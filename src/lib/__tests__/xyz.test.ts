import { describe, expect, it } from 'vitest'
import { sizeProblem } from '../loadPoints'
import { MAX_FILE_BYTES, parseXyz, XyzParser } from '../xyz'

describe('xyz', () => {
  it('xyz: reads x y z with commas, spaces or tabs, without a header', () => {
    const c = parseXyz('1,2,3\n4 5 6\n7\t8\t9\n')!
    expect(c.count).toBe(3)
    expect(c.skipped).toBe(0)
    expect(c.centre).toEqual({ x: 4, y: 5, z: 6 })
  })

  it('xyz: centres on the centroid with north as -z and rl as up', () => {
    const c = parseXyz('easting,northing,rl\n100,1000,50\n110,1010,60\n')!
    // Point 2 is 5 m east, 5 m north and 5 m higher than the centroid.
    expect(Array.from(c.positions.subarray(3, 6))).toEqual([5, 5, -5])
    expect(c.halfX).toBe(5)
    expect(c.halfZ).toBe(5)
    expect(c.minY).toBe(-5)
    expect(c.maxY).toBe(5)
  })

  it('xyz: a header can put the columns in any order', () => {
    const c = parseXyz('id;rl;northing;easting\na;50;1000;100\nb;60;1010;110\n')!
    expect(c.count).toBe(2)
    expect(c.centre).toEqual({ x: 105, y: 1005, z: 55 })
  })

  it('xyz: bad lines are skipped and counted; comments and blank lines are not', () => {
    const c = parseXyz('# survey\nx y z\n1 2 3\n\n1 2\nfoo bar baz\n4 5 six\n// note\n7 8 9\r\n')!
    expect(c.count).toBe(2)
    expect(c.skipped).toBe(3)
  })

  it('xyz: a line split across chunks is read once', () => {
    const p = new XyzParser()
    p.push('1,2,3\n4,5')
    p.push(',6\n7,8,9')
    const c = p.finish()!
    expect(c.count).toBe(3)
    expect(c.centre).toEqual({ x: 4, y: 5, z: 6 })
  })

  it('xyz: a file with no points gives null, not a crash', () => {
    expect(parseXyz('')).toBeNull()
    expect(parseXyz('\u0089PNG\r\n\u001a\n\u0000\u0000binary junk\n')).toBeNull()
    expect(parseXyz('only, two\n1, 2\n')).toBeNull()
  })

  it('xyz: grows past its first buffer', () => {
    const lines: string[] = []
    for (let i = 0; i < 70000; i++) lines.push(`${i} ${i * 2} ${i % 100}`)
    const c = parseXyz(lines.join('\n'))!
    expect(c.count).toBe(70000)
  })

  it('xyz: files over the size limit get a message with both sizes', () => {
    expect(sizeProblem(MAX_FILE_BYTES)).toBeNull()
    expect(sizeProblem(MAX_FILE_BYTES + 50 * 1024 * 1024)).toBe('That file is 150 MB. The limit is 100 MB.')
  })
})
