/*
 * FIXED version of access_control/phishable.sol
 * Original bug (SWC-115): authorisation via tx.origin, so a call relayed
 *   through an intermediate contract still passes the owner check.
 * Fix: authorise on msg.sender, the immediate caller.
 */
pragma solidity ^0.4.22;

contract Phishable {
    address public owner;

    constructor(address _owner) public {
        owner = _owner;
    }

    function () public payable {} // collect ether

    function withdrawAll(address _recipient) public {
        require(msg.sender == owner); // was: tx.origin == owner
        _recipient.transfer(this.balance);
    }
}
