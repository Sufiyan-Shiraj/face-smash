import * as THREE from 'three'

// Stand a downloaded prop up in the frame the physics already uses.
//
// Every artist models to their own convention: the spoon lies along +Z, the
// sledgehammer stands along +Y, the rock has no orientation at all. The swing
// code cannot care about any of that, so each prop is transformed ONCE, here,
// into the one frame everything else assumes:
//
//     striking head at the origin, handle running back along -Y
//
// which is exactly where striker.face() puts the collider: the body sits at the
// head, and the grip is at local (0, -reach, 0). Get this wrong and the weapon
// renders somewhere other than the thing it collides with, which reads to the
// player as "the game ignored my hit" — or, in the case that prompted this, a
// sledgehammer swinging handle-first with its head up by the player's fist.
//
// MEASURED AT LOAD, IN FINAL SCENE SPACE, and that part is the whole point.
// The obvious shortcut is to inspect each file once, write down which way it
// points, and hardcode that. It silently does not work: glTF geometry sits
// under a node hierarchy that can carry its own rotation, and the baseball bat
// ships with a 90-degree turn on its node. Its raw mesh data says the barrel is
// at +Z while the assembled scene puts it at -Y. Anything derived from the
// buffers alone is therefore correct for five props and inverted for the sixth,
// with nothing to indicate which. Measuring the assembled scene has no such
// failure mode, costs one traversal per weapon, and needs no constants at all.

const Y_UP = new THREE.Vector3(0, 1, 0)
const SLICES = 8
/**
 * How many times longer than it is wide a prop must be before it counts as
 * having a handle.
 *
 * ELONGATION, not girth ratio, and that distinction was found the hard way. The
 * obvious test — "is one end much fatter than the other" — fails on a baseball
 * bat, because a bat has a KNOB: the handle end flares back out to almost the
 * barrel's width, the ratio comes out near 1, and the bat gets classified as a
 * featureless blob and rendered as a 27 cm lump floating below the player's
 * hand. Length-to-width separates the six props cleanly and without a
 * borderline case: bat 14.3, sledgehammer 4.8, spoon 3.2, pan 2.4, then a gap,
 * then rock 1.9 and bananas 1.4.
 */
const HANDLE_ELONGATION = 2.1
/** Vertices sampled per mesh. Enough to find a fat end, cheap on a 25k bunch. */
const SAMPLE_TARGET = 1500

/** Sample vertex positions in the scene's own space. */
function sampleVertices(root) {
  const out = []
  const v = new THREE.Vector3()
  root.updateMatrixWorld(true)
  root.traverse((o) => {
    const pos = o.isMesh && o.geometry?.attributes?.position
    if (!pos) return
    const step = Math.max(1, Math.floor(pos.count / SAMPLE_TARGET))
    for (let i = 0; i < pos.count; i += step) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld)
      out.push(v.x, v.y, v.z)
    }
  })
  return out
}

/**
 * Which way the striking end points, as a unit vector in the prop's own space.
 * Returns null when the prop is a blob with no meaningful direction.
 */
function findHeadAxis(pts) {
  if (pts.length < 9) return null

  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < pts.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      if (pts[i + k] < min[k]) min[k] = pts[i + k]
      if (pts[i + k] > max[k]) max[k] = pts[i + k]
    }
  }

  const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]]
  const L = size.indexOf(Math.max(...size))
  if (size[L] < 1e-6) return null
  const [a, b] = [0, 1, 2].filter((k) => k !== L)

  // A rock and a bunch of bananas have no handle and no end worth leading
  // with. They get held in the fist instead of swung on a rod.
  if (size[L] < Math.max(size[a], size[b]) * HANDLE_ELONGATION) return null

  const midA = (min[a] + max[a]) / 2
  const midB = (min[b] + max[b]) / 2

  // Girth per slice along the long axis: how far the surface sits from the
  // prop's own centreline. Now that elongation has already decided THAT there
  // is a handle, this only has to decide WHICH END — so it compares the outer
  // two slices at each extreme and takes the fatter. Averaging two absorbs the
  // bat's knob, which a single-slice comparison would trip over.
  const girth = new Float64Array(SLICES)
  for (let i = 0; i < pts.length; i += 3) {
    const t = Math.min(Math.floor(((pts[i + L] - min[L]) / size[L]) * SLICES), SLICES - 1)
    const r = Math.hypot(pts[i + a] - midA, pts[i + b] - midB)
    if (r > girth[t]) girth[t] = r
  }

  const lo = (girth[0] + girth[1]) / 2
  const hi = (girth[SLICES - 1] + girth[SLICES - 2]) / 2

  const dir = [0, 0, 0]
  dir[L] = hi > lo ? 1 : -1
  return new THREE.Vector3(...dir)
}

