"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import {
  AlertTriangle,
  CircleCheckBig,
  ListOrdered,
  Loader,
  UserCheck,
} from "lucide-react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
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
  getJohnIdOf,
  getJohnInteractions,
  registerJohn,
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

  // Recover an existing registration for this burner wallet.
  useEffect(() => {
    if (!address || !isContractConfigured) return;
    getJohnIdOf(address)
      .then((id) => id && setJohnId(id))
      .catch(() => {});
  }, [address]);

  // Poll John's interactions + status while registered.
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
    async (params: Parameters<typeof registerJohn>[2]) => {
      if (!walletClient || !account) return;
      setSubmitting(true);
      setError(null);
      try {
        const { johnId: newId } = await registerJohn(walletClient, account, params);
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
    <main className="flex min-h-screen items-center justify-center bg-black px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-2xl text-white">John&apos;s Portal</CardTitle>
          <CardDescription className="text-center">
            Generate your anonymous ZK-powered ID and authorize interactions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isContractConfigured && (
            <Alert variant="warning">
              <AlertTitle>Contract not configured</AlertTitle>
              <AlertDescription>
                Set NEXT_PUBLIC_ZKBURN_ADDRESS to the deployed ZKBurn address.
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Authentication Error
              </AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* State 1: not registered */}
          {!johnId && (
            <>
              {reg.phase === "qr" ? (
                <div className="space-y-3 rounded-lg border border-gray-700 bg-gray-900 p-4 text-center">
                  <p className="text-sm text-gray-300">
                    Scan with the <span className="font-semibold text-white">ZKPassport app</span> to
                    prove you&apos;re a real person — without revealing who you are.
                  </p>
                  <div className="mx-auto w-fit rounded-lg bg-white p-2">
                    <QRCodeSVG value={reg.url} size={192} fgColor="#111827" bgColor="#ffffff" />
                  </div>
                  <a
                    href={reg.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block break-all text-xs text-gray-500 underline hover:text-gray-300"
                  >
                    Open link on this device
                  </a>
                  <p className="text-sm text-gray-400">Waiting for scan…</p>
                </div>
              ) : (
                <Button
                  onClick={startRealFlow}
                  disabled={busy || !isContractConfigured}
                  className="w-full bg-white px-8 py-3 text-lg text-black hover:bg-gray-300"
                >
                  {busy ? (
                    <>
                      <Loader className="h-5 w-5 animate-spin" /> Authenticating...
                    </>
                  ) : (
                    <>
                      <UserCheck className="h-5 w-5" /> Generate My Anonymous ID
                    </>
                  )}
                </Button>
              )}

              {reg.phase === "scanned" && (
                <p className="animate-pulse text-center text-sm text-gray-400">
                  Request received — check your phone…
                </p>
              )}
              {reg.phase === "proving" && (
                <p className="animate-pulse text-center text-sm text-gray-400">
                  Generating zero-knowledge proof…
                </p>
              )}
              {submitting && (
                <p className="animate-pulse text-center text-sm text-gray-400">
                  Registering your JohnID on Gnosis Chain…
                </p>
              )}

              {DEMO_MODE && !submitting && (
                <Button
                  onClick={startSimulated}
                  disabled={busy || !isContractConfigured}
                  className="w-full border border-purple-500/50 bg-purple-900/20 text-purple-300 hover:bg-purple-900/40"
                >
                  Simulate proof (demo mode)
                </Button>
              )}
            </>
          )}

          {/* State 2: registered */}
          {johnId && (
            <>
              <div className="space-y-2 rounded-lg border border-gray-700 bg-gray-900 p-4">
                <div className="flex items-center gap-2 text-white">
                  <UserCheck className="h-5 w-5 text-gray-300" />
                  <span className="font-semibold">ID Generated Successfully!</span>
                  {status && <GradeBadge zkVerified={status.zkVerified} devMode={status.devMode} />}
                </div>
                <p className="break-all rounded bg-gray-800 p-2 font-mono text-sm text-white">
                  {johnId}
                </p>
                {status && (
                  <p className="text-xs text-gray-400">
                    {status.isBurned
                      ? `⚠ This ID is BURNED (${status.burnCount} burn${status.burnCount === 1 ? "" : "s"}).`
                      : `This ID is clean with ${status.vouchCount} positive vouch(es).`}
                  </p>
                )}
              </div>

              <div className="space-y-2 rounded-lg border border-gray-700 bg-gray-900 p-4">
                <div className="flex items-center gap-2 font-semibold text-white">
                  <ListOrdered className="h-5 w-5 text-gray-300" /> Next Step
                </div>
                <p className="text-sm text-gray-400">
                  Present this ID to the Worker. Once they verify it, they will show you a QR code to
                  authorize the interaction.
                </p>
              </div>

              {justConfirmed && pending.length === 0 && (
                <div className="space-y-2 py-4 text-center">
                  <CircleCheckBig className="mx-auto h-20 w-20 text-gray-400" />
                  <h3 className="text-2xl font-bold text-white">Interaction Authorized!</h3>
                  <p className="text-gray-400">
                    You have successfully consented to log this interaction.
                  </p>
                </div>
              )}

              {pending.length > 0 && (
                <div className="space-y-2 rounded-lg border border-gray-700 bg-gray-900 p-4">
                  <p className="font-semibold text-white">Pending interaction requests</p>
                  {pending.map(({ id, interaction }) => (
                    <div
                      key={id.toString()}
                      className={`flex items-center justify-between gap-2 rounded border p-2 text-sm ${
                        highlightId === id.toString()
                          ? "border-gray-400 bg-gray-800"
                          : "border-gray-700"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-gray-300">Interaction #{id.toString()}</p>
                        <p className="truncate font-mono text-xs text-gray-500">
                          Worker {interaction.worker}
                        </p>
                      </div>
                      <Button
                        onClick={() => authorize(id)}
                        disabled={confirmingId !== null}
                        className="shrink-0 bg-gray-700 text-white hover:bg-gray-600"
                      >
                        {confirmingId === id ? (
                          <Loader className="h-4 w-4 animate-spin" />
                        ) : (
                          "Authorize"
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          <WalletFooter role="john" />
          <p className="text-center text-xs text-gray-600">
            <Link href="/demo" className="underline hover:text-gray-400">
              ← Back to demo hub
            </Link>
          </p>
        </CardContent>
      </Card>
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
