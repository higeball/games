import { expect, test } from "@playwright/test";

test("own FA retention is separate, confirmed in-app and retained across reloads", async ({
  page,
}) => {
  test.setTimeout(90000);
  const nativeDialogs: string[] = [];
  page.on("dialog", async (dialog) => {
    nativeDialogs.push(dialog.type());
    await dialog.dismiss();
  });
  await page.goto("/games/neko-nine/");
  await page.getByRole("button", { name: /2026年オフから就任/ }).click();
  await expect(page.getByRole("status")).toHaveCount(0);
  const names = await page.evaluate(
    () =>
      new Promise<string[]>((resolve, reject) => {
        const req = indexedDB.open("neko-owner-v3", 1);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result,
            tx = db.transaction("saves", "readwrite"),
            store = tx.objectStore("saves"),
            q = store.get("current");
          let names: string[] = [];
          q.onsuccess = () => {
            const w = q.result;
            const own = w.players
              .filter((p: any) => p.team === 0 && p.species === "cat")
              .slice(0, 2);
            const other = w.players.find(
              (p: any) => p.team === 1 && p.species === "cat",
            );
            const players = [...own, other];
            names = players.map((p) => p.name);
            players.forEach((p) => {
              p.formerTeam = p.team;
              p.team = null;
              p.market = "fa";
              p.ask = 1500;
              p.faRank = "C";
              p.offers = [];
              p.offerRound = 0;
            });
            w.phase = "retain";
            w.faDeclarations = { year: w.year, ids: players.map((p) => p.id) };
            store.put(w, "current");
          };
          tx.oncomplete = () => {
            db.close();
            resolve(names);
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "自球団FA選手の引き止め", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".retention-card")).toHaveCount(2);
  await expect(
    page.locator(".retention-card").filter({ hasText: names[2] }),
  ).toHaveCount(0);
  await expect(page.locator(".market-tabs")).toHaveCount(0);
  await expect(page.locator(".status-advance")).toBeDisabled();
  const retained = page
    .locator(".retention-card")
    .filter({ hasText: names[0] });
  await retained.getByRole("button", { name: "残留交渉をする" }).click();
  const detail = page.getByRole("dialog", { name: "選手詳細" });
  await detail.getByLabel("提示年俸", { exact: true }).fill("10000");
  await detail
    .getByRole("button", { name: "年俸を提示する", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveCount(0);
  await detail.getByRole("button", { name: "閉じる ×", exact: true }).click();
  await expect(retained).toContainText("残留決定");
  const leaving = page.locator(".retention-card").filter({ hasText: names[1] });
  await leaving.getByRole("button", { name: "引き止めを見送る" }).click();
  const confirm = page.getByRole("dialog", {
    name: "引き止めを見送りますか？",
  });
  await confirm.getByRole("button", { name: "戻る", exact: true }).click();
  await expect(page.locator(".status-advance")).toBeDisabled();
  await leaving.getByRole("button", { name: "引き止めを見送る" }).click();
  await confirm.getByRole("button", { name: "見送りを確定" }).click();
  await expect(page.getByRole("status")).toHaveCount(0);
  await page.reload();
  await expect(retained).toContainText("残留決定");
  await expect(leaving).toContainText("引き止め見送り");
  await expect(page.locator(".status-advance")).toBeEnabled();
  await page.screenshot({ path: "test-results/serial-retention-mobile.png" });
  await page.locator(".status-advance").click();
  await expect(
    page.getByRole("heading", { name: "合同トライアウト", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /保存・設定|保存と設定|セーブ・設定/ })
    .click();
  await page
    .locator('input[type="file"]')
    .setInputFiles({
      name: "invalid.json",
      mimeType: "application/json",
      buffer: Buffer.from("{}"),
    });
  const importing = page.getByRole("dialog", {
    name: "セーブを読み込みますか？",
  });
  await expect(importing).toBeVisible();
  await importing.getByRole("button", { name: "戻る", exact: true }).click();
  expect(nativeDialogs).toEqual([]);
});
