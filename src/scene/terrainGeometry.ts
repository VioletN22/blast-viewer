import { BufferAttribute, BufferGeometry, Color } from 'three'
import { groundAfterBlast } from '../sim/field'
import type { DrillHole, Terrain } from '../sim/types'

const TOP = new Color('#77716a')
const FACE = new Color('#4a4642')
const FLOOR = new Color('#5c5853')
const BLASTED = new Color('#3d3a37')

/** Box blur of a row-major grid, radius r, clamped at the edges. */
function blur(src: Float32Array, cols: number, rows: number, r: number): Float32Array {
  const tmp = new Float32Array(src.length)
  const out = new Float32Array(src.length)
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      let s = 0
      for (let k = -r; k <= r; k++) s += src[j * cols + Math.min(cols - 1, Math.max(0, i + k))]
      tmp[j * cols + i] = s / (2 * r + 1)
    }
  }
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      let s = 0
      for (let k = -r; k <= r; k++) s += tmp[Math.min(rows - 1, Math.max(0, j + k)) * cols + i]
      out[j * cols + i] = s / (2 * r + 1)
    }
  }
  return out
}

/**
 * Grid mesh of the terrain. With holes, the surface is the post-blast ground
 * (groundAfterBlast: the floor inside the blasted footprint). In 'ghost' mode
 * it is the pre-blast bench over the footprint only (plus a one-cell skirt),
 * for the translucent showBefore shell. Normals come from
 * a blurred copy of the heights so the per-vertex noise does not speckle the
 * shading; positions keep the exact heights.
 */
export function buildTerrainGeometry(t: Terrain, holes: DrillHole[] | null, mode: 'surface' | 'ghost' = 'surface'): BufferGeometry {
  const ghost = mode === 'ghost' && holes !== null
  const { cols, rows } = t
  const { width, depth, resolution: res, benchHeight } = t.options
  const n = cols * rows
  const h = new Float32Array(n)
  const blasted = new Uint8Array(n)
  for (let j = 0; j < rows; j++) {
    const z = -depth / 2 + j * res
    for (let i = 0; i < cols; i++) {
      const k = j * cols + i
      const x = -width / 2 + i * res
      const pre = t.heights[k]
      if (holes) {
        const g = groundAfterBlast(x, z, holes, t)
        // groundAfterBlast is the floor (0) inside the footprint, terrain elsewhere.
        if (g === 0 && pre > 0.5) {
          // The ghost keeps the pre-blast height over the footprint; the surface drops to the floor.
          h[k] = ghost ? pre : 0
          blasted[k] = 1
        } else h[k] = pre
      } else h[k] = pre
    }
  }
  const hs = blur(h, cols, rows, 2)
  const pos = new Float32Array(n * 3)
  const nor = new Float32Array(n * 3)
  const col = new Float32Array(n * 3)
  const c = new Color()
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const k = j * cols + i
      pos[k * 3] = -width / 2 + i * res
      pos[k * 3 + 1] = h[k]
      pos[k * 3 + 2] = -depth / 2 + j * res
      const dx = (hs[j * cols + Math.min(cols - 1, i + 1)] - hs[j * cols + Math.max(0, i - 1)]) / (2 * res)
      const dz = (hs[Math.min(rows - 1, j + 1) * cols + i] - hs[Math.max(0, j - 1) * cols + i]) / (2 * res)
      const len = Math.hypot(dx, 1, dz)
      nor[k * 3] = -dx / len
      nor[k * 3 + 1] = 1 / len
      nor[k * 3 + 2] = -dz / len
      // Colour: bench top and floor by height, darker on steep ground, darkest on the blasted floor.
      const ny = 1 / len
      const flat = Math.min(1, Math.max(0, (ny - 0.55) / 0.35))
      c.copy(FLOOR).lerp(TOP, Math.min(1, Math.max(0, h[k] / benchHeight)))
      c.lerp(FACE, 1 - flat)
      if (blasted[k]) c.lerp(BLASTED, 0.7)
      col[k * 3] = c.r
      col[k * 3 + 1] = c.g
      col[k * 3 + 2] = c.b
    }
  }
  const idx = new Uint32Array((cols - 1) * (rows - 1) * 6)
  let m = 0
  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < cols - 1; i++) {
      const a = j * cols + i
      const b = a + 1
      const d = a + cols
      const e = d + 1
      // The ghost covers only cells touching the blasted footprint: the removed bench top and face.
      if (ghost && !(blasted[a] || blasted[b] || blasted[d] || blasted[e])) continue
      idx[m++] = a
      idx[m++] = d
      idx[m++] = b
      idx[m++] = b
      idx[m++] = d
      idx[m++] = e
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(pos, 3))
  g.setAttribute('normal', new BufferAttribute(nor, 3))
  g.setAttribute('color', new BufferAttribute(col, 3))
  g.setIndex(new BufferAttribute(m === idx.length ? idx : idx.slice(0, m), 1))
  g.computeBoundingSphere()
  return g
}

/** Earliest firing time in the pattern, ms (0 for no holes). */
export function firstFireMs(holes: DrillHole[]): number {
  let m = Infinity
  for (const h of holes) if (h.delayMs < m) m = h.delayMs
  return Number.isFinite(m) ? m : 0
}

/** Latest firing time in the pattern, ms. */
export function lastFireMs(holes: DrillHole[]): number {
  let m = 0
  for (const h of holes) if (h.delayMs > m) m = h.delayMs
  return m
}
