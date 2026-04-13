import React, { useState, useEffect } from 'react';
import { Calendar, Clock, ChevronRight, Trophy, Star } from 'lucide-react';

const ActivityTable = ({ activities = [] }) => {
  const [displayCount, setDisplayCount] = useState(10);

  // Détection de la taille d'écran pour le nombre d'activités
  useEffect(() => {
    const updateCount = () => {
      setDisplayCount(window.innerWidth < 768 ? 5 : 10);
    };
    updateCount();
    window.addEventListener('resize', updateCount);
    return () => window.removeEventListener('resize', updateCount);
  }, []);

  // Tes icônes personnalisées
  const getActivityIcon = (type) => {
    if (type?.includes('Run')) return '🏃';
    if (type?.includes('Ride')) return '🚴';
    if (type?.includes('Swim')) return '🏊';
    return '🔥';
  };

  const formatTime = (timeValue) => {
    if (!timeValue) return "--";
    const totalMinutes = timeValue > 1440 ? Math.floor(timeValue / 60) : timeValue;
    const h = Math.floor(totalMinutes / 60);
    const m = Math.round(totalMinutes % 60);
    return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m}min`;
  };

  const formatDistance = (dist) => {
    if (!dist) return "0.0";
    const value = dist > 500 ? dist / 1000 : dist;
    return value.toFixed(1);
  };

  const visibleActivities = activities.slice(0, displayCount);

  return (
    <div className="bg-slate-900 rounded-[2rem] md:rounded-[2.5rem] border border-slate-800 shadow-xl overflow-hidden mt-8">
          {/* HEADER */}
          <div className="p-5 md:p-8 border-b border-slate-800 bg-slate-800/20">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-3">
              <Trophy size={18} className="text-orange-500" /> Dernières Activités <span className="text-slate-600">({displayCount})</span>
            </h3>
          </div>


      <div className="bg-slate-900 rounded-[2rem] border border-slate-800 overflow-hidden shadow-2xl">
        <table className="w-full text-left border-collapse">
          {/* HEADER DESKTOP */}
          <thead className="hidden md:table-header-group bg-slate-800/50">
            <tr>
              <th className="p-5 text-[10px] font-black uppercase text-slate-500 tracking-widest">Activité</th>
              <th className="p-5 text-[10px] font-black uppercase text-slate-500 tracking-widest text-center">Distance</th>
              <th className="p-5 text-[10px] font-black uppercase text-slate-500 tracking-widest text-center">Durée</th>
              <th className="p-5 text-[10px] font-black uppercase text-slate-500 tracking-widest text-center">Score</th>
              <th className="p-5"></th>
            </tr>
          </thead>

          <tbody className="block md:table-row-group">
            {visibleActivities.map((activity) => (
              <tr 
                key={activity.id} 
                className="block md:table-row border-b border-slate-800/50 hover:bg-white/[0.02] transition-colors"
              >
                {/* NOM / EMOJI / DATE */}
                <td className="block md:table-cell p-4 md:p-5">
                  <div className="flex items-center gap-4">
                    <div className="text-2xl w-12 h-12 flex items-center justify-center bg-slate-800 rounded-2xl shadow-inner">
                      {getActivityIcon(activity.type)}
                    </div>
                    <div>
                      <p className="text-sm font-black text-white leading-tight mb-1">{activity.name}</p>
                      <div className="flex items-center gap-3 text-[10px] text-slate-500 font-bold uppercase tracking-tighter">
                        <span className="text-orange-500 font-black">{activity.type}</span>
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          {new Date(activity.date || activity.start_date).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </td>

                {/* DISTANCE */}
                <td className="inline-block md:table-cell p-4 md:p-5 pt-0 md:pt-5 w-1/3 md:w-auto">
                  <div className="flex flex-col items-start md:items-center">
                    <span className="md:hidden text-[8px] text-slate-500 uppercase font-black mb-1">Distance</span>
                    <p className="text-sm font-black text-white">
                      {formatDistance(activity.distance)}<span className="text-[10px] text-slate-500 font-normal ml-0.5">km</span>
                    </p>
                  </div>
                </td>

                {/* DURÉE */}
                <td className="inline-block md:table-cell p-4 md:p-5 pt-0 md:pt-5 w-1/3 md:w-auto text-center">
                  <div className="flex flex-col items-center">
                    <span className="md:hidden text-[8px] text-slate-500 uppercase font-black mb-1">Durée</span>
                    <p className="text-sm font-bold text-slate-300 flex items-center gap-1">
                       <Clock size={12} className="text-slate-600" />
                       {formatTime(activity.moving_time || activity.duration)}
                    </p>
                  </div>
                </td>

                {/* SCORE (Visible partout) */}
                <td className="inline-block md:table-cell p-4 md:p-5 pt-0 md:pt-5 w-1/3 md:w-auto text-right md:text-center">
                  <div className="flex flex-col items-end md:items-center">
                    <span className="md:hidden text-[8px] text-slate-500 uppercase font-black mb-1">Score</span>
                    <div className="flex items-center gap-1 bg-orange-500/10 px-2 py-1 rounded-lg border border-orange-500/20">
                       <Star size={12} className="text-orange-500 fill-orange-500" />
                       <span className="text-sm font-black text-orange-500">
                         {Math.round(activity.custom_score || 0)}
                       </span>
                    </div>
                  </div>
                </td>

                <td className="hidden md:table-cell p-5 text-right">
                  <ChevronRight size={18} className="text-slate-700 ml-auto" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ActivityTable;