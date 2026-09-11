import React, { useState, useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { PaintbrushNav } from '../components/PaintbrushNav.jsx'
import { Modals } from '../components/Modals.jsx'
import { sound } from '../utils/uiAudio.js'

export default function Shell() {
  const location = useLocation()
  const navigate = useNavigate()

  const [soundMuted, setSoundMuted] = useState(() => sound.getMuted())
  const [activeModal, setActiveModal] = useState(null)

  // Derive current view from current URL pathname
  const currentView =
    location.pathname === '/scan'
      ? 'scan'
      : location.pathname === '/lab' || location.pathname === '/results'
        ? 'smash'
        : 'upload'

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return
      if (e.key === '1') navigate('/')
      if (e.key === '2') navigate('/scan')
      if (e.key === '3') navigate('/lab')
      if (e.key === 'm' || e.key === 'M') {
        const muted = sound.toggleMute()
        setSoundMuted(muted)
      }
      if (e.key === 'Escape') {
        setActiveModal(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigate])

  const handleToggleSound = () => {
    const muted = sound.toggleMute()
    setSoundMuted(muted)
  }

  const handleNavigate = (view) => {
    if (view === 'upload') navigate('/')
    else if (view === 'scan') navigate('/scan')
    else if (view === 'smash') navigate('/lab')
  }

  return (
    <div className="h-screen w-screen overflow-hidden font-sans select-none antialiased bg-[#080b11] relative">
      {/* Top Paintbrush Stroke Navbar floating on top */}
      <div className="absolute top-0 left-0 w-full z-40 pointer-events-auto">
        <PaintbrushNav
          currentView={currentView}
          onNavigate={handleNavigate}
          soundMuted={soundMuted}
          onToggleSound={handleToggleSound}
        />
      </div>

      {/* Screen Views (Strictly 100vh with zero scroll, backgrounds extend behind nav) */}
      <main className="w-full h-full overflow-hidden relative">
        <Outlet context={{ soundMuted, onOpenModal: setActiveModal }} />
      </main>

      {/* Global Modals (Achievements, Leaderboard, Settings, How it Works) */}
      <Modals
        activeModal={activeModal}
        onClose={() => setActiveModal(null)}
        soundMuted={soundMuted}
        onToggleSound={handleToggleSound}
      />
    </div>
  )
}
