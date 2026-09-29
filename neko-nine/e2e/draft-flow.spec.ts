import { expect, test } from "@playwright/test";

test("mobile draft advances only after each result, including lottery and reload", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const settle = async () => {
    await expect(page.getByRole("status")).toHaveCount(0);
    await expect(page.getByRole("alert")).toHaveCount(0);
  };
  const click = async (name: string | RegExp) => {
    await page
      .getByRole("button", { name, exact: typeof name === "string" })
      .click();
    await settle();
  };
  await page.goto("/games/neko-nine/");
  await click(/2026年オフから就任/);
  await click(/第1次戦力外通告・育成打診へ進む/);
  await expect(page.locator(".release-candidate")).toHaveCount(10);
  for (let i = 0; i < 3; i++) {
    await page
      .locator('.release-candidate[data-released="false"]')
      .first()
      .getByRole("button", { name: /に戦力外通告/ })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "戦力外通告を確定" })
      .click();
    await settle();
  }
  await click("第1次戦力外通告・育成打診を終了しドラフト会議へ進む");
  // A deterministic high-profile prospect ensures the browser test exercises a lottery.
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("neko-owner-v3", 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction("saves", "readwrite");
          const saves = tx.objectStore("saves");
          const read = saves.get("current");
          read.onsuccess = () => {
            const w = read.result;
            w.seed = 100003;
            const p = w.players
              .filter((p: any) => p.market === "draft")
              .sort(
                (a: any, b: any) =>
                  b.scouting - a.scouting ||
                  Number(a.id.slice(1)) - Number(b.id.slice(1)),
              )[0];
            Object.keys(p.skills).forEach((k) => {
              p.skills[k] = 100;
            });
            saves.put(w, "current");
          };
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            db.close();
            reject(tx.error);
          };
        };
      }),
  );
  await page.reload();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /進行/ })
    .click();
  await settle();
  const guide = page.getByRole("complementary", { name: "秘書フーミーの案内" });
  await expect(page.locator(".market-tabs, .event-progression")).toHaveCount(0);
  expect(
    (await page.getByRole("heading", { name: "ドラフト 第1巡" }).boundingBox())!
      .y,
  ).toBeGreaterThan((await guide.boundingBox())!.y);
  let reloaded = false;
  let sawLottery = false;
  for (let round = 1; round <= 6; round++) {
    let acquired = false;
    for (let attempt = 0; attempt < 20 && !acquired; attempt++) {
      await expect(
        page.getByRole("heading", {
          name: `ドラフト 第${round}巡`,
          exact: true,
        }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "指名する", exact: true })
        .first()
        .click();
      await settle();
      await expect(
        page.getByRole("button", { name: "指名する", exact: true }),
      ).toHaveCount(0);
      if (!reloaded) {
        await page.reload();
        await page
          .getByRole("navigation")
          .getByRole("button", { name: /進行/ })
          .click();
        await settle();
        reloaded = true;
      }
      if (
        await page
          .getByRole("button", { name: "くじを引く", exact: true })
          .count()
      ) {
        sawLottery = true;
        await expect(
          page.getByRole("region", { name: "競合指名・抽選待ち" }),
        ).toBeVisible();
        await page.screenshot({
          path: "test-results/draft-lottery.png",
          fullPage: true,
        });
        await click("くじを引く");
      }
      const result = page.getByRole("region", { name: "ドラフト指名結果" });
      await expect(result).toBeVisible();
      await expect(
        page.getByRole("heading", {
          name: `ドラフト 第${round}巡`,
          exact: true,
        }),
      ).toBeVisible();
      acquired =
        (await result.locator(".lottery-result strong").textContent()) ===
        "交渉権獲得！";
      const abilities = result.getByRole("region", {
        name: "獲得選手の確定能力",
      });
      if (acquired) {
        await expect(abilities).toBeVisible();
        expect(
          await abilities.locator(".ability-chip .grade").count(),
        ).toBeGreaterThanOrEqual(2);
        await expect(abilities.locator(".ability-rank i")).toHaveCount(0);
        await expect(abilities).not.toContainText("推定範囲");
        if (round === 2)
          await abilities.screenshot({
            path: "test-results/draft-acquired-abilities.png",
          });
      } else await expect(abilities).toHaveCount(0);
      if (round === 1)
        await page.screenshot({
          path: "test-results/draft-result.png",
          fullPage: true,
        });
      if (!acquired) await click("1巡目を再指名する");
      else
        await click(
          round === 6
            ? "ドラフトの結果を確定する"
            : `${round + 1}巡目の指名へ進む`,
        );
    }
    expect(acquired).toBe(true);
  }
  await expect(
    page.getByRole("heading", { name: "ドラフト指名終了", exact: true }),
  ).toBeVisible();
  expect(sawLottery).toBe(true);
  await expect(page.getByText("獲得 6人。", { exact: false })).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /チーム戦力/ })
    .click();
  await expect(page.locator(".newcomer-list > div")).toHaveCount(6);
  await expect(page.locator(".status-advance")).toHaveCount(0);
  await click(/ドラフト会議に戻る/);
  await expect(
    page.getByRole("heading", { name: "ドラフト指名終了", exact: true }),
  ).toBeVisible();
  for (const width of [360, 390, 430, 1100]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  const finish = page.getByRole("button", {
    name: "ドラフト会議を終了し秋季キャンプへ進む",
    exact: true,
  });
  await expect(finish).toBeEnabled();
  expect(await finish.evaluate((el) => !!el.closest(".owner-status"))).toBe(
    true,
  );
  await click("ドラフト会議を終了し秋季キャンプへ進む");
  await expect(
    page.getByRole("heading", { name: "秋季キャンプ", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
