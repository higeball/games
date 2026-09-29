import { expect, type Page } from "@playwright/test";

export async function completeInvitation(page: Page) {
  await page
    .getByRole("button", { name: "湯上谷 モジを選ぶ", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveCount(0);
  await page
    .getByRole("button", { name: "浜名 ヤスを選ぶ", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveCount(0);
  await page
    .getByRole("button", {
      name: "この2名を獲得して主力選手一覧へ進む",
      exact: true,
    })
    .click();
  await expect(page.getByRole("status")).toHaveCount(0);
}
export async function chooseInvitations(page: Page) {
  await page.getByRole("button", { name: /特別招待選手を選ぶ/ }).click();
  await expect(page.getByRole("status")).toHaveCount(0);
  await completeInvitation(page);
}
