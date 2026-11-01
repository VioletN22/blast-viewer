import { useEffect, useRef } from 'react'
import { useBlast } from '../state/store'

/** Pause after the first scenario loads, so the opening frame registers before the blast starts. */
export const AUTOPLAY_DELAY_MS = 800

/** Autoplay is a motion effect: off when the viewer asks for reduced motion. */
export function shouldAutoplay(reducedMotion: boolean): boolean {
  return !reducedMotion
}

/**
 * Plays the blast once from t = 0 shortly after the first scenario loads. The
 * Player in Stage stops it on the final frame (no loop). Skipped when disabled
 * (an explicit ?t= link), with reduced motion, or if the viewer has already
 * scrubbed or pressed play before the delay is up.
 */
export function useAutoplay(enabled: boolean) {
  const scenario = useBlast((s) => s.scenario)
  const first = useRef<typeof scenario>(null)
  useEffect(() => {
    if (!scenario || !enabled) return
    // Only the first scenario: a later rebuild (scale change) never restarts playback.
    if (first.current && first.current !== scenario) return
    first.current = scenario
    const reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!shouldAutoplay(reduced)) return
    let touched = false
    const unsub = useBlast.subscribe((s, prev) => {
      if (s.timeMs !== prev.timeMs || s.playing !== prev.playing) touched = true
    })
    const id = window.setTimeout(() => {
      unsub()
      if (touched) return
      const s = useBlast.getState()
      s.setTime(0)
      s.play()
    }, AUTOPLAY_DELAY_MS)
    return () => {
      window.clearTimeout(id)
      unsub()
    }
  }, [scenario, enabled])
}
