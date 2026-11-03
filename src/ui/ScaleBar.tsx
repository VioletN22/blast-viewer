import { scaleBar } from '../lib/scaleBar'
import { useMetresPerPixel } from '../state/view'

/** A bar of a round length at the orbit target's distance, drawn in two halves like a map scale, so sizes on screen read in metres. */
export function ScaleBar({ maxPx = 96 }: { maxPx?: number }) {
  const mpp = useMetresPerPixel((s) => s.mpp)
  const bar = scaleBar(mpp, maxPx)
  if (!bar) return null
  return (
    <div className="scale-bar" data-testid="scale-bar" aria-label={`Scale bar: ${bar.label} at the view centre`}>
      <span className="scale-bar-line" style={{ width: `${Math.round(bar.px)}px` }} aria-hidden="true">
        <i />
        <i />
      </span>
      <span className="scale-bar-label">{bar.label}</span>
    </div>
  )
}
