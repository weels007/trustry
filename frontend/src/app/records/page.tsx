"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleAlert, Loader2, Search } from "lucide-react";

import { ConsensusPanel } from "@/components/trustry/consensus-panel";
import { STUDIONET, TRUSTRY_CONTRACT } from "@/lib/genlayer/chain";
import { readContract } from "@/lib/genlayer/client";
import { type FrontendDetails } from "@/lib/trustry";
import { cn } from "@/lib/utils";

export default function RecordsPage() {
  const [ids, setIds] = useState<string[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<{ id: string; record: FrontendDetails } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await readContract<string[]>(
          STUDIONET,
          TRUSTRY_CONTRACT,
          "get_all_record_ids",
        );
        if (cancelled) return;
        setIds(result);
        setSelected((current) => current ?? result[0] ?? null);
      } catch (caught) {
        if (cancelled) return;
        setError(
          caught instanceof Error
            ? caught.message
            : "The register could not be read right now.",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    void (async () => {
      try {
        const result = await readContract<FrontendDetails>(
          STUDIONET,
          TRUSTRY_CONTRACT,
          "get_frontend_details",
          [selected],
        );
        if (!cancelled) setLoaded({ id: selected, record: result });
      } catch {
        if (!cancelled) setLoaded(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected]);

  // Only show a record once the one on screen is the one that was asked for.
  const details = loaded && loaded.id === selected ? loaded.record : null;

  const filtered = useMemo(() => {
    if (!ids) return [];
    const needle = query.trim().toLowerCase();
    if (!needle) return ids;
    return ids.filter((id) => id.toLowerCase().includes(needle));
  }, [ids, query]);

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <p className="label flex items-center gap-3">
          <span className="h-px w-8 bg-seal" />
          The register
        </p>
        <h1 className="mt-5 font-display text-5xl leading-[1.05] text-ink">
          Every record, in the open.
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-soft">
          Nothing here is private and nothing here can be edited after the
          fact. Pick a record to see the page it came from, the exact words
          that carried the proof, and where its deposit ended up.
        </p>

        {error && (
          <div className="mt-8 flex items-start gap-3 rounded-md border border-seal/40 bg-seal/10 p-4">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-seal" strokeWidth={1.4} />
            <p className="text-sm leading-relaxed text-ink">{error}</p>
          </div>
        )}

        <div className="mt-12 grid gap-10 lg:grid-cols-[320px_1fr]">
          <div>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted"
                strokeWidth={1.5}
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Filter by reference"
                className="w-full rounded-md border border-input bg-night/60 py-2.5 pl-9 pr-3 font-mono text-xs text-ink outline-none transition-colors placeholder:text-muted/60 focus:border-ink/25"
              />
            </div>

            {loading ? (
              <div className="mt-6 flex items-center gap-2 text-xs text-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
                Reading the register
              </div>
            ) : (
              <ul className="mt-4 max-h-[60vh] space-y-px overflow-y-auto border border-line">
                {filtered.length === 0 && (
                  <li className="bg-night p-5 text-sm text-muted">
                    {ids && ids.length > 0
                      ? "No record matches that reference."
                      : "No record has been made yet."}
                  </li>
                )}
                {filtered.map((id) => (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => setSelected(id)}
                      className={cn(
                        "w-full border-l-2 px-4 py-3 text-left transition-colors",
                        selected === id
                          ? "border-seal bg-seal/[0.07]"
                          : "border-transparent hover:bg-ink/[0.03]",
                      )}
                    >
                      <span className="block font-mono text-[11px] text-ink">
                        {id}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            {details ? (
              <ConsensusPanel details={details} />
            ) : (
              <div className="rounded-lg border border-line bg-panel/40 p-8 text-sm text-muted">
                {loading ? "Reading the record." : "Pick a record to read it."}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
