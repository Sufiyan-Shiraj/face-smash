// Picks the best still for each angle Tripo needs.
//
// TRIPO'S CONTRACT: multiview_to_model takes [front, left, back, right] — yaw
// only, there is no up or down slot. We fill front, left and right and leave
// back empty, which is allowed: front is required and at least two must be
// present. Skipping back means nobody has to turn a full 360°, and the back of
// a head is mostly hair anyway.
//
// Pure logic on purpose — no camera, no DOM. Feed it scored frames from
// anywhere and it tells you which angles you still need. That makes the part
// most likely to be subtly wrong testable without standing in front of a lens.

// Thresholds on the −1..+1 scale from frameScoring.headTurn().
export const ANGLES = [
  { key: 'front', label: 'Front', required: true, min: -0.18, max: 0.18, hint: 'Look straight at the camera' },
  { key: 'left', label: 'Left', min: -1, max: -0.4, hint: 'Turn your head to your right' },
  { key: 'right', label: 'Right', min: 0.4, max: 1, hint: 'Turn your head to your left' },
]

// A frame has to be meaningfully good to lock a slot, not merely the least bad
// thing seen so far. Otherwise the first blurry frame in a bucket wins and
// never gets beaten because the player has already moved on.
const MIN_SCORE = 0.3

export function createAngleCollector({ minScore = MIN_SCORE } = {}) {
  const best = { front: null, left: null, right: null }

  function angleFor(turn) {
    return ANGLES.find((a) => turn >= a.min && turn <= a.max) ?? null
  }

  /**
   * @param {object} frame
   * @param {number} frame.turn    −1..+1 head yaw.
   * @param {number} frame.score   From scoreFrame(); negative means rejected.
   * @param {string|null} frame.reject
   * @param {() => any} frame.capture Called ONLY when this frame wins its slot,
   *   so we copy pixels for keepers instead of every frame.
   * @returns {{angle: string|null, accepted: boolean, reason: string|null}}
   */
  function offer({ turn, score, reject, capture, detail }) {
    const angle = angleFor(turn)
    if (!angle) return { angle: null, accepted: false, reason: 'between angles' }
    if (reject) return { angle: angle.key, accepted: false, reason: reject }
    if (score < minScore) return { angle: angle.key, accepted: false, reason: 'too blurry' }

    const held = best[angle.key]
    if (held && held.score >= score) {
      return { angle: angle.key, accepted: false, reason: 'already have a better one' }
    }

    best[angle.key] = { score, turn, detail, ...capture() }
    return { angle: angle.key, accepted: true, reason: null }
  }

  function status() {
    const have = ANGLES.filter((a) => best[a.key])
    return {
      captured: Object.fromEntries(ANGLES.map((a) => [a.key, Boolean(best[a.key])])),
      count: have.length,
      // Tripo needs front plus at least one more.
      complete: Boolean(best.front) && have.length >= 2,
      missing: ANGLES.filter((a) => !best[a.key]),
      next: ANGLES.find((a) => !best[a.key]) ?? null,
    }
  }

  return {
    offer,
    status,
    angleFor,
    get views() {
      // Slot order is Tripo's, with `back` deliberately absent.
      return { front: best.front, left: best.left, right: best.right }
    },
    reset() {
      best.front = null
      best.left = null
      best.right = null
    },
    clear(key) {
      best[key] = null
    },
  }
}
