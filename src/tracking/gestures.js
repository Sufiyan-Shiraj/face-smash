// Gesture classification from MediaPipe hand landmarks.
//
// No ML here on purpose. "Is this a fist?" is a geometry question: a curled
// finger puts its tip closer to the wrist than its own middle knuckle. That
// test is scale-invariant, rotation-invariant, and costs four distance
// comparisons.

/** MediaPipe hand landmark indices. */
export const LM = {
  WRIST: 0,
  THUMB_CMC: 1, THUMB_MCP: 2, THUMB_IP: 3, THUMB_TIP: 4,
  INDEX_MCP: 5, INDEX_PIP: 6, INDEX_DIP: 7, INDEX_TIP: 8,
  MIDDLE_MCP: 9, MIDDLE_PIP: 10, MIDDLE_DIP: 11, MIDDLE_TIP: 12,
  RING_MCP: 13, RING_PIP: 14, RING_DIP: 15, RING_TIP: 16,
  PINKY_MCP: 17, PINKY_PIP: 18, PINKY_DIP: 19, PINKY_TIP: 20,
}

/** Bone pairs for drawing the skeleton overlay. */
export const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
]

const FINGERS = [
  { name: 'index', tip: LM.INDEX_TIP, dip: LM.INDEX_DIP, pip: LM.INDEX_PIP, mcp: LM.INDEX_MCP },
  { name: 'middle', tip: LM.MIDDLE_TIP, dip: LM.MIDDLE_DIP, pip: LM.MIDDLE_PIP, mcp: LM.MIDDLE_MCP },
  { name: 'ring', tip: LM.RING_TIP, dip: LM.RING_DIP, pip: LM.RING_PIP, mcp: LM.RING_MCP },
  { name: 'pinky', tip: LM.PINKY_TIP, dip: LM.PINKY_DIP, pip: LM.PINKY_PIP, mcp: LM.PINKY_MCP },
]

export function dist2D(a, b) {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.hypot(dx, dy)
}

export function dist3D(a, b) {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const dz = (a.z ?? 0) - (b.z ?? 0)
  return Math.hypot(dx, dy, dz)
}

/**
 * Reference length for this hand, in normalized image units: wrist to the
 * middle-finger knuckle. In 3D space when available so turning the hand
 * sideways doesn't artificially collapse the span.
 */
export function handSpan(landmarks) {
  const hasZ = landmarks[0]?.z !== undefined
  if (hasZ) {
    return Math.max(dist3D(landmarks[LM.WRIST], landmarks[LM.MIDDLE_MCP]), 1e-4)
  }
  return Math.max(dist2D(landmarks[LM.WRIST], landmarks[LM.MIDDLE_MCP]), 1e-4)
}

/**
 * Robust anatomical gesture classifier evaluating continuous finger curls,
 * thumb opposition, high-velocity flick extension, and combat actions.
 *
 * Actions supported:
 *  - 'superpunch': tight clench (curled fingers, clench >= 0.68)
 *  - 'superflick': rapid finger extension snap or pinch-release
 *  - 'superslap': flat open palm facing target
 *  - 'chop': blade-vertical hand
 *  - 'poke': extended index with other fingers curled
 *  - 'punch': standard fist
 *  - 'neutral': relaxed hand
 */
