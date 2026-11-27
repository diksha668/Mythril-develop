/*
 * FIXED version of access_control/mycontract.sol
 * Original bug (SWC-115): authorisation via tx.origin.
 * Fix: authorise on msg.sender.
 */
pragma solidity ^0.4.24;

contract MyContract {
    address owner;

    constructor() public {
        owner = msg.sender;
    }

    function sendTo(address receiver, uint amount) public {
        require(msg.sender == owner); // was: tx.origin == owner
        receiver.transfer(amount);
    }
}
