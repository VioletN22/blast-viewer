import { useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Icon } from './Icons'

const GROUPS_KEY = 'blast-viewer.groups'

function readGroups(): Record<string, boolean> {
  try {
    const v = JSON.parse(localStorage.getItem(GROUPS_KEY) ?? '{}')
    return v && typeof v === 'object' ? v : {}
  } catch {
    return {}
  }
}

function saveGroup(id: string, open: boolean) {
  try {
    localStorage.setItem(GROUPS_KEY, JSON.stringify({ ...readGroups(), [id]: open }))
  } catch {
    // Storage blocked (a private window): the group still opens and closes, it is just not remembered.
  }
}

/** A titled group of controls that opens and closes on its title; the state is remembered per browser. */
export function Group({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  const [open, setOpen] = useState(() => readGroups()[id] ?? true)
  const bodyId = `group-${id}`
  return (
    <section className={`group${open ? ' is-open' : ''}`}>
      <h2 className="group-title">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => {
            setOpen(!open)
            saveGroup(id, !open)
          }}
        >
          <span>{title}</span>
          <Icon name="chevron" />
        </button>
      </h2>
      <div id={bodyId} className="group-body" hidden={!open}>
        {children}
      </div>
    </section>
  )
}

/** aria replaces the visible label for screen readers; note is a grey line after it. */
export type Option<T> = { v: T; label: string; aria?: string; note?: string }

/**
 * A row of choices drawn as text: the active one in the accent with a rule under it.
 * Native radios underneath, so arrows move the choice and screen readers read a radio group.
 * onRepeat runs when the checked option is clicked again.
 */
export function TextChoice<T extends string | number>({
  label,
  name,
  options,
  value,
  onChange,
  onRepeat,
  mono,
}: {
  label: string
  name: string
  options: Option<T>[]
  value: T | null
  onChange(v: T): void
  onRepeat?(v: T): void
  mono?: boolean
}) {
  const id = useId()
  return (
    <div className="row">
      <span className="row-label" id={id}>
        {label}
      </span>
      <div className={`text-choice${mono ? ' is-mono' : ''}`} role="radiogroup" aria-labelledby={id}>
        {options.map((o) => (
          <label key={String(o.v)}>
            <input
              type="radio"
              name={name}
              value={String(o.v)}
              checked={value === o.v}
              onChange={() => onChange(o.v)}
              onClick={() => value === o.v && onRepeat?.(o.v)}
              aria-label={o.aria}
            />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

/** A short list of choices, one per line, with a round mark that fills with the accent. */
export function DotChoice<T extends string>({ label, name, options, value, onChange }: { label: string; name: string; options: Option<T>[]; value: T | null; onChange(v: T): void }) {
  const id = useId()
  return (
    <div className="dot-choice" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <label key={o.v}>
          <input type="radio" name={name} value={o.v} checked={value === o.v} onChange={() => onChange(o.v)} aria-describedby={o.note ? `${id}-${o.v}` : undefined} />
          <span className="dot" aria-hidden="true" />
          <span className="dot-label">{o.label}</span>
          {o.note && (
            <span className="dot-note" id={`${id}-${o.v}`} aria-hidden="true">
              {o.note}
            </span>
          )}
        </label>
      ))}
    </div>
  )
}

/** A checkbox drawn as a small square with a tick in the accent, and a one-word hint shown on hover or focus. */
export function Check({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange(v: boolean): void }) {
  const hintId = useId()
  return (
    <label className="check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.currentTarget.checked)} aria-describedby={hintId} />
      <span className="box" aria-hidden="true">
        <svg viewBox="0 0 12 12" width="12" height="12">
          <path d="M2.5 6.25 5 8.75l4.5-5.5" />
        </svg>
      </span>
      <span className="check-label">{label}</span>
      <span className="check-hint" id={hintId} aria-hidden="true">
        {hint}
      </span>
    </label>
  )
}

/**
 * A stepped slider. Keys and taps commit at once; a drag commits on release,
 * so passing over a heavy value on the way does not build it.
 */
export function StepSlider({ label, min, max, value, onCommit }: { label: string; min: number; max: number; value: number; onCommit(v: number): void }) {
  const [draft, setDraft] = useState<number | null>(null)
  const dragging = useRef(false)
  const id = useId()
  const shown = draft ?? value
  const steps = Array.from({ length: max - min + 1 }, (_, i) => min + i)
  const commit = (v: number) => {
    setDraft(null)
    if (v !== value) onCommit(v)
  }
  return (
    <div className="step-slider">
      <label className="row-label" htmlFor={id}>
        {label}
      </label>
      <div className="step-track" style={{ '--f': (shown - min) / (max - min) } as CSSProperties}>
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={1}
          value={shown}
          onPointerDown={() => (dragging.current = true)}
          onPointerUp={(e) => {
            dragging.current = false
            commit(Number(e.currentTarget.value))
          }}
          onPointerCancel={() => {
            dragging.current = false
            setDraft(null)
          }}
          onChange={(e) => {
            const v = Number(e.currentTarget.value)
            if (dragging.current) setDraft(v)
            else commit(v)
          }}
        />
        <div className="step-ticks" aria-hidden="true">
          {steps.map((s) => (
            <span key={s} className={s === shown ? 'is-on' : undefined}>
              {s}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
