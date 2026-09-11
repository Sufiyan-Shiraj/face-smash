import React, { useState } from 'react';
import { Sliders, Copy, Check, RotateCcw, X, ChevronDown, ChevronUp, Move, Layers } from 'lucide-react';

export interface StageConfig {
  pedestalX: number;     // % of canvas width
  pedestalY: number;     // % of canvas height
  pedestalWidth: number; // px width
  headX: number;         // % of canvas width
  headY: number;         // % of canvas height
  headWidth: number;     // px width
  headAnchorY: number;   // % vertical anchor inside head
}

export const DEFAULT_STAGE_CONFIG: StageConfig = {
  pedestalX: 50,
  pedestalY: 68,
  pedestalWidth: 545,
  headX: 50,
  headY: 55.5,
  headWidth: 230,
  headAnchorY: 52,
};

const STORAGE_KEY = 'face_smash_stage_config_v2';

export const getSavedStageConfig = (): StageConfig => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...DEFAULT_STAGE_CONFIG, ...parsed };
    }
  } catch (e) {}
  return DEFAULT_STAGE_CONFIG;
};

export const saveStageConfig = (config: StageConfig) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {}
};

interface StageControlsProps {
  config: StageConfig;
  onChange: (newConfig: StageConfig) => void;
  onReset?: () => void;
}

