import { describe, expect, it } from 'vitest'
import { draftCandidates } from '../content/cats'
import { OPPONENTS } from '../content/opponents'
import type { CatPlayer, MatchState, TacticId } from '../types'
import { createMatch, resolveDecision, simulateToNextDecision } from './match'

function roster(seed = 1234): CatPlayer[] {
  return Array.from({ length: 9 }, (_, round) => draftCandidates(seed, round)[0])
}

function finish(seed: number, policy: 'recommended' | 'opposite') {
  const cats = roster(seed)
  let match: MatchState = simulateToNextDecision(createMatch(cats, OPPONENTS[1], seed), cats)
  let guard = 0
  while (!match.finished && guard < 20) {
    if (!match.pending) match = simulateToNextDecision(match, cats)
    if (match.pending) {
      const tactic = policy === 'recommended'
        ? match.pending.recommended
        : match.pending.options.find(option => option.id !== match.pending?.recommended)!.id as TacticId
      match = simulateToNextDecision(resolveDecision(match, cats, tactic), cats)
    }
    guard += 1
  }
  return match
}

describe('match simulation', () => {
  it('is deterministic for the same seed and decisions', () => {
    expect(finish(777, 'recommended')).toEqual(finish(777, 'recommended'))
  })

  it('always reaches a valid final score', () => {
    const match = finish(21, 'recommended')
    expect(match.finished).toBe(true)
    expect(match.inning).toBeGreaterThanOrEqual(9)
    expect(match.ourScore).toBeGreaterThanOrEqual(0)
    expect(match.theirScore).toBeGreaterThanOrEqual(0)
    expect(match.ourScore).not.toBe(match.theirScore)
  })

  it('rewards context-aware tactics over consistently wrong calls', () => {
    let smartWins = 0
    let poorWins = 0
    for (let seed = 1; seed <= 400; seed += 1) {
      if (finish(seed, 'recommended').won) smartWins += 1
      if (finish(seed, 'opposite').won) poorWins += 1
    }
    expect(smartWins - poorWins).toBeGreaterThanOrEqual(50)
  })
})
