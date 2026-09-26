import type { CatPlayer, DecisionContext, MatchState, Opponent, TacticId, TacticOption } from '../types'
import { hashSeed, nextRandom } from './rng'

type Outcome = 'out' | 'walk' | 'single' | 'double' | 'homer'

const OFFENSE: Array<[TacticId, string, string]> = [
  ['contact', 'ミート重視', '確実にバットへ当てる'],
  ['power', 'フルスイング', '長打で一気に返す'],
  ['patience', 'じっくり待つ', 'ボール球を見極める']
]
const DEFENSE: Array<[TacticId, string, string]> = [
  ['attack', 'ストライク勝負', '早いカウントで押し込む'],
  ['careful', '慎重にかわす', '長打を避けてコーナーへ'],
  ['grounder', '低めでゴロ狙い', '走者を進ませない']
]

function average(roster: CatPlayer[], key: keyof CatPlayer['stats']) {
  return roster.reduce((sum, cat) => sum + cat.stats[key], 0) / Math.max(1, roster.length)
}

function recommendedTactic(state: MatchState): TacticId {
  const runners = state.bases.filter(Boolean).length
  const diff = state.ourScore - state.theirScore
  if (state.half === 'bottom') {
    if (state.inning >= 7 && diff < 0) return 'power'
    if (runners > 0 && state.outs < 2) return 'contact'
    return state.outs === 0 ? 'patience' : 'contact'
  }
  if (runners > 0 && state.outs < 2) return 'grounder'
  if (state.inning >= 7 && diff > 0) return 'careful'
  return 'attack'
}

function decisionContext(state: MatchState): DecisionContext {
  const side = state.half === 'bottom' ? 'offense' : 'defense'
  const recommended = recommendedTactic(state)
  const source = side === 'offense' ? OFFENSE : DEFENSE
  const labels = state.bases.map((occupied, index) => occupied ? `${index + 1}塁` : '').filter(Boolean)
  const options: TacticOption[] = source.map(([id, label, description]) => ({
    id, label, description,
    hint: id === recommended ? '有利' : source.findIndex(([value]) => value === id) === 1 ? '五分' : '危険'
  }))
  return {
    side,
    title: side === 'offense' ? 'ここでどう攻める？' : 'ここをどう守る？',
    situation: `${state.inning}回${state.half === 'top' ? '表' : '裏'}・${state.outs}アウト・${labels.join('・') || '走者なし'}`,
    recommended,
    options
  }
}

export function createMatch(roster: CatPlayer[], opponent: Opponent, seed: number): MatchState {
  void roster
  return {
    opponent, inning: 1, half: 'top', outs: 0, bases: [false, false, false],
    ourScore: 0, theirScore: 0, plateAppearances: 0, decisionCount: 0, nextDecisionAt: 3,
    rngState: hashSeed(seed, opponent.strength * 100), pending: null,
    commentary: [`プレイボール！ ${opponent.name}との一戦です。`], lastPlay: '試合開始', finished: false, won: null
  }
}

function chooseOutcome(state: MatchState, roster: CatPlayer[], tactic: TacticId | null): [Outcome, number, boolean] {
  let roll: number
  let rng: number
  ;[roll, rng] = nextRandom(state.rngState)
  const oursBatting = state.half === 'bottom'
  const offense = oursBatting
    ? average(roster, 'contact') * 0.55 + average(roster, 'power') * 0.35 + average(roster, 'focus') * 0.1
    : state.opponent.strength
  const defense = oursBatting
    ? state.opponent.strength
    : average(roster, 'pitching') * 0.65 + average(roster, 'defense') * 0.25 + average(roster, 'focus') * 0.1
  const recommended = recommendedTactic(state)
  const goodCall = tactic !== null && tactic === recommended
  const badCall = tactic !== null && tactic !== recommended
  const edge = (offense - defense) * 0.025 + (goodCall ? (oursBatting ? 0.11 : -0.11) : 0) + (badCall ? (oursBatting ? -0.07 : 0.07) : 0)
  const outLine = Math.max(0.48, Math.min(0.79, 0.67 - edge))
  const walkLine = outLine + 0.08 + (tactic === 'patience' ? 0.05 : 0)
  const singleLine = walkLine + 0.13 + (tactic === 'contact' ? 0.05 : 0)
  const doubleLine = singleLine + 0.07
  const outcome: Outcome = roll < outLine ? 'out' : roll < walkLine ? 'walk' : roll < singleLine ? 'single' : roll < doubleLine ? 'double' : 'homer'
  return [outcome, rng, goodCall]
}

