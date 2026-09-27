import { beforeAll, describe, expect, it } from "vitest";
import {
  ability,
  advancePhase,
  applyOwnerAction,
  createSchedule,
  createWorld,
  estimate,
  roster,
  simulateMonth,
  standings,
  validateRoster,
} from "./engine";
import { POSITIONS, STAFF_ROLES, type WorldState } from "./model";
import { seniorRoster, projectedPayroll, activeError } from "./operations";
let initial: WorldState;
beforeAll(() => {
  initial = createWorld(20261026);
}, 30000);
function autoOffseason(start: WorldState) {
  let w = structuredClone(start);
  let guard = 0;
  while (w.phase !== "season" && guard++ < 30) {
    if (["release", "release2"].includes(w.phase)) {
      while (seniorRoster(w).length > 64) {
        const list = seniorRoster(w);
        const p = list
          .filter(
            (p) =>
              p.contractYear <= w.year &&
              list.filter((x) => x.position === p.position).length >
                (p.position === "投" ? 12 : p.position === "捕" ? 2 : 1),
          )
          .sort((a, b) => ability(a) - ability(b))[0];
        if (!p) break;
        w = applyOwnerAction(w, { type: "release", id: p.id });
      }
    }
    if (w.phase === "budget")
      for (const role of STAFF_ROLES) {
        const s =
          w.staff.find((s) => s.team === 0 && s.role === role) ??
          w.staff.find((s) => s.team === null && s.role === role)!;
        w = applyOwnerAction(w, { type: "hire", id: s.id });
      }
    if (w.phase === "draft") w = applyOwnerAction(w, { type: "passDraft" });
    if (w.phase === "autumn" || w.phase === "spring")
      w = applyOwnerAction(w, { type: "camp", location: 0, focus: "contact" });
    if (w.phase === "contracts") {
      w = applyOwnerAction(w, { type: "renewAll" });
      for (const p of roster(w).filter((p) => p.contractYear < w.year + 1))
        w = applyOwnerAction(w, {
          type: "negotiate",
          id: p.id,
          salary: Math.ceil((p.ask * 1.08) / 100) * 100,
          years: 1,
          incentive: false,
          promise: "none",
        });
      w = applyOwnerAction(w, {
        type: "salaryBudget",
        value: Math.max(50000, Math.ceil(projectedPayroll(w) / 10000) * 10000),
      });
    }
    if (w.phase === "activeDraft") {
      const p = seniorRoster(w).find(
        (p) =>
          p.species === "cat" &&
          p.pro >= 1 &&
          p.salary < 7000 &&
          p.contractYear <= w.year &&
          p.draftYear !== w.year + 1 &&
          seniorRoster(w).filter((x) => x.position === p.position).length >
            (p.position === "投" ? 10 : p.position === "捕" ? 2 : 1),
      )!;
      if (!p) throw Error("no active draft nominee");
      w = applyOwnerAction(w, {
        type: "activeDraft",
        give: p.id,
        take: w.activeDraftPool[0],
      });
    }
    if (w.phase === "preseason") w = applyOwnerAction(w, { type: "preseason" });
    if (w.phase === "registration")
      w = applyOwnerAction(w, { type: "autoActive" });
    if (w.phase === "tryout") {
      let tries = 0;
      while (validateRoster(w) && tries++ < 40) {
        const list = roster(w);
        const pos =
          list.filter((p) => p.position === "投").length < 10
            ? "投"
            : list.filter((p) => p.position === "捕").length < 2
              ? "捕"
              : POSITIONS.slice(2).find(
                  (pos) => !list.some((p) => p.position === pos),
                );
        const p = w.players
          .filter((p) => p.market === "tryout" && (!pos || p.position === pos))
          .sort((a, b) => ability(b) - ability(a))[0];
        if (!p) throw Error(`no candidate ${pos}`);
        w = applyOwnerAction(w, { type: "sign", id: p.id });
      }
    }
    w = advancePhase(w);
  }
  return w;
}
describe("owner simulation", () => {
  it("has a Fukuoka club, cat prospects, two leagues and coherent 2026 regular-season records", () => {
    expect(initial.teams).toHaveLength(12);
    expect(initial.players.filter((p) => p.market === "draft")).toHaveLength(
      144,
    );
    expect(initial.teams[0].city).toBe("福岡");
    expect(initial.teams.filter((t) => t.league === "パ")).toHaveLength(6);
    expect(initial.teams.filter((t) => t.league === "セ")).toHaveLength(6);
    expect(
      initial.players
        .filter((p) => p.market === "draft")
        .every((p) => p.species === "cat"),
    ).toBe(true);
    expect(initial.archives).toHaveLength(0);
    expect(seniorRoster(initial).length).toBeLessThanOrEqual(70);
    expect(initial.phase).toBe("review");
    expect(
      initial.teams.every((t) => t.wins + t.losses + t.draws === 143),
    ).toBe(true);
  });
  it("schedules 143 games per team without simultaneous double booking", () => {
    const fixtures = createSchedule();
    expect(fixtures).toHaveLength(858);
    for (let id = 0; id < 12; id++) {
      expect(
        fixtures.filter((g) => g.home === id || g.away === id),
      ).toHaveLength(143);
      for (let other = 0; other < 12; other++)
        if (id !== other)
          expect(
            fixtures.filter(
              (g) =>
                (g.home === id && g.away === other) ||
                (g.away === id && g.home === other),
            ),
          ).toHaveLength(Math.floor(id / 6) === Math.floor(other / 6) ? 25 : 3);
    }
    for (let i = 0; i < fixtures.length; i += 6)
      expect(
        new Set(fixtures.slice(i, i + 6).flatMap((f) => [f.home, f.away])).size,
      ).toBe(12);
  });
  it("preserves league-wide score and batting/pitching accounting", () => {
    const rs = initial.players.map((p) => p.reports[2026]).filter(Boolean);
    expect(initial.teams.reduce((n, t) => n + t.scored, 0)).toBe(
      initial.teams.reduce((n, t) => n + t.conceded, 0),
    );
    expect(rs.reduce((n, r) => n + r.runs, 0)).toBe(
      initial.teams.reduce((n, t) => n + t.scored, 0),
    );
    expect(rs.reduce((n, r) => n + r.walks, 0)).toBe(
      rs.reduce((n, r) => n + r.bb, 0),
    );
    expect(
      rs.every(
        (r) => r.hits <= r.ab && r.hr <= r.hits && r.earned <= r.allowed,
      ),
    ).toBe(true);
  });
  it("rejects illegal actions without mutating state", () => {
    const snapshot = JSON.stringify(initial);
    expect(() =>
      applyOwnerAction(initial, { type: "invest", facility: 0 }),
    ).toThrow();
    expect(JSON.stringify(initial)).toBe(snapshot);
  });
  it("scouting narrows estimates and camps only charge once", () => {
    let w = structuredClone(initial);
    w.phase = "draft";
    const p = w.players.find((p) => p.market === "draft")!;
    const before = estimate(w, p, "contact");
    w = applyOwnerAction(w, { type: "scout", id: p.id });
    const after = estimate(
      w,
      w.players.find((x) => x.id === p.id)!,
      "contact",
    );
    expect(after.high - after.low).toBeLessThan(before.high - before.low);
    w.phase = "autumn";
    const cash = w.teams[0].finance.cash;
    w = applyOwnerAction(w, { type: "camp", location: 0, focus: "contact" });
    expect(w.teams[0].finance.cash).toBe(cash - 800);
    expect(() =>
      applyOwnerAction(w, { type: "camp", location: 0, focus: "contact" }),
    ).toThrow();
    expect(w.teams[0].finance.ledger.at(-1)?.year).toBe(2027);
  });
  it("finishes 2027 and resumes the 2028 recruitment cycle", () => {
    let w = autoOffseason(initial);
    expect(w.year).toBe(2027);
    const snapshot = structuredClone(w);
    expect(simulateMonth(w)).toEqual(simulateMonth(snapshot));
    for (let m = 4; m <= 9; m++) w = simulateMonth(w);
    expect(w.phase).toBe("review");
    expect(
      w.teams.every(
        (t) =>
          t.previousRank ===
          standings(w, t.league).findIndex((x) => x.id === t.id) + 1,
      ),
    ).toBe(true);
    expect(w.archives.at(-1)?.year).toBe(2026);
    expect(w.teams.every((t) => t.wins + t.losses + t.draws === 143)).toBe(
      true,
    );
    w = autoOffseason(w);
    expect(w.phase).toBe("season");
    expect(w.year).toBe(2028);
    expect(w.archives.at(-1)?.year).toBe(2027);
    expect(w.players.filter((p) => p.market === "draft")).toHaveLength(144);
  }, 30000);
  it("supports twenty seasons without invalid rosters or money", async () => {
    let w = structuredClone(initial);
    for (let year = 0; year < 20; year++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      w = autoOffseason(w);
      for (let m = 4; m <= 9; m++) w = simulateMonth(w);
      expect(
        w.teams.every(
          (t) => Number.isFinite(t.finance.cash) && t.finance.cash >= 0,
        ),
      ).toBe(true);
      expect(new Set(w.players.map((p) => p.id)).size).toBe(w.players.length);
      expect(w.phase).toBe("review");
      expect(seniorRoster(w).length).toBeLessThanOrEqual(70);
    }
    expect(w.archives).toHaveLength(20);
  }, 240000);
});
