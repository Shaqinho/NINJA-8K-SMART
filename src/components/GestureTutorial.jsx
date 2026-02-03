import React, { useState, useCallback, useRef } from 'react';

// ============================================================================
// GESTURE TUTORIAL - Interactive gesture learning
// User must perform each gesture correctly to proceed
// ============================================================================

const TUTORIAL_DONE_KEY = 'ninja_tutorial_done';

// Check if tutorial was already completed
export const isTutorialDone = () => {
  try {
    return localStorage.getItem(TUTORIAL_DONE_KEY) === 'true';
  } catch {
    return false;
  }
};

// Mark tutorial as done
export const setTutorialDone = () => {
  try {
    localStorage.setItem(TUTORIAL_DONE_KEY, 'true');
  } catch {}
};

// Reset tutorial (for testing)
export const resetTutorial = () => {
  try {
    localStorage.removeItem(TUTORIAL_DONE_KEY);
  } catch {}
};

// Calculate angle between two touch points
const getAngle = (touch1, touch2) => {
  return Math.atan2(touch2.pageY - touch1.pageY, touch2.pageX - touch1.pageX) * 180 / Math.PI;
};

// Gesture definitions
const GESTURES = [
  {
    id: 'scroll',
    name: 'Scroll',
    description: 'Swipe up or down',
    fingers: 1,
    icon: '👆',
    animation: 'scroll',
  },
  {
    id: 'tap2',
    name: '2-Finger Tap',
    description: 'Tap with 2 fingers',
    fingers: 2,
    icon: '✌️',
    animation: 'tap2',
  },
  {
    id: 'pinch',
    name: 'Pinch',
    description: 'Pinch with 2 fingers',
    fingers: 2,
    icon: '🤏',
    animation: 'pinch',
  },
  {
    id: 'spread',
    name: 'Spread',
    description: 'Spread with 2 fingers',
    fingers: 2,
    icon: '🖐️',
    animation: 'spread',
  },
  {
    id: 'rotate_right',
    name: 'Rotate Right',
    description: 'Rotate clockwise',
    fingers: 2,
    icon: '🔄',
    animation: 'rotate_right',
  },
  {
    id: 'rotate_left',
    name: 'Rotate Left',
    description: 'Rotate counter-clockwise',
    fingers: 2,
    icon: '🔃',
    animation: 'rotate_left',
  },
  {
    id: 'pinch3',
    name: '3-Finger Pinch',
    description: 'Pinch with 3 fingers → OTT mode',
    fingers: 3,
    icon: '🤌',
    animation: 'pinch3',
  },
  {
    id: 'spread3',
    name: '3-Finger Spread',
    description: 'Spread with 3 fingers → Hub mode',
    fingers: 3,
    icon: '🖐️',
    animation: 'spread3',
  },
];

