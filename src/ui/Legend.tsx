import { useMemo } from 'react'
import { lastFireMs } from '../sim/fire'
import { useBlast } from '../state/store'
import { RAMP_CSS } from '../scene/colors'
import { ScaleBar } from './ScaleBar'

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
    <div className="legend panel" role="group" aria-label="Legend">
      <div className="legend-title">{movement ? 'Movement (m)' : 'Firing delay (ms)'}</div>
      <div className="legend-ramp" style={{ background: RAMP_CSS }} aria-hidden="true" />
      <div className="legend-scale" aria-label={`0 to ${max}`}>
        <span>0</span>
        <span>{max}</span>
      </div>
      <p className="legend-note">Hole collars always by firing delay</p>
      {showDigLine && (
        <ul className="legend-keys" aria-label="Ore zone">
          <li>
            <span className="sw sw-before" aria-hidden="true" />
            Ore zone before (dashed)
          </li>
          <li>
            <span className="sw sw-after" aria-hidden="true" />
            Ore zone after
          </li>
        </ul>
      )}
      <ScaleBar />
    </div>
  )
}
