import React, { useRef, useEffect } from 'react';
import { sound } from '../utils/audio';

export type WeaponType = 'slap' | 'punch' | 'brick' | 'spoon' | 'spin' | 'banana' | 'dumbbell' | 'chaos';

import nextdudeImg from '../assets/scan/nextdude.png';
import pedestalImg from '../assets/smash/pedestal.png';
import { StageConfig, DEFAULT_STAGE_CONFIG } from './StageControls';

interface SmashCanvasProps {
  activeTool: WeaponType;
  onHit: (weapon: WeaponType, damageAmount: number) => void;
  integrity: number;
  uploadedFaceUrl?: string;
  targetModel?: 'bust' | 'dummy';
  stageConfig?: StageConfig;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
  text?: string;
  isShockwave?: boolean;
}

interface Projectile {
  type: WeaponType;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  progress: number;
  rotation: number;
  scale: number;
}

export const SmashCanvas: React.FC<SmashCanvasProps> = ({
  activeTool,
  onHit,
  integrity,
  uploadedFaceUrl,
  targetModel = 'bust',
  stageConfig = DEFAULT_STAGE_CONFIG,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const projectilesRef = useRef<Projectile[]>([]);
  const stageConfigRef = useRef<StageConfig>(stageConfig);
  stageConfigRef.current = stageConfig;

  const headStateRef = useRef({
    squishX: 1,
    squishY: 1,
    rotation: 0,
    offsetX: 0,
    offsetY: 0,
    spinVelocity: 0,
    bruises: [] as { x: number; y: number; r: number; color: string }[],
  });

  const headImgRef = useRef<HTMLImageElement | null>(null);
  const pedestalImgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const headImg = new Image();
    headImg.src = targetModel === 'dummy' && uploadedFaceUrl ? uploadedFaceUrl : nextdudeImg;
    headImg.onload = () => {
      headImgRef.current = headImg;
    };

    const pedImg = new Image();
    pedImg.src = pedestalImg;
    pedImg.onload = () => {
      pedestalImgRef.current = pedImg;
    };
  }, [uploadedFaceUrl, targetModel]);

  const triggerAttack = (tool: WeaponType) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cfg = stageConfigRef.current;
    const headCenterX = 680 * (cfg.headX / 100);
    const headCenterY = 640 * (cfg.headY / 100);

    let baseDamage = 180;

    switch (tool) {
      case 'slap': {
        sound.playSlap();
        baseDamage = 220;
        headStateRef.current.squishX = 0.82;
        headStateRef.current.squishY = 1.18;
        headStateRef.current.rotation = -0.2;
        headStateRef.current.offsetX = -25;

        projectilesRef.current.push({
          type: 'slap',
          x: 680 * 0.95,
          y: headCenterY,
          targetX: headCenterX,
          targetY: headCenterY,
          progress: 0,
          rotation: -0.4,
          scale: 1.2,
        });
        break;
      }
      case 'punch': {
        sound.playPunch();
        baseDamage = 350;
        headStateRef.current.squishX = 0.74;
        headStateRef.current.squishY = 1.26;
        headStateRef.current.rotation = 0.22;
        headStateRef.current.offsetX = 28;
        break;
      }
      case 'brick': {
        sound.playBrick();
        baseDamage = 450;
        headStateRef.current.squishY = 0.72;
        headStateRef.current.squishX = 1.28;
        projectilesRef.current.push({
          type: 'brick',
          x: 680 * 0.1,
          y: headCenterY - 100,
          targetX: headCenterX,
          targetY: headCenterY - 20,
          progress: 0,
          rotation: 0,
          scale: 1.1,
        });
        break;
      }
      case 'spoon': {
        sound.playSpoon();
        baseDamage = 160;
        headStateRef.current.squishX = 0.9;
        headStateRef.current.squishY = 1.1;
        projectilesRef.current.push({
          type: 'spoon',
          x: 680 * 0.9,
          y: headCenterY - 80,
          targetX: headCenterX,
          targetY: headCenterY,
          progress: 0,
          rotation: 0.8,
          scale: 1.1,
        });
        break;
      }
      case 'spin': {
        sound.playSpin();
        baseDamage = 280;
        headStateRef.current.spinVelocity = 0.6;
        break;
      }
      case 'banana': {
        sound.playSlap();
        baseDamage = 200;
        headStateRef.current.squishX = 1.15;
        headStateRef.current.squishY = 0.88;
        headStateRef.current.rotation = 0.15;
        projectilesRef.current.push({
          type: 'banana',
          x: 680 * 0.1,
          y: headCenterY - 60,
          targetX: headCenterX,
          targetY: headCenterY,
          progress: 0,
          rotation: -0.5,
          scale: 1.2,
        });
        break;
      }
      case 'dumbbell': {
        sound.playBrick();
        baseDamage = 500;
        headStateRef.current.squishY = 0.65;
        headStateRef.current.squishX = 1.35;
        headStateRef.current.offsetY = 30;
        projectilesRef.current.push({
          type: 'dumbbell',
          x: headCenterX,
          y: -50,
          targetX: headCenterX,
          targetY: headCenterY - 40,
          progress: 0,
          rotation: 0,
          scale: 1.3,
        });
        break;
      }
      case 'chaos': {
        sound.playPunch();
        baseDamage = 600;
        headStateRef.current.spinVelocity = 0.9;
        headStateRef.current.squishX = 0.65;
        headStateRef.current.squishY = 1.4;
        [0, 1, 2, 3].forEach((idx) => {
          setTimeout(() => {
            projectilesRef.current.push({
              type: (['brick', 'banana', 'spoon', 'slap'] as WeaponType[])[idx],
              x: (idx % 2 === 0 ? 0 : 680),
              y: headCenterY + (idx - 1.5) * 40,
              targetX: headCenterX,
              targetY: headCenterY,
              progress: 0,
              rotation: idx * 1.5,
              scale: 1.1,
            });
          }, idx * 60);
        });
        break;
      }
    }

    createImpactParticles(headCenterX, headCenterY, tool);

    if (headStateRef.current.bruises.length < 15) {
      headStateRef.current.bruises.push({
        x: headCenterX + (Math.random() * 50 - 25),
        y: headCenterY + (Math.random() * 50 - 25),
        r: Math.random() * 12 + 6,
        color: ['rgba(225, 29, 72, 0.55)', 'rgba(147, 51, 234, 0.45)', 'rgba(37, 99, 235, 0.4)'][Math.floor(Math.random() * 3)],
      });
    }

    onHit(tool, baseDamage + Math.floor(Math.random() * 60));
  };

  const createImpactParticles = (x: number, y: number, tool: WeaponType) => {
    const colors = ['#eb2f6c', '#facc15', '#ffffff', '#38bdf8', '#fb923c', '#4ade80'];

    // Shockwave Ring
    particlesRef.current.push({
      x,
      y,
      vx: 0,
      vy: 0,
      color: tool === 'punch' ? '#eb2f6c' : '#facc15',
      size: 10,
      life: 0,
      maxLife: 20,
      isShockwave: true,
    });

    // Comic Text
    const words = tool === 'slap' ? ['SLAP!!', 'WHACK!'] : tool === 'chaos' ? ['KABOOM!!', 'CHAOS!'] : ['SMACK!!', 'POW!', 'CRUNCH!', 'BAM!'];
    const chosenWord = words[Math.floor(Math.random() * words.length)];

    particlesRef.current.push({
      x: x + (Math.random() * 30 - 15),
      y: y - 70,
      vx: (Math.random() * 2 - 1) * 1.5,
      vy: -2.8,
      color: '#eb2f6c',
      size: 30,
      life: 0,
      maxLife: 35,
      text: chosenWord,
    });

    // Sparks & Stars
    for (let i = 0; i < 22; i++) {
      const angle = (Math.PI * 2 * i) / 22 + (Math.random() * 0.4 - 0.2);
      const speed = Math.random() * 7 + 4;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 7 + 3,
        life: 0,
        maxLife: Math.floor(Math.random() * 20 + 20),
      });
    }
  };

  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const cfg = stageConfigRef.current;
      const headCenterX = 680 * (cfg.headX / 100);
      const headCenterY = 640 * (cfg.headY / 100);

      const state = headStateRef.current;

      if (state.spinVelocity > 0.005) {
        state.rotation += state.spinVelocity;
        state.spinVelocity *= 0.92;
      } else {
        state.rotation *= 0.85;
      }

      state.squishX += (1 - state.squishX) * 0.16;
      state.squishY += (1 - state.squishY) * 0.16;
      state.offsetX *= 0.85;
      state.offsetY *= 0.85;

      // 1. Draw Pedestal Base (Stationary, anchored underneath on the workbench)
      if (pedestalImgRef.current) {
        const pImg = pedestalImgRef.current;
        const pedW = cfg.pedestalWidth;
        const pedH = (pImg.height / pImg.width) * pedW;
        const pedX = 680 * (cfg.pedestalX / 100) - pedW * 0.5;
        const pedY = 640 * (cfg.pedestalY / 100);
        ctx.drawImage(
          pImg,
          pedX,
          pedY,
          pedW,
          pedH
        );
      }

      // 2. Draw Interactive Deformable Head (Sits with neck entering inside collar)
      if (headImgRef.current) {
        ctx.save();
        ctx.translate(headCenterX + state.offsetX, headCenterY + state.offsetY);
        ctx.rotate(state.rotation);
        ctx.scale(state.squishX, state.squishY);

        const img = headImgRef.current;
        const targetW = cfg.headWidth;
        const targetH = (img.height / img.width) * targetW;
        const anchorYRatio = (cfg.headAnchorY || 52) / 100;

        ctx.drawImage(
          img,
          -targetW * 0.5,
          -targetH * anchorYRatio,
          targetW,
          targetH
        );

        // Bruises
        state.bruises.forEach((b) => {
          ctx.beginPath();
          ctx.arc(b.x - headCenterX, b.y - headCenterY, b.r, 0, Math.PI * 2);
          ctx.fillStyle = b.color;
          ctx.fill();
        });

        // Band-Aid on low integrity
        if (integrity < 50) {
          ctx.save();
          ctx.rotate(0.3);
          ctx.fillStyle = '#fde68a';
          ctx.strokeStyle = '#d97706';
          ctx.lineWidth = 2;
          ctx.fillRect(15, -40, 38, 16);
          ctx.strokeRect(15, -40, 38, 16);
          ctx.fillStyle = '#ef4444';
          ctx.font = 'bold 11px sans-serif';
          ctx.fillText('+', 30, -28);
          ctx.restore();
        }

        ctx.restore();
      }

      // 3. Draw Projectiles
      for (let i = projectilesRef.current.length - 1; i >= 0; i--) {
        const p = projectilesRef.current[i];
        p.progress += 0.14;

        const currX = p.x + (p.targetX - p.x) * Math.min(1, p.progress);
        const currY = p.y + (p.targetY - p.y) * Math.min(1, p.progress);

        ctx.save();
        ctx.translate(currX, currY);
        ctx.rotate(p.rotation + p.progress * 5);
        ctx.scale(p.scale, p.scale);

        if (p.type === 'slap') {
          ctx.font = '48px sans-serif';
          ctx.fillText('🖐️', -24, 24);
        } else if (p.type === 'brick') {
          ctx.font = '46px sans-serif';
          ctx.fillText('🧱', -23, 23);
        } else if (p.type === 'spoon') {
          ctx.font = '46px sans-serif';
          ctx.fillText('🥄', -23, 23);
        } else if (p.type === 'banana') {
          ctx.font = '46px sans-serif';
          ctx.fillText('🍌', -23, 23);
        } else if (p.type === 'dumbbell') {
          ctx.font = '50px sans-serif';
          ctx.fillText('🏋️', -25, 25);
        }

        ctx.restore();

        if (p.progress >= 1) {
          projectilesRef.current.splice(i, 1);
        }
      }

      // 4. Draw Particles & Shockwaves
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const pt = particlesRef.current[i];
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.life++;

        const alpha = 1 - pt.life / pt.maxLife;

        ctx.save();
        ctx.globalAlpha = Math.max(0, alpha);

        if (pt.isShockwave) {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, (pt.life / pt.maxLife) * 110 + 10, 0, Math.PI * 2);
          ctx.strokeStyle = pt.color;
          ctx.lineWidth = 3;
          ctx.shadowBlur = 15;
          ctx.shadowColor = pt.color;
          ctx.stroke();
        } else if (pt.text) {
          ctx.font = `900 ${pt.size}px 'Luckiest Guy', Impact, sans-serif`;
          ctx.fillStyle = '#facc15';
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 5;
          ctx.strokeText(pt.text, pt.x, pt.y);
          ctx.fillText(pt.text, pt.x, pt.y);
        } else {
          ctx.fillStyle = pt.color;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();

        if (pt.life >= pt.maxLife) {
          particlesRef.current.splice(i, 1);
        }
      }

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [integrity]);

  return (
    <canvas
      ref={canvasRef}
      width={680}
      height={760}
      onClick={() => triggerAttack(activeTool)}
      className="w-full h-full max-w-[560px] max-h-[620px] object-contain cursor-pointer relative z-40"
      title="Click head to smash!"
    />
  );
};
