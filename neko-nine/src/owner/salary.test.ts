import { beforeAll, expect, it } from "vitest";
import { createWorld, applyOwnerAction, desiredSalary, roster } from "./engine";
import { blankRecord, type WorldState } from "./model";
import {
  normalizeSalaryScale,
  performanceSalary,
  renewalSalary,
} from "./salary";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PlayerAbilityPanel } from "./PlayerAbilityPanel";
import { ScoutingStatus } from "./ScoutingStatus";

let world: WorldState;
beforeAll(() => {
  world = createWorld();
}, 30000);
it("initial unsigned rookies have zero contracted salary and a 600万円 entry salary regardless of talent", () => {
  const rookies = world.players.filter((p) => p.market === "draft");
  expect(rookies).toHaveLength(144);
  expect(rookies.every((p) => p.salary === 0 && p.ask === 600)).toBe(true);
  const p = structuredClone(rookies[0]);
  Object.keys(p.skills).forEach((k) => {
    p.skills[k as keyof typeof p.skills] = 100;
  });
  p.popularity = 100;
  expect(desiredSalary(p)).toBe(600);
});
it("initial first-team nonparticipants have modest salaries even when their reserve stats are excellent", () => {
  const list = roster(world).filter(
    (p) => p.registration === "senior" && !p.reports[2026].games,
  );
  expect(list.length).toBeGreaterThan(0);
  expect(list.every((p) => p.salary >= 500 && p.salary <= 2300)).toBe(true);
  const p = structuredClone(list[0]);
  p.reports = { 2026: blankRecord(2026, 0) };
  p.popularity = 100;
  const base = performanceSalary(p);
  p.farmReports = {
    2026: { ...blankRecord(2026, 0), games: 143, hr: 50, hits: 250 },
  };
  expect(performanceSalary(p)).toBe(base);
  expect(base).toBeLessThanOrEqual(800);
});
it("rewards both hitting and pitching achievements without endlessly compounding unchanged performance", () => {
  for (const position of ["投", "一"] as const) {
    const p = structuredClone(
      roster(world).find(
        (p) => p.position === position && p.species === "cat",
      )!,
    );
    p.reports = { 2026: blankRecord(2026, 0) };
    const before = performanceSalary(p);
    Object.assign(
      p.reports[2026],
      position === "投"
        ? { games: 28, outs: 540, earned: 55, wins: 14, k: 180 }
        : { games: 130, pa: 550, ab: 480, hits: 150, hr: 25, rbi: 80 },
    );
    expect(performanceSalary(p)).toBeGreaterThan(before * 3);
    for (let i = 0; i < 20; i++) p.salary = renewalSalary(p);
    expect(p.salary).toBe(performanceSalary(p));
  }
});
it("migrates old generated pay once without changing player stats, RNG, cash or negotiated contracts", () => {
  const w = structuredClone(world);
  delete w.salaryModelVersion;
  const zero = roster(w).find(
    (p) => p.registration === "senior" && !p.reports[2026].games,
  )!;
  zero.salary = 5400;
  const signed = roster(w).find((p) => p.id !== zero.id)!;
  signed.salary = 12340;
  signed.ask = 12500;
  signed.contractYear = 2028;
  signed.negotiation = "accepted";
  const records = JSON.stringify(w.players.map((p) => [p.reports, p.skills]));
  const joinedRookie = w.players.find((p) => p.market === "draft")!;
  joinedRookie.market = "roster";
  joinedRookie.team = 0;
  joinedRookie.contractYear = 2027;
  joinedRookie.negotiation = "accepted";
  joinedRookie.salary = 600;
  joinedRookie.ask = 5400;
  const teams = JSON.stringify(w.teams),
    seed = w.seed;
  expect(normalizeSalaryScale(w)).toBe(true);
  expect(zero.salary).toBeLessThan(3000);
  expect(signed.salary).toBe(12340);
  expect(signed.ask).toBe(12500);
  expect(joinedRookie.salary).toBe(600);
  expect(joinedRookie.ask).toBe(600);
  expect(JSON.stringify(w.players.map((p) => [p.reports, p.skills]))).toBe(
    records,
  );
  expect(JSON.stringify(w.teams)).toBe(teams);
  expect(w.seed).toBe(seed);
  expect(normalizeSalaryScale(w)).toBe(false);
});
it("counts meaningful investigations, saves before/after values and blocks wasted fourth investigations", () => {
  let w = structuredClone(world);
  w.phase = "draft";
  const p = w.players.find((p) => p.market === "draft")!;
  let count = 0;
  while (w.players.find((x) => x.id === p.id)!.scouting < 100) {
    const before = w.players.find((x) => x.id === p.id)!.scouting;
    w = applyOwnerAction(w, { type: "scout", id: p.id });
    count++;
    const next = w.players.find((x) => x.id === p.id)!;
    expect(next.scoutingCount).toBe(count);
    expect(next.lastScouting).toEqual({ before, after: next.scouting, count });
    expect(
      renderToStaticMarkup(createElement(ScoutingStatus, { p: next })),
    ).toContain(`${count}回目`);
  }
  const cash = w.teams[0].finance.cash;
  expect(() => applyOwnerAction(w, { type: "scout", id: p.id })).toThrow(
    /完了/,
  );
  expect(w.teams[0].finance.cash).toBe(cash);
  expect(
    JSON.parse(JSON.stringify(w)).players.find((x: any) => x.id === p.id)
      .scoutingCount,
  ).toBe(count);
});
it("does not invent investigation counts for older saves", () => {
  let w = structuredClone(world);
  w.phase = "draft";
  const p = w.players.find((p) => p.market === "draft")!;
  delete p.scoutingCount;
  p.scouting = 40;
  expect(renderToStaticMarkup(createElement(ScoutingStatus, { p }))).toContain(
    "回数未記録",
  );
  w = applyOwnerAction(w, { type: "scout", id: p.id });
  expect(w.players.find((x) => x.id === p.id)?.scoutingLegacy).toBe(true);
  expect(
    renderToStaticMarkup(
      createElement(ScoutingStatus, {
        p: w.players.find((x) => x.id === p.id)!,
      }),
    ),
  ).toContain("更新後の調査");
});
it("renders separate pitcher and batter ability layouts with real traits, stats and seven-step pitches", () => {
  const p = roster(world).find((p) => p.position === "投")!;
  const pitcher = renderToStaticMarkup(
    createElement(PlayerAbilityPanel, { p, w: world }),
  );
  expect(pitcher).toContain("投手能力画面");
  expect(pitcher).toContain("球速");
  expect(pitcher.indexOf("コントロール")).toBeLessThan(
    pitcher.indexOf("スタミナ"),
  );
  expect(pitcher).toContain("7段階");
  expect(pitcher).toContain(p.trait);
  const playing = structuredClone(world);
  playing.year = 2027;
  playing.phase = "season";
  const active = playing.players.find((x) => x.id === p.id)!;
  active.reports[2027] = { ...blankRecord(2027, 0), games: 7 };
  const current = renderToStaticMarkup(
    createElement(PlayerAbilityPanel, { p: active, w: playing }),
  );
  expect(current).toContain("2027年 一軍成績");
  expect(current).toContain("7試合");
  const batter = renderToStaticMarkup(
    createElement(PlayerAbilityPanel, {
      p: roster(world).find((p) => p.position !== "投")!,
      w: world,
    }),
  );
  expect(batter).toContain("野手能力画面");
  expect(batter).toContain("弾道");
  expect(batter).toContain("守備適性");
  expect(batter).toContain("その他は未評価");
  expect(batter).not.toContain("スローイング");
  expect(batter.indexOf("ability-special")).toBeLessThan(
    batter.indexOf("ability-season"),
  );
});
