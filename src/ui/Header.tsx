const SITE = 'https://www.violetnwe.com/3d'
const REPO = 'https://github.com/VioletN22/blast-viewer'

/** Title, the synthetic-data note, and links back to the portfolio and the source. */
export function Header() {
  return (
    <header className="app-header">
      <h1>Bench blast viewer</h1>
      <p>Synthetic data. Illustrative model, not a prediction.</p>
      <nav className="header-links" aria-label="Links">
        <a href={SITE} target="_blank" rel="noopener" aria-label="violetnwe.com/3d (opens in a new tab)">
          violetnwe.com/3d
        </a>
        <a href={REPO} target="_blank" rel="noopener" aria-label="Source on GitHub (opens in a new tab)">
          Source
        </a>
      </nav>
    </header>
  )
}
