// Headless physics harness.
//
// Drives the real striker through the real head at known speeds and asserts a
// real contact force event comes out. It exists because every failure it covers
// is SILENT — no error, no warning, just a hit that does nothing — and each one
// returns the moment somebody changes a collider size, a timestep, or a setter.
//
// It has already caught three things that were wrong in the design:
//   - CCD does not prevent tunneling for a KINEMATIC body (only a dynamic one)
//   - addTorque accumulates across steps, so a per-frame spring runs away
//   - the neck pivot below the centre of mass is an inverted pendulum
//
// Run: npm run sim:physics

import { createPhysicsWorld } from '../src/physics/world.js'
import { createHead } from '../src/physics/head.js'
import { createStriker } from '../src/physics/striker.js'
import { createImpactRouter } from '../src/physics/impact.js'
import { createHandProjector } from '../src/physics/handToWorld.js'
import { colliderFor, getWeapon, heftOf } from '../src/physics/weapons.js'
import { RAPIER } from '../src/physics/world.js'

/**
 * Mirror of applyWeapon() in usePhysics — the sim must drive the real path.
 *
 * `rodless` pins the collider to the hand (reach 0). Most checks below are
 * about the collider itself — tunneling, the kinematic setter, which face
 * region was hit — and driving those through the pendulum would be testing the
 * rod's arc instead of the thing under test. The pendulum has its own check.
 */
function equip(striker, weapon, { rodless = false } = {}) {
  weapon.heft = heftOf(weapon)
  striker.setShape(colliderFor(weapon, RAPIER), {
    threshold: 0,
    restitution: weapon.restitution,
    friction: weapon.friction,
    reach: rodless ? 0 : (weapon.reach ?? 0),
    swingDamp: weapon.swingDamp ?? 0.9,
    spinRate: weapon.spin ? 14 : 0,
  })
  return weapon
}

const FRAME_DT = 1 / 60 // camera/render rate; physics substeps under this

/**
 * Sweep the striker along +x straight through the head.
 *
 * @param {object} opts
 * @param {number} opts.speed         m/s
 * @param {number} [opts.radius]      Striker radius; small weapons tunnel first.
 * @param {boolean} [opts.substep]    Interpolate across physics substeps (the fix).
 * @param {boolean} [opts.teleport]   Use setTranslation — the bug we guard against.
 * @param {boolean} [opts.ccd]
 * @param {[number,number]} [opts.dropout] Seconds [from,to] with no observation.
 * @param {boolean} [opts.straddle]   Place samples either side of the head.
 */
async function swing({
  speed,
  radius = 0.08,
  substep = true,
  teleport = false,
  ccd = true,
  dropout = null,
  straddle = false,
  travel = 1.0,
  weapon = 'punch',
}) {
  const ctx = await createPhysicsWorld()
  const head = createHead(ctx)
  const striker = createStriker(ctx, { radius, contactForceThreshold: 0 })
  if (!ccd) striker.body.enableCcd(false)
  const equipped = weapon ? equip(striker, getWeapon(weapon), { rodless: true }) : null

  const impacts = []
  let rawEvents = 0

  const router = createImpactRouter({
    strikerHandle: () => striker.handle,
    head,
    strikerPosition: striker.position,
    strikerVelocity: striker.velocity,
    weapon: () => equipped,
    suppressMs: 0, // count every event; the game debounces, the test must not
    onImpact: (i) => impacts.push(i),
  })

  const centre = head.position()
  const frameStep = speed * FRAME_DT
  // Whether a fast swing tunnels depends on sampling PHASE, not just speed: if
  // a frame happens to land inside the head it registers either way.
  // `straddle` puts the samples symmetrically either side of the centre, which
  // is the genuine worst case and the only honest way to test this.
  const startX = straddle
    ? centre.x - (Math.ceil(travel / 2 / frameStep) + 0.5) * frameStep
    : centre.x - travel / 2

  striker.reacquire({ x: startX, y: centre.y, z: centre.z })

  const frames = Math.ceil((centre.x + travel / 2 - startX) / frameStep)

  let maxTilt = 0
  for (let i = 0; i <= frames; i++) {
    const t = i * FRAME_DT
    const observed = { x: startX + speed * t, y: centre.y, z: centre.z }
    const blurred = dropout && t >= dropout[0] && t <= dropout[1]

    if (teleport) {
      striker.body.setTranslation(observed, true) // the wrong way, on purpose
    } else {
      striker.aim({ observed: blurred ? null : observed, dt: FRAME_DT, ghostLimit: 0.5 })
      if (!substep) {
        // Jump the whole frame's distance at once — what happens without
        // interpolation, and how a fast strike steps clear over the head.
        striker.body.setNextKinematicTranslation(observed)
      }
    }

    ctx.step(FRAME_DT, {
      beforeStep: (dt) => {
        if (!teleport && substep) striker.advance(dt)
        head.applyNeckSpring(dt)
      },
      afterStep: head.clampTilt,
      onCollision: (h1, h2, started) => {
        if (started) rawEvents++
        router.handle(h1, h2, started)
      },
    })
    maxTilt = Math.max(maxTilt, head.tiltAngle())
  }

  // Let the neck finish the swing it was given, so peak tilt is the real peak.
  for (let i = 0; i < 90; i++) {
    striker.aim({ observed: null, dt: FRAME_DT, ghostLimit: 0 })
    ctx.step(FRAME_DT, { beforeStep: (dt) => head.applyNeckSpring(dt), afterStep: head.clampTilt })
    maxTilt = Math.max(maxTilt, head.tiltAngle())
  }

  const result = {
    rawEvents,
    impacts: impacts.length,
    peakMomentum: impacts.reduce((m, i) => Math.max(m, i.momentum), 0),
    peakStrength: impacts.reduce((m, i) => Math.max(m, i.strength), 0),
    headTilt: head.tiltAngle(),
    maxTilt,
    regions: impacts.map((i) => i.region),
  }
  ctx.destroy()
  return result
}

