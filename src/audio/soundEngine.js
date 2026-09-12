// Zero-latency procedural Web Audio sound synthesis engine.
// Synthesizes visceral punch thuds, sub-bass explosions, superflick snaps,
// air whooshes, and ascending combo chimes without external audio files.

let audioCtx = null
let masterGain = null
let isMuted = false
let lastWhooshTime = 0

function getAudioContext() {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return null
    audioCtx = new AudioContextClass()
    masterGain = audioCtx.createGain()
    masterGain.gain.setValueAtTime(isMuted ? 0 : 0.85, audioCtx.currentTime)
    masterGain.connect(audioCtx.destination)

    // Unlock AudioContext on first user gesture
    const unlock = () => {
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume()
      }
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {})
  }
  return audioCtx
}

// Pre-create shared noise buffer (1 second of white noise)
let noiseBuffer = null
function getNoiseBuffer(ctx) {
  if (!noiseBuffer && ctx) {
    const bufferSize = ctx.sampleRate
    noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = noiseBuffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1
    }
  }
  return noiseBuffer
}

// Distortion curve for superpunch overdrive
let distortionCurve = null
function getDistortionCurve() {
  if (!distortionCurve) {
    const n = 256
    const curve = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1
      curve[i] = ((Math.PI + 3) * x) / (Math.PI + 3 * Math.abs(x))
    }
    distortionCurve = curve
  }
  return distortionCurve
}

let ramEttanAudio = null
let ramEttanBuffer = null
let ramEttanLoading = false
let activeRamEttanSource = null
let activeRamEttanGain = null
let comboLoopTimer = null
let isVoicePlaying = false

/**
 * Pre-fetch and decode Superman 1A audio buffer into Web Audio API memory
 * for zero-latency, gapless seamless looping during combos.
 */
async function loadRamEttanBuffer() {
  if (ramEttanBuffer || ramEttanLoading || typeof window === 'undefined') return
  ramEttanLoading = true
  try {
    const res = await fetch('/audio/superman_1a.mp3?v=2')
    const arrayBuffer = await res.arrayBuffer()
    const ctx = getAudioContext() || new (window.AudioContext || window.webkitAudioContext)()
    ramEttanBuffer = await new Promise((resolve, reject) => {
      const p = ctx.decodeAudioData(arrayBuffer, resolve, reject)
      if (p && typeof p.then === 'function') {
        p.then(resolve).catch(reject)
      }
    })
  } catch (err) {
    // Non-fatal, fallback to HTML5 Audio element
    console.warn('Ram Ettan audio buffer decode:', err)
  } finally {
    ramEttanLoading = false
  }
}

if (typeof window !== 'undefined') {
  // Pre-load audio buffer in background for instant responsiveness
  setTimeout(loadRamEttanBuffer, 50)
}

/**
 * Toggle or set mute state
 */
export function setMuted(muted) {
  isMuted = Boolean(muted)
  if (masterGain && audioCtx) {
    masterGain.gain.setValueAtTime(isMuted ? 0 : 0.85, audioCtx.currentTime)
  }
  if (activeRamEttanGain && audioCtx) {
    activeRamEttanGain.gain.setValueAtTime(isMuted ? 0 : 0.95, audioCtx.currentTime)
  }
  if (ramEttanAudio) {
    ramEttanAudio.muted = isMuted
  }
}

export function getMuted() {
  return isMuted
}

/**
 * Play Superman 1A voice line when Ram Ettan is hit.
 * Features:
 * 1. Single hits: plays through completely without cutting off midway.
 * 2. Combos: seamlessly loops the "1A!" chant without interruption or gaps.
 * 3. Graceful combo finish: when combo window expires, sets loop = false so the
 *    current cry finishes naturally to completion without sudden cutoff.
 */
