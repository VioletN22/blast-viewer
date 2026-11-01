import { useEffect, useState } from 'react'
import { useBlast, type ColorBy, type Scale } from '../state/store'

const SCALES: Scale[] = [1, 2, 3, 4]
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
  const st = useBlast.getState()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div className={`controls${open ? ' is-open' : ''}`}>
      <button type="button" className="controls-toggle panel" aria-label="Layers" aria-expanded={open} aria-controls="view-options" onClick={() => setOpen((o) => !o)}>
        <LayersIcon />
        <span>Layers</span>
      </button>
      <div id="view-options" className="controls-panel panel" role="group" aria-label="View options">
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
      </div>
    </div>
  )
}
