// One command: ATTACK on the vulnerable contract, then the same attack on the FIXED one.
//   npm run demo:token | demo:timelock | demo:bec | demo (all three)
const { spawnSync } = require("child_process");
const path = require("path");

const which = (process.argv[2] || process.env.CASE || "all").toLowerCase();
const root = path.join(__dirname, "..");
const hardhat = path.join(root, "node_modules", "hardhat", "internal", "cli", "bootstrap.js");

function run(title, script) {
  console.log("\n" + "#".repeat(66) + "\n# " + title + "\n" + "#".repeat(66));
  const r = spawnSync(process.execPath, [hardhat, "run", script], {
    cwd: root, stdio: "inherit", env: { ...process.env, CASE: which },
  });
  if (r.status !== 0) process.exit(r.status || 1);
}

run("PART 1: ATTACK on VULNERABLE contract (bug exploited)", "scripts/attack.js");
run("PART 2: SAME ATTACK on FIXED contract (must be blocked)", "scripts/fix.js");