export function playRamEttanVoice({ isCombo = false } = {}) {
  if (isMuted || typeof window === 'undefined') return

  const ctx = getAudioContext()

  // Primary path: Web Audio API AudioBuffer (sample-accurate, zero-latency seamless looping)
  if (ramEttanBuffer && ctx) {
    if (activeRamEttanSource && isVoicePlaying) {
      if (isCombo) {
        activeRamEttanSource.loop = true
        if (comboLoopTimer) clearTimeout(comboLoopTimer)
        comboLoopTimer = setTimeout(() => {
          if (activeRamEttanSource) {
            activeRamEttanSource.loop = false
          }
          comboLoopTimer = null
        }, 1300)
      }
      return
    }

    // Start fresh playback
    try {
      const source = ctx.createBufferSource()
      source.buffer = ramEttanBuffer
      source.loop = Boolean(isCombo)

      const voiceGain = ctx.createGain()
      voiceGain.gain.setValueAtTime(isMuted ? 0 : 0.95, ctx.currentTime)

      source.connect(voiceGain)
      voiceGain.connect(masterGain || ctx.destination)

      activeRamEttanSource = source
      activeRamEttanGain = voiceGain
      isVoicePlaying = true

      source.onended = () => {
        if (activeRamEttanSource === source) {
          activeRamEttanSource = null
          activeRamEttanGain = null
          isVoicePlaying = false
        }
      }

      source.start(0)

      if (isCombo) {
        if (comboLoopTimer) clearTimeout(comboLoopTimer)
        comboLoopTimer = setTimeout(() => {
          if (activeRamEttanSource) {
            activeRamEttanSource.loop = false
          }
          comboLoopTimer = null
        }, 1300)
      }
      return
    } catch (err) {
      console.warn('Web Audio playback error, falling back to HTML5 audio:', err)
    }
  }

  // Fallback path: HTML5 Audio element (if buffer still loading or Web Audio unavailable)
  if (!ramEttanAudio) {
    ramEttanAudio = new Audio('/audio/superman_1a.mp3?v=2')
    ramEttanAudio.volume = 0.95
  }

  ramEttanAudio.muted = isMuted

  if (isCombo) {
    ramEttanAudio.loop = true
    if (comboLoopTimer) clearTimeout(comboLoopTimer)
    comboLoopTimer = setTimeout(() => {
      if (ramEttanAudio) ramEttanAudio.loop = false
      comboLoopTimer = null
    }, 1300)
  }

  // If already playing smoothly, do not cut it off midway
  if (!ramEttanAudio.paused && !ramEttanAudio.ended && ramEttanAudio.currentTime > 0) {
    return
  }

  ramEttanAudio.currentTime = 0
  ramEttanAudio.play().catch(() => {})

  // Trigger background buffer load if not yet done
  if (!ramEttanBuffer && !ramEttanLoading) {
    loadRamEttanBuffer()
  }
}

export function stopRamEttanVoice({ immediate = true } = {}) {
  if (comboLoopTimer) {
    clearTimeout(comboLoopTimer)
    comboLoopTimer = null
  }

  if (activeRamEttanSource) {
    if (immediate) {
      try {
        if (activeRamEttanGain && audioCtx) {
          activeRamEttanGain.gain.setValueAtTime(activeRamEttanGain.gain.value, audioCtx.currentTime)
          activeRamEttanGain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.03)
          setTimeout(() => {
            try {
              activeRamEttanSource?.stop()
            } catch {}
            activeRamEttanSource = null
            activeRamEttanGain = null
            isVoicePlaying = false
          }, 35)
        } else {
          activeRamEttanSource.stop()
          activeRamEttanSource = null
          activeRamEttanGain = null
          isVoicePlaying = false
        }
      } catch {
        activeRamEttanSource = null
        activeRamEttanGain = null
        isVoicePlaying = false
      }
    } else {
      activeRamEttanSource.loop = false
    }
  }

  if (ramEttanAudio) {
    ramEttanAudio.loop = false
    if (immediate) {
      ramEttanAudio.pause()
      ramEttanAudio.currentTime = 0
    }
  }
}

/**
 * Visceral physical punch impact.
 * Combines pitch-dropped sub bass, filtered leather impact noise, and attack click.
 */
