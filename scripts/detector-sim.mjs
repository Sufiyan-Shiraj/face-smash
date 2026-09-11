// Synthetic strike-detector harness.
//
// Feeds the detector hand trajectories with known shapes so the state machine
// can be checked without standing in front of a camera. Catches the two bugs
// that are murder to diagnose live: one slap registering as many, and firing
// after the motion has finished instead of during it.
//
// Run: npm run sim

import { createStrikeDetector } from '../src/tracking/strikeDetector.js'
import { DEFAULTS } from '../src/tracking/tuning.js'

const FPS = 60
const DT = 1 / FPS
const SPAN = 0.12 // hand span in normalized image units, ~a hand at arm's length

/**
 * A swing with a bell-shaped velocity profile — accelerate, peak, decelerate.
 * Real limb motion looks like this; constant velocity does not.
 * @returns {{t:number,x:number,y:number}[]}
 */
function swing({ startT, duration, distance, y = 0.5, x0 = 0.2 }) {
  const frames = []
  const steps = Math.round(duration / DT)
  for (let i = 0; i <= steps; i++) {
    const u = i / steps
    // Integral of sin^2 normalized to [0,1]: smooth start, smooth stop.
    const s = u - Math.sin(2 * Math.PI * u) / (2 * Math.PI)
    frames.push({ t: startT + i * DT, x: x0 + distance * s, y })
  }
  return frames
}

function idle({ startT, duration, x = 0.2, y = 0.5 }) {
  const frames = []
  for (let i = 0; i < Math.round(duration / DT); i++) {
    // A pinch of jitter — a real landmarker is never perfectly still, and the
    // filter needs to prove it can swallow that without firing.
    frames.push({ t: startT + i * DT, x: x + (Math.random() - 0.5) * 0.002, y: y + (Math.random() - 0.5) * 0.002 })
  }
  return frames
}

