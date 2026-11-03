import { OrbitControls } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { BufferAttribute, BufferGeometry, Color, PointsMaterial, Vector3, type PerspectiveCamera } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { PointCloud } from '../lib/xyz'
import { useBlast } from '../state/store'
import { rampColor } from './colors'
import { PerfProbe } from './PerfProbe'
import { ScaleProbe } from './ScaleProbe'

const BG = '#16140f'
const LUT_SIZE = 256

/** Heights to colours on the shared ramp, through a 256-step lookup so a large cloud colours quickly. */
function cloudColours(c: PointCloud): Float32Array {
  const lut = new Float32Array(LUT_SIZE * 3)
  const tmp = new Color()
  for (let i = 0; i < LUT_SIZE; i++) rampColor(i / (LUT_SIZE - 1), tmp).toArray(lut, i * 3)
  const out = new Float32Array(c.count * 3)
  const span = c.maxY - c.minY
  for (let i = 0; i < c.count; i++) {
    const v = span > 0 ? (c.positions[i * 3 + 1] - c.minY) / span : 0
    const k = Math.min(LUT_SIZE - 1, Math.max(0, Math.round(v * (LUT_SIZE - 1)))) * 3
    out[i * 3] = lut[k]
    out[i * 3 + 1] = lut[k + 1]
    out[i * 3 + 2] = lut[k + 2]
  }
  return out
}

/** Point size for PointsMaterial (its units come out smaller on screen than metres at this field of view): a sparse cloud still reads as a surface. */
export function pointSize(c: Pick<PointCloud, 'count' | 'halfX' | 'halfZ'>): number {
  const area = Math.max(1, 4 * c.halfX * c.halfZ)
  return Math.min(150, Math.max(0.05, 2.6 * Math.sqrt(area / Math.max(1, c.count))))
}

function Cloud({ cloud }: { cloud: PointCloud }) {
  const geom = useMemo(() => {
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(cloud.positions, 3))
    g.setAttribute('color', new BufferAttribute(cloudColours(cloud), 3))
    g.computeBoundingSphere()
    return g
  }, [cloud])
  const mat = useMemo(() => new PointsMaterial({ size: pointSize(cloud), sizeAttenuation: true, vertexColors: true }), [cloud])
  useEffect(() => () => geom.dispose(), [geom])
  useEffect(() => () => mat.dispose(), [mat])
  return <points geometry={geom} material={mat} />
}

/** Frames the whole cloud from the south, about 50 degrees down, once per cloud. */
function CloudFraming({ cloud }: { cloud: PointCloud }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null
  const get = useThree((s) => s.get)
  useEffect(() => {
    const size = get().size
    camera.aspect = size.width / Math.max(1, size.height)
    const target = new Vector3(0, (cloud.minY + cloud.maxY) / 2, 0)
    const dir = new Vector3(0, 0.76, 0.65).normalize()
    const r = Math.max(1, Math.hypot(cloud.halfX, cloud.halfZ, (cloud.maxY - cloud.minY) / 2))
    const dist = r / Math.sin(((camera.fov / 2) * Math.PI) / 180) / Math.min(1, camera.aspect) + 1
    camera.position.copy(target).addScaledVector(dir, dist)
    camera.near = Math.max(0.05, dist / 2000)
    camera.far = dist * 10
    camera.lookAt(target)
    camera.updateProjectionMatrix()
    if (controls) {
      controls.target.copy(target)
      controls.maxDistance = dist * 4
      controls.minDistance = Math.max(0.5, r / 200)
      controls.update()
    }
  }, [cloud, camera, controls, get])
  return null
}

/** The view while survey points are loaded: the cloud on its own, centred on its centroid, coloured by height. */
export function CloudStage({ cloud }: { cloud: PointCloud }) {
  const showPerf = useBlast((s) => s.showPerf)
  return (
    <Canvas frameloop={showPerf ? 'always' : 'demand'} dpr={[1, 2]} camera={{ fov: 38, position: [0, 100, 100] }} gl={{ antialias: true, preserveDrawingBuffer: import.meta.env.DEV }} style={{ background: BG }}>
      <color attach="background" args={[BG]} />
      <Cloud cloud={cloud} />
      <OrbitControls makeDefault enableDamping screenSpacePanning={false} />
      <CloudFraming cloud={cloud} />
      <PerfProbe />
      <ScaleProbe />
    </Canvas>
  )
}
