import { describe, expect, it } from 'vitest'
import { hasWebGL } from '../webgl'

type Ctx = { getExtension(name: string): { loseContext(): void } | null }
const canvas = (kinds: Record<string, Ctx | null | 'throw'>) => () =>
  ({
    getContext(kind: string) {
      const k = kinds[kind]
      if (k === 'throw') throw new Error('blocked')
      return k ?? null
    },
  }) as unknown as HTMLCanvasElement
const ctx: Ctx = { getExtension: () => null }

describe('hasWebGL', () => {
  it('accepts webgl2', () => expect(hasWebGL(canvas({ webgl2: ctx }))).toBe(true))
  it('falls back to webgl', () => expect(hasWebGL(canvas({ webgl: ctx }))).toBe(true))
  it('is false with neither', () => expect(hasWebGL(canvas({}))).toBe(false))
  it('is false when getContext throws', () => expect(hasWebGL(canvas({ webgl2: 'throw' }))).toBe(false))
})
