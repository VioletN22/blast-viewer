import { flightFor } from '../sim/blast'
import { digLine, holeIndex, nearestHole } from '../sim/field'
import type { Scenario } from '../sim/scenario'

/** Same ease-out as blast.ts positionAt, so the zone keeps pace with the rock around it. */
const ease = (u: number) => 1 - (1 - u) * (1 - u)

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
  const { terrain, holes, fragments } = sc
  const from = digLine(terrain, holes, false)
  const to = digLine(terrain, holes, true)
  const n = from.length / 3
  const fire = new Float32Array(n)
  const flight = new Float32Array(n)
  if (holes.length > 0) {
    const idx = holeIndex(holes, terrain)
    for (let i = 0; i < n; i++) {
      const o = i * 3
      fire[i] = holes[nearestHole(idx, from[o], from[o + 2])].delayMs
      flight[i] = flightFor(Math.hypot(to[o] - from[o], to[o + 1] - from[o + 1], to[o + 2] - from[o + 2]), fragments.maxMagnitude)
    }
  }
  return { from, to, fire, flight }
}

/** Writes the outline at timeMs into out (xyz triplets). Allocation-free. */
export function digZoneAt(z: DigZone, timeMs: number, out: Float32Array): void {
  const { from, to, fire, flight } = z
  for (let i = 0; i < fire.length; i++) {
    const local = timeMs - fire[i]
    const u = local <= 0 ? 0 : local >= flight[i] ? 1 : ease(local / flight[i])
    const o = i * 3
    out[o] = from[o] + (to[o] - from[o]) * u
    out[o + 1] = from[o + 1] + (to[o + 1] - from[o + 1]) * u
    out[o + 2] = from[o + 2] + (to[o + 2] - from[o + 2]) * u
  }
}
