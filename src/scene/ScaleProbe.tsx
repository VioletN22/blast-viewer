import { useFrame, useThree } from '@react-three/fiber'
import type { PerspectiveCamera } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { useMetresPerPixel } from '../state/view'

/** Works out metres per pixel at the orbit target each rendered frame, for the scale bar. */
export function ScaleProbe() {
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null
  useFrame(({ camera, size }) => {
    if (!controls || size.height <= 0) return
    const cam = camera as PerspectiveCamera
    const d = cam.position.distanceTo(controls.target)
    const mpp = (2 * d * Math.tan((cam.fov * Math.PI) / 360)) / size.height
    const prev = useMetresPerPixel.getState().mpp
    if (!(prev > 0) || Math.abs(mpp - prev) / prev > 0.01) useMetresPerPixel.setState({ mpp })
  })
  return null
}
