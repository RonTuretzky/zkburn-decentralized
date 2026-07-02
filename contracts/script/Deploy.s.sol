// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {ZKBurn} from "../src/ZKBurn.sol";

/// @title Deploy
/// @notice Deploys ZKBurn. Env-driven:
///         - PRIVATE_KEY (required): deployer key, read via vm.envUint (no --private-key flag needed).
///         - ZKBURN_DOMAIN (default "zkburn.app"): zkPassport service domain.
///         - ZKBURN_SCOPE (default "zkburn-v1"): zkPassport service scope.
///         - ZKPASSPORT_VERIFIER (default 0x1D000001000EFD9a6371f4d90bB8920D5431c0D8):
///           the CREATE2-deterministic zkPassport RootVerifier address.
contract Deploy is Script {
    /// @notice Runs the deployment.
    function run() external returns (ZKBurn zkBurn) {
        string memory domain = vm.envOr("ZKBURN_DOMAIN", string("zkburn.app"));
        string memory scope = vm.envOr("ZKBURN_SCOPE", string("zkburn-v1"));
        address verifier = vm.envOr("ZKPASSPORT_VERIFIER", address(0x1D000001000EFD9a6371f4d90bB8920D5431c0D8));

        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        zkBurn = new ZKBurn(verifier, domain, scope);
        vm.stopBroadcast();

        console.log("ZKBurn deployed at:", address(zkBurn));
        console.log("  verifier:", verifier);
        console.log("  domain:", domain);
        console.log("  scope:", scope);
    }
}
