import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildScenario } from '../scenario'
import { loadScenario } from '../loadScenario'
import defaultParams from '../../../public/scenarios/default.json'

const budget = Number(process.env.BUILD_BUDGET_MS ?? 1500)

const stubFetch = (body: unknown, ok = true) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok, status: ok ? 200 : 404, statusText: ok ? 'OK' : 'Not Found', json: async () => body })),
  )

afterEach(() => vi.unstubAllGlobals())

describe('scenario', () => {
  it('scenario: same params same scenario', () => {
    const a = buildScenario({ seed: 42, scale: 1 })
    const b = buildScenario({ seed: 42, scale: 1 })
    expect(Array.from(a.fragments.end.subarray(0, 30))).toEqual(Array.from(b.fragments.end.subarray(0, 30)))
    const c = buildScenario({ seed: 43, scale: 1 })
    expect(Array.from(c.fragments.end.subarray(0, 30))).not.toEqual(Array.from(a.fragments.end.subarray(0, 30)))
  })
  it('scenario: scale sets cols and fragments per hole', () => {
    const s1 = buildScenario({ seed: 1, scale: 1 })
    expect(s1.holes).toHaveLength(120)
    expect(s1.fragments.count).toBe(120 * 24)
    const s2 = buildScenario({ seed: 1, scale: 2 })
    expect(s2.holes).toHaveLength(180)
    expect(s2.fragments.count).toBe(180 * 40)
  })
  it('scenario: durationMs = last fire + max flight + 500', () => {
    const s = buildScenario({ seed: 1, scale: 1 })
    const lastFire = Math.max(...s.holes.map((h) => h.delayMs))
    const maxFlight = Math.max(...Array.from(s.fragments.flightMs))
    expect(s.durationMs).toBeCloseTo(lastFire + maxFlight + 500)
  })
  it('scale 4 builds under 1500 ms', () => {
    const t0 = performance.now()
    const s = buildScenario({ seed: 1, scale: 4 })
    const ms = performance.now() - t0
    expect(s.holes).toHaveLength(300)
    expect(s.fragments.count).toBe(300 * 96)
    expect(ms).toBeLessThan(budget)
  })
  it('default.json is valid params', async () => {
    stubFetch(defaultParams)
    const p = await loadScenario('/scenarios/default.json')
    expect(p.scale).toBe(1)
    expect(typeof p.seed).toBe('number')
  })
  it('loadScenario rejects a bad shape with a readable message', async () => {
    stubFetch({ seed: 1, scale: 7 })
    await expect(loadScenario('x.json')).rejects.toThrow('Scenario params: "scale" must be 1, 2, 3 or 4')
    stubFetch({ scale: 1 })
    await expect(loadScenario('x.json')).rejects.toThrow('"seed"')
    stubFetch({ seed: 1, scale: 1, pattern: { rows: 'six' } })
    await expect(loadScenario('x.json')).rejects.toThrow('"pattern.rows"')
    stubFetch([1, 2])
    await expect(loadScenario('x.json')).rejects.toThrow('Scenario params')
    stubFetch({}, false)
    await expect(loadScenario('x.json')).rejects.toThrow('404')
  })
})
