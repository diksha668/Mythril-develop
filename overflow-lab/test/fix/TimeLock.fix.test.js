const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FIX | TimeLock - same attack replayed on FIXED contracts only", function () {
  for (const name of ["TimeLockSafeMath", "TimeLockFixed"]) {
    it(`${name}: overflow reverts and the lock holds`, async function () {
      const [attacker] = await ethers.getSigners();
      const lock = await (await ethers.getContractFactory(name)).deploy();
      await lock.connect(attacker).deposit({ value: ethers.parseEther("1") });
      const t = await lock.lockTime(attacker.address);
      await expect(lock.connect(attacker).increaseLockTime(ethers.MaxUint256 - t + 1n)).to.be.reverted;
      expect(await lock.lockTime(attacker.address)).to.equal(t);
      await expect(lock.connect(attacker).withdraw()).to.be.reverted;
      console.log("      overflow reverted, withdraw still locked");
    });
  }
});
