import type { Player } from "./model";

export function ScoutingStatus({ p }: { p: Player }) {
  const old =
    p.scoutingLegacy || (p.scoutingCount === undefined && p.scouting > 0);
  const count = p.scoutingCount ?? 0;
  const last = p.lastScouting;
  return (
    <div className="scouting-status" aria-label={`${p.name}の調査状況`}>
      <div>
        <b>
          {old && !count
            ? "調査済み（回数未記録）"
            : `${old ? "更新後の調査" : "調査"} ${count}回`}
        </b>
        <span>
          調査度 {Math.round(p.scouting)}%
          {p.scouting >= 100 ? " · 調査完了" : ""}
        </span>
      </div>
      <progress aria-label={`${p.name}の調査度`} max={100} value={p.scouting} />
      {last && (
        <p className="scouting-change" aria-live="polite">
          {last.count}回目：{Math.round(last.before)}% →{" "}
          {Math.round(last.after)}% （+{Math.round(last.after - last.before)}%）
        </p>
      )}
    </div>
  );
}