function scoreRunner(state: MatchState, oursBatting: boolean) {
  if (oursBatting) state.ourScore += 1
  else state.theirScore += 1
}

function applyOutcome(state: MatchState, outcome: Outcome) {
  const oursBatting = state.half === 'bottom'
  if (outcome === 'out') {
    state.outs += 1
    return '打ち取った！'
  }
  if (outcome === 'walk') {
    if (state.bases[0] && state.bases[1] && state.bases[2]) scoreRunner(state, oursBatting)
    state.bases[2] = state.bases[2] || (state.bases[1] && state.bases[0])
    state.bases[1] = state.bases[1] || state.bases[0]
    state.bases[0] = true
    return 'フォアボール。走者が出た。'
  }
  const advance = outcome === 'single' ? 1 : outcome === 'double' ? 2 : 4
  const next: [boolean, boolean, boolean] = [false, false, false]
  state.bases.forEach((occupied, index) => {
    if (!occupied) return
    if (index + advance >= 3) scoreRunner(state, oursBatting)
    else next[index + advance] = true
  })
  if (advance >= 4) scoreRunner(state, oursBatting)
  else next[advance - 1] = true
  state.bases = next
  return outcome === 'single' ? 'ヒット！ チャンスが広がる。' : outcome === 'double' ? '長打！ 外野を破った！' : 'ホームラン！ スタンドへ一直線！'
}

function finishHalf(state: MatchState) {
  if (state.outs < 3) return
  state.outs = 0
  state.bases = [false, false, false]
  if (state.half === 'top') state.half = 'bottom'
  else {
    if (state.inning >= 9 && state.ourScore !== state.theirScore) {
      state.finished = true
      state.won = state.ourScore > state.theirScore
    } else {
      state.half = 'top'
      state.inning += 1
      if (state.inning > 12) {
        state.finished = true
        state.won = state.ourScore >= state.theirScore
        if (state.ourScore === state.theirScore) state.ourScore += 1
      }
    }
  }
}

function playPlateAppearance(state: MatchState, roster: CatPlayer[], tactic: TacticId | null) {
  const next = structuredClone(state)
  const [outcome, rng, goodCall] = chooseOutcome(next, roster, tactic)
  next.rngState = rng
  const result = applyOutcome(next, outcome)
  next.plateAppearances += 1
  next.pending = null
  next.lastPlay = result
  if (tactic) {
    next.decisionCount += 1
    next.nextDecisionAt += 4 + (next.decisionCount % 3)
    next.commentary = [`${goodCall ? '采配的中！' : '読みが外れた…'} ${result}`, ...next.commentary].slice(0, 4)
  } else {
    next.commentary = [result, ...next.commentary].slice(0, 4)
  }
  finishHalf(next)
  return next
}

export function simulateToNextDecision(initial: MatchState, roster: CatPlayer[]) {
  let state = structuredClone(initial)
  let guard = 0
  while (!state.finished && !state.pending && guard < 160) {
    const isLateEnough = state.plateAppearances >= state.nextDecisionAt
    if (isLateEnough && state.decisionCount < 10) {
      state.pending = decisionContext(state)
      break
    }
    state = playPlateAppearance(state, roster, null)
    guard += 1
  }
  return state
}

export function resolveDecision(state: MatchState, roster: CatPlayer[], tactic: TacticId) {
  if (!state.pending) return state
  return playPlateAppearance(state, roster, tactic)
}
