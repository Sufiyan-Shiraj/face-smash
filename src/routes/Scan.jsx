import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import StepRail from '../app/StepRail.jsx'
import { ANGLES } from '../capture/angleCollector.js'
import { setViews } from '../capture/imageSource.js'
import { generateHead } from '../capture/headModel.js'
import { useLiveCapture } from '../game/useLiveCapture.js'
import './scan.css'

const STATUS_TEXT = {
  idle: 'Starting…',
  camera: 'Asking for your camera…',
  model: 'Loading the face scanner…',
  capturing: '',
  error: '',
}

/** Where the head currently is, on the −1..+1 turn scale. */
function TurnDial({ turn, target }) {
  const pct = ((turn + 1) / 2) * 100
  return (
    <div className="dial">
      {ANGLES.map((a) => (
        <span
          key={a.key}
          className={`dial-zone${target === a.key ? ' target' : ''}`}
          style={{
            left: `${((a.min + 1) / 2) * 100}%`,
            width: `${((a.max - a.min) / 2) * 100}%`,
          }}
        />
      ))}
      <span className="dial-needle" style={{ left: `${pct}%` }} />
    </div>
  )
}

export default function Scan() {
  const navigate = useNavigate()
  const { videoRef, status, error, live, tick, finalize, collector, statusOf } = useLiveCapture()
  const thumbRefs = useRef({})
  const [, force] = useState(0)

  // `live` is a ref mutated every camera frame — poll it for display rather
  // than re-rendering React sixty times a second.
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 120)
    return () => clearInterval(id)
  }, [])

  // Repaint thumbnails whenever a slot is won.
  useEffect(() => {
    const views = collector?.views
    if (!views) return
    for (const { key } of ANGLES) {
      const target = thumbRefs.current[key]
      const src = views[key]?.canvas
      if (!target || !src) continue
      target.width = src.width
      target.height = src.height
      target.getContext('2d').drawImage(src, 0, 0)
    }
  }, [tick, collector])

  async function useThese() {
    const views = await finalize()
    if (views) setViews(views)
    // Same single-image path as the upload route: send the front shot off and
    // go straight to the lab. Generation keeps running across the navigation
    // and the stand-in head is punchable the whole time.
    if (views?.front?.blob) generateHead(views.front.blob)
    navigate('/lab')
  }

  const l = live.current
  const next = statusOf.next
  const booting = status !== 'capturing' && status !== 'error'

  const instruction = l.paused
    ? 'Paused — come back to this tab'
    : !l.faceSeen
      ? 'Get your face in frame'
      : next
        ? next.hint
        : 'Got everything. You can stop turning.'

  return (
    <div className="scan">
      <div className="scan-body">
        <aside className="scan-side">
          <div className="sticky scan-note">Let's get to know you!</div>
          <p className="scan-blurb">
            Look at the camera and slowly turn your head. We grab a still the moment you hit
            each angle with a clean expression.
          </p>

          <div className="panel">
            <h3 className="panel-title">What we reject</h3>
            <ul className="reject-list">
              <li>Blinks</li>
              <li>Smiles — they get baked in permanently</li>
              <li>Open mouths</li>
              <li>Motion blur</li>
            </ul>
            <p className="muted small">
              Whatever we send gets baked into the model for good. The camera gives us
              hundreds of frames, so there's no reason to settle for a bad one.
            </p>
          </div>
        </aside>

        <section className="scan-stage">
          <div className={`scan-video${l.faceSeen ? ' seen' : ''}`}>
            <span className="rec">
              <span className="rec-dot" /> LIVE
            </span>
            <div className="scan-mirror">
              <video ref={videoRef} playsInline muted />
            </div>
            {booting && (
              <div className="scan-boot">
                <div className="spinner" />
                <p>{STATUS_TEXT[status]}</p>
              </div>
            )}
          </div>

          <div className="instruction">
            <strong>{instruction}</strong>
            {l.faceSeen && l.reason && !statusOf.complete && (
              <span className="reason">holding off — {l.reason}</span>
            )}
          </div>

          <TurnDial turn={l.turn} target={next?.key} />

          <div className="thumbs">
            {ANGLES.map(({ key, label, required }) => (
              <div key={key} className={`thumb${statusOf.captured[key] ? ' got' : ''}`}>
                <canvas ref={(el) => (thumbRefs.current[key] = el)} />
                <span className="thumb-label">
                  {label}
                  {required && <em> · required</em>}
                </span>
              </div>
            ))}
          </div>

          <p className="muted small center">
            Tripo takes its views as yaw only — front, left and right. There's no up or down
            slot, so there's no reason to ask you to nod.
          </p>
        </section>

        <aside className="scan-side">
          <div className="panel">
            <h3 className="panel-title">
              {statusOf.complete ? 'Ready' : `${statusOf.count} of ${ANGLES.length} angles`}
            </h3>

            <ul className="stages">
              {ANGLES.map((a) => (
                <li key={a.key} className={`stage ${statusOf.captured[a.key] ? 'done' : next?.key === a.key ? 'active' : 'idle'}`}>
                  <span className="stage-dot" />
                  {a.label}
                  {statusOf.captured[a.key] && (
                    <button className="redo" onClick={() => collector.clear(a.key)}>
                      redo
                    </button>
                  )}
                </li>
              ))}
            </ul>

            <p className="muted small">
              The front view is the one that becomes your head. Turning to the sides is
              optional — those shots are kept for a future multi-view pass.
            </p>

            {error && <div className="notice error">{error}</div>}
          </div>

          <button
            className="btn btn-pink"
            disabled={!statusOf.captured.front}
            onClick={useThese}
          >
            {statusOf.captured.front ? 'Make my head' : 'Need a front shot'}
          </button>
          <button className="btn btn-ghost" onClick={() => navigate('/')}>
            Upload photos instead
          </button>
        </aside>
      </div>

      <StepRail current={1} steps={['Capture', 'Review', '3D Reconstruction', 'Smash Lab']} />
    </div>
  )
}
