import Link from "next/link";
import { Body, Button, Caption, Heading1, Heading2, Heading3, Logo } from "@breadcoop/ui";
import { contractExplorerUrl, isContractConfigured, ZKBURN_ADDRESS } from "@/lib/chain";

const problems = [
  {
    title: 'Unverifiable "bad lists"',
    body: "Existing safety lists are unverifiable rumor mills. Entries can be fabricated, and there is no proof an interaction ever took place.",
  },
  {
    title: "Privacy compromise",
    body: "Sharing names, phone numbers, or photos exposes both workers and clients to doxxing, stalking, and legal risk.",
  },
  {
    title: "Censorship & deplatforming",
    body: "Centralized platforms can be shut down, subpoenaed, or quietly censored — taking the community's safety data with them.",
  },
  {
    title: "Exclusive, gated access",
    body: "Many screening tools are expensive or gatekept, leaving the most vulnerable workers without protection.",
  },
];

const values = [
  {
    title: "Empowerment & agency",
    body: "Workers hold the pen. Burns and vouches come only from workers who can prove a mutually authorized interaction.",
  },
  {
    title: "Verifiable & trustworthy",
    body: "Every record is anchored to a consented, on-chain interaction — no fabricated entries, no hearsay.",
  },
  {
    title: "A balanced system",
    body: "Burns and vouches, not a blacklist: good clients benefit from proving they are good.",
  },
  {
    title: "Community protection",
    body: "One worker's warning instantly protects every other worker who checks the same JohnID.",
  },
];

const features = [
  {
    title: "Anonymous identity",
    body: "Clients and workers prove they are a real, unique adult with zkPassport. The proof's scoped nullifier becomes their ID — no name, no document data, ever.",
  },
  {
    title: "Immutable records",
    body: "Data stored on-chain cannot be erased or edited by anyone — not John, not the worker, not the maintainers.",
  },
  {
    title: "Sybil-resistant reputation",
    body: "Because workers are verified-unique too, status reports how many distinct people flagged or vouched — not just a raw count.",
  },
  {
    title: "Verified burns with notes",
    body: "Burning requires a mutually authorized interaction, preventing abuse. A worker can retract their own burn to correct a mistake.",
  },
  {
    title: "Decentralized trust",
    body: "No backend, no admin keys. The app talks directly to an ownerless smart contract on Gnosis Chain.",
  },
  {
    title: "Non-profit & open",
    body: "An open-specification project. All contracts and code are open source and permissionlessly forkable.",
  },
];

const johnSteps = [
  {
    title: "Generate an anonymous ID",
    body: "Using zkPassport, you prove you're a real person without revealing your identity. This creates a unique, anonymous JohnID.",
  },
  {
    title: "Authorize interactions",
    body: "You confirm a worker's interaction request from your bound wallet — signalling consent to log the interaction on-chain.",
  },
];

const workerSteps = [
  {
    title: "Register as a worker",
    body: "Prove you're a unique person with zkPassport. Your identity stays anonymous, but your burns and vouches now carry verifiable weight.",
  },
  {
    title: "Check a client's ID",
    body: "Before an interaction, look up the client's JohnID: is it burned, and by how many distinct workers? How many vouches does it have?",
  },
  {
    title: "Record an interaction",
    body: "You and the client mutually authorize the interaction, creating a permanent, consented on-chain record.",
  },
  {
    title: "Vouch or burn",
    body: "After a positive interaction, give a vouch. After a harmful one, burn the ID with a note. Each is retractable by you.",
  },
];

function Timeline({ steps }: { steps: { title: string; body: string }[] }) {
  return (
    <ol className="relative ml-4 space-y-8 border-l border-paper-2">
      {steps.map((s, i) => (
        <li key={s.title} className="relative ml-8">
          <span className="absolute -left-12 flex h-8 w-8 items-center justify-center rounded-full bg-core-orange text-sm font-semibold text-white ring-4 ring-paper-main">
            {i + 1}
          </span>
          <h4 className="font-breadDisplay text-lg font-semibold text-surface-ink">{s.title}</h4>
          <p className="mt-1 text-surface-grey-2">{s.body}</p>
        </li>
      ))}
    </ol>
  );
}

