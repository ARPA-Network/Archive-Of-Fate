pragma solidity ^0.8.20;

import {GeneralRandcastConsumerBase} from
    "randcast-user-contract/user/GeneralRandcastConsumerBase.sol";
import {BasicRandcastConsumerBase} from
    "randcast-user-contract/user/BasicRandcastConsumerBase.sol";

interface IAdapterMinimal {
    function fundSubscription(uint64 subId) external payable;
    function getLastRandomness() external view returns (uint256);
}

contract FateRandomnessConsumer is GeneralRandcastConsumerBase {
    uint64 public subId;
    address public operator;

    uint256 public lastSeed;
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

    constructor(address adapter, uint64 subId_) BasicRandcastConsumerBase(adapter) {
        operator = msg.sender;
        subId = subId_;
    }

    function requestSeed() external payable returns (bytes32 requestId) {
        return _request(msg.sender, bytes32(0), msg.value);
    }

    function requestSeedWithSalt(bytes32 salt) external payable returns (bytes32 requestId) {
        return _request(msg.sender, salt, msg.value);
    }

    function requestSeedFor(bytes32 gameSessionId) external onlyOperator returns (bytes32 requestId) {
        return _request(msg.sender, gameSessionId, 0);
    }

    function _request(address requester, bytes32 salt, uint256 bnbValue) internal returns (bytes32 requestId) {
        if (bnbValue > 0) {
            IAdapterMinimal(address(adapter)).fundSubscription{value: bnbValue}(subId);
        }

        bytes memory params;
        requestId = _requestRandomness(RequestType.Randomness, params);

        requesters[requestId] = requester;
        emit SeedRequested(requestId, requester, salt);
    }

    function _fulfillRandomness(bytes32 requestId, uint256 randomness) internal override {
        uint256 seed = (randomness % 900000) + 100000;
        seeds[requestId] = seed;
        rawRandomness[requestId] = randomness;
        fulfilledFlag[requestId] = true;
        lastSeed = seed;
        emit SeedFulfilled(requestId, seed, requesters[requestId], randomness);
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
