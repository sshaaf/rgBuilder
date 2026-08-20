import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

function bundleDir(): string | undefined {
  return process.env.UNIVERSE_BUNDLE_DIR;
}

function searchQuery(bundle: string): string {
  const landmarksPath = path.join(bundle, "search_landmarks.json");
  if (fs.existsSync(landmarksPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(landmarksPath, "utf8")) as {
        landmarks?: { name?: string }[];
      };
      const name = data.landmarks?.[0]?.name;
      if (name && name.length >= 3) return name.slice(0, Math.min(6, name.length));
    } catch {
      /* fall through */
    }
  }
  return "pay";
}

function drillTargets(bundle: string): { communityId: number; packageId: number } | null {
  const universePath = path.join(bundle, "universe.json");
  if (!fs.existsSync(universePath)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(universePath, "utf8")) as {
      communities?: { id: number }[];
      packages?: { id: number; community_id: number; member_indices?: unknown[] }[];
    };
    const communityId = data.communities?.[0]?.id;
    const pkg = data.packages?.find(
      (p) => p.member_indices && p.member_indices.length > 0 && p.community_id === communityId,
    ) ?? data.packages?.find((p) => p.member_indices && p.member_indices.length > 0);
    if (communityId == null || !pkg) return null;
    return { communityId, packageId: pkg.id };
  } catch {
    return null;
  }
}

test("universe bundle loads without tab bar", async ({ page }) => {
  const bundle = bundleDir();
  test.skip(!bundle, "set UNIVERSE_BUNDLE_DIR to .rgbuilder/universe for e2e");

  await page.goto(`file://${bundle}/index.html`);
  await expect(page.locator(".universe-search")).toBeVisible();
  await expect(page.locator('[role="tablist"]')).toHaveCount(0);
  await expect(page.locator("#universe-canvas, .universe-canvas-host canvas")).toHaveCount(1, {
    timeout: 15_000,
  });
});

test("search selection stays at L0 breadcrumb", async ({ page }) => {
  const bundle = bundleDir();
  test.skip(!bundle, "set UNIVERSE_BUNDLE_DIR to .rgbuilder/universe for e2e");

  await page.goto(`file://${bundle}/index.html`);
  await expect(page.locator(".universe-search-input")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".universe-breadcrumb")).toHaveCount(0);

  const query = searchQuery(bundle);
  await page.locator(".universe-search-input").fill(query);
  await page.locator(".universe-search-hit").first().click({ timeout: 10_000 });

  await expect(page.locator(".universe-breadcrumb")).toHaveCount(0);
  await expect(page.locator(".universe-canvas-host canvas")).toHaveCount(1);
});

test("drill community then package shows L2 nodes", async ({ page }) => {
  const bundle = bundleDir();
  test.skip(!bundle, "set UNIVERSE_BUNDLE_DIR to .rgbuilder/universe for e2e");

  const targets = drillTargets(bundle);
  test.skip(!targets, "universe.json missing drill targets");

  await page.goto(`file://${bundle}/index.html?e2e=1`);
  await page.waitForFunction(() => window.__universeE2e != null, undefined, { timeout: 15_000 });
  await expect(page.locator(".universe-wasm-ok")).toBeVisible({ timeout: 20_000 });

  await page.evaluate(({ communityId }) => {
    window.__universeE2e!.selectCommunity(communityId);
  }, targets);

  await expect(page.locator(".universe-breadcrumb")).toContainText(/.+/);
  await page.waitForFunction(() => window.__universeE2e!.lod() === 1, undefined, { timeout: 5_000 });

  await page.evaluate(async ({ packageId }) => {
    await window.__universeE2e!.selectPackage(packageId);
  }, targets);

  await page.waitForFunction(() => window.__universeE2e!.lod() === 2, undefined, { timeout: 10_000 });
  await page.waitForFunction(
    () => window.__universeE2e!.l2NodeCount() > 0,
    undefined,
    { timeout: 20_000 },
  );

  const l2Count = await page.evaluate(() => window.__universeE2e!.l2NodeCount());
  expect(l2Count).toBeGreaterThan(0);
});

test("L3 symbol opens blast context panel", async ({ page }) => {
  const bundle = bundleDir();
  test.skip(!bundle, "set UNIVERSE_BUNDLE_DIR to .rgbuilder/universe for e2e");

  const targets = drillTargets(bundle);
  test.skip(!targets, "universe.json missing drill targets");

  await page.goto(`file://${bundle}/index.html?e2e=1`);
  await page.waitForFunction(() => window.__universeE2e != null, undefined, { timeout: 15_000 });
  await expect(page.locator(".universe-wasm-ok")).toBeVisible({ timeout: 20_000 });

  await page.evaluate(({ communityId }) => {
    window.__universeE2e!.selectCommunity(communityId);
  }, targets);
  await page.evaluate(async ({ packageId }) => {
    await window.__universeE2e!.selectPackage(packageId);
  }, targets);

  await page.waitForFunction(() => window.__universeE2e!.l2NodeCount() > 0, undefined, {
    timeout: 20_000,
  });

  await page.evaluate(() => {
    const fn = window.__universeE2e!.firstL2Function();
    if (!fn) throw new Error("no L2 function");
    window.__universeE2e!.selectFunction(fn.nodeIndex, fn.name);
  });

  await page.waitForFunction(() => window.__universeE2e!.lod() === 3, undefined, { timeout: 5_000 });
  await expect(page.getByTestId("universe-context-panel")).toBeVisible();
  await expect(page.getByRole("heading", { name: "BLAST RADIUS" })).toBeVisible();
});
