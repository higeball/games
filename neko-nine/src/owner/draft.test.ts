import { beforeAll, expect, it } from "vitest";
import { advancePhase, applyOwnerAction, createWorld, random } from "./engine";
import { seniorRoster, phaseBlockers } from "./operations";
import type { WorldState } from "./model";

let initial: WorldState;
beforeAll(() => {
  initial = createWorld();
}, 30000);
function draftWorld() {
  const w = structuredClone(initial);
  w.phase = "release";
  for (const t of w.teams.slice(1)) t.finance.debt = 1; // No competing offers.
  return advancePhase(w);
}
it("holds a single nomination result until explicit advancement and prevents duplicate picks", () => {
  const w = draftWorld();
  const p = w.players.find((p) => p.market === "draft")!;
  const selected = applyOwnerAction(w, { type: "draft", id: p.id });
  expect(selected.draftPending).toMatchObject({
    round: 1,
    stage: "result",
    winner: 0,
  });
  expect(selected.draftRound).toBe(0);
  expect(selected.draftLog).toHaveLength(1);
  expect(seniorRoster(selected)).toHaveLength(seniorRoster(w).length + 1);
  expect(() => applyOwnerAction(selected, { type: "draft", id: p.id })).toThrow(
    /結果/,
  );
  expect(() =>
    applyOwnerAction(selected, { type: "drawDraftLottery" }),
  ).toThrow();
  expect(() => advancePhase(selected)).toThrow();
  const resumed = applyOwnerAction(JSON.parse(JSON.stringify(selected)), {
    type: "nextDraftRound",
  });
  expect(resumed.draftRound).toBe(1);
  expect(resumed.draftPending).toBeUndefined();
  const next = resumed.players.find((p) => p.market === "draft")!;
  const second = applyOwnerAction(resumed, { type: "draft", id: next.id });
  expect(second.draftRound).toBe(1);
  expect(second.draftPending).toMatchObject({
    round: 2,
    stage: "result",
    winner: 0,
  });
});
it("shows competing nominations before drawing and spends no contract money yet", () => {
  const base = structuredClone(initial);
  base.phase = "release";
  const w = advancePhase(base);
  const p = w.players.find((p) => p.market === "draft")!;
  Object.keys(p.skills).forEach((k) => {
    p.skills[k as keyof typeof p.skills] = 100;
  });
  let contested: WorldState | undefined;
  for (let i = 1; i <= 20 && !contested; i++) {
    w.seed = i * 100003;
    const selected = applyOwnerAction(w, { type: "draft", id: p.id });
    if (selected.draftPending?.stage === "lottery") contested = selected;
  }
  expect(contested).toBeDefined();
  expect(contested!.players.find((x) => x.id === p.id)?.team).toBeNull();
  expect(contested!.teams[0].finance.cash).toBe(w.teams[0].finance.cash);
  expect(contested!.draftLog).toHaveLength(0);
  expect(() =>
    applyOwnerAction(contested!, { type: "nextDraftRound" }),
  ).toThrow();
  expect(() => applyOwnerAction(contested!, { type: "passDraft" })).toThrow(
    /くじ/,
  );
  const saved = JSON.parse(JSON.stringify(contested));
  expect(applyOwnerAction(saved, { type: "drawDraftLottery" })).toEqual(
    applyOwnerAction(saved, { type: "drawDraftLottery" }),
  );
});
for (const won of [true, false]) {
  it(`resolves a ${won ? "winning" : "losing"} lottery without advancing or allowing a redraw`, () => {
    const w = draftWorld();
    const p = w.players.find((p) => p.market === "draft")!;
    w.teams[1].finance.debt = 0;
    w.draftPending = { round: 1, player: p.id, rivals: [1], stage: "lottery" };
    for (let seed = 1; seed < 100; seed++) {
      w.seed = seed * 100003;
      if (random(structuredClone(w)) < 0.5 === won) break;
    }
    const result = applyOwnerAction(w, { type: "drawDraftLottery" });
    expect(result.draftPending).toMatchObject({
      stage: "result",
      winner: won ? 0 : 1,
    });
    expect(result.draftRound).toBe(0);
    expect(result.players.find((x) => x.id === p.id)?.team).toBe(won ? 0 : 1);
    expect(() =>
      applyOwnerAction(result, { type: "drawDraftLottery" }),
    ).toThrow();
    const next = applyOwnerAction(result, { type: "nextDraftRound" });
    expect(next.draftRound).toBe(won ? 1 : 0);
    expect(next.draftPending).toBeUndefined();
    expect(next.draftLog.filter((x) => x.player === p.id)).toHaveLength(1);
  });
}
it("confirms the sixth result before ending and retains the seventy-player cap", () => {
  let w = draftWorld();
  seniorRoster(w)
    .slice(0, 3)
    .forEach((p) => {
      p.team = null;
      p.market = "tryout";
    });
  for (let round = 1; round <= 6; round++) {
    const p = w.players.find((p) => p.market === "draft")!;
    w = applyOwnerAction(w, { type: "draft", id: p.id });
    expect(w.draftPending?.round).toBe(round);
    expect(w.draftRound).toBe(round - 1);
    w = applyOwnerAction(w, { type: "nextDraftRound" });
  }
  expect(w.draftRound).toBe(6);
  expect(w.draftLog.filter((x) => x.team === 0)).toHaveLength(6);
  expect(seniorRoster(w).length).toBeLessThanOrEqual(70);
  expect(phaseBlockers(w)).toEqual([]);
  expect(advancePhase(w).phase).toBe("autumn");
});
