// Tuning HUD.
//
// The speed graph is the point of this screen. Thresholds for "what counts as
// a slap" cannot be reasoned out in the abstract — you find them by swinging at
// the camera and looking at where the curve actually peaks. Everything else
// here is readouts.

import { CONTROLS, resetTuning, saveTuning } from '../tracking/tuning.js'

const GRAPH_SAMPLES = 240 // ~4 s of history at 60 fps

export function createHud({ root, params, onReset }) {
  const el = (sel) => root.querySelector(sel)

  const dom = {
    damage: el('#damage'),
    hits: el('#hits'),
    combo: el('#combo'),
    kind: el('#strike-kind'),
    strength: el('#strike-strength'),
    source: el('#strike-source'),
    gesture: el('#gesture'),
    speed: el('#speed'),
    fps: el('#fps'),
    infer: el('#infer'),
    state: el('#state'),
    status: el('#status'),
    smack: el('#smack'),
    graph: el('#graph'),
    sliders: el('#sliders'),
  }

  const gctx = dom.graph.getContext('2d')

  // Ring buffer of graph samples. Parallel typed arrays instead of objects so
  // the per-frame push allocates nothing.
  const speeds = new Float32Array(GRAPH_SAMPLES)
  const fired = new Uint8Array(GRAPH_SAMPLES)
  const armedFlags = new Uint8Array(GRAPH_SAMPLES)
  // Zero means "in cooldown", so an untouched buffer would paint the whole
  // graph as one long refractory window before a single frame has run.
  armedFlags.fill(1)
  let cursor = 0

  let damage = 0
  let hits = 0
  let combo = 0
  let lastHitT = 0
  let peakSeen = 1

  buildSliders()

  function buildSliders() {
    for (const [key, min, max, step] of CONTROLS) {
      const row = document.createElement('label')
      row.className = 'slider'

      const name = document.createElement('span')
      name.className = 'slider-name'
      name.textContent = key

      const value = document.createElement('span')
      value.className = 'slider-value'
      value.textContent = params[key]

      const input = document.createElement('input')
      input.type = 'range'
      input.min = min
      input.max = max
      input.step = step
      input.value = params[key]
      input.addEventListener('input', () => {
        params[key] = Number(input.value)
        value.textContent = input.value
        saveTuning(params)
      })

      row.append(name, value, input)
      dom.sliders.append(row)
      row.dataset.key = key
    }

    const reset = document.createElement('button')
    reset.id = 'reset-tuning'
    reset.textContent = 'Reset to defaults'
    reset.addEventListener('click', () => {
      resetTuning(params)
      syncSliders()
      onReset?.()
    })
    dom.sliders.append(reset)
  }

  function syncSliders() {
    for (const row of dom.sliders.querySelectorAll('.slider')) {
      const key = row.dataset.key
      row.querySelector('input').value = params[key]
      row.querySelector('.slider-value').textContent = params[key]
    }
  }

  function resizeGraph() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    dom.graph.width = dom.graph.clientWidth * dpr
    dom.graph.height = dom.graph.clientHeight * dpr
    gctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  function drawGraph() {
    const W = dom.graph.clientWidth
    const H = dom.graph.clientHeight
    if (!W || !H) return

    gctx.clearRect(0, 0, W, H)

    // Autoscale to whatever we've actually seen, so the curve never clips off
    // the top while you're hunting for a threshold.
    const ceiling = Math.max(params.maxSpeed, peakSeen) * 1.1
    const yOf = (v) => H - (v / ceiling) * H
    const xOf = (i) => (i / (GRAPH_SAMPLES - 1)) * W

    // Refractory shading — the windows where input is deliberately ignored.
    gctx.fillStyle = 'rgba(255, 46, 136, 0.09)'
    for (let i = 0; i < GRAPH_SAMPLES; i++) {
      const idx = (cursor + i) % GRAPH_SAMPLES
      if (!armedFlags[idx]) gctx.fillRect(xOf(i), 0, W / GRAPH_SAMPLES + 1, H)
    }

    // Threshold lines.
    line(yOf(params.fireSpeed), '#ff2e88', [6, 5])
    line(yOf(params.releaseSpeed), 'rgba(255,255,255,0.25)', [3, 5])

    // Speed curve.
    gctx.strokeStyle = '#3ef0b0'
    gctx.lineWidth = 2
    gctx.beginPath()
    for (let i = 0; i < GRAPH_SAMPLES; i++) {
      const idx = (cursor + i) % GRAPH_SAMPLES
      const x = xOf(i)
      const y = yOf(speeds[idx])
      if (i === 0) gctx.moveTo(x, y)
      else gctx.lineTo(x, y)
    }
    gctx.stroke()

    // Fire markers.
    gctx.strokeStyle = '#ffe14d'
    gctx.lineWidth = 2
    gctx.beginPath()
    for (let i = 0; i < GRAPH_SAMPLES; i++) {
      const idx = (cursor + i) % GRAPH_SAMPLES
      if (fired[idx]) {
        gctx.moveTo(xOf(i), 0)
        gctx.lineTo(xOf(i), H)
      }
    }
    gctx.stroke()

    function line(y, color, dash) {
      gctx.save()
      gctx.setLineDash(dash)
      gctx.strokeStyle = color
      gctx.lineWidth = 1.5
      gctx.beginPath()
      gctx.moveTo(0, y)
      gctx.lineTo(W, y)
      gctx.stroke()
      gctx.restore()
    }
  }

  function pushSample(speed, didFire, armed) {
    speeds[cursor] = speed
    fired[cursor] = didFire ? 1 : 0
    armedFlags[cursor] = armed ? 1 : 0
    cursor = (cursor + 1) % GRAPH_SAMPLES
    if (speed > peakSeen) peakSeen = speed
  }

  function registerStrike(strike) {
    hits++
    // Combo window is generous — chaining should feel achievable, not precise.
    combo = strike.t - lastHitT < 1.2 ? combo + 1 : 1
    lastHitT = strike.t
    damage += Math.round(strike.strength * 1000 * (1 + combo * 0.15))

    dom.kind.textContent = strike.kind.toUpperCase()
    dom.strength.textContent = strike.strength.toFixed(2)
    // "hand" vs "blur" says what actually happened more directly than the
    // internal source names, and fits the tile.
    dom.source.textContent = strike.source === 'motion' ? 'blur' : 'hand'
    dom.source.dataset.source = strike.source

    dom.smack.textContent = strike.strength > 0.66 ? 'SMASH!' : strike.strength > 0.33 ? 'SMACK!' : 'tap'
    dom.smack.style.setProperty('--pop', 0.7 + strike.strength * 0.9)
    // Restart the CSS animation: force a reflow between removing and re-adding.
    dom.smack.classList.remove('pop')
    void dom.smack.offsetWidth
    dom.smack.classList.add('pop')
  }

  function update({ frame, hand, fps, inferenceMs }) {
    if (frame.strike) registerStrike(frame.strike)
    pushSample(frame.speed, Boolean(frame.strike), frame.armed)
    drawGraph()

    dom.damage.textContent = damage.toLocaleString()
    dom.hits.textContent = hits
    dom.combo.textContent = 'x' + combo
    dom.speed.textContent = frame.speed.toFixed(1)
    dom.gesture.textContent = hand.present ? frame.gesture : frame.stale ? frame.gesture + ' (ghost)' : '—'
    dom.gesture.dataset.gesture = hand.present ? frame.gesture : 'none'
    dom.fps.textContent = fps.toFixed(0)
    dom.infer.textContent = inferenceMs.toFixed(1)
    dom.state.textContent = frame.armed ? 'ARMED' : 'COOLDOWN'
    dom.state.dataset.armed = String(frame.armed)
  }

  function setStatus(text, tone = 'info') {
    dom.status.textContent = text
    dom.status.dataset.tone = tone
    dom.status.hidden = !text
  }

  return { update, setStatus, resizeGraph, syncSliders }
}
