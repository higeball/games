import type { Player } from "./model";

/** Full-color plates: blue positive traits, red warnings, yellow basic facts. */
export function ProfileAbilities({
  p,
  known = true,
}: {
  p: Player;
  known?: boolean;
}) {
  return (
    <div className="profile-abilities" aria-label="特殊能力・プロフィール">
      {p.position === "投" ? (
        <>
          <span className="ability-plate neutral">
            球速{" "}
            <b>
              {known
                ? `${p.velocity}km/h`
                : `${p.velocity - 5}〜${p.velocity + 5}km/h（推定）`}
            </b>
          </span>
          {p.pitches.map((pitch) => (
            <span className="ability-plate positive" key={pitch.name}>
              {pitch.name} <b>{known ? pitch.level : "調査中"}</b>
            </span>
          ))}
        </>
      ) : (
        <span className="ability-plate neutral">
          弾道 <b>{known ? p.trajectory : "未確定"}</b>
        </span>
      )}
      <span className="ability-plate positive">{p.trait}</span>
      <span className={`ability-plate ${p.injured ? "negative" : "condition"}`}>
        {p.injured ? `故障あと${p.injured}日` : "故障なし"}
      </span>
    </div>
  );
}
