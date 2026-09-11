// Weapon definitions.
//
// WHAT ACTUALLY MAKES A WEAPON FEEL DIFFERENT
//
// Three things, and they are independent:
//
// 1. HEFT — how much momentum it delivers. The striker is a KINEMATIC body, so
//    the solver treats it as infinite mass and the contact alone shoves the head
//    identically for everything. Mass is therefore applied explicitly: on
//    contact, an impulse of m·v at the contact point (see impact.js). A 6 kg
//    sledgehammer at 8 m/s carries 48 N·s and a 30 g spoon carries 0.24, and
//    that gap is the real momentum gap rather than a curve someone drew.
//
// 2. SHAPE — what the solver actually collides. Previously fiction: every weapon
//    used the same 0.08 ball because the cuboid and capsule descriptors were
//    built by a function nothing called. Real now, and `shape` describes the
//    STRIKING HEAD only — the pan's bowl, the hammer's head, the bat's barrel —
//    not the whole object. The handle is scenery; it never hits anything.
//
// 3. REACH — how far the head sits from the hand, and this is the one that
//    changes how the thing FEELS to swing. See the pendulum note below.
//
// THE PENDULUM, AND WHY REACH IS NOT JUST AN OFFSET
//
// A weapon rigidly glued to the tracked hand point is the version this started
// as, and the problem with it is not that it looks wrong — it is that a real
// weapon does not go where your hand goes. It TRAILS, then catches up, then
// overshoots. Most of the weight in a swing lives in that lag.
//
// So the head hangs off the grip on a rod and is simulated (striker.js): it
// falls under gravity, it is dragged along when the hand moves, and the rod
// constraint whips it through at the end of an arc. Consequences that fall out
// for free rather than being animated:
//
//   - the tip of a 0.5 m bat moves far faster than the hand that swung it, so a
//     long weapon genuinely hits harder for the same arm speed;
//   - a heavy head lags further behind the hand and takes longer to come back,
//     which is what "heavy" feels like;
//   - at rest the weapon hangs down instead of floating where the hand is.
//
// `reach: 0` opts out and glues the collider to the hand, which is right for a
// bare palm or fist — those really are where your hand is.
//
// `swingDamp` is how much of the head's velocity survives each step: higher
// keeps more energy, so it swings longer and overshoots further. It is the
// handle on "heavy and loose" versus "light and tight".
//
// `tint` is what the debris is made of. Brass sparks off a pan and pale steel
// off a sledgehammer read as different impacts before the player has read a
// single number, which is the cheapest way to make ten weapons feel like ten
// weapons rather than ten damage values.
//
// `damageScale` and `integrityScale` remain game-design weights on top of the
// measured contact. They are not pretending to be physics.

/** Mass that produces the baseline shove. Weapons heavier than this hit harder. */
export const REFERENCE_MASS = 0.4 // kg, roughly a human hand

export const SPOON = {
  id: 'spoon',
  tint: [0.9, 0.9, 0.9],
  label: 'Spoon',
  shape: { type: 'ball', radius: 0.022 },
  mass: 0.03,
  reach: 0.15,
  restitution: 0.3,
  friction: 0.5,
  damageScale: 0.5,
  integrityScale: 0.5,
}

export const FIST = {
  id: 'fist',
  tint: [1, 0.42, 0.42],
  label: 'Fist',
  icon: '✊',
  shape: { type: 'ball', radius: 0.056 },
  mass: 0.7, // a fist carries forearm behind it
  reach: 0, // your fist is exactly where your hand is — no pendulum lag
  restitution: 0.2,
  friction: 0.7,
  damageScale: 1.35,
  integrityScale: 1.3,
  model: 'fist',
  blurb: 'Bare fists. Direct contact.',
}

export const WEAPONS = [FIST, SPOON]
export const DEFAULT_WEAPON = FIST

export function getWeapon(id) {
  if (id === 'spoon') return SPOON
  return FIST
}

/**
 * Largest half-extent of a weapon's striking head, for the trail width and for
 * sizing the debris burst.
 */
export function weaponReach(weapon) {
  const s = weapon.shape
  if (s.type === 'cuboid') return Math.max(s.hx, s.hy, s.hz)
  if (s.type === 'capsule') return s.halfHeight + s.radius
  return s.radius
}

/** Build the Rapier ColliderDesc for a weapon's striking head. */
export function colliderFor(weapon, RAPIER) {
  const s = weapon.shape
  if (s.type === 'cuboid') return RAPIER.ColliderDesc.cuboid(s.hx, s.hy, s.hz)
  if (s.type === 'capsule') return RAPIER.ColliderDesc.capsule(s.halfHeight, s.radius)
  return RAPIER.ColliderDesc.ball(s.radius)
}

/**
 * Heft multiplier relative to a bare hand, compressed.
 *
 * Raw mass ratio spans 200x from spoon to sledgehammer, which would make the
 * spoon literally unable to move the head and the sledgehammer launch it out of
 * the vise. The cube root keeps the ordering honest while landing the range in
 * roughly 0.4x - 2.5x, which is the band where the difference is legible.
 */
export function heftOf(weapon) {
  return Math.cbrt((weapon.mass ?? REFERENCE_MASS) / REFERENCE_MASS)
}
