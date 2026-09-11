import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { setMuted, getMuted } from '../audio/soundEngine.js'

export default function Shell() {
  const [audioOn, setAudioOn] = useState(() => !getMuted())

  const handleToggleAudio = () => {
    const next = !audioOn
    setAudioOn(next)
    setMuted(!next)
  }

  return (
    <div className="shell">
      <header className="grunge-header">
        <div className="header-splatter-bg" />
        <div className="nav-container">
          {/* Brand & Tagline */}
          <div className="brand-group">
            <NavLink to="/" className="brand-logo">
              <svg className="crown-doodle" viewBox="0 0 40 28" fill="none">
                <path
                  d="M4 22L8 8L16 16L20 4L24 16L32 8L36 22H4Z"
                  fill="#ffe14d"
                  stroke="#14141f"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                />
                <circle cx="8" cy="8" r="2.5" fill="#ff2e88" />
                <circle cx="20" cy="4" r="2.5" fill="#ff2e88" />
                <circle cx="32" cy="8" r="2.5" fill="#ff2e88" />
              </svg>
              <div className="brand-titles">
                <span className="brand-word face">FACE</span>
                <span className="brand-word smash">SMASH</span>
              </div>
            </NavLink>
            <span className="tagline-cursive">Same face. Worse decisions.</span>
          </div>

          {/* Center Navigation Pills */}
          <nav className="center-nav">
            <NavLink
              to="/"
              className={({ isActive }) => `nav-pill-btn ${isActive ? 'active' : ''}`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Upload
            </NavLink>
            <NavLink
              to="/"
              className="nav-pill-btn"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
              Scan 3D
            </NavLink>
            <NavLink
              to="/lab"
              className={({ isActive }) => `nav-pill-btn smash-lab-btn ${isActive ? 'active' : ''}`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="M10 2v7.31L4.2 19.3A2 2 0 0 0 5.8 22h12.4a2 2 0 0 0 1.6-2.7L14 9.31V2" />
                <line x1="8.5" y1="2" x2="15.5" y2="2" />
                <line x1="7" y1="16" x2="17" y2="16" />
              </svg>
              Smash Lab
            </NavLink>
          </nav>

          {/* Right Controls: Audio & Settings */}
          <div className="right-controls">
            <button
              type="button"
              className="audio-pill-btn"
              onClick={handleToggleAudio}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                {audioOn ? (
                  <>
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                  </>
                ) : (
                  <line x1="23" y1="9" x2="17" y2="15" />
                )}
              </svg>
              <span>AUDIO: {audioOn ? 'ON' : 'OFF'}</span>
              <span className={`audio-dot ${audioOn ? 'live' : ''}`} />
            </button>

            <button type="button" className="settings-btn" title="Settings">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          </div>
        </div>
      </header>
      <main className="shell-main">
        <Outlet />
      </main>
    </div>
  )
}
