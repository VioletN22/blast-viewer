import { describe, expect, it } from 'vitest'
import { mulberry32, randRange } from '../rng'

describe('mulberry32', () => {
  it('same seed gives the same sequence', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    const first = Array.from({ length: 5 }, () => a())
    const second = Array.from({ length: 5 }, () => b())
    expect(first).toEqual(second)
  })

  it('different seeds differ', () => {
    const a = mulberry32(1)
    const b = mulberry32(2)
    const first = Array.from({ length: 5 }, () => a())
    const second = Array.from({ length: 5 }, () => b())
    expect(first).not.toEqual(second)
  })

  it('values are in [0,1)', () => {
    const rng = mulberry32(7)
    for (let i = 0; i < 10000; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('randRange', () => {
  it('stays within [min, max)', () => {
    const rng = mulberry32(3)
    for (let i = 0; i < 1000; i++) {
      const v = randRange(rng, -5, 10)
      expect(v).toBeGreaterThanOrEqual(-5)
      expect(v).toBeLessThan(10)
    }
  })
})
