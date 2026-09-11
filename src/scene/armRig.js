import * as THREE from 'three'

// Where the player's shoulders are, how long their arms are, and how big the
// play area is.
//
// Pure numbers and pure maths, deliberately kept out of Lab3D.jsx so the whole
// rig can be checked headlessly (scripts/mapping-sim.mjs). The bug this makes
// testable is the one that is hardest to see in a screenshot and most obvious in
// motion: an arm anchored on the wrong side of the body, so the two arms cross
// over each other on their way to the gloves.

export const VIEW_DEFAULTS = {
  headCentre: { x: 0, y: 1.31, z: 0 },
  cameraPosition: [0, 1.34, 1.15],
}

/**
 * First-person shoulder anchor, in world space, relative to the camera.
 *
 * THE FORWARD OFFSET IS NOT COSMETIC. It used to be 0.22 m, which put the
 * shoulder 0.79 m from a fist resting in the middle of the play area — while the
 * arm it drives is 0.58 m of bone. The arm could not reach the target on ANY
 * frame, so the IK stretched the forearm to cover the difference and the result
 * never looked like an arm.
 *
 * 0.63 m puts a centred, resting fist at about 0.80 of full extension: a natural
 * guard, with room left to extend into a punch rather than starting locked out.
 */
// Slightly BEHIND the camera plane, so the shoulder joint sits outside the near
// plane and is never drawn. The previous value put it 0.63 m in front, which
// parked a dark deltoid sphere in the middle of the playfield between the player
// and the head, and pulled both arms in toward the centre of the screen so they
// appeared to cross.
export const SHOULDER_FORWARD = -0.02
export const SHOULDER_DROP = 0.55
/**
 * Half the distance between the shoulders, and how far below the camera they sit.
 *
 * Wide and low, which is a LOOK and not just a reach budget. Narrow, shallow
 * shoulders put both arms directly under the camera pointing away from it, so
 * the forearm is seen end-on as a vertical tube rising out of the bottom of the
 * frame — no elbow, no direction, nothing that reads as an arm. Moving the
 * shoulders out to the bottom corners makes each forearm enter the frame
 * diagonally, which is what a first-person guard actually looks like.
 */
export const SHOULDER_HALF_WIDTH = 0.50

/**
 * Bone lengths, in metres, and deliberately not human.
 *
 * A real arm is about 58 cm of bone. The camera sits 1.15 m back from the head
 * and the fist rests 0.22 m in front of it, so a first-person shoulder is very
 * nearly a metre from its own fist before the player does anything at all. With
 * anatomical bones that is unreachable on every frame, and the old solver hid it
 * by stretching the forearm — up to 48 cm of stretch on a wide swing.
 *
 * Long arms are the standard answer to this in first-person games, and they are
 * invisible: the shoulder is off-camera, so there is nothing on screen to
 * compare the length against. What IS visible is a forearm that changes length,
 * which is why this is the trade that gets made.
 *
 * The exact length is not taste. The binding case is the far cross-body corner
 * of the play area at full punch depth, and mapping-sim.mjs measures it: at the
 * previous 1.25 m the arm fell 49 cm short there against a 40 cm lean budget, so
 * it would have hit the wrist clamp and visibly stopped following the hand.
 */
export const MAX_LEAN = 0.45
export const UPPER_ARM = 0.77
export const FOREARM = 0.73
export const ARM_LENGTH = UPPER_ARM + FOREARM

/**
 * Half-height of the play area, in metres, measured at the head.
 *
 * Fixed in world units rather than derived from the viewport — see
 * handToWorld.js. 0.38 gives a box about 1.35 m across at 16:9, which the arms
 * above can cover with the shoulder lean they have.
 */
export const PLAY_HALF_HEIGHT = 0.32

export function getShoulderPosition(cameraPos, handedness) {
  const isLeft = handedness === 'left' || handedness === 'Left'
  const sign = isLeft ? -1 : 1

  const camX = cameraPos?.x ?? VIEW_DEFAULTS.cameraPosition[0]
  const camY = cameraPos?.y ?? VIEW_DEFAULTS.cameraPosition[1]
  const camZ = cameraPos?.z ?? VIEW_DEFAULTS.cameraPosition[2]

  const fwdX = VIEW_DEFAULTS.headCentre.x - camX
  const fwdY = VIEW_DEFAULTS.headCentre.y - camY
  const fwdZ = VIEW_DEFAULTS.headCentre.z - camZ
  const fwdLen = Math.hypot(fwdX, fwdY, fwdZ) || 1
  const fx = fwdX / fwdLen
  const fz = fwdZ / fwdLen

  // Right vector: forward x (0, 1, 0)
  const rx = -fz
  const rz = fx

  return {
    x: camX + fx * SHOULDER_FORWARD + rx * (sign * SHOULDER_HALF_WIDTH),
    y: camY - SHOULDER_DROP,
    z: camZ + fz * SHOULDER_FORWARD + rz * (sign * SHOULDER_HALF_WIDTH),
    // Horizontal body forward, handed to the IK solver so the elbow pole is
    // expressed relative to the player rather than to a fixed world axis.
    fx,
    fz,
  }
}

