"use client";

import { sha256, stringToBytes, toHex } from "viem";
import { ZKBURN_SCOPE, ZKPASSPORT_DEVMODE } from "./chain";
import type { ProofVerificationParams } from "./zkburn";

export type RegistrationStatus =
  | { phase: "idle" }
  | { phase: "requesting" }
  | { phase: "qr"; url: string }
  | { phase: "scanned" }
  | { phase: "proving" }
  | { phase: "params"; params: ProofVerificationParams; verified: boolean }
  | { phase: "error"; message: string };

/** zkPassport service scope hashing: bytes32(uint256(sha256(input)) >> 8). */
export function scopeHash(input: string): `0x${string}` {
  const h = BigInt(sha256(stringToBytes(input)));
  return toHex(h >> 8n, { size: 32 });
}

/** The domain used for zkPassport requests and simulated proofs. */
export function serviceDomain(): string {
  // Must match the ZKBURN_DOMAIN the contract was deployed with.
  return process.env.NEXT_PUBLIC_ZKBURN_DOMAIN ?? "zkburn.app";
}

/**
 * Starts a REAL zkPassport registration flow. Returns a cancel function.
 * The QR url is delivered via onStatus({phase:"qr"}); when the user completes
 * the flow in the ZKPassport mobile app, onStatus({phase:"params"}) delivers
 * the Solidity verifier params ready for ZKBurn.registerJohn.
 */
export async function startRegistration({
  johnAddress,
  onStatus,
}: {
  johnAddress: `0x${string}`;
  onStatus: (s: RegistrationStatus) => void;
}): Promise<() => void> {
  onStatus({ phase: "requesting" });
  const { ZKPassport } = await import("@zkpassport/sdk");
  const zkPassport = new ZKPassport(serviceDomain());

  const queryBuilder = await zkPassport.request({
    name: "ZKBurn",
    purpose: "Create your anonymous JohnID",
    scope: ZKBURN_SCOPE,
    mode: "compressed-evm",
    devMode: ZKPASSPORT_DEVMODE,
  });

  const {
    url,
    requestId,
    onRequestReceived,
    onGeneratingProof,
    onResult,
    onReject,
    onError,
  } = queryBuilder
    .gte("age", 18)
    .bind("user_address", johnAddress)
    .bind("chain", "gnosis")
    .done();

  onStatus({ phase: "qr", url });

  onRequestReceived(() => onStatus({ phase: "scanned" }));
  onGeneratingProof(() => onStatus({ phase: "proving" }));
  onReject(() =>
    onStatus({ phase: "error", message: "Request rejected in the ZKPassport app." }),
  );
  onError((err: string) =>
    onStatus({ phase: "error", message: `ZK Passport authentication failed. Please try again. (${err})` }),
  );
  onResult(({ verified, proofs, sdkInstance }) => {
    try {
      const evmProof = proofs.find((p) => p.name?.startsWith("outer_evm"));
      if (!evmProof) {
        onStatus({
          phase: "error",
          message: "No EVM-verifiable proof returned. Please try again.",
        });
        return;
      }
      const params = sdkInstance.getSolidityVerifierParameters({
        proof: evmProof,
        scope: ZKBURN_SCOPE,
        devMode: ZKPASSPORT_DEVMODE,
      }) as unknown as {
        version: string;
        proofVerificationData: { vkeyHash: string; proof: string; publicInputs: string[] };
        committedInputs: string;
        serviceConfig: {
          validityPeriodInSeconds: number;
          domain: string;
          scope: string;
          devMode: boolean;
        };
      };
      onStatus({
        phase: "params",
        verified,
        params: {
          version: params.version as `0x${string}`,
          proofVerificationData: {
            vkeyHash: params.proofVerificationData.vkeyHash as `0x${string}`,
            proof: params.proofVerificationData.proof as `0x${string}`,
            publicInputs: params.proofVerificationData.publicInputs as `0x${string}`[],
          },
          committedInputs: params.committedInputs as `0x${string}`,
          serviceConfig: {
            validityPeriodInSeconds: BigInt(params.serviceConfig.validityPeriodInSeconds),
            domain: params.serviceConfig.domain,
            scope: params.serviceConfig.scope,
            devMode: params.serviceConfig.devMode,
          },
        },
      });
    } catch (e) {
      onStatus({
        phase: "error",
        message: e instanceof Error ? e.message : "Failed to prepare on-chain parameters.",
      });
    }
  });

  return () => zkPassport.cancelRequest(requestId);
}

/**
 * DEMO MODE ONLY: builds well-formed ProofVerificationParams with a random
 * nullifier so the full on-chain flow can be exercised without the ZKPassport
 * mobile app. The contract registers it optimistically and the UI labels it
 * "simulated" — never presented as verified.
 */
export function buildSimulatedParams(): ProofVerificationParams {
  const domain = serviceDomain();
  const nullifierBytes = new Uint8Array(32);
  crypto.getRandomValues(nullifierBytes);
  // Keep well below the BN254 field modulus, like a real nullifier.
  nullifierBytes[0] = 0;

  const now = Math.floor(Date.now() / 1000);
  const publicInputs: `0x${string}`[] = [
    toHex(1n, { size: 32 }), // certificate_registry_root
    toHex(1n, { size: 32 }), // circuit_registry_root
    toHex(BigInt(now), { size: 32 }), // current_date
    scopeHash(domain), // service_scope
    scopeHash(ZKBURN_SCOPE), // service_subscope
    toHex(1n, { size: 32 }), // nullifier_type
    toHex(nullifierBytes), // scoped_nullifier (JohnID)
    toHex(0n, { size: 32 }), // oprf_pk_hash
  ];

  return {
    version: toHex(stringToBytes("simulated", { size: 32 })),
    proofVerificationData: { vkeyHash: toHex(0n, { size: 32 }), proof: "0x", publicInputs },
    committedInputs: "0x",
    serviceConfig: {
      validityPeriodInSeconds: 604800n,
      domain,
      scope: ZKBURN_SCOPE,
      devMode: true,
    },
  };
}
