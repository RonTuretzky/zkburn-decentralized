// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Verification data for a zkPassport outer proof.
/// @dev Layout of `publicInputs` (outer_evm proofs):
///      [0] certificate_registry_root, [1] circuit_registry_root,
///      [2] current_date (unix seconds), [3] service_scope = bytes32(uint256(sha256(domain)) >> 8),
///      [4] service_subscope = bytes32(uint256(sha256(scope)) >> 8),
///      [5..len-4] param_commitments, [len-3] nullifier_type,
///      [len-2] scoped_nullifier, [len-1] oprf_pk_hash.
struct ProofVerificationData {
    bytes32 vkeyHash;
    bytes proof;
    bytes32[] publicInputs;
}

/// @notice Service configuration the proof was generated against.
struct ServiceConfig {
    uint256 validityPeriodInSeconds;
    string domain;
    string scope;
    bool devMode;
}

/// @notice Full parameter bundle passed to the zkPassport RootVerifier.
struct ProofVerificationParams {
    bytes32 version;
    ProofVerificationData proofVerificationData;
    bytes committedInputs;
    ServiceConfig serviceConfig;
}

/// @title IZKPassportVerifier
/// @notice Interface of the canonical zkPassport RootVerifier
///         (CREATE2-deterministic at 0x1D000001000EFD9a6371f4d90bB8920D5431c0D8 on all chains).
interface IZKPassportVerifier {
    /// @notice Verifies a zkPassport proof.
    /// @param params The proof verification parameters.
    /// @return verified True if the proof is valid.
    /// @return uniqueIdentifier The scoped nullifier (publicInputs[len-2]).
    /// @return helper The per-version helper contract address.
    function verify(ProofVerificationParams calldata params)
        external
        view
        returns (bool verified, bytes32 uniqueIdentifier, address helper);
}
