import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** Shown in place of the children after a render or renderer error. */
  fallback: ReactNode
  /** A change (a new scenario) clears the error and mounts the children again. */
  resetKey: unknown
}

interface State {
  error: Error | null
}

/** Catches a WebGL or scene failure (including a lost context) and shows the fallback instead of a blank page. */
export class StageBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null })
  }

  render() {
    return this.state.error ? this.props.fallback : this.props.children
  }
}
