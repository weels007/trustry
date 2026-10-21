"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  detectWallets,
  ensureChain,
  readAccounts,
  requestAccounts,
  WalletError,
  type DetectedWallet,
} from "@/lib/wallet";
import { STUDIONET } from "@/lib/genlayer/chain";

const STORAGE_KEY = "trustry.wallet";

type WalletState = {
  wallets: DetectedWallet[];
  wallet: DetectedWallet | null;
  address: `0x${string}` | null;
  chainId: number | null;
  isCorrectNetwork: boolean;
  isConnecting: boolean;
  error: string | null;
  connect: (wallet: DetectedWallet) => Promise<void>;
  disconnect: () => void;
  clearError: () => void;
  switchNetwork: () => Promise<void>;
};

const WalletContext = createContext<WalletState | null>(null);

function readChainId(provider: DetectedWallet["provider"]): Promise<number | null> {
  return provider
    .request({ method: "eth_chainId" })
    .then((value) => Number.parseInt(String(value), 16))
    .catch(() => null);
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallets, setWallets] = useState<DetectedWallet[]>([]);
  const [wallet, setWallet] = useState<DetectedWallet | null>(null);
  const [address, setAddress] = useState<`0x${string}` | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Wallets can inject themselves after the page has loaded, so look again
  // a couple of times before giving up.
  useEffect(() => {
    const refresh = () => setWallets(detectWallets());
    refresh();
    const timers = [
      window.setTimeout(refresh, 400),
      window.setTimeout(refresh, 1600),
      window.setTimeout(refresh, 3200),
    ];
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, []);

  // Bring back a session the browser already had. `eth_accounts` never opens
  // a popup, so this is silent.
  useEffect(() => {
    if (!wallets.length || wallet) return;
    const storedId = window.localStorage.getItem(STORAGE_KEY);
    if (!storedId) return;
    const match = wallets.find((candidate) => candidate.id === storedId);
    if (!match) return;

    let cancelled = false;
    void (async () => {
      const accounts = await readAccounts(match.provider);
      if (cancelled || accounts.length === 0) return;
      setWallet(match);
      setAddress(accounts[0] as `0x${string}`);
      setChainId(await readChainId(match.provider));
    })();

    return () => {
      cancelled = true;
    };
  }, [wallets, wallet]);

  // Follow the wallet when the person switches account or network.
  useEffect(() => {
    if (!wallet) return;

    const provider = wallet.provider;
    const onAccountsChanged = (...args: never[]) => {
      const list = args[0] as unknown as string[] | undefined;
      if (!list || list.length === 0) {
        setAddress(null);
        return;
      }
      setAddress(list[0] as `0x${string}`);
    };
    const onChainChanged = (...args: never[]) => {
      setChainId(Number.parseInt(String(args[0]), 16));
    };
    const onDisconnect = () => {
      setAddress(null);
      setChainId(null);
    };

    provider.on?.("accountsChanged", onAccountsChanged);
    provider.on?.("chainChanged", onChainChanged);
    provider.on?.("disconnect", onDisconnect);

    return () => {
      provider.removeListener?.("accountsChanged", onAccountsChanged);
      provider.removeListener?.("chainChanged", onChainChanged);
      provider.removeListener?.("disconnect", onDisconnect);
    };
  }, [wallet]);

  const connect = useCallback(async (chosen: DetectedWallet) => {
    setIsConnecting(true);
    setError(null);
    try {
      // Only the chosen wallet is asked, so only one popup can appear.
      const account = await requestAccounts(chosen.provider);
      window.localStorage.setItem(STORAGE_KEY, chosen.id);

      setWallet(chosen);
      setAddress(account);
      setChainId(await readChainId(chosen.provider));
    } catch (connectError) {
      setError(
        connectError instanceof WalletError
          ? connectError.message
          : "The wallet could not be connected.",
      );
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const switchNetwork = useCallback(async () => {
    if (!wallet) return;
    setError(null);
    try {
      await ensureChain(wallet.provider);
      setChainId(await readChainId(wallet.provider));
    } catch (switchError) {
      setError(
        switchError instanceof WalletError
          ? switchError.message
          : "The wallet could not move to the GenLayer network.",
      );
    }
  }, [wallet]);

  const disconnect = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    setWallet(null);
    setAddress(null);
    setChainId(null);
    setError(null);
  }, []);

  const value = useMemo<WalletState>(
    () => ({
      wallets,
      wallet,
      address,
      chainId,
      isCorrectNetwork: chainId === STUDIONET.id,
      isConnecting,
      error,
      connect,
      disconnect,
      clearError: () => setError(null),
      switchNetwork,
    }),
    [wallets, wallet, address, chainId, isConnecting, error, connect, disconnect, switchNetwork],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletState {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet has to be used inside a WalletProvider");
  }
  return context;
}
