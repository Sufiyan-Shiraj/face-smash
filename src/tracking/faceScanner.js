// MediaPipe Face Landmarker — used ONCE, to pick frames out of the scan video.
//
// This must never run in the same loop as the hand landmarker. Hand tracking is
// the live model during play; this one only runs on the scan route, over a
// video that has already been recorded. That separation is the difference
// between 60 fps and a slideshow.
//
// Because the footage is already captured, there is no realtime budget here. We
// can afford to look at every frame of a 20-second clip — roughly 600 of them —
// and pick the best four, which turns frame selection from a one-shot gamble
// into an offline search.

import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'

const WASM_PATH = '/mediapipe'
const MODEL_PATH = '/models/face_landmarker.task'

export async function createFaceScanner() {
  const fileset = await FilesetResolver.forVisionTasks(WASM_PATH)

  const landmarker = await FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL_PATH, delegate: 'GPU' },
    runningMode: 'VIDEO',
    numFaces: 1,
    // Blendshapes are how we catch a blink or a grin before it gets baked into
    // the model permanently.
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: true,
  })

  let lastTimestamp = -1

  function detect(source, tMs) {
    const ts = tMs <= lastTimestamp ? lastTimestamp + 1 : tMs
    lastTimestamp = ts

    const result = landmarker.detectForVideo(source, ts)
    const landmarks = result.faceLandmarks?.[0]
    if (!landmarks?.length) return { present: false }

    const blend = {}
    for (const c of result.faceBlendshapes?.[0]?.categories ?? []) {
      blend[c.categoryName] = c.score
    }

    return { present: true, landmarks, blend }
  }

  return {
    detect,
    warmup(frames = 3) {
      const c = document.createElement('canvas')
      c.width = 640
      c.height = 480
      const ctx = c.getContext('2d')
      ctx.fillStyle = '#808080'
      ctx.fillRect(0, 0, c.width, c.height)
      for (let i = 0; i < frames; i++) detect(c, performance.now() + i)
    },
    close: () => landmarker.close(),
  }
}
