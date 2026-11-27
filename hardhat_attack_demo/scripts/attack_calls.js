const { ethers } = require("hardhat");

// Run the same attack against one Caller contract and report the outcome.
async function runAgainst(callerContractPath, label) {
  const [owner, attacker] = await ethers.getSigners();

  console.log(`\n==================== ${label} ====================`);

  // fixed_address points to a contract whose fallback always reverts.
  const Reverter = await ethers.getContractFactory("RevertingTarget");
  const reverter = await Reverter.deploy();
  await reverter.waitForDeployment();

  const Caller = await ethers.getContractFactory(callerContractPath);
  const victim = await Caller.connect(owner).deploy(await reverter.getAddress());
  await victim.waitForDeployment();
  const victimAddress = await victim.getAddress();

  const Attacker = await ethers.getContractFactory("CallsAttacker");
  const atk = await Attacker.connect(attacker).deploy(victimAddress);
  await atk.waitForDeployment();

  console.log("Owner                       :", owner.address);
  console.log("Attacker                    :", attacker.address);
  console.log("Victim deployed at          :", victimAddress);
  console.log("Attacker contract at        :", await atk.getAddress());

  // ---- Check 1: unchecked return value (SWC-104) ----
  let uncheckedResult;
  try {
    const tx = await victim.connect(owner).thisisfine();
    await tx.wait();
    uncheckedResult = "tx SUCCEEDED although inner call failed (BUG)";
  } catch (err) {
    uncheckedResult = `tx REVERTED: ${err.shortMessage || err.message} (SAFE)`;
  }

  // ---- Check 2: hijack stored_address + reentrancy + user-supplied call ----
  console.log("\n--- Before attack ---");
  console.log("stored_address              :", await victim.stored_address());
  console.log("Calls received by attacker  :", (await atk.timesCalled()).toString());

  let outcome;
  try {
    const tx = await atk.connect(attacker).attack();
    await tx.wait();
    outcome = "ATTACK SUCCEEDED";
  } catch (err) {
    outcome = `ATTACK REVERTED: ${err.shortMessage || err.message}`;
  }

  const hits = await atk.timesCalled();
  const reentries = await atk.reentries();

  console.log("\n--- After attack ---");
  console.log("Outcome                     :", outcome);
  console.log("stored_address              :", await victim.stored_address());
  console.log("Calls received by attacker  :", hits.toString());
  console.log("Re-entries into victim      :", reentries.toString());
  console.log("thisisfine() on failing call:", uncheckedResult);

  console.log(
    "Result                      :",
    hits > 0n
      ? `VULNERABLE - attacker hijacked ${hits} call(s), re-entered ${reentries} time(s)`
      : "SAFE - attacker could not hijack or re-enter any call"
  );
}

async function main() {
  // Pick a contract with TARGET=vulnerable or TARGET=fixed (default: both).
  const target = (process.env.TARGET || "both").toLowerCase();

  if (target === "vulnerable" || target === "both") {
    await runAgainst("contracts/calls.sol:Caller", "VULNERABLE Caller (calls.sol)");
  }
  if (target === "fixed" || target === "both") {
    await runAgainst("contracts/calls_fixed.sol:CallerFixed", "FIXED CallerFixed (calls_fixed.sol)");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
