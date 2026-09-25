// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

// Fixed via a reentrancy guard (minimal inline version of
// OpenZeppelin's ReentrancyGuard, kept dependency-free for this example).
// The lock blocks a re-entrant call to withdraw() even though the external
// call still happens before the state update.
contract EtherBank {

    mapping(address => uint256) public balances;

    bool private locked;

    modifier nonReentrant() {
        require(!locked, "Reentrant call blocked.");
        locked = true;
        _;
        locked = false;
    }

    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }

    function withdraw() external nonReentrant {
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
