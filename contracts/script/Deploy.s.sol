// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {WalkPool} from "../src/WalkPool.sol";

contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);
        WalkPool pool = new WalkPool();
        vm.stopBroadcast();
        console.log("WalkPool deployed at:", address(pool));
    }
}
