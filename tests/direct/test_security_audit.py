"""Security regression tests for the Trustry contract, in direct mode.

Each test locks in one protection. A passing test means the protection holds.
The matching gap was proven with an audit script before the fix.
"""

import json

TITLE = "Test Event Release"
URL = "https://github.com/test/release"


def _deploy(direct_vm, direct_deploy, user):
    direct_vm.sender = user
    return direct_deploy("contracts/trustry.py")


def _mock(direct_vm, body, llm):
    """Register the page and the model answer. The quote must be on the page."""
    llm = dict(llm)
    llm.setdefault("evidence_quote", body)
    direct_vm.mock_web(r".*github\.com/test/release.*", {"status": 200, "body": body})
    direct_vm.mock_llm(r".*AI Notary.*", json.dumps(llm))


def _open(contract, event_id, description="Desc", url=URL, phrase=TITLE):
    return contract.open_case(event_id, description, url, phrase)


def test_protection_one_evidence_url_cannot_back_two_events(direct_vm, direct_deploy, direct_alice):
    """One page can no longer certify an unlimited number of events."""
    contract = _deploy(direct_vm, direct_deploy, direct_alice)
    _open(contract, "evt_0")
    with direct_vm.expect_revert("already notarized"):
        _open(contract, "evt_1")


def test_protection_url_variants_are_blocked(direct_vm, direct_deploy, direct_alice):
    """Query strings, fragments, case and scheme changes do not create a new URL."""
    contract = _deploy(direct_vm, direct_deploy, direct_alice)
    _open(contract, "evt_0")
    for index, variant in enumerate((
        "https://github.com/test/release?ref=main",
        "https://github.com/test/release#frag",
        "https://GitHub.com/test/release/",
    )):
        with direct_vm.expect_revert("already notarized"):
            _open(contract, f"evt_v{index}", url=variant)


def test_protection_events_per_address_are_capped(direct_vm, direct_deploy, direct_alice):
    """One address cannot flood the contract with cases."""
    contract = _deploy(direct_vm, direct_deploy, direct_alice)
    for i in range(25):
        _open(contract, f"evt_{i}", url=f"https://github.com/test/release/{i}")
    assert int(contract.get_event_count(direct_alice)) == 25
    with direct_vm.expect_revert("Too many events"):
        _open(contract, "evt_over", url="https://github.com/test/release/over")


def test_protection_page_without_the_phrase_is_never_verified(direct_vm, direct_deploy, direct_alice):
    """A page that does not contain the required phrase cannot be verified.

    Before the fix, a page about gardening was accepted as proof of a
    "Nuclear Launch" because the model output was never checked.
    """
    contract = _deploy(direct_vm, direct_deploy, direct_alice)
    _open(contract, "evt_inject", description="A launch happened", phrase="Nuclear Launch")
    _mock(direct_vm, "Completely unrelated content about gardening.",
          {"verified": True, "event_title": "Nuclear Launch Confirmed", "reasoning": "Definitely happened."})
    result = contract.notarize("evt_inject")
    assert result["verified"] is False


def test_protection_model_cannot_claim_a_title_that_is_not_on_the_page(direct_vm, direct_deploy, direct_alice):
    """The reported title must be a phrase that really occurs on the page."""
    contract = _deploy(direct_vm, direct_deploy, direct_alice)
    _open(contract, "evt_fake")
    _mock(direct_vm, f"The page mentions {TITLE} once.",
          {"verified": True, "event_title": "Something Else Entirely", "reasoning": "ok"})
    result = contract.notarize("evt_fake")
    assert result["event_title"] == ""


def test_protection_all_required_phrases_must_be_present(direct_vm, direct_deploy, direct_alice):
    """With several phrases, every one of them has to be on the page."""
    contract = _deploy(direct_vm, direct_deploy, direct_alice)
    _open(contract, "evt_multi", phrase="first phrase|second phrase")
    _mock(direct_vm, "Only the first phrase is here.",
          {"verified": True, "event_title": "Only", "reasoning": "ok"})
    result = contract.notarize("evt_multi")
    assert result["verified"] is False


