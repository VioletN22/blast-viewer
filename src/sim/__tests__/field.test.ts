import { describe, expect, it } from 'vitest'
import { generateTerrain } from '../terrain'
import { generatePattern } from '../pattern'
import { digLine, displacementAt, groundAfterBlast } from '../field'
import { simulateBlast } from '../blast'

const t = generateTerrain()
const holes = generatePattern(t)
const len = (d: [number, number, number]) => Math.hypot(d[0], d[1], d[2])
const backRowZ = Math.min(...holes.map((h) => h.z))
const burden = Math.min(...holes.filter((h) => h.z > backRowZ + 1e-6).map((h) => h.z - backRowZ))
const backEdgeZ = backRowZ - burden / 2

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
      expect(y).toBeGreaterThanOrEqual(groundAfterBlast(x, z, holes, t) - 0.01)
    }
  })
  it('field: back-row rock does not rise more than 6 m', () => {
    const f = simulateBlast(t, holes, { fragmentsPerHole: 24, seed: 5 })
    const secondBackZ = -22.5
    let n = 0
    for (let i = 0; i < f.count; i++) {
      if (f.start[i * 3 + 2] >= secondBackZ) continue
      n++
      expect(f.end[i * 3 + 1] - f.start[i * 3 + 1]).toBeLessThanOrEqual(6)
      // Back rock ends at about its start x and z (no slot against the back wall).
      expect(Math.abs(f.end[i * 3] - f.start[i * 3])).toBeLessThanOrEqual(2)
      expect(Math.abs(f.end[i * 3 + 2] - f.start[i * 3 + 2])).toBeLessThanOrEqual(2)
    }
    expect(n).toBeGreaterThan(100)
  })
  it('field: ground after the blast is the floor inside the block, terrain outside', () => {
    expect(groundAfterBlast(0, -10, holes, t)).toBe(0)
    expect(groundAfterBlast(0, -50, holes, t)).toBeCloseTo(t.heightAt(0, -50))
    expect(groundAfterBlast(75, -10, holes, t)).toBeCloseTo(t.heightAt(75, -10))
  })
  it('field: back rows heave mostly vertically', () => {
    for (const z of [backRowZ, backEdgeZ]) {
      for (const y of [6, 11]) {
        const d = displacementAt([0, y, z], holes, t)
        expect(d[2]).toBeGreaterThan(0)
        expect(d[1]).toBeGreaterThan(Math.abs(d[2]))
      }
    }
  })
  it('field: displacement tapers smoothly to 0 behind the back row', () => {
    for (const x of [0, 20]) {
      for (const y of [0.5, 6, 11]) {
        let prev = displacementAt([x, y, backRowZ], holes, t)
        for (let k = 1; k <= 12; k++) {
          const d = displacementAt([x, y, backRowZ - 0.5 * k], holes, t)
          expect(Math.hypot(d[0] - prev[0], d[1] - prev[1], d[2] - prev[2])).toBeLessThanOrEqual(1)
          prev = d
        }
        expect(len(prev)).toBeLessThan(0.05)
      }
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
