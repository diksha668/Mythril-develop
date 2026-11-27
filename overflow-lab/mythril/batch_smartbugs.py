#!/usr/bin/env python3
"""
Run Mythril on every contract in dataset/arithmetic (SmartBugs Curated) and
compare the SWC-101 findings with the dataset's ground-truth labels
(@vulnerable_at_lines in each file header).

Usage (from the project root):
    python3 mythril/batch_smartbugs.py            # uses Docker image mythril/myth
    python3 mythril/batch_smartbugs.py --local    # uses a locally installed `myth`

Output: mythril/results/smartbugs_arithmetic.csv and .md (table for your slides)
"""
import csv, json, os, re, subprocess, sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATASET = ROOT / "dataset" / "arithmetic"
OUT = ROOT / "mythril" / "results"
SOLC = "0.4.25"          # satisfies every ^0.4.x pragma in this folder
TIMEOUT = "300"          # seconds of symbolic execution per contract
LOCAL = "--local" in sys.argv
IMAGE = os.environ.get("MYTH_IMAGE", "mythril/myth")   # e.g. mythril/myth:develop


def labelled_lines(path):
    m = re.search(r"@vulnerable_at_lines:\s*([\d,\s]+)", path.read_text())
    return sorted({int(x) for x in m.group(1).replace(" ", "").split(",") if x}) if m else []


def run_mythril(sol):
    if LOCAL:
        cmd = ["myth", "analyze", str(sol)]
    else:
        cmd = ["docker", "run", "--rm", "-v", f"{ROOT}:/project", IMAGE,
               "analyze", f"/project/{sol.relative_to(ROOT).as_posix()}"]
    cmd += ["--solv", SOLC, "-t", "2", "--execution-timeout", TIMEOUT, "-o", "json"]
    start = time.time()
    p = subprocess.run(cmd, capture_output=True, text=True)
    secs = round(time.time() - start, 1)
    try:
        data = json.loads(p.stdout)
    except json.JSONDecodeError:
        return None, secs, (p.stderr or p.stdout)[-300:]
    return data, secs, data.get("error")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    rows = []
    for sol in sorted(DATASET.glob("*.sol")):
        truth = labelled_lines(sol)
        print(f"[*] {sol.name:52s} labelled lines {truth} ...", flush=True)
        data, secs, err = run_mythril(sol)
        if data is None:
            rows.append(dict(contract=sol.name, labelled=truth, mythril_swc101=[], other_swc="",
                             matched="", result="ERROR", seconds=secs, note=err))
            print(f"    ERROR: {err}")
            continue
        issues = data.get("issues", [])
        swc101 = sorted({i.get("lineno") for i in issues if str(i.get("swc-id")) == "101" and i.get("lineno")})
        other = sorted({f"SWC-{i.get('swc-id')}" for i in issues if str(i.get("swc-id")) != "101"})
        matched = sorted(set(swc101) & set(truth))
        if matched and set(matched) == set(truth):
            result = "TP (all lines)"
        elif matched:
            result = "TP (partial)"
        elif swc101:
            result = "flagged, wrong line"
        else:
            result = "FN (missed)"
        rows.append(dict(contract=sol.name, labelled=truth, mythril_swc101=swc101,
                         other_swc=" ".join(other), matched=matched, result=result,
                         seconds=secs, note=err or ""))
        print(f"    SWC-101 at {swc101} -> {result}  ({secs}s)")

    keys = ["contract", "labelled", "mythril_swc101", "matched", "result", "other_swc", "seconds", "note"]
    with open(OUT / "smartbugs_arithmetic.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=keys)
        w.writeheader()
        w.writerows(rows)

    detected = sum(r["result"].startswith("TP") for r in rows)
    with open(OUT / "smartbugs_arithmetic.md", "w") as f:
        f.write("| Contract | Labelled lines | Mythril SWC-101 lines | Result | Time (s) |\n|---|---|---|---|---|\n")
        for r in rows:
            f.write(f"| {r['contract']} | {r['labelled']} | {r['mythril_swc101']} | {r['result']} | {r['seconds']} |\n")
        f.write(f"\n**Detected {detected} / {len(rows)} labelled contracts.**\n")
    print(f"\nDetected {detected}/{len(rows)}. Results in {OUT}")


if __name__ == "__main__":
    main()
