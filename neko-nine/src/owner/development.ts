import {
  blankRecord,
  type Player,
  type WorldState,
  type AbilitySnapshot,
} from "./model";

export const abilitySnapshot = (p: Player): AbilitySnapshot => ({
  skills: { ...p.skills },
  velocity: p.velocity,
  pitches: structuredClone(p.pitches),
  position: p.position,
});

export function startDevelopmentRecord(
  w: WorldState,
  year: number,
  label: string,
) {
  w.developmentBaseline = {
    year,
    label,
    players: Object.fromEntries(
      w.players
        .filter((p) => p.team === 0 && p.market === "roster")
        .map((p) => [p.id, abilitySnapshot(p)]),
    ),
  };
}
export function recordSeasonReview(w: WorldState, rank: number) {
  const team = w.teams[0],
    baseline =
      w.developmentBaseline?.year === w.year
        ? w.developmentBaseline
        : undefined;
  const ledger = team.finance.ledger.filter(
    (r) => r.year === w.year && !/融資|返済/.test(r.category),
  );
  w.seasonReview = {
    year: w.year,
    comparisonLabel: baseline?.label ?? "比較元の能力記録なし",
    rank,
    team: {
      wins: team.wins,
      losses: team.losses,
      draws: team.draws,
      scored: team.scored,
      conceded: team.conceded,
      previousRank: team.previousRank,
    },
    finance: {
      income: ledger
        .filter((r) => r.amount > 0)
        .reduce((sum, r) => sum + r.amount, 0),
      expense: -ledger
        .filter((r) => r.amount < 0)
        .reduce((sum, r) => sum + r.amount, 0),
      attendance: team.finance.attendance,
    },
    players: w.players
      .filter(
        (p) =>
          (p.team === 0 && p.market === "roster") ||
          (p.reports[w.year]?.team === 0 &&
            p.reports[w.year]?.source !== "backfill"),
      )
      .map((p) => ({
        id: p.id,
        name: p.name,
        age: p.age,
        record: structuredClone(
          p.reports[w.year]?.source !== "backfill"
            ? (p.reports[w.year] ?? blankRecord(w.year, 0))
            : blankRecord(w.year, 0),
        ),
        before: baseline?.players[p.id],
        after: abilitySnapshot(p),
      })),
  };
}
// Never reconstruct past growth: old saves begin comparison at their actual loaded state.
export function ensureDevelopmentRecord(w: WorldState) {
  if (w.developmentBaseline) return;
  startDevelopmentRecord(
    w,
    w.phase === "season" ? w.year : w.year + 1,
    `${w.year}年${w.phase === "season" ? w.month + "月" : "オフ"}の記録開始時`,
  );
}

export function recordNewOwnerPlayers(w: WorldState) {
  if (!w.developmentBaseline) return;
  for (const p of w.players.filter(
    (p) => p.team === 0 && p.market === "roster",
  )) {
    w.developmentBaseline.players[p.id] ??= abilitySnapshot(p);
  }
}
