"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { Flame, Loader, QrCode, Search, ThumbsUp, UserCheck, Undo2 } from "lucide-react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  GradeBadge,
  Input,
  Label,
} from "@/components/ui";
import { WalletFooter } from "@/components/wallet-footer";
import { APP_BASE_PATH, DEMO_MODE, isContractConfigured } from "@/lib/chain";
import { useBurner } from "@/lib/wallet";
import {
  burn,
  checkStatus,
  friendlyError,
  getIdOf,
  getInteraction,
  getWorkerInteractions,
  interactionCapabilities,
  parseJohnId,
  proposeInteraction,
  register,
  retractBurn,
  retractVouch,
  vouch,
  type Interaction,
  type InteractionCapabilities,
  type JohnStatus,
} from "@/lib/zkburn";
import { buildSimulatedParams, startRegistration, type RegistrationStatus } from "@/lib/zkpassport";

type Result = { kind: "success" | "error" | "warning"; title: string; message: string };
type Row = { id: bigint; interaction: Interaction; caps: InteractionCapabilities };

function ResultAlert({ result }: { result: Result | null }) {
  if (!result) return null;
  return (
    <Alert
      variant={
        result.kind === "error" ? "destructive" : result.kind === "warning" ? "warning" : "default"
      }
      className="mt-4"
    >
      <AlertTitle>{result.title}</AlertTitle>
      <AlertDescription>{result.message}</AlertDescription>
    </Alert>
  );
}

