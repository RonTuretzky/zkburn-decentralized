// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IZKPassportVerifier, ProofVerificationParams} from "./interfaces/IZKPassportVerifier.sol";

/// @title ZKBurn
/// @notice Mutual-consent reputation registry for anonymous clients ("Johns").
///         A John proves personhood with zkPassport; the scoped nullifier becomes
///         their JohnID. Workers propose interactions, the John confirms from the
///         wallet bound in the proof, and each confirmed interaction grants that
///         worker one burn (flag with note) and one vouch for that JohnID.
/// @dev Fully permissionless: no owner, no admin, no upgradeability.
///      If the zkPassport verifier has no code at the configured address (e.g. Gnosis
///      Chain today), registration proceeds optimistically with `zkVerified = false`.
contract ZKBurn {
    // ---------------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------------

    /// @notice Caller has no confirmed, unused interaction with the JohnID.
    error NoUsableInteraction();
    /// @notice Proof service scope/subscope does not match this contract's configuration.
    error ScopeMismatch();
    /// @notice Proof timestamp is outside the accepted validity window.
    error ProofExpired();
    /// @notice JohnID is already registered.
    error AlreadyRegistered();
    /// @notice Caller is not the wallet bound to the interaction's JohnID.
    error NotJohn();
    /// @notice Interaction has already been confirmed.
    error AlreadyConfirmed();
    /// @notice JohnID is not registered.
    error UnknownJohn();
    /// @notice The zkPassport verifier rejected the proof.
    error InvalidProof();
    /// @notice Verifier-returned unique identifier does not match the proof's nullifier.
    error NullifierMismatch();
    /// @notice Caller wallet is already bound to a JohnID.
    error AlreadyBound();
    /// @notice Proof public inputs are malformed (too short or zero nullifier).
    error InvalidPublicInputs();
    /// @notice Proof service config domain does not match this contract's domain.
    error DomainMismatch();

    // ---------------------------------------------------------------------
    // Types
    // ---------------------------------------------------------------------

    /// @notice A registered anonymous client.
    struct John {
        address account;
        uint64 registeredAt;
        bool zkVerified;
        bool devMode;
        uint32 burnCount;
        uint32 vouchCount;
    }

    /// @notice A worker-proposed, John-confirmed interaction.
    struct Interaction {
        bytes32 johnId;
        address worker;
        uint64 proposedAt;
        uint64 confirmedAt;
        bool burnUsed;
        bool vouchUsed;
    }

    /// @notice A burn or vouch record.
    struct ActionRecord {
        address worker;
        uint64 timestamp;
        uint256 interactionId;
        string note;
    }

    // ---------------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------------

    /// @notice Emitted when a new John registers.
    event JohnRegistered(bytes32 indexed johnId, address indexed account, bool zkVerified, bool devMode);
    /// @notice Emitted when a worker proposes an interaction.
    event InteractionProposed(uint256 indexed id, bytes32 indexed johnId, address indexed worker);
    /// @notice Emitted when the bound John confirms an interaction.
    event InteractionConfirmed(uint256 indexed id, bytes32 indexed johnId, address indexed worker);
    /// @notice Emitted when a worker burns a JohnID.
    event JohnBurned(bytes32 indexed johnId, address indexed worker, uint256 indexed interactionId, string note);
    /// @notice Emitted when a worker vouches for a JohnID.
    event JohnVouched(bytes32 indexed johnId, address indexed worker, uint256 indexed interactionId, string note);

    // ---------------------------------------------------------------------
    // Configuration
    // ---------------------------------------------------------------------

    /// @notice Maximum accepted proof validity period.
    uint256 public constant MAX_VALIDITY = 7 days;

    /// @notice The zkPassport RootVerifier (may have no code on chains where it is not yet deployed).
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

    /// @notice JohnID => John record.
    mapping(bytes32 => John) public johns;
    /// @notice Bound wallet => JohnID (zero if unbound).
    mapping(address => bytes32) public johnIdOf;
    /// @notice All interactions, indexed by id.
    Interaction[] internal interactions;
    /// @notice JohnID => interaction ids referencing it.
    mapping(bytes32 => uint256[]) internal johnInteractionIds;
    /// @notice Worker => interaction ids they proposed.
    mapping(address => uint256[]) internal workerInteractionIds;
    /// @notice JohnID => burn records.
    mapping(bytes32 => ActionRecord[]) internal burnsOf;
    /// @notice JohnID => vouch records.
    mapping(bytes32 => ActionRecord[]) internal vouchesOf;

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

    /// @notice Registers the caller as a John using a zkPassport proof.
    /// @dev If the verifier address has no code (e.g. Gnosis Chain today), the proof's
    ///      structure is still validated but registration proceeds optimistically with
    ///      `zkVerified = false`. When zkPassport deploys the verifier, verification
    ///      becomes automatic.
    /// @param params The zkPassport Solidity verifier parameters (from getSolidityVerifierParameters).
    /// @return johnId The scoped nullifier, now bound to msg.sender.
    function registerJohn(ProofVerificationParams calldata params) external returns (bytes32 johnId) {
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

        // Freshness: proof date must not be in the far future nor older than the
        // validity period (capped at MAX_VALIDITY).
        uint256 ts = uint256(publicInputs[2]);
        if (ts > block.timestamp + 1 days) revert ProofExpired();
        uint256 validity = params.serviceConfig.validityPeriodInSeconds;
        if (validity > MAX_VALIDITY) validity = MAX_VALIDITY;
        if (ts + validity < block.timestamp) revert ProofExpired();

        johnId = publicInputs[len - 2];
        if (johnId == bytes32(0)) revert InvalidPublicInputs();
        if (johns[johnId].registeredAt != 0) revert AlreadyRegistered();
        if (johnIdOf[msg.sender] != bytes32(0)) revert AlreadyBound();

        bool zkVerified;
        if (address(zkPassportVerifier).code.length > 0) {
            (bool verified, bytes32 uniqueIdentifier,) = zkPassportVerifier.verify(params);
            if (!verified) revert InvalidProof();
            if (uniqueIdentifier != johnId) revert NullifierMismatch();
            zkVerified = true;
        }

        johns[johnId] = John({
            account: msg.sender,
            registeredAt: uint64(block.timestamp),
            zkVerified: zkVerified,
            devMode: params.serviceConfig.devMode,
            burnCount: 0,
            vouchCount: 0
        });
        johnIdOf[msg.sender] = johnId;

        emit JohnRegistered(johnId, msg.sender, zkVerified, params.serviceConfig.devMode);
    }

    // ---------------------------------------------------------------------
    // Interactions
    // ---------------------------------------------------------------------

    /// @notice Proposes an interaction with a registered JohnID. Callable by any worker.
    /// @param johnId The JohnID to interact with.
    /// @return id The new interaction id.
    function proposeInteraction(bytes32 johnId) external returns (uint256 id) {
        if (johns[johnId].registeredAt == 0) revert UnknownJohn();

        id = interactions.length;
        interactions.push(
            Interaction({
                johnId: johnId,
                worker: msg.sender,
                proposedAt: uint64(block.timestamp),
                confirmedAt: 0,
                burnUsed: false,
                vouchUsed: false
            })
        );
        johnInteractionIds[johnId].push(id);
        workerInteractionIds[msg.sender].push(id);

        emit InteractionProposed(id, johnId, msg.sender);
    }

    /// @notice Confirms an interaction. Only callable by the wallet bound to the interaction's JohnID.
    /// @param id The interaction id to confirm.
    function confirmInteraction(uint256 id) external {
        Interaction storage it = interactions[id];
        if (msg.sender != johns[it.johnId].account) revert NotJohn();
        if (it.confirmedAt != 0) revert AlreadyConfirmed();

        it.confirmedAt = uint64(block.timestamp);

        emit InteractionConfirmed(id, it.johnId, it.worker);
    }

    // ---------------------------------------------------------------------
    // Burn / vouch
    // ---------------------------------------------------------------------

    /// @notice Burns (flags) a JohnID. Consumes the caller's oldest confirmed,
    ///         burn-unused interaction with that JohnID.
    /// @param johnId The JohnID to burn.
    /// @param note Free-text note explaining the burn.
    function burn(bytes32 johnId, string calldata note) external {
        if (johns[johnId].registeredAt == 0) revert UnknownJohn();

        uint256 interactionId = _consumeInteraction(johnId, true);
        johns[johnId].burnCount++;
        burnsOf[johnId].push(
            ActionRecord({
                worker: msg.sender, timestamp: uint64(block.timestamp), interactionId: interactionId, note: note
            })
        );

        emit JohnBurned(johnId, msg.sender, interactionId, note);
    }

    /// @notice Vouches for a JohnID. Consumes the caller's oldest confirmed,
    ///         vouch-unused interaction with that JohnID.
    /// @param johnId The JohnID to vouch for.
    /// @param note Free-text note (may be empty).
    function vouch(bytes32 johnId, string calldata note) external {
        if (johns[johnId].registeredAt == 0) revert UnknownJohn();

        uint256 interactionId = _consumeInteraction(johnId, false);
        johns[johnId].vouchCount++;
        vouchesOf[johnId].push(
            ActionRecord({
                worker: msg.sender, timestamp: uint64(block.timestamp), interactionId: interactionId, note: note
            })
        );

        emit JohnVouched(johnId, msg.sender, interactionId, note);
    }

    /// @dev Finds and marks the caller's oldest confirmed interaction with `johnId`
    ///      whose burn/vouch slot is unused. Reverts with NoUsableInteraction if none.
    function _consumeInteraction(bytes32 johnId, bool forBurn) internal returns (uint256) {
        uint256[] storage ids = workerInteractionIds[msg.sender];
        uint256 count = ids.length;
        for (uint256 i = 0; i < count; i++) {
            uint256 id = ids[i];
            Interaction storage it = interactions[id];
            if (it.johnId != johnId || it.confirmedAt == 0) continue;
            if (forBurn) {
                if (it.burnUsed) continue;
                it.burnUsed = true;
            } else {
                if (it.vouchUsed) continue;
                it.vouchUsed = true;
            }
            return id;
        }
        revert NoUsableInteraction();
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    /// @notice Returns the reputation status of a JohnID.
    /// @param johnId The JohnID to check.
    /// @return exists True if the JohnID is registered.
    /// @return zkVerified True if registration was verified on-chain by zkPassport.
    /// @return devMode True if the registration proof was generated in dev mode.
    /// @return isBurned True if the JohnID has at least one burn.
    /// @return burnCount Number of burns.
    /// @return vouchCount Number of vouches.
    /// @return lastBurnNote Note of the most recent burn ("" if none).
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
            string memory lastBurnNote
        )
    {
        John storage j = johns[johnId];
        exists = j.registeredAt != 0;
        zkVerified = j.zkVerified;
        devMode = j.devMode;
        burnCount = j.burnCount;
        vouchCount = j.vouchCount;
        isBurned = burnCount > 0;
        ActionRecord[] storage burnRecords = burnsOf[johnId];
        lastBurnNote = burnRecords.length > 0 ? burnRecords[burnRecords.length - 1].note : "";
    }

    /// @notice Returns all burn records for a JohnID.
    /// @param johnId The JohnID.
    function getBurns(bytes32 johnId) external view returns (ActionRecord[] memory) {
        return burnsOf[johnId];
    }

    /// @notice Returns all vouch records for a JohnID.
    /// @param johnId The JohnID.
    function getVouches(bytes32 johnId) external view returns (ActionRecord[] memory) {
        return vouchesOf[johnId];
    }

    /// @notice Returns an interaction by id.
    /// @param id The interaction id.
    function getInteraction(uint256 id) external view returns (Interaction memory) {
        return interactions[id];
    }

    /// @notice Returns the total number of interactions.
    function interactionCount() external view returns (uint256) {
        return interactions.length;
    }

    /// @notice Returns all interaction ids referencing a JohnID.
    /// @param johnId The JohnID.
    function getJohnInteractions(bytes32 johnId) external view returns (uint256[] memory) {
        return johnInteractionIds[johnId];
    }

    /// @notice Returns all interaction ids proposed by a worker.
    /// @param worker The worker address.
    function getWorkerInteractions(address worker) external view returns (uint256[] memory) {
        return workerInteractionIds[worker];
    }

    /// @notice Whether a worker currently has a usable interaction to burn/vouch a JohnID.
    /// @param worker The worker address.
    /// @param johnId The JohnID.
    /// @return canBurn True if the worker has a confirmed, burn-unused interaction.
    /// @return canVouch True if the worker has a confirmed, vouch-unused interaction.
    function canAct(address worker, bytes32 johnId) external view returns (bool canBurn, bool canVouch) {
        uint256[] storage ids = workerInteractionIds[worker];
        uint256 count = ids.length;
        for (uint256 i = 0; i < count; i++) {
            Interaction storage it = interactions[ids[i]];
            if (it.johnId != johnId || it.confirmedAt == 0) continue;
            if (!it.burnUsed) canBurn = true;
            if (!it.vouchUsed) canVouch = true;
            if (canBurn && canVouch) break;
        }
    }
}
