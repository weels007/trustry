/**
 * Checks the transaction data the browser builds for a write against the
 * bytes the Python SDK produces. Run with: npx tsx scripts/verify-write.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { buildConsensusTransaction, buildWriteCalldata } from "../src/lib/genlayer/client";
import { address } from "../src/lib/genlayer/calldata";
import { STUDIONET, TRUSTRY_CONTRACT } from "../src/lib/genlayer/chain";

type GroundTruth = Record<string, { inner_data: string; transaction_data: string }>;

const groundTruth = JSON.parse(
  readFileSync(join(process.cwd(), "..", "write_ground_truth.json"), "utf-8"),
) as GroundTruth;

const SENDER = "0xE8b3e800d08727D25156a44cD1609F793bd0Af5a";
const RECIPIENT = "0x18207BFEF02C1e00Dd2BA6D746FbbeB84A22C1A4";

let failures = 0;

for (const [method, expected] of Object.entries(groundTruth)) {
  const args =
    method === "release_escrow"
      ? ["evt_1", address(RECIPIENT as `0x${string}`)]
      : method === "open_case"
        ? ["evt_1", "desc", "https://docs.genlayer.com/", "GenLayer"]
        : ["evt_1"];

  const inner = buildWriteCalldata(method, args as never);
  const transaction = buildConsensusTransaction(
    STUDIONET,
    SENDER as `0x${string}`,
    TRUSTRY_CONTRACT,
    method,
    args as never,
  );

  const okInner = inner === expected.inner_data;
  const okTx = transaction === expected.transaction_data;

  if (okInner && okTx) {
    console.log(`  OK    ${method}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${method}`);
    if (!okInner) {
      console.log(`        inner expected ${expected.inner_data}`);
      console.log(`        inner actual   ${inner}`);
    }
    if (!okTx) {
      console.log(`        tx expected ${expected.transaction_data}`);
      console.log(`        tx actual   ${transaction}`);
    }
  }
}

console.log(
  failures === 0
    ? "\nthe write payload matches the Python SDK on every case"
    : `\n${failures} case(s) differ from the Python SDK`,
);
process.exit(failures === 0 ? 0 : 1);
