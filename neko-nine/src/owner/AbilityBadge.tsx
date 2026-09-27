import { grade } from "./model";

export function GradeMark({ value }: { value: number }) {
  const rank = grade(value);
  return (
    <strong className={`grade g-${rank}`} data-grade={rank}>
      {rank}
    </strong>
  );
}
export function AbilityBadge({
  label,
  low,
  high = low,
}: {
  label: string;
  low: number;
  high?: number;
}) {
  return (
    <span
      className="ability-chip"
      aria-label={`${label} ${grade(low)}${low === high ? "" : `〜${grade(high)}`} ${low}${low === high ? "" : `〜${high}`}`}
    >
      <small>{label}</small>
      <span className="ability-rank">
        <GradeMark value={low} />
        {low !== high && (
          <>
            <i>〜</i>
            <GradeMark value={high} />
          </>
        )}
      </span>
      <b>
        {low}
        {low !== high && `〜${high}`}
      </b>
    </span>
  );
}
