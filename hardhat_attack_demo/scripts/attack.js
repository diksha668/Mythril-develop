const { ethers } = require("hardhat");

async function runAttack(contractName, label) {
  const [depositor, attacker] = await ethers.getSigners();

  const Bank = await ethers.getContractFactory(contractName);
  const bank = await Bank.deploy();
  await bank.waitForDeployment();
  const bankAddress = await bank.getAddress();

  const Attacker = await ethers.getContractFactory("Attacker");
  const attackerContract = await Attacker.connect(attacker).deploy(bankAddress);
  await attackerContract.waitForDeployment();

  // seed the bank with another depositor's funds, like the reference screenshots
  await bank.connect(depositor).deposit({ value: ethers.parseEther("15") });

  console.log(`\n=== ${label} ===`);
  console.log("EtherBank balance:", (await bank.getBalance()).toString());
  console.log("Attacker's own funds going in:", ethers.parseEther("5").toString());

  let outcome;
  try {
    const tx = await attackerContract.connect(attacker).attack({ value: ethers.parseEther("5") });
    await tx.wait();
    outcome = "ATTACK SUCCEEDED (contract drained)";
  } catch (err) {
    outcome = `ATTACK REVERTED: ${err.shortMessage || err.message}`;
  }

  console.log(outcome);
  console.log("EtherBank balance after:", (await bank.getBalance()).toString());
  console.log("Attacker contract balance after:", (await attackerContract.getBalance()).toString());
}

async function main() {
  await runAttack("contracts/VulnerableBank.sol:EtherBank", "1. Vulnerable Bank");
  await runAttack("contracts/LogicalBank.sol:EtherBank", "2. Logical (Checks-Effects-Interactions) Solution");
  await runAttack("contracts/GuardBank.sol:EtherBank", "3. ReentrancyGuard Solution");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