def test_protection_input_length_is_bounded(direct_vm, direct_deploy, direct_alice):
    """Oversized user input is rejected before it reaches the model."""
    contract = _deploy(direct_vm, direct_deploy, direct_alice)
    with direct_vm.expect_revert("too long"):
        _open(contract, "evt_long", description="x" * 300)


def test_protection_owner_cannot_release_another_users_escrow(direct_vm, direct_deploy, direct_alice, direct_bob):
    """The owner has no override over escrows. Only the depositor moves the money."""
    contract = _deploy(direct_vm, direct_deploy, direct_alice)

    direct_vm.sender = direct_bob
    _open(contract, "evt_owner")
    direct_vm.value = 10 ** 16
    contract.fund_escrow("evt_owner")
    direct_vm.value = 0
    _mock(direct_vm, f"Title: {TITLE}", {"verified": True, "event_title": TITLE, "reasoning": "ok"})
    contract.notarize("evt_owner")

    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("funder"):
        contract.release_escrow("evt_owner", direct_alice)
    direct_vm.sender = direct_alice


def test_protection_escrow_cannot_be_released_twice(direct_vm, direct_deploy, direct_alice, direct_bob):
    """The escrow status is tracked, so the same money cannot be released twice."""
    contract = _deploy(direct_vm, direct_deploy, direct_alice)
    _open(contract, "evt_twice")
    direct_vm.value = 10 ** 16
    contract.fund_escrow("evt_twice")
    direct_vm.value = 0
    _mock(direct_vm, f"Title: {TITLE}", {"verified": True, "event_title": TITLE, "reasoning": "ok"})
    contract.notarize("evt_twice")

    contract.release_escrow("evt_twice", direct_bob)
    with direct_vm.expect_revert("already released"):
        contract.release_escrow("evt_twice", direct_bob)


def test_protection_a_model_that_invents_its_quote_is_not_accepted(direct_vm, direct_deploy, direct_alice):
    """The model is the notary, but its answer has to point at the page.

    A verdict that cites a snippet the page does not contain is a
    hallucination, so it cannot certify anything.
    """
    contract = _deploy(direct_vm, direct_deploy, direct_alice)
    _open(contract, "evt_qu")
    direct_vm.mock_web(r".*github\.com/test/release.*",
                        {"status": 200, "body": "The GenLayer documentation is published here."})
    direct_vm.mock_llm(r".*AI Notary.*", json.dumps({
        "verified": True,
        "event_title": "Test Event Release",
        "evidence_quote": "A sentence that appears nowhere on this page at all.",
        "reasoning": "Trust me.",
    }))
    result = contract.notarize("evt_qu")
    assert result["verified"] is False


def test_protection_a_grounded_quote_is_accepted(direct_vm, direct_deploy, direct_alice):
    """The normal path: the model cites the page, so the verdict stands."""
    contract = _deploy(direct_vm, direct_deploy, direct_alice)
    _open(contract, "evt_ok")
    page = f"{TITLE} is published on the GenLayer documentation page."
    direct_vm.mock_web(r".*github\.com/test/release.*", {"status": 200, "body": page})
    direct_vm.mock_llm(r".*AI Notary.*", json.dumps({
        "verified": True,
        "event_title": TITLE,
        "evidence_quote": page,
        "reasoning": "The page announces it.",
    }))
    result = contract.notarize("evt_ok")
    assert result["verified"] is True
    assert contract.get_record("evt_ok")["evidence_quote"] == page


def test_protection_a_rejected_event_can_be_appealed(direct_vm, direct_deploy, direct_alice):
    """A wrong rejection can be re-evaluated through consensus."""
    contract = _deploy(direct_vm, direct_deploy, direct_alice)
    _open(contract, "evt_appeal")
    _mock(direct_vm, "Unrelated content.", {"verified": False, "event_title": "Nope", "reasoning": "no"})
    contract.notarize("evt_appeal")
    assert contract.get_record("evt_appeal")["verified"] is False

    # The evidence is published now. The old mock is cleared first, because
    # the first registered mock is the one that answers.
    direct_vm.clear_mocks()
    _mock(direct_vm, f"Title: {TITLE}", {"verified": True, "event_title": TITLE, "reasoning": "ok"})
    result = contract.appeal_notarization("evt_appeal")
    assert result["verified"] is True
    assert result["appeal_count"] == 1
    assert contract.get_record("evt_appeal")["appeal_count"] == 1


