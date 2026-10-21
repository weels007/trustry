import json

ESCROW_WEI = 10 ** 16  # 0.01 GEN
TITLE = "Test Event Release"
URL = "https://github.com/test/release"


def _deploy_fresh(direct_vm, direct_deploy, user):
    direct_vm.sender = user
    return direct_deploy("contracts/trustry.py")


def _mock_accept(direct_vm, body=None, title=TITLE):
    """The page contains the required phrase, so the anchor is found."""
    page = body or f"Event confirmed. Title: {title}"
    direct_vm.mock_web(
        r".*github\.com/test/release.*",
        {"status": 200, "body": page},
    )
    direct_vm.mock_llm(
        r".*AI Notary.*",
        json.dumps({
            "verified": True,
            "event_title": title,
            "evidence_quote": page,
            "reasoning": "Matches expected event",
        }),
    )


def _mock_reject(direct_vm, body=None, title="Wrong Title"):
    """The page does not contain the required phrase, so the anchor fails."""
    page = body or "Unrelated content about gardening."
    direct_vm.mock_web(
        r".*github\.com/test/release.*",
        {"status": 200, "body": page},
    )
    direct_vm.mock_llm(
        r".*AI Notary.*",
        json.dumps({
            "verified": False,
            "event_title": title,
            "evidence_quote": page,
            "reasoning": "Does not match",
        }),
    )


def _open(contract, event_id, description="Desc", url=URL, phrase=TITLE):
    return contract.open_case(event_id, description, url, phrase)


# ---------------- Basic flow ----------------

def test_contract_deploy_and_read(direct_vm, direct_deploy, direct_alice):
    contract = _deploy_fresh(direct_vm, direct_deploy, direct_alice)
    assert len(contract.get_all_record_ids()) == 0
    assert contract.is_trusted_domain("https://github.com/test") is True
    assert contract.is_trusted_domain("https://unknown-site.xyz/test") is False


def test_open_case_then_notarize(direct_vm, direct_deploy, direct_alice):
    contract = _deploy_fresh(direct_vm, direct_deploy, direct_alice)
    opened = _open(contract, "evt_001")
    assert opened["state"] == "pending"

    _mock_accept(direct_vm)
    result = contract.notarize("evt_001")
    assert result["verified"] is True
    assert result["event_title"] == TITLE
    assert result["state"] == "verified"

    record = contract.get_record("evt_001")
    assert record["verified"] is True
    assert record["source_domain"] == "github.com"
    direct_vm.clear_mocks()


def test_get_frontend_details(direct_vm, direct_deploy, direct_alice):
    contract = _deploy_fresh(direct_vm, direct_deploy, direct_alice)
    _open(contract, "evt_001")
    _mock_accept(direct_vm)
    contract.notarize("evt_001")
    details = contract.get_frontend_details("evt_001")
    assert details["frontend_ready"] is True
    assert details["consensus_status"] == "accepted"
    assert details["state"] == "verified"
    assert "AI Notary" in details["display_message"]
    direct_vm.clear_mocks()


def test_notarize_twice_fails(direct_vm, direct_deploy, direct_alice):
    contract = _deploy_fresh(direct_vm, direct_deploy, direct_alice)
    _open(contract, "evt_001")
    _mock_accept(direct_vm)
    contract.notarize("evt_001")
    direct_vm.clear_mocks()
    with direct_vm.expect_revert("not pending"):
        contract.notarize("evt_001")


def test_notarize_unknown_event_fails(direct_vm, direct_deploy, direct_alice):
    contract = _deploy_fresh(direct_vm, direct_deploy, direct_alice)
    with direct_vm.expect_revert("not found"):
        contract.notarize("evt_none")


# ---------------- Open case validation ----------------

def test_open_case_untrusted_domain_fails(direct_vm, direct_deploy, direct_alice):
    contract = _deploy_fresh(direct_vm, direct_deploy, direct_alice)
    with direct_vm.expect_revert("Untrusted"):
        _open(contract, "evt_bad", url="https://evil.com/page")


def test_open_case_bad_url_scheme_fails(direct_vm, direct_deploy, direct_alice):
    contract = _deploy_fresh(direct_vm, direct_deploy, direct_alice)
    with direct_vm.expect_revert("HTTP"):
        _open(contract, "evt_bad", url="ftp://github.com/test")


def test_open_case_duplicate_event_fails(direct_vm, direct_deploy, direct_alice):
    contract = _deploy_fresh(direct_vm, direct_deploy, direct_alice)
    _open(contract, "evt_dup")
    with direct_vm.expect_revert("already exists"):
        _open(contract, "evt_dup")


