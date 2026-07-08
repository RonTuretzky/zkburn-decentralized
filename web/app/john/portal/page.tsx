"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { CheckCircle, ListNumbers, SealCheck, Warning } from "@phosphor-icons/react";
import { Body, Button, Heading3, Logo } from "@breadcoop/ui";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  GradeBadge,
} from "@/components/ui";
import { WalletFooter } from "@/components/wallet-footer";
import { DEMO_MODE, isContractConfigured } from "@/lib/chain";
import { useBurner } from "@/lib/wallet";
import {
  confirmInteraction,
  friendlyError,
  getInteraction,
  getIdOf,
  getJohnInteractions,
  register,
  checkStatus,
  type Interaction,
  type JohnStatus,
} from "@/lib/zkburn";
import { buildSimulatedParams, startRegistration, type RegistrationStatus } from "@/lib/zkpassport";

type PendingInteraction = { id: bigint; interaction: Interaction };

function JohnPortal() {
  const { account, walletClient, address } = useBurner("john");
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("interaction");

  const [johnId, setJohnId] = useState<`0x${string}` | null>(null);
  const [status, setStatus] = useState<JohnStatus | null>(null);
  const [reg, setReg] = useState<RegistrationStatus>({ phase: "idle" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingInteraction[]>([]);
  const [confirmingId, setConfirmingId] = useState<bigint | null>(null);
  const [justConfirmed, setJustConfirmed] = useState(false);
  const cancelRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!address || !isContractConfigured) return;
    getIdOf(address)
      .then((id) => id && setJohnId(id))
      .catch(() => {});
  }, [address]);

  const refresh = useCallback(async () => {
    if (!johnId) return;
    try {
      const [ids, st] = await Promise.all([getJohnInteractions(johnId), checkStatus(johnId)]);
      setStatus(st);
      const loaded = await Promise.all(
        ids.map(async (id) => ({ id, interaction: await getInteraction(id) })),
      );
      setPending(loaded.filter((p) => p.interaction.confirmedAt === 0n));
    } catch {
      // transient RPC errors — retry on next poll
    }
  }, [johnId]);

  useEffect(() => {
    if (!johnId) return;
    refresh();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 8_000);
    return () => clearInterval(t);
  }, [johnId, refresh]);

  const submitParams = useCallback(
    async (params: Parameters<typeof register>[2]) => {
      if (!walletClient || !account) return;
      setSubmitting(true);
      setError(null);
      try {
        const { id: newId } = await register(walletClient, account, params);
        setJohnId(newId);
        setReg({ phase: "idle" });
      } catch (e) {
        setError(friendlyError(e));
        setReg({ phase: "idle" });
      } finally {
        setSubmitting(false);
      }
    },
    [walletClient, account],
  );

  const startRealFlow = useCallback(async () => {
    if (!address) return;
    setError(null);
    try {
      cancelRef.current = await startRegistration({
        johnAddress: address,
        onStatus: (s) => {
          setReg(s);
          if (s.phase === "params") submitParams(s.params);
          if (s.phase === "error") setError(s.message);
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "ZK Passport authentication failed. Please try again.");
      setReg({ phase: "idle" });
    }
  }, [address, submitParams]);

  const startSimulated = useCallback(() => {
    cancelRef.current?.();
    setReg({ phase: "idle" });
    submitParams(buildSimulatedParams());
  }, [submitParams]);

  const authorize = useCallback(
    async (id: bigint) => {
      if (!walletClient || !account) return;
      setConfirmingId(id);
      setError(null);
      try {
        await confirmInteraction(walletClient, account, id);
        setJustConfirmed(true);
        await refresh();
      } catch (e) {
        setError(friendlyError(e));
      } finally {
        setConfirmingId(null);
      }
    },
    [walletClient, account, refresh],
  );

  const busy = submitting || reg.phase === "requesting" || reg.phase === "proving";

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper-main px-4 py-12">
      <div className="w-full max-w-md">
        <Link href="/app" className="mb-6 flex items-center justify-center gap-2">
          <Logo color="orange" size={24} />
          <span className="font-breadDisplay text-lg font-bold text-surface-ink">ZKBurn</span>
        </Link>
        <Card>
          <CardHeader>
            <CardTitle className="text-center text-2xl">John&apos;s Portal</CardTitle>
            <CardDescription className="text-center">
              Generate your anonymous zkPassport ID and authorize interactions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isContractConfigured && (
              <Alert variant="warning">
                <AlertTitle>Contract not configured</AlertTitle>
                <AlertDescription>Set NEXT_PUBLIC_ZKBURN_ADDRESS.</AlertDescription>
              </Alert>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertTitle className="flex items-center gap-2">
                  <Warning className="h-4 w-4" weight="bold" /> Authentication error
                </AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {!johnId && (
              <>
                {reg.phase === "qr" ? (
                  <div className="space-y-3 rounded-xl border border-paper-2 bg-paper-1 p-4 text-center">
                    <p className="text-sm text-surface-grey-2">
                      Scan with the <span className="font-semibold text-surface-ink">ZKPassport app</span> to
                      prove you&apos;re a real person — without revealing who you are.
                    </p>
                    <div className="mx-auto w-fit rounded-lg bg-white p-2">
                      <QRCodeSVG value={reg.url} size={192} fgColor="#1b201a" bgColor="#ffffff" />
                    </div>
                    <a
                      href={reg.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block break-all text-xs text-primary-blue underline"
                    >
                      Open link on this device
                    </a>
                    <p className="text-sm text-surface-grey-2">Waiting for scan…</p>
                  </div>
                ) : (
                  <Button
                    app="fund"
                    variant="primary"
                    className="w-full"
                    isLoading={busy}
                    showChildrenWhenLoading
                    leftIcon={!busy ? <SealCheck className="h-5 w-5" weight="bold" /> : undefined}
                    onClick={startRealFlow}
                    disabled={busy || !isContractConfigured}
                  >
                    {busy ? "Authenticating…" : "Generate My Anonymous ID"}
                  </Button>
                )}

                {reg.phase === "scanned" && (
                  <p className="text-center text-sm text-surface-grey-2">Request received — check your phone…</p>
                )}
                {reg.phase === "proving" && (
                  <p className="text-center text-sm text-surface-grey-2">Generating zero-knowledge proof…</p>
                )}
                {submitting && (
                  <p className="text-center text-sm text-surface-grey-2">
                    Registering your JohnID on Gnosis Chain…
                  </p>
                )}

                {DEMO_MODE && !submitting && (
                  <Button
                    app="fund"
                    variant="secondary"
                    className="w-full"
                    onClick={startSimulated}
                    disabled={busy || !isContractConfigured}
                  >
                    Simulate proof (dev only)
                  </Button>
                )}
              </>
            )}

            {johnId && (
              <>
                <div className="space-y-2 rounded-xl border border-paper-2 bg-paper-1 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <SealCheck className="h-5 w-5 text-system-green" weight="fill" />
                    <span className="font-semibold text-surface-ink">ID generated</span>
                    {status && <GradeBadge zkVerified={status.zkVerified} devMode={status.devMode} />}
                  </div>
                  <p className="break-all rounded bg-paper-0 p-2 font-mono text-sm text-surface-ink">
                    {johnId}
                  </p>
                  {status && (
                    <p className="text-xs text-surface-grey-2">
                      {status.isBurned
                        ? `⚠ This ID is burned by ${status.distinctBurners} worker(s).`
                        : `Clean — ${status.vouchCount} vouch(es) from ${status.distinctVouchers} worker(s).`}
                    </p>
                  )}
                </div>

                <div className="space-y-2 rounded-xl border border-paper-2 bg-paper-1 p-4">
                  <div className="flex items-center gap-2 font-semibold text-surface-ink">
                    <ListNumbers className="h-5 w-5 text-core-orange" weight="bold" /> Next step
                  </div>
                  <p className="text-sm text-surface-grey-2">
                    Present this ID to the worker. When they record an interaction, authorize it below
                    to consent to logging it on-chain.
                  </p>
                </div>

                {justConfirmed && pending.length === 0 && (
                  <div className="space-y-2 py-4 text-center">
                    <CheckCircle className="mx-auto h-16 w-16 text-system-green" weight="fill" />
                    <Heading3>Interaction authorized</Heading3>
                    <Body>You have successfully consented to log this interaction.</Body>
                  </div>
                )}

                {pending.length > 0 && (
                  <div className="space-y-2 rounded-xl border border-paper-2 bg-paper-1 p-4">
                    <p className="font-semibold text-surface-ink">Pending interaction requests</p>
                    {pending.map(({ id, interaction }) => (
                      <div
                        key={id.toString()}
                        className={`flex items-center justify-between gap-2 rounded-lg border p-2 text-sm ${
                          highlightId === id.toString()
                            ? "border-core-orange bg-orange-0"
                            : "border-paper-2 bg-paper-0"
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="text-surface-ink">Interaction #{id.toString()}</p>
                          <p className="truncate font-mono text-xs text-surface-grey">
                            Worker {interaction.workerId}
                          </p>
                        </div>
                        <Button
                          app="fund"
                          variant="primary"
                          size="sm"
                          isLoading={confirmingId === id}
                          onClick={() => authorize(id)}
                          disabled={confirmingId !== null}
                        >
                          Authorize
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            <WalletFooter role="john" />
            <p className="text-center text-xs text-surface-grey">
              <Link href="/app" className="underline">
                ← Back
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense>
      <JohnPortal />
    </Suspense>
  );
}