/** Add landmark jitter of a given amplitude, in normalized image units. */
function jitter(frames, amp, seed = 1) {
  // Deterministic LCG: a noise test that fails one run in ten is not a test.
  let x = seed
  const rand = () => ((x = (x * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff - 0.5) * 2
  return frames.map((f) => ({ ...f, x: f.x + rand() * amp, y: f.y + rand() * amp }))
}

function run(frames, { params = { ...DEFAULTS }, gesture = 'open', dropout = null } = {}) {
  const detector = createStrikeDetector(params)
  const strikes = []
  const trace = []

  for (const f of frames) {
    const blurred = dropout && f.t >= dropout.from && f.t <= dropout.to
    const motion = blurred
      ? { energy: dropout.energy, cx: f.x, cy: f.y, valid: true }
      : { energy: 0.01, cx: 0.5, cy: 0.5, valid: true }

    const out = detector.update({
      present: !blurred,
      point: { x: f.x, y: f.y },
      span: SPAN,
      gesture,
      motion,
      tSec: f.t,
    })

    trace.push({ t: f.t, speed: out.speed, armed: out.armed })
    if (out.strike) strikes.push({ ...out.strike, t: f.t })
  }

  const peak = trace.reduce((a, b) => (b.speed > a.speed ? b : a), trace[0])
  return { strikes, trace, peak }
}

// ---------------------------------------------------------------------------

let failures = 0
function check(name, ok, detail = '') {
  const mark = ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'
  console.log(`${mark} ${name}${detail ? `  \x1b[2m${detail}\x1b[0m` : ''}`)
  if (!ok) failures++
}

console.log('\n\x1b[1mstrike detector — synthetic trajectories\x1b[0m\n')

// 1. A hand sitting still must never fire.
{
  const { strikes, peak } = run(idle({ startT: 0, duration: 2 }))
  check('idle hand fires nothing', strikes.length === 0, `peak speed ${peak.speed.toFixed(2)}`)
}

// 2. A slow deliberate reach must never fire.
{
  const frames = [...idle({ startT: 0, duration: 0.3 }), ...swing({ startT: 0.3, duration: 1.2, distance: 0.4 })]
  const { strikes, peak } = run(frames)
  check('slow reach fires nothing', strikes.length === 0, `peak speed ${peak.speed.toFixed(2)}`)
}

// 3. One fast slap fires exactly once. This is the debounce test — without the
//    refractory window a single swing registers a hit on every frame above
//    threshold, which at 60 fps is roughly eight of them.
{
  const frames = [
    ...idle({ startT: 0, duration: 0.3 }),
    ...swing({ startT: 0.3, duration: 0.15, distance: 0.55 }),
    ...idle({ startT: 0.45, duration: 0.8, x: 0.75 }),
  ]
  const { strikes, peak } = run(frames)
  check('one slap → one hit', strikes.length === 1, `${strikes.length} strike(s), peak ${peak.speed.toFixed(1)}`)

  if (strikes.length) {
    const s = strikes[0]
    // The whole point of rising-edge firing: the hit must land while the hand
    // is still speeding up, not after the peak has been confirmed.
    check('fires on the rising edge', s.t < peak.t, `fired ${((peak.t - s.t) * 1000).toFixed(0)}ms before peak`)
    check('reports a usable strength', s.strength > 0.15 && s.strength <= 1, `strength ${s.strength.toFixed(2)}`)
    check('classifies a lateral open hand as a slap', s.kind === 'slap', `kind "${s.kind}"`)
  }
}

// 4. Harder slap must read harder. If strength does not track effort the whole
//    damage model is theatre.
{
  const soft = run([...idle({ startT: 0, duration: 0.3 }), ...swing({ startT: 0.3, duration: 0.22, distance: 0.45 })])
  const hard = run([...idle({ startT: 0, duration: 0.3 }), ...swing({ startT: 0.3, duration: 0.1, distance: 0.7 })])
  const a = soft.strikes[0]?.strength ?? 0
  const b = hard.strikes[0]?.strength ?? 0
  check('harder slap scores higher', b > a, `soft ${a.toFixed(2)} → hard ${b.toFixed(2)}`)
}

// 5. Two slaps in quick succession, separated by more than the refractory
//    window, must both count.
{
  const frames = [
    ...idle({ startT: 0, duration: 0.2 }),
    ...swing({ startT: 0.2, duration: 0.13, distance: 0.5 }),
    ...idle({ startT: 0.33, duration: 0.4, x: 0.7 }),
    ...swing({ startT: 0.73, duration: 0.13, distance: -0.5, x0: 0.7 }),
    ...idle({ startT: 0.86, duration: 0.4, x: 0.2 }),
  ]
  const { strikes } = run(frames)
  check('two separated slaps → two hits', strikes.length === 2, `${strikes.length} strike(s)`)
}

// 6. A fist travelling sideways is a hook, not a slap.
{
  const frames = [...idle({ startT: 0, duration: 0.3 }), ...swing({ startT: 0.3, duration: 0.13, distance: 0.55 })]
  const { strikes } = run(frames, { gesture: 'fist' })
  check('fist + lateral → hook', strikes[0]?.kind === 'hook', `kind "${strikes[0]?.kind}"`)
}

// 7. THE IMPORTANT ONE. Motion blur wipes out the landmarks mid-swing — the
//    exact failure mode of a hard hit. The frame-diff backstop must still fire.
{
  const frames = [
    ...idle({ startT: 0, duration: 0.3 }),
    ...swing({ startT: 0.3, duration: 0.13, distance: 0.55 }),
    ...idle({ startT: 0.43, duration: 0.5, x: 0.75 }),
  ]
  // Landmarks vanish almost immediately after the swing starts, before speed
  // has had a chance to cross the firing threshold.
  const dropout = { from: 0.32, to: 0.43, energy: 0.25 }
  const { strikes } = run(frames, { dropout })
  check('blur dropout still registers a hit', strikes.length === 1, `${strikes.length} strike(s)`)
  check('...and credits the motion backstop', strikes[0]?.source === 'motion', `source "${strikes[0]?.source}"`)
}

// 8. Background motion with no hand recently present must not fire. Otherwise
//    someone walking past the camera scores points.
{
  const detector = createStrikeDetector({ ...DEFAULTS })
  let strikes = 0
  for (let i = 0; i < 120; i++) {
    const out = detector.update({
      present: false,
      motion: { energy: 0.4, cx: 0.5, cy: 0.5, valid: true },
      tSec: i * DT,
    })
    if (out.strike) strikes++
  }
  check('motion with no recent hand fires nothing', strikes === 0, `${strikes} strike(s)`)
}

// Velocity estimation has to survive landmark jitter, because a blurred hand
// mid-slap is exactly when the landmarks are worst AND when the speed reading
// matters most. A two-point difference divides that noise by a small dt and
// hands it straight to the threshold; a least-squares slope over the window
// averages it down instead.
{
  const clean = run(swing({ startT: 0, duration: 0.2, distance: 0.55 }))
  const noisy = run(jitter(swing({ startT: 0, duration: 0.2, distance: 0.55 }), 0.004))

  const peak = (r) => r.trace.reduce((m, f) => Math.max(m, f.speed), 0)
  const drift = Math.abs(peak(noisy) - peak(clean)) / peak(clean)

  check(
    'jitter barely moves the peak speed reading',
    drift < 0.15,
    `clean ${peak(clean).toFixed(1)} vs noisy ${peak(noisy).toFixed(1)} (${(drift * 100).toFixed(1)}% drift)`
  )
  check(
    '...and a jittered swing still fires exactly once',
    noisy.strikes.length === 1,
    `${noisy.strikes.length} strike(s)`
  )
}

console.log(
  failures === 0
    ? '\n\x1b[32mall checks passed\x1b[0m\n'
    : `\n\x1b[31m${failures} check(s) failed\x1b[0m\n`
)
process.exit(failures === 0 ? 0 : 1)
