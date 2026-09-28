import { useEffect, useRef, useState } from "react";
import { roster, standings, estimate } from "./engine";
import {
  seniorRoster,
  projectedPayroll,
  phaseBlockers,
  teamStrength,
  protectionCandidates,
} from "./operations";
import {
  CAMPS,
  CLUBS,
  PHASE_FLOW,
  PHASE_NAMES,
  PHASE_DATES,
  SKILLS,
  POSITIONS,
  STAFF_ROLES,
  grade,
  money,
  type WorldState,
  type OwnerAction,
  type Player,
  type Skill,
  type CampPlan,
} from "./model";
import { PlayerList, StaffCard, Annual } from "./OwnerApp";
import { YasuPortrait } from "../ui/Sprites";
import { ReleasePanel } from "./ReleasePanel";
import { nextEventLabel } from "./Secretary";
import { AbilityBadge } from "./AbilityBadge";
import { AnimalPortrait } from "./AnimalPortrait";
type Props = {
  w: WorldState;
  act: (a: OwnerAction) => void;
  open: (id: string) => void;
};
export const phaseDate = (w: WorldState) =>
  `${w.year + (["budget", "staff", "spring", "preseason", "registration"].includes(w.phase) ? 1 : 0)}年 ${w.phase === "season" ? `${w.month}月` : PHASE_DATES[w.phase]}`;
