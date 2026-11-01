import { flightFor } from '../sim/blast'
import { easeOut } from '../sim/ease'
import { digLine, holeIndex, nearestHole } from '../sim/field'
import type { Scenario } from '../sim/scenario'

export interface DigZone {
  from: Float32Array
  to: Float32Array
  /** Per point: when its nearest hole fires, ms. */
  fire: Float32Array
  /** Per point: flight time using the fragments' formula, ms. */
  flight: Float32Array
}

/** Ore-zone outline before and after the blast, with each point's fire and flight time. Built once per scenario. */
export function buildDigZone(sc: Scenario): DigZone {
  const { terrain, holes, fragments, durationMs } = sc
  const from = digLine(terrain, holes, false)
  const to = digLine(terrain, holes, true)
  const n = from.length / 3
  const fire = new Float32Array(n)
  const flight = new Float32Array(n)
  if (holes.length > 0) {
    const idx = holeIndex(holes, terrain)
    for (let i = 0; i < n; i++) {
      const o = i * 3
      // Clamp fire + flight to the duration, so the last frame is exactly the moved outline.
      fire[i] = Math.min(holes[nearestHole(idx, from[o], from[o + 2])].delayMs, durationMs)
      const f = flightFor(Math.hypot(to[o] - from[o], to[o + 1] - from[o + 1], to[o + 2] - from[o + 2]), fragments.maxMagnitude)
      flight[i] = Math.min(f, durationMs - fire[i])
    }
  }
  return { from, to, fire, flight }
}

/** Writes the outline at timeMs into out (xyz triplets). Allocation-free. */
export function digZoneAt(z: DigZone, timeMs: number, out: Float32Array): void {
  const { from, to, fire, flight } = z
  for (let i = 0; i < fire.length; i++) {
    const local = timeMs - fire[i]
    // The end test first, so a point clamped to zero flight lands at t = fire.
    const u = local >= flight[i] && local >= 0 ? 1 : local <= 0 ? 0 : easeOut(local / flight[i]) // the fragments' ease, so the zone keeps pace with the rock
    const o = i * 3
    out[o] = from[o] + (to[o] - from[o]) * u
    out[o + 1] = from[o + 1] + (to[o + 1] - from[o + 1]) * u
    out[o + 2] = from[o + 2] + (to[o + 2] - from[o + 2]) * u
  }
}
