import { RAMP_CSS } from '../scene/colors'
import { useBlast } from '../state/store'
import { ScaleBar } from './ScaleBar'

/** Legend for loaded points: the height ramp in the file's own levels, the count and the scale bar. */
export function PointsLegend() {
  const cloud = useBlast((s) => s.cloud)
  if (!cloud) return null
  const lo = (cloud.centre.z + cloud.minY).toFixed(1)
  const hi = (cloud.centre.z + cloud.maxY).toFixed(1)
  return (
    <div className="legend panel" role="group" aria-label="Legend">
      <div className="legend-title">Height (m)</div>
      <div className="legend-ramp" style={{ background: RAMP_CSS }} aria-hidden="true" />
      <div className="legend-scale" aria-label={`${lo} to ${hi}`}>
        <span>{lo}</span>
        <span>{hi}</span>
      </div>
      <p className="legend-note">Centred on the points' own centroid</p>
      <ScaleBar />
    </div>
  )
}
