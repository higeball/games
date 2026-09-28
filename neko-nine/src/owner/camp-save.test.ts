import "fake-indexeddb/auto";
import { beforeAll, expect, it } from "vitest";
import { applyOwnerAction, createWorld, roster } from "./engine";
import { CAMPS, type WorldState } from "./model";
import {
  listSaveSlots,
  loadWorld,
  loadWorldSlot,
  persistWorld,
  saveWorldSlot,
  validateWorld,
} from "./storage";

let world: WorldState;
beforeAll(() => {
  world = createWorld();
}, 30000);

it("keeps three independent snapshots separate from autosave and requires explicit overwrite", async () => {
  expect(await listSaveSlots()).toEqual([null, null, null]);
  await expect(loadWorldSlot(1)).rejects.toThrow(/空いて/);
  for (const slot of [0, 4])
    await expect(saveWorldSlot(slot, world)).rejects.toThrow(/1〜3/);
  await persistWorld(world);
  for (const slot of [1, 2, 3]) {
    const snapshot = structuredClone(world);
    snapshot.revision = slot;
    await saveWorldSlot(slot, snapshot);
  }
  expect((await listSaveSlots()).map((s) => s?.slot)).toEqual([1, 2, 3]);
  await expect(saveWorldSlot(1, world)).rejects.toThrow(/上書き/);
  expect((await loadWorldSlot(1)).revision).toBe(1);
  await saveWorldSlot(1, world, true);
  expect((await loadWorldSlot(2)).revision).toBe(2);
  expect((await loadWorldSlot(3)).revision).toBe(3);
  expect((await loadWorld())?.revision).toBe(world.revision);
  const newGame = structuredClone(world);
  newGame.revision = 99;
  await persistWorld(newGame);
  expect((await loadWorldSlot(2)).revision).toBe(2);
  expect((await loadWorldSlot(3)).revision).toBe(3);
  expect((await loadWorld(true))?.revision).toBe(world.revision);
});

it("records exact camp changes, position and pitches, and preserves the plan/report in saves", async () => {
  const before = structuredClone(world);
  before.phase = "autumn";
  before.campDone = false;
  const pitcher = roster(before).find((p) => p.position === "投")!;
  const batter = roster(before).find((p) => p.position !== "投")!;
  const pitch = [
    "シュート",
    "フォーク",
    "カーブ",
    "スライダー",
    "チェンジアップ",
  ].find((n) => !pitcher.pitches.some((p) => p.name === n))!;
  const planned = applyOwnerAction(before, {
    type: "campPlan",
    plan: {
      location: 1,
      budget: 2500,
      focuses: ["contact"],
      legend: "none",
      special: [
        { id: pitcher.id, kind: "pitch", pitch },
        { id: batter.id, kind: "convert", position: "右" },
      ],
    },
  });
  const after = applyOwnerAction(planned, {
    type: "camp",
    location: 1,
    focus: "contact",
  });
  const report = after.campReport!;
  expect(report.cost).toBe(CAMPS[1].cost + 2500);
  expect(planned.teams[0].finance.cash - after.teams[0].finance.cash).toBe(
    report.cost,
  );
  expect(report.players).toHaveLength(roster(after).length);
  for (const entry of report.players) {
    const old = before.players.find((p) => p.id === entry.id)!;
    const next = after.players.find((p) => p.id === entry.id)!;
    for (const change of entry.changes) {
      expect(change.before).toBe(old.skills[change.skill]);
      expect(change.after).toBe(next.skills[change.skill]);
      expect(change.before).not.toBe(change.after);
    }
  }
  expect(
    report.players.find((p) => p.id === pitcher.id)?.pitches,
  ).toContainEqual({ name: pitch, before: 0, after: 1 });
  expect(report.players.find((p) => p.id === batter.id)?.positionAfter).toBe(
    "右",
  );
  expect(
    report.players.find((p) => p.id === batter.id)?.changes,
  ).toContainEqual({
    skill: "fielding",
    before: batter.skills.fielding,
    after: batter.skills.fielding - 5,
  });
  await saveWorldSlot(1, after, true);
  expect((await loadWorldSlot(1)).campReport).toEqual(report);
  expect((await loadWorldSlot(1)).campPlan.location).toBe(1);
  expect(before.campReport).toBeUndefined();
  const corrupt = structuredClone(after);
  corrupt.campReport!.location = 100;
  expect(() => validateWorld(corrupt)).toThrow(/キャンプ結果/);
  expect(() =>
    applyOwnerAction(after, { type: "camp", location: 1, focus: "contact" }),
  ).toThrow(/実施済み/);
});
