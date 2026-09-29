import { beforeAll, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createWorld, estimate, applyOwnerAction } from "./engine";
import { SKILLS, type Skill, type WorldState } from "./model";
import { velocityEstimate, pitchLevelEstimate } from "./scouting";
import { PlayerAbilityPanel } from "./PlayerAbilityPanel";

let base: WorldState;
beforeAll(() => {
  base = createWorld();
}, 30000);
function candidate() {
  const w = structuredClone(base);
  w.phase = "tryout";
  const p = w.players.find(
    (p) => p.market === "tryout" && p.position === "投",
  )!;
  p.pro = 8;
  p.scouting = 0;
  return { w, p };
}
it("keeps professional tryout ranges narrow but uncertain, including every actual skill", () => {
  const { w, p } = candidate();
  for (const value of [1, 30, 50, 70, 99, 100]) {
    for (const key of Object.keys(SKILLS) as Skill[]) {
      p.skills[key] = value;
      const range = estimate(w, p, key);
      expect(range.high - range.low).toBeGreaterThan(0);
      expect(range.high - range.low).toBeLessThanOrEqual(8);
      expect(range.low).toBeLessThanOrEqual(value);
      expect(range.high).toBeGreaterThanOrEqual(value);
      expect(range.low).toBeGreaterThanOrEqual(1);
      expect(range.high).toBeLessThanOrEqual(100);
    }
  }
});
it("narrows further through scouting and only confirms the final point at 100 percent or signing", () => {
  const { w, p } = candidate();
  p.skills.control = 60;
  const widths = [0, 25, 50, 75, 99, 100].map((sc) => {
    p.scouting = sc;
    const range = estimate(w, p, "control");
    return range.high - range.low;
  });
  expect(widths).toEqual([8, 6, 4, 2, 2, 0]);
  p.scouting = 0;
  const signed = applyOwnerAction(w, { type: "sign", id: p.id });
  expect(
    estimate(
      signed,
      signed.players.find((x) => x.id === p.id)!,
      "control",
    ),
  ).toEqual({ low: 60, high: 60 });
});
it("does not narrow unknown amateurs, draft prospects or foreign candidates", () => {
  const { w, p } = candidate();
  p.skills.control = 60;
  p.pro = 0;
  let range = estimate(w, p, "control");
  expect(range.high - range.low).toBeGreaterThan(8);
  p.pro = 8;
  for (const market of ["draft", "foreign"] as const) {
    p.market = market;
    range = estimate(w, p, "control");
    expect(range.high - range.low).toBeGreaterThan(8);
  }
});
it("uses small professional velocity and pitch ranges without changing skills, stats, or RNG", () => {
  const { w, p } = candidate();
  const before = JSON.stringify(w);
  expect(velocityEstimate(p)).toEqual({
    low: p.velocity - 2,
    high: p.velocity + 2,
  });
  expect(pitchLevelEstimate(p, 4)).toEqual({ low: 3, high: 5 });
  expect(pitchLevelEstimate(p, 1)).toEqual({ low: 1, high: 2 });
  expect(pitchLevelEstimate(p, 7)).toEqual({ low: 6, high: 7 });
  const html = renderToStaticMarkup(
    createElement(PlayerAbilityPanel, { w, p }),
  );
  expect(html).toContain("実績を踏まえた小幅な推定範囲");
  expect(html).not.toContain("変化量 未調査");
  for (const key of Object.keys(SKILLS) as Skill[]) estimate(w, p, key);
  expect(JSON.stringify(w)).toBe(before);
  expect(
    estimate(
      JSON.parse(before),
      JSON.parse(before).players.find((x: typeof p) => x.id === p.id),
      "control",
    ),
  ).toEqual(estimate(w, p, "control"));
  p.scouting = 100;
  expect(velocityEstimate(p)).toEqual({ low: p.velocity, high: p.velocity });
  expect(pitchLevelEstimate(p, 4)).toEqual({ low: 4, high: 4 });
});
