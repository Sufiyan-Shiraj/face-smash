import React from 'react'
import { UploadCloud, Box, Gamepad2, Volume2, VolumeX } from 'lucide-react'
import { CrownDoodle } from './Doodles.jsx'
import { sound } from '../utils/uiAudio.js'
import { useParallax } from '../utils/useParallax.js'
import navbarImg from '../assets/common/paintbrush_navbar.png'

export function PaintbrushNav({
  currentView,
  onNavigate,
  soundMuted,
  onToggleSound,
}) {
  const parallax = useParallax(0.12)
  const strokeOffset = parallax.getOffset(12, 6, true)
  const strokeTilt = parallax.getTilt(2, 2.5)
  const contentOffset = parallax.getOffset(16, 8, false)
  const contentTilt = parallax.getTilt(3, 3.5)

  return (
    <header className="w-full relative z-40 select-none px-3 sm:px-6 md:px-8 h-[64px] sm:h-[70px] md:h-[74px] flex items-center justify-between overflow-visible">
      {/* Pink Paintbrush Stroke Background from navbar.png with subtle counter parallax drift */}
      <div
        className="absolute -inset-2 w-[calc(100%+16px)] h-[calc(100%+16px)] pointer-events-none z-0 parallax-layer"
        style={{
          transform: `translate3d(${strokeOffset.x}px, ${strokeOffset.y}px, 0) perspective(900px) rotateX(${strokeTilt.rotateX}deg) rotateY(${strokeTilt.rotateY}deg)`,
        }}
      >
        <img
          src={navbarImg}
          alt="Pink Paintbrush Navbar"
          className="w-full h-full object-fill drop-shadow-[0_4px_16px_rgba(235,47,108,0.45)]"
        />
      </div>

      <div
        className="w-full max-w-7xl mx-auto flex items-center justify-between relative z-10 parallax-layer"
        style={{
          transform: `translate3d(${contentOffset.x}px, ${contentOffset.y}px, 0) perspective(900px) rotateX(${contentTilt.rotateX}deg) rotateY(${contentTilt.rotateY}deg)`,
        }}
      >
        {/* Left Brand */}
        <div
          onClick={() => {
            sound.playClick()
            onNavigate('upload')
          }}
          className="flex items-center gap-2 cursor-pointer group transform -rotate-[2deg] -translate-y-[2px] sm:-translate-y-[3px] transition-transform duration-200 hover:-rotate-[1deg] hover:scale-102"
        >
          <CrownDoodle
            size={26}
            color="#facc15"
            className="group-hover:rotate-12 transition-transform duration-200 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] -rotate-6"
          />
          <div className="flex items-baseline">
            <span className="font-comic text-2xl sm:text-3xl text-white tracking-wider leading-none drop-shadow-[2px_2px_0px_#0f172a] drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
              FACE
            </span>
            <span className="font-comic text-2xl sm:text-3xl text-[#facc15] tracking-wider leading-none ml-1 drop-shadow-[2px_2px_0px_#0f172a] drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
              SMASH
            </span>
          </div>
          <span className="hidden lg:inline font-hand text-xs sm:text-sm text-white/95 border-l border-white/40 pl-2.5 ml-1 font-bold drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
            Same face. Worse decisions.
          </span>
        </div>

        {/* Center: Core Navigation Tabs following the S-curve wave */}
        <nav className="flex items-center gap-1.5 sm:gap-2.5 md:gap-3">
          {/* Upload Tab */}
          <button
            onClick={() => {
              sound.playClick()
              onNavigate('upload')
            }}
            className={`group relative flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-full font-heading text-xs sm:text-sm font-bold cursor-pointer transition-all duration-200 transform rotate-[2.5deg] -translate-y-[3px] sm:-translate-y-[4px] hover:rotate-[1deg] hover:scale-105 ${
              currentView === 'upload'
                ? 'bg-[#facc15] text-[#0f172a] border-2 border-[#0f172a] font-black shadow-[0_4px_14px_rgba(0,0,0,0.35),0_0_12px_rgba(250,204,21,0.6)] scale-105'
                : 'bg-black/25 text-white border border-white/20 drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)] hover:text-[#facc15] hover:bg-black/40 hover:border-yellow-400/40'
            }`}
          >
            <UploadCloud size={15} className={currentView === 'upload' ? 'stroke-[2.5]' : ''} />
            <span>Upload</span>
            {currentView === 'upload' && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#0f172a] inline-block animate-pulse ml-0.5" />
            )}
          </button>

          {/* Scan 3D Tab */}
          <button
            onClick={() => {
              sound.playClick()
              onNavigate('scan')
            }}
            className={`group relative flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-full font-heading text-xs sm:text-sm font-bold cursor-pointer transition-all duration-200 transform rotate-[0.5deg] translate-y-[2px] sm:translate-y-[3px] hover:rotate-0 hover:scale-105 ${
              currentView === 'scan'
                ? 'bg-[#facc15] text-[#0f172a] border-2 border-[#0f172a] font-black shadow-[0_4px_14px_rgba(0,0,0,0.35),0_0_12px_rgba(250,204,21,0.6)] scale-105'
                : 'bg-black/25 text-white border border-white/20 drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)] hover:text-[#facc15] hover:bg-black/40 hover:border-yellow-400/40'
            }`}
          >
            <Box size={15} className={currentView === 'scan' ? 'stroke-[2.5]' : ''} />
            <span>Scan 3D</span>
            {currentView === 'scan' && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#0f172a] inline-block animate-pulse ml-0.5" />
            )}
          </button>

          {/* Smash Lab Tab */}
          <button
            onClick={() => {
              sound.playClick()
              onNavigate('smash')
            }}
            className={`group relative flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-full font-heading text-xs sm:text-sm font-bold cursor-pointer transition-all duration-200 transform -rotate-[2deg] translate-y-[6px] sm:translate-y-[7px] hover:-rotate-[1deg] hover:scale-105 ${
              currentView === 'smash'
                ? 'bg-[#facc15] text-[#0f172a] border-2 border-[#0f172a] font-black shadow-[0_4px_14px_rgba(0,0,0,0.35),0_0_12px_rgba(250,204,21,0.6)] scale-105'
                : 'bg-black/25 text-white border border-white/20 drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)] hover:text-[#facc15] hover:bg-black/40 hover:border-yellow-400/40'
            }`}
          >
            <Gamepad2 size={15} className={currentView === 'smash' ? 'stroke-[2.5]' : ''} />
            <span>Smash Lab</span>
            {currentView === 'smash' && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#0f172a] inline-block animate-pulse ml-0.5" />
            )}
          </button>
        </nav>

        {/* Right: Sound & Music FX Badge */}
        <div className="flex items-center gap-2 transform -rotate-[6deg] sm:-rotate-[6.5deg] -translate-y-[6px] sm:-translate-y-[8px]">
          <button
            onClick={() => {
              sound.playClick()
              onToggleSound()
            }}
            title={soundMuted ? 'Turn Sound & Music ON' : 'Turn Sound & Music OFF'}
            className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-full text-xs font-heading font-bold cursor-pointer transition-all duration-200 hover:scale-105 ${
              !soundMuted
                ? 'bg-[#0f172a] text-[#facc15] border-2 border-[#0f172a] shadow-[0_4px_12px_rgba(0,0,0,0.35)] font-black hover:bg-black'
                : 'bg-black/50 text-white/80 border border-white/30 backdrop-blur-xs hover:bg-black/70 hover:text-white'
            }`}
          >
            {soundMuted ? (
              <VolumeX size={15} className="text-red-400" />
            ) : (
              <Volume2 size={15} className="text-emerald-400 animate-bounce" />
            )}
            <span className="text-[11px] sm:text-xs tracking-wider">
              {soundMuted ? 'AUDIO: OFF' : 'AUDIO: ON'}
            </span>
            {!soundMuted && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_#34d399]" />
            )}
          </button>
        </div>
      </div>
    </header>
  )
}
