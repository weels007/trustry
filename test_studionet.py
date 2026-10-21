"""Test every Trustry method on the real studionet network.

The contract separates the risky step from the funding step:
    open_case -> fund_escrow (payable) -> notarize -> release_escrow / refund_escrow
"""

import json
import sys
import time
from pathlib import Path

from eth_account import Account
from genlayer_py import create_client, studionet
from genlayer_py.types import CalldataAddress as Address, TransactionStatus

WALLET_DIR = Path(r"D:\Genlayer-project\weels\wallet")
CONTRACT = "0xf322db27dceD1AF28Db33756dff7f4D99205dA98"
ESCROW_WEI = 10 ** 16  # 0.01 GEN

CANDIDATES = [
    ("https://docs.genlayer.com/", "GenLayer",
     "The GenLayer homepage, introducing the GenLayer project and its documentation"),
    ("https://blog.ethereum.org/", "Ethereum",
     "The Ethereum blog, publishing an update about Ethereum"),
    ("https://www.cointelegraph.com/", "Bitcoin",
     "Cointelegraph news coverage about Bitcoin"),
    ("https://docs.genlayer.com/developers", "GenLayer",
     "The GenLayer developers page about building on GenLayer"),
    ("https://docs.genlayer.com/understand-genlayer-protocol", "GenLayer",
     "The GenLayer page that explains the GenLayer protocol"),
    ("https://docs.genlayer.com/developers/intelligent-contracts/introduction", "GenLayer",
     "The GenLayer introduction to intelligent contracts"),
]

PASS, FAIL = [], []


def check(name: str, condition: bool, detail: str = "") -> None:
    if condition:
        PASS.append(name)
        print(f"  PASS  {name}")
    else:
        FAIL.append(name)
        print(f"  FAIL  {name}  {detail}")


def load_account(name: str) -> Account:
    data = json.loads((WALLET_DIR / f"{name}-keystore.json").read_text(encoding="utf-8"))
    password = (WALLET_DIR / f"{name}.password").read_text(encoding="utf-8").strip()
    return Account.from_key(Account.decrypt(data, password))


