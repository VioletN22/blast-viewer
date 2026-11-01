import type { DrillHole, Terrain } from './types'

/**
 * Displacement field for a bench blast. Illustrative, not predictive.
 *
 * Model: rock moves toward the free face (+z) and slightly outward from the
 * nearest holes. Forward throw decays exponentially with distance behind the
 * crest (near-crest rock about 18 to 30 m, back rows a few metres), scaled by
 * the local charge relative to the default 210.6 kg hole. The end point is then
 * dropped onto a muck-pile surface: thick in front of the face, a thin heaved
 * layer on the bench behind it, so rock never ends below the terrain.
 */

/** Charge of the default hole (0.75 kg/m3 * 4.5 m * 5.2 m * 12 m). Throw scales with sqrt(charge / this). */
export const REF_CHARGE_KG = 210.6
/** e-folding distance of forward throw behind the crest, metres. */
const THROW_DECAY_M = 7
/** Forward throw (m) right at the crest and at the back of the block, for unit charge. */
const THROW_CREST_M = 21
const THROW_BASE_M = 2.5
/** Muck-pile reach in front of the crest and its height as a fraction of the bench. */
const PILE_REACH_M = 34
const PILE_HEIGHT_FRAC = 0.85
/** Heave left on the bench behind the crest (back rows bulk up) and the minimum layer. */
const BACK_HEAVE_M = 1.8
const MIN_LAYER_M = 0.4

/** Hole data laid out for fast neighbour queries (uniform grid, CSR buckets). */
export interface HoleIndex {
  n: number
  x: Float64Array
  z: Float64Array
  charge: Float64Array
  delay: Float64Array
  meanCharge: number
  burden: number
  spacing: number
  /** Blasted block: x in [minX, maxX], z in [minZ, maxZ]. */
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  centreX: number
  sigma: number
  radius: number
  cell: number
  gx0: number
  gz0: number
  gcols: number
  grows: number
  cellStart: Int32Array
  cellHoles: Int32Array
}

const cache = new WeakMap<DrillHole[], { t: Terrain; idx: HoleIndex }>()

/** Builds (or reuses) the neighbour index for a hole list on a terrain. */
export function holeIndex(holes: DrillHole[], t: Terrain): HoleIndex {
  const hit = cache.get(holes)
  if (hit && hit.t === t) return hit.idx
  const idx = buildIndex(holes, t)
  cache.set(holes, { t, idx })
  return idx
}

function buildIndex(holes: DrillHole[], t: Terrain): HoleIndex {
  const n = holes.length
  if (n === 0) throw new Error('holeIndex: no drill holes')
  const x = new Float64Array(n)
  const z = new Float64Array(n)
  const charge = new Float64Array(n)
  const delay = new Float64Array(n)
  let minHX = Infinity
  let maxHX = -Infinity
  let minHZ = Infinity
  let maxHZ = -Infinity
  let sumCharge = 0
  for (let i = 0; i < n; i++) {
    const h = holes[i]
    x[i] = h.x
    z[i] = h.z
    charge[i] = h.chargeKg
    delay[i] = h.delayMs
    sumCharge += h.chargeKg
    if (h.x < minHX) minHX = h.x
    if (h.x > maxHX) maxHX = h.x
    if (h.z < minHZ) minHZ = h.z
    if (h.z > maxHZ) maxHZ = h.z
  }

  // Spacing: smallest x gap within a row; burden: smallest z gap between rows.
  let spacing = Infinity
  let burden = Infinity
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dz = Math.abs(z[j] - z[i])
      const dx = Math.abs(x[j] - x[i])
      if (dz < 1e-6 && dx > 1e-6 && dx < spacing) spacing = dx
      if (dz > 1e-6 && dz < burden) burden = dz
    }
    if (i > 64 && Number.isFinite(spacing) && Number.isFinite(burden)) break
  }
  if (!Number.isFinite(spacing)) spacing = 5.2
  if (!Number.isFinite(burden)) burden = Math.max(1, t.options.crestZ - maxHZ) || 4.5

  const sigma = 0.6 * spacing
  const radius = 2.5 * sigma
  const cell = radius
  const gx0 = minHX - radius
  const gz0 = minHZ - radius
  const gcols = Math.max(1, Math.ceil((maxHX - minHX + 2 * radius) / cell) + 1)
  const grows = Math.max(1, Math.ceil((maxHZ - minHZ + 2 * radius) / cell) + 1)
  const counts = new Int32Array(gcols * grows + 1)
  const cellOf = new Int32Array(n)
  for (let i = 0; i < n; i++) {
    const c = Math.floor((x[i] - gx0) / cell)
    const r = Math.floor((z[i] - gz0) / cell)
    cellOf[i] = r * gcols + c
    counts[cellOf[i] + 1]++
  }
  const cellStart = new Int32Array(gcols * grows + 1)
  for (let k = 1; k <= gcols * grows; k++) cellStart[k] = cellStart[k - 1] + counts[k]
  const fill = cellStart.slice(0, gcols * grows)
  const cellHoles = new Int32Array(n)
  for (let i = 0; i < n; i++) cellHoles[fill[cellOf[i]]++] = i

  return {
    n,
    x,
    z,
    charge,
    delay,
    meanCharge: sumCharge / n,
    burden,
    spacing,
    minX: minHX - spacing / 2,
    maxX: maxHX + spacing / 2,
    minZ: minHZ - burden / 2,
    maxZ: t.options.crestZ,
    centreX: (minHX + maxHX) / 2,
    sigma,
    radius,
    cell,
    gx0,
    gz0,
    gcols,
    grows,
    cellStart,
    cellHoles,
  }
}

