import React, { useState, useRef, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { CrownDoodle, TornPaperBottom } from './Doodles';
import { SmashCanvas, WeaponType } from './SmashCanvas';
import { StageConfig, getSavedStageConfig } from './StageControls';
import { sound } from '../utils/audio';
import { useParallax } from '../utils/useParallax';

// Assets
import background3Img from '../assets/smash/background3.png';
import webcamFrameImg from '../assets/smash/webcam.png';
import standImg from '../assets/smash/stand.png';

// Extracted Glove Icons
import glovePinkImg from '../assets/smash/glove_pink.png';
import gloveSpikedImg from '../assets/smash/glove_spiked.png';
import gloveDuckyImg from '../assets/smash/glove_ducky.png';
import gloveHammerImg from '../assets/smash/glove_hammer.png';
import gloveGauntletImg from '../assets/smash/glove_gauntlet.png';

interface SmashLabProps {
  onBackToUpload: () => void;
  uploadedFaceUrl?: string;
}

interface GloveOption {
  id: WeaponType;
  name: string;
  img: string;
}

const GLOVE_OPTIONS: GloveOption[] = [
  { id: 'punch', name: 'Boxing Glove', img: glovePinkImg },
  { id: 'brick', name: 'Spiked Fist', img: gloveSpikedImg },
  { id: 'banana', name: 'Cool Duck', img: gloveDuckyImg },
  { id: 'dumbbell', name: 'Sledgehammer', img: gloveHammerImg },
  { id: 'chaos', name: 'Gauntlet', img: gloveGauntletImg },
];

export const SmashLabView: React.FC<SmashLabProps> = ({ onBackToUpload, uploadedFaceUrl }) => {
  const [selectedGloveIdx, setSelectedGloveIdx] = useState(0);
  const [targetModel, setTargetModel] = useState<'bust' | 'dummy'>('bust');
  const [punchForce, setPunchForce] = useState(60);
  const [punchSpeed, setPunchSpeed] = useState(70);
  const [showParticles, setShowParticles] = useState(true);
  const [showDeformation, setShowDeformation] = useState(true);
  const [realtimeSmash, setRealtimeSmash] = useState(true);

  const [damage, setDamage] = useState(8420);
  const [hits, setHits] = useState(12);
  const [combo, setCombo] = useState(3);
  const [integrity, setIntegrity] = useState(72);
  const [cameraActive, setCameraActive] = useState(false);
  const [isPunching, setIsPunching] = useState(false);
  const [stageConfig, setStageConfig] = useState<StageConfig>(() => getSavedStageConfig());

  const videoRef = useRef<HTMLVideoElement>(null);
  const arenaRef = useRef<HTMLDivElement>(null);

  // Parallax hook
  const parallax = useParallax(0.12);
  const bgOffset = parallax.getOffset(18, 12, true);
  const leftOffset = parallax.getOffset(32, 18);
  const rightOffset = parallax.getOffset(36, 20);

  // Initialize webcam feed
  useEffect(() => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ video: { width: 480, height: 360 } })
        .then((stream) => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play();
            setCameraActive(true);
          }
        })
        .catch(() => setCameraActive(false));
    }

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Keyboard shortcut triggers (1-5 for weapons, Space/Enter to smash, R to reset)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        handleTriggerSmash();
      }
      if (e.key >= '1' && e.key <= '5') {
        const idx = parseInt(e.key) - 1;
        if (idx < GLOVE_OPTIONS.length) {
          setSelectedGloveIdx(idx);
          sound.playClick();
        }
      }
      if (e.key === 'ArrowLeft') {
        setSelectedGloveIdx((prev) => (prev > 0 ? prev - 1 : GLOVE_OPTIONS.length - 1));
        sound.playClick();
      }
      if (e.key === 'ArrowRight') {
        setSelectedGloveIdx((prev) => (prev < GLOVE_OPTIONS.length - 1 ? prev + 1 : 0));
        sound.playClick();
      }
      if (e.key === 'r' || e.key === 'R') {
        handleReset();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [punchForce, punchSpeed, isPunching]);

  const activeTool = GLOVE_OPTIONS[selectedGloveIdx].id;

  const handleTriggerSmash = () => {
    if (isPunching) return;
    setIsPunching(true);
    sound.playPunch();

    // Damage computation based on punch force
    const dmg = Math.floor(250 * (punchForce / 50) + Math.random() * 80);
    setDamage((prev) => prev + dmg);
    setHits((prev) => prev + 1);
    setCombo((prev) => {
      const next = prev + 1;
      if (next % 5 === 0) {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.5, x: 0.5 },
        });
      }
      return next;
    });
    setIntegrity((prev) => Math.max(0, prev - Math.floor(dmg / 200)));

    setTimeout(() => {
      setIsPunching(false);
    }, Math.max(200, 480 - (punchSpeed * 2.5)));
  };

  const handleHit = (weapon: WeaponType, damageAmount: number) => {
    setDamage((prev) => prev + damageAmount);
    setHits((prev) => prev + 1);
    setCombo((prev) => prev + 1);
    setIntegrity((prev) => Math.max(0, prev - Math.floor(damageAmount / 250)));
  };

  const handleReset = () => {
    sound.playVictory();
    setDamage(0);
    setHits(0);
    setCombo(0);
    setIntegrity(100);
    confetti({
      particleCount: 70,
      spread: 80,
      origin: { y: 0.6 },
    });
  };

  return (
    <div
      ref={arenaRef}
      className="w-full h-full bg-[#080b11] text-gray-900 flex flex-col justify-between relative overflow-hidden select-none parallax-container"
    >
      {/* LAYER 1: BASE WORKSHOP BACKGROUND CANVAS (Fills whole 100vh window up to top) */}
      <div
        className="absolute -inset-8 w-[calc(100%+64px)] h-[calc(100%+64px)] bg-cover bg-center pointer-events-none z-0 parallax-layer"
        style={{
          backgroundImage: `url(${background3Img})`,
          transform: `translate3d(${bgOffset.x}px, ${bgOffset.y}px, 0)`,
        }}
      />

      {/* AMBIENT GLOWS */}
      <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-pink-500/12 rounded-full blur-3xl pointer-events-none z-0" />
      <div className="absolute bottom-1/3 right-1/4 w-96 h-96 bg-yellow-400/10 rounded-full blur-3xl pointer-events-none z-0" />

      {/* ================= MAIN 3-COLUMN SMASH LAB ARENA ================= */}
      <div className="w-full max-w-[1600px] mx-auto px-3 sm:px-6 lg:px-8 flex-1 flex items-center justify-between relative z-20 my-auto h-full overflow-visible pt-[66px] sm:pt-[70px] pb-2">
        
        {/* ================= LEFT COLUMN: WEBCAM POLAROID & STICKY NOTE ================= */}
        <div
          className="w-[20%] xl:w-[22%] h-full flex flex-col justify-between items-start py-2 lg:py-4 relative z-10 pointer-events-auto parallax-layer"
          style={{
            transform: `translate3d(${leftOffset.x}px, ${leftOffset.y}px, 0)`,
          }}
        >
          {/* Taped Webcam Polaroid Frame */}
          <div className="relative w-full max-w-[210px] sm:max-w-[230px] lg:max-w-[250px] aspect-[1448/1086] transform -rotate-3 hover:rotate-0 transition-transform duration-300 drop-shadow-[0_12px_24px_rgba(0,0,0,0.65)]">
            
            {/* Live Camera Viewport placed directly behind Polaroid Cutout */}
            <div className="absolute left-[8%] top-[12%] w-[84%] h-[72%] bg-black/90 rounded-lg overflow-hidden flex items-center justify-center border border-gray-800">
              {cameraActive ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover transform -scale-x-100"
                />
              ) : (
                <img
                  src={uploadedFaceUrl || '/assets/face_front.png'}
                  alt="Webcam Feed"
                  className="w-full h-full object-cover opacity-80"
                />
              )}
            </div>

            {/* High-Resolution Taped Frame Overlay */}
            <img
              src={webcamFrameImg}
              alt="Webcam Polaroid Frame"
              className="w-full h-full object-contain pointer-events-none relative z-10"
            />
          </div>

          {/* Wall Graffiti: "SAME FACE. WORSE DECISIONS. :)" */}
          <div className="font-marker text-xs sm:text-sm text-pink-300/80 leading-tight select-none my-1 drop-shadow-md">
            <p className="tracking-wide">SAME FACE.</p>
            <p className="tracking-wide">WORSE DECISIONS. :)</p>
          </div>

          {/* Proportional Yellow Taped Sticky Note: "GOOD FACES BAD IDEAS :)" */}
          <div className="bg-[#fef08a] px-3 py-2 sm:px-3.5 sm:py-2.5 rounded shadow-xl transform rotate-2 max-w-[155px] sm:max-w-[165px] border border-amber-300 pointer-events-auto hover:scale-105 transition-transform">
            <div className="flex items-center justify-between mb-0.5">
              <span className="font-marker text-xs sm:text-sm text-gray-900 leading-tight">GOOD FACES</span>
              <CrownDoodle size={14} color="#000" />
            </div>
            <p className="font-marker text-xs sm:text-sm text-gray-900 leading-tight">BAD IDEAS :)</p>
          </div>

          {/* Bottom Left Humorous Marker Hint */}
          <div className="font-marker text-xs text-yellow-300 leading-tight drop-shadow-md select-none">
            <p className="text-pink-400 font-bold">SMACK! ⤵</p>
            <p className="text-gray-300 font-sans text-[10px]">Click head or hit SPACE</p>
          </div>
        </div>

        {/* ================= CENTER COLUMN: 3D DEFORMABLE BUST & STAGE (FRONT-MOST LAYER) ================= */}
        <div className="w-[50%] xl:w-[48%] h-full flex flex-col items-center justify-center relative z-40 my-auto pointer-events-auto overflow-visible">
          
          {/* Main Smash Canvas Area */}
          <div className="relative w-full h-full max-w-[700px] max-h-[660px] flex items-center justify-center z-40 overflow-visible">
            
            {/* Interactive 3D Deformable Canvas (renders anchored pedestal and marble bust) */}
            <SmashCanvas
              activeTool={activeTool}
              onHit={handleHit}
              integrity={integrity}
              uploadedFaceUrl={uploadedFaceUrl}
              targetModel={targetModel}
              stageConfig={stageConfig}
            />

            {/* Subtle Neon Floor Ring Accent */}
            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 w-64 h-12 bg-pink-500/25 rounded-full blur-xl pointer-events-none -z-10 animate-pulse" />
          </div>

        </div>

        {/* ================= RIGHT COLUMN: WALL STICKY NOTES & DOODLE ================= */}
        <div
          className="w-[20%] xl:w-[22%] h-full flex flex-col justify-between items-end py-2 lg:py-4 relative z-20 pointer-events-auto parallax-layer"
          style={{
            transform: `translate3d(${rightOffset.x}px, ${rightOffset.y}px, 0)`,
          }}
        >
          {/* Note 1: "TRY THEM ALL!" */}
          <div className="bg-[#fef08a] px-3.5 py-3 rounded shadow-2xl transform -rotate-3 hover:rotate-0 transition-transform duration-300 max-w-[155px] border border-amber-300 relative group cursor-default">
            {/* Top Tape Tab */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-12 h-5 bg-amber-200/80 border border-amber-300/60 shadow-sm transform -rotate-2" />
            <p className="font-marker text-sm text-gray-900 leading-tight text-center">
              TRY THEM ALL!
            </p>
          </div>

          {/* Doodle Arrow pointing left to bust: "SMACK! ⤵" */}
          <div className="text-right select-none my-auto pr-2">
            <p className="font-marker text-2xl sm:text-3xl text-yellow-400 drop-shadow-[0_2px_10px_rgba(250,204,21,0.6)] transform -rotate-6">
              SMACK! ⤵
            </p>
            <p className="font-hand text-xs text-pink-300/90 mt-1">
              Click face to smash
            </p>
          </div>

          {/* Note 2: "SAME FACE. MORE DAMAGE. :)" */}
          <div className="bg-[#fef08a] px-3.5 py-2.5 rounded shadow-2xl transform rotate-3 hover:rotate-0 transition-transform duration-300 max-w-[170px] border border-amber-300 relative group cursor-default">
            {/* Top Tape Tab */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-12 h-5 bg-amber-200/80 border border-amber-300/60 shadow-sm transform rotate-1" />
            <p className="font-marker text-xs sm:text-sm text-gray-900 leading-tight">
              SAME FACE.
            </p>
            <p className="font-marker text-xs sm:text-sm text-gray-900 leading-tight">
              MORE DAMAGE. :)
            </p>
          </div>
        </div>

      </div>

      {/* ================= BOTTOM DOODLE & FOOTNOTE GUIDE BAR ================= */}
      <div className="w-full bg-[#0a0d14] text-white pt-1 pb-2.5 relative z-30">
        <TornPaperBottom color="#0a0d14" className="-mt-6 md:-mt-8" />

        <div className="max-w-[1536px] mx-auto px-4 sm:px-8 flex items-center justify-between text-xs select-none">
          
          {/* Left Footnote */}
          <div className="flex items-center gap-2">
            <CrownDoodle size={16} color="#ec4899" />
            <span className="font-hand text-xs sm:text-sm text-gray-300">
              IT'LL BE FUNNIER LATER. ⤵
            </span>
          </div>

          {/* Center Hint */}
          <div className="font-hand text-xs text-gray-400 hidden md:block">
            CLICK FACE OR HIT SPACE TO SMASH • KEYS 1-5 FOR GLOVES
          </div>

          {/* Right Footnote */}
          <div className="font-hand text-xs sm:text-sm text-gray-400 text-right hidden sm:block">
            A FEW SECONDS NOW. A LIFETIME OF REGRET LATER. :)
          </div>

        </div>
      </div>

    </div>
  );
};
