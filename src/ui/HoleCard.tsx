import { useEffect, useMemo } from 'react'
import { hasFired } from '../sim/fire'
import { useBlast } from '../state/store'

/** Details of the selected hole and whether it has fired at the current time. Escape or the close button deselects. */
export function HoleCard() {
  const scenario = useBlast((s) => s.scenario)
  const id = useBlast((s) => s.selectedHoleId)
  const hole = useMemo(() => (id && scenario ? scenario.holes.find((h) => h.id === id) : undefined), [id, scenario])
  // A boolean selector: the card re-renders when the hole fires, not on every frame of playback.
  const fired = useBlast((s) => !!hole && hasFired(hole.delayMs, s.timeMs))

  useEffect(() => {
    if (!hole) return
    const onKey = (e: KeyboardEvent) => {
      // An open Layers sheet sits above the card and claims Escape first (preventDefault).
      if (e.key === 'Escape' && !e.defaultPrevented) useBlast.getState().selectHole(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hole])

  if (!hole) return null
  const close = () => useBlast.getState().selectHole(null)
  return (
    <section className="hole-card panel" role="dialog" aria-labelledby="hole-card-title">
      <div className="hc-head">
        <h2 id="hole-card-title">Hole {hole.id}</h2>
        <span className={`hc-status ${fired ? 'is-fired' : 'is-waiting'}`}>{fired ? 'fired' : 'waiting'}</span>
        <button type="button" className="hc-close" onClick={close} aria-label="Close hole details" title="Close (Esc)">
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
            <path d="M3.5 3.5l9 9m0-9-9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <dl className="hc-grid">
        <dt>Depth</dt>
        <dd>{hole.depth.toFixed(1)} m</dd>
        <dt>Charge</dt>
        <dd>{Math.round(hole.chargeKg).toLocaleString('en-US')} kg</dd>
        <dt>Delay</dt>
        <dd>{Math.round(hole.delayMs).toLocaleString('en-US')} ms</dd>
      </dl>
    </section>
  )
}
