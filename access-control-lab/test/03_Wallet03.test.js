const { expect } = require("chai");
const { ethers } = require("hardhat");

// SWC-105 — initWallet() is a public function, not the constructor.
describe("Wallet03 wrong constructor (SWC-105)", function () {
  it("VULNERABLE: attacker becomes creator via initWallet() and drains deposits", async function () {
    const [deployer, victim, attacker] = await ethers.getSigners();
    const F = await ethers.getContractFactory("contracts/vulnerable/Wallet03.sol:Wallet");
    const c = await F.deploy();
    await c.waitForDeployment();
    const addr = await c.getAddress();

    // A legitimate user deposits.
    await c.connect(victim).deposit({ value: ethers.parseEther("10") });
    expect(await ethers.provider.getBalance(addr)).to.equal(ethers.parseEther("10"));

    // Attack: hijack creator, then migrate everything out.
    await c.connect(attacker).initWallet();
    await c.connect(attacker).migrateTo(attacker.address);

    expect(await ethers.provider.getBalance(addr)).to.equal(0n);
  });

  it("FIXED: no initWallet(), and migrateTo is creator-only", async function () {
    const [deployer, victim, attacker] = await ethers.getSigners();
    const F = await ethers.getContractFactory("contracts/fixed/Wallet03.sol:Wallet");
    const c = await F.deploy();
    await c.waitForDeployment();

    await c.connect(victim).deposit({ value: ethers.parseEther("10") });
    expect(c.interface.hasFunction("initWallet")).to.equal(false);
    await expect(c.connect(attacker).migrateTo(attacker.address)).to.be.reverted;
  });
});
