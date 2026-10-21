"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, CircleAlert, Loader2, Wallet } from "lucide-react";

import { ConsensusPanel } from "@/components/trustry/consensus-panel";
import { Seal } from "@/components/trustry/seal";
import { useWallet } from "@/hooks/use-wallet";
import {
  buildConsensusTransaction,
  readContract,
  readExecution,
  waitForReceipt,
  type ExecutionOutcome,
} from "@/lib/genlayer/client";
import { STUDIONET, TRUSTRY_CONTRACT } from "@/lib/genlayer/chain";
import type { FrontendDetails } from "@/lib/trustry";
import { cn } from "@/lib/utils";

type Stage = "open" | "fund" | "notarize";

const STAGE_ORDER: Stage[] = ["open", "fund", "notarize"];

const STAGE_COPY: Record<Stage, { title: string; body: string }> = {
  open: {
    title: "Open the case",
    body: "Name the claim and point at the page that carries it. The wording you require has to appear on that page, otherwise the record cannot be attested.",
  },
  fund: {
    title: "Fund the escrow",
    body: "Hold GEN against the claim while the validators read it. If the record comes back unattested, the deposit goes straight back to you.",
  },
  notarize: {
    title: "Let the validators read it",
    body: "Each validator fetches the page on its own and judges it against the claim. Their agreement is what seals the record.",
  },
};

