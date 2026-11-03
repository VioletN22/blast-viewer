import { useEffect, useRef } from 'react'
import { useBlast, type ColorBy, type Exaggeration, type Ground, type Scale, type View } from '../state/store'
import { MAX_POINTS } from '../lib/xyz'
import { HolePicker } from './HolePicker'
import { Icon } from './Icons'
import { Check, DotChoice, Group, StepSlider, TextChoice, type Option } from './PanelParts'
import { useSheet } from './useSheet'

const GROUNDS: Option<Ground>[] = [
  { v: 'pit', label: 'Super Pit', note: 'real ground' },
  { v: 'bench', label: 'Synthetic bench', note: 'generated' },
]
const VIEWS: Option<View>[] = [
  { v: 'pit', label: 'Whole pit', aria: 'Frame the whole pit' },
  { v: 'blast', label: 'Blast', aria: 'Frame the blast' },
]
const EXAGGERATIONS: Option<Exaggeration>[] = [1, 1.5, 2].map((k) => ({ v: k as Exaggeration, label: `x${k}`, aria: `Height x${k}` }))
const COLORS: Option<ColorBy>[] = [
  { v: 'movement', label: 'Movement', aria: 'Colour rock by movement' },
  { v: 'delay', label: 'Delay', aria: 'Colour rock by delay' },
]
const POINT_FILES = '.xyz,.csv,.txt,.pts,text/csv,text/plain'
const n = (v: number) => v.toLocaleString('en-US')

/**
 * The control panel: ground, blast, layers and points, each a group that
 * opens and closes. Docked on the right on wide screens; a bottom sheet with
 * a grab handle on phones.
 */
export function Controls() {
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
  const rootRef = useRef<HTMLDivElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const sheet = useSheet(rootRef)
  const onPit = !cloud && ground === 'pit' && !!scenario?.site

  useEffect(() => {
    if (!sheet.phone || !sheet.open) return
    // Capture phase, so the open sheet (the topmost layer) takes Escape before the hole card does.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      e.preventDefault()
      sheet.close()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [sheet.phone, sheet.open, sheet.close])

  return (
    <div ref={rootRef} className={`controls${sheet.open ? ' is-open' : ''}`} data-snap={sheet.snap}>
      <button ref={toggleRef} type="button" className="controls-toggle" aria-expanded={sheet.open} aria-controls="view-options" {...sheet.handle}>
        <span className="grip" aria-hidden="true" />
        <Icon name="layers" />
        <span>Controls</span>
        <Icon name="chevron" />
      </button>
      <div id="view-options" className="controls-panel" role="group" aria-label="View options">
        <Group id="ground" title="Ground">
          <DotChoice label="Terrain" name="ground" options={GROUNDS} value={cloud ? null : ground} onChange={(g) => void st.setGround(g)} />
          {onPit && (
            <>
              <TextChoice label="Height" name="exaggeration" options={EXAGGERATIONS} value={exaggeration} onChange={st.setExaggeration} mono />
              {/* Picking the current view again frames it again. */}
              <TextChoice label="View" name="view" options={VIEWS} value={view} onChange={st.setView} onRepeat={st.setView} />
            </>
          )}
          {demStatus === 'loading' && <p className="note">Loading the pit…</p>}
          {demStatus === 'error' && (
            <p className="note is-error" role="alert">
              The pit terrain did not load.
            </p>
          )}
          {(onPit || siteNote) && (
            <p className={`note${siteNoteError ? ' is-error' : ''}`} role="status" data-testid="site-note">
              {siteNote ?? 'Click the pit to move the blast.'}
            </p>
          )}
        </Group>
        {!cloud && (
          <>
            <Group id="blast" title="Blast">
              <StepSlider label="Scale" min={1} max={4} value={scale} onCommit={(v) => st.setScale(v as Scale)} />
              {scenario && (
                <p className="note is-mono" data-testid="blast-size">
                  {n(scenario.holes.length)} holes · {n(scenario.fragments.count)} rocks
                </p>
              )}
              <TextChoice label="Colour" name="color-by" options={COLORS} value={colorBy} onChange={st.setColorBy} />
              {/* On a phone the sheet closes on a pick, so the card is not under it; focus then returns to the Controls handle. */}
              <HolePicker onPick={sheet.close} fallbackFocus={toggleRef} />
            </Group>
            <Group id="layers" title="Layers">
              <div className="checks">
                <Check label="Before surface" hint="dashed" checked={showBefore} onChange={st.setShowBefore} />
                <Check label="Vectors" hint="movement" checked={showVectors} onChange={st.setShowVectors} />
                <Check label="Ore zone" hint="outline" checked={showDigLine} onChange={st.setShowDigLine} />
                <Check label="Stats" hint="fps" checked={showPerf} onChange={st.setShowPerf} />
              </div>
            </Group>
          </>
        )}
        <Group id="points" title="Points">
          <div className="actions">
            <button type="button" className="text-btn" disabled={cloudBusy} onClick={() => void st.openPoints()}>
              <Icon name="layers" />
              Load sample
            </button>
            <button type="button" className="text-btn" disabled={cloudBusy} onClick={() => fileRef.current?.click()}>
              <Icon name="upload" />
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
          {cloudBusy && <p className="note">Reading points…</p>}
          {!cloudBusy && cloud && (
            <p className="note is-mono" data-testid="points-count">
              {n(cloud.count)} points
              {cloud.skipped > 0 && ` · ${n(cloud.skipped)} ${cloud.skipped === 1 ? 'line' : 'lines'} skipped`}
              {cloud.truncated && ` · first ${n(MAX_POINTS)} kept`}
            </p>
          )}
          {!cloudBusy && !cloud && !cloudNote && <p className="note">XYZ or CSV. You can also drop a file on the view.</p>}
          {cloudNote && (
            <p className="note is-error" role="alert" data-testid="points-error">
              {cloudNote}
            </p>
          )}
          {cloud && (
            <button type="button" className="text-btn" onClick={st.closePoints}>
              <Icon name="back" />
              Back to the blast
            </button>
          )}
        </Group>
      </div>
    </div>
  )
}
