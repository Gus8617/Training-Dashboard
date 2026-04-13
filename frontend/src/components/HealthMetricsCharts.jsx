import React, { useState, useLayoutEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, AreaChart, Area, ReferenceArea } from 'recharts';
import { Activity, Heart, ArrowDown, ArrowUp, TrendingUp, TrendingDown } from 'lucide-react';

const HealthCharts = ({ data = [] }) => {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 200 });

  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        if (entry.contentRect.width > 0) {
          setDimensions({ width: Math.floor(entry.contentRect.width - 10), height: 180 });
        }
      }
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.unobserve(containerRef.current);
  }, []);

  const chartData = data.slice(-30).map((entry, index, array) => {
    const start = Math.max(0, index - 6);
    const subset = array.slice(start, index + 1);
    const hrvVal = entry.hrv || 0;
    const rhrVal = entry.resting_hr || entry.restingHR || 0;
    
    const avgHRV = subset.reduce((acc, curr) => acc + (curr.hrv || 0), 0) / subset.length;
    const avgRHR = subset.reduce((acc, curr) => acc + (curr.resting_hr || curr.restingHR || 0), 0) / subset.length;

    return {
      ...entry,
      display_rhr: rhrVal,
      dynamic_hrv_baseline: Math.round(avgHRV),
      dynamic_rhr_baseline: Math.round(avgRHR)
    };
  });

  // Calcul des tendances (7 derniers jours vs 7 précédents)
  const getTrend = (key) => {
    if (data.length < 14) return { val: 0, status: 'stable' };
    const last7 = data.slice(-7).reduce((acc, d) => acc + (d[key] || 0), 0) / 7;
    const prev7 = data.slice(-14, -7).reduce((acc, d) => acc + (d[key] || 0), 0) / 7;
    const diff = ((last7 / prev7 - 1) * 100).toFixed(1);
    
    // Logique métier : HRV haut = bien, RHR bas = bien
    let status = 'stable';
    if (key === 'hrv') status = diff > 2 ? 'good' : diff < -2 ? 'bad' : 'stable';
    if (key === 'resting_hr' || key === 'restingHR') status = diff < -2 ? 'good' : diff > 2 ? 'bad' : 'stable';
    
    return { diff, status };
  };

  const hrvTrend = getTrend('hrv');
  const rhrTrend = getTrend('resting_hr');
  const last = chartData[chartData.length - 1] || {};

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      
      {/* CARD HRV */}
      <div className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 shadow-xl">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-xs font-black flex items-center gap-2 text-slate-500 uppercase tracking-[0.2em]">
              <Activity size={16} className="text-purple-500" /> HRV Nocturne
            </h3>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-4xl font-black text-white">{last.hrv || '--'}</span>
              <span className="text-slate-600 font-mono text-sm">ms</span>
            </div>
          </div>
          <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase ${
            hrvTrend.status === 'good' ? 'bg-emerald-500/10 text-emerald-500' : 
            hrvTrend.status === 'bad' ? 'bg-orange-500/10 text-orange-500' : 'bg-slate-800 text-slate-400'
          }`}>
            {hrvTrend.status === 'good' ? <ArrowUp size={12}/> : <ArrowDown size={12}/>}
            {Math.abs(hrvTrend.diff)}% <span className="opacity-50 ml-1">7J</span>
          </div>
        </div>
        
        <div ref={containerRef} className="w-full h-[180px]">
          {dimensions.width > 0 && (
            <LineChart width={dimensions.width} height={dimensions.height} data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
              <XAxis dataKey="date" hide />
              <YAxis domain={['dataMin - 10', 'dataMax + 10']} hide />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', fontSize: '12px' }}
                itemStyle={{ color: '#8b5cf6' }}
              />
              {/* Baseline grise pour voir l'écart à la moyenne */}
              <Line type="monotone" dataKey="dynamic_hrv_baseline" stroke="#334155" strokeWidth={2} strokeDasharray="5 5" dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="hrv" stroke="#8b5cf6" strokeWidth={4} dot={{ r: 4, fill: '#8b5cf6', strokeWidth: 0 }} activeDot={{ r: 6 }} isAnimationActive={true} />
            </LineChart>
          )}
        </div>
      </div>

      {/* CARD FC REPOS */}
      <div className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 shadow-xl">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-xs font-black flex items-center gap-2 text-slate-500 uppercase tracking-[0.2em]">
              <Heart size={16} className="text-red-500" /> FC Repos
            </h3>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-4xl font-black text-white">{last.display_rhr || '--'}</span>
              <span className="text-slate-600 font-mono text-sm">BPM</span>
            </div>
          </div>
          <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase ${
            rhrTrend.status === 'good' ? 'bg-emerald-500/10 text-emerald-500' : 
            rhrTrend.status === 'bad' ? 'bg-orange-500/10 text-orange-500' : 'bg-slate-800 text-slate-400'
          }`}>
            {rhrTrend.status === 'good' ? <ArrowDown size={12}/> : <ArrowUp size={12}/>}
            {Math.abs(rhrTrend.diff)}% <span className="opacity-50 ml-1">7J</span>
          </div>
        </div>

        <div className="w-full h-[180px]">
          {dimensions.width > 0 && (
            <AreaChart width={dimensions.width} height={dimensions.height} data={chartData}>
              <defs>
                <linearGradient id="colorRhr" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="date" hide />
              <YAxis domain={['dataMin - 5', 'dataMax + 5']} hide />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', fontSize: '12px' }}
                itemStyle={{ color: '#ef4444' }}
              />
              <Area type="monotone" dataKey="display_rhr" stroke="#ef4444" fill="url(#colorRhr)" strokeWidth={4} dot={{ r: 4, fill: '#ef4444', strokeWidth: 0 }} isAnimationActive={true} />
              <Line type="monotone" dataKey="dynamic_rhr_baseline" stroke="#334155" strokeWidth={2} strokeDasharray="5 5" dot={false} />
            </AreaChart>
          )}
        </div>
      </div>

    </div>
  );
};

export default HealthCharts;