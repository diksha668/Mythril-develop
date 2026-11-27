const { expect } = require("chai");
const { ethers } = require("hardhat");

// SWC-106 — unprotected selfdestruct.
describe("SimpleSuicide (SWC-106)", function () {
  async function deploy(fqn) {
    const F = await ethers.getContractFactory(fqn);
    const c = await F.deploy();
    await c.waitForDeployment();
    return c;
  }

  it("VULNERABLE: anyone can trigger selfdestruct", async function () {
    const [, attacker] = await ethers.getSigners();
    const c = await deploy("contracts/vulnerable/SimpleSuicide.sol:SimpleSuicide");
    await expect(c.connect(attacker).sudicideAnyone()).to.not.be.reverted;
  });

  it("FIXED: a non-owner is rejected, the owner is allowed", async function () {
    const [owner, attacker] = await ethers.getSigners();
    const c = await deploy("contracts/fixed/SimpleSuicide.sol:SimpleSuicide");
    await expect(c.connect(attacker).sudicideAnyone()).to.be.reverted;
    await expect(c.connect(owner).sudicideAnyone()).to.not.be.reverted;
  });
});
