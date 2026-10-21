const { ethers } = require("hardhat");

function eth(wei) {
  return `${ethers.formatEther(wei)} ETH`;
}

async function main() {
  const [depositor, attacker] = await ethers.getSigners();

  console.log("=== Setup ===");
  console.log("Depositor:", depositor.address);
  console.log("Attacker :", attacker.address);

  const Bank = await ethers.getContractFactory("contracts/GuardBank.sol:EtherBank");
  const bank = await Bank.deploy();
  await bank.waitForDeployment();
  const bankAddress = await bank.getAddress();
  console.log("GuardBank deployed at:", bankAddress);

  const Attacker = await ethers.getContractFactory("Attacker");
  const attackerContract = await Attacker.connect(attacker).deploy(bankAddress);
  await attackerContract.waitForDeployment();
  console.log("Attacker contract deployed at:", await attackerContract.getAddress());

  // A legitimate depositor puts money in the bank first.
  await bank.connect(depositor).deposit({ value: ethers.parseEther("15") });

  const attackerEoaBalanceBefore = await ethers.provider.getBalance(attacker.address);

  console.log("\n=== Before attack ===");
  console.log("Bank balance          :", eth(await bank.getBalance()));
  console.log("Depositor's own funds  :", eth(await bank.balances(depositor.address)));
  console.log("Attacker EOA balance   :", eth(attackerEoaBalanceBefore));

  console.log("\n=== Attack transaction (deposit 5 ETH, then withdraw -> attempt reenter) ===");
  let outcome;
  try {
    const tx = await attackerContract.connect(attacker).attack({ value: ethers.parseEther("5") });
    await tx.wait();
    outcome = "ATTACK SUCCEEDED";
  } catch (err) {
    outcome = `ATTACK REVERTED: ${err.shortMessage || err.message}`;
  }
  console.log(outcome);

  console.log("\n=== After attack ===");
  console.log("Bank balance                 :", eth(await bank.getBalance()));
  console.log("Attacker contract balance    :", eth(await attackerContract.getBalance()));
  const attackerEoaBalanceAfter = await ethers.provider.getBalance(attacker.address);
  console.log("Attacker EOA balance         :", eth(attackerEoaBalanceAfter));

  const netChange = attackerEoaBalanceAfter - attackerEoaBalanceBefore;

  console.log("\n=== Net result ===");
  console.log("Net wallet change (should be ~0, minus gas if reverted):", eth(netChange));
  console.log("Depositor's funds still safe in the bank:", eth(await bank.balances(depositor.address)));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
