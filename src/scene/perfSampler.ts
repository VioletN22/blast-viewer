export const PUSH_EVERY_MS = 250
/** A longer gap (demand-mode idle, a stall) counts as this long, so fps decays instead of freezing. */
export const MAX_GAP_MS = 250
const EMA = 0.12

export interface PerfSampler {
  prev: number
  fps: number
  lastPush: number
}

export const newSampler = (): PerfSampler => ({ prev: 0, fps: 0, lastPush: -Infinity })

/**
 * Registers a rendered frame at time now (ms): updates the smoothed fps and
 * returns true when the store should be written (at most every PUSH_EVERY_MS).
 * The first frame only starts the clock. Mutates and allocates nothing.
 */
export function pushFrame(s: PerfSampler, now: number): boolean {
  if (s.prev > 0) {
    const gap = Math.min(MAX_GAP_MS, Math.max(1, now - s.prev))
    const inst = 1000 / gap
    s.fps = s.fps === 0 ? inst : s.fps + (inst - s.fps) * EMA
  }
  s.prev = now
  if (s.fps === 0 || now - s.lastPush < PUSH_EVERY_MS) return false
  s.lastPush = now
  return true
}