def test_get_record_not_found_fails(direct_vm, direct_deploy, direct_alice):
    contract = _deploy_fresh(direct_vm, direct_deploy, direct_alice)
    with direct_vm.expect_revert("not found"):
        contract.get_record("evt_none")


def test_is_trusted_domain_various(direct_vm, direct_deploy, direct_alice):
    contract = _deploy_fresh(direct_vm, direct_deploy, direct_alice)
    assert contract.is_trusted_domain("https://ethereum.org/en/") is True
    assert contract.is_trusted_domain("https://reuters.com/news") is True
    assert contract.is_trusted_domain("https://docs.genlayer.com/") is True
    assert contract.is_trusted_domain("https://random-blog.xyz/post") is False


# ---------------- Security: the anchor is the ground truth ----------------

def test_page_without_the_phrase_is_not_verified(direct_vm, direct_deploy, direct_alice):
    """A page that does not contain the required phrase can never be verified,
    even when the model claims it is."""
    contract = _deploy_fresh(direct_vm, direct_deploy, direct_alice)
    _open(contract, "evt_inject", description="A launch happened", phrase="Nuclear Launch")
    direct_vm.mock_web(r".*github\.com/test/release.*",
                        {"status": 200, "body": "Completely unrelated content about gardening."})
    direct_vm.mock_llm(r".*AI Notary.*",
                        json.dumps({"verified": True, "event_title": "Nuclear Launch Confirmed",
                                    "reasoning": "Definitely happened."}))
    result = contract.notarize("evt_inject")
    assert result["verified"] is False
    direct_vm.clear_mocks()


def test_model_cannot_claim_a_title_that_is_not_on_the_page(direct_vm, direct_deploy, direct_alice):
    """The reported title must be a phrase that really occurs on the page."""
    contract = _deploy_fresh(direct_vm, direct_deploy, direct_alice)
    _open(contract, "evt_fake")
    direct_vm.mock_web(r".*github\.com/test/release.*",
                        {"status": 200, "body": "The page mentions Test Event Release once."})
    direct_vm.mock_llm(r".*AI Notary.*",
                        json.dumps({"verified": True, "event_title": "Something Else Entirely",
                                    "reasoning": "ok"}))
    result = contract.notarize("evt_fake")
    assert result["event_title"] == ""
    direct_vm.clear_mocks()


def test_multiple_phrases_all_must_be_present(direct_vm, direct_deploy, direct_alice):
    contract = _deploy_fresh(direct_vm, direct_deploy, direct_alice)
    _open(contract, "evt_multi", phrase="first phrase|second phrase")
    direct_vm.mock_web(r".*github\.com/test/release.*",
                        {"status": 200, "body": "Only the first phrase is here."})
    direct_vm.mock_llm(r".*AI Notary.*",
                        json.dumps({"verified": True, "event_title": "Only", "reasoning": "ok"}))
    result = contract.notarize("evt_multi")
    assert result["verified"] is False
    direct_vm.clear_mocks()


def test_adversarial_llm_markdown_wrapper(direct_vm, direct_deploy, direct_alice):
    contract = _deploy_fresh(direct_vm, direct_deploy, direct_alice)
    _open(contract, "evt_md")
    direct_vm.mock_web(r".*github\.com/test/release.*", {"status": 200, "body": "Page content. Test Event Release"})
    direct_vm.mock_llm(
        r".*AI Notary.*",
        'Here you go:\n```json\n{"verified": true, "event_title": "Test Event Release", '
        '"evidence_quote": "Page content. Test Event Release", "reasoning": "Fine."}\n```\nHope this helps.',
    )
    result = contract.notarize("evt_md")
    assert result["verified"] is True
    assert result["event_title"] == TITLE
    direct_vm.clear_mocks()


def test_validator_agreement(direct_vm, direct_deploy, direct_alice):
    contract = _deploy_fresh(direct_vm, direct_deploy, direct_alice)
    _open(contract, "evt_val")
    _mock_accept(direct_vm)
    contract.notarize("evt_val")
    direct_vm.clear_mocks()
    _mock_accept(direct_vm)
    assert direct_vm.run_validator() is True
    direct_vm.clear_mocks()


# ---------------- Security: url dedup and rate limits ----------------

def test_same_url_cannot_back_two_events(direct_vm, direct_deploy, direct_alice):
    contract = _deploy_fresh(direct_vm, direct_deploy, direct_alice)
    _open(contract, "evt_a")
    with direct_vm.expect_revert("already notarized"):
        _open(contract, "evt_b")


def test_url_variants_are_blocked(direct_vm, direct_deploy, direct_alice):
    contract = _deploy_fresh(direct_vm, direct_deploy, direct_alice)
    _open(contract, "evt_a")
    for index, variant in enumerate((
        "https://github.com/test/release?ref=main",
        "https://github.com/test/release#frag",
        "http://github.com/test/release",
        "https://GitHub.com/test/release/",
    )):
        with direct_vm.expect_revert("already notarized"):
            _open(contract, f"evt_v{index}", url=variant)


