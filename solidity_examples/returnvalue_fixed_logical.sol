// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

// returnvalue.sol fixed in the style of LogicalBank.sol / etherbank_fixed.sol.
// No lock: the logic itself handles the call result. Checks-Effects-Interactions
// order is kept (state is written before the external call), and the boolean
// the call returns is captured and acted on. A failed call reverts and rolls
// back the effects, so state never records a call that did not happen.
contract ReturnValue {

  address public callee = 0xE0f7e56E62b4267062172495D7506087205A4229;

  uint256 public callCount;

  error CallFailed(address target);

  function callnotchecked() public {
    // Checks: read storage once, before the external call
    address target = callee;

    // Effects
    callCount += 1;

    // Interaction: the return value is checked
    (bool success, ) = target.call("");
    if (!success) {
      revert CallFailed(target);
    }
  }

  function callchecked() public {
    address target = callee;
    callCount += 1;

    (bool success, ) = target.call("");
    if (!success) {
      revert CallFailed(target);
    }
  }

}
