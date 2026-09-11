// Collision events → one impact record, and the momentum that moves the head.
//
// This is the seam the whole game hangs off. Rapier decides IF, WHEN and WHICH
// PART OF THE FACE; this file decides how hard, and applies the weapon's actual
// momentum at the actual contact point. Damage, integrity, hitstop, shake, the
// squash shader, the SMACK variant and the sound all read the one record it
// produces — nothing downstream invents its own strength.
//
// WHY THE HEAD IS MOVED FROM HERE RATHER THAN BY THE SOLVER
//
// The striker is kinematic and does not solve against the head (striker.js
// explains the measurements). So the contact carries no force of its own, and
// the head's response is exactly J = m·v applied at the contact point:
//
//   - m is the weapon's real mass, compressed by heftOf() so the 200x span from
//     spoon to sledgehammer lands in a range a neck can survive;
//   - v is the striker's measured velocity, the same vector the tracking layer
//     produced, not a gesture classifier's opinion;
//   - the point is where the two colliders actually met, so the torque is
//     r × J and a jaw shot turns the head where a forehead shot shoves it. That
//     falls out of the geometry instead of being special-cased.
//
// Two things must both be true or drainCollisionEvents never fires, and neither
// raises an error when it isn't:
//   - the event queue is passed to world.step(eventQueue)
//   - a collider in the pair has ActiveEvents.COLLISION_EVENTS

