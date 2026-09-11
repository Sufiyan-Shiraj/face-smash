import { useNavigate } from 'react-router-dom'

import { durationSeconds, finalScore, run } from '../game/runState.js'
import './results.css'

function Row({ label, value, accent }) {
  return (
    <div className="result-row">
      <span className="result-label">{label}</span>
      <span className={`result-value${accent ? ' accent' : ''}`}>{value}</span>
    </div>
  )
}

export default function Results() {
  const navigate = useNavigate()
  const seconds = durationSeconds()

  return (
    <div className="results">
      <div className="results-card">
        <header className="results-head">
          <h1>Smash session complete</h1>
          <p className="muted">You really did this.</p>
        </header>

        <div className="results-rows">
          <Row label="Total damage" value={run.damage.toLocaleString()} />
          <Row label="Total hits" value={run.hits} />
          <Row label="Max combo" value={`x${run.maxCombo}`} />
          <Row label="Strongest impact" value={run.strongest.toLocaleString()} />
          <Row label="Face integrity" value={`${Math.round(run.integrity * 100)}%`} />
          <Row label="Time survived" value={`${seconds.toFixed(1)}s`} />
          <Row label="Final score" value={finalScore().toLocaleString()} accent />
        </div>

        <div className="results-actions">
          <button className="btn btn-pink" onClick={() => navigate('/lab')}>
            Smash again
          </button>
          <button className="btn btn-ghost" onClick={() => navigate('/')}>
            Scan another face
          </button>
        </div>
      </div>

      <div className="sticky results-note">
        Some questions
        <br />
        don't need answers.
      </div>
    </div>
  )
}
