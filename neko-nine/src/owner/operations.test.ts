import { beforeAll, describe, expect, it } from "vitest";
import {
  createWorld,
  applyOwnerAction,
  advancePhase,
  roster,
  acquire,
  estimate,
  ability,
} from "./engine";
import {
  seniorRoster,
  contractAssessment,
  phaseBlockers,
  activeError,
  protectionCandidates,
  upgradeLegacy,
  projectedPayroll,
} from "./operations";
import { emptyCampPlan, type WorldState } from "./model";
let initial: WorldState;
beforeAll(() => {
  initial = createWorld();
}, 30000);
const state = (phase: WorldState["phase"]) => {
  const w = structuredClone(initial);
  w.phase = phase;
  return w;
};

describe("roster and contracts", () => {
  it("repeated strong seasons do not compound salary indefinitely", () => {
    const w = state("contracts"),
      id = roster(w)[0].id;
    for (let i = 0; i < 20; i++) {
      roster(w).forEach((p) => {
        p.contractYear = w.year;
      });
      contractAssessment(w);
      const p = w.players.find((p) => p.id === id)!;
      p.salary = p.ask;
      expect(p.ask).toBeLessThan(50000);
    }
  });
  it("enforces 70 senior slots but excludes development players", () => {
    const w = state("tryout");
    const pool = w.players.filter((p) => p.market === "tryout");
    while (seniorRoster(w).length < 70) acquire(w, pool.pop()!, 0, 600);
    expect(roster(w).length).toBeGreaterThan(70);
    expect(() => applyOwnerAction(w, { type: "sign", id: pool[0].id })).toThrow(
      /70/,
    );
    expect(seniorRoster(w)).toHaveLength(70);
  });
  it("development offers can free a slot or lose the player", () => {
    const base = state("release"),
      p = seniorRoster(base).find((p) => p.species === "cat")!;
    p.age = 27;
    const outcomes = new Set<string>();
    for (let seed = 1; seed <= 80; seed++) {
      const w = structuredClone(base);
      w.seed = seed * 100003;
      const next = applyOwnerAction(w, { type: "development", id: p.id });
      outcomes.add(next.players.find((x) => x.id === p.id)!.market);
      expect(seniorRoster(next)).toHaveLength(seniorRoster(base).length - 1);
    }
    expect(outcomes.has("roster")).toBe(true);
    expect(outcomes.has("tryout")).toBe(true);
  }, 15000);
  it("bulk assessment renews most players and leaves meeting cases", () => {
    let w = state("contracts");
    contractAssessment(w);
    const count = roster(w).length;
    w = applyOwnerAction(w, { type: "renewAll" });
    const waiting = roster(w).filter((p) => p.contractYear < w.year + 1);
    expect(waiting.length).toBeGreaterThan(0);
    expect(waiting.length / count).toBeLessThan(0.2);
    expect(waiting.every((p) => p.negotiation === "meeting")).toBe(true);
    expect(phaseBlockers(w).some((s) => s.includes("契約"))).toBe(true);
  });
  it("negotiation cards trade lower salary for commitments", () => {
    const w = state("contracts");
    contractAssessment(w);
    const p = roster(w).find((p) => p.negotiation === "meeting")!;
    const refused = applyOwnerAction(w, {
      type: "negotiate",
      id: p.id,
      salary: p.ask * 0.8,
      years: 1,
      incentive: false,
      promise: "none",
    });
    expect(refused.players.find((x) => x.id === p.id)!.contractYear).toBe(
      w.year,
    );
    const next = applyOwnerAction(w, {
      type: "negotiate",
      id: p.id,
      salary: p.ask,
      years: 3,
      incentive: true,
      promise: "position",
    });
    const signed = next.players.find((x) => x.id === p.id)!;
    expect(signed.contractYear).toBe(2029);
    expect(signed.incentive).toBeGreaterThan(0);
    expect(signed.promise).toBe("position");
    const release = structuredClone(next);
    release.phase = "release2";
    expect(() =>
      applyOwnerAction(release, { type: "release", id: p.id }),
    ).toThrow(/契約/);
  });
  it("blocks progression for unsettled contracts and payroll budget", () => {
    const w = state("contracts");
    roster(w).forEach((p) => {
      p.contractYear = 2027;
    });
    w.teams[0].finance.salaryBudget = 1;
    expect(() => advancePhase(w)).toThrow(/予算/);
    expect(projectedPayroll(w)).toBeGreaterThan(1);
  });
});

