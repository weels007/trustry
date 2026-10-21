"""Look at the state the new contract is holding on the studio network."""

import json
from pathlib import Path

from eth_account import Account
from genlayer_py import create_client, studionet

WALLET_DIR = Path(r"D:\Genlayer-project\weels\wallet")
CONTRACT = "0xf322db27dceD1AF28Db33756dff7f4D99205dA98"

data = json.loads((WALLET_DIR / "tester1-keystore.json").read_text(encoding="utf-8"))
password = (WALLET_DIR / "tester1.password").read_text(encoding="utf-8").strip()
account = Account.from_key(Account.decrypt(data, password))

client = create_client(studionet, account=account)

ids = client.read_contract(CONTRACT, "get_all_record_ids")
print("records:")
for event_id in ids:
    status = client.read_contract(CONTRACT, "get_escrow_status", [event_id])
    print(f"  {event_id}: verified={status['verified']} escrow={status['escrow_wei']} status={status['escrow_status']}")

print("\ntotal escrow held :", client.read_contract(CONTRACT, "get_total_escrow_held"))
print("contract balance  :", client.read_contract(CONTRACT, "get_contract_balance"))
print("depositor escrow  :", client.read_contract(CONTRACT, "get_escrow_pool", [account.address]))
print("contract balance  :", client.get_balance(CONTRACT))
