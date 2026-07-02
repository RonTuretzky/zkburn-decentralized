# ZKBurn

A real, decentralized implementation of the [ZKBurn concept](https://zk-burn.vercel.app/) — *"Empowering Sex Workers with Verifiable, Anonymous Safety."*

The original site is a client-side mock with no chain and no real ZK. This repo implements the full feature set end-to-end:

- **Anonymous identity** — clients ("John") prove they are a real, unique person with [zkPassport](https://zkpassport.id) (zero-knowledge proofs over government-issued passports/IDs). The proof's *scoped nullifier* becomes their `JohnID`: unique per person per app, unlinkable to their identity.
- **Mutual-consent interactions** — a worker proposes an interaction on-chain; John confirms it from the wallet bound to his JohnID. Both parties must act — nobody can fabricate an interaction alone.
- **Burns & vouches** — each confirmed interaction grants the worker exactly one burn (flag, with an optional note) and one vouch for that JohnID. Status checks are free public reads.
- **No backend, no admin** — the contract has no owner and the web app talks straight to Gnosis Chain. Nothing can be deleted or edited by anyone, including us.

## Deployed contract

| | |
|---|---|
| Network | Gnosis Chain (id 100) |
| Contract | [`0x772fA3dde14AAEeCD3c98E9b26E07a9afFfC46b4`](https://gnosis.blockscout.com/address/0x772fA3dde14AAEeCD3c98E9b26E07a9afFfC46b4) |
| Verified | Blockscout (solc 0.8.35) + [Sourcify full match](https://sourcify.dev/server/v2/contract/100/0x772fA3dde14AAEeCD3c98E9b26E07a9afFfC46b4) |
| Deployed via | [etherform](https://github.com/BreadchainCoop/etherform) `_deploy-testnet.yml` reusable workflow (`workflow_dispatch`) |
| Config | domain `zkburn.app`, scope `zkburn-v1`, verifier `0x1D000001000EFD9a6371f4d90bB8920D5431c0D8` |

## Demos

Recorded end-to-end against the **live Gnosis mainnet contract** (every step is a real transaction; the QR in flow 1 is a genuine zkPassport request, completable with the ZKPassport mobile app — the recording finishes via the clearly-labeled demo-mode simulated proof since a phone can't scan a headless browser):

| Flow | GIF |
|---|---|
| 1. John registers (zkPassport QR → JohnID) | ![john registers](demos/1-john-register.gif) |
| 2. Worker checks ID + proposes interaction | ![worker checks](demos/2-worker-check-request.gif) |
| 3. John authorizes (mutual consent) | ![john authorizes](demos/3-john-authorize.gif) |
| 4. Worker vouches, burns w/ note, re-checks | ![vouch and burn](demos/4-worker-vouch-burn.gif) |

Reproduce with `demos/record-demos.mjs` (Playwright): fund two burner keys with a little xDAI, then
`JOHN_PK=0x… WORKER_PK=0x… BASE_URL=http://localhost:3100 node demos/record-demos.mjs`.

## Repo layout

```
foundry.toml          # Foundry config at root (etherform's workflows expect this)
contracts/src/        # ZKBurn.sol + zkPassport interface
contracts/script/     # Deploy.s.sol (env-driven)
contracts/test/       # Foundry tests
web/                  # Next.js dapp (John's Portal, Worker's Dashboard)
.github/              # etherform CI/CD (BreadchainCoop/etherform reusable workflows)
```

## Trust model & the "optimistic" mode

zkPassport's `RootVerifier` lives at the CREATE2-deterministic address `0x1D000001000EFD9a6371f4d90bB8920D5431c0D8` on every chain they've deployed to (Ethereum, Base, Sepolia today). **It is not yet deployed on Gnosis.**

`ZKBurn.registerJohn` therefore auto-detects: if verifier code exists at that address it performs full on-chain ZK verification (`zkVerified = true`); otherwise it still enforces the proof's scope binding (domain + scope hashes in the public inputs) and freshness on-chain, extracts the nullifier from the canonical public-input layout, and registers *optimistically* (`zkVerified = false`, shown honestly in the UI). The day zkPassport deploys their verifier to Gnosis (they do so [on request](mailto:company@zkpassport.id)), every new registration is fully verified — no redeploy, no migration.

The UI distinguishes three registration grades: **verified** (on-chain ZK), **optimistic** (real zkPassport proof, verifier not yet on Gnosis), and **simulated** (demo-mode synthetic params for recordings/testing — never presented as verified).

## Running the app

```sh
cd web
pnpm install
cp .env.local.example .env.local   # set NEXT_PUBLIC_ZKBURN_ADDRESS
pnpm dev
```

Users get an in-browser burner wallet per role (John / Worker), stored in localStorage. Fund it with a little xDAI to transact. Real passport registration requires the ZKPassport mobile app (dev mode supports mock "ZKR" passports).

## Contracts

```sh
forge build
forge test -vv
```

Deploys run through [etherform](https://github.com/BreadchainCoop/etherform) reusable GitHub Actions (`.github/workflows/cicd.yml`): CI on every push; deployment to Gnosis mainnet + Blockscout verification on `workflow_dispatch`, with `PRIVATE_KEY`/`RPC_URL` repo secrets.
