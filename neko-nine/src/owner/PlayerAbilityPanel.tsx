import { estimate } from "./engine";
import { type Player, type WorldState } from "./model";
import { AbilityBadge } from "./AbilityBadge";
import { ProfileAbilities } from "./ProfileAbilities";
import { BatterAbilityPanel } from "./BatterAbilityPanel";
import {
  experiencedTryout,
  pitchLevelEstimate,
  rangeLabel,
  velocityEstimate,
} from "./scouting";

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
  const arrows =
    mirror === 1 ? ["←", "↙", "↓", "↘", "→"] : ["→", "↘", "↓", "↙", "←"];
  return (
    <section className="pitch-repertoire" aria-label="球種と変化量">
      <h3>球種・変化量</h3>
      <div className="pitch-repertoire-body">
        <div className="pitch-chart">
          <div className="pitch-straight">↑ ストレート</div>
          <svg
            viewBox="0 0 220 156"
            role="img"
            aria-label="変化球の方向と7段階の変化量"
          >
            {ends.map(([ex, ey], index) => {
              const pitches = p.pitches.filter(
                (pitch) => direction(pitch.name) === index,
              );
              const level = known
                ? Math.max(0, ...pitches.map((pitch) => pitch.level))
                : 0;
              const x = 110 + (ex - 110) * mirror;
              const t = known ? 0.25 + (Math.min(7, level) / 7) * 0.75 : 1;
              const targetX = 110 + (x - 110) * t,
                targetY = 58 + (ey - 58) * t;
              const angle = Math.atan2(ey - 58, x - 110);
              return (
                <g key={index}>
                  <line
                    x1="110"
                    y1="58"
                    x2={x}
                    y2={ey}
                    stroke="#d2d5c8"
                    strokeWidth="2"
                  />
                  {!!pitches.length && (
                    <>
                      <line
                        x1="110"
                        y1="58"
                        x2={targetX}
                        y2={targetY}
                        stroke="#24628c"
                        strokeWidth="3"
                        strokeDasharray={known ? undefined : "4 4"}
                      />
                      <path
                        d={`M${targetX - 8 * Math.cos(angle - 0.5)} ${targetY - 8 * Math.sin(angle - 0.5)} L${targetX} ${targetY} L${targetX - 8 * Math.cos(angle + 0.5)} ${targetY - 8 * Math.sin(angle + 0.5)}`}
                        fill="none"
                        stroke="#24628c"
                        strokeWidth="3"
                      />
                    </>
                  )}
                </g>
              );
            })}
            <path
              d="M110 58 V14 M106 20 L110 14 L114 20"
              stroke="#24628c"
              strokeWidth="2"
              fill="none"
            />
            <circle cx="110" cy="58" r="10" fill="#f8f7ef" stroke="#71786f" />
          </svg>
          <small>
            {known
              ? "矢印の長さ＝変化量"
              : experiencedTryout(p)
                ? "破線＝変化量は推定"
                : "破線＝変化量は未調査"}
          </small>
        </div>
        <div className="pitch-list">
          <div className="pitch-list-heading">
            <span>球種</span>
            <span>変化量</span>
          </div>
          <ul className="pitch-labels">
            {p.pitches.map((pitch) => {
              const range = known
                ? { low: pitch.level, high: pitch.level }
                : pitchLevelEstimate(p, pitch.level);
              const label = range ? rangeLabel(range) : "未調査";
              return (
                <li
                  key={pitch.name}
                  aria-label={`${pitch.name} 変化量 ${label}`}
                >
                  <span aria-hidden="true">
                    {arrows[direction(pitch.name)]}
                  </span>
                  <span>{pitch.name}</span>
                  <b>{range ? label : "？"}</b>
                </li>
              );
            })}
          </ul>
          {!p.pitches.length && <p>変化球の登録なし</p>}
          <small>変化量は1〜7段階</small>
        </div>
      </div>
    </section>
  );
}

export function PlayerAbilityPanel({ p, w }: { p: Player; w: WorldState }) {
  if (p.position !== "投") return <BatterAbilityPanel p={p} w={w} />;
  const known = p.team === 0 || p.scouting >= 100;
  return (
    <section
      className="player-ability-panel pitcher-ability-panel"
      aria-label="投手能力画面"
    >
      <header className="ability-panel-title">
        <strong>投手能力</strong>
        <span>
          {p.throws}投{p.bats}打
        </span>
      </header>
      <div className="batter-primary pitcher-primary" aria-label="投球能力">
        <div className="pitcher-velocity">
          <small>球速</small>
          <b>{rangeLabel(velocityEstimate(p))}</b>
          <span>km/h</span>
        </div>
        {(["control", "stamina"] as const).map((key) => {
          const range = estimate(w, p, key);
          return (
            <AbilityBadge
              key={key}
              label={key === "control" ? "制球" : "スタミナ"}
              low={known ? p.skills[key] : range.low}
              high={known ? p.skills[key] : range.high}
            />
          );
        })}
      </div>
      {!known && (
        <p className="pitcher-estimate">
          {experiencedTryout(p)
            ? "能力は実績を踏まえた小幅な推定範囲"
            : "能力は調査に基づく推定範囲"}
        </p>
      )}
      <PitchChart p={p} known={known} />
      <section className="ability-special batter-special" aria-label="特殊能力">
        <h3>特殊能力</h3>
        <ProfileAbilities p={p} known={known} includeBasics={false} />
      </section>
    </section>
  );
}
