import { estimate } from "./engine";
import {
  POSITIONS,
  SKILLS,
  type Player,
  type Skill,
  type WorldState,
} from "./model";
import { AbilityBadge } from "./AbilityBadge";
import { ProfileAbilities } from "./ProfileAbilities";
import { estimationCaption } from "./scouting";

const fieldSpots = {
  中: [50, 12],
  左: [17, 24],
  右: [83, 24],
  遊: [31, 48],
  二: [69, 48],
  三: [15, 67],
  一: [85, 67],
  捕: [50, 87],
} as const;
const positionNames = {
  投: "投手",
  捕: "捕手",
  一: "一塁手",
  二: "二塁手",
  三: "三塁手",
  遊: "遊撃手",
  左: "左翼手",
  中: "中堅手",
  右: "右翼手",
};

/** A presentation-only, shared-data prototype. No new ratings or simulation rules. */
export function BatterAbilityPanel({ p, w }: { p: Player; w: WorldState }) {
  const known = p.team === 0 || p.scouting >= 100;
  const badge = (key: Skill) => {
    const range = estimate(w, p, key);
    return (
      <AbilityBadge
        key={key}
        label={SKILLS[key]}
        low={known ? p.skills[key] : range.low}
        high={known ? p.skills[key] : range.high}
      />
    );
  };
  return (
    <section
      className="player-ability-panel batter-ability-panel"
      aria-label="野手能力画面"
    >
      <header className="ability-panel-title">
        <strong>野手能力</strong>
        <span>
          {p.throws}投{p.bats}打 · {positionNames[p.position]}
        </span>
      </header>
      <div className="batter-primary" aria-label="打撃・走塁能力">
        {(["contact", "power", "speed"] as const).map(badge)}
      </div>
      <div className="batter-trajectory">
        <span>
          弾道 <b>↗ {known ? p.trajectory : "？"}</b>
        </span>
        {!known && <span>{estimationCaption(p)}</span>}
      </div>
      <div className="batter-defense">
        <section className="batter-position" aria-label="守備適性">
          <h3>守備適性</h3>
          <div className="batter-field">
            <svg viewBox="0 0 200 170" aria-hidden="true">
              <path
                d="M100 153 L20 73 Q100 -35 180 73 Z"
                className="field-outfield"
              />
              <path
                d="M100 143 L50 93 L100 43 L150 93 Z"
                className="field-infield"
              />
              <path
                d="M100 143 L50 93 L100 43 L150 93 Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
              />
              <circle
                cx="100"
                cy="98"
                r="5"
                fill="none"
                stroke="currentColor"
              />
            </svg>
            {POSITIONS.filter((position) => position !== "投").map(
              (position) => {
                const spot = fieldSpots[position as keyof typeof fieldSpots];
                const active = p.position === position;
                return (
                  <span
                    key={position}
                    className={`field-position${active ? " main-position" : ""}`}
                    style={{ left: `${spot[0]}%`, top: `${spot[1]}%` }}
                    aria-label={`${position} ${active ? "主守備位置" : "未評価"}`}
                  >
                    {position}
                    {active && <b>主</b>}
                  </span>
                );
              },
            )}
          </div>
          <p>
            主守備：{positionNames[p.position]} <span>／ その他は未評価</span>
          </p>
        </section>
        <section className="batter-fielding" aria-label="守備能力">
          <h3>守備能力</h3>
          <div>{(["catching", "arm", "fielding"] as const).map(badge)}</div>
        </section>
      </div>
      <section className="ability-special batter-special" aria-label="特殊能力">
        <h3>特殊能力</h3>
        <ProfileAbilities p={p} known={known} includeBasics={false} />
      </section>
    </section>
  );
}
