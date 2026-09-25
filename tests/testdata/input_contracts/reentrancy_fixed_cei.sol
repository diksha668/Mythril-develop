// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

// Fixed via checks-effects-interactions: the balance is zeroed BEFORE the
// external call, so a re-entrant call from msg.sender sees a zero balance
// and the require() reverts it.
contract EtherBank {

    mapping(address => uint256) public balances;

    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }

    function withdraw() external {
        uint256 amount = balances[msg.sender];
        require(amount > 0, "Withdrawal amount exceeds available balance.");

        balances[msg.sender] = 0;

        (bool success, ) = msg.sender.call{value: amount}("");
        require(success);
    }

    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
