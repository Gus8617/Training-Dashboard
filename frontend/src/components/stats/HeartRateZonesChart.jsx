import React, { useMemo, useState } from 'react';
import { Clock } from 'lucide-react';

const HeartRateZonesChart = ({ activities = [] }) => {
  const currentYear = new Date().getFullYear();
  const lastYear = currentYear - 1;

  const [view, setView] = useState('30days');
  const [selectedSport, setSelectedSport] = useState('All');

  const zoneColors = ["#10b981", "#34d399", "#fbbf24", "#f87171", "#ef4444"];

  const formatTimeShort = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const filteredData = useMemo(() => {
    if (!activities || !Array.isArray(activities)) return { zones: [0,0,0,0,0], totalSec: 0, latestZones: null };
    
    const now = new Date();
    let periodActs = [];

    if (view === '30days') {
      const limit = new Date().setDate(now.getDate() - 30);
      periodActs = activities.filter(a => new Date(a.start_date || a.date).getTime() >= limit);
    } else {
      periodActs = activities.filter(a => new Date(a.start_date || a.date).getFullYear() === view);
    }

    if (selectedSport !== 'All') {
      periodActs = periodActs.filter(a => 
        selectedSport === 'Ride' ? (a.type === 'Ride' || a.type === 'VirtualRide') : a.type === selectedSport
      );
    }

    const totals = [0, 0, 0, 0, 0];
    let totalSec = 0;
    let latestZonesRef = null;

    periodActs.forEach(act => {
      const raw = typeof act.hr_zones === 'string' ? JSON.parse(act.hr_zones) : act.hr_zones;
      if (raw && raw.length >= 5 && raw[0].info !== 'no_hr') {
        if (!latestZonesRef) latestZonesRef = raw;
        for(let i=0; i<5; i++) {
          const val = Number(raw[i].time || 0);
          totals[i] += val;
          totalSec += val;
        }
      }
    });

    return { zones: totals, totalSec, latestZones: latestZonesRef };
  }, [activities, view, selectedSport]);

  return (
    <div className="bg-slate-950 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl">
      {/* HEADER */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-12">
        <div>
          <h3 className="text-white font-black text-2xl uppercase italic tracking-tighter flex items-center gap-3">
            <Clock className="text-orange-500" size={24} /> Distribution d'intensité
          </h3>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.3em] mt-1">Analyse des zones cardiaques</p>
        </div>
        
        <div className="flex flex-wrap gap-4">
            <div className="flex bg-slate-900 p-1.5 rounded-2xl border border-slate-800 shadow-inner">
                {[
                    { id: 'All', icon: '🎯' },
                    { id: 'Run', icon: '🏃' },
                    { id: 'Ride', icon: '🚴' },
                    { id: 'Swim', icon: '🏊' }
                ].map(sport => (
                    <button 
                        key={sport.id}
                        onClick={() => setSelectedSport(sport.id)}
                        className={`px-3 py-2 rounded-xl transition-all text-xl ${selectedSport === sport.id ? 'bg-white shadow-xl scale-105' : 'opacity-40 hover:opacity-100 grayscale hover:grayscale-0'}`}
                    >
                        {sport.icon}
                    </button>
                ))}
            </div>

            <div className="flex bg-slate-900 p-1.5 rounded-2xl border border-slate-800">
                {[
                    { id: '30days', label: '30J' },
                    { id: currentYear, label: currentYear },
                    { id: lastYear, label: lastYear }
                ].map(btn => (
                    <button 
                        key={btn.id}
                        onClick={() => setView(btn.id)}
                        className={`px-5 py-2 rounded-xl text-[10px] font-black transition-all ${view === btn.id ? 'bg-orange-500 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                    >
                        {btn.label}
                    </button>
                ))}
            </div>
        </div>
      </div>

      {/* CONTENU - HAUTEUR FIXE */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center min-h-[400px]">
        {/* COLONNE GAUCHE : LES BARS */}
        <div className="space-y-6">
            {filteredData.zones.map((time, i) => {
                const pct = filteredData.totalSec > 0 ? Math.round((time / filteredData.totalSec) * 100) : 0;
                const range = filteredData.latestZones ? `${filteredData.latestZones[i].min}-${filteredData.latestZones[i].max === -1 ? 'max' : filteredData.latestZones[i].max}` : "--";
                
                return (
                    <div key={i}>
                        <div className="flex justify-between items-end mb-2 px-1">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Zone {i+1}</span>
                                <span className="text-[11px] font-mono text-slate-700 font-bold">{range} BPM</span>
                            </div>
                            <div className="text-right">
                                <span className="text-white font-black text-sm block leading-none">{formatTimeShort(time)}</span>
                                <span className="text-[10px] font-mono font-bold text-orange-500">{pct}%</span>
                            </div>
                        </div>
                        <div className="h-4 w-full bg-slate-900/50 rounded-full overflow-hidden border border-slate-800/50 shadow-inner">
                            <div 
                                className="h-full transition-all duration-700 ease-out" 
                                style={{ 
                                    width: `${pct}%`, 
                                    backgroundColor: zoneColors[i],
                                    boxShadow: pct > 0 ? `0 0 20px ${zoneColors[i]}22` : 'none'
                                }} 
                            />
                        </div>
                    </div>
                );
            })}
        </div>

        {/* COLONNE DROITE : RÉCAPITULATIF */}
        <div className="h-full flex flex-col justify-center gap-6">
            <div className="bg-slate-900/40 p-8 rounded-[2.5rem] border border-slate-800/50 text-center shadow-inner">
                <span className="text-slate-500 text-[10px] font-black uppercase tracking-[0.4em] mb-4 block">Temps Total Analysé</span>
                <h4 className="text-5xl font-black text-white tracking-tighter tabular-nums">
                    {formatTimeShort(filteredData.totalSec)}
                </h4>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-900/60 p-5 rounded-3xl border border-slate-800 flex flex-col items-center">
                    <span className="text-[9px] font-black text-emerald-500 uppercase mb-2 tracking-widest text-center">Endurance Fondamentale</span>
                    <span className="text-2xl font-black text-white">
                        {Math.round(((filteredData.zones[0] + filteredData.zones[1]) / filteredData.totalSec) * 100 || 0)}%
                    </span>
                    <span className="text-[8px] text-slate-600 font-bold mt-1">Z1 + Z2</span>
                </div>
                <div className="bg-slate-900/60 p-5 rounded-3xl border border-slate-800 flex flex-col items-center">
                    <span className="text-[9px] font-black text-red-500 uppercase mb-2 tracking-widest text-center">Travail de Qualité</span>
                    <span className="text-2xl font-black text-white">
                        {Math.round(((filteredData.zones[3] + filteredData.zones[4]) / filteredData.totalSec) * 100 || 0)}%
                    </span>
                    <span className="text-[8px] text-slate-600 font-bold mt-1">Z4 + Z5</span>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default HeartRateZonesChart;