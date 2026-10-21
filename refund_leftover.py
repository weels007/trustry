"""Return the escrow that was left behind when a run was cut short.

The deposit belongs to the depositor, so it goes back to them.
"""

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

for event_id in client.read_contract(CONTRACT, "get_all_record_ids"):
    try:
        status = client.read_contract(CONTRACT, "get_escrow_status", [event_id])
    except Exception as error:
        print(f"{event_id}: could not be read ({str(error)[:60]})")
        continue
    if status["escrow_status"] != "held" or status["escrow_wei"] == 0:
        continue

    print(f"{event_id}: verified={status['verified']} escrow={status['escrow_wei']} -> refunding")
    tx = client.write_contract(CONTRACT, "refund_escrow", account=account, args=[event_id])
    receipt = client.wait_for_transaction_receipt(tx, retries=120, interval=3000)
    print("  status:", receipt.get("status_name"))

    after = client.read_contract(CONTRACT, "get_escrow_status", [event_id])
    print("  now   :", after)

print("\ntotal escrow held :", client.read_contract(CONTRACT, "get_total_escrow_held"))
print("contract balance  :", client.read_contract(CONTRACT, "get_contract_balance"))
