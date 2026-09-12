import { Environment } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

import { ENV_PATH } from '../assets/catalog.js'
import { createHandProjector } from '../physics/handToWorld.js'
import { CAPTURE } from '../tracking/handTracker.js'
import { DEFAULT_WEAPON, weaponReach } from '../physics/weapons.js'
import HeadMesh from './HeadMesh.jsx'
import WeaponMesh from './WeaponMesh.jsx'
import FullArmMesh from './FullArmMesh.jsx'
import { createArmSolver } from './armIK.js'
import {
  computeHandOrientation,
  ARM_LENGTH,
  FOREARM,
  MAX_LEAN,
  PLAY_HALF_HEIGHT,
  UPPER_ARM,
  getShoulderPosition,
} from './armRig.js'
import WeaponTrail from './WeaponTrail.jsx'
import Effects from './Effects.jsx'

// The camera and the strike-shell projector must agree exactly, or the hand
// will appear in one place on screen and collide somewhere else.
export const VIEW = {
  fov: 45,
  neck: { x: 0, y: 1.2, z: 0 },
  headCentre: { x: 0, y: 1.31, z: 0 },
  cameraPosition: [0, 1.34, 1.15],
  // Fraction of the camera image trimmed from each edge before it is mapped to
  // the play area, so reaching the edge of the play area does NOT mean putting
  // your hand on the edge of the frame.
  trackingInset: 0.16,
}

/** Interactive Camera Controller with mouse drag orbit, wheel zoom, and A/S/D key controls */
function InteractiveCameraController({ cameraPosRef }) {
  const { camera, gl } = useThree()

  // Default values
  const defaultRadius = 1.15
  const defaultTheta = 0
  const defaultAlpha = 0.026 // ~1.5 deg elevation

  const stateRef = useRef({
    radius: defaultRadius,
    theta: defaultTheta,
    alpha: defaultAlpha,
    targetRadius: defaultRadius,
    targetTheta: defaultTheta,
    targetAlpha: defaultAlpha,
    isDragging: false,
    startX: 0,
    startY: 0,
  })

  // Keyboard controls: A / D to orbit left/right, S or R to reset, W / Arrow keys, +/- zoom
  useEffect(() => {
    const onKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return

      const s = stateRef.current
      if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') {
        s.targetTheta -= 0.15
      } else if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') {
        s.targetTheta += 0.15
      } else if (e.key === 's' || e.key === 'S' || e.key === 'r' || e.key === 'R') {
        s.targetTheta = defaultTheta
        s.targetAlpha = defaultAlpha
        s.targetRadius = defaultRadius
      } else if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') {
        s.targetAlpha = Math.min(0.65, s.targetAlpha + 0.08)
      } else if (e.key === 'ArrowDown') {
        s.targetAlpha = Math.max(-0.25, s.targetAlpha - 0.08)
      } else if (e.key === '+' || e.key === '=') {
        s.targetRadius = Math.max(0.68, s.targetRadius - 0.12)
      } else if (e.key === '-' || e.key === '_') {
        s.targetRadius = Math.min(2.4, s.targetRadius + 0.12)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Mouse wheel zoom anywhere in the viewport (except over scrollable console)
  useEffect(() => {
    const onWheel = (e) => {
      if (e.target?.closest?.('.console-hud, .unified-feed, input, select, textarea')) return
      const s = stateRef.current
      s.targetRadius = Math.max(0.68, Math.min(2.4, s.targetRadius + e.deltaY * 0.0015))
    }

    window.addEventListener('wheel', onWheel, { passive: true })
    return () => window.removeEventListener('wheel', onWheel)
  }, [])

  // Mouse / Pointer drag orbit on canvas and background viewport
  useEffect(() => {
    const s = stateRef.current

    const onPointerDown = (e) => {
      if (e.target?.closest?.('.console-hud, .unified-feed, .bottom-controls-bar, button, input, a, label')) {
        return
      }
      s.isDragging = true
      if (cameraPosRef?.current) cameraPosRef.current.isDragging = true
      s.startX = e.clientX
      s.startY = e.clientY
    }

    const onPointerMove = (e) => {
      if (!s.isDragging) return
      const dx = e.clientX - s.startX
      const dy = e.clientY - s.startY
      s.startX = e.clientX
      s.startY = e.clientY

      s.targetTheta += dx * 0.006
      s.targetAlpha = Math.max(-0.25, Math.min(0.65, s.targetAlpha - dy * 0.005))
    }

    const onPointerUp = () => {
      s.isDragging = false
      if (cameraPosRef?.current) cameraPosRef.current.isDragging = false
    }

    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)

    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
    }
  }, [cameraPosRef])

  useFrame((_, delta) => {
    const s = stateRef.current
    const lerpFactor = 1 - Math.exp(-22 * Math.min(delta, 0.1))

    s.radius += (s.targetRadius - s.radius) * lerpFactor
    s.theta += (s.targetTheta - s.theta) * lerpFactor
    s.alpha += (s.targetAlpha - s.alpha) * lerpFactor

    const cx = VIEW.headCentre.x + s.radius * Math.cos(s.alpha) * Math.sin(s.theta)
    const cy = VIEW.headCentre.y + s.radius * Math.sin(s.alpha)
    const cz = VIEW.headCentre.z + s.radius * Math.cos(s.alpha) * Math.cos(s.theta)

    camera.position.set(cx, cy, cz)
    camera.lookAt(VIEW.headCentre.x, VIEW.headCentre.y, VIEW.headCentre.z)
    camera.updateProjectionMatrix()

    if (cameraPosRef?.current) {
      cameraPosRef.current.x = cx
      cameraPosRef.current.y = cy
      cameraPosRef.current.z = cz
    }
  })

  return null
}

// How long the hand must be gone before the mouse is allowed to take over, in
// seconds. Long enough that no realistic tracking dropout reaches it.
const MOUSE_TAKEOVER = 1.5

const _spVec = new THREE.Vector3()

