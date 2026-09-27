import { beforeAll, expect, it } from "vitest";
import { createWorld } from "./engine";
import { backfillCareerHistory } from "./history";
import { grade, type WorldState } from "./model";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AbilityBadge } from "./AbilityBadge";

let initial: WorldState;
beforeAll(() => {
  initial = createWorld();
}, 30000);
const oldSave = () => {
  const w = structuredClone(initial);
  for (const p of w.players) {
    delete p.reports[2024];
    delete p.reports[2025];
  }
  return w;
};
it("fills old-save gaps for batters and pitchers without replacing played records", () => {
  const w = oldSave(),
    teams = structuredClone(w.teams),
    seed = w.seed,
    revision = w.revision,
    nextId = w.nextId;
  const originals = new Map(
    w.players.map((p) => [p.id, structuredClone(p.reports[2026])]),
  );
  expect(backfillCareerHistory(w)).toBe(true);
  for (const p of w.players) {
    if (originals.get(p.id))
      expect(p.reports[2026]).toEqual(originals.get(p.id));
    if (p.pro >= 4 && p.age >= 21 && p.market !== "draft") {
      expect(p.reports[2024]?.source).toBe("backfill");
      expect(p.reports[2025]?.source).toBe("backfill");
      expect(p.reports[2025].games).toBeGreaterThanOrEqual(0);
    }
  }
  expect(w.teams).toEqual(teams);
  expect(w.seed).toBe(seed);
  expect(w.revision).toBe(revision);
  expect(w.nextId).toBe(nextId);
});
it("is deterministic and persists already-generated records on repeat calls", () => {
  const a = oldSave(),
    b = oldSave();
  backfillCareerHistory(a);
  backfillCareerHistory(b);
  expect(a.players.map((p) => p.reports)).toEqual(
    b.players.map((p) => p.reports),
  );
  const snapshot = structuredClone(a);
  expect(backfillCareerHistory(a)).toBe(false);
  expect(a).toEqual(snapshot);
});
it("does not create pre-professional, draft-prospect or live-season records", () => {
  const w = oldSave();
  w.phase = "season";
  w.year = 2027;
  for (const p of w.players) delete p.reports[2027];
  const rookie = w.players.find((p) => p.team === 0)!;
  rookie.draftYear = 2027;
  rookie.reports = {};
  backfillCareerHistory(w);
  expect(rookie.reports).toEqual({});
  expect(w.players.every((p) => !p.reports[2027])).toBe(true);
  expect(
    w.players
      .filter((p) => p.market === "draft")
      .every((p) => Object.keys(p.reports).length === 0),
  ).toBe(true);
});
it("keeps individual stat lines consistent, finite and non-negative", () => {
  const w = oldSave();
  backfillCareerHistory(w);
  for (const p of w.players)
    for (const r of Object.values(p.reports).filter(
      (r) => r.source === "backfill",
    )) {
      for (const [key, n] of Object.entries(r))
        if (typeof n === "number") {
          expect(Number.isFinite(n)).toBe(true);
          if (key !== "team") expect(n).toBeGreaterThanOrEqual(0);
        }
      expect(r.hits).toBeLessThanOrEqual(r.ab);
      expect(r.hr + r.doubles + r.triples).toBeLessThanOrEqual(r.hits);
      expect(r.pa).toBe(r.ab + r.walks);
      expect(r.wins + r.losses).toBeLessThanOrEqual(r.games);
      expect(r.earned).toBeLessThanOrEqual(r.allowed);
    }
});
it("renders every letter rank separately and retains unscouted bounds", () => {
  for (const [value, rank] of [
    [95, "S"],
    [85, "A"],
    [75, "B"],
    [65, "C"],
    [55, "D"],
    [45, "E"],
    [35, "F"],
    [15, "G"],
  ] as const) {
    expect(grade(value)).toBe(rank);
    const html = renderToStaticMarkup(
      createElement(AbilityBadge, { label: "ミート", low: value }),
    );
    expect(html).toContain(`g-${rank}`);
    expect(html).toContain(`data-grade="${rank}"`);
  }
  const range = renderToStaticMarkup(
    createElement(AbilityBadge, { label: "ミート", low: 35, high: 85 }),
  );
  expect(range).toContain("g-F");
  expect(range).toContain("g-A");
  expect(range).toContain("35〜85");
});
