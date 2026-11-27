const { expect } = require("chai");
const { ethers } = require("hardhat");

// SWC-105 — newOwner() missing the onlyOwner modifier.
describe("MultiOwnable missing modifier (SWC-105)", function () {
  it("VULNERABLE: attacker self-registers as owner and drains", async function () {
    const [deployer, attacker] = await ethers.getSigners();
    const F = await ethers.getContractFactory(
      "contracts/vulnerable/MultiOwnable.sol:TestContract"
    );
    const c = await F.deploy();
    await c.waitForDeployment();
    const addr = await c.getAddress();

    await deployer.sendTransaction({ to: addr, value: ethers.parseEther("3") });

    // Attack: register self as owner, then withdraw everything.
    await c.connect(attacker).newOwner(attacker.address);
    await c.connect(attacker).withdrawAll();

    expect(await ethers.provider.getBalance(addr)).to.equal(0n);
  });

  it("FIXED: newOwner is owner-only, so withdrawAll stays denied", async function () {
    const [deployer, attacker] = await ethers.getSigners();
    const F = await ethers.getContractFactory(
      "contracts/fixed/MultiOwnable.sol:TestContract"
    );
    const c = await F.deploy();
    await c.waitForDeployment();
    const addr = await c.getAddress();
    await deployer.sendTransaction({ to: addr, value: ethers.parseEther("3") });

    await expect(c.connect(attacker).newOwner(attacker.address)).to.be.reverted;
    await expect(c.connect(attacker).withdrawAll()).to.be.reverted;
  });
});
