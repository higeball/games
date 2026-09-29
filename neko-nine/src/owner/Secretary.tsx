import { PHASE_FLOW, PHASE_NAMES, PHASE_DATES, type WorldState } from "./model";
import { phaseBlockers, seniorRoster } from "./operations";
import { eventObjective } from "./experience";

export function nextEventLabel(w: WorldState) {
  if (w.phase === "season") return `${w.month}月を進める`;
  if (w.phase === "retain" && w.retentionReturn)
    return `${PHASE_NAMES[w.retentionReturn]}へ進む`;
  const next = PHASE_FLOW[PHASE_FLOW.indexOf(w.phase) + 1];
  return next ? `${PHASE_NAMES[next]}へ進む` : "レギュラーシーズン開幕";
}
export function phaseFinishLabel(w: WorldState) {
  if (w.phase === "season") return `${nextEventLabel(w)} →`;
  return `${PHASE_NAMES[w.phase]}を終了し${nextEventLabel(w)}`;
}
export function eventTab(
  _w: Pick<WorldState, "phase">,
): "ホーム" | "編成" | "経営" {
  return "ホーム";
}
export function secretaryAdvice(w: WorldState) {
  const room = 70 - seniorRoster(w).length;
  const completed = phaseBlockers(w).length === 0;
  const instructions: Record<string, { message: string; steps: string[] }> = {
    review: {
      message:
        "ヤスオーナー、シーズンお疲れ様でした。まずは来季までの流れをご説明します。このあと補強ポイントを確認し、戦力外通告から球団づくりを始めましょう。",
      steps: ["今季の成績を確認", "戦力外候補を選ぶ", "ドラフトへ"],
    },
    release: {
      message: `第1次戦力外通告になります。能力と直近3年成績を比べ、候補を選んでください。若手・主力の除外はチェックで解除できます。空き枠は${room}人。整理が済んだらドラフトへ進みましょう。`,
      steps: ["候補を比較", "通告／育成を打診", "ドラフト会議へ"],
    },
    draft: {
      message:
        w.draftPending?.stage === "lottery"
          ? "1巡目は競合指名になりました。下の「くじを引く」で交渉権の抽選を行ってください。結果が出たら次の手続きをご案内します。"
          : w.draftPending?.stage === "result"
            ? w.draftPending.winner === 0
              ? `${w.draftPending.round}巡目の交渉権を獲得しました！下の指名結果をご確認ください。「次の巡」のボタンを押すまでは、次の指名へ進みません。`
              : "抽選は残念ながら落選です。下の結果を確認し、「1巡目を再指名する」を押して別の候補を選んでください。"
            : w.draftRound >= 6
              ? "ドラフトの指名が完了しました。次は秋季キャンプです。獲得した若手をどう伸ばすか、育成方針を決めてください。"
              : `ドラフト会議の第${w.draftRound + 1}巡になります。補強したい守備位置と調査度を確認し、指名してください。1位の重複指名は抽選です。枠や予算に余裕がなければ、指名を終了することもできます。`,
      steps: [
        "補強ポイントを確認",
        "調査して指名",
        "指名終了後、秋季キャンプへ",
      ],
    },
    autumn: {
      message: w.campDone
        ? "秋季キャンプが終わりました。次へ進むと日本シリーズの結果とFA宣言が公示されます。第2次戦力外の検討へ移りましょう。"
        : "秋季キャンプになります。開催地・予算・重点方針を選んでください。集中指導は5枠から直接選べます。設定は自動保存されるので、内容が決まったらキャンプを実施してください。",
      steps: [
        "計画を選ぶ（自動保存）",
        "キャンプを実施",
        "FA公示・第2次戦力外へ",
      ],
    },
    release2: {
      message:
        "日本シリーズが終了し、FA宣言が公示されました。第2次戦力外通告になります。新戦力を迎える枠を確認して、必要なら候補を見直してください。整理が済んだら自球団FA選手の引き止めへ進みましょう。",
      steps: ["空き枠を確認", "最終の枠整理", "自球団FA選手の引き止めへ"],
    },
    tryout: {
      message:
        "合同トライアウトになります。低年俸のベテランや、代走・守備固めなどの専門家を探してください。獲得は任意です。検討が済んだら現役ドラフトへ進みましょう。",
      steps: ["再生候補を比較", "必要な選手だけ獲得", "現役ドラフトへ"],
    },
    activeDraft: {
      message: w.activeDraftDone
        ? "現役ドラフトが確定しました。次は契約更改と本格的な補強交渉になります。"
        : "現役ドラフトになります。出場機会の少ない選手と、獲得したい他球団の候補を選び、交換を確定してください。",
      steps: ["送り出す選手を選ぶ", "獲得候補を選び交換", "契約更改へ"],
    },
    contracts: {
      message: completed
        ? "契約更改の必須手続きが完了しました。年俸予算を確認し、他球団FA選手の獲得へ進んでください。"
        : `契約更改になります。まずは査定年俸を一括提示してください。保留した主力だけ個別に面談します。他球団FA・外国人・トレードは、この後それぞれの画面で進めます。${w.compensations.length ? "人的補償のプロテクトも必要です。" : ""}想定総年俸が予算に収まるかも確認してください。`,
      steps: ["年俸を一括提示", "要面談選手と交渉", "他球団FA選手の獲得へ"],
    },
    budget: {
      message:
        "施設と集客への投資を決めましょう。投資は任意です。来季年俸が予算に収まったら、監督・コーチ人事へ進んでください。",
      steps: ["収支を確認", "必要な設備へ投資", "監督・コーチ人事へ"],
    },
    staff: {
      message:
        "監督とコーチ6職種を契約しましょう。現スタッフと契約を更新するか、新しい候補を選んでください。契約が揃ったら春季キャンプです。",
      steps: ["現スタッフを確認", "6職種を契約", "春季キャンプへ"],
    },
    retain: {
      message:
        "自球団のFA宣言選手を引き止める期間です。残したい選手と残留交渉し、それ以外は引き止めを見送ってください。他球団からのFA獲得は契約更改の後です。",
      steps: ["自球団のFA宣言を確認", "残留交渉または見送り", "トライアウトへ"],
    },
    fa: {
      message:
        "他球団のFA選手を獲得できます。必要な選手だけ交渉してください。A・Bランクの獲得時は、人的補償のプロテクトも確定します。",
      steps: ["他球団のFA選手を比較", "獲得交渉・人的補償", "外国人補強へ"],
    },
    foreign: {
      message:
        "外国人選手を補強できます。調査で能力の幅を絞り、弱点を補える選手を探しましょう。補強は任意です。検討を終えたらトレードへ進みます。",
      steps: ["外国人候補を調査", "必要な選手を獲得", "トレードへ"],
    },
    trade: {
      message:
        "他球団に選手交換を打診できます。放出と獲得の戦力差を比べて条件を提示してください。トレードは任意です。次は施設・経営計画になります。",
      steps: ["交換候補を比較", "交換条件を提示", "施設・経営計画へ"],
    },
    promotion: {
      message:
        "開幕前に育成選手の支配下昇格を決めましょう。一軍で起用したい育成選手を昇格させてください。昇格は任意です。次の画面で一軍メンバーを選びます。",
      steps: ["育成選手を比較", "支配下昇格を決定", "開幕一軍登録へ"],
    },
    spring: {
      message: w.campDone
        ? "春季キャンプが終わりました。次はオープン戦で、新戦力の調整状態を確認しましょう。"
        : "春季キャンプになります。全体方針を決めて、新球種の習得やポジションコンバートを集中指導に設定してください。設定は自動保存されます。内容が決まったらキャンプを実施してください。",
      steps: ["新戦力の指導を設定", "キャンプを実施", "オープン戦へ"],
    },
    preseason: {
      message: w.preseasonDone
        ? "オープン戦が終了しました。状態評価を確認したら、育成選手の支配下昇格へ進んでください。"
        : "オープン戦になります。「オープン戦を実施」を押し、新戦力の状態評価を確認してください。公式戦の成績には含まれません。",
      steps: ["オープン戦を実施", "調整状態を確認", "育成選手の支配下昇格へ"],
    },
    registration: {
      message:
        "開幕一軍を決める時期になります。自動選抜を土台に、守備位置・投手・捕手の人数を確認してください。一軍は31人、外国人は4人までです。編成が決まったら開幕へ進みましょう。",
      steps: [
        "支配下選手の状態を確認",
        "開幕一軍を選ぶ",
        "レギュラーシーズン開幕",
      ],
    },
    season: {
      message: `${w.month}月のペナントになります。試合は監督に任せ、ヘッダーの月送りボタンで順番に結果を確認してください。来秋のドラフト候補へのスカウト派遣もお忘れなく。`,
      steps: ["来秋の候補を調査", "ヘッダーから月送り", "成績・営業報告を確認"],
    },
  };
  return (
    instructions[w.phase] ?? {
      message: "現在のイベントを確認し、未完了の手続きから進めてください。",
      steps: ["イベントを確認"],
    }
  );
}
export function FoomyGuide({
  w,
  compact = false,
  onAdvance,
}: {
  w: WorldState;
  compact?: boolean;
  onAdvance?: () => void;
}) {
  const advice = secretaryAdvice(w),
    blockers = phaseBlockers(w);
  const group = ["review", "release"].includes(w.phase)
    ? 0
    : [
          "draft",
          "autumn",
          "release2",
          "tryout",
          "activeDraft",
          "contracts",
        ].includes(w.phase)
      ? 1
      : w.phase === "season"
        ? 3
        : 2;
  return (
    <aside
      className={`secretary-guide${compact ? " compact" : ""}`}
      aria-label="秘書フーミーの案内"
    >
      <div className="secretary-briefing">
        <img
          src={`${import.meta.env.BASE_URL}assets/characters/foomy-secretary-pixel.png`}
          alt="茶髪のショートヘアーの秘書フーミー"
          width="90"
          height="108"
        />
        <div>
          <small>OWNER'S SECRETARY</small>
          <h2>フーミーからのご案内</h2>
          <p>{advice.message}</p>
        </div>
      </div>
      {onAdvance && (
        <button className="primary secretary-primary" onClick={onAdvance}>
          {nextEventLabel(w)} →
        </button>
      )}
      {w.phase === "review" ? (
        <section className="season-overview" aria-label="球団運営の年間の流れ">
          <h3>来季までの全体の流れ</h3>
          <ol>
            {[...PHASE_FLOW.slice(1), "season" as const].map((phase) => (
              <li key={phase} data-phase={phase}>
                <small>
                  {w.year +
                    ([
                      "budget",
                      "staff",
                      "spring",
                      "preseason",
                      "promotion",
                      "registration",
                      "season",
                    ].includes(phase)
                      ? 1
                      : 0)}
                  年{PHASE_DATES[phase]}
                </small>
                <b>{PHASE_NAMES[phase]}</b>
              </li>
            ))}
          </ol>
        </section>
      ) : compact ? null : (
        <>
          <ol className="year-journey" aria-label="年間の進行">
            {["構想", "補強・契約", "調整・開幕準備", "シーズン"].map(
              (s, i) => (
                <li
                  key={s}
                  className={i === group ? "current" : i < group ? "done" : ""}
                  aria-current={i === group ? "step" : undefined}
                >
                  {s}
                </li>
              ),
            )}
          </ol>
          <ol className="secretary-steps">
            {advice.steps.map((s, i) => (
              <li key={s}>
                <span>{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
          {blockers.length > 0 && (
            <p className="secretary-task">先に必要な手続き：{blockers[0]}</p>
          )}
        </>
      )}
    </aside>
  );
}
