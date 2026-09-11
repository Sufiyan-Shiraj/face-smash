import React, { useState, useEffect, useRef } from 'react';
import { Camera, Check, Sparkles, Sliders, Move, RotateCcw, Copy, ChevronDown, ChevronUp } from 'lucide-react';
import confetti from 'canvas-confetti';
import { CrownDoodle, TornPaperBottom } from './Doodles';
import { sound } from '../utils/audio';
import { useParallax } from '../utils/useParallax';
import scan3dLogo from '../assets/scan/scan3d.png';
import scandivImg from '../assets/scan/scandiv.png';
import startscanImg from '../assets/scan/startscan.png';
import nextdudeImg from '../assets/scan/nextdude.png';
import background2Img from '../assets/scan/background2.png';
import cameraCardImg from '../assets/scan/camera_status_card.png';
import almostThereImg from '../assets/scan/almost_there_badge.png';

import { ScanMeshCanvas } from './ScanMeshCanvas';

interface ScanViewProps {
  onScanComplete: () => void;
  onCancel: () => void;
  uploadedFaceUrl?: string;
}

export const ScanView: React.FC<ScanViewProps> = ({ onScanComplete, onCancel, uploadedFaceUrl }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState(72);
  const [scanComplete, setScanComplete] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [dudePunched, setDudePunched] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // High-performance parallax
  const parallax = useParallax(0.12);
  const bgOffset = parallax.getOffset(20, 15, true);
  const leftOffset = parallax.getOffset(50, 30);
  const leftTilt = parallax.getTilt(4, 5);
  const cardOffset = parallax.getOffset(35, 20);
  const cardTilt = parallax.getTilt(3, 4);
  const rightOffset = parallax.getOffset(55, 32);
  const rightTilt = parallax.getTilt(4, -5);

  // Initialize webcam
  useEffect(() => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ video: { width: 1280, height: 720 } })
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

  // Scanning progress simulation when active
  useEffect(() => {
    if (!isScanning) return;

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setScanComplete(true);
          sound.playVictory();
          confetti({
            particleCount: 90,
            spread: 80,
            origin: { y: 0.55 },
          });
          return 100;
        }
        const next = prev + Math.floor(Math.random() * 6 + 4);
        if (next % 12 === 0) sound.playStepDone();
        return Math.min(100, next);
      });
    }, 250);

    return () => clearInterval(interval);
  }, [isScanning]);

  const handleToggleScan = () => {
    sound.playClick();
    if (scanComplete) {
      onScanComplete();
      return;
    }
    if (isScanning) {
      setIsScanning(false);
    } else {
      setIsScanning(true);
      if (progress >= 100) setProgress(20);
    }
  };

  const handleDudeClick = () => {
    sound.playPunch();
    setDudePunched(true);
    setTimeout(() => setDudePunched(false), 500);
  };

  return (
    <div className="w-full h-full bg-[#f6f2ea] text-gray-900 flex flex-col justify-between relative overflow-hidden select-none parallax-container">
      {/* LAYER 1: BASE BACKGROUND CANVAS WITH PARALLAX PAN */}
      <div 
        className="absolute -inset-8 w-[calc(100%+64px)] h-[calc(100%+64px)] bg-cover bg-center pointer-events-none z-0 parallax-layer"
        style={{
          backgroundImage: `url(${background2Img})`,
          transform: `translate3d(${bgOffset.x}px, ${bgOffset.y}px, 0)`,
        }}
      />

      {/* AMBIENT ACCENT GLOWS & SPRAY SPLATTERS */}
      <div className="absolute top-1/4 left-10 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl pointer-events-none z-0" />
      <div className="absolute bottom-1/4 right-10 w-96 h-96 bg-amber-400/12 rounded-full blur-3xl pointer-events-none z-0" />

      {/* ================= MAIN 3-COLUMN COMPOSITION ================= */}
      <div className="w-full max-w-[1536px] mx-auto px-3 sm:px-6 lg:px-8 flex-1 flex items-center justify-between relative z-10 my-auto h-full overflow-visible">
        
        {/* ================= LEFT COLUMN: GRAFFITI LOGO & QUOTES ================= */}
        <div 
          className="w-[20%] xl:w-[22%] h-full flex flex-col justify-between items-start py-6 lg:py-10 relative z-20 pointer-events-auto parallax-layer"
          style={{
            transform: `translate3d(${leftOffset.x}px, ${leftOffset.y}px, 0)`,
          }}
        >
          {/* Top-Left Handwritten Quote */}
          <div className="font-marker text-xs sm:text-sm lg:text-base text-gray-900 leading-tight select-none">
            <p className="tracking-wide">SAME</p>
            <p className="tracking-wide">FACE.</p>
            <p className="tracking-wide">WORSE</p>
            <div className="flex items-center gap-1">
              <span className="tracking-wide">DECISIONS.</span>
              <span className="text-base font-sans">:)</span>
            </div>
          </div>

          {/* Main "SCAN & 3D" Graffiti Logo with 3D Tilt */}
          <div 
            className="w-full max-w-[340px] my-auto cursor-pointer hover:scale-105 transition-transform"
            style={{
              transform: `perspective(800px) rotateX(${leftTilt.rotateX}deg) rotateY(${leftTilt.rotateY}deg)`,
            }}
            onClick={() => sound.playClick()}
          >
            <img
              src={scan3dLogo}
              alt="SCAN & 3D"
              className="w-full h-auto object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.25)]"
            />
          </div>

          {/* Bottom-Left Handwritten Note */}
          <div className="font-marker text-[11px] sm:text-xs lg:text-sm text-gray-900 leading-snug max-w-[200px] select-none">
            <p>WE'RE TURNING</p>
            <p>YOUR FACE INTO</p>
            <p>SOMETHING</p>
            <p>SERIOUSLY</p>
            <div className="flex items-center gap-1.5">
              <span>SMASHABLE.</span>
              <CrownDoodle size={18} color="#000" className="rotate-12" />
            </div>
          </div>
        </div>

        {/* ================= CENTER COLUMN: MAIN SCAN CONTAINER ================= */}
        <div 
          className="w-[58%] xl:w-[56%] flex flex-col items-center justify-center relative z-20 my-auto parallax-layer px-1"
          style={{
            transform: `translate3d(${cardOffset.x}px, ${cardOffset.y}px, 0) perspective(900px) rotateX(${cardTilt.rotateX}deg) rotateY(${cardTilt.rotateY}deg)`,
          }}
        >
          
          {/* ================= PRE-SCAN STATE (Uses scandiv.png backdrop with interactive button overlay) ================= */}
          {!isScanning ? (
            <div className="relative w-full max-w-[800px] lg:max-w-[840px] xl:max-w-[880px] aspect-[1766/891] drop-shadow-[0_20px_45px_rgba(0,0,0,0.45)] flex items-center justify-center">
              
              {/* High-Resolution scandiv.png Backdrop */}
              <img
                src={scandivImg}
                alt="3D Scan Console"
                className="w-full h-full object-contain pointer-events-none select-none"
              />

              {/* Living 3D Animated Particle Mesh & Telemetry Console */}
              <div className="absolute left-[2.5%] top-[4%] w-[49%] h-[92%] z-10 flex items-center justify-center pointer-events-auto">
                <ScanMeshCanvas progress={progress} onMeshClick={handleToggleScan} />
              </div>

              {/* Interactive "Start Scan" Button with user-chosen placement */}
              <div 
                className="absolute flex items-center justify-center pointer-events-auto"
                style={{
                  left: '60.1%',
                  top: '68.9%',
                  width: '36.5%',
                  height: '14.1%',
                }}
              >
                <button
                  onClick={handleToggleScan}
                  title="Click to start 3D scan!"
                  className="group relative cursor-pointer transform hover:scale-105 active:scale-95 transition-all duration-200 focus:outline-none w-full h-full flex items-center justify-center"
                >
                  <img
                    src={startscanImg}
                    alt="Start Scan"
                    className="w-full h-full object-fill drop-shadow-[0_0_24px_rgba(235,47,108,0.85)] group-hover:brightness-110"
                  />
                </button>
              </div>

            </div>
          ) : (
            /* ================= LIVE SCANNING STATE (Camera Viewport + Landmarks) ================= */
            <div className="relative w-full max-w-[800px] lg:max-w-[840px] xl:max-w-[880px] aspect-[16/8.2] bg-[#0c1017] rounded-3xl p-3 sm:p-4 md:p-5 shadow-[0_20px_50px_rgba(0,0,0,0.5),0_0_0_2px_rgba(255,255,255,0.08)] border border-gray-800 text-white flex items-stretch overflow-hidden">
              
              {/* White Tape Note on Top Right of Card */}
              <div className="absolute top-2 right-12 w-10 h-3.5 bg-white/80 rounded-sm transform rotate-3 shadow-sm z-30 pointer-events-none" />

              <div className="w-full h-full flex items-stretch justify-between relative z-10">
                
                {/* LIVE WEBCAM FEED (LEFT 60%) */}
                <div className="w-[60%] h-full relative rounded-2xl overflow-hidden bg-black border border-pink-500/50 flex items-center justify-center">
                  
                  {/* Top Live Badge */}
                  <div className="absolute top-2.5 left-2.5 z-30 flex items-center gap-1.5 px-2 py-0.5 bg-black/80 rounded-md border border-white/10 text-[10px] font-mono">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_#ef4444]" />
                    <span className="font-bold text-white tracking-wider">LIVE CAMERA</span>
                  </div>

                  {/* Video or Uploaded Image */}
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
                      alt="Live Camera Scan"
                      className="w-full h-full object-cover"
                    />
                  )}

                  {/* Pink Corner Reticles */}
                  <div className="absolute inset-4 pointer-events-none border border-pink-500/30 rounded-xl">
                    <div className="absolute -top-1 -left-1 w-5 h-5 border-t-2 border-l-2 border-pink-500" />
                    <div className="absolute -top-1 -right-1 w-5 h-5 border-t-2 border-r-2 border-pink-500" />
                    <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-2 border-l-2 border-pink-500" />
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-2 border-r-2 border-pink-500" />

                    {/* Animated Scanning Laser */}
                    <div className="w-full h-1 bg-gradient-to-r from-transparent via-pink-500 to-transparent shadow-[0_0_15px_#eb2f6c] absolute top-1/3 animate-pulse" />
                  </div>

                  {/* 3D Facial Landmark Tracking Nodes */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 400 300">
                    {[
                      { cx: 200, cy: 110 },
                      { cx: 165, cy: 130 },
                      { cx: 235, cy: 130 },
                      { cx: 200, cy: 160 },
                      { cx: 200, cy: 180 },
                      { cx: 175, cy: 215 },
                      { cx: 225, cy: 215 },
                      { cx: 200, cy: 225 },
                      { cx: 140, cy: 170 },
                      { cx: 260, cy: 170 },
                    ].map((pt, i) => (
                      <g key={i}>
                        <circle cx={pt.cx} cy={pt.cy} r="3" fill="#ec4899" className="animate-ping" style={{ animationDuration: `${1.2 + (i % 3) * 0.4}s` }} />
                        <circle cx={pt.cx} cy={pt.cy} r="2.5" fill="#facc15" />
                      </g>
                    ))}
                  </svg>

                  {/* Bottom Pill Badge */}
                  <div className="absolute bottom-2.5 left-1/2 transform -translate-x-1/2 px-3 py-1 bg-black/80 rounded-full border border-gray-700 text-[10px] font-mono text-gray-300">
                    Scanning your face... ({progress}%)
                  </div>
                </div>

                {/* RIGHT CONTROL PANEL */}
                <div className="w-[38%] h-full flex flex-col justify-between pl-4 text-left">
                  <div>
                    <div className="inline-block bg-[#facc15] text-black font-heading font-black text-xs sm:text-sm px-2.5 py-0.5 rounded shadow mb-1">
                      {scanComplete ? 'MESH COMPLETE!' : '3D GEOMETRY'}
                    </div>
                    <p className="font-hand text-xs text-gray-300">
                      {scanComplete ? 'Ready for face smashing!' : 'Tracking 48,732 polygon landmarks...'}
                    </p>
                  </div>

                  {/* Progress Bar */}
                  <div className="my-2">
                    <div className="flex items-center justify-between text-xs font-mono mb-1">
                      <span className="text-gray-400">CALIBRATION</span>
                      <span className="text-[#facc15] font-bold">{progress}%</span>
                    </div>
                    <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden p-0.5">
                      <div
                        className="h-full bg-gradient-to-r from-pink-500 to-yellow-400 rounded-full transition-all duration-200"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-2">
                    {scanComplete ? (
                      <button
                        onClick={() => {
                          sound.playClick();
                          onScanComplete();
                        }}
                        className="w-full py-2.5 px-4 bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-400 hover:to-rose-500 text-white font-heading font-black text-xs sm:text-sm rounded-xl shadow-[0_0_20px_rgba(235,47,108,0.8)] transform hover:scale-102 active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Sparkles size={16} />
                        <span>ENTER SMASH LAB 🚀</span>
                      </button>
                    ) : (
                      <button
                        onClick={handleToggleScan}
                        className="w-full py-2 px-3 bg-pink-600/90 hover:bg-pink-500 text-white font-heading font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        <span>Stop Scan</span>
                      </button>
                    )}
                  </div>

                  <p className="font-hand text-[10px] text-gray-400">
                    Keep your face centered and stay still :)
                  </p>
                </div>

              </div>
            </div>
          )}

        </div>

        {/* ================= RIGHT COLUMN: CAMERA STATUS & STATUE DUDE ================= */}
        <div 
          className="w-[20%] xl:w-[22%] h-full flex flex-col justify-between items-end py-4 lg:py-6 relative z-20 pointer-events-auto parallax-layer"
          style={{
            transform: `translate3d(${rightOffset.x}px, ${rightOffset.y}px, 0)`,
          }}
        >
          
          {/* Top-Right: CAMERA STATUS Stamp-Edged Card */}
          <div 
            className="relative max-w-[155px] sm:max-w-[170px] lg:max-w-[185px] cursor-pointer hover:scale-105 transition-transform"
            style={{
              transform: `perspective(800px) rotateX(${rightTilt.rotateX}deg) rotateY(${rightTilt.rotateY}deg)`,
            }}
            onClick={() => sound.playClick()}
          >
            <img
              src={cameraCardImg}
              alt="Camera Status"
              className="w-full h-auto object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.35)]"
            />
          </div>

          {/* Middle Right "Almost there!" Badge */}
          <div className="self-center max-w-[145px] sm:max-w-[160px] lg:max-w-[175px] my-1 transform -rotate-3 hover:scale-105 transition-transform">
            <img
              src={almostThereImg}
              alt="Almost there!"
              className="w-full h-auto object-contain drop-shadow-md"
            />
          </div>

          {/* Bottom-Right: Statue Head Artwork with Sunglasses & Pink Splash */}
          <div className="relative flex items-end justify-end w-full max-w-[210px] sm:max-w-[240px] lg:max-w-[270px] xl:max-w-[300px] -mb-6 sm:-mb-8 md:-mb-10 lg:-mb-12 -mr-2 sm:-mr-4 md:-mr-6">
            
            {/* Pink/Yellow Spray Splatter behind Statue Head */}
            <div className="absolute -bottom-4 -right-4 w-44 h-44 bg-gradient-to-tr from-pink-500/40 via-yellow-400/30 to-transparent rounded-full blur-2xl pointer-events-none" />

            {/* Handwritten note to the left of the statue */}
            <div className="absolute -left-16 sm:-left-20 bottom-16 sm:bottom-20 font-marker text-xs sm:text-sm text-gray-900 leading-tight text-right select-none z-20">
              <p className="tracking-wide">NO FILTERS.</p>
              <p className="tracking-wide">JUST</p>
              <div className="flex items-center justify-end gap-1">
                <span className="tracking-wide">CHAOS.</span>
                <span className="font-sans text-xs">:)</span>
              </div>
              {/* Curved doodle arrow pointing to statue */}
              <div className="text-gray-800 text-sm mt-0.5 text-right font-sans font-bold">⤵</div>
            </div>

            {/* Statue Bust Image */}
            <div
              onClick={handleDudeClick}
              title="Click the character!"
              className={`relative cursor-pointer transition-transform duration-200 ${
                dudePunched ? 'animate-punch-recoil' : 'hover:scale-105'
              }`}
              style={{
                transform: `perspective(800px) rotateX(${rightTilt.rotateX}deg) rotateY(${rightTilt.rotateY}deg)`,
              }}
            >
              <img
                src={nextdudeImg}
                alt="Statue Head with Sunglasses"
                className="w-full h-auto max-h-[35vh] sm:max-h-[38vh] lg:max-h-[42vh] object-contain object-right-bottom drop-shadow-2xl"
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
            
            {/* Step 1: Upload Face */}
            <div
              onClick={() => {
                sound.playClick();
                onCancel();
              }}
              className="flex items-center gap-2.5 cursor-pointer group"
            >
              <div className="w-6 h-6 rounded-full bg-pink-500 text-white flex items-center justify-center text-xs font-black shadow-[0_0_10px_rgba(235,47,108,0.7)]">
                ✓
              </div>
              <span className="font-heading font-medium text-xs sm:text-sm text-gray-400 group-hover:text-white transition-colors">
                Upload Face
              </span>
            </div>

            <div className="w-10 sm:w-20 h-0.5 bg-gray-700/80" />

            {/* Step 2: Scan & 3D (Active) */}
            <div className="flex items-center gap-2.5 cursor-pointer group">
              <div className="w-6 h-6 rounded-full bg-pink-500 text-white flex items-center justify-center text-xs font-bold shadow-[0_0_12px_rgba(235,47,108,0.8)]">
                2
              </div>
              <span className="font-heading font-bold text-xs sm:text-sm text-white border-b-2 border-pink-500 pb-0.5 tracking-tight">
                Scan & 3D
              </span>
            </div>

            <div className="w-10 sm:w-20 h-0.5 bg-gray-700/80" />

            {/* Step 3: Smash Lab */}
            <div
              onClick={() => {
                sound.playClick();
                onScanComplete();
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
            <div className="leading-snug text-right">
              <p className="text-gray-300 font-bold">Step 2: Scan & 3D</p>
              <p className="text-gray-500">Gettin' real (in 3D).</p>
            </div>
            <CrownDoodle size={16} color="#94a3b8" />
          </div>

        </div>
      </div>

    </div>
  );
};