def test_event_count_is_capped(direct_vm, direct_deploy, direct_alice):
    contract = _deploy_fresh(direct_vm, direct_deploy, direct_alice)
    for i in range(25):
        _open(contract, f"evt_{i}", url=f"https://github.com/test/release/{i}")
    assert int(contract.get_event_count(direct_alice)) == 25
    with direct_vm.expect_revert("Too many events"):
        _open(contract, "evt_over", url="https://github.com/test/release/over")


def test_input_length_is_bounded(direct_vm, direct_deploy, direct_alice):
    contract = _deploy_fresh(direct_vm, direct_deploy, direct_alice)
    with direct_vm.expect_revert("too long"):
        _open(contract, "evt_long", description="x" * 300)


# ---------------- Escrow ----------------

def test_fund_escrow_records_the_deposit(direct_vm, direct_deploy, direct_alice):
    contract = _deploy_fresh(direct_vm, direct_deploy, direct_alice)
    _open(contract, "evt_esc")
    direct_vm.value = ESCROW_WEI
    result = contract.fund_escrow("evt_esc")
    direct_vm.value = 0
    assert result["escrow_wei"] == ESCROW_WEI
    status = contract.get_escrow_status("evt_esc")
    assert status["escrow_wei"] == ESCROW_WEI
    assert status["escrow_status"] == "held"
    assert int(contract.get_total_escrow_held()) == ESCROW_WEI


def test_fund_escrow_never_fails_so_funds_cannot_be_trapped(direct_vm, direct_deploy, direct_alice):
    """fund_escrow has no raising check, so a value is always recorded."""
    contract = _deploy_fresh(direct_vm, direct_deploy, direct_alice)
    # The case does not exist. The call still succeeds and the funds are held.
    direct_vm.value = ESCROW_WEI
    contract.fund_escrow("evt_unknown")
    direct_vm.value = 0
    status = contract.get_escrow_status("evt_unknown")
    assert status["escrow_wei"] == ESCROW_WEI
    assert status["escrow_status"] == "held"