/**
 * @param {THREE.Object3D} scene   The loaded glTF scene (mutated; pass a clone).
 * @param {object} opts
 * @param {number} opts.reach      Grip-to-head rod length, metres.
 * @param {number} opts.headSize   Radius of the striking head's collider.
 * @returns {THREE.Group} A group holding the fitted prop.
 */
export function fitProp(scene, { reach, headSize }) {
  const group = new THREE.Group()
  const pts = sampleVertices(scene)
  const headAxis = findHeadAxis(pts)
  const handled = headAxis !== null && reach > 0.02

  // Turn the striking end to +Y, so -Y runs back down the handle to the grip.
  if (handled) scene.quaternion.setFromUnitVectors(headAxis, Y_UP)

  scene.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(scene)
  const size = new THREE.Vector3()
  box.getSize(size)

  // A handled weapon is scaled so its handle END lands on the grip, which is
  // what makes the hand look like it is holding the thing. A blob has no
  // handle, so it is scaled to its collider and simply sits in the fist.
  const scale = handled
    ? reach / Math.max(size.y, 1e-4)
    : (headSize * 2.2) / Math.max(size.x, size.y, size.z)

  scene.scale.setScalar(scale)
  scene.updateMatrixWorld(true)

  // Re-measure after scaling, then slide the striking end onto the origin.
  const scaled = new THREE.Box3().setFromObject(scene)
  const centre = new THREE.Vector3()
  scaled.getCenter(centre)
  scene.position.set(-centre.x, handled ? -scaled.max.y : -centre.y, -centre.z)

  // Poly Haven ships real-world materials that assume image-based lighting.
  // Without an environment they read as flat grey, so the scene supplies one;
  // this just makes sure nothing arrives with shadows disabled.
  scene.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true
      o.frustumCulled = false
    }
  })

  if (globalThis.__FIT_DEBUG) {
    globalThis.__FIT_DEBUG.push({
      headAxis: headAxis ? headAxis.toArray() : null,
      handled,
      scale,
      rawSize: size.toArray().map((v) => +v.toFixed(3)),
      scaledBox: [scaled.min.toArray(), scaled.max.toArray()].map((a) =>
        a.map((v) => +v.toFixed(3))
      ),
    })
  }

  group.add(scene)
  return group
}


// ---------------------------------------------------------------------------
// Gloves and gauntlets
// ---------------------------------------------------------------------------

const Z_FWD = new THREE.Vector3(0, 0, 1)

