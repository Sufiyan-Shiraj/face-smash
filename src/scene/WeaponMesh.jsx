import { useFrame } from '@react-three/fiber'
import { Suspense, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { fitGlove } from './fitProp.js'
import * as THREE from 'three'

// Stylized fighter hand with live dynamic finger articulation & 3D combat boxing glove.
// Knuckles lead squarely along +z so impacts connect knuckles-first.

const GLOVE_GLB = '/models/glove_opt.glb'

/**
 * Cuff-to-knuckle length of the rendered glove, in metres.
 *
 * Sized against the TARGET, not against life. The head's skull collider has a
 * radius of 0.11 m, so the head is about 22 cm across; a real 30 cm glove is
 * genuinely bigger than that, and at 30 cm it filled a third of the screen and
 * read as a beach ball because it also sits nearer the camera than the head
 * does. Matching the head's diameter keeps the hit legible: you can see both
 * the glove and the face it is about to land on.
 */
const GLOVE_LENGTH = 0.22

const SKIN_TONE = '#d89b78'
const SKIN_WARM = '#cb8763'
const KNUCKLE_BLUSH = '#cf6860'
const WRAP_COLOR = '#ece7dc'
const WRAP_DARK = '#242533'
const ACCENT_PINK = '#ff2e88'

/**
 * Natural muscular athletic forearm extending along -z.
 * Seamlessly connects to the wrist cuff of either the boxing glove or the bare fist.
 */
export function CombatForearm({ skinColor = SKIN_TONE, handedness = 'right' }) {
  const isLeft = handedness === 'left' || handedness === 'Left'
  const sign = isLeft ? -1 : 1

  return (
    <group>
      {/* Heavy combat wrist wrap collar connecting cuff to arm */}
      <group position={[0, -0.002, -0.045]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.044, 0.046, 0.055, 24]} />
          <meshStandardMaterial color={WRAP_DARK} roughness={0.62} metalness={0.15} />
        </mesh>
        {/* Layered athletic compression tape band */}
        <mesh position={[0, 0, -0.015]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.0455, 0.0465, 0.024, 24]} />
          <meshStandardMaterial color={WRAP_COLOR} roughness={0.88} />
        </mesh>
        {/* Neon Pink Combat Branding Accent Stripe */}
        <mesh position={[0.046 * sign, 0, -0.015]} scale={[0.004, 0.018, 0.014]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            color={ACCENT_PINK}
            emissive={ACCENT_PINK}
            emissiveIntensity={1.2}
            roughness={0.3}
          />
        </mesh>
      </group>

      {/* Muscular contoured forearm cylinder extending along -z */}
      <mesh position={[0, -0.006, -0.16]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.036, 0.046, 0.19, 20]} />
        <meshStandardMaterial color={skinColor} roughness={0.65} metalness={0.02} />
      </mesh>
      {/* Brachioradialis muscle taper */}
      <mesh position={[0.012 * sign, 0.010, -0.18]} rotation={[Math.PI / 2 + 0.05, 0, 0.08 * sign]} castShadow>
        <cylinderGeometry args={[0.034, 0.042, 0.16, 16]} />
        <meshStandardMaterial color={SKIN_WARM} roughness={0.7} metalness={0.02} />
      </mesh>
    </group>
  )
}

export function BoxingGlove({ handedness = 'right', includeForearm = true, model = GLOVE_GLB, variant = 'boxing' }) {
  const { scene } = useGLTF(model)
  const isLeft = handedness === 'left' || handedness === 'Left'

  // Fitted by MEASUREMENT, not by constants. See fitGlove() for what this
  // replaces and why the old version rendered half a glove.
  //
  // The clone is skinDeep: useGLTF caches one scene per URL and every consumer
  // shares it, so mutating it in place would have the left hand's mirror flip
  // the right hand too.
  const glove = useMemo(() => {
    const fitted = fitGlove(scene.clone(true), { length: GLOVE_LENGTH, mirror: isLeft })
    if (variant === 'ducky') {
      fitted.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material = child.material.clone()
          child.material.color = new THREE.Color('#facc15')
          child.material.roughness = 0.3
        }
      })
    } else if (variant === 'spiked') {
      fitted.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material = child.material.clone()
          child.material.color = new THREE.Color('#2d121d')
          child.material.metalness = 0.55
          child.material.roughness = 0.4
        }
      })
    } else if (variant === 'hammer') {
      fitted.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material = child.material.clone()
          child.material.color = new THREE.Color('#718096')
          child.material.metalness = 0.82
          child.material.roughness = 0.25
        }
      })
    }
    return fitted
  }, [scene, isLeft, variant])

  return (
    <group>
      <primitive object={glove} />

      {/* Athletic forearm extending back along -z into incoming strike trajectory */}
      {includeForearm && <CombatForearm handedness={handedness} />}

      {/* Lightweight physics shadow proxy */}
      <mesh position={[0, 0.016, 0.09]} castShadow>
        <sphereGeometry args={[0.075, 16, 12]} />
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  )
}