// Animated hand component
const AnimatedHand = ({ animation, isPaused }) => {
  const getAnimationStyle = () => {
    switch (animation) {
      case 'scroll':
        return {
          animation: isPaused ? 'none' : 'scrollAnim 1.5s ease-in-out infinite',
        };
      case 'tap2':
        return {
          animation: isPaused ? 'none' : 'tap2Anim 1s ease-in-out infinite',
        };
      case 'pinch':
        return {
          animation: isPaused ? 'none' : 'pinchAnim 1.5s ease-in-out infinite',
        };
      case 'spread':
        return {
          animation: isPaused ? 'none' : 'spreadAnim 1.5s ease-in-out infinite',
        };
      case 'rotate_right':
        return {
          animation: isPaused ? 'none' : 'rotateRightAnim 2s ease-in-out infinite',
        };
      case 'rotate_left':
        return {
          animation: isPaused ? 'none' : 'rotateLeftAnim 2s ease-in-out infinite',
        };
      case 'pinch3':
        return {
          animation: isPaused ? 'none' : 'pinch3Anim 1.5s ease-in-out infinite',
        };
      case 'spread3':
        return {
          animation: isPaused ? 'none' : 'spread3Anim 1.5s ease-in-out infinite',
        };
      default:
        return {};
    }
  };

  const renderFingers = () => {
    switch (animation) {
      case 'scroll':
        return (
          <div className="relative" style={getAnimationStyle()}>
            <div className="w-8 h-8 rounded-full bg-white/80 shadow-lg" />
          </div>
        );
      
      case 'tap2':
        return (
          <div className="flex gap-6" style={getAnimationStyle()}>
            <div className="w-8 h-8 rounded-full bg-white/80 shadow-lg" />
            <div className="w-8 h-8 rounded-full bg-white/80 shadow-lg" />
          </div>
        );
      
      case 'pinch':
      case 'spread':
        return (
          <div className="flex gap-4 items-center" style={getAnimationStyle()}>
            <div className="w-8 h-8 rounded-full bg-white/80 shadow-lg finger-left" />
            <div className="w-8 h-8 rounded-full bg-white/80 shadow-lg finger-right" />
          </div>
        );
      
      case 'rotate_right':
      case 'rotate_left':
        return (
          <div className="relative w-24 h-24" style={getAnimationStyle()}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white/80 shadow-lg" />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white/80 shadow-lg" />
          </div>
        );
      
      case 'pinch3':
      case 'spread3':
        return (
          <div className="flex gap-3 items-center" style={getAnimationStyle()}>
            <div className="w-7 h-7 rounded-full bg-white/80 shadow-lg" />
            <div className="w-7 h-7 rounded-full bg-white/80 shadow-lg" />
            <div className="w-7 h-7 rounded-full bg-white/80 shadow-lg" />
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="flex items-center justify-center h-40">
      {renderFingers()}
    </div>
  );
};

// Main tutorial component
const GestureTutorial = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSuccess, setIsSuccess] = useState(false);
  const [touchData, setTouchData] = useState({
    startY: 0,
    startDistance: 0,
    startAngle: 0,
    fingerCount: 0,
  });

  const containerRef = useRef(null);
  const currentGesture = GESTURES[currentStep];
  const progress = ((currentStep) / GESTURES.length) * 100;

  // Handle gesture success
  const handleSuccess = useCallback(() => {
    setIsSuccess(true);
    
    setTimeout(() => {
      setIsSuccess(false);
      
      if (currentStep < GESTURES.length - 1) {
        setCurrentStep(prev => prev + 1);
      } else {
        // Tutorial complete
        setTutorialDone();
        onComplete?.();
      }
    }, 800);
  }, [currentStep, onComplete]);

  // Touch handlers
  const handleTouchStart = useCallback((e) => {
    const touches = e.touches;
    
    setTouchData({
      fingerCount: touches.length,
      startY: touches.length > 0 ? touches[0].pageY : 0,
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
    
    // Scroll detection (1 finger)
    if (gesture.id === 'scroll' && touches.length === 1) {
      const deltaY = Math.abs(touches[0].pageY - touchData.startY);
      if (deltaY > 50) {
        handleSuccess();
      }
    }
    
    // 2-finger gestures
    if (touches.length === 2 && touchData.startDistance > 0) {
      const currentDistance = Math.hypot(
        touches[0].pageX - touches[1].pageX,
        touches[0].pageY - touches[1].pageY
      );
      const currentAngle = getAngle(touches[0], touches[1]);
      
      const distanceDelta = currentDistance - touchData.startDistance;
      let angleDelta = currentAngle - touchData.startAngle;
      if (angleDelta > 180) angleDelta -= 360;
      if (angleDelta < -180) angleDelta += 360;
      
      // Pinch
      if (gesture.id === 'pinch' && distanceDelta < -40) {
        handleSuccess();
      }
      
      // Spread
      if (gesture.id === 'spread' && distanceDelta > 40) {
        handleSuccess();
      }
      
      // Rotate right
      if (gesture.id === 'rotate_right' && angleDelta > 25) {
        handleSuccess();
      }
      
      // Rotate left
      if (gesture.id === 'rotate_left' && angleDelta < -25) {
        handleSuccess();
      }
    }
    
    // 3-finger gestures
    if (touches.length === 3 && touchData.fingerCount === 3) {
      const currentDistance = Math.hypot(
        touches[0].pageX - touches[1].pageX,
        touches[0].pageY - touches[1].pageY
      );
      const distanceDelta = currentDistance - touchData.startDistance;
      
      // 3-finger pinch
      if (gesture.id === 'pinch3' && distanceDelta < -30) {
        handleSuccess();
      }
      
      // 3-finger spread
      if (gesture.id === 'spread3' && distanceDelta > 30) {
        handleSuccess();
      }
    }
  }, [currentGesture, touchData, isSuccess, handleSuccess]);

  const handleTouchEnd = useCallback((e) => {
    if (isSuccess) return;
    
    const gesture = currentGesture;
    
    // 2-finger tap
    if (gesture.id === 'tap2' && touchData.fingerCount === 2) {
      handleSuccess();
    }
    
    // Reset touch data
    setTouchData({
      startY: 0,
      startDistance: 0,
      startAngle: 0,
      fingerCount: 0,
    });
  }, [currentGesture, touchData, isSuccess, handleSuccess]);

  // Skip tutorial
  const handleSkip = useCallback(() => {
    setTutorialDone();
    onComplete?.();
  }, [onComplete]);

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
      <div className="flex items-center justify-between p-4">
        <div className="flex items-baseline">
          <span className="text-white font-black text-xl">NINJA</span>
          <span className="font-black text-xl ml-1" style={{ color: '#6225ff' }}>8K</span>
        </div>
        <button 
          onClick={handleSkip}
          className="px-4 py-2 text-gray-400 text-sm"
        >
          Skip
        </button>
      </div>

      {/* Progress bar */}
      <div className="px-4 mb-8">
        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
          <div 
            className="h-full rounded-full transition-all duration-500"
            style={{ 
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #6225ff, #8b5cf6)',
            }}
          />
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-gray-500 text-xs">{currentStep + 1} / {GESTURES.length}</span>
          <span className="text-gray-500 text-xs">Gestures</span>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        {/* Success indicator */}
        {isSuccess ? (
          <div className="flex flex-col items-center animate-pulse">
            <div 
              className="w-24 h-24 rounded-full flex items-center justify-center mb-6"
              style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}
            >
              <svg className="w-12 h-12 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <p className="text-green-400 text-xl font-bold">Perfect!</p>
          </div>
        ) : (
          <>
            {/* Gesture icon */}
            <div 
              className="w-32 h-32 rounded-full flex items-center justify-center mb-6"
              style={{ background: 'rgba(98, 37, 255, 0.2)', border: '2px solid rgba(98, 37, 255, 0.5)' }}
            >
              <span className="text-5xl">{currentGesture.icon}</span>
            </div>

            {/* Gesture name */}
            <h2 className="text-white text-2xl font-bold mb-2">{currentGesture.name}</h2>
            <p className="text-gray-400 text-center mb-8">{currentGesture.description}</p>

            {/* Animated demo */}
            <div 
              className="w-full max-w-xs h-48 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px dashed rgba(255,255,255,0.2)' }}
            >
              <AnimatedHand animation={currentGesture.animation} isPaused={isSuccess} />
            </div>

            {/* Hint */}
            <p className="text-gray-500 text-sm mt-6 text-center">
              Perform the gesture anywhere on screen
            </p>
          </>
        )}
      </div>

      {/* Dots indicator */}
      <div className="flex justify-center gap-2 pb-8">
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

      {/* CSS Animations */}
      <style>{`
        @keyframes scrollAnim {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-30px); }
        }
        
        @keyframes tap2Anim {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(0.9); opacity: 0.7; }
        }
        
        @keyframes pinchAnim {
          0%, 100% { gap: 4rem; }
          50% { gap: 1rem; }
        }
        
        @keyframes spreadAnim {
          0%, 100% { gap: 1rem; }
          50% { gap: 4rem; }
        }
        
        @keyframes rotateRightAnim {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(45deg); }
        }
        
        @keyframes rotateLeftAnim {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(-45deg); }
        }
        
        @keyframes pinch3Anim {
          0%, 100% { gap: 2rem; }
          50% { gap: 0.5rem; }
        }
        
        @keyframes spread3Anim {
          0%, 100% { gap: 0.5rem; }
          50% { gap: 2rem; }
        }
      `}</style>
    </div>
  );
};

export default GestureTutorial;
