import type { Player, RecordLine, WorldState } from "./model";

export const ROOKIE_SALARY = 600;
const rounded = (n: number) => Math.round(n / 10) * 10;
function seasonValue(p: Player, r: RecordLine) {
  if (!r.games) return 0;
  if (p.position === "投") {
    const innings = r.outs / 3;
    const era = r.outs ? (r.earned * 27) / r.outs : 6;
    const quality = Math.max(
      0.65,
      Math.min(1.25, 1.2 - Math.max(0, era - 2) * 0.1),
    );
    return (
      (innings * 28 +
        r.wins * 250 +
        r.saves * 180 +
        r.holds * 100 +
        r.k * 6 +
        r.games * 10) *
      quality
    );
  }
  const average = r.ab ? r.hits / r.ab : 0;
  const quality = Math.max(0.75, Math.min(1.15, 0.9 + (average - 0.23) * 2));
  return (
    (r.pa * 8 +
      r.hits * 18 +
      r.hr * 120 +
      r.rbi * 16 +
      r.steals * 25 +
      r.games * 8) *
    quality
  );
}

/** Game valuation in万円. Reserve stats do not count as first-team achievements. */
export function performanceSalary(p: Player, year?: number) {
  if (p.market === "draft") return ROOKIE_SALARY;
  if (p.registration === "development") return 300;
  const years = Object.keys(p.reports)
    .map(Number)
    .sort((a, b) => b - a);
  const latest = year ?? years[0];
  const r = p.reports[latest];
  const previous = years
    .filter((y) => y < latest)
    .slice(0, 2)
    .map((y) => seasonValue(p, p.reports[y]));
  const past = Math.max(0, ...previous);
  // New foreign recruits have overseas pedigree, unlike unsigned domestic rookies.
  if (!r && p.species === "dog") {
    const talent =
      p.position === "投"
        ? p.skills.control
        : (p.skills.contact + p.skills.power) / 2;
    return rounded(
      Math.max(
        2000,
        Math.min(15000, 2000 + Math.max(0, talent - 40) ** 2 * 12),
      ),
    );
  }
  const base = 500 + Math.min(300, Math.max(0, p.pro) * 30);
  const value = r ? seasonValue(p, r) : 0;
  if (!value) return rounded(base + Math.min(1500, past * 0.3));
  const career = Math.min(value * 0.3, past * 0.15);
  const popularity = Math.min(value * 0.08, p.popularity * 15);
  const assessed = base + value + career + popularity;
  return rounded(
    Math.min(
      50000,
      p.market === "tryout" ? Math.min(1800, assessed) : assessed,
    ),
  );
}

export function renewalSalary(p: Player) {
  if (p.market === "draft" || p.registration === "development")
    return performanceSalary(p);
  // Existing professionals retain a portion of their previous pay; not an exact NPB rule simulation.
  return rounded(
    Math.max(performanceSalary(p), p.salary * (p.salary > 10000 ? 0.6 : 0.75)),
  );
}

/** One-time correction of generated 2026 pay; user-negotiated contracts are preserved. */
export function normalizeSalaryScale(w: WorldState) {
  if (w.salaryModelVersion === 1) return false;
  for (const p of w.players) {
    if (p.market === "draft") {
      p.salary = 0;
      p.ask = ROOKIE_SALARY;
      continue;
    }
    if (
      p.draftYear > w.year &&
      p.market === "roster" &&
      p.negotiation === "accepted"
    ) {
      p.ask = p.salary;
      continue;
    }
    if (
      w.year === 2026 &&
      p.contractYear <= 2026 &&
      (p.team !== null || p.releaseNotice)
    ) {
      p.salary = performanceSalary(p, 2026);
      p.ask = p.salary;
    } else if (p.contractYear <= w.year && p.negotiation !== "accepted") {
      p.ask = renewalSalary(p);
    }
  }
  w.salaryModelVersion = 1;
  return true;
}
