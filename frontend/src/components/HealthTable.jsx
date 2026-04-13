import React, { useState, useEffect } from 'react';
import { Calendar, Moon, Heart, Activity } from 'lucide-react';

const HealthTable = ({ data = [] }) => {
  const [displayCount, setDisplayCount] = useState(10);

  // Gestion du nombre de jours affichés selon l'écran
  useEffect(() => {
    const updateCount = () => {
      setDisplayCount(window.innerWidth < 768 ? 5 : 10);
    };
    updateCount();
    window.addEventListener('resize', updateCount);
    return () => window.removeEventListener('resize', updateCount);
  }, []);

  // Inverser pour avoir les plus récents et découper
  const recentData = [...data].reverse().slice(0, displayCount);

  return (
    <div className="bg-slate-900 rounded-[2rem] md:rounded-[2.5rem] border border-slate-800 shadow-xl overflow-hidden mt-8">
      {/* HEADER */}
      <div className="p-5 md:p-8 border-b border-slate-800 bg-slate-800/20 flex justify-between items-center">
        <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-3">
          <Calendar size={18} className="text-blue-500" /> Historique de Santé <span className="text-slate-600">({displayCount})</span>
        </h3>
        <span className="text-[10px] font-black text-slate-600 uppercase md:block hidden">
          Derniers {displayCount} jours
        </span>
      </div>

      <div className="w-full">
        <table className="w-full text-left border-collapse">
          {/* EN-TÊTE DESKTOP */}
          <thead className="hidden md:table-header-group bg-slate-800/30">
            <tr>
              <th className="p-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Date</th>
              <th className="p-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">HRV (ms)</th>
              <th className="p-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">FC Repos</th>
              <th className="p-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Sommeil</th>
              <th className="p-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Sommeil profond</th>
            </tr>
          </thead>

          <tbody className="block md:table-row-group divide-y divide-slate-800/50">
            {recentData.map((day, idx) => (
              <tr key={idx} className="block md:table-row hover:bg-slate-800/20 transition-colors group">
                
                {/* DATE (Formatée pour mobile/PC) */}
                <td className="block md:table-cell p-4 md:p-5 text-sm font-bold text-slate-300 bg-slate-800/10 md:bg-transparent">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-blue-500 md:hidden" />
                    <span className="capitalize">
                      {new Date(day.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                </td>
                
                {/* BLOC 3 COLONNES MOBILE */}
                <td className="inline-block md:table-cell p-4 md:p-5 w-1/3 md:w-auto text-center border-r md:border-0 border-slate-800/30">
                  <div className="flex flex-col items-center">
                    <span className="md:hidden text-[8px] text-slate-500 font-black uppercase mb-1">HRV</span>
                    <span className="text-white font-black">{day.hrv || '--'}</span>
                    <span className="hidden md:block text-[10px] text-slate-400 font-bold opacity-50">Base: {day.hrv}</span>
                  </div>
                </td>

                <td className="inline-block md:table-cell p-4 md:p-5 w-1/3 md:w-auto text-center border-r md:border-0 border-slate-800/30">
                  <div className="flex flex-col items-center">
                    <span className="md:hidden text-[8px] text-slate-500 font-black uppercase mb-1">Repos</span>
                    <span className="text-white font-bold text-sm">
                      {day.restingHR || '--'} 
                      <span className="text-slate-500 text-[10px] ml-0.5 font-normal">bpm</span>
                    </span>
                  </div>
                </td>

                <td className="inline-block md:table-cell p-4 md:p-5 w-1/3 md:w-auto text-center">
                  <div className="flex flex-col items-center">
                    <span className="md:hidden text-[8px] text-slate-500 font-black uppercase mb-1">Sommeil</span>
                    <div className="inline-flex items-center gap-1 text-indigo-400 text-xs font-bold">
                      <Moon size={10} /> {day.quality || '--'}%
                    </div>
                  </div>
                </td>

                {/* SCORE / PROFOND (Mobile pied de bloc) */}
                <td className="block md:table-cell p-4 md:p-5 text-right bg-slate-800/5 md:bg-transparent">
                  <div className="flex justify-between md:justify-end items-center gap-3">
                    <span className="md:hidden text-[9px] text-slate-500 font-black uppercase">Profond</span>
                    <span className={`text-xs font-black px-3 py-1 rounded-lg border ${
                      day.readiness_score > 80 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                      day.readiness_score > 60 ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                      'bg-orange-500/10 text-orange-400 border-orange-500/20'
                    }`}>
                      {day.deepSleep || '--'} min
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default HealthTable;