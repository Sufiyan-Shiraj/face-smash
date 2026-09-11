import React, { useRef, useEffect, useState, useCallback } from 'react';
import { sound } from '../utils/audio';

interface Point3D {
  x: number;
  y: number;
  z: number;
  baseColor: string;
  size: number;
  origX: number;
  origY: number;
  origZ: number;
}

interface ScanMeshCanvasProps {
  progress?: number;
  onMeshClick?: () => void;
  interactive?: boolean;
}

export const ScanMeshCanvas: React.FC<ScanMeshCanvasProps> = ({
  progress = 72,
  onMeshClick,
  interactive = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0, isHovered: false });
  const glitchRef = useRef(0);
  const [telemetry, setTelemetry] = useState({
    depth: '8.76',
    points: 48732,
    fps: 60,
  });

  // Generate 3D point cloud face model
  const pointsRef = useRef<Point3D[]>([]);

  useEffect(() => {
    const pts: Point3D[] = [];

    // Head base ellipsoid
    const latSteps = 28;
    const lonSteps = 32;
    for (let i = 0; i <= latSteps; i++) {
      const lat = ((i / latSteps) - 0.5) * Math.PI * 0.96;
      const r = Math.cos(lat);
      const y = -Math.sin(lat) * 115;

      for (let j = 0; j <= lonSteps; j++) {
        // Front hemisphere focus (face + temples)
        const lon = ((j / lonSteps) - 0.5) * Math.PI * 1.15;
        const x = Math.sin(lon) * r * 82;
        let z = Math.cos(lon) * r * 82;

        // Facial features displacement
        const isFaceFront = z > 15;

        // Nose ridge & tip protrusion
        if (isFaceFront && Math.abs(x) < 20 && y > -18 && y < 38) {
          const noseDist = Math.hypot(x, y - 10);
          z += Math.max(0, (30 - noseDist) * 1.25);
        }

        // Eye sockets depression
        if (isFaceFront && Math.abs(Math.abs(x) - 27) < 18 && Math.abs(y + 16) < 14) {
          z -= 14;
        }

        // Forehead brow ridge
        if (isFaceFront && Math.abs(y + 28) < 8 && Math.abs(x) < 45) {
          z += 6;
        }

        // Cheekbones
        if (isFaceFront && Math.abs(x) > 22 && Math.abs(x) < 58 && y > 2 && y < 36) {
          z += 12;
        }

        // Lips contour
        if (isFaceFront && Math.abs(x) < 24 && y > 38 && y < 60) {
          z += Math.cos(((y - 49) / 11) * Math.PI * 0.5) * 14;
        }

        // Chin protrusion
        if (isFaceFront && Math.abs(x) < 28 && y > 62 && y < 92) {
          z += (88 - y) * 0.65;
        }

        // Neck contour
        if (y > 90) {
          z *= 0.62;
        }

        // Point coloring: pink / yellow / golden gradient
        const isFeature = isFaceFront && y > -30 && y < 78;
        const color = isFeature
          ? y < 10
            ? '#fb7185'
            : y < 45
            ? '#facc15'
            : '#f43f5e'
          : '#ec4899';

        pts.push({
          x,
          y,
          z,
          origX: x,
          origY: y,
          origZ: z,
          baseColor: color,
          size: isFeature ? 2.3 : 1.6,
        });
      }
    }

    // Additional dense feature rings for eyes, nose, and lips
    for (let a = 0; a < Math.PI * 2; a += 0.28) {
      // Left eye outline
      const leX = -27 + Math.cos(a) * 13;
      const leY = -16 + Math.sin(a) * 7;
      pts.push({ x: leX, y: leY, z: 30, origX: leX, origY: leY, origZ: 30, baseColor: '#fef08a', size: 2.2 });

      // Right eye outline
      const reX = 27 + Math.cos(a) * 13;
      const reY = -16 + Math.sin(a) * 7;
      pts.push({ x: reX, y: reY, z: 30, origX: reX, origY: reY, origZ: 30, baseColor: '#fef08a', size: 2.2 });

      // Lips outline
      const lpX = Math.cos(a) * 20;
      const lpY = 49 + Math.sin(a) * 8;
      pts.push({ x: lpX, y: lpY, z: 36, origX: lpX, origY: lpY, origZ: 36, baseColor: '#fb7185', size: 2.2 });
    }

    pointsRef.current = pts;
  }, []);

  // Mouse move listener for smooth 3D rotation
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    mouseRef.current.targetX = ((e.clientX - cx) / (rect.width / 2)) * 0.55;
    mouseRef.current.targetY = ((e.clientY - cy) / (rect.height / 2)) * 0.4;
    mouseRef.current.isHovered = true;
  }, []);

  const handleMouseLeave = useCallback(() => {
    mouseRef.current.targetX = 0;
    mouseRef.current.targetY = 0;
    mouseRef.current.isHovered = false;
  }, []);

  const handleClick = () => {
    sound.playClick();
    glitchRef.current = 1.0;
    if (onMeshClick) onMeshClick();
  };

  // Live percentage calibration fluctuations (e.g. continuous calibration between 65% and 95%)
  const [livePercent, setLivePercent] = useState(72);

  useEffect(() => {
    const interval = setInterval(() => {
      setLivePercent(() => {
        const t = Date.now() / 1400;
        const base = 78 + Math.sin(t) * 13;
        const jitter = (Math.random() - 0.5) * 5;
        return Math.round(Math.max(62, Math.min(97, base + jitter)));
      });
    }, 250);
    return () => clearInterval(interval);
  }, []);

  const displayPercent = progress !== 72 ? progress : livePercent;

  // Live telemetry fluctuations
  useEffect(() => {
    const interval = setInterval(() => {
      setTelemetry({
        depth: (8.70 + Math.random() * 0.12).toFixed(2),
        points: 48732 + Math.floor(Math.random() * 24 - 12),
        fps: 59 + Math.floor(Math.random() * 2),
      });
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // 3D Canvas Rendering Loop
  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let time = 0;

    const render = () => {
      time += 0.035;
      const cw = canvas.width;
      const ch = canvas.height;
      const centerX = cw * 0.5;
      const centerY = ch * 0.5;

      ctx.clearRect(0, 0, cw, ch);

      // Smooth mouse lerp
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.08;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.08;

      // Rotation angles (idle breathing oscillation + mouse tracking)
      const yaw = mouseRef.current.x + Math.sin(time * 0.65) * 0.14;
      const pitch = mouseRef.current.y + Math.cos(time * 0.5) * 0.07;
      const fov = 340;

      // Scanning laser plane height sweep
      const laserY = Math.sin(time * 1.4) * 88;

      // Glitch decay
      if (glitchRef.current > 0.01) {
        glitchRef.current *= 0.91;
      } else {
        glitchRef.current = 0;
      }
      const glitch = glitchRef.current;

      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);
      const cosP = Math.cos(pitch);
      const sinP = Math.sin(pitch);

      // Transform and sort points by depth (painter's algorithm)
      const projected = pointsRef.current.map((pt) => {
        let px0 = pt.origX;
        let py0 = pt.origY;
        let pz0 = pt.origZ;

        if (glitch > 0) {
          px0 += (Math.random() - 0.5) * glitch * 22;
          py0 += (Math.random() - 0.5) * glitch * 15;
          pz0 += (Math.random() - 0.5) * glitch * 25;
        }

        // Rotate around Y (yaw)
        const x1 = px0 * cosY - pz0 * sinY;
        const z1 = px0 * sinY + pz0 * cosY;

        // Rotate around X (pitch)
        const y2 = py0 * cosP - z1 * sinP;
        const z2 = py0 * sinP + z1 * cosP;

        // Perspective projection
        const scale = fov / (fov + z2 + 80);
        const px = centerX + x1 * scale;
        const py = centerY + y2 * scale;

        // Distance from laser sweep line
        const distToLaser = Math.abs(y2 - laserY);
        const isLaserHit = distToLaser < 14;

        return {
          px,
          py,
          z: z2,
          scale,
          color: isLaserHit ? '#ffffff' : pt.baseColor,
          size: (isLaserHit ? pt.size * 1.85 : pt.size) * scale,
          alpha: Math.max(0.2, Math.min(1, (z2 + 100) / 180)),
          isLaserHit,
        };
      });

      projected.sort((a, b) => b.z - a.z);

      // Draw subtle connecting mesh lines
      ctx.lineWidth = 0.55;
      for (let i = 0; i < projected.length; i += 3) {
        const p1 = projected[i];
        const p2 = projected[i + 1];
        if (p2 && Math.hypot(p1.px - p2.px, p1.py - p2.py) < 32) {
          ctx.strokeStyle = `rgba(235, 47, 108, ${p1.alpha * 0.28})`;
          ctx.beginPath();
          ctx.moveTo(p1.px, p1.py);
          ctx.lineTo(p2.px, p2.py);
          ctx.stroke();
        }
      }

      // Draw glowing points
      for (const p of projected) {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.px, p.py, p.size, 0, Math.PI * 2);
        ctx.fill();

        if (p.isLaserHit) {
          ctx.fillStyle = 'rgba(250, 204, 21, 0.7)';
          ctx.beginPath();
          ctx.arc(p.px, p.py, p.size * 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.globalAlpha = 1.0;

      // Draw horizontal laser sweep line
      const laserScreenY = centerY + laserY * (fov / (fov + 80));
      const grad = ctx.createLinearGradient(centerX - 135, laserScreenY, centerX + 135, laserScreenY);
      grad.addColorStop(0, 'rgba(235, 47, 108, 0)');
      grad.addColorStop(0.18, 'rgba(235, 47, 108, 0.85)');
      grad.addColorStop(0.5, 'rgba(255, 255, 255, 1)');
      grad.addColorStop(0.82, 'rgba(250, 204, 21, 0.85)');
      grad.addColorStop(1, 'rgba(250, 204, 21, 0)');

      ctx.strokeStyle = grad;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(centerX - 135, laserScreenY);
      ctx.lineTo(centerX + 135, laserScreenY);
      ctx.stroke();

      // Laser lens flare center
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.beginPath();
      ctx.arc(centerX + Math.sin(time * 2.2) * 35, laserScreenY, 3.5, 0, Math.PI * 2);
      ctx.fill();

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div
      className="relative w-full h-full flex items-center justify-center select-none cursor-pointer group"
      onMouseMove={interactive ? handleMouseMove : undefined}
      onMouseLeave={interactive ? handleMouseLeave : undefined}
      onClick={handleClick}
      title="Hover to rotate 3D mesh • Click to glitch!"
    >
      {/* Background Mask to cleanly shield static print */}
      <div className="absolute inset-2 sm:inset-3 rounded-2xl bg-[#0b0e14] -z-10 shadow-inner" />

      {/* Dynamic 3D Point-Cloud Canvas */}
      <canvas
        ref={canvasRef}
        width={360}
        height={360}
        className="w-full h-full max-w-[270px] max-h-[270px] sm:max-w-[290px] sm:max-h-[290px] object-contain relative z-10"
      />

      {/* Pink Cyber Corner Brackets */}
      <div className="absolute inset-3 sm:inset-5 pointer-events-none z-20">
        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-pink-500 shadow-[0_0_8px_#eb2f6c]" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-pink-500 shadow-[0_0_8px_#eb2f6c]" />
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-pink-500 shadow-[0_0_8px_#eb2f6c]" />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-pink-500 shadow-[0_0_8px_#eb2f6c]" />
      </div>

      {/* Glowing Circular Gauge with Rotating Arc */}
      <div className="absolute inset-4 sm:inset-6 rounded-full border-2 border-pink-500/80 shadow-[0_0_22px_rgba(235,47,108,0.55)] pointer-events-none flex items-center justify-center z-20">
        <svg className="absolute inset-0 w-full h-full animate-spin-slow pointer-events-none" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="48"
            fill="none"
            stroke="#facc15"
            strokeWidth="3.5"
            strokeDasharray={`${Math.round((displayPercent / 100) * 280)} ${Math.round(280 - (displayPercent / 100) * 280)}`}
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Live Percentage Yellow Spray / Brush Badge on Top of Gauge */}
      <div className="absolute top-1 sm:top-2 left-1/2 transform -translate-x-1/2 bg-[#facc15] text-black font-heading font-black text-xs sm:text-sm px-3 py-0.5 rounded shadow-lg -rotate-1 border border-black z-30 tracking-tight transition-all duration-200">
        {displayPercent}%
      </div>

      {/* Live Telemetry Readout on Top Left */}
      <div className="absolute left-3.5 top-6 sm:top-8 text-[8px] sm:text-[9px] font-mono text-gray-300 leading-tight space-y-0.5 text-left pointer-events-none z-20 drop-shadow-md">
        <div className="text-white font-bold text-[10px] tracking-wider">3D SCAN</div>
        <div className="text-gray-400 text-[8px]">v2.4.8</div>
        <div className="pt-2 text-pink-400">DEPTH: {telemetry.depth} m</div>
        <div>POINTS: {telemetry.points.toLocaleString()}</div>
        <div>RES: 1024x1024</div>
        <div className="text-yellow-400">FPS: {telemetry.fps}</div>
      </div>

      {/* Live Audio Equalizer Waveform at Bottom */}
      <div className="absolute bottom-3 sm:bottom-4 left-4 right-4 flex items-center gap-2 text-[8px] sm:text-[9px] font-mono text-gray-300 pointer-events-none z-20">
        <div className="flex items-center gap-0.5 h-3.5">
          {[7, 13, 5, 16, 11, 19, 9, 15, 8, 14, 10, 18, 12, 6, 17].map((h, idx) => (
            <div
              key={idx}
              className="w-0.5 bg-gradient-to-t from-pink-500 to-yellow-300 rounded-full animate-pulse"
              style={{
                height: `${h}px`,
                animationDuration: `${0.35 + (idx % 5) * 0.15}s`,
              }}
            />
          ))}
        </div>
        <span className="text-gray-300 tracking-wider font-semibold">CAPTURING FACIAL DATA...</span>
      </div>
    </div>
  );
};
