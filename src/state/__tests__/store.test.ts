import { beforeEach, describe, expect, it } from 'vitest'
import { buildScenario } from '../../sim/scenario'
import { steppedDem } from '../../sim/__tests__/demFixture'
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

  it('store: the pit and back, and a click moves the blast', async () => {
    useBlast.setState({ dem: steppedDem(), demStatus: 'ready', cloud: null })
    await useBlast.getState().setGround('pit')
    // The fixture has no pit below its rim, so the automatic pick finds nothing and the ground stays.
    expect(useBlast.getState().scenario!.site).toBeNull()
    expect(useBlast.getState().siteNote).toMatch(/No bench/)
    useBlast.setState({ scenario: buildScenario({ seed: 1, scale: 1, ground: 'pit', site: { x: -30, z: 0 } }, steppedDem()), ground: 'pit' })
    const before = useBlast.getState().scenario!.site!
    const seq = useBlast.getState().viewSeq
    useBlast.getState().placeSite(-40, 200)
    const s = useBlast.getState()
    expect(s.siteNote).toBeNull()
    expect(s.scenario!.site!.z).not.toBeCloseTo(before.z, 0)
    expect(s.view).toBe('blast')
    expect(s.viewSeq).toBe(seq + 1)
    // A click far from any face puts the blast on the nearest one and says how far it went.
    useBlast.getState().placeSite(-300, 0)
    expect(useBlast.getState().siteNote).toBe('Placed on the nearest face, 300 m away.')
    expect(useBlast.getState().siteNoteError).toBe(false)
    await useBlast.getState().setGround('bench')
    expect(useBlast.getState().scenario!.site).toBeNull()
    expect(useBlast.getState().ground).toBe('bench')
  })
})
