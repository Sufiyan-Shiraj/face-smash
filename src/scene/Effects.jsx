import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

// Impact effects: debris shards, high-speed spark streaks, dual shockwave rings,
// flare, flash, and camera trauma recoil.
//
// All driven by the ONE impact record the physics produced, so they agree with
// each other and with the damage number by construction.
// Imperative handle and flat typed-array mutation for locked 60 FPS.

const MAX_DEBRIS = 160
const DEBRIS_PER_HIT = 22
const GRAVITY = -6.2

const MAX_SPARKS = 80
const SPARKS_PER_HIT = 16

const MAX_RINGS = 4
const RING_LIFE = 0.36
const FLARE_LIFE = 0.16

const TRAUMA_DECAY = 2.8

const tmpObj = new THREE.Object3D()
const tmpColor = new THREE.Color()
const tmpVec = new THREE.Vector3()
const tmpVel = new THREE.Vector3()
const UNIT_Z = new THREE.Vector3(0, 0, 1)
const UNIT_Y = new THREE.Vector3(0, 1, 0)
const tmpQuat = new THREE.Quaternion()

/**
 * Soft four-point star, drawn once into an offscreen canvas.
 */
function makeFlareTexture() {
  const size = 128
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')
  const mid = size / 2

  const glow = g.createRadialGradient(mid, mid, 0, mid, mid, mid)
  glow.addColorStop(0, 'rgba(255,255,255,1)')
  glow.addColorStop(0.2, 'rgba(255,245,210,0.85)')
  glow.addColorStop(0.55, 'rgba(255,60,150,0.35)')
  glow.addColorStop(1, 'rgba(255,46,136,0)')
  g.fillStyle = glow
  g.fillRect(0, 0, size, size)

  // Two crossed tapered spikes for comic impact star
  g.fillStyle = 'rgba(255,255,255,0.95)'
  for (const angle of [0, Math.PI / 2]) {
    g.save()
    g.translate(mid, mid)
    g.rotate(angle)
    g.beginPath()
    g.moveTo(-mid, 0)
    g.lineTo(0, -mid * 0.08)
    g.lineTo(mid, 0)
    g.lineTo(0, mid * 0.08)
    g.closePath()
    g.fill()
    g.restore()
  }

  // Diagonal micro spikes
  g.fillStyle = 'rgba(255,230,120,0.7)'
  for (const angle of [Math.PI / 4, (3 * Math.PI) / 4]) {
    g.save()
    g.translate(mid, mid)
    g.rotate(angle)
    g.beginPath()
    g.moveTo(-mid * 0.55, 0)
    g.lineTo(0, -mid * 0.04)
    g.lineTo(mid * 0.55, 0)
    g.lineTo(0, mid * 0.04)
    g.closePath()
    g.fill()
    g.restore()
  }

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/**
 * @param {object} props
 * @param {{current: object|null}} props.effectsRef Receives the imperative handle.
 */
export default function Effects({ effectsRef }) {
  const { camera, size } = useThree()
  const debrisMeshRef = useRef(null)
  const sparkMeshRef = useRef(null)
  const flashRef = useRef(null)

  // Debris pool (tumbling geometric shards)
  const debrisPool = useMemo(
    () => ({
      px: new Float32Array(MAX_DEBRIS),
      py: new Float32Array(MAX_DEBRIS),
      pz: new Float32Array(MAX_DEBRIS),
      vx: new Float32Array(MAX_DEBRIS),
      vy: new Float32Array(MAX_DEBRIS),
      vz: new Float32Array(MAX_DEBRIS),
      life: new Float32Array(MAX_DEBRIS),
      ttl: new Float32Array(MAX_DEBRIS),
      size: new Float32Array(MAX_DEBRIS),
      spin: new Float32Array(MAX_DEBRIS),
      cursor: 0,
    }),
    []
  )
  const debrisColors = useMemo(
    () => new THREE.InstancedBufferAttribute(new Float32Array(MAX_DEBRIS * 3), 3),
    []
  )

  // Spark streaks pool (fast, bright velocity-aligned streaks)
  const sparkPool = useMemo(
    () => ({
      px: new Float32Array(MAX_SPARKS),
      py: new Float32Array(MAX_SPARKS),
      pz: new Float32Array(MAX_SPARKS),
      vx: new Float32Array(MAX_SPARKS),
      vy: new Float32Array(MAX_SPARKS),
      vz: new Float32Array(MAX_SPARKS),
      life: new Float32Array(MAX_SPARKS),
      ttl: new Float32Array(MAX_SPARKS),
      len: new Float32Array(MAX_SPARKS),
      cursor: 0,
    }),
    []
  )
  const sparkColors = useMemo(
    () => new THREE.InstancedBufferAttribute(new Float32Array(MAX_SPARKS * 3), 3),
    []
  )

  // Concentric dual shockwave rings
  const rings = useMemo(
    () =>
      Array.from({ length: MAX_RINGS }, () => ({
        t: RING_LIFE,
        strength: 0,
        pos: new THREE.Vector3(),
        quat: new THREE.Quaternion(),
      })),
    []
  )
  const ringInnerRefs = useRef([])
  const ringOuterRefs = useRef([])
  const ringCursor = useRef(0)

  // Camera-facing impact flare
  const flare = useRef({ t: FLARE_LIFE, strength: 0, pos: new THREE.Vector3() })
  const flareRef = useRef(null)
  const flareTex = useMemo(() => makeFlareTexture(), [])

  // Flash point light
  const flash = useRef({ t: 0, life: 0, strength: 0 })

  // Camera shake & directional recoil
  const trauma = useRef(0)
  const recoil = useRef(new THREE.Vector3())
  const base = useRef(null)

  useEffect(() => {
    base.current = { pos: camera.position.clone(), quat: camera.quaternion.clone() }
  }, [camera])

  useEffect(() => {
    if (!effectsRef) return

    effectsRef.current = {
      /**
       * Projects a 3D world coordinate into 2D viewport coordinates.
       */
      toScreen(worldPoint) {
        tmpVec.set(worldPoint.x, worldPoint.y, worldPoint.z)
        tmpVec.project(camera)
        return {
          x: ((tmpVec.x + 1) / 2) * size.width,
          y: ((-tmpVec.y + 1) / 2) * size.height,
        }
      },

      /**
       * @param {object} impact From physics/impact.js.
       * @param {[number,number,number]} [tint] Color tint.
       */
      burst(impact, tint) {
        const s = impact?.strength ?? 0.5
        const n = impact?.normal ?? { x: 0, y: 0, z: 1 }
        const t = impact?.travel ?? impact?.localTravel ?? { x: 0, y: 0, z: -1 }
        const tl = Math.hypot(t.x, t.y, t.z) || 1
        const tx = t.x / tl
        const ty = t.y / tl
        const tz = t.z / tl

        // Reflection vector across the contact surface normal
        const dot = tx * n.x + ty * n.y + tz * n.z
        let rx = tx - 2 * dot * n.x
        let ry = ty - 2 * dot * n.y
        let rz = tz - 2 * dot * n.z
        const rl = Math.hypot(rx, ry, rz) || 1
        rx /= rl
        ry /= rl
        rz /= rl

        // 1. Spawning Debris Shards
        const debrisCount = Math.max(8, Math.round(DEBRIS_PER_HIT * (0.4 + s * 0.8)))
        const debrisSpeed = 1.1 + s * 3.6

        for (let i = 0; i < debrisCount; i++) {
          const k = debrisPool.cursor
          debrisPool.cursor = (debrisPool.cursor + 1) % MAX_DEBRIS

          debrisPool.px[k] = impact.point.x
          debrisPool.py[k] = impact.point.y
          debrisPool.pz[k] = impact.point.z

          const spread = 0.8 - s * 0.35
          const jx = (Math.random() * 2 - 1) * spread
          const jy = (Math.random() * 2 - 1) * spread
          const jz = (Math.random() * 2 - 1) * spread
          const v = debrisSpeed * (0.5 + Math.random() * 0.8)

          debrisPool.vx[k] = (rx + jx) * v
          debrisPool.vy[k] = (ry + jy) * v + 0.7
          debrisPool.vz[k] = (rz + jz) * v
          debrisPool.ttl[k] = 0.35 + Math.random() * 0.45
          debrisPool.life[k] = debrisPool.ttl[k]
          debrisPool.size[k] = (0.007 + Math.random() * 0.014) * (0.6 + s * 0.8)
          debrisPool.spin[k] = (Math.random() * 2 - 1) * 16

          const jc = 0.75 + Math.random() * 0.5
          const c = tmpColor.setRGB(
            (tint?.[0] ?? 1.0) * jc,
            (tint?.[1] ?? 0.22) * jc,
            (tint?.[2] ?? 0.45) * jc
          )
          debrisColors.array[k * 3] = c.r
          debrisColors.array[k * 3 + 1] = c.g
          debrisColors.array[k * 3 + 2] = c.b
        }
        debrisColors.needsUpdate = true

        // 2. Spawning High-Velocity Spark Streaks
        const sparkCount = Math.max(10, Math.round(SPARKS_PER_HIT * (0.5 + s * 0.9)))
        const sparkSpeed = 3.2 + s * 5.8

        for (let i = 0; i < sparkCount; i++) {
          const sk = sparkPool.cursor
          sparkPool.cursor = (sparkPool.cursor + 1) % MAX_SPARKS

          sparkPool.px[sk] = impact.point.x
          sparkPool.py[sk] = impact.point.y
          sparkPool.pz[sk] = impact.point.z

          // Tighter radial cone along reflection
          const spSpread = 0.55 - s * 0.2
          const sjx = (Math.random() * 2 - 1) * spSpread
          const sjy = (Math.random() * 2 - 1) * spSpread
          const sjz = (Math.random() * 2 - 1) * spSpread
          const sv = sparkSpeed * (0.65 + Math.random() * 0.7)

          sparkPool.vx[sk] = (rx + sjx) * sv
          sparkPool.vy[sk] = (ry + sjy) * sv
          sparkPool.vz[sk] = (rz + sjz) * sv
          sparkPool.ttl[sk] = 0.12 + Math.random() * 0.16
          sparkPool.life[sk] = sparkPool.ttl[sk]
          sparkPool.len[sk] = (0.06 + Math.random() * 0.1) * (0.7 + s * 1.2)

          // Electric gold & hot neon pink sparks
          const isGold = Math.random() > 0.35
          if (isGold) {
            sparkColors.array[sk * 3] = 1.0
            sparkColors.array[sk * 3 + 1] = 0.88
            sparkColors.array[sk * 3 + 2] = 0.35
          } else {
            sparkColors.array[sk * 3] = 1.0
            sparkColors.array[sk * 3 + 1] = 0.18
            sparkColors.array[sk * 3 + 2] = 0.55
          }
        }
        sparkColors.needsUpdate = true

        // 3. Shockwave rings (inner hot ring + outer expanding halo)
        const ring = rings[ringCursor.current]
        ringCursor.current = (ringCursor.current + 1) % MAX_RINGS
        ring.t = 0
        ring.strength = s
        ring.pos.set(impact.point.x, impact.point.y, impact.point.z)
        ring.quat.setFromUnitVectors(UNIT_Z, tmpVec.set(-n.x, -n.y, -n.z).normalize())

        // 4. Impact star flare
        flare.current.t = 0
        flare.current.strength = s
        flare.current.pos.set(impact.point.x, impact.point.y, impact.point.z)

        // 5. Flash point light
        flash.current.life = 0.14 + s * 0.12
        flash.current.t = 0
        flash.current.strength = s
        if (flashRef.current) flashRef.current.position.set(impact.point.x, impact.point.y, impact.point.z)

        // 6. Camera Trauma & Recoil Kick
        trauma.current = Math.min(1.2, trauma.current + 0.42 + s * 0.7)
        // Recoil kick in the direction of the weapon travel
        recoil.current.x += tx * (0.008 + s * 0.02)
        recoil.current.y += ty * (0.005 + s * 0.012)
        recoil.current.z += tz * (0.012 + s * 0.025)
      },
    }

    return () => {
      if (effectsRef) effectsRef.current = null
    }
  }, [effectsRef, camera, size, debrisPool, debrisColors, sparkPool, sparkColors, rings])

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)

    // --- 1. Debris Shards Update ------------------------------------------
    const dMesh = debrisMeshRef.current
    if (dMesh) {
      for (let i = 0; i < MAX_DEBRIS; i++) {
        if (debrisPool.life[i] <= 0) {
          tmpObj.position.set(0, -999, 0)
          tmpObj.scale.setScalar(0)
          tmpObj.updateMatrix()
          dMesh.setMatrixAt(i, tmpObj.matrix)
          continue
        }

        debrisPool.life[i] -= dt
        debrisPool.vy[i] += GRAVITY * dt
        debrisPool.px[i] += debrisPool.vx[i] * dt
        debrisPool.py[i] += debrisPool.vy[i] * dt
        debrisPool.pz[i] += debrisPool.vz[i] * dt

        const u = Math.max(debrisPool.life[i] / debrisPool.ttl[i], 0)
        tmpObj.position.set(debrisPool.px[i], debrisPool.py[i], debrisPool.pz[i])
        tmpObj.rotation.set(
          debrisPool.spin[i] * debrisPool.life[i],
          debrisPool.spin[i] * debrisPool.life[i] * 0.7,
          0
        )
        tmpObj.scale.setScalar(debrisPool.size[i] * Math.sqrt(u))
        tmpObj.updateMatrix()
        dMesh.setMatrixAt(i, tmpObj.matrix)
      }
      dMesh.instanceMatrix.needsUpdate = true
    }

    // --- 2. High-Speed Spark Streaks Update --------------------------------
    const sMesh = sparkMeshRef.current
    if (sMesh) {
      for (let i = 0; i < MAX_SPARKS; i++) {
        if (sparkPool.life[i] <= 0) {
          tmpObj.position.set(0, -999, 0)
          tmpObj.scale.setScalar(0)
          tmpObj.updateMatrix()
          sMesh.setMatrixAt(i, tmpObj.matrix)
          continue
        }

        sparkPool.life[i] -= dt
        sparkPool.px[i] += sparkPool.vx[i] * dt
        sparkPool.py[i] += sparkPool.vy[i] * dt
        sparkPool.pz[i] += sparkPool.vz[i] * dt

        const u = Math.max(sparkPool.life[i] / sparkPool.ttl[i], 0)
        tmpObj.position.set(sparkPool.px[i], sparkPool.py[i], sparkPool.pz[i])

        // Orient spark cylinder along its velocity direction
        tmpVel.set(sparkPool.vx[i], sparkPool.vy[i], sparkPool.vz[i]).normalize()
        tmpQuat.setFromUnitVectors(UNIT_Y, tmpVel)
        tmpObj.quaternion.copy(tmpQuat)

        // Stretch along velocity, shrink radius as life drops
        const len = sparkPool.len[i] * (0.4 + u * 0.6)
        const rad = 0.0035 * u
        tmpObj.scale.set(rad, len, rad)
        tmpObj.updateMatrix()
        sMesh.setMatrixAt(i, tmpObj.matrix)
      }
      sMesh.instanceMatrix.needsUpdate = true
    }

    // --- 3. Flash Point Light ---------------------------------------------
    const f = flash.current
    if (f.life > 0) {
      f.t += dt
      const u = 1 - Math.min(f.t / f.life, 1)
      if (flashRef.current) flashRef.current.intensity = u * u * (0.8 + f.strength * 4.2)
      if (f.t >= f.life) {
        f.life = 0
        if (flashRef.current) flashRef.current.intensity = 0
      }
    }

    // --- 4. Concentric Shockwave Rings ------------------------------------
    for (let i = 0; i < MAX_RINGS; i++) {
      const r = rings[i]
      const mInner = ringInnerRefs.current[i]
      const mOuter = ringOuterRefs.current[i]

      if (r.t >= RING_LIFE) {
        if (mInner) mInner.visible = false
        if (mOuter) mOuter.visible = false
        continue
      }
      r.t += dt
      const u = Math.min(r.t / RING_LIFE, 1)

      // Inner fast incandescent ring
      if (mInner) {
        mInner.visible = true
        mInner.position.copy(r.pos)
        mInner.quaternion.copy(r.quat)
        const growInner = 1 - (1 - u) * (1 - u)
        mInner.scale.setScalar(0.015 + growInner * (0.09 + r.strength * 0.18))
        mInner.material.opacity = (1 - u) * (1 - u) * (0.85 + r.strength * 0.15)
      }

      // Outer wide neon shockwave ring
      if (mOuter) {
        mOuter.visible = true
        mOuter.position.copy(r.pos)
        mOuter.quaternion.copy(r.quat)
        const growOuter = Math.pow(u, 0.65)
        mOuter.scale.setScalar(0.02 + growOuter * (0.16 + r.strength * 0.32))
        mOuter.material.opacity = (1 - u) * (0.6 + r.strength * 0.4)
      }
    }

    // --- 5. Impact Star Flare ----------------------------------------------
    const fl = flare.current
    if (flareRef.current) {
      if (fl.t >= FLARE_LIFE) {
        flareRef.current.visible = false
      } else {
        fl.t += dt
        const u = Math.min(fl.t / FLARE_LIFE, 1)
        flareRef.current.visible = true
        flareRef.current.position.copy(fl.pos)
        flareRef.current.quaternion.copy(camera.quaternion)
        flareRef.current.scale.setScalar((0.09 + fl.strength * 0.48) * (0.4 + u * 0.8))
        flareRef.current.material.opacity = (1 - u) * (0.75 + fl.strength * 0.25)
      }
    }

    // --- 6. Camera Shake & Recoil -----------------------------------------
    const b = base.current
    if (b) {
      // Decay directional recoil impulse rapidly
      recoil.current.multiplyScalar(Math.max(0, 1 - 16 * dt))

      if (trauma.current > 0) {
        trauma.current = Math.max(0, trauma.current - TRAUMA_DECAY * dt)
        const amp = trauma.current * trauma.current
        const t = state.clock.elapsedTime

        const ox = Math.sin(t * 52.3) * 0.024 * amp + recoil.current.x
        const oy = Math.sin(t * 67.1 + 1.4) * 0.022 * amp + recoil.current.y
        const oz = recoil.current.z
        const roll = Math.sin(t * 43.1 + 2.7) * 0.028 * amp

        camera.position.set(b.pos.x + ox, b.pos.y + oy, b.pos.z + oz)
        camera.quaternion.copy(b.quat)
        camera.rotateZ(roll)
      } else if (recoil.current.lengthSq() > 1e-6) {
        camera.position.set(
          b.pos.x + recoil.current.x,
          b.pos.y + recoil.current.y,
          b.pos.z + recoil.current.z
        )
        camera.quaternion.copy(b.quat)
      } else {
        camera.position.copy(b.pos)
        camera.quaternion.copy(b.quat)
      }
    }
  })

  return (
    <>
      {/* Geometric Debris Shards */}
      <instancedMesh
        ref={debrisMeshRef}
        args={[undefined, undefined, MAX_DEBRIS]}
        frustumCulled={false}
      >
        <tetrahedronGeometry args={[1, 0]} />
        <meshStandardMaterial
          vertexColors
          roughness={0.5}
          emissive="#ff2e88"
          emissiveIntensity={0.5}
        />
        <instancedBufferAttribute attach="geometry-attributes-color" args={[debrisColors.array, 3]} />
      </instancedMesh>

      {/* High-Velocity Spark Streaks */}
      <instancedMesh
        ref={sparkMeshRef}
        args={[undefined, undefined, MAX_SPARKS]}
        frustumCulled={false}
      >
        <cylinderGeometry args={[1, 1, 1, 6]} />
        <meshBasicMaterial
          vertexColors
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          transparent
        />
        <instancedBufferAttribute attach="geometry-attributes-color" args={[sparkColors.array, 3]} />
      </instancedMesh>

      {/* Inner Incandescent Shockwave Rings */}
      {rings.map((_, i) => (
        <mesh
          key={`inner-${i}`}
          ref={(el) => (ringInnerRefs.current[i] = el)}
          visible={false}
          frustumCulled={false}
        >
          <ringGeometry args={[0.55, 1, 36]} />
          <meshBasicMaterial
            color="#fff8d6"
            transparent
            opacity={0}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}

      {/* Outer Neon-Pink Shockwave Rings */}
      {rings.map((_, i) => (
        <mesh
          key={`outer-${i}`}
          ref={(el) => (ringOuterRefs.current[i] = el)}
          visible={false}
          frustumCulled={false}
        >
          <ringGeometry args={[0.88, 1, 44]} />
          <meshBasicMaterial
            color="#ff2e88"
            transparent
            opacity={0}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}

      {/* Impact Flare Quad */}
      <mesh ref={flareRef} visible={false} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          map={flareTex}
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Impact Point Light Flash */}
      <pointLight ref={flashRef} intensity={0} color="#fff2cc" distance={1.2} decay={2} />
    </>
  )
}

