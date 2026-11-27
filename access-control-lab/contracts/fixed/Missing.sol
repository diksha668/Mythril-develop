/*
 * FIXED version of access_control/incorrect_constructor_name1.sol
 * Original bug (SWC-105): the intended constructor was a plain function
 *   named IamMissing(), callable by anyone to seize ownership.
 * Fix: use the constructor keyword so the initialiser runs once, at deploy.
 */
pragma solidity ^0.4.24;

contract Missing {
    address private owner;

    modifier onlyowner {
        require(msg.sender == owner);
        _;
    }

    constructor() public { // was: function IamMissing() public
        owner = msg.sender;
    }

    function () public payable {}

    function withdraw() public onlyowner {
        owner.transfer(this.balance);
    }
}
