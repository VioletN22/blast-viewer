import { Component, type ReactNode } from 'react'

interface State {
  error: Error | null
}

/** Catches a WebGL or scene failure and shows a readable message instead of a blank page. */
export class StageBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="status status-error" role="alert">
        <strong>The 3D view could not start.</strong>
        <span>This page needs WebGL. {this.state.error.message}</span>
      </div>
    )
  }
}
