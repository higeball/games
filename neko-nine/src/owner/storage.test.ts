import "fake-indexeddb/auto";
import { beforeAll, expect, it } from "vitest";
import { createWorld } from "./engine";
import { loadWorld, persistWorld, validateWorld } from "./storage";
import type { WorldState } from "./model";
import { backfillCareerHistory } from "./history";

let world: WorldState;
beforeAll(() => {
  world = createWorld();
  backfillCareerHistory(world);
}, 30000);

it("persists current and previous snapshots without deleting legacy saves", async () => {
  localStorage.setItem("neko-nine-v1", "legacy");
  await persistWorld(world);
  const next = structuredClone(world);
  next.revision++;
  await persistWorld(next);
  expect((await loadWorld())?.revision).toBe(next.revision);
  expect((await loadWorld(true))?.revision).toBe(world.revision);
  expect(localStorage.getItem("neko-nine-v1")).toBe("legacy");
});

it("rejects incompatible, corrupted and out-of-range imports", async () => {
  expect(() => validateWorld({ version: 1 })).toThrow();
  const bad = structuredClone(world);
  bad.players[0].skills.power = Number.NaN;
  await expect(persistWorld(bad)).rejects.toThrow();
  expect(() => validateWorld({ ...world, phase: "unknown" })).toThrow();
  expect(() =>
    validateWorld({ ...world, players: [...world.players, world.players[0]] }),
  ).toThrow();
  expect((await loadWorld())?.players[0].skills.power).toBe(
    world.players[0].skills.power,
  );
});

it("renames old numeric player names on load while preserving saved career data", async () => {
  const old = structuredClone(world);
  old.players[0].name = "ダイ斗１";
  old.players[1].name = "ダイ斗１";
  await persistWorld(old);
  const loaded = (await loadWorld())!;
  expect(loaded.players.every((p) => !/[0-9０-９]/.test(p.name))).toBe(true);
  expect(new Set(loaded.players.map((p) => p.name)).size).toBe(
    loaded.players.length,
  );
  expect(loaded.players[0].reports).toEqual(old.players[0].reports);
  expect(loaded.players[0].skills).toEqual(old.players[0].skills);
  expect(loaded.teams).toEqual(old.teams);
  expect((await loadWorld())?.players[0].name).toBe(loaded.players[0].name);
});

it("backfills and saves missing old career years on load without changing real results", async () => {
  const old = structuredClone(world);
  const veteran = old.players.find(
    (p) => p.team === 0 && p.pro >= 4 && p.age >= 21,
  )!;
  const real = structuredClone(veteran.reports[2026]);
  delete veteran.reports[2024];
  delete veteran.reports[2025];
  await persistWorld(old);
  const current = (await loadWorld())!,
    p = current.players.find((p) => p.id === veteran.id)!;
  expect(p.reports[2024].source).toBe("backfill");
  expect(p.reports[2025].source).toBe("backfill");
  expect(p.reports[2026]).toEqual(real);
  expect(current.teams).toEqual(old.teams);
  expect(current.seed).toBe(old.seed);
  expect(
    (await loadWorld())?.players.find((x) => x.id === veteran.id)
      ?.reports[2024],
  ).toEqual(p.reports[2024]);
});

it("migrates and persists reserve reference records while keeping first-team zeros", async () => {
  const old = structuredClone(world);
  const p = old.players.find(
    (p) => p.team === 0 && p.pro >= 4 && !p.reports[2026]?.games,
  )!;
  const official = structuredClone(p.reports);
  delete p.farmReports;
  await persistWorld(old);
  const loaded = (await loadWorld())!.players.find((x) => x.id === p.id)!;
  expect(loaded.reports).toEqual(official);
  expect(loaded.farmReports?.[2026].games).toBeGreaterThan(0);
  expect(
    (await loadWorld())!.players.find((x) => x.id === p.id)!.farmReports,
  ).toEqual(loaded.farmReports);
});
