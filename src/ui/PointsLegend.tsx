import { useBlast } from '../state/store'
import { Ramp } from './Legend'

/** Legend for loaded points: the height ramp in the file's own levels. */
export function PointsLegend() {
  const cloud = useBlast((s) => s.cloud)
  if (!cloud) return null
  const lo = (cloud.centre.z + cloud.minY).toFixed(1)
  const hi = (cloud.centre.z + cloud.maxY).toFixed(1)
  return (
    <div className="legend" role="group" aria-label="Legend">
      <div className="legend-title">
        Height <span className="unit">m</span>
      </div>
      <Ramp lo={lo} hi={hi} />
      <p className="legend-note">Centred on the points' own centroid.</p>
    </div>
  )
}
