"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { Flame, Loader, QrCode, Search, ThumbsUp } from "lucide-react";
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
  Textarea,
} from "@/components/ui";
import { WalletFooter } from "@/components/wallet-footer";
import { isContractConfigured } from "@/lib/chain";
import { useBurner } from "@/lib/wallet";
import {
  burnJohn,
  checkStatus,
  friendlyError,
  parseJohnId,
  proposeInteraction,
  vouchJohn,
  type JohnStatus,
} from "@/lib/zkburn";

type Result = { kind: "success" | "error" | "warning"; title: string; message: string };

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
  const { account, walletClient } = useBurner("worker");

  // Card 1: check status
  const [checkId, setCheckId] = useState("");
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<Result | null>(null);
  const [checkedStatus, setCheckedStatus] = useState<JohnStatus | null>(null);

  // Card 2: interaction request
  const [requestId, setRequestId] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [requestResult, setRequestResult] = useState<Result | null>(null);
  const [interactionUrl, setInteractionUrl] = useState<string | null>(null);

  // Card 3: vouch
  const [vouchId, setVouchId] = useState("");
  const [vouching, setVouching] = useState(false);
  const [vouchResult, setVouchResult] = useState<Result | null>(null);

  // Card 4: burn
  const [burnId, setBurnId] = useState("");
  const [burnNote, setBurnNote] = useState("");
  const [burning, setBurning] = useState(false);
  const [burnResult, setBurnResult] = useState<Result | null>(null);

  const doCheck = useCallback(async () => {
    setCheckedStatus(null);
    if (!checkId.trim()) {
      setCheckResult({ kind: "error", title: "Error", message: "Please enter a John ID." });
      return;
    }
    const id = parseJohnId(checkId);
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
          message: `This ID is BURNED. Proceed with caution.${st.lastBurnNote ? ` Note: ${st.lastBurnNote}` : ""}`,
        });
      } else {
        setCheckResult({
          kind: "success",
          title: `Status for ID: ${shortId}`,
          message: `This ID is clean with ${st.vouchCount} positive vouch(es).`,
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
    if (!requestId.trim()) {
      setRequestResult({
        kind: "error",
        title: "Error",
        message: "John's Anonymous ID is required.",
      });
      return;
    }
    const id = parseJohnId(requestId);
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
        `${window.location.origin}/authorize-interaction?id=${interactionId.toString()}`,
      );
      setRequestResult({
        kind: "success",
        title: "Request Generated",
        message: "Interaction request generated. Share the link or QR code with John.",
      });
    } catch (e) {
      setRequestResult({ kind: "error", title: "Error", message: friendlyError(e) });
    } finally {
      setRequesting(false);
    }
  }, [requestId, walletClient, account]);

  const doVouch = useCallback(async () => {
    if (!vouchId.trim()) {
      setVouchResult({ kind: "error", title: "Error", message: "John's Anonymous ID is required." });
      return;
    }
    const id = parseJohnId(vouchId);
    if (!id) {
      setVouchResult({
        kind: "error",
        title: "Error",
        message: "Invalid JohnID — expected a 32-byte hex string (0x…).",
      });
      return;
    }
    if (!walletClient || !account) return;
    setVouching(true);
    setVouchResult(null);
    try {
      await vouchJohn(walletClient, account, id, "");
      setVouchResult({
        kind: "success",
        title: "Success",
        message: "Successfully vouched for John's ID.",
      });
    } catch (e) {
      setVouchResult({ kind: "error", title: "Error", message: friendlyError(e, "vouch") });
    } finally {
      setVouching(false);
    }
  }, [vouchId, walletClient, account]);

  const doBurn = useCallback(async () => {
    if (!burnId.trim()) {
      setBurnResult({ kind: "error", title: "Error", message: "John's Anonymous ID is required." });
      return;
    }
    const id = parseJohnId(burnId);
    if (!id) {
      setBurnResult({
        kind: "error",
        title: "Error",
        message: "Invalid JohnID — expected a 32-byte hex string (0x…).",
      });
      return;
    }
    if (!walletClient || !account) return;
    setBurning(true);
    setBurnResult(null);
    try {
      await burnJohn(walletClient, account, id, burnNote);
      setBurnResult({
        kind: "success",
        title: "Success",
        message: "John's ID burned successfully.",
      });
    } catch (e) {
      setBurnResult({ kind: "error", title: "Error", message: friendlyError(e, "burn") });
    } finally {
      setBurning(false);
    }
  }, [burnId, burnNote, walletClient, account]);

  return (
    <main className="min-h-screen bg-black px-4 py-12">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-4xl font-bold text-white">Worker&apos;s Dashboard</h1>
        <p className="mt-2 text-gray-400">
          Check a client&apos;s ID, manage interactions, and build reputation.
        </p>

        {!isContractConfigured && (
          <Alert variant="warning" className="mt-6">
            <AlertTitle>Contract not configured</AlertTitle>
            <AlertDescription>
              Set NEXT_PUBLIC_ZKBURN_ADDRESS to the deployed ZKBurn address.
            </AlertDescription>
          </Alert>
        )}

        {/* Card 1 */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl text-gray-200">
              <Search className="h-5 w-5" /> 1. Check Client ID Status
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

        <div className="mt-8 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {/* Card 2 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl text-gray-200">
                <QrCode className="h-5 w-5" /> 2. Generate Interaction Request
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Label htmlFor="request-id">John&apos;s Anonymous ID</Label>
              <Input
                id="request-id"
                placeholder="Enter John's ZK-ID"
                value={requestId}
                onChange={(e) => setRequestId(e.target.value)}
              />
              <Button
                onClick={doRequest}
                disabled={requesting}
                className="w-full bg-gray-700 text-white hover:bg-gray-600"
              >
                {requesting ? <Loader className="h-4 w-4 animate-spin" /> : "Generate Request"}
              </Button>
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

          {/* Card 3 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl text-gray-200">
                <ThumbsUp className="h-5 w-5" /> 3. Vouch for John
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Label htmlFor="vouch-id">John&apos;s Anonymous ID</Label>
              <Input
                id="vouch-id"
                placeholder="Enter John's ZK-ID"
                value={vouchId}
                onChange={(e) => setVouchId(e.target.value)}
              />
              <Button
                onClick={doVouch}
                disabled={vouching}
                className="w-full bg-green-800 text-white hover:bg-green-700"
              >
                {vouching ? <Loader className="h-4 w-4 animate-spin" /> : "Give Vouch"}
              </Button>
            </CardContent>
            <CardFooter>
              <ResultAlert result={vouchResult} />
            </CardFooter>
          </Card>

          {/* Card 4 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl text-gray-200">
                <Flame className="h-5 w-5" /> 4. Burn John
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Label htmlFor="burn-id">John&apos;s Anonymous ID to Burn</Label>
              <Input
                id="burn-id"
                placeholder="Enter John's ZK-ID"
                value={burnId}
                onChange={(e) => setBurnId(e.target.value)}
              />
              <Label htmlFor="burn-note">Note (Optional, Public On-Chain)</Label>
              <Textarea
                id="burn-note"
                placeholder="Add a note about the incident..."
                value={burnNote}
                onChange={(e) => setBurnNote(e.target.value)}
              />
              <Button
                onClick={doBurn}
                disabled={burning}
                className="w-full bg-red-800 text-white hover:bg-red-700"
              >
                {burning ? <Loader className="h-4 w-4 animate-spin" /> : "Burn John"}
              </Button>
            </CardContent>
            <CardFooter>
              <ResultAlert result={burnResult} />
            </CardFooter>
          </Card>
        </div>

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