export function Fist() {
  const fingers = useMemo(
    () => [
      { id: 'index', x: -0.026, r: 0.0125, len: 0.038, kR: 0.0135, kZ: 0.040, kY: 0.014 },
      { id: 'middle', x: -0.009, r: 0.0135, len: 0.042, kR: 0.0148, kZ: 0.042, kY: 0.016 },
      { id: 'ring', x: 0.009, r: 0.0125, len: 0.038, kR: 0.0132, kZ: 0.039, kY: 0.013 },
      { id: 'pinky', x: 0.025, r: 0.0110, len: 0.032, kR: 0.0118, kZ: 0.034, kY: 0.009 },
    ],
    []
  )

  return (
    <group>
      {/* ---------- FOREARM & WRIST ---------- */}
      {/* Forearm muscular taper extending back along -z */}
      <mesh position={[0, -0.004, -0.11]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.032, 0.038, 0.14, 18]} />
        <meshStandardMaterial color={SKIN_TONE} roughness={0.68} metalness={0.02} />
      </mesh>

      {/* Layered athletic wrist wraps */}
      <group position={[0, -0.002, -0.055]}>
        {/* Base thick wrap padding */}
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.039, 0.041, 0.065, 20]} />
          <meshStandardMaterial color={WRAP_COLOR} roughness={0.88} metalness={0.05} />
        </mesh>
        {/* Angled tape overlapping layer */}
        <mesh rotation={[Math.PI / 2 + 0.08, 0, 0.05]} castShadow>
          <cylinderGeometry args={[0.0405, 0.0415, 0.038, 20]} />
          <meshStandardMaterial color="#ded7cb" roughness={0.85} metalness={0.05} />
        </mesh>
        {/* Contrast brand strap with neon pink accent */}
        <mesh position={[0, 0.001, -0.008]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.0418, 0.0418, 0.014, 20]} />
          <meshStandardMaterial color={WRAP_DARK} roughness={0.5} metalness={0.2} />
        </mesh>
        {/* Glowing neon rubber tab */}
        <mesh position={[0, 0.041, -0.008]} scale={[0.016, 0.004, 0.01]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            color={ACCENT_PINK}
            emissive={ACCENT_PINK}
            emissiveIntensity={0.8}
            roughness={0.3}
          />
        </mesh>
      </group>

      {/* ---------- PALM & HAND BODY ---------- */}
      {/* Main contoured palm core */}
      <mesh position={[0, -0.004, 0.005]} scale={[1.05, 0.95, 1]} castShadow>
        <sphereGeometry args={[0.044, 24, 20]} />
        <meshStandardMaterial color={SKIN_TONE} roughness={0.7} metalness={0.02} />
      </mesh>

      {/* Palm wrap band across the mid-hand */}
      <mesh position={[0, -0.003, 0.002]} scale={[0.046, 0.043, 0.028]} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={WRAP_COLOR} roughness={0.9} />
      </mesh>

      {/* Back-of-hand tendon ridges */}
      {[-0.015, 0, 0.015].map((tx, idx) => (
        <mesh
          key={idx}
          position={[tx, 0.031, -0.008]}
          rotation={[-0.25, 0, tx * 1.5]}
          scale={[0.005, 0.004, 0.026]}
          castShadow
        >
          <capsuleGeometry args={[1, 1, 4, 8]} />
          <meshStandardMaterial color={SKIN_WARM} roughness={0.65} />
        </mesh>
      ))}

      {/* ---------- KNUCKLES & FINGERS ---------- */}
      {fingers.map((f) => (
        <group key={f.id}>
          {/* Prominent striking knuckle node on the leading +z face */}
          <mesh position={[f.x, f.kY, f.kZ]} castShadow>
            <sphereGeometry args={[f.kR, 18, 14]} />
            {/* Impact blush / combat redness on the contact knuckle point */}
            <meshStandardMaterial
              color={KNUCKLE_BLUSH}
              roughness={0.52}
              metalness={0.04}
            />
          </mesh>

          {/* Proximal finger segment curving down into the fist */}
          <mesh
            position={[f.x, f.kY - 0.016, f.kZ - 0.002]}
            rotation={[0.35, 0, (f.x / 0.026) * 0.08]}
            scale={[f.r, 0.014, f.r * 1.1]}
            castShadow
          >
            <cylinderGeometry args={[1, 1, 1, 14]} />
            <meshStandardMaterial color={SKIN_TONE} roughness={0.68} />
          </mesh>

          {/* Curled middle phalanx tucking under the palm */}
          <mesh
            position={[f.x, f.kY - 0.030, f.kZ - 0.012]}
            rotation={[1.2, 0, 0]}
            scale={[f.r * 0.95, 0.012, f.r * 0.95]}
            castShadow
          >
            <cylinderGeometry args={[1, 1, 1, 12]} />
            <meshStandardMaterial color={SKIN_WARM} roughness={0.7} />
          </mesh>
        </group>
      ))}

      {/* ---------- CLENCHED THUMB ---------- */}
      {/* Thumb metacarpal base along lateral edge */}
      <mesh
        position={[-0.042, -0.014, 0.006]}
        rotation={[0.2, 0.3, 0.75]}
        scale={[0.015, 0.026, 0.016]}
        castShadow
      >
        <capsuleGeometry args={[1, 1, 6, 10]} />
        <meshStandardMaterial color={SKIN_TONE} roughness={0.68} />
      </mesh>

      {/* Thumb joint folded across the index/middle fingers */}
      <mesh
        position={[-0.032, -0.020, 0.028]}
        rotation={[0.3, -0.15, 1.1]}
        scale={[0.013, 0.032, 0.014]}
        castShadow
      >
        <capsuleGeometry args={[1, 1, 6, 10]} />
        <meshStandardMaterial color={SKIN_TONE} roughness={0.65} />
      </mesh>

      {/* Thumb tip & nail plate resting firmly on the fingers */}
      <mesh
        position={[-0.014, -0.026, 0.032]}
        rotation={[0.2, 0, 1.35]}
        scale={[0.011, 0.018, 0.012]}
        castShadow
      >
        <capsuleGeometry args={[1, 1, 6, 10]} />
        <meshStandardMaterial color={SKIN_WARM} roughness={0.62} />
      </mesh>
      {/* Thumbnail */}
      <mesh
        position={[-0.014, -0.027, 0.039]}
        rotation={[0.3, 0, 1.35]}
        scale={[0.005, 0.007, 0.002]}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#f2e2d8" roughness={0.3} metalness={0.1} />
      </mesh>

      {/* Thumb tape wrap anchor */}
      <mesh
        position={[-0.038, -0.016, 0.012]}
        rotation={[0.25, 0.2, 0.75]}
        scale={[0.0165, 0.014, 0.017]}
      >
        <cylinderGeometry args={[1, 1, 1, 12]} />
        <meshStandardMaterial color={WRAP_COLOR} roughness={0.88} />
      </mesh>
    </group>
  )
}

