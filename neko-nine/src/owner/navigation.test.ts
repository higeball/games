import { beforeAll, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createWorld, applyOwnerAction, roster } from "./engine";
import { Dashboard, FrontOffice, OwnerStatus } from "./FrontOffice";
import { phaseFinishLabel } from "./Secretary";
import { phaseBlockers } from "./operations";
import { type WorldState } from "./model";
let initial: WorldState;
beforeAll(() => {
  initial = createWorld();
}, 30000);
const parse = (html: string) => {
  const el = document.createElement("div");
  el.innerHTML = html;
  return el;
};

it("counts the five age brackets without overlap at any boundary", () => {
  const w = structuredClone(initial);
  const template = roster(w)[0];
  w.players = [18, 22, 23, 27, 28, 32, 33, 37, 38, 45].map((age, i) => ({
    ...template,
    id: `age${i}`,
    age,
  }));
  const dom = parse(
    renderToStaticMarkup(
      createElement(Dashboard, { w, act: () => {}, go: () => {} }),
    ),
  );
  const rows = [...dom.querySelectorAll(".age-chart > div")];
  expect(rows.map((r) => r.querySelector("span")!.textContent)).toEqual([
    "22歳以下",
    "23歳〜27歳",
    "28歳〜32歳",
    "33歳〜37歳",
    "38歳以上",
  ]);
  expect(rows.map((r) => r.querySelector("b")!.textContent)).toEqual(
    Array(5).fill("2人"),
  );
});
it("blocks header progression until the required camp has been completed", () => {
  const w = structuredClone(initial);
  w.phase = "autumn";
  w.campDone = false;
  const render = () =>
    parse(
      renderToStaticMarkup(
        createElement(OwnerStatus, { w, onAdvance: () => {} }),
      ),
    );
  expect(
    render().querySelector(".status-advance")!.hasAttribute("disabled"),
  ).toBe(true);
  expect(phaseFinishLabel(w)).toBe(
    "秋季キャンプを終了しFA公示・第2次戦力外へ進む",
  );
  w.campDone = true;
  expect(
    render().querySelector(".status-advance")!.hasAttribute("disabled"),
  ).toBe(false);
});
it("cannot leave a draft with an unconfirmed final-round result", () => {
  const w = structuredClone(initial);
  w.phase = "draft";
  w.draftRound = 6;
  w.draftPending = {
    round: 6,
    stage: "result",
    player: w.players[0].id,
    rivals: [],
    winner: 0,
  };
  expect(phaseBlockers(w).some((task) => task.includes("指名結果"))).toBe(true);
  expect(() => applyOwnerAction(w, { type: "advance" })).toThrow(/指名結果/);
  delete w.draftPending;
  expect(phaseBlockers(w)).toHaveLength(0);
});
it("shows only in-period markets and no routes to other calendar events", () => {
  const w = structuredClone(initial);
  w.phase = "release";
  const render = () =>
    parse(
      renderToStaticMarkup(
        createElement(FrontOffice, { w, act: () => {}, open: () => {} }),
      ),
    );
  expect(render().querySelector(".market-tabs")).toBeNull();
  expect(render().textContent).not.toContain("他の編成メニュー");
  w.phase = "contracts";
  expect(
    [...render().querySelectorAll(".market-tabs button")].map(
      (b) => b.textContent,
    ),
  ).toEqual(["イベント", "FA市場", "外国人", "トレード"]);
});