function newEventId(): string {
  return `evt_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export default function NotarizePage() {
  const { address, wallet, isCorrectNetwork, switchNetwork } = useWallet();

  const [stage, setStage] = useState<Stage>("open");
  const [eventId, setEventId] = useState("");
  const [description, setDescription] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [requiredPhrase, setRequiredPhrase] = useState("");
  const [deposit, setDeposit] = useState("0.01");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<ExecutionOutcome | null>(null);
  const [details, setDetails] = useState<FrontendDetails | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const stageIndex = STAGE_ORDER.indexOf(stage);

  // The reference is made in the browser, when the person first reaches for
  // it, so nothing depends on the clock while the page is prerendered.
  const eventIdRef = useRef("");
  const ensureEventId = useCallback((): string => {
    if (!eventIdRef.current) {
      eventIdRef.current = newEventId();
      setEventId(eventIdRef.current);
    }
    return eventIdRef.current;
  }, []);
  const depositWei = useMemo(() => {
    const parsed = Number.parseFloat(deposit);
    if (!Number.isFinite(parsed) || parsed <= 0) return 0;
    return Math.round(parsed * 1e18);
  }, [deposit]);

  const send = useCallback(
    async (
      method: string,
      args: unknown[],
      value = 0n,
    ): Promise<{ hash: string; outcome: ExecutionOutcome }> => {
      if (!address || !wallet) throw new Error("Connect a wallet first.");
      const data = buildConsensusTransaction(
        STUDIONET,
        address,
        TRUSTRY_CONTRACT,
        method,
        args as never,
      );

      const hash = (await wallet.provider.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: address,
            to: STUDIONET.consensusMainContract,
            data,
            value: `0x${value.toString(16)}`,
          },
        ],
      })) as string;

      setTxHash(hash);
      const receipt = await waitForReceipt(STUDIONET, hash);
      return { hash, outcome: readExecution(receipt) };
    },
    [address, wallet],
  );

  const runOpen = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const id = ensureEventId();
      const { outcome: result } = await send("open_case", [
        id,
        description,
        evidenceUrl,
        requiredPhrase,
      ]);
      setOutcome(result);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setStage("fund");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The case could not be opened.");
    } finally {
      setBusy(false);
    }
  }, [description, ensureEventId, evidenceUrl, requiredPhrase, send]);

  const runFund = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const { outcome: result } = await send("fund_escrow", [eventId], BigInt(depositWei));
      setOutcome(result);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setStage("notarize");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The escrow could not be funded.");
    } finally {
      setBusy(false);
    }
  }, [depositWei, eventId, send]);

  const runNotarize = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const { outcome: result } = await send("notarize", [eventId]);
      setOutcome(result);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      const record = await readContract<FrontendDetails>(
        STUDIONET,
        TRUSTRY_CONTRACT,
        "get_frontend_details",
        [eventId],
      );
      setDetails(record);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "The case could not be notarized.",
      );
    } finally {
      setBusy(false);
    }
  }, [eventId, send]);

  const reset = useCallback(() => {
    setStage("open");
    setEventId(newEventId());
    setDescription("");
    setEvidenceUrl("");
    setRequiredPhrase("");
    setDeposit("0.01");
    setError(null);
    setOutcome(null);
    setDetails(null);
    setTxHash(null);
  }, []);

  useEffect(() => {
    if (!details) return;
    void readContract<FrontendDetails>(STUDIONET, TRUSTRY_CONTRACT, "get_frontend_details", [
      eventId,
    ]).then(setDetails);
  }, [details, eventId]);

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <div className="grid gap-14 lg:grid-cols-[1.15fr_0.85fr]">
          {/* The form. */}
          <div>
            <p className="label flex items-center gap-3">
              <span className="h-px w-8 bg-seal" />
              New record
            </p>
            <h1 className="mt-5 font-display text-5xl leading-[1.05] text-ink">
              Ask the network to
              <br />
              <em className="text-seal">confirm a claim.</em>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-soft">
              Three steps. Each one is a separate transaction, so you can stop
              at any point and take the deposit back.
            </p>

            {/* The steps. */}
            <ol className="mt-10 flex items-center gap-2">
              {STAGE_ORDER.map((item, index) => {
                const reached = index <= stageIndex;
                const current = index === stageIndex;
                return (
                  <li key={item} className="flex flex-1 items-center gap-2">
                    <div
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border font-mono text-[10px] transition-colors",
                        current
                          ? "border-seal/60 text-seal"
                          : reached
                            ? "border-line text-ink-soft"
                            : "border-line-soft text-muted",
                      )}
                    >
                      {index < stageIndex ? <Check className="h-3 w-3" strokeWidth={2} /> : index + 1}
                    </div>
                    {index < STAGE_ORDER.length - 1 && (
                      <div
                        className={cn(
                          "h-px flex-1",
                          index < stageIndex ? "bg-line" : "bg-line-soft",
                        )}
                      />
                    )}
                  </li>
                );
              })}
            </ol>

            <div className="mt-8 rounded-lg border border-line bg-panel/50 p-6">
              <h2 className="font-display text-2xl text-ink">{STAGE_COPY[stage].title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {STAGE_COPY[stage].body}
              </p>

              {!address && (
                <div className="mt-6 flex items-start gap-3 rounded-md border border-attention/30 bg-attention/10 p-4">
                  <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-attention" strokeWidth={1.4} />
                  <p className="text-sm leading-relaxed text-ink-soft">
                    Connect a wallet to sign the transactions. Reading the
                    register does not need one.
                  </p>
                </div>
              )}

              {address && !isCorrectNetwork && (
                <div className="mt-6 flex items-start gap-3 rounded-md border border-attention/30 bg-attention/10 p-4">
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-attention" strokeWidth={1.4} />
                  <div className="flex-1">
                    <p className="text-sm leading-relaxed text-ink-soft">
                      The wallet is on another network. Trustry lives on the
                      GenLayer Studio network.
                    </p>
                    <button
                      type="button"
                      onClick={() => void switchNetwork()}
                      className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-attention underline underline-offset-4"
                    >
                      Switch network
                    </button>
                  </div>
                </div>
              )}

              {stage === "open" && (
                <div className="mt-6 space-y-5">
                  <Field
                    label="What happened"
                    value={
                      <input
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        placeholder="The Ethereum upgrade went live on the mainnet"
                        className="w-full rounded-md border border-input bg-night/60 px-3 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-muted/60 focus:border-ink/25"
                      />
                    }
                  />
                  <Field
                    label="Where it is written"
                    value={
                      <input
                        value={evidenceUrl}
                        onChange={(event) => setEvidenceUrl(event.target.value)}
                        placeholder="https://blog.ethereum.org/..."
                        className="w-full rounded-md border border-input bg-night/60 px-3 py-2.5 font-mono text-xs text-ink outline-none transition-colors placeholder:text-muted/60 focus:border-ink/25"
                      />
                    }
                  />
                  <Field
                    label="Wording that has to be there"
                    hint="Separate several with a pipe. Every one of them must appear on the page."
                    value={
                      <input
                        value={requiredPhrase}
                        onChange={(event) => setRequiredPhrase(event.target.value)}
                        placeholder="Dencun"
                        className="w-full rounded-md border border-input bg-night/60 px-3 py-2.5 font-mono text-xs text-ink outline-none transition-colors placeholder:text-muted/60 focus:border-ink/25"
                      />
                    }
                  />
                  <Field label="Case reference" hint="Made for you. Change it if you keep your own filing numbers." value={
                    <input
                      value={eventId}
                      onFocus={ensureEventId}
                      onChange={(event) => {
                        eventIdRef.current = event.target.value;
                        setEventId(event.target.value);
                      }}
                      placeholder="made when you start"
                      className="w-full rounded-md border border-input bg-night/60 px-3 py-2.5 font-mono text-xs text-ink outline-none transition-colors placeholder:text-muted/60 focus:border-ink/25"
                    />
                  } />
                </div>
              )}

              {stage === "fund" && (
                <div className="mt-6 space-y-5">
                  <Field
                    label="Deposit in GEN"
                    hint="Held by the contract until the record is settled. Comes back in full if the claim is not attested."
                    value={
                      <input
                        value={deposit}
                        onChange={(event) => setDeposit(event.target.value)}
                        inputMode="decimal"
                        className="w-full rounded-md border border-input bg-night/60 px-3 py-2.5 font-mono text-xs text-ink outline-none transition-colors focus:border-ink/25"
                      />
                    }
                  />
                  <p className="text-xs leading-relaxed text-muted">
                    The deposit is sent in its own transaction so that a
                    verification that fails can never take it with it.
                  </p>
                </div>
              )}

              {stage === "notarize" && (
                <div className="mt-6 rounded-md border border-line bg-surface/50 p-5">
                  <p className="label">Ready</p>
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                    {description}
                  </p>
                  <p className="mt-2 font-mono text-xs text-muted">{evidenceUrl}</p>
                </div>
              )}

              {error && (
                <div className="mt-6 flex items-start gap-3 rounded-md border border-seal/40 bg-seal/10 p-4">
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-seal" strokeWidth={1.4} />
                  <div className="flex-1">
                    <p className="text-sm leading-relaxed text-ink">
                      {error}
                    </p>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted">
                      The state was rolled back, so nothing was changed and any
                      deposit is still yours.
                    </p>
                  </div>
                </div>
              )}

              <div className="mt-7 flex flex-wrap items-center gap-3">
                {stage === "open" && (
                  <ActionButton
                    onClick={() => void runOpen()}
                    busy={busy}
                    disabled={!address || !isCorrectNetwork || !description || !evidenceUrl || !requiredPhrase}
                  >
                    Open the case
                    <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.6} />
                  </ActionButton>
                )}
                {stage === "fund" && (
                  <ActionButton
                    onClick={() => void runFund()}
                    busy={busy}
                    disabled={!address || !isCorrectNetwork || depositWei <= 0}
                  >
                    Fund the escrow
                    <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.6} />
                  </ActionButton>
                )}
                {stage === "notarize" && (
                  <ActionButton
                    onClick={() => void runNotarize()}
                    busy={busy}
                    disabled={!address || !isCorrectNetwork}
                  >
                    Let the validators read it
                    <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.6} />
                  </ActionButton>
                )}

                {(details || error) && (
                  <button
                    type="button"
                    onClick={reset}
                    className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
                  >
                    Start another
                  </button>
                )}
              </div>

              {txHash && (
                <p className="mt-4 font-mono text-[10px] text-muted">
                  Transaction {txHash.slice(0, 18)}...
                </p>
              )}
            </div>
          </div>

          {/* The result. */}
          <div className="lg:pt-16">
            {details ? (
              <ConsensusPanel details={details} votes={outcome?.votes} />
            ) : (
              <div className="rounded-lg border border-line bg-panel/40 p-8">
                <Seal progress={0.08} size={96} className="mx-auto" />
                <h3 className="mt-6 text-center font-display text-2xl text-ink">
                  Nothing sealed yet
                </h3>
                <p className="mt-3 text-center text-sm leading-relaxed text-muted">
                  When the record is attested, the page it came from, the words
                  that carried the proof and how the validators voted all show
                  up here.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  hint,
  value,
}: {
  label: string;
  hint?: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      {hint && <p className="mt-1 text-xs leading-relaxed text-muted">{hint}</p>}
      <div className="mt-2">{value}</div>
    </div>
  );
}

function ActionButton({
  onClick,
  busy,
  disabled,
  children,
}: {
  onClick: () => void;
  busy: boolean;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className="group inline-flex items-center gap-2 rounded-md bg-ink px-5 py-3 text-xs uppercase tracking-[0.18em] text-night transition-all hover:bg-white disabled:cursor-not-allowed disabled:opacity-35"
    >
      {busy ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.6} />
          Waiting for the network
        </>
      ) : (
        children
      )}
    </button>
  );
}
