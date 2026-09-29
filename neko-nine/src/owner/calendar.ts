import { type WorldState } from "./model";

// Existing saves may be midway through the former combined contract/FA screen.
export function upgradeSerialFlow(w: WorldState) {
  if (w.serialFlowVersion === 1) return false;
  w.serialFlowVersion = 1;
  w.faDeclarations ??= {
    year: w.year,
    ids: w.players.filter((p) => p.market === "fa").map((p) => p.id),
  };
  w.retentionPassed ??= [];
  if (
    w.phase === "contracts" &&
    w.players.some((p) => p.market === "fa" && p.formerTeam === 0)
  ) {
    w.phase = "retain";
    w.retentionReturn = "contracts";
  }
  return true;
}
