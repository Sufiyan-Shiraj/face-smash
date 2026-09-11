import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const SKIN_TONE = '#d89b78'
const SKIN_WARM = '#cb8763'
const WRAP_COLOR = '#ece7dc'
const WRAP_DARK = '#242533'
const SLEEVE_DARK = '#181926'

/**
 * Full Articulated Human Combat Arm.
 * Renders complete Shoulder -> Upper Arm (Bicep/Tricep) -> Elbow Joint -> Forearm -> Wrist Wraps -> Boxing Glove/Fist.
 * Driven continuously by 2-Bone Inverse Kinematics.
 */
export default function FullArmMesh({
  ikRef,
  ikData,
  handedness = 'right',
}) {
  const isLeft = handedness === 'left' || handedness === 'Left'
  const accentColor = isLeft ? '#00f0ff' : '#ff2e88'
  const sign = isLeft ? -1 : 1

  const upperArmRef = useRef(null)
  const forearmRef = useRef(null)
  const elbowRef = useRef(null)
  const wristRef = useRef(null)

  useFrame(() => {
    const data = ikRef?.current || ikData
    if (!data) return

    const {
      elbow,
      wrist,
      upperArmMid,
      forearmMid,
      upperArmLen,
      forearmLen,
      upperArmQuat,
      forearmQuat,
      handQuat,
    } = data

    // 1. Upper Arm
    if (upperArmRef.current) {
      upperArmRef.current.position.copy(upperArmMid)
      upperArmRef.current.quaternion.copy(upperArmQuat)
      upperArmRef.current.scale.set(1, upperArmLen, 1)
    }

    // 2. Elbow Joint
    if (elbowRef.current) {
      elbowRef.current.position.copy(elbow)
      elbowRef.current.quaternion.copy(upperArmQuat)
    }

    // 3. Forearm
    if (forearmRef.current) {
      forearmRef.current.position.copy(forearmMid)
      forearmRef.current.quaternion.copy(forearmQuat)
      forearmRef.current.scale.set(1, forearmLen, 1)
    }

    // 4. Wrist Wraps Collar
    if (wristRef.current) {
      wristRef.current.position.copy(wrist)
      if (handQuat) {
        wristRef.current.quaternion.copy(handQuat)
      }
    }
  })

  return (
    <group>
      {/*
        No shoulder cap. The shoulder joint now sits just behind the camera's
        near plane (see SHOULDER_FORWARD in Lab3D), so a deltoid sphere there is
        either invisible or, when it was pushed forward into the playfield, a
        dark ball hanging in the middle of the screen between the player and the
        target. The arm simply emerges from off-camera, which is what a
        first-person arm does.
      */}

      {/* 2. Upper Arm (Bicep & Tricep) */}
      <group ref={upperArmRef}>
        {/* Main upper arm shaft */}
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[0.062, 0.074, 1, 20]} />
          <meshStandardMaterial color={SKIN_TONE} roughness={0.68} metalness={0.02} />
        </mesh>
        {/* Athletic compression sleeve upper portion */}
        <mesh position={[0, 0.22, 0]} scale={[1.03, 0.45, 1.03]}>
          <cylinderGeometry args={[0.067, 0.074, 1, 20]} />
          <meshStandardMaterial color={SLEEVE_DARK} roughness={0.7} metalness={0.1} />
        </mesh>
        {/* Bicep muscle peak contour */}
        <mesh position={[0, 0.04, 0.018]} scale={[0.038, 0.42, 0.032]} castShadow>
          <capsuleGeometry args={[1, 1, 8, 12]} />
          <meshStandardMaterial color={SKIN_WARM} roughness={0.7} metalness={0.02} />
        </mesh>
        {/* Tricep lateral head contour */}
        <mesh position={[0.014 * sign, 0.02, -0.016]} scale={[0.032, 0.38, 0.028]} castShadow>
          <capsuleGeometry args={[1, 1, 8, 12]} />
          <meshStandardMaterial color={SKIN_WARM} roughness={0.72} metalness={0.02} />
        </mesh>
      </group>

      {/* 3. Elbow Joint */}
      <group ref={elbowRef}>
        <mesh castShadow receiveShadow>
          <sphereGeometry args={[0.064, 18, 14]} />
          <meshStandardMaterial color={SKIN_TONE} roughness={0.65} metalness={0.02} />
        </mesh>
        {/* Elastic athletic elbow compression sleeve ring */}
        <mesh scale={[1.05, 0.045, 1.05]} castShadow>
          <cylinderGeometry args={[0.063, 0.063, 1, 20]} />
          <meshStandardMaterial color={WRAP_DARK} roughness={0.6} metalness={0.15} />
        </mesh>
        {/* Sleek neon brand accent band on elbow */}
        <mesh scale={[1.07, 0.012, 1.07]}>
          <cylinderGeometry args={[0.063, 0.063, 1, 20]} />
          <meshStandardMaterial
            color={accentColor}
            emissive={accentColor}
            emissiveIntensity={1.2}
            roughness={0.3}
          />
        </mesh>
      </group>

      {/* 4. Forearm (Brachioradialis Muscle & Wrist Taper) */}
      <group ref={forearmRef}>
        {/* Forearm muscular shaft */}
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[0.052, 0.063, 1, 20]} />
          <meshStandardMaterial color={SKIN_TONE} roughness={0.68} metalness={0.02} />
        </mesh>
        {/* Brachioradialis lateral forearm muscle contour */}
        <mesh position={[0.016 * sign, 0.08, 0.008]} scale={[0.034, 0.46, 0.028]} castShadow>
          <capsuleGeometry args={[1, 1, 8, 12]} />
          <meshStandardMaterial color={SKIN_WARM} roughness={0.7} metalness={0.02} />
        </mesh>
      </group>

      {/* 5. Heavy Combat Wrist Wraps Collar */}
      <group ref={wristRef}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.055, 0.058, 0.066, 22]} />
          <meshStandardMaterial color={WRAP_DARK} roughness={0.62} metalness={0.15} />
        </mesh>
        <mesh position={[0, 0, -0.012]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.057, 0.059, 0.028, 22]} />
          <meshStandardMaterial color={WRAP_COLOR} roughness={0.88} />
        </mesh>
        {/* Neon combat rubber tab */}
        <mesh position={[0.060 * sign, 0, -0.016]} scale={[0.004, 0.016, 0.012]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            color={accentColor}
            emissive={accentColor}
            emissiveIntensity={1.4}
            roughness={0.25}
          />
        </mesh>
      </group>
    </group>
  )
}
