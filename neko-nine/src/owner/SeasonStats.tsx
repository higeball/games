import { useState } from "react";
import {
  blankRecord,
  type WorldState,
  type SeasonReview,
  type RecordLine,
} from "./model";

export const battingAverage = (r: RecordLine) =>
  r.ab ? (r.hits / r.ab).toFixed(3).replace(/^0/, "") : "—";
export const earnedRunAverage = (r: RecordLine) =>
  r.outs ? ((r.earned * 27) / r.outs).toFixed(2) : "—";

export function SeasonStats({
  w,
  open,
  league = "パ",
  review,
  ownOnly = false,
}: {
  w: WorldState;
  open: (id: string) => void;
  league?: "パ" | "セ";
  review?: SeasonReview;
  ownOnly?: boolean;
}) {
  const [kind, setKind] = useState("打者"),
    [scope, setScope] = useState("自球団"),
    [batSort, setBatSort] = useState("hr"),
    [pitchSort, setPitchSort] = useState("wins");
  const own = ownOnly || (scope === "自球団" && league === "パ");
  const rows = review
    ? review.players.map((p) => ({
        id: p.id,
        name: p.name,
        position: p.after.position,
        record: p.record,
      }))
    : w.players.flatMap((p) => {
        const r = p.reports[w.year];
        if (
          own
            ? p.team !== 0 && !(r?.team === 0 && r.source !== "backfill")
            : !r ||
              !r.games ||
              r.source === "backfill" ||
              w.teams[r.team]?.league !== league
        )
          return [];
        return [
          {
            id: p.id,
            name: p.name,
            position: p.position,
            record:
              r && r.source !== "backfill"
                ? r
                : blankRecord(w.year, p.team ?? 0),
          },
        ];
      });
  const sort = kind === "投手" ? pitchSort : batSort;
  const value = (r: RecordLine) =>
    sort === "avg"
      ? r.ab
        ? r.hits / r.ab
        : -1
      : sort === "era"
        ? r.outs
          ? -((r.earned * 27) / r.outs)
          : -999
        : (r[sort as keyof RecordLine] as number);
  const list = rows
    .filter((p) => (p.position === "投") === (kind === "投手"))
    .sort(
      (a, b) =>
        value(b.record) - value(a.record) ||
        b.record.games - a.record.games ||
        a.id.localeCompare(b.id),
    );
  return (
    <section className="season-stats" aria-label="選手のシーズン成績">
      <div className="stats-controls">
        {!ownOnly && league === "パ" && (
          <label>
            表示範囲
            <select
              aria-label="成績の表示範囲"
              value={scope}
              onChange={(e) => setScope(e.target.value)}
            >
              <option>自球団</option>
              <option>リーグ全体</option>
            </select>
          </label>
        )}
        <label>
          選手区分
          <select
            aria-label="成績の選手区分"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option>打者</option>
            <option>投手</option>
          </select>
        </label>
        <label>
          並び順
          <select
            aria-label="成績の並び順"
            value={sort}
            onChange={(e) =>
              kind === "投手"
                ? setPitchSort(e.target.value)
                : setBatSort(e.target.value)
            }
          >
            {Object.entries(
              kind === "投手"
                ? {
                    wins: "勝利",
                    era: "防御率",
                    saves: "セーブ",
                    holds: "ホールド",
                    outs: "投球回",
                    k: "奪三振",
                  }
                : {
                    hr: "本塁打",
                    avg: "打率",
                    rbi: "打点",
                    hits: "安打",
                    steals: "盗塁",
                    games: "試合",
                  },
            ).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="muted">
        {own ? "自球団の全選手" : "リーグの出場選手"} · {list.length}人 ／
        自球団は「福岡」ラベルで表示。表は横にスクロールできます。
      </p>
      <div
        className="season-table-scroll"
        tabIndex={0}
        aria-label="成績表を横スクロール"
      >
        <table className="season-stat-table">
          <caption>
            {review?.year ?? w.year}年 {kind}成績
          </caption>
          <thead>
            <tr>
              <th scope="col">選手</th>
              {(kind === "投手"
                ? ["登板", "勝", "敗", "S", "H", "防御率", "投球回", "奪三振"]
                : ["試合", "打率", "本塁打", "打点", "安打", "盗塁", "打席"]
              ).map((label) => (
                <th key={label} scope="col">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((p) => {
              const r = p.record,
                ours = r.team === 0;
              return (
                <tr
                  key={p.id}
                  className={ours ? "our-player" : ""}
                  data-player-id={p.id}
                >
                  <th scope="row">
                    <button onClick={() => open(p.id)}>{p.name}</button>
                    <small>
                      {ours ? (
                        <span className="our-player-label">福岡</span>
                      ) : (
                        w.teams[r.team]?.short
                      )}{" "}
                      · {p.position}
                    </small>
                  </th>
                  {(kind === "投手"
                    ? [
                        r.games,
                        r.wins,
                        r.losses,
                        r.saves,
                        r.holds,
                        earnedRunAverage(r),
                        `${Math.floor(r.outs / 3)}.${r.outs % 3}`,
                        r.k,
                      ]
                    : [
                        r.games,
                        battingAverage(r),
                        r.hr,
                        r.rbi,
                        r.hits,
                        r.steals,
                        r.pa,
                      ]
                  ).map((value, i) => (
                    <td key={i}>{value}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!list.length && <p>対象の成績はまだありません。</p>}
    </section>
  );
}
