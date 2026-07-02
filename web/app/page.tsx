import Link from "next/link";
import { contractExplorerUrl, isContractConfigured, ZKBURN_ADDRESS } from "@/lib/chain";
import { Button } from "@/components/ui";

const problems = [
  {
    title: 'Unverifiable "Bad Lists"',
    body: "Existing safety lists are unverifiable rumor mills. Entries can be fabricated, and there is no proof an interaction ever took place.",
  },
  {
    title: "Privacy Compromise",
    body: "Sharing names, phone numbers, or photos exposes both workers and clients to doxxing, stalking, and legal risk.",
  },
  {
    title: "Censorship & Deplatforming",
    body: "Centralized platforms can be shut down, subpoenaed, or quietly censored — taking the community's safety data with them.",
  },
  {
    title: "Exclusive & Gated Access",
    body: "Many screening tools are expensive or gatekept, leaving the most vulnerable workers without protection.",
  },
];

const values = [
  {
    title: "Empowerment & Agency",
    body: "Workers hold the pen. Burns and vouches come only from workers who can prove a mutually authorized interaction.",
  },
  {
    title: "Verifiable & Trustworthy",
    body: "Every record is anchored to a consented, on-chain interaction — no fabricated entries, no hearsay.",
  },
  {
    title: "Build a Trusted System",
    body: "A balanced reputation of burns and vouches, not a blacklist: good clients benefit from proving they are good.",
  },
  {
    title: "Community Protection",
    body: "One worker's warning instantly protects every other worker who checks the same JohnID.",
  },
];

const features = [
  {
    title: "Anonymous Identity",
    body: "Clients prove they are a real, unique adult with zkPassport. The proof's scoped nullifier becomes their JohnID — no name, no document data, ever.",
  },
  {
    title: "Immutable Records",
    body: "Data stored on-chain cannot be erased or modified by anyone — not John, not the Worker, not even the system administrators.",
  },
  {
    title: "Verified Burns with Notes",
    body: "Burning requires a mutually authorized interaction with a JohnID, preventing abuse. Optional context notes travel with the burn.",
  },
  {
    title: "Positive Reputation",
    body: "Workers can award vouches for positive interactions, creating a balanced reputation that isn't solely focused on negative interactions.",
  },
  {
    title: "Decentralized Trust",
    body: "No backend, no admin keys. The web app talks directly to an ownerless smart contract on Gnosis Chain.",
  },
  {
    title: "Non-Profit & Open",
    body: "An open-specification project. All contracts and code are open source and permissionlessly forkable.",
  },
];

const johnSteps = [
  {
    title: "Generate Anonymous ID",
    body: "Using ZKPassport, you prove you're a real person without revealing your identity. This creates a unique, anonymous JohnID.",
  },
  {
    title: "Authorize Interaction",
    body: "You present your JohnID and confirm the service provider's interaction request from your wallet to signal your consent for logging the interaction.",
  },
];

const workerSteps = [
  {
    title: "Check John's ID",
    body: "Before the interaction, you ask for the client's JohnID and perform an instant check to ensure it is not already burned and to see their positive vouch count.",
  },
  {
    title: "Record Interaction",
    body: "If the ID is clean, you and John mutually authorize the interaction. This creates a permanent, on-chain record that you both consented to.",
  },
  {
    title: "Burn a John",
    body: 'If the interaction was harmful, you can "burn" the JohnID and add context.',
  },
  {
    title: "Vouch for a Client",
    body: "For positive interactions, you can give a vouch to a JohnID. This contributes to a positive reputation, helping good clients stand out.",
  },
];

function Timeline({ steps }: { steps: { title: string; body: string }[] }) {
  return (
    <ol className="relative border-l border-gray-700 space-y-10 ml-4">
      {steps.map((s, i) => (
        <li key={s.title} className="ml-8 relative">
          <span className="absolute -left-12 flex h-8 w-8 items-center justify-center rounded-full bg-gray-800 ring-4 ring-gray-800 text-gray-300 text-sm font-semibold">
            {i + 1}
          </span>
          <h4 className="text-lg font-semibold text-gray-200">{s.title}</h4>
          <p className="mt-1 text-gray-400">{s.body}</p>
        </li>
      ))}
    </ol>
  );
}

