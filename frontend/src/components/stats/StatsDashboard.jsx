import React, { useState, useEffect } from 'react';
import axios from 'axios';
import HeartRateZonesChart from './HeartRateZonesChart';
import YearlyRecap from './YearlyRecap';

const API_BASE = "/api";

export default function StatsDashboard({ user }) {
  const [data, setData] = useState({ activities: [], health: [], fitness: [] });
  const [loading, setLoading] = useState(false);

  const loadStatsData = async () => {
    setLoading(true);
    try {
      const [resAct, resHealth, resFit] = await Promise.all([
        axios.get(`${API_BASE}/activities`),
        axios.get(`${API_BASE}/health`),
        axios.get(`${API_BASE}/fitness`)
      ]);
      setData({
        activities: resAct.data,
        health: resHealth.data,
        fitness: resFit.data
      });
    } catch (err) {
      console.error("Erreur de chargement des analyses :", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatsData();
  }, []);

  if (loading && !data.fitness.length) {
    return (
      <div className="h-96 flex items-center justify-center text-slate-600 text-xs tracking-widest uppercase font-mono animate-pulse">
        Calcul des cinétiques de charge...
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-6 py-10 flex flex-col gap-8">
      
      {/* Titre de la vue Analyses */}
      <div>
        <h1 className="text-4xl font-black mb-2 flex items-center gap-3">
          Analyses de Performance <span>📊</span>
        </h1>
      </div>

      {/* Rendu des composants de statistiques isolés */}
      <YearlyRecap activities={data.activities} />
      <HeartRateZonesChart activities={data.activities} />

    </div>
  );
}