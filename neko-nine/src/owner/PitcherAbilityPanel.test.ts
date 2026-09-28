import { beforeAll, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createWorld, roster } from "./engine";
import { type Player, type WorldState } from "./model";
import { PlayerAbilityPanel } from "./PlayerAbilityPanel";
let w: WorldState;
beforeAll(() => {
  w = createWorld();
}, 30000);
const render = (p: Player) =>
  renderToStaticMarkup(createElement(PlayerAbilityPanel, { p, w }));
it("renders existing pitcher data once, without fabricated ball power or season stats", () => {
  const p = roster(w).find((p) => p.position === "投")!;
  const before = JSON.stringify(p);
  const html = render(p);
  expect(html).toContain("pitcher-primary");
  expect(html).toContain("制球");
  expect(html).toContain("スタミナ");
  expect(html).not.toContain("球威");
  expect(html).not.toContain("ability-season");
  expect(html).not.toContain("pitch-memory");
  for (const pitch of p.pitches)
    expect(html).toContain(`${pitch.name} 変化量 ${pitch.level}`);
  expect(JSON.stringify(p)).toBe(before);
});
it("conceals unscouted pitch levels and shows dashed directions instead of fabricated levels", () => {
  const p = structuredClone(
    w.players.find((p) => p.market === "draft" && p.position === "投")!,
  );
  p.scouting = 0;
  const html = render(p);
  expect(html).toContain("推定範囲");
  expect(html).toContain("stroke-dasharray");
  for (const pitch of p.pitches)
    expect(html).toContain(`${pitch.name} 変化量 未調査`);
});
it("mirrors pitch direction for left-handed pitchers and handles an empty repertoire", () => {
  const p = structuredClone(roster(w).find((p) => p.position === "投")!);
  p.pitches = [{ name: "スライダー", level: 4 }];
  p.throws = "右";
  expect(render(p)).toContain('aria-hidden="true">←');
  p.throws = "左";
  expect(render(p)).toContain('aria-hidden="true">→');
  p.pitches = [];
  expect(render(p)).toContain("変化球の登録なし");
});