/**
 * Drive the striker straight at the face along -z and report what it hit.
 *
 * A lateral sweep cannot test face regions: it grazes half of them on the way
 * past. Coming in head-on is how you find out which feature actually protrudes
 * furthest at a given height, which is the whole point of a compound hitbox.
 *
 * @param {object} opts
 * @param {number} opts.dy  Height above head centre, metres.
 * @param {number} [opts.dx] Lateral offset, metres.
 * @param {string} [opts.axis] 'z' for a frontal punch, 'x' for a side hit.
 */
async function punch({ dy, dx = 0, speed = 6, radius = 0.022, axis = 'z', weapon = 'spoon', settle = 0 }) {
  const ctx = await createPhysicsWorld()
  const head = createHead(ctx)
  const striker = createStriker(ctx, { radius, contactForceThreshold: 0 })
  const equipped = weapon ? equip(striker, getWeapon(weapon), { rodless: true }) : null

  const impacts = []
  const router = createImpactRouter({
    strikerHandle: () => striker.handle,
    head,
    strikerPosition: striker.position,
    strikerVelocity: striker.velocity,
    weapon: () => equipped,
    suppressMs: 0,
    onImpact: (i) => impacts.push(i),
  })

  const c = head.position()
  const travel = 0.45
  const place = (d) =>
    axis === 'z'
      ? { x: c.x + dx, y: c.y + dy, z: c.z + d }
      : { x: c.x + d, y: c.y + dy, z: c.z + dx }

  striker.reacquire(place(travel))

  // Stop the striker the instant it connects, and hold it there.
  //
  // Driving it on to the head's CENTRE — which this harness used to do — buries
  // a 2 cm collider 10 cm inside the face, puts the nose, a cheek and the skull
  // in contact simultaneously, and makes "which region did it hit" a question
  // about Rapier's internal pair ordering rather than about geometry. It also
  // resolves that penetration with an enormous kinematic shove that swamps
  // every difference between weapons. A real punch stops at the skin; so does
  // this one.
  let landed = false
  const frames = Math.ceil(travel / (speed * FRAME_DT))
  let maxTilt = 0

  for (let i = 0; i <= frames + settle; i++) {
    if (!landed) {
      const d = Math.max(travel - speed * i * FRAME_DT, 0)
      striker.aim({ observed: place(d), dt: FRAME_DT })
    } else {
      striker.aim({ observed: striker.position(), dt: FRAME_DT })
    }

    ctx.step(FRAME_DT, {
      beforeStep: (dt) => {
        if (!landed) striker.advance(dt)
        head.applyNeckSpring(dt)
      },
      afterStep: head.clampTilt,
      onCollision: (h1, h2, started) => {
        router.handle(h1, h2, started)
        if (impacts.length) landed = true
      },
    })
    maxTilt = Math.max(maxTilt, head.tiltAngle())
  }

  const result = {
    impacts: impacts.length,
    first: impacts[0] ?? null,
    region: impacts[0]?.region ?? null,
    peakStrength: impacts.reduce((m, i) => Math.max(m, i.strength), 0),
    maxTilt,
  }
  ctx.destroy()
  return result
}

