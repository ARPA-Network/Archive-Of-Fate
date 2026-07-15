pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {FateRandomnessConsumer} from "../src/FateRandomnessConsumer.sol";
import {InscriptionNFT} from "../src/InscriptionNFT.sol";

contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address adapter = vm.envAddress("ADAPTER_CONTRACT");
        uint64 subId = uint64(vm.envUint("SUB_ID"));
        address treasury = vm.envAddress("TREASURY");
        address arpa = vm.envAddress("ARPA_TOKEN");

        uint256 mintFee = vm.envOr("MINT_FEE", uint256(50 ether));
        string memory baseURI = vm.envOr("BASE_URI", string(""));
        address authorizer = vm.envAddress("AUTHORIZER");

        vm.startBroadcast(pk);

        FateRandomnessConsumer consumer = new FateRandomnessConsumer(adapter, subId);
        console.log("FateRandomnessConsumer:", address(consumer));

        InscriptionNFT nft =
            new InscriptionNFT("Archive of Fate", "FATE", msg.sender, treasury, arpa, mintFee, baseURI, authorizer);
        console.log("InscriptionNFT:", address(nft));
        console.log("mintFee (ARPA, wei):", mintFee);


        vm.stopBroadcast();
    }
}
