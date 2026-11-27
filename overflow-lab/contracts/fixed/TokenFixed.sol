// SPDX-License-Identifier: MIT
// FIXED version of SmartBugs dataset/arithmetic/token.sol (vulnerable lines 20, 22)
pragma solidity ^0.8.20;

contract TokenFixed {
    mapping(address => uint256) balances;
    uint256 public totalSupply;

    constructor(uint256 _initialSupply) {
        balances[msg.sender] = totalSupply = _initialSupply;
    }

    function transfer(address _to, uint256 _value) public returns (bool) {
        // FIX 1: compare before subtracting. The original
        // `balances[msg.sender] - _value >= 0` is ALWAYS true for uint.
        require(balances[msg.sender] >= _value, "insufficient balance");
        // FIX 2: Solidity >=0.8 reverts on underflow automatically (Panic 0x11).
        balances[msg.sender] -= _value;
        balances[_to] += _value;
        return true;
    }

    function balanceOf(address _owner) public view returns (uint256) {
        return balances[_owner];
    }
}
