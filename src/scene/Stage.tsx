import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Vector3, type DirectionalLight, type PerspectiveCamera } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { Scenario } from '../sim/scenario'
import { sceneExtents } from './extents'
import { useBlast } from '../state/store'
import { DemMesh } from './DemMesh'
import { DigLine } from './DigLine'
import { Fragments } from './Fragments'
import { Holes } from './Holes'
import { PerfProbe } from './PerfProbe'
import { ScaleProbe } from './ScaleProbe'
import { SelectionRing } from './SelectionRing'
import { scenarioMatrix } from './siteFrame'
import { SiteMarker } from './SiteMarker'
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

/** Pre-blast ground height at a world (x, z): the DEM on the pit, the bench in the model frame otherwise. Never below the post-blast ground. */
const preBlastGroundAt = (sc: Scenario, x: number, z: number) => (sc.dem ? sc.dem.heightAt(x, z) : sc.terrain.heightAt(x, z))

const LANDSCAPE_DIR = new Vector3(0.28, 0.62, 0.73)
const PORTRAIT_DIR = new Vector3(0.2, 0.78, 0.6)
const PORTRAIT_MARGIN_M = 2
/** The whole-pit view looks north from the south, about 50 degrees down (steeper in portrait). */
const PIT_LANDSCAPE_DIR = new Vector3(0, 0.76, 0.65)
const PIT_PORTRAIT_DIR = new Vector3(0, 0.86, 0.5)
/** On the pit the camera spans metres to kilometres, so the near and far planes follow its distance. */
const PIT_FAR_M = 16000
const PIT_BLAST_PULLBACK = 1.5

/** Near and far planes for a camera at distance d from its target on the pit. */
export function pitClip(d: number): { near: number; far: number } {
  return { near: Math.min(8, Math.max(0.5, d / 800)), far: Math.max(PIT_FAR_M, d * 8) }
}

/** Walks the camera back from target along dir until every corner projects inside the frame. Returns the distance. */
function fitCamera(camera: PerspectiveCamera, target: Vector3, dir: Vector3, corners: Vector3[], step: number): number {
  let dist = 20
  const ndc = new Vector3()
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
    dist *= step
  }
  return dist
}

/**
 * Frames the camera once per scenario (load or rebuild) and whenever the view
 * is asked for again, not on resize. The blast view looks at the block and the
 * pile from the free-face side; on the pit the same view is turned with the
 * site. The pit view takes in the whole DEM, north up.
 */
function Framing({ scenario }: { scenario: Scenario }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null
  const get = useThree((s) => s.get)
  const viewSeq = useBlast((s) => s.viewSeq)
  useEffect(() => {
    const size = get().size
    const aspect = size.width / Math.max(1, size.height)
    const portrait = aspect < 1
    camera.aspect = aspect
    camera.near = 0.5
    const dem = scenario.dem
    let target: Vector3
    let dist: number
    if (dem && useBlast.getState().view === 'pit') {
      target = new Vector3(0, dem.heightAt(0, 0), 0)
      const dir = (portrait ? PIT_PORTRAIT_DIR : PIT_LANDSCAPE_DIR).clone().normalize()
      const corners: Vector3[] = []
      for (const x of [-dem.halfX * 0.92, dem.halfX * 0.92])
        for (const y of [dem.minY, dem.maxY])
          for (const z of [-dem.halfZ * 0.92, dem.halfZ * 0.92]) corners.push(new Vector3(x, y, z))
      dist = fitCamera(camera, target, dir, corners, 1.04)
    } else {
      const m = scenarioMatrix(scenario)
      const ext = sceneExtents(scenario)
      const tz = (ext.minZ + ext.maxZ) / 2 - 6
      // Target on the bench surface (the bench top behind the crest), never inside the rock.
      target = new Vector3(ext.cx, scenario.terrain.heightAt(ext.cx, tz), tz).applyMatrix4(m)
      // Look in from the free face, a little off-axis, about 38 degrees down. A portrait frame
      // is bound by its width, which left a tall band of empty sky: there the view looks down
      // more steeply (about 50 degrees) and the side margin shrinks, so the block fills about
      // 70% of the width and the bench and pile fill more of the height.
      const dir = (portrait ? PORTRAIT_DIR : LANDSCAPE_DIR).clone().transformDirection(m)
      const margin = portrait ? PORTRAIT_MARGIN_M : 8
      // Box to keep in view: the block (with a margin) from the back row to the end of the pile, floor to bench top.
      const corners: Vector3[] = []
      for (const x of [ext.minX - margin, ext.maxX + margin])
        for (const y of [0, 14])
          for (const z of [ext.minZ - 4, ext.maxZ]) corners.push(new Vector3(x, y, z).applyMatrix4(m))
      dist = fitCamera(camera, target, dir, corners, portrait ? 1.02 : 1.06)
      if (dem) {
        // On the pit, stand further back so the ground round the block shows too.
        dist *= PIT_BLAST_PULLBACK
        camera.position.copy(target).addScaledVector(dir, dist)
        camera.lookAt(target)
      }
    }
    if (dem) {
      const clip = pitClip(dist)
      camera.near = clip.near
      camera.far = clip.far
    } else camera.far = dist * 8
    camera.updateProjectionMatrix()
    if (controls) {
      controls.target.copy(target)
      controls.maxDistance = dem ? PIT_FAR_M / 2 : dist * 2.5
      controls.update()
    }
  }, [scenario, viewSeq, camera, controls, get])
  return null
}

