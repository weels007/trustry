import { CircleCheck, CircleX, Quote, Scale, ShieldCheck, Wallet } from "lucide-react";

import { Seal } from "@/components/trustry/seal";

const LAYERS = [
  {
    icon: Scale,
    title: "The model does the judging",
    body: "An AI validator reads the page and decides whether it reports the event. That judgement is the whole point, and it is made independently by each validator, on its own copy of the page.",
  },
  {
    icon: CircleCheck,
    title: "The wording has to be on the page",
    body: "Before the model is even asked, the contract checks that the wording the claim requires is actually present in the fetched page. A page cannot talk its way into proving something it does not contain.",
  },
  {
    icon: Quote,
    title: "The proof has to be quotable",
    body: "The model hands back the exact sentence it relied on. The contract checks that sentence against the page. Evidence that was made up is thrown out, so a confident answer with nothing behind it cannot seal a record.",
  },
  {
    icon: ShieldCheck,
    title: "The validators have to agree",
    body: "The leader proposes, the validators check. They fetch the page again themselves and compare. When they disagree the round is retried with a new leader, and a record only settles when enough of them agree.",
  },
];

const SAFETY = [
  {
    title: "One page, one claim",
    body: "The source is reserved when the case opens, so the same page cannot certify a second claim. A page that proves one thing does not become proof of everything.",
  },
  {
    title: "The owner cannot move anyone's escrow",
    body: "Only the person who deposited the GEN can release it. The contract owner can trigger a refund, but the money always goes back to the depositor.",
  },
  {
    title: "The deposit cannot get trapped",
    body: "Funding is a transaction of its own that never rejects, and the risky step carries no value. A verification that fails halfway can never swallow a deposit.",
  },
  {
    title: "A wrong verdict can be appealed",
    body: "If the evidence was published after the first attempt, the case can be judged again from scratch. The number of appeals stays on the record forever.",
  },
];

export default function HowItWorksPage() {
  return (
    <main className="flex-1">
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <div className="grid gap-16 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <p className="label flex items-center gap-3">
              <span className="h-px w-8 bg-seal" />
              How it works
            </p>
            <h1 className="mt-5 font-display text-5xl leading-[1.05] text-ink">
              A machine that has to
              <br />
              <em className="text-seal">show its work.</em>
            </h1>
            <p className="mt-6 text-base leading-relaxed text-ink-soft">
              GenLayer settles things that need judgement rather than
              arithmetic. Trustry uses that for the oldest job in the book:
              saying that something is true, and being able to prove it later.
            </p>

            <div className="mt-10 flex items-center gap-5">
              <Seal progress={1} attested size={84} />
              <div>
                <p className="label text-verified">The seal</p>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  The ring fills as the validators agree. The wax red only
                  appears once the record is attested.
                </p>
              </div>
            </div>
          </div>

          <div>
            <ol className="space-y-px border border-line bg-line">
              {LAYERS.map((layer, index) => (
                <li key={layer.title} className="bg-night p-7">
                  <div className="flex items-center gap-3">
                    <layer.icon className="h-4 w-4 text-seal" strokeWidth={1.4} />
                    <span className="font-mono text-[10px] tracking-[0.2em] text-muted">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h2 className="mt-5 font-display text-2xl text-ink">
                    {layer.title}
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-muted">
                    {layer.body}
                  </p>
                </li>
              ))}
            </ol>

            <h2 className="mt-16 font-display text-3xl text-ink">
              What the record is made of
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
              Everything below is written once, when the record settles, and
              can be read by anyone afterwards.
            </p>

            <dl className="mt-8">
              {[
                ["The claim", "What was said happened, in the submitter's own words."],
                ["The source", "The page the record was read from."],
                ["The proof", "The exact sentence from that page that carried it."],
                ["The verdict", "Whether the validators agreed, and how many."],
                ["The deposit", "How much was held, and where it ended up."],
                ["The appeals", "How many times the case was judged again."],
              ].map(([term, definition]) => (
                <div key={term} className="border-t border-line py-4">
                  <dt className="text-sm text-ink">{term}</dt>
                  <dd className="mt-1.5 text-sm leading-relaxed text-muted">
                    {definition}
                  </dd>
                </div>
              ))}
            </dl>

            <h2 className="mt-16 font-display text-3xl text-ink">
              Where it can go wrong, and what stops it
            </h2>
            <dl className="mt-8">
              {SAFETY.map((item) => (
                <div key={item.title} className="border-t border-line py-4">
                  <dt className="flex items-start gap-2.5 text-sm text-ink">
                    <CircleX
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-seal"
                      strokeWidth={1.6}
                    />
                    {item.title}
                  </dt>
                  <dd className="mt-1.5 pl-6 text-sm leading-relaxed text-muted">
                    {item.body}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="mt-12 flex items-start gap-3 rounded-lg border border-line bg-panel/50 p-6">
              <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-ink-soft" strokeWidth={1.4} />
              <p className="text-sm leading-relaxed text-muted">
                Anyone with an EVM wallet can open a case and deposit GEN. No
                account, no key held by Trustry, and no fee beyond the gas the
                network charges.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
