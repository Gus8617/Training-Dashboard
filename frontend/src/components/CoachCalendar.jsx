// src/components/CoachCalendar.jsx
import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle2, XCircle, Heart, Sliders, LayoutGrid } from 'lucide-react';
import SettingsTabs from './SettingsTabs';

const DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

// Calcule le numéro de semaine ISO de manière fiable
function getWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}

// Formate une date en YYYY-MM-DD local sans le biais d'un décalage UTC
function formatLocalYYYYMMDD(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function CoachCalendar() {
  const [activeTab, setActiveTab] = useState('calendar'); 
  const [viewMode, setViewMode] = useState('week'); 
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [hoursTarget, setHoursTarget] = useState(8);
  
  const [calendarData, setCalendarData] = useState({
    sessions: [],
    fitnessDay: { ctl: 0, atl: 0, tsb: 0, readiness_score: 100 }
  });

  // Détermine la date de début de la période affichée (Lundi pour la semaine)
  const getStartDateStr = () => {
    const d = new Date(currentDate);
    if (viewMode === 'week') {
      const day = d.getDay();
      // Calcule le décalage pour choper le Lundi (1)
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
      console.error("❌ Erreur lors de la récupération du plan:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlan();
  }, [currentDate, viewMode]);

  const handleTriggerArbitrage = async () => {
    if (!window.confirm("Lancer l'analyse et l'adaptation du plan (Arbitrage Garmin/Strava) ?")) return;
    setIsRescheduling(true);
    try {
      const res = await fetch('/api/planning/reschedule', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ userId: 1, weekType: isCurrentWeekEven ? 'even' : 'odd' }) 
      });
      const data = await res.json();
      alert(data.message || `Moteur d'arbitrage exécuté.`);
      fetchPlan();
    } catch (err) {
      console.error(err);
    } finally {
      setIsRescheduling(false);
    }
  };

  const handleGeneratePlan = async () => {
    if (!window.confirm(`Écraser et générer un nouveau bloc théorique ?`)) return;
    setLoading(true);
    try {
      const res = await fetch('/api/planning/generate', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ 
          userId: 1, 
          targetWeeklyHours: parseFloat(hoursTarget), 
          startDate: getStartDateStr(), 
          goalType: 'Triathlon' 
        } // 80/20 Polarisé par défaut
        ) 
      });
      const data = await res.json();
      if (data.success) { 
        alert(data.message); 
        fetchPlan(); 
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const generateGridDays = () => {
    const days = [];
    const start = new Date(getStartDateStr());
    const maxDays = viewMode === 'week' ? 7 : new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    
    for (let i = 0; i < maxDays; i++) {
      const d = new Date(start); 
      d.setDate(start.getDate() + i); 
      const dateStr = formatLocalYYYYMMDD(d);
      
      days.push({ 
        dateStr, 
        dayNum: d.getDate(), 
        dayName: d.toLocaleDateString('fr-FR', { weekday: 'short' }), 
        sessions: (calendarData.sessions || []).filter(s => s.date === dateStr) 
      });
    }
    return days;
  };

  const todayStr = formatLocalYYYYMMDD(new Date());

  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen font-sans antialiased selection:bg-blue-500/30 selection:text-white">
      
      {/* HEADER PRINCIPAL */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50 px-6 py-4 shadow-xl shadow-slate-950/20 backdrop-blur-md bg-opacity-90">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Core Architecture v2.0</span>
            </div>
            <h1 className="text-lg font-black uppercase tracking-tight text-slate-100 mt-0.5">
              Coach Engine <span className="text-blue-500">Hybrid</span>
            </h1>
          </div>

          <nav className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 w-full md:w-auto">
            <button 
              onClick={() => setActiveTab('calendar')}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-150 ${activeTab === 'calendar' ? 'bg-blue-600 text-white font-black shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <LayoutGrid size={14} /> Calendrier Planifié
            </button>
            <button 
              onClick={() => setActiveTab('constraints')}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-150 ${activeTab === 'constraints' ? 'bg-amber-600 text-slate-950 font-black shadow-md shadow-amber-600/10' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <Sliders size={14} /> Réglages & Paramètres
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'calendar' ? (
          <div className="space-y-6">
            
            {/* CONTROLLER DU GÉNÉRATEUR THÉORIQUE */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-900/40 border border-slate-800 p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-blue-400">Générateur Algorithmique Polarisé</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Calcule et injecte un bloc structurel 80% LIT / 20% HIT sur la base des dispo rituelles.</p>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end bg-slate-950/60 p-1.5 border border-slate-800 rounded-xl">
                <input 
                  type="number" 
                  value={hoursTarget} 
                  onChange={(e) => setHoursTarget(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs font-mono text-center w-14 text-blue-400 font-bold focus:outline-none focus:border-blue-500"
                />
                <span className="text-[11px] text-slate-400 font-medium pr-2">h / sem</span>
                <button onClick={handleGeneratePlan} className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] uppercase tracking-wider px-4 py-2 rounded-lg transition-all">
                  Générer le Bloc
                </button>
              </div>
            </div>

            {/* MONITEUR DE CHARGE BANISTER / COGGAN */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl shadow-sm">
                <div className="text-[9px] font-black tracking-widest text-slate-500 uppercase">Fitness Planifié (CTL)</div>
                <div className="text-2xl font-black text-blue-400 mt-1">{calendarData.fitnessDay.ctl.toFixed(1)}</div>
                <div className="w-full bg-slate-800 h-1 rounded-full mt-2 overflow-hidden">
                  <div className="bg-blue-400 h-full" style={{ width: `${Math.min(calendarData.fitnessDay.ctl, 100)}%` }}></div>
                </div>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl shadow-sm">
                <div className="text-[9px] font-black tracking-widest text-slate-500 uppercase">Fatigue Courante (ATL)</div>
                <div className="text-2xl font-black text-amber-500 mt-1">{calendarData.fitnessDay.atl.toFixed(1)}</div>
                <div className="w-full bg-slate-800 h-1 rounded-full mt-2 overflow-hidden">
                  <div className="bg-amber-400 h-full" style={{ width: `${Math.min(calendarData.fitnessDay.atl, 100)}%` }}></div>
                </div>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl shadow-sm">
                <div className="text-[9px] font-black tracking-widest text-slate-500 uppercase">Fraîcheur Nette (TSB)</div>
                <div className={`text-2xl font-black mt-1 ${calendarData.fitnessDay.tsb >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                  {calendarData.fitnessDay.tsb.toFixed(1)}
                </div>
                <div className="text-[9px] text-slate-500 mt-2 font-medium">
                  {calendarData.fitnessDay.tsb < -10 ? 'Zone de Surcharge' : calendarData.fitnessDay.tsb > 5 ? 'Zone d\'Affûtage' : 'Zone d\'Assimilation'}
                </div>
              </div>

              <div className="bg-slate-900 border border-amber-900/20 bg-gradient-to-b from-slate-900 to-amber-950/10 p-4 rounded-xl flex flex-col justify-between shadow-md">
                <div className="flex justify-between items-center border-b border-slate-800 pb-1.5">
                  <div className="text-[9px] font-black tracking-widest text-amber-400 uppercase">Moteur Adaptatif (S.{currentWeekNum})</div>
                  <Heart size={12} className="text-amber-500 " />
                </div>
                <button 
                  onClick={handleTriggerArbitrage} 
                  disabled={isRescheduling} 
                  className="w-full mt-3 bg-slate-950 border border-slate-800 hover:border-amber-500/40 text-[9px] text-slate-200 py-2.5 rounded-lg font-black tracking-wider uppercase transition-all disabled:opacity-50"
                >
                  {isRescheduling ? 'Calcul Arbitrage...' : 'Vérifier Santé Garmin / Adapter'}
                </button>
              </div>
            </div>

            {/* BARRE INTERNE DE LA GRILLE CALENDRIER */}
            <div className="flex justify-between items-center pt-2">
              <div className="text-xs font-black uppercase text-slate-400 tracking-wider">
                Planification Courante <span className="text-[10px] text-slate-500 ml-1">(Semaine {currentWeekNum} - {isCurrentWeekEven ? 'Paire' : 'Impaire'})</span>
              </div>
              <div className="flex items-center gap-2">
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

            {/* GRILLE DU CALENDRIER */}
            {loading ? (
              <div className="h-64 flex items-center justify-center text-slate-600 text-xs tracking-widest uppercase font-mono animate-pulse">Sync SQLite Kernel...</div>
            ) : (
              <div className={`grid gap-3.5 ${viewMode === 'week' ? 'grid-cols-1 md:grid-cols-7' : 'grid-cols-2 sm:grid-cols-4 md:grid-cols-7'}`}>
                {generateGridDays().map(day => {
                  const isToday = day.dateStr === todayStr;
                  return (
                    <div key={day.dateStr} className={`min-h-[170px] p-3 rounded-xl border flex flex-col justify-between transition-all ${isToday ? 'bg-slate-900 border-blue-500/50 shadow-lg shadow-blue-500/5' : 'bg-slate-900/30 border-slate-800/80 hover:border-slate-800'}`}>
                      <div className="flex justify-between items-baseline border-b border-slate-800/60 pb-1.5 mb-2">
                        <span className={`text-[10px] font-black uppercase ${isToday ? 'text-blue-400' : 'text-slate-400'}`}>{day.dayName} {day.dayNum}</span>
                        <span className="text-[8px] text-slate-600 font-mono font-bold uppercase">{day.sessions.length} sél</span>
                      </div>

                      <div className="space-y-1.5 flex-1 flex flex-col justify-start">
                        {day.sessions.length === 0 ? (
                          <div className="text-[9px] text-slate-600 italic font-medium mt-1">Assimilation / Repos</div>
                        ) : (
                          day.sessions.map(session => {
                            let zoneBadge = "border-slate-800 bg-slate-900/60 text-slate-300";
                            if (session.target_intensity_zone === 'LIT') zoneBadge = "border-emerald-500/20 bg-emerald-500/5 text-emerald-400";
                            if (session.target_intensity_zone === 'MIT') zoneBadge = "border-amber-500/20 bg-amber-500/5 text-amber-400";
                            if (session.target_intensity_zone === 'HIT') zoneBadge = "border-rose-500/20 bg-rose-500/5 text-rose-400";

                            return (
                              <div key={session.id} className={`p-2 rounded-lg border text-[10px] transition-transform duration-100 hover:scale-[1.01] ${zoneBadge}`}>
                                <div className="flex justify-between items-start gap-1">
                                  <span className="font-bold tracking-tight line-clamp-1">{session.title}</span>
                                  <span className="text-[8px] font-mono font-black px-1 bg-slate-950/40 rounded uppercase shrink-0 text-slate-400">{session.type}</span>
                                </div>
                                {viewMode === 'week' && session.description && (
                                  <p className="text-[9px] text-slate-400 line-clamp-2 mt-0.5 leading-tight font-medium">{session.description}</p>
                                )}
                                <div className="flex justify-between items-center mt-2 pt-1 border-t border-slate-800/20 text-[8px] text-slate-500 font-mono font-bold">
                                  <span>{session.target_load || 0} TSS</span>
                                  <div>
                                    {session.status === 'completed' && <CheckCircle2 size={10} className="text-emerald-400" />}
                                    {session.status === 'skipped' && <XCircle size={10} className="text-rose-500" />}
                                    {session.status === 'planned' && <div className="w-1 h-1 rounded-full bg-blue-400"></div>}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <SettingsTabs 
            userId={1} 
            currentWeekStartDate={getStartDateStr()} 
            isCurrentWeekEven={isCurrentWeekEven} 
            DAYS={DAYS}
          />
        )}
      </main>
    </div>
  );
}