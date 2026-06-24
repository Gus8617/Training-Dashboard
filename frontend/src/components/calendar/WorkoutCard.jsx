// src/components/calendar/WorkoutCard.jsx
import React, { useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import WorkoutBlockChart from './WorkoutBlockChart';

function WorkoutCard({ session, isMatch, isImprovisé, onDelete }) {
  const [isOpen, setIsOpen] = useState(false);

  const getTypeStyle = (type) => {
    const t = type?.toLowerCase();
    switch (t) {
      case 'swim': 
        return { icon: '🏊', label: 'Natation', color: 'text-sky-400', bg: 'bg-sky-500/10 border-sky-500/20' };
      case 'ride': case 'bike': 
        return { icon: '🚴', label: 'Vélo', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' };
      case 'run': 
        return { icon: '🏃', label: 'Course', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' };
      case 'strength': 
        return { icon: '🏋️', label: 'Renforcement', color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20' };
      case 'combo': 
        return { icon: '🔥', label: 'Combo', color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' };
      case 'race': 
        return { icon: '🏅', label: 'Race', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' };
      default: 
        return { icon: '💪', label: type || 'Séance', color: 'text-slate-400', bg: 'bg-slate-800 border-slate-700' };
    }
  };

  const getIntensityColors = (zone) => {
    switch (zone) {
      case 'HIT': return { text: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30', badge: 'bg-rose-600 text-white' };
      case 'MIT': return { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', badge: 'bg-amber-500 text-slate-950' };
      case 'LIT': default: return { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', badge: 'bg-emerald-500 text-slate-950' };
    }
  };

  const formatDurationCompact = (sec) => {
    if (!sec) return '0m';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (h > 0) return m > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h`;
    return `${m}m`;
  };

  // 🎯 CHOIX DU THÈME VISUEL DE LA CARTE SELON LE STATUT D'ARBITRAGE
  let cardStatusClass = "bg-slate-900/90 border-slate-800/80 text-slate-300 hover:bg-slate-800/60 hover:border-slate-700";
  let titleDecoration = "text-slate-200";
  let statusMiniLabel = null;

  if (isMatch) {
    cardStatusClass = "bg-emerald-950/20 border-emerald-500/30 hover:border-emerald-500/50 shadow-emerald-950/20";
    titleDecoration = "text-emerald-200/80 line-through decoration-emerald-500/30";
    statusMiniLabel = <span className="text-[7px] bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-extrabold px-1 rounded">DONE</span>;
  } else if (isImprovisé) {
    cardStatusClass = "bg-violet-950/20 border-violet-500/30 hover:border-violet-500/50 shadow-violet-950/20";
    titleDecoration = "text-violet-300";
    statusMiniLabel = <span className="text-[7px] bg-violet-500/20 border border-violet-500/30 text-violet-400 font-extrabold px-1 rounded">STRAVA</span>;
  }

  const typeStyle = getTypeStyle(session.type);
  const intensity = getIntensityColors(session.target_intensity_zone);

  // Hybridation des data réelles / cibles pour l'affichage
  const durationInSeconds = isImprovisé 
    ? (session.realized?.duration_minutes * 60) 
    : (session.target_duration || (session.duration_minutes * 60) || 0);

  const chargeTss = isImprovisé 
    ? session.realized?.actual_load 
    : (session.target_load || session.target_load_tss || null);

  const displayTitle = isImprovisé ? session.realized?.name : (session.title || 'Séance sans titre');

  return (
    <>
      {/* 1. LA CARTE MINIATURE TEMPORALISÉE */}
      <div 
        onClick={() => setIsOpen(true)}
        className={`relative z-10 pointer-events-auto border rounded-xl p-2 shadow-md group transition-all cursor-pointer select-none flex flex-col gap-1.5 w-full min-w-0 ${cardStatusClass}`}
      >
        {/* Suppression autorisée uniquement s'il ne s'agit pas d'une séance Strava pure */}
        {!isImprovisé && (
          <button 
            onClick={(e) => {
              e.stopPropagation(); 
              onDelete(session.id);
            }}
            className="absolute top-1.5 left-1.5 opacity-100 sm:opacity-0 group-hover:opacity-100 text-slate-600 hover:text-rose-500 text-[10px] transition-opacity p-0.5 z-20"
            title="Supprimer la séance"
          >
            ✕
          </button>
        )}

        {/* En-tête de la carte miniature */}
        <div className={`flex justify-between items-start gap-1 min-w-0 ${!isImprovisé ? 'pl-3.5' : ''}`}>
          <div className="flex flex-col gap-0.5 min-w-0">
            <h4 className={`font-bold text-[10px] sm:text-[11px] leading-tight line-clamp-2 shrink min-w-0 ${titleDecoration}`} title={displayTitle}>
              {displayTitle}
            </h4>
            {statusMiniLabel && <div className="mt-0.5">{statusMiniLabel}</div>}
          </div>
          
          {chargeTss ? (
            <span className={`text-[9px] font-mono font-black rounded-full w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center shrink-0 shadow-sm ${isMatch || isImprovisé ? 'bg-slate-950 text-slate-300 border border-slate-800' : intensity.badge}`}>
              {chargeTss}
            </span>
          ) : null}
        </div>

        {/* Graphique masqué si impro (pas de profil d'exercice théorique) */}
        {!isImprovisé && (
          <div className="hidden md:block">
            <WorkoutBlockChart description={session.description} zone={session.target_intensity_zone} isMini={true} />
          </div>
        )}

        {/* Pied de la carte miniature */}
        <div className="flex justify-between items-center text-[10px] font-medium pt-1 border-t border-slate-800/40 text-slate-400 whitespace-nowrap min-w-0 gap-1">
          <span className="flex items-center gap-1 min-w-0">
            <span className="text-xs shrink-0">{typeStyle.icon}</span>
            <span className="hidden sm:inline text-[9px] uppercase tracking-wider font-bold text-slate-500 truncate">{typeStyle.label}</span>
          </span>
          <span className="font-mono text-slate-300 font-bold tracking-tighter shrink-0">
            {formatDurationCompact(durationInSeconds)}
          </span>
        </div>
      </div>

      {/* 2. MODE MODAL ENRICHIE AVEC DONNÉES DE CORRÉLATION */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" 
          onClick={() => setIsOpen(false)}
        >
          <div 
            className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 flex flex-col gap-4 text-left transform transition-all overflow-hidden"
            onClick={(e) => e.stopPropagation()} 
          >
            <div className="flex justify-between items-start gap-4">
              <div className="flex flex-col gap-1.5">
                <span className={`inline-flex items-center gap-1.5 text-xs uppercase tracking-widest font-black px-2.5 py-1 rounded-md border w-fit ${typeStyle.bg} ${typeStyle.color}`}>
                  <span>{typeStyle.icon}</span>
                  <span>{typeStyle.label}</span>
                </span>
                <h3 className="text-lg font-black text-slate-100 leading-snug tracking-tight">
                  {displayTitle}
                </h3>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-200 bg-slate-800/50 hover:bg-slate-800 p-2 rounded-full transition-colors font-mono text-sm h-8 w-8 flex items-center justify-center shrink-0"
              >
                ✕
              </button>
            </div>

            {/* Grille Métriques Comparatives (Réel vs Prévu) */}
            <div className="grid grid-cols-3 gap-2 bg-slate-950/40 border border-slate-800/60 p-3 rounded-xl font-mono text-xs">
              <div className="flex flex-col gap-0.5 border-r border-slate-800/60">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Durée</span>
                <span className="text-sm font-bold text-slate-200">
                  {isMatch ? (
                    <span>
                      {Math.round(session.duration_minutes)}m 
                      <span className="text-emerald-400 font-bold ml-1">→ {Math.round(session.realized?.duration_minutes)}m</span>
                    </span>
                  ) : (
                    `${Math.round(durationInSeconds / 60)} min`
                  )}
                </span>
              </div>
              <div className="flex flex-col gap-0.5 pl-3 border-r border-slate-800/60">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Charge (TSS)</span>
                <span className={`text-sm font-bold ${isMatch ? 'text-slate-300' : typeStyle.color}`}>
                  {isMatch ? (
                    <span>
                      {session.target_load}
                      <span className="text-emerald-400 font-bold ml-1">/{session.realized?.actual_load}</span>
                    </span>
                  ) : (
                    chargeTss || '--'
                  )}
                </span>
              </div>
              <div className="flex flex-col gap-0.5 pl-3">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Type Flux</span>
                <span className={`text-sm font-bold ${isImprovisé ? 'text-violet-400' : isMatch ? 'text-emerald-400' : 'text-blue-400'}`}>
                  {isImprovisé ? 'Improvisé' : isMatch ? 'Matché OK' : 'Théorique'}
                </span>
              </div>
            </div>

            {/* Affichage conditionnel des blocs ou données Strava */}
            {isMatch && session.realized && (
              <div className="bg-emerald-950/10 p-3.5 border border-emerald-900/30 rounded-xl text-xs font-sans text-emerald-300/90 flex flex-col gap-1">
                <span className="font-mono text-[9px] uppercase font-bold text-emerald-500 tracking-wider">Données Strava associées</span>
                <p className="font-semibold text-slate-200 text-[13px]">"{session.realized.name}"</p>
                {session.realized.distance_km && <p>⚡ Distance : {session.realized.distance_km} km</p>}
              </div>
            )}

            {!isImprovisé && (
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80">
                <span className="text-[10px] font-mono uppercase font-bold text-slate-500 tracking-wider block mb-2">Profil d'exercice cible</span>
                <WorkoutBlockChart description={session.description} zone={session.target_intensity_zone} isMini={false} />
              </div>
            )}

            {session.description && !isImprovisé && (
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-mono uppercase font-bold text-slate-500 tracking-wider">Instructions détaillées</span>
                <div className="text-sm text-slate-300 bg-slate-950/60 border border-slate-800/40 p-4 rounded-xl whitespace-pre-line leading-relaxed font-sans max-h-48 overflow-y-auto">
                  {session.description}
                </div>
              </div>
            )}

            <div className="flex justify-between items-center pt-2 mt-1 border-t border-slate-800/60 text-xs font-mono text-slate-500">
              <span className="flex items-center gap-1.5 capitalize">
                Statut : <span className="text-slate-300 font-bold">{isImprovisé ? 'Strava Unpredicted' : isMatch ? 'Completed' : session.status || 'planned'}</span>
                {(isMatch || session.status === 'completed') && <CheckCircle2 size={11} className="text-emerald-400" />}
                {session.status === 'skipped' && <XCircle size={11} className="text-rose-500" />}
              </span>
              {session.start_time && (
                <span>Planifié à {session.start_time}</span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default WorkoutCard;