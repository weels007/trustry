# Trustry

An AI notary on GenLayer. It attests claims about the real world: independent AI validators
fetch the page you point at, judge it on their own, and agree on a record that anyone can
check afterwards.

The repository holds the intelligent contract and the interface that goes with it.

| | |
|---|---|
| Contract (studio network) | `0x18207BFEF02C1e00Dd2BA6D746FbbeB84A22C1A4` |
| Network | Genlayer Studio Network, chain 61999 |
| Contract methods | 15, of which 9 are reads |
| Direct tests | 54 passed |
| Studio network tests | 40 passed |
| Escrow tests | 30 passed |
| Local node integration | 24 passed |
| Interface checks | 6 suites, all passed |

---

## What it does

A claim is opened against a source page. Validators read the page independently and decide
whether it actually reports the event. When they agree, a record is written on chain with the
exact words from the page that carried the proof.

Three deterministic layers sit underneath the model's judgement, so the model can be wrong
about meaning but not about facts:

1. **The wording has to be on the page.** The claim carries the phrasing it requires, and
   that phrasing has to occur in the fetched text. A page cannot talk its way into proving
   something it does not contain.
2. **The title has to be a phrase from the page.** A reported headline that appears nowhere
   in the source is dropped.
3. **The proof has to be quotable.** Every validator hands back the sentence it relied on,
   and the contract checks that sentence against the page. Evidence that was made up cannot
   seal a record.

The model still does the judging. That semantic call is the whole point of GenLayer, and it is
made separately by each validator, each on its own copy of the page.

---

## The contract

```
open_case(event_id, description, evidence_url, expected_event_title)   # not payable
fund_escrow(event_id)                                                  # payable, never rejects
notarize(event_id)                                                     # consensus, not payable
appeal_notarization(event_id)                                          # judged again from scratch
release_escrow(event_id, recipient) / refund_escrow(event_id)           # moves the GEN
```

Reads: `get_record`, `get_frontend_details`, `get_all_record_ids`, `get_escrow_status`,
`get_escrow_pool`, `get_event_count`, `get_total_escrow_held`, `get_contract_balance`,
`is_trusted_domain`.

### The escrow cannot trap anyone's money

A transaction that fails is still credited with its value. The storage is rolled back, but the
GEN is not returned, so it would sit in the contract with no record to refund it from. That is
why funding is a transaction of its own and the risky step carries no value:

- `open_case` and `notarize` are not payable. They do the web fetch and the model call, they
  can fail, and they hold no funds.
- `fund_escrow` is the only payable method and it never rejects a funding that carries value.
  If the case does not exist yet, it records an orphan case owned by the funder, so the value
  is always recorded and `refund_escrow` can always return it.

The owner of the contract has no override over anybody's escrow. Only the depositor can move
the money. The owner may trigger a refund, but the funds always go back to the depositor.

The escrow status is tracked explicitly (`none`, `held`, `released`, `refunded`), so the same
money can never be released twice. `test_escrow_studionet.py` proves the movement by reading
the on-chain balance of the depositor, the recipient and the contract before and after every
step, and checks the invariant that the contract's balance equals the escrow it is holding.

### What a record holds

The claim, the source page, the sentence from that page that carried the proof, the verdict,
how the validators voted, where the deposit ended up, and how many times the case was judged
again. A verdict on its own is worth very little, so the reasoning is stored next to it.

---

## The interface

Next.js 16, React 19, Tailwind v4, shadcn, TypeScript, viem.

| Page | What it holds |
|---|---|
| `/` | The overview, with the convergence of the validators as the hero |
| `/notarize` | The three transaction flow, with the consensus panel |
| `/records` | The register, read straight from the contract |
| `/how-it-works` | How the consensus works and where it can go wrong |

The design reads like an archive of record. Three faces, three voices: Instrument Serif for
anything the record says, Inter Tight for the interface, IBM Plex Mono for anything that is a
measurement. One saturated colour, the wax red of a notary's seal. The seal is the element
that carries state: the ring fills as the validators agree, and the wax red only appears once
the record is attested.

### Talking to the contract

- **Reads** go through `gen_call` over plain `fetch`. No wallet is needed.
- **Writes** are an EVM transaction to the *consensus main contract*, which forwards the call
  to the intelligent contract and runs a consensus round.
- GenLayer does **not** use the EVM ABI for contract calls. It has its own compact encoding and
  the arguments travel inside an RLP list. `src/lib/genlayer/calldata.ts` and `rlp.ts` are a
  faithful port, checked **byte for byte** against the Python SDK.

### Connecting a wallet

MetaMask and Rabby both inject into `window.ethereum`, and when both are installed they fight
over it. Trustry finds every injected provider, offers a choice, and then asks only the wallet
that was picked for permission, so **two popups never compete**. `eth_accounts` restores a
session without opening anything at all.

Rabby also replaces `window.ethereum` with its own provider, which hides MetaMask from
anything that only reads the live global. An early capture in the document head keeps hold of
every provider it can see, and the detection reads the live global, the `providers` array and
that capture together.

---

## Running it

```bash
# The contract
genvm-lint check contracts/trustry.py
pytest tests/direct/ -v

# The interface
cd frontend
npm install
npm run dev
```

