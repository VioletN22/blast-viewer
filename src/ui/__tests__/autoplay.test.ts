import { describe, expect, it } from 'vitest'
import { AUTOPLAY_DELAY_MS, shouldAutoplay } from '../useAutoplay'

describe('autoplay', () => {
  it('reduced motion does not autoplay', () => {
    expect(shouldAutoplay(true)).toBe(false)
    expect(shouldAutoplay(false)).toBe(true)
  })

  it('waits a moment before playing', () => {
    expect(AUTOPLAY_DELAY_MS).toBeGreaterThanOrEqual(600)
    expect(AUTOPLAY_DELAY_MS).toBeLessThanOrEqual(1000)
  })
})
