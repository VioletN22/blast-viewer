import type { ScenarioParams } from './scenario'
import { DEFAULT_PATTERN, DEFAULT_TERRAIN } from './types'

const fail = (msg: string): never => {
  throw new Error(`Scenario params: ${msg}`)
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function checkOptions(name: string, v: unknown, defaults: object): Record<string, unknown> | undefined {
  if (v === undefined) return undefined
  if (!isObject(v)) return fail(`"${name}" must be an object`)
  const ref = defaults as Record<string, unknown>
  for (const [k, val] of Object.entries(v)) {
    if (!(k in ref)) fail(`"${name}.${k}" is not a known option`)
    if (typeof ref[k] === 'boolean') {
      if (typeof val !== 'boolean') fail(`"${name}.${k}" must be true or false`)
    } else if (typeof val !== 'number' || !Number.isFinite(val)) {
      fail(`"${name}.${k}" must be a finite number`)
    }
  }
  return v
}

/** Validates parsed JSON as ScenarioParams; throws a readable Error naming the bad field. */
export function validateScenarioParams(v: unknown): ScenarioParams {
  if (!isObject(v)) return fail('expected a JSON object')
  for (const k of Object.keys(v)) {
    if (k !== 'seed' && k !== 'scale' && k !== 'terrain' && k !== 'pattern') fail(`"${k}" is not a known field`)
  }
  if (typeof v.seed !== 'number' || !Number.isInteger(v.seed)) fail('"seed" must be an integer')
  if (v.scale !== 1 && v.scale !== 2 && v.scale !== 3 && v.scale !== 4) fail('"scale" must be 1, 2, 3 or 4')
  const terrain = checkOptions('terrain', v.terrain, DEFAULT_TERRAIN)
  const pattern = checkOptions('pattern', v.pattern, DEFAULT_PATTERN)
  const out: ScenarioParams = { seed: v.seed as number, scale: v.scale as ScenarioParams['scale'] }
  if (terrain) out.terrain = terrain
  if (pattern) out.pattern = pattern
  return out
}

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
