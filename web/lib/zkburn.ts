"use client";

import {
  BaseError,
  ContractFunctionRevertedError,
  parseEventLogs,
  type Hash,
  type WalletClient,
} from "viem";
import type { PrivateKeyAccount } from "viem/accounts";
import { gnosis } from "viem/chains";
import { publicClient, zkburnAbi, ZKBURN_ADDRESS } from "./chain";

export type ProofVerificationParams = {
  version: `0x${string}`;
  proofVerificationData: {
    vkeyHash: `0x${string}`;
    proof: `0x${string}`;
    publicInputs: `0x${string}`[];
  };
  committedInputs: `0x${string}`;
  serviceConfig: {
    validityPeriodInSeconds: bigint;
    domain: string;
    scope: string;
    devMode: boolean;
  };
};

export type JohnStatus = {
  exists: boolean;
  zkVerified: boolean;
  devMode: boolean;
  isBurned: boolean;
  burnCount: number;
  vouchCount: number;
  distinctBurners: number;
  distinctVouchers: number;
  lastBurnNote: string;
};

export type Interaction = {
  workerId: `0x${string}`;
  johnId: `0x${string}`;
  proposedAt: bigint;
  confirmedAt: bigint;
  burnUsed: boolean;
  vouchUsed: boolean;
};

export type InteractionCapabilities = {
  canBurn: boolean;
  canVouch: boolean;
  canRetractBurn: boolean;
  canRetractVouch: boolean;
};

const ZERO = `0x${"0".repeat(64)}` as const;

/** Maps contract custom errors to user-facing alert copy. */
export function friendlyError(err: unknown, action?: "burn" | "vouch"): string {
  if (err instanceof BaseError) {
    const revert = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError) {
      switch (revert.data?.errorName) {
        case "NotRegistered":
          return "You must register as a worker before recording interactions.";
        case "NotWorker":
          return `Cannot ${action ?? "act"}. This interaction was not recorded by you.`;
        case "NotConfirmed":
          return "This interaction hasn't been confirmed by the client yet.";
        case "BurnAlreadyUsed":
          return "You have already burned this interaction.";
        case "VouchAlreadyUsed":
          return "You have already vouched for this interaction.";
        case "NotBurned":
          return "There is no active burn to retract on this interaction.";
        case "NotVouched":
          return "There is no active vouch to retract on this interaction.";
        case "AlreadyRegistered":
          return "This passport identity is already registered.";
        case "AlreadyBound":
          return "This wallet is already bound to an identity.";
        case "AlreadyConfirmed":
          return "This interaction has already been authorized.";
        case "UnknownJohn":
          return "Unknown JohnID — the client must register first.";
        case "SelfInteraction":
          return "You cannot record an interaction with your own ID.";
        case "NotJohn":
          return "Only the client who owns this ID can authorize the interaction.";
        case "ScopeMismatch":
          return "Proof scope mismatch — this proof was not generated for ZKBurn.";
        case "DomainMismatch":
          return "Proof domain mismatch — this proof was not generated for ZKBurn.";
        case "ProofExpired":
          return "The proof has expired. Please generate a new one.";
        case "InvalidProof":
          return "ZK Passport authentication failed. Please try again.";
        case "NullifierMismatch":
          return "Proof identifier mismatch. Please try again.";
        case "InvalidPublicInputs":
          return "Malformed proof. Please try again.";
      }
    }
    if (err.shortMessage?.includes("exceeds the balance")) {
      return "Insufficient xDAI. Fund this burner wallet with a little xDAI to transact.";
    }
    return err.shortMessage ?? "Transaction failed. Check console.";
  }
  return err instanceof Error ? err.message : "Unexpected error. Check console.";
}

type WriteFn =
  | "register"
  | "proposeInteraction"
  | "confirmInteraction"
  | "burn"
  | "vouch"
  | "retractBurn"
  | "retractVouch";

async function write(
  walletClient: WalletClient,
  account: PrivateKeyAccount,
  functionName: WriteFn,
  args: readonly unknown[],
): Promise<{ hash: Hash; logs: ReturnType<typeof parseEventLogs<typeof zkburnAbi>> }> {
  const { request } = await publicClient.simulateContract({
    address: ZKBURN_ADDRESS,
    abi: zkburnAbi,
    functionName,
    args: args as never,
    account,
    chain: gnosis,
  });
  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const logs = parseEventLogs({ abi: zkburnAbi, logs: receipt.logs });
  return { hash, logs };
}

