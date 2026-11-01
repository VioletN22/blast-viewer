import { endPoint, holeIndex, nearestHole } from './field'
import { mulberry32, randRange } from './rng'
import type { DrillHole, Terrain } from './types'

export interface Fragments {
  count: number
  /** xyz triplets */
  start: Float32Array
  /** xyz triplets */
  end: Float32Array
  fireMs: Float32Array
  flightMs: Float32Array
  magnitude: Float32Array
  maxMagnitude: number
}

const FLIGHT_MIN_MS = 600
const FLIGHT_MAX_MS = 1600

/** Samples fragments through the blasted block and resolves where each lands. */
export function simulateBlast(
  t: Terrain,
  holes: DrillHole[],
  opts: { fragmentsPerHole: number; seed: number },
): Fragments {
  const idx = holeIndex(holes, t)
  const count = holes.length * Math.max(0, Math.floor(opts.fragmentsPerHole))
  const start = new Float32Array(count * 3)
  const end = new Float32Array(count * 3)
  const fireMs = new Float32Array(count)
  const flightMs = new Float32Array(count)
  const magnitude = new Float32Array(count)
  const rng = mulberry32(opts.seed)
  let maxMagnitude = 0

  for (let i = 0; i < count; i++) {
    const x = randRange(rng, idx.minX, idx.maxX)
    const z = randRange(rng, idx.minZ, idx.maxZ)
    const y = randRange(rng, 0, t.heightAt(x, z))
    const o = i * 3
    start[o] = x
    start[o + 1] = y
    start[o + 2] = z
    endPoint(idx, t, x, y, z, randRange(rng, 0.85, 1.15), randRange(rng, -0.8, 0.8), randRange(rng, -0.08, 0.08), end, o)
    fireMs[i] = idx.delay[nearestHole(idx, x, z)]
    const m = Math.hypot(end[o] - start[o], end[o + 1] - start[o + 1], end[o + 2] - start[o + 2])
    magnitude[i] = m
    if (m > maxMagnitude) maxMagnitude = m
  }
  const span = FLIGHT_MAX_MS - FLIGHT_MIN_MS
  for (let i = 0; i < count; i++) {
    flightMs[i] = FLIGHT_MIN_MS + (maxMagnitude > 0 ? (span * magnitude[i]) / maxMagnitude : 0)
  }
  return { count, start, end, fireMs, flightMs, magnitude, maxMagnitude }
}

/** Arc peak above the straight path, metres, for a fragment moving m metres. */
const arcPeak = (m: number) => 1.5 + 0.3 * m

/**
 * Position of fragment i at tMs, written to out[offset..offset+2]. Before fire:
 * start; after fire + flight: end; between: eased lerp plus a ballistic arc.
 * History-free and allocation-free.
 */
export function positionAt(f: Fragments, i: number, tMs: number, out: Float32Array, offset: number): void {
  const o = i * 3
  const local = tMs - f.fireMs[i]
  if (local <= 0) {
    out[offset] = f.start[o]
    out[offset + 1] = f.start[o + 1]
    out[offset + 2] = f.start[o + 2]
    return
  }
  const flight = f.flightMs[i]
  if (local >= flight) {
    out[offset] = f.end[o]
    out[offset + 1] = f.end[o + 1]
    out[offset + 2] = f.end[o + 2]
    return
  }
  const u = local / flight
  const inv = 1 - u
  const h = 1 - inv * inv // ease-out: fast launch, slowing toward landing
  const v = u * u * (3 - 2 * u) // smoothstep for the vertical baseline
  const arc = arcPeak(f.magnitude[i]) * 4 * u * inv
  out[offset] = f.start[o] + (f.end[o] - f.start[o]) * h
  out[offset + 1] = f.start[o + 1] + (f.end[o + 1] - f.start[o + 1]) * v + arc
  out[offset + 2] = f.start[o + 2] + (f.end[o + 2] - f.start[o + 2]) * h
}
