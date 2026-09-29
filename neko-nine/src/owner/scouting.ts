import type { Player } from "./model";

// Professional tryout entrants have playing history; undrafted amateurs do not.
export const experiencedTryout = (p: Player) =>
  p.market === "tryout" && p.pro > 0;
export const fullyKnown = (p: Player) => p.team === 0 || p.scouting >= 100;

export function velocityEstimate(p: Player) {
  const width = fullyKnown(p)
    ? 0
    : experiencedTryout(p)
      ? Math.max(1, Math.round(2 * (1 - p.scouting / 100)))
      : 5;
  return { low: p.velocity - width, high: p.velocity + width };
}

export function pitchLevelEstimate(p: Player, level: number) {
  if (fullyKnown(p)) return { low: level, high: level };
  if (experiencedTryout(p))
    return { low: Math.max(1, level - 1), high: Math.min(7, level + 1) };
  return null;
}

export const rangeLabel = ({ low, high }: { low: number; high: number }) =>
  low === high ? String(low) : `${low}〜${high}`;
