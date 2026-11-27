// SPDX-License-Identifier: MIT
// FIXED (minimal) version of the batchTransfer logic in SmartBugs
// dataset/arithmetic/BECToken.sol (vulnerable line 264, the 2018 "batchOverflow" bug)
pragma solidity ^0.8.20;

contract BecTokenFixed {
    mapping(address => uint256) public balances;
    uint256 public totalSupply;

    event Transfer(address indexed from, address indexed to, uint256 value);

    constructor() {
        totalSupply = 7000000000 * (10 ** 18);
        balances[msg.sender] = totalSupply;
    }

    function balanceOf(address _owner) public view returns (uint256) {
        return balances[_owner];
    }

    function batchTransfer(address[] calldata _receivers, uint256 _value) public returns (bool) {
        uint256 cnt = _receivers.length;
        require(cnt > 0 && cnt <= 20, "bad receiver count");
        require(_value > 0, "zero value");
        // FIX: in >=0.8 this multiplication reverts (Panic 0x11) on overflow,
        // so amount can never wrap to 0 and bypass the balance check.
        uint256 amount = cnt * _value;
        require(balances[msg.sender] >= amount, "insufficient balance");

        balances[msg.sender] -= amount;
        for (uint256 i = 0; i < cnt; i++) {
            balances[_receivers[i]] += _value;
            emit Transfer(msg.sender, _receivers[i], _value);
        }
        return true;
    }
}
