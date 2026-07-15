pragma solidity ^0.8.20;

contract MockRandcastConsumer {
    uint64 public subId;
    address public operator;
    address public owner;

    uint256 public lastSeed;
    uint256 private _nonce;
    mapping(bytes32 => uint256) public seeds;
    mapping(bytes32 => uint256) public rawRandomness;
    mapping(bytes32 => bool) public fulfilledFlag;
    mapping(bytes32 => address) public requesters;

    event SeedRequested(bytes32 indexed requestId, address indexed requester, bytes32 salt);
    event SeedFulfilled(bytes32 indexed requestId, uint256 seed, address indexed requester, uint256 randomness);

    modifier onlyOperator() {
        require(msg.sender == operator, "not operator");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor(uint64 subId_) {
        owner = msg.sender;
        operator = msg.sender;
        subId = subId_;
    }

    function requestSeed() external payable returns (bytes32 requestId) {
        return _request(msg.sender, bytes32(0));
    }

    function requestSeedWithSalt(bytes32 salt) external payable returns (bytes32 requestId) {
        return _request(msg.sender, salt);
    }

    function requestSeedFor(bytes32 gameSessionId) external onlyOperator returns (bytes32 requestId) {
        return _request(msg.sender, gameSessionId);
    }

    function _request(address requester, bytes32 salt) internal returns (bytes32 requestId) {
        _nonce++;
        requestId = keccak256(abi.encodePacked(address(this), requester, _nonce, block.timestamp, salt));
        requesters[requestId] = requester;
        emit SeedRequested(requestId, requester, salt);

        uint256 randomness = uint256(keccak256(abi.encodePacked(block.timestamp, block.prevrandao, requester, _nonce)));
        uint256 seed = (randomness % 900000) + 100000;
        seeds[requestId] = seed;
        rawRandomness[requestId] = randomness;
        fulfilledFlag[requestId] = true;
        lastSeed = seed;
        emit SeedFulfilled(requestId, seed, requester, randomness);
    }

    function getSeed(bytes32 requestId) external view returns (uint256 seed, bool fulfilled) {
        return (seeds[requestId], fulfilledFlag[requestId]);
    }

    function getRandomness(bytes32 requestId) external view returns (uint256) {
        return rawRandomness[requestId];
    }

    function getLastSeed() external view returns (uint256) {
        return lastSeed;
    }

    function setOperator(address op) external onlyOwner {
        operator = op;
    }

    function setSubId(uint64 s) external onlyOwner {
        subId = s;
    }
}
