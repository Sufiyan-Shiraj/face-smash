import React from 'react';
import { X, Trophy, BarChart2, HelpCircle, Settings as SettingsIcon, Check, Volume2, Sparkles, Zap } from 'lucide-react';
import { CrownDoodle, SmileyDoodle, CoolCatDoodle } from './Doodles';
import { sound } from '../utils/audio';

export type ModalType = 'achievements' | 'leaderboard' | 'how-it-works' | 'settings' | null;

interface ModalsProps {
  activeModal: ModalType;
  onClose: () => void;
  soundMuted: boolean;
  onToggleSound: () => void;
}

export const Modals: React.FC<ModalsProps> = ({
  activeModal,
  onClose,
  soundMuted,
  onToggleSound,
}) => {
  if (!activeModal) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[#111827] text-white border border-gray-700/80 rounded-3xl p-6 shadow-2xl relative overflow-hidden text-left animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={() => {
            sound.playClick();
            onClose();
          }}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* ACHIEVEMENTS MODAL */}
        {activeModal === 'achievements' && (
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Trophy size={24} className="text-[#facc15]" />
              <h2 className="font-heading font-black text-2xl text-white tracking-tight">
                Achievements
              </h2>
            </div>
            <p className="font-sans text-xs text-gray-400 mb-5">
              Bad decisions rewarded with shiny digital badges.
            </p>

            <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
              {[
                { title: 'First Blood', desc: 'Deliver your very first slap or punch.', icon: '🥊', unlocked: true },
                { title: 'Slap Virtuoso', desc: 'Chain 10 slaps without missing.', icon: '🖐️', unlocked: true },
                { title: 'Banana Tactician', desc: 'Land a direct banana headshot.', icon: '🍌', unlocked: true },
                { title: '1-Ton Skull Crush', desc: 'Drop the 1-Ton dumbbell from orbit.', icon: '🏋️', unlocked: true },
                { title: 'Total Chaos', desc: 'Trigger all weapons simultaneously.', icon: '💥', unlocked: true },
                { title: 'Zero Integrity', desc: 'Reduce face integrity below 10%.', icon: '💀', unlocked: false },
                { title: 'Master of Regret', desc: 'Inflict over 100,000 total damage.', icon: '👑', unlocked: false },
              ].map((ach, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-2xl flex items-center justify-between border ${
                    ach.unlocked
                      ? 'bg-gray-800/80 border-[#facc15]/40 shadow-sm'
                      : 'bg-gray-900/50 border-gray-800 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{ach.icon}</span>
                    <div>
                      <h4 className="font-heading font-bold text-sm text-white flex items-center gap-2">
                        {ach.title}
                        {ach.unlocked && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#facc15]/20 text-[#facc15] font-bold">
                            UNLOCKED
                          </span>
                        )}
                      </h4>
                      <p className="font-sans text-xs text-gray-400">{ach.desc}</p>
                    </div>
                  </div>
                  {ach.unlocked && <Check size={18} className="text-green-400" />}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* LEADERBOARD MODAL */}
        {activeModal === 'leaderboard' && (
          <div>
            <div className="flex items-center gap-2 mb-1">
              <BarChart2 size={24} className="text-[#eb2f6c]" />
              <h2 className="font-heading font-black text-2xl text-white tracking-tight">
                Global Smashboard
              </h2>
            </div>
            <p className="font-sans text-xs text-gray-400 mb-5">
              Top recorded face-smashing champions worldwide.
            </p>

            <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
              {[
                { rank: 1, name: 'Chad_Smasher99', score: '482,900', combo: 'x142', badge: '🥇' },
                { rank: 2, name: 'SpoonConnoisseur', score: '320,450', combo: 'x89', badge: '🥈' },
                { rank: 3, name: 'RubberDuckKing', score: '298,120', combo: 'x74', badge: '🥉' },
                { rank: 4, name: 'ViolenceSolvesThings', score: '184,300', combo: 'x51' },
                { rank: 5, name: 'You (Current Session)', score: '12,483', combo: 'x8', highlight: true },
                { rank: 6, name: 'Banana_Sniper', score: '9,820', combo: 'x12' },
              ].map((row, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-2xl flex items-center justify-between border ${
                    row.highlight
                      ? 'bg-[#eb2f6c]/20 border-[#eb2f6c] shadow-[0_0_15px_rgba(235,47,108,0.3)]'
                      : 'bg-gray-800/60 border-gray-700/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-heading font-black text-sm w-6 text-center text-gray-400">
                      {row.badge || `#${row.rank}`}
                    </span>
                    <span className="font-heading font-bold text-sm text-white">{row.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-sans text-xs text-gray-400">{row.combo}</span>
                    <span className="font-heading font-black text-sm text-[#facc15]">{row.score}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* HOW IT WORKS MODAL */}
        {activeModal === 'how-it-works' && (
          <div>
            <div className="flex items-center gap-2 mb-1">
              <HelpCircle size={24} className="text-[#38bdf8]" />
              <h2 className="font-heading font-black text-2xl text-white tracking-tight">
                How It Works
              </h2>
            </div>
            <p className="font-sans text-xs text-gray-400 mb-5">
              The revolutionary, highly unnecessary technology pipeline.
            </p>

            <div className="space-y-4">
              <div className="p-3 bg-gray-800/60 rounded-2xl border border-gray-700/60 flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-[#eb2f6c] text-white flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">1</span>
                <div>
                  <h4 className="font-heading font-bold text-sm text-white">Upload or Record</h4>
                  <p className="font-sans text-xs text-gray-400">Upload a 5-20 second face video or snap your camera.</p>
                </div>
              </div>

              <div className="p-3 bg-gray-800/60 rounded-2xl border border-gray-700/60 flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-[#facc15] text-black flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">2</span>
                <div>
                  <h4 className="font-heading font-bold text-sm text-white">3D Face Mesh Extraction</h4>
                  <p className="font-sans text-xs text-gray-400">Cyber landmarks are extracted across 5 camera angles into a squishy digital bust.</p>
                </div>
              </div>

              <div className="p-3 bg-gray-800/60 rounded-2xl border border-gray-700/60 flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-[#22c55e] text-black flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">3</span>
                <div>
                  <h4 className="font-heading font-bold text-sm text-white">Unbridled Catharsis</h4>
                  <p className="font-sans text-xs text-gray-400">Pick from 8 weapon tools (Slap, Punch, Brick, Spoon, Banana, etc.) and relieve your stress.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SETTINGS MODAL */}
        {activeModal === 'settings' && (
          <div>
            <div className="flex items-center gap-2 mb-1">
              <SettingsIcon size={24} className="text-gray-300" />
              <h2 className="font-heading font-black text-2xl text-white tracking-tight">
                Settings
              </h2>
            </div>
            <p className="font-sans text-xs text-gray-400 mb-5">
              Tweak your smashing experience.
            </p>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3.5 bg-gray-800/60 rounded-2xl border border-gray-700/60">
                <div className="flex items-center gap-3">
                  <Volume2 size={20} className="text-[#38bdf8]" />
                  <div>
                    <h4 className="font-heading font-bold text-sm text-white">Sound Effects (Web Audio API)</h4>
                    <p className="font-sans text-xs text-gray-400">Procedural synthesizers for slap, punch, and clang.</p>
                  </div>
                </div>
                <button
                  onClick={onToggleSound}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer ${
                    !soundMuted ? 'bg-[#22c55e] text-black' : 'bg-gray-700 text-gray-400'
                  }`}
                >
                  {!soundMuted ? 'ENABLED' : 'MUTED'}
                </button>
              </div>

              <div className="flex items-center justify-between p-3.5 bg-gray-800/60 rounded-2xl border border-gray-700/60">
                <div className="flex items-center gap-3">
                  <Sparkles size={20} className="text-[#eb2f6c]" />
                  <div>
                    <h4 className="font-heading font-bold text-sm text-white">Impact Sparks & Confetti</h4>
                    <p className="font-sans text-xs text-gray-400">Display comic action text & shockwave particles.</p>
                  </div>
                </div>
                <span className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#22c55e] text-black">
                  ON
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
