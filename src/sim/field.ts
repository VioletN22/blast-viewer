import { smoothstep } from './ease'
import type { DrillHole, Terrain } from './types'

/**
 * Displacement field for a bench blast. Illustrative, not predictive.
 *
 * Model: rock moves toward the free face (+z) and slightly outward from the
 * nearest holes. Forward throw decays exponentially with distance behind the
 * crest (near-crest rock about 18 to 30 m, back rows about a metre, so
 * they heave mostly vertically and settle about in place), scaled by
 * the local charge relative to the default 210.6 kg hole. The end point is then
 * dropped onto a muck-pile surface over the post-blast ground (the floor inside
 * the blasted footprint): the swelled rock heaves a little at the back, slumps
 * forward over the crest and runs out across the floor. Each rock keeps its
 * layer in the pile, so it never ends below the floor nor climbs to the old
 * bench top.
 */

/** Charge of the default hole (0.75 kg/m3 * 4.5 m * 5.2 m * 12 m). Throw scales with sqrt(charge / this). */
export const REF_CHARGE_KG = 210.6
/** e-folding distance of forward throw behind the crest, metres. */
const THROW_DECAY_M = 7
/** Forward throw (m) at the crest for unit charge, decaying behind it; plus a small floor so back rows still creep forward. */
const THROW_CREST_M = 21
const THROW_FLOOR_M = 0.4
/** The field tapers to 0 over this distance outside the blasted footprint (smoothstep), metres. */
const TAPER_M = 3.5
/** Muck-pile reach in front of the crest, metres. */
export const PILE_REACH_M = 34
/** Pile height as a fraction of the bench: at the back of the block (swell plus heave) and at the crest (slumped). */
const PILE_BACK_FRAC = 1.2
const PILE_CREST_FRAC = 0.75
/** Distance behind the crest over which the pile rises from slumped to fully swelled, metres. */
const PILE_RISE_M = 22
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
  /** Blasted block: x in [minX, maxX], z in [minZ, maxZ = crest]; the footprint continues to toeZ. */
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  /** Toe of the face: the blasted footprint runs from minZ to here (the face wedge breaks out too). */
  toeZ: number
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
  /** Scratch for gatherNear: candidate hole indices and their squared plan distances. */
  nearIdx: Int32Array
  nearD2: Float64Array
}

const cache = new WeakMap<DrillHole[], { t: Terrain; idx: HoleIndex }>()

/**
 * Builds (or reuses) the neighbour index for a hole list on a terrain. The
 * cache keys on the array's identity and assumes the holes array (and its
 * holes) is never mutated after first use; build a new array to change holes.
 */
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
    toeZ: t.options.crestZ + t.options.benchHeight / Math.tan((t.options.faceAngleDeg * Math.PI) / 180),
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
    nearIdx: new Int32Array(n),
    nearD2: new Float64Array(n),
  }
}

/**
 * Collects the holes in the 3x3 grid cells around (px, pz) into idx.nearIdx and
 * idx.nearD2 and returns how many there are. Allocation-free; the buffers are
 * overwritten by the next call.
 */
function gatherNear(idx: HoleIndex, px: number, pz: number): number {
  const c0 = Math.floor((px - idx.gx0) / idx.cell)
  const r0 = Math.floor((pz - idx.gz0) / idx.cell)
  const rLo = Math.max(0, r0 - 1)
  const rHi = Math.min(idx.grows - 1, r0 + 1)
  const cLo = Math.max(0, c0 - 1)
  const cHi = Math.min(idx.gcols - 1, c0 + 1)
  let n = 0
  for (let r = rLo; r <= rHi; r++) {
    for (let c = cLo; c <= cHi; c++) {
      const k = r * idx.gcols + c
      for (let m = idx.cellStart[k]; m < idx.cellStart[k + 1]; m++) {
        const i = idx.cellHoles[m]
        const dx = px - idx.x[i]
        const dz = pz - idx.z[i]
        idx.nearIdx[n] = i
        idx.nearD2[n] = dx * dx + dz * dz
        n++
      }
    }
  }
  return n
}

