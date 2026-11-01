import { beforeEach, describe, expect, it } from 'vitest'
import { buildScenario } from '../../sim/scenario'
import { useBlast } from '../store'

describe('store', () => {
  beforeEach(() => {
    useBlast.setState({ scenario: buildScenario({ seed: 20261101, scale: 1 }), timeMs: 0, playing: false, scale: 1, pendingScale: null })
  })

  it('store: setTime clamps', () => {
    const d = useBlast.getState().scenario!.durationMs
    useBlast.getState().setTime(-50)
    expect(useBlast.getState().timeMs).toBe(0)
    useBlast.getState().setTime(d + 1000)
    expect(useBlast.getState().timeMs).toBe(d)
    useBlast.getState().setTime(d / 2)
    expect(useBlast.getState().timeMs).toBe(d / 2)
  })

  it('store: setScale keeps the time fraction', () => {
    const d1 = useBlast.getState().scenario!.durationMs
    useBlast.getState().setTime(d1 * 0.4)
    useBlast.getState().setScale(2)
    const s = useBlast.getState()
    expect(s.scale).toBe(2)
    expect(s.scenario!.params.scale).toBe(2)
    expect(s.scenario!.holes.length).toBe(6 * 30)
    expect(s.timeMs / s.scenario!.durationMs).toBeCloseTo(0.4, 6)
  })

  it('store: setScale before load applies on setScenario', () => {
    useBlast.setState({ scenario: null, timeMs: 0, pendingScale: null })
    useBlast.getState().setScale(2)
    useBlast.getState().setScenario(buildScenario({ seed: 20261101, scale: 1 }))
    const s = useBlast.getState()
    expect(s.scale).toBe(2)
    expect(s.scenario!.params.scale).toBe(2)
    expect(s.pendingScale).toBeNull()
  })
})
