import json
import os
import sys

import pytest
from utils import output_of

from tests import PROJECT_DIR, TESTDATA

MYTH = str(PROJECT_DIR / "myth")
test_data = (
    (
        "flag_array.sol.o",
        {
            "TX_COUNT": 1,
            "TX_OUTPUT": 1,
            "MODULE": "EtherThief",
            "ISSUE_COUNT": 1,
            "ISSUE_NUMBER": 0,
        },
        "0xab12585800000000000000000000000000000000000000000000000000000000000004d2",
    ),
    (
        "exceptions_0.8.0.sol.o",
        {
            "TX_COUNT": 1,
            "TX_OUTPUT": 1,
            "MODULE": "Exceptions",
            "ISSUE_COUNT": 2,
            "ISSUE_NUMBER": 0,
        },
        None,
    ),
    (
        "symbolic_exec_bytecode.sol.o",
        {
            "TX_COUNT": 1,
            "TX_OUTPUT": 0,
            "MODULE": "AccidentallyKillable",
            "ISSUE_COUNT": 1,
            "ISSUE_NUMBER": 0,
        },
        None,
    ),
    (
        "extcall.sol.o",
        {
            "TX_COUNT": 1,
            "TX_OUTPUT": 0,
            "MODULE": "Exceptions",
            "ISSUE_COUNT": 1,
            "ISSUE_NUMBER": 0,
        },
        None,
    ),
)


@pytest.mark.parametrize("file_name, tx_data, calldata", test_data)
def test_analysis(file_name, tx_data, calldata):
    bytecode_file = str(TESTDATA / "inputs" / file_name)
    command = f"""python3 {MYTH} analyze -f {bytecode_file} -t {tx_data["TX_COUNT"]} -o jsonv2 -m {tx_data["MODULE"]} --solver-timeout 60000  --no-onchain-data"""
    output = json.loads(output_of(command))

    assert len(output[0]["issues"]) == tx_data["ISSUE_COUNT"]
    if calldata:
        test_case = output[0]["issues"][tx_data["ISSUE_NUMBER"]]["extra"]["testCases"][
            0
        ]
        assert test_case["steps"][tx_data["TX_OUTPUT"]]["input"] == calldata


@pytest.mark.parametrize("file_name, tx_data, calldata", test_data)
def test_analysis_pending(file_name, tx_data, calldata):
    bytecode_file = str(TESTDATA / "inputs" / file_name)
    command = f"""python3 {MYTH} analyze -f {bytecode_file} -t {tx_data["TX_COUNT"]} -o jsonv2 -m {tx_data["MODULE"]} --solver-timeout 60000 --strategy pending --no-onchain-data"""
    output = json.loads(output_of(command))

    assert len(output[0]["issues"]) == tx_data["ISSUE_COUNT"]
    if calldata:
        test_case = output[0]["issues"][tx_data["ISSUE_NUMBER"]]["extra"]["testCases"][
            0
        ]
        assert test_case["steps"][tx_data["TX_OUTPUT"]]["input"] == calldata


test_data_code = [
    ("114", f"{TESTDATA}/input_contracts/tx.sol", True),
    ("123", f"{TESTDATA}/input_contracts/requirements_violation_pos.sol", True),
    ("123", f"{TESTDATA}/input_contracts/requirements_violation_neg.sol", False),
    ("132", f"{TESTDATA}/input_contracts/unexpected_ether_pos.sol", True),
    ("132", f"{TESTDATA}/input_contracts/unexpected_ether_neg.sol", False),
]


@pytest.mark.parametrize("swc, file_path, exists", test_data_code)
def test_analysis_code(swc, file_path, exists):
    assert (
        "SWC ID: {}".format(swc)
        in output_of(f"python3 {MYTH} a {file_path} --solver-timeout 5000")
    ) == exists


# SWC-107: state access after external call (StateChangeAfterCall module).
# "reentrancy_fixed_guard.sol" is expected to still be flagged even though a
# `nonReentrant`-style lock makes it safe at runtime: the module only checks
# whether a state write is reachable after a CALL along the execution path,
# it does not model that the lock variable blocks a re-entrant call.
test_data_reentrancy = [
    ("reentrancy_vulnerable.sol", True),
    ("reentrancy_fixed_cei.sol", False),
    ("reentrancy_fixed_guard.sol", True),
]


@pytest.mark.parametrize("file_name, exists", test_data_reentrancy)
def test_state_change_after_external_call(file_name, exists):
    file_path = TESTDATA / "input_contracts" / file_name
    # Relative path: mythril's own file:contract_name parsing splits on ":",
    # which mistakes a Windows absolute path's drive letter (e.g. "E:\...")
    # for that separator, so an absolute path breaks on Windows.
    relative_file_path = os.path.relpath(file_path, PROJECT_DIR)
    # 25s timeout: reentrancy_fixed_guard.sol's extra lock branch needs more
    # solver time than the 5s used elsewhere in this file, otherwise the
    # solver just times out and the (real) finding is silently dropped.
    # sys.executable (not a hardcoded "python3") so this also runs on
    # Windows, where only "python" is on PATH.
    assert (
        "State access after external call"
        in output_of(
            f'"{sys.executable}" "{MYTH}" a "{relative_file_path}" --solver-timeout 25000',
            cwd=PROJECT_DIR,
        )
    ) == exists
