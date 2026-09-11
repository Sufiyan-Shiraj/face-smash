// The head: a dynamic body clamped into the vise by the neck.
//
// The render mesh is NEVER the collider. The player sees a textured head; the
// solver sees the seven primitives below. Putting a trimesh on a dynamic body
// is the fastest way to turn a physics scene into a slideshow.
//
// WHY SEVEN PRIMITIVES AND NOT ONE BALL
//
// A single ball has no face. Every hit lands on the same featureless surface,
// which costs three things that turn out to matter more than the sphere saved:
//
//   1. No location. "You hit the nose" is the entire joke of this game and a
//      ball cannot tell a nose from an ear. Each collider below carries a
//      region tag, so the impact router reports WHERE, and the nose is worth
//      2.2x the temple.
//   2. No deflection. A ball is the one shape that cannot produce a glancing
//      blow — every contact normal points at the centre, so nothing ever slides
//      off. The nose and brow stick out, so a hit that clips them skids and
//      rotates the head instead of driving it straight back. That is real
//      geometry doing it, not a special case.
//   3. No lever arm variety. Contacts on a ball all act at radius 0.11. The jaw
//      sits low and forward, so catching it produces the long-lever rotation
//      that reads as a proper knockout.
//
// Total collider mass is kept at a real 4.5 kg human head; the bulk is in the
// skull and the features are nearly weightless, so adding detail did not
// quietly make the head heavier to shove.

import { RAPIER } from './world.js'

// Collision filtering, as Rapier packs it: the upper 16 bits are the groups a
// collider BELONGS to, the lower 16 the groups it INTERACTS with.
//
// The head belongs to group 1 and solves against group 1, so it still behaves
// like a normal rigid body against anything else in the scene. The striker
// (group 2) is detected by it but never solved against it — see striker.js for
// why the hand must not be allowed to push.
export const HEAD_GROUP = 0x00010003
export const HEAD_SOLVER = 0x00010001

/** Real-world head dimensions. Physics engines are tuned for metres; guessing
 *  the scale is the usual reason a rig feels like it's made of balloons. */
export const HEAD = {
  radius: 0.11, // ~0.22 m tall
  mass: 4.5, // kg, an actual human head
  bustMass: 9, // if the mesh includes shoulders
}

/**
 * Face regions, in head-local metres, +z forward and +y up.
 *
 * `damage` is a game-design weight; everything else here is geometry the solver
 * actually uses. Keep these in sync with HeadMesh.jsx — a hitbox the player
 * cannot see is worse than no hitbox, because they cannot learn to aim at it.
 */
export const REGIONS = [
  {
    id: 'skull',
    label: 'HIT',
    shape: { type: 'ball', radius: 0.1 },
    at: { x: 0, y: 0.006, z: -0.004 },
    mass: 3.5,
    damage: 1,
  },
  {
    id: 'nose',
    label: 'NOSE!',
    shape: { type: 'ball', radius: 0.022 },
    at: { x: 0, y: -0.008, z: 0.097 },
    mass: 0.06,
    damage: 2.2, // the one everybody is aiming for
  },
  {
    id: 'brow',
    label: 'SKULL',
    shape: { type: 'cuboid', hx: 0.062, hy: 0.020, hz: 0.026 },
    at: { x: 0, y: 0.045, z: 0.082 },
    mass: 0.12,
    damage: 0.7, // bone. hurts the hand more than the face
  },
  {
    id: 'jaw',
    label: 'JAW!',
    shape: { type: 'cuboid', hx: 0.055, hy: 0.030, hz: 0.042 },
    at: { x: 0, y: -0.072, z: 0.042 },
    mass: 0.35,
    damage: 1.8, // long lever from the pivot — this is the knockout shot
  },
  {
    id: 'chin',
    label: 'CHIN!',
    shape: { type: 'cuboid', hx: 0.038, hy: 0.018, hz: 0.032 },
    at: { x: 0, y: -0.118, z: 0.038 },
    mass: 0.15,
    damage: 2.0, // clean uppercut / chin shot
  },
  {
    id: 'cheekL',
    label: 'CHEEK!',
    shape: { type: 'ball', radius: 0.038 },
    at: { x: -0.060, y: -0.028, z: 0.052 },
    mass: 0.09,
    damage: 1.4,
  },
  {
    id: 'cheekR',
    label: 'CHEEK!',
    shape: { type: 'ball', radius: 0.038 },
    at: { x: 0.060, y: -0.028, z: 0.052 },
    mass: 0.09,
    damage: 1.4,
  },
  {
    id: 'ear',
    label: 'EAR!',
    // One capsule spanning both ears would cut through the skull; two colliders
    // sharing a region id costs nothing and keeps the shape honest.
    shape: { type: 'ball', radius: 0.028 },
    at: { x: -0.102, y: -0.012, z: -0.012 },
    mass: 0.025,
    damage: 1.6,
  },
  {
    id: 'ear',
    label: 'EAR!',
    shape: { type: 'ball', radius: 0.028 },
    at: { x: 0.102, y: -0.012, z: -0.012 },
    mass: 0.025,
    damage: 1.6,
  },
]

