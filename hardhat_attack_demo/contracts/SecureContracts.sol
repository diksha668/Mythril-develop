// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

/*
 * ============================================================================
 *  SECURE CONTRACTS - merged fix of guardbank.sol + calls.sol
 * ============================================================================
 *  Shows that the vulnerabilities Mythril reports in calls.sol can be fixed
 *  with the same techniques used in the guarded EtherBank:
 *
 *   calls.sol function   | Vulnerability (Mythril)                  | Fix applied
 *   ---------------------|------------------------------------------|------------------------------
 *   thisisfine()         | Unchecked return value of low-level call | require(success)
 *   reentrancy()         | State change after external call (SWC-107)| CEI order + nonReentrant
 *   calluseraddress()    | Call to user-supplied address (SWC-107)  | onlyOwner + allowlist + guard
 *   callstoredaddress()  | Call to attacker-settable stored address | onlyOwner + zero-address check
 *   setstoredaddress()   | No access control (SWC-105/106 style)    | onlyOwner
 *   constructor public   | Outdated syntax                          | visibility removed
 *
 *  NOTE: OpenZeppelin v4.x path is used to match guardbank.sol.
 *        For OpenZeppelin v5.x use "@openzeppelin/contracts/utils/ReentrancyGuard.sol".
 * ============================================================================
 */

import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/* ---------------------------------------------------------------------------
 * Simple access control (same idea as OpenZeppelin Ownable, no extra import)
 * ------------------------------------------------------------------------- */
abstract contract OwnableLite {
    address public owner;

    error NotOwner();
    error ZeroAddress();

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}

/* ===========================================================================
 * PART 1 - EtherBank (from guardbank.sol)
 *   Fixed with ReentrancyGuard + Checks-Effects-Interactions
 * ========================================================================= */
contract EtherBank is ReentrancyGuard {
    using Address for address payable;

    mapping(address => uint256) public balances;

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);

    function deposit() external payable {
        balances[msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    function withdraw() external nonReentrant {
        // 1. CHECKS
        uint256 accountBalance = balances[msg.sender];
        require(accountBalance > 0, "Withdrawal amount exceeds available balance.");

        // 2. EFFECTS - zero the balance BEFORE sending ETH
        balances[msg.sender] = 0;

        // 3. INTERACTIONS - external call last
        payable(msg.sender).sendValue(accountBalance);
        emit Withdrawn(msg.sender, accountBalance);
    }

    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
}

/* ===========================================================================
 * PART 2 - SecureCaller (fixed version of Caller from calls.sol)
 *   Same protections as EtherBank, applied to every external call
 * ========================================================================= */
contract SecureCaller is ReentrancyGuard, OwnableLite {
    address public immutable fixed_address;   // FIX: immutable, can never change
    address public stored_address;

    uint256 public statevar;

    // FIX: only addresses approved by the owner may be called
    mapping(address => bool) public allowedTargets;

    error CallFailed(address target);
    error TargetNotAllowed(address target);

    event ExternalCall(address indexed target, bool success);
    event StoredAddressUpdated(address indexed oldAddr, address indexed newAddr);
    event TargetAllowed(address indexed target, bool allowed);

    // FIX: constructor visibility removed (not valid in Solidity >=0.7)
    //      + zero-address validation
    constructor(address addr) {
        if (addr == address(0)) revert ZeroAddress();
        fixed_address = addr;
    }

    /* -----------------------------------------------------------------------
     * Internal helper - every low-level call goes through here.
     * FIX: the return value is ALWAYS checked (unchecked call vulnerability).
     * --------------------------------------------------------------------- */
    function _safeCall(address target) private {
        (bool success, ) = target.call("");
        emit ExternalCall(target, success);
        if (!success) revert CallFailed(target);
    }

    /* -----------------------------------------------------------------------
     * ORIGINAL: fixed_address.call("");
     * VULN    : return value of the call ignored -> silent failure
     * FIX     : checked call + nonReentrant
     * --------------------------------------------------------------------- */
    function thisisfine() external nonReentrant {
        _safeCall(fixed_address);
    }

    /* -----------------------------------------------------------------------
     * ORIGINAL: fixed_address.call(""); statevar = 0;
     * VULN    : state written AFTER the external call -> reentrancy
     * FIX     : Checks-Effects-Interactions (state first, call last)
     *           + nonReentrant guard (same as EtherBank.withdraw)
     * --------------------------------------------------------------------- */
    function reentrancy() external nonReentrant {
        // EFFECTS first
        statevar = 0;
        // INTERACTIONS last
        _safeCall(fixed_address);
    }

    /* -----------------------------------------------------------------------
     * ORIGINAL: addr.call("");   (anyone, any address)
     * VULN    : external call to a user-supplied address
     * FIX     : owner only + target must be on the allowlist + guard
     * --------------------------------------------------------------------- */
    function calluseraddress(address addr) external onlyOwner nonReentrant {
        if (addr == address(0)) revert ZeroAddress();
        if (!allowedTargets[addr]) revert TargetNotAllowed(addr);
        _safeCall(addr);
    }

    /* -----------------------------------------------------------------------
     * ORIGINAL: stored_address.call("");
     * VULN    : stored_address could be set by anyone -> attacker-controlled call
     * FIX     : address can only be set by owner (see below) + checked call
     * --------------------------------------------------------------------- */
    function callstoredaddress() external nonReentrant {
        if (stored_address == address(0)) revert ZeroAddress();
        _safeCall(stored_address);
    }

    /* -----------------------------------------------------------------------
     * ORIGINAL: public, no access control
     * VULN    : anyone could redirect callstoredaddress() to a malicious contract
     * FIX     : onlyOwner + zero-address check + allowlist + event for auditing
     * --------------------------------------------------------------------- */
    function setstoredaddress(address addr) external onlyOwner {
        if (addr == address(0)) revert ZeroAddress();
        if (!allowedTargets[addr]) revert TargetNotAllowed(addr);
        emit StoredAddressUpdated(stored_address, addr);
        stored_address = addr;
    }

    /* -----------------------------------------------------------------------
     * NEW: owner manages which external contracts may be called
     * --------------------------------------------------------------------- */
    function setAllowedTarget(address target, bool allowed) external onlyOwner {
        if (target == address(0)) revert ZeroAddress();
        allowedTargets[target] = allowed;
        emit TargetAllowed(target, allowed);
    }
}
