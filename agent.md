# Agent Guidelines — Trustry (AI Notary GenLayer)

## Mandate
Build an Intelligent Contract for **Trustry** on GenLayer: automated verification of online events with verifiable on-chain records, using trusted web sources, with optional escrow feature. Deploy target: studionet (not yet — only structure).

## Rules
- ALWAYS read GenLayer docs first for any design/implementation decision: https://docs.genlayer.com/
- ALWAYS pin concrete GenVM runner version hash (no `test`, `latest`, unversioned).
- ALWAYS use `run_nondet_unsafe` with independent validator verification for web/LLM blocks.
- ALWAYS read `SKILL.md` (write-contract, direct-tests, integration-tests) before coding.
- NEVER deploy to studionet without user confirmation.
- ALWAY create/update `agent.md` when new instructions arrive.

## Key References
- GenLayer Protocol: https://docs.genlayer.com/understand-genlayer-protocol/
- Intelligent Contracts Intro: https://docs.genlayer.com/developers/intelligent-contracts/introduction
- Equivalence Principle: https://docs.genlayer.com/understand-genlayer-protocol/core-concepts/optimistic-democracy/equivalence-principle
- Non-deterministic Operations: https://docs.genlayer.com/understand-genlayer-protocol/core-concepts/non-deterministic-operations-handling
- Direct Tests Skill: C:\Users\dhozi\.config\opencode\skills\direct-tests\SKILL.md
- Integration Tests Skill: C:\Users\dhozi\.config\opencode\skills\integration-tests\SKILL.md
- Write Contract Skill: C:\Users\dhozi\.config\opencode\skills\write-contract\SKILL.md

## Project Design (Trustry — AI Notary)
- **Theme**: Notary service that verifies online events using trusted URLs (official sites, APIs, news sources with accountability).
- **Evidence Source**: Only trusted/verifiable URLs; contract should store `evidence_url`, `source_domain`, `verified_content_hash` (or summary).
- **Storage**: `NotaryRecord` dataclass with `event_id`, `description`, `verified`, `evidence_url`, `submitted_by`, `timestamp`, `escrow_amount`.
- **Escrow (optional)**: `payable` method to deposit GEN; release to notary/prover on verification or return on dispute/rejection.
- **Consensus**: Custom validator reruns web fetch from same trusted URL, compares `verified` boolean and stable fields (domain, event title, date). Never leader-output-only validation.
- **Web3 Fit**: All state changes are on-chain; appeals possible; verifiable audit trail for dApps/Web3 agents.

## File Structure Target
```
ai-notary/
  agent.md
    contracts/
    trustry.py
  tests/
    direct/
      test_ai_notary.py
    integration/
      test_ai_notary.py
  deploy/
    deploy.sh (future)
```

## Next Actions (Pending)
- Confirm event type with user (Twitter/X, official site, API).
- Confirm trusted URL patterns.
- Implement contract skeleton with pinned runner.

## Deployment & Testing (Verified on studionet)
- **Contract address (studionet, current)**: `0xf322db27dceD1AF28Db33756dff7f4D99205dA98`
  - earlier builds: `0xcf2Ae53f11116Fbf0121990678E4DB513f44dd8d` (v3), `0x175149bE360fbB49D2C216eB26428693D53017A7`, `0xC100045acb98a280e58880C270169BD4C474523a` (v2 with escrow), `0x26400588CF33a28B270bB177D3fC9bAe917d8F2C`, `0x8afB142f503111f84103570bc21E04f103052993` (escrow v1), `0x8Cf3165E5490b982b5e14F3f7d80D349fcCC76E1` (first build, escrow was a stub)
- **Wallet**: `tester1` from `D:\Genlayer-project\weels\wallet` (`tester1-keystore.json` + `tester1.password`)
- **Deploy route**: `python "D:\Genlayer-project\weels\wallet\deploy.py" --contract contracts/trustry.py --wallet tester1`
  - The GenLayer CLI cannot be piped: it reads the keystore password with `inquirer`, which needs a real TTY.
  - `deploy.py` decrypts the keystore with `eth_account` and deploys with `genlayer-py`. No prompt, no key copy, no password on a command line.
  - CLI fallback (needs a keystore copy in `~/.genlayer/keystores`): `account import --source-password <pw> --password <pw>` → `account unlock --account <n> --password <pw>` → `account use <n>` → `contracts deploy --contract <path> --rpc https://studio.genlayer.com/api` → `account lock` + `account remove --force`.
