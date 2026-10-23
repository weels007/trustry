# Steward Feedback and Resolution - Trustry

## 1. Critic from Steward

The integration is real, but the submitted workflow is not yet safe and complete:

> Users can fund escrow without an application path to release or refund it, and another account can fund a case whose submitter then controls those funds. Please add working release, refund, and appeal calls; bind escrow accounting and settlement rights to the actual funder; validate HTTPS hostnames against exact allowed hosts or subdomains; prevent zero-value blank records; align the description response field; and add repository tests for these corrected flows. Please also replace exact equality of independently generated titles and quotes with validation that preserves agreement on the verdict while accepting separately grounded evidence.

## 2. Audit Result (re-check against current code)

| No | Critic from Steward | Status | Note |
| --- | --- | --- | --- |
| 1 | Funding without application path plus another account funding while submitter controls | **Fixed** | A funding that arrives before `open_case` records an orphan case owned by the funder (never rejects a funding that carries value; zero-value funding of an unknown case is still refused). See section 8. |
| 2 | Bind escrow accounting and settlement rights to actual funder | **Fixed** | `escrow_funder` set at funding time; release/refund/appeal authorize against it, pool tracked per funder. Live-verified on `0x18207BFE...`. |
| 3 | Validate HTTPS hostnames against exact allowed hosts or subdomains | **Fixed** | HTTPS-only, real hostname compared exact-or-subdomain. Live-verified. |
| 4 | Prevent zero-value blank records | **Fixed** | `open_case` requires description and a usable title phrase. |
| 5 | Align description response field | **Fixed** | `get_frontend_details` returns `event_description`. |
| 6 | Add repository tests for corrected flows | **Fixed** | Direct suite green (54 passed); integration tests and both studionet suites (40 + 30 checks) pass on the current deployment. |
| 7 | Replace exact equality of titles and quotes with grounding | **Fixed** | Verdict agreement plus per-validator grounding; separately grounded evidence accepted. |

## 3. Implemented Solutions

### 3.1 Escrow gets an escrow_funder (settlement to actual funder)

- NotaryRecord now has an escrow_funder field.
- fund_escrow requires a case that was opened first via open_case.
- fund_escrow now persists the computed funder (the sender who funds) instead of reusing the stale opener value, so the actual funder controls settlement.
- release_escrow, refund_escrow and appeal_notarization use escrow_funder for authorization and payout. Escrow pool accounting is tracked per funder.

### 3.2 Hostname validation

- _is_trusted_domain now requires HTTPS and compares the real host (exact host or subdomain).
- open_case now rejects schemes other than HTTPS.

### 3.3 Description response field

- get_frontend_details now returns event_description.

### 3.4 Validator

- Validator no longer uses strict equality for titles and quotes.
- Consensus now requires the verdict to agree plus per-validator grounding, then accepts separately grounded evidence.

## 4. Details That Can Be Submitted to the Portal

- Runner: py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6
- Network: GenLayer Studio Network (chain 61999)
- Contract: contracts/trustry.py
- Current deployment: `0x18207BFEF02C1e00Dd2BA6D746FbbeB84A22C1A4`
- Explorer: https://explorer-studio.genlayer.com/address/0x18207BFEF02C1e00Dd2BA6D746FbbeB84A22C1A4

## 5. Portal Submission Checklist (summary)

1. Project summary: AI notary for online facts, independent validators, optional escrow.
2. Demo video: optional.
3. How-to: connect wallet, open case, fund escrow, let validators read, read record.
4. Expected verification: record evt_* with claim, source URL, domain, verdict, quote.
5. Project links: GitHub https://github.com/weels007/trustry, website required.
6. Validator application: account akun44471@gmail.com, company weels007, 0 active nodes, track record dill/avail/dymension, hosting Hetzner SG, strong security setup, builder program contribution.

## 6. Live Verification on GenLayer Studio Network (studionet)

- First fixed deployment at `0xB0995a6C0Fe4168cc0961Fc9CDE96C07c1170230` passed the integration suite.
- Second deployment (same source, redeployed with a wallet from `D:\Genlayer-project\weels\wallet`) is the one verified below.
- Integration harness fix: payable calls use `.transact(value=...)` (e.g. `fund_escrow(args=[...]).transact(value=10**16)`), not a `value` kwarg on the method.

## 7. CLI Test Matrix - redeployed contract (live, studionet)

Verified on `0x85F97A7E33D9508aEA5ED476055429B79c917AB2` (superseded by the value-trap fix in section 8; the matrix below still applies to the current build except for the `fund_escrow` rows).

