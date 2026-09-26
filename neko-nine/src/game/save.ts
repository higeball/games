import type { MetaProgress, RunState, SaveData } from './types'

const SAVE_KEY = 'neko-nine-save-v1'
export const EMPTY_META: MetaProgress = { seasons: 0, championships: 0, discoveredCats: [] }

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return { schemaVersion: 1, activeRun: null, meta: EMPTY_META, muted: false }
    const parsed = JSON.parse(raw) as SaveData
    if (parsed.schemaVersion !== 1) throw new Error('unsupported save')
    return parsed
  } catch {
    return { schemaVersion: 1, activeRun: null, meta: EMPTY_META, muted: false }
  }
}

export function saveGame(activeRun: RunState | null, meta: MetaProgress, muted: boolean) {
  localStorage.setItem(SAVE_KEY, JSON.stringify({ schemaVersion: 1, activeRun, meta, muted } satisfies SaveData))
}

export function clearActiveRun(meta: MetaProgress, muted: boolean) {
  saveGame(null, meta, muted)
}
