// The striker: a kinematic collider that follows the player's hand.
//
// This body is what actually touches the head. Three details decide whether a
// hit lands at all, and each was measured rather than assumed — see
// scripts/physics-sim.mjs.
//
//  1. CCD DOES NOT SAVE A KINEMATIC BODY. This is the opposite of the usual
//     advice and it cost us a wrong assumption. Measured: a spoon-sized striker
//     swept through the head at 25 m/s with sample positions straddling it
//     produced ZERO contact events — with CCD on, with CCD on both bodies, and
//     with CCD off. All identical. The same sweep with a DYNAMIC striker
//     produced 2 events with CCD and 0 without. Rapier's CCD sweeps dynamic
//     bodies; a kinematic body is user-positioned and simply teleports between
//     the frames you give it.
//
//     What actually prevents tunneling here is the 240 Hz timestep in world.js
//     plus advance() below, which walks this body across every substep instead
//     of jumping it once per frame.
//
//     CCD is therefore OFF. It was left on for a while on the grounds that it
//     was free and correct in principle. It is neither. Enabling it inflates
//     this body's broad-phase AABB along its sweep, and because the striker
//     deliberately does not solve against the head (see the group note below)
//     there is no contact manifold to narrow that back down — so Rapier reports
//     a collision as STARTED for every face collider the weapon merely passes
//     NEAR. Measured: a spoon driven at the right cheek reported the nose, the
//     jaw and the skull as well, and reported the nose FIRST, which is how a
//     cheek shot came out labelled NOSE. With CCD off, the same swing reports
//     the cheek, because the cheek is what it hit.
//
//  2. setNextKinematicTranslation, never setTranslation. Rapier derives a
//     kinematic body's velocity from where you tell it to be NEXT. Teleporting
//     it with setTranslation means it arrives with zero velocity and the
//     contact resolves with almost nothing behind it. Measured: 185 kN via the
//     correct setter versus 25 kN via setTranslation, for the same swing.
//
//  3. Because velocity is derived from position deltas, any discontinuity in
//     this body's path is indistinguishable from an infinitely fast swing.
//     Every jump has to be either blended or performed as an explicit teleport
//     that resets tracking — see reacquire() below.
//
//  4. THE COLLIDER IS THE WEAPON'S HEAD, NOT THE HAND. Everything below tracks
//     two points: the GRIP, which is where the player's hand actually is, and
//     the HEAD, which hangs off it on a rod of length `reach` and is simulated.
//     The collider rides the head. See swing() — that lag is where a swing gets
//     its weight, and gluing the collider to the hand is why the old build felt
//     like sliding a sticker around rather than swinging something.
//
//  5. ORIENTATION MATTERS ONCE THE SHAPE IS NOT A BALL. A pan left at
//     identity rotation swings edge-on or corner-first depending on nothing at
//     all, and contacts a face-sized flat with a 4 cm edge. face() below turns
//     the collider to lead with its +z face along the direction of travel, so
//     the pan hits flat, the palm hits palm-first, and the banana stays
//     broadside. Rotation is set with setNextKinematicRotation for the same
//     reason position uses the Next setter — the solver derives angular
//     velocity from it, and that is what makes a spinning weapon grip.

import { RAPIER } from './world.js'

const REACQUIRE_BLEND = 0.08 // seconds to ease back after a tracking dropout

// Group 2, detected by the head (group 1) but solved against NOTHING.
//
// THE STRIKER MUST NOT PUSH. This is the single decision that made every other
// number in the rig mean something, and it took measuring to see why. A
// kinematic body has infinite mass, so when the solver resolves its penetration
// with the head it does so with whatever force that takes — measured at 100 to
// 500 kN, which is ~2000 N·s of impulse per substep. That figure is not a hit;
// it is an artifact of how deep the collider happened to be when the step ran.
// It swamped the neck spring, blew through the tilt end-stop (a slap reached
// 104 degrees against a 72 degree limit), and buried every difference between
// weapons under noise: the same probe gave a 6 kg sledgehammer 5 degrees and an
// open palm 61, with the ordering changing if the contact stiffness moved.
//
// So the hand does not shove the head. It is DETECTED against it — Rapier's
// narrow phase still decides if, when and which face collider — and the head is
// moved by the momentum the weapon actually carries, m·v applied at the contact
// point in impact.js. That is the real physics of a strike, where penetration
// ejection never was.
//
// It is also the truthful model of this game: the striker tracks the player's
// real hand, and a real hand does not stop because something in a browser says
// it should.
const STRIKER_GROUP = 0x00020001
const STRIKER_SOLVER = 0x00020000

