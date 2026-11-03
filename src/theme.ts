/**
 * The one accent, a light violet: the active state in the panel, the scrubber
 * head, the ore-zone outline and the blast outline in the 3D view. main.tsx
 * writes both values to CSS (--accent, --accent-ink), so the page and the
 * scene read the same colour. ACCENT_INK is text or marks on the accent.
 */
export const ACCENT = '#b49cff'
export const ACCENT_INK = '#2b0b50'

/** Puts the accent on :root as CSS custom properties. */
export function applyTheme(root: HTMLElement = document.documentElement) {
  root.style.setProperty('--accent', ACCENT)
  root.style.setProperty('--accent-ink', ACCENT_INK)
}
