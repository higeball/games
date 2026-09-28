import type { Player } from "./model";

/** 368,640 stable visual combinations for each species. */
export function portraitPattern(p: Pick<Player, "id" | "species">) {
  let n = Number(p.id.replace(/\D/g, ""));
  if (!Number.isSafeInteger(n) || n <= 0)
    n = [...p.id].reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 1);
  const take = (base: number) => {
    const value = n % base;
    n = Math.floor(n / base);
    return value;
  };
  return {
    coat: take(12),
    marking: take(8),
    eyes: take(6),
    ears: take(5),
    muzzle: take(4),
    shirt: take(8),
    collar: take(4),
  };
}