export function playPunch({ strength = 0.5, region = 'cheek', isCritical = false } = {}) {
  const ctx = getAudioContext()
  if (!ctx || isMuted) return

  const now = ctx.currentTime
  const clampedStrength = Math.max(0.15, Math.min(1.0, strength))

  // 1. Sub-bass punch body (pitch drop sine wave)
  const osc = ctx.createOscillator()
  const oscGain = ctx.createGain()
  osc.type = 'sine'

  // Deeper pitch for jaw / chin / nose
  const startFreq = region === 'jaw' || region === 'chin' ? 120 : region === 'nose' ? 145 : 135
  const endFreq = region === 'jaw' || region === 'chin' ? 32 : 38

  osc.frequency.setValueAtTime(startFreq, now)
  osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.16)

  const oscVol = (0.5 + clampedStrength * 0.55) * (isCritical ? 1.3 : 1.0)
  oscGain.gain.setValueAtTime(oscVol, now)
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18)

  osc.connect(oscGain)
  oscGain.connect(masterGain)
  osc.start(now)
  osc.stop(now + 0.19)

  // 2. Glove / Leather impact noise burst
  const nBuf = getNoiseBuffer(ctx)
  if (nBuf) {
    const noise = ctx.createBufferSource()
    noise.buffer = nBuf

    const bandpass = ctx.createBiquadFilter()
    bandpass.type = 'bandpass'
    bandpass.frequency.setValueAtTime(region === 'nose' ? 1200 : 850, now)
    bandpass.Q.setValueAtTime(2.2, now)

    const noiseGain = ctx.createGain()
    const noiseVol = (0.35 + clampedStrength * 0.45) * (isCritical ? 1.25 : 1.0)
    noiseGain.gain.setValueAtTime(noiseVol, now)
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08)

    noise.connect(bandpass)
    bandpass.connect(noiseGain)
    noiseGain.connect(masterGain)
    noise.start(now)
    noise.stop(now + 0.09)
  }

  // 3. Transient high-click for impact snap
  const clickOsc = ctx.createOscillator()
  const clickGain = ctx.createGain()
  clickOsc.type = 'triangle'
  clickOsc.frequency.setValueAtTime(region === 'brow' ? 3200 : 2400, now)
  clickOsc.frequency.exponentialRampToValueAtTime(200, now + 0.02)

  clickGain.gain.setValueAtTime(0.35 * clampedStrength, now)
  clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.025)

  clickOsc.connect(clickGain)
  clickGain.connect(masterGain)
  clickOsc.start(now)
  clickOsc.stop(now + 0.03)
}

/**
 * Devastating Superpunch explosion!
 * Deep sub-bass cannon thump, overdrive waveshaper, and reverberant shockwave.
 */
export function playSuperpunch() {
  const ctx = getAudioContext()
  if (!ctx || isMuted) return

  const now = ctx.currentTime

  // 1. Overdriven Sub-bass Drop
  const sub = ctx.createOscillator()
  const subGain = ctx.createGain()
  const shaper = ctx.createWaveShaper()
  shaper.curve = getDistortionCurve()
  shaper.oversample = '2x'

  sub.type = 'sine'
  sub.frequency.setValueAtTime(85, now)
  sub.frequency.exponentialRampToValueAtTime(26, now + 0.35)

  subGain.gain.setValueAtTime(1.1, now)
  subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38)

  sub.connect(shaper)
  shaper.connect(subGain)
  subGain.connect(masterGain)
  sub.start(now)
  sub.stop(now + 0.40)

  // 2. Shockwave Noise Burst
  const nBuf = getNoiseBuffer(ctx)
  if (nBuf) {
    const noise = ctx.createBufferSource()
    noise.buffer = nBuf

    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(1400, now)
    lp.frequency.exponentialRampToValueAtTime(120, now + 0.32)

    const nGain = ctx.createGain()
    nGain.gain.setValueAtTime(0.75, now)
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.34)

    noise.connect(lp)
    lp.connect(nGain)
    nGain.connect(masterGain)
    noise.start(now)
    noise.stop(now + 0.36)
  }

  // 3. Resonant metallic anvil ping
  const ping = ctx.createOscillator()
  const pingGain = ctx.createGain()
  ping.type = 'sine'
  ping.frequency.setValueAtTime(480, now)
  ping.frequency.exponentialRampToValueAtTime(90, now + 0.22)

  pingGain.gain.setValueAtTime(0.45, now)
  pingGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24)

  ping.connect(pingGain)
  pingGain.connect(masterGain)
  ping.start(now)
  ping.stop(now + 0.25)
}

/**
 * Sharp whip-crack / finger-snap for Superflick.
 */
export function playSuperflick() {
  const ctx = getAudioContext()
  if (!ctx || isMuted) return

  const now = ctx.currentTime

  // 1. High-frequency noise crack
  const nBuf = getNoiseBuffer(ctx)
  if (nBuf) {
    const noise = ctx.createBufferSource()
    noise.buffer = nBuf

    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.setValueAtTime(3800, now)
    bp.Q.setValueAtTime(3.8, now)

    const nGain = ctx.createGain()
    nGain.gain.setValueAtTime(0.85, now)
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.045)

    noise.connect(bp)
    bp.connect(nGain)
    nGain.connect(masterGain)
    noise.start(now)
    noise.stop(now + 0.05)
  }

  // 2. High snap click
  const snap = ctx.createOscillator()
  const snapGain = ctx.createGain()
  snap.type = 'triangle'
  snap.frequency.setValueAtTime(4200, now)
  snap.frequency.exponentialRampToValueAtTime(800, now + 0.035)

  snapGain.gain.setValueAtTime(0.6, now)
  snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04)

  snap.connect(snapGain)
  snapGain.connect(masterGain)
  snap.start(now)
  snap.stop(now + 0.045)
}

