import "fake-indexeddb/auto";
import { beforeAll, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createWorld, applyOwnerAction, estimate, roster } from "./engine";
import {
  contractAssessment,
  limitContractMeetings,
  seniorRoster,
} from "./operations";
import { coreRoster, CoreRoster } from "./CoreRoster";
import { OwnerStatus } from "./FrontOffice";
import { SeasonSummary } from "./SeasonSummary";
import { SeasonStats } from "./SeasonStats";
import { DraftComparison } from "./DraftComparison";
import {
  startDevelopmentRecord,
  recordSeasonReview,
  ensureDevelopmentRecord,
  recordNewOwnerPlayers,
} from "./development";
import {
  SKILLS,
  type Skill,
  type WorldState,
  type DraftEstimate,
} from "./model";
import { persistWorld, loadWorld, validateWorld } from "./storage";

let base: WorldState;
beforeAll(() => {
  base = createWorld();
}, 30000);
const dom = (html: string) => {
  const el = document.createElement("div");
  el.innerHTML = html;
  return el;
};
it("moves from overview to main players then release, showing every position and unique pitcher roles", () => {
  const core = applyOwnerAction(base, { type: "advance" });
  expect(core.phase).toBe("core");
  expect(applyOwnerAction(core, { type: "advance" }).phase).toBe("release");
  const groups = coreRoster(core);
  expect(groups.slice(0, 3).map((g) => g.name)).toEqual([
    "先発",
    "中継ぎ",
    "抑え",
  ]);
  expect(groups).toHaveLength(11);
  const ids = groups.flatMap((g) => g.players.map((p) => p.id));
  expect(new Set(ids).size).toBe(ids.length);
  const el = dom(
    renderToStaticMarkup(
      createElement(CoreRoster, { w: core, open: () => {} }),
    ),
  );
  expect(el.querySelectorAll(".core-portrait")).toHaveLength(ids.length);
  const header = dom(
    renderToStaticMarkup(createElement(OwnerStatus, { w: core })),
  );
  expect(
    [...header.querySelectorAll(".status-positions b")].reduce(
      (sum, e) => sum + Number(e.textContent),
      0,
    ),
  ).toBe(seniorRoster(core).length);
});
it("limits known professionals to narrow uncertain ranges, with slightly wider foreign estimates", () => {
  const w = structuredClone(base),
    p = w.players.find((p) => p.team === 1)!;
  p.scouting = 0;
  p.pro = 8;
  p.skills.control = 60;
  for (const market of ["roster", "fa", "foreign"] as const) {
    p.market = market;
    const range = estimate(w, p, "control");
    expect(range.high - range.low).toBe(market === "foreign" ? 12 : 8);
    expect(range.low).toBeLessThan(60);
    expect(range.high).toBeGreaterThan(60);
  }
  p.market = "draft";
  expect(
    estimate(w, p, "control").high - estimate(w, p, "control").low,
  ).toBeGreaterThan(12);
});
it("preserves pre-draft ranges before signing and displays both before and exact grades", () => {
  const w = structuredClone(base);
  w.phase = "draft";
  w.teams.slice(1).forEach((t) => {
    t.finance.debt = 1;
  });
  const p = w.players.find((p) => p.market === "draft")!;
  const before = Object.fromEntries(
    (Object.keys(SKILLS) as Skill[]).map((k) => [k, estimate(w, p, k)]),
  ) as DraftEstimate;
  const result = applyOwnerAction(w, { type: "draft", id: p.id });
  expect(result.draftPending?.before).toEqual(before);
  expect(result.draftLog[0].before).toEqual(before);
  const el = dom(
    renderToStaticMarkup(
      createElement(DraftComparison, {
        p: result.players.find((x) => x.id === p.id)!,
        before: result.draftLog[0].before,
      }),
    ),
  );
  expect(el.textContent).toContain("指名前");
  expect(el.textContent).toContain("獲得後");
  expect(el.textContent).toContain("〜");
  expect(el.querySelectorAll("tbody tr")).toHaveLength(
    p.position === "投" ? 2 : 6,
  );
});
it("caps annual and legacy contract meetings at three without changing accepted contracts", () => {
  const w = structuredClone(base);
  w.phase = "contracts";
  contractAssessment(w);
  expect(roster(w).filter((p) => p.negotiation === "meeting")).toHaveLength(3);
  roster(w)
    .slice(0, 10)
    .forEach((p) => {
      p.negotiation = "meeting";
      p.contractYear = w.year;
    });
  const accepted = roster(w)[0];
  accepted.contractYear = w.year + 2;
  const before = structuredClone(accepted);
  expect(limitContractMeetings(w)).toBe(true);
  expect(
    roster(w).filter(
      (p) => p.negotiation === "meeting" && p.contractYear < w.year + 1,
    ),
  ).toHaveLength(3);
  expect(accepted).toEqual(before);
  const renewed = applyOwnerAction(w, { type: "renewAll" });
  expect(
    roster(renewed).filter((p) => p.contractYear < w.year + 1),
  ).toHaveLength(3);
});
it("freezes actual skills and season records, preserves joining players and survives reload", async () => {
  const w = structuredClone(base);
  w.year = 2027;
  w.phase = "season";
  startDevelopmentRecord(w, w.year, "2026年オフ開始時");
  const p = roster(w).find((p) => p.skills.contact < 95)!;
  const initial = p.skills.contact;
  p.skills.contact += 3;
  p.reports[w.year] = {
    ...p.reports[2026],
    year: w.year,
    team: 0,
    source: undefined,
  };
  const joining = w.players.find((p) => p.team === 1)!;
  joining.team = 0;
  recordNewOwnerPlayers(w);
  recordSeasonReview(w, 4);
  const report = structuredClone(w.seasonReview);
  expect(
    report!.players.find((x) => x.id === p.id)!.after.skills.contact - initial,
  ).toBe(3);
  expect(
    report!.players.find((x) => x.id === joining.id)!.before,
  ).toBeDefined();
  startDevelopmentRecord(w, 2028, "2027年オフ開始時");
  p.skills.contact++;
  expect(w.seasonReview).toEqual(report);
  await persistWorld(w);
  expect((await loadWorld())!.seasonReview).toEqual(report);
  const el = dom(
    renderToStaticMarkup(createElement(SeasonSummary, { w, open: () => {} })),
  );
  expect(el.textContent).toContain("2027年 レギュラーシーズン総括");
  expect(el.textContent).toContain("+3");
  expect(
    el.querySelectorAll(".season-stat-table tbody tr").length,
  ).toBeGreaterThan(0);
});
it("does not invent growth for old saves or mutate RNG when rendering statistics", () => {
  const w = structuredClone(base);
  delete w.developmentBaseline;
  delete w.seasonReview;
  ensureDevelopmentRecord(w);
  const before = JSON.stringify(w);
  const el = dom(
    renderToStaticMarkup(createElement(SeasonSummary, { w, open: () => {} })),
  );
  expect(el.textContent).toContain("比較元の能力記録なし");
  expect(JSON.stringify(w)).toBe(before);
  const table = dom(
    renderToStaticMarkup(createElement(SeasonStats, { w, open: () => {} })),
  );
  expect(table.querySelectorAll("tbody tr").length).toBeGreaterThan(0);
  expect(table.querySelectorAll("tbody tr:not(.our-player)")).toHaveLength(0);
});
it("rejects malformed new metadata but accepts absent metadata in old saves", () => {
  const w = structuredClone(base);
  w.developmentBaseline!.players[roster(w)[0].id].skills.contact = NaN;
  expect(() => validateWorld(w)).toThrow(/比較記録/);
  delete w.developmentBaseline;
  w.seasonReview!.players[0].after.pitches = null as never;
  expect(() => validateWorld(w)).toThrow(/年間総括/);
  delete w.seasonReview;
  expect(() => validateWorld(w)).not.toThrow();
});
