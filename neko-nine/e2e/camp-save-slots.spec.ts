import { expect, test } from "@playwright/test";

test("camp plan and results survive three-slot saves, title return and a new game", async ({
  page,
}) => {
  test.setTimeout(120_000);
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
  const settings = async () => {
    await page.getByRole("button", { name: "保存と設定", exact: true }).click();
    await expect(
      page.getByRole("region", { name: "3つのセーブ枠" }),
    ).toBeVisible();
  };
  const save = async (slot: number) => {
    await click(`セーブ${slot}に保存`);
    await expect(
      page.getByText(`セーブ${slot}に保存しました。`, { exact: true }),
    ).toBeVisible();
  };
  const load = async (slot: number) => {
    await click(`セーブ${slot}をロード`);
    await click("ロードする");
  };
  const checkWidths = async () => {
    for (const width of [360, 430, 1100]) {
      await page.setViewportSize({ width, height: 844 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await page.setViewportSize({ width: 390, height: 844 });
  };
  await page.goto("/games/neko-nine/");
  await click(/2026年オフから就任/);
  await click(/第1次戦力外通告へ進む/);
  await click(/ドラフト会議へ進む/);
  await click("指名を終了");
  await click(/ドラフト会議を終了し秋季キャンプへ進む/);
  await expect(
    page.getByRole("region", { name: "キャンプ計画" }),
  ).toBeVisible();
  await page.getByLabel("キャンプ開催地").selectOption("1");
  await settle();
  await page.getByLabel("追加練習予算").selectOption("2500");
  await settle();
  await page.locator(".camp-special-details > summary").click();
  await click("若手5人を自動で選ぶ");
  await expect(
    page.getByRole("button", { name: "集中指導に追加", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "このキャンプ計画を保存", exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await page.locator(".camp-special-details > summary").click();
  await expect(page.getByLabel("キャンプ開催地")).toHaveValue("1");
  await expect(page.getByLabel("追加練習予算")).toHaveValue("2500");
  await expect(page.getByLabel("集中指導5の選手")).not.toHaveValue("");
  await checkWidths();
  await page.screenshot({
    path: "test-results/camp-plan-new.png",
    fullPage: true,
  });
  await settings();
  await save(1);
  await click("閉じる ×");
  await click("この内容でキャンプを実施");
  await expect(
    page.getByRole("region", { name: "キャンプ結果" }),
  ).toBeVisible();
  expect(await page.locator(".camp-change").count()).toBeGreaterThan(0);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /チーム戦力/ })
    .click();
  expect(
    Number(await page.locator(".team-score > b").textContent()),
  ).toBeGreaterThan(0);
  await expect(page.locator(".status-advance")).toHaveCount(0);
  await click(/秋季キャンプに戻る/);
  await checkWidths();
  const firstResult = await page
    .locator(".camp-result-list article")
    .first()
    .textContent();
  await page.screenshot({
    path: "test-results/camp-results-new.png",
    fullPage: true,
  });
  await settings();
  await save(2);
  await save(3);
  await click("セーブ1に保存");
  await expect(
    page.getByRole("dialog", { name: "セーブを上書きしますか？" }),
  ).toBeVisible();
  await page
    .getByRole("dialog", { name: "セーブを上書きしますか？" })
    .getByRole("button", { name: "戻る", exact: true })
    .click();
  await checkWidths();
  await page.screenshot({
    path: "test-results/save-slots-new.png",
    fullPage: true,
  });
  await click("タイトル画面に戻る");
  await expect(
    page.getByRole("button", { name: "続きから再開する", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "続きから再開する", exact: true }),
  ).toBeVisible();
  await click("続きから再開する");
  await expect(page.locator(".camp-result-list article").first()).toHaveText(
    firstResult,
  );
  await settings();
  await click("タイトル画面に戻る");
  await click(/2026年から最初からプレイ/);
  await click("最初から始める");
  await expect(
    page.getByRole("heading", { name: "来季までの全体の流れ" }),
  ).toBeVisible();
  await settings();
  await load(2);
  await expect(page.locator(".camp-result-list article").first()).toHaveText(
    firstResult,
  );
  await settings();
  await load(1);
  await expect(
    page.getByRole("region", { name: "キャンプ計画" }),
  ).toBeVisible();
  await expect(page.getByLabel("追加練習予算")).toHaveValue("2500");
  await expect(page.getByLabel("集中指導5の選手")).not.toHaveValue("");
  await settings();
  await load(3);
  await expect(page.locator(".camp-result-list article").first()).toHaveText(
    firstResult,
  );
  expect(errors).toEqual([]);
});
