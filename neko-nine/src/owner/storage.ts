import type { WorldState } from "./model";
import { PHASE_NAMES, SKILLS, POSITIONS } from "./model";
import { upgradeLegacy } from "./operations";
import { normalizePlayerNames } from "./identity";
import { backfillCareerHistory } from "./history";
import { normalizeSalaryScale } from "./salary";
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
    const renamed = normalizePlayerNames(current);
    const filled = backfillCareerHistory(current);
    const salaries = normalizeSalaryScale(current);
    if ((renamed || filled || salaries) && !backup) await persistWorld(current);
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
  normalizePlayerNames(upgraded);
  backfillCareerHistory(upgraded);
  normalizeSalaryScale(upgraded);
  validateWorld(upgraded);
  await persistWorld(upgraded);
  return upgraded;
}
export async function persistWorld(w: WorldState) {
  validateWorld(w);
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("saves", "readwrite"),
      s = tx.objectStore("saves"),
      r = s.get("current");
    r.onsuccess = () => {
      if (r.result) s.put(r.result, "backup");
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