describe("scouting and camp choices", () => {
  it("keeps first-round prospects available even after a championship", () => {
    const w = state("release");
    w.teams[0].previousRank = 1;
    const next = advancePhase(w);
    expect(next.phase).toBe("draft");
    expect(next.draftCursor).toBe(0);
    expect(next.draftLog).toHaveLength(0);
    expect(next.players.filter((p) => p.market === "draft")).toHaveLength(144);
  });
  it("season scouting reaches exact estimates without leaking unscouted values", () => {
    let w = state("season");
    const p = w.players.find((p) => p.market === "draft")!;
    expect(
      estimate(w, p, "contact").high - estimate(w, p, "contact").low,
    ).toBeGreaterThan(20);
    for (let i = 0; i < 4; i++)
      if (w.players.find((x) => x.id === p.id)!.scouting < 100)
        w = applyOwnerAction(w, { type: "scout", id: p.id });
    const known = w.players.find((x) => x.id === p.id)!;
    expect(known.scouting).toBe(100);
    expect(estimate(w, known, "contact")).toEqual({
      low: known.skills.contact,
      high: known.skills.contact,
    });
  });
  it("applies a camp conversion, a new pitch and limited concentrated training", () => {
    let w = state("spring");
    const batter = roster(w).find((p) => p.position === "一")!,
      pitcher = roster(w).find((p) => p.position === "投")!;
    w = applyOwnerAction(w, {
      type: "campPlan",
      plan: {
        budget: 6000,
        focuses: ["contact", "control"],
        legend: "pitching",
        special: [
          { id: batter.id, kind: "convert", position: "左" },
          { id: pitcher.id, kind: "pitch", pitch: "シュート" },
        ],
      },
    });
    const cash = w.teams[0].finance.cash;
    w = applyOwnerAction(w, { type: "camp", location: 0, focus: "contact" });
    expect(w.players.find((p) => p.id === batter.id)!.position).toBe("左");
    expect(
      w.players
        .find((p) => p.id === pitcher.id)!
        .pitches.some((p) => p.name === "シュート"),
    ).toBe(true);
    expect(w.teams[0].finance.cash).toBe(cash - 10800);
    expect(() =>
      applyOwnerAction(w, { type: "camp", location: 0, focus: "contact" }),
    ).toThrow(/実施済み/);
  });
  it("rejects duplicated or oversized camp selections", () => {
    const w = state("autumn"),
      p = roster(w)[0];
    expect(() =>
      applyOwnerAction(w, {
        type: "campPlan",
        plan: {
          ...emptyCampPlan(),
          special: Array.from({ length: 6 }, () => ({
            id: p.id,
            kind: "breakout",
          })),
        },
      }),
    ).toThrow();
  });
});