/**
 * Dynamic Articulated Fighter Hand.
 * Fingers curl, clench, flick, and open based on live MediaPipe hand tracking state.
 */
export function ArticulatedHand({ hand, handedness = 'right', includeForearm = true }) {
  const fingerRefs = useRef([])
  const auraRef = useRef(null)
  const isLeft = handedness === 'left' || handedness === 'Left'
  const sign = isLeft ? -1 : 1

  const fingers = useMemo(
    () => [
      { id: 'index', x: -0.026 * sign, r: 0.0125, len: 0.038, kR: 0.0135, kZ: 0.040, kY: 0.014 },
      { id: 'middle', x: -0.009 * sign, r: 0.0135, len: 0.042, kR: 0.0148, kZ: 0.042, kY: 0.016 },
      { id: 'ring', x: 0.009 * sign, r: 0.0125, len: 0.038, kR: 0.0132, kZ: 0.039, kY: 0.013 },
      { id: 'pinky', x: 0.025 * sign, r: 0.0110, len: 0.032, kR: 0.0118, kZ: 0.034, kY: 0.009 },
    ],
    [sign]
  )

  useFrame((_, delta) => {
    const h = hand?.current
    const clench = h?.present ? (h.clenchRatio ?? 0) : 0.85
    const action = h?.action ?? 'neutral'
    const isFlick = action === 'superflick' || Boolean(h?.isFlick)
    const isSuperpunch = action === 'superpunch' || clench >= 0.68

    // Animate finger joints
    fingerRefs.current.forEach((grp, idx) => {
      if (!grp) return
      let targetRotX = 0.2 + clench * 1.3
      let targetCurledRotX = 0.4 + clench * 1.4

      if (isFlick && idx <= 1) {
        // Index and middle fingers snap open dynamically
        targetRotX = -0.25
        targetCurledRotX = -0.18
      } else if (action === 'poke' && idx === 0) {
        // Extended pointing finger
        targetRotX = 0.05
        targetCurledRotX = 0.02
      } else if (action === 'superslap' || h?.gesture === 'open') {
        // Open hand
        targetRotX = 0.06
        targetCurledRotX = 0.04
      }

      // Smooth lerp
      grp.rotation.x += (targetRotX - grp.rotation.x) * Math.min(delta * 22, 1)
      if (grp.children[1]) {
        grp.children[1].rotation.x += (targetCurledRotX - grp.children[1].rotation.x) * Math.min(delta * 22, 1)
      }
    })

    // Superpunch energy aura glow
    if (auraRef.current) {
      const targetIntensity = isSuperpunch ? 2.4 : 0.0
      auraRef.current.material.emissiveIntensity +=
        (targetIntensity - auraRef.current.material.emissiveIntensity) * Math.min(delta * 18, 1)
      auraRef.current.visible = auraRef.current.material.emissiveIntensity > 0.05
    }
  })

  return (
    <group>
      {/* Muscular Forearm extending back along -z */}
      {includeForearm && <CombatForearm handedness={handedness} />}

      {/* Superpunch Kinetic Energy Glow Aura */}
      <mesh ref={auraRef} position={[0, 0, 0.03]} visible={false}>
        <sphereGeometry args={[0.07, 16, 12]} />
        <meshStandardMaterial
          color={ACCENT_PINK}
          emissive={ACCENT_PINK}
          emissiveIntensity={0}
          transparent
          opacity={0.35}
        />
      </mesh>

      {/* Layered athletic wrist wraps */}
      <group position={[0, -0.002, -0.055]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.039, 0.041, 0.065, 20]} />
          <meshStandardMaterial color={WRAP_COLOR} roughness={0.88} metalness={0.05} />
        </mesh>
        <mesh rotation={[Math.PI / 2 + 0.08, 0, 0.05 * sign]} castShadow>
          <cylinderGeometry args={[0.0405, 0.0415, 0.038, 20]} />
          <meshStandardMaterial color="#ded7cb" roughness={0.85} metalness={0.05} />
        </mesh>
        <mesh position={[0, 0.001, -0.008]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.0418, 0.0418, 0.014, 20]} />
          <meshStandardMaterial color={WRAP_DARK} roughness={0.5} metalness={0.2} />
        </mesh>
        <mesh position={[0.041 * sign, 0, -0.008]} scale={[0.004, 0.016, 0.01]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            color={ACCENT_PINK}
            emissive={ACCENT_PINK}
            emissiveIntensity={0.8}
            roughness={0.3}
          />
        </mesh>
      </group>

      {/* ---------- PALM & HAND BODY ---------- */}
      <mesh position={[0, -0.004, 0.005]} scale={[1.05, 0.95, 1]} castShadow>
        <sphereGeometry args={[0.044, 24, 20]} />
        <meshStandardMaterial color={SKIN_TONE} roughness={0.7} metalness={0.02} />
      </mesh>
      <mesh position={[0, -0.003, 0.002]} scale={[0.046, 0.043, 0.028]} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={WRAP_COLOR} roughness={0.9} />
      </mesh>

      {/* Back-of-hand tendon ridges */}
      {[-0.015, 0, 0.015].map((tx, idx) => (
        <mesh
          key={idx}
          position={[tx * sign, 0.031, -0.008]}
          rotation={[-0.25, 0, tx * 1.5 * sign]}
          scale={[0.005, 0.004, 0.026]}
          castShadow
        >
          <capsuleGeometry args={[1, 1, 4, 8]} />
          <meshStandardMaterial color={SKIN_WARM} roughness={0.65} />
        </mesh>
      ))}

      {/* ---------- DYNAMIC KNUCKLES & FINGERS ---------- */}
      {fingers.map((f, i) => (
        <group key={f.id} position={[f.x, f.kY, f.kZ]}>
          {/* Contact Knuckle Node on leading +z */}
          <mesh castShadow>
            <sphereGeometry args={[f.kR, 18, 14]} />
            <meshStandardMaterial
              color={KNUCKLE_BLUSH}
              roughness={0.52}
              metalness={0.04}
            />
          </mesh>

          {/* Articulated Finger Hierarchy */}
          <group ref={(el) => (fingerRefs.current[i] = el)}>
            {/* Proximal segment */}
            <mesh
              position={[0, -0.016, -0.002]}
              scale={[f.r, 0.014, f.r * 1.1]}
              castShadow
            >
              <cylinderGeometry args={[1, 1, 1, 14]} />
              <meshStandardMaterial color={SKIN_TONE} roughness={0.68} />
            </mesh>

            {/* Distal / Curled phalanx */}
            <mesh
              position={[0, -0.030, -0.012]}
              scale={[f.r * 0.95, 0.012, f.r * 0.95]}
              castShadow
            >
              <cylinderGeometry args={[1, 1, 1, 12]} />
              <meshStandardMaterial color={SKIN_WARM} roughness={0.7} />
            </mesh>
          </group>
        </group>
      ))}

      {/* ---------- CLENCHED THUMB ---------- */}
      <mesh
        position={[-0.042 * sign, -0.014, 0.006]}
        rotation={[0.2, 0.3 * sign, 0.75 * sign]}
        scale={[0.015, 0.026, 0.016]}
        castShadow
      >
        <capsuleGeometry args={[1, 1, 6, 10]} />
        <meshStandardMaterial color={SKIN_TONE} roughness={0.68} />
      </mesh>
      <mesh
        position={[-0.032 * sign, -0.020, 0.028]}
        rotation={[0.3, -0.15 * sign, 1.1 * sign]}
        scale={[0.013, 0.032, 0.014]}
        castShadow
      >
        <capsuleGeometry args={[1, 1, 6, 10]} />
        <meshStandardMaterial color={SKIN_TONE} roughness={0.65} />
      </mesh>
      <mesh
        position={[-0.014 * sign, -0.026, 0.032]}
        rotation={[0.2, 0, 1.35 * sign]}
        scale={[0.011, 0.018, 0.012]}
        castShadow
      >
        <capsuleGeometry args={[1, 1, 6, 10]} />
        <meshStandardMaterial color={SKIN_WARM} roughness={0.62} />
      </mesh>
    </group>
  )
}

export default function WeaponMesh({ variant = 'boxing', hand, handedness = 'right', includeForearm = true }) {
  if (variant === 'fist' || variant === 'wraps' || variant === 'hand' || variant === 'gauntlet') {
    return <ArticulatedHand hand={hand} handedness={handedness} includeForearm={includeForearm} />
  }
  return (
    <Suspense fallback={<ArticulatedHand hand={hand} handedness={handedness} includeForearm={includeForearm} />}>
      <BoxingGlove handedness={handedness} includeForearm={includeForearm} variant={variant} />
    </Suspense>
  )
}


