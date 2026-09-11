// Hand identity assignment, checked headlessly.
//
// Every bug this file guards against presents identically to the player — "the
// tracking is flaky" — and none of them produce an error anywhere. They are
// also invisible in a single frame, which is what makes them so hard to see
// live: you have to look at what happens ACROSS frames, which is exactly what a
// harness is for.
//
// Run: npm run sim:tracking

import {
  assignSides,
  isContinuous,
  playerSideFromLabel,
  sideFromPosition,
  MAX_TRACK_JUMP,
  MAX_TRACK_SPEED,
} from '../src/tracking/handAssign.js'

let failures = 0
function check(name, ok, detail = '') {
  const mark = ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'
  console.log(`${mark} ${name}${detail ? `  \x1b[2m${detail}\x1b[0m` : ''}`)
  if (!ok) failures++
}

const track = (x, y, t = 0, tracked = true) => ({ x, y, t, tracked })
const fresh = () => ({ left: track(0.65, 0.55, 0, false), right: track(0.35, 0.55, 0, false) })
const det = (x, y, label = null, score = 0.9) => ({ point: { x, y }, label, score })

console.log('\n\x1b[1mhand identity\x1b[0m\n')

// 1. The mirrored-label bug, stated directly. The camera stream is not
//    mirrored, so MediaPipe's "Left" is the player's RIGHT hand.
{
  check(
    "MediaPipe's label is swapped for an unmirrored camera feed",
    playerSideFromLabel('Left', false) === 'right' &&
      playerSideFromLabel('Right', false) === 'left',
    `Left → ${playerSideFromLabel('Left', false)}, Right → ${playerSideFromLabel('Right', false)}`
  )
  check(
    '...and left alone when the feed really is mirrored',
    playerSideFromLabel('Left', true) === 'left' && playerSideFromLabel('Right', true) === 'right'
  )
}

// 2. The label and the geometry must AGREE. The old code OR-ed an inverted
//    label with a correct geometric test, so they contradicted each other on
//    every frame and one hand could claim both sides.
{
  // Player's right hand: physically on their right, so on the LEFT of the raw
  // frame, and labelled 'Left' by MediaPipe.
  const fromLabel = playerSideFromLabel('Left', false)
  const fromGeometry = sideFromPosition({ x: 0.3, y: 0.5 })
  check(
    'label and geometry agree about which hand is which',
    fromLabel === fromGeometry && fromLabel === 'right',
    `label says ${fromLabel}, geometry says ${fromGeometry}`
  )
}

// 3. One hand must land on exactly one side — never both, never neither.
{
  let ok = true
  const notes = []
  for (const [x, label, want] of [
    [0.30, 'Left', 'right'],
    [0.70, 'Right', 'left'],
    [0.30, null, 'right'],
    [0.70, null, 'left'],
  ]) {
    const out = assignSides([det(x, 0.5, playerSideFromLabel(label, false))], fresh(), 1000)
    const got = out.left ? (out.right ? 'both' : 'left') : out.right ? 'right' : 'neither'
    if (got !== want) ok = false
    notes.push(`x=${x} ${label ?? 'no label'} → ${got}`)
  }
  check('a single hand claims exactly one side', ok, notes.join(', '))
}

// 4. Two hands with two different labels: trust the labels.
{
  const out = assignSides(
    [det(0.30, 0.5, 'right', 0.95), det(0.70, 0.5, 'left', 0.93)],
    fresh(),
    1000
  )
  check(
    'two distinctly labelled hands go to their own sides',
    out.right?.point.x === 0.30 && out.left?.point.x === 0.70,
    `right x=${out.right?.point.x}, left x=${out.left?.point.x}`
  )
}

// 5. When the model labels BOTH detections the same hand — which it does, often
//    — geometry has to take over, or one arm freezes.
{
  const out = assignSides(
    [det(0.30, 0.5, 'left', 0.6), det(0.70, 0.5, 'left', 0.55)],
    fresh(),
    1000
  )
  check(
    'two hands labelled the same still get one side each',
    Boolean(out.left) && Boolean(out.right) && out.left.point.x === 0.70,
    `left x=${out.left?.point.x}, right x=${out.right?.point.x}`
  )
}

// 6. THE BIG ONE. Hands crossing must not exchange identities, because the next
//    velocity is differenced against "the same side" one frame earlier.
{
  const tracks = { left: track(0.52, 0.5, 1000), right: track(0.48, 0.5, 1000) }
  // One frame later they have just passed each other. Raw x order has flipped,
  // so a per-frame sort would swap them.
  const out = assignSides(
    [det(0.46, 0.5, null, 0.5), det(0.54, 0.5, null, 0.5)],
    tracks,
    1016
  )
  const leftMoved = Math.abs(out.left.point.x - tracks.left.x)
  const rightMoved = Math.abs(out.right.point.x - tracks.right.x)
  check(
    'crossing hands keep their identities instead of swapping',
    leftMoved < 0.1 && rightMoved < 0.1,
    `left moved ${leftMoved.toFixed(3)}, right moved ${rightMoved.toFixed(3)}`
  )
}

// 7. But a genuine swap — hands that really did trade places — must still be
//    accepted, or the tracker locks onto a stale arrangement.
{
  const tracks = { left: track(0.70, 0.5, 1000), right: track(0.30, 0.5, 1000) }
  // Both hands moved a long way to the other side.
  const out = assignSides([det(0.28, 0.5), det(0.72, 0.5)], tracks, 1016)
  check(
    'a real swap is still accepted when it is clearly the better match',
    Math.abs(out.left.point.x - 0.72) < 1e-9 && Math.abs(out.right.point.x - 0.28) < 1e-9,
    `left → ${out.left.point.x}, right → ${out.right.point.x}`
  )
}

// 8. A single hand near a live track inherits that track's side even when the
//    label disagrees — a lone hand is exactly where the label is least reliable.
{
  const tracks = { left: track(0.60, 0.5, 1000), right: track(0.30, 0.5, 900, false) }
  const out = assignSides([det(0.62, 0.52, 'right')], tracks, 1016)
  check(
    'a lone hand sticks to the side it was just on',
    Boolean(out.left) && !out.right,
    out.left ? 'stayed left' : 'jumped to right'
  )
}

// 9. A stale track must NOT capture a new hand — otherwise a hand that leaves
//    and re-enters on the other side is stuck with the wrong identity.
{
  const tracks = { left: track(0.60, 0.5, 0), right: track(0.30, 0.5, 0, false) }
  const out = assignSides([det(0.30, 0.5, 'right')], tracks, 5000)
  check(
    'a long-stale track does not capture a new hand',
    Boolean(out.right) && !out.left,
    out.right ? 'assigned right' : 'assigned left'
  )
}

console.log('\n\x1b[1mvelocity continuity\x1b[0m\n')

// 10. Continuity gating. This is what stops a phantom strike: a discontinuity
//     means the difference between two samples is not a velocity.
{
  const t = track(0.5, 0.5, 1000)
  check(
    'a normal frame-to-frame step is continuous',
    isContinuous(t, { x: 0.52, y: 0.5 }, 1 / 60)
  )
  check(
    'a fresh acquisition is not',
    !isContinuous({ ...t, tracked: false }, { x: 0.52, y: 0.5 }, 1 / 60)
  )
  check(
    'a long gap is not',
    !isContinuous(t, { x: 0.52, y: 0.5 }, 0.4),
    'a tab switch or a dropout must not integrate into one giant step'
  )
  check(
    'a teleport across the frame is not',
    !isContinuous(t, { x: 0.5 + MAX_TRACK_JUMP + 0.01, y: 0.5 }, 1 / 60, 0.12)
  )
}

// 11. The phantom strike, measured. Differencing one hand against the other's
//     last position produces a speed that clears any sane fire threshold.
{
  const SPAN = 0.12
  const dt = 1 / 60
  // Two hands 0.30 apart in normalized units swap identity.
  const bogus = Math.hypot(0.30, 0) / dt / SPAN // hand-spans per second
  const t = track(0.35, 0.5, 1000)
  const gated = isContinuous(t, { x: 0.65, y: 0.5 }, dt, SPAN)
  check(
    'an identity swap would fabricate a strike, and the gate refuses it',
    bogus > 100 && !gated,
    `ungated reading would be ${bogus.toFixed(0)} spans/s, gate allows ${MAX_TRACK_SPEED}, fire threshold 8`
  )

  // ...while a genuinely hard, fast punch must still get through. A strike that
  // the gate swallows is worse than one it lets past.
  const hard = 30 * SPAN * dt // 30 spans/s, a solid hit
  check(
    '...but a genuinely fast punch still counts as continuous',
    isContinuous(track(0.5, 0.5, 1000), { x: 0.5 + hard, y: 0.5 }, dt, SPAN),
    `${(hard / dt / SPAN).toFixed(0)} spans/s passes`
  )
}

console.log(
  failures === 0
    ? '\n\x1b[32mall checks passed\x1b[0m\n'
    : `\n\x1b[31m${failures} check(s) failed\x1b[0m\n`
)
process.exit(failures === 0 ? 0 : 1)
