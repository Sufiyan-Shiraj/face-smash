// One Euro Filter — Casiez, Roussel & Vogel (CHI 2012).
//
// Why this and not a moving average: a moving average trades lag for smoothness
// at a fixed rate, so it either jitters when the hand is still or lags when the
// hand is fast. One Euro adapts — it smooths hard at low speed and gets out of
// the way at high speed, which is exactly the slap case.

const TWO_PI = Math.PI * 2

/** Smoothing factor for a given sample rate and cutoff frequency. */
function alpha(rate, cutoff) {
  const tau = 1 / (TWO_PI * cutoff)
  const te = 1 / rate
  return 1 / (1 + tau / te)
}

class LowPass {
  constructor() {
    this.prev = null
  }

  filter(value, a) {
    this.prev = this.prev === null ? value : a * value + (1 - a) * this.prev
    return this.prev
  }

  reset() {
    this.prev = null
  }
}

export class OneEuro {
  /**
   * @param {object} [opts]
   * @param {number} [opts.minCutoff] Hz. Lower = smoother when still, more lag.
   * @param {number} [opts.beta]      Speed coefficient. Higher = less lag when fast.
   * @param {number} [opts.dCutoff]   Hz. Cutoff for the internal speed estimate.
   */
  constructor({ minCutoff = 1.0, beta = 0.0, dCutoff = 1.0 } = {}) {
    this.minCutoff = minCutoff
    this.beta = beta
    this.dCutoff = dCutoff
    this.xFilter = new LowPass()
    this.dxFilter = new LowPass()
    this.xPrev = null
    this.tPrev = null
  }

  /**
   * @param {number} x       Raw sample.
   * @param {number} tSec    Timestamp in seconds.
   * @returns {number} Filtered sample.
   */
  filter(x, tSec) {
    let rate = 60
    if (this.tPrev !== null) {
      const dt = tSec - this.tPrev
      // Guard against duplicate frames and tab-switch time jumps, both of which
      // produce a garbage rate that would blow up the derivative.
      if (dt > 1e-6 && dt < 0.5) rate = 1 / dt
    }

    const dx = this.xPrev === null ? 0 : (x - this.xPrev) * rate
    const dxHat = this.dxFilter.filter(dx, alpha(rate, this.dCutoff))

    const cutoff = this.minCutoff + this.beta * Math.abs(dxHat)
    const xHat = this.xFilter.filter(x, alpha(rate, cutoff))

    this.xPrev = x
    this.tPrev = tSec
    return xHat
  }

  reset() {
    this.xFilter.reset()
    this.dxFilter.reset()
    this.xPrev = null
    this.tPrev = null
  }
}

/** Two independent One Euro filters sharing one set of tunables. */
export class OneEuro2D {
  constructor(opts) {
    this.x = new OneEuro(opts)
    this.y = new OneEuro(opts)
  }

  filter(px, py, tSec) {
    return { x: this.x.filter(px, tSec), y: this.y.filter(py, tSec) }
  }

  /** Live-tuning hook: the HUD sliders write straight through to the filters. */
  setParams({ minCutoff, beta, dCutoff }) {
    for (const f of [this.x, this.y]) {
      if (minCutoff !== undefined) f.minCutoff = minCutoff
      if (beta !== undefined) f.beta = beta
      if (dCutoff !== undefined) f.dCutoff = dCutoff
    }
  }

  reset() {
    this.x.reset()
    this.y.reset()
  }
}
