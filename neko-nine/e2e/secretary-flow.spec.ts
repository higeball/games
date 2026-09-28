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
  expect(
    await image.evaluate((el) => getComputedStyle(el).imageRendering),
  ).toBe("pixelated");
  expect(
    await image.evaluate(
      (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
    ),
  ).toBe(true);
  const startButton = page.getByRole("button", {
    name: /第1次戦力外通告へ進む/,
  });
  const flow = page.getByRole("region", { name: "球団運営の年間の流れ" });
  await expect(flow).toContainText("戦力外通告 → ドラフト");
  await expect(flow).toContainText("春季キャンプ");
  const strength = page.getByRole("heading", { name: "どこを補強する？" });
  expect((await flow.boundingBox())!.y).toBeLessThan(
    (await strength.boundingBox())!.y,
  );
  expect((await strength.boundingBox())!.y).toBeLessThan(
    (await startButton.boundingBox())!.y,
  );
  await expect(page.getByRole("heading", { name: "要対応タスク" })).toHaveCount(
    0,
  );
  await expect(page.getByRole("heading", { name: "オーナー方針" })).toHaveCount(
    0,
  );
  expect(
    (await page.locator(".owner-status").boundingBox())!.height,
  ).toBeLessThanOrEqual(85);
  await page.screenshot({
    path: "test-results/foomy-home.png",
    fullPage: true,
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
  const finish = page.getByRole("button", {
    name: "第1次戦力外通告を終了しドラフト会議へ進む",
    exact: true,
  });
  await expect(finish).toHaveCount(1);
  expect(await finish.evaluate((el) => !!el.closest(".owner-status"))).toBe(
    true,
  );
  expect(
    (await page.locator(".owner-status").boundingBox())!.height,
  ).toBeLessThanOrEqual(130);
  await page.getByRole("tab", { name: /^投手/ }).click();
  await expect(page.getByRole("tab", { name: /^投手/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(
    await page
      .locator(".release-candidate")
      .evaluateAll((cards) =>
        cards.every((c) => c.getAttribute("data-position") === "投"),
      ),
  ).toBe(true);
  await page.getByRole("tab", { name: /^捕手/ }).click();
  expect(
    await page
      .locator(".release-candidate")
      .evaluateAll((cards) =>
        cards.every((c) => c.getAttribute("data-position") === "捕"),
      ),
  ).toBe(true);
  await page.getByRole("tab", { name: /^全員/ }).click();
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
  const firstTable = first.getByRole("table", { name: /一軍直近3年成績/ });
  await expect(firstTable).toBeVisible();
  await expect(firstTable.locator("tbody tr")).toHaveCount(3);
  await expect(firstTable).toContainText("2026");
  await expect(firstTable).toContainText("2025");
  await expect(firstTable).toContainText("2024");
  await expect(firstTable).not.toContainText("記録なし");
  await expect(first).toContainText("年俸");
  await expect(first).toContainText("契約");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await first.screenshot({ path: "test-results/release-inline-card.png" });
  await expect(
    first.getByRole("table", { name: /二軍直近3年成績/ }),
  ).toBeVisible();
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
    const resourceTops = await page
      .locator(".status-resources > div")
      .evaluateAll((els) =>
        els.map((el) => Math.round(el.getBoundingClientRect().top)),
      );
    expect(new Set(resourceTops).size).toBe(1);
    expect(
      (await page.locator(".owner-status").boundingBox())!.height,
    ).toBeLessThanOrEqual(130);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: "test-results/foomy-release.png",
    fullPage: false,
  });
  await page.locator(".release-candidate").last().scrollIntoViewIfNeeded();
  const finishBounds = await finish.boundingBox();
  expect(finishBounds!.y).toBeGreaterThanOrEqual(0);
  expect(finishBounds!.y + finishBounds!.height).toBeLessThan(
    page.viewportSize()!.height,
  );
  await page.getByRole("button", { name: /ドラフト会議へ進む/ }).click();
  await settle();
  await expect(
    page.getByRole("heading", { name: "ドラフト 第1巡" }),
  ).toBeVisible();
  await expect(guide).toContainText("第1巡");
  expect(errors).toEqual([]);
});
