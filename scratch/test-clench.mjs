import { LM, dist3D, handSpan } from '../src/tracking/gestures.js'

const span = 0.27
const dt = 0.033 // 1 frame at 30 fps

// Frame 1: Index finger pinched/curled
const prevLM = [
  { x: 0.5, y: 0.8, z: 0 }, // wrist
  ...Array.from({ length: 3 }, () => ({ x: 0.5, y: 0.7, z: 0 })),
  { x: 0.48, y: 0.60, z: 0 }, // 4: thumb tip
  ...Array.from({ length: 3 }, () => ({ x: 0.5, y: 0.6, z: 0 })),
  { x: 0.47, y: 0.60, z: 0 }, // 8: index tip (touching thumb tip!)
  ...Array.from({ length: 12 }, () => ({ x: 0.5, y: 0.6, z: 0 })),
]

// Frame 2: Index snaps open
const currLM = [
  { x: 0.5, y: 0.8, z: 0 }, // wrist
  ...Array.from({ length: 3 }, () => ({ x: 0.5, y: 0.7, z: 0 })),
  { x: 0.48, y: 0.60, z: 0 }, // 4: thumb tip
  ...Array.from({ length: 3 }, () => ({ x: 0.5, y: 0.6, z: 0 })),
  { x: 0.45, y: 0.35, z: 0 }, // 8: index tip (snapped forward/up!)
  ...Array.from({ length: 12 }, () => ({ x: 0.5, y: 0.6, z: 0 })),
]

function testFlick(curr, prev, dt) {
  const currIndexTip = curr[8]
  const prevIndexTip = prev[8]
  const currWrist = curr[0]
  const prevWrist = prev[0]

  const currIndexWristDist = dist3D(currIndexTip, currWrist)
  const prevIndexWristDist = dist3D(prevIndexTip, prevWrist)
  const indexExtRate = ((currIndexWristDist - prevIndexWristDist) / dt) / span

  const prevPinchDist = dist3D(prevIndexTip, prev[4])
  const currPinchDist = dist3D(currIndexTip, curr[4])
  const pinchReleaseRate = ((currPinchDist - prevPinchDist) / dt) / span

  console.log({
    indexExtRate,
    prevPinchDist,
    currPinchDist,
    pinchReleaseRate,
    flick: indexExtRate > 2.8 || (prevPinchDist < span * 0.65 && pinchReleaseRate > 2.8)
  })
}

testFlick(currLM, prevLM, dt)
