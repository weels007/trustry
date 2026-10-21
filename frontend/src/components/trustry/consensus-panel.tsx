"use client";

import { Quote, Scale, ShieldCheck, Users } from "lucide-react";

import { Seal } from "@/components/trustry/seal";
import {
  ESCROW_LABEL,
  formatGen,
  STATE_LABEL,
  type FrontendDetails,
} from "@/lib/trustry";
import { cn } from "@/lib/utils";

type VoteTally = {
  agree: number;
  disagree: number;
  idle: number;
  total: number;
};

function tallyVotes(votes: Record<string, string> | undefined): VoteTally {
  const tally: VoteTally = { agree: 0, disagree: 0, idle: 0, total: 0 };
  if (!votes) return tally;
  for (const vote of Object.values(votes)) {
    tally.total += 1;
    if (vote === "agree") tally.agree += 1;
    else if (vote === "disagree") tally.disagree += 1;
    else tally.idle += 1;
  }
  return tally;
}

function Field({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="border-t border-line py-3 first:border-t-0 first:pt-0">
      <dt className="label">{label}</dt>
      <dd
        className={cn(
          "mt-1.5 break-words text-sm leading-relaxed text-ink-soft",
          mono && "font-mono text-xs",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

/**
 * Everything the network knew about a record. The point of the panel is that
 * a person can see the reasoning, not only the verdict.
 */
export function ConsensusPanel({
  details,
  votes,
  className,
}: {
  details: FrontendDetails;
  votes?: Record<string, string>;
  className?: string;
}) {
  const tally = tallyVotes(votes);
  const attested = details.verified;
  const progress = attested ? 1 : tally.agree > 0 ? 0.45 : 0.1;

  return (
    <div className={cn("rounded-lg border border-line bg-panel/60", className)}>
      <div className="flex flex-col gap-6 border-b border-line p-6 sm:flex-row sm:items-start sm:gap-8">
        <Seal progress={progress} attested={attested} size={104} className="shrink-0" />

        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "label",
              attested ? "text-verified" : "text-muted",
            )}
          >
            {STATE_LABEL[details.state]} by AI consensus
          </p>
          <h3 className="mt-2 font-display text-2xl leading-snug text-ink sm:text-3xl">
            {details.event_title || details.event_id}
          </h3>
          {details.event_description && (
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {details.event_description}
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2">
            {tally.total > 0 && (
              <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-muted">
                <Users className="h-3.5 w-3.5" strokeWidth={1.4} />
                {tally.agree} agreed
                {tally.disagree > 0 && `, ${tally.disagree} disagreed`}
                {tally.idle > 0 && `, ${tally.idle} idle`}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-muted">
              <Scale className="h-3.5 w-3.5" strokeWidth={1.4} />
              {details.appeal_count} appeal{details.appeal_count === 1 ? "" : "s"}
            </span>
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-muted">
              <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.4} />
              {ESCROW_LABEL[details.escrow_status]}
              {details.escrow_wei > 0 && ` · ${formatGen(details.escrow_wei)} GEN`}
            </span>
          </div>
        </div>
      </div>

      {details.evidence_quote && (
        <div className="border-b border-line bg-surface/40 p-6">
          <p className="label flex items-center gap-2">
            <Quote className="h-3 w-3" strokeWidth={1.5} />
            The words the validator relied on
          </p>
          <blockquote className="mt-3 border-l border-seal/40 pl-4 font-display text-lg leading-relaxed text-ink-soft">
            {details.evidence_quote}
          </blockquote>
        </div>
      )}

      <dl className="grid gap-x-8 gap-y-0 p-6 sm:grid-cols-2">
        <Field
          label="Source"
          value={
            <a
              href={details.evidence_url}
              target="_blank"
              rel="noreferrer noopener"
              className="text-ink underline decoration-line underline-offset-4 transition-colors hover:decoration-seal"
            >
              {details.evidence_url}
            </a>
          }
        />
        <Field label="Domain" value={details.source_domain} mono />
        <Field label="Submitted by" value={details.submitted_by} mono />
        <Field
          label="Record"
          value={
            <span className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-ink-soft">
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  attested ? "bg-verified" : "bg-muted",
                )}
              />
              {details.verified_at || "notarized"}
            </span>
          }
        />
      </dl>
    </div>
  );
}
