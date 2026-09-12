import { useEffect, useRef } from 'react'
import { HAND_CONNECTIONS } from '../tracking/gestures.js'
import webcamFrameImg from '../assets/smash/webcam.webp'

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
        if (w > 0 && h > 0 && (vCanvas.width !== w || vCanvas.height !== h)) {
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
            gestureTagRef.current.className = 'font-mono text-[8.5px] font-black uppercase px-1.5 py-0.5 rounded shadow-sm bg-gray-900/80 text-gray-400 border border-gray-700'
          } else if (bothPresent) {
            const eitherClench = (hData?.left?.clenchRatio ?? 0) >= 0.68 || (hData?.right?.clenchRatio ?? 0) >= 0.68
            const eitherFlick = hData?.left?.isFlick || hData?.right?.isFlick
            if (eitherFlick) {
              gestureTagRef.current.textContent = 'SUPER-FLICK!'
              gestureTagRef.current.className = 'font-mono text-[8.5px] font-black uppercase px-1.5 py-0.5 rounded shadow-sm bg-cyan-950 text-cyan-300 border border-cyan-400 animate-pulse'
            } else if (eitherClench) {
              gestureTagRef.current.textContent = '2X CLENCH'
              gestureTagRef.current.className = 'font-mono text-[8.5px] font-black uppercase px-1.5 py-0.5 rounded shadow-sm bg-pink-950 text-pink-300 border border-pink-400 animate-pulse'
            } else {
              gestureTagRef.current.textContent = '2 HANDS'
              gestureTagRef.current.className = 'font-mono text-[8.5px] font-black uppercase px-1.5 py-0.5 rounded shadow-sm bg-indigo-950 text-indigo-300 border border-indigo-400'
            }
          } else if (hData.isFlick) {
            gestureTagRef.current.textContent = 'FLICK!'
            gestureTagRef.current.className = 'font-mono text-[8.5px] font-black uppercase px-1.5 py-0.5 rounded shadow-sm bg-cyan-950 text-cyan-300 border border-cyan-400 animate-pulse'
          } else if (hData.action === 'superpunch' || (hData.clenchRatio ?? 0) >= 0.68) {
            gestureTagRef.current.textContent = 'FIST CLENCH'
            gestureTagRef.current.className = 'font-mono text-[8.5px] font-black uppercase px-1.5 py-0.5 rounded shadow-sm bg-pink-950 text-pink-300 border border-pink-400 animate-pulse'
          } else if (hData.gesture === 'fist') {
            gestureTagRef.current.textContent = 'FIST'
            gestureTagRef.current.className = 'font-mono text-[8.5px] font-black uppercase px-1.5 py-0.5 rounded shadow-sm bg-amber-950 text-yellow-300 border border-yellow-400'
          } else if (hData.gesture === 'open') {
            gestureTagRef.current.textContent = 'OPEN'
            gestureTagRef.current.className = 'font-mono text-[8.5px] font-black uppercase px-1.5 py-0.5 rounded shadow-sm bg-emerald-950 text-emerald-300 border border-emerald-400'
          } else {
            gestureTagRef.current.textContent = 'READY'
            gestureTagRef.current.className = 'font-mono text-[8.5px] font-black uppercase px-1.5 py-0.5 rounded shadow-sm bg-gray-900 text-pink-400 border border-pink-500/40'
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
    <div className="relative w-full max-w-[210px] sm:max-w-[230px] lg:max-w-[250px] aspect-[1448/1086] transform -rotate-3 hover:rotate-0 transition-transform duration-300 drop-shadow-[0_12px_24px_rgba(0,0,0,0.65)] pointer-events-auto">
      {/* Live Camera Viewport placed directly behind Polaroid Cutout */}
      <div className="absolute left-[8%] top-[12%] w-[84%] h-[72%] bg-black/90 rounded-lg overflow-hidden flex items-center justify-center border border-gray-800">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover transform -scale-x-100"
        />
        <canvas
          ref={videoCanvasRef}
          className="absolute inset-0 w-full h-full transform -scale-x-100 pointer-events-none"
        />
      </div>

      {/* High-Resolution Taped Frame Overlay */}
      <img
        src={webcamFrameImg}
        alt="Webcam Polaroid Frame"
        className="w-full h-full object-contain pointer-events-none relative z-10"
      />

      {/* Status Indicator & Live Gesture Tag on the Polaroid Chin */}
      <div className="absolute bottom-[4.2%] left-[8.5%] right-[8.5%] z-20 flex items-center justify-between pointer-events-none px-1">
        <div className="flex items-center gap-1.5 font-mono text-[9px] font-bold text-gray-800">
          <span className={`inline-block w-2 h-2 rounded-full ${live ? 'bg-emerald-500 shadow-[0_0_6px_#10b981]' : 'bg-gray-400'}`} />
          <span className="tracking-tight">{live ? '60 FPS' : 'OFF'}</span>
        </div>
        <span
          ref={gestureTagRef}
          className="font-mono text-[8.5px] font-black uppercase px-1.5 py-0.5 rounded shadow-sm bg-gray-900 text-pink-400 border border-pink-500/40"
        >
          SEARCHING
        </span>
      </div>
    </div>
  )
}