const _mat = new THREE.Matrix4()
const _targetQuat = new THREE.Quaternion()

/**
 * Computes authentic first-person boxing orientation for fighter hands.
 * Knuckles point toward the dummy head, wrists/forearms align naturally with shoulders,
 * fists pronate smoothly on punches, and subtle hook angles eliminate wind-vane flipping.
 */
export function computeHandOrientation(pos, vel, handedness, shoulder = null) {
  // Knuckles (+Z local) point towards the target head (0, 1.31, 0.08)
  let fwdX = 0 - pos.x
  let fwdY = 1.31 - pos.y
  let fwdZ = 0.08 - pos.z

  // Subtle athletic lead into hooks (slight lateral tilt, max ~14 deg)
  const speed = Math.hypot(vel.x, vel.y, vel.z)
  if (speed > 0.35) {
    const hookFactor = Math.max(-0.20, Math.min(0.20, vel.x * 0.035))
    fwdX += hookFactor * Math.abs(fwdZ)
    const uppercutFactor = Math.max(-0.12, Math.min(0.12, vel.y * 0.025))
    fwdY += uppercutFactor * Math.abs(fwdZ)
  }

  // Ensure forward vector points into the screen (-Z direction in Three.js world)
  if (fwdZ >= -0.02) fwdZ = -0.02
  const fwdLen = Math.hypot(fwdX, fwdY, fwdZ) || 1
  const cz = fwdZ / fwdLen
  const cx = fwdX / fwdLen
  const cy = fwdY / fwdLen

  // Unrolled Up vector perpendicular to forward (World Up is (0, 1, 0))
  let u0x = -cy * cx
  let u0y = 1 - cy * cy
  let u0z = -cy * cz
  const u0len = Math.hypot(u0x, u0y, u0z) || 1
  u0x /= u0len
  u0y /= u0len
  u0z /= u0len

  // Right vector R0 = U0 x C, which is what actually closes a RIGHT-HANDED
  // basis: (U0 x C) x U0 = C.
  //
  // This used to be C x U0, with a comment asserting "Right-handed: R0 x U0 =
  // C". That identity is false — (C x U0) x U0 = -C — so the three columns
  // formed a REFLECTION, determinant -1, not a rotation. three.js's
  // setFromRotationMatrix assumes it has been handed a pure rotation and does
  // not check, so it silently returned a frame whose +Z pointed the wrong way:
  // measured in the running app, the glove's forward sat at a dot product of
  // -0.75 against the direction to the head. The fists were aimed backwards,
  // out of the screen, on every single frame — which is what made a boxing
  // glove read as a shapeless blob, because the player was looking at the
  // BACK of it.
  let r0x = u0y * cz - u0z * cy
  let r0y = u0z * cx - u0x * cz
  let r0z = u0x * cy - u0y * cx
  const r0len = Math.hypot(r0x, r0y, r0z) || 1
  r0x /= r0len
  r0y /= r0len
  r0z /= r0len

  // Dynamic boxing pronation: a guard holds the fists semi-vertical, thumbs up;
  // a punch rolls them flat as it lands.
  //
  // How far through the punch we are used to be read off pos.z against two
  // hardcoded world-space constants. That only described the shot while the
  // camera sat on +Z looking down the axis — orbit the view and the fists
  // pronated according to where they happened to be in the world rather than
  // how extended the arm was. Measure the actual reach from the shoulder
  // instead, which is what "extension" means and is orientation-independent.
  const isLeft = handedness === 'left'
  let punchExt
  if (shoulder) {
    const rx = pos.x - shoulder.x
    const ry = pos.y - shoulder.y
    const rz = pos.z - shoulder.z
    const reach = Math.hypot(rx, ry, rz)
    // Roll begins past roughly three-quarters of full extension.
    punchExt = Math.max(0, Math.min(1, (reach / ARM_LENGTH - 0.74) / 0.22))
  } else {
    punchExt = Math.max(0, Math.min(1, (0.24 - pos.z) / 0.14))
  }
  const guardRoll = isLeft ? 0.35 : -0.35 // ~20 deg inward tilt in guard
  const punchRoll = isLeft ? 1.25 : -1.25 // ~72 deg flat pronation on impact
  const roll = guardRoll + (punchRoll - guardRoll) * punchExt

  // Rotate (R0, U0) by roll around C
  const cosR = Math.cos(roll)
  const sinR = Math.sin(roll)

  // Local X = R0 * cosR + U0 * sinR
  const ax = r0x * cosR + u0x * sinR
  const ay = r0y * cosR + u0y * sinR
  const az = r0z * cosR + u0z * sinR

  // Local Y = -R0 * sinR + U0 * cosR
  const bx = -r0x * sinR + u0x * cosR
  const by = -r0y * sinR + u0y * cosR
  const bz = -r0z * sinR + u0z * cosR

  // Construct Three.js Matrix4 (Column 0: A, Column 1: B, Column 2: C)
  _mat.set(
    ax, bx, cx, 0,
    ay, by, cy, 0,
    az, bz, cz, 0,
    0,  0,  0,  1
  )
  return _targetQuat.setFromRotationMatrix(_mat)
}
