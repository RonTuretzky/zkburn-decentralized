import Link from "next/link";
import { Body, Button, Caption, Heading1, Heading3, Logo } from "@breadcoop/ui";
import { contractExplorerUrl, isContractConfigured, ZKBURN_ADDRESS } from "@/lib/chain";
import { Card, CardContent } from "@/components/ui";

export default function AppHome() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-paper-main px-4 py-16">
      <Link href="/" className="mb-8 flex items-center gap-2">
        <Logo color="orange" size={28} />
        <span className="font-breadDisplay text-xl font-bold text-surface-ink">ZKBurn</span>
      </Link>

      <div className="text-center">
        <Heading1>Choose how you&apos;re using ZKBurn</Heading1>
        <div className="mt-3">
          <Body>You&apos;ll get an anonymous, in-browser wallet — no personal account or wallet to connect.</Body>
        </div>
      </div>

      <div className="mt-12 grid w-full max-w-3xl gap-6 md:grid-cols-2">
        <Card className="transition-colors hover:border-core-orange/50">
          <CardContent className="flex flex-col gap-4 p-8">
            <Heading3>I&apos;m a client (John)</Heading3>
            <p className="text-surface-grey-2">
              Generate your anonymous zkPassport ID, then authorize interactions a worker records with
              you.
            </p>
            <Button as={Link} href="/john/portal" app="fund" variant="primary">
              Open John&apos;s Portal
            </Button>
          </CardContent>
        </Card>

        <Card className="transition-colors hover:border-core-orange/50">
          <CardContent className="flex flex-col gap-4 p-8">
            <Heading3>I&apos;m a worker</Heading3>
            <p className="text-surface-grey-2">
              Register your verified worker ID, check a client&apos;s status, record consented
              interactions, and vouch or burn.
            </p>
            <Button as={Link} href="/worker/dashboard" app="fund" variant="primary">
              Open Worker&apos;s Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>

      <footer className="mt-14 space-y-1 text-center">
        <Caption>Runs against a live, ownerless ZKBurn contract on Gnosis Chain.</Caption>
        {isContractConfigured && (
          <a
            href={contractExplorerUrl}
            target="_blank"
            rel="noreferrer"
            className="block font-mono text-xs text-primary-blue underline"
          >
            {ZKBURN_ADDRESS}
          </a>
        )}
      </footer>
    </main>
  );
}
