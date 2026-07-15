pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {InscriptionNFT} from "../src/InscriptionNFT.sol";
import {MockToken} from "../src/MockToken.sol";
import {IFeeQuoter} from "../src/IFeeQuoter.sol";

contract FixedQuoter is IFeeQuoter {
    uint256 public fee;
    constructor(uint256 f) { fee = f; }
    function quoteMintFee() external view returns (uint256) { return fee; }
}

contract InscriptionNFTTest is Test {
    InscriptionNFT nft;
    MockToken arpa;

    address owner = address(this);
    address treasury;
    address user;
    uint256 constant FEE = 50 ether;
    string constant BASE = "https://nft.test/";

    uint256 authPk = 0xA11CE;
    address authAddr;

    uint256[] talents;
    int256[4] alloc;

    function setUp() public {
        treasury = makeAddr("treasury");
        user = makeAddr("user");
        authAddr = vm.addr(authPk);

        arpa = new MockToken("Mock ARPA", "ARPA");
        nft = new InscriptionNFT("Archive of Fate", "FATE", owner, treasury, address(arpa), FEE, BASE, authAddr);

        talents = new uint256[](3);
        talents[0] = 1003;
        talents[1] = 1024;
        talents[2] = 1100;
        alloc = [int256(5), int256(8), int256(4), int256(3)];

        arpa.mint(user, 1000 ether);
    }

    function _sign(uint256 pk, address to, string memory id, uint256 seed, bytes32 rtx, uint256 dl)
        internal
        view
        returns (bytes memory)
    {
        bytes32 digest = nft.mintDigest(to, id, seed, talents, alloc, rtx, dl);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    function _mint(address sender, address to, string memory id, uint256 seed, bytes32 rtx)
        internal
        returns (uint256)
    {
        uint256 dl = block.timestamp + 1 days;
        bytes memory sig = _sign(authPk, to, id, seed, rtx, dl);
        vm.prank(sender);
        return nft.mint(to, id, seed, talents, alloc, rtx, dl, sig);
    }

    function test_Mint_ChargesFeeAndStoresFate() public {
        vm.prank(user);
        arpa.approve(address(nft), FEE);

        uint256 tokenId = _mint(user, user, "fate_1", 738142, bytes32(uint256(0xABCD)));

        assertEq(nft.ownerOf(tokenId), user);
        assertEq(arpa.balanceOf(treasury), FEE);
        assertEq(arpa.balanceOf(user), 1000 ether - FEE);
        assertEq(nft.tokenURI(tokenId), string.concat(BASE, vm.toString(tokenId)));

        (uint256 seed, uint256[] memory t, int256[4] memory a, bytes32 rtx) = nft.getFate(tokenId);
        assertEq(seed, 738142);
        assertEq(t[1], 1024);
        assertEq(a[1], int256(8));
        assertEq(rtx, bytes32(uint256(0xABCD)));
    }

    function test_Mint_RevertsBadSigner() public {
        uint256 wrongPk = 0xBAD5;
        uint256 dl = block.timestamp + 1 days;
        bytes memory sig = _sign(wrongPk, user, "x", 1, bytes32(0), dl);
        vm.prank(user);
        arpa.approve(address(nft), FEE);
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSignature("Error(string)", "unauthorized"));
        nft.mint(user, "x", 1, talents, alloc, bytes32(0), dl, sig);
    }

    function test_Mint_RevertsTamperedData() public {
        uint256 dl = block.timestamp + 1 days;
        bytes memory sig = _sign(authPk, user, "t", 1, bytes32(0), dl);
        vm.prank(user);
        arpa.approve(address(nft), FEE);
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSignature("Error(string)", "unauthorized"));
        nft.mint(user, "t", 999, talents, alloc, bytes32(0), dl, sig);
    }

    function test_Mint_RevertsExpired() public {
        uint256 dl = block.timestamp + 100;
        bytes memory sig = _sign(authPk, user, "e", 1, bytes32(0), dl);
        vm.warp(dl + 1);
        vm.prank(user);
        arpa.approve(address(nft), FEE);
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSignature("Error(string)", "auth expired"));
        nft.mint(user, "e", 1, talents, alloc, bytes32(0), dl, sig);
    }

    function test_CurrentMintFee_IsConfigured() public view {
        assertEq(nft.currentMintFee(), FEE);
    }

    function test_Mint_RevertsWithoutApprove() public {
        uint256 dl = block.timestamp + 1 days;
        bytes memory sig = _sign(authPk, user, "x", 1, bytes32(0), dl);
        vm.prank(user);
        vm.expectRevert();
        nft.mint(user, "x", 1, talents, alloc, bytes32(0), dl, sig);
    }

    function test_Mint_RevertsInsufficientBalance() public {
        address poor = makeAddr("poor");
        arpa.mint(poor, 10 ether);
        vm.prank(poor);
        arpa.approve(address(nft), FEE);
        uint256 dl = block.timestamp + 1 days;
        bytes memory sig = _sign(authPk, poor, "x", 1, bytes32(0), dl);
        vm.prank(poor);
        vm.expectRevert();
        nft.mint(poor, "x", 1, talents, alloc, bytes32(0), dl, sig);
    }

    function test_Mint_RevertsDuplicate() public {
        vm.prank(user);
        arpa.approve(address(nft), FEE * 2);
        _mint(user, user, "dup", 1, bytes32(0));

        uint256 dl = block.timestamp + 1 days;
        bytes memory sig = _sign(authPk, user, "dup", 2, bytes32(0), dl);
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSignature("Error(string)", "already minted"));
        nft.mint(user, "dup", 2, talents, alloc, bytes32(0), dl, sig);
    }

    function test_Mint_FreeWhenFeeZero() public {
        nft.setMintFee(0);
        address u2 = makeAddr("u2");
        uint256 id = _mint(u2, u2, "free_1", 1, bytes32(0));
        assertEq(nft.ownerOf(id), u2);
        assertEq(arpa.balanceOf(treasury), 0);
    }

    function test_GetFate_RevertsNonexistent() public {
        vm.expectRevert();
        nft.getFate(999);
    }

    function test_FeeQuoter_Overrides() public {
        FixedQuoter q = new FixedQuoter(7 ether);
        nft.setFeeQuoter(address(q));
        assertEq(nft.currentMintFee(), 7 ether);
        vm.prank(user);
        arpa.approve(address(nft), 7 ether);
        _mint(user, user, "q_1", 1, bytes32(0));
        assertEq(arpa.balanceOf(treasury), 7 ether);
    }

    function test_Admin_OnlyOwner() public {
        vm.prank(user);
        vm.expectRevert();
        nft.setAuthorizer(address(0x1));

        vm.prank(user);
        vm.expectRevert();
        nft.setMintFee(1);

        nft.setMintFee(123);
        assertEq(nft.currentMintFee(), 123);
        nft.setAuthorizer(address(0x9));
        assertEq(nft.authorizer(), address(0x9));
    }
}
