const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FIX | BecToken - same attack replayed on FIXED contracts only", function () {
  const HUGE = 2n ** 255n;
  for (const name of ["BecTokenSafeMath", "BecTokenFixed"]) {
    it(`${name}: batchTransfer overflow reverts`, async function () {
      const [, attacker, r1, r2] = await ethers.getSigners();
      const bec = await (await ethers.getContractFactory(name)).deploy();
      await expect(bec.connect(attacker).batchTransfer([r1.address, r2.address], HUGE)).to.be.reverted;
      expect(await bec.balanceOf(r1.address)).to.equal(0n);
      console.log("      attack reverted, receiver balance still 0");
    });
  }
});
