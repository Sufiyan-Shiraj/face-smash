import React from 'react';
import { Home, Trophy, BarChart2, HelpCircle, Settings, ChevronDown, Check, X, Volume2, VolumeX } from 'lucide-react';
import { CrownDoodle, SmileyDoodle } from './Doodles';
import { sound } from '../utils/audio';
import { ModalType } from './Modals';

interface HeaderProps {
  currentView: 'upload' | 'scan' | 'smash';
  onNavigate: (view: 'upload' | 'scan' | 'smash') => void;
  soundMuted: boolean;
  onToggleSound: () => void;
  onOpenModal: (modal: ModalType) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onNavigate,
  soundMuted,
  onToggleSound,
  onOpenModal,
}) => {
  return (
    <header className="w-full bg-[#101318] text-white px-4 md:px-8 py-2.5 flex items-center justify-between border-b border-white/5 relative z-40">
      {/* Left Brand */}
      <div
        className="flex items-center gap-3 cursor-pointer group"
        onClick={() => {
          sound.playClick();
          onNavigate('upload');
        }}
      >
        <div className="flex items-center gap-1.5">
          <CrownDoodle size={26} color="#facc15" className="group-hover:rotate-12 transition-transform duration-200" />
          <div className="flex items-baseline">
            <span className="font-comic text-2xl md:text-3xl text-[#eb2f6c] tracking-wider leading-none drop-shadow-[1px_1px_0px_#000]">
              FACE
            </span>
            <span className="font-comic text-2xl md:text-3xl text-[#facc15] tracking-wider leading-none drop-shadow-[1px_1px_0px_#000] ml-1">
              SMASH
            </span>
          </div>
        </div>
        <div className="hidden sm:flex flex-col text-left font-hand text-xs md:text-sm text-gray-300 leading-tight border-l border-white/20 pl-3">
          <span>Same face.</span>
          <span className="text-gray-400">Worse decisions.</span>
        </div>
      </div>

      {/* Middle Navigation - Conditional based on View */}
      {currentView === 'scan' ? (
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Step 1: Upload (Complete) */}
          <div
            onClick={() => onNavigate('upload')}
            className="flex items-center gap-1.5 px-3 py-1 bg-[#15803d]/80 text-[#86efac] border border-[#22c55e]/40 rounded-full text-xs font-semibold cursor-pointer hover:bg-[#15803d] transition-colors"
          >
            <span className="w-4 h-4 rounded-full bg-[#22c55e] text-black flex items-center justify-center text-[10px] font-bold">1</span>
            <span>Upload</span>
            <Check size={12} strokeWidth={3} />
          </div>

          {/* Step 2: Scan (Active) */}
          <div className="flex items-center gap-1.5 px-3.5 py-1 bg-[#eb2f6c] text-white rounded-full text-xs font-bold shadow-[0_0_12px_rgba(235,47,108,0.5)]">
            <span className="w-4 h-4 rounded-full bg-white text-[#eb2f6c] flex items-center justify-center text-[10px] font-bold">2</span>
            <span>Scan</span>
          </div>

          {/* Step 3: Process */}
          <div className="hidden md:flex items-center gap-1.5 text-gray-400 text-xs font-medium">
            <span className="w-4 h-4 rounded-full bg-gray-800 border border-gray-600 flex items-center justify-center text-[10px]">3</span>
            <span>Process</span>
          </div>

          {/* Step 4: Smash */}
          <div
            onClick={() => onNavigate('smash')}
            className="hidden md:flex items-center gap-1.5 text-gray-400 text-xs font-medium cursor-pointer hover:text-white transition-colors"
          >
            <span className="w-4 h-4 rounded-full bg-gray-800 border border-gray-600 flex items-center justify-center text-[10px]">4</span>
            <span>Smash</span>
          </div>
        </div>
      ) : (
        <nav className="hidden md:flex items-center gap-1.5 lg:gap-3">
          {/* Smash Lab Tab */}
          <button
            onClick={() => {
              sound.playClick();
              onNavigate('smash');
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              currentView === 'smash'
                ? 'bg-[#facc15] text-[#0f172a] shadow-md hover:bg-[#eab308]'
                : 'text-gray-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <Home size={15} />
            <span>Smash Lab</span>
          </button>

          {/* Achievements */}
          <button
            onClick={() => {
              sound.playClick();
              onOpenModal('achievements');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <Trophy size={15} />
            <span>Achievements</span>
          </button>

          {/* Leaderboard */}
          <button
            onClick={() => {
              sound.playClick();
              onOpenModal('leaderboard');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <BarChart2 size={15} />
            <span>Leaderboard</span>
          </button>

          {/* How it works */}
          <button
            onClick={() => {
              sound.playClick();
              onOpenModal('how-it-works');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <HelpCircle size={15} />
            <span>How it works</span>
          </button>
        </nav>
      )}

      {/* Right Controls */}
      <div className="flex items-center gap-2.5">
        {/* Audio Mute/Unmute */}
        <button
          onClick={onToggleSound}
          title={soundMuted ? 'Unmute sound effects' : 'Mute sound effects'}
          className="p-1.5 rounded-full hover:bg-white/10 text-gray-300 hover:text-white transition-colors cursor-pointer"
        >
          {soundMuted ? <VolumeX size={17} /> : <Volume2 size={17} />}
        </button>

        {currentView === 'scan' ? (
          <div className="flex items-center gap-2.5">
            <div className="hidden sm:flex items-center gap-1 font-hand text-xs text-[#facc15]">
              <span>Almost there!</span>
              <SmileyDoodle size={15} color="#facc15" />
            </div>
            <button
              onClick={() => {
                sound.playClick();
                onNavigate('upload');
              }}
              className="flex items-center gap-1 px-3 py-1 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-xs font-semibold text-gray-200 transition-colors cursor-pointer"
            >
              <X size={13} />
              <span>Cancel</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                sound.playClick();
                onOpenModal('settings');
              }}
              className="p-1.5 rounded-full hover:bg-white/10 text-gray-300 hover:text-white transition-colors cursor-pointer"
            >
              <Settings size={17} />
            </button>

            {/* User Avatar + Status */}
            <div
              onClick={() => {
                sound.playClick();
                onOpenModal('leaderboard');
              }}
              className="flex items-center gap-1.5 pl-1.5 pr-1 py-0.5 rounded-full hover:bg-white/10 cursor-pointer transition-colors"
            >
              <img
                src="/assets/avatar_user.png"
                alt="User Avatar"
                className="w-6 h-6 rounded-full object-cover border border-white/20"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <span className="hidden sm:inline text-xs text-gray-300 font-medium">
                {currentView === 'smash' ? 'Why are you still here?' : 'Not logged in'}
              </span>
              <ChevronDown size={13} className="text-gray-400" />
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
