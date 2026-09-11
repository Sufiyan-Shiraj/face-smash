// Frame-differencing motion detector — the backstop for when landmarks die.
//
// The failure this exists for: motion blur destroys landmark tracking at
// exactly the speeds that are fun to play at. A hard slap is the one input the
// neural net is guaranteed to drop.
//
// Frame differencing has the opposite bias. Blur *smears* a moving object
// across more pixels, so a blurred fast hand produces a LARGER diff than a
// crisp slow one. Where the landmarker is weakest, this is strongest.
//
// Division of labour: landmarks say WHAT gesture, this says HOW FAST and WHERE.

const DEFAULT_W = 80
const DEFAULT_H = 60

export function createMotionField({ width = DEFAULT_W, height = DEFAULT_H } = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  // Without this hint the browser keeps the canvas GPU-side and every
  // getImageData stalls the pipeline on a readback.
  const ctx = canvas.getContext('2d', { willReadFrequently: true })

  const pixelCount = width * height
  // Two buffers, swapped each frame. Allocating a fresh typed array per frame
  // would hand the GC 60 x 4.8 KB every second for no reason.
  let currGray = new Uint8ClampedArray(pixelCount)
  let prevGray = new Uint8ClampedArray(pixelCount)
  let primed = false

  /**
   * @param {HTMLVideoElement} video
   * @param {number} threshold Per-pixel luma delta counted as motion (0-255).
   * @returns {{ energy: number, cx: number, cy: number, valid: boolean }}
   *   energy: fraction of the frame in motion, 0-1.
   *   cx/cy:  centroid of moving pixels in normalized image units.
   */
  function update(video, threshold = 26) {
    ctx.drawImage(video, 0, 0, width, height)
    const { data } = ctx.getImageData(0, 0, width, height)

    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      // Rec. 601 luma, integer-weighted to stay off the float path.
      currGray[p] = (data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) >> 8
    }

    if (!primed) {
      primed = true
      swap()
      return { energy: 0, cx: 0.5, cy: 0.5, valid: false }
    }

    let moved = 0
    let sumX = 0
    let sumY = 0
    let weight = 0

    for (let p = 0; p < pixelCount; p++) {
      const delta = Math.abs(currGray[p] - prevGray[p])
      if (delta > threshold) {
        moved++
        // Weight by delta so the brightest part of the smear pulls the
        // centroid — that tracks the hand rather than its wake.
        sumX += (p % width) * delta
        sumY += ((p / width) | 0) * delta
        weight += delta
      }
    }

    swap()

    const valid = moved > 0
    return {
      energy: moved / pixelCount,
      cx: valid ? sumX / weight / width : 0.5,
      cy: valid ? sumY / weight / height : 0.5,
      valid,
    }
  }

  function swap() {
    const tmp = prevGray
    prevGray = currGray
    currGray = tmp
  }

  function reset() {
    primed = false
  }

  return { update, reset, canvas, width, height }
}
