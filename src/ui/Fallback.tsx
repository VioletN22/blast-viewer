import { useReducedMotion } from './useAutoplay'

const BASE = import.meta.env.BASE_URL
export const FALLBACK_NOTE = 'Your browser could not start WebGL, so this is a recording of the live viewer.'

/**
 * Shown instead of the 3D view when WebGL is missing, the renderer fails or
 * its context is lost: a muted, looping recording of the live viewer. With
 * reduced motion it does not autoplay and shows its controls instead.
 * `retry` adds a line saying that another stress scale tries the live view again.
 */
export function Fallback({ retry = false }: { retry?: boolean }) {
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
        {FALLBACK_NOTE}
        {retry && <span> Choosing another stress scale tries the live view again.</span>}
      </figcaption>
    </figure>
  )
}
