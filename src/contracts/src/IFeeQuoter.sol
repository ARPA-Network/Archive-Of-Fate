pragma solidity ^0.8.20;

interface IFeeQuoter {
    function quoteMintFee() external view returns (uint256);
}