/** Rotate a world-space vector into a body's local frame (conjugate rotation). */
function toLocal(v, q) {
  const { x, y, z, w } = q
  // v' = q* · v · q, expanded.
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

/**
 * @param {object} opts
 * @param {() => number} opts.strikerHandle  Collider handle of the striker.
 * @param {object} opts.head                 From createHead().
 * @param {() => {x,y,z}} opts.strikerPosition
 * @param {() => {x,y,z}} opts.strikerVelocity Full velocity vector, m/s.
 * @param {() => object} [opts.weapon]       Current weapon, for heft/spin/chaos.
 * @param {number} [opts.maxSpeed]           Speed that maps to strength 1.0.
 * @param {number} [opts.minSpeed]           Below this, contact is not a hit.
 * @param {number} [opts.impulseGain]        N·s per (heft × m/s).
 * @param {number} [opts.suppressMs]         Debounce window after a reported hit.
 * @param {() => number} [opts.now]          Injectable clock, for the headless sim.
 * @param {(impact: object) => void} opts.onImpact
 */
export function createImpactRouter({
  strikerHandle,
  strikers,
  head,
  strikerPosition,
  strikerVelocity,
  weapon = () => null,
  maxSpeed = 12,
  minSpeed = 1.2,
  impulseGain = 0.9,
  suppressMs = 150,
  now = () => performance.now(),
  onImpact,
}) {
  const lastReportedAtByHand = new Map()
  let peakSeen = 0

  /**
   * Pass this straight to the world step's onCollision.
   *
   * @param {number} h1 Collider handle.
   * @param {number} h2 Collider handle.
   * @param {boolean} started True on overlap begin, false on end.
   */
  function handle(h1, h2, started) {
    // Only the leading edge. A collision that is ENDING is the weapon leaving,
    // which is not a second hit — and firing on both is how one slap used to
    // score twice.
    if (!started) return

    let matchingStriker = null
    if (strikers && strikers.length > 0) {
      for (const s of strikers) {
        const sh = typeof s.handle === 'function' ? s.handle() : s.handle
        if (h1 === sh || h2 === sh) {
          matchingStriker = s
          break
        }
      }
    } else if (strikerHandle) {
      const sh = typeof strikerHandle === 'function' ? strikerHandle() : strikerHandle
      if (h1 === sh || h2 === sh) {
        matchingStriker = {
          handle: strikerHandle,
          position: strikerPosition,
          velocity: strikerVelocity,
          id: 'primary',
        }
      }
    }

    if (!matchingStriker) return
    const sh = typeof matchingStriker.handle === 'function' ? matchingStriker.handle() : matchingStriker.handle
    if (!head.owns(h1 === sh ? h2 : h1)) return

    const sp = matchingStriker.position()

    // Rapier is asked only the question it can answer exactly here — is the
    // weapon touching the head — and the geometry is resolved from the shapes.
    const contact = head.nearestRegion(sp)
    if (!contact) return

    const { region } = contact
    const world = contact.point
    // Outward surface normal at the contact — points from the face toward the
    // weapon. Everything below is measured against this. Taken from the region
    // that was actually hit, so a clip off the nose skids where a square hit on
    // the cheek does not — that is the whole reason for a compound hitbox.
    const nx = contact.normal.x
    const ny = contact.normal.y
    const nz = contact.normal.z

    // --- How hard, honestly -------------------------------------------------
    //
    // Raw striker speed was the old answer and it is wrong in both directions:
    // a hand resting on the cheek and drifting at 0.3 m/s reported a hit every
    // 150 ms forever, and a swing that merely passed nearby scored the same as
    // one that connected square. Speed alone cannot tell contact from traffic.
    //
    // Split the velocity against the contact normal instead:
    //
    //   APPROACH is the part driving into the face. A punch is nearly all
    //   approach. This is the component that should dominate.
    //
    //   TANGENT is the part skidding across it. A slap is nearly all tangent,
    //   and a slap is obviously a hit — but only because a palm GRIPS. Friction
    //   is exactly the coefficient for how much of a skid becomes force, so
    //   weight the tangential term by it rather than by a magic number. A 0.9
    //   friction palm keeps most of its sweep; a 0.4 friction banana slides off
    //   and deserves to.
    const v = matchingStriker.velocity()
    const vn = v.x * nx + v.y * ny + v.z * nz
    const approach = Math.max(0, -vn) // negative dot = moving inward
    const tx = v.x - vn * nx
    const ty = v.y - vn * ny
    const tz = v.z - vn * nz
    const tangent = Math.hypot(tx, ty, tz)

    const w = weapon()
    const grip = (w?.friction ?? 0.8) * 0.62
    const speed = Math.hypot(approach, tangent * grip)

    // Below the floor this is contact, not a strike: a hand at rest, a head
    // settling back against a stationary palm, a follow-through already scored.
    if (speed < minSpeed) return

    // One swing sweeps through several face colliders — nose, then cheek, then
    // skull — and each is its own collision event. Report the first and
    // suppress the rest per hand: firing on the leading edge keeps the response
    // immediate, and the player threw one punch, not three.
    const t = now()
    const strikerId = matchingStriker.id ?? 'primary'
    const lastAt = lastReportedAtByHand.get(strikerId) ?? -Infinity
    if (t - lastAt < suppressMs) return
    lastReportedAtByHand.set(strikerId, t)

    const span = Math.max(maxSpeed - minSpeed, 1e-3)
    const strength = Math.min((speed - minSpeed) / span, 1) ** 0.8

    // --- Momentum -----------------------------------------------------------
    let impulse = null
    if (w) {
      const heft = w.heft ?? 1

      // Direction is the WEAPON'S TRAVEL, not the contact normal.
      //
      // This is subtle and it silently cost the whole feature once. A normal-
      // directed impulse on a roughly spherical head points straight at the
      // centre of mass, so r × J is ~zero, the spherical joint eats the linear
      // part, and NOTHING HAPPENS — measured: 790 N·s of impulse moved the head
      // by 0.1 degrees. Momentum travels along the direction the weapon is
      // actually going, and applying it that way is both the real physics and
      // the thing that produces torque.
      const vlen = Math.hypot(v.x, v.y, v.z) || 1
      let jx = v.x / vlen
      let jy = v.y / vlen
      let jz = v.z / vlen

      if (w.chaos) {
        // Not "a bigger number" — an actually unpredictable direction. Blend a
        // random unit vector into the travel direction so the head goes
        // somewhere nobody planned, including us.
        const rx = Math.random() * 2 - 1
        const ry = Math.random() * 2 - 1
        const rz = Math.random() * 2 - 1
        const rl = Math.hypot(rx, ry, rz) || 1
        jx += (rx / rl) * w.chaos
        jy += (ry / rl) * w.chaos
        jz += (rz / rl) * w.chaos
        const jl = Math.hypot(jx, jy, jz) || 1
        jx /= jl
        jy /= jl
        jz /= jl
      }

      const mag = heft * speed * impulseGain
      impulse = { x: jx * mag, y: jy * mag, z: jz * mag }
      head.body.applyImpulseAtPoint(impulse, world, true)

      if (w.spin) {
        // Torque about the contact normal: the weapon grips and twists rather
        // than shoving. This is the whole point of that weapon, so it is
        // explicit rather than left to friction to produce as a side effect.
        const spin = w.spin * strength * (w.chaos ? Math.sign(Math.random() - 0.5) || 1 : 1)
        head.body.applyTorqueImpulse({ x: nx * spin, y: ny * spin, z: nz * spin }, true)
      }
    }

    const momentum = impulse ? Math.hypot(impulse.x, impulse.y, impulse.z) : 0
    if (momentum > peakSeen) peakSeen = momentum

    // The squash shader displaces vertices in the mesh's own frame, so both the
    // point and the direction of the blow have to follow the head as it
    // rotates. nearestRegion already converted the point on the way in.
    const local = contact.localPoint
    const q = head.rotation()
    const vlen0 = Math.hypot(v.x, v.y, v.z) || 1
    const localTravel = toLocal({ x: v.x / vlen0, y: v.y / vlen0, z: v.z / vlen0 }, q)
    const localNormal = toLocal({ x: -nx, y: -ny, z: -nz }, q)

    onImpact({
      speed,
      approach,
      tangent,
      strength,
      /** Real delivered momentum, N·s. Replaces the old penetration force. */
      momentum,
      region: region.id,
      regionLabel: region.label,
      regionDamage: region.damage,
      // Unit vector pointing INTO the head along the contact normal — the
      // direction the dent, the particle cone and the camera shake all follow.
      normal: { x: -nx, y: -ny, z: -nz },
      /** Unit vector along the weapon's travel. Particles spray this way. */
      travel: { x: v.x, y: v.y, z: v.z },
      impulse,
      point: world,
      localPoint: local,
      localTravel,
      localNormal,
      hand: matchingStriker.id ?? 'primary',
      t,
    })
  }

  return {
    handle,
    get peakMomentum() {
      return peakSeen
    },
    resetPeak() {
      peakSeen = 0
    },
  }
}
