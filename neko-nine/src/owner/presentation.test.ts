import { beforeAll, expect, it } from "vitest";
import { createWorld, newPlayer, applyOwnerAction, roster } from "./engine";
import { playerName, normalizePlayerNames } from "./identity";
import { portraitPattern } from "./AnimalPortrait";
import { releaseCandidates, isCorePlayer } from "./release";
import { secretaryAdvice, eventTab, nextEventLabel } from "./Secretary";
import { PHASE_FLOW, type WorldState } from "./model";

let world: WorldState;
beforeAll(() => {
  world = createWorld();
}, 30000);
it("new careers include simulated pre-ownership history without pre-pro records", () => {
  const veterans = world.players.filter(
    (p) => p.team === 0 && p.pro >= 4 && p.age >= 21,
  );
  expect(veterans.length).toBeGreaterThan(0);
  expect(
    veterans.every(
      (p) => p.reports[2024] && p.reports[2025] && p.reports[2026],
    ),
  ).toBe(true);
  expect(veterans.some((p) => p.reports[2024].games > 0)).toBe(true);
  expect(
    world.players
      .filter((p) => p.pro <= 1)
      .every((p) => !p.reports[2024] && !p.reports[2025]),
  ).toBe(true);
  expect(world.archives).toHaveLength(0);
  expect(
    world.teams[0].wins + world.teams[0].losses + world.teams[0].draws,
  ).toBe(143);
  expect(world.teams[0].finance.cash).toBe(280000);
});
it("gives all players unique Japanese family + animal names, also after recruiting", () => {
  const w = structuredClone(world);
  for (let i = 0; i < 500; i++)
    newPlayer(w, null, "投", "draft", i % 5 === 0 ? "dog" : "cat");
  expect(new Set(w.players.map((p) => p.name)).size).toBe(w.players.length);
  expect(
    w.players.every((p) =>
      /^[\p{Script=Han}々]+ [\p{Script=Katakana}ー]+$/u.test(p.name),
    ),
  ).toBe(true);
  const used = new Set<string>();
  for (let i = 0; i < 12000; i++) {
    const name = playerName(i % 5 === 0 ? "dog" : "cat", i, used);
    expect(used.has(name)).toBe(false);
    used.add(name);
  }
});
it("upgrades old names without changing stats or identities and is idempotent", () => {
  const w = structuredClone(world),
    p = w.players[0],
    snapshot = structuredClone(p);
  p.name = "ダイ斗 1";
  w.news[0].body = `ダイ斗 1が入団`;
  expect(normalizePlayerNames(w)).toBe(true);
  expect(p.id).toBe(snapshot.id);
  expect(p.skills).toEqual(snapshot.skills);
  expect(p.reports).toEqual(snapshot.reports);
  expect(w.news[0].body).toBe(`${p.name}が入団`);
  expect(normalizePlayerNames(w)).toBe(false);
});
it("uses distinct stable portrait combinations across the league and future players", () => {
  const signatures = new Set<string>();
  for (let i = 1; i <= 20000; i++) {
    const p = { id: `p${i}`, species: "cat" as const };
    const sig = JSON.stringify(portraitPattern(p));
    expect(signatures.has(sig)).toBe(false);
    signatures.add(sig);
    expect(portraitPattern(p)).toEqual(portraitPattern(p));
  }
});
it("excludes young and core players by default but lets the owner select them", () => {
  const w = structuredClone(world);
  w.phase = "release";
  const options = {
    excludeYoung: true,
    excludeCore: true,
    mode: "戦力外",
    position: "全守備",
    search: "",
  };
  const candidates = releaseCandidates(w, options);
  expect(candidates.length).toBeGreaterThan(0);
  expect(candidates.every((p) => p.pro > 3 && !isCorePlayer(p, w.year))).toBe(
    true,
  );
  const all = releaseCandidates(w, {
    ...options,
    excludeYoung: false,
    excludeCore: false,
  });
  expect(all.length).toBe(roster(w).length);
  expect(all.some((p) => p.pro <= 3)).toBe(true);
  expect(all.some((p) => isCorePlayer(p, w.year))).toBe(true);
  const core = all.find(
    (p) => isCorePlayer(p, w.year) && p.contractYear <= w.year,
  )!;
  expect(
    applyOwnerAction(w, { type: "release", id: core.id }).players.find(
      (p) => p.id === core.id,
    )?.team,
  ).toBe(null);
});
it("keeps multi-year contracts visible but protected and filters development eligibility", () => {
  const w = structuredClone(world);
  w.phase = "release";
  const p = roster(w)[0];
  p.contractYear = w.year + 2;
  const opts = {
    excludeYoung: false,
    excludeCore: false,
    mode: "戦力外",
    position: "全守備",
    search: "",
  };
  expect(releaseCandidates(w, opts).some((x) => x.id === p.id)).toBe(true);
  expect(() => applyOwnerAction(w, { type: "release", id: p.id })).toThrow(
    /契約/,
  );
  expect(
    releaseCandidates(w, { ...opts, mode: "育成打診" }).every(
      (x) => x.species === "cat" && x.registration === "senior",
    ),
  ).toBe(true);
});
it("guides every playable phase and routes advances straight to their task", () => {
  for (const phase of [...PHASE_FLOW, "season"] as const) {
    const w = { ...world, phase };
    expect(secretaryAdvice(w).message.length).toBeGreaterThan(30);
    expect(secretaryAdvice(w).steps.length).toBe(3);
    expect(nextEventLabel(w)).not.toContain("undefined");
  }
  expect(eventTab({ phase: "release" })).toBe("編成");
  expect(eventTab({ phase: "budget" })).toBe("経営");
  expect(eventTab({ phase: "season" })).toBe("ホーム");
  expect(secretaryAdvice(world).message).toContain("シーズンお疲れ様でした");
});
