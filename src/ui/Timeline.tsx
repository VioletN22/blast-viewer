import { useEffect, useMemo, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Color } from 'three'
import { lastFireMs } from '../sim/fire'
import { useBlast } from '../state/store'
import { delayColor } from '../scene/colors'
import { fireTicks, formatReadout, PAGE_STEP_MS, SPEEDS, STEP_MS } from '../lib/timelineFormat'

function togglePlay() {
  const s = useBlast.getState()
  if (s.playing) s.pause()
  else s.play()
}

function step(dir: -1 | 1, by = STEP_MS) {
  const s = useBlast.getState()
  s.pause()
  s.setTime(s.timeMs + dir * by)
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

type Tick = { ms: number; f: number; color: string }

/**
 * The parts that move with time: the readout, the tick highlight and the
 * scrubber. The only timeline component subscribed to timeMs, so the play
 * button and speed select do not re-render on every playing frame.
 */
function TimeTrack({ dur, ticks }: { dur: number; ticks: Tick[] }) {
  const timeMs = useBlast((s) => s.timeMs)
  const frac = dur > 0 ? timeMs / dur : 0
  // Up/Down match Left/Right (100 ms); PageUp/PageDown move 500 ms; Home/End jump to the ends.
  const onScrubKey = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    const k = e.key
    if (k === 'ArrowLeft' || k === 'ArrowDown' || k === 'ArrowRight' || k === 'ArrowUp') {
      e.preventDefault()
      step(k === 'ArrowLeft' || k === 'ArrowDown' ? -1 : 1)
    } else if (k === 'PageUp' || k === 'PageDown') {
      e.preventDefault()
      step(k === 'PageDown' ? -1 : 1, PAGE_STEP_MS)
    } else if (k === 'Home' || k === 'End') {
      e.preventDefault()
      useBlast.getState().pause()
      useBlast.getState().setTime(k === 'Home' ? 0 : dur)
    }
  }
  return (
    <div className="tl-main">
      <div className="tl-meta">
        <span className="tl-readout" data-testid="time-readout">
          {formatReadout(timeMs, dur)}
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
  )
}

/** Play/pause, the scrubber with one tick per firing delay, the time readout and the speed. */
export function Timeline() {
  const scenario = useBlast((s) => s.scenario)
  const playing = useBlast((s) => s.playing)
  const speed = useBlast((s) => s.speed)
  useTimelineKeys()

  const dur = scenario?.durationMs ?? 0
  const ticks = useMemo<Tick[]>(() => {
    if (!scenario) return []
    const max = lastFireMs(scenario.holes)
    const c = new Color()
    return fireTicks(
      scenario.holes.map((h) => h.delayMs),
      scenario.durationMs,
    ).map((t) => ({ ...t, color: `#${delayColor(t.ms, max, c).getHexString()}` }))
  }, [scenario])
  if (!scenario) return null

  return (
    <div className="timeline panel" role="group" aria-label="Timeline">
      <button type="button" className="tl-play" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'} title={playing ? 'Pause (Space)' : 'Play (Space)'}>
        {playing ? <PauseIcon /> : <PlayIcon />}
      </button>
      <TimeTrack dur={dur} ticks={ticks} />
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
