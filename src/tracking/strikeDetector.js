// Strike detection.
//
// A slap is a TRAJECTORY, not a pose. No single frame contains a slap — you
// can only see one in the shape of the last ~150 ms of wrist motion. So the
// job here is: keep a short history, differentiate it, and decide when the
// curve says "now".
//
// Three rules drive every decision below:
//
//  1. FIRE ON THE RISING EDGE, not on the peak and never on completion.
//     Waiting to confirm the peak has passed costs a frame minimum, and waiting
//     for the motion to finish costs ~200 ms, which reads as broken.
//
//  2. COMMIT AND IGNORE. Once the threshold trips, fire immediately and stop
//     listening for ~300 ms. This does double duty: it survives the landmark
//     dropout that motion blur is about to cause, and it stops one slap from
//     registering as eight hits.
//
//  3. LANDMARKS SAY WHAT, MOTION SAYS HOW FAST. When blur kills the landmarks
//     mid-swing, the frame-differencer still sees the hit, and the gesture from
//     just before the dropout is still the right answer.

import { OneEuro2D } from './oneEuro.js'

const HISTORY = 12 // ~200 ms at 60 fps — long enough to see a swing, short enough to stay current

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)

export function createStrikeDetector(params) {
  const filter = new OneEuro2D(params)

  // Preallocated ring buffer. Samples are overwritten in place; nothing is
  // allocated inside the hot loop.
  const buf = Array.from({ length: HISTORY }, () => ({ t: 0, x: 0, y: 0, span: 0.1 }))
  let head = -1
  let count = 0

  let armed = true
  let refractoryUntil = 0
  let prevSpeed = 0
  let prevSpeedT = 0

  let lastSeenT = -Infinity
  let lastGesture = 'open'

  function push(t, x, y, span) {
    head = (head + 1) % HISTORY
    const s = buf[head]
    s.t = t
    s.x = x
    s.y = y
    s.span = span
    if (count < HISTORY) count++
  }

  /** Sample `back` frames behind the newest one. */
  function at(back) {
    return buf[(head - back + HISTORY * 2) % HISTORY]
  }

  function clearHistory() {
    count = 0
    head = -1
    prevSpeed = 0
  }

  /**
   * Velocity over a short lookback window, in hand-spans per second.
   *
   * LEAST-SQUARES SLOPE, NOT A TWO-POINT DIFFERENCE.
   *
   * The obvious estimator — (now - then) / dt — throws away every sample
   * between the two it uses and puts all its weight on exactly the two most
   * likely to be wrong. Fitting a line through the whole window uses all of
   * them, and its variance falls as the window grows.
   *
   * Be honest about the size of this: measured against a jittered swing, at the
   * 4-sample window below it is only about 6% less noisy, which on its own
   * would not be worth writing. What it buys is the RIGHT TO WIDEN THE WINDOW.
   * The two estimators diverge as samples accumulate — 11% at 5 samples, 20% at
   * 7, 25% at 9 — because the difference keeps leaning on two endpoints while
   * the fit keeps averaging. So the window can be opened for noise without the
   * estimator wasting the samples that buys, and the ~8 ms of extra lag that
   * costs is already covered by the predictMs lookahead below.
   *
   * One pass over at most nine entries, no allocation.
   *
   * Measuring in hand-spans rather than pixels is what makes the thresholds
   * hold at any distance from the camera: the same real slap reads the same
   * whether the player is leaning in or sitting back.
   */
  function velocity(window) {
    if (count < 2) return { speed: 0, vx: 0, vy: 0, spanRate: 0 }

    const n = Math.min(window + 1, count)
    if (n < 3) {
      // Two samples is a line, so the fit below would be the difference anyway.
      const now = at(0)
      const then = at(1)
      const dt = now.t - then.t
      if (dt <= 1e-5) return { speed: 0, vx: 0, vy: 0, vz: 0, spanRate: 0 }
      const span = Math.max(now.span, 1e-4)
      const vx = (now.x - then.x) / dt / span
      const vy = (now.y - then.y) / dt / span
      const spanRate = (now.span - then.span) / dt / span
      const vz = Math.max(0, spanRate * 2.8)
      return {
        speed: Math.hypot(vx, vy, vz),
        vx,
        vy,
        vz,
        spanRate,
      }
    }

    // Sums for the normal equations of a straight-line fit, with time measured
    // relative to the newest sample so the numbers stay small and conditioned.
    let st = 0
    let stt = 0
    let sx = 0
    let sy = 0
    let ss = 0
    let stx = 0
    let sty = 0
    let sts = 0
    const t0 = at(0).t

    for (let i = 0; i < n; i++) {
      const p = at(i)
      const dt = p.t - t0
      st += dt
      stt += dt * dt
      sx += p.x
      sy += p.y
      ss += p.span
      stx += dt * p.x
      sty += dt * p.y
      sts += dt * p.span
    }

    const denom = n * stt - st * st
    if (Math.abs(denom) < 1e-12) return { speed: 0, vx: 0, vy: 0, vz: 0, spanRate: 0 }

    const span = Math.max(at(0).span, 1e-4)
    const vx = ((n * stx - st * sx) / denom) / span
    const vy = ((n * sty - st * sy) / denom) / span

    // Relative growth of the hand's apparent size. A hand travelling toward the
    // lens grows; that is the only depth cue a single camera gives us, and it
    // is what separates a punch from a hook.
    const spanRate = ((n * sts - st * ss) / denom) / span
    const vz = Math.max(0, spanRate * 2.8)

    return { speed: Math.hypot(vx, vy, vz), vx, vy, vz, spanRate }
  }

  function classifyStrike(gesture, vx, vy, spanRate, action = null) {
    if (action === 'superflick') return 'superflick'
    if (action === 'superpunch') return 'superpunch'
    if (action === 'superslap') return 'superslap'
    if (action === 'chop') return 'chop'
    if (action === 'poke') return 'poke'

    const lateral = Math.abs(vx) > Math.abs(vy)
    if (gesture === 'fist') {
      return spanRate > params.punchSpanRate ? 'punch' : lateral ? 'hook' : 'uppercut'
    }
    if (gesture === 'open') {
      return spanRate > params.punchSpanRate ? 'punch' : lateral ? 'slap' : 'chop'
    }
    return spanRate > params.punchSpanRate ? 'punch' : 'hit'
  }

  function makeStrike({ kind, strength, speed, x, y, vx, vy, vz = 0, source, t, action }) {
    return { kind, strength, speed, x, y, vx, vy, vz, source, t, action }
  }

  /**
   * @param {object} frame
   * @param {boolean} frame.present   Were landmarks found this frame?
   * @param {{x:number,y:number}} [frame.point] Palm centre, normalized image units.
   * @param {number} [frame.span]     Hand span, normalized image units.
   * @param {string} [frame.gesture]  'fist' | 'open' | 'partial'
   * @param {string} [frame.action]   'superpunch' | 'superflick' | 'superslap' | 'chop' | 'poke'
   * @param {{energy:number,cx:number,cy:number}} frame.motion Frame-diff result.
   * @param {number} frame.tSec       Timestamp in seconds.
   */
  function update({ present, point, span, gesture, action, motion, tSec }) {
    filter.setParams(params)

    let speed = 0
    let vx = 0
    let vy = 0
    let vz = 0
    let spanRate = 0
    let accel = 0
    let smoothed = null

    if (present) {
      smoothed = filter.filter(point.x, point.y, tSec)
      push(tSec, smoothed.x, smoothed.y, span)
      lastSeenT = tSec
      lastGesture = gesture

      const v = velocity(params.velWindow)
      speed = v.speed
      vx = v.vx
      vy = v.vy
      vz = v.vz
      spanRate = v.spanRate

      const dt = tSec - prevSpeedT
      if (dt > 1e-5 && dt < 0.5) accel = (speed - prevSpeed) / dt
      prevSpeed = speed
      prevSpeedT = tSec
    } else {
      // Hand is gone — most likely blurred into uselessness mid-swing, which is
      // precisely when a hit is in flight. Decay rather than snap to zero so
      // the HUD graph stays readable, and let the motion path below decide.
      filter.reset()
      prevSpeed *= 0.6
      speed = prevSpeed
    }

    // Re-arm only after the refractory window AND after the hand has actually
    // slowed down. Without the speed gate the follow-through of one slap trips
    // the detector the instant the window expires.
    if (!armed && tSec >= refractoryUntil && speed < params.releaseSpeed) {
      armed = true
    }

    let strike = null

    if (armed && present && speed >= params.fireSpeed) {
      // Rising-edge firing costs us the true peak, so estimate it: extrapolate
      // one lookahead forward along the current acceleration. Capped, because a
      // single noisy frame can produce an absurd acceleration.
      const bonus = Math.max(0, accel) * (params.predictMs / 1000)
      const predicted = speed + Math.min(bonus, speed * 0.5)
      const strength = clamp01(predicted / params.maxSpeed) ** 0.8

      strike = makeStrike({
        kind: classifyStrike(gesture, vx, vy, spanRate, action),
        strength,
        speed: predicted,
        x: smoothed.x,
        y: smoothed.y,
        vx,
        vy,
        vz,
        source: 'landmark',
        t: tSec,
        action,
      })
    } else if (
      armed &&
      !present &&
      tSec - lastSeenT < params.ghostMs / 1000 &&
      motion.energy >= params.motionFireEnergy
    ) {
      // Ghost hit. The landmarker lost the hand but the frame-differencer can
      // still see a large fast-moving blob, and we know what the hand was doing
      // a few frames ago. Blur makes this signal stronger, not weaker.
      const range = Math.max(params.motionMaxEnergy - params.motionFireEnergy, 1e-3)
      const strength = clamp01((motion.energy - params.motionFireEnergy) / range) ** 0.8

      strike = makeStrike({
        kind: classifyStrike(lastGesture, motion.cx - 0.5, 0, 0),
        strength,
        speed: params.fireSpeed,
        x: motion.cx,
        y: motion.cy,
        vx: 0,
        vy: 0,
        vz: 0,
        source: 'motion',
        t: tSec,
      })
    }

    if (strike) {
      armed = false
      refractoryUntil = tSec + params.refractoryMs / 1000
      // Drop the history at the moment of the hit. Samples from before the
      // strike would otherwise smear across the refractory gap and produce a
      // phantom velocity spike the moment we re-arm.
      clearHistory()
    }

    return {
      strike,
      speed,
      vx,
      vy,
      vz,
      accel,
      spanRate,
      armed,
      point: smoothed,
      gesture: present ? gesture : lastGesture,
      stale: !present && tSec - lastSeenT < params.ghostMs / 1000,
    }
  }

  function reset() {
    filter.reset()
    clearHistory()
    armed = true
    refractoryUntil = 0
    lastSeenT = -Infinity
  }

  return { update, reset }
}
