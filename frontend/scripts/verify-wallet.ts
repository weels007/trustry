/**
 * Wallet detection tests.
 *
 * The point of these is the case where MetaMask and Rabby are both
 * installed: they both want to be `window.ethereum`, and only one of them
 * may ever be asked for permission.
 *
 * Run with: npx tsx scripts/verify-wallet.ts
 */

import { detectWallets, type Eip1193Provider } from "../src/lib/wallet";

type FakeProvider = Eip1193Provider & { isMetaMask?: boolean; isRabby?: boolean };

function fakeProvider(name: string, flags: Partial<FakeProvider> = {}): FakeProvider {
  const provider: FakeProvider = {
    ...flags,
    request: async () => {
      throw new Error(`${name} should not be called in this test`);
    },
  };
  return provider;
}

let failures = 0;

function check(name: string, condition: boolean, detail = "") {
  if (condition) {
    console.log(`  OK    ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${name}  ${detail}`);
  }
}

const globalScope = globalThis as { window?: unknown };

// --- only MetaMask ---
{
  const metamask = fakeProvider("metamask", { isMetaMask: true });
  (globalScope as { window: unknown }).window = { ethereum: metamask };
  const wallets = detectWallets();
  check("one wallet is found when only MetaMask is installed", wallets.length === 1, `got ${wallets.length}`);
  check("it is named MetaMask", wallets[0]?.name === "MetaMask", wallets[0]?.name);
  check("it is the metamask kind", wallets[0]?.kind === "metamask", wallets[0]?.kind);
}

// --- only Rabby ---
{
  const rabby = fakeProvider("rabby", { isRabby: true });
  (globalScope as { window: unknown }).window = { ethereum: rabby };
  const wallets = detectWallets();
  check("one wallet is found when only Rabby is installed", wallets.length === 1, `got ${wallets.length}`);
  check("it is named Rabby", wallets[0]?.name === "Rabby", wallets[0]?.name);
}

// --- both installed, the case that makes wallets fight ---
{
  const metamask = fakeProvider("metamask", { isMetaMask: true });
  const rabby = fakeProvider("rabby", { isRabby: true, isMetaMask: true });
  // A real wallet keeps its own array on the provider it publishes.
  (metamask as { providers?: unknown[] }).providers = [metamask, rabby];
  (globalScope as { window: unknown }).window = { ethereum: metamask };
  const wallets = detectWallets();
  check("both wallets are found when both are installed", wallets.length === 2, `got ${wallets.length}`);
  check(
    "MetaMask is recognised as MetaMask, not as Rabby",
    wallets.some((wallet) => wallet.kind === "metamask"),
    JSON.stringify(wallets.map((wallet) => wallet.kind)),
  );
  check(
    "Rabby is recognised as Rabby even though it also sets isMetaMask",
    wallets.some((wallet) => wallet.kind === "rabby"),
    JSON.stringify(wallets.map((wallet) => wallet.kind)),
  );
  check(
    "each wallet gets its own id, so the choice is stable",
    new Set(wallets.map((wallet) => wallet.id)).size === wallets.length,
    JSON.stringify(wallets.map((wallet) => wallet.id)),
  );
  check(
    "the two wallets are separate provider objects",
    wallets[0]?.provider !== wallets[1]?.provider,
  );
}

// --- the same provider listed twice is only offered once ---
{
  const metamask = fakeProvider("metamask", { isMetaMask: true });
  (metamask as { providers?: unknown[] }).providers = [metamask, metamask];
  (globalScope as { window: unknown }).window = { ethereum: metamask };
  const wallets = detectWallets();
  check("a provider listed twice is only offered once", wallets.length === 1, `got ${wallets.length}`);
}

// --- a wallet that wraps another is not offered twice ---
{
  const metamask = fakeProvider("metamask", { isMetaMask: true });
  const wrapper = { ...metamask, providers: [metamask] };
  (globalScope as { window: unknown }).window = { ethereum: wrapper };
  const wallets = detectWallets();
  check("a wallet that wraps another is offered once", wallets.length === 1, `got ${wallets.length}`);
}

// --- no wallet at all ---
{
  (globalScope as { window: unknown }).window = {};
  const wallets = detectWallets();
  check("no wallet is found when nothing is injected", wallets.length === 0, `got ${wallets.length}`);
}

// --- Rabby replaces window.ethereum, which hides MetaMask ---
{
  const metamask = fakeProvider("metamask", { isMetaMask: true });
  const rabby = fakeProvider("rabby", { isRabby: true, isMetaMask: true });
  // The early capture saw MetaMask before Rabby took over the global.
  (globalScope as { window: unknown }).window = {
    ethereum: rabby,
    __trustryProviders: [metamask],
  };
  const wallets = detectWallets();
  check(
    "a wallet that was hidden by a later one is still found",
    wallets.length === 2,
    `got ${wallets.length}: ${wallets.map((wallet) => wallet.name).join(", ")}`,
  );
  check(
    "the hidden wallet keeps its own identity",
    wallets.some((wallet) => wallet.kind === "metamask"),
    JSON.stringify(wallets.map((wallet) => wallet.kind)),
  );
  check(
    "the wallet that took over the global is still found",
    wallets.some((wallet) => wallet.kind === "rabby"),
    JSON.stringify(wallets.map((wallet) => wallet.kind)),
  );
}

// --- an unknown wallet is still usable ---
{
  const unknown = fakeProvider("unknown");
  (globalScope as { window: unknown }).window = { ethereum: unknown };
  const wallets = detectWallets();
  check("an unknown provider is still offered", wallets.length === 1, `got ${wallets.length}`);
  check("it is called a browser wallet", wallets[0]?.name === "Browser Wallet", wallets[0]?.name);
}

console.log(
  failures === 0
    ? "\nwallet detection behaves the way it should"
    : `\n${failures} check(s) failed`,
);
process.exit(failures === 0 ? 0 : 1);
