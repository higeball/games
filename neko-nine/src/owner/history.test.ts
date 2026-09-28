import { beforeAll, expect, it } from "vitest";
import { createWorld } from "./engine";
import { backfillCareerHistory } from "./history";
import { grade, type WorldState } from "./model";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AbilityBadge } from "./AbilityBadge";
import { RecentResults } from "./RecentResults";
import { AnimalPortrait } from "./AnimalPortrait";

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
it("initializes all eligible careers, including veteran tryout candidates", () => {
  for (const p of initial.players.filter(
    (p) => p.market === "tryout" && p.age >= 29,
  )) {
    for (const year of [2024, 2025, 2026])
      expect(p.reports[year]).toBeDefined();
  }
  const old = structuredClone(initial);
  const veteran = old.players.find(
    (p) => p.market === "tryout" && p.age >= 29,
  )!;
  veteran.pro = 1;
  veteran.reports = {};
  backfillCareerHistory(old);
  expect(veteran.pro).toBe(1);
  for (const year of [2024, 2025, 2026])
    expect(veteran.reports[year]?.games).toBeGreaterThan(0);
});
it("uses completed seasons in the shared history view and distinguishes pre-pro years", () => {
  const w = structuredClone(initial);
  const p = w.players.find((p) => p.pro >= 4 && p.team === 0)!;
  w.year = 2027;
  w.phase = "season";
  const html = renderToStaticMarkup(createElement(RecentResults, { p, w }));
  expect(html).toContain("2024〜2026年");
  expect(html).not.toContain("2027");
  const rookie = {
    ...p,
    pro: 1,
    draftYear: 2026,
    reports: {},
    farmReports: {},
  };
  const young = renderToStaticMarkup(
    createElement(RecentResults, { p: rookie, w: initial }),
  );
  expect(young.match(/プロ入り前/g)).toHaveLength(2);
  expect(young).toContain('data-level="first"');
  expect(young).not.toContain('data-level="farm"');
});
it("renders cats and dogs as crisp grid sprites with no smooth curves", () => {
  for (const species of ["cat", "dog"] as const) {
    const html = renderToStaticMarkup(
      createElement(AnimalPortrait, {
        p: { ...initial.players[0], species },
      }),
    );
    expect(html).toContain('data-style="pixel"');
    expect(html).toContain('shape-rendering="crispEdges"');
    expect(html).not.toContain("<ellipse");
    expect(html).not.toContain("<circle");
    expect(html).toContain("ドット絵ポートレート");
  }
});
it("adds meaningful reserve history without replacing a zero-appearance first-team record", () => {
  const w = structuredClone(initial);
  const p = w.players.find(
    (p) =>
      p.team === 0 &&
      p.pro >= 4 &&
      p.position !== "投" &&
      !p.reports[2026]?.games,
  )!;
  const official = structuredClone(p.reports);
  delete p.farmReports;
  expect(backfillCareerHistory(w)).toBe(true);
  for (const year of [2024, 2025, 2026]) {
    if (p.reports[year].games) continue;
    const r = p.farmReports![year];
    expect(r.games).toBeGreaterThan(0);
    expect(r.games).toBeLessThanOrEqual(120);
    expect(r.hits).toBeLessThanOrEqual(r.ab);
    expect(r.hr + r.doubles + r.triples).toBeLessThanOrEqual(r.hits);
    expect(r.source).toBe("backfill");
  }
  expect(p.reports).toEqual(official);
  const html = renderToStaticMarkup(createElement(RecentResults, { p, w }));
  expect(html).toContain("二軍成績（参考）");
  expect(html).toContain("一軍成績");
  expect(html).not.toContain("二軍参考（一軍0）");
  expect(html).not.toContain("history-backfill");
  expect(backfillCareerHistory(w)).toBe(false);
});
it("always renders three first-team rows but hides a reserve table without appearances", () => {
  const w = structuredClone(initial);
  const p = { ...w.players[0], reports: {}, farmReports: {} };
  const html = renderToStaticMarkup(createElement(RecentResults, { p, w }));
  expect(html.match(/<table /g)).toHaveLength(1);
  expect(html.match(/<th scope="row">/g)).toHaveLength(3);
  expect(html).toContain("一軍成績");
  expect(html).not.toContain("二軍成績");
  p.farmReports = { 2026: { ...initial.players[0].reports[2026], games: 0 } };
  const zeroFarm = renderToStaticMarkup(createElement(RecentResults, { p, w }));
  expect(zeroFarm.match(/<table /g)).toHaveLength(1);
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
