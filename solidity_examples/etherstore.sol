// REENTRANCY GUARD SOLUTION TO VULNERABLE ETHERSTORE SMART CONTRACT

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

// Same OpenZeppelin guard used in the EtherBank solution (OpenZeppelin v4.x path).
// If you have OpenZeppelin v5.x installed, use:
//   import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

// IMPORTING AND USING REENTRANCY GUARD
contract EtherStore is ReentrancyGuard {

    // maximum amount a user can withdraw in one go
    uint256 public withdrawalLimit = 1 ether;

    // when each user last withdrew (used for the 1-week cooldown)
    mapping(address => uint256) public lastWithdrawTime;

    // keeps track of each user's deposited balance
    mapping(address => uint256) public balances;

    // deposit funds into the sender's account
    function depositFunds() public payable {
        balances[msg.sender] += msg.value;
    }

    // withdraw up to 1 ether, at most once per week
    // nonReentrant: if this function is entered again before it finishes
    // (e.g. from an attacker's receive/fallback function), the call reverts.
    function withdrawFunds(uint256 _weiToWithdraw) public nonReentrant {
        require(balances[msg.sender] >= _weiToWithdraw, "Insufficient balance.");
        // limit the withdrawal
        require(_weiToWithdraw <= withdrawalLimit, "Amount exceeds withdrawal limit.");
        // limit the time allowed to withdraw
        require(block.timestamp >= lastWithdrawTime[msg.sender] + 1 weeks, "Withdrawal cooldown active.");

        // WE DON'T USE THE LOGICAL SOLUTION HERE (state is still updated after the
        // external call), so the guard alone is what blocks the reentrancy attack.
        (bool success, ) = payable(msg.sender).call{value: _weiToWithdraw}("");
        require(success, "Transfer failed.");

        balances[msg.sender] -= _weiToWithdraw;
        lastWithdrawTime[msg.sender] = block.timestamp;
    }

    // check the total balance of the EtherStore contract
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