/** Drives physics and syncs dual hand meshes. Must live inside the Canvas. */
function Rig({
  physics,
  hand,
  headRef,
  strikerRefL,
  strikerRefR,
  armGroupRefL,
  armGroupRefR,
  armIKRefL,
  armIKRefR,
  cameraPosRef,
  allowMouse = true,
}) {
  const { size } = useThree()

  const projectors = useMemo(() => {
    const base = {
      cameraPosition: () => cameraPosRef.current,
      headPosition: VIEW.headCentre,
      fov: VIEW.fov,
      aspect: size.width / size.height,
    }
    return {
      hand: createHandProjector({
        ...base,
        mirror: true,
        // The aspect of the CAMERA FRAME, not of the window. This is what makes
        // the mapping isotropic; see handToWorld.js.
        sourceAspect: CAPTURE.width / CAPTURE.height,
        playHalfHeight: PLAY_HALF_HEIGHT,
        inset: VIEW.trackingInset,
        restOffset: 0.22,
        depthGain: 0.28,
        yCenterOffset: 0.06,
      }),
      mouse: createHandProjector({
        ...base,
        mirror: false,
        // Pointer coordinates are already viewport-normalized, so the image
        // they came from IS the viewport.
        sourceAspect: size.width / size.height,
        playHalfHeight: PLAY_HALF_HEIGHT,
        restOffset: 0.22,
        depthGain: 0.28,
        yCenterOffset: 0.06,
        // A mouse has no hand span to learn from.
        adaptDepth: false,
      }),
    }
  }, [size.width, size.height, cameraPosRef])

  // One solver per arm, each owning its own smoothing state. Created once:
  // rebuilding them would drop the damped elbow pose and make the arms twitch.
  const solvers = useMemo(
    () => ({
      left: createArmSolver({ handedness: 'left', L1: UPPER_ARM, L2: FOREARM, maxLean: MAX_LEAN }),
      right: createArmSolver({ handedness: 'right', L1: UPPER_ARM, L2: FOREARM, maxLean: MAX_LEAN }),
    }),
    []
  )

  const mouseActive = useRef(false)
  const mouseDown = useRef(false)

  useEffect(() => {
    if (!allowMouse) return
    const on = () => (mouseActive.current = true)
    const off = () => (mouseActive.current = false)
    const down = (e) => {
      if (e.target?.closest?.('.console-hud, .unified-feed, .bottom-controls-bar, button, input, a, label')) return
      mouseDown.current = true
    }
    const up = () => {
      mouseDown.current = false
    }

    window.addEventListener('pointermove', on)
    window.addEventListener('pointerleave', off)
    window.addEventListener('pointerdown', down)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', on)
      window.removeEventListener('pointerleave', off)
      window.removeEventListener('pointerdown', down)
      window.removeEventListener('pointerup', up)
    }
  }, [allowMouse])

  useFrame((state, delta) => {
    const rig = physics.rig.current
    if (!rig) return

    const h = hand.current
    const hL = h.left
    const hR = h.right

    let observedL = null
    let observedR = null

    // Ready guard stance positions (in front of chest at z = 0.24, y = 1.25)
    // Aligns with active hand reach depth to eliminate sudden teleportation jumps
    const guardL = { x: -0.19, y: 1.25, z: 0.24 }
    const guardR = { x: 0.19, y: 1.25, z: 0.24 }

    const hasWebcamHand = Boolean(hL?.present || hR?.present)

    if (hasWebcamHand) {
      // WEBCAM TRACKING ACTIVE:
      // Strict 1-hand vs 2-hand display:
      // If only Left is detected, ONLY Left is shown (Right is null -> hidden).
      // If only Right is detected, ONLY Right is shown (Left is null -> hidden).
      // If both are detected, both are shown.
      if (hL?.present) {
        const lungeL = Math.min(0.12, ((hL.speed ?? 0) / 4.8) * 0.12)
        observedL = projectors.hand.project({
          x: hL.x, y: hL.y, span: hL.span, lunge: lungeL, dt: delta,
        })
      }
      if (hR?.present) {
        const lungeR = Math.min(0.12, ((hR.speed ?? 0) / 4.8) * 0.12)
        observedR = projectors.hand.project({
          x: hR.x, y: hR.y, span: hR.span, lunge: lungeR, dt: delta,
        })
      }
    } else {
      // NO WEBCAM HANDS IN VIEW (Startup / Idle / Mouse Control):
      // Fighter stands in ready boxing guard so hands are NEVER missing.
      // Mouse cursor drives the right glove into punches, left glove guards.
      if (allowMouse && (mouseActive.current || mouseDown.current) && !cameraPosRef?.current?.isDragging) {
        const mouseSpan = mouseDown.current ? 0.22 : 0.12
        observedR = projectors.mouse.project({
          x: (state.pointer.x + 1) / 2,
          y: (1 - state.pointer.y) / 2,
          span: mouseSpan,
        })
      } else {
        observedR = guardR
      }
      observedL = guardL
    }

    physics.step(Math.min(delta, 0.1), observedL, observedR)

    const hp = rig.head.position()
    const hq = rig.head.rotation()
    if (headRef.current) {
      headRef.current.position.set(hp.x, hp.y, hp.z)
      headRef.current.quaternion.set(hq.x, hq.y, hq.z, hq.w)
    }

    const updateArm = (armGroupRef, strikerRef, armIKRef, body, isObserved, handedness, solver) => {
      if (!armGroupRef?.current || !strikerRef?.current || !body) return
      const sp = body.position()
      const sv = body.velocity()
      const live = sp.y > -10 && isObserved

      armGroupRef.current.visible = live
      if (live) {
        // One rate for both position and rotation. They used to differ (36 vs
        // 28), which sounds harmless and is not: the fist arrived at a spot
        // still wearing the angle it had on the way there, so every direction
        // change showed a visible lag between where the glove was and where it
        // pointed.
        const alpha = 1 - Math.exp(-34 * Math.min(delta, 0.1))
        const shoulder = getShoulderPosition(cameraPosRef.current, handedness)
        const targetQuat = computeHandOrientation(sp, sv, handedness, shoulder)

        _spVec.set(sp.x, sp.y, sp.z)
        if (strikerRef.current.position.y < -5 || strikerRef.current.position.distanceTo(_spVec) > 0.4) {
          strikerRef.current.position.copy(_spVec)
          strikerRef.current.quaternion.copy(targetQuat)
        } else {
          strikerRef.current.position.lerp(_spVec, alpha)
          strikerRef.current.quaternion.slerp(targetQuat, alpha)
        }

        // Solve 2-bone IK for the full arm.
        armIKRef.current = solver.solve({
          shoulder,
          handPos: strikerRef.current.position,
          handQuat: strikerRef.current.quaternion,
          vel: sv,
          forward: { x: shoulder.fx, z: shoulder.fz },
          dt: delta,
        })
      } else {
        strikerRef.current.position.set(sp.x, sp.y, sp.z)
        // Next time this arm appears it should pose from scratch rather than
        // easing out of wherever it was parked.
        solver.reset()
      }
    }

    updateArm(armGroupRefL, strikerRefL, armIKRefL, rig.strikerL, Boolean(observedL), 'left', solvers.left)
    updateArm(armGroupRefR, strikerRefR, armIKRefR, rig.strikerR, Boolean(observedR), 'right', solvers.right)
  })

  return null
}