/** Index of the hole nearest to (px, pz) in plan. */
export function nearestHole(idx: HoleIndex, px: number, pz: number): number {
  let best = -1
  let bestD = Infinity
  const n = gatherNear(idx, px, pz)
  for (let m = 0; m < n; m++) {
    if (idx.nearD2[m] < bestD) {
      bestD = idx.nearD2[m]
      best = idx.nearIdx[m]
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

/** 1 inside the blasted footprint, easing (smoothstep) to 0 at TAPER_M outside it. */
function coverage(idx: HoleIndex, px: number, pz: number): number {
  const ox = Math.max(0, idx.minX - px, px - idx.maxX)
  const oz = Math.max(0, idx.minZ - pz, pz - idx.toeZ)
  const u = Math.max(0, 1 - Math.hypot(ox, oz) / TAPER_M)
  return smoothstep(u)
}

/** Ground after the blast for a prepared index: the floor (y = 0) inside the footprint, terrain outside. */
function groundAt(idx: HoleIndex, t: Terrain, x: number, z: number): number {
  if (x >= idx.minX && x <= idx.maxX && z >= idx.minZ && z <= idx.toeZ) return 0
  return t.heightAt(x, z)
}

/**
 * Ground after the blast: inside the blasted footprint (the fragment sampling
 * extents, carried forward to the toe of the face) the bench is gone and the
 * ground is the floor, y = 0; outside it the ground is the terrain.
 */
export function groundAfterBlast(x: number, z: number, holes: DrillHole[], t: Terrain): number {
  if (holes.length === 0) return t.heightAt(x, z)
  return groundAt(holeIndex(holes, t), t, x, z)
}

/**
 * Absolute muck-pile surface height at z, before taking the ground into
 * account. Behind the crest the swelled rock stands about 20 percent above
 * the old bench at the back and slumps to 75 percent at the crest; in front it
 * runs out across the floor. Cross-section area is about 1.28 times the block and wedge (swell).
 */
function muckTop(t: Terrain, z: number): number {
  const { benchHeight, crestZ } = t.options
  const s = z - crestZ
  if (s <= 0) {
    const u = Math.min(1, -s / PILE_RISE_M)
    const rise = smoothstep(u)
    return benchHeight * (PILE_CREST_FRAC + (PILE_BACK_FRAC - PILE_CREST_FRAC) * rise)
  }
  if (s < PILE_REACH_M) return PILE_CREST_FRAC * benchHeight * Math.pow(1 - s / PILE_REACH_M, 1.5)
  return 0
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
  let wSum = 0
  let qSum = 0
  let offX = 0
  const near = gatherNear(idx, px, pz)
  for (let m = 0; m < near; m++) {
    const d2 = idx.nearD2[m]
    if (d2 > r2max) continue
    const i = idx.nearIdx[m]
    const w = Math.exp(-d2 * inv2s2)
    wSum += w
    qSum += w * idx.charge[i]
    offX += w * (px - idx.x[i])
  }
  const q = wSum > 1e-9 ? qSum / wSum : idx.meanCharge
  if (wSum > 1e-9) offX /= wSum
  const cs = Math.min(1.8, Math.max(0.4, Math.sqrt(q / REF_CHARGE_KG)))

  const behind = Math.max(0, crestZ - pz)
  const f = Math.exp(-behind / THROW_DECAY_M)
  const upper = 0.9 + 0.2 * Math.min(1, Math.max(0, py / benchHeight))
  const k = cov * cs * throwJ

  const dz = k * (THROW_FLOOR_M + THROW_CREST_M * f) * upper
  let dx = k * (offX * (0.2 + 1.4 * f) + 0.08 * (px - idx.centreX) * f) + cov * latJ * (0.3 + 0.7 * f)
  const ez = pz + dz

  // Rock may not travel sideways through the intact bench or face beside the
  // block: its plan path must stay inside the footprint's x range until it has
  // cleared the toe. tau is the fraction of the path at which it reaches the toe.
  const tau = ez > idx.toeZ ? Math.max(0, (idx.toeZ - pz) / (ez - pz)) : 1
  if (tau > 0) {
    const lo = Math.min(idx.minX, px)
    const hi = Math.max(idx.maxX, px)
    if (px + tau * dx > hi) dx = (hi - px) / tau
    if (px + tau * dx < lo) dx = (lo - px) / tau
  }
  const ex = px + dx

  // Drop onto the muck pile over the post-blast ground, keeping the rock's
  // layer. Short of the toe the ground under moved rock is the blasted floor.
  const ground = ez < idx.toeZ ? 0 : groundAt(idx, t, ex, ez)
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
  if (holes.length === 0) return [0, 0, 0]
  endPoint(holeIndex(holes, t), t, p[0], p[1], p[2], 1, 0, 0, scratch)
  return [scratch[0] - p[0], scratch[1] - p[1], scratch[2] - p[2]]
}

/** Points on the ore-zone outline, last equal to the first. */
const DIG_LINE_POINTS = 96

/**
 * Ore zone at mid-bench: a closed lens (xyz triplets, last point equals the
 * first) lying diagonally across the block, from near the crest at one side to
 * the back rows at the other, about 40% of the block's plan area. whenMoved
 * displaces each point with endPoint, so the crest end is thrown well over the
 * face and the zone stretches while its back edge barely moves.
 */
export function digLine(t: Terrain, holes: DrillHole[], whenMoved: boolean): Float32Array {
  if (holes.length === 0) return new Float32Array(0)
  const idx = holeIndex(holes, t)
  const out = new Float32Array(DIG_LINE_POINTS * 3)
  const y = t.options.benchHeight / 2
  const halfW = (idx.maxX - idx.minX) / 2
  const halfD = (idx.maxZ - idx.minZ) / 2
  const midZ = (idx.maxZ + idx.minZ) / 2
  // Ellipse with semi-axes 1.0 and 0.5 in block-normalised coordinates (area pi/2 of 4 = 39%), turned 45 degrees
  // so its long axis runs from the crest side at -x to the back rows at +x; a slow wobble keeps it organic.
  const c = Math.SQRT1_2
  const n = DIG_LINE_POINTS - 1
  for (let i = 0; i < DIG_LINE_POINTS; i++) {
    const phi = ((i % n) / n) * Math.PI * 2
    const wob = 1 + 0.07 * Math.sin(3 * phi + 0.6) + 0.04 * Math.sin(5 * phi)
    const ex = Math.cos(phi) * 1.0 * wob
    const ez = Math.sin(phi) * 0.5 * wob
    // Rotate: long axis (1,0) -> (c, c) in (x', z'), with +z' toward the crest, so -x end is at the crest.
    const nx = c * ex - c * ez
    const nz = -(c * ex + c * ez)
    const x = idx.centreX + halfW * nx
    const z = midZ + halfD * nz
    const o = i * 3
    if (whenMoved) {
      endPoint(idx, t, x, y, z, 1, 0, 0, scratch)
      out[o] = scratch[0]
      out[o + 1] = scratch[1]
      out[o + 2] = scratch[2]
    } else {
      out[o] = x
      out[o + 1] = y
      out[o + 2] = z
    }
  }
  return out
}
