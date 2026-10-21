"use client";

import { useEffect } from "react";
import { CircleAlert, RotateCcw } from "lucide-react";

/**
 * The last line of defence. Anything that throws while a page is rendering
 * lands here, and the person gets a way out instead of a blank screen.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 items-center justify-center px-5 py-24 sm:px-8">
      <div className="w-full max-w-lg rounded-lg border border-line bg-panel/50 p-8">
        <CircleAlert className="h-5 w-5 text-seal" strokeWidth={1.4} />
        <h1 className="mt-6 font-display text-3xl leading-tight text-ink">
          This page could not be shown.
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          The register is read straight from the network, so a broken
          connection looks the same as a broken page. Try again, and if it
          keeps failing the studio network is probably busy.
        </p>
        {error.digest && (
          <p className="mt-4 font-mono text-[11px] text-muted">
            Reference {error.digest}
          </p>
        )}
        <button
          type="button"
          onClick={reset}
          className="mt-7 inline-flex items-center gap-2 rounded-md bg-ink px-5 py-3 text-xs uppercase tracking-[0.18em] text-night transition-colors hover:bg-white"
        >
          <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.6} />
          Try again
        </button>
      </div>
    </main>
  );
}
