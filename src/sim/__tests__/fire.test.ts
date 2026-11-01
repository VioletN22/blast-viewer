import { describe, expect, it } from 'vitest'
import { easeOut, smoothstep } from '../ease'
import { firstFireMs, hasFired, lastFireMs } from '../fire'
import { buildScenario } from '../scenario'

describe('fire', () => {
  it('nothing has fired at t = 0, even a 0 ms hole', () => {
    expect(hasFired(0, 0)).toBe(false)
    expect(hasFired(0, 0.001)).toBe(true)
  })

  it('a hole fires at its delay, not before', () => {
    expect(hasFired(50, 49.9)).toBe(false)
    expect(hasFired(50, 50)).toBe(true)
  })

  it('first and last fire bound the pattern', () => {
    const s = buildScenario({ seed: 3, scale: 1 })
    const delays = s.holes.map((h) => h.delayMs)
    expect(firstFireMs(s.holes)).toBe(Math.min(...delays))
    expect(lastFireMs(s.holes)).toBe(Math.max(...delays))
    expect(firstFireMs([])).toBe(0)
    expect(lastFireMs([])).toBe(0)
  })
})

describe('ease', () => {
  it('both curves run from 0 to 1, ease-out ahead of smoothstep early on', () => {
    for (const f of [easeOut, smoothstep]) {
      expect(f(0)).toBe(0)
      expect(f(1)).toBe(1)
    }
    expect(smoothstep(0.5)).toBe(0.5)
    expect(easeOut(0.25)).toBeGreaterThan(smoothstep(0.25))
  })
})

describe('resolved pattern', () => {
  it('the scenario carries the pattern the holes were built with', () => {
    const s = buildScenario({ seed: 1, scale: 2, pattern: { burden: 5, cols: 3 } })
    expect(s.pattern.burden).toBe(5)
    // Scale overrides cols; the rest falls back to the defaults.
    expect(s.pattern.cols).toBe(30)
    expect(s.pattern.spacing).toBe(5.2)
    const front = s.holes.filter((h) => h.row === 0)
    const back = s.holes.filter((h) => h.row === 1)
    expect(front[0].z - back[0].z).toBeCloseTo(s.pattern.burden)
  })
})
