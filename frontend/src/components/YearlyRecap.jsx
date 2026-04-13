import React, { useState, useMemo } from 'react';
import { Bike, Waves, Footprints, TrendingUp, Activity, ChevronLeft, ChevronRight } from 'lucide-react';

const YearlyRecap = ({ activities = [] }) => { 
  const currentYearActual = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYearActual);

  const yearlyActs = useMemo(() => {
    // Petit debug pour voir TOUTES les années disponibles dans ton array "activities"
    const yearsAvailable = [...new Set(activities.map(a => (a.date || a.start_date || "").substring(0,4)))];

    const filtered = activities.filter(a => {
      const dateStr = a.date || a.start_date;
      if (!dateStr) return false;
      return parseInt(dateStr.toString().substring(0, 4)) === selectedYear;
    });

    return filtered;
  }, [activities, selectedYear]);

  // 2. Grouper les données avec calcul précis via les zones HR
  const stats = useMemo(() => {
    return yearlyActs.reduce((acc, act) => {
      let type = act.type;
      if (type === 'VirtualRide') type = 'Ride';
      if (!['Run', 'Ride', 'Swim'].includes(type)) return acc;

      if (!acc[type]) {
        acc[type] = { count: 0, distance: 0, duration: 0, elevation: 0, hrDuration: 0 };
      }
      
      acc[type].count += 1;
      acc[type].distance += (Number(act.distance) || 0);
      acc[type].elevation += (Number(act.total_elevation_gain) || 0);
      
      // DUREE REELLE VIA ZONES (on ignore le moving_time ici pour la moyenne)
      const rawZones = typeof act.hr_zones === 'string' ? JSON.parse(act.hr_zones) : act.hr_zones;
      if (rawZones && Array.isArray(rawZones)) {
        const timeInZones = rawZones.reduce((sum, z) => sum + (Number(z.time) || 0), 0);
        acc[type].hrDuration += timeInZones;
        // On garde le duration classique pour l'affichage du total (en minutes)
        acc[type].duration += (timeInZones / 60); 
      } else {
        // Fallback si pas de zones : on prend le moving_time divisé par 60
        acc[type].duration += (Number(act.moving_time) || 0);
      }
      
      return acc;
    }, {});
  }, [yearlyActs]);

  const totalDuration = Object.values(stats).reduce((sum, s) => sum + s.duration, 0);

  const formatDuration = (totalMins) => {
    if (!totalMins || totalMins <= 0) return "0min";
    const hrs = Math.floor(totalMins / 60);
    const mins = Math.round(totalMins % 60);
    return hrs > 0 ? `${hrs}h${mins.toString().padStart(2, '0')}` : `${mins}min`;
  };

  const getMonthlyAverage = (durationMin) => {
    const isCurrentYear = selectedYear === currentYearActual;
    const monthsElapsed = isCurrentYear ? (new Date().getMonth() + 1) : 12;
    return formatDuration(durationMin / monthsElapsed);
  };

  const sportsConfig = [
    { key: 'Run', label: 'Course à pied', icon: <Footprints className="text-orange-500" />, color: 'bg-orange-500' },
    { key: 'Ride', label: 'Vélo', icon: <Bike className="text-blue-500" />, color: 'bg-blue-500' },
    { key: 'Swim', label: 'Natation', icon: <Waves className="text-cyan-400" />, color: 'bg-cyan-400' }
  ];

  return (
    <div className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 shadow-xl mt-8">
      {/*HEADER*/}
      <div className='flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8'>
        {/* Titre - Il prendra toute la largeur sur mobile */}
        <div className="flex items-center gap-4 sm:gap-6">
          <h3 className="text-[12px] sm:text-sm font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2 sm:gap-3">
            <TrendingUp size={18} className="text-emerald-500" /> Récapitulatif
          </h3>
        </div>


            {/* Sélecteur d'année - Il passera en dessous sur mobile grâce au flex-col du parent */}
            <div className="flex items-center bg-slate-800 p-1.5 rounded-2xl border border-slate-700 shadow-inner self-start sm:self-auto">
              <button 
                onClick={() => setSelectedYear(prev => prev - 1)} 
                className="p-2.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-all active:scale-90"
              >
                <ChevronLeft size={22} />
              </button>

              <span className="px-5 text-lg font-black text-white min-w-[70px] text-center tracking-tight">
                {selectedYear}
              </span>

              <button 
                onClick={() => setSelectedYear(prev => prev + 1)} 
                disabled={selectedYear >= currentYearActual}
                className="p-2.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-all active:scale-90 disabled:opacity-0"
              >
                <ChevronRight size={22} />
              </button>
            </div>
        
        {/* Le badge des séances s'ajuste maintenant mieux */}
        <div className="bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
          <h3 className="text-[10px] sm:text-sm font-black text-emerald-500 uppercase tracking-[0.1em] flex items-center gap-2">
              <Activity size={16} /> {yearlyActs.length} séances
          </h3>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {sportsConfig.map((sport) => {
          const s = stats[sport.key] || { count: 0, distance: 0, duration: 0, elevation: 0 };
          const percent = totalDuration > 0 ? Math.round((s.duration / totalDuration) * 100) : 0;
          
          return (
            <div key={sport.key} className="relative group">
              <div className="flex justify-between items-end mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-slate-800 rounded-2xl">{sport.icon}</div>
                  <div>
                    <p className="text-white font-black text-lg leading-none">{sport.label}</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
                      {s.count} séances
                    </p>
                  </div>
                </div>
                <span className="text-2xl font-black text-white">{percent}%</span>
              </div>

              <div className="h-1.5 w-full bg-slate-800 rounded-full mb-6 overflow-hidden">
                <div 
                  className={`h-full ${sport.color} transition-all duration-1000`} 
                  style={{ width: `${percent}%` }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-800/40 p-3 rounded-2xl border border-slate-800/50">
                  <p className="text-[9px] text-slate-500 font-black uppercase mb-1">Distance</p>
                  <p className="text-sm font-bold text-white">{(s.distance).toFixed(1)} km</p>
                </div>
                <div className="bg-slate-800/40 p-3 rounded-2xl border border-slate-800/50">
                  <p className="text-[9px] text-slate-500 font-black uppercase mb-1">Durée</p>
                  <p className="text-sm font-bold text-white">{formatDuration(s.duration)}</p>
                </div>
                <div className="bg-slate-800/40 p-3 rounded-2xl border border-slate-800/50">
                  <p className="text-[9px] text-slate-500 font-black uppercase mb-1">Dénivelé</p>
                  <p className="text-sm font-bold text-white">{Math.round(s.elevation)} m</p>
                </div>
                <div className="bg-slate-800/40 p-3 rounded-2xl border border-slate-800/50">
                  <p className="text-[9px] text-slate-500 font-black uppercase mb-1">Moy. / mois</p>
                  <p className="text-sm font-bold text-white">{getMonthlyAverage(s.duration)}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default YearlyRecap;