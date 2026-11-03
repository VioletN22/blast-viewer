import { describe, expect, it } from 'vitest'
import { makeDem } from '../dem'
import { buildScenario, NoBenchError } from '../scenario'
import { siteToWorld } from '../site'
import { validateScenarioParams } from '../validate'
import { steppedDem } from './demFixture'

describe('pit scenario', () => {
  const dem = steppedDem()
  const params = { seed: 7, scale: 1 as const, ground: 'pit' as const, site: { x: -30, z: 0 } }

  it('pit: the pattern sits on the real bench', () => {
    const s = buildScenario(params, dem)
    expect(s.site).not.toBeNull()
    expect(s.terrain.source).toBe('dem')
    expect(s.dem).toBe(dem)
    const site = s.site!
    for (const h of s.holes) {
      const [wx, wz] = siteToWorld(site, h.x, h.z)
      // Every collar is on the DEM surface, behind the crest (west of x = 0).
      expect(site.floorY + h.collarY).toBeCloseTo(dem.heightAt(wx, wz), 1)
      expect(wx).toBeLessThan(0)
    }
  })

  it('pit: rock is thrown through the free face, down the slope', () => {
    const s = buildScenario(params, dem)
    const f = s.fragments
    let dx = 0
    for (let i = 0; i < f.count; i++) {
      const [sx] = siteToWorld(s.site!, f.start[i * 3], f.start[i * 3 + 2])
      const [ex] = siteToWorld(s.site!, f.end[i * 3], f.end[i * 3 + 2])
      dx += ex - sx
    }
    // The face drops to the east, so the mean throw is east.
    expect(dx / f.count).toBeGreaterThan(2)
  })

  it('pit: a point with no face nearby is refused with a reason', () => {
    const flat = makeDem(100, 100, 5, new Float32Array(10000).fill(10))
    expect(() => buildScenario({ ...params, site: { x: 0, z: 0 } }, flat)).toThrow(NoBenchError)
    expect(() => buildScenario({ ...params, site: { x: 480, z: 0 } }, dem)).toThrow(/edge/)
  })

  it('pit: needs the DEM', () => {
    expect(() => buildScenario(params)).toThrow(/terrain loaded/)
  })

  it('pit: the generated bench has no site', () => {
    const s = buildScenario({ seed: 7, scale: 1 })
    expect(s.site).toBeNull()
    expect(s.terrain.source).toBe('synthetic')
  })

  it('pit: params validate ground and site', () => {
    expect(validateScenarioParams({ seed: 1, scale: 1, ground: 'pit', site: { x: 1, z: 2 } })).toEqual({ seed: 1, scale: 1, ground: 'pit', site: { x: 1, z: 2 } })
    expect(() => validateScenarioParams({ seed: 1, scale: 1, ground: 'moon' })).toThrow(/"ground"/)
    expect(() => validateScenarioParams({ seed: 1, scale: 1, site: { x: 1 } })).toThrow(/site.z/)
    expect(() => validateScenarioParams({ seed: 1, scale: 1, site: { x: 1, z: 2, y: 3 } })).toThrow(/"site"/)
  })
})
