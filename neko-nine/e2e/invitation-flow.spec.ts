import { expect, test } from "@playwright/test";

test("selects exactly two illustrated rookies, resumes selections and shows acquisition", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const click = async (name: string | RegExp) => {
    await page
      .getByRole("button", { name, exact: typeof name === "string" })
      .click();
    await expect(page.getByRole("status")).toHaveCount(0);
    await expect(page.getByRole("alert")).toHaveCount(0);
  };
  await page.goto("/games/neko-nine/");
  await click(/2026年オフから就任/);
  await expect(page.locator(".season-overview li").first()).toContainText(
    "特別招待選手",
  );
  await click(/特別招待選手を選ぶ/);
  await expect(page.locator(".invitation-card")).toHaveCount(4);
  const acquire = page.getByRole("button", {
    name: "この2名を獲得して主力選手一覧へ進む",
    exact: true,
  });
  await expect(acquire).toBeDisabled();
  for (const img of await page.locator(".invitation-card img").all()) {
    await expect(img).toBeVisible();
    await expect
      .poll(() =>
        img.evaluate(
          (el: HTMLImageElement) => el.complete && el.naturalWidth > 0,
        ),
      )
      .toBe(true);
  }
  for (const width of [360, 430, 1100]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/invitation-candidates.png",
    fullPage: true,
  });
  await click("湯上谷 モジを選ぶ");
  await page.reload();
  await expect(
    page.getByRole("button", {
      name: "湯上谷 モジの選択を取り消す",
      exact: true,
    }),
  ).toBeVisible();
  await click("浜名 ヤスを選ぶ");
  await expect(
    page.getByRole("button", { name: "坊西 ヒンを選ぶ", exact: true }),
  ).toBeDisabled();
  await click("湯上谷 モジの選択を取り消す");
  await click("坊西 ヒンを選ぶ");
  await expect(acquire).toBeEnabled();
  await acquire.click();
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "特別招待選手の獲得結果" }),
  ).toContainText("浜名 ヤス");
  await expect(
    page.getByRole("region", { name: "特別招待選手の獲得結果" }),
  ).toContainText("坊西 ヒン");
  const invited = await page.evaluate(
    () =>
      new Promise<any[]>((resolve, reject) => {
        const r = indexedDB.open("neko-owner-v3", 1);
        r.onerror = () => reject(r.error);
        r.onsuccess = () => {
          const db = r.result,
            tx = db.transaction("saves", "readonly"),
            q = tx.objectStore("saves").get("current");
          q.onsuccess = () =>
            resolve(q.result.players.filter((p: any) => p.invitationKey));
          tx.oncomplete = () => db.close();
        };
      }),
  );
  expect(invited).toHaveLength(2);
  expect(
    invited.every(
      (p) =>
        p.age === 22 &&
        p.popularity === 80 &&
        p.morale === 80 &&
        p.durability === 80 &&
        p.reports[2026].games === 0,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/invitation-acquired.png",
    fullPage: false,
  });
  await page.reload();
  await expect(
    page.getByRole("region", { name: "特別招待選手の獲得結果" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
