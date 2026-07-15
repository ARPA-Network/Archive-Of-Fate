pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {MockToken} from "../src/MockToken.sol";
import {MockRandcastConsumer} from "../src/MockRandcastConsumer.sol";
import {InscriptionNFT} from "../src/InscriptionNFT.sol";

contract DeployLocal is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address authorizer = vm.envAddress("AUTHORIZER_ADDR");
        address operator = vm.envAddress("OPERATOR_ADDR");
        address treasury = vm.envOr("TREASURY", deployer);
        uint256 mintFee = vm.envOr("MINT_FEE", uint256(50 ether));
        string memory baseURI = vm.envOr("BASE_URI", string("http://localhost:8787/nft/"));

        vm.startBroadcast(pk);

        MockToken arpa = new MockToken("Mock ARPA", "ARPA");
        MockRandcastConsumer consumer = new MockRandcastConsumer(1);
        consumer.setOperator(operator);
        InscriptionNFT nft =
            new InscriptionNFT("Archive of Fate", "FATE", deployer, treasury, address(arpa), mintFee, baseURI, authorizer);

        arpa.mint(deployer, 100000 ether);

        vm.stopBroadcast();

        console.log("=== Local deploy done ===");
        console.log("ARPA_TOKEN (VITE_PROJECT_TOKEN / backend none): ", address(arpa));
        console.log("CONSUMER   (VITE_CONSUMER_ADDRESS / RANDCAST_CONSUMER): ", address(consumer));
        console.log("NFT        (VITE_INSCRIPTION_NFT / INSCRIPTION_NFT): ", address(nft));
        console.log("authorizer: ", authorizer);
        console.log("operator:   ", operator);
        console.log("treasury:   ", treasury);
    }
}
