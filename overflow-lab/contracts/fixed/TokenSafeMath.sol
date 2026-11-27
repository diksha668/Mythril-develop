/*
 * FIXED copy of the ORIGINAL SmartBugs token.sol (same Solidity 0.4 code).
 * Changes vs original (search "FIX"):
 *   1. require(balances[msg.sender] >= _value) instead of "... - _value >= 0" (always true for uint)
 *   2. SafeMath sub/add instead of raw -= / +=
 */
pragma solidity ^0.4.18;

library SafeMathT {
  function sub(uint256 a, uint256 b) internal pure returns (uint256) { require(b <= a); return a - b; }
  function add(uint256 a, uint256 b) internal pure returns (uint256) { uint256 c = a + b; require(c >= a); return c; }
}

contract TokenSafeMath {
  using SafeMathT for uint256;

  mapping(address => uint) balances;
  uint public totalSupply;

  function TokenSafeMath(uint _initialSupply) {
    balances[msg.sender] = totalSupply = _initialSupply;
  }

  function transfer(address _to, uint _value) public returns (bool) {
    require(balances[msg.sender] >= _value);                       // FIX 1
    balances[msg.sender] = balances[msg.sender].sub(_value);       // FIX 2
    balances[_to] = balances[_to].add(_value);                     // FIX 2
    return true;
  }

  function balanceOf(address _owner) public constant returns (uint balance) {
    return balances[_owner];
  }
}
