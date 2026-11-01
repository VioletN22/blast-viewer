import type { ScenarioParams } from './scenario'
import type { PatternOptions, TerrainOptions } from './types'

const fail = (msg: string): never => {
  throw new Error(`Scenario params: ${msg}`)
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

type Rule = 'bool' | 'int' | 'count' | 'index' | 'positive' | 'nonNegative' | 'angle' | 'finite'

/** Per-option rules: counts are whole numbers of at least 1, sizes are strictly positive. */
const TERRAIN_RULES: Record<keyof TerrainOptions, Rule> = {
  width: 'positive',
  depth: 'positive',
  resolution: 'count',
  benchHeight: 'positive',
  crestZ: 'finite',
  faceAngleDeg: 'angle',
  seed: 'int',
}
const PATTERN_RULES: Record<keyof PatternOptions, Rule> = {
  rows: 'count',
  cols: 'count',
  burden: 'positive',
  spacing: 'positive',
  staggered: 'bool',
  holeDelayMs: 'nonNegative',
  rowDelayMs: 'nonNegative',
  initiationCol: 'index',
  subdrill: 'nonNegative',
  powderFactor: 'positive',
}

function checkValue(field: string, rule: Rule, val: unknown): void {
  if (rule === 'bool') {
    if (typeof val !== 'boolean') fail(`"${field}" must be true or false`)
    return
  }
  if (typeof val !== 'number' || !Number.isFinite(val)) return fail(`"${field}" must be a finite number`)
  switch (rule) {
    case 'int':
      if (!Number.isInteger(val)) fail(`"${field}" must be a whole number`)
      break
    case 'count':
      if (!Number.isInteger(val) || val < 1) fail(`"${field}" must be a whole number of at least 1`)
      break
    case 'index':
      if (!Number.isInteger(val) || val < 0) fail(`"${field}" must be a whole number of at least 0`)
      break
    case 'positive':
      if (val <= 0) fail(`"${field}" must be greater than 0`)
      break
    case 'nonNegative':
      if (val < 0) fail(`"${field}" must be 0 or more`)
      break
    case 'angle':
      if (val <= 0 || val > 90) fail(`"${field}" must be greater than 0 and at most 90`)
      break
  }
}

function checkOptions(name: string, v: unknown, rules: Readonly<Record<string, Rule>>): Record<string, unknown> | undefined {
  if (v === undefined) return undefined
  if (!isObject(v)) return fail(`"${name}" must be an object`)
  for (const [k, val] of Object.entries(v)) {
    if (!Object.hasOwn(rules, k)) fail(`"${name}.${k}" is not a known option`)
    checkValue(`${name}.${k}`, rules[k]!, val)
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
  const terrain = checkOptions('terrain', v.terrain, TERRAIN_RULES)
  const pattern = checkOptions('pattern', v.pattern, PATTERN_RULES)
  const out: ScenarioParams = { seed: v.seed as number, scale: v.scale as ScenarioParams['scale'] }
  if (terrain) out.terrain = terrain
  if (pattern) out.pattern = pattern
  return out
}
