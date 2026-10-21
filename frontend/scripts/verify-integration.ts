/**
 * The whole stack, on a local GenLayer node.
 *
 * The contract is deployed to the local network, and then every write and
 * read goes through the interface's own client: the calldata encoding, the
 * transaction that goes to the consensus contract, the wait for the consensus
 * round, and the reads that come back. Nothing is sent to the studio
 * network.
 *
 * Run with: npx tsx scripts/verify-integration.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  buildConsensusTransaction,
  readContract,
  readExecution,
  receiptStatus,
  waitForReceipt,
} from "../src/lib/genlayer/client";
import { LOCALNET } from "../src/lib/genlayer/chain";
import { address as calldataAddress } from "../src/lib/genlayer/calldata";
import { createLocalSigner } from "./local-signer";

const ROOT = join(process.cwd(), "..");
const DEPLOYED = join(ROOT, "localnet-deployment.json");

const PASS: string[] = [];
const FAIL: string[] = [];

function check(name: string, condition: boolean, detail = "") {
  if (condition) {
    PASS.push(name);
    console.log(`  PASS  ${name}`);
  } else {
    FAIL.push(name);
    console.log(`  FAIL  ${name}  ${detail}`);
  }
}

async function main() {
  if (!existsSync(DEPLOYED)) {
    console.error(`no deployment found at ${DEPLOYED}`);
    console.error("run: python deploy_localnet.py");
    process.exit(1);
  }

  const deployment = JSON.parse(readFileSync(DEPLOYED, "utf-8")) as {
    contract: string;
    account: string;
    privateKey: string;
  };
  const contract = deployment.contract as `0x${string}`;

  console.log(`contract : ${contract}`);
  console.log(`node     : ${LOCALNET.rpcUrl}`);
  console.log(`account  : ${deployment.account}\n`);

  const signer = createLocalSigner(
    deployment.privateKey as `0x${string}`,
    LOCALNET.id,
    LOCALNET.rpcUrl,
    {
      // The page the validator reads, and the answer it gives.
      web: {
        "https://docs.genlayer.com/": {
          status: 200,
          body: "GenLayer is the adjudication layer for the agentic economy. The GenLayer docs.",
        },
      },
      llm: {
        "AI Notary": JSON.stringify({
          verified: true,
          event_title: "GenLayer",
          evidence_quote: "GenLayer is the adjudication layer for the agentic economy",
          reasoning: "The page announces it.",
        }),
      },
    },
  );

  const read = <T>(method: string, args: unknown[] = []) =>
    readContract<T>(LOCALNET, contract, method, args as never, {
      from: deployment.account as `0x${string}`,
      variant: "latest-final",
    });

  const write = async (method: string, args: unknown[], value = 0n) => {
    const data = buildConsensusTransaction(
      LOCALNET,
      deployment.account as `0x${string}`,
      contract,
      method,
      args as never,
    );
    const hash = (await signer.request({
      method: "eth_sendTransaction",
      params: [
        {
          from: deployment.account,
          to: LOCALNET.consensusMainContract,
          data,
          value: `0x${value.toString(16)}`,
        },
      ],
    })) as string;
    console.log(`  sent    : ${hash}`);
    const receipt = await waitForReceipt(LOCALNET, hash);
    return { hash, receipt, outcome: readExecution(receipt) };
  };

  const eventId = `evt_local_${Date.now().toString(36)}`;

  // The node is started fresh for every run and the contract is deployed to
  // it, so this page has not certified anything yet. One page can only
  // certify one event, and the contract refuses the second one on purpose.
  const page = {
    url: "https://docs.genlayer.com/",
    phrase: "GenLayer",
    description: "The GenLayer documentation homepage",
  };


  // ---------- READ before anything ----------
  console.log("READ  before the flow");
  const idsBefore = await read<string[]>("get_all_record_ids");
  check("get_all_record_ids answers", Array.isArray(idsBefore), JSON.stringify(idsBefore));
  const trusted = await read<boolean>("is_trusted_domain", ["https://docs.genlayer.com/"]);
  check("is_trusted_domain answers", trusted === true, String(trusted));
  const heldBefore = await read<string>("get_total_escrow_held");
  check("get_total_escrow_held answers", heldBefore !== undefined, String(heldBefore));

  // ---------- WRITE open_case ----------
  console.log("\nWRITE open_case");
  const opened = await write("open_case", [
    eventId,
    page.description,
    page.url,
    page.phrase,
  ]);
  check("open_case reached a decision", receiptStatus(opened.receipt) === "FINALIZED", String(receiptStatus(opened.receipt)));
  check("open_case was accepted", opened.outcome.ok, opened.outcome.message);

  // ---------- WRITE fund_escrow ----------
  console.log("\nWRITE fund_escrow");
  const escrowWei = 10n ** 16n;
  const funded = await write("fund_escrow", [eventId], escrowWei);
  check("fund_escrow reached a decision", receiptStatus(funded.receipt) === "FINALIZED", String(receiptStatus(funded.receipt)));
  check("fund_escrow was accepted", funded.outcome.ok, funded.outcome.message);

  // The local node does not hand the value to the contract, so the escrow it
  // records is empty there. What is checked here is that the interface put
  // the value on the transaction, which is the part the interface owns. The
  // money actually changing hands is proved on the studio network.
  const sentFund = signer.sent[signer.sent.length - 1];
  check(
    "the deposit was attached to the transaction",
    sentFund?.signedValue === escrowWei,
    `signed ${sentFund?.signedValue}`,
  );

  const status = await read<{ escrow_wei: number; escrow_status: string }>("get_escrow_status", [eventId]);
  console.log(`  note  the local node does not deliver the value, escrow is ${status.escrow_status}`);
  check(
    "the escrow state matches what the node delivered",
    status.escrow_status === "none" && Number(status.escrow_wei) === 0,
    JSON.stringify(status),
  );

  // ---------- WRITE notarize ----------
  console.log("\nWRITE notarize");
  const notarized = await write("notarize", [eventId]);
  check("notarize reached a decision", receiptStatus(notarized.receipt) === "FINALIZED", String(receiptStatus(notarized.receipt)));
  check("notarize was accepted", notarized.outcome.ok, notarized.outcome.message);

  const details = await read<Record<string, unknown>>("get_frontend_details", [eventId]);
  console.log("  details:", JSON.stringify(details));
  check("the record exists", details.event_id === eventId, JSON.stringify(details));
  check("the record has a verdict", typeof details.verified === "boolean", JSON.stringify(details));
  check("the record has a source", details.source_domain === "docs.genlayer.com", String(details.source_domain));
  check(
    "the record carries the words the validator relied on",
    typeof details.evidence_quote === "string" && (details.evidence_quote as string).length > 0,
    String(details.evidence_quote),
  );
  check("the record is frontend ready", details.frontend_ready === true, JSON.stringify(details));

  // ---------- READ the register ----------
  console.log("\nREAD  the register");
  const idsAfter = await read<string[]>("get_all_record_ids");
  check("the new event is in the register", idsAfter.includes(eventId), JSON.stringify(idsAfter));
  check("the register grew by one", idsAfter.length === idsBefore.length + 1, `${idsBefore.length} -> ${idsAfter.length}`);

  // ---------- WRITE release_escrow ----------
  console.log("\nWRITE release_escrow");
  const released = await write("release_escrow", [
    eventId,
    calldataAddress(deployment.account as `0x${string}`),
  ]);
  check("release_escrow reached a decision", receiptStatus(released.receipt) === "FINALIZED", String(receiptStatus(released.receipt)));
  // There is no escrow to release on a node that never delivered the value,
  // and the contract has to refuse rather than pay out of nothing. The local
  // SDK cannot re-encode an address argument either, so the refusal may come
  // from there instead. Either way it must not succeed.
  check("release_escrow does not pay out", !released.outcome.ok, released.outcome.message);
  console.log(`  note  the refusal reads: ${released.outcome.message.slice(0, 120)}`);

  // ---------- the accounting after the release ----------
  console.log("\nREAD  the accounting after the release");
  const afterRelease = await read<{ escrow_status: string; escrow_wei: number }>("get_escrow_status", [
    eventId,
  ]);
  check("the escrow is still empty", afterRelease.escrow_status === "none", JSON.stringify(afterRelease));
  check("the escrow amount is zero", Number(afterRelease.escrow_wei) === 0, JSON.stringify(afterRelease));

  const held = BigInt(await read<string>("get_total_escrow_held"));
  check("the contract holds nothing", held === 0n, `held ${held}`);

  const pool = BigInt(await read<string>("get_escrow_pool", [deployment.account]));
  check("the depositor has no escrow left", pool === 0n, `pool ${pool}`);

  console.log("\n" + "=".repeat(56));
  console.log(`PASSED: ${PASS.length}   FAILED: ${FAIL.length}`);
  for (const name of FAIL) console.log(`  FAILED -> ${name}`);
  console.log("=".repeat(56));
  process.exit(FAIL.length === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
