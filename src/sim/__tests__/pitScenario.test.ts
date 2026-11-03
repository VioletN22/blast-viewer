import { describe, expect, it } from 'vitest'
import { makeDem } from '../dem'
import { buildScenario, NoBenchError } from '../scenario'
import { siteHeight, siteToWorld } from '../site'
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
      expect(siteHeight(site, h.x, h.collarY, h.z)).toBeCloseTo(dem.heightAt(wx, wz), 1)
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

  it('pit: a point with no face nearby goes to the nearest face and says how far', () => {
    // The face is at x = 0, so a click 300 m west of it lands on its crest about 300 m away.
    const s = buildScenario({ ...params, site: { x: -300, z: 50 } }, dem)
    expect(s.site!.x).toBeGreaterThan(-10)
    expect(s.site!.x).toBeLessThan(10)
    expect(s.movedM).toBeGreaterThan(280)
    expect(s.movedM).toBeLessThan(320)
    // A click at the edge is pulled in first.
    expect(buildScenario({ ...params, site: { x: 495, z: 0 } }, dem).site).not.toBeNull()
  })

  it('pit: only a surface with no face at all is refused', () => {
    const flat = makeDem(100, 100, 5, new Float32Array(10000).fill(10))
    expect(() => buildScenario({ ...params, site: { x: 0, z: 0 } }, flat)).toThrow(NoBenchError)
  })

  it('pit: the floor tilts with the bench', () => {
    const tilted = makeDem(201, 201, 5, Float32Array.from({ length: 201 * 201 }, (_, k) => {
      const x = -500 + (k % 201) * 5
      const z = -500 + Math.floor(k / 201) * 5
      const base = x <= 0 ? 100 : x >= 21 ? 85 : 100 - (x / 21) * 15
      return base + 0.05 * z
    }))
    const s = buildScenario({ ...params, site: { x: -30, z: 0 } }, tilted)
    const site = s.site!
    // The bench rises 5 cm per metre to the south (+z), which is along the model's -x here.
    expect(Math.hypot(site.tiltX, site.tiltZ)).toBeCloseTo(0.05, 2)
    // The floor runs parallel to the bench top: its depth below the top is the same under every hole.
    const depths = s.holes.map((h) => {
      const [, wz] = siteToWorld(site, h.x, h.z)
      return 100 + 0.05 * wz - siteHeight(site, h.x, 0, h.z)
    })
    expect(Math.max(...depths) - Math.min(...depths)).toBeLessThan(0.1)
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
