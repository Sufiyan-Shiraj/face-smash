import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import StepRail from '../app/StepRail.jsx'
import { ACCEPTED_TYPES, decodeImageFile, setViews } from '../capture/imageSource.js'
import { scoreFrame } from '../capture/frameScoring.js'
import { cropSquare, toJpegBlob } from '../capture/squareCrop.js'
import { createFaceScanner } from '../tracking/faceScanner.js'
import { HEAD_STATUS, generateHead, getHeadModel, subscribeHeadModel } from '../capture/headModel.js'
import './upload.css'

const TIPS = [
  'Look straight at the camera',
  'Whole head in frame, including hair',
  'Good light — not a dark room',
  'Neutral face: no grin, no blink',
]

export default function Upload() {
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const previewRef = useRef(null)
  const scannerRef = useRef(null)

  const [headGen, setHeadGen] = useState(getHeadModel)
  useEffect(() => subscribeHeadModel((next) => setHeadGen({ ...next })), [])

  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [shot, setShot] = useState(null) // { canvas, name, note }

  /**
   * Take ONE photo and keep the best one offered.
   *
   * This screen used to run the three-slot angle collector: it classified each
   * photo as front/left/right by head yaw, demanded a front plus one side, and
   * rejected anything that landed "between angles". All of that existed to feed
   * a multi-view reconstruction that the app no longer calls — generation is a
   * single-image job now — so every one of those rules had become a hoop with
   * nothing on the other side of it. A player could be holding a perfectly good
   * photo of their face and still be told to go and take another one.
   *
   * The face check stays, because it is the one that earns its place: a photo
   * with no face in it produces a Tripo job that burns credit and returns
   * something unusable. Blur and expression are reported but never block —
   * the model can work with a slightly soft photo, and the player is a better
   * judge of their own face than a blur score is.
   */
  async function handleFiles(files) {
    if (!files?.length) return
    setBusy(true)
    setError('')

    try {
      // The scanner is ~4 MB of model; only pay for it if photos actually arrive.
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

        // Several photos at once is not an error — it just means the player has
        // options. Keep the sharpest, most face-on one and say nothing about it.
        if (!best || scored.score > best.score) {
          best = {
            score: scored.score,
            name: file.name,
            canvas: cropSquare(decoded.canvas, face.landmarks).canvas,
            note: scored.reject || null,
          }
        }
      }

      if (!best) {
        setError(failures[0] || 'no usable face in that photo')
      } else {
        setShot(best)
        requestAnimationFrame(() => {
          const el = previewRef.current
          if (!el) return
          el.width = best.canvas.width
          el.height = best.canvas.height
          el.getContext('2d').drawImage(best.canvas, 0, 0)
        })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  /**
   * Send the photo off and go straight to the lab.
   *
   * Deliberately not awaited past acceptance: generateHead resolves once Tripo
   * has queued the job, and polling continues across the route change. The lab
   * opens on the stand-in head immediately and swaps the real one in when it
   * lands, so nothing here blocks the player on a job that takes minutes.
   */
  async function makeHead() {
    if (!shot) return
    const blob = await toJpegBlob(shot.canvas)
    setViews({ front: { canvas: shot.canvas, blob } })
    generateHead(blob)
    navigate('/lab')
  }


  return (
    <div className="upload">
      <div className="upload-body">
        <section className="upload-hero">
          <h1>
            SCAN
            <br />
            <span>YOUR FACE</span>
          </h1>
          <p className="upload-sub">Turn yourself into a 3D punching bag.</p>

          <button className="btn btn-pink upload-cta" onClick={() => navigate('/scan')}>
            Use my camera
          </button>
          <p className="scribble">Fastest way — we grab the shots as you turn.</p>

          <div className="sticky tilt-r upload-note">
            A few seconds now.
            <br />A lifetime of regret later.
          </div>
        </section>

        <section
          className={`dropzone${dragging ? ' over' : ''}`}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            handleFiles([...e.dataTransfer.files])
          }}
        >
          <h2>Or upload a photo</h2>
          <p className="muted">
            One photo of your face, looking at the camera. That's it.
          </p>

          <div className="dropzone-inner">
            {busy ? (
              <>
                <div className="spinner" />
                <p>Looking for a face…</p>
              </>
            ) : (
              <>
                <div className="drop-icon" aria-hidden="true">
                  ↑
                </div>
                <p className="drop-big">Drag a photo here</p>
                <p className="muted">or</p>
                <button className="btn btn-ghost" onClick={() => inputRef.current?.click()}>
                  Choose photos
                </button>
              </>
            )}
          </div>

          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            multiple
            hidden
            onChange={(e) => handleFiles([...e.target.files])}
          />

          {shot && (
            <div className="shot-preview">
              <canvas ref={previewRef} />
              <div className="shot-meta">
                <strong>{shot.name}</strong>
                {shot.note ? (
                  <span className="shot-note">{shot.note} — still usable</span>
                ) : (
                  <span className="shot-ok">looks good</span>
                )}
                <button className="btn btn-ghost btn-tiny" onClick={() => setShot(null)}>
                  Use a different photo
                </button>
              </div>
            </div>
          )}

          {error && <div className="notice error">{error}</div>}

          {/*
            Enabled on the FRONT shot alone. It used to require a front plus a
            side, which was right when three views were being sent to a
            multi-view reconstruction; with a single-image job the second photo
            gates the player out of the game for nothing.
          */}
          <button className="btn btn-pink" disabled={!shot || busy} onClick={makeHead}>
            {shot ? 'Make my head' : 'Add a photo of your face'}
          </button>

          {headGen.status === HEAD_STATUS.FAILED && (
            <div className="notice error">
              {headGen.outOfCredit
                ? 'The 3D service is out of credit, so the stand-in head is being used instead.'
                : `3D generation failed: ${headGen.error}. The stand-in head is being used instead.`}
            </div>
          )}
        </section>

        <section className="upload-aside">
          <div className="panel">
            <h3 className="panel-title">For best results</h3>
            <ul className="tips">
              {TIPS.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>

          <div className="panel">
            <h3 className="panel-title">What happens next</h3>
            <p className="muted small">
              Your photo goes off to be turned into a 3D head, which takes a couple of
              minutes. You don't wait for it — the lab opens straight away with a stand-in
              head, and yours swaps in the moment it's ready.
            </p>
          </div>

          <button className="btn btn-ghost" onClick={() => navigate('/lab')}>
            Skip — smash a demo head
          </button>
        </section>
      </div>

      <StepRail current={0} steps={['Capture', 'Review', '3D Reconstruction', 'Smash Lab']} />
    </div>
  )
}