export function OwnerStatus({
  w,
  onAdvance,
}: {
  w: WorldState;
  onAdvance?: () => void;
}) {
  const t = w.teams[0],
    f = t.finance,
    n = seniorRoster(w).length;
  const rank = standings(w, "パ").findIndex((t) => t.id === 0) + 1;
  const outcome =
    w.phase === "season"
      ? `${t.wins + t.losses + t.draws}試合消化`
      : w.champion === 0
        ? "日本一"
        : w.finalists.includes(0)
          ? "日本シリーズ敗退"
          : rank <= 3
            ? w.champion !== null
              ? "CS敗退"
              : "CS進出"
            : "CS圏外";
  return (
    <div className="owner-status">
      <div className="status-date">
        <b>{phaseDate(w)}</b>
        <span>{PHASE_NAMES[w.phase]}</span>
      </div>
      <div className="status-resources">
        <div>
          <small>球団資金</small>
          <strong>{money(f.cash)}</strong>
        </div>
        <div>
          <small>想定年俸</small>
          <strong
            className={projectedPayroll(w) > f.salaryBudget ? "negative" : ""}
          >
            {money(projectedPayroll(w))}
          </strong>
        </div>
        <div>
          <small>支配下</small>
          <strong className={n >= 70 ? "negative" : ""}>
            {n}
            <em>/70</em>
          </strong>
        </div>
        <div>
          <small>{w.phase === "season" ? "順位" : "前季順位"}</small>
          <strong title={outcome}>
            {rank}位 <em>({outcome})</em>
          </strong>
        </div>
      </div>
      {w.phase === "release" && onAdvance && (
        <button className="primary status-advance" onClick={onAdvance}>
          第1次戦力外通告を終了しドラフト会議へ進む
        </button>
      )}
    </div>
  );
}
const hints: Record<string, string> = {
  review:
    "シーズンの成績から来季の構想を決めましょう。ドラフト6人と補強2人なら、空き枠は8つ必要です。",
  release:
    "残すベテラン、育てる若手、空ける枠。育成打診は拒否されると退団します。",
  draft:
    "調査度と補強ポイントを確認して指名。1位は競合抽選、2位以降は他球団と順番を争います。",
  autumn: "重点2スロットと集中指導5人まで。予算を使う場所を選びましょう。",
  release2:
    "日本シリーズの結果とFA宣言が公示されました。補強を見据えて最後の枠整理を行います。",
  tryout: "代走・守備固め・左キラー。低年俸の再生候補を探す期間です。",
  activeDraft:
    "出場機会の少ない選手を送り出し、別球団の若手に賭けます。交換なので枠は増えません。",
  contracts:
    "まず一括提示。残った主力には出来高・複数年・起用確約を使って交渉。FA・外国人・トレードもこの期間に。",
  budget:
    "自主トレ期間。施設と集客へ投資し、監督・コーチの来季契約を整えます。",
  spring:
    "新戦力を迎える春。若手のブレイク、コンバート、新球種を集中指導で狙います。",
  preseason: "オープン戦で新戦力の状態を確認。公式戦の成績には含まれません。",
  registration:
    "育成からの支配下昇格と開幕一軍を確定。一軍31人・外国人4人まで。",
  season:
    "試合は監督に委任。月次の戦況を見ながら、来秋の候補へスカウトを派遣しましょう。",
};
export function Dashboard({
  w,
  act,
  go,
}: {
  w: WorldState;
  act: Props["act"];
  go: (tab: "ホーム" | "選手" | "編成" | "経営" | "リーグ") => void;
}) {
  const blockers = phaseBlockers(w),
    strength = teamStrength(w),
    list = roster(w);
  const next =
    w.phase === "season"
      ? undefined
      : PHASE_FLOW[PHASE_FLOW.indexOf(w.phase) + 1];
  const nextInfo =
    w.phase === "season"
      ? `${w.month}月 月間MVP・営業報告`
      : w.phase === "registration"
        ? "4月 レギュラーシーズン開幕"
        : next
          ? `${PHASE_DATES[next]} ${PHASE_NAMES[next]}`
          : "10月 シーズン総括";
  const ageGroups = [
    { name: "25歳以下", count: list.filter((p) => p.age <= 25).length },
    {
      name: "26〜31歳",
      count: list.filter((p) => p.age >= 26 && p.age <= 31).length,
    },
    { name: "32歳以上", count: list.filter((p) => p.age >= 32).length },
  ];
  return (
    <>
      {w.phase !== "review" && (
        <section className="event-card">
          <div className="eyebrow">今のイベント</div>
          <h2>{PHASE_NAMES[w.phase]}</h2>
          <p>{hints[w.phase]}</p>
          {!["review", "season"].includes(w.phase) && (
            <button
              className="primary"
              onClick={() => go(w.phase === "budget" ? "経営" : "編成")}
            >
              今すぐイベントへ進む →
            </button>
          )}
          <button
            className="secondary"
            onClick={() => act({ type: "advance" })}
          >
            {w.phase === "season"
              ? `${w.month}月を進める`
              : next
                ? `${PHASE_NAMES[next]}へ進む`
                : "レギュラーシーズン開幕"}{" "}
            →
          </button>
          {w.phase === "season" && (
            <>
              <button onClick={() => act({ type: "skipSeason" })}>
                残りのシーズンを高速ダイジェスト
              </button>
              <button onClick={() => go("編成")}>
                来秋のドラフト候補を調査
              </button>
            </>
          )}
          <small className="next-event">
            次のイベント：
            {nextInfo}
          </small>
        </section>
      )}
      {w.phase !== "review" && (
        <div className="club-heading">
          <div>
            <small>FUKUOKA / OWNER'S DESK</small>
            <h1>
              福岡から、
              <br />
              次の黄金期へ。
            </h1>
            <p>福岡ソフトにゃんくホークス</p>
          </div>
          <YasuPortrait />
        </div>
      )}
      <section className="strength-panel">
        <div className="section-title">
          <h2>補強ポイント</h2>
          <span>支配下の上位戦力</span>
        </div>
        <div className="strength-chart">
          {strength.map((s) => (
            <div key={s.name}>
              <span>{s.name}</span>
              <div className="strength-track">
                <i style={{ width: `${Math.min(100, s.score)}%` }} />
              </div>
              <b className={s.urgent ? "negative" : ""}>{grade(s.score)}</b>
            </div>
          ))}
        </div>
        <p className="warning">
          {strength
            .filter((s) => s.urgent)
            .map((s) => s.name)
            .join("・") || "目立つ穴はありません"}
          {strength.some((s) => s.urgent)
            ? "に補強の余地。年齢と年俸も見て選びましょう。"
            : "。若返りと控えの厚みを考えましょう。"}
        </p>
        <div className="age-chart">
          {ageGroups.map((g) => (
            <div key={g.name}>
              <span>{g.name}</span>
              <i
                style={{
                  width: `${(g.count / Math.max(1, list.length)) * 100}%`,
                }}
              />
              <b>{g.count}人</b>
            </div>
          ))}
        </div>
      </section>
      {w.phase === "review" && (
        <button
          className="primary review-advance"
          onClick={() => act({ type: "advance" })}
        >
          第1次戦力外通告へ進む →
        </button>
      )}
      {w.phase === "review" && w.archives.at(-1)?.year === w.year && (
        <section className="season-outcome">
          <h2>{w.year}年 ポストシーズン結果</h2>
          <p>
            日本一：<b>{w.teams[w.archives.at(-1)!.champion].name}</b>
          </p>
          <details>
            <summary>CS・日本シリーズの対戦結果</summary>
            {w.seriesLog.map((s, i) => (
              <p key={i}>{s}</p>
            ))}
          </details>
          <Annual w={w} />
        </section>
      )}
      {w.phase !== "review" && (
        <>
          <section className="todo-panel">
            <h2>要対応タスク</h2>
            {blockers.length ? (
              blockers.map((s) => (
                <button key={s} onClick={() => go("編成")}>
                  ! {s} ›
                </button>
              ))
            ) : (
              <p>必須タスクは完了。補強や予算を確認して日程を進められます。</p>
            )}
            {w.phase === "contracts" && (
              <p>
                FA市場 {w.players.filter((p) => p.market === "fa").length}人 ／
                育成
                {list.filter((p) => p.registration === "development").length}人
              </p>
            )}
            {seniorRoster(w).length >= 66 &&
              ["review", "release", "release2"].includes(w.phase) && (
                <p className="warning">
                  空き枠{70 - seniorRoster(w).length}
                  人。6人指名したい場合は、先に枠を空けましょう。
                </p>
              )}
          </section>
          <div className="section-title">
            <h2>オーナー方針</h2>
            <span>起用は監督に委任</span>
          </div>
          <div className="segmented">
            {(["若手育成", "バランス", "勝利優先"] as const).map((value) => (
              <button
                key={value}
                className={w.teams[0].policy === value ? "selected" : ""}
                onClick={() => act({ type: "policy", value })}
              >
                {value}
              </button>
            ))}
          </div>
          {w.archives.at(-1)?.year === w.year && (
            <>
              <section className="season-outcome">
                <h2>{w.year}年 ポストシーズン結果</h2>
                <p>
                  日本一：<b>{w.teams[w.archives.at(-1)!.champion].name}</b>
                </p>
                <details>
                  <summary>CS・日本シリーズの対戦結果</summary>
                  {w.seriesLog.map((s, i) => (
                    <p key={i}>{s}</p>
                  ))}
                </details>
              </section>
              <Annual w={w} />
            </>
          )}
          <button className="wide-select" onClick={() => go("リーグ")}>
            セ・パ順位と個人成績・歴代日本一 ›
          </button>
          <h2>球団ニュース</h2>
          <div className="news-feed">
            {w.news.slice(0, 6).map((n) => (
              <article key={n.id}>
                <small>{n.year} / CLUB REPORT</small>
                <h3>{n.title}</h3>
                <p>{n.body}</p>
              </article>
            ))}
          </div>
        </>
      )}
    </>
  );
}

