"use client";

import { useEffect, useState } from "react";

import { STUDIONET, TRUSTRY_CONTRACT } from "@/lib/genlayer/chain";
import { readContract } from "@/lib/genlayer/client";
import { formatGen } from "@/lib/trustry";

/**
 * A live strip of what the network is holding right now. It reads the
 * contract directly, with no wallet and no account.
 */
export function StudioBar() {
  const [records, setRecords] = useState<number | null>(null);
  const [held, setHeld] = useState<number | null>(null);
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [ids, heldValue, balanceValue] = await Promise.all([
          readContract<string[]>(STUDIONET, TRUSTRY_CONTRACT, "get_all_record_ids"),
          readContract<number>(STUDIONET, TRUSTRY_CONTRACT, "get_total_escrow_held"),
          readContract<number>(STUDIONET, TRUSTRY_CONTRACT, "get_contract_balance"),
        ]);
        if (cancelled) return;
        setRecords(ids.length);
        setHeld(heldValue);
        setBalance(balanceValue);
      } catch {
        if (cancelled) return;
        setRecords(null);
      }
    };

    void load();
    const timer = window.setInterval(load, 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div className="border-b border-line bg-panel/40">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-10 gap-y-3 px-5 py-4 sm:px-8">
        <span className="label">Studio network</span>
        <span className="font-mono text-xs text-ink-soft">
          {STUDIONET.id}
        </span>
        <span className="label">Records</span>
        <span className="font-mono text-xs text-ink-soft">
          {records === null ? "—" : records}
        </span>
        <span className="label">In escrow</span>
        <span className="font-mono text-xs text-ink-soft">
          {held === null ? "—" : `${formatGen(held)} GEN`}
        </span>
        <span className="label">Contract</span>
        <span className="font-mono text-xs text-ink-soft">
          {TRUSTRY_CONTRACT.slice(0, 8)}...{TRUSTRY_CONTRACT.slice(-4)}
        </span>
        <span className="label">Balance</span>
        <span className="font-mono text-xs text-ink-soft">
          {balance === null ? "—" : `${formatGen(balance)} GEN`}
        </span>
      </div>
    </div>
  );
}
