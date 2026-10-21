/**
 * The two networks do not answer in exactly the same shape, and the client has
 * to read both. These checks pin the differences down, so a change in one
 * network does not quietly break the other.
 *
 * Run with: npx tsx scripts/verify-client.ts
 */
import {
  readExecution,
  receiptStatus,
  type TransactionReceipt,
} from "../src/lib/genlayer/client";

let failures = 0;
function check(name: string, condition: boolean, detail = "") {
  if (condition) {
    console.log(`  OK    ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${name}  ${detail}`);
  }
}

console.log("READ  the state of a transaction\n");

// The studio network calls it status_name.
const studio: TransactionReceipt = { hash: "0x1", status_name: "FINALIZED" };
check("the studio state is read", receiptStatus(studio) === "FINALIZED", String(receiptStatus(studio)));

// The local node calls it status.
const local: TransactionReceipt = { hash: "0x2", status: "FINALIZED" };
check("the local state is read", receiptStatus(local) === "FINALIZED", String(receiptStatus(local)));

const pending: TransactionReceipt = { hash: "0x3", status: "PENDING" };
check("a pending state is not a finished one", receiptStatus(pending) === "PENDING", String(receiptStatus(pending)));

console.log("\nREAD  the reason a call was refused\n");

// The studio network sends the error text as it is.
const plainError = readExecution({
  hash: "0x4",
  status_name: "FINALIZED",
  consensus_data: {
    leader_receipt: [
      {
        mode: "leader",
        execution_result: "ERROR",
        result: { status: "rollback", payload: "[EXPECTED] Untrusted evidence domain: https://evil.example.com/x" },
      },
    ],
  },
});
check("a plain error is read as it is", plainError.ok === false, plainError.message);
check(
  "the plain error keeps its text",
  plainError.message.includes("Untrusted evidence domain"),
  plainError.message,
);

// The local node sends it base64 encoded.
const encoded = Buffer.from(
  "[EXPECTED] Untrusted evidence domain: https://evil.example.com/x",
  "utf-8",
).toString("base64");
const encodedError = readExecution({
  hash: "0x5",
  status: "FINALIZED",
  consensus_data: {
    leader_receipt: [
      {
        mode: "leader",
        execution_result: "ERROR",
        result: { status: "rollback", payload: encoded },
      },
    ],
  },
});
check("an encoded error is decoded", encodedError.message.includes("Untrusted evidence domain"), encodedError.message);

console.log("\nREAD  a call that worked\n");

const success = readExecution({
  hash: "0x6",
  status_name: "FINALIZED",
  consensus_data: {
    votes: { "0xaaa": "agree", "0xbbb": "agree", "0xccc": "idle" },
    leader_receipt: [
      {
        mode: "leader",
        execution_result: "SUCCESS",
        result: { readable: '{"event_id":"evt_1","verified":true}' },
      },
    ],
  },
});
check("a successful call is read", success.ok === true, success.message);
check("the value comes back", (success.value as { event_id?: string })?.event_id === "evt_1", JSON.stringify(success.value));
check("the votes are counted", success.votes["0xaaa"] === "agree", JSON.stringify(success.votes));

// The local node leaves the leader entry unmarked.
const unmarked = readExecution({
  hash: "0x7",
  status: "FINALIZED",
  consensus_data: {
    leader_receipt: [{ execution_result: "SUCCESS", result: '{"event_id":"evt_2"}' }],
  },
});
check("a leader entry without a mark is still read", unmarked.ok === true, unmarked.message);
check("its value comes back too", (unmarked.value as { event_id?: string })?.event_id === "evt_2", JSON.stringify(unmarked.value));

console.log(
  failures === 0
    ? "\nthe client reads both networks"
    : `\n${failures} check(s) failed`,
);
process.exit(failures === 0 ? 0 : 1);
