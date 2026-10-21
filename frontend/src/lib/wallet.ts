/**
 * Wallet discovery and connection.
 *
 * MetaMask and Rabby both inject into `window.ethereum`. When both are
 * installed they fight over it, and every wallet that calls
 * `eth_requestAccounts` on its own opens a popup of its own. To avoid that:
 *
 *   - every injected provider is found and listed, so the person chooses
 *   - `eth_requestAccounts` is only ever called on the provider they picked
 *   - `eth_accounts` is used first, because it never opens a popup
 */

import { toHex } from "viem";

import { STUDIONET } from "./genlayer/chain";

export type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: never[]) => void) => void;
  removeListener?: (event: string, handler: (...args: never[]) => void) => void;
  isMetaMask?: boolean;
  isRabby?: boolean;
  isCoinbaseWallet?: boolean;
  isBraveWallet?: boolean;
  isTrust?: boolean;
  isFrame?: boolean;
};

type InjectedWindow = Window & {
  ethereum?: Eip1193Provider & { providers?: Eip1193Provider[] };
};

type CapturedWindow = Window & {
  /**
   * Providers seen before a later wallet replaced `window.ethereum`. The
   * inline script in the document head fills this in.
   */
  __trustryProviders?: Eip1193Provider[];
};

/**
 * The script that goes in the document head. It runs as early as the browser
 * allows and keeps hold of every provider it can see, so a wallet that
 * arrives later cannot hide the ones that were already there.
 */
export const EARLY_WALLET_CAPTURE = `(function(){
  try {
    var seen = [];
    function collect() {
      var injected = window.ethereum;
      if (!injected) return;
      if (injected.providers && injected.providers.length) {
        for (var i = 0; i < injected.providers.length; i++) {
          if (seen.indexOf(injected.providers[i]) === -1) seen.push(injected.providers[i]);
        }
      }
      if (seen.indexOf(injected) === -1) seen.push(injected);
      window.__trustryProviders = seen;
    }
    collect();
    var tries = 0;
    var timer = setInterval(function () {
      collect();
      if (++tries > 60) clearInterval(timer);
    }, 100);
  } catch (error) {}
})();`;

export type WalletKind = "metamask" | "rabby" | "coinbase" | "brave" | "trust" | "unknown";

export type DetectedWallet = {
  /** Stable key, so the choice survives a reload. */
  id: string;
  name: string;
  kind: WalletKind;
  provider: Eip1193Provider;
};

function identify(provider: Eip1193Provider): { kind: WalletKind; name: string } {
  if (provider.isRabby) return { kind: "rabby", name: "Rabby" };
  if (provider.isCoinbaseWallet) return { kind: "coinbase", name: "Coinbase Wallet" };
  if (provider.isBraveWallet) return { kind: "brave", name: "Brave Wallet" };
  if (provider.isTrust) return { kind: "trust", name: "Trust Wallet" };
  if (provider.isMetaMask) return { kind: "metamask", name: "MetaMask" };
  return { kind: "unknown", name: "Browser Wallet" };
}

/**
 * Find every wallet that injected itself into the page.
 *
 * Rabby replaces `window.ethereum` with its own provider when it loads, which
 * hides MetaMask from anything that only looks at the live object. The
 * `providers` array and the early capture in the document head both keep a
 * reference to the provider that was there first, so all of them are gathered
 * here and the person is offered the choice.
 */
