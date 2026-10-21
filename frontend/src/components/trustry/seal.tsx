"use client";

import { cn } from "@/lib/utils";

type SealProps = {
  /**
   * 0 to 1. The share of the ring that has been impressed. It follows the
   * consensus: an empty ring while the case is open, a partial arc while the
   * validators are reading, a full impression once the record is attested.
   */
  progress?: number;
  attested?: boolean;
  size?: number;
  className?: string;
};

/**
 * The notary's seal. It is the one element on the page that carries state:
 * the arc fills as the validators agree, and the wax red only appears once
 * the record has been attested.
 */
export function Seal({
  progress = 0,
  attested = false,
  size = 120,
  className,
}: SealProps) {
  const clamped = Math.min(1, Math.max(0, progress));
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const filled = circumference * clamped;

  return (
    <div
      className={cn("relative inline-grid place-items-center", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={
        attested
          ? "The record is attested"
          : clamped > 0
            ? "The validators are still agreeing"
            : "The case is open"
      }
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="0.5"
          className="text-line"
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
          transform="rotate(-90 50 50)"
          className={cn(
            "transition-[stroke-dasharray] duration-700 ease-out",
            attested ? "text-seal" : "text-ink-soft",
          )}
        />
        <circle
          cx="50"
          cy="50"
          r={radius - 5.5}
          fill="none"
          stroke="currentColor"
          strokeWidth="0.5"
          className={cn(attested ? "text-seal/40" : "text-line")}
        />
        <path
          d="M50 34 V66 M34 50 H66"
          stroke="currentColor"
          strokeWidth="0.9"
          className={cn("transition-colors", attested ? "text-seal" : "text-ink-soft/50")}
        />
      </svg>

      {attested && (
        <span
          className="absolute inset-0 rounded-full"
          style={{ boxShadow: "0 0 40px -12px var(--seal)" }}
        />
      )}
    </div>
  );
}
