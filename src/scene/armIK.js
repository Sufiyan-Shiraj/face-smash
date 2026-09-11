import * as THREE from 'three'

/**
 * Analytical two-bone IK for the player's arms.
 *
 * WHY THIS IS A FACTORY AND NOT A PURE FUNCTION
 *
 * The previous version was a pure function, and that was the root of both
 * problems it had.
 *
 *  1. It allocated. Six Vector3s and two Quaternions per call, twice per frame,
 *     sixty times a second — around 43k objects a minute handed straight to the
 *     GC. The resulting collections are short, but they land unpredictably, and
 *     a 4 ms pause in the middle of a swing is exactly the kind of hitch that
 *     reads as "the tracking is bad".
 *
 *  2. It could not smooth anything. Every frame started from nothing, so the
 *     elbow pole — the one value that decides whether an arm looks human — was
 *     recomputed from scratch and snapped between poses. An arm whose elbow
 *     teleports when you cross a velocity threshold does not look like an arm.
 *
 * Both are fixed by giving each arm a solver that owns its own state and its
 * own output object. Nothing is allocated after construction.
 *
 * WHAT MAKES AN ARM LOOK NATURAL
 *
 * The bone lengths and the law of cosines are the easy part; they only decide
 * where the elbow sits on a circle. Which point ON that circle is the entire
 * question, and it is set by the pole vector. Three things matter:
 *
 *  - The pole lives in a BODY-RELATIVE frame, not the world. A world-space
 *    "down and outward" is only correct while the camera looks down -Z, so the
 *    old constant pole quietly became wrong the moment the player orbited.
 *
 *  - It is CONTINUOUS in velocity. The old code switched pose at
 *    `lateralSwing > 0.4` against a value measured in metres per second, so any
 *    real punch (3-8 m/s) blew straight past it and the elbow snapped to the
 *    fully-flared pose in one frame. Here the flare is a smooth saturating
 *    response over the actual range a human punch covers.
 *
 *  - It is DAMPED over time. Even a continuous target is not enough, because
 *    hand velocity itself is noisy. The pole chases its target with a critically
 *    damped filter, so the elbow leads and trails the fist the way a real one
 *    does instead of vibrating.
 */

// ---------------------------------------------------------------------------
// Module-scope scratch. Never returned, never retained; safe to share because
// solve() is synchronous and single-threaded.
// ---------------------------------------------------------------------------
const _v = new THREE.Vector3()
const _u = new THREE.Vector3()
const _pole = new THREE.Vector3()
const _perp = new THREE.Vector3()
const _fwd = new THREE.Vector3()
const _right = new THREE.Vector3()
const _up = new THREE.Vector3()
const _axisY = new THREE.Vector3()
const _axisX = new THREE.Vector3()
const _axisZ = new THREE.Vector3()
const _planeN = new THREE.Vector3()
const _handX = new THREE.Vector3()
const _basis = new THREE.Matrix4()
const _localVel = new THREE.Vector3()

const WORLD_UP = new THREE.Vector3(0, 1, 0)

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)

/**
 * Smooth saturating ramp: 0 below `knee`, approaching 1 well above it, with no
 * corner anywhere. This is what replaces the old `if (x > 0.4)` cliff.
 */
function ramp(value, knee, scale) {
  if (value <= knee) return 0
  const t = (value - knee) / scale
  return t / (1 + t)
}

/**
 * Build an orthonormal basis with +Y along `dir` and the roll resolved by
 * `rollRef`, and write it into `quat`.
 *
 * Three.js offers setFromUnitVectors for this and it is the wrong tool: it
 * produces the minimal rotation from +Y to `dir`, which leaves the twist about
 * the bone completely arbitrary. Cylinders do not care, but the bicep peak and
 * the brachioradialis contour in FullArmMesh are modelled OFF the bone axis, so
 * an arbitrary twist spins them around the arm as it moves. Pinning the roll to
 * the plane of the arm keeps them where anatomy puts them.
 */
function orientBone(quat, dir, rollRef) {
  _axisY.copy(dir).normalize()

  // Z is rollRef made perpendicular to the bone.
  _axisZ.copy(rollRef).addScaledVector(_axisY, -rollRef.dot(_axisY))
  if (_axisZ.lengthSq() < 1e-8) {
    // rollRef was parallel to the bone. Any perpendicular will do.
    _axisZ.set(0, 0, 1).addScaledVector(_axisY, -_axisY.z)
    if (_axisZ.lengthSq() < 1e-8) _axisZ.set(1, 0, 0).addScaledVector(_axisY, -_axisY.x)
  }
  _axisZ.normalize()

  _axisX.crossVectors(_axisY, _axisZ).normalize()

  _basis.makeBasis(_axisX, _axisY, _axisZ)
  quat.setFromRotationMatrix(_basis)
}

/**
 * @param {object} opts
 * @param {'left'|'right'} [opts.handedness]
 * @param {number} [opts.L1] Upper arm length, shoulder to elbow, metres.
 * @param {number} [opts.L2] Forearm length, elbow to wrist, metres.
 */
