// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

// Classic reentrancy: external call happens BEFORE the balance is zeroed,
// so a malicious `msg.sender` can re-enter withdraw() from its receive()
// hook and drain the contract. Detected by Mythril as SWC-107.
contract EtherBank {

    mapping(address => uint256) public balances;

    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }

    function withdraw() external {
        uint256 amount = balances[msg.sender];
        require(amount > 0, "Withdrawal amount exceeds available balance.");

        (bool success, ) = msg.sender.call{value: amount}("");
        require(success);

        balances[msg.sender] = 0;
    }

    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
