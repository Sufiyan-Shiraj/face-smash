import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, Check, RotateCcw, AlertCircle, ArrowRight } from 'lucide-react'
import confetti from 'canvas-confetti'

import { CrownDoodle, TornPaperBottom } from '../components/Doodles.jsx'
import { sound } from '../utils/uiAudio.js'
import { useParallax } from '../utils/useParallax.js'
import { ScanMeshCanvas } from '../components/ScanMeshCanvas.jsx'

import scan3dLogo from '../assets/scan/scan3d.png'
import scandivImg from '../assets/scan/scandiv.png'
import startscanImg from '../assets/scan/startscan.png'
import nextdudeImg from '../assets/scan/nextdude.png'
import background2Img from '../assets/scan/background2.png'
import cameraCardImg from '../assets/scan/camera_status_card.png'
import almostThereImg from '../assets/scan/almost_there_badge.png'

import { ANGLES } from '../capture/angleCollector.js'
import { setViews } from '../capture/imageSource.js'
import { generateHead } from '../capture/headModel.js'
import { useLiveCapture } from '../game/useLiveCapture.js'

const STATUS_BOOT_TEXT = {
  idle: 'Standby…',
  camera: 'Requesting camera access…',
  model: 'Loading MediaPipe Face Landmarker…',
  capturing: '',
  error: '',
}

