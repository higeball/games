import "fake-indexeddb/auto";
import { beforeAll, expect, it } from "vitest";
import { createWorld, applyOwnerAction, advancePhase, roster } from "./engine";
import { PHASE_FLOW, PHASE_NAMES, type WorldState } from "./model";
import { phaseBlockers } from "./operations";
import { upgradeSerialFlow } from "./calendar";
import {
  persistWorld,
  loadWorld,
  saveWorldSlot,
  loadWorldSlot,
  validateWorld,
} from "./storage";
import { nextEventLabel, FoomyGuide } from "./Secretary";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

let initial: WorldState;
beforeAll(() => {
  initial = createWorld();
}, 30000);
function declared() {
  const w = structuredClone(initial);
  const own = roster(w).find((p) => p.species === "cat")!;
  const other = roster(w, 1).find((p) => p.species === "cat")!;
  for (const p of [own, other]) {
    p.formerTeam = p.team;
    p.team = null;
    p.market = "fa";
    p.ask = 1500;
    p.faRank = "A";
    p.offerRound = 0;
    p.offers = [];
  }
  w.faDeclarations = { year: w.year, ids: [own.id, other.id] };
  w.phase = "retain";
  return { w, own, other };
}
it("matches each overview box to exactly one sequential screen", () => {
  const el = document.createElement("div");
  el.innerHTML = renderToStaticMarkup(
    createElement(FoomyGuide, { w: initial }),
  );
  expect(
    [...el.querySelectorAll(".season-overview li")].map((el) =>
      el.getAttribute("data-phase"),
    ),
  ).toEqual([...PHASE_FLOW.slice(1), "season"]);
  expect(
    [...el.querySelectorAll(".season-overview li b")].map(
      (el) => el.textContent,
    ),
  ).toEqual(
    [...PHASE_FLOW.slice(1), "season" as const].map((p) => PHASE_NAMES[p]),
  );
  expect(
    PHASE_FLOW.slice(
      PHASE_FLOW.indexOf("contracts"),
      PHASE_FLOW.indexOf("spring"),
    ),
  ).toEqual(["contracts", "fa", "foreign", "trade", "budget", "staff"]);
});
it("requires a retention decision and keeps own and rival FA markets separate", () => {
  const { w, own, other } = declared();
  expect(phaseBlockers(w).join()).toContain("残留交渉");
  expect(() => advancePhase(w)).toThrow(/残留交渉/);
  const before = JSON.stringify(w);
  expect(() =>
    applyOwnerAction(w, { type: "offer", id: other.id, salary: 4500 }),
  ).toThrow(/別の期間/);
  expect(JSON.stringify(w)).toBe(before);
  const retained = applyOwnerAction(w, {
    type: "offer",
    id: own.id,
    salary: 4500,
  });
  expect(retained.players.find((p) => p.id === own.id)?.team).toBe(0);
  expect(retained.compensations).toHaveLength(0);
  expect(phaseBlockers(retained)).toHaveLength(0);
  const next = advancePhase(retained);
  expect(next.phase).toBe("tryout");
  expect(next.players.find((p) => p.id === other.id)?.market).toBe("fa");
  const rivalPhase = { ...w, phase: "fa" as const };
  expect(() =>
    applyOwnerAction(rivalPhase, { type: "offer", id: own.id, salary: 4500 }),
  ).toThrow(/別の期間/);
});
it("waives retention explicitly, drops our bid and resolves only own free agents", () => {
  const { w, own, other } = declared();
  own.offers = [{ team: 0, salary: 99999 }];
  const passed = applyOwnerAction(w, { type: "waiveRetention", id: own.id });
  expect(passed.players.find((p) => p.id === own.id)?.offers).toHaveLength(0);
  expect(phaseBlockers(passed)).toHaveLength(0);
  expect(() =>
    applyOwnerAction(passed, { type: "offer", id: own.id, salary: 4500 }),
  ).toThrow(/見送った/);
  const next = advancePhase(passed);
  expect(next.players.find((p) => p.id === own.id)?.team).not.toBe(0);
  expect(next.players.find((p) => p.id === own.id)?.market).not.toBe("fa");
  expect(next.players.find((p) => p.id === other.id)?.market).toBe("fa");
});
it("does not allow recruitment or staff actions from the former combined screen", () => {
  const { w, other } = declared();
  w.phase = "contracts";
  expect(() =>
    applyOwnerAction(w, { type: "offer", id: other.id, salary: 4500 }),
  ).toThrow();
  expect(() =>
    applyOwnerAction(w, { type: "foreign", id: other.id }),
  ).toThrow();
  expect(() =>
    applyOwnerAction(w, {
      type: "trade",
      give: roster(w)[0].id,
      take: roster(w, 1)[0].id,
      cash: 0,
    }),
  ).toThrow();
  w.phase = "budget";
  expect(() =>
    applyOwnerAction(w, {
      type: "hire",
      id: w.staff.find((s) => s.team === 0)!.id,
    }),
  ).toThrow();
});
it("migrates a mid-contract save through retention without repeating completed events", async () => {
  const { w, own } = declared();
  delete w.serialFlowVersion;
  delete w.faDeclarations;
  w.phase = "contracts";
  await persistWorld(w);
  await saveWorldSlot(3, w, true);
  const loaded = (await loadWorld())!;
  expect(loaded.phase).toBe("retain");
  expect(loaded.retentionReturn).toBe("contracts");
  expect(nextEventLabel(loaded)).toBe("契約更改へ進む");
  expect(upgradeSerialFlow(loaded)).toBe(false);
  expect((await loadWorldSlot(3)).phase).toBe("retain");
  const next = advancePhase(
    applyOwnerAction(loaded, { type: "waiveRetention", id: own.id }),
  );
  expect(next.phase).toBe("contracts");
  expect(next.retentionReturn).toBeUndefined();
});
it("rejects malformed optional flow metadata", () => {
  const w = structuredClone(initial);
  w.retentionPassed = 5 as unknown as string[];
  expect(() => validateWorld(w)).toThrow(/FA手続き/);
});
