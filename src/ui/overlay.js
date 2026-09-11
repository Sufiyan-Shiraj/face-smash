// Debug overlay drawn on top of the video feed.
//
// Coordinate note: landmarks arrive in unmirrored normalized image space, and
// this canvas sits inside the same CSS-mirrored wrapper as the video, so raw
// coordinates land in the right place for free. The catch is that any TEXT
// drawn here comes out backwards — so all text lives in the HUD instead.

import { HAND_CONNECTIONS } from '../tracking/gestures.js'

const COLORS = {
  bone: 'rgba(62, 240, 176, 0.85)',
  boneStale: 'rgba(62, 240, 176, 0.25)',
  joint: '#ffffff',
  fist: '#ff2e88',
  open: '#3ef0b0',
  partial: '#ffe14d',
  velocity: '#ff2e88',
  motion: 'rgba(255, 225, 77, 0.9)',
}

export function createOverlay(canvas) {
  const ctx = canvas.getContext('2d')

  function resize(width, height) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  function draw({ hand, motion, frame, showMotion, maxSpeed = 34 }) {
    const W = canvas.clientWidth
    const H = canvas.clientHeight
    ctx.clearRect(0, 0, W, H)

    if (showMotion && motion?.valid) {
      // Crosshair on the centre of mass of whatever is moving. When landmarks
      // drop out mid-slap this is the only thing still tracking the hand.
      const mx = motion.cx * W
      const my = motion.cy * H
      const r = 10 + motion.energy * 120
      ctx.strokeStyle = COLORS.motion
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(mx, my, r, 0, Math.PI * 2)
      ctx.moveTo(mx - r - 8, my)
      ctx.lineTo(mx + r + 8, my)
      ctx.moveTo(mx, my - r - 8)
      ctx.lineTo(mx, my + r + 8)
      ctx.stroke()
    }

    if (!hand?.present) return

    const stale = frame?.stale
    const pts = hand.landmarks

    ctx.lineWidth = 4
    ctx.lineCap = 'round'
    ctx.strokeStyle = stale ? COLORS.boneStale : COLORS.bone
    ctx.beginPath()
    for (const [a, b] of HAND_CONNECTIONS) {
      ctx.moveTo(pts[a].x * W, pts[a].y * H)
      ctx.lineTo(pts[b].x * W, pts[b].y * H)
    }
    ctx.stroke()

    ctx.fillStyle = COLORS.joint
    for (const p of pts) {
      ctx.beginPath()
      ctx.arc(p.x * W, p.y * H, 3, 0, Math.PI * 2)
      ctx.fill()
    }

    // Palm marker, coloured by gesture and sized by how close we are to firing.
    const c = frame?.point ?? hand.point
    const cx = c.x * W
    const cy = c.y * H
    ctx.fillStyle = COLORS[hand.gesture] ?? COLORS.partial
    ctx.beginPath()
    ctx.arc(cx, cy, 12, 0, Math.PI * 2)
    ctx.fill()

    // Ring goes solid when armed, hollow during the refractory window.
    ctx.strokeStyle = frame?.armed ? '#ffffff' : 'rgba(255,255,255,0.2)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(cx, cy, 22, 0, Math.PI * 2)
    ctx.stroke()

    // Velocity vector: direction from the normalized velocity, length as a
    // fraction of the speed that would count as a full-strength hit. Watching
    // this arrow is how you tell a real swing from landmark jitter.
    if (frame && frame.speed > 0.5) {
      const len = Math.min(frame.speed / maxSpeed, 1.2) * 140
      const inv = 1 / frame.speed
      ctx.strokeStyle = COLORS.velocity
      ctx.lineWidth = 5
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + frame.vx * inv * len, cy + frame.vy * inv * len)
      ctx.stroke()
    }
  }

  return { resize, draw }
}
