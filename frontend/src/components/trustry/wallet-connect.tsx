"use client";

import { useState } from "react";
import { ChevronDown, Loader2, TriangleAlert, Wallet } from "lucide-react";

import { useWallet } from "@/hooks/use-wallet";
import { shortenAddress, type WalletKind } from "@/lib/wallet";
import { STUDIONET } from "@/lib/genlayer/chain";
import { cn } from "@/lib/utils";

/** A small geometric mark so each wallet is recognisable without logos. */
function WalletMark({ kind }: { kind: WalletKind }) {
  const common = "h-8 w-8 shrink-0";
  if (kind === "metamask") {
    return (
      <svg viewBox="0 0 32 32" className={common} aria-hidden="true">
        <path
          d="M16 3 4 10v12l12 7 12-7V10L16 3Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.1"
          opacity="0.55"
        />
        <path d="M10 15h12M16 11v8" stroke="currentColor" strokeWidth="1.1" />
      </svg>
    );
  }
  if (kind === "rabby") {
    return (
      <svg viewBox="0 0 32 32" className={common} aria-hidden="true">
        <rect
          x="5.5"
          y="8.5"
          width="21"
          height="15"
          rx="4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.1"
          opacity="0.55"
        />
        <path d="M20 14v4M18 16h4" stroke="currentColor" strokeWidth="1.1" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 32 32" className={common} aria-hidden="true">
      <circle
        cx="16"
        cy="16"
        r="11"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
        opacity="0.55"
      />
      <path d="M16 9v14" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}

export function WalletConnect({ className }: { className?: string }) {
  const {
    wallets,
    wallet,
    address,
    isCorrectNetwork,
    isConnecting,
    error,
    connect,
    disconnect,
    clearError,
    switchNetwork,
  } = useWallet();
  const [open, setOpen] = useState(false);

  if (!wallets.length) {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-2 rounded-md border border-dashed border-line px-3 py-2 text-xs text-muted",
          className,
        )}
      >
        <Wallet className="h-3.5 w-3.5" strokeWidth={1.4} />
        <span>No EVM wallet found</span>
      </div>
    );
  }

  if (address && wallet) {
    return (
      <div className={cn("inline-flex items-center gap-2", className)}>
        {!isCorrectNetwork && (
          <button
            type="button"
            onClick={() => void switchNetwork()}
            className="inline-flex items-center gap-1.5 rounded-md border border-seal/40 bg-seal/10 px-2.5 py-1.5 text-[11px] uppercase tracking-[0.18em] text-seal transition-colors hover:bg-seal/20"
          >
            <TriangleAlert className="h-3 w-3" strokeWidth={1.5} />
            Switch to {STUDIONET.shortName}
          </button>
        )}
        <button
          type="button"
          onClick={disconnect}
          title="Disconnect"
          className="group inline-flex items-center gap-2.5 rounded-md border border-line bg-surface/80 px-3 py-2 font-mono text-xs text-ink transition-colors hover:border-ink/20"
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              isCorrectNetwork ? "bg-verified" : "bg-muted",
            )}
          />
          <span className="text-ink">{shortenAddress(address)}</span>
          <span className="text-muted group-hover:text-line">
            {wallet.name}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        disabled={isConnecting}
        className="inline-flex items-center gap-2 rounded-md border border-line bg-surface/80 px-3 py-2 text-xs uppercase tracking-[0.18em] text-ink transition-colors hover:border-ink/25 disabled:opacity-60"
      >
        {isConnecting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.4} />
        ) : (
          <Wallet className="h-3.5 w-3.5" strokeWidth={1.4} />
        )}
        Connect
        <ChevronDown className="h-3 w-3" strokeWidth={1.6} />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-lg border border-line bg-panel/95 shadow-2xl backdrop-blur-xl">
            <p className="border-b border-line px-4 py-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
              Choose a wallet
            </p>
            <ul className="p-1.5">
              {wallets.map((candidate) => (
                <li key={candidate.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      void connect(candidate);
                    }}
                    className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-ink/[0.04]"
                  >
                    <WalletMark kind={candidate.kind} />
                    <span className="flex-1 text-sm text-ink">{candidate.name}</span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                      Connect
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="border-t border-line px-4 py-3 text-[11px] leading-relaxed text-muted">
              Only the wallet you pick will ask for permission, so nothing
              competes for your attention.
            </p>
          </div>
        </>
      )}

      {error && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-lg border border-seal/40 bg-panel/95 p-3 shadow-2xl backdrop-blur-xl">
          <div className="flex items-start gap-2">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-seal" strokeWidth={1.5} />
            <p className="flex-1 text-xs leading-relaxed text-ink">{error}</p>
          </div>
          <button
            type="button"
            onClick={clearError}
            className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
