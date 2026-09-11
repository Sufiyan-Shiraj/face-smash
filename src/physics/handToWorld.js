// Image-space hand position → world-space striker target.
//
// THE STRIKE SHELL
//
// A single camera cannot measure depth reliably. Hand span is the only cue
// available and it is noisy, so if depth were taken literally most swings would
// pass in front of or behind the head and land nothing. Worse, the player gets
// no feedback about why: a whiff caused by a depth error is invisible, and
// reads as broken tracking.
//
// So depth is clamped to a shell around the head. Any swing across the head's
// screen position genuinely connects. What depth still does is modulate how
// hard: a hand driving toward the lens grows, gains forward velocity, and hits
// harder. It just cannot cause a miss.
//
// The contact itself stays entirely real — Rapier decides if, when and where.
// We are only constraining where the striker is allowed to be.
//
// THE INSET, which is the fix for "my hand leaves the webcam and it glitches".
//
// Mapping image 0..1 straight onto the play area means the only way to reach
// the edge of the play area is to put your hand on the edge of the CAMERA
// FRAME — which is the exact place hand tracking stops working. Landmarks go
// unstable as fingers clip the border, then vanish entirely, so the most
// natural thing a player does (swing wide) is the thing that breaks tracking.
//
// So the play area is mapped from the MIDDLE of the image instead. With an
// inset of 0.16, the central 68% of what the camera sees covers the whole
// reachable area, and the outer band is slack the player can overshoot into
// without ever leaving frame. It also multiplies hand movement by ~1.5x, so
// swings need less arm travel — which is the same reason mouse sensitivity
// exists.
//
// THE ASPECT FIX, which is why moving your hand diagonally now moves the glove
// diagonally.
//
// MediaPipe reports landmarks in normalized image coordinates: x and y both run
// 0..1, over a frame that is 960x540. One unit of x is therefore 960 pixels of
// real width and one unit of y is 540 pixels of real height — they are NOT the
// same physical distance, and treating them as if they were is what made this
// feel wrong.
//
// The old code mapped x across the VIEWPORT's half-width and y across its
// half-height. Working it through, horizontal hand motion ended up scaled by
// (viewport aspect / camera aspect) relative to vertical. That is exactly 1.0
// when the browser window happens to be 16:9 and wrong everywhere else — 0.90
// at 1440x900, 0.75 at 4:3. So a hand moving at 45 degrees drove the glove at
// 37 degrees, every swing landed slightly off where it was aimed, and resizing
// the window silently changed the aim.
//
// Now the image is mapped ISOTROPICALLY: one scale factor for both axes,
// derived from the camera's own aspect ratio, sized to fit inside the viewport.
// Diagonal in, diagonal out, at any window size.
//
// Pure maths, no three.js, so it is testable headlessly.

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)

function normalize(v) {
  const len = Math.hypot(v.x, v.y, v.z) || 1
  return { x: v.x / len, y: v.y / len, z: v.z / len }
}

function cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  }
}

/**
 * @param {object} opts
 * @param {{x,y,z}} opts.cameraPosition
 * @param {{x,y,z}} opts.headPosition   Also the centre of the strike shell.
 * @param {number} opts.fov             Vertical field of view, in degrees.
 * @param {number} opts.aspect          Viewport width / height.
 * @param {number} [opts.sourceAspect]  Aspect ratio of the IMAGE the landmarks
 *   came from. This is what keeps the mapping isotropic; it is a different
 *   number from `aspect` and confusing the two is the bug described above.
 * @param {number} [opts.shell]         Half-thickness of the depth band, metres.
 * @param {number} [opts.referenceSpan] Hand span (normalized image units) that
 *   corresponds to the head's own depth plane. Used to seed the adaptive
 *   baseline below.
 * @param {number} [opts.depthGain]     Metres of depth per unit of span ratio.
 * @param {boolean} [opts.mirror]       Selfie view: flip x.
 * @param {number} [opts.inset]         Fraction of the image trimmed from each
 *   edge before mapping to the play area. 0 maps the whole frame; higher keeps
 *   the player's hand further inside it. See the note above.
 * @param {boolean} [opts.adaptDepth]   Track a slow baseline of hand span so
 *   depth is measured against THIS player at THIS distance.
 */
