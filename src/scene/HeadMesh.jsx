import { useFrame } from '@react-three/fiber'
import { Component, forwardRef, Suspense, useEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

import { REGIONS } from '../physics/head.js'
import { reportHeadModelFailure } from '../capture/headModel.js'

const HEAD_GLB = '/models/head_opt.glb'
export const DUMMY_GLB = '/base_basic_shaded.glb'
export const SREEKUTTY_GLB = '/sreekutty_shaded.glb'
export const MATHAYI_GLB = '/mathayi_shaded.glb'

export function ScannedHead({ onBeforeCompile, url = HEAD_GLB }) {
  const { scene } = useGLTF(url)

  // Clean horizontal clipping plane positioned right at the collar clamp transition
  const clipPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.18), [])

  const head = useMemo(() => {
    const clone = scene.clone(true)
    clone.traverse((child) => {
      if (child.isMesh) {
        // High-poly visual mesh receives shadows and light, while proxy below casts shadow
        child.castShadow = false
        child.receiveShadow = true
        if (child.material) {
          const mat = child.material.clone()
          mat.clippingPlanes = [clipPlane]
          mat.clipShadows = true
          mat.roughness = Math.min(mat.roughness ?? 0.65, 0.58)
          mat.metalness = Math.max(mat.metalness ?? 0.05, 0.02)
          mat.onBeforeCompile = onBeforeCompile
          child.material = mat
        }
      }
    })
    return clone
  }, [scene, onBeforeCompile, clipPlane])

  return (
    <group>
      {/* 3D Scanned Head: lifted so chin and jaw sit proudly above the collar clamp */}
      <primitive
        object={head}
        scale={0.285}
        position={[0, -0.290, -0.045]}
        rotation={[0, 0, 0]}
      />
      {/* Ultra-efficient low-poly shadow proxy caster for 60+ FPS */}
      <mesh position={[0, 0.04, 0]} castShadow>
        <sphereGeometry args={[0.11, 16, 12]} />
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  )
}

export function DummyHead({ onBeforeCompile, url = DUMMY_GLB }) {
  const { scene } = useGLTF(url)

  // Clean horizontal clipping plane positioned right at the collar clamp transition
  const clipPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.18), [])

  const head = useMemo(() => {
    const clone = scene.clone(true)
    clone.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = false
        child.receiveShadow = true
        if (child.material) {
          const mat = child.material.clone()
          mat.clippingPlanes = [clipPlane]
          mat.clipShadows = true
          // Ensure baseColor map is set if texture was in emissiveMap
          if (!mat.map && mat.emissiveMap) {
            mat.map = mat.emissiveMap
            mat.color.setRGB(1, 1, 1)
          }
          mat.roughness = Math.min(mat.roughness ?? 0.60, 0.55)
          mat.metalness = Math.max(mat.metalness ?? 0.05, 0.02)
          mat.onBeforeCompile = onBeforeCompile
          child.material = mat
        }
      }
    })
    return clone
  }, [scene, onBeforeCompile, clipPlane])

  return (
    <group>
      {/* 3D Base Dummy Head: positioned to align head, chin, and nose proudly above clamp */}
      <primitive
        object={head}
        scale={0.285}
        position={[0.012, -0.325, -0.035]}
        rotation={[0, 0, 0]}
      />
      {/* Ultra-efficient low-poly shadow proxy caster for 60+ FPS */}
      <mesh position={[0, 0.04, 0]} castShadow>
        <sphereGeometry args={[0.11, 16, 12]} />
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  )
}

