import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center px-5 py-24 sm:px-8">
      <div className="w-full max-w-lg text-center">
        <p className="label">No such page</p>
        <h1 className="mt-5 font-display text-4xl leading-tight text-ink">
          Nothing is filed under that name.
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          The register is still where you left it.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex items-center gap-2 rounded-md border border-line px-5 py-3 text-xs uppercase tracking-[0.18em] text-ink-soft transition-colors hover:border-ink/25 hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.6} />
          Back to the overview
        </Link>
      </div>
    </main>
  );
}
