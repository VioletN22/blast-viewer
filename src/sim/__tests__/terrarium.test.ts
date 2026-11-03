import { describe, expect, it } from 'vitest'
import { terrariumHeight } from '../terrarium'

describe('terrarium', () => {
  it('terrarium: decodes (R * 256 + G + B / 256) - 32768', () => {
    expect(terrariumHeight(128, 0, 0)).toBe(0)
    expect(terrariumHeight(0, 0, 0)).toBe(-32768)
    expect(terrariumHeight(129, 44, 128)).toBe(300.5)
    expect(terrariumHeight(127, 255, 0)).toBe(-1)
  })
})