/** Index of the hole nearest to (px, pz) in plan. */
export function nearestHole(idx: HoleIndex, px: number, pz: number): number {
  const c0 = Math.floor((px - idx.gx0) / idx.cell)
  const r0 = Math.floor((pz - idx.gz0) / idx.cell)
  let best = -1
  let bestD = Infinity
  for (let r = r0 - 1; r <= r0 + 1; r++) {
    if (r < 0 || r >= idx.grows) continue
    for (let c = c0 - 1; c <= c0 + 1; c++) {
      if (c < 0 || c >= idx.gcols) continue
      const k = r * idx.gcols + c
      for (let m = idx.cellStart[k]; m < idx.cellStart[k + 1]; m++) {
        const i = idx.cellHoles[m]
        const dx = px - idx.x[i]
        const dz = pz - idx.z[i]
        const d = dx * dx + dz * dz
        if (d < bestD) {
          bestD = d
          best = i
        }
      }
    }
  }
  if (best >= 0 && bestD <= idx.cell * idx.cell) return best
  for (let i = 0; i < idx.n; i++) {
    const dx = px - idx.x[i]
    const dz = pz - idx.z[i]
    const d = dx * dx + dz * dz
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  return best
}

/** 1 inside the blasted block, falling to 0 three metres outside it. */
function coverage(idx: HoleIndex, px: number, pz: number): number {
  const ox = Math.max(0, idx.minX - px, px - idx.maxX)
  const oz = Math.max(0, idx.minZ - pz, pz - idx.maxZ)
  return Math.max(0, 1 - Math.hypot(ox, oz) / 3)
}

/** Absolute muck-pile surface height at z, before clamping to the terrain. */
function muckTop(t: Terrain, z: number): number {
  const { benchHeight, crestZ } = t.options
  const s = z - crestZ
  let y: number
  if (s <= 0) y = benchHeight + BACK_HEAVE_M * Math.min(1, -s / 12)
  else if (s < PILE_REACH_M) y = PILE_HEIGHT_FRAC * benchHeight * Math.pow(1 - s / PILE_REACH_M, 1.5)
  else y = 0
  return y
}

/** Lateral taper of the pile thickness outside the block's x extents. */
function flankTaper(idx: HoleIndex, x: number): number {
  const ox = Math.max(0, idx.minX - x, x - idx.maxX)
  return Math.max(0, 1 - ox / 8)
}

/**
 * Final position of rock starting at (px, py, pz), written into out[0..2].
 * throwJ scales the throw, latJ adds lateral metres, layerJ shifts the layer
 * fraction; displacementAt uses neutral jitter (1, 0, 0). Allocation-free.
 */
export function endPoint(
  idx: HoleIndex,
  t: Terrain,
  px: number,
  py: number,
  pz: number,
  throwJ: number,
  latJ: number,
  layerJ: number,
  out: Float64Array | Float32Array,
  o = 0,
): void {
  const cov = coverage(idx, px, pz)
  if (cov <= 0) {
    out[o] = px
    out[o + 1] = py
    out[o + 2] = pz
    return
  }
  const { benchHeight, crestZ } = t.options

  // Local charge and outward offset from the nearby holes (Gaussian weights).
  const inv2s2 = 1 / (2 * idx.sigma * idx.sigma)
  const r2max = idx.radius * idx.radius
  const c0 = Math.floor((px - idx.gx0) / idx.cell)
  const r0 = Math.floor((pz - idx.gz0) / idx.cell)
  let wSum = 0
  let qSum = 0
  let offX = 0
  for (let r = r0 - 1; r <= r0 + 1; r++) {
    if (r < 0 || r >= idx.grows) continue
    for (let c = c0 - 1; c <= c0 + 1; c++) {
      if (c < 0 || c >= idx.gcols) continue
      const k = r * idx.gcols + c
      for (let m = idx.cellStart[k]; m < idx.cellStart[k + 1]; m++) {
        const i = idx.cellHoles[m]
        const dx = px - idx.x[i]
        const dz = pz - idx.z[i]
        const d2 = dx * dx + dz * dz
        if (d2 > r2max) continue
        const w = Math.exp(-d2 * inv2s2)
        wSum += w
        qSum += w * idx.charge[i]
        offX += w * dx
      }
    }
  }
  const q = wSum > 1e-9 ? qSum / wSum : idx.meanCharge
  if (wSum > 1e-9) offX /= wSum
  const cs = Math.min(1.8, Math.max(0.4, Math.sqrt(q / REF_CHARGE_KG)))

  const behind = Math.max(0, crestZ - pz)
  const f = Math.exp(-behind / THROW_DECAY_M)
  const upper = 0.9 + 0.2 * Math.min(1, Math.max(0, py / benchHeight))
  const k = cov * cs * throwJ

  const dz = k * (THROW_BASE_M + THROW_CREST_M * f) * upper
  const dx = k * (offX * (0.4 + 1.2 * f) + 0.08 * (px - idx.centreX) * f) + cov * latJ
  const ex = px + dx
  const ez = pz + dz

  // Drop onto the muck pile, keeping the rock's layer in the bench.
  const ground = t.heightAt(ex, ez)
  const pile = Math.max(muckTop(t, ez), ground + MIN_LAYER_M)
  const thick = (pile - ground) * flankTaper(idx, ex)
  const startTop = Math.max(1e-6, t.heightAt(px, pz))
  const layer = Math.min(1, Math.max(0, py / startTop + layerJ))
  const landed = ground + thick * layer

  out[o] = ex
  out[o + 1] = py + cov * (landed - py)
  out[o + 2] = ez
}

const scratch = new Float64Array(3)

/** Final displacement of rock at p (end minus start), metres. */
export function displacementAt(p: [number, number, number], holes: DrillHole[], t: Terrain): [number, number, number] {
  endPoint(holeIndex(holes, t), t, p[0], p[1], p[2], 1, 0, 0, scratch)
  return [scratch[0] - p[0], scratch[1] - p[1], scratch[2] - p[2]]
}

const DIG_LINE_POINTS = 48

/**
 * Ore/waste boundary at mid-bench (xyz triplets): a gently curving contact that
 * runs from the back of the block to the crest. whenMoved displaces each point.
 */
export function digLine(t: Terrain, holes: DrillHole[], whenMoved: boolean): Float32Array {
  const idx = holeIndex(holes, t)
  const out = new Float32Array(DIG_LINE_POINTS * 3)
  const y = t.options.benchHeight / 2
  const halfSpan = (idx.maxX - idx.minX) / 2
  const z0 = idx.minZ
  const z1 = idx.maxZ
  for (let i = 0; i < DIG_LINE_POINTS; i++) {
    const u = i / (DIG_LINE_POINTS - 1)
    const z = z0 + (z1 - z0) * u
    const x = idx.centreX + halfSpan * (0.12 * (u - 0.5) + 0.05 * Math.sin(u * Math.PI * 3))
    if (whenMoved) {
      endPoint(idx, t, x, y, z, 1, 0, 0, scratch)
      out[i * 3] = scratch[0]
      out[i * 3 + 1] = scratch[1]
      out[i * 3 + 2] = scratch[2]
    } else {
      out[i * 3] = x
      out[i * 3 + 1] = y
      out[i * 3 + 2] = z
    }
  }
  return out
}