/**
 * Open-palm stinging slap with wide acoustic resonance.
 */
export function playSlap() {
  const ctx = getAudioContext()
  if (!ctx || isMuted) return

  const now = ctx.currentTime

  const nBuf = getNoiseBuffer(ctx)
  if (nBuf) {
    const noise = ctx.createBufferSource()
    noise.buffer = nBuf

    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.setValueAtTime(1450, now)
    bp.Q.setValueAtTime(1.8, now)

    const nGain = ctx.createGain()
    nGain.gain.setValueAtTime(0.65, now)
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09)

    noise.connect(bp)
    bp.connect(nGain)
    nGain.connect(masterGain)
    noise.start(now)
    noise.stop(now + 0.10)
  }

  const thud = ctx.createOscillator()
  const thudGain = ctx.createGain()
  thud.type = 'sine'
  thud.frequency.setValueAtTime(180, now)
  thud.frequency.exponentialRampToValueAtTime(55, now + 0.08)

  thudGain.gain.setValueAtTime(0.4, now)
  thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09)

  thud.connect(thudGain)
  thudGain.connect(masterGain)
  thud.start(now)
  thud.stop(now + 0.10)
}

/**
 * Air displacement whoosh for fast punches and swings.
 */
export function playWhoosh({ speed = 1 } = {}) {
  const ctx = getAudioContext()
  if (!ctx || isMuted) return

  const now = ctx.currentTime
  if (now - lastWhooshTime < 0.16) return
  lastWhooshTime = now

  const nBuf = getNoiseBuffer(ctx)
  if (!nBuf) return

  const noise = ctx.createBufferSource()
  noise.buffer = nBuf

  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  const centerFreq = Math.min(1100, 350 + speed * 30)
  bp.frequency.setValueAtTime(220, now)
  bp.frequency.linearRampToValueAtTime(centerFreq, now + 0.06)
  bp.frequency.linearRampToValueAtTime(180, now + 0.14)
  bp.Q.setValueAtTime(1.5, now)

  const nGain = ctx.createGain()
  nGain.gain.setValueAtTime(0.01, now)
  nGain.gain.linearRampToValueAtTime(0.28, now + 0.06)
  nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15)

  noise.connect(bp)
  bp.connect(nGain)
  nGain.connect(masterGain)
  noise.start(now)
  noise.stop(now + 0.16)
}

/**
 * Ascending harmonious arcade chime for combos.
 */
const PENTATONIC = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51]
export function playCombo({ combo = 1, isOneTwo = false } = {}) {
  const ctx = getAudioContext()
  if (!ctx || isMuted) return

  const now = ctx.currentTime

  if (isOneTwo) {
    // 1-2 Combo: Double harmonic bell
    ;[523.25, 783.99].forEach((freq, idx) => {
      const delay = idx * 0.075
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(freq, now + delay)

      gain.gain.setValueAtTime(0.35, now + delay)
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.22)

      osc.connect(gain)
      gain.connect(masterGain)
      osc.start(now + delay)
      osc.stop(now + delay + 0.23)
    })
    return
  }

  // Ascending pitch by combo index
  const noteIdx = Math.min(PENTATONIC.length - 1, Math.max(0, (combo - 1) % PENTATONIC.length))
  const freq = PENTATONIC[noteIdx]

  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(freq, now)

  gain.gain.setValueAtTime(0.32, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22)

  osc.connect(gain)
  gain.connect(masterGain)
  osc.start(now)
  osc.stop(now + 0.23)
}

/**
 * Heavy knockout bell when integrity reaches 0%.
 */
export function playKnockout() {
  const ctx = getAudioContext()
  if (!ctx || isMuted) return

  const now = ctx.currentTime

  // Deep gong fundamental
  const osc1 = ctx.createOscillator()
  const osc2 = ctx.createOscillator()
  const gain = ctx.createGain()

  osc1.type = 'sine'
  osc1.frequency.setValueAtTime(146.83, now) // D3
  osc2.type = 'triangle'
  osc2.frequency.setValueAtTime(220.0, now) // A3

  gain.gain.setValueAtTime(0.65, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85)

  osc1.connect(gain)
  osc2.connect(gain)
  gain.connect(masterGain)

  osc1.start(now)
  osc2.start(now)
  osc1.stop(now + 0.9)
  osc2.stop(now + 0.9)
}
