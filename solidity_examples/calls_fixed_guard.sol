// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

// calls.sol with its reentrancy fixed via a reentrancy guard (same minimal
// inline nonReentrant modifier as etherbank_fixed_guard.sol). The lock blocks
// a re-entrant call into any guarded function while an external call is in
// progress, even though reentrancy() still writes statevar after its call.
contract Caller {

	address public fixed_address;
	address public stored_address;

	uint256 statevar;

	bool private locked;

	modifier nonReentrant() {
		require(!locked, "Reentrant call blocked.");
		locked = true;
		_;
		locked = false;
	}

	constructor(address addr) {
		fixed_address = addr;
	}

	function thisisfine() public nonReentrant {
	    fixed_address.call("");
	}

	function reentrancy() public nonReentrant {
	    fixed_address.call("");
	    statevar = 0;
	}

	function calluseraddress(address addr) public nonReentrant {
	    addr.call("");
	}

	function callstoredaddress() public nonReentrant {
	    stored_address.call("");
	}

	function setstoredaddress(address addr) public nonReentrant {
	    stored_address = addr;
	}

}
