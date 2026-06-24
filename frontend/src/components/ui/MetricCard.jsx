import React from 'react';

export default function MetricCard({ title, label, value, color, progress, isTsb }) {
  const colorMap = {
    orange: "text-orange-500",
    blue: "text-blue-500",
    emerald: "text-emerald-400",
    purple: "text-purple-500"
  };

  return (
    <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-xl">
      <h3 className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">{title}</h3>
      <p className={`text-4xl font-black ${isTsb && value < 0 ? 'text-red-400' : colorMap[color]}`}>
        {isTsb && value > 0 ? `+${value}` : value}
      </p>
      <label className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1 block">
        {label}
      </label>  
      {progress && (
        <div className="mt-4 w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
          <div className="bg-blue-500 h-full" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}