import React, { useState, useEffect } from 'react';
import axios from 'axios';
import MetricCard from '../ui/MetricCard';
import PerformanceCharts from '../dashboard/PerformanceCharts';
import ActivityTable from '../dashboard/ActivityTable';
import RecoveryAdvisor from '../dashboard/RecoveryAdvisor';
import HealthMetricsCharts from '../health/HealthMetricsCharts';
import HealthTable from '../health/HealthTable';
import MethodologyCard from '../ui/MethodologyCard';
import { Activity, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import CoachCalendar from '../calendar/CoachCalendar';

const API_BASE = "/api";

export default function Dashboard({ user, onLogout }) {
  const [data, setData] = useState({ activities: [], health: [], fitness: [], annualStats: [] });
  const [loading, setLoading] = useState(false);
  
  // États pour l'insight quotidien de l'IA
  const [dailyInsight, setDailyInsight] = useState('');
  const [loadingInsight, setLoadingInsight] = useState(false);
  // Nouvel état pour gérer le repli de l'analyse
  const [isExpanded, setIsExpanded] = useState(false);

  // Fonction de chargement pur (Base de données locale -> UI)
  const loadData = async () => {
    try {
      const [resAct, resHealth, resFit, resAnnual] = await Promise.all([
        axios.get(`${API_BASE}/activities`),
        axios.get(`${API_BASE}/health`),
        axios.get(`${API_BASE}/fitness`),
        axios.get(`${API_BASE}/stats/annual`)
      ]);
      setData({ 
        activities: resAct.data, 
        health: resHealth.data, 
        fitness: resFit.data, 
        annualStats: resAnnual.data 
      });
    } catch (err) { 
      console.error("Erreur de chargement local:", err); 
    }
  };

  // Récupération du message du coach IA
  const fetchDailyInsight = async () => {
    setLoadingInsight(true);
    try {
      const res = await axios.get(`${API_BASE}/insights/daily-explanation`);
      setDailyInsight(res.data.insight);
    } catch (err) {
      console.error("Erreur récupération insight IA:", err);
      setDailyInsight("Impossible de charger ton analyse de forme ce matin.");
    } finally {
      setLoadingInsight(false);
    }
  };
  
  useEffect(() => {
    loadData();
    fetchDailyInsight();
  
    const autoSync = async () => {
      if (!user?.userId) {
        console.warn("⚠️ Synchro auto impossible : userId manquant.");
        return;
      }
  
      setLoading(true);
      try {
        const res = await axios.post(`${API_BASE}/sync/all`, { userId: user.userId });
        console.log("🔄 Synchro globale auto terminée", res.data);
        await loadData();
      } catch (err) {
        console.error("❌ Erreur lors de la synchro auto globale:", err.response?.data || err.message);
      } finally {
        setLoading(false);
      }
    };
  
    if (user) {
      autoSync();
    }
  }, [user]);

  const handleSync = async () => {
    if (!user?.userId) {
      console.warn("⚠️ Impossible de synchroniser : userId introuvable.");
      return;
    }
  
    setLoading(true);
    try { 
      await axios.post(`${API_BASE}/sync/all`, { userId: user.userId }); 
      await loadData(); 
      await fetchDailyInsight(); 
    } catch (err) {
      console.error("❌ Erreur lors de la synchro du Dashboard:", err.response?.data || err.message);
    } finally { 
      setLoading(false); 
    }
  };

  // --- LOGIQUE DE CALCUL DES MÉTRIQUES ---
  const currentFit = data.fitness.length > 0 
    ? data.fitness[data.fitness.length - 1] 
    : { ctl: 0, atl: 0, tsb: 0 };

  const weeklyTSS = data.fitness.slice(-7).reduce((acc, day) => acc + (day.total_suffer_score || 0), 0);
  const lastWeeklyTSS = data.fitness.slice(-14, -7).reduce((acc, day) => acc + (day.total_suffer_score || 0), 0);
  const tssDiff = lastWeeklyTSS > 0 ? ((weeklyTSS / lastWeeklyTSS - 1) * 100).toFixed(0) : 0;

  return (
    <div className="min-h-screen w-full bg-slate-950 text-white font-sans flex flex-col">
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col gap-6 sm:gap-8">
        
        {/* Header avec état de synchro */}
        <div className="w-full flex justify-between items-end gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black mb-1 sm:mb-2 flex items-center gap-2 sm:gap-3">
              Hello {user?.firstname} ! <span>🔥</span>
              {loading && (
                <span className="relative flex h-2.5 w-2.5 sm:h-3 sm:w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 sm:h-3 sm:w-3 bg-emerald-500"></span>
                </span>
              )}
            </h1>
            <p className="text-slate-500 font-medium uppercase text-[9px] sm:text-[10px] tracking-[0.2em] sm:tracking-[0.3em]">
              {loading ? "Mise à jour des données Strava..." : "Tes performances sont à jour"}
            </p>
          </div>
          
          <button 
            onClick={handleSync}
            disabled={loading}
            className="text-slate-600 hover:text-white transition-colors p-2 shrink-0"
            title="Forcer la synchro complète"
          >
            <Activity size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* BLOC INSIGHT DU JOUR REVISITÉ ET COHÉRENT */}
        <div className="w-full bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 sm:p-5 relative overflow-hidden shadow-xl">
          
          {/* Header cliquable */}
          <div 
            onClick={() => setIsExpanded(!isExpanded)} 
            className="flex items-center justify-between cursor-pointer select-none"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400">
                <Sparkles size={16} />
              </div>
              <div>
                <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 font-mono">
                  Analyse du Coach
                </h2>
                {dailyInsight && typeof dailyInsight === 'object' && (
                  <span className={`inline-block mt-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    dailyInsight.statusColor === 'emerald' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                    dailyInsight.statusColor === 'amber' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                    'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}>
                    {dailyInsight.status}
                  </span>
                )}
              </div>
            </div>
            
            <button className="text-slate-400 hover:text-white transition-colors p-1 bg-slate-800/40 rounded-lg">
              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>

          {/* Contenu rétractable */}
          {isExpanded && (
            <div className="mt-5 pt-4 border-t border-slate-800/60 space-y-5">
              {loadingInsight ? (
                <div className="space-y-3 animate-pulse">
                  <div className="h-4 bg-slate-800 rounded w-1/3"></div>
                  <div className="h-3 bg-slate-800 rounded w-full"></div>
                  <div className="h-3 bg-slate-800 rounded w-5/6"></div>
                </div>
              ) : dailyInsight && typeof dailyInsight === 'object' ? (
                <div className="flex flex-col gap-5 text-xs sm:text-sm">
                  
                  {/* 1. L'accroche / Intro */}
                  <p className="text-slate-200 font-semibold text-sm sm:text-base border-l-2 border-indigo-500 pl-3">
                    {dailyInsight.intro}
                  </p>

                  {/* Rappel Visuel des Métriques Clés avec la charte couleur du Dashboard */}
                  <div className="flex flex-wrap gap-2 text-[10px] font-bold font-mono uppercase bg-slate-950/30 p-2 rounded-xl border border-slate-800/40 w-fit">
                    <span className="text-slate-500 px-1">Pilotes :</span>
                    <span className="text-orange-500 bg-orange-500/5 px-2 py-0.5 rounded border border-orange-500/10">
                      ATL: {Math.round(currentFit.atl)}
                    </span>
                    <span className="text-blue-500 bg-blue-500/5 px-2 py-0.5 rounded border border-blue-500/10">
                      CTL: {Math.round(currentFit.ctl)}
                    </span>
                    <span className={`px-2 py-0.5 rounded border ${
                      currentFit.tsb < 0 
                        ? 'text-rose-500 bg-rose-500/5 border-rose-500/10' 
                        : 'text-emerald-400 bg-emerald-400/5 border-emerald-400/10'
                    }`}>
                      TSB: {Math.round(currentFit.tsb)}
                    </span>
                    <span className="text-purple-500 bg-purple-500/5 px-2 py-0.5 rounded border border-purple-500/10">
                      TSS 7j: {Math.round(weeklyTSS)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-1">
                    {/* 2. Bloc "Le Pourquoi" en Bullet Points */}
                    <div className="bg-slate-950/40 border border-slate-800/40 rounded-xl p-4">
                      <h3 className="text-slate-400 font-bold uppercase text-[10px] tracking-wider mb-3 font-mono">
                        🔍 Analyse Physiologique
                      </h3>
                      <ul className="space-y-2.5 list-none pl-0">
                        {dailyInsight.whyBullets && dailyInsight.whyBullets.map((bullet, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-slate-300 leading-relaxed font-medium">
                            <span className="text-indigo-400 mt-1 shrink-0">•</span>
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* 3. Bloc "Le Quoi Faire" (Action Terrain) */}
                    <div className={`border rounded-xl p-4 flex flex-col justify-between ${
                      dailyInsight.statusColor === 'emerald' ? 'bg-emerald-950/10 border-emerald-500/20 text-emerald-300' :
                      dailyInsight.statusColor === 'amber' ? 'bg-amber-950/10 border-amber-500/20 text-amber-300' :
                      'bg-rose-950/10 border-rose-500/20 text-rose-300'
                    }`}>
                      <div>
                        <h3 className="font-bold uppercase text-[10px] tracking-wider mb-2 font-mono opacity-80">
                          🎯 Directives d'Entraînement
                        </h3>
                        <p className="leading-relaxed font-semibold text-sm sm:text-base">
                          {dailyInsight.whatToDo}
                        </p>
                      </div>
                    </div>
                  </div>

                </div>
              ) : (
                <p className="text-slate-400 text-xs font-medium">
                  Impossible de charger l'analyse structurée.
                </p>
              )}
            </div>
          )}
        </div>

        <CoachCalendar userId={user?.id} />

        <div className="md:col-span-1">
           <RecoveryAdvisor data={data.fitness} />
        </div>
        
        <div className="w-full grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
           <MetricCard title="ATL (Fatigue)" label="Fatigue (7j)" value={Math.round(currentFit.atl)} color="orange" />
           <MetricCard title="CTL (Fitness)" label="Fitness (42j)" value={Math.round(currentFit.ctl)} color="blue" />
           <MetricCard title="TSB (Forme)" label="Forme" value={Math.round(currentFit.tsb)} color="emerald" isTsb />
           <MetricCard title="TSS Hebdo" label="Charge 7j" value={Math.round(weeklyTSS)} color="purple" trend={tssDiff} />
        </div>

        <PerformanceCharts fitness={data.fitness} health={data.health} />
        <HealthMetricsCharts data={data.fitness} />
        <ActivityTable activities={data.activities} />
        <HealthTable data={data.health} />
        <MethodologyCard />
      </main>
    </div>
  );
}