import type { Player } from "./model";

// Professional tryout entrants have playing history; undrafted amateurs do not.
export const experiencedTryout = (p: Player) =>
  p.market === "tryout" && p.pro > 0;
export const fullyKnown = (p: Player) => p.team === 0 || p.scouting >= 100;

export const abilityUncertainty = (p: Player) =>
  p.market === "foreign"
    ? 6
    : p.market === "fa" || p.market === "roster" || experiencedTryout(p)
      ? 4
      : Infinity;
export const estimationCaption = (p: Player) =>
  p.market === "foreign"
    ? "能力は海外実績に基づく推定範囲"
    : abilityUncertainty(p) <= 4
      ? "能力は実績を踏まえた小幅な推定範囲"
      : "能力は調査に基づく推定範囲";

export function velocityEstimate(p: Player) {
  const width = fullyKnown(p)
    ? 0
    : Number.isFinite(abilityUncertainty(p))
      ? Math.max(
          1,
          Math.round((p.market === "foreign" ? 3 : 2) * (1 - p.scouting / 100)),
        )
      : 5;
  return { low: p.velocity - width, high: p.velocity + width };
}

export function pitchLevelEstimate(p: Player, level: number) {
  if (fullyKnown(p)) return { low: level, high: level };
  if (Number.isFinite(abilityUncertainty(p))) {
    const width = p.market === "foreign" && p.scouting < 50 ? 2 : 1;
    return {
      low: Math.max(1, level - width),
      high: Math.min(7, level + width),
    };
  }
  return null;
}

export const rangeLabel = ({ low, high }: { low: number; high: number }) =>
  low === high ? String(low) : `${low}〜${high}`;
