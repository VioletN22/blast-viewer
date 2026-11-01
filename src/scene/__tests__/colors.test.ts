import { Color } from 'three'
import { describe, expect, it } from 'vitest'
import { delayColor, rampColor } from '../colors'

const lum = (c: Color) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b

describe('colors', () => {
  it('colors: ramp endpoints', () => {
    const lo = rampColor(0, new Color())
    expect(lo.b).toBeGreaterThan(lo.g)
    expect(lo.r).toBeGreaterThan(lo.g)
    expect(lum(lo)).toBeLessThan(0.1)

    const hi = rampColor(1, new Color())
    expect(hi.r).toBeGreaterThan(0.8)
    expect(hi.g).toBeGreaterThan(0.7)
    expect(hi.b).toBeLessThan(0.3)

    let prev = -1
    for (const v of [0, 0.25, 0.5, 0.75, 1]) {
      const l = lum(rampColor(v, new Color()))
      expect(l).toBeGreaterThan(prev)
      prev = l
    }
    // Out-of-range input clamps; the out colour is returned.
    const out = new Color()
    expect(rampColor(2, out)).toBe(out)
    expect(out.equals(hi)).toBe(true)
    expect(delayColor(0, 100, new Color()).equals(rampColor(0, new Color()))).toBe(true)
  })
})
