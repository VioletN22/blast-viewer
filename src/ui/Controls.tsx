import { useEffect, useRef, useState } from 'react'
import { useBlast, type ColorBy, type Exaggeration, type Ground, type Scale, type View } from '../state/store'
import { MAX_POINTS } from '../lib/xyz'
import { HolePicker } from './HolePicker'

const SCALES: Scale[] = [1, 2, 3, 4]
const GROUNDS: { v: Ground; label: string; aria: string }[] = [
  { v: 'bench', label: 'Synthetic', aria: 'Synthetic bench' },
  { v: 'pit', label: 'Super Pit', aria: 'Super Pit, real elevation' },
]
const VIEWS: { v: View; label: string; aria: string }[] = [
  { v: 'pit', label: 'Whole pit', aria: 'Frame the whole pit' },
  { v: 'blast', label: 'Blast', aria: 'Frame the blast' },
]
const EXAGGERATIONS: Exaggeration[] = [1, 1.5, 2]
const POINT_FILES = '.xyz,.csv,.txt,.pts,text/csv,text/plain'
const COLORS: { v: ColorBy; label: string }[] = [
  { v: 'movement', label: 'Movement' },
  { v: 'delay', label: 'Delay' },
]

function Switch({ label, aria, checked, onChange }: { label: string; aria: string; checked: boolean; onChange(v: boolean): void }) {
  return (
    <label className="switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.currentTarget.checked)} aria-label={aria} />
      <span className="switch-track" aria-hidden="true" />
      <span className="switch-label">{label}</span>
    </label>
  )
}

const LayersIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
    <path d="M8 1.8 1.5 5 8 8.2 14.5 5zM2.6 7.7 1.5 8.2 8 11.4l6.5-3.2-1.1-.5L8 10.3zm0 3.2-1.1.5L8 14.6l6.5-3.2-1.1-.5L8 13.5z" fill="currentColor" />
  </svg>
)

/**
 * View options: colour by movement or delay, the overlays, and the stress
 * scale. A fixed panel on wide screens; behind a "Layers" toggle on phones.
 */
