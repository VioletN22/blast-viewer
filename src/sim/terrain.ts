import { mulberry32, randRange } from './rng'
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

  return { options, cols, rows, heights, heightAt }
}
