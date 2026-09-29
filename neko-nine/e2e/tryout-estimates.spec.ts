import { expect, test } from "@playwright/test";

test("experienced tryout estimates are narrow, consistent, and stable on reload", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.goto("/games/neko-nine/");
  await page.getByRole("button", { name: /2026年オフから就任/ }).click();
  await expect(page.getByRole("status")).toHaveCount(0);
  const entrants = await page.evaluate(
    () =>
      new Promise<Array<{ id: string; name: string; velocity: number }>>(
        (resolve, reject) => {
          const request = indexedDB.open("neko-owner-v3", 1);
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const db = request.result,
              tx = db.transaction("saves", "readwrite"),
              store = tx.objectStore("saves"),
              read = store.get("current");
            let entrants: Array<{
              id: string;
              name: string;
              velocity: number;
            }> = [];
            read.onsuccess = () => {
              const w = read.result;
              w.phase = "tryout";
              entrants = [true, false].map((pitcher) => {
                const p = w.players.find(
                  (p: any) =>
                    p.market === "tryout" && (p.position === "投") === pitcher,
                );
                p.pro = 8;
                p.scouting = 0;
                Object.keys(p.skills).forEach((key) => (p.skills[key] = 60));
                if (pitcher) p.pitches = [{ name: "スライダー", level: 4 }];
                return { id: p.id, name: p.name, velocity: p.velocity };
              });
              store.put(w, "current");
            };
            tx.oncomplete = () => {
              db.close();
              resolve(entrants);
            };
            tx.onerror = () => reject(tx.error);
          };
        },
      ),
  );
  await page.reload();
  const widths = (values: string[]) =>
    values.map((text) => {
      const [lo, hi] = text.split("〜").map(Number);
      return hi - lo;
    });
  for (const [i, entrant] of entrants.entries()) {
    await page.getByLabel("選手名・種類・役割で検索").fill(entrant.name);
    const row = page.locator(`[data-player-id="${entrant.id}"]`);
    const values = await row.locator(".ability-chip > b").allTextContents();
    expect(values).toHaveLength(i === 0 ? 2 : 6);
    expect(widths(values).every((width) => width > 0 && width <= 8)).toBe(true);
    await expect(row).toContainText("実績を踏まえた小幅な推定範囲");
    if (i === 0) {
      await expect(row.locator(".pitcher-velocity b")).toHaveText(
        `${entrant.velocity - 2}〜${entrant.velocity + 2}`,
      );
      await expect(
        row.getByRole("listitem", { name: "スライダー 変化量 3〜5" }),
      ).toBeVisible();
    }
    await row.locator(".player-summary").click();
    const detail = page.getByRole("dialog", { name: "選手詳細" });
    expect(await detail.locator(".ability-chip > b").allTextContents()).toEqual(
      values,
    );
    await detail.getByRole("button", { name: /追加調査 200万円/ }).click();
    await expect(page.getByRole("status")).toHaveCount(0);
    const surveyed = await detail
      .locator(".ability-chip > b")
      .allTextContents();
    expect(widths(surveyed).every((width) => width > 0 && width < 8)).toBe(
      true,
    );
    await detail.getByRole("button", { name: "閉じる ×", exact: true }).click();
    await page.reload();
    await page.getByLabel("選手名・種類・役割で検索").fill(entrant.name);
    expect(await row.locator(".ability-chip > b").allTextContents()).toEqual(
      surveyed,
    );
    await page.setViewportSize({ width: 360, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (i === 0)
      await row.screenshot({
        path: "test-results/tryout-estimates-mobile.png",
      });
  }
});