export const StageControls: React.FC<StageControlsProps> = ({ config, onChange, onReset }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'pedestal' | 'head'>('all');
  const [copied, setCopied] = useState(false);

  const updateField = (field: keyof StageConfig, value: number) => {
    const newConfig = {
      ...config,
      [field]: value,
    };
    saveStageConfig(newConfig);
    onChange(newConfig);
  };

  const handleCopy = () => {
    const text = JSON.stringify(config, null, 2);
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleReset = () => {
    if (onReset) {
      onReset();
    } else {
      onChange(DEFAULT_STAGE_CONFIG);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-14 right-4 z-50 bg-[#111827]/90 hover:bg-[#1f2937] text-yellow-400 hover:text-yellow-300 font-mono text-xs font-bold px-3.5 py-2 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.6)] border border-yellow-500/40 flex items-center gap-2 backdrop-blur-md transition-all cursor-pointer hover:scale-105 active:scale-95"
      >
        <Sliders size={15} className="text-pink-500 animate-spin-slow" />
        <span>Stage Tuner</span>
      </button>
    );
  }

  return (
    <div className="fixed top-20 left-4 z-50 w-80 max-h-[calc(100vh-120px)] bg-[#0b0f19]/95 text-gray-100 rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.1)] border border-pink-500/30 backdrop-blur-xl flex flex-col overflow-hidden animate-fade-in font-sans">
      
      {/* Header */}
      <div className="px-3.5 py-2.5 bg-gradient-to-r from-pink-950/60 to-purple-950/60 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-lg bg-pink-500/20 text-pink-400">
            <Sliders size={14} />
          </div>
          <div>
            <div className="font-heading font-black text-xs text-white tracking-wider flex items-center gap-1.5">
              <span>STAGE TUNER</span>
              <span className="text-[9px] bg-yellow-400 text-black px-1 rounded font-bold">LIVE</span>
            </div>
            <div className="text-[9px] text-gray-400 font-mono">Real-time positioning</div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            title="Copy Config JSON"
            className="p-1.5 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-lg transition-colors cursor-pointer text-[10px] flex items-center gap-1"
          >
            {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
            <span className="font-mono text-[9px]">{copied ? 'Copied' : 'Copy'}</span>
          </button>

          <button
            onClick={handleReset}
            title="Reset to default positions"
            className="p-1.5 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-yellow-400 rounded-lg transition-colors cursor-pointer"
          >
            <RotateCcw size={12} />
          </button>

          <button
            onClick={() => setIsOpen(false)}
            title="Minimize"
            className="p-1.5 bg-white/5 hover:bg-rose-500/20 text-gray-400 hover:text-rose-300 rounded-lg transition-colors cursor-pointer"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-2.5 py-1.5 bg-black/40 border-b border-white/5 text-[10px] font-mono">
        <button
          onClick={() => setActiveTab('all')}
          className={`flex-1 py-1 rounded-md transition-all cursor-pointer font-bold ${
            activeTab === 'all' ? 'bg-pink-500 text-white shadow-sm' : 'text-gray-400 hover:text-white'
          }`}
        >
          ALL
        </button>
        <button
          onClick={() => setActiveTab('pedestal')}
          className={`flex-1 py-1 rounded-md transition-all cursor-pointer font-bold ${
            activeTab === 'pedestal' ? 'bg-pink-500 text-white shadow-sm' : 'text-gray-400 hover:text-white'
          }`}
        >
          🏛️ STAND
        </button>
        <button
          onClick={() => setActiveTab('head')}
          className={`flex-1 py-1 rounded-md transition-all cursor-pointer font-bold ${
            activeTab === 'head' ? 'bg-pink-500 text-white shadow-sm' : 'text-gray-400 hover:text-white'
          }`}
        >
          🗿 HEAD
        </button>
      </div>

      {/* Sliders Container */}
      <div className="p-3 space-y-3 overflow-y-auto max-h-[calc(100vh-220px)] scrollbar-thin scrollbar-thumb-gray-800 text-[11px] font-mono">
        
        {/* SECTION 1: PEDESTAL STAND */}
        {(activeTab === 'all' || activeTab === 'pedestal') && (
          <div className="bg-white/[0.03] p-2.5 rounded-xl border border-white/5 space-y-2">
            <div className="flex items-center justify-between text-yellow-400 font-bold text-[10px] uppercase tracking-wider">
              <span>🏛️ Pedestal Base</span>
              <span className="text-gray-500 font-normal">{config.pedestalWidth}px</span>
            </div>

            {/* Pedestal X */}
            <div className="space-y-0.5">
              <div className="flex justify-between text-gray-300 text-[10px]">
                <span>X Center</span>
                <span className="text-pink-400 font-bold">{config.pedestalX}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="90"
                step="0.5"
                value={config.pedestalX}
                onChange={(e) => updateField('pedestalX', parseFloat(e.target.value))}
                className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-yellow-400"
              />
            </div>

            {/* Pedestal Y */}
            <div className="space-y-0.5">
              <div className="flex justify-between text-gray-300 text-[10px]">
                <span>Y Center (Table Alignment)</span>
                <span className="text-pink-400 font-bold">{config.pedestalY}%</span>
              </div>
              <input
                type="range"
                min="20"
                max="95"
                step="0.5"
                value={config.pedestalY}
                onChange={(e) => updateField('pedestalY', parseFloat(e.target.value))}
                className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-yellow-400"
              />
            </div>

            {/* Pedestal Width */}
            <div className="space-y-0.5">
              <div className="flex justify-between text-gray-300 text-[10px]">
                <span>Width Scale</span>
                <span className="text-pink-400 font-bold">{config.pedestalWidth}px</span>
              </div>
              <input
                type="range"
                min="150"
                max="750"
                step="5"
                value={config.pedestalWidth}
                onChange={(e) => updateField('pedestalWidth', parseInt(e.target.value))}
                className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-yellow-400"
              />
            </div>
          </div>
        )}

        {/* SECTION 2: HEAD / BUST */}
        {(activeTab === 'all' || activeTab === 'head') && (
          <div className="bg-white/[0.03] p-2.5 rounded-xl border border-white/5 space-y-2">
            <div className="flex items-center justify-between text-cyan-400 font-bold text-[10px] uppercase tracking-wider">
              <span>🗿 Target Head / Bust</span>
              <span className="text-gray-500 font-normal">{config.headWidth}px</span>
            </div>

            {/* Head X */}
            <div className="space-y-0.5">
              <div className="flex justify-between text-gray-300 text-[10px]">
                <span>X Center</span>
                <span className="text-pink-400 font-bold">{config.headX}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="90"
                step="0.5"
                value={config.headX}
                onChange={(e) => updateField('headX', parseFloat(e.target.value))}
                className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>

            {/* Head Y */}
            <div className="space-y-0.5">
              <div className="flex justify-between text-gray-300 text-[10px]">
                <span>Y Center</span>
                <span className="text-pink-400 font-bold">{config.headY}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="90"
                step="0.5"
                value={config.headY}
                onChange={(e) => updateField('headY', parseFloat(e.target.value))}
                className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>

            {/* Head Width */}
            <div className="space-y-0.5">
              <div className="flex justify-between text-gray-300 text-[10px]">
                <span>Head Width</span>
                <span className="text-pink-400 font-bold">{config.headWidth}px</span>
              </div>
              <input
                type="range"
                min="100"
                max="500"
                step="5"
                value={config.headWidth}
                onChange={(e) => updateField('headWidth', parseInt(e.target.value))}
                className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>

            {/* Head Vertical Anchor Offset */}
            <div className="space-y-0.5">
              <div className="flex justify-between text-gray-300 text-[10px]">
                <span>Anchor Y Offset</span>
                <span className="text-pink-400 font-bold">{config.headAnchorY}%</span>
              </div>
              <input
                type="range"
                min="20"
                max="80"
                step="1"
                value={config.headAnchorY}
                onChange={(e) => updateField('headAnchorY', parseInt(e.target.value))}
                className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>
          </div>
        )}

      </div>

      {/* Footer Info */}
      <div className="px-3 py-1.5 bg-black/60 border-t border-white/5 flex items-center justify-between text-[9px] text-gray-400 font-mono">
        <span>Click 📋 Copy when satisfied!</span>
        <button
          onClick={() => {
            // Quick align: center head with pedestal
            onChange({
              ...config,
              headX: config.pedestalX,
            });
          }}
          className="text-pink-400 hover:text-pink-300 font-bold underline cursor-pointer"
        >
          Align X Center
        </button>
      </div>

    </div>
  );
};
