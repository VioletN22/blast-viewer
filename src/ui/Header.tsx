/** Where the header's portfolio link points. */
export const PORTFOLIO_URL = 'https://www.violetnwe.com/3d'
const REPO = 'https://github.com/VioletN22/blast-viewer'

import { useBlast, type Exaggeration } from '../state/store'

/** One reading in the header's status line: a short key and its value. */
export type Reading = { key: string; value: string }

/** The status line on the pit: where the ground comes from, the live height factor, and that the blast is a model. */
export const pitReadings = (k: Exaggeration): Reading[] => [
  { key: 'ground', value: 'super pit, srtm 30 m' },
  { key: 'height', value: `x${k}` },
  { key: 'blast', value: 'synthetic model, not a prediction' },
]
export const SYNTHETIC_READINGS: Reading[] = [
  { key: 'ground', value: 'synthetic bench' },
  { key: 'blast', value: 'synthetic model, not a prediction' },
]
const POINTS_READINGS = {
  sample: [{ key: 'points', value: 'sample from the super pit srtm grid' }],
  file: [{ key: 'points', value: 'your file, read in the browser, not uploaded' }],
} as const satisfies Record<string, Reading[]>

/** The same readings as one sentence, for the tooltip and screen readers. */
export const readingsText = (r: readonly Reading[]) => r.map((x) => `${x.key}: ${x.value}`).join('; ')

/** Title, the status line, and links back to the portfolio and the source. */
export function Header() {
  const pit = useBlast((s) => s.scenario?.site != null)
  const cloudSource = useBlast((s) => (s.cloud ? s.cloudSource : null))
  const exaggeration = useBlast((s) => s.exaggeration)
  const readings = cloudSource ? POINTS_READINGS[cloudSource] : pit ? pitReadings(exaggeration) : SYNTHETIC_READINGS
  return (
    <header className="app-header">
      <h1>Bench blast viewer</h1>
      <p className="readout" data-testid="readout" title={readingsText(readings)}>
        {readings.map((r) => (
          <span key={r.key} className="reading">
            <span className="reading-key">{r.key}</span> <span className="reading-value">{r.value}</span>
          </span>
        ))}
      </p>
      <nav className="header-links" aria-label="Links">
        <a href={PORTFOLIO_URL} target="_blank" rel="noopener" aria-label="portfolio (opens in a new tab)">
          portfolio
        </a>
        <a href={REPO} target="_blank" rel="noopener" aria-label="source on GitHub (opens in a new tab)">
          source
        </a>
      </nav>
    </header>
  )
}
