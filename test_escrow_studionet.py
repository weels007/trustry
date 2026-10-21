"""Prove on studionet that the escrow can never trap funds, and that the GEN
really moves.

The contract separates the risky step from the funding step on purpose:
`open_case` and `notarize` carry no value, so their failures are harmless.
Only `fund_escrow` is payable, and it has no check that can reject, so the
value is always recorded and always refundable.
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

# Trusted pages that return 200, with a phrase that really is on them and a
# description that really describes them.
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
    depositor = load_account("tester1")
    recipient = load_account("tester2")
    client = create_client(studionet, account=depositor)
    depositor_addr = Address(depositor.address)
    recipient_addr = Address(recipient.address)

    print(f"depositor: {depositor.address}")
    print(f"recipient: {recipient.address}")
    print(f"contract : {CONTRACT}\n")

    def balance(addr) -> int:
        return int(client.get_balance(addr))

    def wait_balance(addr, predicate, tries: int = 30) -> int:
        value = balance(addr)
        for _ in range(tries):
            if predicate(value):
                return value
            time.sleep(2)
            value = balance(addr)
        return value

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

    def open_case(event_id, description, url, phrase):
        tx = client.write_contract(
            CONTRACT, "open_case", account=depositor,
            args=[event_id, description, url, phrase],
        )
        return wait_final(tx)

    def open_case_fresh(event_id, description=None, phrase=None):
        """Open the case with the first evidence page that is not used yet.

        Each candidate carries a phrase and a description that really match
        its page, so the notary can confirm the event.
        """
        last = None
        for url, candidate_phrase, candidate_description in CANDIDATES:
            receipt = open_case(
                event_id,
                description if description else candidate_description,
                url,
                phrase if phrase else candidate_phrase,
            )
            payload = leader_payload(receipt)
            if execution_result(receipt) == "SUCCESS":
                return receipt, url
            last = (receipt, payload)
            if "already notarized" not in payload:
                break
        return last if last else (None, "")

    def fund(event_id, value=ESCROW_WEI):
        tx = client.write_contract(CONTRACT, "fund_escrow", account=depositor, value=value, args=[event_id])
        return wait_final(tx)

    def notarize(event_id):
        tx = client.write_contract(CONTRACT, "notarize", account=depositor, args=[event_id])
        return wait_final(tx)

    # ---------- 1. fund and release on a verified event ----------
    print("\nSTEP 1  open_case -> fund_escrow -> notarize -> release_escrow")
    event_id = f"evt_esc_{int(time.time())}"
    receipt, used_url = open_case_fresh(event_id)
    print(f"  evidence: {used_url}")
    check("open_case succeeded", execution_result(receipt) == "SUCCESS",
          f"{execution_result(receipt)} {leader_payload(receipt)[:120]}")

    dep_before = balance(depositor.address)
    rec_before = balance(recipient.address)
    con_before = balance(CONTRACT)

    receipt = fund(event_id)
    check("fund_escrow succeeded", execution_result(receipt) == "SUCCESS",
          f"{execution_result(receipt)} {leader_payload(receipt)[:120]}")

    con_after_fund = wait_balance(CONTRACT, lambda v: v == con_before + ESCROW_WEI)
    dep_after_fund = balance(depositor.address)
    check("contract holds the escrow", con_after_fund - con_before == ESCROW_WEI,
          f"delta {con_after_fund - con_before}")
    check("depositor paid the escrow", dep_before - dep_after_fund >= ESCROW_WEI,
          f"delta {dep_before - dep_after_fund}")

    status = read("get_escrow_status", [event_id])
    check("escrow recorded as held", status.get("escrow_status") == "held", str(status))
    check("escrow amount recorded", status.get("escrow_wei") == ESCROW_WEI, str(status))
    held = int(read("get_total_escrow_held"))
    check("total escrow held matches the balance", held == con_after_fund, f"{held} vs {con_after_fund}")

    receipt = notarize(event_id)
    check("notarize succeeded", execution_result(receipt) == "SUCCESS",
          f"{execution_result(receipt)} {leader_payload(receipt)[:120]}")
    check("event verified", read("get_record", [event_id])["verified"] is True,
          str(read("get_record", [event_id])))

    tx = client.write_contract(CONTRACT, "release_escrow", account=depositor,
                               args=[event_id, recipient_addr])
    receipt = wait_final(tx)
    check("release_escrow succeeded", execution_result(receipt) == "SUCCESS",
          f"{execution_result(receipt)} {leader_payload(receipt)[:120]}")

    rec_after = wait_balance(recipient.address, lambda v: v == rec_before + ESCROW_WEI)
    con_after = wait_balance(CONTRACT, lambda v: v == con_before)
    check("RECIPIENT BALANCE INCREASED BY ESCROW", rec_after - rec_before == ESCROW_WEI,
          f"delta {rec_after - rec_before}")
    check("CONTRACT BALANCE DECREASED BY ESCROW", con_after_fund - con_after == ESCROW_WEI,
          f"delta {con_after_fund - con_after}")
    check("contract balance back to start", con_after == con_before, f"{con_after} vs {con_before}")

    status = read("get_escrow_status", [event_id])
    check("escrow now released", status.get("escrow_status") == "released", str(status))
    check("escrow amount now zero", status.get("escrow_wei") == 0, str(status))
    check("total escrow held back to zero", int(read("get_total_escrow_held")) == 0,
          str(read("get_total_escrow_held")))

    # ---------- 2. double release is impossible ----------
    print("\nSTEP 2  release_escrow again -> must fail")
    tx = client.write_contract(CONTRACT, "release_escrow", account=depositor,
                               args=[event_id, recipient_addr])
    receipt = wait_final(tx)
    payload = leader_payload(receipt)
    check("double release rejected", execution_result(receipt) == "ERROR", execution_result(receipt))
    check("double release says already released", "already released" in payload, payload[:120])
    rec_after2 = wait_balance(recipient.address, lambda v: v == rec_after, tries=10)
    check("recipient balance unchanged after double release", rec_after2 == rec_after,
          f"{rec_after2} vs {rec_after}")

    # ---------- 3. a failing verification must not trap the funds ----------
    print("\nSTEP 3  a failing notarize must leave the escrow refundable")
    ref_id = f"evt_ref_{int(time.time())}"
    receipt, ref_url = open_case_fresh(
        ref_id, "A case with a phrase that is not on the page",
        "This exact phrase does not appear on the page",
    )
    print(f"  evidence: {ref_url}")
    check("open_case for refund succeeded", execution_result(receipt) == "SUCCESS",
          f"{execution_result(receipt)} {leader_payload(receipt)[:120]}")

    con_before_refund = balance(CONTRACT)
    receipt = fund(ref_id)
    check("fund_escrow for refund case succeeded", execution_result(receipt) == "SUCCESS",
          f"{execution_result(receipt)} {leader_payload(receipt)[:120]}")
    con_after_refund_fund = wait_balance(CONTRACT, lambda v: v == con_before_refund + ESCROW_WEI)

    # The verification fails, but no value is attached to notarize, so nothing
    # can be trapped.
    receipt = notarize(ref_id)
    payload = leader_payload(receipt)
    print(f"  notarize execution: {execution_result(receipt)}  payload: {payload[:120]}")
    check("notarize rejected the unbacked claim", execution_result(receipt) == "SUCCESS",
          f"{execution_result(receipt)} {payload[:120]}")
    check("event is rejected, not verified", read("get_record", [ref_id])["verified"] is False,
          str(read("get_record", [ref_id])))
    con_after_failed = balance(CONTRACT)
    check("contract still holds the escrow after the failed verification",
          con_after_failed == con_after_refund_fund, f"{con_after_failed} vs {con_after_refund_fund}")

    # ---------- 4. refund the escrow ----------
    print("\nSTEP 4  refund_escrow")
    dep_before_refund = balance(depositor.address)
    tx = client.write_contract(CONTRACT, "refund_escrow", account=depositor, args=[ref_id])
    receipt = wait_final(tx)
    check("refund_escrow succeeded", execution_result(receipt) == "SUCCESS",
          f"{execution_result(receipt)} {leader_payload(receipt)[:120]}")

    dep_after_refund = wait_balance(depositor.address, lambda v: v == dep_before_refund + ESCROW_WEI)
    con_after_refund = wait_balance(CONTRACT, lambda v: v == con_before_refund)
    check("DEPOSITOR GOT THE ESCROW BACK", dep_after_refund - dep_before_refund == ESCROW_WEI,
          f"delta {dep_after_refund - dep_before_refund}")
    check("contract balance decreased by refund", con_after_refund_fund - con_after_refund == ESCROW_WEI,
          f"delta {con_after_refund_fund - con_after_refund}")
    status = read("get_escrow_status", [ref_id])
    check("refund case now refunded", status.get("escrow_status") == "refunded", str(status))
    check("refund case amount zero", status.get("escrow_wei") == 0, str(status))

    # ---------- 5. the invariant holds at the end ----------
    print("\nSTEP 5  invariants")
    final_balance = balance(CONTRACT)
    final_held = int(read("get_total_escrow_held"))
    check("contract balance equals total escrow held", final_balance == final_held,
          f"balance {final_balance} held {final_held}")
    check("contract is empty after both escrows settled", final_balance == 0, str(final_balance))

    print("\n" + "=" * 56)
    print(f"PASSED: {len(PASS)}   FAILED: {len(FAIL)}")
    for name in FAIL:
        print(f"  FAILED -> {name}")
    print("=" * 56)
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
