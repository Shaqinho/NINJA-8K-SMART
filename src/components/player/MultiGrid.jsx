import React from 'react';

const glassCard = {
  background: 'transparent',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
};

const GridCell = ({ item, active, onSelect, onRemove, children }) => (
  <div className={`relative rounded-xl overflow-hidden cursor-pointer transition-all ${active ? 'ring-2 ring-purple-500' : 'ring-1 ring-white/10'}`} onClick={() => onSelect?.(item)}>
    {children}
    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-transparent to-transparent">
      <p className="text-white text-xs font-bold truncate">{item?.name}</p>
    </div>
    {active && <div className="absolute top-2 left-2"><div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" /></div>}
    <button onClick={(e) => { e.stopPropagation(); onRemove?.(item); }} className="absolute top-2 right-2 w-6 h-6 rounded-full bg-transparent flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
      <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  </div>
);

const AddCell = ({ onClick }) => (
  <button onClick={onClick} className="rounded-xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-2 hover:border-purple-500/50 hover:bg-white/5 transition-all">
    <svg className="w-8 h-8 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
    <span className="text-gray-500 text-xs font-bold">Add Channel</span>
  </button>
);

export const MultiGrid = ({
  visible,
  onClose,
  items = [],
  activeIndex = 0,
  gridSize = 2,
  onSelect,
  onRemove,
  onAdd,
  onGridSizeChange,
  renderVideo,
}) => {
  const gridConfigs = {
    2: { className: 'grid-cols-2 grid-rows-1' },
    3: { className: 'grid-cols-3 grid-rows-1' },
    4: { className: 'grid-cols-2 grid-rows-2' },
  };
  const config = gridConfigs[gridSize];

  if (!visible) return null;

  return (
    <div className="absolute inset-0 z-40" style={{ background: 'transparent' }}>
      <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <h2 className="text-white font-bold">Multi-View</h2>
        </div>

        <div className="flex items-center gap-2 p-1 rounded-xl" style={glassCard}>
          {[2, 3, 4].map((size) => (
            <button key={size} onClick={() => onGridSizeChange?.(size)} className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${gridSize === size ? 'bg-purple-500 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}>
              {size}
            </button>
          ))}
        </div>
      </div>

      <div className={`absolute inset-0 pt-20 pb-4 px-4 grid gap-2 ${config.className}`}>
        {Array.from({ length: gridSize }).map((_, index) => {
          const item = items[index];
          if (item) {
            return <GridCell key={item.id} item={item} active={index === activeIndex} onSelect={() => onSelect?.(index)} onRemove={() => onRemove?.(index)}>{renderVideo?.(item, index)}</GridCell>;
          }
          return <AddCell key={`add-${index}`} onClick={onAdd} />;
        })}
      </div>
    </div>
  );
};

export default MultiGrid;
