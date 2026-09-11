// Square crop around the face, sized for Tripo.
//
// Tripo takes a square image. A webcam frame is 4:3 or 16:9, so handing it over
// unmodified means either the pipeline squashes it — and reconstructs a squashed
// head — or it crops somewhere arbitrary. Cropping deliberately, around the face
// we have already located, is the only way to know what it receives.
//
// Deliberately NOT removing the background: Tripo segments the subject itself,
// and a hand-cut matte with a halo around the hair is worse than none.

export const OUTPUT_SIZE = 1024 // Tripo downscales to 512; 1024 leaves headroom
export const JPEG_QUALITY = 0.92

/**
 * @param {HTMLVideoElement|HTMLCanvasElement} source
 * @param {Array<{x:number,y:number}>|null} landmarks Normalized face landmarks,
 *   or null (the back-of-head frame has no detectable face).
 * @param {object} [opts]
 * @param {number} [opts.expand] Multiple of the face box to include — hair and
 *   a little neck, which the reconstruction needs to build a whole head.
 * @param {{cx:number,cy:number,size:number}} [opts.fallbackBox] Used when there
 *   are no landmarks.
 * @returns {{canvas: HTMLCanvasElement, box: object}}
 */
export function cropSquare(source, landmarks, { expand = 1.75, fallbackBox = null } = {}) {
  const sw = source.videoWidth ?? source.width
  const sh = source.videoHeight ?? source.height

  let cx
  let cy
  let size

  if (landmarks?.length) {
    let minX = 1
    let minY = 1
    let maxX = 0
    let maxY = 0
    for (const p of landmarks) {
      if (p.x < minX) minX = p.x
      if (p.y < minY) minY = p.y
      if (p.x > maxX) maxX = p.x
      if (p.y > maxY) maxY = p.y
    }
    cx = ((minX + maxX) / 2) * sw
    // Bias upward: the landmark box stops at the chin and brow, so centring on
    // it cuts the top of the skull off — exactly the part with the hair.
    cy = ((minY + maxY) / 2) * sh - (maxY - minY) * sh * 0.08
    size = Math.max(maxX - minX, maxY - minY) * Math.max(sw, sh) * expand
  } else if (fallbackBox) {
    ;({ cx, cy, size } = fallbackBox)
  } else {
    cx = sw / 2
    cy = sh / 2
    size = Math.min(sw, sh) * 0.8
  }

  size = Math.min(size, Math.max(sw, sh))

  const canvas = document.createElement('canvas')
  canvas.width = OUTPUT_SIZE
  canvas.height = OUTPUT_SIZE
  const ctx = canvas.getContext('2d')

  // Fill first. When the crop runs off the edge of the frame we pad rather than
  // clamp the box — clamping would change the aspect and distort the face, and
  // Tripo removes the background anyway.
  ctx.fillStyle = '#1c1c22'
  ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE)

  const sx = cx - size / 2
  const sy = cy - size / 2
  const scale = OUTPUT_SIZE / size

  // Intersect the requested box with the real frame, then place the overlap at
  // the matching spot in the output.
  const ix = Math.max(sx, 0)
  const iy = Math.max(sy, 0)
  const iw = Math.min(sx + size, sw) - ix
  const ih = Math.min(sy + size, sh) - iy

  if (iw > 0 && ih > 0) {
    ctx.drawImage(
      source,
      ix, iy, iw, ih,
      (ix - sx) * scale, (iy - sy) * scale, iw * scale, ih * scale
    )
  }

  return { canvas, box: { cx, cy, size } }
}

export function toJpegBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY))
}
