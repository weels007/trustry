/**
 * Network settings for the GenLayer Studio network.
 *
 * The values come from the chain definition the Python SDK uses, so the
 * browser and the SDK agree on what a transaction has to look like.
 */

export const STUDIONET = {
  id: 61999,
  name: "GenLayer Studio Network",
  shortName: "studionet",
  currency: { name: "GEN", symbol: "GEN", decimals: 18 },
  rpcUrl: "https://studio.genlayer.com/api",
  explorerUrl: "https://explorer-studio.genlayer.com",
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
export const TRUSTRY_CONTRACT = "0xd71227403E81BcDC4f0Fa657661687D2773333B0";

export type GenLayerChain = typeof STUDIONET;
