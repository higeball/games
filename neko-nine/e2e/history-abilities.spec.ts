import { expect, test } from "@playwright/test";

test("old saves gain career history and compact individually colored ranks", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  const expectAlignedRanks = async (
    panel: import("@playwright/test").Locator,
  ) => {
    const cells = await panel
      .locator(".batter-fielding .ability-chip")
      .evaluateAll((els) =>
        els.map((el) => {
          const row = el.getBoundingClientRect();
          const rank = el
            .querySelector(".ability-rank")!
            .getBoundingClientRect();
          const grade = el.querySelector(".grade")!.getBoundingClientRect();
          return { column: rank.x + rank.width / 2, offset: grade.y - row.y };
        }),
      );
    expect(cells).toHaveLength(3);
    expect(
      Math.max(...cells.map((c) => c.column)) -
        Math.min(...cells.map((c) => c.column)),
    ).toBeLessThan(1);
    expect(
      Math.max(...cells.map((c) => c.offset)) -
        Math.min(...cells.map((c) => c.offset)),
    ).toBeLessThan(1);
  };
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 360, height: 844 });
  await page.goto("/games/neko-nine/");
  await page.getByRole("button", { name: /2026年オフから就任/ }).click();
  await expect(page.getByRole("status")).toHaveCount(0);
  const original = await page.evaluate(
    () =>
      new Promise<{
        id: string;
        name: string;
        real: string;
        teams: string;
        seed: number;
      }>((resolve, reject) => {
        const request = indexedDB.open("neko-owner-v3", 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result,
            tx = db.transaction("saves", "readwrite"),
            store = tx.objectStore("saves"),
            read = store.get("current");
          let result: {
            id: string;
            name: string;
            real: string;
            teams: string;
            seed: number;
          };
          read.onsuccess = () => {
            const w = read.result,
              p = w.players.find(
                (p: any) =>
                  p.team === 0 &&
                  p.pro >= 4 &&
                  p.age >= 21 &&
                  p.position !== "投",
              );
            result = {
              id: p.id,
              name: p.name,
              real: JSON.stringify(p.reports[2026]),
              teams: JSON.stringify(w.teams),
              seed: w.seed,
            };
            for (const player of w.players) {
              delete player.reports[2024];
              delete player.reports[2025];
            }
            Object.assign(p.skills, {
              contact: 95,
              power: 85,
              speed: 75,
              arm: 65,
              fielding: 55,
              catching: 45,
            });
            store.put(w, "current");
          };
          tx.oncomplete = () => {
            db.close();
            resolve(result);
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
  await page.reload();
  await page.getByRole("button", { name: /第1次戦力外通告へ進む/ }).click();
  await expect(page.getByRole("status")).toHaveCount(0);
  await page.locator(".release-filters > summary").click();
  await page.getByLabel("主力選手を除外").uncheck();
  await page.getByLabel("戦力外候補を検索").fill(original.name);
  const card = page.locator(`[data-player-id="${original.id}"]`);
  await expect(card).toHaveCount(1);
  const firstTable = card.getByRole("table", { name: /一軍直近3年成績/ });
  const rows = firstTable.locator("tbody tr");
  await expect(rows).toHaveCount(3);
  await expect(firstTable).not.toContainText("記録なし");
  await expect(rows.nth(1).locator("th")).toHaveText("2025");
  await expect(rows.nth(2).locator("th")).toHaveText("2024");
  await expect(firstTable).not.toContainText("補完");
  const grades = await card
    .locator(".batter-ability-panel [data-grade]")
    .evaluateAll((nodes) =>
      nodes.map((n) => ({
        rank: n.getAttribute("data-grade"),
        color: getComputedStyle(n).color,
      })),
    );
  expect(grades.map((g) => g.rank)).toEqual(["S", "A", "B", "E", "C", "D"]);
  expect(new Set(grades.map((g) => g.color)).size).toBe(6);
  const skills = card.getByRole("region", { name: "野手能力画面" });
  await expect(skills.locator(".ability-season")).toHaveCount(0);
  await expect(card.locator(".candidate-skills")).toHaveCount(0);
  for (const width of [360, 390, 430, 1100]) {
    await page.setViewportSize({ width, height: 844 });
    await expectAlignedRanks(skills);
    expect(
      (await skills.locator(".batter-primary").boundingBox())!.height,
    ).toBeLessThanOrEqual(60);
    expect(
      await skills.evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const releaseAbilityMarkup = await skills.innerHTML();
  await skills.evaluate((el) =>
    el.scrollIntoView({ block: "center", behavior: "instant" }),
  );
  await skills.screenshot({
    path: "test-results/release-standard-abilities.png",
  });
  const table = firstTable;
  await table.evaluate((el) =>
    el.scrollIntoView({ block: "center", behavior: "instant" }),
  );
  await table.screenshot({ path: "test-results/backfilled-three-years.png" });
  const preserved = await page.evaluate(
    () =>
      new Promise<any>((resolve, reject) => {
        const request = indexedDB.open("neko-owner-v3", 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result,
            tx = db.transaction("saves", "readonly"),
            read = tx.objectStore("saves").get("current");
          read.onsuccess = () => resolve(read.result);
          tx.oncomplete = () => db.close();
        };
      }),
  );
  expect(
    JSON.stringify(
      preserved.players.find((p: any) => p.id === original.id).reports[2026],
    ),
  ).toBe(original.real);
  expect(JSON.stringify(preserved.teams)).toBe(original.teams);
  expect(preserved.seed).toBe(original.seed);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /選手名鑑/ })
    .click();
  await page.getByLabel("選手名・種類・役割で検索").fill(original.name);
  const catalogue = page.locator(
    `.player-row[data-player-id="${original.id}"]`,
  );
  const catalogueFirst = catalogue.getByRole("table", {
    name: /一軍直近3年成績/,
  });
  await expect(catalogueFirst).toContainText("2024〜2026年");
  await expect(catalogueFirst.locator("tbody tr")).toHaveCount(3);
  await expect(catalogueFirst).not.toContainText("プロ入り前");
  await expect(catalogue.locator("[data-style='pixel']")).toHaveCount(1);
  expect(await catalogue.locator("svg").getAttribute("shape-rendering")).toBe(
    "crispEdges",
  );
  await catalogue.screenshot({
    path: "test-results/pixel-player-three-years.png",
  });
  await expect(
    catalogue.getByRole("table", { name: /二軍直近3年成績/ }),
  ).toHaveCount(1);
  await expect(
    catalogueFirst.locator("tbody tr").first().locator("td").first(),
  ).toHaveText("0");
  await page.locator(".player-summary").click();
  const modal = page.getByRole("dialog");
  await expect(
    modal.getByRole("table", { name: /一軍直近3年成績/ }).locator("tbody tr"),
  ).toHaveCount(3);
  await expect(modal.locator(".ability-chip")).toHaveCount(6);
  const panel = modal.getByRole("region", { name: "野手能力画面" });
  await expect(panel.locator(".ability-season")).toHaveCount(0);
  expect(await panel.innerHTML()).toBe(releaseAbilityMarkup);
  await expect(panel.locator(".batter-primary .ability-chip")).toHaveCount(3);
  expect(
    await panel
      .locator(".batter-primary .ability-chip small")
      .allTextContents(),
  ).toEqual(["ミート", "パワー", "走力"]);
  await expect(panel.locator(".batter-fielding .ability-chip")).toHaveCount(3);
  await expect(panel.locator(".main-position")).toHaveCount(1);
  await expect(panel.locator(".batter-position")).toContainText(
    "その他は未評価",
  );
  for (const width of [360, 390, 430, 1100]) {
    await page.setViewportSize({ width, height: 844 });
    await expectAlignedRanks(panel);
    expect(await panel.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
      true,
    );
    const primary = await panel
      .locator(".batter-primary .ability-chip")
      .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().y));
    expect(primary.every((top) => top === primary[0])).toBe(true);
    expect(await modal.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
      true,
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await modal
    .locator(".player-ability-panel")
    .screenshot({ path: "test-results/compact-player-detail.png" });
  await expect(modal).toContainText("2024");
  await expect(modal).toContainText("補完データ");
  await page.getByRole("button", { name: "閉じる ×" }).click();
  for (const width of [360, 390, 430, 1100]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.reload();
  await expect(page.locator(".status-date")).toContainText("2026");
  expect(errors).toEqual([]);
});
