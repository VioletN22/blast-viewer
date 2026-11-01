import { describe, expect, it } from 'vitest'
import { digLine } from '../../sim/field'
import { buildScenario } from '../../sim/scenario'
import { buildDigZone, digZoneAt } from '../digZone'

const sc = buildScenario({ seed: 1, scale: 1 })

describe('dig zone animation', () => {
  it('starts at the unmoved outline and ends exactly at digLine(..., true)', () => {
    const z = buildDigZone(sc)
    const out = new Float32Array(z.from.length)
    digZoneAt(z, 0, out)
    expect(Array.from(out)).toEqual(Array.from(digLine(sc.terrain, sc.holes, false)))
    digZoneAt(z, sc.durationMs, out)
    expect(Array.from(out)).toEqual(Array.from(digLine(sc.terrain, sc.holes, true)))
  })
})
