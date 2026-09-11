// Live hand tracking, decoupled from the render loop.
//
// The camera produces frames at its own rate (30-60 fps) and the renderer runs
// at the display's. Coupling them would either waste inference on frames the
// camera hasn't produced or stall rendering behind inference, so tracking
// writes into a ref and the R3F frame loop reads whatever is latest.
//
// Only ONE MediaPipe model runs here. Face landmarking belongs to the scan
// route and must never share a loop with this — that is the difference between
// 60 fps and a slideshow.

import { useEffect, useRef, useState } from 'react'

import { createHandTracker, startCamera } from '../tracking/handTracker.js'
import { createStrikeDetector } from '../tracking/strikeDetector.js'
import { createMotionField } from '../tracking/motionField.js'
import { loadTuning } from '../tracking/tuning.js'

export function useHandTracking({ enabled = true } = {}) {
  const videoRef = useRef(null)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')

  // Latest observation. Mutated in place; never triggers a re-render.
  const hand = useRef({
    present: false,
    x: 0.5,
    y: 0.5,
    span: 0.12,
    gesture: 'open',
    speed: 0,
    stale: false,
    lost: true,
    lostFor: Infinity,
    fps: 0,
    inferenceMs: 0,
    strike: null,
    left: {
      side: 'left',
      present: false,
      x: 0.35,
      y: 0.55,
      span: 0.12,
      gesture: 'open',
      action: 'neutral',
      clenchRatio: 0,
      speed: 0,
      strike: null,
      stale: false,
      lost: true,
      landmarks: null,
    },
    right: {
      side: 'right',
      present: false,
      x: 0.65,
      y: 0.55,
      span: 0.12,
      gesture: 'open',
      action: 'neutral',
      clenchRatio: 0,
      speed: 0,
      strike: null,
      stale: false,
      lost: true,
      landmarks: null,
    },
    hands: [],
  })

  const params = useRef(loadTuning())

  // Where each hand was last actually seen, for attributing frame-diff motion.
  const lastSeen = useRef({
    left: { x: 0.65, y: 0.55, t: -Infinity },
    right: { x: 0.35, y: 0.55, t: -Infinity },
  })

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    let tracker = null
    let rafId = null

    const detectorL = createStrikeDetector(params.current)
    const detectorR = createStrikeDetector(params.current)
    const motion = createMotionField()

    async function boot() {
      const video = videoRef.current
      if (!video) return

      try {
        setStatus('camera')
        await startCamera(video)
        if (cancelled) return

        setStatus('model')
        tracker = await createHandTracker({ numHands: 2 })
        if (cancelled) return

        setStatus('warmup')
        tracker.warmup()
        if (cancelled) return

        setStatus('tracking')
        loop()
      } catch (err) {
        if (!cancelled) {
          setError(err.message)
          setStatus('error')
        }
      }
    }

    let lastT = 0
    let usingVFC = false
    function loop() {
      const video = videoRef.current
      usingVFC = typeof video?.requestVideoFrameCallback === 'function'
      const schedule = (cb) =>
        usingVFC ? video.requestVideoFrameCallback(cb) : requestAnimationFrame(cb)

      rafId = schedule(function tick(nowMs) {
        if (cancelled || !tracker) return

        try {
          const detected = tracker.detect(video, nowMs)
          const m = motion.update(video, params.current.motionThreshold)

          // The frame-differencer sees ONE blob for the whole image, so handing
          // the same reading to both detectors made a single blurred swing fire
          // a ghost strike on the left hand AND the right hand in the same
          // frame — one slap, two hits, double damage.
          //
          // Attribute the blob to whichever hand was last seen nearer to it, and
          // give the other hand a reading with no energy in it. When only one
          // hand is on screen the question does not arise and it keeps the blob.
          const motionOwner = (() => {
            const L = lastSeen.current.left
            const R = lastSeen.current.right
            const freshL = nowMs - L.t < params.current.ghostMs
            const freshR = nowMs - R.t < params.current.ghostMs
            if (!freshL && !freshR) return null
            if (freshL !== freshR) return freshL ? 'left' : 'right'
            const dL = Math.hypot(m.cx - L.x, m.cy - L.y)
            const dR = Math.hypot(m.cx - R.x, m.cy - R.y)
            return dL <= dR ? 'left' : 'right'
          })()
          const quiet = { energy: 0, cx: m.cx, cy: m.cy, valid: false }

          const updateHandSlot = (slot, det, side) => {
            const isPresent = Boolean(slot?.present)
            if (isPresent) {
              const seen = lastSeen.current[side]
              seen.x = slot.point.x
              seen.y = slot.point.y
              seen.t = nowMs
            }
            const frame = det.update({
              present: isPresent,
              point: slot?.point,
              span: slot?.span,
              gesture: slot?.gesture,
              action: slot?.action,
              motion: motionOwner === null || motionOwner === side ? m : quiet,
              tSec: nowMs / 1000,
            })

            const strike = frame.strike ? { ...frame.strike, hand: side } : null

            return {
              side,
              present: isPresent,
              x: frame.point?.x ?? slot?.point?.x ?? (side === 'left' ? 0.35 : 0.65),
              y: frame.point?.y ?? slot?.point?.y ?? 0.55,
              span: slot?.span ?? 0.12,
              gesture: isPresent ? (frame.gesture || slot?.gesture || 'open') : 'open',
              action: isPresent ? (slot?.action || 'neutral') : 'neutral',
              clenchRatio: isPresent ? (slot?.clenchRatio ?? 0) : 0,
              fingers: isPresent ? (slot?.fingers ?? null) : null,
              isFlick: isPresent ? Boolean(slot?.isFlick) : false,
              orientation: isPresent ? (slot?.orientation ?? null) : null,
              speed: frame.speed ?? slot?.speed ?? 0,
              stale: frame.stale,
              lost: !isPresent && !frame.stale,
              strike,
              landmarks: slot?.landmarks ?? null,
            }
          }

          const leftHand = updateHandSlot(detected.left, detectorL, 'left')
          const rightHand = updateHandSlot(detected.right, detectorR, 'right')

          const h = hand.current
          const dt = nowMs - lastT
          if (lastT && dt > 0) h.fps += (1000 / dt - h.fps) * 0.1
          lastT = nowMs

          h.left = leftHand
          h.right = rightHand
          h.hands = [leftHand, rightHand]

          // Keep primary synced to the most active/dominant hand
          const primarySlot = (detected.left?.score ?? 0) > (detected.right?.score ?? 0)
            ? leftHand
            : (rightHand.present ? rightHand : leftHand)

          h.present = Boolean(leftHand.present || rightHand.present)
          h.x = primarySlot.x
          h.y = primarySlot.y
          h.span = primarySlot.span
          h.gesture = primarySlot.gesture
          h.action = primarySlot.action
          h.clenchRatio = Math.max(leftHand.clenchRatio, rightHand.clenchRatio)
          h.speed = Math.max(leftHand.speed, rightHand.speed)
          h.landmarks = primarySlot.landmarks
          h.allLandmarks = detected.allLandmarks ?? []
          h.fingers = primarySlot.fingers
          h.isFlick = leftHand.isFlick || rightHand.isFlick
          h.orientation = primarySlot.orientation
          h.stale = leftHand.stale || rightHand.stale
          h.lost = !h.present && !h.stale
          h.lostFor = h.present ? 0 : h.lostFor + (dt > 0 ? dt / 1000 : 0)
          h.inferenceMs = detected.inferenceMs ?? 0

          // Whatever happened this frame IS h.strike, including nothing.
          // This used only to assign on a hit and never clear, so the last
          // strike stayed readable forever and any consumer that polled the
          // field instead of edge-detecting it re-fired the same hit every
          // frame until the next one replaced it.
          h.strike = leftHand.strike ?? rightHand.strike ?? null
        } catch (err) {
          console.error('[HandTracker tick error]:', err)
        }

        rafId = schedule(tick)
      })
    }

    boot()

    return () => {
      cancelled = true
      // A requestVideoFrameCallback handle is NOT a rAF handle, and passing one
      // to cancelAnimationFrame silently cancels nothing (or something else).
      // The `cancelled` flag is what actually stops the loop; cancel through the
      // matching API so the pending callback goes too.
      if (rafId != null) {
        const v = videoRef.current
        if (usingVFC) v?.cancelVideoFrameCallback?.(rafId)
        else if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(rafId)
      }
      tracker?.close()
      const stream = videoRef.current?.srcObject
      if (stream) for (const track of stream.getTracks()) track.stop()
    }
  }, [enabled])

  return { videoRef, hand, status, error, params }
}