- Contract: `0x85F97A7E33D9508aEA5ED476055429B79c917AB2` (source `contracts/trustry.py`, 35822 bytes, sha256 `b8290b356ec11280`)
- Deploy tx: `0xd952b1c69d90e71f484d1f6f66e9c27698c78069261e89d25f3efcbedf8ade9d`, status `ACCEPTED`
- Deployer: `tester1` `0xE8b3e800d08727D25156a44cD1609F793bd0Af5a` (keystore from the wallet folder, deployed via `wallet/deploy.py`)
- Callers: `asmodeus` `0xD92eBB228e9385Ea90a852387aA1c4162B2ec009` (GenLayer CLI) and `tester2` `0x0C0Fd005478Cef9219451BBD19Dfc6C0586fC1Ad` (Python SDK, used for payable `value` txs because the CLI cannot set call value)

### 7.1 Read methods

| Method | Input | Result |
| --- | --- | --- |
| `get_all_record_ids` | - | `[]` initially, later listed all 4 test events |
| `get_contract_balance` | - | `0` → `10000000000000000` after funding → `0` after release/refund settle |
| `get_total_escrow_held` | - | `0` → `10000000000000000` → `0` |
| `get_escrow_pool` | tester2 | `0` → `10000000000000000` → `0` |
| `get_event_count` | tester2 | `3` |
| `is_trusted_domain` | `https://github.com` | `true` |
| `is_trusted_domain` | `https://docs.genlayer.com` | `true` |
| `is_trusted_domain` | `http://example.com` | `false` (non-HTTPS) |
| `is_trusted_domain` | `https://evil.example.com` | `false` (not exact host/subdomain) |
| `get_record` | unknown id | `[EXCEPTION] no_such_id not found` |
| `get_escrow_status` | unknown id | `[EXCEPTION] no_such_id not found` |
| `get_frontend_details` | unknown id | `[EXCEPTION] ... not found` |

### 7.2 open_case

| Case | Input | Result |
| --- | --- | --- |
| non-HTTPS evidence | `http://github.com/foo` | rollback `[EXPECTED] Evidence URL must be HTTPS` (MAJORITY_AGREE) |
| untrusted host | `https://evil.example.com/` | `[EXPECTED] Untrusted evidence domain: https://evil.example.com/` |
| duplicate event id | `evt_rejected_cli` again | `[EXPECTED] Event evt_rejected_cli already exists` |
| duplicate canonical URL | `https://github.com/genlayer` again | `[EXPECTED] Evidence URL already notarized as evt_rejected_cli` |
| valid | `evt_cli_steward` + https github URL | ACCEPTED, `state=pending`, `event_description` returned by `get_frontend_details` |

### 7.3 fund_escrow (critic #1)

| Case | Result |
| --- | --- |
| unknown event | `[EXPECTED] Event no_such_case not found; open a case first` |
| funded `evt_escrow_cli` with `value=10**16` (tester2) | ACCEPTED, `escrow_status=held`, `escrow_wei=10000000000000000`, contract balance `10000000000000000` |

### 7.4 escrow_funder binding (critic #2)

| Call | Caller | Result |
| --- | --- | --- |
| `refund_escrow` | asmodeus (not funder, not owner) | `[EXPECTED] Not authorized to refund escrow` |
| `release_escrow` (verified) | asmodeus (not funder) | `[EXPECTED] Only the funder can release this escrow` |
| `appeal_notarization` | asmodeus (not funder, not owner) | `[EXPECTED] Not authorized to appeal this event` |
| `release_escrow` | tester2 (funder) | ACCEPTED, `escrow_status=released`, `escrow_wei=0`, recipient `tester1` balance +0.01 GEN, contract balance back to `0` |
| `refund_escrow` | tester2 (funder) | ACCEPTED, `escrow_status=refunded`, funds returned, contract balance `0` |

### 7.5 notarize / appeal (LLM path)

| Event | Result |
| --- | --- |
| `evt_escrow_cli` (anchor on page, `https://docs.genlayer.com/`) | `state=verified`, `verified=true`, real `event_title` and verbatim `evidence_quote` from the page |
| `evt_cli_steward` (URL 404) | `[EXTERNAL] Source returned 404` → rollback, state stays `pending` (no trap) |
| `evt_rejected_cli` (anchor not on page) | `state=rejected` (deterministic grounding, no model trust needed) |
| `appeal_notarization` on rejected (funder) | ACCEPTED, `appeal_count=1`, re-judged, still `rejected` |

