import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Vector3, type DirectionalLight, type PerspectiveCamera } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { Scenario } from '../sim/scenario'
import { sceneExtents } from './extents'
import { useBlast } from '../state/store'
import { DigLine } from './DigLine'
import { Fragments } from './Fragments'
import { Holes } from './Holes'
import { PerfProbe } from './PerfProbe'
import { SelectionRing } from './SelectionRing'
import { TEST_HOOKS, TestHooks } from './TestHooks'
import { TerrainMesh } from './TerrainMesh'
import { Vectors } from './Vectors'

const BG = '#121417'

/** Advances timeMs by delta * speed while playing and stops at the end. */
function Player() {
  useFrame((_, delta) => {
    const s = useBlast.getState()
    if (!s.playing || !s.scenario) return
    // One zustand set per playing frame is accepted (ruling); the no-allocation rule covers the render loops.
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

/** Bench-top height at (x, z): the pre-blast terrain, which is never below the post-blast ground. */
const preBlastGroundAt = (sc: Scenario, x: number, z: number) => sc.terrain.heightAt(x, z)

const LANDSCAPE_DIR = new Vector3(0.28, 0.62, 0.73)
const PORTRAIT_DIR = new Vector3(0.2, 0.78, 0.6)
const PORTRAIT_MARGIN_M = 2

/** Frames the camera on the block and the pile from the free-face side, once per scenario (load or rebuild), not on resize. */
function Framing({ scenario }: { scenario: Scenario }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null
  const get = useThree((s) => s.get)
  useEffect(() => {
    const ext = sceneExtents(scenario)
    const size = get().size
    const aspect = size.width / Math.max(1, size.height)
    const tz = (ext.minZ + ext.maxZ) / 2 - 6
    // Target on the bench surface (the bench top behind the crest), never inside the rock.
    const target = new Vector3(ext.cx, preBlastGroundAt(scenario, ext.cx, tz), tz)
    // Look in from the free face, a little off-axis, about 38 degrees down. A portrait frame
    // is bound by its width, which left a tall band of empty sky: there the view looks down
    // more steeply (about 50 degrees) and the side margin shrinks, so the block fills about
    // 70% of the width and the bench and pile fill more of the height.
    const portrait = aspect < 1
    const dir = (portrait ? PORTRAIT_DIR : LANDSCAPE_DIR).clone().normalize()
    const margin = portrait ? PORTRAIT_MARGIN_M : 8
    // Box to keep in view: the block (with a margin) from the back row to the end of the pile, floor to bench top.
    const corners: Vector3[] = []
    for (const x of [ext.minX - margin, ext.maxX + margin])
      for (const y of [0, 14])
        for (const z of [ext.minZ - 4, ext.maxZ]) corners.push(new Vector3(x, y, z))
    camera.aspect = aspect
    camera.near = 0.5
    let dist = 20
    const ndc = new Vector3()
    // Walk the camera back along dir until every corner projects inside the frame.
    for (let k = 0; k < 400; k++) {
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
      dist *= portrait ? 1.02 : 1.06
    }
    camera.far = dist * 8
    camera.updateProjectionMatrix()
    if (controls) {
      controls.target.copy(target)
      controls.maxDistance = dist * 2.5
      controls.update()
    }
  }, [scenario, camera, controls, get])
  return null
}

const CAMERA_CLEARANCE_M = 2

/**
 * Keeps the orbit target inside the terrain box and on its surface, and the
 * camera at least CAMERA_CLEARANCE_M above the terrain at its xz, through
 * orbit, zoom and pan.
 */
function CameraClamp({ scenario }: { scenario: Scenario }) {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null
  useEffect(() => {
    if (!controls) return
    const { width, depth } = scenario.terrain.options
    const hx = width / 2
    const hz = depth / 2
    const clamp = () => {
      const t = controls.target
      const x = Math.min(hx, Math.max(-hx, t.x))
      const z = Math.min(hz, Math.max(-hz, t.z))
      if (x !== t.x || z !== t.z) {
        // Shift the camera with the target so a clamped pan does not also rotate the view.
        camera.position.x += x - t.x
        camera.position.z += z - t.z
        t.x = x
        t.z = z
      }
      t.y = preBlastGroundAt(scenario, t.x, t.z)
      const floor = preBlastGroundAt(scenario, camera.position.x, camera.position.z) + CAMERA_CLEARANCE_M
      if (camera.position.y < floor) camera.position.y = floor
    }
    controls.addEventListener('change', clamp)
    return () => controls.removeEventListener('change', clamp)
  }, [controls, camera, scenario])
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

/** How long a lost context may take to come back (a phone tab returning from the background) before the fallback shows. */
export const CONTEXT_RESTORE_WAIT_MS = 3000

/**
 * Waits for a lost WebGL context to be restored. preventDefault on the loss
 * tells the browser the page can restore; if no webglcontextrestored arrives
 * within CONTEXT_RESTORE_WAIT_MS, onGiveUp runs. On restore, onRestored runs
 * (the demand frameloop would otherwise leave the canvas blank until the next change).
 */
function useContextLoss(canvas: HTMLCanvasElement | null, onGiveUp: () => void, onRestored: () => void) {
  useEffect(() => {
    if (!canvas) return
    let timer: number | undefined
    const onLost = (e: Event) => {
      e.preventDefault()
      window.clearTimeout(timer)
      timer = window.setTimeout(onGiveUp, CONTEXT_RESTORE_WAIT_MS)
    }
    const onRestore = () => {
      window.clearTimeout(timer)
      onRestored()
    }
    canvas.addEventListener('webglcontextlost', onLost)
    canvas.addEventListener('webglcontextrestored', onRestore)
    return () => {
      window.clearTimeout(timer)
      canvas.removeEventListener('webglcontextlost', onLost)
      canvas.removeEventListener('webglcontextrestored', onRestore)
    }
  }, [canvas, onGiveUp, onRestored])
}

export function Stage({ scenario }: { scenario: Scenario }) {
  // A context that stays lost is rethrown during render, so StageBoundary shows the fallback.
  const [lost, setLost] = useState(false)
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null)
  const giveUp = useCallback(() => setLost(true), [])
  const invalidateRef = useRef<() => void>(() => {})
  const redraw = useCallback(() => invalidateRef.current(), [])
  useContextLoss(canvas, giveUp, redraw)
  const playing = useBlast((s) => s.playing)
  // With the stats panel on, render continuously so the fps it shows is a real frame rate, not idle gaps.
  const showPerf = useBlast((s) => s.showPerf)
  if (lost) throw new Error('The WebGL context was lost and not restored.')
  return (
    <Canvas
      frameloop={playing || showPerf ? 'always' : 'demand'}
      dpr={[1, 2]}
      shadows
      camera={{ fov: 38, position: [60, 90, 140], near: 0.5, far: 2000 }}
      gl={{ antialias: true, preserveDrawingBuffer: import.meta.env.DEV }}
      onCreated={({ gl, invalidate }) => {
        invalidateRef.current = () => invalidate()
        setCanvas(gl.domElement)
      }}
      onPointerMissed={() => useBlast.getState().selectHole(null)}
      style={{ background: BG }}
    >
      <color attach="background" args={[BG]} />
      <fog attach="fog" args={[BG, 260, 700]} />
      <Lights scenario={scenario} />
      <TerrainMesh scenario={scenario} />
      <Holes scenario={scenario} />
      <Fragments scenario={scenario} />
      <Vectors scenario={scenario} />
      <DigLine scenario={scenario} />
      <SelectionRing scenario={scenario} />
      <OrbitControls
        makeDefault
        enableDamping
        minDistance={12}
        maxPolarAngle={Math.PI * 0.47}
        screenSpacePanning={false}
      />
      <Framing scenario={scenario} />
      <CameraClamp scenario={scenario} />
      <Player />
      <PerfProbe />
      <InvalidateOnChange />
      {TEST_HOOKS && <TestHooks scenario={scenario} />}
    </Canvas>
  )
}
