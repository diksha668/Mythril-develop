# Integer Overflow / Underflow Lab (SWC-101): SmartBugs Curated + Hardhat + Mythril

This project uses the **`dataset/arithmetic`** folder of SmartBugs Curated (your zip) to
**identify** (Mythril), **exploit** (Hardhat tests) and **fix** (SafeMath / Solidity 0.8)
integer overflow and underflow bugs.

```
overflow-lab/
├── contracts/
│   ├── vulnerable/        # untouched SmartBugs files (Solidity 0.4.x)
│   │   ├── Token.sol      # underflow   (lines 20, 22)
│   │   ├── TimeLock.sol   # overflow    (line 22)
│   │   └── BECToken.sol   # batchOverflow, real 2018 attack (line 264)
│   └── fixed/
│       ├── TokenFixed.sol         # 0.8.20 checked arithmetic + correct require
│       ├── TimeLockFixed.sol      # 0.8.20 checked arithmetic
│       ├── BecTokenSafeMath.sol   # same 0.4 code, one-line fix: cnt.mul(_value)
│       └── BecTokenFixed.sol      # 0.8.20 rewrite of batchTransfer
├── test/                  # Hardhat tests: exploit on vulnerable, revert on fixed
├── mythril/
│   ├── run_case_studies.sh    # Mythril on the 3 contracts, before vs after the fix
│   └── batch_smartbugs.py     # Mythril on all 15 arithmetic contracts vs ground truth
└── dataset/arithmetic/    # all 15 SmartBugs arithmetic contracts + README + LICENSE
```

## 1. Hardhat: exploit and fix

Requirements: Node.js 18+ (Node 20/22 recommended).

```bash
npm install
npx hardhat compile     # downloads solc 0.4.25 and 0.8.20 automatically
npx hardhat test
```

You should get 7 passing tests:

| Test | Vulnerable contract | Fixed contract |
|---|---|---|
| Token | attacker with 0 tokens transfers 1 → balance = 2²⁵⁶−1 | reverts `insufficient balance` |
| TimeLock | `increaseLockTime(2²⁵⁶ − t)` wraps lockTime to 0 → withdraw at once | reverts with Panic `0x11` |
| BecToken | `batchTransfer([r1,r2], 2²⁵⁵)` → amount = 0, each receiver gets 2²⁵⁵ | SafeMath: reverts · 0.8: Panic `0x11` |

> Note: Hardhat fully supports Solidity 0.5.1 and newer. The 0.4.25 contracts still
> compile, deploy and run correctly. Only Hardhat's Solidity stack traces and `console.log`
> may not work for them, and these tests don't use either.

## 2. Mythril: identify and analyze

The easiest way to run Mythril is Docker (it avoids Python/solc version problems, especially on Windows):

```bash
docker pull mythril/myth
bash mythril/run_case_studies.sh          # 3 contracts, vulnerable vs fixed
python3 mythril/batch_smartbugs.py        # all 15 SmartBugs arithmetic contracts
```

To use the Mythril **develop** branch instead of the latest release, set `MYTH_IMAGE`
(Docker) or install develop with pip and use `--local`:

```bash
MYTH_IMAGE=mythril/myth:develop bash mythril/run_case_studies.sh
MYTH_IMAGE=mythril/myth:develop python3 mythril/batch_smartbugs.py
# or: pip install "git+https://github.com/Consensys/mythril.git@develop"
#     python3 mythril/batch_smartbugs.py --local
```

If you have `myth` installed locally (`pip install mythril`), use
`python3 mythril/batch_smartbugs.py --local`, or a single file:

```bash
myth analyze contracts/vulnerable/Token.sol:Token --solv 0.4.25 -t 2
```

Windows PowerShell: replace `$PWD` with `${PWD}` in the Docker command.

**What to look for in a report:**

```
==== Integer Arithmetic Bugs ====
SWC ID: 101
Severity: High
Contract: Token
Function name: transfer(address,uint256)
...
In file: .../Token.sol:22
```

- **SWC ID 101**: integer overflow/underflow.
- **Line number**: compare it with the `@vulnerable_at_lines` tag in the file header (the ground truth).
- **Transaction sequence**: the concrete inputs Mythril found that trigger the wrap.
- **After the fix**: re-run Mythril. SWC-101 should disappear. Other findings may remain:
  for example, TimeLock uses `block.timestamp` (SWC-116), which is a different issue.

`batch_smartbugs.py` writes `mythril/results/smartbugs_arithmetic.md`, a table of
labelled lines vs Mythril lines, TP/FN per contract and run time. You can paste it into a slide.

## 3. Why the bug exists and how the fixes work

- The EVM uses 256-bit unsigned words. Before **Solidity 0.8.0**, `+ - *` silently wrapped:
  `0 − 1 = 2²⁵⁶−1` and `2²⁵⁵ × 2 = 0`.
- **Token**: `require(balance - value >= 0)` is *always true* for `uint`, so it checks nothing.
  Fix: `require(balance >= value)`, plus checked arithmetic.
- **TimeLock**: adding a big number to `lockTime` wraps it to 0, so the time lock is bypassed.
- **BEC (BeautyChain), April 2018**: `amount = cnt * _value` overflowed to 0, the balance check
  passed, and two attacker addresses each received 2²⁵⁵ (≈5.8×10⁷⁶) tokens. Exchanges suspended BEC trading.
  The rest of the contract *did* use SafeMath; one unprotected `*` was enough.
- **Fix 1 (legacy 0.4–0.7)**: SafeMath (`a.mul(b)` reverts on overflow).
- **Fix 2 (modern)**: compile with Solidity ≥ 0.8, which reverts with `Panic(0x11)`.
  Be careful with `unchecked { }` blocks, which turn the old wrapping behaviour back on.

## Credits

Vulnerable contracts come from **SmartBugs Curated** (github.com/smartbugs/smartbugs-curated).
They keep their original licenses (see `dataset/arithmetic/SMARTBUGS_LICENSE`). Cite:
Durieux et al., *Empirical Review of Automated Analysis Tools on 47,587 Ethereum Smart Contracts*, ICSE 2020.
