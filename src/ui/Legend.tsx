import { useMemo } from 'react'
import { lastFireMs } from '../sim/fire'
import { useBlast } from '../state/store'
import { RAMP_CSS } from '../scene/colors'

/** The colour ramp with quarter ticks and its two ends in mono. */
export function Ramp({ lo, hi }: { lo: string; hi: string }) {
  return (
    <div className="ramp">
      <div className="ramp-bar" style={{ background: RAMP_CSS }} aria-hidden="true" />
      <div className="ramp-ticks" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
        <i />
      </div>
      <div className="ramp-ends" aria-label={`${lo} to ${hi}`}>
        <span>{lo}</span>
        <span>{hi}</span>
      </div>
    </div>
  )
}

/** What the rock colour means (movement in metres or firing delay in ms), plus the ore-zone key when it is on. */
export function Legend() {
  const scenario = useBlast((s) => s.scenario)
  const colorBy = useBlast((s) => s.colorBy)
  const showDigLine = useBlast((s) => s.showDigLine)
  const maxDelay = useMemo(() => (scenario ? lastFireMs(scenario.holes) : 0), [scenario])
  if (!scenario) return null
  const movement = colorBy === 'movement'
  const max = movement ? `${scenario.fragments.maxMagnitude.toFixed(1)}` : Math.round(maxDelay).toLocaleString('en-US')
  return (
    <div className="legend" role="group" aria-label="Legend">
      <div className="legend-title">
        {movement ? 'Movement' : 'Firing delay'} <span className="unit">{movement ? 'm' : 'ms'}</span>
      </div>
      <Ramp lo="0" hi={max} />
      <p className="legend-note">Hole collars always show delay.</p>
      {showDigLine && (
        <ul className="legend-keys" aria-label="Ore zone">
          <li>
            <span className="sw sw-before" aria-hidden="true" />
            Ore zone before, dashed
          </li>
          <li>
            <span className="sw sw-after" aria-hidden="true" />
            Ore zone after
          </li>
        </ul>
      )}
    </div>
  )
}