export default function Landing() {
  return (
    <main className="bg-black">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-gray-800 bg-black/80 backdrop-blur-lg">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="text-2xl font-bold text-white">
            ZKBurn
          </Link>
          <Link href="/demo">
            <Button className="text-gray-300 hover:bg-gray-800 hover:text-white">View Demo</Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-black py-20 md:py-32">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white">
            ZKBurn Platform
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-xl text-gray-300">
            Empowering Sex Workers with Verifiable, Anonymous Safety.
          </p>
          <p className="mx-auto mt-4 max-w-3xl text-gray-400">
            ZKBurn allows clients (John) to generate a private, verifiable ID using ZKPassport. Sex
            workers (referred to as &quot;Worker&quot;) can then use this ID to record interactions and
            &quot;burn&quot; it if necessary, creating a trustworthy, anonymous safety net.
          </p>
          <Link href="/demo" className="mt-10 inline-block">
            <Button className="h-11 bg-white px-8 py-3 text-lg text-black hover:bg-gray-200">
              Explore the Demo
            </Button>
          </Link>
        </div>
      </section>

      {/* Problem */}
      <section className="bg-gray-950 py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-center text-3xl sm:text-4xl font-bold text-white">
            The Problem: A Lack of Safe, Private Accountability
          </h2>
          <p className="mx-auto mt-4 max-w-3xl text-center text-gray-400">
            Sex workers face real danger with no reliable, privacy-preserving way to warn each other
            about harmful clients — or to reward good ones.
          </p>
          <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {problems.map((p) => (
              <div key={p.title} className="rounded-lg border border-gray-800 bg-gray-900/50 p-6">
                <h3 className="text-xl font-semibold text-gray-200">{p.title}</h3>
                <p className="mt-3 text-gray-400">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-black py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-center text-3xl sm:text-4xl font-bold text-white">
            How It Works: A Step-by-Step Guide
          </h2>
          <div className="mt-16 grid gap-16 md:grid-cols-2">
            <div>
              <h3 className="mb-8 text-2xl font-semibold text-white">For John (The Client)</h3>
              <Timeline steps={johnSteps} />
            </div>
            <div>
              <h3 className="mb-8 text-2xl font-semibold text-white">
                For the Worker (The Service Provider)
              </h3>
              <Timeline steps={workerSteps} />
            </div>
          </div>
        </div>
      </section>

      {/* Value */}
      <section className="bg-gray-950 py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-center text-3xl sm:text-4xl font-bold text-white">
            The Value for Sex Workers: Empowerment Through Technology
          </h2>
          <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {values.map((v) => (
              <div key={v.title} className="rounded-lg border border-gray-800 bg-gray-900/50 p-6">
                <h3 className="text-xl font-semibold text-gray-200">{v.title}</h3>
                <p className="mt-3 text-gray-400">{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-black py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-center text-3xl sm:text-4xl font-bold text-white">Core Features</h2>
          <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="rounded-lg border border-gray-800 bg-gray-950 p-6">
                <h3 className="text-xl font-semibold text-gray-200">{f.title}</h3>
                <p className="mt-3 text-gray-400">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech */}
      <section className="bg-gray-950 py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white">Technology Powering ZKBurn</h2>
          <div className="mx-auto mt-10 grid max-w-3xl gap-6 sm:grid-cols-3">
            <div className="rounded-lg border border-gray-800 p-6">
              <h3 className="text-lg font-semibold text-gray-200">ZKPassport</h3>
              <p className="mt-2 text-sm text-gray-400">For anonymous identity verification.</p>
            </div>
            <div className="rounded-lg border border-gray-800 p-6">
              <h3 className="text-lg font-semibold text-gray-200">Solidity</h3>
              <p className="mt-2 text-sm text-gray-400">For on-chain smart contract logic.</p>
            </div>
            <div className="rounded-lg border border-gray-800 p-6">
              <h3 className="text-lg font-semibold text-gray-200">Gnosis Chain</h3>
              <p className="mt-2 text-sm text-gray-400">
                For decentralized, immutable record-keeping.
              </p>
            </div>
          </div>
          {isContractConfigured && (
            <p className="mt-8 text-sm text-gray-500">
              Live contract:{" "}
              <a
                href={contractExplorerUrl}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-gray-400 underline hover:text-white"
              >
                {ZKBURN_ADDRESS}
              </a>{" "}
              on Gnosis Chain
            </p>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-black py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            Ready to See ZKBurn in Action?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-gray-400">
            Explore our interactive demo to understand the user flows for both the Worker (service
            provider) and John (client).
          </p>
          <Link href="/demo" className="mt-10 inline-block">
            <Button className="h-11 bg-white px-10 py-4 text-xl text-black hover:bg-gray-200">
              Launch Demo Application
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 bg-black py-10">
        <div className="container mx-auto space-y-2 px-4 text-center text-sm text-gray-500">
          <p>ZKBurn is an open-specification project (CC-BY-SA-4.0).</p>
          <p>© 2025 ZKBurn Working Group.</p>
          <p>This deployment runs against the real ZKBurn contract on Gnosis Chain.</p>
        </div>
      </footer>
    </main>
  );
}
