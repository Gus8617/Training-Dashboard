import React from 'react';

export const WorkoutBlockChart = ({ description, zone, isMini }) => {
  // Parseur ultra-léger pour détecter des patterns d'intervalles dans la description
  const parseBlocks = () => {
    const descLower = description ? description.toLowerCase() : '';
    
    // Pattern 1: ex "3x(8x30s/30s)" ou "3x8x30" ou "réveil"
    if (descLower.includes('3x') || descLower.includes('8x') || descLower.includes('réveil')) {
      return [
        { type: 'warmup', width: 'w-3', height: 'bg-blue-500' },
        ...Array(4).fill([
          { type: 'work', width: 'w-1', height: 'bg-red-500' },
          { type: 'rest', width: 'w-1', height: 'bg-blue-400' },
          { type: 'work', width: 'w-1', height: 'bg-red-500' },
          { type: 'rest', width: 'w-1.5', height: 'bg-slate-700' },
        ]).flat(),
        { type: 'cooldown', width: 'w-3', height: 'bg-blue-500' }
      ];
    }
    
    // Pattern 2: ex "4x4 min", "hit" ou "la ferté-macé"
    if (descLower.includes('4x4') || descLower.includes('hit') || descLower.includes('la ferté-macé')) {
      return [
        { type: 'warmup', width: 'w-4', height: 'bg-blue-500' },
        { type: 'work', width: 'w-2.5', height: 'bg-red-600' },
        { type: 'rest', width: 'w-2', height: 'bg-blue-400' },
        { type: 'work', width: 'w-2.5', height: 'bg-red-600' },
        { type: 'rest', width: 'w-2', height: 'bg-blue-400' },
        { type: 'work', width: 'w-2.5', height: 'bg-red-600' },
        { type: 'cooldown', width: 'w-4', height: 'bg-blue-500' },
      ];
    }

    // Par défaut (LIT / Endurance continue ou Récupération)
    if (zone === 'LIT') {
      return [{ type: 'steady', width: 'w-full', height: 'bg-blue-500' }];
    }

    return [{ type: 'default', width: 'w-full', height: 'bg-emerald-500' }];
  };

  const blocks = parseBlocks();

  // Ajustement dynamique des hauteurs et des styles selon le mode (Miniature vs Modale)
  const containerHeight = isMini ? "h-6" : "h-16";
  
  const getHeightClass = (type) => {
    if (isMini) {
      switch (type) {
        case 'work': return 'h-full';
        case 'warmup': case 'cooldown': return 'h-3';
        case 'rest': return 'h-1.5';
        default: return 'h-2';
      }
    } else {
      switch (type) {
        case 'work': return 'h-full';
        case 'warmup': case 'cooldown': return 'h-8';
        case 'rest': return 'h-4';
        default: return 'h-6';
      }
    }
  };

  return (
    <div className={`my-1 ${containerHeight} bg-slate-950/60 rounded-md flex items-end justify-center p-1 gap-0.5 border border-slate-800/50 overflow-hidden`}>
      {blocks.map((block, idx) => (
        <div 
          key={idx} 
          className={`${block.width} ${getHeightClass(block.type)} ${block.height} rounded-t-[1px] transition-all ${block.type === 'steady' || block.type === 'default' ? '' : 'flex-1'}`} 
        />
      ))}
    </div>
  );
};

export default WorkoutBlockChart;