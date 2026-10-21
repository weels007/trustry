# Trustry — frontend

The interface for the Trustry AI notary. Next.js 16, React 19, Tailwind v4, shadcn, TypeScript.

## Running it

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
npm run lint
```

## The verification suite

The browser has to talk to GenLayer in its own way, and the encoding is easy to
get subtly wrong. Every part of it is checked against the Python SDK.

```bash
npm run verify            # all of them
npm run verify:calldata   # the calldata codec, byte for byte
npm run verify:write      # the transaction the wallet signs, byte for byte
npm run verify:wallet     # wallet detection, MetaMask and Rabby together
npm run verify:wallet-ui  # a real browser, both wallets faked
npm run verify:read       # a read against the live contract
npm run shots             # screenshots of every page, desktop and phone
```

The ground truth lives in `../calldata_ground_truth.json` and
`../write_ground_truth.json`, produced by the Python scripts next to them.

`verify:wallet-ui` covers both situations that matter: both wallets publishing
themselves, and Rabby arriving later and replacing `window.ethereum`, which is
what hides MetaMask in a real browser.

## How the pages are put together

```
src/
  app/
    page.tsx              the overview
    notarize/page.tsx     the three step flow
    records/page.tsx      the register
    how-it-works/page.tsx the mechanics
    error.tsx             the error boundary
    not-found.tsx
  components/
    trustry/
      wallet-connect.tsx  the wallet picker
      consensus-panel.tsx what the network knew about a record
      seal.tsx            the seal, which shows the state
      site-header.tsx
      site-footer.tsx
      studio-bar.tsx      live numbers from the contract
    ui/
      gateway-flow.tsx    the converging validators
  hooks/
    use-wallet.tsx        the wallet state
  lib/
    genlayer/
      calldata.ts         the GenLayer call encoding
      rlp.ts              the RLP wrapper
      client.ts           reads and writes
      chain.ts            the studio network settings
    wallet.ts             wallet discovery
    trustry.ts            the shape of a record
```

## Two things worth knowing

**GenLayer does not use the EVM ABI for contract calls.** It has its own compact
encoding, and the arguments travel inside an RLP list. `lib/genlayer/calldata.ts`
and `lib/genlayer/rlp.ts` are a faithful port of it.

**A write goes to the consensus contract, not the intelligent contract.** The
data is `addTransaction(...)` with the RLP wrapped call inside, and the value
travels with it.

## Finding every wallet

Rabby replaces `window.ethereum` with its own provider, so a wallet that was
there first disappears from the page. `EARLY_WALLET_CAPTURE` in `lib/wallet.ts`
is a small script that goes into the document head and keeps hold of every
provider it can see. The detection then reads the live global, the `providers`
array and that capture together, and the person picks from the list. Only the
picked provider is ever asked for permission, so nothing competes for attention.
