import Link from "next/link";
import { contractExplorerUrl, isContractConfigured, ZKBURN_ADDRESS } from "@/lib/chain";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";

export default function DemoHub() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black px-4 py-16">
      <h1 className="mb-2 text-5xl font-bold text-white">ZKBurn Demo</h1>
      <p className="mb-12 text-xl text-gray-400">
        An interactive demonstration of the ZKBurn specification.
      </p>

      <div className="grid w-full max-w-3xl gap-8 md:grid-cols-2">
        <Card className="bg-gray-900 border-gray-800 transition-colors hover:border-gray-600">
          <CardHeader>
            <CardTitle className="text-2xl text-white">John&apos;s Portal</CardTitle>
            <CardDescription>
              For clients (John): Use ZKPassport to generate your anonymous ID and check your burn
              status.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/john/portal">
              <Button className="w-full bg-gray-200 py-6 text-lg text-black hover:bg-gray-300">
                Go to John&apos;s Portal
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800 transition-colors hover:border-gray-600">
          <CardHeader>
            <CardTitle className="text-2xl text-white">Worker&apos;s Dashboard</CardTitle>
            <CardDescription>
              For service providers (Worker): Record interactions and burn a John&apos;s anonymous
              ID.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/worker/dashboard">
              <Button className="w-full bg-gray-200 py-6 text-lg text-black hover:bg-gray-300">
                Go to Worker&apos;s Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <footer className="mt-16 space-y-1 text-center text-sm text-gray-500">
        <p>© 2025 ZKBurn Working Group Demo.</p>
        <p>This demo runs against the real ZKBurn contract on Gnosis Chain.</p>
        {isContractConfigured && (
          <p>
            <a
              href={contractExplorerUrl}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-gray-400 underline hover:text-white"
            >
              {ZKBURN_ADDRESS}
            </a>
          </p>
        )}
      </footer>
    </main>
  );
}
