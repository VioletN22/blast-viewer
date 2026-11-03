import type { Dem } from './dem'

/**
 * Finding a bench on a real surface, and the frame the blast model runs in there.
 *
 * The blast model works in its own frame: the crest along x at z = 0, the free
 * face toward +z, the floor at y = 0 and the bench top at y = benchHeight. On a
 * real surface a site is a crest point, a face direction (downhill, in plan) and
 * the floor level, and the model runs unchanged in that rotated, shifted frame.
 */

export type HeightFn = (x: number, z: number) => number

export interface PlaneFit {
  /** Height of the plane at the window centre, metres. */
  h: number
  /** Slope of the plane, dy/dx and dy/dz. */
  gx: number
  gz: number
  /** Root-mean-square distance of the samples from the plane, metres. */
  rms: number
  slopeDeg: number
}

/**
 * Least-squares plane over a rectangle centred on (cx, cz) with axes a = (ax, az)
 * (unit) and b = a turned a quarter turn, half sizes halfA and halfB, sampled every
 * step metres. The samples are symmetric about the centre, so the fit splits into
 * a mean and two independent slopes.
 */
export function fitPlane(height: HeightFn, cx: number, cz: number, halfA: number, halfB: number, step: number, ax = 1, az = 0): PlaneFit {
  const bx = -az
  const bz = ax
  const na = Math.max(1, Math.round(halfA / step))
  const nb = Math.max(1, Math.round(halfB / step))
  let n = 0
  let sum = 0
  let sa = 0
  let sb = 0
  let saa = 0
  let sbb = 0
  for (let p = -na; p <= na; p++) {
    for (let q = -nb; q <= nb; q++) {
      const a = (p * halfA) / na
      const b = (q * halfB) / nb
      const h = height(cx + a * ax + b * bx, cz + a * az + b * bz)
      n++
      sum += h
      sa += a * h
      sb += b * h
      saa += a * a
      sbb += b * b
    }
  }
  const h0 = sum / n
  const ga = sa / saa
  const gb = sb / sbb
  let r2 = 0
  for (let p = -na; p <= na; p++) {
    for (let q = -nb; q <= nb; q++) {
      const a = (p * halfA) / na
      const b = (q * halfB) / nb
      const d = height(cx + a * ax + b * bx, cz + a * az + b * bz) - (h0 + ga * a + gb * b)
      r2 += d * d
    }
  }
  // Back from the (a, b) axes to x and z.
  const gx = ga * ax + gb * bx
  const gz = ga * az + gb * bz
  return { h: h0, gx, gz, rms: Math.sqrt(r2 / n), slopeDeg: (Math.atan(Math.hypot(gx, gz)) * 180) / Math.PI }
}

export interface BenchFit {
  /** Crest point in plan, metres. */
  x: number
  z: number
  /** Face direction in plan: unit vector pointing down the face. */
  dirX: number
  dirZ: number
  /** Bench top height at the crest, metres. */
  topY: number
  benchHeight: number
  faceAngleDeg: number
  /** Plane fit over the pattern area behind the crest. */
  bench: PlaneFit
}

/** The pattern area behind the crest that a site is judged on: half width along the crest and half depth, metres. */
export const PATTERN_HALF_WIDTH_M = 50
export const PATTERN_HALF_DEPTH_M = 15
const DIRECTIONS = 32
const PROBE_M = 80
const FACE_START = Math.tan((18 * Math.PI) / 180)
const FACE_END = Math.tan((12 * Math.PI) / 180)
export const SEARCH_M = 150
const MIN_DROP_M = 4
export const BENCH_MIN_M = 6
export const BENCH_MAX_M = 18

/**
 * Lays a bench on the surface near (px, pz). The face direction is the one with
 * the largest drop over 80 m. Along it, the crest is where the ground first gets
 * steeper than 18 degrees (or, from a point already on the face, the last place
 * behind it that is flatter than that), and the toe is where it eases below 12
 * degrees again. The bench height is the drop from crest to toe, kept between
 * 6 and 18 m, and the face angle is the mean slope between them. Returns null
 * when there is no face within SEARCH_M (150 m).
 */
