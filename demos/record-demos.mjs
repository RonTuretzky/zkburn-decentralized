// Records the ZKBurn end-to-end flows against a running web app (localhost:3100)
// and the live Gnosis mainnet contract. Produces one video per flow in OUT_DIR.
//
// Usage:
//   JOHN_PK=0x… WORKER_PK=0x… BASE_URL=http://localhost:3100 node demos/record-demos.mjs
//
// The private keys are pre-funded burner wallets; they are seeded into
// localStorage so the app picks them up as the per-role burner wallets.

import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3100";
const OUT_DIR = process.env.OUT_DIR ?? "/tmp/zkburn-videos";
const JOHN_PK = process.env.JOHN_PK;
const WORKER_PK = process.env.WORKER_PK;
if (!JOHN_PK || !WORKER_PK) throw new Error("JOHN_PK and WORKER_PK env vars required");

mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch();

/** Fresh context with burner keys seeded and video recording on. */
async function newContext(name) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: OUT_DIR, size: { width: 1280, height: 800 } },
  });
  await context.addInitScript(
    ([john, worker]) => {
      localStorage.setItem("zkburn.john.pk", john);
      localStorage.setItem("zkburn.worker.pk", worker);
    },
    [JOHN_PK, WORKER_PK],
  );
  const page = await context.newPage();
  page.on("console", (m) => {
    if (m.type() === "error") console.log(`[${name}][console.error]`, m.text());
  });
  return { context, page, name };
}

async function finish({ context, page, name }) {
  const video = page.video();
  await context.close();
  const path = await video.path();
  console.log(`recorded ${name}: ${path}`);
  return path;
}

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Flow 1 — John registers: real zkPassport QR, then simulated proof (demo mode)
// ---------------------------------------------------------------------------
let johnId;
{
  const ctx = await newContext("1-john-register");
  const { page } = ctx;
  await page.goto(`${BASE_URL}/demo`);
  await pause(2000);
  await page.getByRole("button", { name: "Go to John's Portal" }).click();
  await page.waitForURL("**/john/portal");
  await pause(2000);

  // Real zkPassport flow: shows a genuinely scannable QR code.
  await page.getByRole("button", { name: "Generate My Anonymous ID" }).click();
  try {
    await page.waitForSelector("svg[height='192']", { timeout: 20000 });
    await pause(5000); // linger on the QR so viewers see it
  } catch {
    console.log("[1] real QR did not appear (bridge unreachable?) — continuing with simulate");
  }

  // Complete the recording without a phone: clearly-labeled demo-mode path.
  await page.getByRole("button", { name: "Simulate proof (demo mode)" }).click();
  const idBox = page.locator("p.font-mono.break-all");
  await idBox.waitFor({ timeout: 90000 });
  johnId = (await idBox.textContent()).trim();
  console.log("[1] registered JohnID:", johnId);
  await pause(4000);
  await finish(ctx);
}

// ---------------------------------------------------------------------------
// Flow 2 — Worker checks the ID and generates an interaction request (on-chain)
// ---------------------------------------------------------------------------
let interactionUrl;
{
  const ctx = await newContext("2-worker-check-request");
  const { page } = ctx;
  await page.goto(`${BASE_URL}/worker/dashboard`);
  await pause(2000);

  await page.fill("#check-id", johnId);
  await pause(500);
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await page.getByText(/This ID is clean with/).waitFor({ timeout: 30000 });
  await pause(3000);

  await page.fill("#request-id", johnId);
  await pause(500);
  await page.getByRole("button", { name: "Generate Request" }).click();
  await page.getByText("Show this to John").waitFor({ timeout: 90000 });
  interactionUrl = await page
    .locator("a[href*='authorize-interaction']")
    .first()
    .getAttribute("href");
  console.log("[2] interaction URL:", interactionUrl);
  await pause(4000);
  await finish(ctx);
}

// ---------------------------------------------------------------------------
// Flow 3 — John authorizes the interaction (mutual consent, on-chain)
// ---------------------------------------------------------------------------
{
  const ctx = await newContext("3-john-authorize");
  const { page } = ctx;
  await page.goto(interactionUrl);
  await page.getByRole("button", { name: "Authorize Interaction" }).waitFor({ timeout: 30000 });
  await pause(2500);
  await page.getByRole("button", { name: "Authorize Interaction" }).click();
  await page.getByText("Interaction successfully authorized and recorded.").waitFor({
    timeout: 90000,
  });
  await pause(4000);
  await finish(ctx);
}

// ---------------------------------------------------------------------------
// Flow 4 — Worker vouches, burns with a note, and re-checks the status
// ---------------------------------------------------------------------------
{
  const ctx = await newContext("4-worker-vouch-burn");
  const { page } = ctx;
  await page.goto(`${BASE_URL}/worker/dashboard`);
  await pause(2000);

  // Vouch (uses the confirmed interaction's vouch slot)
  await page.fill("#vouch-id", johnId);
  await pause(500);
  await page.getByRole("button", { name: "Give Vouch" }).click();
  await page.getByText("Successfully vouched for John's ID.").waitFor({ timeout: 90000 });
  await pause(3000);

  // Burn with a note (uses the same interaction's burn slot)
  await page.fill("#burn-id", johnId);
  await page.fill("#burn-note", "Ignored agreed boundaries. Avoid.");
  await pause(500);
  await page.getByRole("button", { name: "Burn John" }).click();
  await page.getByText("John's ID burned successfully.").waitFor({ timeout: 90000 });
  await pause(3000);

  // Status check now shows BURNED with the note
  await page.fill("#check-id", johnId);
  await pause(500);
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await page.getByText(/This ID is BURNED/).waitFor({ timeout: 30000 });
  await pause(4500);
  await finish(ctx);
}

await browser.close();
console.log("ALL FLOWS RECORDED. JohnID:", johnId);
