/**
 * Network settings for the GenLayer Studio network.
 *
 * The values come from the chain definition the Python SDK uses, so the
 * browser and the SDK agree on what a transaction has to look like.
 *
 * The RPC and the contract can be pointed somewhere else without touching
 * the code, by setting these in the deployment:
 *
 *   NEXT_PUBLIC_GENLAYER_RPC_URL       the node to talk to
 *   NEXT_PUBLIC_TRUSTRY_CONTRACT        the Trustry contract to read and write
 *   NEXT_PUBLIC_GENLAYER_EXPLORER_URL   the explorer for the links
 *
 * They all have a working default, so nothing has to be set.
 */

export const STUDIONET = {
  id: 61999,
  name: "GenLayer Studio Network",
  shortName: "studionet",
  currency: { name: "GEN", symbol: "GEN", decimals: 18 },
  rpcUrl:
    process.env.NEXT_PUBLIC_GENLAYER_RPC_URL ?? "https://studio.genlayer.com/api",
  explorerUrl:
    process.env.NEXT_PUBLIC_GENLAYER_EXPLORER_URL ?? "https://explorer-studio.genlayer.com",
  /**
   * Every contract call is submitted to the consensus contract. It routes the
   * call to the intelligent contract and starts the consensus round.
   */
  consensusMainContract: "0xb7278A61aa25c888815aFC32Ad3cC52fF24fE575",
  consensusDataContract: "0x88B0F18613Db92Bf970FfE264E02496e20a74D16",
  numInitialValidators: 5,
  maxRotations: 3,
} as const;

/** The Trustry contract that is live on the studio network. */
export const TRUSTRY_CONTRACT = (
  process.env.NEXT_PUBLIC_TRUSTRY_CONTRACT ??
  "0xd71227403E81BcDC4f0Fa657661687D2773333B0"
) as `0x${string}`;

export type GenLayerChain = typeof STUDIONET;
