import { expect, test } from "@playwright/test";
import { chooseInvitations } from "./invitation-helpers";

test("restrained profile styling, entry pay and persistent scouting feedback", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const settle = async () => {
    await expect(page.getByRole("status")).toHaveCount(0);
    await expect(page.getByRole("alert")).toHaveCount(0);
  };
  await page.setViewportSize({ width: 360, height: 844 });
  await page.goto("/games/neko-nine/");
  await page.getByRole("button", { name: /2026年オフから就任/ }).click();
  await settle();
  const dates = page.locator(".season-overview li small");
  await expect(dates.first()).toHaveText("2026年10月上旬");
  await expect(
    page.locator('.season-overview [data-phase="spring"] small'),
  ).toHaveText("2027年2月");
  expect(
    await dates
      .first()
      .evaluate((el) => getComputedStyle(el, "::before").content),
  ).toBe("none");
  await chooseInvitations(page);
  await page
    .getByRole("button", { name: /第1次戦力外通告・育成打診へ進む/ })
    .click();
  await settle();
  await expect(
    page.getByRole("button", { name: "戦力外選手候補（約10人）", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/おすすめ候補/)).toHaveCount(0);
  const candidate = page.locator(".release-candidate").first();
  await expect(candidate.locator(".candidate-age")).toContainText("歳");
  const ageSize = await candidate
    .locator(".candidate-age b")
    .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(ageSize).toBeGreaterThanOrEqual(14);
  expect(ageSize).toBeLessThanOrEqual(16);
  const plates = candidate.locator(".ability-plate");
  expect(
    new Set(
      await plates.evaluateAll((els) =>
        els.map((el) => getComputedStyle(el).backgroundColor),
      ),
    ).size,
  ).toBe(1);
  await candidate.locator(".candidate-heading").scrollIntoViewIfNeeded();
  await candidate
    .locator(".candidate-heading")
    .screenshot({ path: "test-results/age-prominent.png" });
  await page
    .getByRole("button", { name: /第1次戦力外通告・育成打診を終了し/ })
    .click();
  await settle();
  const name = await page.locator(".prospect-name b").first().innerText();
  const prospect = page
    .locator(".prospect-grid > article")
    .filter({ hasText: name });
  await expect(prospect.locator(".scouting-status b")).toHaveText("調査 0回");
  let count = 0;
  while (
    (await prospect.getByRole("button", { name: /調査 200万円/ }).count()) &&
    count < 6
  ) {
    const button = prospect.getByRole("button", { name: /調査 200万円/ });
    if (await button.isDisabled()) break;
    await button.click();
    await settle();
    count++;
    await expect(prospect.locator(".scouting-status b")).toHaveText(
      `調査 ${count}回`,
    );
    await expect(prospect.locator(".scouting-change")).toContainText(
      `${count}回目：`,
    );
    await expect(prospect.locator(".scouting-change")).toContainText("→");
    if (count === 1)
      await prospect.screenshot({ path: "test-results/scouting-feedback.png" });
  }
  expect(count).toBeGreaterThan(0);
  await expect(
    prospect.getByRole("button", { name: "調査完了", exact: true }),
  ).toBeDisabled();
  await prospect.locator(".prospect-name").click();
  let modal = page.getByRole("dialog", { name: "選手詳細" });
  await expect(modal.locator(".contract-facts")).toContainText("未契約");
  await expect(modal.locator(".contract-facts")).toContainText(
    "入団時年俸 600万円",
  );
  await expect(modal.locator(".contract-facts")).not.toContainText("5,400");
  await page.getByRole("button", { name: "閉じる ×" }).click();
  await page.reload();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /進行/ })
    .click();
  await settle();
  await expect(prospect.locator(".scouting-status b")).toHaveText(
    `調査 ${count}回`,
  );
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /選手名鑑/ })
    .click();
  await page.getByLabel("守備位置", { exact: true }).selectOption("投");
  await page.locator(".player-summary").first().click();
  modal = page.getByRole("dialog", { name: "選手詳細" });
  const panel = modal.getByRole("region", { name: "投手能力画面" });
  await expect(panel).toBeVisible();
  await expect(panel.locator(".pitcher-primary .ability-chip")).toHaveCount(2);
  const labels = await panel
    .locator(".pitcher-primary .ability-chip small")
    .allTextContents();
  expect(labels).toEqual(["制球", "スタミナ"]);
  await expect(panel.locator(".pitcher-primary")).toContainText("球速");
  await expect(panel.locator(".ability-season")).toHaveCount(0);
  await expect(
    modal.getByRole("table", { name: /一軍直近3年成績/ }),
  ).toBeVisible();
  await expect(
    panel.getByRole("img", { name: "変化球の方向と7段階の変化量" }),
  ).toBeVisible();
  await expect(panel.locator(".pitch-memory")).toHaveCount(0);
  expect(
    await panel
      .locator(".pitch-labels")
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
  ).toBeGreaterThanOrEqual(12);
  await expect(panel.locator(".pitch-labels li").first()).toBeVisible();
  for (const width of [360, 390, 430, 1100]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await panel.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
      true,
    );
    expect(await modal.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
      true,
    );
    expect(
      (await panel.locator(".pitcher-primary").boundingBox())!.height,
    ).toBeLessThanOrEqual(60);
    const left = await panel.locator(".pitch-chart").boundingBox();
    const right = await panel.locator(".pitch-list").boundingBox();
    expect(left!.x + left!.width).toBeLessThan(right!.x);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await panel.screenshot({ path: "test-results/pitcher-ability-panel.png" });
  expect(errors).toEqual([]);
});