export default function Lab3D({
  physics,
  hand,
  impactsRef,
  effectsRef,
  weapon = DEFAULT_WEAPON,
  targetVariant = 'scanned',
  weaponVariant = 'glove',
  headModelUrl,
}) {
  const headRef = useRef(null)
  const strikerRefL = useRef(null)
  const strikerRefR = useRef(null)
  const armGroupRefL = useRef(null)
  const armGroupRefR = useRef(null)
  const armIKRefL = useRef(null)
  const armIKRefR = useRef(null)
  const handLRef = useRef(hand.current?.left ?? null)
  const handRRef = useRef(hand.current?.right ?? null)
  const cameraPosRef = useRef({
    x: VIEW.cameraPosition[0],
    y: VIEW.cameraPosition[1],
    z: VIEW.cameraPosition[2],
  })

  // Keep sub-refs synced for ArticulatedHand dynamic curl
  useEffect(() => {
    let raf
    const sync = () => {
      handLRef.current = hand.current?.left ?? null
      handRRef.current = hand.current?.right ?? null
      raf = requestAnimationFrame(sync)
    }
    raf = requestAnimationFrame(sync)
    return () => cancelAnimationFrame(raf)
  }, [hand])

  return (
    <Canvas
      className="lab-canvas"
      style={{ position: 'absolute', inset: 0 }}
      shadows
      dpr={[1, 1.75]}
      camera={{ position: VIEW.cameraPosition, fov: VIEW.fov, near: 0.05, far: 50 }}
      gl={{ antialias: true, localClippingEnabled: true }}
    >
      <color attach="background" args={['#0a0b12']} />
      <fog attach="fog" args={['#0a0b12', 4.5, 9.5]} />

      <InteractiveCameraController cameraPosRef={cameraPosRef} />

      {/* Image-based lighting for props and reflective steel */}
      <Suspense fallback={null}>
        <Environment files={ENV_PATH} environmentIntensity={0.55} />
      </Suspense>

      <ambientLight intensity={0.42} />
      {/*
        The only shadow caster in the scene, and its frustum is bounded.

        Left to itself three.js gives a directional light a 10 x 10 m orthographic
        shadow camera. That covers the entire room, which costs twice: every
        decorative mesh in the backdrop, the punching bag and the equipment rack
        all get drawn into the shadow map even though nothing of theirs is
        visible, and the 1024 map is stretched over 10 m, so the shadows that DO
        matter — the head and the player's arms — get about a centimetre per
        texel and come out soft and blocky.

        Bounding it to the play area culls the distant casters out of the shadow
        pass and simultaneously multiplies the effective shadow resolution by
        about four, which is the rare case of cheaper and better at once.
      */}
      <directionalLight
        position={[1.4, 2.8, 1.8]}
        intensity={2.6}
        color="#fff0de"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-1.3}
        shadow-camera-right={1.3}
        shadow-camera-top={1.3}
        shadow-camera-bottom={-1.3}
        shadow-camera-near={0.5}
        shadow-camera-far={7}
        shadow-normalBias={0.02}
      />
      <directionalLight position={[-2.4, 1.6, 1.2]} intensity={0.8} color="#6fb4ff" />
      {/* Vibrant Hot Pink Rim Backlight */}
      <pointLight position={[0, 1.45, -0.9]} intensity={3.5} color="#ff2e88" distance={2.8} />
      {/* Subtle Front Table Neon Glow Bounce */}
      <pointLight position={[0, 1.08, 0.7]} intensity={0.8} color="#ff2e88" distance={1.8} />
      {/* Cyan Rim Accent Light for background equipment */}
      <pointLight position={[2.2, 1.8, -1.8]} intensity={1.5} color="#00f0ff" distance={3.2} />

      {/* Atmospheric Underground Facility Background */}
      <IndustrialBackdrop />
      <HeavyPunchingBag />
      <TelemetryRack />
      <CagedWorkLamps />
      <AtmosphericDust />

      <HeadMesh
        ref={headRef}
        impactsRef={impactsRef}
        variant={targetVariant}
        modelUrl={headModelUrl}
      />

      {/* Dual trails for Left and Right boxing gloves */}
      <WeaponTrail strikerRef={strikerRefL} color="#00f0ff" width={weaponReach(weapon) * 1.6} />
      <WeaponTrail strikerRef={strikerRefR} color="#ff2e88" width={weaponReach(weapon) * 1.6} />

      {/* Left Full Arm + Boxing Glove / Hand */}
      <group ref={armGroupRefL} visible={false}>
        <FullArmMesh ikRef={armIKRefL} handedness="left" />
        <group ref={strikerRefL}>
          <WeaponMesh variant={weaponVariant} hand={handLRef} handedness="left" includeForearm={false} />
        </group>
      </group>

      {/* Right Full Arm + Boxing Glove / Hand */}
      <group ref={armGroupRefR} visible={false}>
        <FullArmMesh ikRef={armIKRefR} handedness="right" />
        <group ref={strikerRefR}>
          <WeaponMesh variant={weaponVariant} hand={handRRef} handedness="right" includeForearm={false} />
        </group>
      </group>

      <Effects effectsRef={effectsRef} />
      <WorkshopStand />

      <Rig
        physics={physics}
        hand={hand}
        headRef={headRef}
        strikerRefL={strikerRefL}
        strikerRefR={strikerRefR}
        armGroupRefL={armGroupRefL}
        armGroupRefR={armGroupRefR}
        armIKRefL={armIKRefL}
        armIKRefR={armIKRefR}
        cameraPosRef={cameraPosRef}
      />
    </Canvas>
  )
}