export function detectWallets(): DetectedWallet[] {
  if (typeof window === "undefined") return [];

  const live = (window as InjectedWindow).ethereum;
  const captured = (window as CapturedWindow).__trustryProviders ?? [];

  const candidates: Eip1193Provider[] = [];

  const push = (provider: Eip1193Provider | undefined) => {
    if (!provider) return;
    if (typeof provider.request !== "function") return;
    if (candidates.includes(provider)) return;
    candidates.push(provider);
  };

  // Whatever the page can see right now.
  push(live);
  if (live && Array.isArray(live.providers)) {
    for (const provider of live.providers) push(provider);
  }

  // Whatever was there before a later wallet replaced it.
  for (const provider of captured) push(provider);

  const seen = new Set<Eip1193Provider>();
  const takenKinds = new Set<WalletKind>();
  const wallets: DetectedWallet[] = [];

  for (const provider of candidates) {
    if (seen.has(provider)) continue;
    seen.add(provider);
    const { kind, name } = identify(provider);

    // A wallet can be reachable twice, for instance through a wrapper object
    // and through the array it keeps. One of each kind is enough.
    if (kind !== "unknown" && takenKinds.has(kind)) continue;
    takenKinds.add(kind);

    const label =
      kind === "unknown" && wallets.some((wallet) => wallet.kind === "unknown")
        ? `Browser Wallet ${wallets.filter((wallet) => wallet.kind === "unknown").length + 1}`
        : name;

    wallets.push({ id: `${kind}-${wallets.length}`, name: label, kind, provider });
  }

  return wallets;
}

export type WalletConnection = {
  address: `0x${string}`;
  chainId: number;
  wallet: DetectedWallet;
};

export class WalletError extends Error {
  readonly code: number | undefined;

  constructor(message: string, code?: number) {
    super(message);
    this.name = "WalletError";
    this.code = code;
  }
}

/** Read the accounts a wallet already shares. This never opens a popup. */
export async function readAccounts(provider: Eip1193Provider): Promise<string[]> {
  try {
    const accounts = await provider.request({ method: "eth_accounts" });
    return Array.isArray(accounts) ? (accounts as string[]) : [];
  } catch {
    return [];
  }
}

/** Ask the wallet to share an account. This is the only call that opens a popup. */
export async function requestAccounts(
  provider: Eip1193Provider,
): Promise<`0x${string}`> {
  let accounts: unknown;
  try {
    accounts = await provider.request({ method: "eth_requestAccounts" });
  } catch (error) {
    const code = (error as { code?: number }).code;
    if (code === 4001) {
      throw new WalletError("The connection request was declined.", code);
    }
    throw new WalletError(
      error instanceof Error ? error.message : "The wallet refused the connection.",
      code,
    );
  }

  const list = Array.isArray(accounts) ? (accounts as string[]) : [];
  if (list.length === 0) {
    throw new WalletError("The wallet did not share an account.");
  }
  return list[0] as `0x${string}`;
}

export function currentChainId(provider: Eip1193Provider): Promise<number> {
  return provider
    .request({ method: "eth_chainId" })
    .then((value) => Number.parseInt(String(value), 16));
}

/** Move the wallet onto the GenLayer network, adding it if it is missing. */
export async function ensureChain(provider: Eip1193Provider): Promise<void> {
  const chainIdHex = toHex(STUDIONET.id);
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chainIdHex }],
    });
    return;
  } catch (error) {
    const code = (error as { code?: number }).code;
    // 4902 means the chain is not known to the wallet yet.
    if (code !== 4902) {
      if (code === 4001) {
        throw new WalletError("The network switch was declined.", code);
      }
      throw new WalletError(
        error instanceof Error ? error.message : "Could not switch the wallet network.",
        code,
      );
    }
  }

  try {
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: chainIdHex,
          chainName: STUDIONET.name,
          nativeCurrency: STUDIONET.currency,
          rpcUrls: [STUDIONET.rpcUrl],
          blockExplorerUrls: [STUDIONET.explorerUrl],
        },
      ],
    });
  } catch (error) {
    const code = (error as { code?: number }).code;
    if (code === 4001) {
      throw new WalletError("Adding the network was declined.", code);
    }
    throw new WalletError(
      error instanceof Error ? error.message : "Could not add the GenLayer network.",
      code,
    );
  }
}

/** Shorten an address for display without losing its recognisable shape. */
export function shortenAddress(address: string, size = 4): string {
  if (address.length <= size * 2 + 2) return address;
  return `${address.slice(0, size + 2)}...${address.slice(-size)}`;
}
