import React, { useState, useEffect } from 'react';
import axios from 'axios';
import MetricCard from './MetricCard';
import PerformanceCharts from './PerformanceCharts';
import ActivityTable from './ActivityTable';
import RecoveryAdvisor from './RecoveryAdvisor';
import HealthMetricsCharts from './HealthMetricsCharts';
import HealthTable from './HealthTable';
import YearlyRecap from './YearlyRecap';
import HeartRateZonesChart from './HeartRateZonesChart';
import MethodologyCard from './MethodologyCard';
import { Activity } from 'lucide-react';

const API_BASE = "/api";

export default function Dashboard({ user, onLogout }) {
  const [data, setData] = useState({ activities: [], health: [], fitness: [], annualStats: [] });
  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    // ÉTAPE 1 : Affichage immédiat des données du Pi
    loadData();

    // ÉTAPE 2 : Synchro automatique silencieuse
    const autoSync = async () => {
      setLoading(true); // Petit indicateur (le point qui clignote)
      try {
        // On utilise l'endpoint intelligent qui ne récupère que le delta
        const res = await axios.get(`${API_BASE}/sync-strava`);
        console.log("🔄 Synchro Strava terminée", res.data);
        
        // On recharge les données systématiquement pour recalculer 
        // les métriques de forme (TSB/CTL) qui changent chaque jour
        await loadData();
      } catch (err) {
        console.error("Erreur synchro auto:", err);
      } finally {
        setLoading(false);
      }
    };

    autoSync();
  }, []);

  // Ton bouton manuel au cas où
  const handleSync = async () => {
    setLoading(true);
    try { 
      await axios.post(`${API_BASE}/sync/all`); 
      await loadData(); 
    } finally { setLoading(false); }
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
      <main className="w-full max-w-7xl mx-auto px-6 py-10 flex flex-col gap-8">
        
        {/* Header avec état de synchro */}
        <div className="w-full flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-black mb-2 flex items-center gap-3">
              Hello {user?.firstname} ! <span>🔥</span>
              {loading && (
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
              )}
            </h1>
            <p className="text-slate-500 font-medium uppercase text-[10px] tracking-[0.3em]">
              {loading ? "Mise à jour des données Strava..." : "Tes performances sont à jour"}
            </p>
          </div>
          
          {/* Bouton manuel discret si besoin */}
          <button 
            onClick={handleSync}
            disabled={loading}
            className="text-slate-600 hover:text-white transition-colors p-2"
            title="Forcer la synchro complète"
          >
            <Activity size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* ... (Reste du rendu identique) */}
        <div className="md:col-span-1">
           <RecoveryAdvisor data={data.fitness} />
        </div>
        
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
           <MetricCard title="ATL (Fatigue)" label="Fatigue récente (7j)" value={Math.round(currentFit.atl)} color="orange" />
           <MetricCard title="CTL (Fitness)" label="Fitness de fond (42j)" value={Math.round(currentFit.ctl)} color="blue" />
           <MetricCard title="TSB (Forme)" label="Balance CTL - ATL" value={Math.round(currentFit.tsb)} color="emerald" isTsb />
           <MetricCard title="TSS Hebdo" label="Charge 7 derniers jours" value={Math.round(weeklyTSS)} color="purple" trend={tssDiff} />
        </div>

        <YearlyRecap activities={data.activities} />
        <PerformanceCharts fitness={data.fitness} health={data.health} />
        <HeartRateZonesChart activities={data.activities} />
        <HealthMetricsCharts data={data.fitness} />
        <ActivityTable activities={data.activities} />
        <HealthTable data={data.health} />
        <MethodologyCard />
      </main>
    </div>
  );
}