def test_release_escrow_moves_funds(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = _deploy_fresh(direct_vm, direct_deploy, direct_alice)
    _open(contract, "evt_rel")
    direct_vm.value = ESCROW_WEI
    contract.fund_escrow("evt_rel")
    direct_vm.value = 0
    _mock_accept(direct_vm)
    contract.notarize("evt_rel")
    direct_vm.clear_mocks()

    assert int(contract.get_escrow_pool(direct_alice)) == ESCROW_WEI
    assert contract.release_escrow("evt_rel", direct_bob) is True

    status = contract.get_escrow_status("evt_rel")
    assert status["escrow_wei"] == 0
    assert status["escrow_status"] == "released"
    assert int(contract.get_escrow_pool(direct_alice)) == 0
    assert int(contract.get_total_escrow_held()) == 0


def test_release_escrow_twice_fails(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = _deploy_fresh(direct_vm, direct_deploy, direct_alice)
    _open(contract, "evt_twice")
    direct_vm.value = ESCROW_WEI
    contract.fund_escrow("evt_twice")
    direct_vm.value = 0
    _mock_accept(direct_vm)
    contract.notarize("evt_twice")
    direct_vm.clear_mocks()

    contract.release_escrow("evt_twice", direct_bob)
    with direct_vm.expect_revert("already released"):
        contract.release_escrow("evt_twice", direct_bob)


def test_release_escrow_on_unverified_fails(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = _deploy_fresh(direct_vm, direct_deploy, direct_alice)
    _open(contract, "evt_unver")
    direct_vm.value = ESCROW_WEI
    contract.fund_escrow("evt_unver")
    direct_vm.value = 0
    _mock_reject(direct_vm)
    contract.notarize("evt_unver")
    direct_vm.clear_mocks()

    with direct_vm.expect_revert("not verified"):
        contract.release_escrow("evt_unver", direct_bob)


def test_release_escrow_unauthorized_fails(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = _deploy_fresh(direct_vm, direct_deploy, direct_alice)
    _open(contract, "evt_unauth")
    direct_vm.value = ESCROW_WEI
    contract.fund_escrow("evt_unauth")
    direct_vm.value = 0
    _mock_accept(direct_vm)
    contract.notarize("evt_unauth")
    direct_vm.clear_mocks()

    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("depositor"):
        contract.release_escrow("evt_unauth", direct_bob)
    direct_vm.sender = direct_alice


def test_owner_cannot_release_another_users_escrow(direct_vm, direct_deploy, direct_alice, direct_bob):
    """The owner has no override: only the depositor can move the money."""
    contract = _deploy_fresh(direct_vm, direct_deploy, direct_alice)
    direct_vm.sender = direct_bob
    _open(contract, "evt_owner")
    direct_vm.value = ESCROW_WEI
    contract.fund_escrow("evt_owner")
    direct_vm.value = 0
    _mock_accept(direct_vm)
    contract.notarize("evt_owner")
    direct_vm.clear_mocks()

    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("depositor"):
        contract.release_escrow("evt_owner", direct_alice)
    direct_vm.sender = direct_alice


def test_refund_escrow_returns_to_submitter(direct_vm, direct_deploy, direct_alice):
    contract = _deploy_fresh(direct_vm, direct_deploy, direct_alice)
    _open(contract, "evt_ref")
    direct_vm.value = ESCROW_WEI
    contract.fund_escrow("evt_ref")
    direct_vm.value = 0
    _mock_reject(direct_vm)
    contract.notarize("evt_ref")
    direct_vm.clear_mocks()

    assert contract.refund_escrow("evt_ref") is True
    status = contract.get_escrow_status("evt_ref")
    assert status["escrow_wei"] == 0
    assert status["escrow_status"] == "refunded"
    assert int(contract.get_escrow_pool(direct_alice)) == 0
    assert int(contract.get_total_escrow_held()) == 0


def test_refund_escrow_twice_fails(direct_vm, direct_deploy, direct_alice):
    contract = _deploy_fresh(direct_vm, direct_deploy, direct_alice)
    _open(contract, "evt_ref2")
    direct_vm.value = ESCROW_WEI
    contract.fund_escrow("evt_ref2")
    direct_vm.value = 0
    _mock_reject(direct_vm)
    contract.notarize("evt_ref2")
    direct_vm.clear_mocks()

    contract.refund_escrow("evt_ref2")
    with direct_vm.expect_revert("already refunded"):
        contract.refund_escrow("evt_ref2")


def test_refund_escrow_on_verified_fails(direct_vm, direct_deploy, direct_alice):
    contract = _deploy_fresh(direct_vm, direct_deploy, direct_alice)
    _open(contract, "evt_refver")
    direct_vm.value = ESCROW_WEI
    contract.fund_escrow("evt_refver")
    direct_vm.value = 0
    _mock_accept(direct_vm)
    contract.notarize("evt_refver")
    direct_vm.clear_mocks()

    with direct_vm.expect_revert("must be released"):
        contract.refund_escrow("evt_refver")


def test_escrow_status_missing_event_fails(direct_vm, direct_deploy, direct_alice):
    contract = _deploy_fresh(direct_vm, direct_deploy, direct_alice)
    with direct_vm.expect_revert("not found"):
        contract.get_escrow_status("evt_none")


# ---------------- Appeal ----------------

def test_appeal_re_evaluates_a_rejected_event(direct_vm, direct_deploy, direct_alice):
    contract = _deploy_fresh(direct_vm, direct_deploy, direct_alice)
    _open(contract, "evt_appeal")
    _mock_reject(direct_vm)
    contract.notarize("evt_appeal")
    direct_vm.clear_mocks()
    assert contract.get_record("evt_appeal")["verified"] is False

    # The evidence is published now, so the appeal must succeed.
    _mock_accept(direct_vm)
    result = contract.appeal_notarization("evt_appeal")
    assert result["verified"] is True
    assert result["appeal_count"] == 1
    record = contract.get_record("evt_appeal")
    assert record["verified"] is True
    assert record["appeal_count"] == 1
    direct_vm.clear_mocks()


def test_appeal_on_verified_event_fails(direct_vm, direct_deploy, direct_alice):
    contract = _deploy_fresh(direct_vm, direct_deploy, direct_alice)
    _open(contract, "evt_apv")
    _mock_accept(direct_vm)
    contract.notarize("evt_apv")
    direct_vm.clear_mocks()
    with direct_vm.expect_revert("already verified"):
        contract.appeal_notarization("evt_apv")


def test_appeal_unauthorized_fails(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = _deploy_fresh(direct_vm, direct_deploy, direct_alice)
    _open(contract, "evt_apu")
    _mock_reject(direct_vm)
    contract.notarize("evt_apu")
    direct_vm.clear_mocks()
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("Not authorized"):
        contract.appeal_notarization("evt_apu")
    direct_vm.sender = direct_alice


def test_appeal_missing_event_fails(direct_vm, direct_deploy, direct_alice):
    contract = _deploy_fresh(direct_vm, direct_deploy, direct_alice)
    with direct_vm.expect_revert("not found"):
        contract.appeal_notarization("evt_none")
