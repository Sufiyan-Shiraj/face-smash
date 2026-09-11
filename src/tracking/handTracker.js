// MediaPipe Hand Landmarker wrapper + camera plumbing.
//
// Note on scope: hand tracking is the LIVE model. Face tracking is a one-time
// scan step that happens on a different screen. The two must never run in the
// same frame loop — that is the difference between 60 fps and a slideshow.

import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'
import { classifyGesture, handSpan, palmCenter, handBounds, handOrientation } from './gestures.js'
import { assignSides, isContinuous, playerSideFromLabel } from './handAssign.js'

// Served from disk, not a CDN. Assume the venue wifi is hostile.
const WASM_PATH = '/mediapipe'
const MODEL_PATH = '/models/hand_landmarker.task'

/**
 * 16:9, not 4:3, and this is about REACH rather than image quality.
 *
 * A 4:3 sensor mode is narrower horizontally than the same camera's 16:9 mode
 * on almost every webcam, so asking for 640x480 threw away the outer part of
 * the field of view — precisely the part a player's hand travels through when
 * they swing wide. Hands left the frame, landmarks died, and the striker was
 * left dead-reckoning through the most important part of the motion.
 *
 * 960x540 keeps the original reasoning intact: it is still a low resolution, so
 * inference stays fast and many webcams still pick the shorter exposure that
 * keeps a fast hand from smearing into uselessness. It just stops cropping the
 * sides off the play area. Pair it with the projector's inset (handToWorld.js),
 * which spends that extra width as slack rather than as extra reaching.
 */
export const CAPTURE = { width: 960, height: 540, frameRate: 60 }

export async function startCamera(video) {
  let stream
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        width: { ideal: CAPTURE.width },
        height: { ideal: CAPTURE.height },
        frameRate: { ideal: CAPTURE.frameRate },
        // Ask for the widescreen sensor mode explicitly. `width`/`height` alone
        // are honoured loosely, and a camera that decides to letterbox a 4:3
        // mode up to 960x540 gives back none of the horizontal view this is
        // here for.
        aspectRatio: { ideal: CAPTURE.width / CAPTURE.height },
        facingMode: 'user',
      },
    })
  } catch (err) {
    const reason =
      err.name === 'NotAllowedError'
        ? 'Camera permission was denied. Allow it in the address bar and reload.'
        : err.name === 'NotFoundError'
          ? 'No camera found.'
          : err.name === 'NotReadableError'
            ? 'The camera is already in use by another app. Close it and reload.'
            : err.message
    throw new Error(reason)
  }

  video.srcObject = stream
  video.playsInline = true
  video.muted = true
  await video.play()

  // Chrome reports 0x0 until the first frame is decoded.
  if (!video.videoWidth) {
    await new Promise((resolve) => video.addEventListener('loadeddata', resolve, { once: true }))
  }

  const settings = stream.getVideoTracks()[0]?.getSettings?.() ?? {}
  return { stream, settings }
}

