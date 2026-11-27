// FIX only: replays the SAME attacks on the FIXED contracts; every one must be rejected.
//   npx hardhat run scripts/fix.js        (CASE=token|timelock|bec to pick one)
const { ethers } = require("hardhat");
const L = console.log;
const head = (s) => L("\n" + "=".repeat(66) + "\n" + s + "\n" + "=".repeat(66));
const which = (process.env.CASE || "all").toLowerCase();
const on = (k) => which === "all" || which === k;
const blocked = async (fn) => {
  try { await fn(); return "!! NOT BLOCKED (fix failed)"; }
  catch (e) { return "BLOCKED: " + (e.shortMessage || e.message).split("\n")[0]; }
};

async function main() {
  const [owner, attacker, r1, r2] = await ethers.getSigners();
  if (on("token")) for (const n of ["TokenSafeMath", "TokenFixed"]) {
    head("FIX 1: " + n);
    const c = await (await ethers.getContractFactory(n)).deploy(20);
    L("transfer(owner,1) with 0 tokens ->", await blocked(async () => (await c.connect(attacker).transfer(owner.address, 1)).wait()));
    L("attacker balance:", String(await c.balanceOf(attacker.address)));
  }
  if (on("timelock")) for (const n of ["TimeLockSafeMath", "TimeLockFixed"]) {
    head("FIX 2: " + n);
    const c = await (await ethers.getContractFactory(n)).deploy();
    await (await c.connect(attacker).deposit({ value: ethers.parseEther("1") })).wait();
    const t = await c.lockTime(attacker.address);
    L("increaseLockTime(2^256-t) ->", await blocked(async () => (await c.connect(attacker).increaseLockTime(ethers.MaxUint256 - t + 1n)).wait()));
    L("lockTime unchanged:", String(await c.lockTime(attacker.address)) === String(t));
    L("withdraw() ->", await blocked(async () => (await c.connect(attacker).withdraw()).wait()));
  }
  if (on("bec")) for (const n of ["BecTokenSafeMath", "BecTokenFixed"]) {
    head("FIX 3: " + n);
    const c = await (await ethers.getContractFactory(n)).deploy();
    L("batchTransfer([r1,r2],2^255) ->", await blocked(async () => (await c.connect(attacker).batchTransfer([r1.address, r2.address], 2n ** 255n)).wait()));
    L("receiver1 balance:", String(await c.balanceOf(r1.address)));
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
