import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import Lab3D from '../scene/Lab3D.jsx'
import WebcamFeed from '../scene/WebcamFeed.jsx'
import { usePhysics } from '../game/usePhysics.js'
import { useHandTracking } from '../game/useHandTracking.js'
import { DEFAULT_WEAPON } from '../physics/weapons.js'
import { registerImpact, run, startRun, subscribe } from '../game/runState.js'
import { spawnComicHit } from '../scene/comicSvg.js'
import { HEAD_STATUS, getHeadModel, subscribeHeadModel } from '../capture/headModel.js'
import {
  playPunch,
  playSuperpunch,
  playSuperflick,
  playSlap,
  playWhoosh,
  playCombo,
  playKnockout,
} from '../audio/soundEngine.js'
import './lab.css'

/* ==================== CUSTOM SVG ICON COMPONENTS (ZERO EMOJIS) ==================== */

function SvgBoxingGlove({ active }) {
  return (
    <svg width="30" height="30" viewBox="0 0 32 32" fill="none" className="custom-svg-icon">
      <defs>
        <linearGradient id="gloveLeatherGrad" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={active ? '#ff3388' : '#e61e6e'} />
          <stop offset="100%" stopColor={active ? '#940b44' : '#5a0628'} />
        </linearGradient>
      </defs>
      {/* Glove main padded punch body */}
      <path
        d="M8 12C8 6.5 13 4 19 5C25 6 27 10 27 15C27 21 24 23 20 23H13C9 23 8 18 8 12Z"
        fill="url(#gloveLeatherGrad)"
        stroke={active ? '#ff66aa' : '#ff2e88'}
        strokeWidth="1.8"
      />
      {/* Padded thumb curve */}
      <path
        d="M8 13C6 14 4.5 16.5 5 19C5.5 21.5 8 22 10 21.5"
        fill="url(#gloveLeatherGrad)"
        stroke={active ? '#ff66aa' : '#ff2e88'}
        strokeWidth="1.8"
      />
      {/* Wrist cuff tape */}
      <rect x="11" y="22" width="10" height="6" rx="2" fill="#ded7cb" stroke="#181824" strokeWidth="1.5" />
      {/* Glove laces */}
      <line x1="14" y1="24" x2="18" y2="24" stroke="#ff2e88" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="14" y1="26" x2="18" y2="26" stroke="#ff2e88" strokeWidth="1.6" strokeLinecap="round" />
      {/* Dynamic light highlight sheen */}
      <path d="M14 7C17 7.5 22 9.5 23 13" stroke="rgba(255,255,255,0.7)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function SvgFistWraps({ active }) {
  return (
    <svg width="30" height="30" viewBox="0 0 32 32" fill="none" className="custom-svg-icon">
      <defs>
        <linearGradient id="fistSkinGrad" x1="6" y1="6" x2="26" y2="26" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f7d0b3" />
          <stop offset="100%" stopColor="#c78c66" />
        </linearGradient>
      </defs>
      {/* Clenched fist palm body */}
      <rect x="7" y="10" width="18" height="12" rx="4" fill="url(#fistSkinGrad)" stroke="#1a1a24" strokeWidth="1.6" />
      {/* Articulated knuckles */}
      <circle cx="9" cy="9" r="2.5" fill="#f7d0b3" stroke="#1a1a24" strokeWidth="1.2" />
      <circle cx="14" cy="8.2" r="2.8" fill="#f7d0b3" stroke="#1a1a24" strokeWidth="1.2" />
      <circle cx="19" cy="8.6" r="2.6" fill="#f7d0b3" stroke="#1a1a24" strokeWidth="1.2" />
      <circle cx="23.5" cy="9.8" r="2.2" fill="#f7d0b3" stroke="#1a1a24" strokeWidth="1.2" />
      {/* Clenched thumb lock */}
      <path d="M6 14C6 17 8 19 12 19" stroke="#1a1a24" strokeWidth="2.2" strokeLinecap="round" />
      {/* Wrist athletic wrap bandages */}
      <rect x="8" y="18" width="16" height="4" fill="#ded7cb" stroke="#1a1a24" strokeWidth="1.2" />
      <rect x="9" y="21" width="14" height="6" fill="#181924" stroke={active ? '#ff2e88' : '#33384a'} strokeWidth="1.4" />
      <line x1="10" y1="24" x2="22" y2="24" stroke="#ff2e88" strokeWidth="1.6" />
    </svg>
  )
}

function SvgBust({ active }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="custom-svg-icon">
      <defs>
        <linearGradient id="bustGrad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={active ? '#00f0ff' : '#6fb4ff'} />
          <stop offset="100%" stopColor={active ? '#ff2e88' : '#334466'} />
        </linearGradient>
      </defs>
      <path
        d="M12 2C8.7 2 6.5 4.5 6.5 8C6.5 11 8.5 13.5 12 13.5C15.5 13.5 17.5 11 17.5 8C17.5 4.5 15.3 2 12 2Z"
        fill="url(#bustGrad)"
        fillOpacity="0.35"
        stroke={active ? '#00f0ff' : '#88a0cc'}
        strokeWidth="1.6"
      />
      <line x1="8" y1="5.5" x2="16" y2="5.5" stroke={active ? '#00f0ff' : '#88a0cc'} strokeWidth="1" strokeOpacity="0.8" />
      <line x1="7.5" y1="8.5" x2="16.5" y2="8.5" stroke={active ? '#00f0ff' : '#88a0cc'} strokeWidth="1" strokeOpacity="0.8" />
      <line x1="9" y1="11.5" x2="15" y2="11.5" stroke={active ? '#00f0ff' : '#88a0cc'} strokeWidth="1" strokeOpacity="0.8" />
      <path
        d="M4 22C4 18 7.5 16 12 16C16.5 16 20 18 20 22"
        stroke={active ? '#00f0ff' : '#88a0cc'}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

function SvgDummy({ active }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="custom-svg-icon">
      <circle
        cx="12"
        cy="9"
        r="7"
        fill={active ? 'rgba(255, 225, 77, 0.2)' : 'rgba(100, 100, 120, 0.2)'}
        stroke={active ? '#ffe14d' : '#8890aa'}
        strokeWidth="1.6"
      />
      <path d="M12 2V16M5 9H19" stroke={active ? '#ffe14d' : '#8890aa'} strokeWidth="1.2" />
      <path d="M12 9H19A7 7 0 0 1 12 16V9Z" fill={active ? '#ffe14d' : '#8890aa'} fillOpacity="0.4" />
      <path d="M5 9A7 7 0 0 1 12 2V9H5Z" fill={active ? '#ffe14d' : '#8890aa'} fillOpacity="0.4" />
      <path d="M9 17L6 22H18L15 17" stroke={active ? '#ffe14d' : '#8890aa'} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  )
}

function SvgSmashFist() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="smash-svg-fist">
      <path
        d="M5 11V6a2 2 0 0 1 4 0v5m0-3a2 2 0 0 1 4 0v3m0-2a2 2 0 0 1 4 0v3m-8 4H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2m13 7a4 4 0 0 1-8 0"
        stroke="#ffffff"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/* ==================== ACTION & COMIC CALLOUT LABELS ==================== */

const KIND_LABEL = {
  superpunch: 'SUPER-PUNCH!',
  superflick: 'SUPER-FLICK!',
  superslap: 'MEGA-SLAP!',
  chop: 'KARATE CHOP!',
  poke: 'FINGER JAB!',
  punch: 'PUNCH!',
  hook: 'HOOK!',
  uppercut: 'UPPERCUT!',
  slap: 'SLAP!',
}

const REGION_WORDS = {
  nose: ['CRUNCH!', 'SNOUT SMASH!', 'NOSEBREAKER!', 'WHAM!'],
  jaw: ['JAWBREAKER!', 'UPPERCUT!', 'CLOCKED!', 'KA-POW!'],
  chin: ['CHIN CHECK!', 'UPPERCUT!', 'LIGHTS OUT!', 'ROCKED!'],
  brow: ['SKULL CRACK!', 'HEAD-ON!', 'BONK!', 'WHACK!'],
  cheek: ['HAYMAKER!', 'SLUGGER!', 'POW!', 'SMACK!'],
  skull: ['HEAVY SLAM!', 'CRUSH!', 'BOOM!', 'THWACK!'],
}

function getComicWord(impact, strike, combo) {
  if (impact.isOneTwoCombo) {
    const otWords = ['1-2 COMBO!', 'ONE-TWO!', 'DOUBLE-CROSS!', 'FLURRY!']
    return otWords[Math.floor(Math.random() * otWords.length)]
  }
  if (impact.action === 'superpunch' || strike?.action === 'superpunch') {
    const spWords = ['SUPER-PUNCH!', 'KABOOM!', 'MEGA-FIST!', 'CRUNCH!', 'OBLITERATE!']
    return spWords[Math.floor(Math.random() * spWords.length)]
  }
  if (impact.action === 'superflick' || strike?.action === 'superflick') {
    const sfWords = ['SUPER-FLICK!', 'WHIP-CRACK!', 'SNAP!', 'STINGER!', 'PINPOINT!']
    return sfWords[Math.floor(Math.random() * sfWords.length)]
  }
  if (impact.action === 'superslap' || strike?.action === 'superslap') {
    return 'MEGA-SLAP!'
  }
  if (impact.action === 'chop' || strike?.action === 'chop') {
    return 'KARATE CHOP!'
  }
  if (impact.action === 'poke' || strike?.action === 'poke') {
    return 'FINGER JAB!'
  }

  if (combo >= 10 && combo % 5 === 0) return `ULTRA x${combo}!`
  if (combo >= 5 && combo % 5 === 0) return `COMBO x${combo}!`
  if (impact.strength > 0.82) return 'K.O. SMASH!'

  const list = REGION_WORDS[impact.region]
  if (list && impact.strength > 0.38) {
    return list[Math.floor(Math.random() * list.length)]
  }

  const fresh = strike && performance.now() / 1000 - strike.t < 0.35
  if (fresh && KIND_LABEL[strike.kind]) return KIND_LABEL[strike.kind]

  return impact.strength > 0.62 ? 'WHAM!' : 'POW!'
}

function labelFor(impact, strike) {
  if (impact.isOneTwoCombo) return '1-2 COMBO!'
  if (impact.action === 'superpunch' || strike?.action === 'superpunch') return 'SUPER-PUNCH!'
  if (impact.action === 'superflick' || strike?.action === 'superflick') return 'SUPER-FLICK!'
  if (impact.action === 'superslap' || strike?.action === 'superslap') return 'MEGA-SLAP!'
  if (impact.strength <= 0.3) return 'TAP'
  if (impact.strength > 0.5 && impact.region !== 'skull') return impact.regionLabel
  const fresh = strike && performance.now() / 1000 - strike.t < 0.35
  if (fresh && KIND_LABEL[strike.kind]) return KIND_LABEL[strike.kind]
  return impact.strength > 0.66 ? 'SMASH!' : 'SMACK!'
}

const STATUS_TEXT = {
  idle: 'Starting…',
  camera: 'Asking for your camera…',
  model: 'Loading the hand model…',
  warmup: 'Warming up the GPU…',
  tracking: '',
  error: '',
}

export default function Lab() {
  const navigate = useNavigate()

  // The generated head, if one is on its way. This is READ-ONLY here: the job
  // was started on the upload screen and keeps running across the route change,
  // so the lab never waits for it — it opens with the stand-in and swaps the
  // real head in whenever it lands. See src/capture/headModel.js.
  const [headGen, setHeadGen] = useState(getHeadModel)
  useEffect(() => subscribeHeadModel((next) => setHeadGen({ ...next })), [])
  const [dismissed, setDismissed] = useState(false)
  const [targetVariant, setTargetVariant] = useState('scanned')
  const [weaponVariant, setWeaponVariant] = useState('boxing')
  const [punchForce, setPunchForce] = useState(60)
  const [punchSpeed, setPunchSpeed] = useState(70)
  const [showParticles, setShowParticles] = useState(true)
  const [showDeformation, setShowDeformation] = useState(true)
  const [slowMotion, setSlowMotion] = useState(false)

  const weapon = DEFAULT_WEAPON

  const impactsRef = useRef(null) // squash-shader handle, set by HeadMesh
  const effectsRef = useRef(null) // debris/flash/shake handle, set by Effects
  const smackRef = useRef(null)
  const floatingLayerRef = useRef(null)
  const flashOverlayRef = useRef(null)
  const hud = useRef({})

  const { videoRef, hand, status, error } = useHandTracking()

  const weaponRef = useRef(weapon)
  weaponRef.current = weapon

  const forceRef = useRef(punchForce)
  forceRef.current = punchForce
  const lastStrikeHandRef = useRef(null)

  const onImpact = useCallback(
    (impact) => {
      const w = weaponRef.current
      const forceMultiplier = forceRef.current / 50

      // MOMENTUM DETERMINES POWER: Delivered impulse scales strike power
      const momentum = impact.momentum ?? 1.5
      // Dynamic momentum multiplier (0.6x up to 2.5x)
      const momentumMult = Math.max(0.6, Math.min(2.5, momentum / 2.2))

      // 1-2 Punch Combo: Alternating hands (Left -> Right or Right -> Left)
      let isOneTwoCombo = false
      if (impact.hand && impact.hand !== 'primary' && lastStrikeHandRef.current && lastStrikeHandRef.current !== impact.hand) {
        isOneTwoCombo = true
      }
      if (impact.hand) lastStrikeHandRef.current = impact.hand
      const comboBonus = isOneTwoCombo ? 1.3 : 1.0

      // GESTURE ACTION MULTIPLIERS (Superpunch clench, Superflick snap, etc.)
      const hCurr = hand.current
      const action = hCurr?.action || hCurr?.strike?.action || 'neutral'
      const clench = hCurr?.clenchRatio ?? 0
      const isSuperpunch = action === 'superpunch' || clench >= 0.68
      const isSuperflick = action === 'superflick' || hCurr?.isFlick

      let actionMultiplier = 1.0
      let resolvedAction = action
      if (isSuperpunch) {
        actionMultiplier = 2.2 // Clenched fist delivers massive Superpunch damage
        resolvedAction = 'superpunch'
      } else if (isSuperflick) {
        actionMultiplier = 1.75 // Rapid finger snap delivers Superflick critical hit
        resolvedAction = 'superflick'
      } else if (action === 'superslap') {
        actionMultiplier = 1.35
        resolvedAction = 'superslap'
      } else if (action === 'chop') {
        actionMultiplier = 1.45
        resolvedAction = 'chop'
      } else if (action === 'poke') {
        actionMultiplier = 1.2
        resolvedAction = 'poke'
      }

      const scaled = {
        ...impact,
        strength: Math.min(
          impact.strength * w.damageScale * forceMultiplier * momentumMult * actionMultiplier * comboBonus,
          1
        ),
        action: resolvedAction,
        momentum,
        isOneTwoCombo,
      }

      const points = registerImpact(scaled, w.integrityScale)
      if (points === null) return

      // Squash deformation dent follows the blow
      if (showDeformation) {
        impactsRef.current?.add(impact.localPoint, scaled.strength, impact.localTravel)
      }

      // Particle sparks burst
      if (showParticles) {
        effectsRef.current?.burst(impact, w.tint)
      }

      // Screen location projected from 3D impact point
      const pos = effectsRef.current?.toScreen?.(impact.point) || {
        x: window.innerWidth * 0.5,
        y: window.innerHeight * 0.42,
      }

      // 1 & 2. Spawn Custom Manga/Marvel SVG Comic Burst & Floating Damage Number
      const isCritical = scaled.strength > 0.65 || run.combo >= 4 || isSuperpunch || isSuperflick
      const isSmash = scaled.strength > 0.78 || isSuperpunch
      const comicWord = getComicWord(scaled, hand.current?.strike, run.combo)

      spawnComicHit(floatingLayerRef.current, pos, {
        word: comicWord,
        points,
        strength: scaled.strength,
        isCritical,
        isSmash,
      })

      // 3. Screen Edge Hit Flash for heavy smashes
      if ((scaled.strength > 0.68 || isSuperpunch) && flashOverlayRef.current) {
        const flashEl = flashOverlayRef.current
        flashEl.classList.remove('active')
        void flashEl.offsetWidth
        flashEl.classList.add('active')
      }

      // 4. Centered Large Title Smack
      const el = smackRef.current
      if (el) {
        el.textContent = labelFor(scaled, hand.current?.strike)
        el.style.setProperty('--pop', String(0.75 + scaled.strength))
        el.classList.remove('pop')
        void el.offsetWidth // restart the CSS animation
        el.classList.add('pop')
      }

      // 5. Procedural Combat Audio Effects
      if (isSuperpunch) {
        playSuperpunch()
      } else if (isSuperflick) {
        playSuperflick()
      } else if (resolvedAction === 'superslap') {
        playSlap()
      } else {
        playPunch({
          strength: scaled.strength,
          region: impact.region,
          isCritical,
        })
      }

      // Combo audio chime progression
      if (isOneTwoCombo || run.combo >= 2) {
        playCombo({ combo: run.combo, isOneTwo: isOneTwoCombo })
      }

      // Consumed
      if (hand.current) hand.current.strike = null
    },
    [hand, showParticles, showDeformation]
  )

  const physics = usePhysics({ onImpact, weapon })

  useEffect(() => {
    startRun({ weapon: weapon.id })
    return subscribe((r) => {
      if (r.over) {
        playKnockout()
        const timer = setTimeout(() => navigate('/results'), 750)
        return () => clearTimeout(timer)
      }
    })
  }, [navigate, weapon.id])

  const handleReset = useCallback(() => {
    startRun({ weapon: weapon.id })
  }, [weapon.id])

  const handleManualSmash = useCallback(() => {
    onImpact({
      point: { x: 0, y: 1.34, z: 0.12 },
      localPoint: { x: 0, y: 0.03, z: 0.12 },
      localTravel: { x: 0, y: 0, z: -1 },
      region: 'nose',
      regionLabel: 'NOSEBREAKER!',
      regionDamage: 1.5,
      strength: (punchForce / 100) * 0.95,
      momentum: 4.8,
      t: performance.now(),
    })
  }, [onImpact, punchForce])

  // The HUD is written straight into the DOM on a rAF tick.
  useEffect(() => {
    let raf
    const tick = () => {
      const h = hud.current
      if (h.damage) h.damage.textContent = run.damage.toLocaleString()
      if (h.hits) h.hits.textContent = String(run.hits)
      if (h.combo) h.combo.textContent = `x${run.combo}`
      if (h.integrityBar) h.integrityBar.style.width = `${(run.integrity * 100).toFixed(1)}%`
      if (h.integrityPct) h.integrityPct.textContent = `${Math.round(run.integrity * 100)}%`

      // Live Combat Gesture & Momentum metrics
      const hData = hand.current
      const clench = Math.round((hData?.clenchRatio ?? 0) * 100)
      const action = hData?.action || 'neutral'
      const speed = hData?.speed ?? 0
      const momentumEstimate = (speed * 1.8).toFixed(1)

      if (h.clenchVal) h.clenchVal.textContent = `${clench}%`
      if (h.clenchBar) {
        h.clenchBar.style.width = `${clench}%`
        h.clenchBar.style.backgroundColor = (action === 'superpunch' || clench >= 68) ? '#ffe14d' : '#ff2e88'
      }
      if (h.clenchStatus) {
        if (action === 'superpunch' || clench >= 68) {
          h.clenchStatus.textContent = '★ SUPERPUNCH CHARGED! ★'
          h.clenchStatus.style.color = '#ffe14d'
        } else {
          h.clenchStatus.textContent = 'Clench fingers tight for Superpunch'
          h.clenchStatus.style.color = 'rgba(255, 255, 255, 0.45)'
        }
      }

      if (h.momentumVal) h.momentumVal.textContent = `${momentumEstimate} N·s`
      if (h.momentumBar) {
        const momPct = Math.min(100, Math.round((speed / 8) * 100))
        h.momentumBar.style.width = `${momPct}%`
      }

      if (h.actionBadge) {
        if (action === 'superpunch' || clench >= 68) {
          h.actionBadge.textContent = 'SUPERPUNCH'
          h.actionBadge.className = 'action-badge-live badge-superpunch'
        } else if (action === 'superflick' || hData?.isFlick) {
          h.actionBadge.textContent = 'SUPERFLICK'
          h.actionBadge.className = 'action-badge-live badge-superflick'
        } else if (action === 'superslap') {
          h.actionBadge.textContent = 'SLAP READY'
          h.actionBadge.className = 'action-badge-live badge-slap'
        } else if (action === 'chop') {
          h.actionBadge.textContent = 'CHOP BLADE'
          h.actionBadge.className = 'action-badge-live badge-chop'
        } else if (action === 'poke') {
          h.actionBadge.textContent = 'POKE JAB'
          h.actionBadge.className = 'action-badge-live badge-poke'
        } else if (hData?.present) {
          h.actionBadge.textContent = 'READY'
          h.actionBadge.className = 'action-badge-live badge-ready'
        } else {
          h.actionBadge.textContent = 'SEARCHING'
          h.actionBadge.className = 'action-badge-live badge-off'
        }
      }

      // Fast punch / swing aerodynamic whoosh
      if (speed > 2.8) {
        playWhoosh({ speed })
      }

      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [hand])

  const booting = status !== 'tracking' && status !== 'error'

  // ONLY Authentic Fists & Gloves (Zero Fantasy Weapons, Zero Emojis)
  const GLOVE_OPTIONS = [
    {
      id: 'boxing',
      label: 'Boxing Glove',
      sub: 'Pro 16oz Leather',
      renderIcon: (active) => <SvgBoxingGlove active={active} />,
    },
    {
      id: 'wraps',
      label: 'Fighter Wraps',
      sub: 'Articulated Clench',
      renderIcon: (active) => <SvgFistWraps active={active} />,
    },
  ]

  const TARGET_OPTIONS = [
    {
      id: 'scanned',
      label: '3D Bust',
      renderIcon: (active) => <SvgBust active={active} />,
    },
    {
      id: 'dummy',
      label: 'Crash Dummy',
      renderIcon: (active) => <SvgDummy active={active} />,
    },
  ]

  return (
    <div className="lab">
      <Lab3D
        physics={physics}
        hand={hand}
        impactsRef={impactsRef}
        effectsRef={effectsRef}
        weapon={weapon}
        targetVariant={targetVariant}
        weaponVariant={weaponVariant}
        headModelUrl={headGen.url ?? undefined}
      />

      {/* Screen edge combat flash vignette */}
      <div ref={flashOverlayRef} className="screen-flash" />

      {/* 3D-Projected Floating Damage & Comic Badges Layer */}
      <div ref={floatingLayerRef} className="floating-layer" />

      <div ref={smackRef} className="smack" />

      {/* Left Panel: Webcam, Hand Preview Wireframe & Post-It Note */}
      <WebcamFeed videoRef={videoRef} hand={hand} status={status} />

      {/* Right Sidebar: Glassmorphic Control Console with Custom SVGs */}
      <aside className="lab-hud console-hud">
        {/* 1. Header: Face Integrity + Live Stats Strip */}
        <div className="console-section integrity-section">
          <div className="hud-row">
            <span className="hud-label">FACE INTEGRITY</span>
            <div className="integrity-header-right">
              <svg className="cat-mascot-doodle" viewBox="0 0 24 20" fill="none">
                <path
                  d="M4 18V9L7 3L10 8H14L17 3L20 9V18C20 19 19 20 18 20H6C5 20 4 19 4 18Z"
                  stroke="#ff2e88"
                  strokeWidth="2"
                  fill="rgba(255, 46, 136, 0.2)"
                />
                <circle cx="9" cy="13" r="1.5" fill="#ffffff" />
                <circle cx="15" cy="13" r="1.5" fill="#ffffff" />
                <path d="M12 15L11 16H13L12 15Z" fill="#ff2e88" />
              </svg>
              <span className="hud-pct" ref={(el) => (hud.current.integrityPct = el)}>
                100%
              </span>
            </div>
          </div>
          <div className="integrity-bar-track">
            <div className="integrity-bar-fill" ref={(el) => (hud.current.integrityBar = el)} />
          </div>

          <div className="stats-row-compact">
            <div className="stat-pill">
              <span className="stat-label">DMG</span>
              <span className="stat-val damage-val" ref={(el) => (hud.current.damage = el)}>
                0
              </span>
            </div>
            <div className="stat-pill">
              <span className="stat-label">HITS</span>
              <span className="stat-val" ref={(el) => (hud.current.hits = el)}>
                0
              </span>
            </div>
            <div className="stat-pill">
              <span className="stat-label">COMBO</span>
              <span className="stat-val" ref={(el) => (hud.current.combo = el)}>
                x0
              </span>
            </div>
          </div>
        </div>

        {/* 2. COMBAT GESTURE SENSOR */}
        <div className="console-section gesture-action-compact">
          <div className="section-title-row">
            <span className="section-title">COMBAT SENSOR</span>
            <span className="action-badge-live" ref={(el) => (hud.current.actionBadge = el)}>
              TRACKING
            </span>
          </div>
          <div className="mini-meters-duo">
            <div className="mini-meter-pod">
              <div className="mini-meter-header">
                <span className="metric-label">CLENCH</span>
                <span className="metric-val" ref={(el) => (hud.current.clenchVal = el)}>0%</span>
              </div>
              <div className="metric-bar-track">
                <div className="metric-bar-fill clench-fill" ref={(el) => (hud.current.clenchBar = el)} />
              </div>
            </div>
            <div className="mini-meter-pod">
              <div className="mini-meter-header">
                <span className="metric-label">MOMENTUM</span>
                <span className="metric-val" ref={(el) => (hud.current.momentumVal = el)}>0.0 N·s</span>
              </div>
              <div className="metric-bar-track">
                <div className="metric-bar-fill momentum-fill" ref={(el) => (hud.current.momentumBar = el)} />
              </div>
            </div>
          </div>
        </div>

        {/* 3. FIGHT GEAR Selector */}
        <div className="console-section selector-section">
          <div className="section-title-row">
            <span className="section-title">FIGHT GEAR</span>
          </div>
          <div className="segmented-pill-row">
            {GLOVE_OPTIONS.map((opt) => {
              const active = weaponVariant === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  className={`segmented-pill-btn ${active ? 'active' : ''}`}
                  onClick={() => setWeaponVariant(opt.id)}
                >
                  <div className="pill-icon-svg">{opt.renderIcon(active)}</div>
                  <span className="pill-btn-label">{opt.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* 4. TARGET MODEL Selector */}
        <div className="console-section selector-section">
          <div className="section-title-row">
            <span className="section-title">TARGET MODEL</span>
            {/*
              Says what the head on screen actually IS. Without this a player
              who uploaded a photo sees the stand-in head, assumes their upload
              failed, and uploads it again — the generation is invisible
              otherwise, because nothing about the lab blocks on it.
            */}
            {headGen.status === HEAD_STATUS.UPLOADING && (
              <span className="head-gen head-gen-busy">SENDING PHOTO</span>
            )}
            {headGen.status === HEAD_STATUS.GENERATING && (
              <span className="head-gen head-gen-busy">
                BUILDING YOUR HEAD {Math.round((headGen.progress ?? 0) * 100)}%
              </span>
            )}
            {headGen.status === HEAD_STATUS.READY && (
              <span className="head-gen head-gen-ready">YOUR HEAD</span>
            )}
            {headGen.status === HEAD_STATUS.FAILED && (
              <span
                className="head-gen head-gen-failed"
                title={headGen.error || ''}
              >
                {headGen.outOfCredit ? 'NO 3D CREDIT' : 'STAND-IN HEAD'}
              </span>
            )}
          </div>
          <div className="segmented-pill-row">
            {TARGET_OPTIONS.map((opt) => {
              const active = targetVariant === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  className={`segmented-pill-btn ${active ? 'active' : ''}`}
                  onClick={() => setTargetVariant(opt.id)}
                >
                  <div className="pill-icon-svg">{opt.renderIcon(active)}</div>
                  <span className="pill-btn-label">{opt.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* 5. Compact Sliders: Punch Force & Punch Speed */}
        <div className="console-section sliders-section">
          <div className="slider-row-compact">
            <div className="slider-header">
              <span className="slider-label">PUNCH FORCE</span>
              <span className="slider-val">{punchForce}%</span>
            </div>
            <div className="custom-slider-container">
              <input
                type="range"
                min="10"
                max="100"
                value={punchForce}
                onChange={(e) => setPunchForce(Number(e.target.value))}
                className="custom-range-input"
              />
              <div className="slider-track-visual">
                <div className="slider-fill-visual force-fill" style={{ width: `${punchForce}%` }} />
                <div className="slider-thumb-visual" style={{ left: `${punchForce}%` }}>
                  <svg width="14" height="14" viewBox="0 0 18 18">
                    <circle cx="9" cy="9" r="8" fill="#181924" stroke="#ff2e88" strokeWidth="2.5" />
                    <circle cx="9" cy="9" r="4" fill="#ffe14d" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
          <div className="slider-row-compact">
            <div className="slider-header">
              <span className="slider-label">PUNCH SPEED</span>
              <span className="slider-val">{punchSpeed}%</span>
            </div>
            <div className="custom-slider-container">
              <input
                type="range"
                min="10"
                max="100"
                value={punchSpeed}
                onChange={(e) => setPunchSpeed(Number(e.target.value))}
                className="custom-range-input"
              />
              <div className="slider-track-visual">
                <div className="slider-fill-visual speed-fill" style={{ width: `${punchSpeed}%` }} />
                <div className="slider-thumb-visual" style={{ left: `${punchSpeed}%` }}>
                  <svg width="14" height="14" viewBox="0 0 18 18">
                    <circle cx="9" cy="9" r="8" fill="#181924" stroke="#00f0ff" strokeWidth="2.5" />
                    <circle cx="9" cy="9" r="4" fill="#ffe14d" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 6. Custom SVG Feature Toggles */}
        <div className="console-section toggles-row-compact">
          <label className="toggle-switch-item">
            <input
              type="checkbox"
              checked={showParticles}
              onChange={(e) => setShowParticles(e.target.checked)}
              className="toggle-hidden-input"
            />
            <div className={`custom-svg-switch ${showParticles ? 'active' : ''}`}>
              <svg width="32" height="18" viewBox="0 0 36 20" fill="none">
                <rect
                  x="1"
                  y="1"
                  width="34"
                  height="18"
                  rx="9"
                  fill={showParticles ? '#ff2e88' : '#1e202e'}
                  stroke={showParticles ? '#ff66aa' : '#33384a'}
                  strokeWidth="1.5"
                />
                <circle cx={showParticles ? 26 : 10} cy="10" r="7" fill="#ffffff" />
              </svg>
            </div>
            <span className="switch-label">Sparks</span>
          </label>
          <label className="toggle-switch-item">
            <input
              type="checkbox"
              checked={showDeformation}
              onChange={(e) => setShowDeformation(e.target.checked)}
              className="toggle-hidden-input"
            />
            <div className={`custom-svg-switch ${showDeformation ? 'active' : ''}`}>
              <svg width="32" height="18" viewBox="0 0 36 20" fill="none">
                <rect
                  x="1"
                  y="1"
                  width="34"
                  height="18"
                  rx="9"
                  fill={showDeformation ? '#ff2e88' : '#1e202e'}
                  stroke={showDeformation ? '#ff66aa' : '#33384a'}
                  strokeWidth="1.5"
                />
                <circle cx={showDeformation ? 26 : 10} cy="10" r="7" fill="#ffffff" />
              </svg>
            </div>
            <span className="switch-label">Dent</span>
          </label>
          <label className="toggle-switch-item">
            <input
              type="checkbox"
              checked={slowMotion}
              onChange={(e) => setSlowMotion(e.target.checked)}
              className="toggle-hidden-input"
            />
            <div className={`custom-svg-switch ${slowMotion ? 'active' : ''}`}>
              <svg width="32" height="18" viewBox="0 0 36 20" fill="none">
                <rect
                  x="1"
                  y="1"
                  width="34"
                  height="18"
                  rx="9"
                  fill={slowMotion ? '#00f0ff' : '#1e202e'}
                  stroke={slowMotion ? '#66f5ff' : '#33384a'}
                  strokeWidth="1.5"
                />
                <circle cx={slowMotion ? 26 : 10} cy="10" r="7" fill="#ffffff" />
              </svg>
            </div>
            <span className="switch-label">Slow Mo</span>
          </label>
        </div>

        {/* 7. Action Buttons: Reset & Giant SMASH! */}
        <div className="console-section actions-row">
          <button type="button" className="btn-reset-pill" onClick={handleReset}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
            <span>Reset</span>
          </button>
          <button type="button" className="btn-smash-giant" onClick={handleManualSmash}>
            <SvgSmashFist />
            <span>SMASH!</span>
          </button>
        </div>
      </aside>

      {/* Clean Bottom Controls Bar (Working shortcuts) */}
      <footer className="bottom-controls-bar">
        <div className="shortcuts-cluster">
          <div className="key-pill-combo">
            <span className="key-cap">A</span>
            <span className="key-cap">D</span>
            <span className="shortcut-label">Rotate</span>
          </div>
          <div className="key-pill-combo">
            <span className="key-cap">S</span>
            <span className="shortcut-label">Reset View</span>
          </div>
          <div className="key-pill-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="5" y="2" width="14" height="20" rx="7" />
              <line x1="12" y1="6" x2="12" y2="10" />
            </svg>
            <span>Drag to Orbit</span>
          </div>
          <div className="key-pill-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="5" y="2" width="14" height="20" rx="7" />
              <line x1="12" y1="8" x2="12" y2="12" />
            </svg>
            <span>Scroll to Zoom</span>
          </div>
        </div>
      </footer>

      {booting && (
        <div className="lab-overlay">
          <div className="spinner" />
          <p>{STATUS_TEXT[status]}</p>
        </div>
      )}

      {status === 'error' && !dismissed && (
        <div className="lab-overlay">
          <div className="notice error">{error}</div>
          <p className="muted">
            The physics still runs — the head just has nothing to react to without a camera.
          </p>
          <button className="btn btn-ghost" onClick={() => setDismissed(true)}>
            Look around anyway
          </button>
        </div>
      )}
    </div>
  )
}
