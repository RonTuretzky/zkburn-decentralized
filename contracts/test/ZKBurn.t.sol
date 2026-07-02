// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ZKBurn} from "../src/ZKBurn.sol";
import {
    IZKPassportVerifier,
    ProofVerificationData,
    ProofVerificationParams,
    ServiceConfig
} from "../src/interfaces/IZKPassportVerifier.sol";

/// @notice Configurable mock of the zkPassport RootVerifier for verified-mode tests.
contract MockZKPassportVerifier is IZKPassportVerifier {
    bool internal verifiedResult = true;
    bool internal uidOverridden;
    bytes32 internal uidOverride;

    function setVerified(bool v) external {
        verifiedResult = v;
    }

    function setUniqueIdentifier(bytes32 uid) external {
        uidOverridden = true;
        uidOverride = uid;
    }

    function verify(ProofVerificationParams calldata params)
        external
        view
        returns (bool verified, bytes32 uniqueIdentifier, address helper)
    {
        bytes32[] calldata publicInputs = params.proofVerificationData.publicInputs;
        uniqueIdentifier = uidOverridden ? uidOverride : publicInputs[publicInputs.length - 2];
        return (verifiedResult, uniqueIdentifier, address(0));
    }
}

contract ZKBurnTest is Test {
    string constant DOMAIN = "zkburn.app";
    string constant SCOPE = "zkburn-v1";
    uint256 constant START_TIME = 1_750_000_000;
    uint256 constant VALIDITY = 1 days;
    // No code at this address in the test environment => optimistic mode.
    address constant EMPTY_VERIFIER = 0x1D000001000EFD9a6371f4d90bB8920D5431c0D8;

    ZKBurn zkburn; // optimistic-mode instance (verifier address has no code)
    ZKBurn zkburnVerified; // verified-mode instance (mock verifier)
    MockZKPassportVerifier mockVerifier;

    // Precomputed in setUp: sha256 is a precompile STATICCALL, so hashing inside
    // _buildParams would consume a pending vm.prank/vm.expectRevert/vm.expectEmit
    // when params are built inline as a call argument.
    bytes32 internal domainHash;
    bytes32 internal subscopeHash;

    address john = makeAddr("john");
    address john2 = makeAddr("john2");
    address worker = makeAddr("worker");
    address worker2 = makeAddr("worker2");

    bytes32 constant JOHN_ID = bytes32(uint256(0xBEEF));
    bytes32 constant JOHN_ID_2 = bytes32(uint256(0xCAFE));

    event JohnRegistered(bytes32 indexed johnId, address indexed account, bool zkVerified, bool devMode);
    event InteractionProposed(uint256 indexed id, bytes32 indexed johnId, address indexed worker);
    event InteractionConfirmed(uint256 indexed id, bytes32 indexed johnId, address indexed worker);
    event JohnBurned(bytes32 indexed johnId, address indexed worker, uint256 indexed interactionId, string note);
    event JohnVouched(bytes32 indexed johnId, address indexed worker, uint256 indexed interactionId, string note);

    function setUp() public {
        vm.warp(START_TIME);
        domainHash = _scopeHash(DOMAIN);
        subscopeHash = _scopeHash(SCOPE);
        assertEq(EMPTY_VERIFIER.code.length, 0, "sanity: canonical address must be empty locally");
        zkburn = new ZKBurn(EMPTY_VERIFIER, DOMAIN, SCOPE);
        mockVerifier = new MockZKPassportVerifier();
        zkburnVerified = new ZKBurn(address(mockVerifier), DOMAIN, SCOPE);
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    /// @dev Real zkPassport scope hashing: bytes32(uint256(sha256(input)) >> 8).
    function _scopeHash(string memory input) internal pure returns (bytes32) {
        return bytes32(uint256(sha256(bytes(input))) >> 8);
    }

    /// @dev Builds well-formed ProofVerificationParams matching the outer-proof
    ///      publicInputs layout, with real sha256 scope hashes.
    function _buildParams(bytes32 nullifier, uint256 proofTimestamp, uint256 validityPeriod, bool devMode)
        internal
        view
        returns (ProofVerificationParams memory)
    {
        bytes32[] memory publicInputs = new bytes32[](8);
        publicInputs[0] = bytes32(uint256(1)); // certificate_registry_root
        publicInputs[1] = bytes32(uint256(1)); // circuit_registry_root
        publicInputs[2] = bytes32(proofTimestamp); // current_date
        publicInputs[3] = domainHash; // service_scope
        publicInputs[4] = subscopeHash; // service_subscope
        publicInputs[5] = bytes32(uint256(1)); // nullifier_type
        publicInputs[6] = nullifier; // scoped_nullifier (JohnID)
        publicInputs[7] = bytes32(0); // oprf_pk_hash

        return ProofVerificationParams({
            version: bytes32("test"),
            proofVerificationData: ProofVerificationData({
                vkeyHash: bytes32(0), proof: hex"", publicInputs: publicInputs
            }),
            committedInputs: hex"",
            serviceConfig: ServiceConfig({
                validityPeriodInSeconds: validityPeriod, domain: DOMAIN, scope: SCOPE, devMode: devMode
            })
        });
    }

    function _validParams(bytes32 nullifier) internal view returns (ProofVerificationParams memory) {
        return _buildParams(nullifier, block.timestamp, VALIDITY, false);
    }

    /// @dev Registers `nullifier` for `account` on the optimistic instance.
    function _register(address account, bytes32 nullifier) internal {
        vm.prank(account);
        zkburn.registerJohn(_validParams(nullifier));
    }

    /// @dev Full register + propose + confirm flow; returns the interaction id.
    function _registeredConfirmedInteraction(address johnAccount, bytes32 johnId, address workerAccount)
        internal
        returns (uint256 id)
    {
        _register(johnAccount, johnId);
        vm.prank(workerAccount);
        id = zkburn.proposeInteraction(johnId);
        vm.prank(johnAccount);
        zkburn.confirmInteraction(id);
    }

    // ------------------------------------------------------------------
    // Constructor
    // ------------------------------------------------------------------

    function test_constructor_config() public view {
        assertEq(address(zkburn.zkPassportVerifier()), EMPTY_VERIFIER);
        assertEq(zkburn.domain(), DOMAIN);
        assertEq(zkburn.scope(), SCOPE);
        assertEq(zkburn.serviceScopeHash(), _scopeHash(DOMAIN));
        assertEq(zkburn.serviceSubscopeHash(), _scopeHash(SCOPE));
        assertEq(zkburn.MAX_VALIDITY(), 7 days);
    }

    // ------------------------------------------------------------------
    // registerJohn — optimistic mode
    // ------------------------------------------------------------------

    function test_register_optimistic_happyPath() public {
        vm.expectEmit(true, true, true, true);
        emit JohnRegistered(JOHN_ID, john, false, false);

        vm.prank(john);
        bytes32 returnedId = zkburn.registerJohn(_validParams(JOHN_ID));

        assertEq(returnedId, JOHN_ID);
        assertEq(zkburn.johnIdOf(john), JOHN_ID);

        (address account, uint64 registeredAt, bool zkVerified, bool devMode, uint32 burnCount, uint32 vouchCount) =
            zkburn.johns(JOHN_ID);
        assertEq(account, john);
        assertEq(registeredAt, uint64(START_TIME));
        assertFalse(zkVerified); // optimistic: verifier has no code
        assertFalse(devMode);
        assertEq(burnCount, 0);
        assertEq(vouchCount, 0);
    }

    function test_register_storesDevModeFlag() public {
        vm.prank(john);
        zkburn.registerJohn(_buildParams(JOHN_ID, block.timestamp, VALIDITY, true));
        (,,, bool devMode,,) = zkburn.johns(JOHN_ID);
        assertTrue(devMode);
    }

    function test_register_revert_publicInputsTooShort() public {
        ProofVerificationParams memory params = _validParams(JOHN_ID);
        params.proofVerificationData.publicInputs = new bytes32[](7);
        vm.prank(john);
        vm.expectRevert(ZKBurn.InvalidPublicInputs.selector);
        zkburn.registerJohn(params);
    }

    function test_register_revert_serviceScopeMismatch() public {
        ProofVerificationParams memory params = _validParams(JOHN_ID);
        params.proofVerificationData.publicInputs[3] = _scopeHash("evil.app");
        vm.prank(john);
        vm.expectRevert(ZKBurn.ScopeMismatch.selector);
        zkburn.registerJohn(params);
    }

    function test_register_revert_serviceSubscopeMismatch() public {
        ProofVerificationParams memory params = _validParams(JOHN_ID);
        params.proofVerificationData.publicInputs[4] = _scopeHash("evil-scope");
        vm.prank(john);
        vm.expectRevert(ZKBurn.ScopeMismatch.selector);
        zkburn.registerJohn(params);
    }

    function test_register_revert_domainStringMismatch() public {
        ProofVerificationParams memory params = _validParams(JOHN_ID);
        params.serviceConfig.domain = "evil.app";
        vm.prank(john);
        vm.expectRevert(ZKBurn.DomainMismatch.selector);
        zkburn.registerJohn(params);
    }

    function test_register_revert_scopeStringMismatch() public {
        ProofVerificationParams memory params = _validParams(JOHN_ID);
        params.serviceConfig.scope = "evil-scope";
        vm.prank(john);
        vm.expectRevert(ZKBurn.ScopeMismatch.selector);
        zkburn.registerJohn(params);
    }

    function test_register_revert_expiredProof() public {
        // Proof dated beyond its validity window.
        ProofVerificationParams memory params = _buildParams(JOHN_ID, block.timestamp - VALIDITY - 1, VALIDITY, false);
        vm.prank(john);
        vm.expectRevert(ZKBurn.ProofExpired.selector);
        zkburn.registerJohn(params);
    }

    function test_register_revert_futureDatedProof() public {
        ProofVerificationParams memory params = _buildParams(JOHN_ID, block.timestamp + 1 days + 1, VALIDITY, false);
        vm.prank(john);
        vm.expectRevert(ZKBurn.ProofExpired.selector);
        zkburn.registerJohn(params);
    }

    function test_register_allows_slightlyFutureDatedProof() public {
        ProofVerificationParams memory params = _buildParams(JOHN_ID, block.timestamp + 1 days, VALIDITY, false);
        vm.prank(john);
        zkburn.registerJohn(params);
        assertEq(zkburn.johnIdOf(john), JOHN_ID);
    }

    function test_register_validityCappedAtMaxValidity() public {
        // Proof is 7 days + 1 second old; claimed validity of 30 days must be capped at 7 days.
        ProofVerificationParams memory params = _buildParams(JOHN_ID, block.timestamp - 7 days - 1, 30 days, false);
        vm.prank(john);
        vm.expectRevert(ZKBurn.ProofExpired.selector);
        zkburn.registerJohn(params);

        // Exactly 7 days old passes.
        params = _buildParams(JOHN_ID, block.timestamp - 7 days, 30 days, false);
        vm.prank(john);
        zkburn.registerJohn(params);
        assertEq(zkburn.johnIdOf(john), JOHN_ID);
    }

    function test_register_revert_zeroNullifier() public {
        ProofVerificationParams memory params = _validParams(bytes32(0));
        vm.prank(john);
        vm.expectRevert(ZKBurn.InvalidPublicInputs.selector);
        zkburn.registerJohn(params);
    }

    function test_register_revert_duplicateJohnId() public {
        _register(john, JOHN_ID);
        vm.prank(john2);
        vm.expectRevert(ZKBurn.AlreadyRegistered.selector);
        zkburn.registerJohn(_validParams(JOHN_ID));
    }

    function test_register_revert_addressAlreadyBound() public {
        _register(john, JOHN_ID);
        vm.prank(john);
        vm.expectRevert(ZKBurn.AlreadyBound.selector);
        zkburn.registerJohn(_validParams(JOHN_ID_2));
    }

    // ------------------------------------------------------------------
    // registerJohn — verified mode (mock verifier has code)
    // ------------------------------------------------------------------

    function test_register_verified_happyPath() public {
        vm.expectEmit(true, true, true, true, address(zkburnVerified));
        emit JohnRegistered(JOHN_ID, john, true, false);

        vm.prank(john);
        bytes32 returnedId = zkburnVerified.registerJohn(_validParams(JOHN_ID));

        assertEq(returnedId, JOHN_ID);
        (,, bool zkVerified,,,) = zkburnVerified.johns(JOHN_ID);
        assertTrue(zkVerified);
    }

    function test_register_verified_revert_verifierRejects() public {
        mockVerifier.setVerified(false);
        vm.prank(john);
        vm.expectRevert(ZKBurn.InvalidProof.selector);
        zkburnVerified.registerJohn(_validParams(JOHN_ID));
    }

    function test_register_verified_revert_nullifierMismatch() public {
        mockVerifier.setUniqueIdentifier(bytes32(uint256(0xDEAD)));
        vm.prank(john);
        vm.expectRevert(ZKBurn.NullifierMismatch.selector);
        zkburnVerified.registerJohn(_validParams(JOHN_ID));
    }

    // ------------------------------------------------------------------
    // proposeInteraction
    // ------------------------------------------------------------------

    function test_propose_revert_unknownJohn() public {
        vm.prank(worker);
        vm.expectRevert(ZKBurn.UnknownJohn.selector);
        zkburn.proposeInteraction(JOHN_ID);
    }

    function test_propose_happyPath() public {
        _register(john, JOHN_ID);

        vm.expectEmit(true, true, true, true);
        emit InteractionProposed(0, JOHN_ID, worker);

        vm.prank(worker);
        uint256 id = zkburn.proposeInteraction(JOHN_ID);

        assertEq(id, 0);
        assertEq(zkburn.interactionCount(), 1);

        ZKBurn.Interaction memory it = zkburn.getInteraction(id);
        assertEq(it.johnId, JOHN_ID);
        assertEq(it.worker, worker);
        assertEq(it.proposedAt, uint64(START_TIME));
        assertEq(it.confirmedAt, 0);
        assertFalse(it.burnUsed);
        assertFalse(it.vouchUsed);

        uint256[] memory johnIds = zkburn.getJohnInteractions(JOHN_ID);
        assertEq(johnIds.length, 1);
        assertEq(johnIds[0], id);

        uint256[] memory workerIds = zkburn.getWorkerInteractions(worker);
        assertEq(workerIds.length, 1);
        assertEq(workerIds[0], id);
    }

    function test_propose_idsIncrement() public {
        _register(john, JOHN_ID);
        vm.prank(worker);
        assertEq(zkburn.proposeInteraction(JOHN_ID), 0);
        vm.prank(worker2);
        assertEq(zkburn.proposeInteraction(JOHN_ID), 1);
        assertEq(zkburn.interactionCount(), 2);
    }

    // ------------------------------------------------------------------
    // confirmInteraction
    // ------------------------------------------------------------------

    function test_confirm_happyPath() public {
        _register(john, JOHN_ID);
        vm.prank(worker);
        uint256 id = zkburn.proposeInteraction(JOHN_ID);

        vm.warp(START_TIME + 100);
        vm.expectEmit(true, true, true, true);
        emit InteractionConfirmed(id, JOHN_ID, worker);

        vm.prank(john);
        zkburn.confirmInteraction(id);

        assertEq(zkburn.getInteraction(id).confirmedAt, uint64(START_TIME + 100));
    }

    function test_confirm_revert_notJohn() public {
        _register(john, JOHN_ID);
        vm.prank(worker);
        uint256 id = zkburn.proposeInteraction(JOHN_ID);

        // The proposing worker cannot confirm.
        vm.prank(worker);
        vm.expectRevert(ZKBurn.NotJohn.selector);
        zkburn.confirmInteraction(id);

        // Nor can another registered john.
        _register(john2, JOHN_ID_2);
        vm.prank(john2);
        vm.expectRevert(ZKBurn.NotJohn.selector);
        zkburn.confirmInteraction(id);
    }

    function test_confirm_revert_alreadyConfirmed() public {
        uint256 id = _registeredConfirmedInteraction(john, JOHN_ID, worker);
        vm.prank(john);
        vm.expectRevert(ZKBurn.AlreadyConfirmed.selector);
        zkburn.confirmInteraction(id);
    }

    function test_confirm_revert_nonexistentInteraction() public {
        vm.prank(john);
        vm.expectRevert(); // array out-of-bounds panic
        zkburn.confirmInteraction(0);
    }

    // ------------------------------------------------------------------
    // burn
    // ------------------------------------------------------------------

    function test_burn_revert_unknownJohn() public {
        vm.prank(worker);
        vm.expectRevert(ZKBurn.UnknownJohn.selector);
        zkburn.burn(JOHN_ID, "bad");
    }

    function test_burn_revert_noInteraction() public {
        _register(john, JOHN_ID);
        vm.prank(worker);
        vm.expectRevert(ZKBurn.NoUsableInteraction.selector);
        zkburn.burn(JOHN_ID, "bad");
    }

    function test_burn_revert_unconfirmedInteraction() public {
        _register(john, JOHN_ID);
        vm.prank(worker);
        zkburn.proposeInteraction(JOHN_ID);
        vm.prank(worker);
        vm.expectRevert(ZKBurn.NoUsableInteraction.selector);
        zkburn.burn(JOHN_ID, "bad");
    }

    function test_burn_revert_otherWorkersInteractionUnusable() public {
        _registeredConfirmedInteraction(john, JOHN_ID, worker);
        // worker2 has no interaction of their own with this john.
        vm.prank(worker2);
        vm.expectRevert(ZKBurn.NoUsableInteraction.selector);
        zkburn.burn(JOHN_ID, "bad");
    }

    function test_burn_revert_interactionWithDifferentJohnUnusable() public {
        _registeredConfirmedInteraction(john, JOHN_ID, worker);
        _register(john2, JOHN_ID_2);
        // worker's confirmed interaction is with JOHN_ID, not JOHN_ID_2.
        vm.prank(worker);
        vm.expectRevert(ZKBurn.NoUsableInteraction.selector);
        zkburn.burn(JOHN_ID_2, "bad");
    }

    function test_burn_happyPath() public {
        uint256 id = _registeredConfirmedInteraction(john, JOHN_ID, worker);

        vm.expectEmit(true, true, true, true);
        emit JohnBurned(JOHN_ID, worker, id, "stole my lunch");

        vm.prank(worker);
        zkburn.burn(JOHN_ID, "stole my lunch");

        assertTrue(zkburn.getInteraction(id).burnUsed);
        (,,,, uint32 burnCount,) = zkburn.johns(JOHN_ID);
        assertEq(burnCount, 1);

        ZKBurn.ActionRecord[] memory burns = zkburn.getBurns(JOHN_ID);
        assertEq(burns.length, 1);
        assertEq(burns[0].worker, worker);
        assertEq(burns[0].timestamp, uint64(START_TIME));
        assertEq(burns[0].interactionId, id);
        assertEq(burns[0].note, "stole my lunch");
    }

    function test_burn_revert_onceperInteraction() public {
        _registeredConfirmedInteraction(john, JOHN_ID, worker);
        vm.prank(worker);
        zkburn.burn(JOHN_ID, "first");
        vm.prank(worker);
        vm.expectRevert(ZKBurn.NoUsableInteraction.selector);
        zkburn.burn(JOHN_ID, "second");
    }

    function test_burn_multipleInteractions_multipleBurns() public {
        uint256 id0 = _registeredConfirmedInteraction(john, JOHN_ID, worker);
        vm.prank(worker);
        uint256 id1 = zkburn.proposeInteraction(JOHN_ID);
        vm.prank(john);
        zkburn.confirmInteraction(id1);

        // Oldest interaction is consumed first.
        vm.prank(worker);
        zkburn.burn(JOHN_ID, "first");
        assertTrue(zkburn.getInteraction(id0).burnUsed);
        assertFalse(zkburn.getInteraction(id1).burnUsed);

        vm.prank(worker);
        zkburn.burn(JOHN_ID, "second");
        assertTrue(zkburn.getInteraction(id1).burnUsed);

        (,,,, uint32 burnCount,) = zkburn.johns(JOHN_ID);
        assertEq(burnCount, 2);
        assertEq(zkburn.getBurns(JOHN_ID).length, 2);

        vm.prank(worker);
        vm.expectRevert(ZKBurn.NoUsableInteraction.selector);
        zkburn.burn(JOHN_ID, "third");
    }

    // ------------------------------------------------------------------
    // vouch
    // ------------------------------------------------------------------

    function test_vouch_revert_unknownJohn() public {
        vm.prank(worker);
        vm.expectRevert(ZKBurn.UnknownJohn.selector);
        zkburn.vouch(JOHN_ID, "");
    }

    function test_vouch_revert_noInteraction() public {
        _register(john, JOHN_ID);
        vm.prank(worker);
        vm.expectRevert(ZKBurn.NoUsableInteraction.selector);
        zkburn.vouch(JOHN_ID, "");
    }

    function test_vouch_revert_unconfirmedInteraction() public {
        _register(john, JOHN_ID);
        vm.prank(worker);
        zkburn.proposeInteraction(JOHN_ID);
        vm.prank(worker);
        vm.expectRevert(ZKBurn.NoUsableInteraction.selector);
        zkburn.vouch(JOHN_ID, "");
    }

    function test_vouch_happyPath() public {
        uint256 id = _registeredConfirmedInteraction(john, JOHN_ID, worker);

        vm.expectEmit(true, true, true, true);
        emit JohnVouched(JOHN_ID, worker, id, "great client");

        vm.prank(worker);
        zkburn.vouch(JOHN_ID, "great client");

        assertTrue(zkburn.getInteraction(id).vouchUsed);
        (,,,,, uint32 vouchCount) = zkburn.johns(JOHN_ID);
        assertEq(vouchCount, 1);

        ZKBurn.ActionRecord[] memory vouches = zkburn.getVouches(JOHN_ID);
        assertEq(vouches.length, 1);
        assertEq(vouches[0].worker, worker);
        assertEq(vouches[0].interactionId, id);
        assertEq(vouches[0].note, "great client");
    }

    function test_vouch_revert_oncePerInteraction() public {
        _registeredConfirmedInteraction(john, JOHN_ID, worker);
        vm.prank(worker);
        zkburn.vouch(JOHN_ID, "");
        vm.prank(worker);
        vm.expectRevert(ZKBurn.NoUsableInteraction.selector);
        zkburn.vouch(JOHN_ID, "");
    }

    function test_burnAndVouch_independentOnSameInteraction() public {
        uint256 id = _registeredConfirmedInteraction(john, JOHN_ID, worker);

        vm.prank(worker);
        zkburn.burn(JOHN_ID, "note");
        vm.prank(worker);
        zkburn.vouch(JOHN_ID, "but also fine");

        ZKBurn.Interaction memory it = zkburn.getInteraction(id);
        assertTrue(it.burnUsed);
        assertTrue(it.vouchUsed);

        (,,,, uint32 burnCount, uint32 vouchCount) = zkburn.johns(JOHN_ID);
        assertEq(burnCount, 1);
        assertEq(vouchCount, 1);
    }

    // ------------------------------------------------------------------
    // checkStatus
    // ------------------------------------------------------------------

    function test_checkStatus_nonexistent() public view {
        (
            bool exists,
            bool zkVerified,
            bool devMode,
            bool isBurned,
            uint32 burnCount,
            uint32 vouchCount,
            string memory lastBurnNote
        ) = zkburn.checkStatus(JOHN_ID);
        assertFalse(exists);
        assertFalse(zkVerified);
        assertFalse(devMode);
        assertFalse(isBurned);
        assertEq(burnCount, 0);
        assertEq(vouchCount, 0);
        assertEq(lastBurnNote, "");
    }

    function test_checkStatus_clean() public {
        _registeredConfirmedInteraction(john, JOHN_ID, worker);
        vm.prank(worker);
        zkburn.vouch(JOHN_ID, "");

        (bool exists,,, bool isBurned, uint32 burnCount, uint32 vouchCount, string memory lastBurnNote) =
            zkburn.checkStatus(JOHN_ID);
        assertTrue(exists);
        assertFalse(isBurned);
        assertEq(burnCount, 0);
        assertEq(vouchCount, 1);
        assertEq(lastBurnNote, "");
    }

    function test_checkStatus_burned_lastNote() public {
        _registeredConfirmedInteraction(john, JOHN_ID, worker);
        vm.prank(worker);
        zkburn.burn(JOHN_ID, "first note");

        vm.prank(worker);
        uint256 id1 = zkburn.proposeInteraction(JOHN_ID);
        vm.prank(john);
        zkburn.confirmInteraction(id1);
        vm.prank(worker);
        zkburn.burn(JOHN_ID, "second note");

        (bool exists,,, bool isBurned, uint32 burnCount,, string memory lastBurnNote) = zkburn.checkStatus(JOHN_ID);
        assertTrue(exists);
        assertTrue(isBurned);
        assertEq(burnCount, 2);
        assertEq(lastBurnNote, "second note");
    }

    function test_checkStatus_verifiedFlag() public {
        vm.prank(john);
        zkburnVerified.registerJohn(_validParams(JOHN_ID));
        (, bool zkVerified,,,,,) = zkburnVerified.checkStatus(JOHN_ID);
        assertTrue(zkVerified);
    }

    // ------------------------------------------------------------------
    // canAct
    // ------------------------------------------------------------------

    function test_canAct_lifecycle() public {
        // Unregistered john / no interactions.
        (bool canBurn, bool canVouch) = zkburn.canAct(worker, JOHN_ID);
        assertFalse(canBurn);
        assertFalse(canVouch);

        // Proposed but unconfirmed.
        _register(john, JOHN_ID);
        vm.prank(worker);
        uint256 id = zkburn.proposeInteraction(JOHN_ID);
        (canBurn, canVouch) = zkburn.canAct(worker, JOHN_ID);
        assertFalse(canBurn);
        assertFalse(canVouch);

        // Confirmed: both available.
        vm.prank(john);
        zkburn.confirmInteraction(id);
        (canBurn, canVouch) = zkburn.canAct(worker, JOHN_ID);
        assertTrue(canBurn);
        assertTrue(canVouch);

        // Other workers unaffected.
        (canBurn, canVouch) = zkburn.canAct(worker2, JOHN_ID);
        assertFalse(canBurn);
        assertFalse(canVouch);

        // Burn used: only vouch remains.
        vm.prank(worker);
        zkburn.burn(JOHN_ID, "note");
        (canBurn, canVouch) = zkburn.canAct(worker, JOHN_ID);
        assertFalse(canBurn);
        assertTrue(canVouch);

        // Vouch used too: neither.
        vm.prank(worker);
        zkburn.vouch(JOHN_ID, "");
        (canBurn, canVouch) = zkburn.canAct(worker, JOHN_ID);
        assertFalse(canBurn);
        assertFalse(canVouch);
    }

    function test_canAct_scopedToJohnId() public {
        _registeredConfirmedInteraction(john, JOHN_ID, worker);
        _register(john2, JOHN_ID_2);
        (bool canBurn, bool canVouch) = zkburn.canAct(worker, JOHN_ID_2);
        assertFalse(canBurn);
        assertFalse(canVouch);
    }

    // ------------------------------------------------------------------
    // Multi-actor integration
    // ------------------------------------------------------------------

    function test_integration_twoWorkersTwoJohns() public {
        _register(john, JOHN_ID);
        _register(john2, JOHN_ID_2);

        vm.prank(worker);
        uint256 idA = zkburn.proposeInteraction(JOHN_ID);
        vm.prank(worker2);
        uint256 idB = zkburn.proposeInteraction(JOHN_ID);
        vm.prank(worker);
        uint256 idC = zkburn.proposeInteraction(JOHN_ID_2);

        vm.prank(john);
        zkburn.confirmInteraction(idA);
        vm.prank(john);
        zkburn.confirmInteraction(idB);
        vm.prank(john2);
        zkburn.confirmInteraction(idC);

        vm.prank(worker);
        zkburn.burn(JOHN_ID, "worker1 burn");
        vm.prank(worker2);
        zkburn.vouch(JOHN_ID, "worker2 vouch");
        vm.prank(worker);
        zkburn.vouch(JOHN_ID_2, "worker1 vouch for john2");

        (,,, bool isBurned1, uint32 burns1, uint32 vouches1, string memory note1) = zkburn.checkStatus(JOHN_ID);
        assertTrue(isBurned1);
        assertEq(burns1, 1);
        assertEq(vouches1, 1);
        assertEq(note1, "worker1 burn");

        (,,, bool isBurned2, uint32 burns2, uint32 vouches2,) = zkburn.checkStatus(JOHN_ID_2);
        assertFalse(isBurned2);
        assertEq(burns2, 0);
        assertEq(vouches2, 1);

        assertEq(zkburn.getWorkerInteractions(worker).length, 2);
        assertEq(zkburn.getWorkerInteractions(worker2).length, 1);
        assertEq(zkburn.getJohnInteractions(JOHN_ID).length, 2);
        assertEq(zkburn.getJohnInteractions(JOHN_ID_2).length, 1);
    }
}
