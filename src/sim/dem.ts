/**
 * A gridded elevation model in a local metric frame: x east, z south (so
 * north is -z), y up, all in metres. The grid is centred on the origin, and
 * node (i, j) sits at x = (i - (cols - 1) / 2) * cell, z = (j - (rows - 1) / 2) * cell.
 */
export interface DemMeta {
  name: string
  source: string
  imagerySources: string[]
  fetched: string
  zoom: number
  cols: number
  rows: number
  cellM: number
  bounds: { west: number; east: number; north: number; south: number }
  centreMga51: { easting: number; northing: number }
  heightOffsetM: number
  heightStepM: number
  minM: number
  maxM: number
  despikedSamples: number
}

export interface Dem {
  cols: number
  rows: number
  cell: number
  /** Row-major heights in metres, row j runs west to east, rows run north to south. */
  heights: Float32Array
  minY: number
  maxY: number
  /** Half extents of the grid, metres: x in [-halfX, halfX], z in [-halfZ, halfZ]. */
  halfX: number
  halfZ: number
  meta: DemMeta | null
  /** Bilinear height at (x, z), clamped to the grid. */
  heightAt(x: number, z: number): number
  inside(x: number, z: number, margin?: number): boolean
}

export function makeDem(cols: number, rows: number, cell: number, heights: Float32Array, meta: DemMeta | null = null): Dem {
  if (cols < 2 || rows < 2) throw new Error('DEM: the grid needs at least 2 x 2 samples')
  if (heights.length !== cols * rows) throw new Error(`DEM: expected ${cols * rows} heights, got ${heights.length}`)
  if (!(cell > 0)) throw new Error('DEM: the cell size must be greater than 0')
  let minY = Infinity
  let maxY = -Infinity
  for (const h of heights) {
    if (h < minY) minY = h
    if (h > maxY) maxY = h
  }
  const halfX = ((cols - 1) * cell) / 2
  const halfZ = ((rows - 1) * cell) / 2
  const heightAt = (x: number, z: number): number => {
    const fx = Math.min(cols - 1, Math.max(0, (x + halfX) / cell))
    const fz = Math.min(rows - 1, Math.max(0, (z + halfZ) / cell))
    const i0 = Math.min(cols - 2, Math.floor(fx))
    const j0 = Math.min(rows - 2, Math.floor(fz))
    const tx = fx - i0
    const tz = fz - j0
    const k = j0 * cols + i0
    return (heights[k] * (1 - tx) + heights[k + 1] * tx) * (1 - tz) + (heights[k + cols] * (1 - tx) + heights[k + cols + 1] * tx) * tz
  }
  const inside = (x: number, z: number, margin = 0) => Math.abs(x) <= halfX - margin && Math.abs(z) <= halfZ - margin
  return { cols, rows, cell, heights, minY, maxY, halfX, halfZ, meta, heightAt, inside }
}

/** Grid from decoded 16-bit samples: height = offset + value * step. */
export function demFromSamples(values: Uint16Array, meta: DemMeta): Dem {
  const h = new Float32Array(values.length)
  for (let k = 0; k < values.length; k++) h[k] = meta.heightOffsetM + values[k] * meta.heightStepM
  return makeDem(meta.cols, meta.rows, meta.cellM, h, meta)
}
