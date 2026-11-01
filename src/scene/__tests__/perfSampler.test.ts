import { describe, expect, it } from 'vitest'
import { newSampler, pushFrame } from '../perfSampler'

describe('perfSampler', () => {
  it('converges to the frame rate and publishes at most every 250 ms', () => {
    const s = newSampler()
    let pushes = 0
    for (let k = 0; k < 180; k++) if (pushFrame(s, 1000 + k * (1000 / 60))) pushes++
    expect(s.fps).toBeGreaterThan(58)
    expect(s.fps).toBeLessThan(62)
    // 3 s of frames: no more than 4 pushes per second
    expect(pushes).toBeLessThanOrEqual(12)
    expect(pushes).toBeGreaterThanOrEqual(10)
  })
  it('clamps a long gap instead of dropping it', () => {
    const s = newSampler()
    pushFrame(s, 1000)
    pushFrame(s, 1016)
    const before = s.fps
    pushFrame(s, 6000)
    expect(s.fps).toBeLessThan(before)
    expect(s.fps).toBeGreaterThan(0)
  })
  it('does not publish before a rate exists', () => {
    expect(pushFrame(newSampler(), 1000)).toBe(false)
  })
})
