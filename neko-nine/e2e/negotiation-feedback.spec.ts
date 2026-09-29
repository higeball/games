import { expect, test } from "@playwright/test";

test("FA negotiation shows errors and the player's answer inside the dialog", async ({
  page,
}) => {
  await page.goto("/games/neko-nine/");
  await page.getByRole("button", { name: /2026年オフから就任/ }).click();
  await expect(page.getByRole("status")).toHaveCount(0);
  const playerName = await page.evaluate(
    () =>
      new Promise<string>((resolve, reject) => {
        const r = indexedDB.open("neko-owner-v3", 1);
        r.onerror = () => reject(r.error);
        r.onsuccess = () => {
          const db = r.result,
            tx = db.transaction("saves", "readwrite"),
            s = tx.objectStore("saves"),
            q = s.get("current");
          let name = "";
          q.onsuccess = () => {
            const w = q.result;
            w.phase = "fa";
            const p = w.players.find(
              (p: any) => p.team === 1 && p.species === "cat",
            );
            p.formerTeam = 1;
            p.team = null;
            p.market = "fa";
            p.faRank = "C";
            p.ask = 1500;
            p.offerRound = 0;
            p.offers = [];
            name = p.name;
            s.put(w, "current");
          };
          tx.oncomplete = () => {
            db.close();
            resolve(name);
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
  await page.reload();
  await expect(page.locator(".market-tabs")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "FA交渉を始める", exact: true }),
  ).toHaveCount(1);
  await page
    .getByRole("button", { name: "FA交渉を始める", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "選手詳細" });
  await dialog.getByLabel("提示年俸", { exact: true }).fill("0");
  await dialog
    .getByRole("button", { name: "年俸を提示する", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText("500万円以上");
  await dialog.getByLabel("提示年俸", { exact: true }).fill("500");
  await dialog
    .getByRole("button", { name: "年俸を提示する", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(dialog.getByRole("alert")).toHaveCount(0);
  await expect(dialog.locator(".negotiation-response")).toContainText(
    playerName,
  );
  await dialog.locator(".negotiation-response").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/negotiation-answer.png" });
  await page.getByRole("button", { name: "閉じる ×", exact: true }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /選手名鑑/ })
    .click();
  await expect(page.locator(".status-advance")).toHaveCount(0);
  await page.getByRole("button", { name: /他球団FA選手の獲得に戻る/ }).click();
  await expect(
    page.getByRole("heading", { name: "他球団FA選手の獲得", exact: true }),
  ).toBeVisible();
});
