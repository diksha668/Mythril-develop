# Mythril Workspace — Project Documentation

This document explains what this repository is, what work has been done on top of
the upstream Mythril project in this workspace, why each change was made, and how
to run everything yourself. It is written so that someone opening this repo for
the first time can understand the whole picture without having to read every
commit and diff individually.

---

## 1. What is Mythril?

[Mythril](https://github.com/Consensys/mythril) is a **symbolic-execution-based
security analysis tool for EVM bytecode**. Given a Solidity file, a compiled
bytecode file, or a deployed contract address, it explores the contract's
possible execution paths and flags known vulnerability classes (the
[SWC registry](https://swcregistry.io/)) — things like integer overflow,
unprotected `selfdestruct`, and (relevant to the work below) **reentrancy**
(SWC-107, detected via the `StateChangeAfterCall` module: it flags any path
where contract state is written *after* an external `CALL`).

You run it from the command line as `myth analyze <file>.sol` (or via Docker /
pip install). This repository is the Mythril source tree itself — the work
below is development *on* Mythril (bug fixes, test coverage) plus a **separate
standalone demo** that shows a reentrancy exploit actually draining a contract,
built to validate what Mythril's static analysis predicts.

---

## 2. Summary of What Was Done

| # | Area | What | Why |
|---|------|------|-----|
| 1 | `mythril/plugin/discovery.py` | Fixed `entry_points()` usage for Python 3.10+ | Mythril's plugin loader crashed on modern Python |
| 2 | `mythril/mythril/mythril_disassembler.py` | Fixed `file:contract_name` parsing on Windows | Windows absolute paths (`C:\...`) broke the parser |
| 3 | `tests/cmd_line_test.py`, `tests/integration_tests/utils.py` | Made the test suite run on Windows | Hardcoded `python3`, unquoted paths, and `\r\n` line endings all failed on Windows |
| 4 | `solidity_examples/`, `tests/testdata/input_contracts/` | Added 3 reentrancy (SWC-107) Solidity fixtures | No automated test coverage existed for the `StateChangeAfterCall` detector |
| 5 | `tests/integration_tests/analysis_tests.py` | Added a parametrized regression test over those 3 fixtures | Lock in detector behavior, including a documented known limitation |
| 6 | `hardhat_attack_demo/` | Built a full Hardhat project that **actually performs** a live reentrancy attack | Prove the vulnerability Mythril flags statically is real and exploitable, and show what each fix does differently |
| 7 | `solidity_examples/hardhat_reference/` | Kept the original Hardhat/OpenZeppelin-flavored contracts for provenance | Mythril can't resolve `hardhat/console.sol` or `@openzeppelin` imports, so these aren't analyzed directly — they're the "source of truth" the dependency-free fixtures were derived from |

Each of these is explained in detail below.

---

## 3. Bug Fixes to Mythril Itself

### 3.1 `entry_points()` crash on Python 3.10+ (commit `2e487b5`)

**File:** `mythril/plugin/discovery.py`

Mythril discovers analysis plugins via Python's `importlib.metadata.entry_points()`.
Starting with Python 3.10, calling `entry_points()` **without** a `group=` filter
returns a dict-like `SelectableGroups` object keyed by group name, rather than a
flat list of `EntryPoint` objects. The old code iterated over this unfiltered
result and then accessed `ep.group` on each item — but each item was actually a
*group name string*, not an `EntryPoint`, so it raised `AttributeError`.

**Fix:** call `entry_points(group="mythril.plugins")` directly, which returns the
correctly-typed list of entry points for that group on all supported Python
versions.

**Why it matters:** without this fix, Mythril's plugin discovery (and therefore
plugin-dependent analysis) was broken on any Python 3.10+ environment.

### 3.2 Windows path parsing bug in the disassembler (`mythril_disassembler.py`)

**File:** `mythril/mythril/mythril_disassembler.py`

Mythril accepts solidity file arguments in the form `path/to/File.sol:ContractName`
(to disambiguate when a file has multiple contracts). The original parser did:

```python
if ":" in file:
    file, contract_name = file.split(":")
```

On Windows, an absolute path looks like `C:\Users\...\File.sol`, which also
contains a `:`. The old code would split on the *first* colon it found — the one
after the drive letter — and produce garbage (`file = "C"`,
`contract_name = "\Users\...\File.sol"`), which then fails to resolve.

**Fix:**

```python
head, sep, tail = file.rpartition(":")
if sep and head and "\\" not in tail and "/" not in tail:
    file, contract_name = head, tail
else:
    contract_name = None
```

This uses `rpartition` (splits on the *last* colon) and additionally checks that
the text after the colon doesn't look like a path fragment (no `\` or `/`), which
is true for a real `:ContractName` suffix but false for a Windows drive letter.
A plain absolute path with no contract suffix is now left untouched.

### 3.3 Making the test suite runnable on Windows (`tests/cmd_line_test.py`, `tests/integration_tests/utils.py`)

Several small, unrelated-looking fixes were all needed to get the existing test
suite to pass on Windows:

- **Hardcoded `python3`** → replaced with `sys.executable`, since only `python`
  (not `python3`) is typically on `PATH` on Windows, and `sys.executable` is
  correct everywhere regardless of what the interpreter is named.
- **Unquoted file paths in shell commands** (e.g. `myth analyze {file}`) → wrapped
  in `"..."`, because Windows paths containing spaces (`F:\Smart Contracts\...`)
  broke the shell command otherwise.
- **`\r\n` vs `\n` in subprocess output** → `output_of()` / `total_output()` now
  `.replace("\r\n", "\n")` the decoded output before assertions run, since
  Windows subprocesses emit `\r\n` line endings but the test assertions expect
  Unix-style `\n`.
- **`output_of()` didn't accept a working directory** (`tests/integration_tests/utils.py`)
  → added a `cwd=None` parameter, needed by the new reentrancy test (see below)
  so it can run `myth` with a *relative* path from the project root instead of an
  absolute one (working around the same drive-letter-colon ambiguity as §3.2 at
  the call-site level, belt-and-suspenders).

---

## 4. Reentrancy (SWC-107) Test Fixtures (commit `018e96d`)

Before this work, the `StateChangeAfterCall` module (Mythril's reentrancy
detector) had **no automated regression test**. This section added one.

### 4.1 The three fixtures

Three versions of the same simple "bank" contract were created, each
representing a different point on the reentrancy-safety spectrum:

| File (dependency-free, analyzed by Mythril) | Behavior |
|---|---|
| `solidity_examples/etherbank_vulnerable.sol` / `tests/testdata/input_contracts/reentrancy_vulnerable.sol` | **Vulnerable.** Sends ETH via `.call{value: amount}("")` **before** zeroing the caller's balance. A malicious contract's `receive()` hook can call `withdraw()` again before the balance is zeroed, draining the contract. |
| `tests/testdata/input_contracts/reentrancy_fixed_cei.sol` | **Fixed via Checks-Effects-Interactions (CEI).** Balance is zeroed **before** the external call, so a re-entrant call sees a zero balance and its `require()` reverts. |
| `tests/testdata/input_contracts/reentrancy_fixed_guard.sol` | **Fixed via a reentrancy lock** (a boolean flag set before the external call and checked on entry, modeling OpenZeppelin's `ReentrancyGuard`/`nonReentrant`), *without* reordering the state write after the call. |

These are deliberately written with **no external imports** (no
`hardhat/console.sol`, no `@openzeppelin/contracts`) so Mythril — which doesn't
resolve Node-style imports — can compile and analyze them directly with
`solc`.

### 4.2 The original Hardhat-flavored contracts (`solidity_examples/hardhat_reference/`)

The dependency-free fixtures above were derived from an earlier, more
"realistic" version of the same contracts written against Hardhat and
OpenZeppelin (using `ReentrancyGuard`, `Address.sendValue`, and
`console.log` for debugging). Those originals are preserved under
`solidity_examples/hardhat_reference/` purely **for provenance** — Mythril
cannot analyze them directly, since it has no Hardhat/npm import resolution.
Each file has a header comment pointing to its dependency-free equivalent.

### 4.3 The regression test (`tests/integration_tests/analysis_tests.py`)

```python
test_data_reentrancy = [
    ("reentrancy_vulnerable.sol", True),
    ("reentrancy_fixed_cei.sol", False),
    ("reentrancy_fixed_guard.sol", True),   # <- see note below
]

@pytest.mark.parametrize("file_name, exists", test_data_reentrancy)
def test_state_change_after_external_call(file_name, exists):
    file_path = TESTDATA / "input_contracts" / file_name
    relative_file_path = os.path.relpath(file_path, PROJECT_DIR)
    assert (
        "State access after external call"
        in output_of(
            f'"{sys.executable}" "{MYTH}" a "{relative_file_path}" --solver-timeout 25000',
            cwd=PROJECT_DIR,
        )
    ) == exists
```

This runs `myth analyze` against each of the three fixtures and asserts whether
the "State access after external call" finding appears in the output.

**The interesting result is the third row.** You might expect the
guard-protected contract to be clean, since at runtime the `nonReentrant` lock
genuinely prevents the exploit. But Mythril **still flags it** (`True`), and
that's the *correct* expected value in the test — not a bug in the fixture.

**Why:** the `StateChangeAfterCall` module works by checking, along each
symbolic execution path, whether a storage write is reachable *after* a `CALL`
opcode. It does not reason about *why* a particular path might be unreachable
at runtime (e.g., because a boolean lock variable would make the re-entrant
call revert). So from the detector's point of view, "there exists a path with a
state write after a call" is `True` regardless of the guard. This is documented
directly in the test and commit message as a **known limitation** of the
detector — a useful thing to know if you're using Mythril's output to decide
whether a contract is actually safe: a flagged guard-protected contract is a
false positive you have to manually verify, not a reason to assume Mythril is
wrong.

The 25-second solver timeout on this test (vs. 5s elsewhere in the file) exists
because the guard contract's extra branch needs more solver time to explore; at
5s the solver was timing out and silently dropping the real finding.

---

## 5. The Hardhat Attack Demo (`hardhat_attack_demo/`)

This is a **separate, runnable Hardhat project** (not part of Mythril's test
suite) that proves the vulnerability is real by actually executing a
reentrancy exploit against a local blockchain, and shows how each fix defeats
it.

### 5.1 Contracts (`hardhat_attack_demo/contracts/`)

- **`VulnerableBank.sol`** — the originally-vulnerable variant: external call
  happens before the balance is zeroed.
- **`GuardBank.sol`** — uses OpenZeppelin's `ReentrancyGuard` / `nonReentrant`
  modifier.
- **`LogicalBank.sol`** — fixed via checks-effects-interactions (balance
  zeroed before the external send).
- **`EtherBank_vulnerable.sol`** — a second vulnerable bank (copy of
  `solidity_examples/hardhat_reference/EtherBank_vulnerable.sol`): sends ETH
  with `sendValue` before zeroing the balance.
- **`SecureContracts.sol`** — the combined fix (copy of
  `solidity_examples/SecureContracts.sol`): an `EtherBank` protected by both
  `nonReentrant` and checks-effects-interactions, plus `SecureCaller`, a fixed
  version of `calls.sol` (checked call results, owner-only targets, allowlist).
- **`Attacker.sol`** — the exploit contract. It deposits ETH into the target
  bank, calls `withdraw()`, and its `receive()` hook **re-enters** `withdraw()`
  again as long as the bank still has a balance, draining it in a loop. Once
  drained, it forwards all stolen ETH to its owner (the attacker's EOA).

### 5.2 Attack scripts (`hardhat_attack_demo/scripts/`)

Each script deploys a bank variant plus the `Attacker` contract, has a
legitimate depositor fund the bank, then has the attacker deposit a smaller
amount and trigger the exploit — printing balances before/after and the
attacker's net profit:

| Script | Target | Expected outcome |
|---|---|---|
| `attack_vulnerable_detailed.js` | `VulnerableBank` | Attack **succeeds** — attacker drains more than they put in |
| `attack_guard_detailed.js` | `GuardBank` | Attack **reverts** — `nonReentrant` blocks the re-entrant call |
| `attack_logical_detailed.js` | `LogicalBank` | Attack **reverts** — balance is already zero on re-entry, so `require()` fails |
| `attack_etherbank_vulnerable.js` | `EtherBank_vulnerable` | Attack **succeeds** — 20 ETH drained in four 5 ETH withdrawals |
| `attack_secure_detailed.js` | `SecureContracts` `EtherBank` | Attack **reverts**; afterwards the honest depositor still withdraws their 15 ETH |
| `attack.js` | earlier/simpler variant | Same idea, less detailed output |

Note: the "Stolen profit" line printed by `attack_vulnerable_detailed.js`
reads 10 ETH because it subtracts the attacker's 5 ETH deposit twice; the
"Net wallet change" line (about 15 ETH) is the correct figure.

### 5.2.1 Mythril misses reentrancy when `console.log` is present

Mythril reports **no issues** for `VulnerableBank.sol` and
`EtherBank_vulnerable.sol`, even though the attack drains both. Removing the
`console.log` lines (and the `hardhat/console.sol` import) makes Mythril flag
"State access after external call" on the `balances[msg.sender] = 0` line;
raising `--execution-timeout` to 900 s does not, so it is not a timeout.
Strip debug logging before analyzing a contract with Mythril.

### 5.3 How to run the demo

```bash
cd hardhat_attack_demo
npm install
npx hardhat compile
npx hardhat run scripts/attack_vulnerable_detailed.js
npx hardhat run scripts/attack_guard_detailed.js
npx hardhat run scripts/attack_logical_detailed.js
npx hardhat run scripts/attack_etherbank_vulnerable.js
npx hardhat run scripts/attack_secure_detailed.js
```

To analyze the demo contracts with Mythril, run from `hardhat_attack_demo`
so the OpenZeppelin v4 remappings in `solc-settings.json` apply:

```bash
myth analyze contracts/SecureContracts.sol --solv 0.8.20 --solc-json solc-settings.json --execution-timeout 120
```

`solidity_examples/solc_remap.json` does the same for
`solidity_examples/SecureContracts.sol` when run from `solidity_examples/`.

Each run spins up Hardhat's built-in local chain, deploys fresh contracts, and
prints a before/after/net-result report to the console so you can see the
exploit (or its failure) directly.

### 5.4 Root-level `package.json`

The `package.json` / `package-lock.json` at the repo root install `hardhat` and
`@openzeppelin/contracts` (v5) into the root `node_modules/`. They are kept
because analyzing the `solidity_examples/hardhat_reference/` files with Mythril
uses that `node_modules/` through `--solc-json` remappings. The demo project
has its own `package.json` (OpenZeppelin v4, which `GuardBank.sol` needs for
`security/ReentrancyGuard.sol`).

---

## 6. How to Run Mythril's Own Test Suite

From the repository root:

```bash
pip install -e .
pytest tests/cmd_line_test.py
pytest tests/integration_tests/analysis_tests.py -k reentrancy
```

The reentrancy-specific tests (`test_state_change_after_external_call`) will
analyze all three fixtures from §4.1 and confirm the detector's behavior,
including the documented guard-contract limitation.

---

## 7. Directory Map (relevant parts only)

```
mythril/
  plugin/discovery.py                  # entry_points() fix (§3.1)
  mythril/mythril_disassembler.py      # Windows path parsing fix (§3.2)
tests/
  cmd_line_test.py                     # Windows-compatible CLI tests (§3.3)
  integration_tests/
    utils.py                           # output_of() with cwd support (§3.3)
    analysis_tests.py                  # reentrancy regression test (§4.3)
  testdata/input_contracts/
    reentrancy_vulnerable.sol          # fixture: vulnerable (§4.1)
    reentrancy_fixed_cei.sol           # fixture: CEI fix (§4.1)
    reentrancy_fixed_guard.sol         # fixture: guard fix (§4.1)
solidity_examples/
  etherbank_vulnerable.sol             # vulnerable fixture, example form (§4.1)
  SecureContracts.sol                  # combined fix for the bank and calls.sol (§5.1)
  solc_remap.json                      # OpenZeppelin v4 remapping for SecureContracts.sol
  hardhat_reference/                   # original Hardhat/OZ-flavored sources (§4.2)
    EtherBank_vulnerable.sol
    Attacker.sol
hardhat_attack_demo/                   # standalone live-exploit demo (§5)
  contracts/
    VulnerableBank.sol
    GuardBank.sol
    LogicalBank.sol
    EtherBank_vulnerable.sol
    SecureContracts.sol
    Attacker.sol
  scripts/
    attack_vulnerable_detailed.js
    attack_guard_detailed.js
    attack_logical_detailed.js
    attack_etherbank_vulnerable.js
    attack_secure_detailed.js
    attack.js
  hardhat.config.js
  package.json
```

---

## 8. Key Takeaways

1. **Mythril's core bugs fixed:** plugin discovery on modern Python, and a
   Windows-specific path-parsing bug that made the `file:contract` syntax
   unusable on Windows.
2. **New regression coverage:** the reentrancy detector (`StateChangeAfterCall`,
   SWC-107) now has an automated test across three representative contracts.
3. **A documented detector limitation:** Mythril correctly flags *reachability*
   of a state write after a call, but can't reason about whether a lock
   variable actually makes that path unreachable at runtime — so a
   `ReentrancyGuard`-protected contract is still (correctly, by the detector's
   own logic) reported as a finding. Treat such findings as "needs manual
   review," not "definitely exploitable."
4. **Independent proof-of-concept:** the Hardhat demo (`hardhat_attack_demo/`)
   actually executes the exploit end-to-end against a local chain, confirming
   that what Mythril flags statically corresponds to a real, working attack —
   and that both the CEI fix and the reentrancy-guard fix genuinely stop it at
   runtime, even though only one of them satisfies Mythril's static check.
