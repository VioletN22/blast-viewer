import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'

/** Matches the phone CSS media query and isPhone in src/lib/device.ts. */
export const PHONE_QUERY = '(max-width: 767px), (max-height: 500px)'
/** The grab handle's height; the closed sheet is only this. */
export const HANDLE_PX = 40
/** Below this much room under the legend, the full sheet covers the legend instead (a phone in landscape). */
const MIN_FULL_PX = 240

export type Snap = 'closed' | 'half' | 'full'

function usePhone(): boolean {
  const [phone, setPhone] = useState(() => typeof window.matchMedia === 'function' && window.matchMedia(PHONE_QUERY).matches)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia(PHONE_QUERY)
    const on = () => setPhone(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return phone
}

/**
 * Heights of the two open snaps, from the room between the header and the
 * timeline and the height of the legend row that sits on the sheet.
 */
function snapHeights(room: number, legend: number): Record<Snap, number> {
  // A landscape phone is too short to keep the legend clear: the full sheet takes the room.
  const full = Math.max(HANDLE_PX, room - legend >= MIN_FULL_PX ? room - legend : room - 8)
  const half = Math.max(HANDLE_PX, Math.min(full, Math.round(room * 0.45)))
  return { closed: HANDLE_PX, half, full }
}

/**
 * The phone bottom sheet: closed (the handle only), half or full. A tap on the
 * handle opens it half way or closes it; a drag snaps to the nearest height;
 * Up and Down on the handle step between heights. The height is written to
 * --sheet-h on the view, so the legend can sit above the sheet.
 */
export function useSheet(rootRef: RefObject<HTMLElement | null>) {
  const phone = usePhone()
  const [snap, setSnap] = useState<Snap>('closed')
  const [dragPx, setDragPx] = useState<number | null>(null)
  const [room, setRoom] = useState(0)
  const [legend, setLegend] = useState(0)
  const drag = useRef<{ y: number; h: number; moved: boolean } | null>(null)

  // The room: the view's height less the timeline under the sheet.
  useEffect(() => {
    const root = rootRef.current
    const view = root?.closest<HTMLElement>('.viewport')
    if (!root || !view) return
    const measure = () => {
      setRoom(Math.max(0, root.getBoundingClientRect().bottom - view.getBoundingClientRect().top))
      setLegend(view.querySelector<HTMLElement>('.dock-row')?.offsetHeight ?? 0)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(view)
    // The legend row grows with the ore-zone key and changes when the hole card replaces the legend.
    const mo = new MutationObserver(measure)
    mo.observe(view, { childList: true, subtree: true })
    return () => {
      ro.disconnect()
      mo.disconnect()
    }
  }, [rootRef, phone])

  const heights = snapHeights(room, legend)
  const height = !phone ? 0 : dragPx ?? heights[snap]

  useEffect(() => {
    const view = rootRef.current?.closest<HTMLElement>('.viewport')
    if (!view) return
    view.style.setProperty('--sheet-h', `${height}px`)
  }, [height, rootRef])
  useEffect(() => {
    const view = rootRef.current?.closest<HTMLElement>('.viewport')
    return () => void view?.style.removeProperty('--sheet-h')
  }, [rootRef])

  const close = useCallback(() => setSnap('closed'), [])
  const open = snap !== 'closed' || dragPx !== null

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (!phone || e.button !== 0) return
    drag.current = { y: e.clientY, h: heights[snap], moved: false }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current
    if (!d) return
    const dy = d.y - e.clientY
    if (!d.moved && Math.abs(dy) < 6) return
    d.moved = true
    setDragPx(Math.min(heights.full, Math.max(HANDLE_PX, d.h + dy)))
  }
  const onPointerUp = (e: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current
    drag.current = null
    if (!d?.moved) return
    // A drag is not a tap: the click that follows must not toggle the sheet again.
    e.currentTarget.dataset.dragged = '1'
    const h = Math.min(heights.full, Math.max(HANDLE_PX, d.h + (d.y - e.clientY)))
    const nearest = (['closed', 'half', 'full'] as Snap[]).reduce((a, b) => (Math.abs(heights[b] - h) < Math.abs(heights[a] - h) ? b : a))
    setDragPx(null)
    setSnap(nearest)
  }
  const onClick = (e: ReactMouseEvent<HTMLElement>) => {
    if (e.currentTarget.dataset.dragged) {
      delete e.currentTarget.dataset.dragged
      return
    }
    setSnap((s) => (s === 'closed' ? 'half' : 'closed'))
  }
  const onKeyDown = (e: ReactKeyboardEvent<HTMLElement>) => {
    if (e.key === 'ArrowUp') setSnap((s) => (s === 'closed' ? 'half' : 'full'))
    else if (e.key === 'ArrowDown') setSnap((s) => (s === 'full' ? 'half' : 'closed'))
    else return
    e.preventDefault()
  }

  return {
    phone,
    snap: dragPx !== null ? 'drag' : snap,
    open,
    close,
    handle: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onClick, onKeyDown },
  }
}
