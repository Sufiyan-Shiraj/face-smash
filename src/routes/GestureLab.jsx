// Step 1's tuning rig, on its own route.
//
// The feel of the detector is found by standing in front of the camera swinging
// at it while watching the speed graph, and that needs instruments the game
// screen must not have. The underlying modules are the same ones the Smash Lab
// uses — only the presentation differs.

import { useEffect, useRef } from 'react'

import { CAPTURE, createHandTracker, startCamera } from '../tracking/handTracker.js'
import { createMotionField } from '../tracking/motionField.js'
import { createStrikeDetector } from '../tracking/strikeDetector.js'
import { loadTuning } from '../tracking/tuning.js'
import { createHud } from '../ui/hud.js'
import { createOverlay } from '../ui/overlay.js'
import { CONTROLS } from '../tracking/tuning.js'
import '../ui/lab.css'

export default function GestureLab() {
  const rootRef = useRef(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const video = root.querySelector('#video')
    const overlayCanvas = root.querySelector('#overlay')
    const panel = root.querySelector('.panel')
    const mirror = root.querySelector('.mirror')

    const params = loadTuning()
    const overlay = createOverlay(overlayCanvas)
    const detector = createStrikeDetector(params)
    const motionField = createMotionField()
    const hud = createHud({ root, params, onReset: () => detector.reset() })

    let showMotion = false
    let fps = 0
    let lastFrameT = 0
    let cancelled = false
    let tracker = null

    function fitCanvases() {
      overlay.resize(mirror.clientWidth, mirror.clientHeight)
      hud.resizeGraph()
    }

    const ro = new ResizeObserver(fitCanvases)
    ro.observe(mirror)
    window.addEventListener('resize', fitCanvases)

    function onKey(e) {
      if (e.target.tagName === 'INPUT') return
      const key = e.key.toLowerCase()
      if (key === 'm') showMotion = !showMotion
      if (key === 'h') {
        panel.classList.toggle('hidden')
        fitCanvases()
      }
    }
    window.addEventListener('keydown', onKey)

    async function boot() {
      try {
        hud.setStatus('Starting camera…')
        const { settings } = await startCamera(video)
        if (cancelled) return

        hud.setStatus('Loading hand model…')
        tracker = await createHandTracker({ numHands: 1 })
        if (cancelled) return

        hud.setStatus('Warming up GPU…')
        tracker.warmup()
        if (cancelled) return

        fitCanvases()
        hud.setStatus(
          `${settings.width ?? CAPTURE.width}x${settings.height ?? CAPTURE.height} @ ${Math.round(
            settings.frameRate ?? 0
          )}fps — swing at the camera.`
        )
        setTimeout(() => !cancelled && hud.setStatus(''), 4000)
        loop()
      } catch (err) {
        if (!cancelled) hud.setStatus(err.message, 'error')
      }
    }

    function loop() {
      const useVFC = typeof video.requestVideoFrameCallback === 'function'
      const schedule = (cb) =>
        useVFC ? video.requestVideoFrameCallback(cb) : requestAnimationFrame(cb)

      schedule(function tick(nowMs) {
        if (cancelled || !tracker) return

        const dt = nowMs - lastFrameT
        if (lastFrameT && dt > 0) fps += (1000 / dt - fps) * 0.1
        lastFrameT = nowMs

        const hand = tracker.detect(video, nowMs)
        const motion = motionField.update(video, params.motionThreshold)
        const frame = detector.update({
          present: hand.present,
          point: hand.point,
          span: hand.span,
          gesture: hand.gesture,
          motion,
          tSec: nowMs / 1000,
        })

        overlay.draw({ hand, motion, frame, showMotion, maxSpeed: params.maxSpeed })
        hud.update({ frame, hand, fps, inferenceMs: hand.inferenceMs })
        schedule(tick)
      })
    }

    boot()

    return () => {
      cancelled = true
      ro.disconnect()
      window.removeEventListener('resize', fitCanvases)
      window.removeEventListener('keydown', onKey)
      tracker?.close()
      const stream = video?.srcObject
      if (stream) for (const t of stream.getTracks()) t.stop()
    }
  }, [])

  return (
    <div id="lab" ref={rootRef}>
      <section className="stage-col">
        <header className="titlebar">
          <h1>
            FACE<span>SMASH</span>
          </h1>
          <p className="subtitle">gesture lab — tune the feel before anything else</p>
        </header>

        <div className="stage">
          <div className="mirror">
            <video id="video" playsInline muted />
            <canvas id="overlay" />
          </div>
          <div id="smack" className="smack" />
          <div id="status" className="status" hidden />
        </div>

        <div className="readouts">
          <div className="readout big">
            <span className="label">damage</span>
            <span className="value" id="damage">0</span>
          </div>
          <div className="readout">
            <span className="label">hits</span>
            <span className="value" id="hits">0</span>
          </div>
          <div className="readout">
            <span className="label">combo</span>
            <span className="value" id="combo">x0</span>
          </div>
          <div className="readout">
            <span className="label">last</span>
            <span className="value" id="strike-kind">—</span>
          </div>
          <div className="readout">
            <span className="label">strength</span>
            <span className="value" id="strike-strength">0.00</span>
          </div>
          <div className="readout">
            <span className="label">via</span>
            <span className="value" id="strike-source" data-source="landmark">—</span>
          </div>
        </div>
      </section>

      <aside className="panel">
        <div className="panel-block">
          <div className="graph-head">
            <h2>
              speed <em>hand-spans / sec</em>
            </h2>
            <div className="legend">
              <span className="key fire">fire</span>
              <span className="key release">release</span>
              <span className="key hit">hit</span>
            </div>
          </div>
          <canvas id="graph" />
          <div className="live">
            <span>
              <b id="speed">0.0</b> speed
            </span>
            <span>
              <b id="gesture" data-gesture="none">—</b> gesture
            </span>
            <span>
              <b id="state" data-armed="true">ARMED</b>
            </span>
            <span>
              <b id="fps">0</b> fps
            </span>
            <span>
              <b id="infer">0.0</b> ms infer
            </span>
          </div>
        </div>

        <div className="panel-block">
          <h2>
            tuning <em>saved to this browser</em>
          </h2>
          <div id="sliders" className="sliders" data-count={CONTROLS.length} />
        </div>

        <div className="panel-block hints">
          <h2>keys</h2>
          <ul>
            <li>
              <kbd>M</kbd> toggle motion-field overlay
            </li>
            <li>
              <kbd>H</kbd> hide / show the tuning panel
            </li>
          </ul>
        </div>
      </aside>
    </div>
  )
}
