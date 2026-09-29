import type { Player } from "./model";
import { pitchLevelEstimate, rangeLabel, velocityEstimate } from "./scouting";

/** Shared neutral plates with blue positive text and red warning text. */
export function ProfileAbilities({
  p,
  known = true,
  includeBasics = true,
}: {
  p: Player;
  known?: boolean;
  includeBasics?: boolean;
}) {
  return (
    <div className="profile-abilities" aria-label="特殊能力・プロフィール">
      {includeBasics &&
        (p.position === "投" ? (
          <>
            <span className="ability-plate neutral">
              球速{" "}
              <b>
                {known
                  ? `${p.velocity}km/h`
                  : `${rangeLabel(velocityEstimate(p))}km/h（推定）`}
              </b>
            </span>
            {p.pitches.map((pitch) => (
              <span className="ability-plate positive" key={pitch.name}>
                {pitch.name}{" "}
                <b>
                  {known
                    ? pitch.level
                    : pitchLevelEstimate(p, pitch.level)
                      ? rangeLabel(pitchLevelEstimate(p, pitch.level)!)
                      : "調査中"}
                </b>
              </span>
            ))}
          </>
        ) : (
          <span className="ability-plate neutral">
            弾道 <b>{known ? p.trajectory : "未確定"}</b>
          </span>
        ))}
      <span className="ability-plate positive">{p.trait}</span>
      <span className={`ability-plate ${p.injured ? "negative" : "condition"}`}>
        {p.injured ? `故障あと${p.injured}日` : "故障なし"}
      </span>
    </div>
  );
}
