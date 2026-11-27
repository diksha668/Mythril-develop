#!/usr/bin/env bash
# Runs Mythril (Docker image mythril/myth) on the 3 case-study contracts,
# vulnerable vs fixed. Run from the project root:  bash mythril/run_case_studies.sh
set -u
mkdir -p mythril/results
MYTH_IMAGE="${MYTH_IMAGE:-mythril/myth}"   # e.g. MYTH_IMAGE=mythril/myth:develop
MYTH="docker run --rm -v $PWD:/project $MYTH_IMAGE"

scan () {   # $1 = file:Contract   $2 = solc version   $3 = output name
  echo "=================== $1 (solc $2)"
  $MYTH analyze "/project/$1" --solv "$2" -t 2 --execution-timeout 300 \
    | tee "mythril/results/$3.txt"
}

# --- VULNERABLE (expect SWC-101 "Integer Arithmetic Bugs") ---
scan contracts/vulnerable/Token.sol:Token          0.4.25 Token_vulnerable
scan contracts/vulnerable/TimeLock.sol:TimeLock    0.4.25 TimeLock_vulnerable
scan contracts/vulnerable/BECToken.sol:BecToken    0.4.25 BecToken_vulnerable

# --- FIXED (expect NO SWC-101) ---
scan contracts/fixed/TokenFixed.sol:TokenFixed                 0.8.20 Token_fixed
scan contracts/fixed/TimeLockFixed.sol:TimeLockFixed           0.8.20 TimeLock_fixed
scan contracts/fixed/BecTokenSafeMath.sol:BecTokenSafeMath     0.4.25 BecToken_safemath_fixed
scan contracts/fixed/BecTokenFixed.sol:BecTokenFixed           0.8.20 BecToken_08_fixed

echo; echo "SWC-101 hits per report:"
for f in mythril/results/*.txt; do
  printf "  %-34s %s\n" "$(basename "$f")" "$(grep -c 'SWC ID: 101' "$f")"
done
