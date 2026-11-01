import { useEffect, useRef, useState } from 'react'
import { useBlast } from '../state/store'

/** Pause after the first scenario loads, so the opening frame registers before the blast starts. */
export const AUTOPLAY_DELAY_MS = 800

/** Autoplay is a motion effect: off when the viewer asks for reduced motion. */
export function shouldAutoplay(reducedMotion: boolean): boolean {
  return !reducedMotion
}

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)'
const reducedQuery = () => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(REDUCED_QUERY) : null)

/** The viewer's prefers-reduced-motion setting, kept current when it changes. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => reducedQuery()?.matches ?? false)
  useEffect(() => {
    const mq = reducedQuery()
    if (!mq) return
    const onChange = () => setReduced(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

/**
 * Plays the blast once from t = 0 shortly after the first scenario loads. The
 * Player in Stage stops it on the final frame (no loop). Skipped when disabled
 * (an explicit ?t= link), with reduced motion, or if the viewer has already
 * scrubbed or pressed play before the delay is up. Turning reduced motion on
 * cancels a pending autoplay and pauses one that is running.
 */
export function useAutoplay(enabled: boolean) {
  const scenario = useBlast((s) => s.scenario)
  const reduced = useReducedMotion()
  const first = useRef<typeof scenario>(null)
  /** Set once autoplay has fired or been ruled out by reduced motion; it never re-arms. */
  const decided = useRef(false)
  /** True while a playback that autoplay started is still running. */
  const autoPlaying = useRef(false)

  useEffect(() => {
    if (!scenario || !enabled || decided.current) return
    // Only the first scenario: a later rebuild (scale change) never restarts playback.
    if (first.current && first.current !== scenario) return
    first.current = scenario
    if (!shouldAutoplay(reduced)) {
      decided.current = true
      return
    }
    let touched = false
    const unsub = useBlast.subscribe((s, prev) => {
      if (s.timeMs !== prev.timeMs || s.playing !== prev.playing) touched = true
    })
    const id = window.setTimeout(() => {
      unsub()
      decided.current = true
      if (touched) return
      const s = useBlast.getState()
      s.setTime(0)
      s.play()
      autoPlaying.current = true
    }, AUTOPLAY_DELAY_MS)
    return () => {
      window.clearTimeout(id)
      unsub()
    }
  }, [scenario, enabled, reduced])

  // An autoplayed run ends when playback stops for any reason (the end, a pause, a scrub).
  useEffect(
    () =>
      useBlast.subscribe((s) => {
        if (!s.playing) autoPlaying.current = false
      }),
    [],
  )

  useEffect(() => {
    if (reduced && autoPlaying.current) useBlast.getState().pause()
  }, [reduced])
}
