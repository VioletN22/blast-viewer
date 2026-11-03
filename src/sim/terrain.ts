import type { Dem } from './dem'
import { mulberry32, randRange } from './rng'
import { siteHeight, siteToWorld, type Site } from './site'
import { DEFAULT_TERRAIN, type Terrain, type TerrainOptions } from './types'

const BACK_WALL_Z = -60
const NOISE_AMPLITUDE = 0.3

/** Noise-free bench profile: top, sloped free face, lower floor, back wall. */
function baseHeight(z: number, o: TerrainOptions): number {
  const tan = Math.tan((o.faceAngleDeg * Math.PI) / 180)
  let y: number
  if (z < o.crestZ) y = o.benchHeight
  else y = Math.max(0, o.benchHeight - (z - o.crestZ) * tan)
  if (z < BACK_WALL_Z) y += (BACK_WALL_Z - z) * tan
  return y
}

export function generateTerrain(opts: Partial<TerrainOptions> = {}): Terrain {
  const options: TerrainOptions = { ...DEFAULT_TERRAIN, ...opts }
  const { width, depth, resolution } = options
  const cols = Math.round(width / resolution) + 1
  const rows = Math.round(depth / resolution) + 1
  const heights = new Float32Array(cols * rows)
  const rng = mulberry32(options.seed)
  const half = NOISE_AMPLITUDE / 2

  for (let j = 0; j < rows; j++) {
    const z = -depth / 2 + j * resolution
    const base = baseHeight(z, options)
    for (let i = 0; i < cols; i++) {
      heights[j * cols + i] = base + randRange(rng, -half, half)
    }
  }

  return makeTerrain(options, cols, rows, heights)
}

/** Wraps a row-major height grid (col along x from -width/2, row along z from -depth/2) as a Terrain with bilinear heightAt. */
function makeTerrain(options: TerrainOptions, cols: number, rows: number, heights: Float32Array, source: Terrain['source'] = 'synthetic'): Terrain {
  const { width, depth, resolution } = options
  const heightAt = (x: number, z: number): number => {
    const fx = Math.min(cols - 1, Math.max(0, (x + width / 2) / resolution))
    const fz = Math.min(rows - 1, Math.max(0, (z + depth / 2) / resolution))
    const i0 = Math.min(cols - 2, Math.floor(fx))
    const j0 = Math.min(rows - 2, Math.floor(fz))
    const tx = fx - i0
    const tz = fz - j0
    const h00 = heights[j0 * cols + i0]
    const h10 = heights[j0 * cols + i0 + 1]
    const h01 = heights[(j0 + 1) * cols + i0]
    const h11 = heights[(j0 + 1) * cols + i0 + 1]
    return (h00 * (1 - tx) + h10 * tx) * (1 - tz) + (h01 * (1 - tx) + h11 * tx) * tz
  }

  return { options, cols, rows, heights, heightAt, source }
}

/**
 * The model's terrain at a site on a real surface: the DEM resampled into the
 * model frame (crest at z = 0, face toward +z) at opts.resolution, with heights
 * measured from the site's tilted floor plane. The bench height and face angle come from the site.
 */
export function terrainFromDem(dem: Dem, site: Site, opts: Partial<TerrainOptions> = {}): Terrain {
  const options: TerrainOptions = {
    ...DEFAULT_TERRAIN,
    ...opts,
    benchHeight: site.benchHeight,
    faceAngleDeg: site.faceAngleDeg,
    crestZ: 0,
  }
  const { width, depth, resolution } = options
  const cols = Math.round(width / resolution) + 1
  const rows = Math.round(depth / resolution) + 1
  const heights = new Float32Array(cols * rows)
  for (let j = 0; j < rows; j++) {
    const z = -depth / 2 + j * resolution
    for (let i = 0; i < cols; i++) {
      const x = -width / 2 + i * resolution
      const [wx, wz] = siteToWorld(site, x, z)
      heights[j * cols + i] = dem.heightAt(wx, wz) - siteHeight(site, x, 0, z)
    }
  }
  const t = makeTerrain(options, cols, rows, heights, 'dem')
  t.floorAt = (x, z) => siteHeight(site, x, 0, z)
  t.range = [dem.minY, dem.maxY]
  return t
}
