import { estimate } from "./engine";
import { completedSeasonYear } from "./history";
import { SKILLS, type Player, type Skill, type WorldState } from "./model";
import { AbilityBadge } from "./AbilityBadge";
import { ProfileAbilities } from "./ProfileAbilities";

const direction = (name: string) =>
  /スライダー|カット/.test(name)
    ? 0
    : /カーブ/.test(name)
      ? 1
      : /フォーク|チェンジアップ/.test(name)
        ? 2
        : /シンカー/.test(name)
          ? 3
          : 4;
export function PitchChart({ p, known }: { p: Player; known: boolean }) {
  const ends = [
    [16, 58],
    [40, 124],
    [110, 144],
    [180, 124],
    [204, 58],
  ];
  const mirror = p.throws === "左" ? -1 : 1;
  return (
    <div className="pitch-chart" aria-label="球種と変化量">
      <svg
        viewBox="0 0 220 174"
        role="img"
        aria-label="変化球の方向と7段階の変化量"
      >
        <circle cx="110" cy="58" r="12" fill="#fff" stroke="#6487b2" />
        <path
          d="M104 51 Q110 58 104 65 M116 51 Q110 58 116 65"
          fill="none"
          stroke="#d26c72"
        />
        <path
          d="M110 44 V15 M106 20 L110 14 L114 20"
          stroke="#6389bc"
          fill="none"
          strokeWidth="2"
        />
        <text x="110" y="9" textAnchor="middle">
          ストレート
        </text>
        {ends.map(([ex, ey], index) => {
          const pitches = p.pitches.filter(
            (pitch) => direction(pitch.name) === index,
          );
          const level = known
            ? Math.max(0, ...pitches.map((pitch) => pitch.level))
            : 0;
          const x = 110 + (ex - 110) * mirror;
          const dx = x - 110,
            dy = ey - 58;
          const rotation = (Math.atan2(dy, dx) * 180) / Math.PI;
          return (
            <g key={index}>
              <line
                x1="110"
                y1="58"
                x2={x}
                y2={ey}
                stroke="#c1ccd9"
                strokeWidth="2"
              />
              {Array.from({ length: 7 }, (_, i) => {
                const t = 0.23 + i * 0.102;
                const rx = 110 + dx * t,
                  ry = 58 + dy * t;
                return (
                  <rect
                    key={i}
                    x={rx - 4}
                    y={ry - 3}
                    width="8"
                    height="6"
                    rx="1"
                    transform={`rotate(${rotation},${rx},${ry})`}
                    fill={i < level ? "#32b8e8" : "#e1e8ef"}
                    stroke="#6487b2"
                    strokeWidth="0.8"
                  />
                );
              })}
              {!!pitches.length && (
                <text
                  x={x}
                  y={ey + (index === 0 || index === 4 ? -10 : 16)}
                  textAnchor={x < 60 ? "start" : x > 160 ? "end" : "middle"}
                >
                  {pitches.map((pitch) => pitch.name).join("/")}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {p.pitches.map((pitch) => (
        <div
          className="pitch-memory"
          key={pitch.name}
          aria-label={`${pitch.name} 変化量 ${known ? pitch.level : "未調査"}`}
        >
          <span>{pitch.name}</span>
          <div>
            {Array.from({ length: 7 }, (_, i) => (
              <i key={i} className={known && i < pitch.level ? "filled" : ""} />
            ))}
            <b>{known ? pitch.level : "？"}</b>
          </div>
        </div>
      ))}
    </div>
  );
}

export function PlayerAbilityPanel({ p, w }: { p: Player; w: WorldState }) {
  const pitching = p.position === "投";
  const known = p.team === 0 || p.scouting >= 100;
  const keys: Skill[] = pitching
    ? ["control", "stamina"]
    : ["contact", "power", "speed", "arm", "fielding", "catching"];
  const year = w.phase === "season" ? w.year : completedSeasonYear(w);
  const r = p.reports[year];
  const stats = pitching
    ? [
        ["登板", `${r?.games ?? 0}試合`],
        ["防御率", r?.outs ? ((r.earned * 27) / r.outs).toFixed(2) : "—"],
        ["勝敗", `${r?.wins ?? 0}勝 ${r?.losses ?? 0}敗`],
        ["セーブ", r?.saves ?? 0],
        ["ホールド", r?.holds ?? 0],
        ["奪三振", r?.k ?? 0],
      ]
    : [
        ["出場", `${r?.games ?? 0}試合`],
        ["打率", r?.ab ? (r.hits / r.ab).toFixed(3).replace(/^0/, "") : "—"],
        ["本塁打", `${r?.hr ?? 0}本`],
        ["打点", r?.rbi ?? 0],
        ["盗塁", r?.steals ?? 0],
        ["安打", r?.hits ?? 0],
      ];
  return (
    <section
      className="player-ability-panel"
      aria-label={pitching ? "投手能力画面" : "野手能力画面"}
    >
      <div className="ability-panel-title">
        {pitching ? "投手能力" : "野手能力"}
        <span>
          {p.throws}投{p.bats}打 · {p.position}
        </span>
      </div>
      <div className="ability-panel-columns">
        <section className="ability-panel-left" aria-label="基本能力">
          {pitching ? (
            <div className="ability-fact">
              <span>球速</span>
              <b>
                {known ? p.velocity : `${p.velocity - 5}〜${p.velocity + 5}`}
              </b>
              <small>km/h{known ? "" : "（推定）"}</small>
            </div>
          ) : (
            <div className="ability-fact trajectory">
              <span>弾道</span>
              <b>↗ {known ? p.trajectory : "？"}</b>
            </div>
          )}
          {keys.map((k) => {
            const e = estimate(w, p, k);
            return (
              <AbilityBadge
                key={k}
                label={k === "control" ? "コントロール" : SKILLS[k]}
                low={known ? p.skills[k] : e.low}
                high={known ? p.skills[k] : e.high}
              />
            );
          })}
          {pitching && <PitchChart p={p} known={known} />}
        </section>
        <div className="ability-panel-right">
          <section className="ability-season" aria-label="直近の一軍成績">
            <h3>{year}年 一軍成績</h3>
            {p.market === "draft" || p.draftYear > year ? (
              <p>プロ入り前</p>
            ) : (
              <>
                <dl>
                  {stats.map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
                {!r?.games && <p>一軍出場なし</p>}
              </>
            )}
          </section>
          <section className="ability-special" aria-label="特殊能力">
            <h3>特殊能力</h3>
            <ProfileAbilities p={p} known={known} includeBasics={false} />
          </section>
        </div>
      </div>
    </section>
  );
}