/**
 * Fit a glove-shaped asset into the striker's frame: cuff at the origin,
 * knuckles leading along +Z.
 *
 * WHY THIS EXISTS, i.e. what it replaces.
 *
 * The glove used to be placed by hand, and the placement did two damaging
 * things. First it carried a constant nobody could re-derive:
 *
 *     geom.translate(-0.474 + 0.0713 / 0.15, 0, -0.0162 / 0.15)
 *
 * which mixes pre-scale and post-scale units in one expression and only holds
 * for one specific export of one specific file. Second, and much worse, it ran
 * this:
 *
 *     // Filter out the second glove: keep only triangles where x > 0
 *     if (pos.getX(a) > 0 && pos.getX(b) > 0 && pos.getX(c) > 0) ...
 *
 * There is no second glove. The asset is ONE glove lying along its X axis, so
 * that filter did not separate a pair — it cut the glove in half at the waist
 * and deleted the wrist cuff along with 48% of the triangles, leaving an open,
 * hollow mitt. That is the pink blob with a dent in it.
 *
 * So this measures instead, on exactly the same grounds as fitProp above: the
 * long axis is whichever bbox dimension is largest, and the cuff is whichever
 * END of that axis is thinner, because a glove is a fat mitt tapering to a
 * narrow wrist. Verified against both supplied assets — the boxing glove
 * (long axis X, cuff at -X) and the spiked gauntlet (long axis Z, cuff at -Z) —
 * neither of which needed a constant written down.
 *
 * @param {THREE.Object3D} scene  Loaded glTF scene (mutated; pass a clone).
 * @param {object} opts
 * @param {number} opts.length    Cuff-to-knuckle length in world metres.
 * @param {boolean} [opts.mirror] Mirror across X for the left hand.
 * @returns {THREE.Group}
 */
export function fitGlove(scene, { length = 0.22, mirror = false } = {}) {
  const group = new THREE.Group()
  const pts = sampleVertices(scene)

  const axis = findGloveAxis(pts)
  if (axis) scene.quaternion.setFromUnitVectors(axis, Z_FWD)

  scene.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(scene)
  const size = new THREE.Vector3()
  box.getSize(size)

  scene.scale.setScalar(length / Math.max(size.z, 1e-4))
  scene.updateMatrixWorld(true)

  // Re-measure, then put the CUFF on the origin. The striker body is the fist,
  // and the wrist is where the forearm has to meet it, so that is the point the
  // arm solver and this model have to agree on.
  const scaled = new THREE.Box3().setFromObject(scene)
  const centre = new THREE.Vector3()
  scaled.getCenter(centre)
  scene.position.set(-centre.x, -centre.y, -scaled.min.z)

  scene.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true
      o.frustumCulled = false
    }
  })

  group.add(scene)

  // Mirroring a whole group by a negative scale flips winding, so three.js
  // needs told to flip face culling to match; doing it on the group rather than
  // rewriting index buffers keeps the two hands sharing ONE geometry.
  if (mirror) {
    group.scale.x = -1
    group.traverse((o) => {
      if (o.isMesh && o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material]
        for (const m of mats) m.side = THREE.DoubleSide
      }
    })
  }

  return group
}

/** Cuff-to-knuckle direction in the glove's own space, or null for a blob. */
function findGloveAxis(pts) {
  if (pts.length < 9) return null

  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < pts.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      if (pts[i + k] < min[k]) min[k] = pts[i + k]
      if (pts[i + k] > max[k]) max[k] = pts[i + k]
    }
  }
  const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]]
  const L = size.indexOf(Math.max(...size))
  if (size[L] < 1e-6) return null
  const [a, b] = [0, 1, 2].filter((k) => k !== L)

  const midA = (min[a] + max[a]) / 2
  const midB = (min[b] + max[b]) / 2

  const girth = new Float64Array(SLICES)
  for (let i = 0; i < pts.length; i += 3) {
    const t = Math.min(Math.floor(((pts[i + L] - min[L]) / size[L]) * SLICES), SLICES - 1)
    const r = Math.hypot(pts[i + a] - midA, pts[i + b] - midB)
    if (r > girth[t]) girth[t] = r
  }

  // Two slices per end, for the same reason fitProp averages them: a single
  // slice at the very tip is a handful of vertices and reads as noise.
  const lo = (girth[0] + girth[1]) / 2
  const hi = (girth[SLICES - 1] + girth[SLICES - 2]) / 2

  // Knuckles are the FAT end; the cuff is the thin one. +Z must lead with the
  // knuckles, so point away from the cuff.
  const dir = [0, 0, 0]
  dir[L] = hi > lo ? 1 : -1
  return new THREE.Vector3(...dir)
}