### Verification

```bash
cd frontend
npm run verify
```

| Command | What it checks |
|---|---|
| `verify:calldata` | The TypeScript calldata codec against the bytes the Python SDK produces |
| `verify:write` | The transaction data the wallet signs, against the Python SDK |
| `verify:wallet` | Wallet detection, including MetaMask and Rabby installed together |
| `verify:wallet-ui` | A real browser with both wallets faked, checking only the picked one is asked |
| `verify:client` | That the client reads the answers of both networks |
| `verify:schema` | The interface against the contract, using the GenVM linter's own schema |

The ground truth for the first two lives in `calldata_ground_truth.json` and
`write_ground_truth.json`, produced by the Python scripts beside them.

### Against a local node, without touching the studio network

`glsim` is a local GenLayer network. It runs the contract for real, with a real
consensus round, so the whole stack can be exercised with nothing going to the
public network.

```bash
python run_localnet_test.py
```

It starts a fresh node, deploys the contract to it, and then drives the whole
flow through the interface's own client: the calldata encoding, the
transaction to the consensus contract, the wait for the consensus round, and
the reads that come back. The page and the model are mocked, so every run is
the same.

Two things the local node cannot do, and where they are covered instead:
it does not hand a transaction value to a contract, so the escrow balance is
proved on the studio network, where the balances are actually read. And its
SDK re-encodes an address argument in a way the runtime does not take, so
calls with an address argument fail there.

### The studio network, end to end

```bash
python test_studionet.py        # every read and write method, real web and model calls
python test_escrow_studionet.py # the escrow, with on-chain balances
```

The studio network allows 500 requests an hour, so a long run can hit that
limit.

Two things are worth knowing about these runs. The verdict is the model's
opinion, and a real model does not answer the same way twice, so both tests
follow whichever answer came back: an attested case is released, an unattested
one is refunded, and the money has to move either way. And a page can only
certify one event, because the contract reserves it, so every run takes the
next free page out of `pages.py`. `refund_leftover.py` returns anything a run
that was cut short left behind.

---
## Deploying

### The interface to Vercel

Set **Root Directory = `frontend`** in the project settings. Vercel then builds
inside that directory, which is what the `vercel.json` there is written for.

Do not set the Root Directory to the repository root. Vercel would look for a
Next.js app in the root, where there is none, and the build would fail.

**No environment variables are required.** The interface reads the contract from
the browser through `gen_call` against the studio RPC, so there is no API key on
the server, and the studio RPC allows any origin.

They are available if the contract moves or a different node is wanted, in
`frontend/.env.example`:

| Variable | Default |
|---|---|
| `NEXT_PUBLIC_GENLAYER_RPC_URL` | `https://studio.genlayer.com/api` |
| `NEXT_PUBLIC_TRUSTRY_CONTRACT` | `0x18207BFEF02C1e00Dd2BA6D746FbbeB84A22C1A4` |
| `NEXT_PUBLIC_GENLAYER_EXPLORER_URL` | `https://explorer-studio.genlayer.com` |

### The contract to the studio network

```bash
python "D:\Genlayer-project\weels\wallet\deploy.py" --contract contracts/trustry.py --wallet tester1
```

The ordinary `genlayer` CLI cannot be used here: it reads the keystore password
with `inquirer`, which needs a real terminal, so it cannot be piped.

The wallets live outside this repository on purpose, and `.gitignore` blocks
`*.keystore.json`, `*.password` and `.env` as a second line of defence.

---

## Project layout

```
trustry/
  agent.md                    # the rules, and everything learned the hard way
  contracts/
    trustry.py                # the intelligent contract
  tests/
    direct/                   # fast, in memory
      test_ai_notary.py       # behaviour
      test_security_audit.py  # the protections, locked in
    integration/              # full consensus against a real network
  frontend/
    src/
      app/                    # the four pages
      components/trustry/     # wallet picker, consensus panel, the seal
      components/ui/          # the flow, and the shadcn parts
      hooks/use-wallet.tsx
      lib/genlayer/           # calldata, rlp, client, chain settings
      lib/wallet.ts           # wallet discovery
    scripts/                  # the verification suite
  test_studionet.py
  test_escrow_studionet.py
  gltest.config.yaml
  vercel.json
```

---

## Notes for anyone changing this

`agent.md` holds the rules and the findings. The short version:

- Read the GenLayer documentation at `https://docs.genlayer.com/` before changing a design.
- Pin a concrete GenVM runner version. `test` and `latest` are rejected by every network.
- Use `run_nondet_unsafe` with independent verification. `strict_eq` never works against a
  model or a live page.
- The type and the length share one uleb128 value in the calldata. A separate length byte
  changes every byte after it.
- An address argument has to be encoded as an address, not as a hex string. A string reaches
  the contract as a string and the contract then traps.
- `ACCEPTED` and `FINALIZED` are lifecycle states, not proof that the contract ran. Read
  `execution_result` out of the leader receipt.
- Read state only after the transaction is finalized, and with the `latest-final` variant.
- The studio host returns 502 now and then. Retry the receipt wait and the read.