export async function createHandTracker({ numHands = 2 } = {}) {
  const fileset = await FilesetResolver.forVisionTasks(WASM_PATH)

  const landmarker = await HandLandmarker.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath: MODEL_PATH,
      // Total latency budget for the whole chain is around 100 ms. CPU
      // inference alone can eat most of that.
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    numHands,
    // Deliberately below the 0.5 defaults. A blurred hand mid-slap scores low,
    // and dropping it is the single worst thing this system can do. We would
    // rather tolerate an occasional false positive than miss the hardest hits.
    minHandDetectionConfidence: 0.35,
    minHandPresenceConfidence: 0.28,
    minTrackingConfidence: 0.28,
  })

  let lastTimestamp = -1
  let inferenceMs = 0

  /**
   * Persistent per-side tracking state.
   *
   * WHY SIDES ARE STICKY RATHER THAN RECOMPUTED EVERY FRAME
   *
   * The previous version decided which hand was which by sorting the detections
   * by image x, every frame, independently. Two things went wrong with that, and
   * together they are most of what "the detection is flaky" meant.
   *
   * First, velocity history was keyed by MediaPipe's handedness label. That
   * label is a per-frame classification and it flips — most often exactly when
   * the hands cross, overlap, or one turns over. The moment the key flipped, the
   * next velocity was computed between the position of one hand and the last
   * position of the OTHER one. Two hands 30 cm apart at 60 fps produce an
   * apparent 18 m/s, which sails past any sane fire threshold, so crossing your
   * hands reliably fabricated a strike out of nothing.
   *
   * Second, the label was being read backwards. See MP_LABEL_IS_MIRRORED below.
   *
   * So: sides persist, detections are ASSIGNED to them by nearest neighbour
   * against the previous frame, and history is dropped whenever a side is
   * (re)acquired rather than differenced across a discontinuity.
   */
  const sides = {
    left: newSideState('left'),
    right: newSideState('right'),
  }
  let activeHandCategory = null

  function newSideState(side) {
    return {
      side,
      x: side === 'left' ? 0.65 : 0.35,
      y: 0.55,
      lm: null,
      span: 0.12,
      t: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      speed: 0,
      flickUntil: 0,
      tracked: false,
    }
  }

  // The <video> element carries the raw camera stream, so the frame MediaPipe
  // sees is NOT mirrored and every handedness label it returns is inverted.
  // handAssign.js explains why at length; this is the flag that drives it.
  const INPUT_IS_MIRRORED = false

  /**
   * @param {HTMLVideoElement} video
   * @param {number} tMs Monotonic timestamp in milliseconds.
   */
  function detect(video, tMs) {
    // MediaPipe requires strictly increasing timestamps in VIDEO mode and
    // throws if it ever sees one repeat.
    const ts = tMs <= lastTimestamp ? lastTimestamp + 1 : tMs
    lastTimestamp = ts

    const t0 = performance.now()
    const result = landmarker.detectForVideo(video, ts)
    inferenceMs = performance.now() - t0

    const hands = result.landmarks?.filter((lm) => lm && lm.length >= 21) ?? []
    if (hands.length === 0) {
      sides.left.tracked = false
      sides.right.tracked = false
      activeHandCategory = null
      return {
        present: false,
        left: null,
        right: null,
        hands: [],
        allLandmarks: [],
        inferenceMs,
        switchedHand: false,
      }
    }

    // --- 1. Describe each detection, with no identity attached yet ----------
    const detections = hands.map((lm, idx) => ({
      lm,
      point: palmCenter(lm),
      span: handSpan(lm),
      label: playerSideFromLabel(result.handedness?.[idx]?.[0]?.categoryName ?? null, INPUT_IS_MIRRORED),
      score: result.handedness?.[idx]?.[0]?.score ?? 0,
    }))

    // --- 2. Assign detections to sides --------------------------------------
    const assigned = assignSides(detections, sides, ts)

    // --- 3. Update each side, deriving velocity only across a continuous track
    const out = { left: null, right: null }

    for (const side of ['left', 'right']) {
      const st = sides[side]
      const d = assigned[side]

      if (!d) {
        st.tracked = false
        continue
      }

      const dtRaw = (ts - st.t) / 1000
      // A track is continuous only if this side was tracked, the gap is short,
      // and the hand has not teleported. Any of those failing means the number
      // we would compute is not a velocity, so we report zero instead of a
      // fabricated spike.
      const continuous = isContinuous(st, d.point, dtRaw, st.span)

      const res = classifyGesture(d.lm, continuous ? st.lm : null, continuous ? dtRaw : 0.016)
      const { gesture, curled, clenchRatio, fingers } = res

      // Latch a flick briefly: the pose that triggers it lasts one or two frames
      // and the strike it belongs to lasts longer.
      const flickActive = st.flickUntil && ts < st.flickUntil
      const isFlick = res.isFlick || Boolean(flickActive)
      let action = res.action
      if (res.isFlick) action = 'superflick'
      else if (flickActive && action !== 'superpunch') action = 'superflick'
      st.flickUntil = res.isFlick ? ts + 420 : st.flickUntil

      let vx = 0
      let vy = 0
      let vz = 0
      let speed = 0
      if (continuous) {
        vx = (d.point.x - st.x) / dtRaw
        vy = (d.point.y - st.y) / dtRaw
        // Growth of the hand's apparent size is the only depth cue one camera
        // offers. Keep the sign — a hand pulling back is not a hand punching —
        // and scale it down, because span is by far the noisiest of the three.
        vz = ((d.span - st.span) / dtRaw) * 1.6
        speed = Math.hypot(vx, vy, vz)
      }

      st.x = d.point.x
      st.y = d.point.y
      st.lm = d.lm
      st.span = d.span
      st.t = ts
      st.vx = vx
      st.vy = vy
      st.vz = vz
      st.speed = speed
      st.tracked = true

      out[side] = {
        key: side,
        side,
        landmarks: d.lm,
        point: d.point,
        span: d.span,
        bounds: handBounds(d.lm),
        gesture,
        action,
        curled,
        clenchRatio,
        fingers,
        isFlick,
        orientation: handOrientation(d.lm),
        handedness: d.label,
        speed,
        vx,
        vy,
        vz,
        // Priority score, used only to pick which hand drives the single-hand
        // legacy fields below.
        score:
          d.span +
          (gesture === 'fist' ? 0.32 : 0) +
          (action === 'superpunch' ? 0.25 : action === 'superflick' ? 0.2 : 0) +
          Math.min(speed * 0.35, 0.6) +
          (activeHandCategory === side ? 0.28 : 0),
        present: true,
      }
    }

    const leftHand = out.left
    const rightHand = out.right
    const present = Boolean(leftHand || rightHand)
    if (!present) {
      activeHandCategory = null
      return {
        present: false,
        left: null,
        right: null,
        hands: [],
        allLandmarks: hands,
        inferenceMs,
        switchedHand: false,
      }
    }

    const primary =
      leftHand && rightHand ? (leftHand.score >= rightHand.score ? leftHand : rightHand) : leftHand || rightHand

    const switchedHand = activeHandCategory !== null && activeHandCategory !== primary.side
    activeHandCategory = primary.side

    return {
      present: true,
      left: leftHand,
      right: rightHand,
      hands: [leftHand, rightHand].filter(Boolean),
      landmarks: primary.landmarks,
      allLandmarks: hands,
      point: primary.point,
      span: primary.span,
      bounds: primary.bounds,
      gesture: primary.gesture,
      action: primary.action,
      curled: primary.curled,
      clenchRatio: primary.clenchRatio,
      fingers: primary.fingers,
      isFlick: primary.isFlick,
      orientation: primary.orientation,
      handedness: primary.handedness,
      speed: primary.speed,
      activeHandCategory: primary.side,
      switchedHand,
      inferenceMs,
    }
  }

  /**
   * Run inference a few times on a blank frame before the real loop starts.
   *
   * The first detectForVideo call is not like the others: it compiles GPU
   * shaders and allocates buffers, which measured anywhere from 140 ms to over
   * four seconds on a cold page. Paying that while the loading message is still
   * on screen is free. Paying it on the player's first swing is a freeze at the
   * worst possible moment.
   */
  function warmup(frames = 4) {
    const blank = document.createElement('canvas')
    blank.width = CAPTURE.width
    blank.height = CAPTURE.height
    const ctx = blank.getContext('2d')
    ctx.fillStyle = '#808080'
    ctx.fillRect(0, 0, blank.width, blank.height)

    const timings = []
    for (let i = 0; i < frames; i++) {
      detect(blank, performance.now() + i)
      timings.push(inferenceMs)
    }
    return timings
  }

  function close() {
    landmarker.close()
  }

  return { detect, warmup, close }
}