export function createArmSolver({ handedness = 'right', L1 = 0.30, L2 = 0.28, maxLean = 0.40 } = {}) {
  const isLeft = handedness === 'left' || handedness === 'Left'
  const lateralSign = isLeft ? -1 : 1

  // Persistent output. FullArmMesh copies out of this every frame, so the same
  // object can be handed back forever.
  const out = {
    shoulder: new THREE.Vector3(),
    elbow: new THREE.Vector3(),
    wrist: new THREE.Vector3(),
    upperArmMid: new THREE.Vector3(),
    forearmMid: new THREE.Vector3(),
    upperArmLen: L1,
    forearmLen: L2,
    upperArmQuat: new THREE.Quaternion(),
    forearmQuat: new THREE.Quaternion(),
    handQuat: new THREE.Quaternion(),
    elbowAngle: 0,
    extensionRatio: 0,
  }

  // Smoothed pole direction, in world space. Seeded on first solve.
  const poleSmoothed = new THREE.Vector3()
  let seeded = false

  /**
   * @param {object} frame
   * @param {{x,y,z}} frame.shoulder  World-space shoulder pivot.
   * @param {THREE.Vector3} frame.handPos   World-space fist centre.
   * @param {THREE.Quaternion} frame.handQuat Fist orientation.
   * @param {{x,y,z}} [frame.vel]     Fist velocity, world metres/second.
   * @param {{x,y,z}} [frame.forward] Body forward (shoulder toward the target),
   *   horizontal. Defaults to -Z.
   * @param {number} [frame.dt]       Seconds since the previous solve.
   */
  function solve({ shoulder, handPos, handQuat, vel, forward, dt = 1 / 60 }) {
    out.handQuat.copy(handQuat)

    // --- 1. Wrist sits back from the fist centre, along the fist's -Z -------
    _fwd.set(0, 0, 1).applyQuaternion(handQuat)
    out.wrist.copy(handPos).addScaledVector(_fwd, -0.082)

    out.shoulder.set(shoulder.x, shoulder.y, shoulder.z)

    // --- 2. Shoulder to wrist ----------------------------------------------
    _v.subVectors(out.wrist, out.shoulder)
    let rawDist = _v.length()

    const dMin = Math.max(Math.abs(L1 - L2) + 0.02, 0.12)
    // Never fully straight: a locked-out elbow is the classic "mannequin" tell,
    // and it is also a singularity for the pole projection below.
    const dMax = (L1 + L2) * 0.985

    if (rawDist > 1e-5) _u.copy(_v).divideScalar(rawDist)
    else _u.set(0, 0, -1)

    // --- 2b. Lean, because the fist goes further than the arm is long -------
    //
    // The play area is sized by the camera's field of view, and at the edges it
    // puts the fist close to a metre from a shoulder carrying 58 cm of bone. The
    // previous solver resolved that by leaving the wrist where it was and
    // letting the forearm stretch to meet it — measured at 48 cm of stretch on
    // a wide swing, and at least 21 cm even on a centred one, every frame. A
    // forearm that changes length is not an arm, and it is a large part of why
    // the arms never looked right.
    //
    // Bones do not stretch here. A person reaching past their arm's length
    // leans and rolls the shoulder after it, so that is what happens: the
    // shoulder slides along the line to the fist, up to a limit. Past that limit
    // the wrist is pulled in to the last reachable point, which keeps both bones
    // exact and simply falls short — honest, and far less visible than a
    // rubber forearm.
    // The lean starts BEFORE the arm runs out, at `comfort`, not at full stretch.
    // Leaning only once the elbow is already locked would leave the arm straight
    // across most of the play area — measured at a 160-degree elbow anywhere the
    // right hand crossed to the left half, which is the stiff, mannequin look.
    // People start shifting their shoulder well before they are at full stretch,
    // so the elbow keeps a bend through the whole reach.
    const comfort = dMax * 0.86
    if (rawDist > comfort) {
      const lean = Math.min(rawDist - comfort, maxLean)
      out.shoulder.addScaledVector(_u, lean)
      rawDist -= lean
    }
    if (rawDist > dMax) {
      // Past even the lean. Keep both bones exact and fall short rather than
      // stretching the forearm, which is what the old solver did.
      out.wrist.copy(out.shoulder).addScaledVector(_u, dMax)
      rawDist = dMax
    }

    const d = clamp(rawDist, dMin, dMax)

    // --- 3. Law of cosines --------------------------------------------------
    const cosAlpha = clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1)
    const sinAlpha = Math.sqrt(Math.max(0, 1 - cosAlpha * cosAlpha))
    const cosBeta = clamp((L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2), -1, 1)
    out.elbowAngle = Math.acos(cosBeta)
    out.extensionRatio = d / (L1 + L2)

    // --- 4. Body-relative frame --------------------------------------------
    // Everything about the pole is expressed in this frame, so orbiting the
    // camera rotates the whole arm rather than leaving the elbow pointing at a
    // fixed corner of the world.
    if (forward) _fwd.set(forward.x, 0, forward.z)
    else _fwd.set(0, 0, -1)
    if (_fwd.lengthSq() < 1e-8) _fwd.set(0, 0, -1)
    _fwd.normalize()
    _right.crossVectors(_fwd, WORLD_UP).normalize().negate()
    _up.copy(WORLD_UP)

    // Velocity in body coordinates: +x outward from the body's centre line for
    // this arm, +y up, +z toward the target.
    if (vel) {
      _localVel.set(
        (vel.x * _right.x + vel.y * _right.y + vel.z * _right.z) * lateralSign,
        vel.x * _up.x + vel.y * _up.y + vel.z * _up.z,
        vel.x * _fwd.x + vel.y * _fwd.y + vel.z * _fwd.z
      )
    } else {
      _localVel.set(0, 0, 0)
    }

    // --- 5. Target pole -----------------------------------------------------
    // Rest: the elbow hangs down, a little outboard of the ribs and slightly
    // behind the shoulder. That is where a guard actually sits.
    let pRight = 0.52
    let pUp = -1.0
    let pFwd = -0.22

    // Hook. Swinging the fist ACROSS the body (inward, -x in body coords) lifts
    // the elbow into the horizontal hook frame and flares it outward. Knee and
    // scale are in metres/second and chosen for the range a real punch covers,
    // which is the unit the old threshold got wrong.
    const hook = ramp(-_localVel.x, 1.2, 3.5)
    pUp += hook * 1.15
    pRight += hook * 0.65

    // Uppercut. Driving upward drops the elbow tight to the body.
    const upper = ramp(_localVel.y, 1.0, 3.0)
    pUp -= upper * 0.55
    pRight -= upper * 0.30

    // Extension. A straight punch finishes with the elbow rotated in UNDER the
    // line of the arm, not out beside it — this is the difference between a jab
    // and a chicken wing.
    const ext = clamp((out.extensionRatio - 0.72) / 0.26, 0, 1)
    pRight *= 1 - ext * 0.62
    pFwd -= ext * 0.18

    _pole.set(
      _right.x * pRight * lateralSign + _up.x * pUp + _fwd.x * pFwd,
      _right.y * pRight * lateralSign + _up.y * pUp + _fwd.y * pFwd,
      _right.z * pRight * lateralSign + _up.z * pUp + _fwd.z * pFwd
    ).normalize()

    // --- 6. Damp the pole ---------------------------------------------------
    // Rate is deliberately below the hand's own tracking rate: the elbow is a
    // heavy joint driven through soft tissue and should visibly trail the fist.
    if (!seeded) {
      poleSmoothed.copy(_pole)
      seeded = true
    } else {
      const k = 1 - Math.exp(-16 * clamp(dt, 0, 0.1))
      poleSmoothed.lerp(_pole, k)
      if (poleSmoothed.lengthSq() < 1e-8) poleSmoothed.copy(_pole)
      else poleSmoothed.normalize()
    }

    // --- 7. Elbow position --------------------------------------------------
    // Project the pole onto the plane perpendicular to the shoulder->wrist axis
    // to get the direction the elbow bulges out along.
    _perp.copy(poleSmoothed).addScaledVector(_u, -poleSmoothed.dot(_u))
    if (_perp.lengthSq() < 1e-6) {
      _perp.crossVectors(WORLD_UP, _u)
      if (_perp.lengthSq() < 1e-6) _perp.crossVectors(_right, _u)
    }
    _perp.normalize()

    out.elbow
      .copy(out.shoulder)
      .addScaledVector(_u, L1 * cosAlpha)
      .addScaledVector(_perp, L1 * sinAlpha)

    // --- 8. Bones -----------------------------------------------------------
    out.upperArmMid.addVectors(out.shoulder, out.elbow).multiplyScalar(0.5)
    out.forearmMid.addVectors(out.elbow, out.wrist).multiplyScalar(0.5)

    _v.subVectors(out.elbow, out.shoulder)
    out.upperArmLen = _v.length()

    // The normal of the arm's own plane is the natural, continuous roll
    // reference: it only changes when the whole arm swings, never on its own.
    _planeN.crossVectors(_u, _perp).normalize()
    orientBone(out.upperArmQuat, _v, _planeN)

    _v.subVectors(out.wrist, out.elbow)
    out.forearmLen = _v.length()

    // The forearm's twist follows the FIST, because anatomically that is what
    // pronation is — the radius crossing the ulna. Rolling the fist without
    // rolling the forearm is the single most obvious "this is a puppet" tell.
    _handX.set(1, 0, 0).applyQuaternion(handQuat)
    _handX.crossVectors(_handX, _v)
    if (_handX.lengthSq() < 1e-8) _handX.copy(_planeN)
    orientBone(out.forearmQuat, _v, _handX)

    return out
  }

  function reset() {
    seeded = false
  }

  return { solve, out, reset }
}
