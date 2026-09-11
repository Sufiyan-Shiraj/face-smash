import React, { useRef, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { UploadCloud, Video, Sparkles, RefreshCw, AlertCircle, ArrowRight } from 'lucide-react'
import confetti from 'canvas-confetti'

import { CoolCatDoodle, SmileyDoodle, CurvedArrow, TornPaperBottom } from '../components/Doodles.jsx'
import { sound } from '../utils/uiAudio.js'
import { useParallax } from '../utils/useParallax.js'

import logoImg from '../assets/upload/hero_logo.png'
import drawingImg from '../assets/upload/punched_dude.png'

import { ACCEPTED_TYPES, decodeImageFile, setViews } from '../capture/imageSource.js'
import { scoreFrame } from '../capture/frameScoring.js'
import { cropSquare, toJpegBlob } from '../capture/squareCrop.js'
import { createFaceScanner } from '../tracking/faceScanner.js'
import { HEAD_STATUS, generateHead, getHeadModel, subscribeHeadModel } from '../capture/headModel.js'

export default function Upload() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const scannerRef = useRef(null)

  const [headGen, setHeadGen] = useState(getHeadModel)
  useEffect(() => subscribeHeadModel((next) => setHeadGen({ ...next })), [])

  const [isDragging, setIsDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [shot, setShot] = useState(null) // { canvas, name, note, score, previewUrl }

  const [statuePunched, setStatuePunched] = useState(false)
  const [duckWiggle, setDuckWiggle] = useState(false)

  // High-performance 60-120fps smoothed parallax with bold displacement
  const parallax = useParallax(0.12)

  // Background subtle counter-drift
  const bgOffset = parallax.getOffset(24, 18, true)
  const glowOffset = parallax.getOffset(45, 35, false)

  // Dude Statue (Left Layer)
  const dudeOffset = parallax.getOffset(65, 36)
  const dudeTilt = parallax.getTilt(6, 8)
  const pinkNoteOffset = parallax.getOffset(90, 50)

  // CRT Computer & Duck (Right Layer)
  const compOffset = parallax.getOffset(58, 32)
  const compTilt = parallax.getTilt(5, -7)
  const yellowNoteOffset = parallax.getOffset(85, 45)

  // Center Hero & 3D Upload Card
  const logoOffset = parallax.getOffset(24, 16)
  const logoTilt = parallax.getTilt(6, 6)
  const cardOffset = parallax.getOffset(34, 22)
  const cardTilt = parallax.getTilt(12, 12)

  /**
   * Process uploaded files through MediaPipe face detection, quality scoring, and square crop.
   */
  async function handleFiles(files) {
    if (!files?.length) return
    setBusy(true)
    setError('')
    sound.playClick()

    try {
      if (!scannerRef.current) {
        scannerRef.current = await createFaceScanner()
        scannerRef.current.warmup()
      }
      const scanner = scannerRef.current

      let best = null
      const failures = []

      for (const file of files) {
        const decoded = await decodeImageFile(file)
        if (!decoded.ok) {
          failures.push(`${file.name}: ${decoded.error}`)
          continue
        }

        const face = scanner.detect(decoded.canvas, performance.now())
        if (!face.present) {
          failures.push(`${file.name}: no face found`)
          continue
        }

        const ctx = decoded.canvas.getContext('2d')
        const small = Math.min(160, decoded.canvas.width)
        const imageData = ctx.getImageData(
          0,
          0,
          small,
          Math.max(1, Math.round((small * decoded.canvas.height) / decoded.canvas.width))
        )
        const scored = scoreFrame({ landmarks: face.landmarks, blend: face.blend, imageData })

        if (!best || scored.score > best.score) {
          const croppedCanvas = cropSquare(decoded.canvas, face.landmarks).canvas
          best = {
            score: scored.score,
            name: file.name,
            canvas: croppedCanvas,
            previewUrl: croppedCanvas.toDataURL('image/jpeg', 0.92),
            note: scored.reject || null,
          }
        }
      }

      if (!best) {
        setError(failures[0] || 'No face found in photo — please look straight at the camera!')
      } else {
        setShot(best)
        sound.playStepDone()
      }
    } catch (err) {
      setError(err.message || 'Error processing photo')
    } finally {
      setBusy(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles([...e.dataTransfer.files])
    }
  }

  const handleStatueClick = () => {
    sound.playPunch()
    setStatuePunched(true)
    confetti({
      particleCount: 45,
      spread: 70,
      origin: { x: 0.22, y: 0.5 },
      colors: ['#eb2f6c', '#facc15', '#ffffff', '#38bdf8'],
    })
    setTimeout(() => setStatuePunched(false), 500)
  }

  const handleDuckClick = (e) => {
    e.stopPropagation()
    sound.playBanana()
    setDuckWiggle(true)
    setTimeout(() => setDuckWiggle(false), 600)
  }

  /**
   * Send the photo off for Tripo generation and navigate straight to the smash lab.
   */
  async function makeHead() {
    if (!shot) return
    sound.playClick()
    const blob = await toJpegBlob(shot.canvas)
    setViews({ front: { canvas: shot.canvas, blob } })
    generateHead(blob)
    navigate('/lab')
  }

  return (
    <div className="w-full h-full bg-[#f6f2ea] flex flex-col justify-between relative overflow-hidden select-none parallax-container">
      {/* LAYER 1: BASE BACKGROUND CANVAS WITH PARALLAX PAN */}
      <div
        className="absolute -inset-8 w-[calc(100%+64px)] h-[calc(100%+64px)] bg-cover bg-center pointer-events-none z-0 parallax-layer"
        style={{
          backgroundImage: 'url(/uploads/background_canvas.png)',
          transform: `translate3d(${bgOffset.x}px, ${bgOffset.y}px, 0)`,
        }}
      />

      {/* AMBIENT ACCENT GLOWS WITH ORGANIC FLOATING SHIFT */}
      <div
        className="absolute top-1/4 left-10 w-80 h-80 bg-pink-500/10 rounded-full blur-3xl pointer-events-none parallax-layer"
        style={{
          transform: `translate3d(${glowOffset.x}px, ${glowOffset.y}px, 0)`,
        }}
      />
      <div
        className="absolute bottom-1/4 right-10 w-96 h-96 bg-pink-500/15 rounded-full blur-3xl pointer-events-none parallax-layer"
        style={{
          transform: `translate3d(${-glowOffset.x}px, ${-glowOffset.y}px, 0)`,
        }}
      />

      {/* ================= MAIN 3-COLUMN COMPOSITION ================= */}
      <div className="w-full flex-1 flex items-stretch justify-between relative z-10 px-0 h-full overflow-visible">
        {/* ================= LEFT: STATUE BUST & ANNOTATIONS ================= */}
        <div className="w-[35%] lg:w-[37%] xl:w-[39%] h-full flex flex-col justify-end items-start relative z-10 pl-0 pb-0 select-none pointer-events-none">
          {/* Top-Left Handwritten Quote with Parallax Float */}
          <div
            className="absolute top-8 sm:top-12 lg:top-16 left-6 sm:left-10 lg:left-14 font-marker text-xs sm:text-sm lg:text-base text-gray-900 leading-tight select-none z-20 pointer-events-auto parallax-layer"
            style={{
              transform: `translate3d(${dudeOffset.x * 0.75}px, ${dudeOffset.y * 0.75}px, 0) rotate(-3deg)`,
            }}
          >
            <p className="tracking-wide">SAME</p>
            <p className="tracking-wide">FACE.</p>
            <p className="tracking-wide">WORSE</p>
            <div className="flex items-center gap-1">
              <span className="tracking-wide">DECISIONS.</span>
              <span className="text-base font-sans">:)</span>
            </div>
          </div>

          {/* Statue Artwork - 3D Parallax with dynamic perspective */}
          <div
            className="relative w-[42vw] min-w-[420px] sm:min-w-[500px] lg:min-w-[580px] xl:min-w-[660px] 2xl:min-w-[740px] max-w-[560px] sm:max-w-[640px] lg:max-w-[720px] xl:max-w-[800px] 2xl:max-w-[880px] -ml-[20%] flex items-end pointer-events-auto parallax-layer -mb-4 sm:-mb-6 md:-mb-8 lg:-mb-10"
            style={{
              transform: `translate3d(${dudeOffset.x}px, ${dudeOffset.y}px, 0) perspective(1000px) rotateX(${dudeTilt.rotateX}deg) rotateY(${dudeTilt.rotateY}deg)`,
              transformOrigin: 'bottom left',
            }}
          >
            <div
              onClick={handleStatueClick}
              title="Click to punch the character!"
              className="relative cursor-pointer group w-full flex items-end"
            >
              <img
                src={drawingImg}
                alt="Punched Statue with Sunglasses"
                className={`w-full h-auto max-h-[65vh] sm:max-h-[70vh] lg:max-h-[74vh] xl:max-h-[78vh] object-contain object-left-bottom drop-shadow-2xl origin-bottom-left ${
                  statuePunched ? 'animate-punch-recoil' : ''
                }`}
              />

              {/* Pink Sticky Note on Statue Chest */}
              <div
                className="sticky-note sticky-pink absolute bottom-16 sm:bottom-22 lg:bottom-26 left-[50%] sm:left-[53%] lg:left-[55%] bg-[#fbcfe8] px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-sm shadow-xl max-w-[125px] sm:max-w-[150px] border border-pink-300 z-20 hover:scale-110 transition-transform parallax-layer"
                style={{
                  transform: `translate3d(${pinkNoteOffset.x * 0.45}px, ${pinkNoteOffset.y * 0.45}px, 0) rotate(${3 + parallax.x * 6}deg)`,
                }}
              >
                <p className="font-hand text-[10px] sm:text-xs text-gray-900 font-bold leading-tight">
                  A highly unnecessary web application. :)
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ================= CENTER: HERO TITLE & UPLOAD CARD ================= */}
        <div
          className="w-[32%] lg:w-[32%] xl:w-[30%] flex flex-col items-center justify-center text-center relative z-20 px-1 my-auto parallax-layer"
          style={{
            transform: `translate3d(${logoOffset.x}px, ${logoOffset.y}px, 0)`,
          }}
        >
          {/* Giant Graffiti Main Logo with 3D Parallax Tilt */}
          <div
            className="relative w-full max-w-[460px] lg:max-w-[520px] xl:max-w-[560px] mb-1 sm:mb-2 flex flex-col items-center parallax-layer"
            style={{
              transform: `perspective(800px) rotateX(${logoTilt.rotateX}deg) rotateY(${logoTilt.rotateY}deg)`,
            }}
          >
            <img
              src={logoImg}
              alt="FACE SMASH - Turn yourself into a 3D punching bag"
              className="w-full max-w-[400px] sm:max-w-[460px] lg:max-w-[520px] xl:max-w-[560px] h-auto object-contain drop-shadow-[0_10px_28px_rgba(0,0,0,0.4)] hover:scale-105 transition-transform duration-200 cursor-pointer"
              onClick={() => {
                sound.playClick()
                fileInputRef.current?.click()
              }}
            />
          </div>

          {/* Dark Charcoal Upload Box with Full 3D Card Tilt and Glare Sheen */}
          <div
            className="relative w-full max-w-[330px] sm:max-w-[360px] parallax-layer"
            style={{
              transform: `translate3d(${cardOffset.x}px, ${cardOffset.y}px, 0) perspective(1000px) rotateX(${cardTilt.rotateX}deg) rotateY(${cardTilt.rotateY}deg)`,
            }}
          >
            {/* Washi Tape Accent */}
            <div className="absolute -top-2.5 -right-2 w-13 h-5 bg-white/80 backdrop-blur-sm border border-gray-300 rounded-sm transform rotate-12 shadow-sm z-30 pointer-events-none" />

            {/* Dynamic Cursor Light Sheen Reflection */}
            <div
              className="absolute inset-0 rounded-[26px] pointer-events-none z-20 opacity-30"
              style={{
                background: `radial-gradient(circle at ${((parallax.x + 1) / 2) * 100}% ${((parallax.y + 1) / 2) * 100}%, rgba(255,255,255,0.45) 0%, transparent 65%)`,
              }}
            />

            <div
              onDragOver={(e) => {
                e.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => !shot && !busy && fileInputRef.current?.click()}
              className={`w-full bg-[#10141d]/95 backdrop-blur-sm text-white rounded-[26px] p-4.5 sm:p-6 flex flex-col items-center justify-center border-2 border-dashed transition-all cursor-pointer shadow-2xl relative overflow-hidden ${
                isDragging
                  ? 'border-[#eb2f6c] bg-[#1c2230] scale-105 shadow-[0_0_30px_rgba(235,47,108,0.5)]'
                  : 'border-white/35 hover:border-white/70 hover:shadow-black/50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_TYPES.join(',')}
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFiles([...e.target.files])
                  }
                }}
              />

              {/* STATE 1: BUSY / ANALYZING FACE */}
              {busy && (
                <div className="flex flex-col items-center justify-center py-4 space-y-3">
                  <div className="w-10 h-10 border-4 border-pink-500/20 border-t-pink-500 rounded-full animate-spin shadow-[0_0_15px_rgba(235,47,108,0.5)]" />
                  <h4 className="font-heading font-bold text-sm text-white">Looking for a face…</h4>
                  <p className="font-hand text-xs text-gray-400">MediaPipe landmark scan in progress</p>
                </div>
              )}

              {/* STATE 2: SHOT READY / FACE CONFIRMED */}
              {!busy && shot && (
                <div className="flex flex-col items-center justify-center w-full space-y-3">
                  <div className="relative group">
                    <img
                      src={shot.previewUrl}
                      alt="Face Crop Preview"
                      className="w-24 h-24 sm:w-28 sm:h-28 object-cover rounded-2xl border-2 border-[#facc15] shadow-[0_4px_20px_rgba(0,0,0,0.5)]"
                    />
                    <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-[#22c55e] text-black font-black text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider shadow">
                      {shot.note ? 'Face OK' : 'Perfect Face'}
                    </div>
                  </div>

                  <div className="text-center mt-1">
                    <h4 className="font-heading font-bold text-xs sm:text-sm text-white truncate max-w-[240px]">
                      {shot.name}
                    </h4>
                    {shot.note && (
                      <p className="font-hand text-[11px] text-amber-300">
                        {shot.note} — still usable!
                      </p>
                    )}
                  </div>

                  {/* Primary Make Head CTA */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      makeHead()
                    }}
                    className="w-full py-2.5 px-5 bg-gradient-to-r from-[#eb2f6c] to-[#db2777] hover:from-[#f43f5e] hover:to-[#eb2f6c] text-white font-heading font-black text-xs sm:text-sm rounded-full flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(235,47,108,0.7)] active:scale-95 transition-all cursor-pointer animate-pulse"
                  >
                    <span>Make My Head</span>
                    <ArrowRight size={15} />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setShot(null)
                      setError('')
                      fileInputRef.current?.click()
                    }}
                    className="text-[11px] font-hand text-gray-400 hover:text-white transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <RefreshCw size={11} />
                    <span>Use a different photo</span>
                  </button>
                </div>
              )}

              {/* STATE 3: DEFAULT DROPZONE */}
              {!busy && !shot && (
                <>
                  {/* Cloud Icon with Pink Arrow ( — ☁️↑ — ) */}
                  <div className="flex items-center gap-2 mb-1 text-white">
                    <span className="text-[#eb2f6c] font-bold text-sm tracking-widest">—</span>
                    <div className="relative flex items-center justify-center">
                      <UploadCloud size={32} strokeWidth={2.2} className="text-white drop-shadow-md" />
                      <span className="absolute top-2 text-[#eb2f6c] text-xs font-black">↑</span>
                    </div>
                    <span className="text-[#eb2f6c] font-bold text-sm tracking-widest">—</span>
                  </div>

                  {/* Main Instruction */}
                  <h3 className="font-heading font-bold text-sm sm:text-base text-white mb-0.5 tracking-tight">
                    Drop a video or photo here
                  </h3>
                  <span className="font-hand text-xs text-gray-400 mb-2">or</span>

                  {/* Pink Choose File Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      fileInputRef.current?.click()
                    }}
                    className="px-7 py-2 bg-[#eb2f6c] hover:bg-[#db2777] text-white font-heading font-bold text-xs sm:text-sm rounded-full flex items-center gap-2 shadow-[0_4px_18px_rgba(235,47,108,0.6)] active:scale-95 transition-all cursor-pointer"
                  >
                    <Video size={15} />
                    <span>Choose File</span>
                  </button>

                  {/* File Specs */}
                  <p className="font-sans text-[10.5px] text-gray-400 font-medium mt-2.5">
                    MP4, MOV, WebM, PNG, JPG (5–20s)
                  </p>
                  <p className="font-sans text-[10.5px] text-gray-500 font-medium">
                    Max size: 100 MB
                  </p>

                  {/* Demo Launcher Button (redirects to /lab) */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      sound.playClick()
                      navigate('/lab')
                    }}
                    className="mt-1.5 text-xs font-hand text-gray-400 hover:text-[#facc15] transition-colors cursor-pointer flex items-center gap-1.5 py-1 px-3 rounded-full hover:bg-white/10"
                  >
                    <Sparkles size={12} className="text-[#facc15]" />
                    <span>or test with demo face ➔</span>
                  </button>
                </>
              )}

              {/* Error Notice */}
              {error && (
                <div className="mt-3 p-2 bg-red-950/80 border border-red-500/50 rounded-xl text-red-200 text-[11px] font-sans flex items-start gap-2 text-left animate-fadeIn">
                  <AlertCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Tripo Out of Credit / Status Warning */}
              {headGen.status === HEAD_STATUS.FAILED && (
                <div className="mt-2 text-[10.5px] text-amber-300 font-hand">
                  {headGen.outOfCredit
                    ? '3D service out of credit — stand-in head ready in lab!'
                    : `3D notice: ${headGen.error}`}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ================= RIGHT: CRT COMPUTER TV & DOODLES ================= */}
        <div className="w-[32%] lg:w-[33%] xl:w-[35%] h-full flex flex-col justify-end items-end relative z-10 pr-0 pb-0 select-none pointer-events-none">
          {/* Top Right: Cat with Sunglasses Doodle + Quote */}
          <div
            className="absolute top-6 sm:top-9 lg:top-12 right-6 sm:right-10 lg:right-14 flex flex-col items-end z-20 pointer-events-auto parallax-layer"
            style={{
              transform: `translate3d(${yellowNoteOffset.x * 0.75}px, ${yellowNoteOffset.y * 0.75}px, 0)`,
            }}
          >
            <div className="flex items-center gap-2 mb-1 mr-2">
              <span className="font-hand text-xs sm:text-sm text-gray-800 font-bold leading-tight -rotate-3 text-right">
                Look serious.
                <br />
                It'll be funnier later.
              </span>
              <CoolCatDoodle size={40} color="#0f172a" />
            </div>

            {/* Yellow Sticky Note */}
            <div
              className="sticky-note bg-[#fef08a] px-3.5 py-2 rounded-sm shadow-xl border border-amber-300 max-w-[195px] mb-1 mr-3 text-left hover:scale-110 transition-transform parallax-layer"
              style={{
                transform: `translate3d(${yellowNoteOffset.x * 0.45}px, ${yellowNoteOffset.y * 0.45}px, 0) rotate(${-2 - parallax.x * 5}deg)`,
              }}
            >
              <p className="font-hand text-xs text-gray-900 font-bold leading-tight">
                A few seconds now.
                <br />
                A lifetime of regret later. :)
              </p>
            </div>

            {/* Curved Arrow pointing toward CRT TV */}
            <div className="mr-16 mb-0.5">
              <CurvedArrow size={26} direction="right-down" color="#0f172a" />
            </div>
          </div>

          {/* Computer Artwork - 3D Parallax with rubber duck */}
          <div
            className="relative w-full max-w-[500px] lg:max-w-[600px] xl:max-w-[680px] 2xl:max-w-[760px] flex items-end justify-end pointer-events-auto parallax-layer"
            style={{
              transform: `translate3d(${compOffset.x}px, ${compOffset.y}px, 0) perspective(1000px) rotateX(${compTilt.rotateX}deg) rotateY(${compTilt.rotateY}deg)`,
              transformOrigin: 'bottom right',
            }}
          >
            <div
              onClick={handleDuckClick}
              title="Click duck or CRT to interact!"
              className="relative cursor-pointer group w-full flex items-end justify-end -mb-1"
            >
              <img
                src="/uploads/crt_computer.png"
                alt="Retro CRT Monitor with Rubber Duck"
                className={`w-full h-auto max-h-[58vh] sm:max-h-[62vh] lg:max-h-[68vh] xl:max-h-[72vh] object-contain object-right-bottom drop-shadow-2xl origin-bottom-right ${
                  duckWiggle ? 'scale-108 rotate-2' : ''
                }`}
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
            {/* Step 1: Upload Face (Active) */}
            <div
              onClick={() => {
                sound.playClick()
              }}
              className="flex items-center gap-2.5 cursor-pointer group"
            >
              <div className="w-6 h-6 rounded-full bg-[#eb2f6c] text-white flex items-center justify-center text-xs font-bold shadow-[0_0_12px_rgba(235,47,108,0.8)]">
                1
              </div>
              <span className="font-heading font-bold text-xs sm:text-sm text-white border-b-2 border-[#eb2f6c] pb-0.5 tracking-tight">
                Upload Face
              </span>
            </div>

            <div className="w-10 sm:w-20 h-0.5 bg-gray-700/80" />

            {/* Step 2: Scan & 3D (Navigates to /scan) */}
            <div
              onClick={() => {
                sound.playClick()
                navigate('/scan')
              }}
              className="flex items-center gap-2.5 cursor-pointer group"
            >
              <div className="w-6 h-6 rounded-full bg-gray-800 border border-gray-600 text-gray-400 group-hover:text-white group-hover:border-white flex items-center justify-center text-xs font-bold transition-colors">
                2
              </div>
              <span className="font-heading font-medium text-xs sm:text-sm text-gray-400 group-hover:text-white transition-colors">
                Scan & 3D
              </span>
            </div>

            <div className="w-10 sm:w-20 h-0.5 bg-gray-700/80" />

            {/* Step 3: Smash Lab (Navigates to /lab) */}
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
            <div className="leading-snug">
              <p>Step 1: Good decision.</p>
              <p>Step 2: Questionable.</p>
              <p>Step 3: Definitely questionable.</p>
            </div>
            <SmileyDoodle size={16} color="#94a3b8" />
          </div>
        </div>
      </div>
    </div>
  )
}
