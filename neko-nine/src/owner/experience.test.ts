import "fake-indexeddb/auto";
import { beforeAll, expect, it } from "vitest";
import { createWorld, applyOwnerAction } from "./engine";
import {
  recordStrengthBaseline,
  actionFeedback,
  eventObjective,
} from "./experience";
import { teamStrength } from "./operations";
import {
  persistWorld,
  loadWorld,
  saveWorldSlot,
  loadWorldSlot,
} from "./storage";
import type { WorldState } from "./model";

let initial: WorldState;
beforeAll(() => {
  initial = createWorld();
}, 30000);
it("compares real camp improvements against a persistent baseline and restores it from a slot", async () => {
  const before = structuredClone(initial);
  recordStrengthBaseline(before);
  const base = structuredClone(before.strengthBaseline);
  before.phase = "autumn";
  const after = applyOwnerAction(before, {
    type: "camp",
    location: 2,
    focus: "contact",
  });
  recordStrengthBaseline(after);
  expect(after.strengthBaseline).toEqual(base);
  expect(teamStrength(after).reduce((n, s) => n + s.score, 0)).toBeGreaterThan(
    base!.scores.reduce((n, s) => n + s.score, 0),
  );
  await saveWorldSlot(1, after);
  expect((await loadWorldSlot(1)).strengthBaseline).toEqual(base);
  after.phase = "season";
  after.year++;
  recordStrengthBaseline(after);
  expect(after.strengthBaseline).toEqual(base);
  after.phase = "review";
  recordStrengthBaseline(after);
  expect(after.strengthBaseline?.year).toBe(after.year);
  expect(after.strengthBaseline?.scores).toEqual(
    teamStrength(after).map(({ name, score }) => ({ name, score })),
  );
});
it("starts comparison at an old save's actual state, without inventing past improvements", async () => {
  const legacy = structuredClone(initial);
  legacy.phase = "spring";
  delete legacy.strengthBaseline;
  await persistWorld(legacy);
  const loaded = (await loadWorld())!;
  expect(loaded.strengthBaseline?.scores).toEqual(
    teamStrength(legacy).map(({ name, score }) => ({ name, score })),
  );
  expect(loaded.strengthBaseline?.label).toContain("春季キャンプ");
  expect((await loadWorld())?.strengthBaseline).toEqual(
    loaded.strengthBaseline,
  );
});
it("reports only actual action changes and keeps optional events distinct from required work", () => {
  const w = structuredClone(initial);
  w.phase = "release";
  expect(eventObjective(w).state).toBe("選択は任意");
  w.phase = "autumn";
  w.campDone = false;
  expect(eventObjective(w).state).toBe("編成中");
  w.campDone = true;
  expect(eventObjective(w).state).toBe("完了");
  expect(
    actionFeedback(w, w, { type: "campPlan", plan: w.campPlan }),
  ).toBeNull();
  const next = structuredClone(w);
  next.teams[0].finance.cash -= 2000;
  expect(
    actionFeedback(w, next, { type: "invest", facility: 0 })?.changes,
  ).toEqual(["資金 −2,000万円"]);
});
