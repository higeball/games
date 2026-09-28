import { beforeAll, expect, it } from "vitest";
import { createWorld, newPlayer, applyOwnerAction, roster } from "./engine";
import { playerName, normalizePlayerNames } from "./identity";
import { portraitPattern } from "./AnimalPortrait";
import {
  releaseCandidates,
  isCorePlayer,
  isPendingRelease,
  recommendedReleaseIds,
} from "./release";
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
      .filter((p) => p.team !== null && p.pro <= 1)
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

it("preselects ten eligible recommendations without releasing anyone and allows individual selection", () => {
  const w = structuredClone(world);
  w.phase = "release";
  const ids = recommendedReleaseIds(w);
  const options = {
    excludeYoung: true,
    excludeCore: true,
    mode: "戦力外",
    position: "全守備",
    search: "",
    recommendedIds: ids,
  };
  const list = releaseCandidates(w, options);
  expect(list).toHaveLength(10);
  expect(new Set(ids).size).toBe(10);
  expect(
    list.every(
      (p) =>
        p.team === 0 &&
        p.pro > 3 &&
        !isCorePlayer(p, w.year) &&
        p.contractYear <= w.year,
    ),
  ).toBe(true);
  expect(roster(w)).toHaveLength(roster(world).length);
  expect(
    releaseCandidates(w, {
      ...options,
      recommendedIds: undefined,
      excludeYoung: false,
      excludeCore: false,
    }),
  ).toHaveLength(roster(w).length);
  const released = applyOwnerAction(w, { type: "release", id: ids[0] });
  expect(releaseCandidates(released, options)).toHaveLength(10);
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

it("keeps released core players visible and restores roster, history and fan rating on cancellation", () => {
  const w = structuredClone(world);
  w.phase = "release";
  const p = roster(w).find(
    (p) => isCorePlayer(p, w.year) && p.contractYear <= w.year,
  )!;
  const initial = structuredClone(p);
  const count = roster(w).length;
  const popularity = w.teams[0].finance.popularity;
  const released = applyOwnerAction(w, { type: "release", id: p.id });
  const pending = released.players.find((x) => x.id === p.id)!;
  expect(isPendingRelease(pending, released)).toBe(true);
  expect(roster(released)).toHaveLength(count - 1);
  expect(
    releaseCandidates(released, {
      excludeYoung: true,
      excludeCore: true,
      mode: "戦力外",
      position: "全守備",
      search: "",
    }).some((x) => x.id === p.id),
  ).toBe(true);
  // JSON roundtrip represents saving and reopening the game.
  const restored = applyOwnerAction(JSON.parse(JSON.stringify(released)), {
    type: "cancelRelease",
    id: p.id,
  });
  expect(roster(restored)).toHaveLength(count);
  expect(restored.players.find((x) => x.id === p.id)).toEqual(initial);
  expect(restored.teams[0].finance.popularity).toBeCloseTo(popularity);
  expect(() =>
    applyOwnerAction(restored, { type: "cancelRelease", id: p.id }),
  ).toThrow();
});

it("finalizes notices at the end of their release period and rejects stale cancellation", () => {
  const w = structuredClone(world);
  w.phase = "release";
  const p = roster(w).find((p) => p.contractYear <= w.year)!;
  const released = applyOwnerAction(w, { type: "release", id: p.id });
  const advanced = applyOwnerAction(released, { type: "advance" });
  expect(advanced.phase).toBe("draft");
  expect(
    advanced.players.find((x) => x.id === p.id)?.releaseNotice,
  ).toBeUndefined();
  advanced.phase = "release2";
  expect(() =>
    applyOwnerAction(advanced, { type: "cancelRelease", id: p.id }),
  ).toThrow();
  const stale = structuredClone(released);
  stale.year++;
  expect(() =>
    applyOwnerAction(stale, { type: "cancelRelease", id: p.id }),
  ).toThrow();
});

it("cancels second-period notices without inflating a floor-clamped fan rating", () => {
  const w = structuredClone(world);
  w.phase = "release2";
  w.teams[0].finance.popularity = 1.1;
  const players = roster(w)
    .filter((p) => p.contractYear <= w.year)
    .slice(0, 2);
  let updated = w;
  for (const p of players)
    updated = applyOwnerAction(updated, { type: "release", id: p.id });
  for (const p of players)
    updated = applyOwnerAction(updated, { type: "cancelRelease", id: p.id });
  expect(updated.teams[0].finance.popularity).toBeCloseTo(1.1);
  expect(roster(updated)).toHaveLength(roster(w).length);
});

it("does not let cancelling a notice exceed the seventy-player senior limit", () => {
  const w = structuredClone(world);
  w.phase = "release";
  const p = roster(w).find(
    (p) => p.registration === "senior" && p.contractYear <= w.year,
  )!;
  const released = applyOwnerAction(w, { type: "release", id: p.id });
  while (
    roster(released).filter((p) => p.registration === "senior").length < 70
  )
    newPlayer(released, 0, "投", "roster");
  expect(() =>
    applyOwnerAction(released, { type: "cancelRelease", id: p.id }),
  ).toThrow(/支配下枠/);
  expect(
    isPendingRelease(
      released.players.find((x) => x.id === p.id)!,
      released,
    ),
  ).toBe(true);
});
