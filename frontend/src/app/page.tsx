import Link from "next/link";
import { ArrowRight, FileSearch, Fingerprint, Landmark, Scale } from "lucide-react";

import GatewayFlow from "@/components/ui/gateway-flow";
import { Seal } from "@/components/trustry/seal";
import { StudioBar } from "@/components/trustry/studio-bar";

const STEPS = [
  {
    icon: FileSearch,
    title: "Open a case",
    body: "Name the claim and point at the page that proves it. The source has to be a domain Trustry trusts, and one page can only ever certify one claim.",
  },
  {
    icon: Scale,
    title: "Validators read it",
    body: "Independent AI validators fetch the page themselves and judge it against the claim. Nobody can hand them the answer, because none of them talks to the others.",
  },
  {
    icon: Fingerprint,
    title: "A record is sealed",
    body: "When the validators agree, the record is attested on chain, with the exact words from the page that carried the proof. Anyone can check it later.",
  },
];

const GUARANTEES = [
  {
    title: "The page has to say it",
    body: "The claim is only attested when the required wording is actually present on the source page. A page cannot talk its way into proving something it does not contain.",
  },
  {
    title: "The proof has to be quotable",
    body: "Every validator has to hand back the exact sentence it relied on, and the contract checks that sentence against the page. Invented evidence does not count.",
  },
  {
    title: "The money cannot get stuck",
    body: "Escrow is funded in its own step and can always be returned. A verification that fails halfway never takes anyone's deposit with it.",
  },
  {
    title: "A wrong verdict can be appealed",
    body: "If a page was published after the first attempt, the case can be judged again from scratch, and the number of appeals stays on the record.",
  },
];

export default function HomePage() {
  return (
    <main className="flex-1">
      {/* The hero is the consensus itself. */}
      <section className="relative min-h-[86vh] overflow-hidden border-b border-line">
        <div className="pointer-events-none absolute inset-0 opacity-70">
          <GatewayFlow className="h-full w-full" density={0.9} speed={0.55} />
        </div>

        <div className="relative mx-auto flex min-h-[86vh] max-w-7xl flex-col justify-center px-5 py-24 sm:px-8">
          <div className="max-w-2xl">
            <p className="label flex items-center gap-3">
              <span className="h-px w-8 bg-seal" />
              An AI notary on GenLayer
            </p>

            <h1 className="mt-6 font-display text-[clamp(2.75rem,7vw,5.25rem)] leading-[0.98] tracking-tight text-ink">
              Proof that something
              <br />
              <em className="text-seal">actually happened.</em>
            </h1>

            <p className="mt-7 max-w-xl text-lg leading-relaxed text-ink-soft">
              Trustry attests claims about the real world. Independent AI
              validators read the page you point at, judge it on their own, and
              agree on a record that anyone can check afterwards.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Link
                href="/notarize"
                className="group inline-flex items-center gap-2 rounded-md bg-ink px-5 py-3 text-xs uppercase tracking-[0.18em] text-night transition-all hover:bg-white"
              >
                Notarize a claim
                <ArrowRight
                  className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                  strokeWidth={1.6}
                />
              </Link>
              <Link
                href="/how-it-works"
                className="inline-flex items-center gap-2 rounded-md border border-line px-5 py-3 text-xs uppercase tracking-[0.18em] text-ink-soft transition-colors hover:border-ink/25 hover:text-ink"
              >
                How it works
              </Link>
            </div>
          </div>
        </div>
      </section>

      <StudioBar />

      {/* The three steps, in the order they actually happen. */}
      <section className="border-b border-line">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
          <p className="label">The record of a claim</p>
          <h2 className="mt-4 max-w-2xl font-display text-4xl leading-tight text-ink">
            Three steps, and none of them is you telling the truth.
          </h2>

          <ol className="mt-14 grid gap-px border border-line bg-line md:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className="bg-night p-7">
                <div className="flex items-center justify-between">
                  <step.icon className="h-5 w-5 text-seal" strokeWidth={1.3} />
                  <span className="font-mono text-[10px] tracking-[0.2em] text-muted">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="mt-8 font-display text-2xl text-ink">{step.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* What the record carries. */}
      <section className="border-b border-line">
        <div className="mx-auto grid max-w-7xl gap-16 px-5 py-20 sm:px-8 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          <div>
            <p className="label">What ends up on chain</p>
            <h2 className="mt-4 font-display text-4xl leading-tight text-ink">
              A verdict is not much on its own.
            </h2>
            <p className="mt-6 text-base leading-relaxed text-ink-soft">
              A record that only says yes or no is worth little. Trustry
              stores the reasoning next to the verdict: the page it came from,
              the exact words that carried the proof, who submitted it, and
              how the validators voted.
            </p>
            <p className="mt-4 text-base leading-relaxed text-ink-soft">
              That is the difference between a claim and a record of a claim.
            </p>

            <dl className="mt-10 space-y-0">
              {GUARANTEES.map((item) => (
                <div
                  key={item.title}
                  className="border-t border-line py-4 last:border-b"
                >
                  <dt className="text-sm text-ink">{item.title}</dt>
                  <dd className="mt-1.5 text-sm leading-relaxed text-muted">
                    {item.body}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative">
            <div className="rounded-lg border border-line bg-panel/60 p-8">
              <div className="flex items-center gap-4">
                <Seal progress={1} attested size={72} />
                <div>
                  <p className="label text-verified">Attested by AI consensus</p>
                  <p className="mt-2 font-display text-2xl leading-snug text-ink">
                    GenLayer — The Adjudication Layer for the Agentic Economy
                  </p>
                </div>
              </div>

              <blockquote className="mt-7 border-l border-seal/40 pl-4 font-display text-base leading-relaxed text-ink-soft">
                “GenLayer is the adjudication layer for the agentic economy:
                decentralized AI-validator consensus for contracts that require
                judgment, not just code.”
              </blockquote>

              <dl className="mt-7 grid gap-x-8 sm:grid-cols-2">
                <div className="border-t border-line py-3">
                  <dt className="label">Source</dt>
                  <dd className="mt-1.5 font-mono text-xs text-ink-soft">
                    docs.genlayer.com
                  </dd>
                </div>
                <div className="border-t border-line py-3">
                  <dt className="label">Validators</dt>
                  <dd className="mt-1.5 font-mono text-xs text-ink-soft">
                    3 agreed, 0 disagreed
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-line">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
          <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <p className="label flex items-center gap-3">
                <Landmark className="h-3.5 w-3.5" strokeWidth={1.4} />
                Open the register
              </p>
              <h2 className="mt-4 font-display text-4xl leading-tight text-ink">
                Every record anyone has made, in the open.
              </h2>
            </div>
            <Link
              href="/records"
              className="group inline-flex items-center gap-2 rounded-md border border-line px-5 py-3 text-xs uppercase tracking-[0.18em] text-ink-soft transition-colors hover:border-ink/25 hover:text-ink"
            >
              Browse the records
              <ArrowRight
                className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                strokeWidth={1.6}
              />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
