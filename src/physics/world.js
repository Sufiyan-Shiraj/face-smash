// Rapier world, fixed-timestep stepping, and hitstop.
//
// Everything here is framework-agnostic. React Three Fiber drives it from a
// useFrame, the headless test drives it from a for-loop, and neither knows
// about the other.

import RAPIER from '@dimforge/rapier3d-compat'

export { RAPIER }

// 240 Hz, not 60. This is what actually stops a fast strike from skipping over
// the head between frames, and it is NOT what CCD does — see striker.js.
//
// A collider tunnels when one step carries it clear over the combined diameter
// of both shapes. The smallest weapon (a spoon, r=0.02) against the head
// (r=0.11) gives 0.26 m, which at 60 Hz is exceeded above just 15.6 m/s — well
// inside what an arm can do. At 240 Hz the same swing moves 0.10 m per step and
// cannot skip the head at any speed a human can produce.
//
// Measured cost with this scene: ~11 us/step, so 5 seconds of simulation costs
// 13 ms. The safety is effectively free.
const FIXED_DT = 1 / 240
// Cap on catch-up steps per frame. Without it, one long stall (a tab switch, a
// GC pause) makes the next frame try to simulate the whole gap and take even
// longer — the classic spiral of death. At 240 Hz a 60 fps frame needs 4.
const MAX_STEPS_PER_FRAME = 12

// RAPIER.init() MUST be called exactly once per page, and the compat build does
// not enforce that itself — it re-runs the wasm-bindgen initializer on every
// call, builds a SECOND wasm instance, and repoints the module-level binding
// that every Rapier object method goes through at the new one.
//
// That turns any overlapping pair of world creations into heap corruption:
//
//   1. world A is created; its pointer is an address inside wasm instance 1.
//   2. a second init() runs; the shared binding now refers to instance 2.
//   3. world A is freed. The free call goes through the NEW binding, so an
//      instance-1 address is handed to instance 2's allocator.
//   4. instance 2's heap — where the surviving world lives — is now corrupt.
//      Its bodies still read back plausible values, and the next step() traps
//      with a bare wasm "unreachable" and no JavaScript stack.
//
// React StrictMode mounts every effect twice in development, so this happened
// on every single load of the lab: the head's neck spring panicked on the first
// substep and the whole scene froze. Memoizing the promise is the entire fix —
// one instance, one binding, and free() then refers to the heap it came from.
let initPromise = null
function initRapier() {
  if (!initPromise) {
    initPromise = RAPIER.init().catch((err) => {
      // Don't cache a failure; a retry deserves a fresh attempt.
      initPromise = null
      throw err
    })
  }
  return initPromise
}

export async function createPhysicsWorld({ gravity = { x: 0, y: -9.81, z: 0 } } = {}) {
  // compat build embeds the wasm as base64, so this needs no bundler config
  // and works identically in Node and the browser.
  await initRapier()

  const world = new RAPIER.World(gravity)
  world.timestep = FIXED_DT
  // Impacts are the entire point of this simulation, so spend the iterations.
  world.numSolverIterations = 8

  // autoDrain:true clears the queue at the start of each world.step, which is
  // why every step below is followed immediately by a drain.
  const events = new RAPIER.EventQueue(true)

  let accumulator = 0
  let hitstopRemaining = 0
  let elapsed = 0

  // Collision events are buffered here during the drain and dispatched after
  // it returns. See the note in step(). Flat triples (h1, h2, started) in one
  // preallocated array, so the hot path allocates nothing.
  const pending = []

  /**
   * Freeze the simulation briefly. The single cheapest way to make an impact
   * feel like it has weight.
   * @param {number} seconds
   */
  function hitstop(seconds) {
    hitstopRemaining = Math.max(hitstopRemaining, seconds)
  }

  /**
   * @param {number} dt Wall-clock seconds since the last call.
   * @param {object} [handlers]
   * @param {(h1:number, h2:number, started:boolean) => void} [handlers.onCollision]
   *   Dispatched AFTER the drain completes, so it may call back into the world.
   * @param {(dt: number) => void} [handlers.beforeStep] Runs once per fixed step.
   * @param {(dt: number) => void} [handlers.afterStep] Runs once per fixed step,
   *   after the solver. Constraints that must hold in what the renderer sees go
   *   here — anything enforced only in beforeStep is a full step stale by the
   *   time the frame is drawn, which is long enough to show.
   * @returns {number} Number of fixed steps actually simulated.
   */
  function step(dt, { onCollision, beforeStep, afterStep } = {}) {
    if (hitstopRemaining > 0) {
      hitstopRemaining -= dt
      if (hitstopRemaining <= 0) {
        hitstopRemaining = 0
        // Discard the frozen time instead of banking it. Otherwise the moment
        // the freeze releases, the accumulator is holding 80ms of debt and the
        // solver burns through five steps at once — the head lurches, and the
        // hitstop that was supposed to add impact instead reads as a glitch.
        accumulator = 0
      }
      return 0
    }

    // Clamp so a backgrounded tab doesn't hand us a multi-second dt.
    accumulator += Math.min(dt, 0.1)

    let steps = 0
    while (accumulator >= FIXED_DT && steps < MAX_STEPS_PER_FRAME) {
      beforeStep?.(FIXED_DT)
      world.step(events)

      // Collision events, not contact-force events. The striker does not solve
      // against the head (see head.js / striker.js on solver groups), so there
      // is no contact force to report — the momentum comes from impact.js
      // instead. What Rapier still provides, and all we need from it, is the
      // moment two specific colliders begin to overlap.
      //
      // DRAIN FIRST, DISPATCH AFTER. The obvious spelling — passing the handler
      // straight to drainCollisionEvents — calls user code while the wasm side
      // still holds a mutable borrow of the event queue. Our handler then reads
      // body transforms and applies impulses, which are calls back INTO that
      // borrow, and wasm-bindgen aborts the frame with "recursive use of an
      // object detected which would lead to unsafe aliasing in rust". It throws
      // from inside the render loop, so the scene simply stops with no React
      // error and nothing in the stack pointing at the handler.
      //
      // Buffering the triples costs one array write per event and makes the
      // handler free to touch the world however it likes.
      if (onCollision) {
        events.drainCollisionEvents((h1, h2, started) => {
          pending.push(h1, h2, started)
        })
        for (let i = 0; i < pending.length; i += 3) {
          onCollision(pending[i], pending[i + 1], pending[i + 2])
        }
        pending.length = 0
      }

      afterStep?.(FIXED_DT)
      accumulator -= FIXED_DT
      elapsed += FIXED_DT
      steps++
    }

    // Ran out of step budget — drop the backlog rather than accruing it.
    if (steps === MAX_STEPS_PER_FRAME) accumulator = 0

    return steps
  }

  let destroyed = false
  function destroy() {
    // Idempotent. Freeing twice corrupts the allocator in exactly the same way
    // as the init bug above, and the second call is easy to reach: an unmount
    // that races the async creation can run cleanup on a world that already
    // tore itself down.
    if (destroyed) return
    destroyed = true
    events.free()
    world.free()
  }

  return {
    world,
    events,
    step,
    hitstop,
    destroy,
    get elapsed() {
      return elapsed
    },
    get isFrozen() {
      return hitstopRemaining > 0
    },
    FIXED_DT,
  }
}
