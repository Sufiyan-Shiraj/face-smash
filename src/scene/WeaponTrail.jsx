import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'

// Motion trail behind the weapon.
//
// This is not decoration. A slap crosses the whole face in about 120 ms, which
// at 60 fps is seven frames — fast enough that the eye gets a sequence of
// disconnected poses rather than a swing, and hits start to feel like they came
// out of nowhere. A trail gives the motion a shape that persists long enough to
// be read, which is the same reason a real camera's motion blur helps.
//
// Built as a screen-facing ribbon: the strip is widened along the axis
// perpendicular to BOTH the direction of travel and the view direction, so it
// always presents its full width to the camera instead of vanishing edge-on
// whenever the player swings toward the lens.

const SAMPLES = 20
const FADE = 0.075 // seconds a sample survives; crisp arcade persistence

const view = new THREE.Vector3()
const dir = new THREE.Vector3()
const side = new THREE.Vector3()

export default function WeaponTrail({ strikerRef, color = '#ff2e88', width = 0.065 }) {
  const meshRef = useRef(null)
  const { camera } = useThree()

  const state = useMemo(() => {
    const positions = new Float32Array(SAMPLES * 2 * 3)
    const alphas = new Float32Array(SAMPLES * 2)
    const indices = []
    for (let i = 0; i < SAMPLES - 1; i++) {
      const a = i * 2
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
    return {
      positions,
      alphas,
      indices: new Uint16Array(indices),
      // Ring of recent centre points, newest last.
      trail: Array.from({ length: SAMPLES }, () => ({ x: 0, y: 0, z: 0, age: Infinity })),
    }
  }, [])

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(state.positions, 3))
    g.setAttribute('aAlpha', new THREE.BufferAttribute(state.alphas, 1))
    g.setIndex(new THREE.BufferAttribute(state.indices, 1))
    return g
  }, [state])

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: { uColor: { value: new THREE.Color(color) } },
        vertexShader: `
          attribute float aAlpha;
          varying float vAlpha;
          void main() {
            vAlpha = aAlpha;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 uColor;
          varying float vAlpha;
          void main() {
            if (vAlpha <= 0.001) discard;
            // Hot luminous core inside saturated neon fringe
            vec3 core = vec3(1.0, 0.95, 0.85);
            vec3 col = mix(uColor, core, pow(vAlpha, 1.6) * 0.8);
            gl_FragColor = vec4(col, vAlpha);
          }
        `,
      }),
    [color]
  )

  useFrame((_, delta) => {
    const striker = strikerRef.current
    const mesh = meshRef.current
    if (!striker || !mesh) return

    const dt = Math.min(delta, 0.05)
    const p = striker.position

    // Parked between swings. Drop the history rather than drawing a streak from
    // the last hit to somewhere under the floor.
    const parked = p.y < -10
    for (const s of state.trail) s.age += dt

    if (!parked) {
      // Shift newest-last and append. SAMPLES is 16, so the copy is cheaper
      // than the bookkeeping a ring index would need in the strip builder.
      for (let i = 0; i < SAMPLES - 1; i++) {
        const a = state.trail[i]
        const b = state.trail[i + 1]
        a.x = b.x
        a.y = b.y
        a.z = b.z
        a.age = b.age
      }
      const head = state.trail[SAMPLES - 1]
      head.x = p.x
      head.y = p.y
      head.z = p.z
      head.age = 0
    }

    // Scratch vectors live outside the loop: this runs every frame, and three
    // fresh Vector3s per frame is 180 allocations a second for nothing.
    camera.getWorldDirection(view)

    for (let i = 0; i < SAMPLES; i++) {
      const s = state.trail[i]
      const next = state.trail[Math.min(i + 1, SAMPLES - 1)]
      const prev = state.trail[Math.max(i - 1, 0)]

      dir.set(next.x - prev.x, next.y - prev.y, next.z - prev.z)
      if (dir.lengthSq() < 1e-10) dir.set(1, 0, 0)
      side.crossVectors(dir, view)
      if (side.lengthSq() < 1e-10) side.set(0, 1, 0)
      side.normalize()

      // Taper to a point at the tail so the ribbon ends rather than stopping.
      const along = i / (SAMPLES - 1)
      const fade = Math.max(0, 1 - s.age / FADE)
      const w = width * along * Math.pow(fade, 0.6) * 0.75

      const o = i * 6
      state.positions[o] = s.x + side.x * w
      state.positions[o + 1] = s.y + side.y * w
      state.positions[o + 2] = s.z + side.z * w
      state.positions[o + 3] = s.x - side.x * w
      state.positions[o + 4] = s.y - side.y * w
      state.positions[o + 5] = s.z - side.z * w

      const a = along * fade * 0.75
      state.alphas[i * 2] = a
      state.alphas[i * 2 + 1] = a
    }

    geometry.attributes.position.needsUpdate = true
    geometry.attributes.aAlpha.needsUpdate = true
    geometry.computeBoundingSphere()
  })

  return <mesh ref={meshRef} geometry={geometry} material={material} frustumCulled={false} />
}
