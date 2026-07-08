"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle, CircleNotch, Warning } from "@phosphor-icons/react";
import { Body, Button, Heading3, Logo } from "@breadcoop/ui";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import { isContractConfigured } from "@/lib/chain";
import { useBurner } from "@/lib/wallet";
import {
  confirmInteraction,
  friendlyError,
  getInteraction,
  getIdOf,
  type Interaction,
} from "@/lib/zkburn";

type Phase =
  | { kind: "loading"; message: string }
  | { kind: "ready"; id: bigint; interaction: Interaction }
  | { kind: "not-yours"; interaction: Interaction }
  | { kind: "success" }
  | { kind: "error"; message: string };

function AuthorizeInteraction() {
  const searchParams = useSearchParams();
  const idParam = searchParams.get("id");
  const { account, walletClient, address } = useBurner("john");
  const [phase, setPhase] = useState<Phase>({ kind: "loading", message: "Loading interaction…" });
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!isContractConfigured) {
      setPhase({ kind: "error", message: "Contract not configured." });
      return;
    }
    if (idParam === null || idParam === "" || !/^\d+$/.test(idParam)) {
      setPhase({ kind: "error", message: "No authorization id provided. This link is invalid." });
      return;
    }
    if (!address) return;
    const id = BigInt(idParam);
    (async () => {
      try {
        const interaction = await getInteraction(id);
        if (interaction.confirmedAt !== 0n) {
          setPhase({ kind: "error", message: "This interaction has already been authorized." });
          return;
        }
        const myId = await getIdOf(address);
        if (!myId || myId.toLowerCase() !== interaction.johnId.toLowerCase()) {
          setPhase({ kind: "not-yours", interaction });
          return;
        }
        setPhase({ kind: "ready", id, interaction });
      } catch (e) {
        setPhase({ kind: "error", message: friendlyError(e) || "Invalid or expired authorization id." });
      }
    })();
  }, [idParam, address]);

  const authorize = useCallback(async () => {
    if (phase.kind !== "ready" || !walletClient || !account) return;
    setConfirming(true);
    try {
      await confirmInteraction(walletClient, account, phase.id);
      setPhase({ kind: "success" });
    } catch (e) {
      setPhase({ kind: "error", message: friendlyError(e) });
    } finally {
      setConfirming(false);
    }
  }, [phase, walletClient, account]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper-main px-4 py-12">
      <div className="w-full max-w-md">
        <Link href="/app" className="mb-6 flex items-center justify-center gap-2">
          <Logo color="orange" size={24} />
          <span className="font-breadDisplay text-lg font-bold text-surface-ink">ZKBurn</span>
        </Link>
        <Card className="text-center">
          <CardHeader>
            <CardTitle className="text-2xl">Interaction authorization</CardTitle>
            <CardDescription>Finalizing the mutual consent for this interaction.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {phase.kind === "loading" && (
              <div className="space-y-3 py-6">
                <CircleNotch className="mx-auto h-12 w-12 animate-spin text-core-orange" weight="bold" />
                <Body>{phase.message}</Body>
              </div>
            )}

            {phase.kind === "ready" && (
              <div className="space-y-4 py-2">
                <p className="text-sm text-surface-grey-2">
                  Worker{" "}
                  <span className="break-all font-mono text-surface-ink">{phase.interaction.workerId}</span>{" "}
                  requests to log an interaction with your JohnID.
                </p>
                <Button
                  app="fund"
                  variant="primary"
                  className="w-full"
                  isLoading={confirming}
                  showChildrenWhenLoading
                  onClick={authorize}
                >
                  {confirming ? "Authorizing…" : "Authorize interaction"}
                </Button>
              </div>
            )}

            {phase.kind === "success" && (
              <div className="space-y-3 py-6">
                <CheckCircle className="mx-auto h-16 w-16 text-system-green" weight="fill" />
                <Heading3>Success</Heading3>
                <Body>Interaction successfully authorized and recorded.</Body>
              </div>
            )}

            {phase.kind === "not-yours" && (
              <div className="space-y-3 py-6">
                <Warning className="mx-auto h-12 w-12 text-system-warning" weight="fill" />
                <Heading3>This request isn&apos;t for your ID</Heading3>
                <p className="text-sm text-surface-grey-2">
                  This request is addressed to a different JohnID than the one bound to this device.
                  Open this link on the device where you generated your JohnID.
                </p>
                <Button as={Link} href="/john/portal" app="fund" variant="secondary">
                  Open John&apos;s Portal
                </Button>
              </div>
            )}

            {phase.kind === "error" && (
              <div className="space-y-3 py-6">
                <Warning className="mx-auto h-12 w-12 text-system-red" weight="fill" />
                <Heading3>Authorization failed</Heading3>
                <Body>{phase.message}</Body>
              </div>
            )}

            <Button app="fund" variant="secondary" className="w-full" onClick={() => window.close()}>
              Close window
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense>
      <AuthorizeInteraction />
    </Suspense>
  );
}