def test_protection_funding_never_traps_value(direct_vm, direct_deploy, direct_alice):
    """A failed payable call keeps its value, so funding an unknown case must
    create a refundable orphan instead of raising."""
    contract = _deploy(direct_vm, direct_deploy, direct_alice)
    direct_vm.value = 10 ** 16
    result = contract.fund_escrow("evt_unknown")
    direct_vm.value = 0
    assert result["escrow_status"] == "held"
    assert contract.refund_escrow("evt_unknown") is True
    assert contract.get_escrow_status("evt_unknown")["escrow_status"] == "refunded"
    assert int(contract.get_total_escrow_held()) == 0


def test_protection_funding_without_value_and_without_a_case_fails(direct_vm, direct_deploy, direct_alice):
    """Zero-value funding of an unknown case is still refused."""
    contract = _deploy(direct_vm, direct_deploy, direct_alice)
    with direct_vm.expect_revert("not found"):
        contract.fund_escrow("evt_unknown")
    assert len(contract.get_all_record_ids()) == 0


def test_protection_notarize_carries_no_value(direct_vm, direct_deploy, direct_alice):
    """The non-deterministic step is not payable, so its failures are harmless."""
    contract = _deploy(direct_vm, direct_deploy, direct_alice)
    _open(contract, "evt_nov")
    # A 404 makes the verification fail. No value is attached, so nothing can
    # be trapped in the contract.
    direct_vm.mock_web(r".*github\.com/test/release.*", {"status": 404, "body": "Not found"})
    with direct_vm.expect_revert("Source returned 404"):
        contract.notarize("evt_nov")
    # The case is untouched and still refundable.
    assert contract.get_record("evt_nov")["state"] == "pending"

def test_protection_funder_not_submitter_controls_escrow(direct_vm, direct_deploy, direct_alice, direct_bob):
    """A third party that funds the case is the funder, not the submitter."""
    contract = _deploy(direct_vm, direct_deploy, direct_alice)

    direct_vm.sender = direct_bob
    _open(contract, "evt_funder", description="A launch happened", url=URL, phrase=TITLE)
    direct_vm.sender = direct_alice
    direct_vm.value = 10 ** 16
    contract.fund_escrow("evt_funder")
    direct_vm.value = 0
    _mock(direct_vm, f"Title: {TITLE}", {"verified": True, "event_title": TITLE, "reasoning": "ok"})
    contract.notarize("evt_funder")

    # The submitter who opened the case cannot release a third party's escrow.
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("funder"):
        contract.release_escrow("evt_funder", direct_alice)

    # The funder can release it.
    direct_vm.sender = direct_alice
    assert contract.release_escrow("evt_funder", direct_alice) is True


def test_protection_subdomain_of_trusted_domain_is_allowed(direct_vm, direct_deploy, direct_alice):
    contract = _deploy(direct_vm, direct_deploy, direct_alice)
    assert contract.is_trusted_domain("https://sub.github.com/test/release") is True
    assert contract.is_trusted_domain("https://docs.genlayer.com.evil.com/") is False
    assert contract.is_trusted_domain("https://evil-github.com/test") is False


def test_protection_get_frontend_details_exposes_event_description(direct_vm, direct_deploy, direct_alice):
    contract = _deploy(direct_vm, direct_deploy, direct_alice)
    _open(contract, "evt_desc", description="The GenLayer homepage describes the project", url=URL, phrase=TITLE)
    _mock(direct_vm, f"Title: {TITLE}", {"verified": True, "event_title": TITLE, "reasoning": "ok"})
    contract.notarize("evt_desc")
    details = contract.get_frontend_details("evt_desc")
    assert details["event_description"] == "The GenLayer homepage describes the project"