/** Rotate a world vector into the head's local frame (conjugate rotation). */
function intoLocal(v, q) {
  const { x, y, z, w } = q
  const ix = w * v.x - y * v.z + z * v.y
  const iy = w * v.y - z * v.x + x * v.z
  const iz = w * v.z - x * v.y + y * v.x
  const iw = x * v.x + y * v.y + z * v.z
  return {
    x: ix * w + iw * x + iy * z - iz * y,
    y: iy * w + iw * y + iz * x - ix * z,
    z: iz * w + iw * z + ix * y - iy * x,
  }
}

/** Rotate a local vector back out into world space. */
function intoWorld(v, q) {
  return intoLocal(v, { x: -q.x, y: -q.y, z: -q.z, w: q.w })
}

/**
 * Closest point on a region's surface to `p`, both in head-local metres, with
 * the OUTWARD surface normal there. Distance is negative when `p` is inside.
 *
 * The normal is taken from the shape, not from (p - closestPoint). Those agree
 * only while the weapon is outside: once it penetrates — which is most of the
 * time, since a kinematic striker keeps going — the difference vector points
 * back INWARD and the normal silently inverts. That reads as a hit travelling
 * away from the face, so approach speed comes out zero and a square blow is
 * discarded as a graze. Measured: a spoon 6.6 mm into the cheek scored nothing.
 */
function closestOn(region, p) {
  const s = region.shape
  const at = region.at
  const dx = p.x - at.x
  const dy = p.y - at.y
  const dz = p.z - at.z

  if (s.type === 'cuboid') {
    const cx = Math.min(Math.max(dx, -s.hx), s.hx)
    const cy = Math.min(Math.max(dy, -s.hy), s.hy)
    const cz = Math.min(Math.max(dz, -s.hz), s.hz)
    const ox = dx - cx
    const oy = dy - cy
    const oz = dz - cz
    const d = Math.hypot(ox, oy, oz)

    if (d > 1e-9) {
      return {
        d,
        x: at.x + cx,
        y: at.y + cy,
        z: at.z + cz,
        nx: ox / d,
        ny: oy / d,
        nz: oz / d,
      }
    }

    // Inside the box: the outward normal is the axis of the nearest face, and
    // the depth to it is the (negative) distance.
    const gx = s.hx - Math.abs(dx)
    const gy = s.hy - Math.abs(dy)
    const gz = s.hz - Math.abs(dz)
    const inset = Math.min(gx, gy, gz)
    const n = { nx: 0, ny: 0, nz: 0 }
    let px = at.x + cx
    let py = at.y + cy
    let pz = at.z + cz
    if (inset === gx) {
      n.nx = Math.sign(dx) || 1
      px = at.x + n.nx * s.hx
    } else if (inset === gy) {
      n.ny = Math.sign(dy) || 1
      py = at.y + n.ny * s.hy
    } else {
      n.nz = Math.sign(dz) || 1
      pz = at.z + n.nz * s.hz
    }
    return { d: -inset, x: px, y: py, z: pz, ...n }
  }

  // Ball (and, for these purposes, capsule): the outward normal is radial at
  // any depth, so penetration is handled by the same expression.
  const len = Math.hypot(dx, dy, dz) || 1e-9
  const r = s.radius
  return {
    d: len - r,
    x: at.x + (dx / len) * r,
    y: at.y + (dy / len) * r,
    z: at.z + (dz / len) * r,
    nx: dx / len,
    ny: dy / len,
    nz: dz / len,
  }
}

function descFor(region) {
  const s = region.shape
  const desc =
    s.type === 'cuboid'
      ? RAPIER.ColliderDesc.cuboid(s.hx, s.hy, s.hz)
      : s.type === 'capsule'
        ? RAPIER.ColliderDesc.capsule(s.halfHeight, s.radius)
        : RAPIER.ColliderDesc.ball(s.radius)
  return desc.setTranslation(region.at.x, region.at.y, region.at.z)
}

/**
 * @param {object} ctx           From createPhysicsWorld().
 * @param {object} [opts]
 * @param {number} [opts.radius]
 * @param {{x,y,z}} [opts.neck]  World position of the neck pivot.
 * @param {number} [opts.stiffness] Restoring torque toward upright.
 * @param {number} [opts.damping]   Angular damping in the restoring spring.
 * @param {number} [opts.maxTilt]   Radians past which the neck stops giving.
 */
