import { describe, expect, it } from 'vitest'
import { fireTicks, formatReadout, SPEEDS, DEFAULT_SPEED } from '../timelineFormat'

describe('timeline format', () => {
  it('readout uses grouped whole milliseconds', () => {
    expect(formatReadout(1240.4, 2685.2)).toBe('t = 1,240 ms / 2,685 ms')
    expect(formatReadout(0, 900)).toBe('t = 0 ms / 900 ms')
  })

  it('a time at the end reads as the duration', () => {
    expect(formatReadout(2685.2, 2685.2)).toBe('t = 2,685 ms / 2,685 ms')
  })

  it('one tick per distinct delay, as a fraction of the duration', () => {
    const ticks = fireTicks([0, 25, 25, 50, 0, 100], 200)
    expect(ticks).toEqual([
      { ms: 0, f: 0 },
      { ms: 25, f: 0.125 },
      { ms: 50, f: 0.25 },
      { ms: 100, f: 0.5 },
    ])
  })

  it('speed options and default', () => {
    expect(SPEEDS).toEqual([0.1, 0.25, 0.5, 1])
    expect(DEFAULT_SPEED).toBe(0.25)
  })
})
