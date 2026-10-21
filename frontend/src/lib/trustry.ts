/** The shape of a record as the contract returns it. */

export type RecordState = "pending" | "verified" | "rejected";
export type EscrowState = "none" | "held" | "released" | "refunded";

export type TrustryRecord = {
  event_id: string;
  event_title: string;
  event_description?: string;
  evidence_url: string;
  evidence_quote?: string;
  source_domain: string;
  verified: boolean;
  verified_at: string;
  state: RecordState;
  submitted_by: string;
  escrow_wei: number;
  escrow_status: EscrowState;
  appeal_count: number;
  consensus_status: "accepted" | "rejected";
  display_message?: string;
  frontend_ready?: boolean;
};

export type FrontendDetails = TrustryRecord;

export const STATE_LABEL: Record<RecordState, string> = {
  pending: "Open",
  verified: "Attested",
  rejected: "Unattested",
};

export const ESCROW_LABEL: Record<EscrowState, string> = {
  none: "No escrow",
  held: "Held",
  released: "Released",
  refunded: "Refunded",
};

/** GEN amounts are wei on chain. */
export function formatGen(wei: number | string, digits = 4): string {
  const value = typeof wei === "string" ? Number(wei) : wei;
  if (!Number.isFinite(value)) return "0";
  const gen = value / 1e18;
  if (gen === 0) return "0";
  if (gen < 0.0001) return "<0.0001";
  return gen.toFixed(digits).replace(/0+$/, "").replace(/\.$/, "");
}

export function formatTimestamp(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
