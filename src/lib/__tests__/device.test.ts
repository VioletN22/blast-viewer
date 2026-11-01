import { describe, expect, it } from 'vitest'
import { deviceDefaults, isPhone } from '../device'

describe('device', () => {
  it('phones start at scale 1 with vectors off', () => {
    expect(deviceDefaults(375, 812)).toEqual({ scale: 1, showVectors: false })
    expect(deviceDefaults(767, 1024)).toEqual({ scale: 1, showVectors: false })
    expect(deviceDefaults(1280, 800)).toEqual({})
  })

  it('a phone in landscape is still a phone (500 px tall or less)', () => {
    expect(isPhone(844, 390)).toBe(true)
    expect(isPhone(932, 430)).toBe(true)
    expect(deviceDefaults(844, 390)).toEqual({ scale: 1, showVectors: false })
  })

  it('matches the phone CSS query: tablets and short desktop windows are not phones', () => {
    expect(isPhone(1024, 500)).toBe(true)
    expect(isPhone(1024, 768)).toBe(false)
    expect(isPhone(1366, 650)).toBe(false)
    expect(isPhone(1366, 1024)).toBe(false)
  })
})
