import React, { useState, useCallback, useRef } from 'react';

// ============================================================================
// GESTURE TUTORIAL - Contextual Interactive Learning
// Each step = real app scenario (volume slider, OTT panels, grid zoom, etc.)
// ============================================================================

const TUTORIAL_DONE_KEY = 'ninja_tutorial_done';

export const isTutorialDone = () => {
  try { return localStorage.getItem(TUTORIAL_DONE_KEY) === 'true'; } catch { return false; }
};
export const setTutorialDone = () => {
  try { localStorage.setItem(TUTORIAL_DONE_KEY, 'true'); } catch {}
};
export const resetTutorial = () => {
  try { localStorage.removeItem(TUTORIAL_DONE_KEY); } catch {}
};

const getAngle = (t1, t2) => Math.atan2(t2.pageY - t1.pageY, t2.pageX - t1.pageX) * 180 / Math.PI;

// ============================================================================
// STEPS — Each with real app context
// ============================================================================
const GESTURES = [
  {
    id: 'volume',
    name: 'Volume Control',
    description: 'Slide 2 fingers up to raise volume',
    fingers: 2,
    icon: '🔊',
    scene: 'volume',
  },
  {
    id: 'grid_zoom_out',
    name: 'More Thumbnails',
    description: 'Pinch 2 fingers to see more items per row',
    fingers: 2,
    icon: '🔍',
    scene: 'grid_pinch',
  },
  {
    id: 'grid_zoom_in',
    name: 'Bigger Thumbnails',
    description: 'Spread 2 fingers to enlarge items',
    fingers: 2,
    icon: '🖼️',
    scene: 'grid_spread',
  },
  {
    id: 'rotate_right',
    name: 'Next Channel',
    description: 'Rotate 2 fingers clockwise',
    fingers: 2,
    icon: '📺',
    scene: 'channel_next',
  },
  {
    id: 'rotate_left',
    name: 'Previous Channel',
    description: 'Rotate 2 fingers counter-clockwise',
    fingers: 2,
    icon: '📺',
    scene: 'channel_prev',
  },
  {
    id: 'ott_open',
    name: 'Open OTT Panels',
    description: 'Swipe 3 fingers right to open OTTLeft + OTTRight',
    fingers: 3,
    icon: '📂',
    scene: 'ott_open',
  },
  {
    id: 'ott_close',
    name: 'Close OTT Panels',
    description: 'Swipe 3 fingers left to close the panels',
    fingers: 3,
    icon: '✖️',
    scene: 'ott_close',
  },
];

// ============================================================================
// SCENE COMPONENTS — Visual mock-ups of the real app
// ============================================================================

const VolumeScene = ({ progress }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
    <div style={{ width: '6px', height: '140px', borderRadius: '3px', background: 'rgba(255,255,255,0.12)', position: 'relative', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', bottom: 0, width: '100%',
        height: `${Math.min(100, progress)}%`,
        borderRadius: '3px',
        background: 'linear-gradient(to top, #6225ff, #a855f7)',
        transition: 'height 0.1s',
      }} />
    </div>
    <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>{Math.round(progress)}%</span>
  </div>
);

const GridScene = ({ columns }) => (
  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: '4px', width: '160px' }}>
    {Array.from({ length: columns * 2 }, (_, i) => (
      <div key={i} style={{
        aspectRatio: '16/9', borderRadius: '4px',
        background: `linear-gradient(135deg, rgba(98,37,255,${0.2 + i * 0.05}), rgba(168,85,247,${0.15 + i * 0.03}))`,
        border: '1px solid rgba(255,255,255,0.08)',
      }} />
    ))}
  </div>
);

