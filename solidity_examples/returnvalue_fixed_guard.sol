// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

// returnvalue.sol fixed in the style of GuardBank.sol / etherbank_fixed_guard.sol.
// The nonReentrant lock on its own does NOT fix SWC-104 (it only stops
// re-entry). The fix is require(success): if the callee reverts, the whole
// transaction reverts instead of continuing silently. GuardBank.sol gets this
// same check from OpenZeppelin's Address.sendValue().
contract ReturnValue {

  address public callee = 0xE0f7e56E62b4267062172495D7506087205A4229;

  bool private locked;

  modifier nonReentrant() {
    require(!locked, "Reentrant call blocked.");
    locked = true;
    _;
    locked = false;
  }

  function callnotchecked() public nonReentrant {
    (bool success, ) = callee.call("");
    require(success, "External call failed.");
  }

  function callchecked() public nonReentrant {
    (bool success, ) = callee.call("");
    require(success, "External call failed.");
  }

}