export function createHead(
  { world },
  {
    radius = HEAD.radius,
    neck = { x: 0, y: 1.2, z: 0 },
    stiffness = 12,
    damping = 0.4,
    angularDamping = 1.5,
    maxTilt = 1.25, // ~72 degrees. Past this it is not a neck any more.
    limitStiffness = 140,
  } = {}
) {
  // The vise. Immovable, and the thing the neck joint hangs off.
  const anchor = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(neck.x, neck.y, neck.z)
  )

  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(neck.x, neck.y + radius, neck.z)
      // Rapier's own angular damping is applied implicitly by the solver, so
      // unlike the explicit spring below it stays stable at any magnitude.
      // Let it do the settling and keep the spring weak.
      .setAngularDamping(angularDamping)
      .setLinearDamping(0.1)
      .setCanSleep(false) // a sleeping head ignores the first hit that wakes it
  )

  // handle → region, so a collision event can say which part of the face it
  // hit. The entries are per-instance copies carrying their own collider, so
  // two heads in one world never share state and the REGIONS table above stays
  // the immutable description it looks like.
  const regionOf = new Map()
  const colliders = REGIONS.map((region) => {
    const collider = world.createCollider(
      descFor(region)
        .setMass(region.mass)
        .setRestitution(0.4)
        .setFriction(0.6)
        .setCollisionGroups(HEAD_GROUP)
        .setSolverGroups(HEAD_SOLVER),
      body
    )
    regionOf.set(collider.handle, { ...region, collider })
    return collider
  })
  const regions = [...regionOf.values()]

  // Ball joint at the head's CENTRE, not down at the neck.
  //
  // Anchoring below the centre of mass builds an inverted pendulum: gravity
  // then produces a destabilising torque of m·g·r ≈ 4.9 N·m that the spring has
  // to out-muscle at every angle. Pivoting through the centre makes gravity's
  // torque identically zero, so the spring only ever has to answer the hit —
  // which is the whole reason it exists. Visually it is also what the vise in
  // the mockup actually does: the head rotates in place inside the clamp.
  world.createImpulseJoint(
    RAPIER.JointData.spherical({ x: 0, y: 0, z: 0 }, { x: 0, y: radius, z: 0 }),
    body,
    anchor,
    true
  )

  /**
   * Restoring torque toward upright, as a PD controller on the orientation
   * quaternion, plus a hard end-stop past `maxTilt`.
   *
   * Applied as a one-shot torque IMPULSE of torque·dt, not with addTorque.
   * Rapier's addForce/addTorque persist across steps until resetForces/
   * resetTorques is called — they are not per-frame. Calling addTorque every
   * frame therefore sums into a runaway: an earlier version of this did
   * exactly that and, instead of settling, spun the head faster the longer it
   * ran, at 45 rad/s after four seconds with damping that should have stopped
   * it dead.
   *
   * Note also that Rapier's inertia here is about the body's own centre
   * (0.4·m·r² ≈ 0.022), not the parallel-axis value about the pivot — size
   * `stiffness` against the former.
   *
   * @param {number} dt Fixed timestep, in seconds.
   */
  function applyNeckSpring(dt) {
    // Enforce the cone before reading the orientation, so every caller gets the
    // limit for free and nobody has to remember to ask for it.
    clampTilt()

    let { x, y, z, w } = body.rotation()

    // A quaternion and its negation are the same orientation. Without this the
    // controller picks the long way round past 180 degrees and the head spins.
    if (w < 0) {
      x = -x
      y = -y
      z = -z
      w = -w
    }

    const sinHalf = Math.hypot(x, y, z)
    let tx = 0
    let ty = 0
    let tz = 0

    if (sinHalf > 1e-6) {
      const angle = 2 * Math.atan2(sinHalf, w)

      // Linear spring toward upright, plus a progressive end-stop past maxTilt.
      // The stop is soft on purpose: it takes the speed off a big hit over the
      // last few degrees so the head eases into the limit rather than hitting a
      // wall. clampTilt() below is what actually guarantees the limit.
      let k = -stiffness * angle
      if (angle > maxTilt) k -= limitStiffness * (angle - maxTilt) ** 2

      k /= sinHalf
      tx = x * k
      ty = y * k
      tz = z * k
    }

    const av = body.angvel()
    body.applyTorqueImpulse(
      {
        x: (tx - damping * av.x) * dt,
        y: (ty - damping * av.y) * dt,
        z: (tz - damping * av.z) * dt,
      },
      true
    )
  }

  /**
   * Which part of the face is nearest a world-space point, and where exactly.
   *
   * WHY THIS EXISTS RATHER THAN TRUSTING THE COLLISION EVENT.
   *
   * The collider handle Rapier hands us with a CollisionEvent looks like the
   * answer and is not. Because the striker does not solve against the head,
   * there is no contact manifold to narrow the pair down, and `started` fires
   * with the broad phase's prediction margin still attached — measured at about
   * 15 mm here, enough that a spoon driven squarely into the right cheek also
   * reported the nose, the jaw and the skull, and reported the NOSE FIRST.
   * Picking impacts[0] then labelled a cheek shot "NOSE!".
   *
   * So Rapier is asked the question it can answer exactly — is the weapon
   * touching the head — and the geometry is resolved here, where it is a closed
   * form over eight primitives and costs nothing. That also yields a true contact
   * point and surface normal instead of a projection onto a nominal sphere.
   *
   * @param {{x,y,z}} p World-space point, normally the striker's centre.
   */
  function nearestRegion(p) {
    const c = body.translation()
    const q = body.rotation()
    const local = intoLocal({ x: p.x - c.x, y: p.y - c.y, z: p.z - c.z }, q)

    let best = null
    let bestD = Infinity
    for (const region of regions) {
      const hit = closestOn(region, local)
      if (hit.d < bestD) {
        bestD = hit.d
        best = { region, hit }
      }
    }
    if (!best) return null

    const { region, hit } = best
    const worldPoint = intoWorld({ x: hit.x, y: hit.y, z: hit.z }, q)
    const worldNormal = intoWorld({ x: hit.nx, y: hit.ny, z: hit.nz }, q)

    return {
      region,
      distance: bestD,
      localPoint: { x: hit.x, y: hit.y, z: hit.z },
      point: { x: c.x + worldPoint.x, y: c.y + worldPoint.y, z: c.z + worldPoint.z },
      normal: worldNormal,
    }
  }

  /**
   * Hard angular limit on the neck.
   *
   * A spherical joint has no limits, and a penalty spring cannot supply one
   * here: stopping a 13 N·s sledgehammer inside a few degrees needs a stiffness
   * around 20000, and at a 240 Hz timestep k·dt²/I is then ~17 — an explicit
   * integrator well past the point where it explodes. Measured with the soft
   * stop alone, a sledgehammer reached 144 degrees against a 72 degree limit, which
   * leaves the face pointing backwards out of the vise and reads as a bug
   * rather than as a hard hit.
   *
   * So the limit is enforced the way a joint limit actually works: clamp the
   * orientation into the cone and remove the angular velocity still driving
   * outward. Unconditionally stable at any impulse, because it is a projection
   * rather than a force. Velocity pointing back INTO the cone is untouched, so
   * the spring can still pull the head upright.
   */
  function clampTilt() {
    let { x, y, z, w } = body.rotation()
    if (w < 0) {
      x = -x
      y = -y
      z = -z
      w = -w
    }

    const sinHalf = Math.hypot(x, y, z)
    if (sinHalf < 1e-6) return

    const angle = 2 * Math.atan2(sinHalf, w)
    if (angle <= maxTilt) return

    // Same axis, angle clamped to the cone.
    const ax = x / sinHalf
    const ay = y / sinHalf
    const az = z / sinHalf
    const half = maxTilt * 0.5
    body.setRotation(
      { x: ax * Math.sin(half), y: ay * Math.sin(half), z: az * Math.sin(half), w: Math.cos(half) },
      true
    )

    // Strip the outward part of the spin. On the cone the rotation axis IS the
    // outward direction, so this is one dot product.
    const av = body.angvel()
    const outward = av.x * ax + av.y * ay + av.z * az
    if (outward > 0) {
      body.setAngvel(
        { x: av.x - outward * ax, y: av.y - outward * ay, z: av.z - outward * az },
        true
      )
    }
  }

  /**
   * Shortest-path angle from upright, in radians, always within [0, PI].
   * Taking asin of |xyz| instead wraps back down past 90 degrees, so a head
   * knocked to 150 degrees would report as 30 and look like it had recovered.
   */
  function tiltAngle() {
    const { x, y, z, w } = body.rotation()
    return 2 * Math.atan2(Math.min(Math.hypot(x, y, z), 1), Math.abs(w))
  }

  return {
    body,
    colliders,
    anchor,
    radius,
    neck,
    applyNeckSpring,
    clampTilt,
    nearestRegion,
    tiltAngle,
    /** Is this collider handle part of the head? */
    owns: (handle) => regionOf.has(handle),
    /** @returns {object|undefined} The region for a collider handle, if it is ours. */
    regionFor: (handle) => regionOf.get(handle),
    /** Kept for callers that only need one handle (the skull is the bulk). */
    handle: colliders[0].handle,
    position: () => body.translation(),
    rotation: () => body.rotation(),
  }
}