const ChannelScene = ({ channel }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
    <div style={{
      width: '180px', height: '100px', borderRadius: '8px',
      background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.1)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <span style={{ fontSize: '32px', fontWeight: 900, color: '#6225ff' }}>{channel}</span>
    </div>
    <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>CH {channel}</span>
  </div>
);

const OTTScene = ({ open }) => (
  <div style={{ width: '200px', height: '120px', borderRadius: '8px', background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.1)', position: 'relative', overflow: 'hidden' }}>
    {/* OTTLeft */}
    <div style={{
      position: 'absolute', top: 0, bottom: 0, left: 0, width: '50px',
      background: 'rgba(98,37,255,0.2)', borderRight: '1px solid rgba(255,255,255,0.1)',
      transform: open ? 'translateX(0)' : 'translateX(-100%)',
      transition: 'transform 0.4s cubic-bezier(0.16,1,0.3,1)',
    }}>
      <div style={{ padding: '6px 4px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ height: '8px', borderRadius: '2px', background: 'rgba(255,255,255,0.15)' }} />
        ))}
      </div>
    </div>
    {/* OTTRight */}
    <div style={{
      position: 'absolute', top: 0, bottom: 0, right: 0, width: '80px',
      background: 'rgba(98,37,255,0.15)', borderLeft: '1px solid rgba(255,255,255,0.1)',
      transform: open ? 'translateX(0)' : 'translateX(100%)',
      transition: 'transform 0.4s cubic-bezier(0.16,1,0.3,1)',
    }}>
      <div style={{ padding: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ height: '6px', width: '60%', borderRadius: '2px', background: 'rgba(255,255,255,0.2)' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px' }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{ aspectRatio: '16/9', borderRadius: '2px', background: 'rgba(255,255,255,0.1)' }} />
          ))}
        </div>
      </div>
    </div>
    {/* Center label */}
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>
        {open ? 'OTT OPEN' : 'VIDEO'}
      </span>
    </div>
  </div>
);

// ============================================================================
// FINGER HINT — Shows how many fingers to use
// ============================================================================
const FingerHint = ({ count, animation }) => {
  const dots = Array.from({ length: count });
  return (
    <div style={{ display: 'flex', gap: count === 3 ? '8px' : '12px', animation: animation || 'none' }}>
      {dots.map((_, i) => (
        <div key={i} style={{
          width: count === 3 ? '24px' : '28px',
          height: count === 3 ? '24px' : '28px',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.7)',
          boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
        }} />
      ))}
    </div>
  );
};

