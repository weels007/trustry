/**
 * Checks the TypeScript calldata codec against the bytes the Python SDK
 * produced. Run with: npx tsx scripts/verify-calldata.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { address, encodeCalldata, makeCalldataObject } from "../src/lib/genlayer/calldata";
import { encodeRlpList } from "../src/lib/genlayer/rlp";

type GroundTruth = Record<
  string,
  {
    method: string;
    args: unknown[];
    calldata_hex: string;
    read_data_hex: string;
    write_data_hex: string;
  }
>;

const groundTruthPath = join(
  process.cwd(),
  "..",
  "calldata_ground_truth.json",
);
const groundTruth = JSON.parse(
  readFileSync(groundTruthPath, "utf-8"),
) as GroundTruth;

function toHexString(bytes: Uint8Array): string {
  return `0x${Buffer.from(bytes).toString("hex")}`;
}

let failures = 0;
for (const [key, expected] of Object.entries(groundTruth)) {
  const method = expected.method;

  const args = expected.args.map((arg) => {
    if (arg && typeof arg === "object" && "__addr" in arg) {
      return address((arg as { __addr: `0x${string}` }).__addr);
    }
    return arg as never;
  });

  const encoded = encodeCalldata(makeCalldataObject(method, args));
  const readData = toHexString(encodeRlpList([encoded, new Uint8Array([0])]));
  const writeData = toHexString(encodeRlpList([encoded, new Uint8Array([])]));

  const okCalldata = toHexString(encoded) === expected.calldata_hex;
  const okRead = readData === expected.read_data_hex;
  const okWrite = writeData === expected.write_data_hex;

  if (okCalldata && okRead && okWrite) {
    console.log(`  OK    ${key}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${key}`);
    if (!okCalldata) {
      console.log(`        calldata expected ${expected.calldata_hex}`);
      console.log(`        calldata actual   ${toHexString(encoded)}`);
    }
    if (!okRead) {
      console.log(`        read expected ${expected.read_data_hex}`);
      console.log(`        read actual   ${readData}`);
    }
    if (!okWrite) {
      console.log(`        write expected ${expected.write_data_hex}`);
      console.log(`        write actual   ${writeData}`);
    }
  }
}

console.log(
  failures === 0
    ? "\ncalldata codec matches the Python SDK on every case"
    : `\n${failures} case(s) differ from the Python SDK`,
);
process.exit(failures === 0 ? 0 : 1);
