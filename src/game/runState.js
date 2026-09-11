// Run state: damage, hits, combo, Face Integrity.
//
// Deliberately a plain mutable object rather than React state. Impacts arrive
// from a 240 Hz physics loop, and routing every one of them through setState
// would re-render the whole Smash Lab hundreds of times a second. The HUD reads
// these fields directly into DOM refs on a rAF tick instead, and React only
// gets involved for discrete events — a run ending.

const COMBO_WINDOW = 1.2 // seconds; generous, chaining should feel achievable

export const run = {
  damage: 0,
  hits: 0,
  combo: 0,
  maxCombo: 0,
  integrity: 1, // 1 → 0, the Face Integrity meter
  strongest: 0,
  bestRegion: null,
  startedAt: 0,
  endedAt: 0,
  lastHitAt: -Infinity,
  weapon: 'fist',
  over: false,
}

const listeners = new Set()

/** Subscribe to discrete run events (start/end) — not per-hit updates. */
export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function emit() {
  for (const fn of listeners) fn(run)
}

export function startRun({ weapon = 'fist' } = {}) {
  run.damage = 0
  run.hits = 0
  run.combo = 0
  run.maxCombo = 0
  run.integrity = 1
  run.strongest = 0
  run.bestRegion = null
  run.startedAt = performance.now()
  run.endedAt = 0
  run.lastHitAt = -Infinity
  run.weapon = weapon
  run.over = false
  emit()
}

/**
 * Record one real contact.
 * @param {object} impact From physics/impact.js — strength is derived from the
 *   striker's measured speed, force is Rapier's raw contact magnitude.
 * @param {number} [integrityScale] Per-weapon multiplier on integrity damage.
 */
export function registerImpact(impact, integrityScale = 1) {
  if (run.over) return null

  const t = impact.t / 1000
  run.combo = t - run.lastHitAt < COMBO_WINDOW ? run.combo + 1 : 1
  run.maxCombo = Math.max(run.maxCombo, run.combo)
  run.lastHitAt = t
  run.hits++

  // Where you hit counts. The region multiplier comes from the physics — it is
  // the collider that was actually nearest the weapon, not a guess from the
  // gesture — so aiming for the nose is a real skill rather than a label.
  const region = impact.regionDamage ?? 1
  const points = Math.round(impact.strength * 1000 * region * (1 + run.combo * 0.15))
  run.damage += points
  if (points > run.strongest) {
    run.strongest = points
    run.bestRegion = impact.region ?? null
  }

  // Integrity falls with the square of strength, so light taps barely register
  // and a real hit takes a visible bite out of the bar.
  //
  // The region multiplier is applied here under a square root, not at full
  // weight. It already multiplies the SCORE above, and letting it multiply both
  // compounds: a sledgehammer to the nose came to 1.0 x 0.055 x 3.6 x 2.2 = 43% of
  // the bar in a single hit, which ended a run in three swings. Points are what
  // reward aim; integrity only needs to lean that way.
  run.integrity = Math.max(
    0,
    run.integrity - impact.strength ** 2 * 0.055 * integrityScale * Math.sqrt(region)
  )

  if (run.integrity <= 0 && !run.over) {
    run.over = true
    run.endedAt = performance.now()
    emit()
  }

  return points
}

export function finalScore() {
  return Math.round(run.damage * (1 + run.maxCombo * 0.02))
}

export function durationSeconds() {
  const end = run.endedAt || performance.now()
  return Math.max(0, (end - run.startedAt) / 1000)
}
