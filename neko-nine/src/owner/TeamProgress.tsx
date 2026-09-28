import { roster } from "./engine";
import { teamStrength } from "./operations";
import { GradeMark } from "./AbilityBadge";
import { AnimalPortrait } from "./AnimalPortrait";
import type { WorldState } from "./model";

export function TeamProgress({
  w,
  compact = false,
}: {
  w: WorldState;
  compact?: boolean;
}) {
  const strength = teamStrength(w),
    base = w.strengthBaseline;
  const newcomers = base
    ? roster(w).filter((p) => !base.players.some((b) => b.id === p.id))
    : [];
  const departed =
    base?.players.filter(
      (p) => !roster(w).some((current) => current.id === p.id),
    ) ?? [];
  const currentScore =
    strength.reduce((n, s) => n + s.score, 0) / strength.length;
  const beforeScore = base
    ? base.scores.reduce((n, s) => n + s.score, 0) / base.scores.length
    : currentScore;
  const delta = currentScore - beforeScore;
  return (
    <section
      className={`team-progress${compact ? " compact" : ""}`}
      aria-label="チーム戦力の変化"
    >
      <div className="section-title">
        <h2>{compact ? "補強ポイント" : "チームはどう変わった？"}</h2>
        <small>{base?.label ?? "現在の戦力"}との比較</small>
      </div>
      <div className="team-score">
        <span>総合戦力</span>
        <GradeMark value={currentScore} />
        <strong>{currentScore.toFixed(1)}</strong>
        <b className={delta >= 0 ? "positive-text" : "negative-text"}>
          {delta >= 0 ? "+" : ""}
          {delta.toFixed(1)}
        </b>
      </div>
      <div className="progress-strength-rows">
        {strength.map((s) => {
          const old =
            base?.scores.find((b) => b.name === s.name)?.score ?? s.score;
          const change = s.score - old;
          return (
            <div key={s.name}>
              <span>{s.name}</span>
              <div className="comparison-track">
                <i style={{ width: `${s.score}%` }} />
                <em style={{ left: `${old}%` }} />
              </div>
              <GradeMark value={s.score} />
              <b className={change >= 0 ? "positive-text" : "negative-text"}>
                {change >= 0 ? "+" : ""}
                {change.toFixed(1)}
              </b>
            </div>
          );
        })}
      </div>
      <p className="muted">
        目盛り＝比較開始時 / バー＝現在。支配下の上位戦力を評価。
      </p>
      {!compact && (
        <>
          <div className="result-counts">
            <span>
              加入 <b>{newcomers.length}人</b>
            </span>
            <span>
              退団 <b>{departed.length}人</b>
            </span>
            <span>
              重点補強{" "}
              <b>
                {strength
                  .filter((s) => s.urgent)
                  .map((s) => s.name)
                  .join("・") || "大きな穴なし"}
              </b>
            </span>
          </div>
          {newcomers.length > 0 && (
            <>
              <h3>新しく加わった戦力</h3>
              <div className="newcomer-list">
                {newcomers.map((p) => (
                  <div key={p.id}>
                    <AnimalPortrait p={p} />
                    <span>
                      <b>{p.name}</b>
                      <small>
                        {p.position} / {p.age}歳
                      </small>
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
          {w.campReport && (
            <p className="result-note">
              直近のキャンプ：
              {
                w.campReport.players.filter(
                  (p) =>
                    p.changes.some((c) => c.after > c.before) ||
                    p.pitches.length,
                ).length
              }
              人が成長・球種習得
            </p>
          )}
        </>
      )}
    </section>
  );
}
