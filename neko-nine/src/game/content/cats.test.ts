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
})
