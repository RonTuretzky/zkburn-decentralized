import { createPublicClient, http } from "viem";
import { gnosis } from "viem/chains";

/**
 * Latest deployed ZKBurn on Gnosis mainnet (chain 100), deployed via the
 * etherform GitHub Actions workflow and verified on Blockscout.
 * Override with NEXT_PUBLIC_ZKBURN_ADDRESS.
 */
export const FALLBACK_ZKBURN_ADDRESS =
  "0x772fA3dde14AAEeCD3c98E9b26E07a9afFfC46b4" as const;

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

/**
 * Hand-written ABI matching contracts/src/ZKBurn.sol exactly
 * (per SPEC.md contract section; integration step diffs against forge inspect).
 */
export const zkburnAbi = [
  // ---- Custom errors ----
  { type: "error", name: "NoUsableInteraction", inputs: [] },
  { type: "error", name: "ScopeMismatch", inputs: [] },
  { type: "error", name: "ProofExpired", inputs: [] },
  { type: "error", name: "AlreadyRegistered", inputs: [] },
  { type: "error", name: "NotJohn", inputs: [] },
  { type: "error", name: "AlreadyConfirmed", inputs: [] },
  { type: "error", name: "UnknownJohn", inputs: [] },
  { type: "error", name: "InvalidProof", inputs: [] },
  { type: "error", name: "AlreadyBound", inputs: [] },
  { type: "error", name: "NullifierMismatch", inputs: [] },
  { type: "error", name: "InvalidPublicInputs", inputs: [] },
  { type: "error", name: "DomainMismatch", inputs: [] },
  // ---- Events ----
  {
    type: "event",
    name: "JohnRegistered",
    inputs: [
      { name: "johnId", type: "bytes32", indexed: true },
      { name: "account", type: "address", indexed: true },
      { name: "zkVerified", type: "bool", indexed: false },
      { name: "devMode", type: "bool", indexed: false },
    ],
  },
  {
    type: "event",
    name: "InteractionProposed",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "johnId", type: "bytes32", indexed: true },
      { name: "worker", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "InteractionConfirmed",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "johnId", type: "bytes32", indexed: true },
      { name: "worker", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "JohnBurned",
    inputs: [
      { name: "johnId", type: "bytes32", indexed: true },
      { name: "worker", type: "address", indexed: true },
      { name: "interactionId", type: "uint256", indexed: false },
      { name: "note", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "JohnVouched",
    inputs: [
      { name: "johnId", type: "bytes32", indexed: true },
      { name: "worker", type: "address", indexed: true },
      { name: "interactionId", type: "uint256", indexed: false },
      { name: "note", type: "string", indexed: false },
    ],
  },
  // ---- Writes ----
  {
    type: "function",
    name: "registerJohn",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "version", type: "bytes32" },
          {
            name: "proofVerificationData",
            type: "tuple",
            components: [
              { name: "vkeyHash", type: "bytes32" },
              { name: "proof", type: "bytes" },
              { name: "publicInputs", type: "bytes32[]" },
            ],
          },
          { name: "committedInputs", type: "bytes" },
          {
            name: "serviceConfig",
            type: "tuple",
            components: [
              { name: "validityPeriodInSeconds", type: "uint256" },
              { name: "domain", type: "string" },
              { name: "scope", type: "string" },
              { name: "devMode", type: "bool" },
            ],
          },
        ],
      },
    ],
    outputs: [{ name: "johnId", type: "bytes32" }],
  },
  {
    type: "function",
    name: "proposeInteraction",
    stateMutability: "nonpayable",
    inputs: [{ name: "johnId", type: "bytes32" }],
    outputs: [{ name: "id", type: "uint256" }],
  },
  {
    type: "function",
    name: "confirmInteraction",
    stateMutability: "nonpayable",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "burn",
    stateMutability: "nonpayable",
    inputs: [
      { name: "johnId", type: "bytes32" },
      { name: "note", type: "string" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "vouch",
    stateMutability: "nonpayable",
    inputs: [
      { name: "johnId", type: "bytes32" },
      { name: "note", type: "string" },
    ],
    outputs: [],
  },
  // ---- Views ----
  {
    type: "function",
    name: "checkStatus",
    stateMutability: "view",
    inputs: [{ name: "johnId", type: "bytes32" }],
    outputs: [
      { name: "exists", type: "bool" },
      { name: "zkVerified", type: "bool" },
      { name: "devMode", type: "bool" },
      { name: "isBurned", type: "bool" },
      { name: "burnCount", type: "uint32" },
      { name: "vouchCount", type: "uint32" },
      { name: "lastBurnNote", type: "string" },
    ],
  },
  {
    type: "function",
    name: "getBurns",
    stateMutability: "view",
    inputs: [{ name: "johnId", type: "bytes32" }],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "worker", type: "address" },
          { name: "timestamp", type: "uint64" },
          { name: "interactionId", type: "uint256" },
          { name: "note", type: "string" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "getVouches",
    stateMutability: "view",
    inputs: [{ name: "johnId", type: "bytes32" }],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "worker", type: "address" },
          { name: "timestamp", type: "uint64" },
          { name: "interactionId", type: "uint256" },
          { name: "note", type: "string" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "getInteraction",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "johnId", type: "bytes32" },
          { name: "worker", type: "address" },
          { name: "proposedAt", type: "uint64" },
          { name: "confirmedAt", type: "uint64" },
          { name: "burnUsed", type: "bool" },
          { name: "vouchUsed", type: "bool" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "interactionCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "getJohnInteractions",
    stateMutability: "view",
    inputs: [{ name: "johnId", type: "bytes32" }],
    outputs: [{ name: "", type: "uint256[]" }],
  },
  {
    type: "function",
    name: "getWorkerInteractions",
    stateMutability: "view",
    inputs: [{ name: "worker", type: "address" }],
    outputs: [{ name: "", type: "uint256[]" }],
  },
  {
    type: "function",
    name: "canAct",
    stateMutability: "view",
    inputs: [
      { name: "worker", type: "address" },
      { name: "johnId", type: "bytes32" },
    ],
    outputs: [
      { name: "canBurn", type: "bool" },
      { name: "canVouch", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "johnIdOf",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bytes32" }],
  },
] as const;
