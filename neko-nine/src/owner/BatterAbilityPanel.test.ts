import { beforeAll, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createWorld, estimate, roster } from "./engine";
import { blankRecord, type Player, type WorldState } from "./model";
import { BatterAbilityPanel } from "./BatterAbilityPanel";

let world: WorldState;
beforeAll(() => {
  world = createWorld();
}, 30000);
const render = (p: Player, w = world) =>
  renderToStaticMarkup(createElement(BatterAbilityPanel, { p, w }));

it("uses six existing ratings and marks only the recorded main position", () => {
  const p = roster(world).find((p) => p.position === "遊")!;
  const before = JSON.stringify(world);
  const html = render(p);
  expect(html.match(/class="ability-chip"/g)).toHaveLength(6);
  expect(html.match(/main-position/g)).toHaveLength(1);
  expect(html).toContain("遊 主守備位置");
  expect(html).toContain("主守備：遊撃手");
  expect(html).not.toContain("スローイング");
  expect(html).not.toContain("対右ミート");
  expect(JSON.stringify(world)).toBe(before);
});
it("does not reveal unknown prospect ratings or trajectory", () => {
  const p = structuredClone(
    world.players.find((p) => p.market === "draft" && p.position !== "投")!,
  );
  p.scouting = 0;
  const html = render(p);
  const e = estimate(world, p, "contact");
  expect(html).toContain(`${e.low}〜${e.high}`);
  expect(html).toContain("能力は調査に基づく推定範囲");
  expect(html).toContain("↗ ？");
  expect(html).not.toContain("ability-season");
});
it("fully scouted prospects show exact existing ratings", () => {
  const p = structuredClone(
    world.players.find((p) => p.market === "draft" && p.position !== "投")!,
  );
  p.scouting = 100;
  const html = render(p);
  expect(html).not.toContain("推定範囲");
  expect(html).toContain(`↗ ${p.trajectory}`);
  expect(html).toContain(`>${p.skills.contact}</b>`);
});
it("omits duplicated season results without altering first-team or farm reports", () => {
  const p = structuredClone(roster(world).find((p) => p.position !== "投")!);
  const w = { ...world, year: 2027, phase: "season" as const };
  p.reports[2027] = {
    ...blankRecord(2027, 0),
    games: 10,
    ab: 30,
    hits: 9,
    hr: 2,
  };
  p.farmReports = { 2027: { ...blankRecord(2027, 0), games: 70, hr: 55 } };
  const before = JSON.stringify(p);
  const html = render(p, w);
  expect(html).not.toContain("一軍成績");
  expect(html).not.toContain("ability-season");
  expect(JSON.stringify(p)).toBe(before);
});
