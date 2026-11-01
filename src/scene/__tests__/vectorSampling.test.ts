import { describe, expect, it } from 'vitest'
import { vectorSampling } from '../vectorSampling'

describe('vectorSampling', () => {
  it('keeps at most 1500 segments at every scale and never overruns', () => {
    for (const count of [0, 1, 480, 1500, 1501, 3000, 6000, 9600, 48000]) {
      const { step, n } = vectorSampling(count)
      expect(n).toBeLessThanOrEqual(1500)
      if (count > 0) expect((n - 1) * step).toBeLessThan(count)
    }
    expect(vectorSampling(3000)).toEqual({ step: 2, n: 1500 })
  })
})
