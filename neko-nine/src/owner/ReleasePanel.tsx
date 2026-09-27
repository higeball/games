import { useState } from "react";
import { roster } from "./engine";
import {
  CAT_BREEDS,
  DOG_BREEDS,
  POSITIONS,
  SKILLS,
  money,
  type Player,
  type OwnerAction,
  type WorldState,
  type RecordLine,
} from "./model";
import { seniorRoster } from "./operations";
import { AnimalPortrait } from "./AnimalPortrait";
import { AbilityBadge, GradeMark } from "./AbilityBadge";
import { releaseCandidates, releaseReasons, isCorePlayer } from "./release";

const rate = (n: number, d: number, digits = 3) =>
  d ? (n / d).toFixed(digits).replace(/^0\./, ".") : "—";
function RecentResults({ p, year }: { p: Player; year: number }) {
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
        <caption>直近3年の成績</caption>
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
            const r = p.reports[y];
            return (
              <tr key={y}>
                <th scope="row">
                  {y}
                  {r?.source === "backfill" && (
                    <small className="history-backfill">補完</small>
                  )}
                </th>
                {r ? (
                  cell(r).map((v, i) => <td key={i}>{v}</td>)
                ) : (
                  <td colSpan={6}>記録なし（未記録／プロ入り前）</td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
export function ReleasePanel({
  w,
  act,
}: {
  w: WorldState;
  act: (a: OwnerAction) => void;
}) {
  const [mode, setMode] = useState("戦力外"),
    [excludeYoung, setYoung] = useState(true),
    [excludeCore, setCore] = useState(true),
    [position, setPosition] = useState("全守備"),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(0);
  const list = releaseCandidates(w, {
    excludeYoung,
    excludeCore,
    mode,
    position,
    search,
  });
  const pages = Math.max(1, Math.ceil(list.length / 10)),
    current = Math.min(page, pages - 1);
  const changeFilter = (change: () => void) => {
    change();
    setPage(0);
  };
  return (
    <section className="release-panel" aria-label="戦力外候補の選択">
      <h2>戦力外候補を比較する</h2>
      <p>
        現在の空き枠は<strong>{70 - seniorRoster(w).length}人</strong>
        。候補は出場機会・年齢・戦力評価から並べています。自動的に通告はしません。
      </p>
      <div className="release-filters">
        <label>
          <input
            type="checkbox"
            checked={excludeYoung}
            onChange={(e) => changeFilter(() => setYoung(e.target.checked))}
          />
          3年目までの選手を除外
        </label>
        <label>
          <input
            type="checkbox"
            checked={excludeCore}
            onChange={(e) => changeFilter(() => setCore(e.target.checked))}
          />
          主力選手を除外
        </label>
        <small>
          主力の目安：野手60試合／180打席、投手10先発／30登板／10セーブ／10ホールド。除外を解除すれば主力も選べます。
        </small>
        <div className="filters">
          <input
            aria-label="戦力外候補を検索"
            placeholder="名前・特殊能力で検索"
            value={search}
            onChange={(e) => changeFilter(() => setSearch(e.target.value))}
          />
          <select
            aria-label="戦力外候補の守備位置"
            value={position}
            onChange={(e) => changeFilter(() => setPosition(e.target.value))}
          >
            <option>全守備</option>
            {POSITIONS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="segmented">
        {["戦力外", "育成打診"].map((v) => (
          <button
            key={v}
            className={mode === v ? "selected" : ""}
            onClick={() => changeFilter(() => setMode(v))}
          >
            {v}
          </button>
        ))}
      </div>
      <p className="muted">
        表示 {list.length}人 / 所属 {roster(w).length}人 ·
        来季の契約が残る選手は通告不可。育成打診は拒否されると退団します。
      </p>
      <div className="release-candidates">
        {list.slice(current * 10, current * 10 + 10).map((p) => {
          const locked = p.contractYear > w.year;
          const depth = roster(w).filter(
            (x) =>
              x.registration === "senior" &&
              x.position === p.position &&
              x.id !== p.id,
          ).length;
          const skills =
            p.position === "投"
              ? (["control", "stamina", "fielding"] as const)
              : ([
                  "contact",
                  "power",
                  "speed",
                  "arm",
                  "fielding",
                  "catching",
                ] as const);
          return (
            <article
              className="release-candidate"
              key={p.id}
              data-player-id={p.id}
              data-pro={p.pro}
              data-core={isCorePlayer(p, w.year)}
            >
              <div className="candidate-heading">
                <AnimalPortrait p={p} />
                <div>
                  <h3>{p.name}</h3>
                  <p>
                    {p.position} /{" "}
                    {(p.species === "cat" ? CAT_BREEDS : DOG_BREEDS)[p.breed]} /{" "}
                    {p.age}歳 / プロ{Math.max(1, p.pro)}年目
                  </p>
                  <p>
                    {p.throws}投{p.bats}打 ·{" "}
                    {p.registration === "development"
                      ? "育成"
                      : p.species === "dog"
                        ? "外国人・支配下"
                        : "支配下"}{" "}
                    {isCorePlayer(p, w.year) && (
                      <span className="core-badge">主力</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="candidate-contract">
                <span>
                  年俸 <b>{money(p.salary)}</b>
                </span>
                <span>
                  契約 <b>{p.contractYear}年まで</b>
                </span>
                <span>
                  同守備の支配下 <b>他{depth}人</b>
                </span>
                <span>
                  成長期待 <GradeMark value={p.potential} /> / ピーク目安{" "}
                  <b>{p.peak}歳</b>
                </span>
              </div>
              <div className="candidate-skills">
                {skills.map((k) => (
                  <AbilityBadge key={k} label={SKILLS[k]} low={p.skills[k]} />
                ))}
              </div>
              <p className="candidate-trait">
                {p.position === "投"
                  ? `球速${p.velocity}km/h · `
                  : `弾道${p.trajectory} · `}
                {p.trait} ·{" "}
                {p.injured > 0 ? `故障あと${p.injured}日` : "故障なし"}
                {p.position === "投" &&
                  ` · ${p.pitches.map((x) => `${x.name}${x.level}`).join(" / ")}`}
              </p>
              <RecentResults p={p} year={w.year} />
              <p className="candidate-reasons">
                判断材料：{releaseReasons(p, w.year).join(" / ")}
              </p>
              {locked && (
                <p className="warning">
                  来季以降の契約が残るため、通告・育成打診はできません。
                </p>
              )}
              {!locked &&
                depth <
                  (p.position === "投" ? 10 : p.position === "捕" ? 2 : 1) &&
                p.registration === "senior" && (
                  <p className="warning">
                    この選手を外すと守備位置の人数が不足します。別の選手の獲得・昇格・コンバートが必要です。
                  </p>
                )}
              <button
                className="candidate-action"
                disabled={locked}
                aria-label={`${p.name}に${mode === "戦力外" ? "戦力外通告" : "育成契約を打診"}`}
                onClick={() => {
                  const warning = isCorePlayer(p, w.year)
                    ? "主力選手です。退団は戦力やファン評価に影響します。\n"
                    : "";
                  if (
                    confirm(
                      `${warning}${p.name}に${mode === "戦力外" ? "戦力外通告" : "育成打診（拒否時は退団）"}しますか？`,
                    )
                  )
                    act({
                      type: mode === "戦力外" ? "release" : "development",
                      id: p.id,
                    });
                }}
              >
                {locked
                  ? "契約継続中"
                  : mode === "戦力外"
                    ? "この選手に戦力外通告"
                    : "この選手に育成契約を打診"}
              </button>
            </article>
          );
        })}
      </div>
      {!list.length && (
        <p className="empty">
          条件に合う候補はいません。除外チェックや守備位置を見直してください。
        </p>
      )}
      {pages > 1 && (
        <div className="pagination">
          <button disabled={current === 0} onClick={() => setPage(current - 1)}>
            前の候補
          </button>
          <span>
            {current + 1} / {pages}
          </span>
          <button
            disabled={current === pages - 1}
            onClick={() => setPage(current + 1)}
          >
            次の候補
          </button>
        </div>
      )}
      <p className="muted">
        通告は必須ではありません。必要な枠が確保できていれば次のイベントへ進めます。
      </p>
      {w.news
        .filter(
          (n) =>
            n.year === w.year && /戦力外通告|育成契約|育成打診/.test(n.title),
        )
        .slice(0, 4)
        .map((n) => (
          <p className="notice" key={n.id}>
            {n.title}：{n.body}
          </p>
        ))}
    </section>
  );
}