export function Controls() {
  const [open, setOpen] = useState(false)
  const scenario = useBlast((s) => s.scenario)
  const colorBy = useBlast((s) => s.colorBy)
  const showBefore = useBlast((s) => s.showBefore)
  const showVectors = useBlast((s) => s.showVectors)
  const showDigLine = useBlast((s) => s.showDigLine)
  const showPerf = useBlast((s) => s.showPerf)
  const scale = useBlast((s) => s.scale)
  const ground = useBlast((s) => s.ground)
  const demStatus = useBlast((s) => s.demStatus)
  const view = useBlast((s) => s.view)
  const siteNote = useBlast((s) => s.siteNote)
  const siteNoteError = useBlast((s) => s.siteNoteError)
  const exaggeration = useBlast((s) => s.exaggeration)
  const cloud = useBlast((s) => s.cloud)
  const cloudBusy = useBlast((s) => s.cloudBusy)
  const cloudNote = useBlast((s) => s.cloudNote)
  const st = useBlast.getState()
  const toggleRef = useRef<HTMLButtonElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const onPit = !cloud && ground === 'pit' && !!scenario?.site

  useEffect(() => {
    if (!open) return
    // Capture phase, so the open sheet (the topmost layer) takes Escape before the hole card does.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      e.preventDefault()
      setOpen(false)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open])

  return (
    <div className={`controls${open ? ' is-open' : ''}`}>
      <button ref={toggleRef} type="button" className="controls-toggle panel" aria-label="Layers" aria-expanded={open} aria-controls="view-options" onClick={() => setOpen((o) => !o)}>
        <LayersIcon />
        <span>Layers</span>
      </button>
      <div id="view-options" className="controls-panel panel" role="group" aria-label="View options">
        <fieldset className="ctl">
          <legend>Terrain</legend>
          <div className="seg">
            {GROUNDS.map((g) => (
              <label key={g.v}>
                <input
                  type="radio"
                  name="ground"
                  value={g.v}
                  checked={!cloud && ground === g.v}
                  onChange={() => void st.setGround(g.v)}
                  aria-label={g.aria}
                />
                <span>{g.label}</span>
              </label>
            ))}
          </div>
          {onPit && (
            <div className="seg seg-view">
              {VIEWS.map((v) => (
                // Picking the current view again (a click on the checked one) frames it again.
                <label key={v.v}>
                  <input type="radio" name="view" value={v.v} checked={view === v.v} onChange={() => st.setView(v.v)} onClick={() => view === v.v && st.setView(v.v)} aria-label={v.aria} />
                  <span>{v.label}</span>
                </label>
              ))}
            </div>
          )}
          {onPit && (
            <div className="seg seg-view seg-exag" role="radiogroup" aria-label="Height exaggeration">
              {EXAGGERATIONS.map((k) => (
                <label key={k}>
                  <input type="radio" name="exaggeration" value={k} checked={exaggeration === k} onChange={() => st.setExaggeration(k)} aria-label={`Height x${k}`} />
                  <span>{k}x</span>
                </label>
              ))}
            </div>
          )}
          {demStatus === 'loading' && <p className="ctl-note">Loading the pit…</p>}
          {demStatus === 'error' && (
            <p className="ctl-note ctl-error" role="alert">
              The pit terrain did not load.
            </p>
          )}
          {(onPit || siteNote) && (
            <p className={`ctl-note${siteNoteError ? ' ctl-error' : ''}`} role="status" data-testid="site-note">
              {siteNote ?? 'Click the pit to move the blast.'}
            </p>
          )}
        </fieldset>
        {!cloud && (
          <>
            <fieldset className="ctl">
              <legend>Colour rock by</legend>
              <div className="seg">
                {COLORS.map((c) => (
                  <label key={c.v}>
                    <input type="radio" name="color-by" value={c.v} checked={colorBy === c.v} onChange={() => st.setColorBy(c.v)} aria-label={`Colour rock by ${c.label.toLowerCase()}`} />
                    <span>{c.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="ctl ctl-switches">
              <Switch label="Before surface" aria="Show the pre-blast surface" checked={showBefore} onChange={st.setShowBefore} />
              <Switch label="Vectors" aria="Show movement vectors" checked={showVectors} onChange={st.setShowVectors} />
              <Switch label="Ore zone" aria="Show the ore zone dig line" checked={showDigLine} onChange={st.setShowDigLine} />
              <Switch label="Stats" aria="Show performance stats" checked={showPerf} onChange={st.setShowPerf} />
            </div>
            <fieldset className="ctl">
              <legend>Stress scale</legend>
              <div className="seg seg-4">
                {SCALES.map((s) => (
                  <label key={s}>
                    <input type="radio" name="scale" value={s} checked={scale === s} onChange={() => st.setScale(s)} aria-label={`Stress scale ${s}`} />
                    <span>{s}</span>
                  </label>
                ))}
              </div>
              {scenario && (
                <p className="ctl-note">
                  {scenario.holes.length.toLocaleString('en-US')} holes · {scenario.fragments.count.toLocaleString('en-US')} rocks
                </p>
              )}
            </fieldset>
            {/* On a phone the sheet closes on a pick, so the card is not under it; focus then returns to the Layers toggle. */}
            <HolePicker onPick={() => setOpen(false)} fallbackFocus={toggleRef} />
          </>
        )}
        <fieldset className="ctl">
          <legend>Points</legend>
          <div className="btn-row">
            <button type="button" className="btn" disabled={cloudBusy} onClick={() => void st.openPoints()}>
              Load sample
            </button>
            <button type="button" className="btn" disabled={cloudBusy} onClick={() => fileRef.current?.click()}>
              Open file
            </button>
          </div>
          <input
            ref={fileRef}
            className="file-input"
            type="file"
            accept={POINT_FILES}
            aria-label="Open a points file"
            data-testid="points-file"
            onChange={(e) => {
              const f = e.currentTarget.files?.[0]
              e.currentTarget.value = ''
              if (f) void st.openPoints(f)
            }}
          />
          {cloudBusy && <p className="ctl-note">Reading points…</p>}
          {!cloudBusy && cloud && (
            <p className="ctl-note" data-testid="points-count">
              {cloud.count.toLocaleString('en-US')} points
              {cloud.skipped > 0 && ` · ${cloud.skipped.toLocaleString('en-US')} ${cloud.skipped === 1 ? 'line' : 'lines'} skipped`}
              {cloud.truncated && ` · first ${MAX_POINTS.toLocaleString('en-US')} kept`}
            </p>
          )}
          {!cloudBusy && !cloud && !cloudNote && <p className="ctl-note">XYZ or CSV. Drop a file on the view to open it.</p>}
          {cloudNote && (
            <p className="ctl-note ctl-error" role="alert" data-testid="points-error">
              {cloudNote}
            </p>
          )}
          {cloud && (
            <button type="button" className="btn btn-wide" onClick={st.closePoints}>
              Back to the blast
            </button>
          )}
        </fieldset>
      </div>
    </div>
  )
}
