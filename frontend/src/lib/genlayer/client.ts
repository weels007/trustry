/**
 * A small client for the GenLayer network.
 *
 * Reads go through `gen_call`, which runs the contract in the leader mode and
 * returns the value straight away. Writes are sent to the consensus contract
 * as an ordinary EVM transaction, which is what a wallet can sign.
 */

import { encodeAbiParameters, parseAbiParameters, toFunctionSelector } from "viem";

import {
  decodeCalldata,
  encodeCalldata,
  makeCalldataObject,
  type CalldataValue,
} from "./calldata";
import { encodeRlpList, toHex } from "./rlp";
import type { GenLayerChain } from "./chain";

const ADD_TRANSACTION_SIGNATURE =
  "addTransaction(address,address,uint256,uint256,bytes,uint256)";

export const ADD_TRANSACTION_SELECTOR = toFunctionSelector(ADD_TRANSACTION_SIGNATURE);

export type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: never[]) => void) => void;
  removeListener?: (event: string, handler: (...args: never[]) => void) => void;
};

export class GenLayerError extends Error {
  readonly code: number | undefined;

  constructor(message: string, code?: number) {
    super(message);
    this.name = "GenLayerError";
    this.code = code;
  }
}

export type ReadVariant = "latest-final" | "latest-nonfinal";

/** Build the calldata payload the node expects for a contract call. */
export function buildCallData(
  method: string,
  args: CalldataValue[] = [],
): `0x${string}` {
  const encoded = encodeCalldata(makeCalldataObject(method, args));
  return toHex(encodeRlpList([encoded, new Uint8Array([0])]));
}

/** Build the calldata payload for a write, which the consensus contract wraps. */
export function buildWriteCalldata(
  method: string,
  args: CalldataValue[] = [],
): `0x${string}` {
  const encoded = encodeCalldata(makeCalldataObject(method, args));
  return toHex(encodeRlpList([encoded, new Uint8Array([])]));
}

/**
 * Build the transaction data for the consensus contract, which is where a
 * write has to be sent for the network to run a consensus round.
 */
export function buildConsensusTransaction(
  chain: GenLayerChain,
  sender: `0x${string}`,
  recipient: `0x${string}`,
  method: string,
  args: CalldataValue[] = [],
): `0x${string}` {
  const inner = buildWriteCalldata(method, args);
  const encoded = encodeAbiParameters(
    parseAbiParameters(
      "address, address, uint256, uint256, bytes, uint256",
    ),
    [
      sender,
      recipient,
      BigInt(chain.numInitialValidators),
      BigInt(chain.maxRotations),
      inner,
      0n,
    ],
  );
  return `${ADD_TRANSACTION_SELECTOR}${encoded.slice(2)}` as `0x${string}`;
}

export type ReadOptions = {
  from?: `0x${string}`;
  variant?: ReadVariant;
};

async function rpc<T>(url: string, method: string, params: unknown[]): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });

  const text = await response.text();
  if (!text) {
    throw new GenLayerError(`The node returned an empty answer for ${method}.`);
  }

  let payload: { result?: T; error?: { code?: number; message?: string } };
  try {
    payload = JSON.parse(text) as typeof payload;
  } catch {
    throw new GenLayerError(
      `The node did not answer with JSON for ${method}. It may be restarting, try again in a moment.`,
    );
  }

  if (payload.error) {
    throw new GenLayerError(
      payload.error.message ?? `The node refused ${method}.`,
      payload.error.code,
    );
  }
  if (payload.result === undefined) {
    throw new GenLayerError(`The node gave no result for ${method}.`);
  }
  return payload.result;
}

/** Call a read only method on an intelligent contract. */
export async function readContract<T = Record<string, unknown>>(
  chain: GenLayerChain,
  contract: `0x${string}`,
  method: string,
  args: CalldataValue[] = [],
  options: ReadOptions = {},
): Promise<T> {
  const data = buildCallData(method, args);
  const from = options.from ?? "0x0000000000000000000000000000000000000000";

  const result = await rpc<string>(
    chain.rpcUrl,
    "gen_call",
    [
      {
        type: "read",
        to: contract,
        from,
        data,
        transaction_hash_variant: options.variant ?? "latest-final",
      },
    ],
  );

  const hex = result.startsWith("0x") ? result.slice(2) : result;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return decodeCalldata(bytes) as T;
}

