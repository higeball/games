import { describe, expect, it } from 'vitest'
import { draftCandidates } from './cats'
import { POSITIONS } from '../types'

describe('draft candidates', () => {
  it('offers three distinct breeds for every position', () => {
    POSITIONS.forEach((position, round) => {
      const candidates = draftCandidates(42, round)
      expect(candidates).toHaveLength(3)
      expect(new Set(candidates.map(cat => cat.breed)).size).toBe(3)
      expect(candidates.every(cat => cat.position === position)).toBe(true)
    })
  })

  it('repeats the same draft from the same run seed', () => {
    expect(draftCandidates(9001, 5)).toEqual(draftCandidates(9001, 5))
  })

  it('generates special players with roughly 5% probability and boosted abilities', () => {
    let totalCandidates = 0
    let specialCount = 0
    let foundSpecial: any = null

    for (let seed = 1; seed <= 200; seed++) {
      const candidates = draftCandidates(seed, 0)
      totalCandidates += candidates.length
      for (const cat of candidates) {
        if (cat.isSpecial) {
          specialCount++
          if (!foundSpecial) foundSpecial = cat
        }
      }
    }

    expect(specialCount).toBeGreaterThan(15) // ~5% of 600 candidates = ~30
    expect(specialCount).toBeLessThan(50)
    expect(foundSpecial).not.toBeNull()
    expect(foundSpecial.condition).toBe(100)
    expect(foundSpecial.conditionRank).toBe('絶好調')
    expect(foundSpecial.specialTitle).toBeDefined()
    expect(foundSpecial.trait.name).toContain('・極★')
    expect(foundSpecial.stats.contact).toBeGreaterThanOrEqual(7)
  })
})

