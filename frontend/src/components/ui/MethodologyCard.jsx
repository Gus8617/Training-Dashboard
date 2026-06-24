import React from 'react';
// Correction ici : Info avec une majuscule
import { Info, Calculator, Zap, Heart } from 'lucide-react';

const MethodologyCard = () => {
  const hrCoeffs = [
    { zone: 'Z1', coeff: 1.0, color: 'text-emerald-400', label: 'Récup' },
    { zone: 'Z2', coeff: 1.2, color: 'text-blue-400', label: 'Endurance' },
    { zone: 'Z3', coeff: 2.2, color: 'text-yellow-400', label: 'Tempo' },
    { zone: 'Z4', coeff: 4.5, color: 'text-orange-400', label: 'Seuil' },
    { zone: 'Z5', coeff: 9.0, color: 'text-red-400', label: 'Anaérobie' },
  ];

  return (
    <div className="p-8 rounded-[2.5rem] border border-slate-800 bg-slate-900/50 shadow-2xl backdrop-blur-md">
      {/* Titre */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 bg-blue-500/10 rounded-xl text-blue-400">
          <Calculator size={20} />
        </div>
        <div>
          <h3 className="text-white font-bold text-lg leading-none">Algorithme & Méthodologie</h3>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">Version 1.2 • Modèle Coggan & Banister</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Section 1 : Custom Suffer Score */}
        <div className="space-y-4">
          <h4 className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
            <Zap size={14} className="text-yellow-400" /> Calcul du Custom Score (TSS)
          </h4>
          <p className="text-slate-400 text-xs leading-relaxed">
            Pondération du temps passé dans chaque zone cardiaque.
          </p>
          
          <div className="flex flex-wrap gap-2">
            {hrCoeffs.map((c) => (
              <div key={c.zone} className="flex-1 min-w-[80px] p-3 rounded-2xl bg-slate-800/40 border border-slate-700/30 text-center">
                <span className={`block font-black text-sm ${c.color}`}>{c.zone}</span>
                <span className="block text-[9px] text-slate-500 uppercase font-bold mb-1">{c.label}</span>
                <span className="text-white text-xs font-black">×{c.coeff.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Section 2 : Readiness Balance */}
        <div className="space-y-4">
          <h4 className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
            <Heart size={14} className="text-pink-400" /> Pondération du Readiness
          </h4>
          <div className="space-y-3">
            {[
              { label: 'HRV (Système Nerveux)', weight: '35%', desc: 'Déviation vs Moyenne 7j' },
              { label: 'Sommeil (Qualité)', weight: '30%', desc: 'Profondeur & Récupération' },
              { label: 'TSB (Forme)', weight: '20%', desc: 'Fitness vs Fatigue (CTL/ATL)' },
              { label: 'RHR (Repos)', weight: '15%', desc: 'Cœur au repos vs Moyenne' },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between p-3 rounded-2xl bg-slate-800/20 border border-slate-700/20">
                <div>
                  <p className="text-white text-xs font-bold">{item.label}</p>
                  <p className="text-[9px] text-slate-500 font-medium">{item.desc}</p>
                </div>
                <span className="text-blue-400 font-black text-xs">{item.weight}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-8 pt-6 border-t border-slate-800 flex items-center gap-3">
        {/* Correction ici aussi : Info avec une majuscule */}
        <Info size={14} className="text-slate-600" />
        <p className="text-[9px] text-slate-600 font-bold uppercase leading-relaxed">
          Le Fitness (CTL) est lissé sur 42 jours. La Fatigue (ATL) sur 7 jours. Le TSB optimal pour la performance se situe entre -10 et +5.
        </p>
      </div>
    </div>
  );
};

export default MethodologyCard;