// ============================================================================
// MAIN TUTORIAL
// ============================================================================
const GestureTutorial = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSuccess, setIsSuccess] = useState(false);
  const [volumeProgress, setVolumeProgress] = useState(30);
  const [gridCols, setGridCols] = useState(3);
  const [channelNum, setChannelNum] = useState(42);
  const [ottOpen, setOttOpen] = useState(false);
  const [touchData, setTouchData] = useState({ startY: 0, startX: 0, startDistance: 0, startAngle: 0, fingerCount: 0 });

  const containerRef = useRef(null);
  const currentGesture = GESTURES[currentStep];
  const progress = ((currentStep) / GESTURES.length) * 100;

  const handleSuccess = useCallback(() => {
    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      if (currentStep < GESTURES.length - 1) {
        setCurrentStep(prev => prev + 1);
        // Reset scenes for next step
        setVolumeProgress(30);
        setGridCols(3);
        setChannelNum(42);
        setOttOpen(false);
      } else {
        setTutorialDone();
        onComplete?.();
      }
    }, 800);
  }, [currentStep, onComplete]);

  // ========================================
  // TOUCH HANDLERS
  // ========================================
  const handleTouchStart = useCallback((e) => {
    const touches = e.touches;
    setTouchData({
      fingerCount: touches.length,
      startY: touches.length > 0 ? touches[0].pageY : 0,
      startX: touches.length > 0 ? touches[0].pageX : 0,
      startDistance: touches.length >= 2
        ? Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY)
        : 0,
      startAngle: touches.length >= 2
        ? getAngle(touches[0], touches[1])
        : 0,
    });
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (isSuccess) return;
    const touches = e.touches;
    const gesture = currentGesture;

    // 2-finger gestures
    if (touches.length === 2 && touchData.startDistance > 0) {
      const currentDistance = Math.hypot(
        touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY
      );
      const currentAngle = getAngle(touches[0], touches[1]);
      const distanceDelta = currentDistance - touchData.startDistance;
      let angleDelta = currentAngle - touchData.startAngle;
      if (angleDelta > 180) angleDelta -= 360;
      if (angleDelta < -180) angleDelta += 360;

      // Volume (2 finger vertical)
      if (gesture.id === 'volume') {
        const centerY = (touches[0].pageY + touches[1].pageY) / 2;
        const deltaY = touchData.startY - centerY;
        if (Math.abs(deltaY) > 30) {
          setVolumeProgress(prev => Math.max(0, Math.min(100, prev + (deltaY > 0 ? 5 : -5))));
          if (Math.abs(deltaY) > 80) handleSuccess();
        }
      }

      // Pinch → grid zoom out
      if (gesture.id === 'grid_zoom_out' && distanceDelta < -40) {
        setGridCols(5);
        handleSuccess();
      }

      // Spread → grid zoom in
      if (gesture.id === 'grid_zoom_in' && distanceDelta > 40) {
        setGridCols(2);
        handleSuccess();
      }

      // Rotate right → next channel
      if (gesture.id === 'rotate_right' && angleDelta > 25) {
        setChannelNum(prev => prev + 1);
        handleSuccess();
      }

      // Rotate left → prev channel
      if (gesture.id === 'rotate_left' && angleDelta < -25) {
        setChannelNum(prev => prev - 1);
        handleSuccess();
      }
    }

    // 3-finger gestures
    if (touches.length === 3 && touchData.fingerCount === 3) {
      const centerX = (touches[0].pageX + touches[1].pageX + touches[2].pageX) / 3;
      const deltaX = centerX - touchData.startX;

      // OTT open (swipe right)
      if (gesture.id === 'ott_open' && deltaX > 60) {
        setOttOpen(true);
        handleSuccess();
      }

      // OTT close (swipe left)
      if (gesture.id === 'ott_close' && deltaX < -60) {
        setOttOpen(false);
        handleSuccess();
      }
    }
  }, [currentGesture, touchData, isSuccess, handleSuccess]);

  const handleTouchEnd = useCallback(() => {
    setTouchData({ startY: 0, startX: 0, startDistance: 0, startAngle: 0, fingerCount: 0 });
  }, []);

  const handleSkip = useCallback(() => {
    setTutorialDone();
    onComplete?.();
  }, [onComplete]);

  // ========================================
  // SCENE RENDERER
  // ========================================
  const renderScene = () => {
    switch (currentGesture.scene) {
      case 'volume':
        return <VolumeScene progress={volumeProgress} />;
      case 'grid_pinch':
        return <GridScene columns={gridCols} />;
      case 'grid_spread':
        return <GridScene columns={gridCols} />;
      case 'channel_next':
      case 'channel_prev':
        return <ChannelScene channel={channelNum} />;
      case 'ott_open':
        return <OTTScene open={ottOpen} />;
      case 'ott_close':
        // Start with panels open for close gesture
        if (!ottOpen && currentGesture.id === 'ott_close') setOttOpen(true);
        return <OTTScene open={ottOpen} />;
      default:
        return null;
    }
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[100] flex flex-col"
      style={{ background: 'linear-gradient(180deg, #0a0a0f 0%, #1a1a2f 100%)' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-2" style={{ flexShrink: 0 }}>
        <div className="flex items-baseline">
          <span className="text-white font-black text-lg">NINJA</span>
          <span className="font-black text-lg ml-1" style={{ color: '#6225ff' }}>8K</span>
        </div>
        {/* Progress bar inline */}
        <div className="flex-1 mx-6">
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #6225ff, #8b5cf6)' }}
            />
          </div>
        </div>
        <span className="text-gray-500 text-xs mr-4">{currentStep + 1} / {GESTURES.length}</span>
        <button onClick={handleSkip} className="px-3 py-1 text-gray-400 text-sm">Skip</button>
      </div>

      {/* Main content — landscape row */}
      <div className="flex-1 flex items-center justify-center px-8 gap-10" style={{ minHeight: 0 }}>
        {isSuccess ? (
          <div className="flex flex-col items-center animate-pulse">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mb-4"
              style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}
            >
              <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p className="text-green-400 text-lg font-bold">Perfect!</p>
          </div>
        ) : (
          <>
            {/* Left: Scene mockup */}
            <div
              className="rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{
                width: '280px', height: '180px',
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {renderScene()}
            </div>

            {/* Right: Info + finger hint */}
            <div className="flex flex-col items-center justify-center" style={{ maxWidth: '300px' }}>
              <h2 className="text-white text-xl font-bold mb-1">{currentGesture.name}</h2>
              <p className="text-gray-400 text-center text-sm mb-4">{currentGesture.description}</p>

              {/* Finger hint */}
              <div
                className="w-full h-16 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.15)' }}
              >
                <FingerHint count={currentGesture.fingers} />
              </div>

              <p className="text-gray-600 text-xs mt-3 text-center">
                Perform the gesture anywhere on screen
              </p>
            </div>
          </>
        )}
      </div>

      {/* Dots */}
      <div className="flex justify-center gap-2 pb-4" style={{ flexShrink: 0 }}>
        {GESTURES.map((_, index) => (
          <div
            key={index}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              index < currentStep
                ? 'bg-green-500'
                : index === currentStep
                  ? 'bg-purple-500 w-4'
                  : 'bg-white/20'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default GestureTutorial;