/**
 * The whole chain, end to end: normalized image coordinates (what MediaPipe
 * actually hands us) → strike shell → striker → real Rapier contact.
 *
 * @param {object} opts
 * @param {number} opts.y      Image-space height of the sweep, 0..1.
 * @param {number} [opts.span] Hand span; varies the depth within the shell.
 * @param {number} [opts.durationMs] Time to cross the frame.
 */
async function sweepImage({ y, span = 0.12, durationMs = 150, fromX = 0.1, toX = 0.9 }) {
  const ctx = await createPhysicsWorld()
  const head = createHead(ctx)
  const striker = createStriker(ctx, { radius: 0.08, contactForceThreshold: 0 })
  const equipped = equip(striker, getWeapon('punch'), { rodless: true })

  const headPos = head.position()
  const projector = createHandProjector({
    cameraPosition: { x: headPos.x, y: headPos.y, z: headPos.z + 1.2 },
    headPosition: headPos,
    fov: 45,
    aspect: 4 / 3,
  })

  const impacts = []
  const router = createImpactRouter({
    strikerHandle: () => striker.handle,
    head,
    strikerPosition: striker.position,
    strikerVelocity: striker.velocity,
    weapon: () => equipped,
    suppressMs: 0,
    onImpact: (i) => impacts.push(i),
  })

  striker.reacquire(projector.project({ x: fromX, y, span }))

  const frames = Math.ceil(durationMs / 1000 / FRAME_DT)
  for (let i = 0; i <= frames; i++) {
    const u = i / frames
    const observed = projector.project({ x: fromX + (toX - fromX) * u, y, span })
    striker.aim({ observed, dt: FRAME_DT })
    ctx.step(FRAME_DT, {
      beforeStep: (dt) => {
        striker.advance(dt)
        head.applyNeckSpring(dt)
      },
      onCollision: router.handle,
    })
  }

  const result = {
    impacts: impacts.length,
    peakStrength: impacts.reduce((m, i) => Math.max(m, i.strength), 0),
  }
  ctx.destroy()
  return result
}

/** Drive a punch straight from the front via depth expansion (span growth) */
async function frontalPunchImage({ y = 0.5, spanFrom = 0.10, spanTo = 0.22, durationMs = 120 } = {}) {
  const ctx = await createPhysicsWorld()
  const head = createHead(ctx)
  const striker = createStriker(ctx, { radius: 0.08, contactForceThreshold: 0 })
  const equipped = equip(striker, getWeapon('punch'), { rodless: true })

  const headPos = head.position()
  const projector = createHandProjector({
    cameraPosition: { x: headPos.x, y: headPos.y, z: headPos.z + 1.2 },
    headPosition: headPos,
    fov: 45,
    aspect: 4 / 3,
  })

  const impacts = []
  const router = createImpactRouter({
    strikerHandle: () => striker.handle,
    head,
    strikerPosition: striker.position,
    strikerVelocity: striker.velocity,
    weapon: () => equipped,
    suppressMs: 0,
    onImpact: (i) => impacts.push(i),
  })

  striker.reacquire(projector.project({ x: 0.5, y, span: spanFrom }))

  const frames = Math.ceil(durationMs / 1000 / FRAME_DT)
  for (let i = 0; i <= frames; i++) {
    const u = i / frames
    const currentSpan = spanFrom + (spanTo - spanFrom) * u
    const observed = projector.project({ x: 0.5, y, span: currentSpan })
    striker.aim({ observed, dt: FRAME_DT })
    ctx.step(FRAME_DT, {
      beforeStep: (dt) => {
        striker.advance(dt)
        head.applyNeckSpring(dt)
      },
      onCollision: router.handle,
    })
  }

  const result = {
    impacts: impacts.length,
    peakStrength: impacts.reduce((m, i) => Math.max(m, i.strength), 0),
    region: impacts[0]?.region ?? null,
  }
  ctx.destroy()
  return result
}

