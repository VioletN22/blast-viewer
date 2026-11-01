import { describe, expect, it } from 'vitest'
import { formatPerf } from '../perfFormat'

describe('formatPerf', () => {
  it('rounds fps and groups thousands', () => {
    expect(formatPerf({ fps: 59.6, calls: 18, triangles: 412_345, instances: 2880 })).toEqual([
      '60 fps',
      '18 draw calls',
      '412k triangles',
      '2,880 instances',
    ])
  })
  it('keeps small triangle counts exact and handles zeros', () => {
    expect(formatPerf({ fps: 0, calls: 0, triangles: 950, instances: 0 })).toEqual([
      '0 fps',
      '0 draw calls',
      '950 triangles',
      '0 instances',
    ])
  })
  it('uses one decimal for millions and singular forms', () => {
    const l = formatPerf({ fps: 60, calls: 1, triangles: 1_250_000, instances: 1 })
    expect(l[1]).toBe('1 draw call')
    expect(l[2]).toBe('1.3M triangles')
    expect(l[3]).toBe('1 instance')
  })
})

describe('formatPerf edge', () => {
  it('999,600 triangles is 1.0M, not 1000k', () => {
    expect(formatPerf({ fps: 60, calls: 2, triangles: 999_600, instances: 2 })[2]).toBe('1.0M triangles')
  })
})
