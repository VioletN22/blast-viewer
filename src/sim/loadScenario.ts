import type { ScenarioParams } from './scenario'
import { validateScenarioParams } from './validate'

/** Fetches scenario parameters from url and validates their shape. */
export async function loadScenario(url: string): Promise<ScenarioParams> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Scenario params: could not load ${url} (${res.status} ${res.statusText})`)
  let body: unknown
  try {
    body = await res.json()
  } catch {
    throw new Error(`Scenario params: ${url} is not valid JSON`)
  }
  return validateScenarioParams(body)
}