export function FrontOffice({ w, act, open }: Props) {
  const [view, setView] = useState("イベント");
  if (w.phase === "draft") return <DraftBoard w={w} act={act} open={open} />;
  const releasing =
    view === "イベント" && ["release", "release2"].includes(w.phase);
  const choices = [
    "イベント",
    "ドラフト・調査",
    "FA市場",
    "外国人",
    "トレード",
    "トライアウト",
  ];
  const marketTabs = (
    <div className="market-tabs">
      {choices.map((v) => (
        <button
          key={v}
          className={view === v ? "selected" : ""}
          onClick={() => setView(v)}
        >
          {v}
        </button>
      ))}
    </div>
  );
  return (
    <>
      <div className="eyebrow">BASEBALL OPERATIONS</div>
      <h1>{releasing ? PHASE_NAMES[w.phase] : "編成・補強"}</h1>
      {releasing ? (
        <details className="release-other-menu">
          <summary>他の編成メニューを見る</summary>
          {marketTabs}
        </details>
      ) : (
        marketTabs
      )}
      {!releasing && (
        <div className="phase-heading">
          <span>{PHASE_NAMES[w.phase]}</span>
          <b>支配下 {seniorRoster(w).length}/70</b>
        </div>
      )}
      {!["review", "season", "release"].includes(w.phase) && (
        <div className={`event-progression${releasing ? " compact" : ""}`}>
          <p>
            {phaseBlockers(w).length
              ? `未完了：${phaseBlockers(w).join(" / ")}`
              : "検討・手続きが済んだら、次のイベントへ進めます。"}
          </p>
          <button className="primary" onClick={() => act({ type: "advance" })}>
            {nextEventLabel(w)} →
          </button>
        </div>
      )}
      {view === "ドラフト・調査" ? (
        <DraftBoard w={w} act={act} open={open} />
      ) : view === "FA市場" ? (
        <Market w={w} act={act} open={open} kind="fa" />
      ) : view === "外国人" ? (
        <Market w={w} act={act} open={open} kind="foreign" />
      ) : view === "トレード" ? (
        <TradePanel w={w} act={act} />
      ) : view === "トライアウト" ? (
        <Market w={w} act={act} open={open} kind="tryout" />
      ) : ["release", "release2"].includes(w.phase) ? (
        <ReleasePanel w={w} act={act} />
      ) : ["autumn", "spring"].includes(w.phase) ? (
        <CampPanel w={w} act={act} />
      ) : w.phase === "tryout" ? (
        <Market w={w} act={act} open={open} kind="tryout" />
      ) : w.phase === "activeDraft" ? (
        <ActiveDraft w={w} act={act} />
      ) : w.phase === "contracts" ? (
        <>
          <Contracts w={w} act={act} open={open} />
          {w.compensations.length > 0 && (
            <Protection w={w} act={act} open={open} />
          )}
        </>
      ) : w.phase === "budget" ? (
        <StaffPanel w={w} act={act} />
      ) : w.phase === "preseason" ? (
        <>
          <p>
            12試合の調整を一度に実施します。評価は能力と当日の状態から決まり、公式戦成績には含まれません。
          </p>
          <button
            className="primary"
            disabled={w.preseasonDone}
            onClick={() => act({ type: "preseason" })}
          >
            {w.preseasonDone ? "オープン戦実施済み" : "オープン戦を実施"}
          </button>
          {w.preseasonRecord && (
            <p className="notice">
              オープン戦：{w.preseasonRecord.wins}勝 {w.preseasonRecord.losses}
              敗 {w.preseasonRecord.draws}
              分。調整試合の簡易シミュレーションです。
            </p>
          )}
          <div className="news-feed">
            {w.preseasonReport.slice(0, 10).map((r) => (
              <article key={r.player}>
                <b>{w.players.find((p) => p.id === r.player)?.name}</b>
                <p>
                  状態評価 {r.rating} / {r.note}
                </p>
              </article>
            ))}
          </div>
        </>
      ) : w.phase === "registration" ? (
        <Registration w={w} act={act} open={open} />
      ) : w.phase === "season" ? (
        <DraftBoard w={w} act={act} open={open} />
      ) : (
        <p>{hints[w.phase]} ホームから次のイベントに進めます。</p>
      )}
    </>
  );
}
function DraftBoard({ w, act, open }: Props) {
  const inDraft = w.phase === "draft";
  const pending = inDraft ? w.draftPending : undefined;
  const picking = inDraft && w.draftRound < 6 && !pending,
    scouting = w.phase === "season" || picking;
  const selected = pending && w.players.find((p) => p.id === pending.player);
  const finished = inDraft && w.draftRound >= 6;
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!inDraft) return;
    if (pending || w.draftRound > 0)
      heading.current?.scrollIntoView({ block: "start", behavior: "instant" });
    else window.scrollTo({ top: 0, behavior: "instant" });
  }, [inDraft, pending?.stage, pending?.player, w.draftRound]);
  const pool = w.players.filter(
    (p) => p.market === "draft" && p.draftYear === w.year + 1,
  );
  const [position, setPosition] = useState("全守備");
  const candidates = pool
    .filter((p) => position === "全守備" || p.position === position)
    .slice()
    .sort(
      (a, b) =>
        b.scouting - a.scouting ||
        Number(a.id.slice(1)) - Number(b.id.slice(1)),
    );
  return (
    <>
      <h2 ref={heading} className="draft-heading">
        {finished
          ? "ドラフト指名終了"
          : w.phase === "season"
            ? `${w.year + 1}年ドラフトの事前調査`
            : `ドラフト 第${Math.min(6, w.draftRound + 1)}巡`}
      </h2>
      {inDraft && (
        <ol className="draft-steps" aria-label="ドラフトの進行">
          {["候補を指名", "競合・くじ引き", "結果を確認", "次の巡へ"].map(
            (s, i) => (
              <li
                key={s}
                className={
                  i ===
                  (finished
                    ? 3
                    : pending?.stage === "lottery"
                      ? 1
                      : pending
                        ? 2
                        : 0)
                    ? "current"
                    : ""
                }
              >
                {s}
              </li>
            ),
          )}
        </ol>
      )}
      {!pending && !finished && (
        <p>
          調査度0〜100%。低調査では能力評価に大きな幅が残ります。1位は重複抽選、下位は逆順位を交互に反転。契約金1,000万円・年俸600万円。
        </p>
      )}
      {pending && selected && (
        <section
          className="draft-outcome"
          aria-label={
            pending.stage === "lottery"
              ? "競合指名・抽選待ち"
              : "ドラフト指名結果"
          }
        >
          <div className="draft-selected-player">
            <AnimalPortrait p={selected} />
            <div>
              <small>
                {pending.round}巡目指名 · {selected.position} / {selected.age}歳
              </small>
              <h3>{selected.name}</h3>
            </div>
          </div>
          <p>
            {pending.rivals.length
              ? `${[0, ...pending.rivals].map((id) => w.teams[id].short).join("・")}の${pending.rivals.length + 1}球団が競合指名。`
              : pending.round === 1
                ? "単独指名です。"
                : "指名が確定しました。"}
          </p>
          {pending.stage === "lottery" ? (
            <>
              <h3>交渉権をかけて、くじ引きです。</h3>
              <p>フーミー：ヤスオーナー、くじを引いてください！</p>
              <button
                className="primary"
                onClick={() => act({ type: "drawDraftLottery" })}
              >
                くじを引く
              </button>
            </>
          ) : (
            <>
              <div className="lottery-result" aria-live="polite">
                <strong>
                  {pending.winner === 0 ? "交渉権獲得！" : "抽選落選"}
                </strong>
                <p>{w.teams[pending.winner!].short}が交渉権を獲得しました。</p>
              </div>
              <p>
                {pending.winner === 0
                  ? "契約金1,000万円・年俸600万円で入団。指名結果を確認したら次へ進みましょう。"
                  : "まだ1巡目の指名は終わっていません。別の候補を再指名しましょう。"}
              </p>
              <button onClick={() => open(selected.id)}>
                指名選手のプロフィール
              </button>
              <button
                className="primary"
                onClick={() => act({ type: "nextDraftRound" })}
              >
                {pending.winner !== 0
                  ? "1巡目を再指名する"
                  : pending.round === 6
                    ? "ドラフトの結果を確定する"
                    : `${pending.round + 1}巡目の指名へ進む`}
              </button>
            </>
          )}
        </section>
      )}
      {finished && (
        <section className="draft-outcome">
          <h3>新人の指名が完了しました。</h3>
          <p>
            獲得 {w.draftLog.filter((p) => p.team === 0).length}
            人。次は秋季キャンプで、新戦力を育てましょう。
          </p>
          <button className="primary" onClick={() => act({ type: "advance" })}>
            秋季キャンプへ進む
          </button>
        </section>
      )}
      {!pending && !finished && (
        <>
          <label className="field">
            補強ポジション
            <select
              value={position}
              onChange={(e) => setPosition(e.target.value)}
            >
              <option>全守備</option>
              {POSITIONS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <p className="muted">
            残り調査 {w.scoutsLeft}件 ／ 空き枠 {70 - seniorRoster(w).length}人
          </p>
          <div className="prospect-grid">
            {candidates.slice(0, 24).map((p) => {
              const skill = p.position === "投" ? "control" : "contact",
                e = estimate(w, p, skill);
              return (
                <article key={p.id}>
                  <button className="prospect-name" onClick={() => open(p.id)}>
                    <small>
                      {p.position} / {p.age}歳 / 調査{Math.round(p.scouting)}%
                    </small>
                    <b>{p.name}</b>
                  </button>
                  <div className="ability-grid">
                    <AbilityBadge
                      label={SKILLS[skill]}
                      low={e.low}
                      high={e.high}
                    />
                  </div>
                  <progress max={100} value={p.scouting} />
                  <div className="inline-actions">
                    {scouting && (
                      <button
                        disabled={w.scoutsLeft === 0 || p.scouting >= 100}
                        onClick={() => act({ type: "scout", id: p.id })}
                      >
                        調査 200万円
                      </button>
                    )}
                    {picking && (
                      <button onClick={() => act({ type: "draft", id: p.id })}>
                        指名する
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          {candidates.length > 24 && (
            <details>
              <summary>全候補を名鑑で確認（{candidates.length}人）</summary>
              <PlayerList
                w={w}
                list={candidates}
                open={open}
                action={
                  picking ? (p) => act({ type: "draft", id: p.id }) : undefined
                }
                label="指名する"
              />
            </details>
          )}
        </>
      )}
      {inDraft && !finished && pending?.stage !== "lottery" && (
        <button
          className="draft-stop"
          onClick={() => act({ type: "passDraft" })}
        >
          指名を終了
        </button>
      )}
      {!!w.draftLog.length && (
        <details>
          <summary>リアルタイム指名速報</summary>
          <div className="draft-feed">
            {[...w.draftLog]
              .reverse()
              .slice(0, 18)
              .map((p, i) => (
                <p key={i}>
                  {p.round}巡 · {w.teams[p.team].short} →{" "}
                  {w.players.find((x) => x.id === p.player)?.name}
                </p>
              ))}
          </div>
        </details>
      )}
    </>
  );
}
function Market({
  w,
  act,
  open,
  kind,
}: Props & { kind: "fa" | "foreign" | "tryout" }) {
  const enabled =
    kind === "tryout"
      ? ["tryout", "contracts"].includes(w.phase)
      : w.phase === "contracts";
  return (
    <>
      <h2>
        {kind === "fa"
          ? "FA市場"
          : kind === "foreign"
            ? "外国人スカウト"
            : "再生候補を探す"}
      </h2>
      <p>
        {kind === "fa"
          ? "A/Bランク獲得時は28人のプロテクトと人的補償が必要。Cは補償なし。選手詳細から最大3回交渉できます。"
          : kind === "foreign"
            ? "犬は外国人選手。能力は調査で絞り込み、一軍に登録できるのは4人まで。契約金は年俸の20%。"
            : "低年俸のベテランや、代走・守備・左キラーの尖った選手から役割を見つけましょう。"}
      </p>
      {!enabled && (
        <p className="notice">
          獲得交渉は{kind === "tryout" ? "11月中旬以降" : "11月下旬〜12月"}
          に可能です。
        </p>
      )}
      <PlayerList
        w={w}
        list={w.players.filter((p) => p.market === kind)}
        open={open}
        label={kind === "foreign" ? "外国人として獲得" : "希望年俸で獲得"}
        action={
          enabled && kind !== "fa"
            ? (p) =>
                act({ type: kind === "foreign" ? "foreign" : "sign", id: p.id })
            : undefined
        }
      />
    </>
  );
}
function Contracts({ w, act, open }: Props) {
  const list = roster(w).filter((p) => p.contractYear < w.year + 1),
    meetings = list.filter((p) => p.negotiation === "meeting");
  return (
    <>
      <h2>契約更改</h2>
      <p>
        成績査定に基づく一括提示で通常選手を更新。主力・ベテランは要面談に残ります。出来高は達成時に支払い、複数年は将来の枠と年俸を固定します。
      </p>
      <SalaryBudget w={w} act={act} />
      <button
        className="primary"
        disabled={!list.some((p) => p.negotiation !== "meeting")}
        onClick={() => act({ type: "renewAll" })}
      >
        査定年俸を一括提示 ({list.length - meetings.length}人)
      </button>
      <h3>
        要面談 {meetings.length}人 / 未提示 {list.length - meetings.length}人
      </h3>
      <PlayerList w={w} list={list} open={open} />
    </>
  );
}
export function SalaryBudget({ w, act }: { w: WorldState; act: Props["act"] }) {
  return (
    <label className="field">
      来季年俸予算 <b>{money(w.teams[0].finance.salaryBudget)}</b>
      <select
        aria-label="来季年俸予算"
        value={w.teams[0].finance.salaryBudget}
        onChange={(e) =>
          act({ type: "salaryBudget", value: Number(e.target.value) })
        }
      >
        {[
          ...new Set([
            150000,
            200000,
            250000,
            280000,
            300000,
            350000,
            400000,
            500000,
            600000,
            800000,
            w.teams[0].finance.salaryBudget,
          ]),
        ]
          .sort((a, b) => a - b)
          .map((n) => (
            <option key={n} value={n}>
              {money(n)}
            </option>
          ))}
      </select>
      <small>
        契約後見込み {money(projectedPayroll(w))}
        。予算を上げるほど来季の固定費が増えます。
      </small>
    </label>
  );
}
function Protection({ w, act, open }: Props) {
  const c = w.compensations[0],
    list = protectionCandidates(w);
  return (
    <section className="protection-panel">
      <h2>人的補償：28人を守る</h2>
      <p>
        {w.players.find((p) => p.id === c.player)?.name}の獲得に伴い、
        {w.teams[c.from].short}
        がプロテクト外から1人を選びます。外国人・今回のドラフト新人・獲得FA選手は対象外。
      </p>
      <b>
        {c.protected.length} / {Math.min(28, list.length)}人
      </b>
      <div className="inline-actions">
        <button onClick={() => act({ type: "autoProtect" })}>
          戦力順で28人を提案
        </button>
        <button onClick={() => act({ type: "compensate" })}>
          プロテクトを確定
        </button>
      </div>
      <div className="choice-list">
        {list.map((p) => (
          <div key={p.id}>
            <label>
              <input
                type="checkbox"
                checked={c.protected.includes(p.id)}
                onChange={() => act({ type: "protect", id: p.id })}
              />
              {p.position} {p.name}
              <small>
                {p.age}歳・{money(p.salary)}
              </small>
            </label>
            <button onClick={() => open(p.id)}>詳細</button>
          </div>
        ))}
      </div>
    </section>
  );
}
function ActiveDraft({ w, act }: Omit<Props, "open">) {
  const ours = seniorRoster(w).filter(
      (p) =>
        p.species === "cat" &&
        p.contractYear <= w.year &&
        p.salary < 7000 &&
        p.pro >= 1 &&
        p.draftYear !== w.year + 1,
    ),
    others = w.players.filter(
      (p) => w.activeDraftPool.includes(p.id) && p.team !== 0,
    );
  const [give, setGive] = useState(ours[0]?.id ?? ""),
    [take, setTake] = useState(others[0]?.id ?? "");
  return (
    <>
      <h2>現役ドラフト</h2>
      <p>
        各球団の出場機会の少ない猫を交換するゲーム内制度です。放出候補と欲しい選手を選んでください。選択すると全球団の移籍が確定します。
      </p>
      <PlayerSelect
        label="放出候補"
        list={ours}
        value={give}
        onChange={setGive}
      />
      <PlayerSelect
        label="獲得候補"
        list={others}
        value={take}
        onChange={setTake}
        w={w}
      />
      <button
        className="primary"
        disabled={w.activeDraftDone || !give || !take}
        onClick={() => act({ type: "activeDraft", give, take })}
      >
        {w.activeDraftDone ? "現役ドラフト実施済み" : "この選手交換で確定"}
      </button>
    </>
  );
}
function PlayerSelect({
  label,
  list,
  value,
  onChange,
  w,
}: {
  label: string;
  list: Player[];
  value: string;
  onChange: (v: string) => void;
  w?: WorldState;
}) {
  return (
    <label className="field">
      {label}
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">選手を選択</option>
        {list.map((p) => (
          <option key={p.id} value={p.id}>
            {w && p.team !== null ? `${w.teams[p.team].short} ` : ""}
            {p.position} {p.name} ({p.age}歳 / {money(p.salary)})
          </option>
        ))}
      </select>
    </label>
  );
}
function TradePanel({ w, act }: Omit<Props, "open">) {
  const [give, setGive] = useState(""),
    [take, setTake] = useState(""),
    [cash, setCash] = useState(0),
    [team, setTeam] = useState(1);
  const ours = seniorRoster(w).filter((p) => p.draftYear !== w.year + 1),
    others = seniorRoster(w, team).filter((p) => p.draftYear !== w.year + 1);
  return (
    <>
      <h2>トレード打診</h2>
      <p>
        交換選手の実力・若さ・将来性・年俸で相手が判断します。金銭を添えて条件を調整できます。
      </p>
      <PlayerSelect
        label="こちらの選手"
        list={ours}
        value={give}
        onChange={setGive}
      />
      <label className="field">
        相手球団
        <select
          value={team}
          onChange={(e) => {
            setTeam(Number(e.target.value));
            setTake("");
          }}
        >
          {w.teams.slice(1).map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <PlayerSelect
        label="欲しい選手"
        list={others}
        value={take}
        onChange={setTake}
      />
      <label className="field">
        追加金銭（万円）
        <input
          type="number"
          min={0}
          max={10000}
          step={500}
          value={cash}
          onChange={(e) => setCash(Number(e.target.value))}
        />
      </label>
      <button
        disabled={w.phase !== "contracts" || !give || !take}
        onClick={() => act({ type: "trade", give, take, cash })}
      >
        交換条件を提示
      </button>
    </>
  );
}
export function StaffPanel({ w, act }: Omit<Props, "open">) {
  return (
    <>
      <h2>監督・コーチの契約</h2>
      <p>
        6職種の年俸と指導力を比較。更新するスタッフも、新しく招くスタッフも、毎年契約を確定します。
      </p>
      {STAFF_ROLES.map((role) => (
        <section className="staff-section" key={role}>
          <h3>{role}</h3>
          {w.staff
            .filter((s) => s.role === role && (s.team === 0 || s.team === null))
            .sort(
              (a, b) =>
                Number(b.team === 0) - Number(a.team === 0) ||
                b.teaching - a.teaching,
            )
            .slice(0, 4)
            .map((s) => (
              <StaffCard
                key={s.id}
                s={s}
                target={w.year + 1}
                hire={() => act({ type: "hire", id: s.id })}
              />
            ))}
        </section>
      ))}
    </>
  );
}
function CampPanel({ w, act }: Omit<Props, "open">) {
  const [plan, setPlan] = useState<CampPlan>(structuredClone(w.campPlan)),
    [location, setLocation] = useState(0),
    [special, setSpecial] = useState(""),
    [kind, setKind] = useState<"breakout" | "convert" | "pitch">("breakout"),
    [position, setPosition] = useState<Player["position"]>("左"),
    [pitch, setPitch] = useState("シュート");
  return (
    <>
      <h2>{w.phase === "spring" ? "春季" : "秋季"}キャンプ計画</h2>
      <p>
        全体方針は2枠まで。2枠に分けると1能力への効果は薄まります。OB招聘は4,000万円、特別指定は5人まで。
      </p>
      <label className="field">
        開催地
        <select
          aria-label="キャンプ開催地"
          value={location}
          onChange={(e) => setLocation(Number(e.target.value))}
        >
          {CAMPS.map((c, i) => (
            <option key={c.name} value={i}>
              {c.name} / {money(c.cost)}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        追加練習予算
        <select
          value={plan.budget}
          onChange={(e) => setPlan({ ...plan, budget: Number(e.target.value) })}
        >
          {[0, 2500, 6000, 10000].map((n) => (
            <option key={n} value={n}>
              {money(n)}
            </option>
          ))}
        </select>
      </label>
      <h3>重点育成スロット ({plan.focuses.length}/2)</h3>
      <div className="focus-options">
        {Object.entries(SKILLS).map(([k, label]) => (
          <button
            className={plan.focuses.includes(k as Skill) ? "selected" : ""}
            key={k}
            onClick={() =>
              setPlan({
                ...plan,
                focuses: plan.focuses.includes(k as Skill)
                  ? plan.focuses.filter((x) => x !== k)
                  : plan.focuses.length < 2
                    ? [...plan.focuses, k as Skill]
                    : plan.focuses,
              })
            }
          >
            {label}
          </button>
        ))}
      </div>
      <label className="field">
        レジェンドOB招聘
        <select
          value={plan.legend}
          onChange={(e) =>
            setPlan({ ...plan, legend: e.target.value as CampPlan["legend"] })
          }
        >
          <option value="none">招聘なし</option>
          <option value="batting">打撃の名猫：野手 ×1.6</option>
          <option value="pitching">伝説のエース：投手 ×1.6</option>
          <option value="defense">守備の職人：守備・捕球・肩・走力 ×1.6</option>
        </select>
      </label>
      <h3>集中指導 ({plan.special.length}/5)</h3>
      <PlayerSelect
        label="特別指定選手"
        list={roster(w).filter((p) => !plan.special.some((s) => s.id === p.id))}
        value={special}
        onChange={setSpecial}
      />
      <label className="field">
        指導内容
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as typeof kind)}
        >
          <option value="breakout">ブレイク育成 ×1.8</option>
          <option value="convert">ポジションコンバート</option>
          <option value="pitch">新球種習得</option>
        </select>
      </label>
      {kind === "convert" && (
        <label className="field">
          新しい守備位置
          <select
            value={position}
            onChange={(e) => setPosition(e.target.value as Player["position"])}
          >
            {POSITIONS.slice(1).map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
      )}
      {kind === "pitch" && (
        <label className="field">
          習得球種
          <select value={pitch} onChange={(e) => setPitch(e.target.value)}>
            {[
              "シュート",
              "フォーク",
              "カーブ",
              "スライダー",
              "チェンジアップ",
            ].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
      )}
      <button
        disabled={!special || plan.special.length >= 5}
        onClick={() => {
          setPlan({
            ...plan,
            special: [...plan.special, { id: special, kind, position, pitch }],
          });
          setSpecial("");
        }}
      >
        集中指導に追加
      </button>
      <div className="special-list">
        {plan.special.map((s) => (
          <p key={s.id}>
            {w.players.find((p) => p.id === s.id)?.name} /{" "}
            {s.kind === "breakout"
              ? "ブレイク"
              : s.kind === "convert"
                ? `→${s.position}`
                : s.pitch}
            <button
              onClick={() =>
                setPlan({
                  ...plan,
                  special: plan.special.filter((x) => x.id !== s.id),
                })
              }
            >
              外す
            </button>
          </p>
        ))}
      </div>
      <div className="budget-preview">
        <span>開催費＋追加予算＋OB</span>
        <strong>
          {money(
            CAMPS[location].cost +
              plan.budget +
              (plan.legend !== "none" ? 4000 : 0),
          )}
        </strong>
      </div>
      <button
        disabled={w.campDone}
        onClick={() => act({ type: "campPlan", plan })}
      >
        このキャンプ計画を保存
      </button>
      <button
        className="primary"
        disabled={
          w.campDone || JSON.stringify(plan) !== JSON.stringify(w.campPlan)
        }
        onClick={() =>
          act({ type: "camp", location, focus: plan.focuses[0] ?? "contact" })
        }
      >
        {w.campDone ? "キャンプ実施済み" : "保存した計画でキャンプを実施"}
      </button>
      <p className="muted">
        計画を保存してから実施してください。成果は選手詳細の成長履歴で確認できます。
      </p>
    </>
  );
}
function Registration({ w, act, open }: Props) {
  const [mode, setMode] = useState("一軍選抜"),
    ids = w.teams[0].activeIds;
  return (
    <>
      <h2>開幕メンバーを決める</h2>
      <p>
        支配下70人、一軍31人、外国人4人まで。育成選手は支配下昇格が必要です。自動提案から好調な選手に入れ替えられます。
      </p>
      <button onClick={() => act({ type: "autoActive" })}>
        監督の一軍案を再提案
      </button>
      <div className="segmented">
        {["一軍選抜", "育成から昇格"].map((v) => (
          <button
            key={v}
            className={mode === v ? "selected" : ""}
            onClick={() => setMode(v)}
          >
            {v}
          </button>
        ))}
      </div>
      <p>
        <b>一軍 {ids.length}/31人</b> ／ 外国人{" "}
        {
          ids.filter(
            (id) => w.players.find((p) => p.id === id)?.species === "dog",
          ).length
        }
        /4人
      </p>
      {mode === "育成から昇格" ? (
        <PlayerList
          w={w}
          list={roster(w).filter((p) => p.registration === "development")}
          open={open}
          label="支配下へ昇格"
          action={(p) => act({ type: "promote", id: p.id })}
        />
      ) : (
        <div className="choice-list">
          {seniorRoster(w).map((p) => (
            <div key={p.id}>
              <label>
                <input
                  type="checkbox"
                  checked={ids.includes(p.id)}
                  onChange={() => act({ type: "active", id: p.id })}
                />
                {p.position} {p.name}
                <small>
                  {p.species === "dog" ? "外国人" : "猫"} / {p.age}歳
                  {p.promise !== "none" ? " / 起用確約" : ""}
                </small>
              </label>
              <button onClick={() => open(p.id)}>詳細</button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
