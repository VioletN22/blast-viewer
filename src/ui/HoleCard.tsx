import { useEffect, useMemo } from 'react'
import { hasFired } from '../sim/fire'
import { useBlast } from '../state/store'
import { Icon } from './Icons'

/** The card's element id, so the keyboard hole list can move focus to it. */
export const HOLE_CARD_ID = 'hole-card'

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
    // A live region rather than a dialog: it does not trap focus, and screen readers announce it when it opens.
    <section id={HOLE_CARD_ID} className="hole-card" role="region" aria-labelledby="hole-card-title" aria-live="polite" tabIndex={-1}>
      <div className="hc-head">
        <h2 id="hole-card-title">
          Hole <span className="mono">{hole.id}</span>
        </h2>
        <span className={`hc-status ${fired ? 'is-fired' : 'is-waiting'}`}>{fired ? 'fired' : 'waiting'}</span>
        <button type="button" className="hc-close" onClick={close} aria-label="Close hole details" title="Close (Esc)">
          <Icon name="close" size={14} />
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
