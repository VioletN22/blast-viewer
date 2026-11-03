/** Where the header's portfolio link points. Switch to the /3d page once it exists. */
export const PORTFOLIO_URL = 'https://www.violetnwe.com/3d'
const PORTFOLIO_LABEL = PORTFOLIO_URL.replace(/^https:\/\/(www\.)?/, '')
const REPO = 'https://github.com/VioletN22/blast-viewer'

import { useBlast } from '../state/store'

/** The data note on the pit: where the ground comes from, and that the blast is still a model. */
export const pitNote = (k: number) =>
  `Ground: SRTM elevation of the Super Pit, ${k === 1 ? 'true height' : `height x${k}`}. The blast is a synthetic model, not a prediction.`
export const SYNTHETIC_NOTE = 'Synthetic data. Illustrative model, not a prediction.'
const POINTS_NOTES = {
  sample: 'Sample points taken from the SRTM grid of the Super Pit.',
  file: 'Your points. The file is read in the browser and not uploaded.',
} as const

/** Title, the data note, and links back to the portfolio and the source. */
export function Header() {
  const pit = useBlast((s) => s.scenario?.site != null)
  const cloudSource = useBlast((s) => (s.cloud ? s.cloudSource : null))
  const exaggeration = useBlast((s) => s.exaggeration)
  return (
    <header className="app-header">
      <h1>Bench blast viewer</h1>
      <p>{cloudSource ? POINTS_NOTES[cloudSource] : pit ? pitNote(exaggeration) : SYNTHETIC_NOTE}</p>
      <nav className="header-links" aria-label="Links">
        <a href={PORTFOLIO_URL} target="_blank" rel="noopener" aria-label={`${PORTFOLIO_LABEL} (opens in a new tab)`}>
          {PORTFOLIO_LABEL}
        </a>
        <a href={REPO} target="_blank" rel="noopener" aria-label="Source on GitHub (opens in a new tab)">
          Source
        </a>
      </nav>
    </header>
  )
}
