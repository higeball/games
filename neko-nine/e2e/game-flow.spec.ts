import { expect, test } from "@playwright/test";
test("Fukuoka owner completes the new calendar, negotiates and resumes offline", async ({
  page,
  context,
}) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const click = async (name: string | RegExp) => {
    await page
      .getByRole("button", { name, exact: typeof name === "string" })
      .click();
    await expect(page.getByRole("status")).toHaveCount(0);
    await expect(page.getByRole("alert")).toHaveCount(0);
  };
  const home = async () =>
    page
      .getByRole("navigation")
      .getByRole("button", { name: /ホーム/ })
      .click();
  const event = async () => {
    if (
      await page.getByRole("button", { name: /今すぐイベントへ進む/ }).count()
    )
      await click(/今すぐイベントへ進む/);
  };
  const camp = async () => click("保存した計画でキャンプを実施");
  await page.goto("/games/neko-nine/");
  await click(/2026年オフから就任/);
  await expect(
    page.getByRole("heading", { name: "来季までの全体の流れ" }),
  ).toBeVisible({
    timeout: 30_000,
  });
  await page.screenshot({
    path: "test-results/fukuoka-home.png",
    fullPage: true,
  });
  await click(/第1次戦力外通告へ進む/);
  await expect(
    page.getByRole("heading", { name: "戦力外候補を比較する" }),
  ).toBeVisible();
  await click(/ドラフト会議へ進む/);
  await event();
  await page
    .getByRole("button", { name: "指名する", exact: true })
    .first()
    .click();
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(page.locator(".lottery-result")).toBeVisible();
  await page.screenshot({
    path: "test-results/fukuoka-draft.png",
    fullPage: true,
  });
  await click("指名を終了");
  await home();
  await click(/秋季キャンプへ進む/);
  await event();
  await camp();
  await home();
  await click(/FA公示・第2次戦力外へ進む/);
  await home();
  await expect(page.getByRole("heading", { name: "一年の決算" })).toBeVisible();
  await click(/合同トライアウトへ進む/);
  await click(/現役ドラフトへ進む/);
  await event();
  await click("この選手交換で確定");
  await home();
  await click(/契約更改へ進む/);
  await event();
  await click(/査定年俸を一括提示/);
  await page.getByLabel("来季年俸予算").selectOption("400000");
  await expect(page.getByRole("status")).toHaveCount(0);
  await page.screenshot({
    path: "test-results/fukuoka-contracts.png",
    fullPage: true,
  });
  for (
    let guard = 0;
    (await page.locator(".player-summary").count()) > 0 && guard < 15;
    guard++
  ) {
    await page.locator(".player-summary").first().click();
    await page.getByLabel("契約期間").selectOption("2");
    await page.getByLabel(/出来高を追加/).check();
    await click("年俸を提示する");
    await click("閉じる ×");
  }
  await expect(page.getByText(/要面談 0人/)).toBeVisible();
  await home();
  await click(/自主トレ・施設・人事へ進む/);
  await event();
  for (let i = 0; i < 6; i++) {
    await page
      .getByRole("button", { name: "契約を更新", exact: true })
      .first()
      .click();
    await expect(page.getByRole("status")).toHaveCount(0);
  }
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /施設・経営/ })
    .click();
  await page.screenshot({
    path: "test-results/fukuoka-business.png",
    fullPage: true,
  });
  await home();
  await click(/春季キャンプへ進む/);
  await event();
  const pitcher = await page
    .getByLabel("特別指定選手")
    .locator("option")
    .evaluateAll((options) =>
      options
        .find((o) => o.textContent?.startsWith("投 "))
        ?.getAttribute("value"),
    );
  expect(pitcher).toBeTruthy();
  await page.getByLabel("特別指定選手").selectOption(pitcher!);
  await page.getByLabel("指導内容").selectOption("pitch");
  await click("集中指導に追加");
  await click("このキャンプ計画を保存");
  await page.screenshot({
    path: "test-results/fukuoka-camp.png",
    fullPage: true,
  });
  await camp();
  await home();
  await click(/オープン戦へ進む/);
  await event();
  await click("オープン戦を実施");
  await home();
  await click(/開幕一軍登録へ進む/);
  await event();
  await expect(page.getByText(/一軍 31\/31人/)).toBeVisible();
  await page.screenshot({
    path: "test-results/fukuoka-registration.png",
    fullPage: true,
  });
  for (const width of [360, 430, 1100]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await home();
  await click(/レギュラーシーズン開幕/);
  await expect(page.locator(".status-date")).toContainText("2027年 4月");
  await click("4月を進める →");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /編成・補強/ })
    .click();
  await page
    .getByRole("button", { name: "調査 200万円", exact: true })
    .first()
    .click();
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(
    page.locator(".prospect-grid progress").first(),
  ).not.toHaveAttribute("value", "0");
  await home();
  await page.reload();
  await expect(page.locator(".status-date")).toContainText("2027年 5月");
  await click("残りのシーズンを高速ダイジェスト");
  await expect(page.locator(".status-date")).toContainText("2027年 10月上旬");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  expect(
    await page.evaluate(
      async () => !!(await caches.match("/games/neko-nine/index.html")),
    ),
  ).toBe(true);
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator(".status-date")).toContainText("2027年 10月上旬");
  await click(/第1次戦力外通告へ進む/);
  await click(/ドラフト会議へ進む/);
  await event();
  await click("指名を終了");
  await home();
  await click(/秋季キャンプへ進む/);
  await event();
  await camp();
  await home();
  await click(/FA公示・第2次戦力外へ進む/);
  await home();
  await expect(page.getByRole("heading", { name: "一年の決算" })).toBeVisible();
  await page.screenshot({
    path: "test-results/fukuoka-annual.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