def plain(obj):
    if isinstance(obj, bytes):
        return obj.decode("utf-8", errors="ignore")
    if isinstance(obj, dict):
        return {k: plain(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [plain(v) for v in obj]
    return obj


def leader_payload(receipt: dict) -> str:
    for entry in (receipt.get("consensus_data") or {}).get("leader_receipt") or []:
        if entry.get("mode") == "leader":
            result = entry.get("result")
            if isinstance(result, dict):
                return str(result.get("payload", ""))
    return ""


def execution_result(receipt: dict) -> str:
    for entry in (receipt.get("consensus_data") or {}).get("leader_receipt") or []:
        if entry.get("mode") == "leader":
            return str(entry.get("execution_result", ""))
    return ""


def main() -> int:
    account = load_account("tester1")
    client = create_client(studionet, account=account)
    account_addr = Address(account.address)
    print(f"wallet  : {account.address}")
    print(f"network : {studionet.name} (chain {studionet.id})")
    print(f"contract: {CONTRACT}\n")

    def read(fn, args=None):
        last_error = None
        for _ in range(20):
            try:
                return client.read_contract(CONTRACT, fn, args=args)
            except Exception as error:
                last_error = error
                message = str(error)
                if "502" in message or "Bad gateway" in message or "invalid JSON" in message:
                    time.sleep(4)
                    continue
                raise
        raise RuntimeError(f"read {fn} failed: {last_error}")

    def wait_final(tx_hash) -> dict:
        last_error = None
        for _ in range(40):
            try:
                return plain(
                    client.wait_for_transaction_receipt(
                        tx_hash, status=TransactionStatus.FINALIZED, retries=20, interval=3000
                    )
                )
            except Exception as error:
                last_error = error
                message = str(error)
                if "502" in message or "Bad gateway" in message or "invalid JSON" in message:
                    time.sleep(5)
                    continue
                time.sleep(3)
                continue
        raise RuntimeError(f"receipt never arrived: {last_error}")

    def write(fn, args, value=0):
        tx = client.write_contract(CONTRACT, fn, account=account, value=value, args=args)
        return wait_final(tx)

    def open_case_fresh(event_id, description=None, phrase=None):
        for url, candidate_phrase, candidate_description in CANDIDATES:
            receipt = write("open_case", [
                event_id,
                description if description else candidate_description,
                url,
                phrase if phrase else candidate_phrase,
            ])
            payload = leader_payload(receipt)
            if execution_result(receipt) == "SUCCESS":
                return receipt, url
            if "already notarized" not in payload:
                break
        return receipt, ""

    # ---------------- READ: is_trusted_domain ----------------
    print("READ  is_trusted_domain")
    check("is_trusted_domain -> true for docs.genlayer.com",
          read("is_trusted_domain", ["https://docs.genlayer.com/"]) is True)
    check("is_trusted_domain -> false for evil.example.com",
          read("is_trusted_domain", ["https://evil.example.com/x"]) is False)

    # ---------------- READ: get_all_record_ids ----------------
    print("\nREAD  get_all_record_ids")
    ids_before = read("get_all_record_ids")
    print(f"  ids: {ids_before}")
    check("get_all_record_ids returns list", isinstance(ids_before, list), f"got {type(ids_before)}")

    # ---------------- READ: get_escrow_pool / get_event_count ----------------
    print("\nREAD  get_escrow_pool / get_event_count / get_total_escrow_held")
    check("get_escrow_pool returns a number", isinstance(read("get_escrow_pool", [account_addr]), int))
    check("get_event_count returns a number", isinstance(read("get_event_count", [account_addr]), int))
    check("get_total_escrow_held returns a number", isinstance(read("get_total_escrow_held"), int))
    check("get_contract_balance returns a number", isinstance(read("get_contract_balance"), int))

    # ---------------- WRITE: open_case with an untrusted domain ----------------
    print("\nWRITE open_case (untrusted domain -> must fail)")
    receipt = write("open_case", [f"evt_bad_{int(time.time())}", "Bad", "https://evil.example.com/x", "Title"])
    payload = leader_payload(receipt)
    print(f"  execution: {execution_result(receipt)}  payload: {payload[:120]}")
    check("open_case rejects untrusted domain", execution_result(receipt) == "ERROR", execution_result(receipt))
    check("open_case error says Untrusted", "Untrusted" in payload, payload[:120])

    # ---------------- WRITE: open_case + fund + notarize ----------------
    print("\nWRITE open_case -> fund_escrow -> notarize")
    event_id = f"evt_live_{int(time.time())}"
    receipt, used_url = open_case_fresh(event_id)
    print(f"  evidence: {used_url}")
    check("open_case succeeded", execution_result(receipt) == "SUCCESS",
          f"{execution_result(receipt)} {leader_payload(receipt)[:120]}")

    receipt = write("fund_escrow", [event_id], value=ESCROW_WEI)
    check("fund_escrow succeeded", execution_result(receipt) == "SUCCESS",
          f"{execution_result(receipt)} {leader_payload(receipt)[:120]}")

    receipt = write("notarize", [event_id])
    payload = leader_payload(receipt)
    print(f"  notarize: {execution_result(receipt)}  payload: {payload[:180]}")
    check("notarize reached consensus", receipt.get("status_name") == "FINALIZED", str(receipt.get("status_name")))
    check("notarize execution succeeded", execution_result(receipt) == "SUCCESS",
          f"{execution_result(receipt)} {payload[:120]}")
    check("notarize consensus MAJORITY_AGREE", receipt.get("result_name") == "MAJORITY_AGREE",
          str(receipt.get("result_name")))

    # ---------------- READ: get_record ----------------
    print("\nREAD  get_record")
    record = read("get_record", [event_id])
    print(f"  record: {record}")
    check("get_record returns event", bool(record), "empty record")
    check("get_record has verified", "verified" in record, str(record.keys()))
    check("get_record verified is bool", isinstance(record.get("verified"), bool), str(type(record.get("verified"))))
    check("get_record has state", record.get("state") in ("verified", "rejected"), str(record.get("state")))
    check("get_record source_domain is set", bool(record.get("source_domain")), str(record.get("source_domain")))

    # ---------------- READ: get_frontend_details ----------------
    print("\nREAD  get_frontend_details")
    details = read("get_frontend_details", [event_id])
    print(f"  details: {details}")
    check("get_frontend_details frontend_ready", details.get("frontend_ready") is True, str(details))
    check("get_frontend_details has consensus_status", "consensus_status" in details, str(details.keys()))
    check("get_frontend_details has display_message", bool(details.get("display_message")), str(details))
    check("get_frontend_details consensus matches verified",
          details.get("consensus_status") == ("accepted" if record.get("verified") else "rejected"),
          f"{details.get('consensus_status')} vs verified={record.get('verified')}")
    check("get_frontend_details exposes evidence_url", bool(details.get("evidence_url")), str(details))
    check("get_frontend_details exposes escrow status", "escrow_status" in details, str(details.keys()))

    # ---------------- READ: get_escrow_status ----------------
    print("\nREAD  get_escrow_status")
    escrow = read("get_escrow_status", [event_id])
    print(f"  escrow: {escrow}")
    check("get_escrow_status returns event", escrow.get("event_id") == event_id, str(escrow))
    check("get_escrow_status has escrow_wei", "escrow_wei" in escrow, str(escrow.keys()))
    check("get_escrow_status has escrow_status", escrow.get("escrow_status") == "held", str(escrow))

    # ---------------- READ: get_all_record_ids (after) ----------------
    print("\nREAD  get_all_record_ids (after write)")
    ids_after = read("get_all_record_ids")
    print(f"  ids: {ids_after}")
    check("get_all_record_ids contains new event", event_id in ids_after, str(ids_after))

    # ---------------- READ: get_record (missing) ----------------
    print("\nREAD  get_record (missing event -> must fail)")
    try:
        read("get_record", ["evt_does_not_exist"])
        check("get_record fails for missing event", False, "no error raised")
    except Exception:
        check("get_record fails for missing event", True)

    # ---------------- WRITE: release_escrow ----------------
    print("\nWRITE release_escrow")
    receipt = write("release_escrow", [event_id, account_addr])
    payload = leader_payload(receipt)
    print(f"  execution: {execution_result(receipt)}  payload: {payload[:120]}")
    check("release_escrow succeeded", execution_result(receipt) == "SUCCESS",
          f"{execution_result(receipt)} {payload[:120]}")

    # ---------------- WRITE: release_escrow (unknown event) ----------------
    print("\nWRITE release_escrow (unknown event -> must fail)")
    receipt = write("release_escrow", ["evt_does_not_exist", account_addr])
    payload = leader_payload(receipt)
    print(f"  execution: {execution_result(receipt)}  payload: {payload[:120]}")
    check("release_escrow unknown event -> error", execution_result(receipt) == "ERROR", execution_result(receipt))
    check("release_escrow unknown event -> EXPECTED prefix", "not found" in payload, payload[:120])

    # ---------------- WRITE: refund_escrow (unknown event) ----------------
    print("\nWRITE refund_escrow (unknown event -> must fail)")
    receipt = write("refund_escrow", ["evt_does_not_exist"])
    payload = leader_payload(receipt)
    print(f"  execution: {execution_result(receipt)}  payload: {payload[:120]}")
    check("refund_escrow unknown event -> error", execution_result(receipt) == "ERROR", execution_result(receipt))

    # ---------------- WRITE: appeal_notarization (unknown event) ----------------
    print("\nWRITE appeal_notarization (unknown event -> must fail)")
    receipt = write("appeal_notarization", ["evt_does_not_exist"])
    payload = leader_payload(receipt)
    print(f"  execution: {execution_result(receipt)}  payload: {payload[:120]}")
    check("appeal unknown event -> error", execution_result(receipt) == "ERROR", execution_result(receipt))

    # ---------------- WRITE: fund_escrow never fails ----------------
    print("\nWRITE fund_escrow (unknown case -> must still succeed)")
    unknown_id = f"evt_fund_{int(time.time())}"
    receipt = write("fund_escrow", [unknown_id], value=ESCROW_WEI)
    payload = leader_payload(receipt)
    print(f"  execution: {execution_result(receipt)}  payload: {payload[:120]}")
    check("fund_escrow never rejects", execution_result(receipt) == "SUCCESS",
          f"{execution_result(receipt)} {payload[:120]}")
    escrow = read("get_escrow_status", [unknown_id])
    check("fund_escrow recorded the value", escrow.get("escrow_wei") == ESCROW_WEI, str(escrow))

    # ---------------- WRITE: refund_escrow (that case) ----------------
    print("\nWRITE refund_escrow (the funded case)")
    receipt = write("refund_escrow", [unknown_id])
    payload = leader_payload(receipt)
    print(f"  execution: {execution_result(receipt)}  payload: {payload[:120]}")
    check("refund_escrow succeeded", execution_result(receipt) == "SUCCESS",
          f"{execution_result(receipt)} {payload[:120]}")
    escrow = read("get_escrow_status", [unknown_id])
    check("refund marked the escrow refunded", escrow.get("escrow_status") == "refunded", str(escrow))

    # ---------------- summary ----------------
    print("\n" + "=" * 52)
    print(f"PASSED: {len(PASS)}   FAILED: {len(FAIL)}")
    for name in FAIL:
        print(f"  FAILED -> {name}")
    print("=" * 52)
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