function WorkbenchProps() {
  // Label texture for SMASH FUEL aerosol spray can
  const fuelTexture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 512
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#181924'
    ctx.fillRect(0, 0, 512, 512)
    ctx.fillStyle = '#ff2e88'
    ctx.fillRect(0, 160, 512, 200)

    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 54px ui-rounded, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('SMASH', 256, 230)
    ctx.fillStyle = '#ffe14d'
    ctx.fillText('FUEL', 256, 300)

    // Crown doodle
    ctx.fillStyle = '#ffe14d'
    ctx.beginPath()
    ctx.moveTo(210, 140)
    ctx.lineTo(200, 105)
    ctx.lineTo(230, 120)
    ctx.lineTo(256, 95)
    ctx.lineTo(282, 120)
    ctx.lineTo(312, 105)
    ctx.lineTo(302, 140)
    ctx.closePath()
    ctx.fill()

    const tex = new THREE.CanvasTexture(canvas)
    tex.wrapS = THREE.RepeatWrapping
    return tex
  }, [])

  // CRT Screen Canvas Texture: "BEAUTY IS OPTIONAL :)"
  const crtTexture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 384
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#061c10'
    ctx.fillRect(0, 0, 512, 384)

    // CRT phosphor scanlines
    ctx.fillStyle = 'rgba(0, 255, 120, 0.05)'
    for (let y = 0; y < 384; y += 4) {
      ctx.fillRect(0, y, 512, 2)
    }

    ctx.fillStyle = '#3ef0b0'
    ctx.font = 'bold 44px ui-monospace, monospace'
    ctx.textAlign = 'center'
    ctx.shadowColor = '#3ef0b0'
    ctx.shadowBlur = 10
    ctx.fillText('BEAUTY', 256, 150)
    ctx.fillText('IS', 256, 205)
    ctx.fillText('OPTIONAL', 256, 260)
    ctx.font = 'bold 52px monospace'
    ctx.fillText(': )', 256, 320)

    const tex = new THREE.CanvasTexture(canvas)
    return tex
  }, [])

  return (
    <group>
      {/* 1. Yellow Rubber Duck with Cool Sunglasses resting on workbench */}
      <group position={[-0.46, 1.05, 0.36]} rotation={[0, 0.45, 0]} scale={0.062}>
        {/* Duck Body */}
        <mesh position={[0, 0, 0]} castShadow>
          <sphereGeometry args={[1, 24, 20]} />
          <meshStandardMaterial color="#ffcc00" roughness={0.35} metalness={0.05} />
        </mesh>
        {/* Duck Head */}
        <mesh position={[0, 0.72, 0.38]} scale={0.68} castShadow>
          <sphereGeometry args={[1, 24, 20]} />
          <meshStandardMaterial color="#ffcc00" roughness={0.35} metalness={0.05} />
        </mesh>
        {/* Beak */}
        <mesh position={[0, 0.62, 1.05]} scale={[0.42, 0.18, 0.44]} castShadow>
          <sphereGeometry args={[1, 16, 14]} />
          <meshStandardMaterial color="#ff6600" roughness={0.4} />
        </mesh>
        {/* Cool Sunglasses */}
        <mesh position={[0, 0.79, 0.88]} scale={[0.55, 0.17, 0.14]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#111115" roughness={0.1} metalness={0.9} />
        </mesh>
        {/* Sunglasses frame arms */}
        {[-0.28, 0.28].map((sx, si) => (
          <mesh key={`arm-${si}`} position={[sx, 0.79, 0.72]} scale={[0.04, 0.04, 0.28]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#111115" roughness={0.1} metalness={0.9} />
          </mesh>
        ))}
      </group>

      {/* 2. "SMASH FUEL" Spray Paint Aerosol Can on workbench */}
      <group position={[-0.64, 1.10, 0.44]} rotation={[0, -0.2, 0]}>
        {/* Canister Body Cylinder with painted label */}
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[0.038, 0.038, 0.17, 24]} />
          <meshStandardMaterial map={fuelTexture} roughness={0.38} metalness={0.4} />
        </mesh>
        {/* Top Dome Shoulder */}
        <mesh position={[0, 0.088, 0]} castShadow>
          <sphereGeometry args={[0.037, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#c4cad8" roughness={0.25} metalness={0.9} />
        </mesh>
        {/* Neon Pink Spray Cap */}
        <mesh position={[0, 0.118, 0]} castShadow>
          <cylinderGeometry args={[0.036, 0.036, 0.045, 20]} />
          <meshStandardMaterial color="#ff2e88" roughness={0.3} />
        </mesh>
        {/* Nozzle button */}
        <mesh position={[0, 0.144, 0.012]} rotation={[0.2, 0, 0]}>
          <cylinderGeometry args={[0.007, 0.007, 0.012, 12]} />
          <meshStandardMaterial color="#ffffff" roughness={0.3} />
        </mesh>
      </group>

      {/* 3. Small Industrial Hardware Test Blocks on table */}
      {[-0.40, -0.32].map((bx, bi) => (
        <mesh key={`block-${bi}`} position={[bx, 1.025, 0.48]} castShadow receiveShadow>
          <boxGeometry args={[0.045, 0.024, 0.045]} />
          <meshStandardMaterial color="#2d3345" roughness={0.3} metalness={0.88} />
        </mesh>
      ))}

      {/* 4. Vintage Green CRT Monitor on right workbench displaying "BEAUTY IS OPTIONAL :)" */}
      <group position={[0.78, 1.20, -0.25]} rotation={[0, -0.55, 0]}>
        {/* Monitor Housing Case */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.34, 0.28, 0.26]} />
          <meshStandardMaterial color="#1a1e29" roughness={0.5} metalness={0.5} />
        </mesh>
        {/* Curved CRT Screen Face with green phosphorescent glow */}
        <mesh position={[0, 0, 0.134]}>
          <planeGeometry args={[0.28, 0.22]} />
          <meshStandardMaterial
            map={crtTexture}
            emissive="#3ef0b0"
            emissiveIntensity={0.65}
            roughness={0.15}
          />
        </mesh>
        {/* Monitor Base Stand */}
        <mesh position={[0, -0.16, 0]} castShadow>
          <cylinderGeometry args={[0.09, 0.11, 0.04, 18]} />
          <meshStandardMaterial color="#12141c" roughness={0.6} metalness={0.7} />
        </mesh>
      </group>
    </group>
  )
}

function WorkshopStand() {
  const bolts = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const angle = (i / 6) * Math.PI * 2
      return {
        x: Math.cos(angle) * 0.145,
        z: Math.sin(angle) * 0.145,
      }
    })
  }, [])

  const gussets = useMemo(() => {
    return [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4]
  }, [])

  // Stenciled "FACE SMASH" Graffiti Texture for Collar Clamp
  const collarTexture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 256
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#1c1f2b'
    ctx.fillRect(0, 0, 1024, 256)

    ctx.font = '900 86px ui-rounded, "SF Pro Rounded", system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    // Draw front-facing stencils
    for (const cx of [256, 768]) {
      // Crown doodle
      ctx.fillStyle = '#ffe14d'
      ctx.beginPath()
      ctx.moveTo(cx - 190, 80)
      ctx.lineTo(cx - 210, 40)
      ctx.lineTo(cx - 190, 58)
      ctx.lineTo(cx - 170, 35)
      ctx.lineTo(cx - 150, 58)
      ctx.lineTo(cx - 130, 40)
      ctx.lineTo(cx - 150, 80)
      ctx.closePath()
      ctx.fill()

      // "FACE" in Neon Pink
      ctx.fillStyle = '#ff2e88'
      ctx.shadowColor = '#ff2e88'
      ctx.shadowBlur = 10
      ctx.fillText('FACE', cx - 65, 138)

      // "SMASH" in Cyber Yellow
      ctx.fillStyle = '#ffe14d'
      ctx.shadowColor = '#ffe14d'
      ctx.shadowBlur = 10
      ctx.fillText('SMASH', cx + 78, 138)
    }

    const tex = new THREE.CanvasTexture(canvas)
    tex.wrapS = THREE.RepeatWrapping
    return tex
  }, [])

  return (
    <group>
      {/* Workbench Props: Rubber Duck, Spray Paint Can, CRT Monitor */}
      <WorkbenchProps />

      {/* ==================== HEAVY NECK CLAMP VISE ==================== */}
      {/* Upper Collar Bevel Ring */}
      <mesh position={[0, 1.155, 0]} receiveShadow castShadow>
        <torusGeometry args={[0.082, 0.016, 16, 36]} />
        <meshStandardMaterial color="#303445" roughness={0.3} metalness={0.88} />
      </mesh>

      {/* Main Heavy Collar Cylinder with stenciled "FACE SMASH" graffiti */}
      <mesh position={[0, 1.125, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[0.086, 0.096, 0.065, 36]} />
        <meshStandardMaterial
          map={collarTexture}
          roughness={0.35}
          metalness={0.75}
        />
      </mesh>

      {/* Clamping Jaws (Left & Right Machined Steel Blocks) */}
      {[-1, 1].map((side) => (
        <group key={`jaw-${side}`} position={[side * 0.084, 1.135, 0]}>
          {/* Main clamp block */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.026, 0.048, 0.076]} />
            <meshStandardMaterial color="#2a2e3d" roughness={0.32} metalness={0.82} />
          </mesh>
          {/* Inner grooved rubber grip pad holding the neck */}
          <mesh position={[side * -0.012, 0, 0]}>
            <boxGeometry args={[0.005, 0.042, 0.068]} />
            <meshStandardMaterial color="#111218" roughness={0.95} metalness={0.1} />
          </mesh>
          {/* Fastening bolts */}
          {[-0.022, 0.022].map((bz) => (
            <mesh key={`b-${bz}`} position={[side * 0.014, 0, bz]} rotation={[0, 0, side * (Math.PI / 2)]}>
              <cylinderGeometry args={[0.005, 0.005, 0.006, 12]} />
              <meshStandardMaterial color="#8e96a8" roughness={0.2} metalness={0.9} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Heavy Horizontal Threaded Lead Screw */}
      <mesh position={[0, 1.135, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.009, 0.009, 0.25, 20]} />
        <meshStandardMaterial color="#dbe0ea" roughness={0.18} metalness={0.95} />
      </mesh>

      {/* Vise Tommy Bar / Cross-Handle on the right side */}
      <group position={[0.138, 1.135, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.005, 0.005, 0.12, 16]} />
          <meshStandardMaterial color="#c8cfde" roughness={0.2} metalness={0.95} />
        </mesh>
        {/* Spherical handle finials */}
        {[-0.058, 0.058].map((hy) => (
          <mesh key={`h-${hy}`} position={[0, 0, hy]} castShadow>
            <sphereGeometry args={[0.011, 16, 14]} />
            <meshStandardMaterial color="#e4ebf8" roughness={0.15} metalness={0.98} />
          </mesh>
        ))}
      </group>

      {/* Conical Flared Base Casting */}
      <mesh position={[0, 1.055, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[0.096, 0.148, 0.09, 36]} />
        <meshStandardMaterial color="#222530" roughness={0.4} metalness={0.78} />
      </mesh>

      {/* 4 Reinforcing Gusset Braces */}
      {gussets.map((rotY, idx) => (
        <mesh
          key={`gusset-${idx}`}
          position={[Math.cos(rotY) * 0.1, 1.045, Math.sin(rotY) * 0.1]}
          rotation={[0, rotY, 0.28]}
          castShadow
        >
          <boxGeometry args={[0.048, 0.08, 0.014]} />
          <meshStandardMaterial color="#262a38" roughness={0.35} metalness={0.8} />
        </mesh>
      ))}

      {/* Base Mounting Flange Plate */}
      <mesh position={[0, 1.015, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[0.168, 0.174, 0.02, 36]} />
        <meshStandardMaterial color="#2d3142" roughness={0.32} metalness={0.85} />
      </mesh>

      {/* 6 Hexagonal Mounting Bolts securing vise to bench */}
      {bolts.map((b, idx) => (
        <mesh key={`bolt-${idx}`} position={[b.x, 1.028, b.z]} castShadow>
          <cylinderGeometry args={[0.009, 0.009, 0.012, 6]} />
          <meshStandardMaterial color="#9aa3b5" roughness={0.22} metalness={0.92} />
        </mesh>
      ))}

      {/* ==================== STEPPED TURNTABLE PEDESTAL WITH NEON PINK GLOW RING ==================== */}
      <group position={[0, 1.015, 0]}>
        {/* Stepped Turntable Outer Ring */}
        <mesh position={[0, 0.012, 0]} receiveShadow castShadow>
          <cylinderGeometry args={[0.36, 0.38, 0.028, 48]} />
          <meshStandardMaterial color="#1a1c26" roughness={0.35} metalness={0.85} />
        </mesh>
        {/* Outer Castellated Perimeter Lug Teeth */}
        {Array.from({ length: 24 }).map((_, ti) => {
          const a = (ti / 24) * Math.PI * 2
          return (
            <mesh
              key={`tooth-${ti}`}
              position={[Math.cos(a) * 0.368, 0.012, Math.sin(a) * 0.368]}
              rotation={[0, -a, 0]}
              castShadow
            >
              <boxGeometry args={[0.022, 0.022, 0.026]} />
              <meshStandardMaterial color="#2b3142" roughness={0.3} metalness={0.9} />
            </mesh>
          )
        })}
        {/* Intense Hot Pink Neon Glow Ring on Turntable Platform */}
        <mesh position={[0, 0.028, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.26, 0.29, 48]} />
          <meshStandardMaterial
            color="#ff2e88"
            emissive="#ff2e88"
            emissiveIntensity={3.2}
            roughness={0.1}
          />
        </mesh>
        {/* Local Turntable Neon Glow Light */}
        <pointLight position={[0, 0.06, 0]} color="#ff2e88" intensity={1.8} distance={1.4} />
      </group>

      {/* ==================== INDUSTRIAL TESTING BENCH ==================== */}
      {/* Tabletop Surface Slab */}
      <mesh position={[0, 0.995, 0]} receiveShadow>
        <boxGeometry args={[3.2, 0.04, 1.8]} />
        <meshStandardMaterial color="#14151e" roughness={0.46} metalness={0.55} />
      </mesh>

      {/* Circular Turntable Target Grid Inlay on table surface */}
      <mesh position={[0, 1.016, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.19, 0.198, 44]} />
        <meshStandardMaterial color="#35394e" roughness={0.3} metalness={0.8} />
      </mesh>
      <mesh position={[0, 1.016, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.31, 0.316, 56]} />
        <meshStandardMaterial color="#262939" roughness={0.3} metalness={0.7} />
      </mesh>

      {/* Front Recessed Neon Glow Strip */}
      <mesh position={[0, 1.006, 0.902]}>
        <boxGeometry args={[2.9, 0.012, 0.008]} />
        <meshStandardMaterial
          color="#ff2e88"
          emissive="#ff2e88"
          emissiveIntensity={2.4}
          roughness={0.2}
        />
      </mesh>
      {/* Side Neon Accent Bars */}
      {[-1, 1].map((side) => (
        <mesh key={`side-neon-${side}`} position={[side * 1.602, 1.006, 0]} rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[1.5, 0.012, 0.008]} />
          <meshStandardMaterial
            color="#ff2e88"
            emissive="#ff2e88"
            emissiveIntensity={1.8}
            roughness={0.2}
          />
        </mesh>
      ))}

      {/* Front Edge Hazard / Tech Accent Plates */}
      {[-1, 1].map((side) => (
        <mesh key={`hazard-${side}`} position={[side * 1.25, 1.005, 0.902]}>
          <boxGeometry args={[0.18, 0.022, 0.012]} />
          <meshStandardMaterial color="#ffe14d" roughness={0.35} metalness={0.4} />
        </mesh>
      ))}

      {/* Table Chassis / Heavy Subframe */}
      <mesh position={[0, 0.935, 0]} receiveShadow>
        <boxGeometry args={[3.0, 0.08, 1.6]} />
        <meshStandardMaterial color="#1a1c27" roughness={0.65} metalness={0.4} />
      </mesh>

      {/* Heavy Steel Support Legs & Floor Plates */}
      {[
        [-1.35, -0.65],
        [1.35, -0.65],
        [-1.35, 0.65],
        [1.35, 0.65],
      ].map(([lx, lz], idx) => (
        <group key={`leg-${idx}`} position={[lx, 0.45, lz]}>
          <mesh receiveShadow castShadow>
            <boxGeometry args={[0.11, 0.9, 0.11]} />
            <meshStandardMaterial color="#161823" roughness={0.6} metalness={0.5} />
          </mesh>
          {/* Base Floor Plate */}
          <mesh position={[0, -0.44, 0]} receiveShadow>
            <boxGeometry args={[0.22, 0.025, 0.22]} />
            <meshStandardMaterial color="#232635" roughness={0.45} metalness={0.7} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/**
 * Floating dust motes.
 *
 * THE KEEP-OUT SPHERE.
 *
 * The spawn volume runs to z = +1.0 while the camera sits at z = 1.15, so a mote
 * can end up ~15 cm from the lens. A 1.6 cm additive sprite that close covers a
 * large part of the frame as a bright smear. The radius here is small — it only
 * excludes the pathological on-the-lens case and leaves the dust field itself
 * unchanged.
 */
const KEEP_OUT_SQ = 0.35 * 0.35

function AtmosphericDust() {
  const count = 140
  const pointsRef = useRef(null)

  const [positions, seeds] = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const sd = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 3.8
      pos[i * 3 + 1] = 0.8 + Math.random() * 2.2
      pos[i * 3 + 2] = (Math.random() - 0.5) * 2.8 - 0.4
      sd[i * 3] = Math.random() * Math.PI * 2
      sd[i * 3 + 1] = 0.2 + Math.random() * 0.8
      sd[i * 3 + 2] = Math.random() * Math.PI * 2
    }
    return [pos, sd]
  }, [])

  useFrame((state) => {
    if (!pointsRef.current) return
    const t = state.clock.getElapsedTime()
    const posAttr = pointsRef.current.geometry.attributes.position
    const arr = posAttr.array
    const camX = state.camera.position.x
    const camY = state.camera.position.y
    const camZ = state.camera.position.z

    for (let i = 0; i < count; i++) {
      const idx = i * 3
      const speed = seeds[idx + 1]
      const phase = seeds[idx]
      arr[idx] += Math.sin(t * 0.4 * speed + phase) * 0.0012
      arr[idx + 1] += Math.cos(t * 0.3 * speed + phase) * 0.0008 - 0.0002
      arr[idx + 2] += Math.sin(t * 0.5 * speed + seeds[idx + 2]) * 0.0009

      if (arr[idx + 1] < 0.8) arr[idx + 1] = 3.0
      if (arr[idx + 1] > 3.0) arr[idx + 1] = 0.8
      if (arr[idx] < -2.0) arr[idx] = 2.0
      if (arr[idx] > 2.0) arr[idx] = -2.0

      // Keep-out: a mote that has drifted onto the lens is pushed back out to
      // the far edge of the volume rather than being allowed to fill the frame.
      const dx = arr[idx] - camX
      const dy = arr[idx + 1] - camY
      const dz = arr[idx + 2] - camZ
      if (dx * dx + dy * dy + dz * dz < KEEP_OUT_SQ) arr[idx + 2] = -1.9
    }
    posAttr.needsUpdate = true
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.016}
        color="#ffcde3"
        transparent
        opacity={0.55}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  )
}

function HeavyPunchingBag({ position = [-1.8, 2.2, -2.2] }) {
  const bagRef = useRef(null)

  useFrame((state) => {
    if (!bagRef.current) return
    const t = state.clock.getElapsedTime()
    bagRef.current.rotation.z = Math.sin(t * 0.9) * 0.012
    bagRef.current.rotation.x = Math.cos(t * 0.7) * 0.009
  })

  return (
    <group position={position}>
      {/* Ceiling mounting bracket */}
      <mesh position={[0, 1.6, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.09, 0.04, 16]} />
        <meshStandardMaterial color="#2d3140" roughness={0.3} metalness={0.85} />
      </mesh>
      {/* Swivel eye bolt */}
      <mesh position={[0, 1.55, 0]}>
        <torusGeometry args={[0.035, 0.008, 12, 24]} />
        <meshStandardMaterial color="#b8c0d2" roughness={0.2} metalness={0.9} />
      </mesh>

      {/* Hanging Bag Assembly that sways */}
      <group ref={bagRef} position={[0, 1.52, 0]}>
        {/* 4 Suspension Chains */}
        {[-1, 1].map((sx) =>
          [-1, 1].map((sz) => (
            <mesh
              key={`chain-${sx}-${sz}`}
              position={[sx * 0.08, -0.22, sz * 0.08]}
              rotation={[sz * 0.12, 0, sx * -0.12]}
            >
              <cylinderGeometry args={[0.005, 0.005, 0.46, 8]} />
              <meshStandardMaterial color="#a4aebd" roughness={0.25} metalness={0.88} />
            </mesh>
          ))
        )}

        {/* Steel chain collar ring on top of bag */}
        <mesh position={[0, -0.44, 0]}>
          <cylinderGeometry args={[0.21, 0.21, 0.03, 24]} />
          <meshStandardMaterial color="#1e2230" roughness={0.4} metalness={0.8} />
        </mesh>

        {/* Main Heavy Leather Bag Cylinder */}
        <mesh position={[0, -1.02, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.22, 0.22, 1.15, 32]} />
          <meshStandardMaterial color="#2b0f19" roughness={0.52} metalness={0.08} />
        </mesh>

        {/* Contrast white & hot-pink reinforced combat vinyl bands */}
        <mesh position={[0, -0.65, 0]}>
          <cylinderGeometry args={[0.223, 0.223, 0.06, 32]} />
          <meshStandardMaterial color="#ffffff" roughness={0.4} metalness={0.05} />
        </mesh>
        <mesh position={[0, -0.72, 0]}>
          <cylinderGeometry args={[0.224, 0.224, 0.018, 32]} />
          <meshStandardMaterial
            color="#ff2e88"
            emissive="#ff2e88"
            emissiveIntensity={0.6}
            roughness={0.3}
          />
        </mesh>
        <mesh position={[0, -1.40, 0]}>
          <cylinderGeometry args={[0.223, 0.223, 0.06, 32]} />
          <meshStandardMaterial color="#ffffff" roughness={0.4} />
        </mesh>

        {/* Bottom weighted leather cap */}
        <mesh position={[0, -1.61, 0]}>
          <sphereGeometry args={[0.22, 28, 14, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
          <meshStandardMaterial color="#1f0a12" roughness={0.6} />
        </mesh>
      </group>
    </group>
  )
}

function TelemetryRack({ position = [2.0, 0.0, -2.4] }) {
  const ledsRef = useRef([])

  useFrame((state) => {
    const t = state.clock.getElapsedTime()
    ledsRef.current.forEach((mesh, idx) => {
      if (!mesh) return
      const on = Math.sin(t * (3 + idx * 0.7) + idx) > 0
      mesh.material.emissiveIntensity = on ? 1.8 : 0.2
    })
  })

  return (
    <group position={position}>
      {/* Heavy Server / Telemetry Console Cabinet */}
      <mesh position={[0, 1.1, 0]} receiveShadow castShadow>
        <boxGeometry args={[0.65, 2.2, 0.55]} />
        <meshStandardMaterial color="#131622" roughness={0.42} metalness={0.82} />
      </mesh>

      {/* Front Face Inset Panel */}
      <mesh position={[0, 1.1, 0.28]}>
        <boxGeometry args={[0.56, 2.05, 0.02]} />
        <meshStandardMaterial color="#1b1e2e" roughness={0.35} metalness={0.75} />
      </mesh>

      {/* CRT Oscilloscope Screen displaying cyan waveform telemetry */}
      <mesh position={[0, 1.62, 0.292]}>
        <boxGeometry args={[0.46, 0.34, 0.01]} />
        <meshStandardMaterial
          color="#061822"
          emissive="#00f0ff"
          emissiveIntensity={0.4}
          roughness={0.2}
          metalness={0.4}
        />
      </mesh>
      {/* Waveform line overlay on screen */}
      <mesh position={[0, 1.62, 0.298]}>
        <planeGeometry args={[0.42, 0.28]} />
        <meshBasicMaterial color="#00f0ff" wireframe transparent opacity={0.7} />
      </mesh>

      {/* Array of 8 diagnostic status LEDs */}
      {Array.from({ length: 8 }).map((_, i) => {
        const col = (i % 4) * 0.1 - 0.15
        const row = Math.floor(i / 4) * 0.05 + 1.34
        const color = i % 3 === 0 ? '#ff2e88' : i % 3 === 1 ? '#00f0ff' : '#ffe14d'
        return (
          <mesh
            key={`led-${i}`}
            ref={(el) => (ledsRef.current[i] = el)}
            position={[col, row, 0.295]}
          >
            <sphereGeometry args={[0.012, 12, 10]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={1.2}
              roughness={0.2}
            />
          </mesh>
        )
      })}

      {/* Dual circular pressure meters / dial gauges */}
      {[-0.12, 0.12].map((gx, idx) => (
        <group key={`gauge-${idx}`} position={[gx, 1.15, 0.292]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.075, 0.075, 0.016, 24]} />
            <meshStandardMaterial color="#2d3244" roughness={0.3} metalness={0.88} />
          </mesh>
          <mesh position={[0, 0, 0.01]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.065, 24]} />
            <meshStandardMaterial color="#e8ecf4" roughness={0.4} />
          </mesh>
          {/* Dial needle */}
          <mesh position={[0, 0.02, 0.014]} rotation={[0, 0, idx === 0 ? 0.6 : -0.8]}>
            <boxGeometry args={[0.004, 0.045, 0.002]} />
            <meshStandardMaterial color="#d62828" roughness={0.3} />
          </mesh>
        </group>
      ))}

      {/* Lower ventilation grill slots */}
      {Array.from({ length: 5 }).map((_, vi) => (
        <mesh key={`vent-${vi}`} position={[0, 0.45 + vi * 0.08, 0.292]}>
          <boxGeometry args={[0.42, 0.025, 0.008]} />
          <meshStandardMaterial color="#0b0d14" roughness={0.9} />
        </mesh>
      ))}

      {/* Heavy hydraulic conduit cable bundle curving across the floor */}
      <mesh position={[-0.45, 0.04, 0.45]} rotation={[0, 0.7, Math.PI / 2]}>
        <torusGeometry args={[0.55, 0.025, 12, 28, Math.PI * 0.7]} />
        <meshStandardMaterial color="#0a0a0f" roughness={0.85} metalness={0.2} />
      </mesh>
    </group>
  )
}

function IndustrialBackdrop() {
  const columns = [-2.8, -0.9, 0.9, 2.8]

  return (
    <group>
      {/* ==================== ROOM BACK WALL ==================== */}
      <mesh position={[0, 2.0, -3.3]} receiveShadow>
        <planeGeometry args={[9.5, 4.4]} />
        <meshStandardMaterial color="#11131a" roughness={0.65} metalness={0.45} />
      </mesh>

      {/* Acoustic / Armor wall panels with seams */}
      {[-2, 0, 2].map((px) => (
        <mesh key={`panel-${px}`} position={[px, 2.1, -3.28]} receiveShadow>
          <boxGeometry args={[1.7, 2.6, 0.02]} />
          <meshStandardMaterial color="#161824" roughness={0.58} metalness={0.5} />
        </mesh>
      ))}

      {/* Wall Graffiti Poster 1 (Left Wall): "SAME FACE. WORSE DECISIONS. :)" */}
      <group position={[-1.6, 2.3, -3.26]}>
        <mesh receiveShadow>
          <planeGeometry args={[0.75, 0.9]} />
          <meshStandardMaterial color="#f0ece1" roughness={0.85} />
        </mesh>
        {/* Poster Tape Tabs */}
        {[-0.32, 0.32].map((tx, ti) => (
          <mesh key={`tape-${ti}`} position={[tx, 0.44, 0.005]} rotation={[0, 0, (ti - 0.5) * 0.4]}>
            <planeGeometry args={[0.12, 0.04]} />
            <meshStandardMaterial color="#d4cebe" roughness={0.6} />
          </mesh>
        ))}
      </group>

      {/* Wall Graffiti Stencil 2 (Right Wall): "TEST DISTORT SHARE REPEAT" */}
      <group position={[1.4, 2.35, -3.26]}>
        <mesh receiveShadow>
          <planeGeometry args={[0.85, 0.95]} />
          <meshStandardMaterial color="#12131b" roughness={0.9} />
        </mesh>
      </group>

      {/* Vertical Hot-Pink Neon Light Tubes on Concrete Wall Columns */}
      {[-1.9, 1.9].map((nx, ni) => (
        <group key={`neon-tube-${ni}`} position={[nx, 2.1, -3.22]}>
          {/* Top/Bottom Tube Mounting Brackets */}
          {[-0.65, 0.65].map((my, mi) => (
            <mesh key={`bracket-${mi}`} position={[0, my, 0]}>
              <boxGeometry args={[0.04, 0.03, 0.04]} />
              <meshStandardMaterial color="#2d3345" roughness={0.3} metalness={0.88} />
            </mesh>
          ))}
          {/* Glass Neon Lamp Tube */}
          <mesh castShadow>
            <cylinderGeometry args={[0.016, 0.016, 1.25, 16]} />
            <meshStandardMaterial
              color="#ff2e88"
              emissive="#ff2e88"
              emissiveIntensity={2.8}
              roughness={0.15}
            />
          </mesh>
          <pointLight color="#ff2e88" intensity={1.6} distance={2.4} />
        </group>
      ))}

      {/* Heavy Structural Steel I-Beam Columns */}
      {columns.map((cx, idx) => (
        <group key={`col-${idx}`} position={[cx, 2.0, -3.22]}>
          {/* Central web */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.04, 4.4, 0.18]} />
            <meshStandardMaterial color="#222634" roughness={0.4} metalness={0.82} />
          </mesh>
          {/* Front flange plate */}
          <mesh position={[0, 0, 0.09]} castShadow receiveShadow>
            <boxGeometry args={[0.22, 4.4, 0.02]} />
            <meshStandardMaterial color="#262b3a" roughness={0.35} metalness={0.85} />
          </mesh>
          {/* Rivet plates at vertical intervals */}
          {[-1.5, 0, 1.5].map((ry) => (
            <mesh key={`rivet-${ry}`} position={[0, ry, 0.105]}>
              <boxGeometry args={[0.24, 0.08, 0.015]} />
              <meshStandardMaterial color="#353b50" roughness={0.3} metalness={0.9} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Overhead High-Voltage Cable Tray */}
      <group position={[0, 3.7, -3.0]}>
        {/* Wire mesh tray frame */}
        <mesh>
          <boxGeometry args={[9.0, 0.08, 0.32]} />
          <meshStandardMaterial color="#2b3042" roughness={0.4} metalness={0.8} />
        </mesh>
        {/* Bundled cables */}
        {[-0.08, 0.0, 0.08].map((cz, ci) => (
          <mesh
            key={`cable-${ci}`}
            position={[0, 0.06, cz]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.022, 0.022, 9.0, 12]} />
            <meshStandardMaterial
              color={ci === 0 ? '#ff2e88' : ci === 1 ? '#00f0ff' : '#22242e'}
              roughness={0.6}
            />
          </mesh>
        ))}
      </group>

      {/* Wall Facility Backlit Sign Plate */}
      <group position={[0, 3.0, -3.22]}>
        {/* Neon Pink Backlight Halo Box */}
        <mesh>
          <boxGeometry args={[2.4, 0.36, 0.02]} />
          <meshStandardMaterial
            color="#ff2e88"
            emissive="#ff2e88"
            emissiveIntensity={1.4}
            roughness={0.3}
          />
        </mesh>
        {/* Inner Dark Stencil Frame */}
        <mesh position={[0, 0, 0.015]}>
          <boxGeometry args={[2.3, 0.28, 0.01]} />
          <meshStandardMaterial color="#0d0e16" roughness={0.4} metalness={0.7} />
        </mesh>
        {/* Cyan Tech Status Accent Strip */}
        <mesh position={[0, -0.16, 0.018]}>
          <boxGeometry args={[2.1, 0.015, 0.008]} />
          <meshStandardMaterial
            color="#00f0ff"
            emissive="#00f0ff"
            emissiveIntensity={2.0}
            roughness={0.2}
          />
        </mesh>
      </group>

      {/* Base Hazard Chevron Stripes Wall Trim */}
      <group position={[0, 0.12, -3.25]}>
        <mesh>
          <boxGeometry args={[8.8, 0.22, 0.04]} />
          <meshStandardMaterial color="#222530" roughness={0.5} metalness={0.6} />
        </mesh>
        {/* Hazard yellow warning bar */}
        <mesh position={[0, 0.04, 0.022]}>
          <boxGeometry args={[8.6, 0.04, 0.008]} />
          <meshStandardMaterial color="#ffe14d" roughness={0.4} />
        </mesh>
      </group>

      {/* ==================== INDUSTRIAL FLOOR SLAB ==================== */}
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[9.5, 9.0]} />
        <meshStandardMaterial color="#0e1017" roughness={0.52} metalness={0.48} />
      </mesh>
      {/* Painted Yellow Safety Boundary Frame on floor */}
      <mesh position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.7, 1.76, 4]} />
        <meshStandardMaterial color="#ffe14d" roughness={0.4} />
      </mesh>
    </group>
  )
}

function CagedWorkLamps() {
  const lampPositions = [
    [-1.1, 2.7, -0.3],
    [1.1, 2.7, -0.3],
  ]

  return (
    <group>
      {lampPositions.map(([lx, ly, lz], idx) => (
        <group key={`lamp-${idx}`} position={[lx, ly, lz]}>
          {/* Drop cord from ceiling */}
          <mesh position={[0, 0.65, 0]}>
            <cylinderGeometry args={[0.004, 0.004, 1.3, 8]} />
            <meshStandardMaterial color="#1a1c24" roughness={0.8} />
          </mesh>

          {/* Heavy Socket Hood */}
          <mesh position={[0, 0.08, 0]} castShadow>
            <cylinderGeometry args={[0.05, 0.09, 0.12, 16]} />
            <meshStandardMaterial color="#2b2f3e" roughness={0.3} metalness={0.85} />
          </mesh>

          {/* Incandescent Glowing Bulb */}
          <mesh position={[0, -0.01, 0]}>
            <sphereGeometry args={[0.042, 18, 14]} />
            <meshStandardMaterial
              color="#fff0d0"
              emissive="#ffb347"
              emissiveIntensity={3.2}
              roughness={0.1}
            />
          </mesh>

          {/* Protective Wire Cage Rings */}
          {[0.0, -0.05, -0.09].map((wy, wi) => (
            <mesh key={`cage-ring-${wi}`} position={[0, wy, 0]}>
              <torusGeometry args={[0.065, 0.004, 8, 18]} />
              <meshStandardMaterial color="#8a94a6" roughness={0.25} metalness={0.9} />
            </mesh>
          ))}
          {/* Vertical cage wire ribs */}
          {Array.from({ length: 6 }).map((_, ri) => {
            const angle = (ri / 6) * Math.PI * 2
            return (
              <mesh
                key={`rib-${ri}`}
                position={[Math.cos(angle) * 0.065, -0.045, Math.sin(angle) * 0.065]}
              >
                <cylinderGeometry args={[0.003, 0.003, 0.12, 6]} />
                <meshStandardMaterial color="#8a94a6" roughness={0.25} metalness={0.9} />
              </mesh>
            )
          })}

          {/*
            Localized warm cone light. NOT a shadow caster, and that one word is
            the single biggest thing in this scene's frame budget.

            A point light's shadow is a CUBE map, so three.js re-renders every
            shadow-casting mesh in the scene six times per light, per frame.
            There are two of these lamps, so `castShadow` here was costing twelve
            extra full scene passes — against 97 shadow-casting meshes — to
            produce shadows from a decorative lamp 2.7 m up that is barely in
            frame. The key light is a single directional light and does all the
            shadow work that is actually visible.
          */}
          <pointLight color="#ffe2b0" intensity={1.6} distance={3.2} decay={2} />
        </group>
      ))}
    </group>
  )
}

