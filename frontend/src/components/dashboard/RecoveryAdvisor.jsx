import React, { useMemo } from 'react';
import { Zap, Activity, Moon, TrendingUp, HeartPulse } from 'lucide-react';

const RecoveryAdvisor = ({ data = [] }) => {
  const metrics = useMemo(() => {
    if (data.length < 2) return null;
    const last = data[data.length - 1];
    const last7Days = data.slice(-7);
    const getRHR = (d) => d.resting_hr || d.restingHR || 0;
    
    const avgHRV = last7Days.reduce((acc, d) => acc + (d.hrv || 0), 0) / last7Days.length;
    const avgRHR = last7Days.reduce((acc, d) => acc + getRHR(d), 0) / last7Days.length;
    const avgSleep = last7Days.reduce((acc, d) => acc + (d.quality || 0), 0) / last7Days.length;
    
    const currentRHR = getRHR(last);
    const hrvRatio = last.hrv / (avgHRV || 1);
    const rhrDiff = currentRHR - avgRHR;

    return { 
      last, avgHRV, avgRHR, avgSleep, hrvRatio, rhrDiff, currentRHR,
      currentHRV: last.hrv || 0,
      currentSleep: last.quality || 0,
      currentTSB: last.tsb || 0,
      score: last.readiness_score || 0 
    };
  }, [data]);

  if (!metrics) return null;
  const { score, currentHRV, currentRHR, currentSleep, currentTSB, hrvRatio, rhrDiff, avgHRV, avgRHR, avgSleep } = metrics;

  const getStatusColor = (s) => {
    if (s >= 80) return 'text-emerald-400';
    if (s >= 60) return 'text-blue-400';
    if (s >= 40) return 'text-orange-400';
    return 'text-red-400';
  };

  return (
    <div className="p-8 rounded-[2.5rem] border border-slate-800 bg-slate-900 shadow-xl">
      <div className="relative z-10">
        
        {/* HEADER COHÉRENT */}
        <div className="mb-8">
          <h3 className="text-sm font-black tracking-[0.2em] text-slate-500 uppercase flex items-center gap-3">
            <Zap size={18} className="text-yellow-400" /> Analyse de récupération
          </h3>
          <div className="mt-4 flex items-center justify-between border-b border-slate-800/50 pb-6">
            <div className="flex items-baseline gap-2">
              <span className="text-7xl font-black text-white tracking-tighter tabular-nums">{score}</span>
              <span className="text-slate-600 font-bold text-xl">/100</span>
            </div>
            <div className="text-right">
              <p className={`text-xs font-black uppercase tracking-[0.2em] ${getStatusColor(score)}`}>
                Statut : {score >= 80 ? 'Optimal' : score >= 60 ? 'Stable' : 'Fatigué'}
              </p>
              <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase">Basé sur les 7 derniers jours</p>
            </div>
          </div>
        </div>

        {/* MÉTRIQUES DESIGN SYSTÈME */}
        <div className="space-y-6">
          <MetricRow 
            label="Sommeil" 
            value={`${currentSleep}%`}
            refValue={`Moy. ${Math.round(avgSleep)}%`}
            percent={currentSleep} 
            color="bg-indigo-500"
            icon={<Moon size={16} className="text-indigo-400" />}
          />

          <MetricRow 
            label="HRV Nocturne" 
            value={`${currentHRV} ms`}
            refValue={`Moy. ${Math.round(avgHRV)} ms`}
            percent={Math.min((currentHRV / (avgHRV * 1.3)) * 100, 100)} 
            color="bg-purple-500"
            icon={<Activity size={16} className="text-purple-400" />}
          />

          <MetricRow 
            label="Fréquence au Repos" 
            value={`${currentRHR} bpm`}
            refValue={`Moy. ${Math.round(avgRHR)} bpm`}
            percent={Math.max(15, 100 - (rhrDiff * 8) - 20)} 
            color="bg-red-500"
            icon={<HeartPulse size={16} className="text-red-400" />}
          />

          <MetricRow 
            label="Forme (TSB)" 
            value={currentTSB}
            refValue="Cible: -10 à -20"
            percent={Math.max(10, 50 + (currentTSB * 1.5))} 
            color="bg-emerald-500"
            icon={<TrendingUp size={16} className="text-emerald-400" />}
          />
        </div>

        <div className="mt-8 pt-6 border-t border-slate-800 text-[9px] text-slate-600 font-black uppercase tracking-widest text-center">
          HRV (35%) • Sommeil (35%) • RHR (15%) • TSB (15%)
        </div>
      </div>
    </div>
  );
};

const MetricRow = ({ label, value, refValue, percent, color, icon }) => (
  <div className="group">
    <div className="flex justify-between items-center mb-2">
      <div className="flex items-center gap-3">
        <span className="text-slate-400">{icon}</span>
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{label}</span>
          <span className="text-[9px] font-bold text-slate-600">{refValue}</span>
        </div>
      </div>
      <span className="font-bold text-white bg-slate-800 px-3 py-1 rounded-lg text-xs tabular-nums tracking-tight">
        {value}
      </span>
    </div>
    <div className="h-1.5 w-full bg-slate-800/50 rounded-full overflow-hidden">
      <div 
        className={`h-full ${color} transition-all duration-700 ease-out`}
        style={{ width: `${percent}%` }}
      />
    </div>
  </div>
);

export default RecoveryAdvisor;