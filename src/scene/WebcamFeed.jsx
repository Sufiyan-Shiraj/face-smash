import { useEffect, useRef } from 'react'

import { HAND_CONNECTIONS } from '../tracking/gestures.js'

export default function WebcamFeed({ videoRef, hand, status }) {
  const videoCanvasRef = useRef(null)
  const gestureTagRef = useRef(null)

  useEffect(() => {
    let raf
    const draw = () => {
      const vCanvas = videoCanvasRef.current
      const vCtx = vCanvas?.getContext('2d')
      if (vCtx) {
        const w = vCanvas.clientWidth
        const h = vCanvas.clientHeight
        if (vCanvas.width !== w || vCanvas.height !== h) {
          vCanvas.width = w
          vCanvas.height = h
        }
        vCtx.clearRect(0, 0, w, h)

        const hData = hand.current
        const leftLm = hData?.left?.landmarks
        const rightLm = hData?.right?.landmarks

        const drawSkeleton = (lm, color, shadowCol) => {
          if (!lm || lm.length < 21) return
          vCtx.save()
          vCtx.shadowColor = shadowCol
          vCtx.shadowBlur = 8
          vCtx.strokeStyle = color
          vCtx.lineWidth = 2.5
          vCtx.lineCap = 'round'
          vCtx.beginPath()
          for (const [a, b] of HAND_CONNECTIONS) {
            vCtx.moveTo(lm[a].x * w, lm[a].y * h)
            vCtx.lineTo(lm[b].x * w, lm[b].y * h)
          }
          vCtx.stroke()

          // Knuckle joint nodes
          for (const p of lm) {
            vCtx.beginPath()
            vCtx.fillStyle = '#ffffff'
            vCtx.shadowColor = shadowCol
            vCtx.shadowBlur = 6
            vCtx.arc(p.x * w, p.y * h, 2.6, 0, Math.PI * 2)
            vCtx.fill()
          }
          vCtx.restore()
        }

        // Left hand in Neon Cyan, Right hand in Hot Pink
        if (leftLm) drawSkeleton(leftLm, 'rgba(0, 240, 255, 0.88)', '#00f0ff')
        if (rightLm) drawSkeleton(rightLm, 'rgba(255, 46, 136, 0.88)', '#ff2e88')

        // Fallback for single primary landmarks if neither left/right assigned
        if (!leftLm && !rightLm && hData?.landmarks) {
          drawSkeleton(hData.landmarks, 'rgba(255, 46, 136, 0.88)', '#ff2e88')
        }

        // Live Gesture Label Tag
        if (gestureTagRef.current) {
          const bothPresent = Boolean(hData?.left?.present && hData?.right?.present)
          if (!hData?.present) {
            gestureTagRef.current.textContent = 'NO HAND'
            gestureTagRef.current.className = 'gesture-tag tag-none'
          } else if (bothPresent) {
            const eitherClench = (hData?.left?.clenchRatio ?? 0) >= 0.68 || (hData?.right?.clenchRatio ?? 0) >= 0.68
            const eitherFlick = hData?.left?.isFlick || hData?.right?.isFlick
            if (eitherFlick) {
              gestureTagRef.current.textContent = 'SUPER-FLICK!'
              gestureTagRef.current.className = 'gesture-tag tag-flick'
            } else if (eitherClench) {
              gestureTagRef.current.textContent = '2X CLENCH'
              gestureTagRef.current.className = 'gesture-tag tag-super'
            } else {
              gestureTagRef.current.textContent = '2 HANDS'
              gestureTagRef.current.className = 'gesture-tag tag-ready'
            }
          } else if (hData.isFlick) {
            gestureTagRef.current.textContent = 'FLICK!'
            gestureTagRef.current.className = 'gesture-tag tag-flick'
          } else if (hData.action === 'superpunch' || (hData.clenchRatio ?? 0) >= 0.68) {
            gestureTagRef.current.textContent = 'FIST CLENCH'
            gestureTagRef.current.className = 'gesture-tag tag-super'
          } else if (hData.gesture === 'fist') {
            gestureTagRef.current.textContent = 'FIST'
            gestureTagRef.current.className = 'gesture-tag tag-fist'
          } else if (hData.gesture === 'open') {
            gestureTagRef.current.textContent = 'OPEN'
            gestureTagRef.current.className = 'gesture-tag tag-open'
          } else {
            gestureTagRef.current.textContent = 'READY'
            gestureTagRef.current.className = 'gesture-tag tag-ready'
          }
        }
      }

      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [hand])

  const live = status === 'tracking'

  return (
    <aside className="left-panel-stack">
      {/* Streamlined Unified WEBCAM & SKELETON Card */}
      <div className="webcam-card unified-feed">
        <div className="webcam-head">
          <div className="webcam-title-group">
            <span className={`dot${live ? ' live' : ''}`} />
            <span>VISION FEED</span>
          </div>
          <span ref={gestureTagRef} className="gesture-tag tag-none">
            SEARCHING
          </span>
        </div>
        <div className="webcam-mirror">
          <video ref={videoRef} playsInline muted />
          <canvas ref={videoCanvasRef} />
        </div>
        <div className="webcam-foot">
          <div className="status-indicator">
            <span className={`dot${live ? ' live' : ''}`} />
            <span>{live ? 'Tracking 60 FPS' : 'Sensor Off'}</span>
          </div>
          <svg className="hand-icon-svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 11V6a2 2 0 0 0-4 0v4" />
            <path d="M14 10V4a2 2 0 0 0-4 0v6" />
            <path d="M10 10.5V6a2 2 0 0 0-4 0v8" />
            <path d="M18 8a2 2 0 0 1 4 2v6a8 8 0 0 1-16 0v-2" />
            <path d="M6 14a2 2 0 0 1-2-2 2 2 0 0 1 2-2" />
          </svg>
        </div>
      </div>

      {/* Discrete compact comic stamp */}
      <div className="comic-stamp-pill">
        <span className="stamp-text">GOOD FACES • BAD IDEAS</span>
      </div>
    </aside>
  )
}
