"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, CheckCircle, Loader } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import { isContractConfigured } from "@/lib/chain";
import { useBurner } from "@/lib/wallet";
import {
  confirmInteraction,
  friendlyError,
  getInteraction,
  getJohnIdOf,
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
  const [phase, setPhase] = useState<Phase>({
    kind: "loading",
    message: "Loading interaction…",
  });
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!isContractConfigured) {
      setPhase({ kind: "error", message: "Contract not configured." });
      return;
    }
    if (idParam === null || idParam === "" || !/^\d+$/.test(idParam)) {
      setPhase({
        kind: "error",
        message: "No authorization id provided. This link is invalid.",
      });
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
        const myJohnId = await getJohnIdOf(address);
        if (!myJohnId || myJohnId.toLowerCase() !== interaction.johnId.toLowerCase()) {
          setPhase({ kind: "not-yours", interaction });
          return;
        }
        setPhase({ kind: "ready", id, interaction });
      } catch (e) {
        setPhase({
          kind: "error",
          message: friendlyError(e) || "Invalid or expired authorization id.",
        });
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
    <main className="flex min-h-screen items-center justify-center bg-black px-4 py-12">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle className="text-2xl text-white">Interaction Authorization</CardTitle>
          <CardDescription>Finalizing the mutual consent for this interaction.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {phase.kind === "loading" && (
            <div className="space-y-3 py-6">
              <Loader className="mx-auto h-12 w-12 animate-spin text-gray-400" />
              <p className="text-gray-400">{phase.message}</p>
            </div>
          )}

          {phase.kind === "ready" && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-gray-400">
                Worker{" "}
                <span className="break-all font-mono text-gray-300">
                  {phase.interaction.worker}
                </span>{" "}
                requests to log an interaction with your JohnID.
              </p>
              <Button
                onClick={authorize}
                disabled={confirming}
                className="w-full bg-white py-3 text-lg text-black hover:bg-gray-300"
              >
                {confirming ? (
                  <>
                    <Loader className="h-5 w-5 animate-spin" /> Authorizing your interaction...
                  </>
                ) : (
                  "Authorize Interaction"
                )}
              </Button>
            </div>
          )}

          {phase.kind === "success" && (
            <div className="space-y-3 py-6">
              <CheckCircle className="mx-auto h-16 w-16 text-gray-400" />
              <p className="font-semibold text-white">Success!</p>
              <p className="text-gray-400">Interaction successfully authorized and recorded.</p>
            </div>
          )}

          {phase.kind === "not-yours" && (
            <div className="space-y-3 py-6">
              <AlertTriangle className="mx-auto h-12 w-12 text-yellow-500" />
              <p className="font-semibold text-yellow-400">This request isn&apos;t for your ID</p>
              <p className="text-sm text-gray-400">
                This interaction request is addressed to JohnID{" "}
                <span className="break-all font-mono">{phase.interaction.johnId}</span>, which is not
                bound to this device&apos;s wallet. Open this link on the device where you generated
                your JohnID.
              </p>
              <Link href="/john/portal">
                <Button className="border border-gray-600 text-gray-300 hover:bg-gray-800">
                  Open John&apos;s Portal
                </Button>
              </Link>
            </div>
          )}

          {phase.kind === "error" && (
            <div className="space-y-3 py-6">
              <AlertTriangle className="mx-auto h-12 w-12 text-red-500" />
              <p className="font-semibold text-red-400">Authorization Failed</p>
              <p className="text-gray-400">{phase.message}</p>
            </div>
          )}

          <Button
            onClick={() => window.close()}
            className="border border-gray-600 text-gray-300 hover:bg-gray-800"
          >
            Close Window
          </Button>
        </CardContent>
      </Card>
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
