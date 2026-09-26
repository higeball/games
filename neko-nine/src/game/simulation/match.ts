import type { CatPlayer, DecisionContext, MatchState, Opponent, TacticId, TacticOption } from '../types'
import { hashSeed, nextRandom } from './rng'

type Outcome = 'out' | 'walk' | 'single' | 'double' | 'homer'

type OutcomeDetail = {
  outcome: Outcome
  kind: 'homer' | 'double' | 'single' | 'walk' | 'out' | 'strikeout' | 'doubleplay'
  text: string
}

const OFFENSE: Array<[TacticId, string, string, string]> = [
  ['contact', 'ミート打ち', '確実にバットへ当てる', '【打率UP】三振を防ぎ出塁を狙う'],
  ['power', 'フルスイング', '長打で一気に走者を返す', '【長打率UP】特大ホームランのチャンス'],
  ['patience', 'じっくり待球', 'ボール球を見極めて歩く', '【四球率UP】相手投手の球数を増やす'],
  ['bunt', 'セーフティバント', '意表をつき走者を進める', '【進塁率UP】確実に走者を次塁へ送る']
]

const DEFENSE: Array<[TacticId, string, string, string]> = [
  ['attack', 'ストライク勝負', '剛速球で強気に押し込む', '【球威UP】早いカウントで追い込む'],
  ['careful', 'コーナーを突く', '長打を警戒して厳しくかわす', '【被長打率DOWN】甘い球を絶対投げない'],
  ['grounder', '低めでゴロ狙い', '低めの変化球で併殺を狙う', '【併殺率UP】ダブルプレーでピンチ脱出'],
  ['strikeout', '空振り三振狙い', 'ウイニングショットで決める', '【三振率UP】三振で走者を釘付け']
]

function average(roster: CatPlayer[], key: keyof CatPlayer['stats']) {
  return roster.reduce((sum, cat) => sum + cat.stats[key], 0) / Math.max(1, roster.length)
}

function recommendedTactic(state: MatchState): TacticId {
  const runners = state.bases.filter(Boolean).length
  const diff = state.ourScore - state.theirScore
  if (state.half === 'bottom') {
    if (state.inning >= 7 && diff < 0) return 'power'
    if (runners > 0 && state.outs === 0 && (state.bases[0] || state.bases[1])) return 'bunt'
    if (runners > 0 && state.outs < 2) return 'contact'
    return state.outs === 0 ? 'patience' : 'contact'
  }
  if (runners >= 2 && state.outs < 2) return 'grounder'
  if (runners > 0 && state.outs === 2) return 'strikeout'
  if (state.inning >= 7 && diff > 0) return 'careful'
  return 'attack'
}

function decisionContext(state: MatchState, roster: CatPlayer[]): DecisionContext {
  const side = state.half === 'bottom' ? 'offense' : 'defense'
  const recommended = recommendedTactic(state)
  const source = side === 'offense' ? OFFENSE : DEFENSE
  const labels = state.bases.map((occupied, index) => occupied ? `${index + 1}塁` : '').filter(Boolean)

  const currentBatter = side === 'offense' && roster.length > 0
    ? roster[state.plateAppearances % roster.length]
    : undefined
  const activePitcher = roster.find(c => c.position === 'P') || roster[0]

  const options: TacticOption[] = source.map(([id, label, description, tacticEffect]) => {
    let hint: '有利' | '五分' | '危険' = '五分'
    if (id === recommended) {
      hint = '有利'
    } else {
      const isOpposite = (recommended === 'power' && id === 'bunt') ||
                         (recommended === 'attack' && id === 'careful') ||
                         (recommended === 'grounder' && id === 'strikeout')
      hint = isOpposite ? '危険' : '五分'
    }
    return { id, label, description, hint, tacticEffect }
  })

  return {
    side,
    title: side === 'offense'
      ? `【攻撃】${currentBatter?.name || '打者'}の打席！どう攻める？`
      : `【守備】${activePitcher?.name || '投手'}のマウンド！どう防ぐ？`,
    situation: `${state.inning}回${state.half === 'top' ? '表（守）' : '裏（攻）'}・${state.outs}アウト・${labels.join('・') || '走者なし'}`,
    recommended,
    options,
    activeCatName: side === 'offense' ? currentBatter?.name : activePitcher?.name,
    activeCatTrait: side === 'offense' ? currentBatter?.trait.name : activePitcher?.trait.name
  }
}

