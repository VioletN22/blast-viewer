import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { decodeGray16 } from '../../lib/png16'
import { demFromSamples, makeDem, type DemMeta } from '../dem'
import { autoBench } from '../site'
import metaJson from '../../../public/terrain/super-pit.json'

const meta = metaJson as DemMeta

describe('dem', () => {
  it('dem: grid is centred on the origin with x east and z south', () => {
    const d = makeDem(3, 2, 10, Float32Array.from([0, 10, 20, 30, 40, 50]))
    expect(d.halfX).toBe(10)
    expect(d.halfZ).toBe(5)
    expect(d.heightAt(-10, -5)).toBe(0)
    expect(d.heightAt(10, 5)).toBe(50)
    expect(d.heightAt(0, 0)).toBeCloseTo(25)
    // Outside the grid the height clamps to the edge.
    expect(d.heightAt(-99, -99)).toBe(0)
    expect(d.inside(9, 4)).toBe(true)
    expect(d.inside(9, 4, 2)).toBe(false)
    expect(d.minY).toBe(0)
    expect(d.maxY).toBe(50)
  })

  it('dem: rejects a bad grid', () => {
    expect(() => makeDem(1, 5, 1, new Float32Array(5))).toThrow(/2 x 2/)
    expect(() => makeDem(2, 2, 1, new Float32Array(3))).toThrow(/expected 4/)
    expect(() => makeDem(2, 2, 0, new Float32Array(4))).toThrow(/cell size/)
  })

  it('dem: samples map through the offset and step', () => {
    const d = demFromSamples(Uint16Array.from([0, 1, 2, 2000]), { ...meta, cols: 2, rows: 2, cellM: 1, heightOffsetM: 100, heightStepM: 0.05 })
    expect(Array.from(d.heights)).toEqual([100, 100.05, 100.1, 200].map((v) => Math.fround(v)))
  })

  it('dem: the baked Super Pit grid matches its metadata and bounds', async () => {
    const png = await decodeGray16(new Uint8Array(readFileSync(new URL('../../../public/terrain/super-pit.png', import.meta.url))))
    expect(png.width).toBe(meta.cols)
    expect(png.height).toBe(meta.rows)
    // About 8 m per sample, and the pit (30.78 S, 121.50 E) inside the bounds.
    expect(meta.cellM).toBeGreaterThan(7.5)
    expect(meta.cellM).toBeLessThan(10)
    expect(meta.bounds.north).toBeGreaterThan(-30.78)
    expect(meta.bounds.south).toBeLessThan(-30.78)
    expect(meta.bounds.west).toBeLessThan(121.5)
    expect(meta.bounds.east).toBeGreaterThan(121.5)
    const dem = demFromSamples(png.data, meta)
    expect(dem.minY).toBeCloseTo(meta.minM, 0)
    expect(dem.maxY).toBeCloseTo(meta.maxM, 0)
    // The grid spans about 3.4 by 3.9 km.
    expect(2 * dem.halfX).toBeGreaterThan(3000)
    expect(2 * dem.halfZ).toBeGreaterThan(3000)
    // A bench is found inside the pit, well below the rim.
    const b = autoBench(dem)
    expect(b).not.toBeNull()
    expect(b!.topY).toBeLessThan(340)
    expect(b!.bench.slopeDeg).toBeLessThan(5)
  })
})
