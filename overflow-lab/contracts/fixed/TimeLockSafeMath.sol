/*
 * FIXED copy of the ORIGINAL SmartBugs timelock.sol (same Solidity 0.4 code).
 * Only change: increaseLockTime uses SafeMath add (search "FIX").
 */
pragma solidity ^0.4.10;

library SafeMathL {
  function add(uint256 a, uint256 b) internal pure returns (uint256) { uint256 c = a + b; require(c >= a); return c; }
}

contract TimeLockSafeMath {
  using SafeMathL for uint256;

  mapping(address => uint) public balances;
  mapping(address => uint) public lockTime;

  function deposit() public payable {
    balances[msg.sender] += msg.value;
    lockTime[msg.sender] = now + 1 weeks;
  }

  function increaseLockTime(uint _secondsToIncrease) public {
    lockTime[msg.sender] = lockTime[msg.sender].add(_secondsToIncrease); // FIX: reverts on overflow
  }

  function withdraw() public {
    require(balances[msg.sender] > 0);
    require(now > lockTime[msg.sender]);
    uint transferValue = balances[msg.sender];
    balances[msg.sender] = 0;
    msg.sender.transfer(transferValue);
  }
}
