// Records the ZKBurn V2 end-to-end flows against a running web app and the live
// Gnosis mainnet contract. Produces one video per flow in OUT_DIR.
//
//   DEMOJ_PK=0x… DEMOW_PK=0x… BASE_URL=http://localhost:3101 node demos/record-demos.mjs
//
// The keys are pre-funded burner wallets seeded into localStorage so the app
// picks them up as the per-role burner wallets.

import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3101";
const OUT_DIR = process.env.OUT_DIR ?? "/tmp/zkburn-v2-videos";
const JOHN_PK = process.env.DEMOJ_PK;
const WORK_PK = process.env.DEMOW_PK;
if (!JOHN_PK || !WORK_PK) throw new Error("DEMOJ_PK and DEMOW_PK required");
mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

async function newCtx(name, seeds) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 860 },
    recordVideo: { dir: OUT_DIR, size: { width: 1280, height: 860 } },
  });
  await context.addInitScript((pairs) => {
    for (const [role, pk] of pairs) localStorage.setItem(`zkburn.${role}.pk`, pk);
  }, seeds);
  const page = await context.newPage();
  page.on("console", (m) => m.type() === "error" && console.log(`[${name}]`, m.text().slice(0, 140)));
  return { context, page, name };
}
async function finish({ context, page, name }) {
  const v = page.video();
  await context.close();
  console.log(`recorded ${name}: ${await v.path()}`);
}

let johnId;

// Flow 1 — John registers (real zkPassport QR, then demo-mode simulate)
{
  const c = await newCtx("1-john-register", [["john", JOHN_PK]]);
  const { page } = c;
  await page.goto(`${BASE_URL}/demo/`);
  await pause(1800);
  await page.getByRole("button", { name: "Go to John's Portal" }).click();
  await page.waitForURL("**/john/portal/");
  await pause(1500);
  await page.getByRole("button", { name: "Generate My Anonymous ID" }).click();
  try {
    await page.waitForSelector("svg[height='192']", { timeout: 20000 });
    await pause(4500);
  } catch {}
  await page.getByRole("button", { name: "Simulate proof (demo mode)" }).click();
  const idBox = page.locator("p.font-mono.break-all");
  await idBox.waitFor({ timeout: 90000 });
  johnId = (await idBox.textContent()).trim();
  console.log("[1] JohnID:", johnId);
  await pause(4000);
  await finish(c);
}

// Flow 2 — Worker registers (Sybil resistance) + checks the client's status
{
  const c = await newCtx("2-worker-register-check", [["worker", WORK_PK]]);
  const { page } = c;
  await page.goto(`${BASE_URL}/worker/dashboard/`);
  await pause(2000);
  await page.getByRole("button", { name: "Register My Worker ID" }).click();
  try {
    await page.waitForSelector("svg[height='176']", { timeout: 20000 });
    await pause(3500);
  } catch {}
  await page.getByRole("button", { name: "Simulate proof (demo mode)" }).click();
  await page.getByText(/Registered worker ID/).waitFor({ timeout: 90000 });
  await pause(1500);
  await page.fill("#check-id", johnId);
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await page.getByText(/This ID is clean/).waitFor({ timeout: 30000 });
  await pause(3500);
  await finish(c);
}

// Flow 3 — Worker records an interaction; John authorizes it (mutual consent)
let interactionUrl;
{
  const c = await newCtx("3-record-and-authorize", [["worker", WORK_PK], ["john", JOHN_PK]]);
  const { page } = c;
  await page.goto(`${BASE_URL}/worker/dashboard/`);
  await page.getByText(/Registered worker ID/).waitFor({ timeout: 30000 });
  await pause(1500);
  await page.fill("#request-id", johnId);
  await page.getByRole("button", { name: "Generate Request" }).click();
  await page.getByText("Show this to John").waitFor({ timeout: 90000 });
  interactionUrl = await page.locator("a[href*='authorize-interaction']").first().getAttribute("href");
  console.log("[3] link:", interactionUrl);
  await pause(3500);
  // John authorizes in the same context (shares localStorage seed)
  await page.goto(interactionUrl);
  await page.getByRole("button", { name: "Authorize Interaction" }).click({ timeout: 30000 });
  await page.getByText("Interaction successfully authorized and recorded.").waitFor({ timeout: 90000 });
  await pause(4000);
  await finish(c);
}

// Flow 4 — Worker vouches, burns with a note, re-checks status (BURNED), then retracts
{
  const c = await newCtx("4-vouch-burn-retract", [["worker", WORK_PK]]);
  const { page } = c;
  await page.goto(`${BASE_URL}/worker/dashboard/`);
  await page.getByText("Your Interactions").waitFor({ timeout: 30000 });
  await page.getByText(/Confirmed by client/).first().waitFor({ timeout: 30000 });
  await pause(2000);

  await page.getByRole("button", { name: "Vouch" }).first().click();
  await page.getByText(/· vouched/).waitFor({ timeout: 90000 });
  await pause(2000);

  // add a burn note then burn
  await page.locator("input[placeholder^='Optional note']").first().fill("Ignored agreed boundaries. Avoid.");
  await pause(800);
  await page.getByRole("button", { name: "Burn", exact: true }).first().click();
  await page.getByText(/· burned/).waitFor({ timeout: 90000 });
  await pause(2000);

  await page.fill("#check-id", johnId);
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await page.getByText(/This ID is BURNED/).waitFor({ timeout: 30000 });
  await pause(3500);

  // retract the burn (author-only correction) → clean again
  await page.getByRole("button", { name: "Retract burn" }).first().click();
  // wait for the retract tx to land, then re-check (retry until the chain reflects it)
  await page.getByText(/· burned/).first().waitFor({ state: "detached", timeout: 90000 }).catch(() => {});
  let clean = false;
  for (let i = 0; i < 10 && !clean; i++) {
    await pause(3000);
    await page.fill("#check-id", johnId);
    await page.getByRole("button", { name: "Check", exact: true }).click();
    clean = await page
      .getByText(/This ID is clean/)
      .waitFor({ timeout: 6000 })
      .then(() => true)
      .catch(() => false);
  }
  if (!clean) throw new Error("status did not return to clean after retract");
  await pause(4000);
  await finish(c);
}

await browser.close();
console.log("ALL V2 FLOWS RECORDED. JohnID:", johnId);
