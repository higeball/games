import { completedSeasonYear, professionalStartYear } from "./history";
import {
  blankRecord,
  type Player,
  type RecordLine,
  type WorldState,
} from "./model";

const rate = (n: number, d: number) =>
  d ? (n / d).toFixed(3).replace(/^0\./, ".") : "—";

/** First-team history is always visible; reserves get their own optional table. */
export function RecentResults({ p, w }: { p: Player; w: WorldState }) {
  const year = completedSeasonYear(w);
  const years = [year, year - 1, year - 2];
  const pitching = p.position === "投";
  const cell = (r: RecordLine) =>
    pitching
      ? [
          r.games,
          `${r.wins}勝${r.losses}敗`,
          `${r.saves}S/${r.holds}H`,
          r.outs ? ((r.earned * 27) / r.outs).toFixed(2) : "—",
          `${Math.floor(r.outs / 3)}.${r.outs % 3}`,
          r.k,
        ]
      : [
          r.games,
          rate(r.hits, r.ab),
          r.hr,
          r.rbi,
          r.steals,
          `${r.ab}打数${r.hits}安打`,
        ];
  const hasFarm = years.some((y) => (p.farmReports?.[y]?.games ?? 0) > 0);
  const hasBackfill = years.some((y) => p.reports[y]?.source === "backfill");
  const table = (farm: boolean) => (
    <table
      aria-label={`${p.name}の${farm ? "二軍" : "一軍"}直近3年成績`}
      data-level={farm ? "farm" : "first"}
    >
      <caption>
        {farm ? "二軍成績（参考）" : "一軍成績"} · {year - 2}〜{year}年
      </caption>
      <thead>
        <tr>
          {[
            "年度",
            ...(pitching
              ? ["登板", "勝敗", "S/H", "防御率", "回", "奪三振"]
              : ["試合", "打率", "本", "打点", "盗塁", "打数・安打"]),
          ].map((s) => (
            <th key={s} scope="col">
              {s}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {years.map((y) => {
          const r = farm ? p.farmReports?.[y] : p.reports[y];
          const beforePro =
            p.market === "draft" || y < professionalStartYear(p, w);
          return (
            <tr key={y}>
              <th scope="row">{y}</th>
              {beforePro && !r ? (
                <td colSpan={6}>プロ入り前</td>
              ) : (
                cell(r ?? blankRecord(y, p.team ?? -1)).map((v, i) => (
                  <td key={i}>{v}</td>
                ))
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
  return (
    <div className="recent-results">
      {table(false)}
      {hasFarm && table(true)}
      {(hasFarm || hasBackfill) && (
        <small className="history-note">
          ※過去成績には架空の補完データを含みます。
        </small>
      )}
    </div>
  );
}
