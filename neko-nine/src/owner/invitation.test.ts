import "fake-indexeddb/auto";
import { beforeAll, expect, it } from "vitest";
import { createWorld, applyOwnerAction } from "./engine";
import { grade, type WorldState } from "./model";
import { invitationAvailable, invitationCandidates } from "./invitation";
import { seniorRoster, phaseBlockers } from "./operations";
import { backfillCareerHistory } from "./history";
import { normalizePlayerNames } from "./identity";
import { persistWorld, loadWorld, validateWorld } from "./storage";
import { nextEventLabel } from "./Secretary";
let base: WorldState;
beforeAll(() => {
  base = createWorld();
}, 30000);
it("creates all four exact rookie profiles without fictional 2026 or reserve appearances", () => {
  const players = invitationCandidates();
  expect(players.map((p) => [p.name, p.position])).toEqual([
    ["シロックスラー", "一"],
    ["湯上谷 モジ", "三"],
    ["浜名 ヤス", "二"],
    ["坊西 ヒン", "捕"],
  ]);
  expect(
    players.map((p) =>
      ["contact", "power", "speed", "catching", "arm", "fielding"].map((k) =>
        grade(p.skills[k as keyof typeof p.skills]),
      ),
    ),
  ).toEqual([
    ["S", "F", "F", "F", "F", "F"],
    ["D", "S", "E", "C", "D", "C"],
    ["C", "C", "C", "B", "B", "S"],
    ["D", "D", "D", "A", "A", "A"],
  ]);
  for (const p of players) {
    expect([p.age, p.popularity, p.morale, p.durability, p.pro]).toEqual([
      22, 80, 80, 80, 0,
    ]);
    expect(p.reports[2026].games).toBe(0);
    expect(p.draftYear).toBe(2027);
  }
});
it("requires exactly two choices, supports cancellation, and registers once without changing RNG or cash", () => {
  let w = applyOwnerAction(base, { type: "advance" });
  expect(w.phase).toBe("invitation");
  expect(nextEventLabel(base)).toBe("特別招待選手を選ぶ");
  expect(() => applyOwnerAction(w, { type: "advance" })).toThrow(/2名/);
  w = applyOwnerAction(w, { type: "toggleInvitation", id: "invite-shiroxler" });
  w = applyOwnerAction(w, { type: "toggleInvitation", id: "invite-moji" });
  expect(() =>
    applyOwnerAction(w, { type: "toggleInvitation", id: "invite-yasu" }),
  ).toThrow(/2名/);
  w = applyOwnerAction(w, { type: "toggleInvitation", id: "invite-moji" });
  w = applyOwnerAction(w, { type: "toggleInvitation", id: "invite-hin" });
  const cash = w.teams[0].finance.cash,
    seed = w.seed,
    count = seniorRoster(w).length;
  const result = applyOwnerAction(w, { type: "advance" });
  expect(result.phase).toBe("core");
  expect(result.invitationComplete).toBe(true);
  expect(seniorRoster(result)).toHaveLength(count + 2);
  expect(
    result.players.filter((p) => p.invitationKey).map((p) => p.name),
  ).toEqual(["シロックスラー", "坊西 ヒン"]);
  expect(result.seed).toBe(seed);
  expect(result.teams[0].finance.cash).toBe(cash);
  backfillCareerHistory(result);
  normalizePlayerNames(result);
  const shiro = result.players.find((p) => p.id === "invite-shiroxler")!;
  expect(shiro.name).toBe("シロックスラー");
  expect(shiro.reports[2026].games).toBe(0);
  expect(shiro.farmReports).toBeUndefined();
  expect(result.developmentBaseline!.players[shiro.id].skills).toEqual(
    shiro.skills,
  );
  expect(() =>
    applyOwnerAction(result, { type: "toggleInvitation", id: "invite-yasu" }),
  ).toThrow();
  result.phase = "review";
  expect(applyOwnerAction(result, { type: "advance" }).phase).toBe("core");
});
it("preserves selection and acquired player identities in saves", async () => {
  let w = applyOwnerAction(base, { type: "advance" });
  w = applyOwnerAction(w, { type: "toggleInvitation", id: "invite-yasu" });
  await persistWorld(w);
  let loaded = (await loadWorld())!;
  expect(loaded.invitationPicks).toEqual(["invite-yasu"]);
  loaded = applyOwnerAction(loaded, {
    type: "toggleInvitation",
    id: "invite-shiroxler",
  });
  loaded = applyOwnerAction(loaded, { type: "advance" });
  await persistWorld(loaded);
  const restored = (await loadWorld())!;
  expect(restored.players.filter((p) => p.invitationKey)).toEqual(
    loaded.players.filter((p) => p.invitationKey),
  );
});
it("skips the invitation in later years and older saves, enforcing the normal registration cap", () => {
  const old = structuredClone(base);
  delete old.invitationOffered;
  expect(invitationAvailable(old)).toBe(false);
  expect(applyOwnerAction(old, { type: "advance" }).phase).toBe("core");
  const future = { ...base, year: 2027 };
  expect(applyOwnerAction(future, { type: "advance" }).phase).toBe("core");
  const w = applyOwnerAction(base, { type: "advance" });
  w.invitationPicks = ["invite-yasu", "invite-hin"];
  for (const p of w.players.filter((p) => p.team === 0))
    p.registration = "senior";
  expect(phaseBlockers(w).join()).toContain("支配下枠");
  expect(() => applyOwnerAction(w, { type: "advance" })).toThrow(/支配下/);
  w.invitationPicks = ["invite-yasu", "invite-yasu"];
  expect(() => validateWorld(w)).toThrow(/特別招待/);
});
