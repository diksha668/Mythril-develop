const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FIX | Token - same attack replayed on FIXED contracts only", function () {
  for (const name of ["TokenSafeMath", "TokenFixed"]) {
    it(`${name}: transfer with 0 balance is rejected`, async function () {
      const [owner, attacker] = await ethers.getSigners();
      const token = await (await ethers.getContractFactory(name)).deploy(20);
      await expect(token.connect(attacker).transfer(owner.address, 1)).to.be.reverted;
      expect(await token.balanceOf(attacker.address)).to.equal(0n);
      console.log("      attack reverted, attacker balance still 0");
    });
  }
});