export default function WorkerDashboard() {
  const { account, walletClient, address } = useBurner("worker");

  // Worker identity
  const [workerId, setWorkerId] = useState<`0x${string}` | null>(null);
  const [reg, setReg] = useState<RegistrationStatus>({ phase: "idle" });
  const [registering, setRegistering] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);

  // Card: check status
  const [checkId, setCheckId] = useState("");
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<Result | null>(null);
  const [checkedStatus, setCheckedStatus] = useState<JohnStatus | null>(null);

  // Card: interaction request
  const [requestId, setRequestId] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [requestResult, setRequestResult] = useState<Result | null>(null);
  const [interactionUrl, setInteractionUrl] = useState<string | null>(null);

  // Your interactions
  const [rows, setRows] = useState<Row[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  // Recover worker identity for this burner.
  useEffect(() => {
    if (!address || !isContractConfigured) return;
    getIdOf(address)
      .then((id) => id && setWorkerId(id))
      .catch(() => {});
  }, [address]);

  const refreshInteractions = useCallback(async () => {
    if (!workerId || !address) return;
    try {
      const ids = await getWorkerInteractions(workerId);
      const loaded = await Promise.all(
        ids.map(async (id) => ({
          id,
          interaction: await getInteraction(id),
          caps: await interactionCapabilities(id, address),
        })),
      );
      setRows(loaded.reverse()); // newest first
    } catch {
      // transient RPC errors — retry on next poll
    }
  }, [workerId, address]);

  useEffect(() => {
    if (!workerId) return;
    refreshInteractions();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") refreshInteractions();
    }, 8_000);
    return () => clearInterval(t);
  }, [workerId, refreshInteractions]);

  // -- worker registration --
  const submitRegistration = useCallback(
    async (params: Parameters<typeof register>[2]) => {
      if (!walletClient || !account) return;
      setRegistering(true);
      setRegError(null);
      try {
        const { id } = await register(walletClient, account, params);
        setWorkerId(id);
        setReg({ phase: "idle" });
      } catch (e) {
        setRegError(friendlyError(e));
        setReg({ phase: "idle" });
      } finally {
        setRegistering(false);
      }
    },
    [walletClient, account],
  );

  const startRealRegistration = useCallback(async () => {
    if (!address) return;
    setRegError(null);
    try {
      await startRegistration({
        johnAddress: address,
        onStatus: (s) => {
          setReg(s);
          if (s.phase === "params") submitRegistration(s.params);
          if (s.phase === "error") setRegError(s.message);
        },
      });
    } catch (e) {
      setRegError(e instanceof Error ? e.message : "ZK Passport authentication failed.");
      setReg({ phase: "idle" });
    }
  }, [address, submitRegistration]);

  const busyReg = registering || reg.phase === "requesting" || reg.phase === "proving";

  // -- card actions --
  const doCheck = useCallback(async () => {
    setCheckedStatus(null);
    const id = parseJohnId(checkId);
    if (!checkId.trim()) {
      setCheckResult({ kind: "error", title: "Error", message: "Please enter a John ID." });
      return;
    }
    if (!id) {
      setCheckResult({
        kind: "error",
        title: "Error",
        message: "Invalid JohnID — expected a 32-byte hex string (0x…).",
      });
      return;
    }
    setChecking(true);
    setCheckResult(null);
    try {
      const st = await checkStatus(id);
      setCheckedStatus(st);
      const shortId = `${checkId.trim().slice(0, 15)}...`;
      if (!st.exists) {
        setCheckResult({
          kind: "error",
          title: `Status for ID: ${shortId}`,
          message: "Unknown JohnID — this ID has never been registered.",
        });
      } else if (st.isBurned) {
        setCheckResult({
          kind: "warning",
          title: `Status for ID: ${shortId}`,
          message: `This ID is BURNED by ${st.distinctBurners} distinct worker(s) (${st.burnCount} burn${st.burnCount === 1 ? "" : "s"}). Proceed with caution.${st.lastBurnNote ? ` Latest note: ${st.lastBurnNote}` : ""}`,
        });
      } else {
        setCheckResult({
          kind: "success",
          title: `Status for ID: ${shortId}`,
          message: `This ID is clean with ${st.vouchCount} vouch(es) from ${st.distinctVouchers} distinct worker(s).`,
        });
      }
    } catch (e) {
      setCheckResult({ kind: "error", title: "Error", message: friendlyError(e) });
    } finally {
      setChecking(false);
    }
  }, [checkId]);

  const doRequest = useCallback(async () => {
    setInteractionUrl(null);
    const id = parseJohnId(requestId);
    if (!requestId.trim()) {
      setRequestResult({ kind: "error", title: "Error", message: "John's Anonymous ID is required." });
      return;
    }
    if (!id) {
      setRequestResult({
        kind: "error",
        title: "Error",
        message: "Invalid JohnID — expected a 32-byte hex string (0x…).",
      });
      return;
    }
    if (!walletClient || !account) return;
    setRequesting(true);
    setRequestResult(null);
    try {
      const { id: interactionId } = await proposeInteraction(walletClient, account, id);
      setInteractionUrl(
        `${window.location.origin}${APP_BASE_PATH}/authorize-interaction/?id=${interactionId.toString()}`,
      );
      setRequestResult({
        kind: "success",
        title: "Request Generated",
        message: "Interaction request recorded. Share the link or QR code with John to confirm.",
      });
      refreshInteractions();
    } catch (e) {
      setRequestResult({ kind: "error", title: "Error", message: friendlyError(e) });
    } finally {
      setRequesting(false);
    }
  }, [requestId, walletClient, account, refreshInteractions]);

  const rowAction = useCallback(
    async (
      id: bigint,
      fn: (
        wc: NonNullable<typeof walletClient>,
        acc: NonNullable<typeof account>,
        interactionId: bigint,
        note: string,
      ) => Promise<unknown>,
      needsNote: boolean,
    ) => {
      if (!walletClient || !account) return;
      setRowBusy(id.toString());
      setRowError(null);
      try {
        await fn(walletClient, account, id, needsNote ? (notes[id.toString()] ?? "") : "");
        await refreshInteractions();
      } catch (e) {
        setRowError(friendlyError(e));
      } finally {
        setRowBusy(null);
      }
    },
    [walletClient, account, notes, refreshInteractions],
  );

  const short = (id: string) => `${id.slice(0, 10)}…${id.slice(-6)}`;

  return (
    <main className="min-h-screen bg-black px-4 py-12">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-4xl font-bold text-white">Worker&apos;s Dashboard</h1>
        <p className="mt-2 text-gray-400">
          Check a client&apos;s ID, record consented interactions, and build reputation.
        </p>

        {!isContractConfigured && (
          <Alert variant="warning" className="mt-6">
            <AlertTitle>Contract not configured</AlertTitle>
            <AlertDescription>Set NEXT_PUBLIC_ZKBURN_ADDRESS.</AlertDescription>
          </Alert>
        )}

        {/* Worker registration gate */}
        {isContractConfigured && !workerId && (
          <Card className="mt-8 border-purple-500/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl text-gray-200">
                <UserCheck className="h-5 w-5" /> Register as a worker
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-gray-400">
                Recording interactions requires a zkPassport-verified identity — this makes burns
                and vouches count as coming from a distinct, unique person (Sybil resistance). Your
                identity stays anonymous: only a per-app nullifier is stored.
              </p>
              {regError && (
                <Alert variant="destructive">
                  <AlertTitle>Registration Error</AlertTitle>
                  <AlertDescription>{regError}</AlertDescription>
                </Alert>
              )}
              {reg.phase === "qr" ? (
                <div className="space-y-3 rounded-lg border border-gray-700 bg-gray-900 p-4 text-center">
                  <p className="text-sm text-gray-300">Scan with the ZKPassport app.</p>
                  <div className="mx-auto w-fit rounded-lg bg-white p-2">
                    <QRCodeSVG value={reg.url} size={176} fgColor="#111827" bgColor="#ffffff" />
                  </div>
                  <p className="text-sm text-gray-400">Waiting for scan…</p>
                </div>
              ) : (
                <Button
                  onClick={startRealRegistration}
                  disabled={busyReg}
                  className="bg-white px-6 py-3 text-black hover:bg-gray-200"
                >
                  {busyReg ? (
                    <>
                      <Loader className="h-5 w-5 animate-spin" /> Registering…
                    </>
                  ) : (
                    <>
                      <UserCheck className="h-5 w-5" /> Register My Worker ID
                    </>
                  )}
                </Button>
              )}
              {DEMO_MODE && !busyReg && (
                <Button
                  onClick={() => submitRegistration(buildSimulatedParams())}
                  className="ml-0 border border-purple-500/50 bg-purple-900/20 text-purple-300 hover:bg-purple-900/40 sm:ml-3"
                >
                  Simulate proof (demo mode)
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {workerId && (
          <p className="mt-4 flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <UserCheck className="h-3.5 w-3.5" /> Registered worker ID{" "}
            <span className="font-mono text-gray-400">{short(workerId)}</span>
          </p>
        )}

        {/* Card: Check Client ID Status */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl text-gray-200">
              <Search className="h-5 w-5" /> Check Client ID Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="check-id">John&apos;s Anonymous ID</Label>
            <div className="flex gap-2">
              <Input
                id="check-id"
                placeholder="Enter or scan John's ZK-ID"
                value={checkId}
                onChange={(e) => setCheckId(e.target.value)}
              />
              <Button
                onClick={doCheck}
                disabled={checking}
                className="bg-gray-700 text-white hover:bg-gray-600"
              >
                {checking ? <Loader className="h-4 w-4 animate-spin" /> : "Check"}
              </Button>
            </div>
            {checkedStatus?.exists && (
              <div className="pt-1">
                <GradeBadge zkVerified={checkedStatus.zkVerified} devMode={checkedStatus.devMode} />
              </div>
            )}
          </CardContent>
          <CardFooter>
            <ResultAlert result={checkResult} />
          </CardFooter>
        </Card>

        {/* Card: Generate Interaction Request */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl text-gray-200">
              <QrCode className="h-5 w-5" /> Record an Interaction
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="request-id">John&apos;s Anonymous ID</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="request-id"
                placeholder="Enter John's ZK-ID"
                value={requestId}
                onChange={(e) => setRequestId(e.target.value)}
                disabled={!workerId}
              />
              <Button
                onClick={doRequest}
                disabled={requesting || !workerId}
                className="bg-gray-700 text-white hover:bg-gray-600 sm:w-56"
              >
                {requesting ? <Loader className="h-4 w-4 animate-spin" /> : "Generate Request"}
              </Button>
            </div>
            {!workerId && <p className="text-xs text-gray-500">Register a worker ID first.</p>}
          </CardContent>
          <CardFooter>
            <ResultAlert result={requestResult} />
            {interactionUrl && (
              <div className="mt-4 space-y-2 rounded-lg border border-gray-700 bg-gray-900 p-4 text-center">
                <p className="font-semibold text-white">Show this to John</p>
                <div className="mx-auto w-fit rounded-lg bg-white p-2">
                  <QRCodeSVG value={interactionUrl} size={128} fgColor="#111827" bgColor="#ffffff" />
                </div>
                <a
                  href={interactionUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block break-all text-xs text-gray-500 underline hover:text-gray-300"
                >
                  {interactionUrl}
                </a>
              </div>
            )}
          </CardFooter>
        </Card>

        {/* Your interactions */}
        {workerId && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl text-gray-200">
                Your Interactions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {rowError && (
                <Alert variant="destructive">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{rowError}</AlertDescription>
                </Alert>
              )}
              {rows.length === 0 && (
                <p className="text-sm text-gray-500">
                  No interactions yet. Record one above; once the client authorizes it you can vouch
                  or burn.
                </p>
              )}
              {rows.map(({ id, interaction, caps }) => {
                const key = id.toString();
                const confirmed = interaction.confirmedAt !== 0n;
                const busy = rowBusy === key;
                return (
                  <div
                    key={key}
                    className="space-y-2 rounded-lg border border-gray-700 bg-gray-900 p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm text-gray-300">
                          Interaction #{key} with{" "}
                          <span className="font-mono text-gray-400">{short(interaction.johnId)}</span>
                        </p>
                        <p className="text-xs">
                          {confirmed ? (
                            <span className="text-green-400">Confirmed by client</span>
                          ) : (
                            <span className="text-yellow-400">Awaiting client authorization</span>
                          )}
                          {interaction.burnUsed && <span className="text-red-400"> · burned</span>}
                          {interaction.vouchUsed && <span className="text-green-400"> · vouched</span>}
                        </p>
                      </div>
                    </div>

                    {confirmed && (caps.canBurn || caps.canVouch) && (
                      <Input
                        placeholder="Optional note (public, immutable)…"
                        value={notes[key] ?? ""}
                        onChange={(e) => setNotes((n) => ({ ...n, [key]: e.target.value }))}
                        className="text-sm"
                      />
                    )}

                    {confirmed && (
                      <div className="flex flex-wrap gap-2">
                        {caps.canVouch && (
                          <Button
                            onClick={() => rowAction(id, vouch, true)}
                            disabled={busy}
                            className="bg-green-800 text-white hover:bg-green-700"
                          >
                            {busy ? <Loader className="h-4 w-4 animate-spin" /> : <ThumbsUp className="h-4 w-4" />}
                            Vouch
                          </Button>
                        )}
                        {caps.canBurn && (
                          <Button
                            onClick={() => rowAction(id, burn, true)}
                            disabled={busy}
                            className="bg-red-800 text-white hover:bg-red-700"
                          >
                            {busy ? <Loader className="h-4 w-4 animate-spin" /> : <Flame className="h-4 w-4" />}
                            Burn
                          </Button>
                        )}
                        {caps.canRetractVouch && (
                          <Button
                            onClick={() => rowAction(id, (w, a, i) => retractVouch(w, a, i), false)}
                            disabled={busy}
                            className="border border-gray-600 text-gray-300 hover:bg-gray-800"
                          >
                            <Undo2 className="h-4 w-4" /> Retract vouch
                          </Button>
                        )}
                        {caps.canRetractBurn && (
                          <Button
                            onClick={() => rowAction(id, (w, a, i) => retractBurn(w, a, i), false)}
                            disabled={busy}
                            className="border border-gray-600 text-gray-300 hover:bg-gray-800"
                          >
                            <Undo2 className="h-4 w-4" /> Retract burn
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        <div className="mx-auto mt-8 max-w-md">
          <WalletFooter role="worker" />
          <p className="mt-2 text-center text-xs text-gray-600">
            <Link href="/demo" className="underline hover:text-gray-400">
              ← Back to demo hub
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
