// SPDX-License-Identifier: MIT
// FIXED version of SmartBugs dataset/arithmetic/timelock.sol (vulnerable line 22)
pragma solidity ^0.8.20;

contract TimeLockFixed {
    mapping(address => uint256) public balances;
    mapping(address => uint256) public lockTime;

    function deposit() public payable {
        balances[msg.sender] += msg.value;
        lockTime[msg.sender] = block.timestamp + 1 weeks;
    }

    function increaseLockTime(uint256 _secondsToIncrease) public {
        // FIX: checked arithmetic (>=0.8) reverts with Panic 0x11 instead of
        // wrapping lockTime back to 0, so the lock can no longer be bypassed.
        lockTime[msg.sender] += _secondsToIncrease;
    }

    function withdraw() public {
        require(balances[msg.sender] > 0, "no balance");
        require(block.timestamp > lockTime[msg.sender], "still locked");
        uint256 transferValue = balances[msg.sender];
        balances[msg.sender] = 0;
        (bool ok, ) = payable(msg.sender).call{value: transferValue}("");
        require(ok, "transfer failed");
    }
}
