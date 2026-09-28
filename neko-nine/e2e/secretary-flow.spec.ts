import { expect, test } from "@playwright/test";

test("Foomy guides directly to inline release comparisons on mobile", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const settle = async () => {
    await expect(page.getByRole("status")).toHaveCount(0);
    await expect(page.getByRole("alert")).toHaveCount(0);
  };
  await page.goto("/games/neko-nine/");
  await page.getByRole("button", { name: /2026年オフから就任/ }).click();
  await settle();
  const guide = page.getByRole("complementary", { name: "秘書フーミーの案内" });
  await expect(guide).toContainText("シーズンお疲れ様でした");
  const image = guide.getByRole("img");
  await expect(image).toBeVisible();
  await expect(image).toHaveAttribute("src", /foomy-secretary-pixel\.png$/);
  expect(await image.evaluate((el) => getComputedStyle(el).imageRendering)).toBe("pixelated");
  expect(
    await image.evaluate(
      (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
    ),
  ).toBe(true);
  const startButton = page.getByRole("button", {
    name: /第1次戦力外通告へ進む/,
  });
  const bounds = await startButton.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.y + bounds!.height).toBeLessThan(
    page.viewportSize()!.height - 70,
  );
  await page.screenshot({
    path: "test-results/foomy-home.png",
    fullPage: false,
  });
  await page.getByRole("button", { name: /第1次戦力外通告へ進む/ }).click();
  await settle();
  await expect(
    page.getByRole("heading", { name: "戦力外候補を比較する" }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation").getByRole("button", { name: /編成・補強/ }),
  ).toHaveClass("active");
  const young = page.getByLabel("3年目までの選手を除外"),
    core = page.getByLabel("主力選手を除外");
  await expect(young).toBeChecked();
  await expect(core).toBeChecked();
  expect(
    await page
      .locator(".release-candidate")
      .evaluateAll((cards) =>
        cards.every(
          (c) =>
            Number(c.getAttribute("data-pro")) > 3 &&
            c.getAttribute("data-core") === "false",
        ),
      ),
  ).toBe(true);
  const first = page.locator(".release-candidate").first();
  await expect(first.getByRole("table")).toBeVisible();
  await expect(first.getByRole("table").locator("tbody tr")).toHaveCount(3);
  await expect(first.getByRole("table")).toContainText("2026");
  await expect(first.getByRole("table")).toContainText("2025");
  await expect(first.getByRole("table")).toContainText("2024");
  await expect(first.getByRole("table")).not.toContainText("記録なし");
  await expect(first).toContainText("年俸");
  await expect(first).toContainText("契約");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await first.screenshot({ path: "test-results/release-inline-card.png" });
  await expect(first).toContainText("二軍参考");
  await first
    .getByRole("img")
    .evaluate((el) =>
      el.scrollIntoView({ block: "center", behavior: "instant" }),
    );
  await first
    .getByRole("img")
    .screenshot({ path: "test-results/unique-cat-portrait.png" });
  const playerId = await first.getAttribute("data-player-id");
  const action = first.getByRole("button", { name: /戦力外通告/ });
  page.once("dialog", (dialog) => dialog.dismiss());
  await action.click();
  await expect(page.locator(`[data-player-id="${playerId}"]`)).toHaveCount(1);
  page.once("dialog", (dialog) => dialog.accept());
  await action.click();
  await settle();
  await expect(page.locator(`[data-player-id="${playerId}"]`)).toHaveCount(0);
  const mainName = await page.evaluate(
    () =>
      new Promise<string>((resolve, reject) => {
        const request = indexedDB.open("neko-owner-v3", 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result,
            tx = db.transaction("saves", "readonly"),
            r = tx.objectStore("saves").get("current");
          r.onsuccess = () => {
            const w = r.result,
              p = w.players.find(
                (p: any) =>
                  p.team === 0 &&
                  p.position !== "投" &&
                  (p.reports[w.year]?.games >= 60 ||
                    p.reports[w.year]?.pa >= 180),
              );
            resolve(p.name);
          };
          tx.oncomplete = () => db.close();
        };
      }),
  );
  await page.getByLabel("戦力外候補を検索").fill(mainName);
  await expect(page.locator(".release-candidate")).toHaveCount(0);
  await core.uncheck();
  await young.uncheck();
  await expect(page.locator(".release-candidate")).toHaveCount(1);
  await expect(page.locator(".release-candidate")).toHaveAttribute(
    "data-core",
    "true",
  );
  await expect(
    page
      .locator(".release-candidate")
      .getByRole("button", { name: /戦力外通告/ }),
  ).toBeEnabled();
  await page.getByLabel("戦力外候補を検索").fill("");
  const portraits = await page
    .locator(".release-candidate [data-portrait]")
    .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("data-portrait")));
  expect(new Set(portraits).size).toBe(portraits.length);
  for (const width of [360, 390, 430, 1100]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: "test-results/foomy-release.png",
    fullPage: false,
  });
  await page.getByRole("button", { name: /ドラフト会議へ進む/ }).click();
  await settle();
  await expect(
    page.getByRole("heading", { name: "ドラフト 第1巡" }),
  ).toBeVisible();
  await expect(guide).toContainText("第1巡");
  expect(errors).toEqual([]);
});
