// React binding for the physics core.
//
// The core itself (src/physics/*) knows nothing about React — it is driven
// identically by useFrame here and by a for-loop in scripts/physics-sim.mjs.
// This hook only owns the lifecycle.

import { useCallback, useEffect, useRef, useState } from 'react'

import { createPhysicsWorld } from '../physics/world.js'
import { createHead } from '../physics/head.js'
import { createStriker } from '../physics/striker.js'
import { createImpactRouter } from '../physics/impact.js'
import { colliderFor, DEFAULT_WEAPON, heftOf } from '../physics/weapons.js'
import { RAPIER } from '../physics/world.js'

// Hitstop, in seconds, as a function of strength. The floor is deliberately
// short enough to read as weight rather than as a dropped frame; the ceiling is
// where a freeze starts to feel like the tab hung.
const HITSTOP_MIN = 0.015
const HITSTOP_MAX = 0.075

/**
 * @param {object} opts
 * @param {(impact: object) => void} opts.onImpact Called for every real contact.
 * @param {object} [opts.weapon] Current weapon definition.
 */
export function usePhysics({ onImpact, weapon = DEFAULT_WEAPON }) {
  const [ready, setReady] = useState(false)
  const rig = useRef(null)

  // Both held in refs so neither a new callback identity nor a weapon change
  // can retrigger the effect below. Rebuilding the world mid-run destroys the
  // head, its pose and the player's score-in-progress; the weapon only ever
  // needs a new COLLIDER, which striker.setShape swaps in place.
  const impactHandler = useRef(onImpact)
  impactHandler.current = onImpact
  const weaponRef = useRef(weapon)
  weaponRef.current = weapon

  useEffect(() => {
    let cancelled = false
    let built = null

    createPhysicsWorld().then((ctx) => {
      // StrictMode mounts effects twice in dev; without this the first world
      // leaks and two simulations fight over the same head.
      if (cancelled) {
        ctx.destroy()
        return
      }

      const head = createHead(ctx)
      const strikerL = createStriker(ctx, { parkAt: { x: -0.28, y: -50, z: 0 } })
      const strikerR = createStriker(ctx, { parkAt: { x: 0.28, y: -50, z: 0 } })
      const router = createImpactRouter({
        strikers: [
          {
            handle: () => strikerL.handle,
            position: strikerL.position,
            velocity: strikerL.velocity,
            id: 'left',
          },
          {
            handle: () => strikerR.handle,
            position: strikerR.position,
            velocity: strikerR.velocity,
            id: 'right',
          },
        ],
        head,
        weapon: () => weaponRef.current,
        onImpact: (impact) => {
          ctx.hitstop(HITSTOP_MIN + (HITSTOP_MAX - HITSTOP_MIN) * impact.strength)
          impactHandler.current?.(impact)
        },
      })

      built = { ctx, head, striker: strikerR, strikerL, strikerR, router }
      rig.current = built
      applyWeapon(strikerL, weaponRef.current)
      applyWeapon(strikerR, weaponRef.current)
      setReady(true)
    })

    return () => {
      cancelled = true
      if (built) {
        built.ctx.destroy()
        rig.current = null
      }
    }
  }, [])

  // Weapon → collider. Apply weapon colliders to both strikers.
  useEffect(() => {
    const r = rig.current
    if (r) {
      if (r.strikerL) applyWeapon(r.strikerL, weapon)
      if (r.strikerR) applyWeapon(r.strikerR, weapon)
    }
  }, [weapon])

  /**
   * Advance one rendered frame. Call from useFrame.
   * @param {number} dt Seconds since the last frame.
   * @param {{x,y,z}|null} observedL Left hand position in world space, or null.
   * @param {{x,y,z}|null} [observedR] Right hand position in world space, or null.
   */
  const step = useCallback((dt, observedL, observedR) => {
    const r = rig.current
    if (!r) return

    // If only one observed is provided, treat it as single-hand driving right striker
    const obsL = observedR !== undefined ? observedL : null
    const obsR = observedR !== undefined ? observedR : observedL

    r.strikerL?.aim({ observed: obsL, dt })
    r.strikerR?.aim({ observed: obsR, dt })

    r.ctx.step(dt, {
      beforeStep: (sub) => {
        // Walking both strikers across every substep prevents tunneling
        r.strikerL?.advance(sub)
        r.strikerR?.advance(sub)
        r.head.applyNeckSpring(sub)
      },
      afterStep: r.head.clampTilt,
      onCollision: r.router.handle,
    })
  }, [])

  return { ready, rig, step }
}

function applyWeapon(striker, weapon) {
  striker.setShape(colliderFor(weapon, RAPIER), {
    restitution: weapon.restitution,
    friction: weapon.friction,
    // reach is what turns a weapon from a cursor into something you swing.
    reach: weapon.reach ?? 0,
    swingDamp: weapon.swingDamp ?? 0.9,
    spinRate: weapon.spin ? 14 : 0,
  })
  // Cached on the weapon so the impact router does not recompute a cube root
  // on every contact event.
  weapon.heft = heftOf(weapon)
}
