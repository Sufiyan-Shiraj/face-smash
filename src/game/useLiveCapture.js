// Live capture: watch the player turn their head, keep the best still per angle.
//
// This is the screen the original poster called "Calibration", and it is the
// one place where a progress bar is doing real work rather than theatre.
// Whatever we capture here gets baked into the 3D model permanently — a blink,
// a grin, a smear of motion blur becomes a feature of the head the player then
// has to look at through every slap of every run. Since the camera hands us
// frames continuously, rejecting the bad ones costs nothing.
//
// Only the FACE model runs here. The hand model belongs to the Smash Lab. They
// must never share a loop.

import { useCallback, useEffect, useRef, useState } from 'react'

import { createAngleCollector } from '../capture/angleCollector.js'
import { cropSquare, toJpegBlob } from '../capture/squareCrop.js'
import { scoreFrame } from '../capture/frameScoring.js'
import { createFaceScanner } from '../tracking/faceScanner.js'
import { startCamera } from '../tracking/handTracker.js'

const ANALYSIS_SIZE = 160

export function useLiveCapture() {
  const videoRef = useRef(null)
  const collectorRef = useRef(null)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0) // bumps when a slot changes, to re-render
  const live = useRef({ turn: 0, reason: null, angle: null, faceSeen: false, paused: false })

  useEffect(() => {
    let cancelled = false
    let scanner = null
    let rafId = null

    const collector = createAngleCollector()
    collectorRef.current = collector

    const work = document.createElement('canvas')
    work.width = ANALYSIS_SIZE
    work.height = Math.round((ANALYSIS_SIZE * 3) / 4)
    const workCtx = work.getContext('2d', { willReadFrequently: true })

    async function boot() {
      const video = videoRef.current
      if (!video) return
      try {
        setStatus('camera')
        await startCamera(video)
        if (cancelled) return

        setStatus('model')
        scanner = await createFaceScanner()
        if (cancelled) return
        scanner.warmup()
        if (cancelled) return

        setStatus('capturing')
        loop()
      } catch (err) {
        if (!cancelled) {
          setError(err.message)
          setStatus('error')
        }
      }
    }

    function loop() {
      const video = videoRef.current
      const useVFC = typeof video?.requestVideoFrameCallback === 'function'
      const schedule = (cb) =>
        useVFC ? video.requestVideoFrameCallback(cb) : requestAnimationFrame(cb)

      rafId = schedule(function step(nowMs) {
        if (cancelled || !scanner) return

        // rVFC stops firing while the tab is hidden. For a live mirror that is
        // fine — nobody is posing at a tab they can't see — but say so rather
        // than freezing a progress bar with no explanation.
        if (document.hidden) {
          live.current.paused = true
          rafId = requestAnimationFrame(step)
          return
        }
        live.current.paused = false

        workCtx.drawImage(video, 0, 0, work.width, work.height)
        const imageData = workCtx.getImageData(0, 0, work.width, work.height)
        const face = scanner.detect(video, nowMs)

        if (!face.present) {
          live.current.faceSeen = false
          live.current.reason = 'no face in frame'
          live.current.angle = null
        } else {
          const scored = scoreFrame({ landmarks: face.landmarks, blend: face.blend, imageData })
          live.current.faceSeen = true
          live.current.turn = scored.detail.turn

          const result = collector.offer({
            turn: scored.detail.turn,
            score: scored.score,
            reject: scored.reject,
            detail: scored.detail,
            // Only runs for a frame that actually wins its slot, so we copy
            // pixels for keepers rather than sixty times a second.
            capture: () => {
              const { canvas } = cropSquare(video, face.landmarks)
              return { canvas, t: nowMs }
            },
          })

          live.current.angle = result.angle
          live.current.reason = result.reason
          if (result.accepted) setTick((n) => n + 1)
        }

        rafId = schedule(step)
      })
    }

    boot()

    return () => {
      cancelled = true
      if (rafId && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(rafId)
      scanner?.close()
      const stream = videoRef.current?.srcObject
      if (stream) for (const t of stream.getTracks()) t.stop()
    }
  }, [])

  /** Encode the captured canvases to JPEG for Tripo. */
  const finalize = useCallback(async () => {
    const collector = collectorRef.current
    if (!collector) return null
    const views = collector.views
    for (const key of Object.keys(views)) {
      if (views[key]?.canvas) views[key].blob = await toJpegBlob(views[key].canvas)
    }
    return views
  }, [])

  const collector = collectorRef.current
  return {
    videoRef,
    status,
    error,
    live,
    tick,
    finalize,
    collector,
    statusOf: collector?.status() ?? { captured: {}, count: 0, complete: false, missing: [], next: null },
  }
}
