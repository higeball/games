import { SKILLS, type DraftEstimate, type Player } from "./model";
import { GradeMark } from "./AbilityBadge";

export function DraftComparison({
  p,
  before,
}: {
  p: Player;
  before?: DraftEstimate;
}) {
  if (!before)
    return (
      <p className="muted">この旧セーブには指名前の評価記録がありません。</p>
    );
  const keys =
    p.position === "投"
      ? (["control", "stamina"] as const)
      : (["contact", "power", "speed", "catching", "arm", "fielding"] as const);
  return (
    <table className="draft-comparison" aria-label="指名前と獲得後の能力比較">
      <thead>
        <tr>
          <th>能力</th>
          <th>指名前</th>
          <th>獲得後</th>
        </tr>
      </thead>
      <tbody>
        {keys.map((key) => {
          const r = before[key];
          return (
            <tr key={key}>
              <th>{SKILLS[key]}</th>
              <td>
                <GradeMark value={r.low} />
                {r.low !== r.high && (
                  <>
                    〜<GradeMark value={r.high} />
                  </>
                )}
              </td>
              <td>
                <GradeMark value={p.skills[key]} />{" "}
                <small>{p.skills[key]}</small>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
