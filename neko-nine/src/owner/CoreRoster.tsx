import { ability, roster } from "./engine";
import { POSITIONS, type WorldState } from "./model";
import { AnimalPortrait } from "./AnimalPortrait";
import { AbilityBadge } from "./AbilityBadge";

const battingRate = (hits: number, attempts: number) =>
  attempts ? (hits / attempts).toFixed(3).replace(/^0/, "") : "—";

export function coreRoster(w: WorldState) {
  const list = roster(w).filter((p) => p.registration === "senior");
  const pitchers = list.filter((p) => p.position === "投");
  const starts = [...pitchers]
    .sort(
      (a, b) =>
        (b.reports[w.year]?.starts ?? 0) - (a.reports[w.year]?.starts ?? 0) ||
        b.skills.stamina - a.skills.stamina,
    )
    .slice(0, 3);
  const remaining = pitchers.filter((p) => !starts.includes(p));
  const closer = [...remaining]
    .sort(
      (a, b) =>
        (b.reports[w.year]?.saves ?? 0) - (a.reports[w.year]?.saves ?? 0) ||
        ability(b) - ability(a),
    )
    .slice(0, 1);
  const relievers = remaining
    .filter((p) => !closer.includes(p))
    .sort(
      (a, b) =>
        (b.reports[w.year]?.holds ?? 0) - (a.reports[w.year]?.holds ?? 0) ||
        (b.reports[w.year]?.games ?? 0) - (a.reports[w.year]?.games ?? 0) ||
        ability(b) - ability(a),
    )
    .slice(0, 2);
  const names: Record<string, string> = {
    捕: "捕手",
    一: "一塁手",
    二: "二塁手",
    三: "三塁手",
    遊: "遊撃手",
    左: "左翼手",
    中: "中堅手",
    右: "右翼手",
  };
  return [
    { name: "先発", players: starts },
    { name: "中継ぎ", players: relievers },
    { name: "抑え", players: closer },
    ...POSITIONS.slice(1).map((pos) => ({
      name: names[pos],
      players: list
        .filter((p) => p.position === pos)
        .sort(
          (a, b) =>
            (b.reports[w.year]?.pa ?? 0) - (a.reports[w.year]?.pa ?? 0) ||
            ability(b) - ability(a),
        )
        .slice(0, 1),
    })),
  ];
}
export function CoreRoster({
  w,
  open,
}: {
  w: WorldState;
  open: (id: string) => void;
}) {
  return (
    <section aria-label="ポジション別の主力選手">
      {w.year === 2026 && w.invitationComplete && (
        <section
          className="invitation-summary"
          aria-label="特別招待選手の獲得結果"
        >
          <h2>特別招待選手が入団しました</h2>
          <div className="invitation-arrivals">
            {w.players
              .filter((p) => w.invitationPicks?.includes(p.id) && p.team === 0)
              .map((p) => (
                <div key={p.id}>
                  <AnimalPortrait p={p} />
                  <span>
                    <b>{p.name}</b>
                    <small>
                      {p.position} · {p.age}歳 · 新人
                    </small>
                  </span>
                </div>
              ))}
          </div>
          <p>
            2名を支配下に登録しました。来季の新戦力としてキャンプで育てましょう。
          </p>
        </section>
      )}
      <p>
        今季の出場実績を優先して選出。金枠の選手を軸に、補強と世代交代を考えましょう。
      </p>
      {coreRoster(w).map((group) => (
        <section className="core-group" key={group.name}>
          <h2>{group.name}</h2>
          <div className="core-player-grid">
            {group.players.map((p) => {
              const r = p.reports[w.year];
              const keys =
                p.position === "投"
                  ? (["control", "stamina"] as const)
                  : (["contact", "power", "speed"] as const);
              const labels = {
                control: "制球",
                stamina: "スタミナ",
                contact: "ミート",
                power: "パワー",
                speed: "走力",
              };
              return (
                <article key={p.id}>
                  <div className="core-player-heading">
                    <AnimalPortrait p={p} core />
                    <div>
                      <b>{p.name}</b>
                      <small>
                        {p.age}歳 ／ {p.position}
                      </small>
                    </div>
                  </div>
                  {p.position === "投" ? (
                    <p>
                      {r?.games ?? 0}登板 · {r?.wins ?? 0}勝 {r?.saves ?? 0}S{" "}
                      {r?.holds ?? 0}H
                    </p>
                  ) : (
                    <div
                      className="core-batting-stats"
                      aria-label={`${p.name}の打撃成績`}
                    >
                      <p>
                        {r?.games ?? 0}試合 · 打率
                        {battingRate(r?.hits ?? 0, r?.ab ?? 0)} · {r?.hr ?? 0}本
                        · {r?.rbi ?? 0}打点 · 出塁率
                        {battingRate(
                          (r?.hits ?? 0) + (r?.walks ?? 0),
                          (r?.ab ?? 0) + (r?.walks ?? 0),
                        )}{" "}
                        · {r?.steals ?? 0}盗塁
                      </p>
                    </div>
                  )}
                  <div className="core-abilities">
                    {keys.map((key) => (
                      <AbilityBadge
                        key={key}
                        label={labels[key]}
                        low={p.skills[key]}
                      />
                    ))}
                  </div>
                  <button onClick={() => open(p.id)}>能力・成績を見る</button>
                </article>
              );
            })}
            {!group.players.length && (
              <p className="warning">担当選手がいません。補強が必要です。</p>
            )}
          </div>
        </section>
      ))}
    </section>
  );
}
