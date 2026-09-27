import { nextRandom } from "../game/simulation/rng";
import { blankRecord, type Player, type WorldState } from "./model";

/** Fill absent fictional career data only. Never overwrite played-season records. */
export function backfillCareerHistory(w: WorldState) {
  const lastYear = w.phase === "season" ? w.year - 1 : w.year;
  let changed = false;
  for (const p of w.players) {
    if (p.market === "draft") continue;
    const joined =
      p.draftYear > 0 ? p.draftYear : w.year - Math.max(1, p.pro) + 1;
    for (let year = lastYear - 2; year <= lastYear; year++) {
      if (p.reports[year] || year < joined || p.age - (w.year - year) < 18)
        continue;
      p.reports[year] = careerRecord(p, year);
      changed = true;
    }
  }
  return changed;
}

function careerRecord(p: Player, year: number) {
  // Independent RNG: importing/reloading must not change future lottery/game RNG.
  let seed = [...`${p.id}:${year}:career`].reduce(
    (s, c) => (Math.imul(s, 31) + c.charCodeAt(0)) >>> 0,
    2166136261,
  );
  const rand = () => {
    const [n, next] = nextRandom(seed);
    seed = next;
    return n;
  };
  const vary = (n: number) => (rand() - 0.5) * n;
  const count = (n: number, max = 10000) =>
    Math.max(0, Math.min(max, Math.round(n)));
  const s = p.skills;
  const team = p.formerTeam ?? p.team ?? -1;
  const r = blankRecord(year, team);
  r.source = "backfill";
  if (p.position === "投") {
    const starter = s.stamina >= 55;
    r.games = count(
      starter
        ? 14 + s.control * 0.17 + vary(10)
        : 14 + s.control * 0.55 + vary(18),
      72,
    );
    r.starts = starter ? r.games : 0;
    r.outs = count(
      r.games * (starter ? 4.2 + s.stamina * 0.02 : 1.1 + rand() * 0.4) * 3,
    );
    r.wins = count(r.games * (starter ? 0.35 : 0.07) + vary(3), r.games);
    r.losses = count(
      r.games * (starter ? 0.25 : 0.05) + vary(3),
      r.games - r.wins,
    );
    const closer = !starter && rand() > 0.7;
    r.saves = closer ? count(r.games * 0.4 + vary(5), r.games - r.wins) : 0;
    r.holds =
      !starter && !closer
        ? count(r.games * 0.38 + vary(5), r.games - r.wins)
        : 0;
    const era = Math.max(
      1.2,
      6.1 - s.control * 0.039 - (p.velocity - 130) * 0.024 + vary(1.1),
    );
    r.earned = count((era * r.outs) / 27);
    r.allowed = r.earned + count(rand() * 8);
    r.k = count(
      (r.outs / 3) *
        Math.max(0.4, 0.65 + (p.velocity - 130) * 0.023 + vary(0.25)),
    );
    r.bb = count(
      (r.outs / 27) * Math.max(1, 5.5 - s.control * 0.045 + vary(0.7)),
    );
  } else {
    const score =
      s.contact * 0.35 + s.power * 0.25 + s.speed * 0.15 + s.fielding * 0.25;
    r.games = count((score - 20) * 2 + vary(34), 143);
    if (!r.games) return r;
    r.ab = count(r.games * (1.8 + score * 0.024 + vary(0.5)));
    r.hits = count(
      r.ab *
        Math.max(0.15, Math.min(0.36, 0.17 + s.contact * 0.0014 + vary(0.045))),
      r.ab,
    );
    r.hr = count(r.ab * (0.002 + s.power * 0.00065 + vary(0.007)), r.hits);
    r.doubles = count(r.hits * (0.14 + rand() * 0.08), r.hits - r.hr);
    r.triples = count(r.hits * 0.025 * rand(), r.hits - r.hr - r.doubles);
    r.walks = count(r.ab * (0.035 + s.contact * 0.00065 + vary(0.025)));
    r.pa = r.ab + r.walks;
    r.rbi = count(r.hr * 1.7 + r.hits * 0.28 + vary(9));
    r.runs = count(r.hits * 0.4 + r.walks * 0.3 + r.hr * 0.5);
    r.steals = count(r.games * Math.max(0, s.speed - 42) * 0.007 * rand(), 60);
    r.errors = count(r.games * Math.max(0.015, 0.18 - s.fielding * 0.0016));
  }
  return r;
}
