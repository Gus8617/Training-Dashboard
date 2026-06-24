// src/components/calendar/CoachCalendar.jsx
import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Construction, Trash2 } from 'lucide-react';
import WorkoutCard from './WorkoutCard';

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function getWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}

function formatLocalYYYYMMDD(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function CoachCalendar() {
  const [viewMode, setViewMode] = useState('week'); 
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(false);
  
  const [calendarData, setCalendarData] = useState({
    sessions: [],
    fitnessDay: { ctl: 0, atl: 0, tsb: 0, readiness_score: 100 }
  });

  const getStartDateStr = () => {
    const d = new Date(currentDate);
    if (viewMode === 'week') {
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
      return formatLocalYYYYMMDD(new Date(d.setDate(diff)));
    } else {
      return formatLocalYYYYMMDD(new Date(d.getFullYear(), d.getMonth(), 1));
    }
  };

  const currentWeekNum = getWeekNumber(currentDate);
  const isCurrentWeekEven = currentWeekNum % 2 === 0;

  const fetchPlan = async () => {
    setLoading(true);
    try {
      const startStr = getStartDateStr();
      const res = await fetch(`/api/planning?startDate=${startStr}&view=${viewMode}&userId=1`);
      const data = await res.json();
      if (data.success) {
        setCalendarData({
          sessions: data.days || [],
          fitnessDay: data.fitness || { ctl: 45.2, atl: 38.0, tsb: 7.2, readiness_score: 85 }
        });
      }
    } catch (err) {
      console.error("Erreur de récupération du plan:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlan();
  }, [currentDate, viewMode]);

  useEffect(() => {
    const handleReload = () => fetchPlan();
    window.addEventListener('reload-calendar', handleReload);
    return () => window.removeEventListener('reload-calendar', handleReload);
  }, [currentDate, viewMode]);

  const handleDeleteSession = async (id) => {
    if (!window.confirm("Supprimer cette séance du planning ?")) return;
    try {
      const res = await fetch(`/api/program/session/${id}`, { method: 'DELETE' }); 
      const data = await res.json();
      if (data.success) fetchPlan();
    } catch (err) {
      console.error(err);
    }
  };
  
  const handleClearWeek = async () => {
    if (!window.confirm("Voulez-vous supprimer TOUTES les séances planifiées affichées à l'écran ?")) return;
    
    const gridDays = generateGridDays().filter(d => !d.isPadding);
    if (gridDays.length === 0) return;
    
    const startDate = gridDays[0].dateStr;
    const endDate = gridDays[gridDays.length - 1].dateStr;
  
    try {
      // 🎯 FIX 1 : Changement de 'DELETE' à 'POST' pour correspondre à la route du backend
      const res = await fetch('/api/program/clear', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 1, startDate, endDate })
      });
      const data = await res.json();
      if (data.success) fetchPlan();
    } catch (err) {
      console.error(err);
    }
  };

  const generateGridDays = () => {
    const days = [];
    const start = new Date(getStartDateStr());
    
    if (viewMode === 'week') {
      for (let i = 0; i < 7; i++) {
        const d = new Date(start); 
        d.setDate(start.getDate() + i); 
        const dateStr = formatLocalYYYYMMDD(d);
        days.push({ 
          dateStr, 
          dayNum: d.getDate(), 
          dayName: d.toLocaleDateString('fr-FR', { weekday: 'short' }), 
          sessions: (calendarData.sessions || []).filter(s => s.date === dateStr),
          isPadding: false
        });
      }
    } else {
      const firstDayIndex = (start.getDay() + 6) % 7; 
      const totalDaysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();

      for (let p = 0; p < firstDayIndex; p++) {
        days.push({ isPadding: true, key: `pad-${p}` });
      }

      for (let i = 1; i <= totalDaysInMonth; i++) {
        const d = new Date(start.getFullYear(), start.getMonth(), i);
        const dateStr = formatLocalYYYYMMDD(d);
        days.push({
          dateStr,
          dayNum: i,
          dayName: d.toLocaleDateString('fr-FR', { weekday: 'short' }),
          sessions: (calendarData.sessions || []).filter(s => s.date === dateStr),
          isPadding: false
        });
      }
    }
    return days;
  };

  const calculateWeeklySummary = () => {
    const summary = {
      totalDuration: 0, swimDuration: 0, bikeDuration: 0, runDuration: 0, strengthDuration: 0,
      totalTss: 0, litCount: 0, mitCount: 0, hitCount: 0
    };

    const activeSessions = generateGridDays().filter(d => !d.isPadding).flatMap(d => d.sessions);

    activeSessions.forEach(s => {
      // 🎯 FIX 2 : Lecture hybride (Prend la durée planifiée, ou à défaut la durée réelle Strava convertie en secondes)
      let duration = s.target_duration || 0;
      if (!duration && s.realized?.duration_minutes) {
        duration = s.realized.duration_minutes * 60;
      }
      
      const tss = s.target_load || s.realized?.actual_load || 0;

      summary.totalDuration += duration;
      summary.totalTss += tss;

      const type = s.type ? s.type.toLowerCase() : 'ride';
      if (type === 'swim') summary.swimDuration += duration;
      else if (type === 'ride' || type === 'bike') summary.bikeDuration += duration;
      else if (type === 'run') summary.runDuration += duration;
      else if (type === 'strength') summary.strengthDuration += duration;

      const zone = s.target_intensity_zone?.toUpperCase();
      if (zone === 'LIT') summary.litCount++;
      else if (zone === 'MIT') summary.mitCount++;
      else if (zone === 'HIT') summary.hitCount++;
    });

    const totalZones = summary.litCount + summary.mitCount + summary.hitCount || 1;
    summary.litPct = Math.round((summary.litCount / totalZones) * 100);
    summary.mitPct = Math.round((summary.mitCount / totalZones) * 100);
    summary.hitPct = Math.round((summary.hitCount / totalZones) * 100);

    return summary;
  };

  const formatVolumeTime = (sec) => {
    if (!sec || isNaN(sec)) return "0:00:00";
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return `${h}:${m.toString().padStart(2, '0')}:00`;
  };

  const todayStr = formatLocalYYYYMMDD(new Date());
  const weeklySummary = calculateWeeklySummary();

  return (
    <div className="space-y-4">
      {/* BARRE INTERNE DE LA GRILLE CALENDRIER */}
      <div className="flex justify-between items-center pt-2">
        <div className="text-xs font-black uppercase text-slate-400 tracking-wider">
          Planification Courante <span className="text-[10px] text-slate-500 ml-1">(Semaine {currentWeekNum} - {isCurrentWeekEven ? 'Paire' : 'Impaire'})</span>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleClearWeek}
            className="flex items-center gap-1.5 bg-slate-900 border border-red-950 text-red-400 hover:bg-red-950/40 px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all"
          >
            <Trash2 size={11}/> Effacer la vue
          </button>
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-lg text-xs font-mono">
            <button onClick={() => { const nd = new Date(currentDate); viewMode === 'week' ? nd.setDate(nd.getDate() - 7) : nd.setMonth(nd.getMonth() - 1); setCurrentDate(nd); }} className="p-1 hover:text-white text-slate-500"><ChevronLeft size={14}/></button>
            <span className="px-2 text-[10px] uppercase font-bold tracking-tight text-slate-300">{viewMode === 'week' ? `Sem. ${currentWeekNum}` : currentDate.toLocaleDateString('fr-FR', {month: 'short', year: 'numeric'})}</span>
            <button onClick={() => { const nd = new Date(currentDate); viewMode === 'week' ? nd.setDate(nd.getDate() + 7) : nd.setMonth(nd.getMonth() + 1); setCurrentDate(nd); }} className="p-1 hover:text-white text-slate-500"><ChevronRight size={14}/></button>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-1 rounded-lg flex gap-1">
            <button onClick={() => setViewMode('week')} className={`px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-all ${viewMode === 'week' ? 'bg-slate-800 text-white' : 'text-slate-500'}`}>Sem</button>
            <button onClick={() => setViewMode('month')} className={`px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-all ${viewMode === 'month' ? 'bg-slate-800 text-white' : 'text-slate-500'}`}>Mois</button>
          </div>
        </div>
      </div>

      {/* HEADER DES JOURS */}
      {viewMode === 'month' && (
        <div className="grid grid-cols-7 gap-2 text-center text-[10px] uppercase font-black text-slate-500 tracking-wider hidden lg:grid">
          {DAYS.map(d => <div key={d}>{d}</div>)}
        </div>
      )}

      {/* GRILLE DU CALENDRIER */}
      {loading ? (
        <div className="h-64 flex items-center justify-center text-slate-600 text-xs tracking-widest uppercase font-mono animate-pulse">Sync SQLite Kernel...</div>
      ) : (
        <div className="space-y-4">
          <div className={`grid gap-3.5 ${
            viewMode === 'week' 
              ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-7' 
              : 'grid-cols-1 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-7'
          }`}>
            {generateGridDays().map((day, idx) => {
              if (day.isPadding) {
                return <div key={day.key} className="hidden lg:block min-h-[120px] bg-slate-950/20 border border-slate-900/40 rounded-xl" />;
              }

              const isToday = day.dateStr === todayStr;

              // 🎯 ANALYSE DES STATUTS DE LA JOURNÉE POUR LE CODE COULEUR
              const hasImprovisé = day.sessions.some(s => s.is_unpredicted);
              const hasMatch = day.sessions.some(s => !s.is_unpredicted && !!s.realized);
              const hasOnlyPlanned = day.sessions.some(s => !s.is_unpredicted && !s.realized);

              let dayBorderClass = 'border-slate-800/80 hover:border-slate-700';
              let dayBgClass = 'bg-slate-900/30';

              if (isToday) {
                dayBorderClass = 'border-blue-500/60 shadow-lg shadow-blue-500/5';
                dayBgClass = 'bg-slate-900/80';
              } else if (hasMatch && !hasOnlyPlanned) {
                // Toutes les séances prévues du jour ont été réalisées !
                dayBorderClass = 'border-emerald-500/30 hover:border-emerald-500/50';
                dayBgClass = 'bg-emerald-950/5';
              } else if (hasImprovisé && day.sessions.length === 1) {
                // Uniquement une sortie Strava non planifiée ce jour-là
                dayBorderClass = 'border-violet-500/30 hover:border-violet-500/50';
                dayBgClass = 'bg-violet-950/5';
              }

              return (
                <div 
                  key={day.dateStr} 
                  className={`p-3 rounded-xl border flex flex-col justify-between transition-all ${
                    viewMode === 'week' ? 'min-h-[180px]' : 'min-h-[130px]'
                  } ${dayBorderClass} ${dayBgClass}`}
                >
                  <div className="flex justify-between items-baseline border-b border-slate-800/60 pb-1.5 mb-2">
                    <span className={`text-[10px] font-black uppercase ${isToday ? 'text-blue-400' : 'text-slate-400'}`}>
                      {day.dayName} {day.dayNum}
                    </span>
                    <span className="text-[8px] text-slate-500 font-mono font-bold uppercase">
                      {day.sessions.length} {day.sessions.length > 1 ? 'selles' : 'sel'}
                    </span>
                  </div>

                  <div className="space-y-2 flex-1 flex flex-col justify-start">
                    {day.sessions.length === 0 ? (
                      <div className="text-[9px] text-slate-600 italic font-medium mt-1">Assimilation</div>
                    ) : (
                      day.sessions.map(session => {
                        // 🎯 EXTRACTION DES STATUTS POUR LA CARTE ENFANT
                        const isMatch = !session.is_unpredicted && !!session.realized;
                        const isImprovisé = !!session.is_unpredicted;

                        return (
                          <WorkoutCard 
                            key={session.id}
                            session={session}
                            isMatch={isMatch}
                            isImprovisé={isImprovisé}
                            onDelete={handleDeleteSession}
                          />
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* BANDEAU DE SYNTHÈSE GLOBAL DU BAS */}
          {viewMode === 'week' && (
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-4 text-xs font-medium text-slate-300 shadow-inner flex flex-col lg:flex-row gap-6 items-center justify-between">
              <div className="w-full lg:w-1/2 min-w-[450px] overflow-x-auto">
                <table className="w-full text-left font-mono text-[11px]">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-500 font-bold uppercase text-[9px] tracking-wider">
                      <th className="pb-1 pl-1 text-left">Volume</th>
                      <th className="pb-1 px-2 text-right">Total</th>
                      <th className="pb-1 px-2 text-right">🏊 Swim</th>
                      <th className="pb-1 px-2 text-right">🚴 Bike</th>
                      <th className="pb-1 px-2 text-right">🏃 Run</th>
                      <th className="pb-1 pr-1 text-right">🏋️ Strength</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-800/40">
                      <td className="py-2 pl-1 text-slate-400 text-left">Prévu</td>
                      <td className="py-2 px-2 font-bold text-slate-200 text-right whitespace-nowrap">{formatVolumeTime(weeklySummary.totalDuration)}</td>
                      <td className="py-2 px-2 text-sky-400 text-right whitespace-nowrap">{formatVolumeTime(weeklySummary.swimDuration)}</td>
                      <td className="py-2 px-2 text-emerald-400 text-right whitespace-nowrap">{formatVolumeTime(weeklySummary.bikeDuration)}</td>
                      <td className="py-2 px-2 text-orange-400 text-right whitespace-nowrap">{formatVolumeTime(weeklySummary.runDuration)}</td>
                      <td className="py-2 pr-1 text-violet-400 text-right whitespace-nowrap">{formatVolumeTime(weeklySummary.strengthDuration)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="w-full lg:flex-1 flex flex-col gap-1.5 px-2">
                <div className="flex justify-between font-mono text-[10px] uppercase text-slate-400 font-bold tracking-wider">
                  <span>Intensity Distribution</span>
                  <span className="text-blue-400">Load: {weeklySummary.totalTss} TSS</span>
                </div>
                <div className="w-full h-3 bg-slate-800 rounded-md overflow-hidden flex shadow-inner">
                  {weeklySummary.litPct > 0 && <div className="h-full bg-green-500 transition-all flex items-center justify-center text-[8px] font-black text-slate-950" style={{ width: `${weeklySummary.litPct}%` }} title="LIT">{weeklySummary.litPct}%</div>}
                  {weeklySummary.mitPct > 0 && <div className="h-full bg-amber-500 transition-all flex items-center justify-center text-[8px] font-black text-slate-950" style={{ width: `${weeklySummary.mitPct}%` }} title="MIT">{weeklySummary.mitPct}%</div>}
                  {weeklySummary.hitPct > 0 && <div className="h-full bg-red-500 transition-all flex items-center justify-center text-[8px] font-black text-white" style={{ width: `${weeklySummary.hitPct}%` }} title="HIT">{weeklySummary.hitPct}%</div>}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}