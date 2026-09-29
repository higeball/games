import { roster, standings } from "./engine";
import { phaseBlockers, teamStrength } from "./operations";
import {
  PHASE_NAMES,
  STAFF_ROLES,
  money,
  type OwnerAction,
  type WorldState,
} from "./model";

export function recordStrengthBaseline(w: WorldState) {
  if (
    w.strengthBaseline &&
    !(w.phase === "review" && w.strengthBaseline.year !== w.year)
  )
    return;
  w.strengthBaseline = {
    year: w.year,
    label:
      w.phase === "review"
        ? w.year === 2026
          ? "就任時"
          : `${w.year}年オフ開始時`
        : `${w.year}年・${PHASE_NAMES[w.phase]}開始時`,
    scores: teamStrength(w).map(({ name, score }) => ({ name, score })),
    players: roster(w).map(({ id, name, position }) => ({
      id,
      name,
      position,
    })),
  };
}

export function eventObjective(w: WorldState) {
  const blocked = phaseBlockers(w).length > 0;
  const remaining = roster(w).filter((p) => p.contractYear < w.year + 1).length;
  const staff = STAFF_ROLES.filter((role) =>
    w.staff.some(
      (s) => s.team === 0 && s.role === role && s.contractYear >= w.year + 1,
    ),
  ).length;
  const optional =
    !blocked &&
    [
      "release",
      "release2",
      "tryout",
      "fa",
      "foreign",
      "trade",
      "budget",
      "promotion",
    ].includes(w.phase);
  const text: Partial<Record<WorldState["phase"], string>> = {
    invitation: `特別招待選手を2名選ぶ · ${w.invitationPicks?.length ?? 0}/2名`,
    release: "来季に向けて登録枠を整理",
    release2: "補強前の最終チェック",
    draft:
      w.draftPending?.stage === "lottery"
        ? "競合指名。くじを引く"
        : w.draftPending
          ? "指名結果を確認"
          : w.draftRound >= 6
            ? "新人の指名が完了"
            : `第${w.draftRound + 1}巡の選手を指名`,
    autumn: w.campDone ? "育成の成果を確認" : "育成方針を選び、キャンプ実施",
    spring: w.campDone
      ? "開幕に向けた成長を確認"
      : "新戦力を育て、キャンプ実施",
    tryout: "再生できる選手を探す",
    activeDraft: w.activeDraftDone ? "選手交換が完了" : "放出・獲得選手を選ぶ",
    contracts: remaining
      ? `来季契約を決める · 残り${remaining}人`
      : w.compensations.length
        ? "人的補償のプロテクトを確定"
        : "来季の選手契約が完了",
    budget: "来季の予算と施設投資を決める",
    staff: `監督・コーチの来季契約 · ${staff}/6職種`,
    retain: "FA宣言した自球団選手の残留を交渉",
    fa: "他球団のFA選手を獲得",
    foreign: "外国人選手で弱点を補う",
    trade: "選手交換を他球団に打診",
    promotion: "育成選手の支配下昇格を決める",
    preseason: w.preseasonDone
      ? "オープン戦の結果を確認"
      : "オープン戦12試合を実施",
    registration: "開幕一軍を決定",
    season: `${w.month}月のペナント`,
  };
  return {
    title: text[w.phase] ?? PHASE_NAMES[w.phase],
    state: optional
      ? "選択は任意"
      : w.phase === "season"
        ? "シーズン中"
        : blocked
          ? "編成中"
          : "完了",
    hint: optional
      ? "必要な選手だけ選び、上のボタンで次へ。"
      : blocked
        ? phaseBlockers(w)[0]
        : "結果を確認したら、上のボタンで次へ。",
  };
}

export function actionFeedback(
  before: WorldState,
  after: WorldState,
  action: OwnerAction,
) {
  const titles: Partial<Record<OwnerAction["type"], string>> = {
    release: "戦力外通告を記録しました",
    cancelRelease: "戦力外通告を取り消しました",
    development: "育成契約の打診結果",
    sign: "新戦力が入団しました",
    foreign: "外国人選手が入団しました",
    activeDraft: "現役ドラフトが成立しました",
    trade: "トレードの回答",
    hire: "スタッフの契約を更新しました",
    invest: "球団設備を強化しました",
    renewAll: "一括提示の結果",
    negotiate: "契約交渉の結果",
    offer: "FA交渉の回答",
    waiveRetention: "FA引き止めを見送りました",
    compensate: "人的補償が確定しました",
    promote: "支配下へ昇格しました",
  };
  if (action.type === "advance" && before.phase === "season") {
    const t = after.teams[0],
      old = before.teams[0];
    return {
      title: `${before.month}月の結果 · ${t.wins - old.wins}勝 ${t.losses - old.losses}敗 ${t.draws - old.draws}分`,
      body: `パ・リーグ${standings(after, "パ").findIndex((t) => t.id === 0) + 1}位 · ${t.wins}勝${t.losses}敗`,
      changes: [] as string[],
      playerId: undefined as string | undefined,
    };
  }
  const title = titles[action.type];
  if (!title) return null;
  const original = teamStrength(before);
  const changes = teamStrength(after).flatMap((s, i) => {
    const delta = Math.round((s.score - original[i].score) * 10) / 10;
    return delta
      ? [`${s.name} ${delta > 0 ? "+" : ""}${delta.toFixed(1)}`]
      : [];
  });
  const cash = after.teams[0].finance.cash - before.teams[0].finance.cash;
  if (cash)
    changes.push(`資金 ${cash > 0 ? "+" : "−"}${money(Math.abs(cash))}`);
  const body =
    action.type === "renewAll"
      ? `契約済み ${roster(after).filter((p) => p.contractYear >= after.year + 1).length}人 / 要面談 ${roster(after).filter((p) => p.negotiation === "meeting" && p.contractYear < after.year + 1).length}人`
      : after.news[0]?.id !== before.news[0]?.id
        ? (after.news[0]?.body ?? "")
        : "変更を保存しました。";
  return {
    title,
    body,
    changes,
    playerId: "id" in action ? action.id : undefined,
  };
}
