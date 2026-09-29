import { invitationCandidates } from "./invitation";
import { AnimalPortrait } from "./AnimalPortrait";
import { BatterAbilityPanel } from "./BatterAbilityPanel";
import type { OwnerAction, WorldState } from "./model";

export function SpecialInvitation({
  w,
  act,
}: {
  w: WorldState;
  act: (action: OwnerAction) => void;
}) {
  const picks = w.invitationPicks ?? [],
    candidates = invitationCandidates();
  const names: Record<string, string> = {
    一: "ファースト",
    三: "サード",
    二: "セカンド",
    捕: "キャッチャー",
  };
  return (
    <section className="special-invitation" aria-label="特別招待選手の選択">
      <div className="invitation-summary" aria-live="polite">
        <strong>4名から2名を招待 · {picks.length}/2名選択</strong>
        <p>
          {picks.length
            ? candidates
                .filter((p) => picks.includes(p.id))
                .map((p) => p.name)
                .join(" ／ ")
            : "チームの補強ポイントに合わせて2名を選びましょう。"}
        </p>
        <small>
          選択は変更できます。2名が決まったら、上の獲得ボタンで入団が確定します。
        </small>
      </div>
      <p className="muted">
        全員22歳の新人・年俸600万円。人気80／調子80／耐久性80。2026年の公式戦出場はありません。獲得した2名は支配下枠に加わります。
      </p>
      <div className="invitation-grid">
        {candidates.map((p) => {
          const selected = picks.includes(p.id);
          return (
            <article
              className={
                selected ? "invitation-card selected" : "invitation-card"
              }
              key={p.id}
              data-player-id={p.id}
            >
              <div className="invitation-hero">
                <AnimalPortrait p={p} />
                <div>
                  <h2>{p.name}</h2>
                  <p>{names[p.position]} · 22歳 · 新人</p>
                </div>
              </div>
              <BatterAbilityPanel w={w} p={p} />
              <button
                className={selected ? "selected" : "primary"}
                aria-pressed={selected}
                disabled={!selected && picks.length >= 2}
                onClick={() => act({ type: "toggleInvitation", id: p.id })}
              >
                {selected ? p.name + "の選択を取り消す" : p.name + "を選ぶ"}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
