// Hand → world mapping and arm IK, checked headlessly.
//
// These two stages are the ones you cannot debug by looking at the screen. A
// skewed projection and a snapping elbow both just read as "the tracking feels
// bad", and neither shows up as an error anywhere. So they get measured.
//
// Run: npm run sim:mapping

import * as THREE from 'three'

import { createHandProjector } from '../src/physics/handToWorld.js'
import { createArmSolver } from '../src/scene/armIK.js'
import {
  getShoulderPosition,
  computeHandOrientation,
  PLAY_HALF_HEIGHT,
  UPPER_ARM,
  FOREARM,
  ARM_LENGTH,
  MAX_LEAN,
} from '../src/scene/armRig.js'
import { playerSideFromLabel } from '../src/tracking/handAssign.js'

let failures = 0
function check(name, ok, detail = '') {
  const mark = ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'
  console.log(`${mark} ${name}${detail ? `  \x1b[2m${detail}\x1b[0m` : ''}`)
  if (!ok) failures++
}

const HEAD = { x: 0, y: 1.31, z: 0 }
const CAM = { x: 0, y: 1.34, z: 1.15 }
const CAM_ASPECT = 960 / 540

const makeProjector = (viewAspect, extra = {}) =>
  createHandProjector({
    cameraPosition: CAM,
    headPosition: HEAD,
    fov: 45,
    aspect: viewAspect,
    sourceAspect: CAM_ASPECT,
    inset: 0.16,
    restOffset: 0.22,
    depthGain: 0.28,
    mirror: true,
    adaptDepth: false,
    ...extra,
  })

console.log('\n\x1b[1mhand → world mapping\x1b[0m\n')

// 1. THE BUG THAT STARTED THIS. Equal physical hand movement along each axis
//    must produce equal world movement, at every window shape. The old mapping
//    scaled x by (viewport aspect / camera aspect), so it was only correct on a
//    16:9 window.
{
  // A square patch of the real world is 1 unit of normalized y tall and
  // 1/CAM_ASPECT units of normalized x wide — that is what "the frame is wider
  // than it is tall" means in normalized coordinates.
  const dNormY = 0.10
  const dNormX = dNormY / CAM_ASPECT

  const rows = []
  let worst = 0
  for (const [w, h] of [
    [800, 600],
    [1440, 900],
    [1920, 1080],
    [1024, 1366],
  ]) {
    const p = makeProjector(w / h)
    const o = p.project({ x: 0.5, y: 0.5, span: 0.12 })
    const px = p.project({ x: 0.5 + dNormX, y: 0.5, span: 0.12 })
    const py = p.project({ x: 0.5, y: 0.5 + dNormY, span: 0.12 })

    const moveX = Math.hypot(px.x - o.x, px.y - o.y, px.z - o.z)
    const moveY = Math.hypot(py.x - o.x, py.y - o.y, py.z - o.z)
    const skew = Math.abs(moveX / moveY - 1)
    worst = Math.max(worst, skew)
    rows.push(`${w}x${h}: ${(skew * 100).toFixed(2)}%`)
  }

  check(
    'equal physical hand motion maps to equal world motion on any window',
    worst < 0.01,
    rows.join('  ')
  )
}

// 2. The direct consequence: a 45-degree hand movement must come out at 45
//    degrees on screen, which is what "aiming works" actually means.
{
  const p = makeProjector(4 / 3)
  const o = p.project({ x: 0.5, y: 0.5, span: 0.12 })
  // Equal PHYSICAL distance right and up.
  const d = 0.08
  // Moving the hand up-and-to-the-player's-right. In the RAW frame that is
  // decreasing x (the camera faces the player) and decreasing y (image y runs
  // downward), and after mirroring it must come out as up-and-right on screen.
  const diag = p.project({ x: 0.5 - d / CAM_ASPECT, y: 0.5 - d, span: 0.12 })
  const angle = (Math.atan2(diag.y - o.y, diag.x - o.x) * 180) / Math.PI
  check(
    'a 45° hand movement drives the glove at 45°',
    Math.abs(angle - 45) < 0.5,
    `${angle.toFixed(2)}°`
  )
}

// 3. Mirroring: the player's right hand is on the left of the RAW frame and
//    must appear on the right of the screen (+x here).
{
  const p = makeProjector(16 / 9)
  const right = p.project({ x: 0.25, y: 0.5, span: 0.12 }) // raw-left = player's right
  const left = p.project({ x: 0.75, y: 0.5, span: 0.12 })
  check(
    "the player's right hand lands on the right of the scene",
    right.x > 0 && left.x < 0,
    `right → x=${right.x.toFixed(2)}, left → x=${left.x.toFixed(2)}`
  )
}

// 4. The inset must give slack: the reachable play area has to be covered well
//    before the hand reaches the edge of the frame, where tracking dies.
{
  const p = makeProjector(16 / 9)
  const atInset = p.project({ x: 0.16, y: 0.5, span: 0.12 })
  const atEdge = p.project({ x: 0.0, y: 0.5, span: 0.12 })
  check(
    'the play area is covered before the frame edge, leaving overshoot room',
    Math.abs(atEdge.x) > Math.abs(atInset.x),
    `inset edge x=${atInset.x.toFixed(2)}, frame edge x=${atEdge.x.toFixed(2)}`
  )
}

// 5. yCenterOffset shifts the centre, and must NOT make the top of the play
//    area unreachable (which is what subtracting it before the divide did).
{
  const plain = makeProjector(16 / 9, { yCenterOffset: 0 })
  const shifted = makeProjector(16 / 9, { yCenterOffset: 0.06 })
  const spanOf = (p) =>
    p.project({ x: 0.5, y: 0.16, span: 0.12 }).y - p.project({ x: 0.5, y: 0.84, span: 0.12 }).y
  const a = spanOf(plain)
  const b = spanOf(shifted)
  check(
    'a vertical centre shift moves the play area without shrinking it',
    Math.abs(a - b) < 1e-9 && Math.abs(a) > 0.1,
    `reach ${a.toFixed(3)} m vs ${b.toFixed(3)} m`
  )
}

// 6. Depth stays inside the shell no matter how wrong the span reading is,
//    because a depth error must never cause a miss.
{
  const p = makeProjector(16 / 9, { shell: 0.28 })
  let worst = 0
  for (const span of [0.02, 0.06, 0.12, 0.3, 0.9]) {
    const o = p.project({ x: 0.5, y: 0.5, span })
    // Depth runs along the camera axis; at this camera that is mostly z.
    worst = Math.max(worst, Math.abs(o.z - HEAD.z))
  }
  check(
    'wild span readings cannot push the striker out of the strike shell',
    worst <= 0.28 + 0.22 + 1e-6,
    `worst offset ${worst.toFixed(3)} m`
  )
}

// 7. The adaptive baseline should follow a player who sits closer, so that
//    "punching" means the same thing for everyone.
{
  const p = makeProjector(16 / 9, { adaptDepth: true, referenceSpan: 0.12 })
  // Someone with a big hand / sitting close: resting span 0.20.
  for (let i = 0; i < 600; i++) p.project({ x: 0.5, y: 0.5, span: 0.20, dt: 1 / 60 })
  const resting = p.project({ x: 0.5, y: 0.5, span: 0.20 })
  const punching = p.project({ x: 0.5, y: 0.5, span: 0.26 })
  // The rest plane sits restOffset in FRONT of the head, i.e. toward the camera,
  // which at this camera is +z. Punching drives back toward the face.
  check(
    'depth calibrates to the player, so resting is neutral and punching is forward',
    Math.abs(resting.z - (HEAD.z + 0.22)) < 0.02 && punching.z < resting.z,
    `baseline ${p.spanBaseline.toFixed(3)}, rest z=${resting.z.toFixed(3)}, punch z=${punching.z.toFixed(3)}`
  )
}

// 7b. END TO END: the arms must not cross.
//
// This is the one the screenshots showed. Each stage was individually defensible
// and the combination put the player's right glove on the left of the screen
// with its forearm running back across the body to a shoulder on the right.
// Everything from the raw MediaPipe label to the world-space shoulder is
// checked here in one chain, because the bug only exists BETWEEN the stages.
{
  const p = createHandProjector({
    cameraPosition: CAM, headPosition: HEAD, fov: 45, aspect: 16 / 9,
    sourceAspect: CAM_ASPECT, playHalfHeight: PLAY_HALF_HEIGHT,
    inset: 0.16, restOffset: 0.22, mirror: true, adaptDepth: false,
  })

  const rows = []
  let ok = true
  for (const [label, rawX, want] of [
    ['Left', 0.30, 'right'],   // MediaPipe says Left; unmirrored feed => player's RIGHT
    ['Right', 0.70, 'left'],
  ]) {
    const side = playerSideFromLabel(label, false)
    const glove = p.project({ x: rawX, y: 0.5, span: 0.12 })
    const shoulder = getShoulderPosition({ x: CAM.x, y: CAM.y, z: CAM.z }, side)
    // Same sign => glove and its own shoulder are on the same side of the body.
    const sameSide = Math.sign(glove.x) === Math.sign(shoulder.x)
    if (side !== want || !sameSide) ok = false
    rows.push(`MP "${label}" @x=${rawX} -> ${side}: glove x=${glove.x.toFixed(2)}, shoulder x=${shoulder.x.toFixed(2)}`)
  }
  check('the arms do not cross: each glove is on its own shoulder\'s side', ok, rows.join('  |  '))
}

// 7c. The whole play area has to be inside the arms' reach, lean included.
{
  const halfW = PLAY_HALF_HEIGHT * CAM_ASPECT
  // Read from the rig, never restated here: a test carrying its own copy of a
  // constant stops testing the code the moment the code changes.
  const maxLean = MAX_LEAN
  const worst = []
  let ok = true
  for (const handedness of ['left', 'right']) {
    const sh = getShoulderPosition({ x: CAM.x, y: CAM.y, z: CAM.z }, handedness)
    for (const sx of [-halfW, 0, halfW]) {
      for (const sy of [-PLAY_HALF_HEIGHT, 0, PLAY_HALF_HEIGHT]) {
        // Deepest the fist ever goes: rest plane driven fully into the face.
        const target = { x: sx, y: HEAD.y + sy, z: HEAD.z + 0.22 - 0.28 }
        const d = Math.hypot(target.x - sh.x, target.y - sh.y, target.z - sh.z)
        const need = d - ARM_LENGTH * 0.985
        if (need > maxLean) { ok = false }
        worst.push(need)
      }
    }
  }
  const w = Math.max(...worst)
  check(
    'every corner of the play area is reachable within the shoulder lean',
    ok,
    `worst shortfall ${(w * 100).toFixed(0)} cm against a ${(maxLean * 100).toFixed(0)} cm lean budget`
  )
}

// 7d. The fists must point AT the head.
//
// They did not. computeHandOrientation built its basis as A = C x U0, with a
// comment claiming that was right-handed. It is not: (C x U0) x U0 = -C, so the
// three columns were a reflection with determinant -1. three.js takes a matrix
// at its word, so the returned quaternion aimed the glove's +Z backwards, out
// of the screen. Measured in the running app the dot product against the
// direction to the head was -0.75 — the player was looking at the BACK of the
// glove on every frame, which is why it read as a shapeless blob rather than a
// boxing glove.
{
  const rows = []
  let worstDot = 1
  let worstDet = 0
  for (const handedness of ['left', 'right']) {
    const shoulder = getShoulderPosition({ x: CAM.x, y: CAM.y, z: CAM.z }, handedness)
    for (const pos of [
      { x: 0, y: 1.31, z: 0.22 },
      { x: -0.4, y: 1.5, z: 0.25 },
      { x: 0.45, y: 1.1, z: 0.3 },
      { x: 0.1, y: 1.31, z: 0.05 },
    ]) {
      const q = computeHandOrientation(pos, { x: 0, y: 0, z: 0 }, handedness, shoulder)

      // A quaternion can only encode a rotation, so a non-unit result is the
      // signature of a basis that was never a rotation to begin with.
      const det = new THREE.Matrix4().makeRotationFromQuaternion(q).determinant()
      worstDet = Math.max(worstDet, Math.abs(det - 1))

      const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(q)
      const toHead = new THREE.Vector3(0, 1.31, 0.08).sub(new THREE.Vector3(pos.x, pos.y, pos.z)).normalize()
      const dot = fwd.dot(toHead)
      if (dot < worstDot) worstDot = dot
      rows.push(`${handedness}@${pos.x},${pos.y}: ${dot.toFixed(2)}`)
    }
  }
  // Not 1.0 at every pose, deliberately: computeHandOrientation clamps the
  // forward vector to always have some -Z, so a fist that has punched PAST the
  // head cannot swing round and face back out of the screen. That clamp costs
  // up to ~28 degrees on the deepest poses and is worth it.
  check(
    'the knuckles point at the head, from anywhere in the play area',
    worstDot > 0.85 && worstDet < 1e-6,
    `worst alignment ${worstDot.toFixed(3)} (was -0.75), basis determinant error ${worstDet.toExponential(1)}`
  )
}

console.log('\n\x1b[1marm IK\x1b[0m\n')

const SHOULDER = { x: 0.28, y: 1.10, z: 0.85, fx: 0, fz: -1 }

function solveSeries(poses, { handedness = 'right', dt = 1 / 60 } = {}) {
  const solver = createArmSolver({ handedness })
  const q = new THREE.Quaternion()
  const out = []
  for (const pose of poses) {
    const r = solver.solve({
      shoulder: SHOULDER,
      handPos: new THREE.Vector3(pose.x, pose.y, pose.z),
      handQuat: pose.quat ?? q,
      vel: pose.vel ?? { x: 0, y: 0, z: 0 },
      forward: { x: SHOULDER.fx, z: SHOULDER.fz },
      dt,
    })
    out.push({
      elbow: r.elbow.clone(),
      wrist: r.wrist.clone(),
      upperArmLen: r.upperArmLen,
      forearmLen: r.forearmLen,
      upperArmQuat: r.upperArmQuat.clone(),
      forearmQuat: r.forearmQuat.clone(),
      extensionRatio: r.extensionRatio,
    })
  }
  return out
}

// 8. It runs at all. The previous solver called Vector3.subScaledVector, which
//    does not exist in three.js — so it threw on EVERY frame, the arms never
//    rendered once, and the only symptom was a console full of errors.
{
  let ok = true
  let msg = ''
  try {
    solveSeries([{ x: 0.2, y: 1.2, z: 0.3 }])
  } catch (e) {
    ok = false
    msg = e.message
  }
  check('the solver runs without throwing', ok, msg || 'no exception')
}

// 9. Bone lengths are the whole point of IK: they must not change as the hand
//    moves, or the arm visibly stretches.
{
  const poses = []
  for (let i = 0; i <= 120; i++) {
    const u = i / 120
    poses.push({
      x: 0.45 - 0.75 * u,
      y: 1.05 + 0.5 * Math.sin(u * Math.PI),
      z: 0.65 - 0.6 * u,
    })
  }
  const r = solveSeries(poses)
  const maxU = Math.max(...r.map((f) => Math.abs(f.upperArmLen - 0.30)))
  const maxF = Math.max(...r.map((f) => Math.abs(f.forearmLen - 0.28)))
  check(
    'bones keep their length through a full swing',
    maxU < 1e-6 && maxF < 1e-6,
    `upper arm drift ${(maxU * 1000).toFixed(4)} mm, forearm ${(maxF * 1000).toFixed(4)} mm`
  )
}

// 10. The elbow must never snap. The old pole vector switched pose at a
//     hardcoded 0.4 m/s threshold while real punches run 3-8 m/s, so it jumped
//     to the fully-flared pose in a single frame and the arm looked broken.
{
  const poses = []
  for (let i = 0; i <= 90; i++) {
    const u = i / 90
    // A hook: hand sweeps across the body, velocity ramps through the old
    // threshold and well past it.
    const speed = 6 * Math.sin(u * Math.PI)
    poses.push({
      x: 0.45 - 0.8 * u,
      y: 1.22,
      z: 0.45,
      vel: { x: -speed, y: 0, z: 0 },
    })
  }
  const r = solveSeries(poses)
  let maxJump = 0
  for (let i = 1; i < r.length; i++) maxJump = Math.max(maxJump, r[i].elbow.distanceTo(r[i - 1].elbow))
  // At 60 fps a physically sensible elbow covers a few cm per frame at most.
  check(
    'the elbow never teleports during a hook',
    maxJump < 0.05,
    `largest single-frame elbow move ${(maxJump * 1000).toFixed(1)} mm`
  )
}

// 11. Bone orientation must be continuous too. setFromUnitVectors leaves the
//     twist about the bone arbitrary, which spun the modelled bicep and forearm
//     muscles around the arm as it moved.
{
  const poses = []
  for (let i = 0; i <= 90; i++) {
    const u = i / 90
    poses.push({ x: 0.4 - 0.7 * u, y: 1.1 + 0.35 * u, z: 0.6 - 0.35 * u })
  }
  const r = solveSeries(poses)
  let maxUpper = 0
  let maxFore = 0
  for (let i = 1; i < r.length; i++) {
    maxUpper = Math.max(maxUpper, r[i].upperArmQuat.angleTo(r[i - 1].upperArmQuat))
    maxFore = Math.max(maxFore, r[i].forearmQuat.angleTo(r[i - 1].forearmQuat))
  }
  const deg = (rad) => (rad * 180) / Math.PI
  check(
    'bone orientation is continuous frame to frame',
    deg(maxUpper) < 12 && deg(maxFore) < 12,
    `upper arm ${deg(maxUpper).toFixed(1)}°/frame, forearm ${deg(maxFore).toFixed(1)}°/frame`
  )
}

// 12. The elbow belongs below the shoulder-wrist line for a normal guard — an
//     elbow above it is the "chicken wing" that reads as a broken rig.
{
  const [r] = solveSeries([{ x: 0.3, y: 1.15, z: 0.6 }])
  const mid = new THREE.Vector3(
    (SHOULDER.x + r.wrist.x) / 2,
    (SHOULDER.y + r.wrist.y) / 2,
    (SHOULDER.z + r.wrist.z) / 2
  )
  check('at rest the elbow hangs below the arm line', r.elbow.y < mid.y, `elbow y=${r.elbow.y.toFixed(3)} vs line ${mid.y.toFixed(3)}`)
}

// 13. Left and right arms must mirror, not share a pose.
{
  const pose = [{ x: 0, y: 1.2, z: 0.4 }]
  const rRight = solveSeries(pose, { handedness: 'right' })[0]
  const shoulderL = { ...SHOULDER, x: -SHOULDER.x }
  const solverL = createArmSolver({ handedness: 'left' })
  const rLeft = solverL.solve({
    shoulder: shoulderL,
    handPos: new THREE.Vector3(0, 1.2, 0.4),
    handQuat: new THREE.Quaternion(),
    vel: { x: 0, y: 0, z: 0 },
    forward: { x: 0, z: -1 },
    dt: 1 / 60,
  })
  check(
    'the two arms flare their elbows to opposite sides',
    Math.sign(rRight.elbow.x - 0) !== Math.sign(rLeft.elbow.x - 0),
    `right elbow x=${rRight.elbow.x.toFixed(3)}, left elbow x=${rLeft.elbow.x.toFixed(3)}`
  )
}

// 14. Reaching past arm's length must not produce NaN or a broken triangle —
//     the player WILL push the glove further than the arm can go.
{
  const r = solveSeries([{ x: -2.5, y: 3.0, z: -4.0 }])[0]
  const finite = [r.elbow.x, r.elbow.y, r.elbow.z, r.upperArmLen, r.forearmLen].every(Number.isFinite)
  check(
    'over-extension stays finite and keeps a bend',
    finite && r.extensionRatio <= 0.9851,
    `extension ${r.extensionRatio.toFixed(4)}`
  )
}

// 14b. The elbow must stay visibly bent across the WHOLE play area. An arm that
//      locks out straight the moment the hand crosses the body is the stiff,
//      mannequin look — and before the progressive lean, a right hand anywhere
//      on the left half of the play area sat at a 160-degree elbow.
{
  const angles = []
  for (const [x, y, z] of [
    [0.45, 1.10, 0.42],
    [0.15, 1.30, 0.25],
    [-0.10, 1.35, 0.22],
    [-0.35, 1.45, 0.22],
    [-0.55, 1.20, 0.25],
    [0.30, 0.95, 0.40],
  ]) {
    const solver = createArmSolver({ handedness: 'right' })
    const r = solver.solve({
      shoulder: { x: 0.28, y: 1.10, z: 0.52 },
      handPos: new THREE.Vector3(x, y, z),
      handQuat: new THREE.Quaternion(),
      forward: { x: 0, z: -1 },
      dt: 1 / 60,
    })
    angles.push((r.elbowAngle * 180) / Math.PI)
  }
  const worst = Math.max(...angles)
  check(
    'the elbow keeps a bend everywhere in the play area',
    worst < 150,
    `straightest elbow ${worst.toFixed(0)}° across the reach (was 160° locked out)`
  )
}

// 15. Allocation-free steady state. The old solver built eight three.js objects
//     per call, twice a frame — GC pauses land mid-swing and read as bad
//     tracking.
{
  const solver = createArmSolver({ handedness: 'right' })
  const q = new THREE.Quaternion()
  const a = solver.solve({
    shoulder: SHOULDER, handPos: new THREE.Vector3(0.2, 1.2, 0.4), handQuat: q, dt: 1 / 60,
  })
  const b = solver.solve({
    shoulder: SHOULDER, handPos: new THREE.Vector3(0.25, 1.2, 0.4), handQuat: q, dt: 1 / 60,
  })
  check(
    'the solver reuses one result object instead of allocating',
    a === b && a.elbow === b.elbow,
    'same result and vector identities across calls'
  )
}

console.log(
  failures === 0
    ? '\n\x1b[32mall checks passed\x1b[0m\n'
    : `\n\x1b[31m${failures} check(s) failed\x1b[0m\n`
)
process.exit(failures === 0 ? 0 : 1)