const CAMERA_CLEARANCE_M = 2

/**
 * Keeps the orbit target inside the terrain box and on its surface, and the
 * camera at least CAMERA_CLEARANCE_M above the terrain at its xz, through
 * orbit, zoom and pan. On the pit the box is the DEM, and the near and far
 * planes follow the camera distance.
 */
function CameraClamp({ scenario }: { scenario: Scenario }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null
  useEffect(() => {
    if (!controls) return
    const dem = scenario.dem
    const hx = dem ? dem.halfX : scenario.terrain.options.width / 2
    const hz = dem ? dem.halfZ : scenario.terrain.options.depth / 2
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
      if (dem) {
        const clip = pitClip(camera.position.distanceTo(t))
        if (Math.abs(clip.near - camera.near) / camera.near > 0.1 || clip.far !== camera.far) {
          camera.near = clip.near
          camera.far = clip.far
          camera.updateProjectionMatrix()
        }
      }
    }
    controls.addEventListener('change', clamp)
    return () => controls.removeEventListener('change', clamp)
  }, [controls, camera, scenario])
  return null
}

/**
 * Light on the pit: a low sun (about 30 degrees up) from the north-west, fixed in the world, so the
 * walls read the same wherever the blast is. The shadow box covers the blast patch only.
 */
function PitLights({ scenario }: { scenario: Scenario }) {
  const site = scenario.site!
  const r = Math.max(scenario.terrain.options.width, scenario.terrain.options.depth) / 2 + 10
  const y = site.floorY + scenario.terrain.options.benchHeight
  const ref = (l: DirectionalLight | null) => {
    if (!l) return
    const cam = l.shadow.camera
    cam.left = -r
    cam.right = r
    cam.top = r
    cam.bottom = -r
    cam.near = 1
    cam.far = 1200
    cam.updateProjectionMatrix()
    l.target.position.set(site.x, y, site.z)
    l.target.updateMatrixWorld()
  }
  return (
    <>
      <hemisphereLight args={['#cfd8e3', '#3a342e', 0.6]} />
      <directionalLight
        ref={ref}
        position={[site.x - 280, y + 230, site.z - 320]}
        intensity={2.6}
        color="#fff3e2"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.4}
      />
    </>
  )
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
  const view = useBlast((s) => s.view)
  const site = scenario.site
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
      <fog attach="fog" args={site ? [BG, 4000, 14000] : [BG, 260, 700]} />
      {site ? <PitLights scenario={scenario} /> : <Lights scenario={scenario} />}
      {site && <DemMesh scenario={scenario} />}
      {/* The blast runs in its own frame: on the pit this group turns and lifts it onto the site. */}
      <group position={site ? [site.x, site.floorY, site.z] : [0, 0, 0]} rotation={[0, site ? site.angle : 0, 0]}>
        <TerrainMesh scenario={scenario} />
        <Holes scenario={scenario} />
        <Fragments scenario={scenario} />
        <Vectors scenario={scenario} />
        <DigLine scenario={scenario} />
        <SelectionRing scenario={scenario} />
        {site && view === 'pit' && <SiteMarker scenario={scenario} />}
      </group>
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
      <ScaleProbe />
      <InvalidateOnChange />
      {TEST_HOOKS && <TestHooks scenario={scenario} />}
    </Canvas>
  )
}
