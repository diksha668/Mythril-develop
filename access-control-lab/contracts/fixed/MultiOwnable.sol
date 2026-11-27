/*
 * FIXED version of access_control/multiowned_vulnerable.sol
 * Original bug (SWC-105): newOwner() was missing the onlyOwner modifier,
 *   so anyone could register themselves as an owner and then withdrawAll().
 * Fix: gate newOwner() behind onlyOwner.
 */
pragma solidity ^0.4.23;

contract MultiOwnable {
    address public root;
    mapping (address => address) public owners; // owner => parent of owner

    constructor() public {
        root = msg.sender;
        owners[root] = root;
    }

    modifier onlyOwner() {
        require(owners[msg.sender] != 0);
        _;
    }

    function newOwner(address _owner) external onlyOwner returns (bool) { // added onlyOwner
        require(_owner != 0);
        owners[_owner] = msg.sender;
        return true;
    }

    function deleteOwner(address _owner) onlyOwner external returns (bool) {
        require(owners[_owner] == msg.sender || (owners[_owner] != 0 && msg.sender == root));
        owners[_owner] = 0;
        return true;
    }
}

contract TestContract is MultiOwnable {
    function withdrawAll() onlyOwner public {
        msg.sender.transfer(this.balance);
    }

    function() payable public {
    }
}