export default function Scan() {
  const navigate = useNavigate()
  const [isScanning, setIsScanning] = useState(false)
  const [dudePunched, setDudePunched] = useState(false)
  const hasCelebratedRef = useRef(false)
  const thumbRefs = useRef({})
  const [, force] = useState(0)

  // Controlled live capture hook
  const { videoRef, status, error, live, tick, finalize, collector, statusOf } = useLiveCapture({
    enabled: isScanning,
  })

  // Smooth parallax depth
  const parallax = useParallax(0.12)
  const bgOffset = parallax.getOffset(20, 15, true)
  const leftOffset = parallax.getOffset(50, 30)
  const leftTilt = parallax.getTilt(4, 5)
  const cardOffset = parallax.getOffset(35, 20)
  const cardTilt = parallax.getTilt(3, 4)
  const rightOffset = parallax.getOffset(55, 32)
  const rightTilt = parallax.getTilt(4, -5)

  // Poll live ref for needle and instruction updates
  useEffect(() => {
    if (!isScanning) return
    const id = setInterval(() => force((n) => n + 1), 100)
    return () => clearInterval(id)
  }, [isScanning])

  // Repaint captured angle thumbnails when slots lock
  useEffect(() => {
    const views = collector?.views
    if (!views) return
    for (const { key } of ANGLES) {
      const target = thumbRefs.current[key]
      const src = views[key]?.canvas
      if (!target || !src) continue
      target.width = src.width
      target.height = src.height
      const ctx = target.getContext('2d')
      ctx.drawImage(src, 0, 0)
    }
  }, [tick, collector])

  // Celebrate when front angle is first captured
  useEffect(() => {
    if (statusOf.captured.front && !hasCelebratedRef.current) {
      hasCelebratedRef.current = true
      sound.playVictory()
      confetti({
        particleCount: 90,
        spread: 80,
        origin: { y: 0.55 },
        colors: ['#eb2f6c', '#facc15', '#ffffff', '#3ef0b0'],
      })
    }
  }, [statusOf.captured.front])

  // Calculate dynamic calibration percentage
  const progressPercent = statusOf.complete
    ? 100
    : statusOf.captured.front
      ? statusOf.count === 2
        ? 80
        : 60
      : statusOf.count > 0
        ? 35
        : isScanning
          ? 20
          : 72

  const handleToggleScan = () => {
    sound.playClick()
    if (statusOf.captured.front) {
      useThese()
      return
    }
    setIsScanning((prev) => !prev)
  }

  const handleDudeClick = () => {
    sound.playPunch()
    setDudePunched(true)
    setTimeout(() => setDudePunched(false), 500)
  }

  async function useThese() {
    sound.playClick()
    const views = await finalize()
    if (views) setViews(views)
    if (views?.front?.blob) generateHead(views.front.blob)
    navigate('/lab')
  }

  const l = live.current
  const next = statusOf.next
  const booting = isScanning && status !== 'capturing' && status !== 'error'

  const instruction = !isScanning
    ? 'Ready to scan'
    : l.paused
      ? 'Paused — come back to this tab'
      : !l.faceSeen
        ? 'Get your face in frame'
        : next
          ? next.hint
          : 'All angles captured! Ready for Smash Lab.'

  // Turn Dial needle placement (-1 to +1 -> 0% to 100%)
  const needlePct = Math.max(0, Math.min(100, ((l.turn + 1) / 2) * 100))

  return (
    <div className="w-full h-full bg-[#f6f2ea] text-gray-900 flex flex-col justify-between relative overflow-hidden select-none parallax-container">
      {/* LAYER 1: BASE BACKGROUND CANVAS WITH PARALLAX PAN */}
      <div
        className="absolute -inset-8 w-[calc(100%+64px)] h-[calc(100%+64px)] bg-cover bg-center pointer-events-none z-0 parallax-layer"
        style={{
          backgroundImage: `url(${background2Img})`,
          transform: `translate3d(${bgOffset.x}px, ${bgOffset.y}px, 0)`,
        }}
      />

      {/* AMBIENT ACCENT GLOWS */}
      <div className="absolute top-1/4 left-10 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl pointer-events-none z-0" />
      <div className="absolute bottom-1/4 right-10 w-96 h-96 bg-amber-400/12 rounded-full blur-3xl pointer-events-none z-0" />

      {/* ================= MAIN 3-COLUMN COMPOSITION ================= */}
      <div className="w-full max-w-[1536px] mx-auto px-3 sm:px-6 lg:px-8 flex-1 flex items-center justify-between relative z-10 my-auto h-full overflow-visible">
        {/* ================= LEFT COLUMN: GRAFFITI LOGO & QUOTES ================= */}
        <div
          className="w-[20%] xl:w-[22%] h-full flex flex-col justify-between items-start py-6 lg:py-10 relative z-20 pointer-events-auto parallax-layer"
          style={{
            transform: `translate3d(${leftOffset.x}px, ${leftOffset.y}px, 0)`,
          }}
        >
          {/* Top-Left Handwritten Quote */}
          <div className="font-marker text-xs sm:text-sm lg:text-base text-gray-900 leading-tight select-none">
            <p className="tracking-wide">SAME</p>
            <p className="tracking-wide">FACE.</p>
            <p className="tracking-wide">WORSE</p>
            <div className="flex items-center gap-1">
              <span className="tracking-wide">DECISIONS.</span>
              <span className="text-base font-sans">:)</span>
            </div>
          </div>

          {/* Main "SCAN & 3D" Graffiti Logo with 3D Tilt */}
          <div
            className="w-full max-w-[340px] my-auto cursor-pointer hover:scale-105 transition-transform"
            style={{
              transform: `perspective(800px) rotateX(${leftTilt.rotateX}deg) rotateY(${leftTilt.rotateY}deg)`,
            }}
            onClick={() => sound.playClick()}
          >
            <img
              src={scan3dLogo}
              alt="SCAN & 3D"
              className="w-full h-auto object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.25)]"
            />
          </div>

          {/* Bottom-Left Handwritten Note */}
          <div className="font-marker text-[11px] sm:text-xs lg:text-sm text-gray-900 leading-snug max-w-[200px] select-none">
            <p>WE'RE TURNING</p>
            <p>YOUR FACE INTO</p>
            <p>SOMETHING</p>
            <p>SERIOUSLY</p>
            <div className="flex items-center gap-1.5">
              <span>SMASHABLE.</span>
              <CrownDoodle size={18} color="#000" className="rotate-12" />
            </div>
          </div>
        </div>

        {/* ================= CENTER COLUMN: MAIN SCAN CONTAINER ================= */}
        <div
          className="w-[58%] xl:w-[56%] flex flex-col items-center justify-center relative z-20 my-auto parallax-layer px-1"
          style={{
            transform: `translate3d(${cardOffset.x}px, ${cardOffset.y}px, 0) perspective(900px) rotateX(${cardTilt.rotateX}deg) rotateY(${cardTilt.rotateY}deg)`,
          }}
        >
          {/* ================= PRE-SCAN SHOWCASE STATE (!isScanning) ================= */}
          {!isScanning ? (
            <div className="relative w-full max-w-[800px] lg:max-w-[840px] xl:max-w-[880px] aspect-[1766/891] drop-shadow-[0_20px_45px_rgba(0,0,0,0.45)] flex items-center justify-center">
              {/* High-Resolution scandiv.png Backdrop */}
              <img
                src={scandivImg}
                alt="3D Scan Console"
                className="w-full h-full object-contain pointer-events-none select-none"
              />

              {/* Living 3D Animated Particle Mesh & Telemetry Console */}
              <div className="absolute left-[2.5%] top-[4%] w-[49%] h-[92%] z-10 flex items-center justify-center pointer-events-auto">
                <ScanMeshCanvas progress={progressPercent} onMeshClick={handleToggleScan} />
              </div>

              {/* Interactive "Start Scan" Button Overlay */}
              <div
                className="absolute flex items-center justify-center pointer-events-auto"
                style={{
                  left: '60.1%',
                  top: '68.9%',
                  width: '36.5%',
                  height: '14.1%',
                }}
              >
                <button
                  onClick={handleToggleScan}
                  title="Click to start 3D scan!"
                  className="group relative cursor-pointer transform hover:scale-105 active:scale-95 transition-all duration-200 focus:outline-none w-full h-full flex items-center justify-center"
                >
                  <img
                    src={startscanImg}
                    alt="Start Scan"
                    className="w-full h-full object-fill drop-shadow-[0_0_24px_rgba(235,47,108,0.85)] group-hover:brightness-110"
                  />
                </button>
              </div>
            </div>
          ) : (
            /* ================= LIVE SCANNING STATE (isScanning) ================= */
            <div className="relative w-full max-w-[800px] lg:max-w-[840px] xl:max-w-[880px] aspect-[16/8.2] bg-[#0c1017] rounded-3xl p-3 sm:p-4 md:p-5 shadow-[0_20px_50px_rgba(0,0,0,0.5),0_0_0_2px_rgba(255,255,255,0.08)] border border-gray-800 text-white flex items-stretch overflow-hidden">
              {/* Washi Tape Accent */}
              <div className="absolute top-2 right-12 w-10 h-3.5 bg-white/80 rounded-sm transform rotate-3 shadow-sm z-30 pointer-events-none" />

              <div className="w-full h-full flex items-stretch justify-between relative z-10">
                {/* LIVE WEBCAM FEED (LEFT 60%) */}
                <div className="w-[58%] h-full relative rounded-2xl overflow-hidden bg-black border border-pink-500/50 flex items-center justify-center">
                  {/* Top Live Badge */}
                  <div className="absolute top-2.5 left-2.5 z-30 flex items-center gap-1.5 px-2 py-0.5 bg-black/80 rounded-md border border-white/10 text-[10px] font-mono">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_#ef4444]" />
                    <span className="font-bold text-white tracking-wider">LIVE CAMERA</span>
                  </div>

                  {/* Mirrored Video Feed */}
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    autoPlay
                    className="w-full h-full object-cover transform -scale-x-100"
                  />

                  {/* Booting Spinner Overlay */}
                  {booting && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-black/85 backdrop-blur-xs">
                      <div className="w-8 h-8 border-3 border-pink-500/20 border-t-pink-500 rounded-full animate-spin" />
                      <p className="font-heading text-xs text-gray-300 font-bold">
                        {STATUS_BOOT_TEXT[status] || 'Initializing…'}
                      </p>
                    </div>
                  )}

                  {/* Pink Corner Reticles & Scanning Laser */}
                  <div className="absolute inset-3 pointer-events-none border border-pink-500/30 rounded-xl">
                    <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-pink-500" />
                    <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-pink-500" />
                    <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-pink-500" />
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-pink-500" />

                    {/* Animated Scanning Laser */}
                    <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-pink-500 to-transparent shadow-[0_0_12px_#eb2f6c] absolute top-1/3 animate-pulse" />
                  </div>

                  {/* 3D Facial Landmark Tracking Nodes */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 400 300">
                    {[
                      { cx: 200, cy: 110 },
                      { cx: 165, cy: 130 },
                      { cx: 235, cy: 130 },
                      { cx: 200, cy: 160 },
                      { cx: 200, cy: 180 },
                      { cx: 175, cy: 215 },
                      { cx: 225, cy: 215 },
                      { cx: 200, cy: 225 },
                      { cx: 140, cy: 170 },
                      { cx: 260, cy: 170 },
                    ].map((pt, i) => (
                      <g key={i}>
                        <circle
                          cx={pt.cx}
                          cy={pt.cy}
                          r="2.5"
                          fill="#ec4899"
                          className="animate-ping"
                          style={{ animationDuration: `${1.2 + (i % 3) * 0.4}s` }}
                        />
                        <circle cx={pt.cx} cy={pt.cy} r="2" fill="#facc15" />
                      </g>
                    ))}
                  </svg>

                  {/* Bottom Guidance Instruction Pill */}
                  <div className="absolute bottom-2 left-2 right-2 px-2.5 py-1 bg-black/85 rounded-lg border border-gray-700 text-[10.5px] font-mono text-center truncate">
                    <span className="text-white font-bold">{instruction}</span>
                    {l.faceSeen && l.reason && !statusOf.complete && (
                      <span className="text-amber-400 ml-1.5 opacity-90">({l.reason})</span>
                    )}
                  </div>
                </div>

                {/* RIGHT CONTROL & ANGLE CAPTURE PANEL (40%) */}
                <div className="w-[40%] h-full flex flex-col justify-between pl-4 text-left">
                  <div>
                    <div className="inline-block bg-[#facc15] text-black font-heading font-black text-xs px-2.5 py-0.5 rounded shadow mb-1">
                      {statusOf.captured.front ? 'FACE MESH LOCKED!' : '3D GEOMETRY'}
                    </div>
                    <p className="font-hand text-xs text-gray-300">
                      {statusOf.captured.front
                        ? 'Ready for face smashing!'
                        : 'Slowly turn head to hit target yaw.'}
                    </p>
                  </div>

                  {/* Head Turn Dial */}
                  <div className="my-1">
                    <div className="flex justify-between text-[10px] font-mono text-gray-400 mb-0.5">
                      <span>TURN YAW</span>
                      <span className="text-[#facc15] font-bold">
                        {l.turn > 0.2 ? 'RIGHT' : l.turn < -0.2 ? 'LEFT' : 'FRONT'}
                      </span>
                    </div>
                    <div className="relative h-4 rounded-full bg-gray-900 border border-gray-700 overflow-hidden">
                      {ANGLES.map((a) => (
                        <span
                          key={a.key}
                          className={`absolute top-0 bottom-0 ${
                            next?.key === a.key
                              ? 'bg-pink-500/35 border-x border-pink-400'
                              : 'bg-emerald-500/15 border-x border-emerald-500/30'
                          }`}
                          style={{
                            left: `${((a.min + 1) / 2) * 100}%`,
                            width: `${((a.max - a.min) / 2) * 100}%`,
                          }}
                        />
                      ))}
                      <span
                        className="absolute top-0 bottom-0 w-1.5 bg-[#facc15] rounded-full shadow-[0_0_6px_#facc15] transition-all duration-75"
                        style={{ left: `calc(${needlePct}% - 3px)` }}
                      />
                    </div>
                  </div>

                  {/* Captured Angle Thumbnails (Front, Left, Right) */}
                  <div>
                    <div className="text-[10px] font-mono text-gray-400 mb-1">CAPTURED ANGLES</div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {ANGLES.map(({ key, label, required }) => (
                        <div key={key} className="flex flex-col items-center">
                          <div
                            className={`w-full aspect-square rounded-lg border overflow-hidden bg-black/60 flex items-center justify-center relative ${
                              statusOf.captured[key]
                                ? 'border-[#22c55e] shadow-[0_0_10px_rgba(34,197,94,0.4)]'
                                : 'border-gray-700'
                            }`}
                          >
                            <canvas
                              ref={(el) => (thumbRefs.current[key] = el)}
                              className="w-full h-full object-cover"
                            />
                            {!statusOf.captured[key] && (
                              <span className="text-[9px] font-mono text-gray-500">
                                {required ? 'req' : 'opt'}
                              </span>
                            )}
                            {statusOf.captured[key] && (
                              <div className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-[#22c55e] text-black flex items-center justify-center">
                                <Check size={9} strokeWidth={3} />
                              </div>
                            )}
                          </div>
                          <span className="text-[9.5px] font-heading font-bold text-gray-400 mt-0.5">
                            {label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Progress Bar & Actions */}
                  <div>
                    <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                      <span className="text-gray-400">CALIBRATION</span>
                      <span className="text-[#facc15] font-bold">{progressPercent}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden p-0.5 mb-2">
                      <div
                        className="h-full bg-gradient-to-r from-pink-500 to-yellow-400 rounded-full transition-all duration-200"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>

                    {statusOf.captured.front ? (
                      <button
                        onClick={useThese}
                        className="w-full py-2 px-3 bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-400 hover:to-rose-500 text-white font-heading font-black text-xs rounded-xl shadow-[0_0_20px_rgba(235,47,108,0.8)] transform hover:scale-102 active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-1.5 animate-pulse"
                      >
                        <Sparkles size={14} />
                        <span>ENTER SMASH LAB 🚀</span>
                      </button>
                    ) : (
                      <button
                        onClick={handleToggleScan}
                        className="w-full py-1.5 px-3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-heading font-bold text-xs rounded-xl border border-gray-700 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <RotateCcw size={12} />
                        <span>Stop Scan</span>
                      </button>
                    )}
                  </div>

                  {error && (
                    <div className="text-[10px] text-red-300 font-sans truncate">
                      {error}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ================= RIGHT COLUMN: CAMERA STATUS & STATUE DUDE ================= */}
        <div
          className="w-[20%] xl:w-[22%] h-full flex flex-col justify-between items-end py-4 lg:py-6 relative z-20 pointer-events-auto parallax-layer"
          style={{
            transform: `translate3d(${rightOffset.x}px, ${rightOffset.y}px, 0)`,
          }}
        >
          {/* Top-Right: CAMERA STATUS Stamp-Edged Card */}
          <div
            className="relative max-w-[155px] sm:max-w-[170px] lg:max-w-[185px] cursor-pointer hover:scale-105 transition-transform"
            style={{
              transform: `perspective(800px) rotateX(${rightTilt.rotateX}deg) rotateY(${rightTilt.rotateY}deg)`,
            }}
            onClick={() => sound.playClick()}
          >
            <img
              src={cameraCardImg}
              alt="Camera Status"
              className="w-full h-auto object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.35)]"
            />
          </div>

          {/* Middle Right "Almost there!" Badge */}
          <div className="self-center max-w-[145px] sm:max-w-[160px] lg:max-w-[175px] my-1 transform -rotate-3 hover:scale-105 transition-transform">
            <img
              src={almostThereImg}
              alt="Almost there!"
              className="w-full h-auto object-contain drop-shadow-md"
            />
          </div>

          {/* Bottom-Right: Statue Head Artwork with Sunglasses & Pink Splash */}
          <div className="relative flex items-end justify-end w-full max-w-[210px] sm:max-w-[240px] lg:max-w-[270px] xl:max-w-[300px] -mb-6 sm:-mb-8 md:-mb-10 lg:-mb-12 -mr-2 sm:-mr-4 md:-mr-6">
            {/* Pink/Yellow Spray Splatter */}
            <div className="absolute -bottom-4 -right-4 w-44 h-44 bg-gradient-to-tr from-pink-500/40 via-yellow-400/30 to-transparent rounded-full blur-2xl pointer-events-none" />

            {/* Handwritten note */}
            <div className="absolute -left-16 sm:-left-20 bottom-16 sm:bottom-20 font-marker text-xs sm:text-sm text-gray-900 leading-tight text-right select-none z-20">
              <p className="tracking-wide">NO FILTERS.</p>
              <p className="tracking-wide">JUST</p>
              <div className="flex items-center justify-end gap-1">
                <span className="tracking-wide">CHAOS.</span>
                <span className="font-sans text-xs">:)</span>
              </div>
              <div className="text-gray-800 text-sm mt-0.5 text-right font-sans font-bold">⤵</div>
            </div>

            {/* Statue Bust Image */}
            <div
              onClick={handleDudeClick}
              title="Click the character!"
              className={`relative cursor-pointer transition-transform duration-200 ${
                dudePunched ? 'animate-punch-recoil' : 'hover:scale-105'
              }`}
              style={{
                transform: `perspective(800px) rotateX(${rightTilt.rotateX}deg) rotateY(${rightTilt.rotateY}deg)`,
              }}
            >
              <img
                src={nextdudeImg}
                alt="Statue Head with Sunglasses"
                className="w-full h-auto max-h-[35vh] sm:max-h-[38vh] lg:max-h-[42vh] object-contain object-right-bottom drop-shadow-2xl"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ================= BOTTOM PROGRESS NAVIGATION BAR ================= */}
      <div className="w-full bg-[#0a0d14] text-white pt-1 pb-3 relative z-30">
        <TornPaperBottom color="#0a0d14" className="-mt-6 md:-mt-8" />

        <div className="max-w-[1440px] mx-auto px-6 sm:px-12 flex items-center justify-between">
          {/* 3 Steps Progress Tracker */}
          <div className="flex items-center gap-4 sm:gap-10">
            {/* Step 1: Upload Face (Checkmark, navigates back to /) */}
            <div
              onClick={() => {
                sound.playClick()
                navigate('/')
              }}
              className="flex items-center gap-2.5 cursor-pointer group"
            >
              <div className="w-6 h-6 rounded-full bg-pink-500 text-white flex items-center justify-center text-xs font-black shadow-[0_0_10px_rgba(235,47,108,0.7)]">
                ✓
              </div>
              <span className="font-heading font-medium text-xs sm:text-sm text-gray-400 group-hover:text-white transition-colors">
                Upload Face
              </span>
            </div>

            <div className="w-10 sm:w-20 h-0.5 bg-gray-700/80" />

            {/* Step 2: Scan & 3D (Active) */}
            <div className="flex items-center gap-2.5 cursor-pointer group">
              <div className="w-6 h-6 rounded-full bg-pink-500 text-white flex items-center justify-center text-xs font-bold shadow-[0_0_12px_rgba(235,47,108,0.8)]">
                2
              </div>
              <span className="font-heading font-bold text-xs sm:text-sm text-white border-b-2 border-pink-500 pb-0.5 tracking-tight">
                Scan & 3D
              </span>
            </div>

            <div className="w-10 sm:w-20 h-0.5 bg-gray-700/80" />

            {/* Step 3: Smash Lab */}
            <div
              onClick={() => {
                sound.playClick()
                navigate('/lab')
              }}
              className="flex items-center gap-2.5 cursor-pointer group"
            >
              <div className="w-6 h-6 rounded-full bg-gray-800 border border-gray-600 text-gray-400 group-hover:text-[#facc15] group-hover:border-[#facc15] flex items-center justify-center text-xs font-bold transition-colors">
                3
              </div>
              <span className="font-heading font-medium text-xs sm:text-sm text-gray-400 group-hover:text-[#facc15] transition-colors">
                Smash Lab
              </span>
            </div>
          </div>

          {/* Bottom Right Handwritten Humorous Footnote */}
          <div className="text-right font-hand text-xs sm:text-sm text-gray-400 hidden sm:flex items-center gap-2">
            <div className="leading-snug text-right">
              <p className="text-gray-300 font-bold">Step 2: Scan & 3D</p>
              <p className="text-gray-500">Gettin' real (in 3D).</p>
            </div>
            <CrownDoodle size={16} color="#94a3b8" />
          </div>
        </div>
      </div>
    </div>
  )
}
