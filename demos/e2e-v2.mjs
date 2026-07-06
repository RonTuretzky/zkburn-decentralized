// End-to-end V2 platform test against the live Gnosis contract.
// Drives: worker registers → john registers → worker records interaction →
// john authorizes → worker vouches, burns, retracts burn → status check.
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3101";
const JOHN_PK = process.env.V2JOHN_PK;
const WORK_PK = process.env.V2WORK_PK;
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();

async function ctx(pk, role) {
  const c = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await c.addInitScript((p) => localStorage.setItem("zkburn.__ROLE__.pk", p), pk);
  // role placeholder replaced per-call below
  return c;
}
// context seeding needs the correct localStorage key per role
async function context(pk, role) {
  const c = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await c.addInitScript(
    ([p, r]) => localStorage.setItem(`zkburn.${r}.pk`, p),
    [pk, role],
  );
  const page = await c.newPage();
  page.on("console", (m) => m.type() === "error" && console.log(`[${role}]`, m.text().slice(0, 160)));
  return { c, page };
}

// 1) Worker registers + records an interaction (John not yet known → register John first)
// Register John
const john = await context(JOHN_PK, "john");
await john.page.goto(`${BASE}/john/portal/`);
await john.page.getByRole("button", { name: "Generate My Anonymous ID" }).click();
await john.page.getByRole("button", { name: "Simulate proof (demo mode)" }).click();
const johnIdBox = john.page.locator("p.font-mono.break-all");
await johnIdBox.waitFor({ timeout: 90000 });
const johnId = (await johnIdBox.textContent()).trim();
console.log("JOHN registered:", johnId);

// Register worker
const work = await context(WORK_PK, "worker");
await work.page.goto(`${BASE}/worker/dashboard/`);
await work.page.getByRole("button", { name: "Register My Worker ID" }).click();
await work.page.getByRole("button", { name: "Simulate proof (demo mode)" }).click();
await work.page.getByText(/Registered worker ID/).waitFor({ timeout: 90000 });
console.log("WORKER registered");

// Check status (clean)
await work.page.fill("#check-id", johnId);
await work.page.getByRole("button", { name: "Check", exact: true }).click();
await work.page.getByText(/This ID is clean/).waitFor({ timeout: 30000 });
console.log("STATUS clean ✓");

// Record interaction
await work.page.fill("#request-id", johnId);
await work.page.getByRole("button", { name: "Generate Request" }).click();
const link = await work.page
  .locator("a[href*='authorize-interaction']")
  .first()
  .getAttribute("href", { timeout: 90000 });
console.log("interaction link:", link);

// John authorizes
await john.page.goto(link);
await john.page.getByRole("button", { name: "Authorize Interaction" }).click({ timeout: 30000 });
await john.page.getByText("Interaction successfully authorized and recorded.").waitFor({ timeout: 90000 });
console.log("JOHN authorized ✓");

// Worker vouches, then burns, then retracts burn — via the interaction row
await pause(3000);
await work.page.reload();
await work.page.getByText("Your Interactions").waitFor({ timeout: 30000 });
await work.page.getByText(/Confirmed by client/).first().waitFor({ timeout: 30000 });

await work.page.getByRole("button", { name: "Vouch" }).first().click();
await work.page.getByText(/· vouched/).waitFor({ timeout: 90000 });
console.log("WORKER vouched ✓");

await work.page.getByRole("button", { name: "Burn", exact: true }).first().click();
await work.page.getByText(/· burned/).waitFor({ timeout: 90000 });
console.log("WORKER burned ✓");

// Status now BURNED
await work.page.fill("#check-id", johnId);
await work.page.getByRole("button", { name: "Check", exact: true }).click();
await work.page.getByText(/This ID is BURNED/).waitFor({ timeout: 30000 });
console.log("STATUS burned ✓");

// Retract the burn
await work.page.getByRole("button", { name: "Retract burn" }).first().click();
await work.page.waitForTimeout(1000);
await work.page.getByText(/Retract burn/).first().waitFor({ state: "detached", timeout: 90000 }).catch(() => {});
await pause(4000);
await work.page.fill("#check-id", johnId);
await work.page.getByRole("button", { name: "Check", exact: true }).click();
await work.page.getByText(/This ID is clean/).waitFor({ timeout: 30000 });
console.log("BURN retracted → status clean again ✓");

console.log("\nALL V2 E2E STEPS PASSED. JohnID:", johnId);
await browser.close();
