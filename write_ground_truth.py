"""Ground truth for the consensus transaction the wallet has to sign."""

import json

import eth_utils
from eth_abi import encode as abi_encode
from genlayer_py import studionet
from genlayer_py.abi import calldata
from genlayer_py.abi.transactions import serialize
from genlayer_py.contracts.utils import make_calldata_object
from genlayer_py.types import CalldataAddress

SENDER = "0xE8b3e800d08727D25156a44cD1609F793bd0Af5a"
RECIPIENT = "0xd71227403E81BcDC4f0Fa657661687D2773333B0"
CONTRACT = "0xb7278A61aa25c888815aFC32Ad3cC52fF24fE575"

CASES = [
    ("open_case", ["evt_1", "desc", "https://docs.genlayer.com/", "GenLayer"]),
    ("fund_escrow", ["evt_1"]),
    ("notarize", ["evt_1"]),
    ("release_escrow", ["evt_1", CalldataAddress(RECIPIENT)]),
    ("refund_escrow", ["evt_1"]),
]

out = {}
for method, args in CASES:
    inner = serialize(
        [calldata.encode(make_calldata_object(method=method, args=args)), False]
    )
    abi = studionet.consensus_main_contract["abi"]
    fn = next(e for e in abi if e.get("name") == "addTransaction")
    types = [i["type"] for i in fn["inputs"]]
    params = abi_encode(
        types,
        [
            SENDER,
            RECIPIENT,
            studionet.default_number_of_initial_validators,
            studionet.default_consensus_max_rotations,
            eth_utils.to_bytes(hexstr=inner),
            0,
        ],
    )
    signature = f"{fn['name']}({','.join(types)})"
    selector = eth_utils.keccak(text=signature)[:4].hex()
    out[method] = {
        "inner_data": inner,
        "transaction_data": "0x" + selector + params.hex(),
    }
    print(method)
    print("  inner :", inner)
    print("  tx    :", out[method]["transaction_data"][:90], "...")

with open("write_ground_truth.json", "w", encoding="utf-8") as handle:
    json.dump(out, handle, indent=2)
print("\nwritten write_ground_truth.json")