export function classifyGesture(landmarks, prevLandmarks = null, dt = 0.016) {
  const wrist = landmarks[LM.WRIST]
  const span = handSpan(landmarks)
  let sumCurl = 0
  let curledCount = 0
  const fingerCurled = []

  for (const f of FINGERS) {
    const tip = landmarks[f.tip]
    const dip = landmarks[f.dip]
    const pip = landmarks[f.pip]
    const mcp = landmarks[f.mcp]

    const tipMcp = dist3D(tip, mcp)
    const pipMcp = dist3D(pip, mcp)
    const fullLen = dist3D(pip, mcp) + dist3D(dip, pip) + dist3D(tip, dip)
    const tipWrist = dist3D(tip, wrist)
    const pipWrist = dist3D(pip, wrist)

    // A finger is curled if the tip is closer to wrist than PIP knuckle, or tip pulled close to MCP
    const isCurled = tipWrist < pipWrist * 1.08 || tipMcp < fullLen * 0.58
    fingerCurled.push(isCurled)
    if (isCurled) curledCount++

    // Continuous extension ratio: 1.0 (straight) -> 0.0 (fully curled into palm)
    const extension = Math.max(0, Math.min(1, (tipMcp - pipMcp * 0.5) / (fullLen * 0.72)))
    const fingerCurl = 1.0 - extension
    sumCurl += fingerCurl
  }

  const baseRatio = sumCurl / 4
  const thumbDist = dist3D(landmarks[LM.THUMB_TIP], landmarks[LM.INDEX_MCP])
  const thumbCurled = thumbDist < span * 0.68

  // Overall clench ratio: 0.0 (open) to 1.0 (tight clenched fist)
  const clenchRatio = Math.max(0, Math.min(1, baseRatio * (thumbCurled ? 1.08 : 0.95)))

  // Flick detection: relative finger extension rate from wrist, or pinch release
  let isFlick = false
  if (prevLandmarks && dt > 0.001) {
    const currIndexTip = landmarks[LM.INDEX_TIP]
    const prevIndexTip = prevLandmarks[LM.INDEX_TIP]
    const currMiddleTip = landmarks[LM.MIDDLE_TIP]
    const prevMiddleTip = prevLandmarks[LM.MIDDLE_TIP]

    const currWrist = landmarks[LM.WRIST]
    const prevWrist = prevLandmarks[LM.WRIST]

    // Rate of extension from wrist in spans per second
    const currIndexWristDist = dist3D(currIndexTip, currWrist)
    const prevIndexWristDist = dist3D(prevIndexTip, prevWrist)
    const indexExtRate = ((currIndexWristDist - prevIndexWristDist) / dt) / Math.max(span, 0.05)

    const currMiddleWristDist = dist3D(currMiddleTip, currWrist)
    const prevMiddleWristDist = dist3D(prevMiddleTip, prevWrist)
    const middleExtRate = ((currMiddleWristDist - prevMiddleWristDist) / dt) / Math.max(span, 0.05)

    // Release from thumb (pinch-flick)
    const currThumbTip = landmarks[LM.THUMB_TIP]
    const prevThumbTip = prevLandmarks[LM.THUMB_TIP]
    const prevPinchDist = dist3D(prevIndexTip, prevThumbTip)
    const currPinchDist = dist3D(currIndexTip, currThumbTip)
    const pinchReleaseRate = ((currPinchDist - prevPinchDist) / dt) / Math.max(span, 0.05)

    // Real human finger flicks produce extension rate > 2.8 spans/s or pinch release rate > 2.8 spans/s
    if (indexExtRate > 2.8 || middleExtRate > 2.8 || (prevPinchDist < span * 0.65 && pinchReleaseRate > 2.8)) {
      isFlick = true
    }
  }

  // Action decision tree
  let action = 'neutral'
  let gesture = 'partial'

  if (isFlick) {
    action = 'superflick'
    gesture = 'open'
  } else if (clenchRatio >= 0.68 && curledCount >= 3) {
    action = 'superpunch'
    gesture = 'fist'
  } else if (curledCount >= 3 || clenchRatio >= 0.48) {
    action = 'punch'
    gesture = 'fist'
  } else if (fingerCurled[0] === false && fingerCurled[1] && fingerCurled[2] && fingerCurled[3]) {
    action = 'poke'
    gesture = 'partial'
  } else if (curledCount <= 1 && clenchRatio < 0.32) {
    // Check if hand is blade-aligned for chop
    const pinkyMcp = landmarks[LM.PINKY_MCP]
    const indexMcp = landmarks[LM.INDEX_MCP]
    const palmWidthX = Math.abs(indexMcp.x - pinkyMcp.x)
    const palmSpanZ = Math.abs((indexMcp.z ?? 0) - (pinkyMcp.z ?? 0))

    if (palmSpanZ > palmWidthX * 1.35) {
      action = 'chop'
    } else {
      action = 'superslap'
    }
    gesture = 'open'
  }

  return {
    gesture,
    action,
    curled: curledCount,
    clenchRatio,
    fingers: fingerCurled,
    isFlick,
  }
}

/**
 * Calculate natural 3D hand orientation (rotation basis vectors) from MediaPipe landmarks.
 * Returns forward vector (wrist -> middle MCP), across vector (pinky -> index),
 * and palm normal (forward x across).
 */
export function handOrientation(landmarks) {
  const wrist = landmarks[LM.WRIST]
  const middleMcp = landmarks[LM.MIDDLE_MCP]
  const indexMcp = landmarks[LM.INDEX_MCP]
  const pinkyMcp = landmarks[LM.PINKY_MCP]

  // Forward axis: wrist pointing towards middle knuckle (+Z in local hand space)
  const fx = middleMcp.x - wrist.x
  const fy = middleMcp.y - wrist.y
  const fz = (middleMcp.z ?? 0) - (wrist.z ?? 0)
  const flen = Math.hypot(fx, fy, fz) || 1
  const forward = { x: fx / flen, y: fy / flen, z: fz / flen }

  // Lateral axis: across knuckles from pinky to index (+X in local hand space)
  const lx = indexMcp.x - pinkyMcp.x
  const ly = indexMcp.y - pinkyMcp.y
  const lz = (indexMcp.z ?? 0) - (pinkyMcp.z ?? 0)
  const llen = Math.hypot(lx, ly, lz) || 1
  const lateral = { x: lx / llen, y: ly / llen, z: lz / llen }

  // Normal axis: pointing out of the palm (+Y in local hand space) = forward x lateral
  const nx = forward.y * lateral.z - forward.z * lateral.y
  const ny = forward.z * lateral.x - forward.x * lateral.z
  const nz = forward.x * lateral.y - forward.y * lateral.x
  const nlen = Math.hypot(nx, ny, nz) || 1
  const normal = { x: nx / nlen, y: ny / nlen, z: nz / nlen }

  return { forward, lateral, normal }
}


/** Axis-aligned bounding box of the hand in normalized image units. */
export function handBounds(landmarks) {
  let minX = 1, minY = 1, maxX = 0, maxY = 0
  for (const p of landmarks) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY }
}

/** Palm centre — steadier than the wrist point, which pivots during a slap. */
export function palmCenter(landmarks) {
  const ids = [LM.WRIST, LM.INDEX_MCP, LM.MIDDLE_MCP, LM.RING_MCP, LM.PINKY_MCP]
  let x = 0, y = 0
  for (const i of ids) {
    x += landmarks[i].x
    y += landmarks[i].y
  }
  return { x: x / ids.length, y: y / ids.length }
}