export function findBench(height: HeightFn, px: number, pz: number): BenchFit | null {
  const h0 = height(px, pz)
  let best = -Infinity
  let dirX = 0
  let dirZ = 1
  for (let k = 0; k < DIRECTIONS; k++) {
    const a = (k / DIRECTIONS) * Math.PI * 2
    const dx = Math.sin(a)
    const dz = Math.cos(a)
    // Mean drop over the probe, so one low sample does not decide the direction.
    let drop = 0
    for (let s = 10; s <= PROBE_M; s += 10) drop += h0 - height(px + dx * s, pz + dz * s)
    if (drop > best) {
      best = drop
      dirX = dx
      dirZ = dz
    }
  }
  // Flat in every direction out to the probe: no face to lay a bench against.
  if (best <= 0.5) return null
  const at = (s: number) => height(px + dirX * s, pz + dirZ * s)
  const slope = (s: number) => (at(s) - at(s + 4)) / 4

  let crest: number | null = null
  if (slope(0) > FACE_START) {
    for (let s = 0; s >= -SEARCH_M; s--) {
      if (slope(s - 1) <= FACE_START) {
        crest = s
        break
      }
    }
  } else {
    for (let s = 0; s <= SEARCH_M; s++) {
      if (slope(s) > FACE_START) {
        crest = s
        break
      }
    }
  }
  if (crest === null) return null
  let toe = crest + SEARCH_M
  for (let s = crest + 4; s <= crest + SEARCH_M; s++) {
    if (slope(s) < FACE_END) {
      toe = s + 2
      break
    }
  }
  const topY = at(crest)
  const drop = topY - at(toe)
  if (drop < MIN_DROP_M) return null
  const x = px + dirX * crest
  const z = pz + dirZ * crest
  const faceAngleDeg = Math.min(75, Math.max(20, (Math.atan(drop / (toe - crest)) * 180) / Math.PI))
  const benchHeight = Math.min(BENCH_MAX_M, Math.max(BENCH_MIN_M, drop))
  // The crest runs along a = (dirZ, -dirX); the pattern area sits behind it, toward -dir.
  const bench = fitPlane(height, x - dirX * (PATTERN_HALF_DEPTH_M + 2), z - dirZ * (PATTERN_HALF_DEPTH_M + 2), PATTERN_HALF_WIDTH_M, PATTERN_HALF_DEPTH_M, 5, dirZ, -dirX)
  return { x, z, dirX, dirZ, topY, benchHeight, faceAngleDeg, bench }
}

/** How well a bench suits the pattern: lower is better. Rough ground and a tilted top both count against it. */
export function benchScore(b: BenchFit): number {
  return b.bench.rms + 0.25 * b.bench.slopeDeg - 0.05 * b.benchHeight
}

/**
 * Picks a bench inside the pit automatically: candidate points every `step`
 * metres, more than `margin` from the edge and at least 30 m below the median
 * ground (the rim), each laid with findBench and scored by benchScore. A bench
 * whose crest is within 20 m of the rim is left out, so the pick is inside the pit.
 */
export function autoBench(dem: Dem, step = 32, margin = 260): BenchFit | null {
  const sorted = Float32Array.from(dem.heights).sort()
  const rim = sorted[Math.floor(sorted.length / 2)]
  let best: BenchFit | null = null
  let bestScore = Infinity
  for (let z = -dem.halfZ + margin; z <= dem.halfZ - margin; z += step) {
    for (let x = -dem.halfX + margin; x <= dem.halfX - margin; x += step) {
      if (dem.heightAt(x, z) > rim - 30) continue
      const b = findBench(dem.heightAt, x, z)
      if (!b || b.benchHeight < 8 || b.topY > rim - 20 || !dem.inside(b.x, b.z, 150)) continue
      const sc = benchScore(b)
      if (sc < bestScore) {
        bestScore = sc
        best = b
      }
    }
  }
  return best
}

/** A bench placed for the blast model: the frame transform from model coordinates to the surface. */
export interface Site {
  /** Crest origin in plan, metres. */
  x: number
  z: number
  /** Turn about y (radians) taking the model's +z (the free face) to the face direction. */
  angle: number
  /** Height of the model's y = 0 (the floor below the bench), metres. */
  floorY: number
  benchHeight: number
  faceAngleDeg: number
}

export function siteFromBench(b: BenchFit): Site {
  return {
    x: b.x,
    z: b.z,
    angle: Math.atan2(b.dirX, b.dirZ),
    floorY: b.topY - b.benchHeight,
    benchHeight: b.benchHeight,
    faceAngleDeg: b.faceAngleDeg,
  }
}

/** Model coordinates (x, z) to surface plan coordinates. */
export function siteToWorld(s: Site, x: number, z: number): [number, number] {
  const c = Math.cos(s.angle)
  const n = Math.sin(s.angle)
  return [s.x + x * c + z * n, s.z - x * n + z * c]
}

/** Surface plan coordinates to model coordinates (the inverse of siteToWorld). */
export function worldToSite(s: Site, wx: number, wz: number): [number, number] {
  const c = Math.cos(s.angle)
  const n = Math.sin(s.angle)
  const dx = wx - s.x
  const dz = wz - s.z
  return [dx * c - dz * n, dx * n + dz * c]
}
