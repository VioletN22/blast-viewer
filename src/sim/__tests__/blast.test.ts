import { describe, expect, it } from 'vitest'
import { generateTerrain } from '../terrain'
import { generatePattern } from '../pattern'
import { positionAt, simulateBlast } from '../blast'

const t = generateTerrain()
const holes = generatePattern(t)
const f = simulateBlast(t, holes, { fragmentsPerHole: 24, seed: 11 })

describe('blast', () => {
  it('blast: fragment count = holes * fragmentsPerHole', () => {
    expect(f.count).toBe(holes.length * 24)
    expect(f.start.length).toBe(f.count * 3)
    expect(f.end.length).toBe(f.count * 3)
    expect(f.fireMs.length).toBe(f.count)
    expect(f.flightMs.length).toBe(f.count)
    expect(f.magnitude.length).toBe(f.count)
  })
  it('blast: fragments start inside the blasted block and fire on a hole delay', () => {
    const delays = new Set(holes.map((h) => h.delayMs))
    for (let i = 0; i < f.count; i++) {
      const y = f.start[i * 3 + 1]
      const z = f.start[i * 3 + 2]
      expect(z).toBeLessThanOrEqual(t.options.crestZ)
      expect(z).toBeGreaterThanOrEqual(-27 - 2.25 - 1e-6)
      expect(y).toBeGreaterThanOrEqual(0)
      expect(y).toBeLessThanOrEqual(t.heightAt(f.start[i * 3], z) + 1e-6)
      expect(delays.has(f.fireMs[i])).toBe(true)
      expect(f.flightMs[i]).toBeGreaterThanOrEqual(600)
      expect(f.flightMs[i]).toBeLessThanOrEqual(1600)
    }
  })
  it('blast: near-crest throw is 15 to 30 m, back-row movement is small', () => {
    let front = 0
    let back = 0
    for (let i = 0; i < f.count; i++) {
      const z = f.start[i * 3 + 2]
      if (z > -2) front = Math.max(front, f.end[i * 3 + 2] - z)
      if (z < -25) back = Math.max(back, Math.abs(f.end[i * 3 + 2] - z))
    }
    expect(front).toBeGreaterThan(15)
    expect(front).toBeLessThan(35)
    expect(back).toBeLessThan(6)
    expect(f.maxMagnitude).toBeGreaterThan(15)
  })
  it('positionAt: start before fire, end after flight', () => {
    const out = new Float32Array(6)
    for (const i of [0, 100, f.count - 1]) {
      positionAt(f, i, f.fireMs[i] - 1, out, 3)
      expect(Array.from(out.subarray(3, 6))).toEqual(Array.from(f.start.subarray(i * 3, i * 3 + 3)))
      positionAt(f, i, f.fireMs[i] + f.flightMs[i] + 1, out, 3)
      expect(Array.from(out.subarray(3, 6))).toEqual(Array.from(f.end.subarray(i * 3, i * 3 + 3)))
    }
    expect(out[0]).toBe(0)
  })
  it('positionAt: mid-flight rises above the straight line', () => {
    const out = new Float32Array(3)
    const i = 5
    positionAt(f, i, f.fireMs[i] + f.flightMs[i] / 2, out, 0)
    const midY = (f.start[i * 3 + 1] + f.end[i * 3 + 1]) / 2
    expect(out[1]).toBeGreaterThan(midY)
  })
  it('positionAt is history-free', () => {
    const a = new Float32Array(f.count * 3)
    const b = new Float32Array(f.count * 3)
    for (let i = 0; i < f.count; i++) positionAt(f, i, 3000, a, i * 3)
    for (let i = 0; i < f.count; i++) positionAt(f, i, 500, a, i * 3)
    const fresh = simulateBlast(t, holes, { fragmentsPerHole: 24, seed: 11 })
    for (let i = 0; i < fresh.count; i++) positionAt(fresh, i, 500, b, i * 3)
    expect(Array.from(a)).toEqual(Array.from(b))
  })
})
