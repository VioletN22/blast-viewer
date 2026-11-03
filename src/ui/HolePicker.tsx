import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import { useBlast } from '../state/store'
import { HOLE_CARD_ID } from './HoleCard'

const optionId = (id: string) => `hole-option-${id}`

/**
 * Keyboard route to the holes, which are otherwise only clickable in the 3D
 * view: a listbox that is visually hidden until it has focus. Up/Down (and
 * Home/End) move through the holes, Enter or Space opens the hole's card and
 * moves focus to it; closing the card (Escape or its button) brings focus back.
 */
export function HolePicker({ onPick, fallbackFocus }: { onPick?(): void; fallbackFocus?: RefObject<HTMLElement | null> }) {
  const holes = useBlast((s) => s.scenario?.holes)
  const selectedHoleId = useBlast((s) => s.selectedHoleId)
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  /** True from a pick here until the card closes, so focus goes to the card and comes back. */
  const owns = useRef(false)

  useEffect(() => {
    if (!owns.current) return
    if (selectedHoleId) {
      document.getElementById(HOLE_CARD_ID)?.focus()
      return
    }
    owns.current = false
    // Only when focus went down with the card; a viewer who has moved on keeps their place.
    if (document.activeElement && document.activeElement !== document.body) return
    const list = listRef.current
    if (list && list.getClientRects().length > 0) list.focus()
    else fallbackFocus?.current?.focus()
  }, [selectedHoleId, fallbackFocus])

  if (!holes || holes.length === 0) return null
  const i = Math.min(active, holes.length - 1)
  const hole = holes[i]

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const last = holes.length - 1
    let next = i
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = Math.min(last, i + 1)
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = Math.max(0, i - 1)
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = last
    else if (e.key === 'Enter' || e.key === ' ') {
      // preventDefault also keeps Space from toggling playback (the timeline keys skip handled events).
      e.preventDefault()
      owns.current = true
      useBlast.getState().selectHole(hole.id)
      onPick?.()
      return
    } else return
    e.preventDefault()
    setActive(next)
  }

  return (
    <div className="hole-picker">
      <div
        ref={listRef}
        className="hole-list"
        role="listbox"
        tabIndex={0}
        aria-label="Holes"
        aria-activedescendant={optionId(hole.id)}
        onKeyDown={onKeyDown}
      >
        {holes.map((h, k) => (
          <div key={h.id} id={optionId(h.id)} role="option" aria-selected={k === i}>
            Hole {h.id}, fires at {Math.round(h.delayMs).toLocaleString('en-US')} ms
          </div>
        ))}
      </div>
      {/* What sighted keyboard users see while the hidden list has focus. */}
      <p className="hole-picker-hint" aria-hidden="true">
        Hole {hole.id}. Up and down move, Enter opens.
      </p>
    </div>
  )
}
