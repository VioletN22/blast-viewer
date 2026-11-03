/**
 * Line icons, drawn once as a sprite and placed with <Icon name="..." />.
 * A 16 px grid, 1.5 px strokes, no fills, so they sit with the type.
 */
export type IconName = 'play' | 'pause' | 'upload' | 'chevron' | 'layers' | 'close' | 'back'

export function IconSprite() {
  return (
    <svg className="icon-sprite" aria-hidden="true" focusable="false">
      <defs>
        <symbol id="i-play" viewBox="0 0 16 16">
          <path d="M5 3.2v9.6L12.6 8z" />
        </symbol>
        <symbol id="i-pause" viewBox="0 0 16 16">
          <path d="M5.5 3.5v9M10.5 3.5v9" />
        </symbol>
        <symbol id="i-upload" viewBox="0 0 16 16">
          <path d="M8 10.5V2.75M4.75 6 8 2.75 11.25 6M2.75 10.5v2.75h10.5V10.5" />
        </symbol>
        <symbol id="i-chevron" viewBox="0 0 16 16">
          <path d="M4.5 6.25 8 9.75l3.5-3.5" />
        </symbol>
        <symbol id="i-layers" viewBox="0 0 16 16">
          <path d="M8 2.5 14 5.5 8 8.5 2 5.5zM2 8.25l6 3 6-3M2 11l6 3 6-3" />
        </symbol>
        <symbol id="i-close" viewBox="0 0 16 16">
          <path d="M4 4l8 8M12 4l-8 8" />
        </symbol>
        <symbol id="i-back" viewBox="0 0 16 16">
          <path d="M6.5 4.25 2.75 8l3.75 3.75M3 8h10.25" />
        </symbol>
      </defs>
    </svg>
  )
}

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg className="icon" width={size} height={size} aria-hidden="true" focusable="false">
      <use href={`#i-${name}`} />
    </svg>
  )
}
