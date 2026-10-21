"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { WalletConnect } from "@/components/trustry/wallet-connect";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/notarize", label: "Notarize" },
  { href: "/records", label: "Records" },
  { href: "/how-it-works", label: "How it works" },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-night/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-5 sm:px-8">
        <Link href="/" className="group flex items-center gap-2.5">
          <svg viewBox="0 0 32 32" className="h-6 w-6 text-seal" aria-hidden="true">
            <circle cx="16" cy="16" r="12" fill="none" stroke="currentColor" strokeWidth="1.1" opacity="0.5" />
            <circle cx="16" cy="16" r="9" fill="none" stroke="currentColor" strokeWidth="0.6" opacity="0.3" />
            <path d="M16 10 V22 M10 16 H22" stroke="currentColor" strokeWidth="1.1" />
          </svg>
          <span className="font-display text-lg tracking-tight text-ink">Trustry</span>
        </Link>

        <nav className="hidden flex-1 items-center gap-1 md:flex">
          {LINKS.map((link) => {
            const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "relative rounded px-3 py-2 text-xs uppercase tracking-[0.18em] transition-colors",
                  active ? "text-ink" : "text-muted hover:text-ink-soft",
                )}
              >
                {link.label}
                {active && (
                  <span className="absolute inset-x-3 -bottom-px h-px bg-seal/70" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <div className="hidden md:block">
            <WalletConnect />
          </div>

          <Sheet>
            <SheetTrigger
              aria-label="Open the menu"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-line text-ink-soft transition-colors hover:border-ink/25 hover:text-ink md:hidden"
            >
              <Menu className="h-4 w-4" strokeWidth={1.5} />
            </SheetTrigger>
            <SheetContent
              side="right"
              className="border-line bg-panel p-0 sm:max-w-xs"
            >
              <div className="border-b border-line p-5">
                <p className="label">Pages</p>
              </div>
              <nav className="flex flex-col p-2">
                {LINKS.map((link) => {
                  const active =
                    link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={cn(
                        "rounded px-3 py-3 text-xs uppercase tracking-[0.18em] transition-colors",
                        active
                          ? "bg-seal/10 text-seal"
                          : "text-muted hover:bg-ink/[0.04] hover:text-ink",
                      )}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </nav>
              <div className="mt-auto border-t border-line p-5">
                <WalletConnect />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
