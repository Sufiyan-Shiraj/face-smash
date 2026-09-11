// Real 3D assets, and where they come from.
//
// SOURCE: Poly Haven (polyhaven.com), everything CC0.
//
// CC0 is the reason this list exists at all. It is public domain: no
// attribution required, commercial use fine, redistribution fine — which means
// these files can be committed or vendored into public/ rather than fetched
// from someone else's server at runtime. That matters more than it sounds,
// because the whole asset story here is "venue wifi is hostile, so the app must
// never need the network to start". A CC-BY-NC pack would have forced a
// runtime CDN fetch or a licensing problem; CC0 lets the download happen once,
// at install time. Credit is not required but the authors are named below
// anyway, because they did the work.
//
// The API is public and keyless:
//   https://api.polyhaven.com/files/<slug>  →  per-format, per-resolution URLs
//
// 1k textures on purpose. These props are 10-20 cm of screen space during a
// 120 ms swing; 4k maps would quadruple the download to buy detail nobody can
// see while the thing is moving.

/**
 * Poly Haven slug → local folder under public/models/props/.
 *
 * Deliberately just a slug and a credit. Which way each prop points and how big
 * it is are NOT recorded here: they are measured from the assembled scene at
 * load time by fitProp(), because a glTF node can carry its own rotation and
 * the baseball bat does. Constants written down from the raw mesh data would be
 * right for five of these six and silently inverted for the other.
 */
export const PROPS = [
  { slug: 'wooden_spoon', author: 'Ronnie Barter' },
  { slug: 'bananas', author: 'Alexander Shulha' },
  { slug: 'rock_07', author: 'Jenelle van Heerden' },
  { slug: 'sledgehammer_01', author: 'Dylan Guzman' },
  { slug: 'brass_pan_01', author: 'Rico Cilliers' },
  { slug: 'baseball_bat', author: 'Enrique Martín' },
]

export const PROP_BY_SLUG = Object.fromEntries(PROPS.map((p) => [p.slug, p]))

/**
 * Environment map. One HDRI replaces the three-point rig for everything
 * reflective — the sledgehammer head, the brass pan, the spoon — which is the
 * single biggest visual difference between "untextured primitive" and "object".
 * A workshop, because that is where the vise is bolted down.
 */
export const ENVIRONMENT = { slug: 'aircraft_workshop_01', res: '1k' }

export const PROP_DIR = '/models/props'
export const ENV_PATH = `/models/env/${ENVIRONMENT.slug}_${ENVIRONMENT.res}.hdr`

/** Runtime path to a prop's glTF. */
export function propUrl(slug) {
  return `${PROP_DIR}/${slug}/${slug}_1k.gltf`
}
