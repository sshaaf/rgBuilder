/**
 * Firefox smoke test: hero tabs switch graph scenes + particles animate.
 * Run: pnpm exec node scripts/firefox-hero-graph.mjs
 */
import { firefox } from "playwright";

const BASE = process.env.SITE_URL || "http://localhost:3000";
const TABS = [
  "blast-radius",
  "gql",
  "semantic",
  "cpg",
  "metrics",
  "taint",
  "communities",
  "migration",
];

async function main() {
  const browser = await firefox.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(BASE + "/", { waitUntil: "networkidle" });

  const results = [];
  for (const tab of TABS) {
    const btn = page.getByRole("button", { name: tab, exact: true });
    await btn.click();
    await page.waitForTimeout(200);

    const scene = await page.locator("[data-graph-scene]").getAttribute("data-graph-scene");
    if (scene !== tab) {
      throw new Error(`Expected scene ${tab}, got ${scene}`);
    }

    const fig = await page
      .locator("[data-graph-scene] span")
      .first()
      .textContent();

    // Particle motion: sample position twice
    const particle = page.locator("[data-particle]").first();
    const count = await page.locator("[data-particle]").count();
    let moved = false;
    if (count > 0) {
      await page.waitForTimeout(120);
      const cx1 = await particle.getAttribute("cx");
      const cy1 = await particle.getAttribute("cy");
      await page.waitForTimeout(500);
      const cx2 = await particle.getAttribute("cx");
      const cy2 = await particle.getAttribute("cy");
      moved =
        cx1 != null &&
        cx2 != null &&
        cy1 != null &&
        cy2 != null &&
        (Math.abs(Number(cx1) - Number(cx2)) > 0.5 ||
          Math.abs(Number(cy1) - Number(cy2)) > 0.5);
    }

    results.push({ tab, scene, fig, particles: count, moved });
    if (count === 0) {
      throw new Error(`No particles for tab ${tab}`);
    }
    if (!moved) {
      throw new Error(
        `Particle did not move for tab ${tab} (Firefox getPointAtLength/rAF)`,
      );
    }
  }

  if (errors.length) {
    console.error("Page errors:", errors);
    process.exit(1);
  }

  console.log(JSON.stringify({ browser: "firefox", ok: true, results }, null, 2));
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
