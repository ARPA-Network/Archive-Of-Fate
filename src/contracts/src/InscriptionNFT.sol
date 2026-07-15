pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {IFeeQuoter} from "./IFeeQuoter.sol";

contract InscriptionNFT is ERC721, Ownable, ReentrancyGuard, EIP712 {
    using ECDSA for bytes32;

    address public authorizer;

    bytes32 public constant MINT_TYPEHASH = keccak256(
        "Mint(address to,string inscriptionId,uint256 seed,uint256[] talentIds,int256[4] allocation,bytes32 randcastRequestTx,uint256 deadline)"
    );

    struct Fate {
        uint256 seed;
        uint256[] talentIds;
        int256[4] allocation;
        bytes32 randcastRequestTx;
    }

    IERC20 public paymentToken;
    address public treasury;
    uint256 public mintFee;
    IFeeQuoter public feeQuoter;

    uint256 private _nextId = 1;
    string public baseURI;
    mapping(uint256 => Fate) private _fates;
    mapping(uint256 => string) public inscriptionIdOf;
    mapping(string => uint256) public tokenIdByInscription;

    event InscriptionMinted(
        uint256 indexed tokenId,
        address indexed owner,
        string inscriptionId,
        uint256 seed,
        bytes32 randcastRequestTx,
        uint256 paidToken
    );
    event PaymentConfigUpdated(address token, address treasury, uint256 mintFee, address feeQuoter);

    constructor(
        string memory name_,
        string memory symbol_,
        address initialOwner,
        address treasury_,
        address paymentToken_,
        uint256 mintFee_,
        string memory baseURI_,
        address authorizer_
    ) ERC721(name_, symbol_) Ownable(initialOwner) EIP712("ArchiveOfFate", "1") {
        treasury = treasury_;
        paymentToken = IERC20(paymentToken_);
        mintFee = mintFee_;
        baseURI = baseURI_;
        authorizer = authorizer_;
    }

    function mint(
        address to,
        string calldata inscriptionId,
        uint256 seed,
        uint256[] calldata talentIds,
        int256[4] calldata allocation,
        bytes32 randcastRequestTx,
        uint256 deadline,
        bytes calldata signature
    ) external nonReentrant returns (uint256 tokenId) {
        require(bytes(inscriptionId).length > 0, "empty inscriptionId");
        require(tokenIdByInscription[inscriptionId] == 0, "already minted");

        require(block.timestamp <= deadline, "auth expired");
        require(authorizer != address(0), "authorizer not set");
        bytes32 digest = mintDigest(to, inscriptionId, seed, talentIds, allocation, randcastRequestTx, deadline);
        require(digest.recover(signature) == authorizer, "unauthorized");

        uint256 fee = currentMintFee();
        if (fee > 0) {
            require(address(paymentToken) != address(0), "paymentToken not set");
            require(treasury != address(0), "treasury not set");
            require(paymentToken.transferFrom(msg.sender, treasury, fee), "token transfer failed");
        }

        tokenId = _nextId++;
        _safeMint(to, tokenId);

        _fates[tokenId] = Fate({
            seed: seed,
            talentIds: talentIds,
            allocation: allocation,
            randcastRequestTx: randcastRequestTx
        });
        inscriptionIdOf[tokenId] = inscriptionId;
        tokenIdByInscription[inscriptionId] = tokenId;

        emit InscriptionMinted(tokenId, to, inscriptionId, seed, randcastRequestTx, fee);
    }

    function mintDigest(
        address to,
        string calldata inscriptionId,
        uint256 seed,
        uint256[] calldata talentIds,
        int256[4] calldata allocation,
        bytes32 randcastRequestTx,
        uint256 deadline
    ) public view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                MINT_TYPEHASH,
                to,
                keccak256(bytes(inscriptionId)),
                seed,
                keccak256(abi.encodePacked(talentIds)),
                keccak256(abi.encodePacked(allocation)),
                randcastRequestTx,
                deadline
            )
        );
        return _hashTypedDataV4(structHash);
    }

    function currentMintFee() public view returns (uint256) {
        if (address(feeQuoter) != address(0)) {
            return feeQuoter.quoteMintFee();
        }
        return mintFee;
    }

    function getFate(uint256 tokenId)
        external
        view
        returns (uint256 seed, uint256[] memory talentIds, int256[4] memory allocation, bytes32 randcastRequestTx)
    {
        _requireOwned(tokenId);
        Fate storage f = _fates[tokenId];
        return (f.seed, f.talentIds, f.allocation, f.randcastRequestTx);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return bytes(baseURI).length == 0 ? "" : string.concat(baseURI, Strings.toString(tokenId));
    }

    function setPaymentToken(address token) external onlyOwner {
        paymentToken = IERC20(token);
        emit PaymentConfigUpdated(token, treasury, mintFee, address(feeQuoter));
    }

    function setMintFee(uint256 fee) external onlyOwner {
        mintFee = fee;
        emit PaymentConfigUpdated(address(paymentToken), treasury, fee, address(feeQuoter));
    }

    function setTreasury(address t) external onlyOwner {
        treasury = t;
        emit PaymentConfigUpdated(address(paymentToken), t, mintFee, address(feeQuoter));
    }

    function setFeeQuoter(address quoter) external onlyOwner {
        feeQuoter = IFeeQuoter(quoter);
        emit PaymentConfigUpdated(address(paymentToken), treasury, mintFee, quoter);
    }

    function setBaseURI(string calldata uri) external onlyOwner {
        baseURI = uri;
    }

    function setAuthorizer(address a) external onlyOwner {
        authorizer = a;
    }
}
