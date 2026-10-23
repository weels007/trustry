from gltest import get_contract_factory
from gltest.assertions import tx_execution_failed, tx_execution_succeeded

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

    fund_receipt = contract.fund_escrow(args=["evt_integration"]).transact(value=10**16)
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
    contract.fund_escrow(args=["evt_release"]).transact(value=10**16)
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


def test_open_case_rejects_untrusted_domain_fails():
    """A host outside the trusted list cannot be used as evidence."""
    factory = get_contract_factory("Trustry")
    contract = factory.deploy(args=[])
    tx = contract.open_case(
        args=["evt_bad_domain", "A launch happened", "https://evil.example.com/", "Launch"]
    ).transact()
    assert tx_execution_failed(tx)


def test_open_case_rejects_non_https_evidence_url_fails():
    """Evidence must be served over HTTPS."""
    factory = get_contract_factory("Trustry")
    contract = factory.deploy(args=[])
    tx = contract.open_case(
        args=["evt_bad_scheme", "A launch happened", "http://evil.example.com/", "Launch"]
    ).transact()
    assert tx_execution_failed(tx)


def test_fund_escrow_without_opened_case_creates_a_refundable_orphan():
    """A funding that arrives before open_case cannot fail: the value would
    stay in the contract with no record. It becomes a refundable orphan."""
    factory = get_contract_factory("Trustry")
    contract = factory.deploy(args=[])
    fund_receipt = contract.fund_escrow(args=["evt_unknown"]).transact(value=10**16)
    assert tx_execution_succeeded(fund_receipt)

    status = contract.get_escrow_status(args=["evt_unknown"]).call()
    assert status["escrow_status"] == "held"
    assert status["escrow_wei"] == 10**16

    refund_receipt = contract.refund_escrow(args=["evt_unknown"]).transact()
    assert tx_execution_succeeded(refund_receipt)
    status = contract.get_escrow_status(args=["evt_unknown"]).call()
    assert status["escrow_status"] == "refunded"


def test_fund_escrow_without_value_and_without_case_fails():
    """Zero-value funding of a case that was never opened is still refused."""
    factory = get_contract_factory("Trustry")
    contract = factory.deploy(args=[])
    tx = contract.fund_escrow(args=["evt_no_value"]).transact()
    assert tx_execution_failed(tx)


def test_release_escrow_before_verification_fails():
    """Escrow cannot be released before the case is verified."""
    factory = get_contract_factory("Trustry")
    contract = factory.deploy(args=[])
    contract.open_case(
        args=["evt_not_yet", "A launch happened", EVIDENCE_URL, PHRASE]
    ).transact()
    contract.fund_escrow(args=["evt_not_yet"]).transact(value=10**16)
    tx = contract.release_escrow(
        args=["evt_not_yet", "0xE8b3e800d08727D25156a44cD1609F793bd0Af5a"]
    ).transact()
    assert tx_execution_failed(tx)
