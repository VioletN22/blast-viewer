import type { Scale } from '../state/store'

/** Playback rates offered in the timeline; 1 is real time. */
export const SPEEDS = [0.1, 0.25, 0.5, 1] as const
/** At 0.25x the default 2.7 s blast plays in about 11 s, slow enough to follow the firing sequence. */
export const DEFAULT_SPEED = 0.25
/** Arrow keys move the time by this much. */
export const STEP_MS = 100
/** Below this width the page treats the device as a phone. */
export const PHONE_MAX_WIDTH = 768

const ms = (v: number) => Math.round(v).toLocaleString('en-US')

/** "t = 1,240 ms / 2,685 ms": whole milliseconds, grouped. */
export function formatReadout(timeMs: number, durationMs: number): string {
  return `t = ${ms(timeMs)} ms / ${ms(durationMs)} ms`
}

/** One tick per distinct firing delay, sorted, with its position as a fraction of the duration. */
export function fireTicks(delays: ArrayLike<number>, durationMs: number): { ms: number; f: number }[] {
  const uniq = Array.from(new Set(Array.from(delays))).sort((a, b) => a - b)
  return uniq.map((d) => ({ ms: d, f: durationMs > 0 ? Math.min(1, Math.max(0, d / durationMs)) : 0 }))
}

/** Phones start light: scale 1 and no vectors. Wider screens keep the store defaults. */
export function deviceDefaults(width: number): { scale?: Scale; showVectors?: boolean } {
  return width < PHONE_MAX_WIDTH ? { scale: 1, showVectors: false } : {}
}
