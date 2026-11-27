/*
 * FIXED version of access_control/proxy.sol
 * Original bug (SWC-112): forward() let anyone delegatecall an arbitrary
 *   address, running foreign code in this contract's storage context.
 * Fix: restrict the call to the owner and to a pre-approved target.
 */
pragma solidity ^0.4.24;

contract Proxy {
    address owner;
    mapping(address => bool) public allowedCallees;

    constructor() public {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner);
        _;
    }

    function setCallee(address callee, bool allowed) public onlyOwner {
        allowedCallees[callee] = allowed;
    }

    function forward(address callee, bytes _data) public onlyOwner {
        require(allowedCallees[callee]); // only vetted libraries
        require(callee.delegatecall(_data));
    }
}
