import { easeOut, smoothstep } from './ease'
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

/** Flight time of a fragment that moves magnitude metres when the largest move is maxMagnitude. */
export function flightFor(magnitude: number, maxMagnitude: number): number {
  return FLIGHT_MIN_MS + (maxMagnitude > 0 ? ((FLIGHT_MAX_MS - FLIGHT_MIN_MS) * magnitude) / maxMagnitude : 0)
}

/** Samples fragments through the blasted footprint and resolves where each lands. Zero holes gives empty fragments. */
export function simulateBlast(
  t: Terrain,
  holes: DrillHole[],
  opts: { fragmentsPerHole: number; seed: number },
): Fragments {
  const count = holes.length * Math.max(0, Math.floor(opts.fragmentsPerHole))
  if (count === 0) {
    const empty = new Float32Array(0)
    return { count: 0, start: empty, end: empty, fireMs: empty, flightMs: empty, magnitude: empty, maxMagnitude: 0 }
  }
  const idx = holeIndex(holes, t)
  // Rejection-sample uniformly by volume through the blasted footprint: the
  // block behind the crest plus the face wedge out to the toe.
  const yMax = t.options.benchHeight + 0.5
  const start = new Float32Array(count * 3)
  const end = new Float32Array(count * 3)
  const fireMs = new Float32Array(count)
  const flightMs = new Float32Array(count)
  const magnitude = new Float32Array(count)
  const rng = mulberry32(opts.seed)
  let maxMagnitude = 0

  for (let i = 0; i < count; i++) {
    let x = 0
    let y = 0
    let z = 0
    for (let tries = 0; ; tries++) {
      x = randRange(rng, idx.minX, idx.maxX)
      z = randRange(rng, idx.minZ, idx.toeZ)
      y = randRange(rng, 0, yMax)
      const top = t.heightAt(x, z)
      if (y <= top) break
      if (tries > 64) {
        y = top > 0 ? y * (top / yMax) : 0
        break
      }
    }
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
  for (let i = 0; i < count; i++) {
    flightMs[i] = flightFor(magnitude[i], maxMagnitude)
  }
  return { count, start, end, fireMs, flightMs, magnitude, maxMagnitude }
}

/**
 * Arc peak above the straight path, metres, for a fragment moving m metres and
 * ending rise metres higher than it started (a final rise already counts toward
 * the heave). Back rows heave 2 to 5 m in all; crest rock arcs about 8 m.
 */
const arcPeak = (m: number, rise: number) => 2.3 + 0.2 * m - 0.4 * Math.max(0, rise)

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
  const h = easeOut(u) // fast launch, slowing toward landing
  const v = smoothstep(u) // vertical baseline
  const arc = arcPeak(f.magnitude[i], f.end[o + 1] - f.start[o + 1]) * 4 * u * (1 - u)
  out[offset] = f.start[o] + (f.end[o] - f.start[o]) * h
  out[offset + 1] = f.start[o + 1] + (f.end[o + 1] - f.start[o + 1]) * v + arc
  out[offset + 2] = f.start[o + 2] + (f.end[o + 2] - f.start[o + 2]) * h
}
