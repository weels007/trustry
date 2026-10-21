"""Deploy the Trustry contract to the local GenLayer node.

The details are written to localnet-deployment.json, where the integration
test picks them up. Nothing here touches the studio network.
"""

import json
from pathlib import Path

from eth_account import Account
from genlayer_py import create_client, localnet

ROOT = Path(__file__).resolve().parent
WALLET_DIR = Path(r"D:\Genlayer-project\weels\wallet")
CONTRACT = ROOT / "contracts" / "trustry.py"
OUTPUT = ROOT / "localnet-deployment.json"

data = json.loads((WALLET_DIR / "tester1-keystore.json").read_text(encoding="utf-8"))
password = (WALLET_DIR / "tester1.password").read_text(encoding="utf-8").strip()
account = Account.from_key(Account.decrypt(data, password))

client = create_client(localnet, account=account)
print("account :", account.address)
print("balance :", client.get_balance(account.address))

code = CONTRACT.read_text(encoding="utf-8")
tx = client.deploy_contract(code=code, account=account)
print("tx      :", tx)

receipt = client.wait_for_transaction_receipt(tx, retries=120, interval=2000)
print("status  :", receipt.get("status_name"))

leader = (receipt.get("consensus_data") or {}).get("leader_receipt") or [{}]
execution = leader[0].get("execution_result")
payload = leader[0].get("result")
print("execution:", execution)
if execution != "SUCCESS":
    print("result  :", json.dumps(payload)[:500])
    raise SystemExit("the contract did not deploy on the local node")

# The contract address is where the deploy transaction landed.
address = receipt.get("to_address")
if not address or address == "0x0000000000000000000000000000000000000000":
    raise SystemExit(f"no contract address in the receipt: {address}")

OUTPUT.write_text(
    json.dumps(
        {
            "contract": address,
            "account": account.address,
            "privateKey": "0x" + account.key.hex().removeprefix("0x"),
            "tx": tx,
        },
        indent=2,
    ),
    encoding="utf-8",
)
print("address :", address)
print("written :", OUTPUT)
