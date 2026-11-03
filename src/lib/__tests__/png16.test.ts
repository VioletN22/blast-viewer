import { deflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { decodeGray16 } from '../png16'

const paeth = (a: number, b: number, c: number) => {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}

function chunk(type: string, data: Buffer) {
  const out = Buffer.alloc(12 + data.length)
  out.writeUInt32BE(data.length, 0)
  out.write(type, 4, 'latin1')
  data.copy(out, 8)
  // The decoder does not check CRCs, so they are left as 0.
  return out
}

/** A 16-bit greyscale PNG with row y using filter filters[y % filters.length]. */
function png16(values: number[], width: number, height: number, filters: number[], depth = 16): Uint8Array {
  const stride = width * 2
  const bytes = Buffer.alloc(height * stride)
  values.forEach((v, i) => bytes.writeUInt16BE(v, i * 2))
  const raw = Buffer.alloc(height * (stride + 1))
  for (let y = 0; y < height; y++) {
    const f = filters[y % filters.length]
    raw[y * (stride + 1)] = f
    for (let i = 0; i < stride; i++) {
      const x = bytes[y * stride + i]
      const a = i >= 2 ? bytes[y * stride + i - 2] : 0
      const b = y > 0 ? bytes[(y - 1) * stride + i] : 0
      const c = y > 0 && i >= 2 ? bytes[(y - 1) * stride + i - 2] : 0
      const pred = f === 0 ? 0 : f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : paeth(a, b, c)
      raw[y * (stride + 1) + 1 + i] = (x - pred) & 255
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = depth
  ihdr[9] = 0
  return new Uint8Array(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]))
}

describe('png16', () => {
  const w = 7
  const h = 5
  const values = Array.from({ length: w * h }, (_, k) => (k * 2731 + (k % 3) * 40000) % 65536)

  it('png16: decodes every row filter', async () => {
    const out = await decodeGray16(png16(values, w, h, [0, 1, 2, 3, 4]))
    expect(out.width).toBe(w)
    expect(out.height).toBe(h)
    expect(Array.from(out.data)).toEqual(values)
  })

  it('png16: rejects a file that is not a 16-bit greyscale PNG', async () => {
    await expect(decodeGray16(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]))).rejects.toThrow(/not a PNG/)
    await expect(decodeGray16(png16(values, w, h, [0], 8))).rejects.toThrow(/16-bit greyscale/)
  })
})
