/**
 * A local signer that behaves like a browser wallet.
 *
 * The point is to drive the interface through the same code path a person
 * would: the interface builds the transaction, this signs it, and the node
 * runs the consensus. Nothing is stubbed out between the interface and the
 * contract.
 */
import { privateKeyToAccount } from "viem/accounts";
import { hexToBigInt, numberToHex } from "viem";

import type { Eip1193Provider } from "../src/lib/genlayer/client";

export type LocalSigner = Eip1193Provider & {
  address: `0x${string}`;
  /** Every transaction that was sent, for the test to look at. */
  sent: Array<{ to: string; data: string; value: string; signedValue: bigint }>;
};

async function rpc<T>(url: string, method: string, params: unknown[]): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const text = await response.text();
  if (!text) throw new Error(`the node returned nothing for ${method}`);
  let payload: { result?: T; error?: { message?: string } };
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`the node did not answer with JSON for ${method}`);
  }
  if (payload.error) {
    throw new Error(payload.error.message ?? `the node refused ${method}`);
  }
  return payload.result as T;
}

export type SimConfig = {
  /** The page the validator will read, keyed by its address. */
  web?: Record<string, { status: number; body: string }>;
  /** The answer the validator will give, keyed by a pattern in the prompt. */
  llm?: Record<string, string>;
};

/**
 * Build a provider that signs locally and submits the raw transaction to the
 * node, which is what a browser wallet does.
 */
export function createLocalSigner(
  privateKey: `0x${string}`,
  chainId: number,
  rpcUrl: string,
  simConfig?: SimConfig,
): LocalSigner {
  const account = privateKeyToAccount(privateKey);
  const sent: LocalSigner["sent"] = [];

  const provider: LocalSigner = {
    address: account.address,
    sent,
    request: async ({ method, params }) => {
      switch (method) {
        case "eth_accounts":
        case "eth_requestAccounts":
          return [account.address];

        case "eth_chainId":
          return numberToHex(chainId);

        case "eth_getTransactionCount":
          return rpc<string>(rpcUrl, "eth_getTransactionCount", params ?? []);

        case "eth_gasPrice":
          return rpc<string>(rpcUrl, "eth_gasPrice", []);

        case "eth_estimateGas":
          return rpc<string>(rpcUrl, "eth_estimateGas", params ?? []);

        case "eth_sendTransaction": {
          const [request] = (params ?? []) as [
            {
              from: `0x${string}`;
              to: `0x${string}`;
              data?: `0x${string}`;
              value?: `0x${string}`;
              gas?: `0x${string}`;
            },
          ];
          const nonce = hexToBigInt(
            (await rpc<string>(rpcUrl, "eth_getTransactionCount", [
              request.from,
              "pending",
            ])) as `0x${string}`,
          );
          const gas = request.gas
            ? BigInt(request.gas)
            : BigInt(
                await rpc<string>(rpcUrl, "eth_estimateGas", [
                  {
                    from: request.from,
                    to: request.to,
                    data: request.data ?? "0x",
                    value: request.value ?? "0x0",
                  },
                ]),
              );

          const signed = await account.signTransaction({
            chainId,
            nonce: Number(nonce),
            gas,
            gasPrice: 0n,
            to: request.to,
            data: request.data ?? "0x",
            value: BigInt(request.value ?? "0x0"),
          });

          sent.push({
            to: request.to,
            data: request.data ?? "0x",
            value: request.value ?? "0x0",
            signedValue: BigInt(request.value ?? "0x0"),
          });

          // The local node can be told what the page and the model will say,
          // so the whole flow runs the same way every time.
          const sim = simConfig
            ? {
                validators: [
                  {
                    plugin_config: {
                      mock_web_response: { nondet_web_request: simConfig.web ?? {} },
                      mock_response: { response: simConfig.llm ?? {} },
                    },
                  },
                ],
              }
            : undefined;

          return rpc<string>(rpcUrl, "eth_sendRawTransaction", [signed, sim]);
        }

        default:
          return rpc<unknown>(rpcUrl, method, params ?? []);
      }
    },
  };

  return provider;
}
