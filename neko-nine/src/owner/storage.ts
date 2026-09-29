import { upgradeSerialFlow } from "./calendar";
import type { WorldState, AbilitySnapshot, DraftEstimate } from "./model";
import { PHASE_NAMES, SKILLS, POSITIONS } from "./model";
import { upgradeLegacy, limitContractMeetings } from "./operations";
import { ensureDevelopmentRecord } from "./development";
import { normalizePlayerNames } from "./identity";
import { backfillCareerHistory } from "./history";
import { normalizeSalaryScale } from "./salary";
import { recordStrengthBaseline } from "./experience";
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open("neko-owner-v3", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("saves");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export function validateWorld(value: unknown): asserts value is WorldState {
  const w = value as WorldState;
  if (
    !w ||
    w.version !== 3 ||
    !Number.isInteger(w.year) ||
    w.year < 2026 ||
    !Object.hasOwn(PHASE_NAMES, w.phase) ||
    !Array.isArray(w.teams) ||
    w.teams.length !== 12 ||
    !Array.isArray(w.players) ||
    !Array.isArray(w.staff) ||
    !Array.isArray(w.archives) ||
    !Array.isArray(w.schedule) ||
    !Array.isArray(w.news) ||
    !Array.isArray(w.compensations) ||
    !Array.isArray(w.draftLog) ||
    !Array.isArray(w.activeDraftPool) ||
    !Array.isArray(w.preseasonReport) ||
    !w.campPlan ||
    !Array.isArray(w.campPlan.special) ||
    !Number.isFinite(w.seed)
  )
    throw Error("オーナー版のセーブデータではありません。");
  if (
    new Set(w.players.map((p) => p.id)).size !== w.players.length ||
    w.teams.some(
      (t, i) =>
        t.id !== i ||
        !t.finance ||
        !Number.isFinite(t.finance.cash) ||
        !Number.isFinite(t.finance.salaryBudget) ||
        !Array.isArray(t.activeIds) ||
        !["パ", "セ"].includes(t.league),
    ) ||
    w.players.some(
      (p) =>
        !p.skills ||
        !p.reports ||
        !Number.isFinite(p.age) ||
        !POSITIONS.includes(p.position) ||
        !Array.isArray(p.growth) ||
        !Array.isArray(p.pitches) ||
        !Array.isArray(p.offers) ||
        !Number.isFinite(p.salary) ||
        !["senior", "development"].includes(p.registration) ||
        Object.keys(SKILLS).some(
          (k) =>
            !Number.isFinite(p.skills[k as keyof typeof SKILLS]) ||
            p.skills[k as keyof typeof SKILLS] < 1 ||
            p.skills[k as keyof typeof SKILLS] > 100,
        ) ||
        (p.team !== null &&
          (!Number.isInteger(p.team) || p.team < 0 || p.team > 11)),
    )
  )
    throw Error("選手・球団情報が壊れています。");
  if (
    w.campPlan.location !== undefined &&
    (!Number.isInteger(w.campPlan.location) ||
      w.campPlan.location < 0 ||
      w.campPlan.location > 3)
  )
    throw Error("キャンプ開催地が不正です。");
  const report = w.campReport;
  const validSnapshot = (s: AbilitySnapshot) =>
    s &&
    s.skills &&
    Object.keys(SKILLS).every(
      (k) =>
        Number.isFinite(s.skills[k as keyof typeof SKILLS]) &&
        s.skills[k as keyof typeof SKILLS] >= 1 &&
        s.skills[k as keyof typeof SKILLS] <= 100,
    ) &&
    POSITIONS.includes(s.position) &&
    Number.isFinite(s.velocity) &&
    Array.isArray(s.pitches) &&
    s.pitches.every(
      (p) =>
        p &&
        typeof p.name === "string" &&
        Number.isInteger(p.level) &&
        p.level >= 1 &&
        p.level <= 7,
    );
  const validEstimate = (e: DraftEstimate) =>
    e &&
    Object.keys(SKILLS).every((k) => {
      const r = e[k as keyof typeof SKILLS];
      return (
        r &&
        Number.isFinite(r.low) &&
        Number.isFinite(r.high) &&
        r.low >= 1 &&
        r.high <= 100 &&
        r.low <= r.high
      );
    });
  if (
    (w.developmentBaseline !== undefined &&
      (!w.developmentBaseline ||
        !Number.isInteger(w.developmentBaseline.year) ||
        typeof w.developmentBaseline.label !== "string" ||
        !w.developmentBaseline.players ||
        Object.values(w.developmentBaseline.players).some(
          (s) => !validSnapshot(s),
        ))) ||
    (w.draftPending?.before !== undefined &&
      !validEstimate(w.draftPending.before)) ||
    w.draftLog.some((d) => d.before !== undefined && !validEstimate(d.before))
  )
    throw Error("能力の比較記録が壊れています。");
  const review = w.seasonReview;
  if (
    review !== undefined &&
    (!review ||
      !Number.isInteger(review.year) ||
      typeof review.comparisonLabel !== "string" ||
      !Number.isInteger(review.rank) ||
      review.rank < 1 ||
      review.rank > 6 ||
      !review.team ||
      Object.values(review.team).some((n) => !Number.isFinite(n)) ||
      !review.finance ||
      Object.values(review.finance).some((n) => !Number.isFinite(n)) ||
      !Array.isArray(review.players) ||
      review.players.some(
        (p) =>
          !p ||
          typeof p.id !== "string" ||
          typeof p.name !== "string" ||
          !Number.isFinite(p.age) ||
          !validSnapshot(p.after) ||
          (p.before !== undefined && !validSnapshot(p.before)) ||
          !p.record ||
          ![
            "team",
            "games",
            "wins",
            "losses",
            "saves",
            "holds",
            "outs",
            "earned",
            "k",
            "ab",
            "hits",
            "hr",
            "rbi",
            "steals",
            "pa",
          ].every((k) => Number.isFinite(p.record[k as keyof typeof p.record])),
      ))
  )
    throw Error("年間総括の記録が壊れています。");
  if (
    (w.serialFlowVersion !== undefined && w.serialFlowVersion !== 1) ||
    (w.retentionReturn !== undefined && w.retentionReturn !== "contracts") ||
    (w.retentionPassed !== undefined &&
      (!Array.isArray(w.retentionPassed) ||
        w.retentionPassed.some((id) => typeof id !== "string"))) ||
    (w.faDeclarations !== undefined &&
      (!w.faDeclarations ||
        !Number.isInteger(w.faDeclarations.year) ||
        !Array.isArray(w.faDeclarations.ids) ||
        w.faDeclarations.ids.some((id) => typeof id !== "string")))
  )
    throw Error("FA手続きの記録が壊れています。");
  if (
    w.strengthBaseline &&
    (!Array.isArray(w.strengthBaseline.scores) ||
      w.strengthBaseline.scores.length !== 5 ||
      w.strengthBaseline.scores.some(
        (s) => !s || !Number.isFinite(s.score) || s.score < 0 || s.score > 100,
      ) ||
      !Array.isArray(w.strengthBaseline.players) ||
      w.strengthBaseline.players.some((p) => !p || typeof p.id !== "string"))
  )
    throw Error("戦力の比較記録が壊れています。");
  if (
    report &&
    (!["autumn", "spring"].includes(report.phase) ||
      !Number.isInteger(report.year) ||
      report.year < 2026 ||
      !Number.isInteger(report.location) ||
      report.location < 0 ||
      report.location > 3 ||
      !Number.isFinite(report.cost) ||
      report.cost < 0 ||
      !Array.isArray(report.players) ||
      report.players.some(
        (p) =>
          !p ||
          typeof p.id !== "string" ||
          typeof p.name !== "string" ||
          !POSITIONS.includes(p.positionBefore) ||
          !POSITIONS.includes(p.positionAfter) ||
          !Array.isArray(p.changes) ||
          !Array.isArray(p.pitches) ||
          p.changes.some(
            (c) =>
              !c ||
              !Object.hasOwn(SKILLS, c.skill) ||
              !Number.isInteger(c.before) ||
              c.before < 1 ||
              c.before > 100 ||
              !Number.isInteger(c.after) ||
              c.after < 1 ||
              c.after > 100,
          ) ||
          p.pitches.some(
            (pitch) =>
              !pitch ||
              typeof pitch.name !== "string" ||
              !Number.isInteger(pitch.before) ||
              pitch.before < 0 ||
              pitch.before > 7 ||
              !Number.isInteger(pitch.after) ||
              pitch.after < 1 ||
              pitch.after > 7,
          ),
      ))
  )
    throw Error("キャンプ結果が壊れています。");
}
async function readWorld(backup = false): Promise<WorldState | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("saves", "readonly"),
      r = tx.objectStore("saves").get(backup ? "backup" : "current");
    r.onsuccess = () => {
      try {
        if (r.result) validateWorld(r.result);
        resolve(r.result ?? null);
      } catch (e) {
        reject(e);
      }
    };
    r.onerror = () => reject(r.error);
    tx.oncomplete = () => db.close();
  });
}
export async function loadWorld(backup = false): Promise<WorldState | null> {
  const current = await readWorld(backup);
  if (current) {
    const migrated = upgradeSerialFlow(current);
    const needsDevelopment = !current.developmentBaseline;
    ensureDevelopmentRecord(current);
    const reducedMeetings =
      current.phase === "contracts" && limitContractMeetings(current);
    const needsBaseline = !current.strengthBaseline;
    recordStrengthBaseline(current);
    const renamed = normalizePlayerNames(current);
    const filled = backfillCareerHistory(current);
    const salaries = normalizeSalaryScale(current);
    if (
      (renamed ||
        filled ||
        salaries ||
        needsBaseline ||
        migrated ||
        needsDevelopment ||
        reducedMeetings) &&
      !backup
    )
      await persistWorld(current, false);
    return current;
  }
  if (backup) return current;
  const legacy = await new Promise<unknown>((resolve, reject) => {
    const r = indexedDB.open("neko-owner-v2");
    r.onupgradeneeded = () => {
      r.transaction?.abort();
      resolve(null);
    };
    r.onerror = () => {
      if (r.error?.name === "AbortError") resolve(null);
      else reject(r.error);
    };
    r.onsuccess = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains("saves")) {
        db.close();
        resolve(null);
        return;
      }
      const tx = db.transaction("saves", "readonly"),
        q = tx.objectStore("saves").get("current");
      q.onsuccess = () => resolve(q.result ?? null);
      q.onerror = () => reject(q.error);
      tx.oncomplete = () => db.close();
    };
  });
  if (!legacy) return null;
  const upgraded = upgradeLegacy(legacy);
  upgradeSerialFlow(upgraded);
  ensureDevelopmentRecord(upgraded);
  if (upgraded.phase === "contracts") limitContractMeetings(upgraded);
  normalizePlayerNames(upgraded);
  backfillCareerHistory(upgraded);
  normalizeSalaryScale(upgraded);
  validateWorld(upgraded);
  await persistWorld(upgraded);
  return upgraded;
}
export async function persistWorld(w: WorldState, rotateBackup = true) {
  validateWorld(w);
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("saves", "readwrite"),
      s = tx.objectStore("saves"),
      r = s.get("current");
    r.onsuccess = () => {
      if (r.result && rotateBackup) s.put(r.result, "backup");
      s.put(w, "current");
    };
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.onabort = () => reject(tx.error);
  });
}
export function exportWorld(w: WorldState) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(w)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `neko-owner-${w.year}-${w.phase}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const SAVE_SLOTS = [1, 2, 3] as const;
export type SaveSlotInfo = {
  slot: number;
  savedAt: number;
  year: number;
  phase: WorldState["phase"];
  cash: number;
  damaged?: boolean;
};
function checkSlot(slot: number) {
  if (!SAVE_SLOTS.includes(slot as 1 | 2 | 3))
    throw Error("セーブ枠は1〜3を選んでください。");
}
async function readSlots() {
  const db = await openDB();
  return new Promise<Array<{ world: WorldState; savedAt: number } | null>>(
    (resolve, reject) => {
      const tx = db.transaction("saves", "readonly"),
        values: Array<{ world: WorldState; savedAt: number } | null> = [];
      SAVE_SLOTS.forEach((slot, index) => {
        const r = tx.objectStore("saves").get(`slot-${slot}`);
        r.onsuccess = () => {
          values[index] = r.result ?? null;
        };
      });
      tx.oncomplete = () => {
        db.close();
        resolve(values);
      };
      tx.onabort = tx.onerror = () => {
        db.close();
        reject(tx.error ?? Error("セーブ枠を読み込めませんでした。"));
      };
    },
  );
}
export async function listSaveSlots(): Promise<Array<SaveSlotInfo | null>> {
  const values = await readSlots();
  return values.map((value, index) => {
    if (!value) return null;
    try {
      validateWorld(value.world);
      const w = value.world;
      return {
        slot: index + 1,
        savedAt: value.savedAt,
        year:
          w.year +
          ([
            "budget",
            "staff",
            "spring",
            "preseason",
            "promotion",
            "registration",
          ].includes(w.phase)
            ? 1
            : 0),
        phase: w.phase,
        cash: w.teams[0].finance.cash,
      };
    } catch {
      return {
        slot: index + 1,
        savedAt: 0,
        year: 0,
        phase: "review",
        cash: 0,
        damaged: true,
      };
    }
  });
}
export async function saveWorldSlot(
  slot: number,
  w: WorldState,
  overwrite = false,
) {
  checkSlot(slot);
  validateWorld(w);
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("saves", "readwrite"),
      store = tx.objectStore("saves");
    let failure: Error | null = null;
    const r = store.get(`slot-${slot}`);
    r.onsuccess = () => {
      if (r.result && !overwrite) {
        failure = Error("セーブ枠は使用中です。上書きを確認してください。");
        tx.abort();
        return;
      }
      store.put({ world: w, savedAt: Date.now() }, `slot-${slot}`);
    };
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(failure ?? tx.error ?? Error("セーブできませんでした。"));
    };
  });
}
export async function loadWorldSlot(slot: number): Promise<WorldState> {
  checkSlot(slot);
  const value = (await readSlots())[slot - 1];
  if (!value) throw Error("このセーブ枠は空いています。");
  validateWorld(value.world);
  const w = value.world;
  upgradeSerialFlow(w);
  ensureDevelopmentRecord(w);
  if (w.phase === "contracts") limitContractMeetings(w);
  normalizePlayerNames(w);
  backfillCareerHistory(w);
  normalizeSalaryScale(w);
  return w;
}
