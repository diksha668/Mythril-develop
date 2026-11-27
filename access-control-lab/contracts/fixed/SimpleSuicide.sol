/*
 * FIXED version of access_control/simple_suicide.sol
 * Original bug (SWC-106): selfdestruct reachable by anyone.
 * Fix: record the deployer as owner and gate the destructive call behind onlyOwner.
 */
pragma solidity ^0.4.25;

contract SimpleSuicide {
    address public owner;

    constructor() public {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner);
        _;
    }

    function sudicideAnyone() public onlyOwner {
        selfdestruct(owner);
    }
}
