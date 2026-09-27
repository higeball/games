import { expect, test } from "@playwright/test";

test("old saves gain career history and compact individually colored ranks", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 360, height: 844 });
  await page.goto("/neko-card-game/");
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
  await page.getByLabel("主力選手を除外").uncheck();
  await page.getByLabel("戦力外候補を検索").fill(original.name);
  const card = page.locator(`[data-player-id="${original.id}"]`);
  await expect(card).toHaveCount(1);
  const rows = card.getByRole("table").locator("tbody tr");
  await expect(rows).toHaveCount(3);
  await expect(card.getByRole("table")).not.toContainText("記録なし");
  await expect(rows.nth(1)).toContainText("補完");
  await expect(rows.nth(2)).toContainText("補完");
  const grades = await card
    .locator(".candidate-skills [data-grade]")
    .evaluateAll((nodes) =>
      nodes.map((n) => ({
        rank: n.getAttribute("data-grade"),
        color: getComputedStyle(n).color,
      })),
    );
  expect(grades.map((g) => g.rank)).toEqual(["S", "A", "B", "C", "D", "E"]);
  expect(new Set(grades.map((g) => g.color)).size).toBe(6);
  const skills = card.locator(".candidate-skills");
  expect((await skills.boundingBox())!.height).toBeLessThanOrEqual(65);
  await skills.evaluate((el) =>
    el.scrollIntoView({ block: "center", behavior: "instant" }),
  );
  await skills.screenshot({
    path: "test-results/compact-colored-abilities.png",
  });
  const table = card.getByRole("table");
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
  await page.locator(".player-summary").click();
  const modal = page.getByRole("dialog");
  await expect(modal.locator(".ability-chip")).toHaveCount(6);
  expect(
    (await modal.locator(".ability-grid").boundingBox())!.height,
  ).toBeLessThanOrEqual(65);
  await modal
    .locator(".ability-grid")
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