- **Real studionet tests**:
  - `python test_studionet.py` — 39 checks, every read and write method, real web + LLM consensus.
  - `python test_escrow_studionet.py` — 31 checks that prove the GEN actually moves, by reading on-chain balances of the depositor, the recipient and the contract.
- **Direct tests**: `pytest tests/direct/` — 48 passed (33 behaviour + 15 security regression).

### Contract API (v3, funding separated from risk)
```
open_case(event_id, description, evidence_url, expected_event_title)  # not payable
fund_escrow(event_id)                                                # payable, cannot fail
notarize(event_id)                                                   # not payable, does the consensus
appeal_notarization(event_id)                                        # not payable
release_escrow(event_id, recipient) / refund_escrow(event_id)         # not payable
```
Reads: `get_record`, `get_frontend_details`, `get_all_record_ids`, `get_escrow_status`,
`get_escrow_pool`, `get_event_count`, `get_total_escrow_held`, `get_contract_balance`,
`is_trusted_domain`.

### Hard-won facts about studionet
- `ACCEPTED` / `FINALIZED` is a **lifecycle status, not execution success**. Read `execution_result` inside `consensus_data.leader_receipt` (entry with `mode == "leader"`) to know whether the contract actually ran.
- `execution_result` is `SUCCESS` or `ERROR`; on ERROR the payload holds the error text, e.g. `[EXPECTED] Untrusted evidence domain: ...` or `[EXTERNAL] Source returned 404`.
- A failed transaction still reaches `MAJORITY_AGREE` and `FINALIZED`, but the state change is **rolled back**. Only a `SUCCESS` execution persists state.
- Read state only **after** the transaction is `FINALIZED` (`wait_for_transaction_receipt(..., status=TransactionStatus.FINALIZED)`). Reading at `ACCEPTED` returns stale state and the record looks missing.
- `read_contract` defaults to `TransactionHashVariant.LATEST_NONFINAL`; use `LATEST_FINAL` to read finalized state.
- The studio host returns **502 Bad Gateway** now and then. Retry the receipt wait and the read on 502, do not treat it as a contract failure.
- The trusted-domain whitelist must match pages that really return 200. `github.com/genlayerlabs/genlayer` and `ethereum.org/en/updates/` are 404; `docs.genlayer.com`, `blog.ethereum.org`, `cointelegraph.com` are 200.
- Never compare `verified` against a hardcoded title. The LLM returns the real page headline, e.g. `GenLayer — The Adjudication Layer for the Agentic Economy`.

### The value trap: a failed transaction still keeps the GEN
- A transaction that fails **still credits the contract with the value**. The receipt shows `value_credited: True` even when `execution_result` is `ERROR`, and the GEN is never returned. The storage is rolled back, so there is no record to refund from.
- Therefore **no method that can fail may carry a value**. The contract separates the two:
  - `open_case` and `notarize` are not payable. They do the web fetch and the LLM call, and they can fail, but they hold no funds.
  - `fund_escrow` is the only payable method, and it has **no check that can raise**. If the case does not exist it creates one, so the funds are always recorded and always refundable.
- Keep the invariant `contract balance == total_escrow_held`. `get_total_escrow_held` and `get_contract_balance` expose both sides, and `release_escrow` / `refund_escrow` refuse to pay out when the contract does not hold the money.

### Escrow rules that matter
- Moving native tokens out of the contract needs the EVM interface:
  ```python
  @gl.evm.contract_interface
  class _Recipient:
      class View: pass
      class Write: pass
  ...
  _Recipient(target).emit_transfer(value=u256(amount))
  ```
  `emit_transfer` raises if the value is 0, so guard the amount first.
- **Address arguments must be encoded as address objects, not hex strings.** The calldata encoder only emits a real address for an `Address` instance; a plain `str` is encoded as a string, the contract receives a `str`, and `address.as_bytes` then traps with `exit_code 1`. From Python use `genlayer_py.types.CalldataAddress`. Inside the contract, normalise defensively:
  ```python
  target = recipient if isinstance(recipient, Address) else Address(recipient)
  ```