export function createMatch(roster: CatPlayer[], opponent: Opponent, seed: number): MatchState {
  void roster
  return {
    opponent,
    inning: 1,
    half: 'top',
    outs: 0,
    balls: 1,
    strikes: 1,
    bases: [false, false, false],
    ourScore: 0,
    theirScore: 0,
    inningScores: { our: [0], their: [0] },
    hits: { our: 0, their: 0 },
    plateAppearances: 0,
    decisionCount: 0,
    nextDecisionAt: 3,
    rngState: hashSeed(seed, opponent.strength * 100),
    pending: null,
    commentary: [`プレイボール！ ${opponent.name}との熱戦がスタート！`],
    lastPlay: '試合開始',
    finished: false,
    won: null
  }
}

function chooseOutcome(state: MatchState, roster: CatPlayer[], tactic: TacticId | null): [OutcomeDetail, number, boolean] {
  let roll: number
  let rng: number
  ;[roll, rng] = nextRandom(state.rngState)
  const oursBatting = state.half === 'bottom'

  const currentCat = oursBatting
    ? roster[state.plateAppearances % roster.length]
    : roster.find(c => c.position === 'P') || roster[0]

  const catBonus = currentCat ? (currentCat.isSpecial ? 1.5 : (currentCat.condition >= 90 ? 0.8 : 0)) : 0

  const offense = oursBatting
    ? average(roster, 'contact') * 0.55 + average(roster, 'power') * 0.35 + average(roster, 'focus') * 0.1 + catBonus
    : state.opponent.strength
  const defense = oursBatting
    ? state.opponent.strength
    : average(roster, 'pitching') * 0.65 + average(roster, 'defense') * 0.25 + average(roster, 'focus') * 0.1 + catBonus

  const recommended = recommendedTactic(state)
  const goodCall = tactic !== null && tactic === recommended
  const badCall = tactic !== null && tactic !== recommended

  const edge = (offense - defense) * 0.025 +
    (goodCall ? (oursBatting ? 0.12 : -0.12) : 0) +
    (badCall ? (oursBatting ? -0.08 : 0.08) : 0)

  let outLine = Math.max(0.46, Math.min(0.79, 0.67 - edge))
  let walkLine = outLine + 0.08 + (tactic === 'patience' ? 0.06 : 0)
  let singleLine = walkLine + 0.13 + (tactic === 'contact' ? 0.06 : 0) + (tactic === 'bunt' ? 0.08 : 0)
  let doubleLine = singleLine + 0.07 + (tactic === 'power' ? 0.05 : 0)

  if (tactic === 'strikeout' && !oursBatting) {
    outLine = Math.min(0.85, outLine + 0.07)
  }

  let subRoll: number
  ;[subRoll, rng] = nextRandom(rng)

  if (roll < outLine) {
    // アウト判定（決定論的）
    if (state.outs < 2 && state.bases[0] && (tactic === 'grounder' || subRoll < 0.35)) {
      return [{ outcome: 'out', kind: 'doubleplay', text: '併殺打！見事なダブルプレーで2死奪取！' }, rng, goodCall]
    }
    if (subRoll < 0.45) {
      return [{ outcome: 'out', kind: 'strikeout', text: '空振り三振！鋭い決め球で仕留めた！' }, rng, goodCall]
    }
    return [{ outcome: 'out', kind: 'out', text: '打ち取った！打者アウト！' }, rng, goodCall]
  }

  if (roll < walkLine) {
    return [{ outcome: 'walk', kind: 'walk', text: 'フォアボール！じっくり見極めて出塁！' }, rng, goodCall]
  }
  if (roll < singleLine) {
    return [{ outcome: 'single', kind: 'single', text: 'クリーンヒット！走者進塁！チャンス拡大！' }, rng, goodCall]
  }
  if (roll < doubleLine) {
    return [{ outcome: 'double', kind: 'double', text: '右中間を真っ二つ！痛烈なツーベースヒット！' }, rng, goodCall]
  }
  return [{ outcome: 'homer', kind: 'homer', text: '特大ホームラン！！スタンドへ突き刺さる完璧な一撃！' }, rng, goodCall]
}

