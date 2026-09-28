import { useState } from "react";
import { roster } from "./engine";
import {
  CAMPS,
  POSITIONS,
  SKILLS,
  money,
  type CampPlan,
  type OwnerAction,
  type Skill,
  type WorldState,
} from "./model";
import { GradeMark } from "./AbilityBadge";

export function CampPanel({
  w,
  act,
}: {
  w: WorldState;
  act: (a: OwnerAction) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const plan = w.campPlan,
    players = roster(w),
    location = plan.location ?? 0;
  const cost =
    CAMPS[location].cost + plan.budget + (plan.legend === "none" ? 0 : 4000);
  const update = (next: CampPlan) => act({ type: "campPlan", plan: next });
  const report = w.campReport?.phase === w.phase ? w.campReport : undefined;
  if (w.campDone) {
    const rows = [...(report?.players ?? [])].sort(
      (a, b) =>
        Number(b.special) - Number(a.special) ||
        b.changes.reduce((s, c) => s + c.after - c.before, 0) -
          a.changes.reduce((s, c) => s + c.after - c.before, 0),
    );
    const changed = rows.filter(
      (r) =>
        r.changes.length ||
        r.pitches.length ||
        r.positionBefore !== r.positionAfter,
    );
    return (
      <section className="camp-results" aria-label="キャンプ結果">
        {report ? (
          <>
            <div className="camp-result-summary">
              <b>
                変化あり {changed.length}人 / 対象 {rows.length}人
              </b>
              <span>
                {CAMPS[report.location].name} · 費用 {money(report.cost)}
              </span>
            </div>
            <p className="muted">
              集中指導選手を先に表示しています。数字は実施前 → 実施後です。
            </p>
            <div className="camp-result-list">
              {(showAll ? rows : rows.slice(0, 8)).map((r) => (
                <article key={r.id} data-player-id={r.id}>
                  <h3>
                    {r.name}{" "}
                    <small>{r.special ? "集中指導" : "全体練習"}</small>
                  </h3>
                  {r.changes.map((c) => (
                    <div className="camp-change" key={c.skill}>
                      <span>{SKILLS[c.skill]}</span>
                      <span>
                        <GradeMark value={c.before} /> {c.before}
                      </span>
                      <span>→</span>
                      <span>
                        <GradeMark value={c.after} /> {c.after}
                      </span>
                      <b
                        className={
                          c.after >= c.before
                            ? "positive-text"
                            : "negative-text"
                        }
                      >
                        {c.after >= c.before ? "+" : ""}
                        {c.after - c.before}
                      </b>
                    </div>
                  ))}
                  {r.pitches.map((p) => (
                    <p className="camp-pitch-change" key={p.name}>
                      {p.name}：{p.before === 0 ? "未習得" : p.before} →{" "}
                      {p.after}{" "}
                      <b className="positive-text">
                        {p.before === 0
                          ? "新球種習得"
                          : `+${p.after - p.before}`}
                      </b>
                    </p>
                  ))}
                  {r.positionBefore !== r.positionAfter && (
                    <p>
                      守備位置：{r.positionBefore} → {r.positionAfter}
                    </p>
                  )}
                  {!r.changes.length &&
                    !r.pitches.length &&
                    r.positionBefore === r.positionAfter && (
                      <p className="muted">能力の変化なし（成長上限など）</p>
                    )}
                </article>
              ))}
            </div>
            {rows.length > 8 && (
              <button onClick={() => setShowAll(!showAll)}>
                {showAll ? "表示を8人に戻す" : `全${rows.length}人の結果を表示`}
              </button>
            )}
          </>
        ) : (
          <p>
            この旧セーブには実施前の比較記録がありません。選手詳細の成長履歴で確認できます。次回から実施前後を記録します。
          </p>
        )}
      </section>
    );
  }
  const setSpecial = (
    index: number,
    patch: Partial<CampPlan["special"][number]>,
  ) => {
    const next = structuredClone(plan.special);
    const entry = {
      ...(next[index] ?? { id: "", kind: "breakout" as const }),
      ...patch,
    };
    const p = players.find((p) => p.id === entry.id);
    if (
      (entry.kind === "pitch" && p?.position !== "投") ||
      (entry.kind === "convert" && p?.position === "投")
    )
      entry.kind = "breakout";
    if (entry.kind === "pitch") entry.pitch ??= "シュート";
    if (entry.kind === "convert") entry.position ??= "左";
    if (entry.id) {
      if (index < next.length) next[index] = entry;
      else next.push(entry);
    } else next.splice(index, 1);
    update({ ...plan, special: next });
  };
  return (
    <section className="camp-planner" aria-label="キャンプ計画">
      <p className="decision-caption">
        開催地と育成方針を選択 · 変更は自動保存
      </p>
      <section className="camp-step">
        <h3>1. 開催地と予算を選ぶ</h3>
        <label className="field">
          開催地
          <select
            aria-label="キャンプ開催地"
            value={location}
            onChange={(e) =>
              update({ ...plan, location: Number(e.target.value) })
            }
          >
            {CAMPS.map((c, i) => (
              <option key={c.name} value={i}>
                {c.name} / {money(c.cost)}
              </option>
            ))}
          </select>
          <small>{CAMPS[location].note}</small>
        </label>
        <label className="field">
          追加練習予算
          <select
            aria-label="追加練習予算"
            value={plan.budget}
            onChange={(e) =>
              update({ ...plan, budget: Number(e.target.value) })
            }
          >
            {[0, 2500, 6000, 10000].map((n) => (
              <option key={n} value={n}>
                {money(n)}
              </option>
            ))}
          </select>
        </label>
      </section>
      <section className="camp-step">
        <h3>2. チーム全体の重点練習を選ぶ ({plan.focuses.length}/2)</h3>
        <p>最大2種類。1種類なら集中して伸ばし、2種類なら幅広く育成します。</p>
        <div className="focus-options">
          {Object.entries(SKILLS).map(([key, label]) => {
            const skill = key as Skill,
              selected = plan.focuses.includes(skill);
            return (
              <button
                key={key}
                aria-pressed={selected}
                className={selected ? "selected" : ""}
                disabled={
                  (selected && plan.focuses.length === 1) ||
                  (!selected && plan.focuses.length === 2)
                }
                onClick={() =>
                  update({
                    ...plan,
                    focuses: selected
                      ? plan.focuses.filter((s) => s !== skill)
                      : [...plan.focuses, skill],
                  })
                }
              >
                {selected ? "✓ " : ""}
                {label}
              </button>
            );
          })}
        </div>
      </section>
      <details className="camp-step camp-special-details">
        <summary>集中指導・OB招聘（任意） · {plan.special.length}/5人</summary>
        <p>
          上の枠から選手と指導内容を選ぶだけです。「指定しない」に戻すと解除できます。
        </p>
        <button
          onClick={() =>
            update({
              ...plan,
              special: players
                .filter(
                  (p) =>
                    p.age <= 27 &&
                    plan.focuses.some((s) =>
                      ["control", "stamina"].includes(s)
                        ? p.position === "投"
                        : p.position !== "投",
                    ),
                )
                .sort((a, b) => b.potential - a.potential)
                .slice(0, 5)
                .map((p) => ({ id: p.id, kind: "breakout" })),
            })
          }
        >
          若手5人を自動で選ぶ
        </button>
        <div className="camp-special-slots">
          {Array.from({ length: 5 }, (_, i) => {
            const entry = plan.special[i],
              p = players.find((p) => p.id === entry?.id);
            return (
              <article key={i}>
                <h4>集中指導 {i + 1}</h4>
                <label className="field">
                  選手
                  <select
                    aria-label={`集中指導${i + 1}の選手`}
                    disabled={i > plan.special.length}
                    value={entry?.id ?? ""}
                    onChange={(e) => setSpecial(i, { id: e.target.value })}
                  >
                    <option value="">指定しない</option>
                    {players
                      .filter(
                        (p) =>
                          p.id === entry?.id ||
                          !plan.special.some((s) => s.id === p.id),
                      )
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.position} {p.name} / {p.age}歳
                        </option>
                      ))}
                  </select>
                </label>
                {entry && (
                  <>
                    <label className="field">
                      指導内容
                      <select
                        aria-label={`集中指導${i + 1}の内容`}
                        value={entry.kind}
                        onChange={(e) =>
                          setSpecial(i, {
                            kind: e.target.value as typeof entry.kind,
                          })
                        }
                      >
                        <option value="breakout">
                          ブレイク育成（成長 ×1.8）
                        </option>
                        {p?.position === "投" ? (
                          <option value="pitch">新球種習得・強化</option>
                        ) : (
                          <option value="convert">守備位置コンバート</option>
                        )}
                      </select>
                    </label>
                    {entry.kind === "pitch" && (
                      <label className="field">
                        球種
                        <select
                          aria-label={`集中指導${i + 1}の球種`}
                          value={entry.pitch ?? "シュート"}
                          onChange={(e) =>
                            setSpecial(i, { pitch: e.target.value })
                          }
                        >
                          {[
                            "シュート",
                            "フォーク",
                            "カーブ",
                            "スライダー",
                            "チェンジアップ",
                          ].map((name) => (
                            <option key={name}>{name}</option>
                          ))}
                        </select>
                      </label>
                    )}
                    {entry.kind === "convert" && (
                      <label className="field">
                        新しい守備位置
                        <select
                          aria-label={`集中指導${i + 1}の守備位置`}
                          value={entry.position ?? "左"}
                          onChange={(e) =>
                            setSpecial(i, {
                              position: e.target.value as typeof entry.position,
                            })
                          }
                        >
                          {POSITIONS.slice(1).map((pos) => (
                            <option key={pos}>{pos}</option>
                          ))}
                        </select>
                        <small>守備力−5から新しい位置に適応します。</small>
                      </label>
                    )}
                  </>
                )}
              </article>
            );
          })}
        </div>
        <label className="field">
          臨時OBコーチ・任意
          <select
            aria-label="臨時OBコーチ"
            value={plan.legend}
            onChange={(e) =>
              update({ ...plan, legend: e.target.value as CampPlan["legend"] })
            }
          >
            <option value="none">招聘なし</option>
            <option value="batting">打撃の名猫（野手 ×1.6 / 4,000万円）</option>
            <option value="pitching">
              伝説のエース（投手 ×1.6 / 4,000万円）
            </option>
            <option value="defense">
              守備の職人（守備など ×1.6 / 4,000万円）
            </option>
          </select>
        </label>
      </details>
      <section className="camp-execution">
        <h3>この内容で実施</h3>
        <p>
          {CAMPS[location].name} / 重点：
          {plan.focuses.map((s) => SKILLS[s]).join("・")} / 集中指導{" "}
          {plan.special.length}人
        </p>
        <div className="budget-preview">
          <span>開催費＋追加予算＋OBの合計</span>
          <strong>{money(cost)}</strong>
        </div>
        <button
          className="primary"
          onClick={() =>
            act({ type: "camp", location, focus: plan.focuses[0] })
          }
        >
          この内容でキャンプを実施
        </button>
      </section>
    </section>
  );
}
