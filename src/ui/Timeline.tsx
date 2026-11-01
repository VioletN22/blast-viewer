import { useEffect, useMemo, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Color } from 'three'
import { lastFireMs } from '../sim/fire'
import { useBlast } from '../state/store'
import { delayColor } from '../scene/colors'
import { fireTicks, formatReadout, SPEEDS, STEP_MS } from './timelineFormat'

function togglePlay() {
  const s = useBlast.getState()
  if (s.playing) s.pause()
  else s.play()
}

function step(dir: -1 | 1) {
  const s = useBlast.getState()
  s.pause()
  s.setTime(s.timeMs + dir * STEP_MS)
}

/** Space toggles play, Left/Right step 100 ms; not while a text field, select or other input has focus. */
function useTimelineKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target instanceof HTMLElement ? e.target : null
      const isRange = t instanceof HTMLInputElement && t.type === 'range'
      if (t && (t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (t && t.tagName === 'INPUT' && !isRange) return
      if (e.key === ' ' || e.code === 'Space') {
        // A focused button already answers Space with a click.
        if (t?.tagName === 'BUTTON') return
        e.preventDefault()
        togglePlay()
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        // The scrubber handles its own arrows (and calls preventDefault), so this is for the rest of the page.
        if (isRange) return
        e.preventDefault()
        step(e.key === 'ArrowLeft' ? -1 : 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

const PlayIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
    <path d="M4 2.5v11l9-5.5z" fill="currentColor" />
  </svg>
)
const PauseIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
    <path d="M4 2.5h3v11H4zM9 2.5h3v11H9z" fill="currentColor" />
  </svg>
)

/** Play/pause, the scrubber with one tick per firing delay, the time readout and the speed. */
export function Timeline() {
  const scenario = useBlast((s) => s.scenario)
  const timeMs = useBlast((s) => s.timeMs)
  const playing = useBlast((s) => s.playing)
  const speed = useBlast((s) => s.speed)
  useTimelineKeys()

  const dur = scenario?.durationMs ?? 0
  const ticks = useMemo(() => {
    if (!scenario) return []
    const max = lastFireMs(scenario.holes)
    const c = new Color()
    return fireTicks(
      scenario.holes.map((h) => h.delayMs),
      scenario.durationMs,
    ).map((t) => ({ ...t, color: `#${delayColor(t.ms, max, c).getHexString()}` }))
  }, [scenario])
  if (!scenario) return null

  const frac = dur > 0 ? timeMs / dur : 0
  const readout = formatReadout(timeMs, dur)
  const onScrubKey = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault()
      step(e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 1)
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault()
      useBlast.getState().pause()
      useBlast.getState().setTime(e.key === 'Home' ? 0 : dur)
    }
  }

  return (
    <div className="timeline panel" role="group" aria-label="Timeline">
      <button type="button" className="tl-play" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'} title={playing ? 'Pause (Space)' : 'Play (Space)'}>
        {playing ? <PauseIcon /> : <PlayIcon />}
      </button>
      <div className="tl-main">
        <div className="tl-meta">
          <span className="tl-readout" data-testid="time-readout">
            {readout}
          </span>
          <span className="tl-hint" aria-hidden="true">
            Space play · ← → 100 ms
          </span>
        </div>
        <div className="tl-scrub" style={{ '--p': frac } as CSSProperties}>
          <svg className="tl-ticks" viewBox="0 0 1000 10" preserveAspectRatio="none" aria-hidden="true">
            {ticks.map((t) => (
              <line key={t.ms} x1={t.f * 1000} x2={t.f * 1000} y1={0} y2={10} stroke={t.color} opacity={t.f <= frac ? 1 : 0.4} />
            ))}
          </svg>
          <input
            type="range"
            className="tl-range"
            min={0}
            max={dur}
            step="any"
            value={timeMs}
            aria-label="Blast time"
            aria-valuetext={`${Math.round(timeMs).toLocaleString('en-US')} ms of ${Math.round(dur).toLocaleString('en-US')} ms`}
            onChange={(e) => {
              useBlast.getState().pause()
              useBlast.getState().setTime(Number(e.currentTarget.value))
            }}
            onKeyDown={onScrubKey}
          />
        </div>
      </div>
      <select className="tl-speed" aria-label="Playback speed" title="Playback speed" value={speed} onChange={(e) => useBlast.getState().setSpeed(Number(e.currentTarget.value))}>
        {SPEEDS.map((s) => (
          <option key={s} value={s}>
            {s}x
          </option>
        ))}
      </select>
    </div>
  )
}