/** Settle the head after a shove and report how far from upright it ends up. */
async function settleAfterShove() {
  const ctx = await createPhysicsWorld()
  const head = createHead(ctx)
  head.body.applyTorqueImpulse({ x: 0, y: 0, z: 0.55 }, true)

  let maxTilt = 0
  for (let i = 0; i < 240; i++) {
    ctx.step(FRAME_DT, { beforeStep: (dt) => head.applyNeckSpring(dt), afterStep: head.clampTilt })
    maxTilt = Math.max(maxTilt, head.tiltAngle())
  }
  const finalTilt = head.tiltAngle()
  ctx.destroy()
  return { maxTilt, finalTilt }
}

/** Hitstop must not bank the frozen time and repay it in a catch-up burst. */
async function hitstopAccumulator() {
  const ctx = await createPhysicsWorld()
  createHead(ctx)
  ctx.hitstop(0.08)

  let frozenSteps = 0
  for (let i = 0; i < 4; i++) frozenSteps += ctx.step(FRAME_DT) // 66ms < 80ms

  const burst = ctx.step(FRAME_DT)
  ctx.destroy()
  return { frozenSteps, burst }
}

// ---------------------------------------------------------------------------

let failures = 0
function check(name, ok, detail = '') {
  const mark = ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'
  console.log(`${mark} ${name}${detail ? `  \x1b[2m${detail}\x1b[0m` : ''}`)
  if (!ok) failures++
}

console.log('\n\x1b[1mphysics — real contact, substepping, dead reckoning\x1b[0m\n')

// 1. Events fire at all. If this fails, one of the three silent preconditions
//    is broken and nothing below means anything.
{
  const r = await swing({ speed: 3 })
  check(
    'collision events fire',
    r.rawEvents > 0,
    `${r.rawEvents} event(s), peak momentum ${r.peakMomentum.toFixed(1)} N·s`
  )
}

// 2. Every speed must land, especially the fast ones — those are the hits the
//    player cares most about.
{
  const results = []
  for (const speed of [2, 5, 15]) {
    const r = await swing({ speed, straddle: true })
    results.push(r)
    check(
      `hit registers at ${speed} m/s`,
      r.impacts > 0,
      `${r.impacts} impact(s), strength ${r.peakStrength.toFixed(2)}`
    )
  }
  check(
    'strength scales with swing speed',
    results[2].peakStrength > results[0].peakStrength * 2,
    `2 m/s → ${results[0].peakStrength.toFixed(2)}, 15 m/s → ${results[2].peakStrength.toFixed(2)}`
  )
}

// 2b. THE LEANING HAND. Contact is not a strike. A hand resting against the
//     face and drifting used to report a fresh hit every 150 ms forever, which
//     made rubbing the head a better scoring strategy than hitting it.
{
  const lean = await swing({ speed: 0.4, straddle: true })
  check(
    'a slow lean makes contact but does not score',
    lean.rawEvents > 0 && lean.impacts === 0,
    `${lean.rawEvents} contact event(s), ${lean.impacts} scored`
  )
}

// 3. THE TUNNELING TEST. A spoon-sized striker has only 0.26 m of combined
//    diameter to clear, so at 25 m/s a single 60 Hz frame (0.42 m) steps
//    straight over the head. Substepping is what prevents that — CCD measurably
//    does not, for a kinematic body.
{
  const SPOON = 0.02
  const stepped = await swing({ speed: 25, radius: SPOON, straddle: true, substep: true })
  const jumped = await swing({ speed: 25, radius: SPOON, straddle: true, substep: false })
  check(
    'substepping lands a 25 m/s spoon that a per-frame jump misses',
    stepped.impacts > 0 && jumped.impacts === 0,
    `substepped → ${stepped.impacts} hit(s), per-frame jump → ${jumped.impacts}`
  )
}

// 4. The setter matters. setTranslation teleports, so Rapier derives no
//    velocity and the contact carries almost nothing.
{
  const proper = await swing({ speed: 8 })
  const teleported = await swing({ speed: 8, teleport: true })
  check(
    'setTranslation produces a far weaker hit than setNextKinematicTranslation',
    teleported.peakMomentum < proper.peakMomentum * 0.5,
    `next → ${proper.peakMomentum.toFixed(1)} N·s, setTranslation → ${teleported.peakMomentum.toFixed(1)} N·s`
  )
}

// 5. THE ONE THAT MATTERS MOST. Motion blur kills the landmarks mid-swing on
//    every hard hit. Dead reckoning has to carry the collider through, and the
//    contact must still be real.
{
  const clean = await swing({ speed: 8 })
  const blurred = await swing({ speed: 8, dropout: [0.02, 0.1] })
  check(
    'blur dropout mid-swing still lands a real hit',
    blurred.impacts > 0,
    `${blurred.impacts} impact(s), ${blurred.peakMomentum.toFixed(1)} vs ${clean.peakMomentum.toFixed(1)} N·s clean`
  )
}

// 6. The neck spring has to bring the head back upright, and must not pump
//    energy into it while doing so.
{
  const { maxTilt, finalTilt } = await settleAfterShove()
  check(
    'head swings then returns upright',
    maxTilt > 0.1 && finalTilt < 0.05,
    `peak ${(maxTilt * 57.3).toFixed(0)}°, settled ${(finalTilt * 57.3).toFixed(1)}°`
  )
}

// 7. Hitstop freezes, then resumes normally — no lurch when it releases.
{
  const { frozenSteps, burst } = await hitstopAccumulator()
  check('hitstop freezes the sim', frozenSteps === 0, `${frozenSteps} steps during freeze`)
  check('...and does not burst afterwards', burst <= 4, `${burst} step(s) on the next frame`)
}

// 8. END TO END. A hand swept across the middle of the CAMERA IMAGE must
//    produce a real contact — this is the full chain MediaPipe actually feeds.
{
  const across = await sweepImage({ y: 0.5 })
  check(
    'hand swept across mid-image lands a real hit',
    across.impacts > 0,
    `${across.impacts} impact(s), strength ${across.peakStrength.toFixed(2)}`
  )
}

// 9. The strike shell must forgive DEPTH, which a single camera cannot measure,
//    without forgiving AIM, which the player can see and control.
{
  const near = await sweepImage({ y: 0.5, span: 0.2 }) // hand close to the lens
  const far = await sweepImage({ y: 0.5, span: 0.07 }) // hand far away
  check(
    'shell forgives bad depth: near and far hands both connect',
    near.impacts > 0 && far.impacts > 0,
    `near → ${near.impacts} hit(s), far → ${far.impacts} hit(s)`
  )

  const low = await sweepImage({ y: 0.95 }) // swung well below the head
  check(
    '...but aim still matters: a swing below the head misses',
    low.impacts === 0,
    `${low.impacts} impact(s)`
  )

  const frontal = await frontalPunchImage({ y: 0.5, spanFrom: 0.03, spanTo: 0.22 })
  check(
    'frontal punch connects directly with the face',
    frontal.impacts > 0,
    `${frontal.impacts} impact(s), hit ${frontal.region} @ ${frontal.peakStrength.toFixed(2)} strength`
  )
}

// 10. FACE REGIONS. The hitbox is seven primitives, and each one has to be
//     reachable — a region nothing can hit is just a slower sphere.
{
  const cases = [
    ['nose', { dy: -0.008 }],
    ['brow', { dy: 0.05 }],
    ['jaw', { dy: -0.088 }],
    ['chin', { dy: -0.118 }],
    ['cheekR', { dy: -0.028, dx: 0.06 }],
    ['ear', { dy: -0.012, dx: -0.012, axis: 'x' }],
  ]
  for (const [want, opts] of cases) {
    const r = await punch(opts)
    check(
      `a hit at ${want} height reports ${want}`,
      r.region === want,
      `got ${r.region ?? 'nothing'} (${r.impacts} impact(s))`
    )
  }
}

// 11. LEVER ARM. A compound hitbox is only worth its cost if WHERE you hit
//     changes what happens. An impulse whose line of action passes through the
//     pivot can only shove; one that misses it turns the head. That difference
//     is r × J falling out of the geometry, not a multiplier.
{
  const jaw = await punch({ dy: -0.075, speed: 9, settle: 90 })
  const centre = await punch({ dy: 0, speed: 9, settle: 90 })
  check(
    'an off-centre hit turns the head where a centred one only shoves',
    jaw.maxTilt > centre.maxTilt * 2,
    `jaw ${(jaw.maxTilt * 57.3).toFixed(1)}° vs centred ${(centre.maxTilt * 57.3).toFixed(1)}°`
  )
}

// 12. SPEED SCALING. Striking faster with a fist delivers greater momentum and tilt.
{
  const order = []
  for (const speed of [3, 8, 15]) {
    const r = await swing({ speed, weapon: 'fist', straddle: true })
    order.push({ speed, tilt: r.maxTilt })
  }
  check(
    'faster fist strikes move the head further',
    order[0].tilt < order[1].tilt && order[1].tilt < order[2].tilt,
    order.map((o) => `${o.speed} m/s ${(o.tilt * 57.3).toFixed(0)}°`).join(' < ')
  )
}

// 12b. The neck is a neck. A wild swing must not put the face through the back of
//      the vise — enforced as a hard clamp cone limit.
{
  const wild = await swing({ speed: 25, weapon: 'fist', straddle: true })
  check(
    'the neck never exceeds its angular limit',
    wild.maxTilt <= 1.2501,
    `peak ${(wild.maxTilt * 57.3).toFixed(1)}° against a 71.6° limit`
  )
}

// 13. Fist shape and friction reach the real collider.
{
  const ctx = await createPhysicsWorld()
  const striker = createStriker(ctx, { contactForceThreshold: 0 })
  const w = equip(striker, getWeapon('fist'))
  const shape = {
    type: striker.collider.shape.type,
    friction: striker.collider.friction(),
  }
  ctx.destroy()
  check(
    'fist shape and friction reach the real collider',
    shape.type === RAPIER.ShapeType.Ball && Math.abs(shape.friction - 0.7) < 1e-3,
    `fist=${shape.type} @ µ${shape.friction}`
  )
}

// 14. Equipping fist leaves the head mid-run untouched.
{
  const ctx = await createPhysicsWorld()
  const head = createHead(ctx)
  const striker = createStriker(ctx, { contactForceThreshold: 0 })
  head.body.applyTorqueImpulse({ x: 0, y: 0, z: 0.4 }, true)
  for (let i = 0; i < 10; i++) ctx.step(FRAME_DT, { beforeStep: (dt) => head.applyNeckSpring(dt) })

  const before = head.tiltAngle()
  equip(striker, getWeapon('fist'))
  const after = head.tiltAngle()
  ctx.destroy()
  check(
    're-equipping fist leaves the head mid-run untouched',
    Math.abs(after - before) < 1e-9 && before > 0.01,
    `tilt ${(before * 57.3).toFixed(2)}° → ${(after * 57.3).toFixed(2)}°`
  )
}

// 15. WEAPON ORIENTATION. The fist is turned to lead with +z along the swing.
{
  const ctx = await createPhysicsWorld()
  const striker = createStriker(ctx)
  equip(striker, getWeapon('fist'), { rodless: true })

  const dirs = []
  for (let a = 0; a < 16; a++) {
    for (let b = 0; b < 16; b++) {
      const th = (a / 16) * Math.PI * 2
      const ph = (b / 16) * Math.PI - Math.PI / 2
      dirs.push([Math.cos(ph) * Math.cos(th), Math.sin(ph), Math.cos(ph) * Math.sin(th)])
    }
  }
  dirs.push([1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1])

  let nonUnit = 0
  let misaimed = 0
  let worstNorm = 0
  let worstAim = 0

  for (const [dx, dy, dz] of dirs) {
    striker.reacquire({ x: 0, y: 1.31, z: 0 })
    striker.aim({ observed: { x: dx * 0.1, y: 1.31 + dy * 0.1, z: dz * 0.1 }, dt: FRAME_DT })
    striker.advance(FRAME_DT)
    const q = striker.rotation()

    const n = Math.hypot(q.x, q.y, q.z, q.w)
    if (!Number.isFinite(n) || Math.abs(n - 1) > 1e-6) nonUnit++
    worstNorm = Math.max(worstNorm, Math.abs(n - 1))

    const fx = 2 * (q.x * q.z + q.w * q.y)
    const fy = 2 * (q.y * q.z - q.w * q.x)
    const fz = 1 - 2 * (q.x * q.x + q.y * q.y)
    const dot = fx * dx + fy * dy + fz * dz
    if (dot < 0.999) misaimed++
    worstAim = Math.max(worstAim, 1 - dot)
  }
  ctx.destroy()

  check(
    'weapon orientation is a unit quaternion in every direction',
    nonUnit === 0,
    `${dirs.length} directions, worst |q|-1 = ${worstNorm.toExponential(1)}`
  )
  check(
    "...and the weapon's leading face points along the swing",
    misaimed === 0,
    `worst misalignment ${(Math.acos(1 - worstAim) * 57.3).toFixed(3)}°`
  )
}

// 16. ZERO PENDULUM LAG. A bare fist has reach 0 and tracks the hand directly.
{
  async function whip(id) {
    const ctx = await createPhysicsWorld()
    const striker = createStriker(ctx)
    const w = equip(striker, getWeapon(id))

    const start = { x: -0.4, y: 1.5, z: 0 }
    striker.reacquire(start)
    for (let i = 0; i < 60; i++) {
      striker.aim({ observed: start, dt: FRAME_DT })
      ctx.step(FRAME_DT, { beforeStep: (dt) => striker.advance(dt) })
    }

    const hangBelow = start.y - striker.position().y

    let peakHead = 0
    let peakGrip = 0
    let maxLag = 0
    const SPEED = 7
    const DRIVE = 24

    const stopX = start.x + SPEED * DRIVE * FRAME_DT
    for (let i = 0; i <= DRIVE; i++) {
      const x = start.x + SPEED * i * FRAME_DT
      striker.aim({ observed: { x, y: start.y, z: 0 }, dt: FRAME_DT })
      ctx.step(FRAME_DT, { beforeStep: (dt) => striker.advance(dt) })

      peakHead = Math.max(peakHead, striker.speed())
      const gv = striker.gripVelocity()
      peakGrip = Math.max(peakGrip, Math.hypot(gv.x, gv.y, gv.z))

      const g = striker.grip()
      const h = striker.position()
      maxLag = Math.max(maxLag, g.x - h.x)
    }
    ctx.destroy()
    return { hangBelow, peakHead, peakGrip, maxLag, reach: w.reach }
  }

  const fist = await whip('fist')

  check(
    'a bare fist has no rod and does not lag',
    fist.maxLag < 1e-6 && Math.abs(fist.peakHead - fist.peakGrip) < 1e-6,
    `lag ${(fist.maxLag * 1000).toFixed(2)} mm, head ${fist.peakHead.toFixed(1)} = hand ${fist.peakGrip.toFixed(1)} m/s`
  )

  // --- Dual Strikers: Left and Right fists ---------------------------------
  {
    const ctx = await createPhysicsWorld()
    const head = createHead(ctx)
    const strikerL = createStriker(ctx, { radius: 0.08, contactForceThreshold: 0 })
    const strikerR = createStriker(ctx, { radius: 0.08, contactForceThreshold: 0 })
    strikerL.body.enableCcd(false)
    strikerR.body.enableCcd(false)
    equip(strikerL, getWeapon('punch'), { rodless: true })
    equip(strikerR, getWeapon('punch'), { rodless: true })

    const impacts = []
    const router = createImpactRouter({
      strikers: [
        { handle: () => strikerL.handle, position: strikerL.position, velocity: strikerL.velocity, id: 'left' },
        { handle: () => strikerR.handle, position: strikerR.position, velocity: strikerR.velocity, id: 'right' },
      ],
      head,
      weapon: () => getWeapon('punch'),
      minSpeed: 0.5,
      onImpact: (imp) => impacts.push(imp),
    })

    // Swing left hand across cheekL and right hand across cheekR
    for (let i = 0; i < 30; i++) {
      const xL = -0.5 + i * (1.0 / 30) // left to right
      const xR = 0.5 - i * (1.0 / 30) // right to left
      strikerL.aim({ observed: { x: xL, y: 1.35, z: 0 }, dt: FRAME_DT })
      strikerR.aim({ observed: { x: xR, y: 1.35, z: 0 }, dt: FRAME_DT })
      ctx.step(FRAME_DT, {
        beforeStep: (sub) => {
          strikerL.advance(sub)
          strikerR.advance(sub)
        },
        onCollision: router.handle,
      })
    }

    const leftHits = impacts.filter((imp) => imp.hand === 'left')
    const rightHits = impacts.filter((imp) => imp.hand === 'right')
    check(
      'dual strikers register independent hits for left and right hands',
      leftHits.length > 0 && rightHits.length > 0,
      `left: ${leftHits.length} hit(s), right: ${rightHits.length} hit(s)`
    )
    ctx.destroy()
  }
}

console.log(
  failures === 0
    ? '\n\x1b[32mall checks passed\x1b[0m\n'
    : `\n\x1b[31m${failures} check(s) failed\x1b[0m\n`
)
process.exit(failures === 0 ? 0 : 1)
