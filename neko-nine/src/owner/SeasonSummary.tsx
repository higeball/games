import { useState } from "react";
import { SKILLS, money, type Skill, type WorldState } from "./model";
import { standings } from "./engine";
import { teamStrength } from "./operations";
import { recordSeasonReview } from "./development";
import { GradeMark } from "./AbilityBadge";
import { SeasonStats } from "./SeasonStats";

export function SeasonSummary({
  w,
  open,
}: {
  w: WorldState;
  open: (id: string) => void;
}) {
  const [all, setAll] = useState(false);
  let report = w.seasonReview?.year === w.year ? w.seasonReview : undefined;
  if (!report) {
    const copy = { ...w };
    recordSeasonReview(
      copy,
      standings(w, "パ").findIndex((t) => t.id === 0) + 1,
    );
    report = copy.seasonReview!;
  }
  const t = report.team;
  const players = report.players.map((p) => ({
    ...p,
    changes: p.before
      ? (Object.keys(SKILLS) as Skill[]).filter(
          (key) => p.before!.skills[key] !== p.after.skills[key],
        )
      : [],
    pitchChanges: p.before
      ? p.after.pitches.filter(
          (pitch) =>
            p.before!.pitches.find((old) => old.name === pitch.name)?.level !==
            pitch.level,
        )
      : [],
  }));
  const changed = players
    .filter(
      (p) =>
        p.changes.length ||
        p.pitchChanges.length ||
        (p.before &&
          (p.before.velocity !== p.after.velocity ||
            p.before.position !== p.after.position)),
    )
    .sort(
      (a, b) =>
        b.changes.reduce(
          (n, k) => n + Math.abs(b.after.skills[k] - b.before!.skills[k]),
          0,
        ) -
        a.changes.reduce(
          (n, k) => n + Math.abs(a.after.skills[k] - a.before!.skills[k]),
          0,
        ),
    );
  const weak = teamStrength(w)
    .sort((a, b) => a.score - b.score)
    .slice(0, 2);
  return (
    <section className="season-summary" aria-label="年間の総括">
      <h1>{report.year}年 レギュラーシーズン総括</h1>
      <div className="season-summary-score">
        <strong>パ・リーグ {report.rank}位</strong>
        <span>
          {t.wins}勝 {t.losses}敗 {t.draws}分
        </span>
        <span>
          勝率{" "}
          {t.wins + t.losses ? (t.wins / (t.wins + t.losses)).toFixed(3) : "—"}
        </span>
        <span>
          得点 {t.scored} ／ 失点 {t.conceded} ／ 得失点差{" "}
          {t.scored - t.conceded > 0 ? "+" : ""}
          {t.scored - t.conceded}
        </span>
      </div>
      <p className="decision-caption">
        {report.rank <= 3
          ? "CS出場圏内。短期決戦と来季の補強に備えましょう。"
          : "CS出場圏外。今季の課題を来季の編成に生かしましょう。"}
      </p>
      <div className="summary-finance">
        <span>収入 {money(report.finance.income)}</span>
        <span>支出 {money(report.finance.expense)}</span>
        <b>収支 {money(report.finance.income - report.finance.expense)}</b>
        <span>観客 {report.finance.attendance.toLocaleString()}人</span>
      </div>
      <small>
        レギュラーシーズン終了時点。融資・返済は収支から除外。CS・日本シリーズの結果と収入は後日確定します。
      </small>
      <h2>来季に向けた補強ポイント</h2>
      <p>
        戦力評価が低いポジション：
        {weak.map((s) => `${s.name}（${Math.round(s.score)}）`).join("、")}
        。主力の年齢・成績と能力変化を確認してください。
      </p>
      <h2>自球団の年間成績</h2>
      <SeasonStats w={w} open={open} review={report} ownOnly />
      <h2>一年間の能力変化</h2>
      <p>
        {report.comparisonLabel} → {report.year}年シーズン終了時
      </p>
      <p>
        変化あり {changed.length}人 ／ 比較記録なし{" "}
        {players.filter((p) => !p.before).length}人
      </p>
      {!changed.length && (
        <p className="muted">
          比較可能な能力変化はありません。記録のない期間の成長値は推測しません。
        </p>
      )}
      <div className="annual-growth-list">
        {(all ? changed : changed.slice(0, 8)).map((p) => (
          <article key={p.id}>
            <h3>
              <button onClick={() => open(p.id)}>{p.name}</button>{" "}
              <small>
                {p.age}歳 · {p.after.position}
              </small>
            </h3>
            {p.changes.map((key) => (
              <div className="camp-change" key={key}>
                <span>{SKILLS[key]}</span>
                <span>
                  <GradeMark value={p.before!.skills[key]} />{" "}
                  {p.before!.skills[key]}
                </span>
                <span>→</span>
                <span>
                  <GradeMark value={p.after.skills[key]} />{" "}
                  {p.after.skills[key]}
                </span>
                <b
                  className={
                    p.after.skills[key] > p.before!.skills[key]
                      ? "positive-text"
                      : "negative-text"
                  }
                >
                  {p.after.skills[key] > p.before!.skills[key] ? "+" : ""}
                  {p.after.skills[key] - p.before!.skills[key]}
                </b>
              </div>
            ))}
            {p.before!.velocity !== p.after.velocity && (
              <p>
                球速 {p.before!.velocity} → {p.after.velocity}km/h
              </p>
            )}
            {p.pitchChanges.map((pitch) => (
              <p key={pitch.name}>
                {pitch.name}{" "}
                {p.before!.pitches.find((old) => old.name === pitch.name)
                  ?.level ?? "未習得"}{" "}
                → {pitch.level}
              </p>
            ))}
            {p.before!.position !== p.after.position && (
              <p>
                守備位置 {p.before!.position} → {p.after.position}
              </p>
            )}
          </article>
        ))}
      </div>
      {changed.length > 8 && (
        <button onClick={() => setAll(!all)}>
          {all ? "8人に戻す" : `全${changed.length}人の変化を見る`}
        </button>
      )}
    </section>
  );
}
