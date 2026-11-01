import { describe, expect, it } from 'vitest'
import { generateTerrain } from '../terrain'
import { generatePattern } from '../pattern'
import { digLine, displacementAt } from '../field'
import { simulateBlast } from '../blast'

const t = generateTerrain()
const holes = generatePattern(t)
const len = (d: [number, number, number]) => Math.hypot(d[0], d[1], d[2])

describe('field', () => {
  it('field: front-row rock moves toward +z', () => {
    const d = displacementAt([0, 6, -4.5], holes, t)
    expect(d[2]).toBeGreaterThan(5)
  })
  it('field: throw decays with distance behind the crest', () => {
    const near = len(displacementAt([0, 6, -4], holes, t))
    const far = len(displacementAt([0, 6, -25], holes, t))
    expect(near).toBeGreaterThan(far)
  })
  it('field: end points never below the floor', () => {
    const f = simulateBlast(t, holes, { fragmentsPerHole: 9, seed: 3 })
    const n = Math.min(1000, f.count)
    expect(n).toBe(1000)
    for (let i = 0; i < n; i++) {
      const x = f.end[i * 3]
      const y = f.end[i * 3 + 1]
      const z = f.end[i * 3 + 2]
      expect(y).toBeGreaterThanOrEqual(t.heightAt(x, z) - 0.01)
    }
  })
  it('field: rock away from the pattern does not move', () => {
    const d = displacementAt([0, 12, -50], holes, t)
    expect(len(d)).toBeLessThan(0.01)
  })
  it('digLine moved differs from unmoved by at least 2 m somewhere', () => {
    const a = digLine(t, holes, false)
    const b = digLine(t, holes, true)
    expect(a.length).toBe(b.length)
    expect(a.length % 3).toBe(0)
    let max = 0
    for (let i = 0; i < a.length; i += 3) {
      max = Math.max(max, Math.hypot(b[i] - a[i], b[i + 1] - a[i + 1], b[i + 2] - a[i + 2]))
    }
    expect(max).toBeGreaterThanOrEqual(2)
    expect(a[1]).toBeCloseTo(t.options.benchHeight / 2)
  })
})
