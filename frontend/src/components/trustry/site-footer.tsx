import Link from "next/link";

import { STUDIONET, TRUSTRY_CONTRACT } from "@/lib/genlayer/chain";

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 py-12 sm:px-8 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <svg viewBox="0 0 32 32" className="h-5 w-5 text-seal" aria-hidden="true">
              <circle cx="16" cy="16" r="12" fill="none" stroke="currentColor" strokeWidth="1.1" opacity="0.5" />
              <path d="M16 10 V22 M10 16 H22" stroke="currentColor" strokeWidth="1.1" />
            </svg>
            <span className="font-display text-base text-ink">Trustry</span>
          </div>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">
            An AI notary for facts that happen online. Independent validators
            read the source, judge it on their own, and agree on a record.
          </p>
        </div>

        <div className="flex flex-col gap-6 sm:flex-row sm:gap-14">
          <div>
            <p className="label">Pages</p>
            <ul className="mt-3 space-y-2">
              {[
                { href: "/", label: "Overview" },
                { href: "/notarize", label: "Notarize" },
                { href: "/records", label: "Records" },
                { href: "/how-it-works", label: "How it works" },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted transition-colors hover:text-ink"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="label">Network</p>
            <ul className="mt-3 space-y-2 font-mono text-xs text-muted">
              <li>{STUDIONET.name}</li>
              <li>chain {STUDIONET.id}</li>
              <li>
                <a
                  href={`${STUDIONET.explorerUrl}/address/${TRUSTRY_CONTRACT}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="transition-colors hover:text-ink"
                >
                  {TRUSTRY_CONTRACT.slice(0, 10)}...{TRUSTRY_CONTRACT.slice(-6)}
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
