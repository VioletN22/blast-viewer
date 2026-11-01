import { describe, expect, it } from 'vitest'
import { generateTerrain } from '../terrain'
import { generatePattern } from '../pattern'
import { positionAt, simulateBlast } from '../blast'
import { groundAfterBlast } from '../field'
import { buildScenario } from '../scenario'

const t = generateTerrain()
const holes = generatePattern(t)
const f = simulateBlast(t, holes, { fragmentsPerHole: 24, seed: 11 })
const backRowZ = Math.min(...holes.map((h) => h.z))
const burden = Math.min(...holes.filter((h) => h.z > backRowZ + 1e-6).map((h) => h.z - backRowZ))
const toeZ = t.options.crestZ + t.options.benchHeight / Math.tan((t.options.faceAngleDeg * Math.PI) / 180)

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
      expect(z).toBeLessThanOrEqual(toeZ + 1e-6)
      expect(z).toBeGreaterThanOrEqual(backRowZ - burden / 2 - 1e-6)
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
  it('blast: the face wedge between crest and toe is sampled', () => {
    let wedge = 0
    for (let i = 0; i < f.count; i++) if (f.start[i * 3 + 2] > t.options.crestZ) wedge++
    expect(wedge).toBeGreaterThan(0)
  })
  it('blast: zero holes gives empty fragments', () => {
    const e = simulateBlast(t, [], { fragmentsPerHole: 24, seed: 1 })
    expect(e.count).toBe(0)
    expect(e.maxMagnitude).toBe(0)
    expect(e.start.length).toBe(0)
  })
  it('blast: back rows heave 2 to 5 m at the top of their flight', () => {
    const out = new Float32Array(3)
    let n = 0
    for (let i = 0; i < f.count; i++) {
      if (f.start[i * 3 + 2] >= backRowZ + burden / 2) continue
      n++
      let peak = -Infinity
      for (let k = 1; k < 20; k++) {
        positionAt(f, i, f.fireMs[i] + (f.flightMs[i] * k) / 20, out, 0)
        peak = Math.max(peak, out[1] - f.start[i * 3 + 1])
      }
      expect(peak).toBeGreaterThanOrEqual(2)
      expect(peak).toBeLessThanOrEqual(5)
      expect(peak).toBeGreaterThan(Math.abs(f.end[i * 3 + 2] - f.start[i * 3 + 2]))
    }
    expect(n).toBeGreaterThan(50)
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
  it('positionAt: continuous at fire + e and fire + flight - e (default scenario)', () => {
    const s = buildScenario({ seed: 20261101, scale: 1 })
    const g = s.fragments
    const out = new Float32Array(3)
    const eps = 1e-3
    let worst = 0
    for (let i = 0; i < g.count; i++) {
      const o = i * 3
      positionAt(g, i, g.fireMs[i] + eps, out, 0)
      worst = Math.max(worst, Math.hypot(out[0] - g.start[o], out[1] - g.start[o + 1], out[2] - g.start[o + 2]))
      positionAt(g, i, g.fireMs[i] + g.flightMs[i] - eps, out, 0)
      worst = Math.max(worst, Math.hypot(out[0] - g.end[o], out[1] - g.end[o + 1], out[2] - g.end[o + 2]))
    }
    expect(worst).toBeLessThan(0.01)
  })
  it('positionAt: flight paths never go below the post-blast ground', () => {
    for (const scale of [1, 4] as const) {
      const s = buildScenario({ seed: 20261101, scale })
      const g = s.fragments
      const out = new Float32Array(3)
      let worst = Infinity
      for (let i = 0; i < g.count; i++) {
        for (let k = 1; k < 16; k++) {
          positionAt(g, i, g.fireMs[i] + (g.flightMs[i] * k) / 16, out, 0)
          worst = Math.min(worst, out[1] - groundAfterBlast(out[0], out[2], s.holes, s.terrain))
        }
      }
      // Terrain noise is +/-0.15 m, so allow that much where a path skims the floor.
      expect(worst).toBeGreaterThanOrEqual(-0.16)
    }
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
