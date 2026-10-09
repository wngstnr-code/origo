// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Script, console2} from "forge-std/Script.sol";
import {OrigoRegistry} from "../src/OrigoRegistry.sol";

contract Deploy is Script {
    function run() external returns (OrigoRegistry registry) {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(pk);
        registry = new OrigoRegistry();
        vm.stopBroadcast();
        console2.log("OrigoRegistry deployed at", address(registry));
    }
}
