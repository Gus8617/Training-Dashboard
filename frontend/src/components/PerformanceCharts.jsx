import React, { useState, useEffect } from 'react';
import { TrendingUp, Moon, Activity } from 'lucide-react';
import { 
  AreaChart, Area, BarChart, Bar, LineChart, Line, 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';

export default function PerformanceCharts({ fitness = [], health = [] }) {
  const [isMobile, setIsMobile] = useState(false);

  // Détection du mobile pour ajuster la quantité de données
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (!fitness.length && !health.length) {
    return <div className="p-10 text-center text-slate-500 bg-slate-900 rounded-[2.5rem] border border-slate-800">En attente de données...</div>;
  }

  // On réduit drastiquement sur mobile pour garder de la clarté
  const fitnessSlice = isMobile ? fitness.slice(-14) : fitness.slice(-30);
  const healthSlice = isMobile ? health.slice(-7) : health.slice(-14);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
      
      {/* COURBE DE PERFORMANCE (CTL/ATL/TSB) */}
      <div className="bg-slate-900 p-6 md:p-8 rounded-[2.5rem] border border-slate-800 shadow-xl">
        <div className="flex justify-between items-center mb-8">
          <h3 className="text-xs font-black flex items-center gap-3 text-slate-400 uppercase tracking-widest">
            <TrendingUp size={18} className="text-blue-500" /> État de Forme
          </h3>
          <span className="text-[10px] font-bold text-slate-600 bg-slate-800 px-2 py-1 rounded-md">
            {isMobile ? '14 JOURS' : '30 JOURS'}
          </span>
        </div>
        
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={fitnessSlice} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorCtl" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis 
              dataKey="date" 
              tickFormatter={(str) => str.split('-')[2]} 
              stroke="#475569" 
              fontSize={10} 
              tickLine={false}
              axisLine={false}
            />
            <YAxis stroke="#475569" fontSize={10} axisLine={false} tickLine={false} />
            <Tooltip 
              contentStyle={{backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', fontSize: '12px'}}
              itemStyle={{padding: '2px 0'}}
            />
            {/* Ligne d'équilibre : au dessus = frais, en dessous = fatigué */}
            <ReferenceLine y={0} stroke="#475569" strokeDasharray="3 3" />
            
            <Area type="monotone" dataKey="ctl" stroke="#3b82f6" strokeWidth={3} fill="url(#colorCtl)" name="Fitness (CTL)" isAnimationActive={false} />
            <Area type="monotone" dataKey="atl" stroke="#f59e0b" strokeWidth={2} fill="transparent" name="Fatigue (ATL)" isAnimationActive={false} />
            <Line type="monotone" dataKey="tsb" stroke="#10b981" strokeWidth={2} dot={false} name="Forme (TSB)" isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* RÉCUPÉRATION (SOMMEIL & HRV) */}
      <div className="bg-slate-900 p-6 md:p-8 rounded-[2.5rem] border border-slate-800 shadow-xl">
        <div className="flex justify-between items-center mb-8">
          <h3 className="text-xs font-black flex items-center gap-3 text-slate-400 uppercase tracking-widest">
            <Moon size={18} className="text-purple-500" /> Sommeil vs HRV
          </h3>
          <span className="text-[10px] font-bold text-slate-600 bg-slate-800 px-2 py-1 rounded-md">
            {isMobile ? '7 JOURS' : '14 JOURS'}
          </span>
        </div>

        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={healthSlice} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis 
              dataKey="date" 
              tickFormatter={(str) => str.split('-')[2]} 
              stroke="#475569" 
              fontSize={10} 
              tickLine={false}
              axisLine={false}
            />
            <YAxis yAxisId="left" stroke="#3b82f6" fontSize={10} axisLine={false} tickLine={false} />
            <YAxis yAxisId="right" orientation="right" stroke="#8b5cf6" fontSize={10} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', fontSize: '12px'}} />
            
            <Bar 
              yAxisId="left" 
              dataKey="duration" 
              fill="#3b82f6" 
              opacity={0.6}
              radius={[4, 4, 0, 0]} 
              name="Sommeil (min)" 
              barSize={isMobile ? 20 : 30}
            />
            <Line 
              yAxisId="right" 
              type="monotone" 
              dataKey="hrv" 
              stroke="#8b5cf6" 
              strokeWidth={4} 
              dot={{fill: '#8b5cf6', r: 4, strokeWidth: 0}} 
              name="HRV" 
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}