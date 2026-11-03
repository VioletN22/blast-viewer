import { makeDem, type Dem } from '../dem'

/**
 * A test surface on a 5 m grid, 1 km square: a flat bench at 100 m west of
 * x = 0, a 35 degree face dropping 15 m to the east, then a flat floor at 85 m.
 */
export function steppedDem(): Dem {
  const cols = 201
  const rows = 201
  const cell = 5
  const h = new Float32Array(cols * rows)
  const run = 15 / Math.tan((35 * Math.PI) / 180)
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x = -500 + i * cell
      h[j * cols + i] = x <= 0 ? 100 : x >= run ? 85 : 100 - (x / run) * 15
    }
  }
  return makeDem(cols, rows, cell, h)
}
