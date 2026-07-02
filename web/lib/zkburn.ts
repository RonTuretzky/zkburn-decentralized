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
  lastBurnNote: string;
};

export type Interaction = {
  johnId: `0x${string}`;
  worker: `0x${string}`;
  proposedAt: bigint;
  confirmedAt: bigint;
  burnUsed: boolean;
  vouchUsed: boolean;
};

/** Maps contract custom errors to the site's user-facing alert copy. */
export function friendlyError(err: unknown, action?: "burn" | "vouch"): string {
  if (err instanceof BaseError) {
    const revert = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError) {
      switch (revert.data?.errorName) {
        case "NoUsableInteraction":
          return `Cannot ${action ?? "act"}. No prior interaction recorded by you for this JohnID.`;
        case "AlreadyRegistered":
          return "This passport identity is already registered.";
        case "AlreadyBound":
          return "This wallet is already bound to a JohnID.";
        case "AlreadyConfirmed":
          return "This interaction has already been authorized.";
        case "UnknownJohn":
          return "Unknown JohnID.";
        case "NotJohn":
          return "Only the John who owns this ID can authorize the interaction.";
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

async function write(
  walletClient: WalletClient,
  account: PrivateKeyAccount,
  functionName: "registerJohn" | "proposeInteraction" | "confirmInteraction" | "burn" | "vouch",
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

export async function registerJohn(
  walletClient: WalletClient,
  account: PrivateKeyAccount,
  params: ProofVerificationParams,
): Promise<{ johnId: `0x${string}`; hash: Hash }> {
  const { hash, logs } = await write(walletClient, account, "registerJohn", [params]);
  const ev = logs.find((l) => l.eventName === "JohnRegistered");
  if (!ev) throw new Error("JohnRegistered event missing from receipt");
  return { johnId: (ev.args as { johnId: `0x${string}` }).johnId, hash };
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

export async function burnJohn(
  walletClient: WalletClient,
  account: PrivateKeyAccount,
  johnId: `0x${string}`,
  note: string,
): Promise<Hash> {
  const { hash } = await write(walletClient, account, "burn", [johnId, note]);
  return hash;
}

export async function vouchJohn(
  walletClient: WalletClient,
  account: PrivateKeyAccount,
  johnId: `0x${string}`,
  note: string,
): Promise<Hash> {
  const { hash } = await write(walletClient, account, "vouch", [johnId, note]);
  return hash;
}

export async function checkStatus(johnId: `0x${string}`): Promise<JohnStatus> {
  const [exists, zkVerified, devMode, isBurned, burnCount, vouchCount, lastBurnNote] =
    await publicClient.readContract({
      address: ZKBURN_ADDRESS,
      abi: zkburnAbi,
      functionName: "checkStatus",
      args: [johnId],
    });
  return { exists, zkVerified, devMode, isBurned, burnCount, vouchCount, lastBurnNote };
}

export async function getJohnIdOf(address: `0x${string}`): Promise<`0x${string}` | null> {
  const id = await publicClient.readContract({
    address: ZKBURN_ADDRESS,
    abi: zkburnAbi,
    functionName: "johnIdOf",
    args: [address],
  });
  return id === `0x${"0".repeat(64)}` ? null : id;
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

export async function getInteraction(id: bigint): Promise<Interaction> {
  return await publicClient.readContract({
    address: ZKBURN_ADDRESS,
    abi: zkburnAbi,
    functionName: "getInteraction",
    args: [id],
  });
}

export async function canAct(
  worker: `0x${string}`,
  johnId: `0x${string}`,
): Promise<{ canBurn: boolean; canVouch: boolean }> {
  const [canBurn, canVouch] = await publicClient.readContract({
    address: ZKBURN_ADDRESS,
    abi: zkburnAbi,
    functionName: "canAct",
    args: [worker, johnId],
  });
  return { canBurn, canVouch };
}

/** Normalizes user-typed JohnID input to bytes32 hex. */
export function parseJohnId(input: string): `0x${string}` | null {
  const s = input.trim();
  if (/^0x[0-9a-fA-F]{64}$/.test(s)) return s as `0x${string}`;
  return null;
}