export default function Landing() {
  return (
    <main className="bg-paper-main">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-paper-2 bg-paper-main/80 backdrop-blur-lg">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <Logo color="orange" size={28} />
            <span className="font-breadDisplay text-xl font-bold text-surface-ink">ZKBurn</span>
          </Link>
          <Button as={Link} href="/app" app="fund" variant="secondary" size="sm">
            Open app
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-4 py-20 md:py-28">
        <div className="container mx-auto max-w-3xl text-center">
          <Heading1>Verifiable, anonymous safety for sex workers</Heading1>
          <div className="mt-6">
            <Body>
              ZKBurn lets clients (&quot;John&quot;) generate a private, verifiable ID with zkPassport.
              Workers record consented interactions and, if necessary, &quot;burn&quot; an ID — building a
              trustworthy, anonymous safety net that no one can censor or fake.
            </Body>
          </div>
          <div className="mt-10 flex justify-center">
            <Button as={Link} href="/app" app="fund" variant="primary">
              Open the app
            </Button>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="bg-paper-0 px-4 py-16">
        <div className="container mx-auto">
          <div className="text-center">
            <Heading2>The problem: no safe, private accountability</Heading2>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {problems.map((p) => (
              <div key={p.title} className="rounded-2xl border border-paper-2 bg-paper-main p-6">
                <Heading3>{p.title}</Heading3>
                <p className="mt-3 text-surface-grey-2">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-4 py-16">
        <div className="container mx-auto">
          <div className="text-center">
            <Heading2>How it works</Heading2>
          </div>
          <div className="mt-12 grid gap-14 md:grid-cols-2">
            <div>
              <h3 className="mb-6 font-breadDisplay text-2xl font-semibold text-surface-ink">
                For John (the client)
              </h3>
              <Timeline steps={johnSteps} />
            </div>
            <div>
              <h3 className="mb-6 font-breadDisplay text-2xl font-semibold text-surface-ink">
                For the worker
              </h3>
              <Timeline steps={workerSteps} />
            </div>
          </div>
        </div>
      </section>

      {/* Value */}
      <section className="bg-paper-0 px-4 py-16">
        <div className="container mx-auto">
          <div className="text-center">
            <Heading2>Empowerment through technology</Heading2>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {values.map((v) => (
              <div key={v.title} className="rounded-2xl border border-paper-2 bg-paper-main p-6">
                <Heading3>{v.title}</Heading3>
                <p className="mt-3 text-surface-grey-2">{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-4 py-16">
        <div className="container mx-auto">
          <div className="text-center">
            <Heading2>Core features</Heading2>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="rounded-2xl border border-paper-2 bg-paper-0 p-6">
                <Heading3>{f.title}</Heading3>
                <p className="mt-3 text-surface-grey-2">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech + CTA */}
      <section className="bg-paper-0 px-4 py-16">
        <div className="container mx-auto max-w-3xl text-center">
          <Heading2>Built on zkPassport, Solidity &amp; Gnosis Chain</Heading2>
          <div className="mt-4">
            <Body>
              Anonymous identity from zkPassport, on-chain logic in Solidity, and decentralized,
              immutable record-keeping on Gnosis Chain.
            </Body>
          </div>
          {isContractConfigured && (
            <p className="mt-6 text-sm text-surface-grey-2">
              Live contract:{" "}
              <a
                href={contractExplorerUrl}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-primary-blue underline"
              >
                {ZKBURN_ADDRESS}
              </a>
            </p>
          )}
          <div className="mt-10 flex justify-center">
            <Button as={Link} href="/app" app="fund" variant="primary">
              Open the app
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-paper-2 bg-paper-main px-4 py-10">
        <div className="container mx-auto space-y-1 text-center">
          <Caption>ZKBurn is an open-specification project (CC-BY-SA-4.0).</Caption>
          <Caption>Runs against a live, ownerless contract on Gnosis Chain.</Caption>
        </div>
      </footer>
    </main>
  );
}
