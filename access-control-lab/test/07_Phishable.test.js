const { expect } = require("chai");
const { ethers } = require("hardhat");

// SWC-115 — tx.origin used for authorisation.
describe("Phishable tx.origin (SWC-115)", function () {
  it("VULNERABLE: a relay the owner calls drains funds via tx.origin", async function () {
    const [deployer, owner, attacker] = await ethers.getSigners();

    const P = await ethers.getContractFactory("contracts/vulnerable/Phishable.sol:Phishable");
    const phish = await P.deploy(owner.address);
    await phish.waitForDeployment();
    const phishAddr = await phish.getAddress();
    await deployer.sendTransaction({ to: phishAddr, value: ethers.parseEther("8") });

    const A = await ethers.getContractFactory("contracts/attack/AttackPhishable.sol:AttackPhishable");
    const attack = await A.connect(attacker).deploy(phishAddr);
    await attack.waitForDeployment();

    // The owner is lured into touching the relay contract.
    await owner.sendTransaction({ to: await attack.getAddress(), value: 0 });

    // tx.origin was the owner, so the check passed and funds left.
    expect(await ethers.provider.getBalance(phishAddr)).to.equal(0n);
  });

  it("FIXED: msg.sender check makes the relay attack revert", async function () {
    const [deployer, owner, attacker] = await ethers.getSigners();

    const P = await ethers.getContractFactory("contracts/fixed/Phishable.sol:Phishable");
    const phish = await P.deploy(owner.address);
    await phish.waitForDeployment();
    const phishAddr = await phish.getAddress();
    await deployer.sendTransaction({ to: phishAddr, value: ethers.parseEther("8") });

    const A = await ethers.getContractFactory("contracts/attack/AttackPhishable.sol:AttackPhishable");
    const attack = await A.connect(attacker).deploy(phishAddr);
    await attack.waitForDeployment();

    await expect(
      owner.sendTransaction({ to: await attack.getAddress(), value: 0 })
    ).to.be.reverted;
    expect(await ethers.provider.getBalance(phishAddr)).to.equal(ethers.parseEther("8"));
  });
});
