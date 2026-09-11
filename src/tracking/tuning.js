// Every number that decides how a slap *feels*, in one place, live-editable.
//
// These defaults are starting points, not answers. The feel of this thing is
// the whole project, and feel is found by standing in front of the camera
// slapping the air while watching the speed graph — not by reasoning about it.
// That is why the HUD writes straight into this object and persists it.

const STORAGE_KEY = 'facesmash.tuning.v1'

export const DEFAULTS = {
  // --- One Euro smoothing -------------------------------------------------
  minCutoff: 1.6, // Hz. Lower = calmer hand at rest, more lag.
  beta: 0.9,      // Higher = less lag when moving fast. The important one.
  dCutoff: 1.0,

  // --- Velocity estimation ------------------------------------------------
  // Frames to look back. 4 @ 60fps = 67 ms. Wider is calmer but laggier; the
  // least-squares fit in strikeDetector actually spends the extra samples,
  // which is what makes 4 cheaper than 3 was.
  velWindow: 4,

  // --- Firing -------------------------------------------------------------
  // Units are hand-spans per second, so these are distance-invariant.
  fireSpeed: 8.0,    // Trip point. THE number to tune first.
  releaseSpeed: 3.0, // Must fall below this to re-arm. Hysteresis.
  refractoryMs: 300, // Commit-and-ignore window.
  predictMs: 60,     // Peak extrapolation lookahead.
  maxSpeed: 34,      // Speed that maps to full strength.
  punchSpanRate: 1.2, // Hand-size growth/sec that reads as "coming at the lens".

  // --- Frame-diff backstop ------------------------------------------------
  motionThreshold: 26,    // Per-pixel luma delta counted as movement.
  motionFireEnergy: 0.1,  // Fraction of frame moving that fires a ghost hit.
  motionMaxEnergy: 0.32,  // Energy that maps to full strength.
  ghostMs: 400,           // How long after landmark loss ghost hits are allowed.
}

/** Slider definitions for the tuning panel: [key, min, max, step]. */
export const CONTROLS = [
  ['fireSpeed', 1, 30, 0.5],
  ['maxSpeed', 5, 80, 1],
  ['releaseSpeed', 0.5, 15, 0.5],
  ['refractoryMs', 80, 800, 10],
  ['predictMs', 0, 200, 5],
  ['velWindow', 1, 8, 1],
  ['beta', 0, 4, 0.05],
  ['minCutoff', 0.2, 6, 0.1],
  ['punchSpanRate', 0.2, 5, 0.1],
  ['motionThreshold', 5, 80, 1],
  ['motionFireEnergy', 0.01, 0.5, 0.01],
  ['motionMaxEnergy', 0.05, 0.8, 0.01],
  ['ghostMs', 0, 800, 20],
]

export function loadTuning() {
  const params = { ...DEFAULTS }
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    for (const key of Object.keys(DEFAULTS)) {
      if (typeof saved[key] === 'number' && Number.isFinite(saved[key])) {
        params[key] = saved[key]
      }
    }
  } catch {
    // Corrupt or unavailable storage is not worth failing a demo over.
  }
  return params
}

export function saveTuning(params) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(params))
  } catch {
    // Private mode. Tuning just won't survive a reload.
  }
}

export function resetTuning(params) {
  Object.assign(params, DEFAULTS)
  saveTuning(params)
  return params
}