export type TransactionStatusName =
  | "SUBMITTED"
  | "PENDING"
  | "ACCEPTED"
  | "FINALIZED"
  | "CANCELED"
  | "UNDETERMINED";

export type TransactionReceipt = {
  hash: string;
  status_name: TransactionStatusName;
  result_name?: string;
  value?: string;
  value_credited?: boolean;
  from_address?: string;
  to_address?: string;
  created_at?: string;
  consensus_data?: {
    votes?: Record<string, string>;
    leader_receipt?: Array<Record<string, unknown>>;
    validators?: Array<Record<string, unknown>>;
  };
};

/** Read a transaction the network already knows about. */
export async function getTransaction(
  chain: GenLayerChain,
  hash: string,
): Promise<TransactionReceipt | null> {
  const result = await rpc<TransactionReceipt | null>(
    chain.rpcUrl,
    "eth_getTransactionByHash",
    [hash],
  );
  return result;
}

export type WaitOptions = {
  intervalMs?: number;
  timeoutMs?: number;
  onUpdate?: (receipt: TransactionReceipt) => void;
};

/**
 * Wait until the network has decided a transaction. The receipt says whether
 * the contract actually ran, which is not the same as the transaction being
 * accepted, so the caller has to look at the execution result.
 */
export async function waitForReceipt(
  chain: GenLayerChain,
  hash: string,
  options: WaitOptions = {},
): Promise<TransactionReceipt> {
  const interval = options.intervalMs ?? 3000;
  const deadline = Date.now() + (options.timeoutMs ?? 300_000);

  for (;;) {
    const receipt = await getTransaction(chain, hash);
    if (receipt) {
      options.onUpdate?.(receipt);
      if (
        receipt.status_name === "FINALIZED" ||
        receipt.status_name === "CANCELED" ||
        receipt.status_name === "UNDETERMINED"
      ) {
        return receipt;
      }
    }
    if (Date.now() > deadline) {
      throw new GenLayerError(
        "The network has not settled this transaction yet. It is still in the finality window, check back shortly.",
      );
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}

export type ExecutionOutcome = {
  ok: boolean;
  /** The message the contract returned, or the reason it refused. */
  message: string;
  /** The raw value the leader returned, already decoded. */
  value: unknown;
  votes: Record<string, string>;
  leader: string | null;
};

/**
 * Read what the contract actually did. The lifecycle status only says the
 * network accepted the transaction, so the execution result has to be read
 * out of the leader receipt.
 */
export function readExecution(receipt: TransactionReceipt): ExecutionOutcome {
  const entries = receipt.consensus_data?.leader_receipt ?? [];
  const leaderEntry = entries.find((entry) => entry.mode === "leader");

  const votes = receipt.consensus_data?.votes ?? {};
  const leader =
    Object.entries(votes).find(([, vote]) => vote === "agree")?.[0] ?? null;

  if (!leaderEntry) {
    return { ok: false, message: "The network has not published a result yet.", value: null, votes, leader };
  }

  const execution = String(leaderEntry.execution_result ?? "ERROR");
  const result = leaderEntry.result as { status?: string; payload?: unknown } | undefined;
  const payload = result?.payload;

  if (execution !== "SUCCESS") {
    const text =
      typeof payload === "string"
        ? payload
        : "The contract refused the call and the state was rolled back.";
    return { ok: false, message: text, value: null, votes, leader };
  }

  let value: unknown = null;
  if (payload && typeof payload === "object" && "readable" in payload) {
    const readable = (payload as { readable?: string }).readable;
    if (readable) {
      try {
        value = JSON.parse(readable);
      } catch {
        value = readable;
      }
    }
  } else if (typeof payload === "string") {
    try {
      value = JSON.parse(payload);
    } catch {
      value = payload;
    }
  }

  return { ok: true, message: "The contract accepted the call.", value, votes, leader };
}