export function SreekuttyHead({ onBeforeCompile, url = SREEKUTTY_GLB }) {
  const { scene } = useGLTF(url)

  // Clean horizontal clipping plane positioned right at the collar clamp transition
  const clipPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.18), [])

  const head = useMemo(() => {
    const clone = scene.clone(true)
    clone.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = false
        child.receiveShadow = true
        if (child.material) {
          const mat = child.material.clone()
          mat.clippingPlanes = [clipPlane]
          mat.clipShadows = true
          // Ensure baseColor map is set if texture was in emissiveMap
          if (!mat.map && mat.emissiveMap) {
            mat.map = mat.emissiveMap
            mat.color.setRGB(1, 1, 1)
          }
          mat.roughness = Math.min(mat.roughness ?? 0.60, 0.55)
          mat.metalness = Math.max(mat.metalness ?? 0.05, 0.02)
          mat.onBeforeCompile = onBeforeCompile
          child.material = mat
        }
      }
    })
    return clone
  }, [scene, onBeforeCompile, clipPlane])

  return (
    <group>
      {/* 3D Sreekutty Head: positioned to align head, chin, and nose proudly above clamp */}
      <primitive
        object={head}
        scale={0.285}
        position={[0.005, -0.305, -0.035]}
        rotation={[0, 0, 0]}
      />
      {/* Ultra-efficient low-poly shadow proxy caster for 60+ FPS */}
      <mesh position={[0, 0.04, 0]} castShadow>
        <sphereGeometry args={[0.11, 16, 12]} />
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  )
}

export function MathayiHead({ onBeforeCompile, url = MATHAYI_GLB }) {
  const { scene } = useGLTF(url)

  // Clean horizontal clipping plane positioned right at the collar clamp transition
  const clipPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.18), [])

  const head = useMemo(() => {
    const clone = scene.clone(true)
    clone.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = false
        child.receiveShadow = true
        if (child.material) {
          const mat = child.material.clone()
          mat.clippingPlanes = [clipPlane]
          mat.clipShadows = true
          // Ensure baseColor map is set if texture was in emissiveMap
          if (!mat.map && mat.emissiveMap) {
            mat.map = mat.emissiveMap
            mat.color.setRGB(1, 1, 1)
          }
          mat.roughness = Math.min(mat.roughness ?? 0.60, 0.55)
          mat.metalness = Math.max(mat.metalness ?? 0.05, 0.02)
          mat.onBeforeCompile = onBeforeCompile
          child.material = mat
        }
      }
    })
    return clone
  }, [scene, onBeforeCompile, clipPlane])

  return (
    <group>
      {/* 3D Mathayi Head: positioned to align head, chin, and nose proudly above clamp */}
      <primitive
        object={head}
        scale={0.285}
        position={[0.005, -0.315, -0.035]}
        rotation={[0, 0, 0]}
      />
      {/* Ultra-efficient low-poly shadow proxy caster for 60+ FPS */}
      <mesh position={[0, 0.04, 0]} castShadow>
        <sphereGeometry args={[0.11, 16, 12]} />
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  )
}

const MAX_IMPACTS = 8

// Damped-spring recovery for dynamic punch dents
const DECAY = 9
const WOBBLE = 26

// Visual neck recoil on impact
const RECOIL_SPRING = 190
const RECOIL_DAMP = 15
const RECOIL_PER_STRENGTH = 0.028

const at = (id) => REGIONS.find((r) => r.id === id).at
const shape = (id) => REGIONS.find((r) => r.id === id).shape

// Color palette for stylized character bust
const SKIN_BASE = '#dba07d'
const SKIN_WARM = '#cc8d69'
const SKIN_BLUSH = '#d97f6c'
const SKIN_SHADOW = '#b97957'
const LIP_COLOR = '#ad5555'
const HAIR_DARK = '#1a1412'
const HAIR_HIGHLIGHT = '#2e2420'
const EYE_SCLERA = '#f4efe8'
const IRIS_PRIMARY = '#3878b8'
const IRIS_DARK = '#1e4368'
const PUPIL_BLACK = '#0d0d12'

/**
 * Stylized 3D character bust.
 * Aligned with physics colliders in REGIONS and driven by the squash shader and recoil spring.
 */

/**
 * Catches a model that fails to LOAD and shows the stand-in head instead.
 *
 * Suspense is not enough, and the difference is the whole reason this class
 * exists. Suspense handles a promise that is PENDING; a promise that REJECTS
 * throws during render and sails straight past it to the nearest error
 * boundary. With no boundary of our own that was React Router's, so a head that
 * failed to download took down the entire route — measured: canvas gone, HUD
 * gone, "Unexpected Application Error" on screen, game over.
 *
 * That is an unacceptable failure mode for something whose URL is a signed link
 * to a third-party service. It can fail because the job expired, because the
 * network blinked, because the account ran out of credit mid-run, or because
 * the GLB came back malformed. None of those are reasons to stop the player
 * punching a head.
 *
 * React has no hook form of this, which is the only reason it is a class.
 */
class HeadModelBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error) {
    // drei caches the rejected promise against the URL, so without clearing it
    // every later attempt at the same head re-throws the stale failure.
    try {
      if (this.props.url) useGLTF.clear(this.props.url)
    } catch {
      // Clearing is best-effort; never let cleanup mask the original failure.
    }
    reportHeadModelFailure(error?.message || 'the generated head could not be loaded')
  }

  componentDidUpdate(prev) {
    // A new URL deserves a fresh attempt.
    if (prev.url !== this.props.url && this.state.failed) this.setState({ failed: false })
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

const HeadMesh = forwardRef(function HeadMesh(
  { impactsRef, variant = 'scanned', modelUrl = HEAD_GLB },
  ref
) {
  const recoilRef = useRef(null)

  const slots = useMemo(
    () =>
      Array.from({ length: MAX_IMPACTS }, () => ({
        point: new THREE.Vector3(),
        dir: new THREE.Vector3(0, 0, -1),
        amp: 0,
        t: 0,
      })),
    []
  )
  const uImpacts = useMemo(
    () => ({ value: Array.from({ length: MAX_IMPACTS }, () => new THREE.Vector4()) }),
    []
  )
  const uDirs = useMemo(
    () => ({ value: Array.from({ length: MAX_IMPACTS }, () => new THREE.Vector3(0, 0, -1)) }),
    []
  )
  const cursor = useRef(0)

  const recoil = useMemo(() => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 }), [])

  useEffect(() => {
    if (!impactsRef) return
    impactsRef.current = {
      add(localPoint, strength, localDir) {
        const slot = slots[cursor.current]
        cursor.current = (cursor.current + 1) % MAX_IMPACTS
        slot.point.set(localPoint.x, localPoint.y, localPoint.z)
        if (localDir) slot.dir.set(localDir.x, localDir.y, localDir.z).normalize()
        slot.amp = strength
        slot.t = 0

        const d = localDir ?? { x: 0, y: 0, z: -1 }
        const k = strength * RECOIL_PER_STRENGTH * RECOIL_SPRING * 0.06
        recoil.vx += d.x * k
        recoil.vy += d.y * k
        recoil.vz += d.z * k
      },
    }
    return () => {
      if (impactsRef) impactsRef.current = null
    }
  }, [impactsRef, slots, recoil])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)

    for (let i = 0; i < MAX_IMPACTS; i++) {
      const s = slots[i]
      const out = uImpacts.value[i]
      if (s.amp <= 0.0005) {
        out.set(0, 0, 0, 0)
        continue
      }
      s.t += dt
      const envelope = Math.exp(-s.t * DECAY) * Math.cos(s.t * WOBBLE)
      out.set(s.point.x, s.point.y, s.point.z, s.amp * envelope)
      uDirs.value[i].copy(s.dir)
      if (s.t > 0.6) s.amp = 0
    }

    recoil.vx += (-RECOIL_SPRING * recoil.x - RECOIL_DAMP * recoil.vx) * dt
    recoil.vy += (-RECOIL_SPRING * recoil.y - RECOIL_DAMP * recoil.vy) * dt
    recoil.vz += (-RECOIL_SPRING * recoil.z - RECOIL_DAMP * recoil.vz) * dt
    recoil.x += recoil.vx * dt
    recoil.y += recoil.vy * dt
    recoil.z += recoil.vz * dt

    const limit = RECOIL_PER_STRENGTH * 1.6
    const len = Math.hypot(recoil.x, recoil.y, recoil.z)
    if (len > limit) {
      const k = limit / len
      recoil.x *= k
      recoil.y *= k
      recoil.z *= k
    }

    if (recoilRef.current) recoilRef.current.position.set(recoil.x, recoil.y, recoil.z)
  })

  // Vertex displacement shader for punch impacts and squash
  const onBeforeCompile = useMemo(
    () => (shader) => {
      shader.uniforms.uImpacts = uImpacts
      shader.uniforms.uImpactDirs = uDirs
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
           uniform vec4 uImpacts[${MAX_IMPACTS}];
           uniform vec3 uImpactDirs[${MAX_IMPACTS}];`
        )
        .replace(
          '#include <begin_vertex>',
          `
          vec3 transformed = vec3(position);
          for (int i = 0; i < ${MAX_IMPACTS}; i++) {
            vec4 imp = uImpacts[i];
            if (abs(imp.w) > 0.001) {
              float d = distance(position, imp.xyz);
              float f = 1.0 - smoothstep(0.0, 0.14, d);
              vec3 dir = normalize(mix(-normal, uImpactDirs[i], 0.65));
              transformed += dir * f * imp.w * 0.08;
            }
          }
          `
        )
    },
    [uImpacts, uDirs]
  )

  const skin = (color = SKIN_BASE, roughness = 0.68) => (
    <meshStandardMaterial
      color={color}
      roughness={roughness}
      metalness={0.03}
      onBeforeCompile={onBeforeCompile}
    />
  )

  const activeUrl =
    variant === 'scanned'
      ? modelUrl
      : variant === 'sreekutty'
        ? SREEKUTTY_GLB
        : variant === 'mathayi'
          ? MATHAYI_GLB
          : DUMMY_GLB

  return (
    <group ref={ref} position={[0, 1.31, 0]}>
      <group ref={recoilRef}>
        <HeadModelBoundary
          url={activeUrl}
          fallback={<ProceduralHead skin={skin} onBeforeCompile={onBeforeCompile} />}
        >
          <Suspense fallback={<ProceduralHead skin={skin} onBeforeCompile={onBeforeCompile} />}>
            {variant === 'scanned' ? (
              <ScannedHead key={modelUrl} url={modelUrl} onBeforeCompile={onBeforeCompile} />
            ) : variant === 'sreekutty' ? (
              <SreekuttyHead key={SREEKUTTY_GLB} url={SREEKUTTY_GLB} onBeforeCompile={onBeforeCompile} />
            ) : variant === 'mathayi' ? (
              <MathayiHead key={MATHAYI_GLB} url={MATHAYI_GLB} onBeforeCompile={onBeforeCompile} />
            ) : (
              <DummyHead key={DUMMY_GLB} url={DUMMY_GLB} onBeforeCompile={onBeforeCompile} />
            )}
          </Suspense>
        </HeadModelBoundary>
      </group>
    </group>
  )
})

export function ProceduralHead({ skin, onBeforeCompile }) {
  const skull = shape('skull')
  const nose = shape('nose')
  const jaw = shape('jaw')
  const brow = shape('brow')
  const cheek = shape('cheekL')
  const ear = shape('ear')

  return (
    <group>
      {/* ==================== CRANIUM & HEAD BASE ==================== */}
        {/* Main Cranium - sculpted with subtle cranial tapering */}
        <mesh
          position={[at('skull').x, at('skull').y, at('skull').z]}
          scale={[0.96, 1.12, 1.02]}
          castShadow
        >
          <sphereGeometry args={[skull.radius, 56, 44]} />
          {skin(SKIN_BASE, 0.65)}
        </mesh>

        {/* Forehead transition */}
        <mesh position={[0, 0.052, 0.058]} scale={[0.076, 0.046, 0.038]} castShadow>
          <sphereGeometry args={[1, 32, 24]} />
          {skin(SKIN_BASE, 0.62)}
        </mesh>

        {/* ==================== BROW & EYEBROWS ==================== */}
        {/* Sculpted Brow Ridge over the orbits */}
        <mesh
          position={[at('brow').x, at('brow').y, at('brow').z]}
          scale={[brow.hx * 1.05, brow.hy * 1.1, brow.hz * 1.05]}
          castShadow
        >
          <sphereGeometry args={[1, 32, 20]} />
          {skin(SKIN_WARM, 0.66)}
        </mesh>

        {/* Sculpted Eyebrows */}
        {[-1, 1].map((side) => (
          <group key={`brow-${side}`} position={[side * 0.042, 0.042, 0.088]}>
            <mesh rotation={[0.05, side * -0.15, side * -0.18]} scale={[0.024, 0.0055, 0.006]}>
              <capsuleGeometry args={[1, 1, 4, 10]} />
              <meshStandardMaterial color={HAIR_DARK} roughness={0.85} />
            </mesh>
            {/* Arch peak */}
            <mesh position={[side * 0.012, 0.004, -0.002]} rotation={[0, 0, side * -0.3]} scale={[0.014, 0.0045, 0.005]}>
              <capsuleGeometry args={[1, 1, 4, 8]} />
              <meshStandardMaterial color={HAIR_DARK} roughness={0.85} />
            </mesh>
          </group>
        ))}

        {/* ==================== EYES & SOCKETS ==================== */}
        {[-1, 1].map((side) => (
          <group key={`eye-${side}`} position={[side * 0.039, 0.012, 0.082]}>
            {/* Eye socket hollow / shadow */}
            <mesh scale={[1.15, 0.95, 0.7]} position={[0, 0, -0.006]}>
              <sphereGeometry args={[0.018, 20, 16]} />
              {skin(SKIN_SHADOW, 0.75)}
            </mesh>

            {/* Sclera (Eyeball white) */}
            <mesh scale={[1, 0.86, 0.65]}>
              <sphereGeometry args={[0.017, 24, 20]} />
              <meshStandardMaterial color={EYE_SCLERA} roughness={0.25} />
            </mesh>

            {/* Iris Outer Limbal Ring */}
            <mesh position={[side * 0.001, 0, 0.012]} scale={[1, 1, 0.35]}>
              <circleGeometry args={[0.0082, 24]} />
              <meshStandardMaterial color={IRIS_DARK} roughness={0.2} />
            </mesh>

            {/* Iris Core with vibrant anime/arcade tint */}
            <mesh position={[side * 0.001, 0, 0.013]} scale={[1, 1, 0.35]}>
              <circleGeometry args={[0.0068, 24]} />
              <meshStandardMaterial color={IRIS_PRIMARY} roughness={0.15} />
            </mesh>

            {/* Pupil */}
            <mesh position={[side * 0.001, 0, 0.014]} scale={[1, 1, 0.2]}>
              <circleGeometry args={[0.0038, 20]} />
              <meshStandardMaterial color={PUPIL_BLACK} roughness={0.08} />
            </mesh>

            {/* Primary Catchlight (Spark of life) */}
            <mesh position={[side * 0.001 - 0.0022, 0.0024, 0.015]} scale={[0.0016, 0.0016, 0.001]}>
              <circleGeometry args={[1, 12]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>

            {/* Secondary subtle glint */}
            <mesh position={[side * 0.001 + 0.002, -0.0018, 0.015]} scale={[0.0009, 0.0009, 0.001]}>
              <circleGeometry args={[1, 10]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>

            {/* Upper Eyelid crease */}
            <mesh position={[0, 0.009, 0.010]} rotation={[-0.2, 0, 0]} scale={[0.019, 0.003, 0.006]}>
              <capsuleGeometry args={[1, 1, 4, 10]} />
              {skin(SKIN_WARM, 0.6)}
            </mesh>
          </group>
        ))}

        {/* ==================== NOSE & NOSTRILS ==================== */}
        {/* Nasal bridge sloping down from brow to tip */}
        <mesh
          position={[0, at('nose').y + 0.024, at('nose').z - 0.014]}
          rotation={[0.34, 0, 0]}
          scale={[0.011, 0.030, 0.013]}
          castShadow
        >
          <sphereGeometry args={[1, 24, 16]} />
          {skin(SKIN_WARM, 0.65)}
        </mesh>

        {/* Nose Tip - exactly at at('nose') */}
        <mesh position={[at('nose').x, at('nose').y, at('nose').z]} scale={[1, 0.94, 1]} castShadow>
          <sphereGeometry args={[nose.radius, 24, 18]} />
          {skin(SKIN_BLUSH, 0.58)}
        </mesh>

        {/* Lateral nostril wings */}
        {[-1, 1].map((side) => (
          <mesh
            key={`nostril-${side}`}
            position={[side * 0.015, at('nose').y - 0.005, at('nose').z - 0.008]}
            scale={[0.008, 0.007, 0.011]}
            castShadow
          >
            <sphereGeometry args={[1, 18, 14]} />
            {skin(SKIN_WARM, 0.65)}
          </mesh>
        ))}

        {/* ==================== CHEEKBONES & TEMPLE ==================== */}
        {['cheekL', 'cheekR'].map((id) => (
          <group key={id} position={[at(id).x, at(id).y, at(id).z]}>
            {/* Main zygomatic cheekbone */}
            <mesh scale={[0.88, 0.72, 0.68]} castShadow>
              <sphereGeometry args={[cheek.radius, 28, 22]} />
              {skin(SKIN_BLUSH, 0.64)}
            </mesh>
            {/* Subtle mid-cheek transition */}
            <mesh position={[0, -0.012, 0.008]} scale={[0.022, 0.024, 0.014]}>
              <sphereGeometry args={[1, 18, 14]} />
              {skin(SKIN_BASE, 0.7)}
            </mesh>
          </group>
        ))}

        {/* ==================== JAW & CHIN ==================== */}
        {/* Main Jawbone - contoured along lower face */}
        <mesh
          position={[at('jaw').x, at('jaw').y + 0.008, at('jaw').z - 0.006]}
          scale={[jaw.hx * 1.08, jaw.hy * 1.25, jaw.hz * 1.15]}
          castShadow
        >
          <sphereGeometry args={[1, 36, 24]} />
          {skin(SKIN_BASE, 0.68)}
        </mesh>

        {/* Sculpted Chin at at('jaw') */}
        <mesh
          position={[0, at('jaw').y - 0.006, at('jaw').z + 0.018]}
          scale={[0.031, 0.024, 0.022]}
          castShadow
        >
          <sphereGeometry args={[1, 24, 18]} />
          {skin(SKIN_BLUSH, 0.66)}
        </mesh>

        {/* Jawline angular contours */}
        {[-1, 1].map((side) => (
          <mesh
            key={`jawline-${side}`}
            position={[side * 0.052, at('jaw').y + 0.020, at('jaw').z - 0.022]}
            rotation={[0.3, side * -0.4, side * -0.2]}
            scale={[0.018, 0.028, 0.042]}
            castShadow
          >
            <boxGeometry args={[1, 1, 1]} />
            {skin(SKIN_WARM, 0.7)}
          </mesh>
        ))}

        {/* ==================== MOUTH & LIPS ==================== */}
        <group position={[0, -0.046, 0.080]}>
          {/* Philtrum groove */}
          <mesh position={[0, 0.016, -0.002]} scale={[0.007, 0.012, 0.004]}>
            <cylinderGeometry args={[1, 1, 1, 10]} />
            {skin(SKIN_WARM, 0.7)}
          </mesh>

          {/* Upper lip with Cupid's bow */}
          <mesh position={[0, 0.004, 0.003]} rotation={[0.1, 0, 0]} scale={[0.023, 0.0055, 0.007]}>
            <sphereGeometry args={[1, 22, 14]} />
            <meshStandardMaterial
              color={LIP_COLOR}
              roughness={0.46}
              metalness={0.04}
              onBeforeCompile={onBeforeCompile}
            />
          </mesh>

          {/* Fuller lower lip */}
          <mesh position={[0, -0.005, 0.002]} scale={[0.021, 0.007, 0.008]} castShadow>
            <sphereGeometry args={[1, 22, 14]} />
            <meshStandardMaterial
              color={LIP_COLOR}
              roughness={0.42}
              metalness={0.04}
              onBeforeCompile={onBeforeCompile}
            />
          </mesh>

          {/* Inner mouth shadow line */}
          <mesh position={[0, -0.0005, 0.002]} scale={[0.024, 0.0018, 0.005]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial color="#3a1616" />
          </mesh>
        </group>

        {/* ==================== EARS ==================== */}
        {[-1, 1].map((side) => (
          <group
            key={`ear-${side}`}
            position={[side * Math.abs(at('ear').x), at('ear').y, at('ear').z]}
            rotation={[0.05, side * 0.32, side * -0.08]}
          >
            {/* Outer ear helix rim */}
            <mesh scale={[0.38, 1.05, 0.76]} castShadow>
              <sphereGeometry args={[ear.radius, 20, 16]} />
              {skin(SKIN_WARM, 0.74)}
            </mesh>

            {/* Inner ear concha / cavity */}
            <mesh position={[side * -0.006, 0.003, 0.004]} scale={[0.22, 0.65, 0.45]}>
              <sphereGeometry args={[ear.radius, 16, 12]} />
              {skin(SKIN_SHADOW, 0.85)}
            </mesh>

            {/* Earlobe with natural flush */}
            <mesh position={[0, -0.016, -0.002]} scale={[0.010, 0.013, 0.009]} castShadow>
              <sphereGeometry args={[1, 14, 10]} />
              {skin(SKIN_BLUSH, 0.65)}
            </mesh>
          </group>
        ))}

        {/* ==================== STYLIZED FIGHTER HAIR ==================== */}
        <group position={[0, 0.028, -0.010]}>
          {/* Main sculpted hair crown */}
          <mesh scale={[0.99, 1.05, 1.04]} castShadow>
            <sphereGeometry
              args={[skull.radius * 1.04, 44, 32, 0, Math.PI * 2, 0, Math.PI * 0.60]}
            />
            <meshStandardMaterial color={HAIR_DARK} roughness={0.82} metalness={0.1} />
          </mesh>

          {/* Layered dimensional hair locks / bangs framing the forehead */}
          {[
            { x: -0.038, y: 0.048, z: 0.085, rotZ: 0.35, rotX: 0.2, s: [0.016, 0.036, 0.024] },
            { x: -0.012, y: 0.056, z: 0.092, rotZ: 0.12, rotX: 0.25, s: [0.018, 0.040, 0.026] },
            { x: 0.016, y: 0.054, z: 0.090, rotZ: -0.18, rotX: 0.22, s: [0.017, 0.038, 0.025] },
            { x: 0.042, y: 0.044, z: 0.082, rotZ: -0.38, rotX: 0.18, s: [0.015, 0.034, 0.022] },
          ].map((bang, i) => (
            <mesh
              key={`bang-${i}`}
              position={[bang.x, bang.y, bang.z]}
              rotation={[bang.rotX, 0, bang.rotZ]}
              scale={bang.s}
              castShadow
            >
              <coneGeometry args={[1, 2, 10]} />
              <meshStandardMaterial color={HAIR_DARK} roughness={0.8} metalness={0.12} />
            </mesh>
          ))}

          {/* Hair top-volume locks */}
          {[-0.03, 0.0, 0.03].map((hx, i) => (
            <mesh
              key={`lock-${i}`}
              position={[hx, 0.108, 0.015]}
              rotation={[0.3, 0, hx * -2.0]}
              scale={[0.026, 0.018, 0.045]}
              castShadow
            >
              <sphereGeometry args={[1, 16, 12]} />
              <meshStandardMaterial color={HAIR_HIGHLIGHT} roughness={0.78} metalness={0.15} />
            </mesh>
          ))}
        </group>

        {/* ==================== MUSCULAR NECK COLUMN ==================== */}
        {/* Contoured neck leading down smoothly into the workshop clamp vise */}
        <mesh position={[0, -0.105, -0.014]} scale={[0.88, 1, 0.94]} castShadow>
          <cylinderGeometry args={[0.056, 0.068, 0.11, 28]} />
          {skin(SKIN_BASE, 0.72)}
        </mesh>
    </group>
  )
}

useGLTF.preload(HEAD_GLB)
useGLTF.preload(DUMMY_GLB)
useGLTF.preload(SREEKUTTY_GLB)
useGLTF.preload(MATHAYI_GLB)

export default HeadMesh

