import type { Player, WorldState } from "./model";
import { ability, roster } from "./engine";

export function isCorePlayer(p: Player, year: number) {
  const r = p.reports[year];
  if (!r) return false;
  return p.position === "投"
    ? r.starts >= 10 || r.games >= 30 || r.saves >= 10 || r.holds >= 10
    : r.games >= 60 || r.pa >= 180;
}
export function releaseReasons(p: Player, year: number) {
  const r = p.reports[year],
    reasons: string[] = [];
  if (!isCorePlayer(p, year)) reasons.push("今季の出場機会が少ない");
  if (p.age > p.peak) reasons.push("成長ピークを過ぎている");
  if (ability(p) < 45) reasons.push("現在の戦力評価が低い");
  if (p.salary >= 7000 && (!r || r.games < 30))
    reasons.push("年俸に対して出場が少ない");
  return reasons.length ? reasons : ["今季の成績・契約を確認"];
}
export function releaseCandidates(
  w: WorldState,
  options: {
    excludeYoung: boolean;
    excludeCore: boolean;
    mode: string;
    position: string;
    search: string;
  },
) {
  return roster(w)
    .filter(
      (p) =>
        (!options.excludeYoung || p.pro > 3) &&
        (!options.excludeCore || !isCorePlayer(p, w.year)) &&
        (options.mode !== "育成打診" ||
          (p.registration === "senior" && p.species === "cat")) &&
        (options.position === "全守備" || p.position === options.position) &&
        `${p.name} ${p.trait}`.includes(options.search),
    )
    .sort(
      (a, b) =>
        Number(a.contractYear > w.year) - Number(b.contractYear > w.year) ||
        Number(isCorePlayer(a, w.year)) - Number(isCorePlayer(b, w.year)) ||
        releaseReasons(b, w.year).length - releaseReasons(a, w.year).length ||
        ability(a) - ability(b) ||
        a.id.localeCompare(b.id),
    );
}
