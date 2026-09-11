// Angle-selection harness.
//
// This decides which stills get sent to Tripo, and Tripo bakes whatever it is
// given permanently. A blink or a blurred frame that slips through becomes a
// feature of the head the player then looks at through every slap of every run,
// so the selection rules are worth testing without a camera in the loop.
//
// Run: npm run sim:capture

import { ANGLES, createAngleCollector } from '../src/capture/angleCollector.js'

/** A scored frame as the live loop would produce it. */
function frame({ turn, score = 0.8, reject = null }) {
  return { turn, score, reject, detail: { turn }, capture: () => ({ canvas: `shot@${turn}` }) }
}

let failures = 0
function check(name, ok, detail = '') {
  const mark = ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'
  console.log(`${mark} ${name}${detail ? `  \x1b[2m${detail}\x1b[0m` : ''}`)
  if (!ok) failures++
}

console.log('\n\x1b[1mcapture — angle selection\x1b[0m\n')

// 1. Tripo's slots are yaw only. There must be no up/down angle to chase.
{
  const keys = ANGLES.map((a) => a.key)
  check(
    'three yaw angles, no up/down',
    keys.length === 3 && keys.includes('front') && !keys.includes('up'),
    keys.join(', ')
  )
}

// 2. A frontal frame fills the front slot and nothing else.
{
  const c = createAngleCollector()
  c.offer(frame({ turn: 0.02 }))
  const s = c.status()
  check('frontal frame fills front only', s.captured.front && !s.captured.left && !s.captured.right)
}

// 3. Rejected expressions never get captured, however well framed.
{
  const c = createAngleCollector()
  const results = [
    c.offer(frame({ turn: 0, reject: 'blinking' })),
    c.offer(frame({ turn: 0, reject: 'smiling' })),
    c.offer(frame({ turn: 0, reject: 'mouth open' })),
  ]
  check(
    'blinks, smiles and open mouths are all refused',
    results.every((r) => !r.accepted) && !c.status().captured.front,
    results.map((r) => r.reason).join(', ')
  )
}

// 4. A blurred frame is refused even with a perfect pose — sharpness is what
//    Tripo needs most and a soft frame poisons the result permanently.
{
  const c = createAngleCollector()
  const r = c.offer(frame({ turn: 0, score: 0.05 }))
  check('a blurred frame is refused', !r.accepted, `reason "${r.reason}"`)
}

// 5. Better frames replace worse ones in the same slot; worse ones never win.
{
  const c = createAngleCollector()
  c.offer(frame({ turn: 0, score: 0.5 }))
  const worse = c.offer(frame({ turn: 0, score: 0.4 }))
  const better = c.offer(frame({ turn: 0, score: 0.9 }))
  check(
    'only a better frame replaces the one held',
    !worse.accepted && better.accepted && c.views.front.score === 0.9,
    `kept ${c.views.front.score}`
  )
}

// 6. Heads between angles are ignored — mid-turn frames are motion-blurred and
//    belong to no slot.
{
  const c = createAngleCollector()
  const r = c.offer(frame({ turn: 0.3 })) // past front, short of the side
  check('a head between angles is ignored', !r.accepted && r.angle === null, `reason "${r.reason}"`)
}

// 7. Tripo needs front plus at least one more. Front alone is not enough, and
//    two sides without a front is not enough either.
{
  const frontOnly = createAngleCollector()
  frontOnly.offer(frame({ turn: 0 }))
  check('front alone is not complete', !frontOnly.status().complete)

  const sidesOnly = createAngleCollector()
  sidesOnly.offer(frame({ turn: -0.7 }))
  sidesOnly.offer(frame({ turn: 0.7 }))
  check('two sides without a front is not complete', !sidesOnly.status().complete)

  const ok = createAngleCollector()
  ok.offer(frame({ turn: 0 }))
  ok.offer(frame({ turn: -0.7 }))
  check('front plus one side is complete', ok.status().complete, `${ok.status().count} angles`)
}

// 8. The next-angle hint must advance as slots fill, so the on-screen
//    instruction always names something still missing.
{
  const c = createAngleCollector()
  const first = c.status().next.key
  c.offer(frame({ turn: 0 }))
  const second = c.status().next.key
  c.offer(frame({ turn: -0.7 }))
  c.offer(frame({ turn: 0.7 }))
  check(
    'the prompt advances and then stops',
    first === 'front' && second !== 'front' && c.status().next === null,
    `${first} → ${second} → done`
  )
}

// 9. Redo clears exactly one slot and asks for it again.
{
  const c = createAngleCollector()
  c.offer(frame({ turn: 0 }))
  c.offer(frame({ turn: -0.7 }))
  c.clear('front')
  const s = c.status()
  check(
    'redo clears one slot and re-requests it',
    !s.captured.front && s.captured.left && s.next.key === 'front',
    `next: ${s.next.key}`
  )
}

// 10. `back` must never appear — we deliberately leave Tripo's fourth slot
//     empty so nobody has to turn a full 360°.
{
  const c = createAngleCollector()
  c.offer(frame({ turn: 0 }))
  check('no back slot is ever produced', !('back' in c.views), Object.keys(c.views).join(', '))
}

console.log(
  failures === 0
    ? '\n\x1b[32mall checks passed\x1b[0m\n'
    : `\n\x1b[31m${failures} check(s) failed\x1b[0m\n`
)
process.exit(failures === 0 ? 0 : 1)
