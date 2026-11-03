import { describe, expect, it } from 'vitest'
import { makeDem } from '../dem'
import { BENCH_MAX_M, findBench, fitPlane, siteFromBench, siteToWorld, worldToSite } from '../site'
import { steppedDem } from './demFixture'

describe('site', () => {
  it('site: fitPlane recovers a tilted plane', () => {
    const f = fitPlane((x, z) => 50 + 0.2 * x - 0.1 * z, 10, 20, 30, 12, 2)
    expect(f.h).toBeCloseTo(50 + 2 - 2, 6)
    expect(f.gx).toBeCloseTo(0.2, 6)
    expect(f.gz).toBeCloseTo(-0.1, 6)
    expect(f.rms).toBeLessThan(1e-6)
    expect(f.slopeDeg).toBeCloseTo((Math.atan(Math.hypot(0.2, 0.1)) * 180) / Math.PI, 6)
  })

  it('site: fitPlane on turned axes gives the same plane', () => {
    const a = Math.SQRT1_2
    const f = fitPlane((x, z) => 3 * x + 2 * z, 0, 0, 20, 10, 1, a, a)
    expect(f.gx).toBeCloseTo(3, 6)
    expect(f.gz).toBeCloseTo(2, 6)
  })

  it('site: fitPlane measures roughness', () => {
    const f = fitPlane((x) => (Math.round(x) % 2 === 0 ? 1 : -1), 0, 0, 10, 10, 1)
    expect(f.rms).toBeGreaterThan(0.9)
  })

  it('site: findBench on a bench faces down the face and finds the crest', () => {
    const dem = steppedDem()
    const b = findBench(dem.heightAt, -30, 40)!
    expect(b).not.toBeNull()
    // The face drops to the east (+x).
    expect(b.dirX).toBeGreaterThan(0.95)
    expect(Math.abs(b.dirZ)).toBeLessThan(0.3)
    // The crest is at x = 0, give or take the slope window and the grid.
    expect(b.x).toBeGreaterThan(-6)
    expect(b.x).toBeLessThan(6)
    expect(b.topY).toBeCloseTo(100, 0)
    expect(b.benchHeight).toBeGreaterThan(13)
    expect(b.benchHeight).toBeLessThanOrEqual(BENCH_MAX_M)
    expect(b.faceAngleDeg).toBeGreaterThan(25)
    expect(b.faceAngleDeg).toBeLessThan(45)
    expect(b.bench.slopeDeg).toBeLessThan(1)
  })

  it('site: findBench from a point on the face walks back to the crest', () => {
    const b = findBench(steppedDem().heightAt, 10, 0)!
    expect(b).not.toBeNull()
    expect(b.x).toBeLessThan(6)
    expect(b.dirX).toBeGreaterThan(0.95)
  })

  it('site: no face on flat ground', () => {
    const flat = makeDem(50, 50, 5, new Float32Array(2500).fill(10))
    expect(findBench(flat.heightAt, 0, 0)).toBeNull()
  })

  it('site: the frame turns the model +z onto the face direction and back', () => {
    const b = findBench(steppedDem().heightAt, -30, 40)!
    const s = siteFromBench(b)
    expect(s.floorY).toBeCloseTo(b.topY - b.benchHeight, 6)
    const [x0, z0] = siteToWorld(s, 0, 0)
    const [x1, z1] = siteToWorld(s, 0, 10)
    expect(x0).toBeCloseTo(b.x, 6)
    expect(z0).toBeCloseTo(b.z, 6)
    expect((x1 - x0) / 10).toBeCloseTo(b.dirX, 6)
    expect((z1 - z0) / 10).toBeCloseTo(b.dirZ, 6)
    const [lx, lz] = worldToSite(s, ...siteToWorld(s, 12.5, -7))
    expect(lx).toBeCloseTo(12.5, 6)
    expect(lz).toBeCloseTo(-7, 6)
  })
})
