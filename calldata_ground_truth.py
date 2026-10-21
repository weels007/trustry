"""Capture ground truth bytes for the GenLayer calldata codec.

Run this to print the exact hex the Python SDK produces, so the TypeScript
port can be checked against it byte for byte.
"""

import json

from genlayer_py.abi import calldata
from genlayer_py.abi.transactions import serialize
from genlayer_py.contracts.utils import make_calldata_object
from genlayer_py.types import CalldataAddress

CASES = [
    ("get_all_record_ids", "get_all_record_ids", []),
    ("get_record", "get_record", ["evt_demo"]),
    ("get_frontend_details", "get_frontend_details", ["evt_demo"]),
    ("is_trusted_domain", "is_trusted_domain", ["https://docs.genlayer.com/"]),
    ("get_escrow_status", "get_escrow_status", ["evt_demo"]),
    ("open_case", "open_case", ["evt_1", "desc", "https://docs.genlayer.com/", "GenLayer"]),
    ("fund_escrow", "fund_escrow", ["evt_1"]),
    ("notarize", "notarize", ["evt_1"]),
    ("release_escrow_string", "release_escrow", ["evt_1", "0xE8b3e800d08727D25156a44cD1609F793bd0Af5a"]),
    ("release_escrow_address", "release_escrow", ["evt_1", CalldataAddress("0xE8b3e800d08727D25156a44cD1609F793bd0Af5a")]),
    ("refund_escrow", "refund_escrow", ["evt_1"]),
    ("get_escrow_pool", "get_escrow_pool", [CalldataAddress("0xE8b3e800d08727D25156a44cD1609F793bd0Af5a")]),
]

out = {}
for key, method, args in CASES:
    encoded = calldata.encode(make_calldata_object(method=method, args=args))
    read_data = serialize([encoded, b"\x00"])
    write_data = serialize([encoded, False])
    out[key] = {
        "method": method,
        "args": [
            {"__addr": a.as_hex} if isinstance(a, CalldataAddress) else a for a in args
        ],
        "calldata_hex": "0x" + encoded.hex(),
        "read_data_hex": read_data,
        "write_data_hex": write_data,
    }
    print(f"{key}")
    print(f"  calldata : 0x{encoded.hex()}")
    print(f"  read     : {read_data}")
    print(f"  write    : {write_data}")

with open("calldata_ground_truth.json", "w", encoding="utf-8") as handle:
    json.dump(out, handle, indent=2)
print("\nwritten calldata_ground_truth.json")
