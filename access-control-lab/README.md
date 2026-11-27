# Access-Control Vulnerability Lab (Hardhat + Mythril)

A self-contained lab for the **access_control** contracts from the
[SmartBugs Curated](https://github.com/smartbugs/smartbugs-curated) dataset
(Apache-2.0). For each contract you:

1. **Detect** the flaw statically with **Mythril**.
2. **Exploit** it dynamically with a **Hardhat** test, to prove it is real.
3. **Fix** it (minimal change, same compiler).
4. **Verify** — Mythril comes back clean and the same exploit now reverts.

The original contracts are kept **verbatim** (with their `@source` headers) in
`contracts/vulnerable/`. Patched copies are in `contracts/fixed/`. They are
analysed and compiled **as Solidity 0.4.x** — do **not** port them to 0.8.x
before analysis, or the upgrade itself removes the bug (0.8 has no
named-function constructors).

## Layout

```
contracts/vulnerable/   dataset contracts, unmodified
contracts/fixed/        patched versions (minimal diff)
contracts/attack/       PoC helpers (tx.origin relay, delegatecall payload)
test/                   one exploit+fix test per contract
scripts/run_mythril.sh  runs Mythril over every contract
mythril/reports/        Mythril output lands here
```

## Setup

```bash
npm install                 # Hardhat + toolbox
pip install mythril         # for the static analysis step
```

> Package installs need network access. If your environment blocks them,
> run this project locally.

## Run

```bash
npm run build     # compile all contracts (0.4.25)
npm test          # run the exploit/fix tests
npm run mythril   # static analysis -> mythril/reports/
```

## Contracts covered

| Contract | SWC | Flaw | Fix | Mythril flags it? |
|---|---|---|---|---|
| SimpleSuicide | 106 | unprotected `selfdestruct` | owner + `onlyOwner` | Yes |
| Missing | 105 | constructor misnamed `IamMissing()` | `constructor` keyword | Yes (`-t 2+`) |
| Wallet03 | 105 | `initWallet()` public, not constructor | `constructor` keyword | Yes (`-t 2+`) |
| MultiOwnable | 105 | `newOwner()` missing modifier | add `onlyOwner` | Yes (`-t 2+`) |
| Phishable | 115 | `tx.origin` auth | `msg.sender` auth | Yes |
| MyContract | 115 | `tx.origin` auth (analysis-only; exploit = same as Phishable) | `msg.sender` auth | Yes |
| Proxy | 112 | `delegatecall` to arbitrary address | `onlyOwner` + allowlist | Yes |
| Unprotected | — | `changeOwner()` unprotected | add `onlyowner` | **Usually no** |

**Unprotected is the teaching case:** no Ether is at stake, so Mythril stays
quiet, yet the Hardhat test shows anyone can seize ownership. "Static analysis
missed it; the dynamic test caught it" is a result worth highlighting.

## Mapping to the results table

For each contract, record four cells — Mythril(vuln), Exploit(vuln),
Mythril(fixed), Exploit(fixed). The expected pattern is
**flag / succeeds / clean / reverts**, with Unprotected the deliberate
exception in the first column.

> The "Mythril flags it?" column is the *expected* detection based on
> Mythril's SWC modules, not output captured here. Run `npm run mythril`
> to fill in the real results.

## Attribution

Contracts: SmartBugs Curated (https://github.com/smartbugs/smartbugs-curated),
Apache-2.0. Original sources are credited in each file's `@source` header.