### 7.6 State guards

| Call | Result |
| --- | --- |
| `release_escrow` before verification | `[EXPECTED] Event not verified; escrow cannot be released` |
| `refund_escrow` with no escrow | `[EXPECTED] No escrow held for evt_cli_steward` |
| `refund_escrow` on verified event | `[EXPECTED] Event verified; escrow must be released to the recipient` |
| `release_escrow` twice | `[EXPECTED] Escrow already released for evt_escrow_cli` |
| `appeal_notarization` on pending | `[EXPECTED] Event evt_cli_steward is pending, not rejected` |
| `appeal_notarization` on verified | `[EXPECTED] Event already verified; nothing to appeal` |

Every table row came from a live CLI/SDK call against the contract above; negative rows are consensus-agreed contract rollbacks (`MAJORITY_AGREE`), not client-side rejections.

Note: the GenLayer CLI passes `--args` positionally (`--args a b c`), not as one JSON object; passing a JSON dict wraps it into a single argument.

## 8. Value-trap regression found and fixed

### 8.1 The problem

The steward fix for critic #1 made `fund_escrow` reject a case that was never opened
(`[EXPECTED] Event ... not found; open a case first`). On GenLayer that check is unsafe
inside a payable method: a transaction that fails **still credits the contract with its
value**. The storage change is rolled back, the GEN is not, so the money sits in the
contract with no record to refund it from. Confirmed live on `0x85F97A7E...`:

- probe `fund_escrow` on an unknown event with `value=1e12` → `execution_result=ERROR`,
  but the contract balance rose by exactly `1e12` while `get_total_escrow_held` stayed `0`.
- the contract has no recovery method, so the GEN was burned permanently
  (0.011 GEN total: 0.01 from the studionet suite run, 0.000001 from the probe).

GenLayer docs: Value Transfers states "if the child transaction fails, the value is not
automatically returned to the sender"; the receipt schema has no refund field; the SDK
`__on_errored_message__` hook only covers internal messages, not top-level user
transactions. A payable method that can raise therefore traps its value by construction.

### 8.2 The fix

`fund_escrow` never raises when it carries value. A funding that arrives before
`open_case` records an **orphan case** (`state=pending`, no evidence, `escrow_funder`
and `submitted_by` = the sender), so `refund_escrow` can always return the money to the
funder. Zero-value funding of an unknown case is still refused — there is no value to
protect, and the caller should open a case first. This keeps the steward's concern
answered (settlement rights stay bound to the actual funder via `escrow_funder`) while
restoring the "escrow cannot trap anyone's money" guarantee.

New tests:
- direct: `test_fund_escrow_without_a_case_creates_a_refundable_orphan`,
  `test_fund_escrow_without_value_and_without_a_case_fails`,
  `test_protection_funding_never_traps_value` (suite now 54 passed)
- integration: `test_fund_escrow_without_opened_case_creates_a_refundable_orphan`,
  `test_fund_escrow_without_value_and_without_case_fails`

### 8.3 Current deployment (live, studionet)

- Contract: `0x18207BFEF02C1e00Dd2BA6D746FbbeB84A22C1A4` (source `contracts/trustry.py`, 36713 bytes, sha256 `82acc71f84e1958d`)
- Deploy tx: `0xfe95c2edba7c072d8a95916eb83e7cc2887021f192f83f8b7ba874819a338a86`, status `ACCEPTED`
- Deployer: `tester1` `0xE8b3e800d08727D25156a44cD1609F793bd0Af5a` via `wallet/deploy.py`
- Explorer: https://explorer-studio.genlayer.com/address/0x18207BFEF02C1e00Dd2BA6D746FbbeB84A22C1A4

Live verification on this build:

| Case | Result |
| --- | --- |
| `fund_escrow` unknown event, `value=1e16` | `SUCCESS`, orphan record, `escrow_status=held`, `total_escrow_held=1e16`, balance `1e16` |
| `refund_escrow` on that orphan (funder) | `SUCCESS`, `escrow_status=refunded`, balance `0`, held `0` — invariant restored |
| `fund_escrow` unknown event, `value=0` | `ERROR` `[EXPECTED] Event ... not found; open a case first` |
| `test_studionet.py` | 40 passed, 0 failed |
| `test_escrow_studionet.py` | 30 passed, 0 failed |
| Direct suite | 54 passed |
| `genvm-lint check` | lint + validation passed |
| Frontend `npm run verify` | 6 suites, all passed |
