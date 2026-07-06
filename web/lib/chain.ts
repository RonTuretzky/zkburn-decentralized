import { createPublicClient, http } from "viem";
import { zkburnAbi } from "./abi";
import { gnosis } from "viem/chains";

/**
 * ZKBurn V2 on Gnosis mainnet (chain 100), deployed via the etherform GitHub
 * Actions workflow and verified on Blockscout. Override with NEXT_PUBLIC_ZKBURN_ADDRESS.
 */
export const FALLBACK_ZKBURN_ADDRESS =
  "0xE8bE1A3C20a484c66668c500E6306968f92ceb88" as const;

export const ZKBURN_ADDRESS = ((process.env.NEXT_PUBLIC_ZKBURN_ADDRESS ??
  "") !== ""
  ? process.env.NEXT_PUBLIC_ZKBURN_ADDRESS
  : FALLBACK_ZKBURN_ADDRESS) as `0x${string}`;

export const isContractConfigured =
  ZKBURN_ADDRESS.toLowerCase() !== `0x${"0".repeat(40)}`;

export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ?? "https://rpc.gnosischain.com";

export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "1";

/** devMode for zkPassport requests — default true until launch hardening. */
export const ZKPASSPORT_DEVMODE =
  (process.env.NEXT_PUBLIC_ZKPASSPORT_DEVMODE ?? "true") !== "false";

export const ZKBURN_SCOPE = "zkburn-v1";

/** Subpath the app is served from (e.g. "/zkburn-decentralized" on GitHub Pages; "" locally). */
export const APP_BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const BLOCKSCOUT_URL = "https://gnosis.blockscout.com";

export const contractExplorerUrl = `${BLOCKSCOUT_URL}/address/${ZKBURN_ADDRESS}`;

export const publicClient = createPublicClient({
  chain: gnosis,
  transport: http(RPC_URL),
});

export { zkburnAbi };