export function createHandProjector({
  cameraPosition,
  headPosition,
  fov = 45,
  aspect = 4 / 3,
  sourceAspect = 16 / 9,
  shell = 0.28,
  referenceSpan = 0.12,
  depthGain = 0.26,
  mirror = true,
  inset = 0,
  restOffset = 0.040,
  yCenterOffset = 0,
  adaptDepth = true,
  playHalfHeight = 0,
}) {
  // Width of the inset window, in normalized image units. Named for what it is
  // rather than `span`, which is already the HAND span inside project() — the
  // shadowed version silently divided image coordinates by 0.12 and threw the
  // striker several metres off screen.
  const windowSpan = Math.max(1 - inset * 2, 0.05)
  const worldUp = { x: 0, y: 1, z: 0 }

  const getCam = () => (typeof cameraPosition === 'function' ? cameraPosition() : cameraPosition)

  // Adaptive depth baseline. A hardcoded referenceSpan assumes every player has
  // the same size hands and sits at the same distance from the lens; anyone
  // closer than that reads as permanently mid-punch and anyone further away can
  // never generate a punch at all. This tracks the player's own resting span on
  // a slow time constant — slow enough that a real punch (which lasts ~120 ms)
  // moves it barely at all, fast enough to follow someone leaning in over a
  // second or two.
  let spanBaseline = referenceSpan

  function getBasis() {
    const cam = getCam()
    const forward = normalize({
      x: headPosition.x - cam.x,
      y: headPosition.y - cam.y,
      z: headPosition.z - cam.z,
    })
    const right = normalize(cross(forward, worldUp))
    const up = normalize(cross(right, forward))
    const distance = Math.hypot(
      headPosition.x - cam.x,
      headPosition.y - cam.y,
      headPosition.z - cam.z
    )
    const viewHalfHeight = distance * Math.tan((fov * Math.PI) / 360)
    const viewHalfWidth = viewHalfHeight * aspect

    // One isotropic scale for the whole image. `scale` is world metres per unit
    // of normalized image HEIGHT; a unit of normalized image WIDTH is
    // sourceAspect times longer in the real world, so it gets that factor.
    //
    // playHalfHeight fixes the play area to a size in METRES rather than
    // deriving it from the viewport. Deriving it from the viewport had two
    // problems. The obvious one: resizing the browser window changed how far the
    // player had to move their hand to reach the same place, so the aim they had
    // just learned stopped being correct. The worse one: at 16:9 it worked out
    // to a box 1.7 m wide, and a player's arm attached at the shoulder cannot
    // cover 85 cm to either side — so the arms were permanently stretched out
    // to their limit trying, which is most of why they looked wrong.
    const scale = playHalfHeight > 0
      ? playHalfHeight
      : Math.min(viewHalfWidth / sourceAspect, viewHalfHeight)
    const halfWidth = scale * sourceAspect
    const halfHeight = scale

    return { forward, right, up, distance, halfHeight, halfWidth, viewHalfHeight, viewHalfWidth }
  }

  /**
   * @param {object} hand
   * @param {number} hand.x Normalized image x, 0..1, unmirrored.
   * @param {number} hand.y Normalized image y, 0..1, top-down.
   * @param {number} [hand.span] Hand span in normalized image units.
   * @param {number} [hand.lunge] Extra metres to drive along the view axis, on
   *   top of the depth cue. Applied along `forward`, not along world Z, so it
   *   stays correct when the camera orbits.
   * @param {number} [hand.dt] Seconds since the last call, for the adaptive
   *   depth baseline. Omit to leave the baseline untouched.
   */
  function project({ x, y, span = referenceSpan, lunge = 0, dt = 0 }) {
    const { forward, right, up, halfHeight, halfWidth } = getBasis()

    // Landmarks arrive unmirrored; the player sees a mirrored selfie view, so
    // their left hand must appear on the left of the screen.
    const ix = mirror ? 1 - x : x

    // Image space (0..1, y down) → inset window → NDC (-1..1, y up).
    //
    // yCenterOffset used to be subtracted BEFORE the division, which shifted the
    // whole range rather than re-centring it: the play area slid down and the
    // top of it became unreachable. It is a centre shift, so it belongs after.
    const nx = ((ix - inset) / windowSpan) * 2 - 1
    const ny = -((((y - inset) / windowSpan) * 2 - 1) + yCenterOffset * 2)

    // --- Depth -------------------------------------------------------------
    if (adaptDepth && dt > 0) {
      // ~1.6 s time constant.
      const k = 1 - Math.exp(-0.6 * Math.min(dt, 0.5))
      spanBaseline += (span - spanBaseline) * k
      // Never let the baseline run away to a value that makes depth meaningless.
      spanBaseline = clamp(spanBaseline, referenceSpan * 0.45, referenceSpan * 2.4)
    }
    const ref = adaptDepth ? spanBaseline : referenceSpan

    // A bigger hand is an extended punch — driving toward the target in the
    // direction of `forward`. Clamped to the shell, so it shifts the impact and
    // connects square.
    const depth = clamp((span / ref - 1) * depthGain, -shell, shell)

    // Base interaction plane sits slightly in front of the head
    // (- forward * restOffset), and expanding span drives the punch forward
    // into the face along +forward * depth.
    const forwardOffset = depth - restOffset + lunge

    return {
      x: headPosition.x + right.x * nx * halfWidth + up.x * ny * halfHeight + forward.x * forwardOffset,
      y: headPosition.y + right.y * nx * halfWidth + up.y * ny * halfHeight + forward.y * forwardOffset,
      z: headPosition.z + right.z * nx * halfWidth + up.z * ny * halfHeight + forward.z * forwardOffset,
    }
  }

  /** Drop the learned depth baseline — call when tracking restarts. */
  function resetDepth() {
    spanBaseline = referenceSpan
  }

  return { project, basis: getBasis, resetDepth, get spanBaseline() { return spanBaseline } }
}
