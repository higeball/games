import { completedSeasonYear, professionalStartYear } from "./history";
import type { Player, RecordLine, WorldState } from "./model";

const rate = (n: number, d: number) =>
  d ? (n / d).toFixed(3).replace(/^0\./, ".") : "—";

/** One shared three-season view for the encyclopedia, releases and player details. */
export function RecentResults({ p, w }: { p: Player; w: WorldState }) {
  const year = completedSeasonYear(w);
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
  return (
    <div className="recent-results">
      <table aria-label={`${p.name}の直近3年成績`}>
        <caption>
          直近3年の成績（{year - 2}〜{year}年）
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
          {[year, year - 1, year - 2].map((y) => {
            const first = p.reports[y];
            const farm = !first?.games ? p.farmReports?.[y] : undefined;
            const r = farm ?? first;
            const beforePro =
              p.market === "draft" || y < professionalStartYear(p, w);
            return (
              <tr key={y}>
                <th scope="row">
                  {y}
                  {farm && (
                    <small className="history-backfill">
                      二軍参考（一軍0）
                    </small>
                  )}
                  {r?.source === "backfill" && (
                    <small className="history-backfill">補完</small>
                  )}
                  {r && !r.games && (
                    <small className="history-backfill">一軍出場なし</small>
                  )}
                </th>
                {r ? (
                  cell(r).map((v, i) => <td key={i}>{v}</td>)
                ) : (
                  <td colSpan={6}>
                    {beforePro ? "プロ入り前" : "一軍出場なし"}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {Object.values(p.reports).some(
        (r) => r.year >= year - 2 && r.year <= year && r.source === "backfill",
      ) && (
        <small className="history-note">
          補完データ：架空の参考成績。プレイ済み成績は変更しません。
        </small>
      )}
      {Object.values(p.farmReports ?? {}).some(
        (r) => r.year >= year - 2 && r.year <= year,
      ) && (
        <small className="history-note">
          一軍出場0の年度は二軍参考成績（架空の補完データ）を表示。一軍成績は0試合／0登板です。
        </small>
      )}
    </div>
  );
}
