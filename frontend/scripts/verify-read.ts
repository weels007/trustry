/**
 * Reads from the live Trustry contract using the browser client.
 * Run with: npx tsx scripts/verify-read.ts
 */
import { STUDIONET, TRUSTRY_CONTRACT } from "../src/lib/genlayer/chain";
import { readContract } from "../src/lib/genlayer/client";

async function main() {
  console.log("reading from the live contract", TRUSTRY_CONTRACT);

  const trusted = await readContract<boolean>(
    STUDIONET,
    TRUSTRY_CONTRACT,
    "is_trusted_domain",
    ["https://docs.genlayer.com/"],
  );
  console.log("  is_trusted_domain(docs.genlayer.com) =", trusted);

  const ids = await readContract<string[]>(
    STUDIONET,
    TRUSTRY_CONTRACT,
    "get_all_record_ids",
  );
  console.log("  get_all_record_ids =", JSON.stringify(ids));

  const total = await readContract<number>(
    STUDIONET,
    TRUSTRY_CONTRACT,
    "get_total_escrow_held",
  );
  console.log("  get_total_escrow_held =", total);

  const balance = await readContract<string>(
    STUDIONET,
    TRUSTRY_CONTRACT,
    "get_contract_balance",
  );
  console.log("  get_contract_balance =", balance);

  if (ids.length > 0) {
    const details = await readContract<Record<string, unknown>>(
      STUDIONET,
      TRUSTRY_CONTRACT,
      "get_frontend_details",
      [ids[0]],
    );
    console.log("  get_frontend_details =", JSON.stringify(details, null, 2));
  }
}

main().catch((error) => {
  console.error("read failed:", error);
  process.exit(1);
});
