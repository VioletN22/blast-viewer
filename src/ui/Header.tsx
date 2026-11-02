/** Where the header's portfolio link points. Switch to the /3d page once it exists. */
export const PORTFOLIO_URL = 'https://www.violetnwe.com/3d'
const PORTFOLIO_LABEL = PORTFOLIO_URL.replace(/^https:\/\/(www\.)?/, '')
const REPO = 'https://github.com/VioletN22/blast-viewer'

/** Title, the synthetic-data note, and links back to the portfolio and the source. */
export function Header() {
  return (
    <header className="app-header">
      <h1>Bench blast viewer</h1>
      <p>Synthetic data. Illustrative model, not a prediction.</p>
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