export function createStriker(
  { world },
  { radius = 0.08, contactForceThreshold = 1, restitution = 0.3, friction = 0.8, parkAt = { x: 0, y: -50, z: 0 } } = {}
) {
  let material = { restitution, friction }
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(parkAt.x, parkAt.y, parkAt.z)
  )
  // See the note above: CCD on a non-solving kinematic body buys no tunneling
  // protection and costs contact precision.
  body.enableCcd(false)

  let collider = world.createCollider(
    dressed(RAPIER.ColliderDesc.ball(radius), restitution, friction),
    body
  )

  /**
   * Everything a striker collider needs regardless of shape.
   *
   * The event flag goes on the STRIKER, not the head: an event fires if either
   * collider in the pair carries it, so this way striker-vs-head reports and
   * head-vs-anything-else stays silent.
   */
  function dressed(desc, r, f) {
    return desc
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS)
      .setContactForceEventThreshold(contactForceThreshold)
      .setRestitution(r)
      .setFriction(f)
      .setCollisionGroups(STRIKER_GROUP)
      .setSolverGroups(STRIKER_SOLVER)
  }

  // GRIP — the player's hand, interpolated across the frame.
  const pos = { x: parkAt.x, y: parkAt.y, z: parkAt.z }
  const vel = { x: 0, y: 0, z: 0 }

  // HEAD — the business end, on a rod of length `reach` from the grip.
  // Integrated with Verlet (position + previous position rather than an
  // explicit velocity) because the rod is enforced as a hard positional
  // constraint, and Verlet turns that projection back into velocity for free:
  // shortening the rod IS the whip. An explicit-velocity integrator would need
  // the constraint impulse worked out by hand and would lose energy every step.
  const head = { x: parkAt.x, y: parkAt.y, z: parkAt.z }
  const headPrev = { x: parkAt.x, y: parkAt.y, z: parkAt.z }
  const headVel = { x: 0, y: 0, z: 0 }
  let reach = 0
  let swingDamp = 0.9
  // Orientation the collider is turned to. See face().
  const quat = { x: 0, y: 0, z: 0, w: 1 }
  let spinAngle = 0
  let spinRate = 0
  // Interpolation span for the current frame. aim() sets it once per rendered
  // frame; advance() walks across it once per physics substep.
  const from = { x: parkAt.x, y: parkAt.y, z: parkAt.z }
  const to = { x: parkAt.x, y: parkAt.y, z: parkAt.z }
  let frameDt = 1 / 60
  let frameElapsed = 0
  let tracking = false
  let blendRemaining = 0
  let ghostElapsed = 0

  /** Hang the head straight down from the grip, at rest. */
  function restHead() {
    head.x = headPrev.x = pos.x
    head.y = headPrev.y = pos.y - reach
    head.z = headPrev.z = pos.z
    headVel.x = headVel.y = headVel.z = 0
  }

  /** Snap without deriving velocity. The one legitimate use of setTranslation. */
  function reacquire(p) {
    pos.x = from.x = to.x = p.x
    pos.y = from.y = to.y = p.y
    pos.z = from.z = to.z = p.z
    vel.x = vel.y = vel.z = 0
    frameElapsed = 0
    restHead()
    body.setTranslation(head, true)
    tracking = true
    ghostElapsed = 0
    blendRemaining = 0
  }

  function park() {
    tracking = false
    ghostElapsed = 0
    vel.x = vel.y = vel.z = 0
    pos.x = from.x = to.x = parkAt.x
    pos.y = from.y = to.y = parkAt.y
    pos.z = from.z = to.z = parkAt.z
    frameElapsed = 0
    restHead()
    body.setTranslation(head, true)
  }

  /**
   * Set this frame's destination. Call once per rendered frame, then call
   * advance() once per physics substep.
   *
   * @param {object} frame
   * @param {{x,y,z}|null} frame.observed Hand position in world space, or null
   *   when tracking has dropped out.
   * @param {number} frame.dt Seconds since the previous aim().
   * @param {number} [frame.ghostLimit] Max seconds to dead-reckon before parking.
   * @returns {{ mode: 'idle'|'tracking'|'ghost'|'blending', speed: number }}
   */
  function aim({ observed, dt, ghostLimit = 0.4 }) {
    if (dt <= 0) return { mode: tracking ? 'tracking' : 'idle', speed: speed() }

    frameDt = dt
    frameElapsed = 0
    from.x = pos.x
    from.y = pos.y
    from.z = pos.z

    if (observed) {
      if (!tracking) {
        // First sighting after being parked: teleport in rather than sweeping
        // across the room, which would be read as a colossal swing.
        reacquire(observed)
        return { mode: 'tracking', speed: 0 }
      }

      let target = observed

      if (blendRemaining > 0) {
        // We were dead-reckoning and guessed slightly wrong. Snapping to the
        // truth would derive a huge velocity from the correction and fabricate
        // a hit out of nothing, so ease across instead.
        const t = 1 - blendRemaining / REACQUIRE_BLEND
        const k = t * t * (3 - 2 * t) // smoothstep
        target = {
          x: pos.x + (observed.x - pos.x) * k,
          y: pos.y + (observed.y - pos.y) * k,
          z: pos.z + (observed.z - pos.z) * k,
        }
        blendRemaining = Math.max(0, blendRemaining - dt)
      }

      to.x = target.x
      to.y = target.y
      to.z = target.z
      ghostElapsed = 0
    } else {
      // --- No observation. Almost always motion blur, mid-swing. ---
      if (!tracking) return { mode: 'idle', speed: 0 }

      ghostElapsed += dt
      if (ghostElapsed > ghostLimit) {
        park()
        return { mode: 'idle', speed: 0 }
      }

      // Dead reckoning. The landmarker lost the hand, but the hand is still
      // moving, and the swing it was in the middle of is exactly the one the
      // player cares about. Keep sweeping the collider along its last known
      // velocity, and the contact happens FOR REAL — right place, right force —
      // despite the hand being invisible. This is why damage is something the
      // physics measures rather than something a gesture classifier reports.
      to.x = pos.x + vel.x * dt
      to.y = pos.y + vel.y * dt
      to.z = pos.z + vel.z * dt

      // Bleed off speed so a dropout at the top of a swing doesn't launch the
      // collider across the scene at constant velocity.
      const decay = Math.pow(0.94, dt * 60)
      vel.x *= decay
      vel.y *= decay
      vel.z *= decay

      blendRemaining = REACQUIRE_BLEND
      return { mode: 'ghost', speed: speed() }
    }

    vel.x = (to.x - from.x) / dt
    vel.y = (to.y - from.y) / dt
    vel.z = (to.z - from.z) / dt
    // Orientation is NOT set here. It depends on the head's velocity, and the
    // head has not moved yet this frame — swing() does that, per substep.
    return { mode: blendRemaining > 0 ? 'blending' : 'tracking', speed: speed() }
  }

  /**
   * Walk the striker one physics substep along this frame's span.
   *
   * Moving the whole frame's distance in a single jump is exactly how a fast
   * strike steps clear over the head and registers nothing, and CCD does not
   * rescue a kinematic body from it. Interpolating across the substeps is what
   * makes the contact happen.
   *
   * @param {number} dt Physics substep, in seconds.
   */
  function advance(dt) {
    if (!tracking) return
    frameElapsed += dt
    const t = frameDt > 0 ? Math.min(frameElapsed / frameDt, 1) : 1
    pos.x = from.x + (to.x - from.x) * t
    pos.y = from.y + (to.y - from.y) * t
    pos.z = from.z + (to.z - from.z) * t

    swing(dt)

    body.setNextKinematicTranslation(head)

    if (spinRate !== 0) {
      spinAngle += spinRate * dt
      body.setNextKinematicRotation(spun())
    } else {
      body.setNextKinematicRotation(quat)
    }
  }

  /**
   * Advance the weapon head one substep and re-hang it off the grip.
   *
   * Verlet plus one distance constraint, which is the whole pendulum:
   *
   *   1. carry the head forward by the step it just took, scaled by damping;
   *   2. add gravity;
   *   3. snap it back onto the sphere of radius `reach` around the grip.
   *
   * Step 3 is the interesting one. When the hand yanks the grip sideways the
   * head is left behind, and the snap that restores the rod length converts
   * that lag into motion ALONG the arc — the head accelerates without anything
   * pushing it, exactly the way a real weapon whips through the end of a swing.
   * Nothing here is keyframed and there is no "swing animation": the arc, the
   * trailing, the overshoot and the settle are all this one constraint.
   *
   * `reach: 0` short-circuits to the hand's own position, which is what a bare
   * palm or fist should do.
   */
  function swing(dt) {
    if (reach <= 0) {
      headVel.x = vel.x
      headVel.y = vel.y
      headVel.z = vel.z
      head.x = headPrev.x = pos.x
      head.y = headPrev.y = pos.y
      head.z = headPrev.z = pos.z
      face()
      return
    }

    // swingDamp is quoted per 60 Hz frame so the weapon table reads in units a
    // human can reason about; the solver runs at 240. Without this conversion
    // a 0.96 "keeps most of its energy" becomes 0.96^240 per second, which is
    // total annihilation, and every weapon feels identically dead.
    const damp = Math.pow(swingDamp, dt * 60)

    const dx = (head.x - headPrev.x) * damp
    const dy = (head.y - headPrev.y) * damp
    const dz = (head.z - headPrev.z) * damp

    headPrev.x = head.x
    headPrev.y = head.y
    headPrev.z = head.z

    head.x += dx
    head.y += dy - 9.81 * dt * dt
    head.z += dz

    // Rod constraint: the head may go anywhere on the sphere of radius `reach`
    // centred on the grip, and nowhere else.
    let rx = head.x - pos.x
    let ry = head.y - pos.y
    let rz = head.z - pos.z
    let len = Math.hypot(rx, ry, rz)
    if (len < 1e-6) {
      // Degenerate: the head is exactly on the grip and there is no rod
      // direction to preserve. Drop it straight down rather than dividing by
      // zero and sending a NaN into the solver.
      rx = 0
      ry = -1
      rz = 0
      len = 1
    }
    const k = reach / len
    head.x = pos.x + rx * k
    head.y = pos.y + ry * k
    head.z = pos.z + rz * k

    // Velocity AFTER the constraint, so it includes the whip rather than just
    // the free-flight part. This is the number impact.js turns into momentum,
    // so a long weapon hitting harder than the hand that swung it is measured
    // here rather than asserted anywhere.
    const inv = dt > 0 ? 1 / dt : 0
    headVel.x = (head.x - headPrev.x) * inv
    headVel.y = (head.y - headPrev.y) * inv
    headVel.z = (head.z - headPrev.z) * inv

    face()
  }

  /**
   * Orient the collider, and with it the mesh that is drawn on top of it.
   *
   * TWO FRAMES, because there are two kinds of weapon.
   *
   * A weapon ON A ROD has its direction decided by the rod: local -Y must point
   * back at the grip, or the handle detaches from the hand holding it. That
   * leaves one degree of freedom — the roll about the rod — and that is spent
   * pointing the face of the weapon along the swing, so the pan hits with the
   * pan and the bat with the barrel.
   *
   * A BARE HAND has no rod, so it uses the older frame: +z leads along the
   * swing, +y stays as upright as it can.
   *
   * The degenerate cases are real and common, and the failure mode is not a
   * visual glitch — a basis that collapses produces a NON-UNIT quaternion, and
   * Rapier does not reject one of those, it traps. That cost a wasm
   * "unreachable" on every horizontal swing once, with a blank canvas and no
   * JavaScript stack to explain it. Hence the fallbacks and the final
   * normalize-or-bail.
   */
  function face() {
    let ax, ay, az // local +X
    let bx, by, bz // local +Y
    let cx, cy, cz // local +Z

    if (reach > 0) {
      // +Y runs from the grip out to the head, so -Y points back up the handle.
      bx = head.x - pos.x
      by = head.y - pos.y
      bz = head.z - pos.z
      const bl = Math.hypot(bx, by, bz)
      if (bl < 1e-6) return
      bx /= bl
      by /= bl
      bz /= bl

      // Spend the remaining roll on the direction of travel, projected off the
      // rod. Below a threshold the head is basically hanging still and that
      // direction is pure noise, so keep the roll we already had.
      let tx = headVel.x
      let ty = headVel.y
      let tz = headVel.z
      const dot = tx * bx + ty * by + tz * bz
      tx -= dot * bx
      ty -= dot * by
      tz -= dot * bz
      let tl = Math.hypot(tx, ty, tz)
      if (tl < 0.25) {
        // Any axis perpendicular to the rod will do. Cross the rod with
        // whichever world axis it is LEAST aligned with, which cannot come out
        // near zero for any rod direction.
        const abx = Math.abs(bx)
        const aby = Math.abs(by)
        const abz = Math.abs(bz)
        let px = 0
        let py = 0
        let pz = 0
        if (abx <= aby && abx <= abz) px = 1
        else if (aby <= abz) py = 1
        else pz = 1
        tx = py * bz - pz * by
        ty = pz * bx - px * bz
        tz = px * by - py * bx
        tl = Math.hypot(tx, ty, tz) || 1
      }
      cx = tx / tl
      cy = ty / tl
      cz = tz / tl

      // X = Y x Z closes a right-handed frame.
      ax = by * cz - bz * cy
      ay = bz * cx - bx * cz
      az = bx * cy - by * cx
    } else {
      const sp = Math.hypot(vel.x, vel.y, vel.z)
      if (sp < 0.25) {
        // When stationary or moving slowly, naturally point forward toward the target head
        let tx = 0 - pos.x
        let ty = 1.31 - pos.y
        let tz = 0 - pos.z
        let tl = Math.hypot(tx, ty, tz)
        if (tl < 1e-4) {
          tx = 0
          ty = 0
          tz = -1
          tl = 1
        }
        cx = tx / tl
        cy = ty / tl
        cz = tz / tl
      } else {
        // When moving, blend target direction with swing direction for natural punch follow-through
        const blend = Math.min((sp - 0.25) / 1.5, 0.7)
        let hx = 0 - pos.x
        let hy = 1.31 - pos.y
        let hz = 0 - pos.z
        let hl = Math.hypot(hx, hy, hz) || 1
        let tx = (hx / hl) * (1 - blend) + (vel.x / sp) * blend
        let ty = (hy / hl) * (1 - blend) + (vel.y / sp) * blend
        let tz = (hz / hl) * (1 - blend) + (vel.z / sp) * blend
        let tl = Math.hypot(tx, ty, tz) || 1
        cx = tx / tl
        cy = ty / tl
        cz = tz / tl
      }

      // right = worldUp x forward
      ax = cz
      ay = 0
      az = -cx
      let al = Math.hypot(ax, ay, az)
      if (al < 1e-5) {
        ax = 1
        ay = 0
        az = 0
        al = 1
      }
      ax /= al
      ay /= al
      az /= al

      bx = cy * az - cz * ay
      by = cz * ax - cx * az
      bz = cx * ay - cy * ax
    }

    // Rotation matrix [X Y Z] as columns → quaternion, branching on the largest
    // diagonal term. The naive single-branch formula divides by ~0 for a
    // quarter of all orientations, which is another route to a quaternion the
    // solver will not accept.
    const m00 = ax, m01 = bx, m02 = cx
    const m10 = ay, m11 = by, m12 = cy
    const m20 = az, m21 = bz, m22 = cz
    const trace = m00 + m11 + m22

    let qx, qy, qz, qw
    if (trace > 0) {
      const k = Math.sqrt(trace + 1) * 2
      qw = 0.25 * k
      qx = (m21 - m12) / k
      qy = (m02 - m20) / k
      qz = (m10 - m01) / k
    } else if (m00 > m11 && m00 > m22) {
      const k = Math.sqrt(1 + m00 - m11 - m22) * 2
      qw = (m21 - m12) / k
      qx = 0.25 * k
      qy = (m01 + m10) / k
      qz = (m02 + m20) / k
    } else if (m11 > m22) {
      const k = Math.sqrt(1 + m11 - m00 - m22) * 2
      qw = (m02 - m20) / k
      qx = (m01 + m10) / k
      qy = 0.25 * k
      qz = (m12 + m21) / k
    } else {
      const k = Math.sqrt(1 + m22 - m00 - m11) * 2
      qw = (m10 - m01) / k
      qx = (m02 + m20) / k
      qy = (m12 + m21) / k
      qz = 0.25 * k
    }

    const n = Math.hypot(qx, qy, qz, qw)
    if (!Number.isFinite(n) || n < 1e-6) return
    quat.x = qx / n
    quat.y = qy / n
    quat.z = qz / n
    quat.w = qw / n
  }

  /** `quat` pre-multiplied by a roll about its own +z, for spinning weapons. */
  function spun() {
    const h = spinAngle * 0.5
    const s2 = Math.sin(h)
    const c = Math.cos(h)
    // quat * (0,0,s2,c). Both operands are unit, so the product is too, but
    // renormalize anyway — spinAngle grows without bound and float drift over a
    // long run is exactly the kind of thing that traps the solver much later.
    const x = quat.x * c + quat.y * s2
    const y = quat.y * c - quat.x * s2
    const z = quat.z * c + quat.w * s2
    const w = quat.w * c - quat.z * s2
    const n = Math.hypot(x, y, z, w) || 1
    return { x: x / n, y: y / n, z: z / n, w: w / n }
  }

  /** Head speed — the number that decides how hard a hit lands. */
  function speed() {
    return Math.hypot(headVel.x, headVel.y, headVel.z)
  }

  /**
   * Swap the collider shape when the player changes weapon.
   *
   * Rebuilding the COLLIDER is cheap and leaves the body, its position, its
   * velocity history and the head's state untouched. Rebuilding the WORLD is
   * what the game used to do on every weapon change, which reset the head
   * mid-run and briefly dropped the striker's tracking.
   *
   * @param {import('@dimforge/rapier3d-compat').ColliderDesc} desc
   * @param {object} [opts]
   * @param {number} [opts.restitution]
   * @param {number} [opts.friction]
   * @param {number} [opts.reach] Grip-to-head rod length, metres. 0 glues the
   *   collider to the hand, which is what a bare palm or fist wants.
   * @param {number} [opts.swingDamp] Fraction of the head's velocity kept per
   *   60 Hz frame. Higher swings longer.
   * @param {number} [opts.spinRate] rad/s of roll about the weapon's own axis.
   */
  function setShape(desc, opts = {}) {
    const {
      threshold = contactForceThreshold,
      restitution: r = material.restitution,
      friction: f = material.friction,
      reach: rc = 0,
      swingDamp: sd = 0.9,
      spinRate: sr = 0,
    } = opts

    material = { restitution: r, friction: f }
    spinRate = sr
    swingDamp = sd

    // Changing reach moves the head, and a head that teleports across the
    // scene would be read as an infinitely fast swing. Re-hang it instead.
    if (rc !== reach) {
      reach = rc
      restHead()
      body.setTranslation(head, true)
    }

    world.removeCollider(collider, false)
    collider = world.createCollider(dressed(desc, r, f).setContactForceEventThreshold(threshold), body)
    return collider
  }

  return {
    body,
    get collider() {
      return collider
    },
    get handle() {
      return collider.handle
    },
    aim,
    advance,
    reacquire,
    park,
    setShape,
    speed,
    /** The striking head — where the collider is, and what hits the face. */
    position: () => ({ ...head }),
    velocity: () => ({ ...headVel }),
    /** The hand. The trail and the handle follow this, not the head. */
    grip: () => ({ ...pos }),
    gripVelocity: () => ({ ...vel }),
    get reach() {
      return reach
    },
    /** Current orientation, including spin roll — the render mesh copies this. */
    rotation: () => (spinRate !== 0 ? spun() : { ...quat }),
    get tracking() {
      return tracking
    },
  }
}
