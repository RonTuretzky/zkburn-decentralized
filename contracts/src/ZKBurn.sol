// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IZKPassportVerifier, ProofVerificationParams} from "./interfaces/IZKPassportVerifier.sol";

/// @title ZKBurn
/// @notice Mutual-consent reputation registry for anonymous clients ("Johns").
///         Both parties prove personhood with zkPassport; the scoped nullifier
///         becomes their identity id. A worker proposes an interaction, the John
///         confirms it from the wallet bound in their proof, and each confirmed
///         interaction grants that worker one burn (flag) and one vouch — each
///         retractable by its author.
/// @dev Fully permissionless: no owner, no admin, no upgradeability. If the
///      zkPassport verifier has no code at the configured address (e.g. Gnosis
///      Chain today), registration proceeds optimistically with `zkVerified = false`.
contract ZKBurn {
    // ---------------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------------

    /// @notice Caller is not a registered identity.
    error NotRegistered();
    /// @notice This nullifier is already registered.
    error AlreadyRegistered();
    /// @notice Caller wallet is already bound to an identity.
    error AlreadyBound();
    /// @notice The referenced John is not registered.
    error UnknownJohn();
    /// @notice Worker and John cannot be the same identity.
    error SelfInteraction();
    /// @notice Caller is not the John bound to the interaction.
    error NotJohn();
    /// @notice Caller is not the worker who owns the interaction.
    error NotWorker();
    /// @notice Interaction has not been confirmed by the John.
    error NotConfirmed();
    /// @notice Interaction has already been confirmed.
    error AlreadyConfirmed();
    /// @notice A burn was already issued for this interaction.
    error BurnAlreadyUsed();
    /// @notice A vouch was already issued for this interaction.
    error VouchAlreadyUsed();
    /// @notice No active burn to retract for this interaction.
    error NotBurned();
    /// @notice No active vouch to retract for this interaction.
    error NotVouched();
    /// @notice Proof service scope/subscope does not match this contract.
    error ScopeMismatch();
    /// @notice Proof service config domain does not match this contract.
    error DomainMismatch();
    /// @notice Proof timestamp is outside the accepted validity window.
    error ProofExpired();
    /// @notice The zkPassport verifier rejected the proof.
    error InvalidProof();
    /// @notice Verifier-returned unique identifier does not match the proof's nullifier.
    error NullifierMismatch();
    /// @notice Proof public inputs are malformed (too short or zero nullifier).
    error InvalidPublicInputs();

    // ---------------------------------------------------------------------
    // Types
    // ---------------------------------------------------------------------

    /// @notice A registered, zkPassport-unique identity (a John or a worker).
    struct Identity {
        address account;
        uint64 registeredAt;
        bool zkVerified;
        bool devMode;
    }

    /// @notice A worker-proposed, John-confirmed interaction.
    struct Interaction {
        bytes32 workerId;
        bytes32 johnId;
        uint64 proposedAt;
        uint64 confirmedAt;
        bool burnUsed; // a burn was issued for this interaction (permanent; blocks re-burn)
        bool vouchUsed;
    }

    /// @notice A burn or vouch record (retained even after retraction for auditability).
    struct ActionRecord {
        bytes32 workerId;
        uint256 interactionId;
        uint64 timestamp;
        bool retracted;
        string note;
    }

    /// @notice Aggregate reputation for a John.
    struct Reputation {
        bool exists;
        uint32 burnCount; // active (non-retracted) burns
        uint32 vouchCount; // active (non-retracted) vouches
        uint32 distinctBurners; // distinct workers with >= 1 active burn
        uint32 distinctVouchers; // distinct workers with >= 1 active vouch
    }

    // ---------------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------------

    /// @notice Emitted when a new identity registers.
    event Registered(bytes32 indexed id, address indexed account, bool zkVerified, bool devMode);
    /// @notice Emitted when a worker proposes an interaction.
    event InteractionProposed(uint256 indexed id, bytes32 indexed johnId, bytes32 indexed workerId, address worker);
    /// @notice Emitted when the bound John confirms an interaction.
    event InteractionConfirmed(uint256 indexed id, bytes32 indexed johnId, bytes32 indexed workerId);
    /// @notice Emitted when a worker burns a John via an interaction.
    event Burned(bytes32 indexed johnId, bytes32 indexed workerId, uint256 indexed interactionId, string note);
    /// @notice Emitted when a worker retracts their own burn.
    event BurnRetracted(bytes32 indexed johnId, bytes32 indexed workerId, uint256 indexed interactionId);
    /// @notice Emitted when a worker vouches for a John via an interaction.
    event Vouched(bytes32 indexed johnId, bytes32 indexed workerId, uint256 indexed interactionId, string note);
    /// @notice Emitted when a worker retracts their own vouch.
    event VouchRetracted(bytes32 indexed johnId, bytes32 indexed workerId, uint256 indexed interactionId);

    // ---------------------------------------------------------------------
    // Configuration
    // ---------------------------------------------------------------------

    /// @notice Maximum accepted proof validity period.
    uint256 public constant MAX_VALIDITY = 7 days;

    /// @notice The zkPassport RootVerifier (may have no code where not yet deployed).
    IZKPassportVerifier public immutable zkPassportVerifier;

    /// @notice The zkPassport service domain this contract accepts proofs for.
    string public domain;
    /// @notice The zkPassport service scope (subscope) this contract accepts proofs for.
    string public scope;

    /// @notice bytes32(uint256(sha256(domain)) >> 8) — expected publicInputs[3].
    bytes32 public immutable serviceScopeHash;
    /// @notice bytes32(uint256(sha256(scope)) >> 8) — expected publicInputs[4].
    bytes32 public immutable serviceSubscopeHash;

    // ---------------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------------

    /// @notice Identity id => identity record.
    mapping(bytes32 => Identity) public identities;
    /// @notice Bound wallet => identity id (zero if unbound).
    mapping(address => bytes32) public idOf;

    /// @notice All interactions, indexed by id.
    Interaction[] internal interactions;
    /// @notice John id => interaction ids referencing them.
    mapping(bytes32 => uint256[]) internal johnInteractionIds;
    /// @notice Worker id => interaction ids they proposed.
    mapping(bytes32 => uint256[]) internal workerInteractionIds;

    /// @notice John id => aggregate reputation.
    mapping(bytes32 => Reputation) internal reps;
    /// @notice John id => burn records.
    mapping(bytes32 => ActionRecord[]) internal burnsOf;
    /// @notice John id => vouch records.
    mapping(bytes32 => ActionRecord[]) internal vouchesOf;
    /// @notice interaction id => 1-based index into burnsOf[johnId] (0 = none).
    mapping(uint256 => uint256) internal burnRecordPtr;
    /// @notice interaction id => 1-based index into vouchesOf[johnId] (0 = none).
    mapping(uint256 => uint256) internal vouchRecordPtr;
    /// @notice John id => worker id => active burn count (for distinct-burner tracking).
    mapping(bytes32 => mapping(bytes32 => uint32)) internal activeBurnsBy;
    /// @notice John id => worker id => active vouch count.
    mapping(bytes32 => mapping(bytes32 => uint32)) internal activeVouchesBy;

    // ---------------------------------------------------------------------
    // Constructor
    // ---------------------------------------------------------------------

    /// @param _verifier Address of the zkPassport RootVerifier.
    /// @param _domain zkPassport service domain (e.g. "zkburn.app").
    /// @param _scope zkPassport service scope (e.g. "zkburn-v1").
    constructor(address _verifier, string memory _domain, string memory _scope) {
        zkPassportVerifier = IZKPassportVerifier(_verifier);
        domain = _domain;
        scope = _scope;
        serviceScopeHash = bytes32(uint256(sha256(bytes(_domain))) >> 8);
        serviceSubscopeHash = bytes32(uint256(sha256(bytes(_scope))) >> 8);
    }

    // ---------------------------------------------------------------------
    // Registration
    // ---------------------------------------------------------------------

    /// @notice Registers the caller as a zkPassport-unique identity (John or worker).
    /// @dev If the verifier address has no code (e.g. Gnosis Chain today), the proof's
    ///      scope binding and freshness are still enforced but registration proceeds
    ///      optimistically with `zkVerified = false`.
    /// @param params The zkPassport Solidity verifier parameters.
    /// @return id The scoped nullifier, now bound to msg.sender.
    function register(ProofVerificationParams calldata params) external returns (bytes32 id) {
        bytes32[] calldata publicInputs = params.proofVerificationData.publicInputs;
        uint256 len = publicInputs.length;
        if (len < 8) revert InvalidPublicInputs();

        // Scope binding: the proof must have been generated for this service.
        if (publicInputs[3] != serviceScopeHash || publicInputs[4] != serviceSubscopeHash) {
            revert ScopeMismatch();
        }
        if (keccak256(bytes(params.serviceConfig.domain)) != keccak256(bytes(domain))) {
            revert DomainMismatch();
        }
        if (keccak256(bytes(params.serviceConfig.scope)) != keccak256(bytes(scope))) {
            revert ScopeMismatch();
        }

        // Freshness: proof date must be recent (capped at MAX_VALIDITY) and not far-future.
        uint256 ts = uint256(publicInputs[2]);
        if (ts > block.timestamp + 1 days) revert ProofExpired();
        uint256 validity = params.serviceConfig.validityPeriodInSeconds;
        if (validity > MAX_VALIDITY) validity = MAX_VALIDITY;
        if (ts + validity < block.timestamp) revert ProofExpired();

        id = publicInputs[len - 2];
        if (id == bytes32(0)) revert InvalidPublicInputs();
        if (identities[id].registeredAt != 0) revert AlreadyRegistered();
        if (idOf[msg.sender] != bytes32(0)) revert AlreadyBound();

        bool zkVerified;
        if (address(zkPassportVerifier).code.length > 0) {
            (bool verified, bytes32 uniqueIdentifier,) = zkPassportVerifier.verify(params);
            if (!verified) revert InvalidProof();
            if (uniqueIdentifier != id) revert NullifierMismatch();
            zkVerified = true;
        }

        identities[id] = Identity({
            account: msg.sender,
            registeredAt: uint64(block.timestamp),
            zkVerified: zkVerified,
            devMode: params.serviceConfig.devMode
        });
        idOf[msg.sender] = id;

        emit Registered(id, msg.sender, zkVerified, params.serviceConfig.devMode);
    }

    // ---------------------------------------------------------------------
    // Interactions
    // ---------------------------------------------------------------------

    /// @notice Proposes an interaction with a registered John. Caller must be a
    ///         registered worker; the interaction is credited to their identity.
    /// @param johnId The John to interact with.
    /// @return id The new interaction id.
    function proposeInteraction(bytes32 johnId) external returns (uint256 id) {
        bytes32 workerId = idOf[msg.sender];
        if (workerId == bytes32(0)) revert NotRegistered();
        if (identities[johnId].registeredAt == 0) revert UnknownJohn();
        if (workerId == johnId) revert SelfInteraction();

        // Lazily mark reputation as existing on first reference.
        if (!reps[johnId].exists) reps[johnId].exists = true;

        id = interactions.length;
        interactions.push(
            Interaction({
                workerId: workerId,
                johnId: johnId,
                proposedAt: uint64(block.timestamp),
                confirmedAt: 0,
                burnUsed: false,
                vouchUsed: false
            })
        );
        johnInteractionIds[johnId].push(id);
        workerInteractionIds[workerId].push(id);

        emit InteractionProposed(id, johnId, workerId, msg.sender);
    }

    /// @notice Confirms an interaction. Only callable by the wallet bound to the John.
    /// @param id The interaction id to confirm.
    function confirmInteraction(uint256 id) external {
        Interaction storage it = interactions[id];
        if (msg.sender != identities[it.johnId].account) revert NotJohn();
        if (it.confirmedAt != 0) revert AlreadyConfirmed();

        it.confirmedAt = uint64(block.timestamp);

        emit InteractionConfirmed(id, it.johnId, it.workerId);
    }

    // ---------------------------------------------------------------------
    // Burn / vouch
    // ---------------------------------------------------------------------

    /// @notice Burns (flags) a John via a specific confirmed interaction the caller owns.
    /// @param interactionId The interaction to consume the burn slot of.
    /// @param note Free-text note explaining the burn (public, immutable).
    function burn(uint256 interactionId, string calldata note) external {
        Interaction storage it = interactions[interactionId];
        bytes32 workerId = idOf[msg.sender];
        if (workerId == bytes32(0) || it.workerId != workerId) revert NotWorker();
        if (it.confirmedAt == 0) revert NotConfirmed();
        if (it.burnUsed) revert BurnAlreadyUsed();

        it.burnUsed = true;
        bytes32 johnId = it.johnId;

        Reputation storage rep = reps[johnId];
        rep.burnCount++;
        if (activeBurnsBy[johnId][workerId]++ == 0) rep.distinctBurners++;

        burnsOf[johnId].push(
            ActionRecord({
                workerId: workerId,
                interactionId: interactionId,
                timestamp: uint64(block.timestamp),
                retracted: false,
                note: note
            })
        );
        burnRecordPtr[interactionId] = burnsOf[johnId].length; // 1-based

        emit Burned(johnId, workerId, interactionId, note);
    }

    /// @notice Retracts the caller's own burn on an interaction. The record is kept
    ///         (marked retracted) so history stays auditable; the burn cannot be re-issued.
    /// @param interactionId The interaction whose burn to retract.
    function retractBurn(uint256 interactionId) external {
        Interaction storage it = interactions[interactionId];
        bytes32 workerId = idOf[msg.sender];
        if (workerId == bytes32(0) || it.workerId != workerId) revert NotWorker();

        bytes32 johnId = it.johnId;
        uint256 ptr = burnRecordPtr[interactionId];
        if (ptr == 0 || burnsOf[johnId][ptr - 1].retracted) revert NotBurned();

        burnsOf[johnId][ptr - 1].retracted = true;

        Reputation storage rep = reps[johnId];
        rep.burnCount--;
        if (--activeBurnsBy[johnId][workerId] == 0) rep.distinctBurners--;

        emit BurnRetracted(johnId, workerId, interactionId);
    }

    /// @notice Vouches for a John via a specific confirmed interaction the caller owns.
    /// @param interactionId The interaction to consume the vouch slot of.
    /// @param note Free-text note (may be empty; public, immutable).
    function vouch(uint256 interactionId, string calldata note) external {
        Interaction storage it = interactions[interactionId];
        bytes32 workerId = idOf[msg.sender];
        if (workerId == bytes32(0) || it.workerId != workerId) revert NotWorker();
        if (it.confirmedAt == 0) revert NotConfirmed();
        if (it.vouchUsed) revert VouchAlreadyUsed();

        it.vouchUsed = true;
        bytes32 johnId = it.johnId;

        Reputation storage rep = reps[johnId];
        rep.vouchCount++;
        if (activeVouchesBy[johnId][workerId]++ == 0) rep.distinctVouchers++;

        vouchesOf[johnId].push(
            ActionRecord({
                workerId: workerId,
                interactionId: interactionId,
                timestamp: uint64(block.timestamp),
                retracted: false,
                note: note
            })
        );
        vouchRecordPtr[interactionId] = vouchesOf[johnId].length; // 1-based

        emit Vouched(johnId, workerId, interactionId, note);
    }

    /// @notice Retracts the caller's own vouch on an interaction.
    /// @param interactionId The interaction whose vouch to retract.
    function retractVouch(uint256 interactionId) external {
        Interaction storage it = interactions[interactionId];
        bytes32 workerId = idOf[msg.sender];
        if (workerId == bytes32(0) || it.workerId != workerId) revert NotWorker();

        bytes32 johnId = it.johnId;
        uint256 ptr = vouchRecordPtr[interactionId];
        if (ptr == 0 || vouchesOf[johnId][ptr - 1].retracted) revert NotVouched();

        vouchesOf[johnId][ptr - 1].retracted = true;

        Reputation storage rep = reps[johnId];
        rep.vouchCount--;
        if (--activeVouchesBy[johnId][workerId] == 0) rep.distinctVouchers--;

        emit VouchRetracted(johnId, workerId, interactionId);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    /// @notice Returns the reputation status of a John.
    /// @param johnId The John to check.
    /// @return exists True if the John is registered.
    /// @return zkVerified True if registration was verified on-chain by zkPassport.
    /// @return devMode True if the registration proof was generated in dev mode.
    /// @return isBurned True if the John has at least one active burn.
    /// @return burnCount Number of active burns.
    /// @return vouchCount Number of active vouches.
    /// @return distinctBurners Number of distinct workers with an active burn.
    /// @return distinctVouchers Number of distinct workers with an active vouch.
    /// @return lastBurnNote Note of the most recent active burn ("" if none).
    function checkStatus(bytes32 johnId)
        external
        view
        returns (
            bool exists,
            bool zkVerified,
            bool devMode,
            bool isBurned,
            uint32 burnCount,
            uint32 vouchCount,
            uint32 distinctBurners,
            uint32 distinctVouchers,
            string memory lastBurnNote
        )
    {
        Identity storage idn = identities[johnId];
        exists = idn.registeredAt != 0;
        zkVerified = idn.zkVerified;
        devMode = idn.devMode;

        Reputation storage rep = reps[johnId];
        burnCount = rep.burnCount;
        vouchCount = rep.vouchCount;
        distinctBurners = rep.distinctBurners;
        distinctVouchers = rep.distinctVouchers;
        isBurned = burnCount > 0;

        ActionRecord[] storage records = burnsOf[johnId];
        for (uint256 i = records.length; i > 0; i--) {
            if (!records[i - 1].retracted) {
                lastBurnNote = records[i - 1].note;
                break;
            }
        }
    }

    /// @notice Returns all burn records for a John (including retracted ones).
    function getBurns(bytes32 johnId) external view returns (ActionRecord[] memory) {
        return burnsOf[johnId];
    }

    /// @notice Returns all vouch records for a John (including retracted ones).
    function getVouches(bytes32 johnId) external view returns (ActionRecord[] memory) {
        return vouchesOf[johnId];
    }

    /// @notice Returns an interaction by id.
    function getInteraction(uint256 id) external view returns (Interaction memory) {
        return interactions[id];
    }

    /// @notice Returns the total number of interactions.
    function interactionCount() external view returns (uint256) {
        return interactions.length;
    }

    /// @notice Returns all interaction ids referencing a John.
    function getJohnInteractions(bytes32 johnId) external view returns (uint256[] memory) {
        return johnInteractionIds[johnId];
    }

    /// @notice Returns all interaction ids proposed by a worker.
    function getWorkerInteractions(bytes32 workerId) external view returns (uint256[] memory) {
        return workerInteractionIds[workerId];
    }

    /// @notice O(1) capability check for a specific interaction and caller.
    /// @param interactionId The interaction id.
    /// @param caller The prospective actor (must be the interaction's worker).
    /// @return canBurn True if the caller can currently burn via this interaction.
    /// @return canVouch True if the caller can currently vouch via this interaction.
    /// @return canRetractBurn True if the caller can retract an active burn on it.
    /// @return canRetractVouch True if the caller can retract an active vouch on it.
    function interactionCapabilities(uint256 interactionId, address caller)
        external
        view
        returns (bool canBurn, bool canVouch, bool canRetractBurn, bool canRetractVouch)
    {
        if (interactionId >= interactions.length) return (false, false, false, false);
        Interaction storage it = interactions[interactionId];
        bytes32 workerId = idOf[caller];
        if (workerId == bytes32(0) || it.workerId != workerId || it.confirmedAt == 0) {
            return (false, false, false, false);
        }
        canBurn = !it.burnUsed;
        canVouch = !it.vouchUsed;
        uint256 bptr = burnRecordPtr[interactionId];
        canRetractBurn = bptr != 0 && !burnsOf[it.johnId][bptr - 1].retracted;
        uint256 vptr = vouchRecordPtr[interactionId];
        canRetractVouch = vptr != 0 && !vouchesOf[it.johnId][vptr - 1].retracted;
    }
}
