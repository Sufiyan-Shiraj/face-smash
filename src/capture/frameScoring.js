// Scoring a candidate frame from the scan video.
//
// Tripo bakes whatever it is given. A blink, a grin, or a smear of motion blur
// becomes a permanent feature of the model, and the player then has to look at
// it through every slap of every run. With hundreds of candidate frames to
// choose from, rejecting bad ones costs nothing.

/** Horizontal head turn, −1 (turned hard one way) → 0 (frontal) → +1. */
export function headTurn(landmarks) {
  let minX = 1
  let maxX = 0
  for (const p of landmarks) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
  }
  const halfWidth = (maxX - minX) / 2
  if (halfWidth < 1e-4) return 0

  // Landmark 1 sits on the nose. As the head turns, the nose slides toward the
  // edge of the face's own bounding box — a ratio, so it is immune to how far
  // the subject is from the lens or how big their head is.
  const noseX = landmarks[1].x
  const centreX = minX + halfWidth
  return Math.max(-1, Math.min(1, (noseX - centreX) / halfWidth))
}

/** Vertical head tilt on the same −1..+1 scale. */
export function headPitch(landmarks) {
  let minY = 1
  let maxY = 0
  for (const p of landmarks) {
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  const half = (maxY - minY) / 2
  if (half < 1e-4) return 0
  return Math.max(-1, Math.min(1, (landmarks[1].y - (minY + half)) / half))
}

/**
 * Variance of the Laplacian — the standard cheap sharpness measure. A blurred
 * frame has little high-frequency content, so its second derivative is flat.
 * @param {ImageData} imageData Grayscale-able RGBA pixels.
 */
export function sharpness(imageData) {
  const { data, width, height } = imageData
  const gray = new Float32Array(width * height)
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    gray[p] = (data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) / 256
  }

  let sum = 0
  let sumSq = 0
  let n = 0
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x
      const lap =
        4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - width] - gray[i + width]
      sum += lap
      sumSq += lap * lap
      n++
    }
  }
  if (!n) return 0
  const mean = sum / n
  return sumSq / n - mean * mean
}

/** Mean brightness and the fraction of pixels crushed or blown out. */
export function exposure(imageData) {
  const { data } = imageData
  let sum = 0
  let clipped = 0
  const n = data.length / 4
  for (let i = 0; i < data.length; i += 4) {
    const luma = (data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) / 256
    sum += luma
    if (luma < 8 || luma > 247) clipped++
  }
  return { mean: sum / n, clipped: clipped / n }
}

export const REJECT = {
  blink: 0.4, // either eye this closed and the avatar blinks forever
  smile: 0.35, // a baked-in grin through every slap of every run
  jawOpen: 0.5,
}

/**
 * @returns {{score: number, reject: string|null, detail: object}}
 *   score is comparable only within a pose bucket.
 */
export function scoreFrame({ landmarks, blend, imageData }) {
  const blink = Math.max(blend.eyeBlinkLeft ?? 0, blend.eyeBlinkRight ?? 0)
  const smile = Math.max(blend.mouthSmileLeft ?? 0, blend.mouthSmileRight ?? 0)
  const jaw = blend.jawOpen ?? 0

  const turn = headTurn(landmarks)
  const pitch = headPitch(landmarks)
  const sharp = imageData ? sharpness(imageData) : 0
  const exp = imageData ? exposure(imageData) : { mean: 128, clipped: 0 }

  let reject = null
  if (blink > REJECT.blink) reject = 'blinking'
  else if (smile > REJECT.smile) reject = 'smiling'
  else if (jaw > REJECT.jawOpen) reject = 'mouth open'

  // Sharpness dominates: a crisp frame with a slightly odd expression beats a
  // blurred neutral one, because Tripo can work with the former.
  const sharpScore = Math.min(sharp / 120, 1)
  const expScore = 1 - Math.min(Math.abs(exp.mean - 128) / 128, 1) - exp.clipped * 0.5
  const calmScore = 1 - (blink + smile + jaw) / 3
  const levelScore = 1 - Math.min(Math.abs(pitch), 1)

  const score = sharpScore * 0.5 + Math.max(expScore, 0) * 0.2 + calmScore * 0.2 + levelScore * 0.1

  return {
    score: reject ? -1 : score,
    reject,
    detail: { blink, smile, jaw, turn, pitch, sharp, exposure: exp.mean },
  }
}