export async function register(
  walletClient: WalletClient,
  account: PrivateKeyAccount,
  params: ProofVerificationParams,
): Promise<{ id: `0x${string}`; hash: Hash }> {
  const { hash, logs } = await write(walletClient, account, "register", [params]);
  const ev = logs.find((l) => l.eventName === "Registered");
  if (!ev) throw new Error("Registered event missing from receipt");
  return { id: (ev.args as { id: `0x${string}` }).id, hash };
}

export async function proposeInteraction(
  walletClient: WalletClient,
  account: PrivateKeyAccount,
  johnId: `0x${string}`,
): Promise<{ id: bigint; hash: Hash }> {
  const { hash, logs } = await write(walletClient, account, "proposeInteraction", [johnId]);
  const ev = logs.find((l) => l.eventName === "InteractionProposed");
  if (!ev) throw new Error("InteractionProposed event missing from receipt");
  return { id: (ev.args as { id: bigint }).id, hash };
}

export async function confirmInteraction(
  walletClient: WalletClient,
  account: PrivateKeyAccount,
  id: bigint,
): Promise<Hash> {
  const { hash } = await write(walletClient, account, "confirmInteraction", [id]);
  return hash;
}

export async function burn(
  walletClient: WalletClient,
  account: PrivateKeyAccount,
  interactionId: bigint,
  note: string,
): Promise<Hash> {
  const { hash } = await write(walletClient, account, "burn", [interactionId, note]);
  return hash;
}

export async function vouch(
  walletClient: WalletClient,
  account: PrivateKeyAccount,
  interactionId: bigint,
  note: string,
): Promise<Hash> {
  const { hash } = await write(walletClient, account, "vouch", [interactionId, note]);
  return hash;
}

export async function retractBurn(
  walletClient: WalletClient,
  account: PrivateKeyAccount,
  interactionId: bigint,
): Promise<Hash> {
  const { hash } = await write(walletClient, account, "retractBurn", [interactionId]);
  return hash;
}

export async function retractVouch(
  walletClient: WalletClient,
  account: PrivateKeyAccount,
  interactionId: bigint,
): Promise<Hash> {
  const { hash } = await write(walletClient, account, "retractVouch", [interactionId]);
  return hash;
}

export async function checkStatus(johnId: `0x${string}`): Promise<JohnStatus> {
  const [
    exists,
    zkVerified,
    devMode,
    isBurned,
    burnCount,
    vouchCount,
    distinctBurners,
    distinctVouchers,
    lastBurnNote,
  ] = await publicClient.readContract({
    address: ZKBURN_ADDRESS,
    abi: zkburnAbi,
    functionName: "checkStatus",
    args: [johnId],
  });
  return {
    exists,
    zkVerified,
    devMode,
    isBurned,
    burnCount,
    vouchCount,
    distinctBurners,
    distinctVouchers,
    lastBurnNote,
  };
}

/** Returns the identity id bound to an address, or null if unregistered. */
export async function getIdOf(address: `0x${string}`): Promise<`0x${string}` | null> {
  const id = await publicClient.readContract({
    address: ZKBURN_ADDRESS,
    abi: zkburnAbi,
    functionName: "idOf",
    args: [address],
  });
  return id === ZERO ? null : id;
}

export async function getJohnInteractions(johnId: `0x${string}`): Promise<bigint[]> {
  const ids = await publicClient.readContract({
    address: ZKBURN_ADDRESS,
    abi: zkburnAbi,
    functionName: "getJohnInteractions",
    args: [johnId],
  });
  return [...ids];
}

export async function getWorkerInteractions(workerId: `0x${string}`): Promise<bigint[]> {
  const ids = await publicClient.readContract({
    address: ZKBURN_ADDRESS,
    abi: zkburnAbi,
    functionName: "getWorkerInteractions",
    args: [workerId],
  });
  return [...ids];
}

export async function getInteraction(id: bigint): Promise<Interaction> {
  return await publicClient.readContract({
    address: ZKBURN_ADDRESS,
    abi: zkburnAbi,
    functionName: "getInteraction",
    args: [id],
  });
}

export async function interactionCapabilities(
  interactionId: bigint,
  caller: `0x${string}`,
): Promise<InteractionCapabilities> {
  const [canBurn, canVouch, canRetractBurn, canRetractVouch] = await publicClient.readContract({
    address: ZKBURN_ADDRESS,
    abi: zkburnAbi,
    functionName: "interactionCapabilities",
    args: [interactionId, caller],
  });
  return { canBurn, canVouch, canRetractBurn, canRetractVouch };
}

/** Normalizes user-typed JohnID input to bytes32 hex. */
export function parseJohnId(input: string): `0x${string}` | null {
  const s = input.trim();
  if (/^0x[0-9a-fA-F]{64}$/.test(s)) return s as `0x${string}`;
  return null;
}
