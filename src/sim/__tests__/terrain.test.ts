import { describe, expect, it } from 'vitest'
import { generateTerrain } from '../terrain'

describe('terrain', () => {
  it('bench top is benchHeight behind the crest', () => {
    const t = generateTerrain()
    expect(Math.abs(t.heightAt(0, -20) - 12)).toBeLessThan(0.5)
  })
  it('floor beyond the toe is about 0', () => {
    const t = generateTerrain()
    expect(Math.abs(t.heightAt(0, 25) - 0)).toBeLessThan(0.5)
  })
  it('same seed same heights', () => {
    const a = generateTerrain({ seed: 3 })
    const b = generateTerrain({ seed: 3 })
    const c = generateTerrain({ seed: 4 })
    expect(Array.from(a.heights)).toEqual(Array.from(b.heights))
    expect(Array.from(a.heights)).not.toEqual(Array.from(c.heights))
  })
  it('clamps outside the grid', () => {
    const t = generateTerrain()
    expect(t.heightAt(1e6, -1e6)).toBe(t.heightAt(80, -70))
  })
})
