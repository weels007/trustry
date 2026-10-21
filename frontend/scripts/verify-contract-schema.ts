/**
 * Checks the interface against the contract itself.
 *
 * The schema comes out of the GenVM linter, which reads the contract source
 * the same way the network does. If the contract gains a method, changes a
 * parameter or changes whether it is payable, this fails.
 *
 * Run with: npx tsx scripts/verify-contract-schema.ts
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { TRUSTRY_METHODS } from "../src/lib/genlayer/contract";

const ROOT = join(process.cwd(), "..");
const CONTRACT = join(ROOT, "contracts", "trustry.py");

if (!existsSync(CONTRACT)) {
  console.error(`no contract at ${CONTRACT}`);
  process.exit(1);
}

type SchemaParam = [string, string];
type SchemaMethod = {
  params: SchemaParam[];
  readonly: boolean;
  payable?: boolean;
};
type Schema = {
  methods: Record<string, SchemaMethod>;
};

const raw = execFileSync("genvm-lint", ["schema", CONTRACT, "--json"], {
  encoding: "utf-8",
  maxBuffer: 16 * 1024 * 1024,
});
const parsed = JSON.parse(raw) as { ok: boolean; schema: Schema };
if (!parsed.ok) {
  console.error("the linter did not return a schema");
  process.exit(1);
}
const schema = parsed.schema;

let failures = 0;
function check(name: string, condition: boolean, detail = "") {
  if (condition) {
    console.log(`  OK    ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${name}  ${detail}`);
  }
}

console.log("READ  the interface against the GenVM schema\n");

// Every method the interface knows about has to exist, with the same shape.
for (const spec of TRUSTRY_METHODS) {
  const found = schema.methods[spec.name];
  if (!found) {
    check(`${spec.name} exists`, false, "not in the contract schema");
    continue;
  }
  const expected = spec.params.map((param) => `${param.name}:${param.type}`);
  const actual = found.params.map((param) => `${param[0]}:${param[1]}`);
  check(
    `${spec.name} has the parameters the interface sends`,
    JSON.stringify(expected) === JSON.stringify(actual),
    `expected ${JSON.stringify(expected)} got ${JSON.stringify(actual)}`,
  );
  check(
    `${spec.name} is ${spec.readonly ? "a read" : "a write"}`,
    found.readonly === spec.readonly,
    `expected readonly ${spec.readonly} got ${found.readonly}`,
  );
  if (spec.payable) {
    check(
      `${spec.name} is payable`,
      found.payable === true,
      `expected payable, got ${found.payable}`,
    );
  }
}

// And the interface must not know about a method the contract does not have.
const known = new Set(TRUSTRY_METHODS.map((method) => method.name));
const extra = Object.keys(schema.methods).filter((name) => !known.has(name));
check("the interface knows every method the contract has", extra.length === 0, `unknown: ${extra.join(", ")}`);

// A method the contract has that the interface does not know is worth
// reporting, because the interface would silently not use it.
for (const name of extra) {
  console.log(`  note  the contract has ${name}, the interface does not use it`);
}

// The address parameters are the ones that break silently, so they are called
// out on their own.
for (const spec of TRUSTRY_METHODS) {
  for (const param of spec.params) {
    if (param.type !== "address") continue;
    const found = schema.methods[spec.name];
    const actual = found?.params.find((entry) => entry[0] === param.name);
    check(
      `${spec.name}.${param.name} is an address in the contract`,
      actual?.[1] === "address",
      `contract says ${actual?.[1]}`,
    );
  }
}

console.log(
  failures === 0
    ? "\nthe interface and the contract agree"
    : `\n${failures} check(s) failed`,
);
process.exit(failures === 0 ? 0 : 1);
