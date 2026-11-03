/**
 * Streaming parser for survey points: one point per line, x y z or
 * easting northing rl, split by commas, spaces, tabs or semicolons. An optional
 * header names the columns; lines starting with # or // are comments. Lines
 * that do not hold three numbers are skipped and counted.
 */

export interface PointCloud {
  count: number
  /** xyz triplets in the view frame, centred on the centroid: x east, y up (rl), z south. */
  positions: Float32Array
  /** The centroid in the file's own coordinates. */
  centre: { x: number; y: number; z: number }
  /** Half extents in plan and the height range, metres from the centroid. */
  halfX: number
  halfZ: number
  minY: number
  maxY: number
  /** Lines that were not comments, blank or the header and did not hold a point. */
  skipped: number
  /** True when the file had more than MAX_POINTS points and the rest were left out. */
  truncated: boolean
}

export const MAX_FILE_BYTES = 100 * 1024 * 1024
export const MAX_POINTS = 2_000_000

const SPLIT = /[\s,;]+/
const NAMES: Record<string, 0 | 1 | 2> = {
  x: 0,
  e: 0,
  east: 0,
  easting: 0,
  y: 1,
  n: 1,
  north: 1,
  northing: 1,
  z: 2,
  rl: 2,
  elev: 2,
  elevation: 2,
  height: 2,
  h: 2,
}

export class XyzParser {
  private rest = ''
  private seenData = false
  private cols: [number, number, number] = [0, 1, 2]
  private need = 3
  private buf = new Float64Array(3 * 65536)
  count = 0
  skipped = 0
  truncated = false

  /** Feeds the next chunk of text. A line cut by the chunk boundary waits for the next chunk. */
  push(text: string): void {
    const s = this.rest + text
    let start = 0
    for (;;) {
      const nl = s.indexOf('\n', start)
      if (nl < 0) break
      this.line(s.slice(start, nl))
      start = nl + 1
    }
    this.rest = s.slice(start)
  }

  private line(raw: string): void {
    if (this.truncated) return
    const t = raw.trim()
    if (!t || t.startsWith('#') || t.startsWith('//')) return
    const f = t.split(SPLIT)
    if (!this.seenData) {
      this.seenData = true
      if (f.some((v) => /[a-df-z_]/i.test(v) && !Number.isFinite(Number(v)))) {
        this.header(f)
        return
      }
    }
    if (f.length < this.need) {
      this.skipped++
      return
    }
    const a = Number(f[this.cols[0]])
    const b = Number(f[this.cols[1]])
    const c = Number(f[this.cols[2]])
    if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(c)) {
      this.skipped++
      return
    }
    if (this.count >= MAX_POINTS) {
      this.truncated = true
      return
    }
    if ((this.count + 1) * 3 > this.buf.length) {
      const next = new Float64Array(this.buf.length * 2)
      next.set(this.buf)
      this.buf = next
    }
    const o = this.count * 3
    this.buf[o] = a
    this.buf[o + 1] = b
    this.buf[o + 2] = c
    this.count++
  }

  /** A header line: columns it names take their place; otherwise the first three columns are x, y, z. */
  private header(f: string[]): void {
    const found: number[] = [-1, -1, -1]
    f.forEach((name, i) => {
      const k = NAMES[name.toLowerCase().replace(/[^a-z]/g, '')]
      if (k !== undefined && found[k] < 0) found[k] = i
    })
    if (found.every((i) => i >= 0)) {
      this.cols = found as [number, number, number]
      this.need = Math.max(...found) + 1
    }
  }

  /** Ends the input and builds the cloud, or returns null when no line held a point. */
  finish(): PointCloud | null {
    if (this.rest) {
      this.line(this.rest)
      this.rest = ''
    }
    const n = this.count
    if (n === 0) return null
    const b = this.buf
    let sx = 0
    let sy = 0
    let sz = 0
    for (let i = 0; i < n; i++) {
      sx += b[i * 3]
      sy += b[i * 3 + 1]
      sz += b[i * 3 + 2]
    }
    const cx = sx / n
    const cy = sy / n
    const cz = sz / n
    const positions = new Float32Array(n * 3)
    let halfX = 0
    let halfZ = 0
    let minY = Infinity
    let maxY = -Infinity
    for (let i = 0; i < n; i++) {
      // File x (east), y (north), z (up) to the view's x east, y up, z south.
      const x = b[i * 3] - cx
      const y = b[i * 3 + 2] - cz
      const z = -(b[i * 3 + 1] - cy)
      positions[i * 3] = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z
      halfX = Math.max(halfX, Math.abs(x))
      halfZ = Math.max(halfZ, Math.abs(z))
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
    return { count: n, positions, centre: { x: cx, y: cy, z: cz }, halfX, halfZ, minY, maxY, skipped: this.skipped, truncated: this.truncated }
  }
}

/** Parses a whole string at once (tests, small files). */
export function parseXyz(text: string): PointCloud | null {
  const p = new XyzParser()
  p.push(text)
  return p.finish()
}
