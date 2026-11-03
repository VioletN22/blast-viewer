import { describe, expect, it } from 'vitest'
import { scaleBar } from '../scaleBar'

describe('scaleBar', () => {
  it('scaleBar: picks the longest round length that fits', () => {
    expect(scaleBar(1, 96)).toEqual({ metres: 50, px: 50, label: '50 m' })
    expect(scaleBar(0.1, 96)).toEqual({ metres: 5, px: 50, label: '5 m' })
    expect(scaleBar(10, 96)!.label).toBe('500 m')
    expect(scaleBar(25, 96)!.label).toBe('2 km')
  })

  it('scaleBar: nothing before the first measure', () => {
    expect(scaleBar(0, 96)).toBeNull()
    expect(scaleBar(Number.NaN, 96)).toBeNull()
  })
})
