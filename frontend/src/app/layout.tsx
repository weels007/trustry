import type { Metadata } from "next";
import { IBM_Plex_Mono, Instrument_Serif, Inter_Tight } from "next/font/google";

import { SiteFooter } from "@/components/trustry/site-footer";
import { SiteHeader } from "@/components/trustry/site-header";
import { WalletProvider } from "@/hooks/use-wallet";
import { EARLY_WALLET_CAPTURE } from "@/lib/wallet";
import "./globals.css";

/**
 * Three faces, three voices.
 * The record speaks in serif, the interface speaks in a tight grotesque, and
 * anything that is a measurement speaks in mono.
 */
const display = Instrument_Serif({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

const body = Inter_Tight({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

const data = IBM_Plex_Mono({
  variable: "--font-data",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

export const metadata: Metadata = {
  title: "Trustry — an AI notary for facts that happen online",
  description:
    "Trustry attests that a claim about the real world is true. Independent AI validators fetch the source, judge the page, and agree on a record that anyone can check.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${data.variable} h-full antialiased`}
    >
      <body className="grain flex min-h-full flex-col bg-night">
        <script
          dangerouslySetInnerHTML={{ __html: EARLY_WALLET_CAPTURE }}
        />
        <WalletProvider>
          <SiteHeader />
          {children}
          <SiteFooter />
        </WalletProvider>
      </body>
    </html>
  );
}
