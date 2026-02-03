import React, { useMemo } from 'react';

const THEME = {
  gradients: { primary: 'linear-gradient(135deg, #6225FF 0%, #A020F0 100%)' }
};

export const EPGBar = ({
  programs = [],
  currentTime = new Date(),
  visible = true,
  onProgramClick,
}) => {
  const { current, next, progress } = useMemo(() => {
    const now = currentTime.getTime();
    let currentProgram = null;
    let nextProgram = null;
    let progressPercent = 0;

    for (let i = 0; i < programs.length; i++) {
      const prog = programs[i];
      const start = new Date(prog.start).getTime();
      const end = new Date(prog.end).getTime();

      if (now >= start && now < end) {
        currentProgram = prog;
        progressPercent = ((now - start) / (end - start)) * 100;
        nextProgram = programs[i + 1] || null;
        break;
      }
    }

    return { current: currentProgram, next: nextProgram, progress: progressPercent };
  }, [programs, currentTime]);

  const formatTime = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!visible || !current) return null;

  return (
    <div className="px-4 py-3">
      <div className="mb-2">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="text-white font-bold text-sm truncate">{current.title}</span>
            {current.rating && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-yellow-500/20 text-yellow-400">{current.rating}</span>}
          </div>
          <span className="text-gray-400 text-xs">{formatTime(current.start)} - {formatTime(current.end)}</span>
        </div>

        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'transparent' }}>
          <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${progress}%`, background: THEME.gradients.primary }}/>
        </div>

        <div className="flex justify-between mt-1">
          <span className="text-gray-500 text-[10px]">{Math.round(progress)}% watched</span>
          <span className="text-gray-500 text-[10px]">{Math.ceil((new Date(current.end).getTime() - currentTime.getTime()) / 60000)} min left</span>
        </div>
      </div>

      {next && (
        <button onClick={() => onProgramClick?.(next)} className="w-full flex items-center gap-3 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
          <span className="text-gray-500 text-[10px] font-bold uppercase">Next</span>
          <span className="text-gray-300 text-xs truncate flex-1">{next.title}</span>
          <span className="text-gray-500 text-[10px]">{formatTime(next.start)}</span>
        </button>
      )}
    </div>
  );
};

export default EPGBar;
