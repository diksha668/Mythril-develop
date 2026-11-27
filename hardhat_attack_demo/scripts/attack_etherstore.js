const { ethers } = require("hardhat");

function eth(wei) {
  return `${ethers.formatEther(wei)} ETH`;
}

// etherstore.sol has no getBalance(), so read balances from the provider.
async function balanceOf(contract) {
  return ethers.provider.getBalance(await contract.getAddress());
}

// Run the same attack against one store and report the outcome.
async function runAgainst(storeContractPath, label) {
  const [depositor, attacker] = await ethers.getSigners();

  console.log(`\n==================== ${label} ====================`);

  const Store = await ethers.getContractFactory(storeContractPath);
  const store = await Store.deploy();
  await store.waitForDeployment();

  const Attacker = await ethers.getContractFactory("EtherStoreAttacker");
  const atk = await Attacker.connect(attacker).deploy(await store.getAddress());
  await atk.waitForDeployment();

  // Honest depositors fill the store with 5 ETH.
  await store.connect(depositor).depositFunds({ value: ethers.parseEther("5") });

  console.log("Store balance before      :", eth(await balanceOf(store)));

  let outcome;
  try {
    // Attacker seeds 1 ETH (== withdrawalLimit) and tries to re-enter.
    const tx = await atk
      .connect(attacker)
      .attack({ value: ethers.parseEther("1") });
    await tx.wait();
    outcome = "ATTACK SUCCEEDED";
  } catch (err) {
    outcome = `ATTACK REVERTED: ${err.shortMessage || err.message}`;
  }

  const atkAfter = await atk.getBalance();

  console.log("Outcome                   :", outcome);
  console.log("Store balance after       :", eth(await balanceOf(store)));
  console.log("Attacker contract balance :", eth(atkAfter));

  // Attacker put in 1 ETH. More than 1 ETH back == funds stolen.
  const stolen = atkAfter - ethers.parseEther("1");
  console.log(
    "Net stolen (minus own 1 ETH seed):",
    stolen > 0n ? eth(stolen) : "0 ETH (no theft)"
  );
}

async function main() {
  // Pick a store with TARGET=vulnerable or TARGET=fixed (default: both).
  const target = (process.env.TARGET || "both").toLowerCase();

  // Both files declare `contract EtherStore`, so use fully qualified names.
  if (target === "vulnerable" || target === "both") {
    await runAgainst("contracts/etherstore.sol:EtherStore", "VULNERABLE EtherStore (etherstore.sol)");
  }
  if (target === "fixed" || target === "both") {
    await runAgainst("contracts/etherstore_fixed.sol:EtherStore", "FIXED EtherStore (etherstore_fixed.sol)");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