describe("recruitment and opening registration", () => {
  it("preseason simulates twelve exhibitions without altering official records", () => {
    const w = state("preseason"),
      records = JSON.stringify(w.players.map((p) => p.reports));
    const next = applyOwnerAction(w, { type: "preseason" });
    const r = next.preseasonRecord!;
    expect(r.wins + r.losses + r.draws).toBe(12);
    expect(JSON.stringify(next.players.map((p) => p.reports))).toBe(records);
    expect(next.preseasonDone).toBe(true);
  });
  it("queues A-rank compensation and loses an unprotected player", () => {
    let w = state("fa");
    const fa = seniorRoster(w, 1).find((p) => p.species === "cat")!;
    fa.team = null;
    fa.market = "fa";
    fa.faRank = "A";
    fa.formerTeam = 1;
    fa.offerRound = 2;
    w.teams[0].finance.cash = 2_000_000;
    w = applyOwnerAction(w, { type: "offer", id: fa.id, salary: fa.ask * 3 });
    expect(w.players.find((p) => p.id === fa.id)!.team).toBe(0);
    expect(w.compensations).toHaveLength(1);
    expect(() => applyOwnerAction(w, { type: "compensate" })).toThrow(/28/);
    w = applyOwnerAction(w, { type: "autoProtect" });
    const protectedIds = [...w.compensations[0].protected];
    expect(protectedIds).toHaveLength(28);
    expect(protectionCandidates(w).every((p) => p.species === "cat")).toBe(
      true,
    );
    const before = seniorRoster(w).length;
    w = applyOwnerAction(w, { type: "compensate" });
    expect(w.compensations).toHaveLength(0);
    expect(seniorRoster(w)).toHaveLength(before - 1);
    expect(
      protectedIds.every(
        (id) => w.players.find((p) => p.id === id)!.team === 0,
      ),
    ).toBe(true);
  });
  it("C-rank acquisitions do not require compensation", () => {
    let w = state("fa");
    const p = seniorRoster(w, 1).find((p) => p.species === "cat")!;
    p.team = null;
    p.market = "fa";
    p.formerTeam = 1;
    p.faRank = "C";
    p.offerRound = 2;
    w.teams[0].finance.cash = 2_000_000;
    w = applyOwnerAction(w, { type: "offer", id: p.id, salary: p.ask * 3 });
    expect(w.compensations).toHaveLength(0);
  });
  it("requires valid one-for-one trade value and moves both players", () => {
    const w = state("trade"),
      give = seniorRoster(w).find((p) => p.species === "cat")!,
      take = seniorRoster(w, 1).sort((a, b) => ability(a) - ability(b))[0];
    Object.keys(give.skills).forEach((k) => {
      give.skills[k as keyof typeof give.skills] = 99;
    });
    give.velocity = 160;
    give.potential = 99;
    const next = applyOwnerAction(w, {
      type: "trade",
      give: give.id,
      take: take.id,
      cash: 1000,
    });
    expect(next.players.find((p) => p.id === give.id)!.team).toBe(1);
    expect(next.players.find((p) => p.id === take.id)!.team).toBe(0);
    expect(seniorRoster(next)).toHaveLength(seniorRoster(w).length);
  });
  it("enforces separate senior, active and foreign limits", () => {
    let w = state("registration");
    w = applyOwnerAction(w, { type: "autoActive" });
    expect(w.teams[0].activeIds).toHaveLength(31);
    expect(activeError(w)).toBeNull();
    expect(
      w.teams[0].activeIds.filter(
        (id) => w.players.find((p) => p.id === id)!.species === "dog",
      ).length,
    ).toBeLessThanOrEqual(4);
    const development = roster(w).find(
      (p) => p.registration === "development",
    )!;
    expect(() =>
      applyOwnerAction(w, { type: "active", id: development.id }),
    ).toThrow(/支配下/);
    w.phase = "promotion";
    const promoted = applyOwnerAction(w, {
      type: "promote",
      id: development.id,
    });
    expect(seniorRoster(promoted)).toHaveLength(seniorRoster(w).length + 1);
  });
  it("legacy upgrade keeps capabilities, history and cash while changing clubs", () => {
    const old = structuredClone(initial);
    (old as unknown as { version: number }).version = 2;
    old.teams[0].finance.cash = 123456;
    const next = upgradeLegacy(old);
    expect(next.version).toBe(3);
    expect(next.teams[0].city).toBe("福岡");
    expect(next.teams[0].finance.cash).toBe(123456);
    expect(next.players[0].skills).toEqual(old.players[0].skills);
    expect(next.players[0].reports).toEqual(old.players[0].reports);
  });
});