function scoreRunner(state: MatchState, oursBatting: boolean) {
  const currentInningIdx = state.inning - 1
  if (oursBatting) {
    state.ourScore += 1
    while (state.inningScores.our.length <= currentInningIdx) state.inningScores.our.push(0)
    state.inningScores.our[currentInningIdx] = (state.inningScores.our[currentInningIdx] || 0) + 1
  } else {
    state.theirScore += 1
    while (state.inningScores.their.length <= currentInningIdx) state.inningScores.their.push(0)
    state.inningScores.their[currentInningIdx] = (state.inningScores.their[currentInningIdx] || 0) + 1
  }
}

function applyOutcome(state: MatchState, detail: OutcomeDetail) {
  const oursBatting = state.half === 'bottom'

  if (detail.outcome === 'out') {
    if (detail.kind === 'doubleplay') {
      state.outs += 2
      state.bases[0] = false
    } else {
      state.outs += 1
    }
    state.strikes = 2
    state.balls = 1
    return detail.text
  }

  if (detail.outcome === 'walk') {
    state.balls = 3
    state.strikes = 2
    if (state.bases[0] && state.bases[1] && state.bases[2]) scoreRunner(state, oursBatting)
    state.bases[2] = state.bases[2] || (state.bases[1] && state.bases[0])
    state.bases[1] = state.bases[1] || state.bases[0]
    state.bases[0] = true
    return detail.text
  }

  if (oursBatting) state.hits.our += 1
  else state.hits.their += 1

  state.balls = 1
  state.strikes = 1

  const advance = detail.outcome === 'single' ? 1 : detail.outcome === 'double' ? 2 : 4
  const next: [boolean, boolean, boolean] = [false, false, false]
  state.bases.forEach((occupied, index) => {
    if (!occupied) return
    if (index + advance >= 3) scoreRunner(state, oursBatting)
    else next[index + advance] = true
  })
  if (advance >= 4) scoreRunner(state, oursBatting)
  else next[advance - 1] = true
  state.bases = next

  return detail.text
}

function finishHalf(state: MatchState) {
  if (state.outs < 3) return
  state.outs = 0
  state.balls = 0
  state.strikes = 0
  state.bases = [false, false, false]
  if (state.half === 'top') {
    state.half = 'bottom'
    while (state.inningScores.our.length < state.inning) state.inningScores.our.push(0)
  } else {
    if (state.inning >= 9 && state.ourScore !== state.theirScore) {
      state.finished = true
      state.won = state.ourScore > state.theirScore
    } else {
      state.half = 'top'
      state.inning += 1
      state.inningScores.our.push(0)
      state.inningScores.their.push(0)
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
  const [detail, rng, goodCall] = chooseOutcome(next, roster, tactic)
  next.rngState = rng
  const resultText = applyOutcome(next, detail)
  next.plateAppearances += 1
  next.pending = null
  next.lastPlay = resultText
  next.lastOutcome = detail.kind
  next.lastOutcomeText = detail.text

  if (tactic) {
    next.decisionCount += 1
    next.nextDecisionAt += 4 + (next.decisionCount % 3)
    const prefix = goodCall ? '【采配的中！】' : '【裏目…】'
    next.commentary = [`${prefix} ${resultText}`, ...next.commentary].slice(0, 4)
  } else {
    next.commentary = [resultText, ...next.commentary].slice(0, 4)
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
      state.pending = decisionContext(state, roster)
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
