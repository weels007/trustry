from gltest import get_contract_factory
from gltest.assertions import tx_execution_succeeded

EVIDENCE_URL = "https://docs.genlayer.com/"
PHRASE = "GenLayer"


def test_full_notarization_integration():
    """Open a case, fund the escrow, then let the validators read it."""
    factory = get_contract_factory("Trustry")
    contract = factory.deploy(args=[])

    # Integration tests run against real GenLayer with full consensus.
    # Mocking is NOT available here, so real web and LLM calls apply.
    open_receipt = contract.open_case(
        args=[
            "evt_integration",
            "The GenLayer homepage, introducing the GenLayer project",
            EVIDENCE_URL,
            PHRASE,
        ]
    ).transact()
    assert tx_execution_succeeded(open_receipt)

    fund_receipt = contract.fund_escrow(
        args=["evt_integration"],
        value=10**16,
    ).transact()
    assert tx_execution_succeeded(fund_receipt)

    notarize_receipt = contract.notarize(args=["evt_integration"]).transact()
    assert tx_execution_succeeded(notarize_receipt)

    record = contract.get_record(args=["evt_integration"]).call()
    assert record["event_id"] == "evt_integration"
    assert record["source_domain"] == "docs.genlayer.com"

    details = contract.get_frontend_details(args=["evt_integration"]).call()
    assert details["frontend_ready"] is True
    assert details["consensus_status"] in ("accepted", "rejected")
    # The validator has to cite the page for the record to stand up.
    assert details["evidence_quote"]


def test_escrow_can_be_released_integration():
    """A verified record releases its escrow, and it cannot be released twice."""
    factory = get_contract_factory("Trustry")
    contract = factory.deploy(args=[])

    contract.open_case(
        args=[
            "evt_release",
            "The GenLayer homepage, introducing the GenLayer project",
            EVIDENCE_URL,
            PHRASE,
        ]
    ).transact()
    contract.fund_escrow(args=["evt_release"], value=10**16).transact()
    contract.notarize(args=["evt_release"]).transact()

    status = contract.get_escrow_status(args=["evt_release"]).call()
    if status["verified"]:
        release_receipt = contract.release_escrow(
            args=["evt_release", "0xE8b3e800d08727D25156a44cD1609F793bd0Af5a"]
        ).transact()
        assert tx_execution_succeeded(release_receipt)

        after = contract.get_escrow_status(args=["evt_release"]).call()
        assert after["escrow_status"] == "released"
        assert after["escrow_wei"] == 0
    else:
        # Not attested, so the deposit goes back to the depositor instead.
        refund_receipt = contract.refund_escrow(args=["evt_release"]).transact()
        assert tx_execution_succeeded(refund_receipt)

        after = contract.get_escrow_status(args=["evt_release"]).call()
        assert after["escrow_status"] == "refunded"
        assert after["escrow_wei"] == 0
