import React, { useState, useEffect } from 'react';
import { PaintbrushNav } from './components/PaintbrushNav';
import { UploadView } from './components/UploadView';
import { ScanView } from './components/ScanView';
import { SmashLabView } from './components/SmashLabView';
import { Modals, ModalType } from './components/Modals';
import { sound } from './utils/audio';

export type ViewState = 'upload' | 'scan' | 'smash';

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>('smash');
  const [soundMuted, setSoundMuted] = useState(false);
  const [uploadedFaceUrl, setUploadedFaceUrl] = useState<string>('/assets/face_front.png');
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === '1') setCurrentView('upload');
      if (e.key === '2') setCurrentView('scan');
      if (e.key === '3') setCurrentView('smash');
      if (e.key === 'm' || e.key === 'M') {
        const muted = sound.toggleMute();
        setSoundMuted(muted);
      }
      if (e.key === 'Escape') {
        setActiveModal(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleToggleSound = () => {
    const muted = sound.toggleMute();
    setSoundMuted(muted);
  };

  const handleStartScan = (file?: File) => {
    if (file) {
      const url = URL.createObjectURL(file);
      setUploadedFaceUrl(url);
    }
    setCurrentView('scan');
  };

  return (
    <div className="h-screen w-screen overflow-hidden font-sans select-none antialiased bg-[#080b11] relative">
      {/* Top Paintbrush Stroke Navbar floating on top */}
      <div className="absolute top-0 left-0 w-full z-40 pointer-events-auto">
        <PaintbrushNav
          currentView={currentView}
          onNavigate={(view) => setCurrentView(view)}
          soundMuted={soundMuted}
          onToggleSound={handleToggleSound}
        />
      </div>

      {/* Screen Views (Strictly 100vh with zero scroll, backgrounds extend to top) */}
      <main className="w-full h-full overflow-hidden relative">
        {currentView === 'upload' && (
          <UploadView
            onStartScan={handleStartScan}
            onNavigateToSmash={() => setCurrentView('smash')}
          />
        )}

        {currentView === 'scan' && (
          <ScanView
            uploadedFaceUrl={uploadedFaceUrl}
            onScanComplete={() => setCurrentView('smash')}
            onCancel={() => setCurrentView('upload')}
          />
        )}

        {currentView === 'smash' && (
          <SmashLabView
            uploadedFaceUrl={uploadedFaceUrl}
            onBackToUpload={() => setCurrentView('upload')}
          />
        )}
      </main>

      {/* Global Modals (Achievements, Leaderboard, Settings, How it Works) */}
      <Modals
        activeModal={activeModal}
        onClose={() => setActiveModal(null)}
        soundMuted={soundMuted}
        onToggleSound={handleToggleSound}
      />
    </div>
  );
};

export default App;