- Mutating a field of a stored dataclass does **not** persist. Reassign the whole object:
  `self.records[event_id] = NotaryRecord(...)`.
- A local reference to a stored record points at the stored object, so capture a counter **before** the reassignment, otherwise the returned value is one too high.
- `emit_transfer` posts the message with `on="finalized"`, so the balance moves **after** the transaction is finalized. Poll the balance instead of reading it once.
- The escrow status must be tracked explicitly (`none` / `held` / `released` / `refunded`), otherwise the same escrow can be released twice.
- `self.balance` is the contract's own balance and works on chain, but it is 0 in direct mode, so the balance guard must not be the only check. The stored counter is the source of truth.

### Security posture (see `tests/direct/test_security_audit.py`)
- **The LLM is the notary.** It judges the meaning of the page: does this page report this event? That semantic call is the core of GenLayer and it is not replaced by any rule in the contract.
- **The deterministic checks guard the LLM, they do not replace it.** Three layers sit under the verdict:
  1. **Anchor, deterministic.** The required key phrases must really occur in the fetched page. The page cannot talk the contract into accepting a claim that is not on the page at all.
  2. **Quote grounding, deterministic.** The model must return a verbatim snippet from the page (`evidence_quote`). The contract checks that snippet against the page text. A model that invents its evidence cannot certify anything, so a hallucination is caught without distrusting the model.
  3. **Title grounding, deterministic.** The reported title must be a phrase that occurs on the page, otherwise it is dropped.
- **The verdict needs all three.** `verified` is the model's answer, accepted only when the anchor was found and the quote was grounded.
- **One evidence page certifies one event.** The URL is canonicalised (scheme, host case, query, fragment, trailing slash) and reserved in `url_index`.
- **Events per address are capped** at 25, so one address cannot flood the contract.
- **User input is bounded and length checked** before it reaches the model, and the page is delimited and labelled as untrusted data.
- **The owner has no override over escrows.** Only the depositor can release the money. The owner may trigger a refund, but the funds always go back to the depositor.
- **A rejected case can be appealed** and judged again from scratch.
- **Output is restricted** to a boolean plus a bounded title, a bounded quote and a bounded reasoning.

## Trusted Domains (verified reachable)
`github.com`, `twitter.com`, `x.com`, `official`, `reuters.com`, `bloomberg.com`, `cointelegraph.com`, `ethereum.org`, `docs.genlayer.com`

## Testing against a local node (no studio transactions)
`glsim` is a local GenLayer network. It runs the contract for real, with a real
consensus round, so the whole stack can be exercised without touching the
studio network.

```bash
python run_localnet_test.py      # fresh node, deploy, then drive it from the interface
```

- The node caches the contract class per process, so **it has to be restarted
  whenever the contract source changes**. A stale class is the reason a
  deploy suddenly fails with "class is not marked for usage within storage".
- The contract class needs `@allow_storage`. The studio runtime marks it
  itself, the local one does not, and the decorator runs after the class is
  created, so it cannot help there. With the marker on the class the contract
  deploys on both.
- The page and the model can be mocked, so the run is the same every time. The
  mocks travel in the `sim_config` of the transaction:
  ```json
  { "validators": [ { "plugin_config": {
      "mock_web_response": { "nondet_web_request": { "<url>": { "status": 200, "body": "..." } } },
      "mock_response": { "response": { "<prompt pattern>": "<the answer>" } } } } ] }
  ```
- **The local node does not hand a transaction value to a contract.** It never
  credits a balance from a transaction, so `gl.message.value` is always 0 and
  the escrow records nothing. The money actually changing hands is proved on
  the studio network instead, where the balances are read.
- The local SDK re-encodes an address argument as `CalldataAddress`, which the
  runtime does not accept, so a call with an address argument fails there with
  "not calldata encodable address". The contract normalises the address it is
  given, which covers the shapes a runtime can hand it.

### The two networks answer in different shapes
- The studio network calls the transaction state `status_name`, the local one
  calls it `status`. `receiptStatus()` reads both.
- The local network may leave the leader receipt entry unmarked, so the entry
  is found by its mark, or taken as the only one there is.
- The studio network sends the error text as it is, the local one sends it
  base64 encoded. The client decodes it, because a person has to be able to
  read it.
