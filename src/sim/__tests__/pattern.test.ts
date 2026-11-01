import { describe, expect, it } from 'vitest'
import { generateTerrain } from '../terrain'
import { generatePattern } from '../pattern'

const t = generateTerrain()
const holes = generatePattern(t)
const at = (r: number, c: number) => holes.find((h) => h.row === r && h.col === c)!

describe('pattern', () => {
  it('6 x 20 = 120 holes', () => {
    expect(holes).toHaveLength(120)
  })
  it('front row sits one burden behind the crest', () => {
    expect(at(0, 0).z).toBeCloseTo(-4.5)
    expect(at(1, 0).z).toBeCloseTo(-9)
  })
  it('initiation hole fires first at 0 ms', () => {
    expect(at(0, 10).delayMs).toBe(0)
    expect(Math.min(...holes.map((h) => h.delayMs))).toBe(0)
  })
  it('delay grows with distance from initiation col and with row', () => {
    expect(at(0, 12).delayMs).toBe(50)
    expect(at(0, 7).delayMs).toBe(75)
    expect(at(2, 10).delayMs).toBe(134)
    expect(at(0, 13).delayMs).toBeGreaterThan(at(0, 12).delayMs)
  })
  it('staggered rows offset by half a spacing', () => {
    expect(at(1, 0).x - at(0, 0).x).toBeCloseTo(2.6)
    expect(at(2, 0).x).toBeCloseTo(at(0, 0).x)
    const flat = generatePattern(t, { staggered: false })
    expect(flat.find((h) => h.row === 1 && h.col === 0)!.x).toBeCloseTo(at(0, 0).x)
  })
  it('holes are centred on x = 0', () => {
    const xs = holes.filter((h) => h.row === 0).map((h) => h.x)
    expect(Math.min(...xs) + Math.max(...xs)).toBeCloseTo(0)
  })
  it('charge = 0.75 * 4.5 * 5.2 * 12', () => {
    expect(at(0, 0).chargeKg).toBeCloseTo(210.6, 1)
  })
  it('depth and collar', () => {
    const h = at(0, 0)
    expect(h.depth).toBeCloseTo(13.2)
    expect(h.collarY).toBeCloseTo(t.heightAt(h.x, h.z))
    expect(h.id).toBe('H0-0')
  })
})
