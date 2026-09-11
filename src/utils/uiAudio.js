// Web Audio API Procedural Sound Synthesizer for Face Smash UI
import { setMuted as setEngineMuted, getMuted as getEngineMuted } from '../audio/soundEngine.js'

class SoundEngine {
  constructor() {
    this.ctx = null
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      if (AudioCtx) {
        this.ctx = new AudioCtx()
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {})
    }
  }

  setMuted(muted) {
    setEngineMuted(muted)
  }

  getMuted() {
    return getEngineMuted()
  }

  toggleMute() {
    const next = !getEngineMuted()
    setEngineMuted(next)
    return next
  }

  playSlap() {
    if (this.getMuted()) return
    this.init()
    if (!this.ctx) return
    const t = this.ctx.currentTime

    // Snappy noise burst
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.08)
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.15))
    }
    const noise = this.ctx.createBufferSource()
    noise.buffer = buffer

    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(1600, t)
    filter.Q.setValueAtTime(4, t)

    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0.9, t)
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08)

    noise.connect(filter)
    filter.connect(gain)
    gain.connect(this.ctx.destination)
    noise.start(t)

    // Resonant slap body
    const osc = this.ctx.createOscillator()
    const oscGain = this.ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(380, t)
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.07)
    oscGain.gain.setValueAtTime(0.6, t)
    oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.07)

    osc.connect(oscGain)
    oscGain.connect(this.ctx.destination)
    osc.start(t)
    osc.stop(t + 0.08)
  }

  playPunch() {
    if (this.getMuted()) return
    this.init()
    if (!this.ctx) return
    const t = this.ctx.currentTime

    // Heavy bass thud
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(190, t)
    osc.frequency.exponentialRampToValueAtTime(35, t + 0.2)

    gain.gain.setValueAtTime(1.2, t)
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2)

    osc.connect(gain)
    gain.connect(this.ctx.destination)
    osc.start(t)
    osc.stop(t + 0.22)

    // Impact crunch
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.14)
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2))
    }
    const noise = this.ctx.createBufferSource()
    noise.buffer = buffer

    const filter = this.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(500, t)

    const nGain = this.ctx.createGain()
    nGain.gain.setValueAtTime(0.7, t)
    nGain.gain.exponentialRampToValueAtTime(0.01, t + 0.14)

    noise.connect(filter)
    filter.connect(nGain)
    nGain.connect(this.ctx.destination)
    noise.start(t)
  }

  playBanana() {
    if (this.getMuted()) return
    this.init()
    if (!this.ctx) return
    const t = this.ctx.currentTime

    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(550, t)
    osc.frequency.linearRampToValueAtTime(950, t + 0.08)
    osc.frequency.exponentialRampToValueAtTime(120, t + 0.28)
    gain.gain.setValueAtTime(0.8, t)
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.28)

    osc.connect(gain)
    gain.connect(this.ctx.destination)
    osc.start(t)
    osc.stop(t + 0.3)
  }

  playClick() {
    if (this.getMuted()) return
    this.init()
    if (!this.ctx) return
    const t = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(800, t)
    osc.frequency.exponentialRampToValueAtTime(300, t + 0.04)
    gain.gain.setValueAtTime(0.15, t)
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.04)
    osc.connect(gain)
    gain.connect(this.ctx.destination)
    osc.start(t)
    osc.stop(t + 0.05)
  }

  playStepDone() {
    if (this.getMuted()) return
    this.init()
    if (!this.ctx) return
    const t = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(523.25, t) // C5
    osc.frequency.setValueAtTime(659.25, t + 0.08) // E5
    osc.frequency.setValueAtTime(783.99, t + 0.16) // G5
    gain.gain.setValueAtTime(0.2, t)
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.35)
    osc.connect(gain)
    gain.connect(this.ctx.destination)
    osc.start(t)
    osc.stop(t + 0.4)
  }

  playVictory() {
    if (this.getMuted()) return
    this.init()
    if (!this.ctx) return
    const notes = [523.25, 659.25, 783.99, 1046.5]
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        if (!this.ctx) return
        const t = this.ctx.currentTime
        const osc = this.ctx.createOscillator()
        const gain = this.ctx.createGain()
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(freq, t)
        gain.gain.setValueAtTime(0.3, t)
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3)
        osc.connect(gain)
        gain.connect(this.ctx.destination)
        osc.start(t)
        osc.stop(t + 0.35)
      }, idx * 100)
    })
  }
}

export const sound = new SoundEngine()