- The studio network allows 500 requests an hour, then answers with
  "Rate limit exceeded". A long test run can hit it.

### Checking the interface against the contract
`verify:schema` reads the schema out of the contract with `genvm-lint` and
compares it with what the interface expects, which is in
`frontend/src/lib/genlayer/contract.ts`. A method that is added, renamed or
changed fails the check instead of failing at runtime.

`verify:client` pins the differences between the two networks, so a change in
one does not quietly break the other.


## Frontend (Next.js, in `frontend/`)
- **Stack**: Next.js 16 App Router, React 19, Tailwind v4, shadcn (base-ui), TypeScript, viem.
- **Pages**: `/` overview, `/notarize` the three step flow, `/records` the register, `/how-it-works` the mechanics.
- **Design**: three faces, three voices. Instrument Serif for anything the record says, Inter Tight for the interface, IBM Plex Mono for anything that is a measurement. One saturated colour, the wax red of a notary seal. The signature element is the seal: the ring fills as the validators agree and the wax red only appears once the record is attested.
- **Read path**: `gen_call` over plain `fetch`, no wallet needed.
- **Write path**: an EVM transaction to the consensus main contract, signed by the wallet.
- **Verifications** (run `npm run verify` in `frontend/`):
  - `verify:calldata` — the TypeScript calldata codec against the bytes the Python SDK produces.
  - `verify:write` — the transaction data the wallet signs, against the Python SDK.
  - `verify:wallet` — wallet detection, including MetaMask and Rabby installed together.
  - `verify:wallet-ui` — a real browser with both wallets faked, checking that only the picked wallet is asked for permission.
  - `verify:read` — a read against the live contract.

### How GenLayer calls work from a browser
- GenLayer does **not** use the EVM ABI for contract calls. It has its own compact encoding, and the arguments travel inside an RLP list. `src/lib/genlayer/calldata.ts` and `src/lib/genlayer/rlp.ts` are a faithful port, checked byte for byte against the Python SDK.
- The encoding puts the type and the length in **one** uleb128 value. Adding a separate length byte silently changes every byte after it.
- An address argument has to be encoded as an address, not as a string. The encoder only emits a real address for an `Address` instance, so use `address("0x...")` from `src/lib/genlayer/calldata.ts`. A hex string becomes a plain string, and the contract then traps with `exit_code 1`.
- **Reads** are `gen_call` with `{ type: "read", to, from, data, transaction_hash_variant }`. Use `latest-final`, because `latest-nonfinal` returns the state before the last settled transaction.
- **Writes** are sent to the consensus main contract, not to the intelligent contract. The data is `addTransaction(address,address,uint256,uint256,bytes,uint256)` with the RLP wrapped calldata inside, and the value is attached to that call.
- The lifecycle status is not the verdict. Read `execution_result` from `consensus_data.leader_receipt`, and take the payload from the leader entry. `src/lib/genlayer/client.ts` does this in `readExecution`.
- The studio host returns 502 now and then. Retry the receipt wait and the read.

### Wallet connection
- MetaMask and Rabby both inject into `window.ethereum`, and when both are installed they fight over it. `src/lib/wallet.ts` finds every injected provider, names them, and lets the person pick. `eth_requestAccounts` is only ever called on the provider they picked, so only one popup can appear.
- **Rabby replaces `window.ethereum` with its own provider**, which hides MetaMask from anything that only reads the live global. That is why an early capture matters: the inline script in the document head (`EARLY_WALLET_CAPTURE`) keeps hold of every provider it can see, and the detection reads the live global, the `providers` array and that capture together.
- The capture runs in the body of the layout, as early as the browser allows. It polls for a short while, because wallets inject at their own pace.
- Deduplication is by kind, not only by identity, because a wallet can be reachable through a wrapper object and through the array it keeps. A wrapper and the provider it wraps would otherwise show up twice.
- `eth_accounts` is used for a silent session restore, because it never opens a popup.
- A returning visitor is matched to the wallet they used last by an id in local storage, so a provider list that changes order does not break the session.
- The GenLayer network is chain 61999. Switching uses `wallet_switchEthereumChain`, and adds the network when the wallet does not know it yet.
- `verify-wallet-ui.ts` drives a real browser through both situations: both wallets published, and Rabby taking the global over. Both have to list both wallets and ask only the picked one for permission.
