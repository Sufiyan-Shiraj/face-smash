// Deciding which detection is the left hand and which is the right.
//
// This is separated from handTracker.js for one reason: handTracker imports the
// MediaPipe wasm and therefore cannot be loaded outside a browser, and this is
// the single most bug-prone piece of the whole tracking path. Pulling it out
// makes it testable headlessly (scripts/tracking-sim.mjs).
//
// Two bugs lived here, and between them they account for most of what "the
// detection is flaky" described.
//
// 1. THE LABEL IS REPORTED MIRRORED.
//
//    MediaPipe documents handedness as being decided "assuming the input image
//    is mirrored" — a selfie view. The <video> element carries the RAW camera
//    stream; getUserMedia does not mirror, and nothing mirrors it before
//    inference. The mirroring the player sees is applied later, in the projector
//    and in CSS. So every label arrives inverted.
//
//    The old code combined the inverted label with a CORRECT geometric test:
//
//        const isLeft = c.handedness === 'Left' || c.point.x > 0.5
//
//    Those two clauses contradict each other on every frame. With one hand up
//    the OR makes everything "left"; with two hands up both could claim the same
//    side, leaving the other arm frozen.
//
// 2. IDENTITY WAS RECOMPUTED FROM SCRATCH EVERY FRAME.
//
//    Sides were assigned by sorting detections on image x, per frame, with no
//    memory. When hands cross, overlap, or one turns over, the order flips — and
//    since velocity was differenced against "the same side" from the previous
//    frame, a flip differenced one hand's position against the OTHER hand's.
//    Two hands 30 cm apart at 60 fps look like 18 m/s, which clears any fire
//    threshold, so crossing your hands manufactured a strike.
//
// The fix for both: trust the label only where it is trustworthy, prefer
// geometry otherwise, and keep identities continuous over time.

/**
 * Fastest apparent hand motion, in hand-spans per second, still believed to be
 * one continuous hand.
 *
 * A limit in spans per second rather than in raw image distance, for the same
 * reason the detector's thresholds are: it holds at any distance from the camera
 * and at any frame rate. A fixed distance cap cannot do that — 0.32 of a frame
 * is a plausible move in 33 ms and an impossible one in 8 ms, and it silently
 * lets an identity swap through whenever the two hands happen to be closer
 * together than the cap.
 *
 * For scale: tuning.js fires a strike at 8 spans/s and treats 34 as maximum
 * strength. 55 leaves headroom above anything a person can actually do, while
 * still rejecting the ~150 that an identity swap invents.
 */
export const MAX_TRACK_SPEED = 55

/** Backstop for pathologically small dt, in normalized image units. */
export const MAX_TRACK_JUMP = 0.32

/** How much better a swapped assignment must be before it is accepted. */
const SWAP_MARGIN = 0.06

/** How close a detection must be to a recent track to inherit its side. */
const REACQUIRE_RADIUS = 0.18

/** How stale a track may be and still claim a detection, in milliseconds. */
const REACQUIRE_MS = 250

/**
 * Convert a MediaPipe handedness label into the player's actual side.
 * @param {string|null} label 'Left' | 'Right' as MediaPipe reports it.
 * @param {boolean} [inputIsMirrored] True if the frame fed to MediaPipe was
 *   already mirrored. For a raw getUserMedia stream this is false, which is the
 *   case that needs the swap.
 * @returns {'left'|'right'|null}
 */
export function playerSideFromLabel(label, inputIsMirrored = false) {
  if (label !== 'Left' && label !== 'Right') return null
  const asSeen = label === 'Left' ? 'left' : 'right'
  return inputIsMirrored ? asSeen : asSeen === 'left' ? 'right' : 'left'
}

/**
 * In the raw, unmirrored frame the camera faces the player, so the player's
 * left hand appears on the right of the image.
 */
export const sideFromPosition = (point) => (point.x > 0.5 ? 'left' : 'right')

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)

/**
 * Assign detections to sides.
 *
 * @param {Array<{point:{x:number,y:number}, label:'left'|'right'|null, score?:number}>} detections
 * @param {{left:{x,y,t,tracked}, right:{x,y,t,tracked}}} tracks Previous state.
 * @param {number} now Milliseconds.
 * @returns {{left:object|null, right:object|null}}
 */
export function assignSides(detections, tracks, now) {
  const out = { left: null, right: null }
  if (!detections || detections.length === 0) return out

  if (detections.length >= 2) {
    // Keep the two the model is most sure about if it over-reports.
    const sorted = [...detections].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    const [a, b] = sorted

    if (a.label && b.label && a.label !== b.label) {
      // The model committed to two DIFFERENT hands. That is the one case its
      // labels are reliable, because it had to distinguish them.
      out[a.label] = a
      out[b.label] = b
    } else {
      // It hedged, or claimed both detections are the same hand. Geometry is a
      // better witness than a confused classifier.
      const byX = [a, b].sort((p, q) => q.point.x - p.point.x)
      out.left = byX[0]
      out.right = byX[1]
    }

    // Continuity. If both sides were being tracked and this assignment would
    // swap them, only accept the swap when it is clearly the better match —
    // otherwise two hands passing near each other trade identities for a few
    // frames, and both report an enormous jump when they trade back.
    if (tracks.left.tracked && tracks.right.tracked) {
      const keep = dist(out.left.point, tracks.left) + dist(out.right.point, tracks.right)
      const swap = dist(out.left.point, tracks.right) + dist(out.right.point, tracks.left)
      if (swap < keep - SWAP_MARGIN) {
        const t = out.left
        out.left = out.right
        out.right = t
      }
    }
    return out
  }

  // --- One hand. The label is least reliable here, because the model never had
  // to tell two hands apart, so a live track gets the first say. ---
  const d = detections[0]
  const near = (st) =>
    st.tracked && now - st.t < REACQUIRE_MS && dist(d.point, st) < REACQUIRE_RADIUS

  let side
  if (near(tracks.left) && !near(tracks.right)) side = 'left'
  else if (near(tracks.right) && !near(tracks.left)) side = 'right'
  else side = d.label ?? sideFromPosition(d.point)

  out[side] = d
  return out
}

/**
 * Is a track continuous enough to differentiate for velocity?
 *
 * Answering "no" here is what stops the detector fabricating strikes. A gap, a
 * teleport, or a fresh acquisition all mean the difference between this sample
 * and the last one is not a velocity, and reporting zero is strictly better than
 * reporting a number that will fire the detector.
 */
export function isContinuous(track, point, dtSec, span = 0.12) {
  if (!track.tracked || dtSec <= 0.004 || dtSec >= 0.25) return false
  const jump = Math.hypot(point.x - track.x, point.y - track.y)
  if (jump >= MAX_TRACK_JUMP) return false
  const spansPerSecond = jump / dtSec / Math.max(span, 1e-4)
  return spansPerSecond < MAX_TRACK_SPEED
}
