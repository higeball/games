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
} from "./model";
import { PlayerList, StaffCard, Annual } from "./OwnerApp";
import { YasuPortrait } from "../ui/Sprites";
import { ReleasePanel } from "./ReleasePanel";
import { phaseFinishLabel } from "./Secretary";
import { AbilityBadge } from "./AbilityBadge";
import { AnimalPortrait } from "./AnimalPortrait";
import { ScoutingStatus } from "./ScoutingStatus";
import { CampPanel } from "./CampPanel";
import { TeamProgress } from "./TeamProgress";
import { PlayerAbilityPanel } from "./PlayerAbilityPanel";
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
  onStopDraft,
  onReturn,
}: {
  w: WorldState;
  onAdvance?: () => void;
  onStopDraft?: () => void;
  onReturn?: () => void;
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
      {onReturn && (
        <button className="return-to-event" onClick={onReturn}>
          ← {PHASE_NAMES[w.phase]}に戻る
        </button>
      )}
      {w.phase !== "review" && onAdvance && (
        <button
          className="primary status-advance"
          onClick={onAdvance}
          disabled={phaseBlockers(w).length > 0}
          title={phaseBlockers(w).join(" / ")}
          data-phase={w.phase}
        >
          {phaseFinishLabel(w)}
        </button>
      )}
      {w.phase === "draft" &&
        w.draftRound < 6 &&
        w.draftPending?.stage !== "lottery" &&
        onStopDraft && (
          <button className="status-draft-stop" onClick={onStopDraft}>
            指名を終了
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
  const list = roster(w),
    team = w.teams[0];
  const ages = [
    { name: "22歳以下", count: list.filter((p) => p.age <= 22).length },
    {
      name: "23歳〜27歳",
      count: list.filter((p) => p.age >= 23 && p.age <= 27).length,
    },
    {
      name: "28歳〜32歳",
      count: list.filter((p) => p.age >= 28 && p.age <= 32).length,
    },
    {
      name: "33歳〜37歳",
      count: list.filter((p) => p.age >= 33 && p.age <= 37).length,
    },
    { name: "38歳以上", count: list.filter((p) => p.age >= 38).length },
  ];
  return (
    <>
      {w.phase === "season" && (
        <>
          <section className="season-scoreboard" aria-label="今季の戦況">
            <small>パ・リーグ</small>
            <strong>
              {standings(w, "パ").findIndex((t) => t.id === 0) + 1}位
            </strong>
            <span>
              {team.wins}勝 {team.losses}敗 {team.draws}分
            </span>
            <p>
              {team.wins + team.losses + team.draws} / 143試合 · 前年{" "}
              {team.previousRank}位
            </p>
          </section>
          <div className="inline-actions">
            <button onClick={() => go("リーグ")}>順位・個人成績を見る</button>
            <button onClick={() => go("編成")}>来秋のドラフト候補を調査</button>
          </div>
          <h2>球団ニュース</h2>
          <div className="news-feed">
            {w.news.slice(0, 6).map((n) => (
              <article key={n.id}>
                <small>球団からの報告</small>
                <h3>{n.title}</h3>
                <p>{n.body}</p>
              </article>
            ))}
          </div>
        </>
      )}
      <TeamProgress w={w} compact={w.phase === "review"} />
      {w.phase === "review" && (
        <>
          <div className="age-chart">
            {ages.map((g) => (
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
          <button
            className="primary review-advance"
            onClick={() => act({ type: "advance" })}
          >
            第1次戦力外通告へ進む →
          </button>
        </>
      )}
      {w.archives.at(-1)?.year === w.year && (
        <section className="season-outcome">
          <h2>{w.year}年 シーズン結果</h2>
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
    </>
  );
}
export function FrontOffice({ w, act, open }: Props) {
  const [view, setView] = useState("契約更改");
  if (w.phase === "draft") return <DraftBoard w={w} act={act} open={open} />;
  const releasing = ["release", "release2"].includes(w.phase);
  const choices =
    w.phase === "contracts" ? ["契約更改", "FA市場", "外国人", "トレード"] : [];
  const marketTabs = (
    <div className="market-tabs">
      {choices.map((v) => (
        <button
          key={v}
          className={view === v ? "selected" : ""}
          aria-pressed={view === v}
          onClick={() => setView(v)}
        >
          {v}
        </button>
      ))}
    </div>
  );
  return (
    <>
      {choices.length > 0 && marketTabs}
      {w.phase === "release2" && w.archives.at(-1)?.year === w.year && (
        <details className="optional-section">
          <summary>日本シリーズ・シーズン決算を見る</summary>
          <p>日本一：{w.teams[w.archives.at(-1)!.champion].name}</p>
          {w.seriesLog.map((s, i) => (
            <p key={i}>{s}</p>
          ))}
          <Annual w={w} />
        </details>
      )}
      {w.phase === "contracts" && w.compensations.length > 0 && (
        <Protection w={w} act={act} open={open} />
      )}
      {w.phase === "season" ? (
        <DraftBoard w={w} act={act} open={open} />
      ) : view === "FA市場" ? (
        <Market w={w} act={act} open={open} kind="fa" />
      ) : view === "外国人" ? (
        <Market w={w} act={act} open={open} kind="foreign" />
      ) : view === "トレード" ? (
        <TradePanel w={w} act={act} />
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
      ) : (
        <p>{hints[w.phase]} ヘッダーから次のイベントに進めます。</p>
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
          {["指名", "抽選", "結果", "次の巡"].map((s, i) => (
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
          ))}
        </ol>
      )}
      {!pending && !finished && (
        <details className="optional-section">
          <summary>ドラフトのルール・契約条件</summary>
          <p>
            調査度0〜100%。低調査では能力評価に大きな幅が残ります。1位は重複抽選、下位は逆順位を交互に反転。契約金1,000万円・年俸600万円。
          </p>
        </details>
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
          <p>
            指名結果を確認したら、ヘッダーの終了ボタンで秋季キャンプへ進んでください。
          </p>
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
          <p className="decision-caption">
            {picking ? "指名する選手を選択" : "調査する選手を選択"} ·
            補強ポイント：
            {teamStrength(w)
              .filter((s) => s.urgent)
              .map((s) => s.name)
              .join("・") || "選手層を厚くする"}
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
                  <ScoutingStatus p={p} />
                  <div className="inline-actions">
                    {scouting && (
                      <button
                        disabled={w.scoutsLeft === 0 || p.scouting >= 100}
                        onClick={() => act({ type: "scout", id: p.id })}
                      >
                        {p.scouting >= 100
                          ? "調査完了"
                          : `調査 200万円（${(p.scoutingCount ?? 0) + 1}回目）`}
                      </button>
                    )}
                    {picking && (
                      <button
                        className="primary"
                        disabled={seniorRoster(w).length >= 70}
                        onClick={() => act({ type: "draft", id: p.id })}
                      >
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
        label={
          kind === "fa"
            ? "FA交渉を始める"
            : kind === "foreign"
              ? "外国人として獲得"
              : "希望年俸で獲得"
        }
        action={
          enabled
            ? (p) =>
                kind === "fa"
                  ? open(p.id)
                  : act({
                      type: kind === "foreign" ? "foreign" : "sign",
                      id: p.id,
                    })
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
      <div className="result-counts">
        <span>
          契約済み <b>{roster(w).length - list.length}人</b>
        </span>
        <span>
          未提示 <b>{list.length - meetings.length}人</b>
        </span>
        <span>
          要面談 <b>{meetings.length}人</b>
        </span>
      </div>
      {list.length > meetings.length && (
        <button
          className="primary"
          disabled={!list.some((p) => p.negotiation !== "meeting")}
          onClick={() => act({ type: "renewAll" })}
        >
          査定年俸を一括提示 ({list.length - meetings.length}人)
        </button>
      )}
      {list.length > 0 && <h3>個別交渉する選手</h3>}
      {list.length > 0 ? (
        <PlayerList
          w={w}
          list={list}
          open={open}
          action={(p) => open(p.id)}
          label="契約を交渉する"
        />
      ) : (
        <p className="completion-card">
          ✓ 全選手の来季契約が揃いました。補強を終えたら、次へ進めます。
        </p>
      )}
      <details
        className="optional-section"
        open={projectedPayroll(w) > w.teams[0].finance.salaryBudget}
      >
        <summary>
          年俸予算を調整 · 残り{" "}
          {money(w.teams[0].finance.salaryBudget - projectedPayroll(w))}
        </summary>
        <SalaryBudget w={w} act={act} />
      </details>
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
        <button
          className="primary"
          disabled={c.protected.length !== Math.min(28, list.length)}
          onClick={() => act({ type: "compensate" })}
        >
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
                disabled={
                  !c.protected.includes(p.id) &&
                  c.protected.length >= Math.min(28, list.length)
                }
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
  if (w.activeDraftDone)
    return (
      <section className="completion-card">
        <h2>選手交換が完了しました</h2>
        <p>新しい戦力が合流しました。チーム戦力で加入選手を確認できます。</p>
      </section>
    );
  return (
    <>
      <h2>現役ドラフト</h2>
      <p className="decision-caption">放出する選手と、迎える選手を比較</p>
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
      <ExchangePreview w={w} give={give} take={take} />
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
function ExchangePreview({
  w,
  give,
  take,
}: {
  w: WorldState;
  give: string;
  take: string;
}) {
  return (
    <section className="exchange-preview" aria-label="交換する選手の比較">
      {[
        [give, "送り出す選手"],
        [take, "迎える選手"],
      ].map(([id, label]) => {
        const p = w.players.find((p) => p.id === id);
        return (
          <article key={label}>
            <small>{label}</small>
            {p ? (
              <>
                <h3>
                  {p.position} {p.name} · {p.age}歳
                </h3>
                <p>年俸 {money(p.salary)}</p>
                <PlayerAbilityPanel p={p} w={w} />
              </>
            ) : (
              <p>選手を選んでください</p>
            )}
          </article>
        );
      })}
    </section>
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
      <ExchangePreview w={w} give={give} take={take} />
      <button
        className="primary"
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
      <p className="decision-caption">現職を更新するか、候補から選ぶ</p>
      {STAFF_ROLES.map((role) => (
        <section className="staff-section" key={role}>
          <h3>{role}</h3>
          {w.staff
            .filter((s) => s.role === role && s.team === 0)
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
          <details className="optional-section">
            <summary>{role}の候補を比較する</summary>
            {w.staff
              .filter((s) => s.role === role && s.team === null)
              .sort((a, b) => b.teaching - a.teaching)
              .slice(0, 3)
              .map((s) => (
                <StaffCard
                  key={s.id}
                  s={s}
                  target={w.year + 1}
                  hire={
                    w.staff.some(
                      (current) =>
                        current.role === role &&
                        current.team === 0 &&
                        current.contractYear >= w.year + 1,
                    )
                      ? undefined
                      : () => act({ type: "hire", id: s.id })
                  }
                />
              ))}
          </details>
        </section>
      ))}
    </>
  );
}
function Registration({ w, act, open }: Props) {
  const [mode, setMode] = useState("一軍選抜"),
    [group, setGroup] = useState("投手"),
    ids = w.teams[0].activeIds;
  const groups: Record<string, string[]> = {
    投手: ["投"],
    捕手: ["捕"],
    内野: ["一", "二", "三", "遊"],
    外野: ["左", "中", "右"],
  };
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
        <>
          <div className="segmented" aria-label="一軍候補のポジション">
            {Object.entries(groups).map(([name, positions]) => (
              <button
                key={name}
                aria-pressed={group === name}
                className={group === name ? "selected" : ""}
                onClick={() => setGroup(name)}
              >
                {name} ·{" "}
                {
                  seniorRoster(w).filter(
                    (p) => positions.includes(p.position) && ids.includes(p.id),
                  ).length
                }
                人
              </button>
            ))}
          </div>
          {ids.length >= 31 && (
            <p className="muted">
              入れ替えは、一軍選手のチェックを外してから。
            </p>
          )}
          <div className="choice-list">
            {seniorRoster(w)
              .filter((p) => groups[group].includes(p.position))
              .map((p) => (
                <div key={p.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={ids.includes(p.id)}
                      disabled={
                        !ids.includes(p.id) &&
                        (ids.length >= 31 ||
                          (p.species === "dog" &&
                            ids.filter(
                              (id) =>
                                w.players.find((p) => p.id === id)?.species ===
                                "dog",
                            ).length >= 4))
                      }
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
        </>
      )}
    </>
  );
}
