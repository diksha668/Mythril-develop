/*
 * FIXED version of access_control/wallet_03_wrong_constructor.sol
 * Original bug (SWC-105): initWallet() was a public function, not the
 *   constructor, so anyone could call it, become creator, and drain funds
 *   through migrateTo().
 * Fix: set creator in the constructor; remove the public initialiser.
 */
pragma solidity ^0.4.24;

contract Wallet {
    address creator;
    mapping(address => uint256) balances;

    constructor() public { // was: function initWallet() public
        creator = msg.sender;
    }

    function deposit() public payable {
        assert(balances[msg.sender] + msg.value > balances[msg.sender]);
        balances[msg.sender] += msg.value;
    }

    function withdraw(uint256 amount) public {
        require(amount <= balances[msg.sender]);
        msg.sender.transfer(amount);
        balances[msg.sender] -= amount;
    }

    function migrateTo(address to) public {
        require(creator == msg.sender);
        to.transfer(this.balance);
    }
}
