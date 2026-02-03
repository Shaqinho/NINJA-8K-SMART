import React, { memo } from 'react';

const FolderRow = memo(({ category, onSelect, isSelected }) => {
  const isNinja = category.isNinja;
  
  return (
    <button
      onClick={() => onSelect(category)}
      className={`
        w-full flex items-center justify-between px-4 py-4 mb-1
        transition-all duration-200 active:scale-95 group
        ${isSelected ? 'bg-white/10' : ''}
      `}
      style={{ background: isSelected ? 'rgba(255,255,255,0.1)' : 'transparent' }}
    >
      <div className="flex items-center gap-3">
        {/* NINJA badge for special folders */}
        {isNinja && (
          <span 
            className="px-2 py-0.5 rounded text-[10px] font-black tracking-tighter"
            style={{ background: 'linear-gradient(135deg, #6225ff 0%, #8b5cf6 100%)', color: 'white' }}
          >
            NINJA
          </span>
        )}
        
        <span 
          className={`text-sm font-bold uppercase tracking-tight transition-colors ${
            isSelected ? 'text-white' : 'text-white/70 group-hover:text-white'
          }`}
        >
          {category.category_name}
        </span>
        
        {/* Count */}
        {category.count !== undefined && (
          <span className="text-gray-500 text-xs">({category.count})</span>
        )}
      </div>

      {/* Arrow right */}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2">
        <path d="M9 18l6-6-6-6"/>
      </svg>
    </button>
  );
});

FolderRow.displayName = 'FolderRow';
export default FolderRow;
