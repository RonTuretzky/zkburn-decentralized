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
    address constant EMPTY_VERIFIER = 0x1D000001000EFD9a6371f4d90bB8920D5431c0D8;

    ZKBurn zkburn; // optimistic-mode instance (verifier address has no code)
    ZKBurn zkburnVerified; // verified-mode instance (mock verifier)
    MockZKPassportVerifier mockVerifier;

    bytes32 internal domainHash;
    bytes32 internal subscopeHash;

    address john = makeAddr("john");
    address john2 = makeAddr("john2");
    address worker = makeAddr("worker");
    address worker2 = makeAddr("worker2");
    address stranger = makeAddr("stranger");

    bytes32 constant JOHN_ID = bytes32(uint256(0xBEEF));
    bytes32 constant JOHN_ID_2 = bytes32(uint256(0xCAFE));
    bytes32 constant WORKER_ID = bytes32(uint256(0xF00D));
    bytes32 constant WORKER_ID_2 = bytes32(uint256(0xD00D));

    event Registered(bytes32 indexed id, address indexed account, bool zkVerified, bool devMode);
    event InteractionProposed(uint256 indexed id, bytes32 indexed johnId, bytes32 indexed workerId, address worker);
    event InteractionConfirmed(uint256 indexed id, bytes32 indexed johnId, bytes32 indexed workerId);
    event Burned(bytes32 indexed johnId, bytes32 indexed workerId, uint256 indexed interactionId, string note);
    event BurnRetracted(bytes32 indexed johnId, bytes32 indexed workerId, uint256 indexed interactionId);
    event Vouched(bytes32 indexed johnId, bytes32 indexed workerId, uint256 indexed interactionId, string note);
    event VouchRetracted(bytes32 indexed johnId, bytes32 indexed workerId, uint256 indexed interactionId);

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

    function _scopeHash(string memory input) internal pure returns (bytes32) {
        return bytes32(uint256(sha256(bytes(input))) >> 8);
    }

    function _buildParams(bytes32 nullifier, uint256 proofTimestamp, uint256 validityPeriod, bool devMode)
        internal
        view
        returns (ProofVerificationParams memory)
    {
        bytes32[] memory publicInputs = new bytes32[](8);
        publicInputs[0] = bytes32(uint256(1));
        publicInputs[1] = bytes32(uint256(1));
        publicInputs[2] = bytes32(proofTimestamp);
        publicInputs[3] = domainHash;
        publicInputs[4] = subscopeHash;
        publicInputs[5] = bytes32(uint256(1));
        publicInputs[6] = nullifier;
        publicInputs[7] = bytes32(0);

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

    function _register(address account, bytes32 nullifier) internal {
        vm.prank(account);
        zkburn.register(_validParams(nullifier));
    }

    /// @dev Registers both parties, proposes and confirms an interaction; returns its id.
    function _confirmedInteraction(address johnAcc, bytes32 johnId, address workerAcc, bytes32 workerId)
        internal
        returns (uint256 id)
    {
        _register(johnAcc, johnId);
        _register(workerAcc, workerId);
        vm.prank(workerAcc);
        id = zkburn.proposeInteraction(johnId);
        vm.prank(johnAcc);
        zkburn.confirmInteraction(id);
    }

    /// @dev The canonical john+worker confirmed interaction used across burn/vouch tests.
    function _setupBurnable() internal returns (uint256 id) {
        return _confirmedInteraction(john, JOHN_ID, worker, WORKER_ID);
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
    // register — optimistic mode
    // ------------------------------------------------------------------

    function test_register_optimistic_happyPath() public {
        vm.expectEmit(true, true, true, true);
        emit Registered(JOHN_ID, john, false, false);

        vm.prank(john);
        bytes32 returnedId = zkburn.register(_validParams(JOHN_ID));

        assertEq(returnedId, JOHN_ID);
        assertEq(zkburn.idOf(john), JOHN_ID);

        (address account, uint64 registeredAt, bool zkVerified, bool devMode) = zkburn.identities(JOHN_ID);
        assertEq(account, john);
        assertEq(registeredAt, uint64(START_TIME));
        assertFalse(zkVerified);
        assertFalse(devMode);
    }

    function test_register_storesDevModeFlag() public {
        vm.prank(john);
        zkburn.register(_buildParams(JOHN_ID, block.timestamp, VALIDITY, true));
        (,,, bool devMode) = zkburn.identities(JOHN_ID);
        assertTrue(devMode);
    }

    function test_register_revert_publicInputsTooShort() public {
        ProofVerificationParams memory params = _validParams(JOHN_ID);
        params.proofVerificationData.publicInputs = new bytes32[](7);
        vm.prank(john);
        vm.expectRevert(ZKBurn.InvalidPublicInputs.selector);
        zkburn.register(params);
    }

    function test_register_revert_serviceScopeMismatch() public {
        ProofVerificationParams memory params = _validParams(JOHN_ID);
        params.proofVerificationData.publicInputs[3] = _scopeHash("evil.app");
        vm.prank(john);
        vm.expectRevert(ZKBurn.ScopeMismatch.selector);
        zkburn.register(params);
    }

    function test_register_revert_serviceSubscopeMismatch() public {
        ProofVerificationParams memory params = _validParams(JOHN_ID);
        params.proofVerificationData.publicInputs[4] = _scopeHash("evil-scope");
        vm.prank(john);
        vm.expectRevert(ZKBurn.ScopeMismatch.selector);
        zkburn.register(params);
    }

    function test_register_revert_domainStringMismatch() public {
        ProofVerificationParams memory params = _validParams(JOHN_ID);
        params.serviceConfig.domain = "evil.app";
        vm.prank(john);
        vm.expectRevert(ZKBurn.DomainMismatch.selector);
        zkburn.register(params);
    }

    function test_register_revert_scopeStringMismatch() public {
        ProofVerificationParams memory params = _validParams(JOHN_ID);
        params.serviceConfig.scope = "evil-scope";
        vm.prank(john);
        vm.expectRevert(ZKBurn.ScopeMismatch.selector);
        zkburn.register(params);
    }

    function test_register_revert_expiredProof() public {
        ProofVerificationParams memory params = _buildParams(JOHN_ID, block.timestamp - VALIDITY - 1, VALIDITY, false);
        vm.prank(john);
        vm.expectRevert(ZKBurn.ProofExpired.selector);
        zkburn.register(params);
    }

    function test_register_revert_futureDatedProof() public {
        ProofVerificationParams memory params = _buildParams(JOHN_ID, block.timestamp + 1 days + 1, VALIDITY, false);
        vm.prank(john);
        vm.expectRevert(ZKBurn.ProofExpired.selector);
        zkburn.register(params);
    }

    function test_register_validityCappedAtMaxValidity() public {
        ProofVerificationParams memory params = _buildParams(JOHN_ID, block.timestamp - 7 days - 1, 30 days, false);
        vm.prank(john);
        vm.expectRevert(ZKBurn.ProofExpired.selector);
        zkburn.register(params);

        params = _buildParams(JOHN_ID, block.timestamp - 7 days, 30 days, false);
        vm.prank(john);
        zkburn.register(params);
        assertEq(zkburn.idOf(john), JOHN_ID);
    }

    function test_register_revert_zeroNullifier() public {
        ProofVerificationParams memory params = _validParams(bytes32(0));
        vm.prank(john);
        vm.expectRevert(ZKBurn.InvalidPublicInputs.selector);
        zkburn.register(params);
    }

    function test_register_revert_duplicateNullifier() public {
        _register(john, JOHN_ID);
        vm.prank(john2);
        vm.expectRevert(ZKBurn.AlreadyRegistered.selector);
        zkburn.register(_validParams(JOHN_ID));
    }

    function test_register_revert_addressAlreadyBound() public {
        _register(john, JOHN_ID);
        vm.prank(john);
        vm.expectRevert(ZKBurn.AlreadyBound.selector);
        zkburn.register(_validParams(JOHN_ID_2));
    }

    // ------------------------------------------------------------------
    // register — verified mode
    // ------------------------------------------------------------------

    function test_register_verified_happyPath() public {
        vm.expectEmit(true, true, true, true, address(zkburnVerified));
        emit Registered(JOHN_ID, john, true, false);

        vm.prank(john);
        bytes32 returnedId = zkburnVerified.register(_validParams(JOHN_ID));

        assertEq(returnedId, JOHN_ID);
        (,, bool zkVerified,) = zkburnVerified.identities(JOHN_ID);
        assertTrue(zkVerified);
    }

    function test_register_verified_revert_verifierRejects() public {
        mockVerifier.setVerified(false);
        vm.prank(john);
        vm.expectRevert(ZKBurn.InvalidProof.selector);
        zkburnVerified.register(_validParams(JOHN_ID));
    }

    function test_register_verified_revert_nullifierMismatch() public {
        mockVerifier.setUniqueIdentifier(bytes32(uint256(0xDEAD)));
        vm.prank(john);
        vm.expectRevert(ZKBurn.NullifierMismatch.selector);
        zkburnVerified.register(_validParams(JOHN_ID));
    }

    // ------------------------------------------------------------------
    // proposeInteraction
    // ------------------------------------------------------------------

    function test_propose_revert_workerNotRegistered() public {
        _register(john, JOHN_ID);
        vm.prank(worker);
        vm.expectRevert(ZKBurn.NotRegistered.selector);
        zkburn.proposeInteraction(JOHN_ID);
    }

    function test_propose_revert_unknownJohn() public {
        _register(worker, WORKER_ID);
        vm.prank(worker);
        vm.expectRevert(ZKBurn.UnknownJohn.selector);
        zkburn.proposeInteraction(JOHN_ID);
    }

    function test_propose_revert_selfInteraction() public {
        _register(worker, WORKER_ID);
        vm.prank(worker);
        vm.expectRevert(ZKBurn.SelfInteraction.selector);
        zkburn.proposeInteraction(WORKER_ID);
    }

    function test_propose_happyPath() public {
        _register(john, JOHN_ID);
        _register(worker, WORKER_ID);

        vm.expectEmit(true, true, true, true);
        emit InteractionProposed(0, JOHN_ID, WORKER_ID, worker);

        vm.prank(worker);
        uint256 id = zkburn.proposeInteraction(JOHN_ID);

        assertEq(id, 0);
        assertEq(zkburn.interactionCount(), 1);

        ZKBurn.Interaction memory it = zkburn.getInteraction(id);
        assertEq(it.johnId, JOHN_ID);
        assertEq(it.workerId, WORKER_ID);
        assertEq(it.proposedAt, uint64(START_TIME));
        assertEq(it.confirmedAt, 0);
        assertFalse(it.burnUsed);
        assertFalse(it.vouchUsed);

        uint256[] memory johnIds = zkburn.getJohnInteractions(JOHN_ID);
        assertEq(johnIds.length, 1);
        assertEq(johnIds[0], id);
        uint256[] memory workerIds = zkburn.getWorkerInteractions(WORKER_ID);
        assertEq(workerIds.length, 1);
        assertEq(workerIds[0], id);
    }

    function test_propose_idsIncrement() public {
        _register(john, JOHN_ID);
        _register(worker, WORKER_ID);
        _register(worker2, WORKER_ID_2);
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
        _register(worker, WORKER_ID);
        vm.prank(worker);
        uint256 id = zkburn.proposeInteraction(JOHN_ID);

        vm.warp(START_TIME + 100);
        vm.expectEmit(true, true, true, true);
        emit InteractionConfirmed(id, JOHN_ID, WORKER_ID);

        vm.prank(john);
        zkburn.confirmInteraction(id);
        assertEq(zkburn.getInteraction(id).confirmedAt, uint64(START_TIME + 100));
    }

    function test_confirm_revert_notJohn() public {
        _register(john, JOHN_ID);
        _register(worker, WORKER_ID);
        vm.prank(worker);
        uint256 id = zkburn.proposeInteraction(JOHN_ID);

        // The proposing worker cannot confirm.
        vm.prank(worker);
        vm.expectRevert(ZKBurn.NotJohn.selector);
        zkburn.confirmInteraction(id);

        // A stranger cannot confirm.
        vm.prank(stranger);
        vm.expectRevert(ZKBurn.NotJohn.selector);
        zkburn.confirmInteraction(id);
    }

    function test_confirm_revert_alreadyConfirmed() public {
        uint256 id = _setupBurnable();
        vm.prank(john);
        vm.expectRevert(ZKBurn.AlreadyConfirmed.selector);
        zkburn.confirmInteraction(id);
    }

    // ------------------------------------------------------------------
    // burn
    // ------------------------------------------------------------------

    function test_burn_revert_notWorker() public {
        uint256 id = _setupBurnable();
        // Registered john is not the interaction's worker.
        vm.prank(john);
        vm.expectRevert(ZKBurn.NotWorker.selector);
        zkburn.burn(id, "bad");
        // A different registered worker isn't the owner.
        _register(worker2, WORKER_ID_2);
        vm.prank(worker2);
        vm.expectRevert(ZKBurn.NotWorker.selector);
        zkburn.burn(id, "bad");
    }

    function test_burn_revert_unconfirmed() public {
        _register(john, JOHN_ID);
        _register(worker, WORKER_ID);
        vm.prank(worker);
        uint256 id = zkburn.proposeInteraction(JOHN_ID);
        vm.prank(worker);
        vm.expectRevert(ZKBurn.NotConfirmed.selector);
        zkburn.burn(id, "bad");
    }

    function test_burn_happyPath() public {
        uint256 id = _setupBurnable();

        vm.expectEmit(true, true, true, true);
        emit Burned(JOHN_ID, WORKER_ID, id, "stole my lunch");

        vm.prank(worker);
        zkburn.burn(id, "stole my lunch");

        assertTrue(zkburn.getInteraction(id).burnUsed);

        ZKBurn.ActionRecord[] memory burns = zkburn.getBurns(JOHN_ID);
        assertEq(burns.length, 1);
        assertEq(burns[0].workerId, WORKER_ID);
        assertEq(burns[0].interactionId, id);
        assertEq(burns[0].note, "stole my lunch");
        assertFalse(burns[0].retracted);

        (,,, bool isBurned, uint32 burnCount,, uint32 distinctBurners,,) = zkburn.checkStatus(JOHN_ID);
        assertTrue(isBurned);
        assertEq(burnCount, 1);
        assertEq(distinctBurners, 1);
    }

    function test_burn_revert_burnAlreadyUsed() public {
        uint256 id = _setupBurnable();
        vm.prank(worker);
        zkburn.burn(id, "first");
        vm.prank(worker);
        vm.expectRevert(ZKBurn.BurnAlreadyUsed.selector);
        zkburn.burn(id, "second");
    }

    function test_burn_multipleInteractions_sameWorker_distinctStaysOne() public {
        uint256 id0 = _setupBurnable();
        vm.prank(worker);
        uint256 id1 = zkburn.proposeInteraction(JOHN_ID);
        vm.prank(john);
        zkburn.confirmInteraction(id1);

        vm.prank(worker);
        zkburn.burn(id0, "first");
        vm.prank(worker);
        zkburn.burn(id1, "second");

        (,,,, uint32 burnCount,, uint32 distinctBurners,,) = zkburn.checkStatus(JOHN_ID);
        assertEq(burnCount, 2, "two burns");
        assertEq(distinctBurners, 1, "but one distinct worker");
    }

    function test_burn_twoDistinctWorkers() public {
        uint256 id0 = _setupBurnable(); // worker/WORKER_ID
        // second worker with their own confirmed interaction
        _register(worker2, WORKER_ID_2);
        vm.prank(worker2);
        uint256 id1 = zkburn.proposeInteraction(JOHN_ID);
        vm.prank(john);
        zkburn.confirmInteraction(id1);

        vm.prank(worker);
        zkburn.burn(id0, "w1");
        vm.prank(worker2);
        zkburn.burn(id1, "w2");

        (,,,, uint32 burnCount,, uint32 distinctBurners,,) = zkburn.checkStatus(JOHN_ID);
        assertEq(burnCount, 2);
        assertEq(distinctBurners, 2);
    }

    // ------------------------------------------------------------------
    // retractBurn
    // ------------------------------------------------------------------

    function test_retractBurn_happyPath() public {
        uint256 id = _setupBurnable();
        vm.prank(worker);
        zkburn.burn(id, "mistake");

        vm.expectEmit(true, true, true, true);
        emit BurnRetracted(JOHN_ID, WORKER_ID, id);
        vm.prank(worker);
        zkburn.retractBurn(id);

        (,,, bool isBurned, uint32 burnCount,, uint32 distinctBurners,,) = zkburn.checkStatus(JOHN_ID);
        assertFalse(isBurned);
        assertEq(burnCount, 0);
        assertEq(distinctBurners, 0);

        ZKBurn.ActionRecord[] memory burns = zkburn.getBurns(JOHN_ID);
        assertEq(burns.length, 1, "record retained for auditability");
        assertTrue(burns[0].retracted);
    }

    function test_retractBurn_cannotReBurn() public {
        uint256 id = _setupBurnable();
        vm.prank(worker);
        zkburn.burn(id, "x");
        vm.prank(worker);
        zkburn.retractBurn(id);
        // burnUsed remains true, so re-burn is blocked
        vm.prank(worker);
        vm.expectRevert(ZKBurn.BurnAlreadyUsed.selector);
        zkburn.burn(id, "again");
    }

    function test_retractBurn_revert_notWorker() public {
        uint256 id = _setupBurnable();
        vm.prank(worker);
        zkburn.burn(id, "x");
        _register(worker2, WORKER_ID_2);
        vm.prank(worker2);
        vm.expectRevert(ZKBurn.NotWorker.selector);
        zkburn.retractBurn(id);
    }

    function test_retractBurn_revert_notBurned() public {
        uint256 id = _setupBurnable();
        vm.prank(worker);
        vm.expectRevert(ZKBurn.NotBurned.selector);
        zkburn.retractBurn(id);
    }

    function test_retractBurn_revert_alreadyRetracted() public {
        uint256 id = _setupBurnable();
        vm.prank(worker);
        zkburn.burn(id, "x");
        vm.prank(worker);
        zkburn.retractBurn(id);
        vm.prank(worker);
        vm.expectRevert(ZKBurn.NotBurned.selector);
        zkburn.retractBurn(id);
    }

    function test_retractBurn_distinctDropsOnlyWhenLastActive() public {
        // one worker burns two of the john's interactions, retracts one → still a distinct burner
        uint256 id0 = _setupBurnable();
        vm.prank(worker);
        uint256 id1 = zkburn.proposeInteraction(JOHN_ID);
        vm.prank(john);
        zkburn.confirmInteraction(id1);
        vm.prank(worker);
        zkburn.burn(id0, "a");
        vm.prank(worker);
        zkburn.burn(id1, "b");

        vm.prank(worker);
        zkburn.retractBurn(id0);
        (,,, bool isBurned, uint32 burnCount,, uint32 distinctBurners,,) = zkburn.checkStatus(JOHN_ID);
        assertTrue(isBurned);
        assertEq(burnCount, 1);
        assertEq(distinctBurners, 1, "still one active burn from this worker");

        vm.prank(worker);
        zkburn.retractBurn(id1);
        (,,, isBurned, burnCount,, distinctBurners,,) = zkburn.checkStatus(JOHN_ID);
        assertFalse(isBurned);
        assertEq(distinctBurners, 0);
    }

    // ------------------------------------------------------------------
    // vouch / retractVouch
    // ------------------------------------------------------------------

    function test_vouch_happyPath() public {
        uint256 id = _setupBurnable();
        vm.expectEmit(true, true, true, true);
        emit Vouched(JOHN_ID, WORKER_ID, id, "great client");
        vm.prank(worker);
        zkburn.vouch(id, "great client");

        assertTrue(zkburn.getInteraction(id).vouchUsed);
        (,,,,, uint32 vouchCount,, uint32 distinctVouchers,) = zkburn.checkStatus(JOHN_ID);
        assertEq(vouchCount, 1);
        assertEq(distinctVouchers, 1);
    }

    function test_vouch_revert_vouchAlreadyUsed() public {
        uint256 id = _setupBurnable();
        vm.prank(worker);
        zkburn.vouch(id, "");
        vm.prank(worker);
        vm.expectRevert(ZKBurn.VouchAlreadyUsed.selector);
        zkburn.vouch(id, "");
    }

    function test_vouch_revert_notConfirmed() public {
        _register(john, JOHN_ID);
        _register(worker, WORKER_ID);
        vm.prank(worker);
        uint256 id = zkburn.proposeInteraction(JOHN_ID);
        vm.prank(worker);
        vm.expectRevert(ZKBurn.NotConfirmed.selector);
        zkburn.vouch(id, "");
    }

    function test_retractVouch_happyPath() public {
        uint256 id = _setupBurnable();
        vm.prank(worker);
        zkburn.vouch(id, "nice");
        vm.expectEmit(true, true, true, true);
        emit VouchRetracted(JOHN_ID, WORKER_ID, id);
        vm.prank(worker);
        zkburn.retractVouch(id);
        (,,,,, uint32 vouchCount,, uint32 distinctVouchers,) = zkburn.checkStatus(JOHN_ID);
        assertEq(vouchCount, 0);
        assertEq(distinctVouchers, 0);
    }

    function test_retractVouch_revert_notVouched() public {
        uint256 id = _setupBurnable();
        vm.prank(worker);
        vm.expectRevert(ZKBurn.NotVouched.selector);
        zkburn.retractVouch(id);
    }

    function test_burnAndVouch_independentSlots() public {
        uint256 id = _setupBurnable();
        vm.prank(worker);
        zkburn.burn(id, "note");
        vm.prank(worker);
        zkburn.vouch(id, "but also fine");

        ZKBurn.Interaction memory it = zkburn.getInteraction(id);
        assertTrue(it.burnUsed);
        assertTrue(it.vouchUsed);
        (,,,, uint32 burnCount, uint32 vouchCount,,,) = zkburn.checkStatus(JOHN_ID);
        assertEq(burnCount, 1);
        assertEq(vouchCount, 1);
    }

    // ------------------------------------------------------------------
    // checkStatus
    // ------------------------------------------------------------------

    function test_checkStatus_nonexistent() public view {
        (bool exists,,, bool isBurned, uint32 burnCount, uint32 vouchCount,,, string memory note) =
            zkburn.checkStatus(JOHN_ID);
        assertFalse(exists);
        assertFalse(isBurned);
        assertEq(burnCount, 0);
        assertEq(vouchCount, 0);
        assertEq(note, "");
    }

    function test_checkStatus_lastNoteSkipsRetracted() public {
        uint256 id0 = _setupBurnable();
        vm.prank(worker);
        zkburn.burn(id0, "first note");

        vm.prank(worker);
        uint256 id1 = zkburn.proposeInteraction(JOHN_ID);
        vm.prank(john);
        zkburn.confirmInteraction(id1);
        vm.prank(worker);
        zkburn.burn(id1, "second note");

        // Retract the latest → lastBurnNote falls back to the earlier active one.
        vm.prank(worker);
        zkburn.retractBurn(id1);

        (,,, bool isBurned, uint32 burnCount,,,, string memory lastBurnNote) = zkburn.checkStatus(JOHN_ID);
        assertTrue(isBurned);
        assertEq(burnCount, 1);
        assertEq(lastBurnNote, "first note");
    }

    function test_checkStatus_verifiedFlag() public {
        vm.prank(john);
        zkburnVerified.register(_validParams(JOHN_ID));
        (, bool zkVerified,,,,,,,) = zkburnVerified.checkStatus(JOHN_ID);
        assertTrue(zkVerified);
    }

    // ------------------------------------------------------------------
    // interactionCapabilities
    // ------------------------------------------------------------------

    function test_capabilities_lifecycle() public {
        // out-of-range id
        (bool cb, bool cv, bool crb, bool crv) = zkburn.interactionCapabilities(0, worker);
        assertFalse(cb || cv || crb || crv);

        _register(john, JOHN_ID);
        _register(worker, WORKER_ID);
        vm.prank(worker);
        uint256 id = zkburn.proposeInteraction(JOHN_ID);

        // proposed but unconfirmed → nothing
        (cb, cv, crb, crv) = zkburn.interactionCapabilities(id, worker);
        assertFalse(cb || cv || crb || crv);

        vm.prank(john);
        zkburn.confirmInteraction(id);
        // confirmed → can burn + vouch, no retracts yet
        (cb, cv, crb, crv) = zkburn.interactionCapabilities(id, worker);
        assertTrue(cb);
        assertTrue(cv);
        assertFalse(crb);
        assertFalse(crv);

        // wrong caller → nothing
        (cb, cv, crb, crv) = zkburn.interactionCapabilities(id, john);
        assertFalse(cb || cv || crb || crv);

        vm.prank(worker);
        zkburn.burn(id, "x");
        (cb, cv, crb, crv) = zkburn.interactionCapabilities(id, worker);
        assertFalse(cb, "burn used");
        assertTrue(cv);
        assertTrue(crb, "can retract burn");
        assertFalse(crv);

        vm.prank(worker);
        zkburn.retractBurn(id);
        (cb,, crb,) = zkburn.interactionCapabilities(id, worker);
        assertFalse(cb, "cannot re-burn");
        assertFalse(crb, "nothing to retract");
    }

    // ------------------------------------------------------------------
    // Integration
    // ------------------------------------------------------------------

    function test_integration_twoWorkersTwoJohns() public {
        _register(john, JOHN_ID);
        _register(john2, JOHN_ID_2);
        _register(worker, WORKER_ID);
        _register(worker2, WORKER_ID_2);

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
        zkburn.burn(idA, "worker1 burn");
        vm.prank(worker2);
        zkburn.vouch(idB, "worker2 vouch");
        vm.prank(worker);
        zkburn.vouch(idC, "worker1 vouch for john2");

        (,,, bool isBurned1, uint32 burns1, uint32 vouches1, uint32 db1, uint32 dv1, string memory note1) =
            zkburn.checkStatus(JOHN_ID);
        assertTrue(isBurned1);
        assertEq(burns1, 1);
        assertEq(vouches1, 1);
        assertEq(db1, 1);
        assertEq(dv1, 1);
        assertEq(note1, "worker1 burn");

        (,,, bool isBurned2, uint32 burns2, uint32 vouches2,,,) = zkburn.checkStatus(JOHN_ID_2);
        assertFalse(isBurned2);
        assertEq(burns2, 0);
        assertEq(vouches2, 1);

        assertEq(zkburn.getWorkerInteractions(WORKER_ID).length, 2);
        assertEq(zkburn.getWorkerInteractions(WORKER_ID_2).length, 1);
        assertEq(zkburn.getJohnInteractions(JOHN_ID).length, 2);
        assertEq(zkburn.getJohnInteractions(JOHN_ID_2).length, 1);
    }
}
