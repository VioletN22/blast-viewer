import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { Vector3, type DirectionalLight, type PerspectiveCamera } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { Scenario } from '../sim/scenario'
import { useBlast } from '../state/store'
import { Fragments } from './Fragments'
import { Holes } from './Holes'
import { TerrainMesh } from './TerrainMesh'

const BG = '#121417'

/** Plan extents that matter for framing: the holes (real min/max x, not symmetric) and the muck-pile reach. */
export function sceneExtents(s: Scenario) {
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  for (const h of s.holes) {
    if (h.x < minX) minX = h.x
    if (h.x > maxX) maxX = h.x
    if (h.z < minZ) minZ = h.z
  }
  const half = s.terrain.options.width / 2
  if (!Number.isFinite(minX)) {
    minX = -half / 2
    maxX = half / 2
    minZ = -20
  }
  const crest = s.terrain.options.crestZ
  return {
    minX: Math.max(-half, minX),
    maxX: Math.min(half, maxX),
    minZ,
    // The pile runs out about 34 m past the crest.
    maxZ: crest + 34,
    cx: (minX + maxX) / 2,
  }
}

/** Advances timeMs by delta * speed while playing and stops at the end. */
function Player() {
  useFrame((_, delta) => {
    const s = useBlast.getState()
    if (!s.playing || !s.scenario) return
    const next = s.timeMs + Math.min(delta, 0.1) * 1000 * s.speed
    if (next >= s.scenario.durationMs) {
      s.setTime(s.scenario.durationMs)
      s.pause()
    } else s.setTime(next)
  })
  return null
}

/** In demand mode, any store change requests one frame. */
function InvalidateOnChange() {
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => useBlast.subscribe(() => invalidate()), [invalidate])
  return null
}

/** Frames the camera on the block and the pile from the free-face side, whenever the scenario's extents change. */
function Framing({ scenario }: { scenario: Scenario }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height))
  const ext = useMemo(() => sceneExtents(scenario), [scenario])
  useEffect(() => {
    const tz = (ext.minZ + ext.maxZ) / 2 - 6
    const target = new Vector3(ext.cx, 4, tz)
    // Look in from the free face, a little off-axis, about 38 degrees down.
    const dir = new Vector3(0.28, 0.62, 0.73).normalize()
    // Box to keep in view: the block (with a margin) from the back row to the end of the pile, floor to bench top.
    const corners: Vector3[] = []
    for (const x of [ext.minX - 8, ext.maxX + 8])
      for (const y of [0, 14])
        for (const z of [ext.minZ - 4, ext.maxZ]) corners.push(new Vector3(x, y, z))
    camera.aspect = aspect
    camera.near = 0.5
    let dist = 20
    const ndc = new Vector3()
    // Walk the camera back along dir until every corner projects inside the frame.
    for (let k = 0; k < 80; k++) {
      camera.position.copy(target).addScaledVector(dir, dist)
      camera.lookAt(target)
      camera.updateMatrixWorld()
      camera.updateProjectionMatrix()
      let worst = 0
      for (const c of corners) {
        ndc.copy(c).project(camera)
        worst = Math.max(worst, Math.abs(ndc.x), Math.abs(ndc.y), ndc.z > 1 ? 9 : 0)
      }
      if (worst <= 0.94) break
      dist *= 1.06
    }
    camera.far = dist * 8
    camera.updateProjectionMatrix()
    if (controls) {
      controls.target.copy(target)
      controls.maxDistance = dist * 2.5
      controls.update()
    }
  }, [ext, camera, controls, aspect])
  return null
}

function Lights({ scenario }: { scenario: Scenario }) {
  const ext = useMemo(() => sceneExtents(scenario), [scenario])
  const w = scenario.terrain.options.width
  const d = scenario.terrain.options.depth
  const r = Math.max(w, d) / 2 + 10
  const ref = (l: DirectionalLight | null) => {
    if (!l) return
    const cam = l.shadow.camera
    cam.left = -r
    cam.right = r
    cam.top = r
    cam.bottom = -r
    cam.near = 1
    cam.far = 600
    cam.updateProjectionMatrix()
    l.target.position.set(ext.cx, 0, 0)
    l.target.updateMatrixWorld()
  }
  return (
    <>
      <hemisphereLight args={['#cfd8e3', '#3a342e', 0.9]} />
      <directionalLight
        ref={ref}
        position={[ext.cx - 120, 160, 90]}
        intensity={2.2}
        color="#fff3e2"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.4}
      />
    </>
  )
}

export function Stage({ scenario }: { scenario: Scenario }) {
  const playing = useBlast((s) => s.playing)
  return (
    <Canvas
      frameloop={playing ? 'always' : 'demand'}
      dpr={[1, 2]}
      shadows
      camera={{ fov: 38, position: [60, 90, 140], near: 0.5, far: 2000 }}
      gl={{ antialias: true, preserveDrawingBuffer: import.meta.env.DEV }}
      onPointerMissed={() => useBlast.getState().selectHole(null)}
      style={{ background: BG }}
    >
      <color attach="background" args={[BG]} />
      <fog attach="fog" args={[BG, 260, 700]} />
      <Lights scenario={scenario} />
      <TerrainMesh scenario={scenario} />
      <Holes scenario={scenario} />
      <Fragments scenario={scenario} />
      <OrbitControls
        makeDefault
        enableDamping
        minDistance={12}
        maxPolarAngle={Math.PI * 0.47}
        screenSpacePanning={false}
      />
      <Framing scenario={scenario} />
      <Player />
      <InvalidateOnChange />
    </Canvas>
  )
}
