/*
 * FIXED version of access_control/unprotected0.sol
 * Original bug: changeOwner() had no access control, so anyone could
 *   reassign ownership. (Mythril typically does NOT flag this, because no
 *   value leaves the contract — the Hardhat exploit test is what proves it.)
 * Fix: apply the onlyowner modifier the contract already defines.
 */
pragma solidity ^0.4.15;

contract Unprotected {
    address private owner;

    modifier onlyowner {
        require(msg.sender == owner);
        _;
    }

    constructor() public {
        owner = msg.sender;
    }

    function changeOwner(address _newOwner) public onlyowner {
        owner = _newOwner;
    }

    function getOwner() public view returns (address) {
        return owner;
    }
}
