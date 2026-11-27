const { expect } = require("chai");
const { ethers } = require("hardhat");

// Unprotected changeOwner(). No value leaves the contract, so Mythril
// typically stays silent — this dynamic test is what proves the bug.
describe("Unprotected changeOwner (static-analysis blind spot)", function () {
  const SLOT0 = 0; // owner is storage slot 0 in both versions

  async function ownerSlot(addr) {
    const raw = await ethers.provider.getStorage(addr, SLOT0);
    return ethers.getAddress("0x" + raw.slice(-40));
  }

  it("VULNERABLE: anyone can reassign ownership", async function () {
    const [deployer, attacker] = await ethers.getSigners();
    const F = await ethers.getContractFactory("contracts/vulnerable/Unprotected.sol:Unprotected");
    const c = await F.deploy();
    await c.waitForDeployment();
    const addr = await c.getAddress();

    expect(await ownerSlot(addr)).to.equal(deployer.address);
    await c.connect(attacker).changeOwner(attacker.address);
    expect(await ownerSlot(addr)).to.equal(attacker.address);
  });

  it("FIXED: non-owner changeOwner reverts", async function () {
    const [deployer, attacker] = await ethers.getSigners();
    const F = await ethers.getContractFactory("contracts/fixed/Unprotected.sol:Unprotected");
    const c = await F.deploy();
    await c.waitForDeployment();

    await expect(c.connect(attacker).changeOwner(attacker.address)).to.be.reverted;
    await expect(c.connect(deployer).changeOwner(attacker.address)).to.not.be.reverted;
  });
});
