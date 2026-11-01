import { useReducedMotion } from './useAutoplay'

const BASE = import.meta.env.BASE_URL
/** Why the live view is not showing: no WebGL at all, or a renderer that stopped (a lost context or a render error). */
export type FallbackReason = 'no-webgl' | 'stopped'

const TAIL = ', so this is a recording of the live viewer.'
export const FALLBACK_NOTES: Record<FallbackReason, string> = {
  'no-webgl': `Your browser could not start WebGL${TAIL}`,
  stopped: `The 3D view stopped (graphics context lost)${TAIL}`,
}

/**
 * Shown instead of the 3D view when WebGL is missing, the renderer fails or
 * its context is lost: a muted, looping recording of the live viewer. With
 * reduced motion it does not autoplay and shows its controls instead.
 * The note follows the reason; after a stop it adds that another stress scale
 * tries the live view again.
 */
export function Fallback({ reason }: { reason: FallbackReason }) {
  const reduced = useReducedMotion()
  return (
    <figure className="fallback" data-testid="fallback">
      <video
        className="fallback-video"
        src={`${BASE}fallback/blast.mp4`}
        poster={`${BASE}fallback/poster.jpg`}
        muted
        loop
        playsInline
        autoPlay={!reduced}
        controls={reduced}
        preload="metadata"
        aria-label="Recording of the bench blast viewer playing the default scenario"
      />
      <figcaption className="fallback-note">
        {FALLBACK_NOTES[reason]}
        {reason === 'stopped' && <span> Choosing another stress scale tries the live view again.</span>}
      </figcaption>
    </figure>
  )
}
