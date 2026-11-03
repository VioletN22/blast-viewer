export interface TerrainOptions {
  width: number
  depth: number
  resolution: number
  benchHeight: number
  crestZ: number
  faceAngleDeg: number
  seed: number
}

export const DEFAULT_TERRAIN: TerrainOptions = {
  width: 160,
  depth: 140,
  resolution: 1,
  benchHeight: 12,
  crestZ: 0,
  faceAngleDeg: 70,
  seed: 7,
}

export interface Terrain {
  options: TerrainOptions
  cols: number
  rows: number
  /** Row-major: index = row * cols + col, col along x, row along z. */
  heights: Float32Array
  heightAt(x: number, z: number): number
  /** 'synthetic' for the generated bench, 'dem' for a real surface resampled at a site. */
  source: 'synthetic' | 'dem'
}

export interface PatternOptions {
  rows: number
  cols: number
  burden: number
  spacing: number
  staggered: boolean
  holeDelayMs: number
  rowDelayMs: number
  initiationCol: number
  subdrill: number
  /** kg per cubic metre */
  powderFactor: number
}

export const DEFAULT_PATTERN: PatternOptions = {
  rows: 6,
  cols: 20,
  burden: 4.5,
  spacing: 5.2,
  staggered: true,
  holeDelayMs: 25,
  rowDelayMs: 67,
  initiationCol: 10,
  subdrill: 1.2,
  powderFactor: 0.75,
}

export interface DrillHole {
  id: string
  row: number
  col: number
  x: number
  z: number
  collarY: number
  depth: number
  chargeKg: number
  delayMs: number
}
