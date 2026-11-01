import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { BufferAttribute, Color, IcosahedronGeometry, InstancedMesh, MeshStandardMaterial, Object3D, Quaternion, Vector3 } from 'three'
import { mulberry32, randRange } from '../sim/rng'
import { positionAt } from '../sim/blast'
import type { Scenario } from '../sim/scenario'
import { DEFAULT_PATTERN } from '../sim/types'
import { useBlast } from '../state/store'
import { delayColor, rampColor } from './colors'
import { firstFireMs, lastFireMs } from './terrainGeometry'

/** Low-poly rock: an icosahedron with its vertices pushed in and out a little, flat shaded. */
function rockGeometry() {
  const g = new IcosahedronGeometry(1, 0)
  const pos = g.getAttribute('position') as BufferAttribute
  const rng = mulberry32(99)
  // Non-indexed: displace each distinct corner consistently so faces stay closed.
  const seen = new Map<string, number>()
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`
    let k = seen.get(key)
    if (k === undefined) {
      k = randRange(rng, 0.78, 1.12)
      seen.set(key, k)
    }
    pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k, pos.getZ(i) * k)
  }
  g.computeVertexNormals()
  return g
}

/**
 * Blasted rock, one InstancedMesh. Each fragment has its own non-uniform scale
 * and rotation (so one geometry reads as many rock shapes), tumbles in flight,
 * and is coloured by distance moved so far (or by firing delay). Hidden until
 * the first hole fires, while the solid pre-blast bench stands.
 */
export function Fragments({ scenario }: { scenario: Scenario }) {
  const { fragments: f, holes, terrain } = scenario
  const ref = useRef<InstancedMesh>(null)
  const geom = useMemo(rockGeometry, [])
  const mat = useMemo(() => new MeshStandardMaterial({ roughness: 0.85, metalness: 0, flatShading: true }), [])
  useEffect(
    () => () => {
      geom.dispose()
      mat.dispose()
    },
    [geom, mat],
  )

  // Per-instance shape: scale (xyz), base rotation, spin axis and spin, all fixed per scenario.
  const shape = useMemo(() => {
    const n = f.count
    const rng = mulberry32(terrain.options.seed ^ 0x5bd1e995)
    // Size so the rocks roughly fill the blasted volume: cube root of the volume per fragment.
    const block = holes.length > 0 ? (scenario.params.pattern?.burden ?? DEFAULT_PATTERN.burden) * (scenario.params.pattern?.spacing ?? DEFAULT_PATTERN.spacing) : 0
    const vol = (block * holes.length * terrain.options.benchHeight) / Math.max(1, n)
    const r = 0.5 * Math.cbrt(Math.max(1, vol)) * 1.05
    const scale = new Float32Array(n * 3)
    const quat = new Float32Array(n * 4)
    const axis = new Float32Array(n * 3)
    const spin = new Float32Array(n)
    const q = new Quaternion()
    const v = new Vector3()
    for (let i = 0; i < n; i++) {
      const s = r * randRange(rng, 0.7, 1.25)
      scale[i * 3] = s * randRange(rng, 0.8, 1.3)
      scale[i * 3 + 1] = s * randRange(rng, 0.55, 0.95)
      scale[i * 3 + 2] = s * randRange(rng, 0.8, 1.3)
      v.set(randRange(rng, -1, 1), randRange(rng, -1, 1), randRange(rng, -1, 1)).normalize()
      q.setFromAxisAngle(v, randRange(rng, 0, Math.PI * 2)).toArray(quat, i * 4)
      v.set(randRange(rng, -1, 1), randRange(rng, -1, 1), randRange(rng, -1, 1)).normalize().toArray(axis, i * 3)
      spin[i] = randRange(rng, 1.5, 5) * (rng() < 0.5 ? -1 : 1)
    }
    return { scale, quat, axis, spin }
  }, [f, holes, terrain, scenario.params])

  const tmp = useMemo(
    () => ({
      o: new Object3D(),
      c: new Color(),
      q: new Quaternion(),
      spinQ: new Quaternion(),
      ax: new Vector3(),
      p: new Float32Array(3),
      last: { t: -1, colorBy: '', fragments: f },
      firstFire: firstFireMs(holes),
      maxDelay: lastFireMs(holes),
    }),
    [f, holes],
  )

  useFrame(() => {
    const mesh = ref.current
    if (!mesh) return
    const { timeMs, colorBy } = useBlast.getState()
    const { last, o, c, q, spinQ, ax, p } = tmp
    if (last.t === timeMs && last.colorBy === colorBy) return
    last.t = timeMs
    last.colorBy = colorBy
    const visible = timeMs > 0 && timeMs >= tmp.firstFire
    mesh.visible = visible
    if (!visible) return
    const inv = f.maxMagnitude > 0 ? 1 / f.maxMagnitude : 0
    const { scale, quat, axis, spin } = shape
    for (let i = 0; i < f.count; i++) {
      positionAt(f, i, timeMs, p, 0)
      const local = timeMs - f.fireMs[i]
      const u = local <= 0 ? 0 : Math.min(1, local / f.flightMs[i])
      q.fromArray(quat, i * 4)
      if (u > 0) {
        ax.fromArray(axis, i * 3)
        // Spin eases out with the flight so rocks come to rest.
        spinQ.setFromAxisAngle(ax, spin[i] * u * (2 - u))
        q.premultiply(spinQ)
      }
      o.position.set(p[0], p[1], p[2])
      o.quaternion.copy(q)
      o.scale.set(scale[i * 3], scale[i * 3 + 1], scale[i * 3 + 2])
      o.updateMatrix()
      mesh.setMatrixAt(i, o.matrix)
      if (colorBy === 'delay') delayColor(f.fireMs[i], tmp.maxDelay, c)
      else {
        const o3 = i * 3
        const dx = p[0] - f.start[o3]
        const dy = p[1] - f.start[o3 + 1]
        const dz = p[2] - f.start[o3 + 2]
        rampColor(Math.sqrt(dx * dx + dy * dy + dz * dz) * inv, c)
      }
      mesh.setColorAt(i, c)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  })

  if (f.count === 0) return null
  return (
    <instancedMesh
      key={f.count}
      ref={ref}
      args={[geom, mat, f.count]}
      castShadow
      receiveShadow
      frustumCulled={false}
    />
  )
}
