// src/components/coach/AICoachAssistant.jsx
import React, { useState, useEffect } from 'react';
import { Sparkles, Calendar, ArrowRight, Target } from 'lucide-react';

function getWeekNumber(d) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

export default function AICoachAssistant({ onGenerationSuccess, userTrainingData, currentContext }) {
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('generate_week'); 
  
  // Initialisation par défaut à 4 pour correspondre à la première option du select
  const [durationWeeks, setDurationWeeks] = useState(4);
  
  const [hasTargetEvent, setHasTargetEvent] = useState(false);
  const [targetEventName, setTargetEventName] = useState('');
  const [targetEventDate, setTargetEventDate] = useState('');

  const [sports, setSports] = useState({
    bike: true,
    run: true,
    swim: true,
    strength: false
  });

  const blockOptions = [
    { value: 4, label: '4 Semaines' },
    { value: 8, label: '8 Semaines (2 mois)' },
    { value: 12, label: '12 Semaines (3 mois)' },
    { value: 16, label: '16 Semaines (4 mois)' },
    { value: 20, label: '20 Semaines (5 mois)' },
    { value: 24, label: '24 Semaines (6 mois)' }
  ];

  const [customContext, setCustomContext] = useState('');

  // Alignement automatique de la durée sur la date d'échéance
  useEffect(() => {
    if (hasTargetEvent && targetEventDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const eventDate = new Date(targetEventDate);
      eventDate.setHours(0, 0, 0, 0);

      const timeDiff = eventDate.getTime() - today.getTime();
      
      if (timeDiff > 0) {
        const weeksRemaining = Math.ceil(timeDiff / (1000 * 60 * 60 * 24 * 7));
        setDurationWeeks(weeksRemaining);
      } else {
        setDurationWeeks(1); // Valeur de secours si la date est passée
      }
    } else if (!hasTargetEvent) {
      // Si on décoche l'échéance, on rétablit une valeur par défaut cohérente (ex: 4)
      setDurationWeeks(4);
    }
  }, [hasTargetEvent, targetEventDate]);

  const toggleSport = (sport) => {
    setSports(prev => ({ ...prev, [sport]: !prev[sport] }));
  };

  const selectTriathlon = () => {
    setSports({ bike: true, run: true, swim: true, strength: sports.strength });
  };

  const handleAction = async () => {
    setLoading(true);
    try {
      // 1. On récupère la date du jour exacte au format local YYYY-MM-DD
      const today = new Date();
      const tzOffset = today.getTimezoneOffset() * 60000;
      const localISODate = new Date(today.getTime() - tzOffset).toISOString().split('T')[0];

      const payload = {
        mode,
        durationWeeks: Number(durationWeeks),
        currentContext: {
          // On donne la priorité à la date passée par le parent, sinon on force la date du jour
          startDate: currentContext?.startDate || localISODate,
          isWeekEven: currentContext?.isWeekEven ?? (getWeekNumber(today) % 2 === 0),
          ...currentContext
        },
        sportsSelected: Object.keys(sports).filter(k => sports[k]),
        customNotes: customContext.trim() || null,
        metrics: {
          ctl: userTrainingData?.ctl || 65,
          tsb: userTrainingData?.tsb || -5,
          weeklyTssTarget: userTrainingData?.weeklyTssTarget || 450,
          currentWeekPerformance: userTrainingData?.currentWeekPerformance || null,
        },
        targetEvent: hasTargetEvent ? {
          name: targetEventName,
          date: targetEventDate
        } : null
      };

      console.log("➡️ [COACH ENGINE] Payload envoyé à l'API :", payload);

      const response = await fetch('/api/coach/coach-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        throw new Error(`Erreur HTTP [${response.status}]`);
      }
      
      const rawResult = await response.json();
      console.log("⬅ *[COACH ENGINE] Réponse JSON brute du serveur :", rawResult);

      let finalJson = null;

      if (rawResult?.success && rawResult?.text) {
        if (typeof rawResult.text === 'object') {
          finalJson = rawResult.text;
        } else if (typeof rawResult.text === 'string') {
          let cleanText = rawResult.text.trim();
          if (cleanText.includes('```')) {
            cleanText = cleanText.split('```json')[1] 
              ? cleanText.split('```json')[1].split('```')[0] 
              : cleanText.split('```')[1].split('```')[0];
          }
          finalJson = JSON.parse(cleanText.trim());
        }
      }

      if (!finalJson) {
        throw new Error("Impossible d'extraire un objet JSON valide de la réponse du serveur.");
      }

      console.log("✅ [COACH ENGINE] Structure finale validée :", finalJson);
      onGenerationSuccess(finalJson);

    } catch (error) {
      console.error("❌ Erreur du moteur IA Coach :", error);
      alert(`Erreur lors de la génération :\n${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800/80 p-5 rounded-2xl space-y-6">
      
      {/* SECTION 1 : ENTÊTE ET MODE */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-800/60 pb-4">
        <div>
          <h4 className="text-xs font-black uppercase tracking-wider text-blue-400 flex items-center gap-1.5 font-mono">
            <Sparkles size={13} /> Assistant IA Coach
          </h4>
          <p className="text-[11px] text-slate-400 mt-0.5">Planification dynamique & sur-mesure</p>
        </div>
        
        {/* SÉLECTEUR DE MODE DE GÉNÉRATION */}
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px] font-bold">
          <button
            type="button"
            onClick={() => setMode('generate_week')}
            className={`px-3 py-1.5 rounded-lg transition-all ${mode === 'generate_week' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Nouveau bloc
          </button>
          <button
            type="button"
            onClick={() => setMode('adjust_week')}
            className={`px-3 py-1.5 rounded-lg transition-all ${mode === 'adjust_week' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Ajustement fatigue
          </button>
        </div>
      </div>

      {/* SECTION 2 : CONFIGURATION DE LA PÉRIODE */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        
        {/* BLOC HORIZON TEMPOREL */}
        <div className="bg-slate-950/40 border border-slate-800/50 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <label htmlFor="duration-select" className="text-[10px] uppercase tracking-wider font-black text-slate-400 flex items-center gap-1.5 mb-2.5">
              <Calendar size={13} className="text-blue-400" /> Horizon de planification
            </label>
            <div className="relative">
              <select 
                id="duration-select"
                value={durationWeeks} 
                disabled={hasTargetEvent && !!targetEventDate}
                onChange={e => setDurationWeeks(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-[11px] font-bold rounded-xl px-3 py-3 focus:border-blue-500 focus:outline-none appearance-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {hasTargetEvent && !!targetEventDate ? (
                  <option value={durationWeeks}>{durationWeeks} {durationWeeks > 1 ? 'Semaines' : 'Semaine'} (Calculé jusqu'à l'échéance)</option>
                ) : (
                  blockOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))
                )}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                </svg>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-slate-500 mt-3 pl-0.5">
            {hasTargetEvent && !!targetEventDate 
              ? "Verrouillé : synchronisé sur la date de l'échéance cible."
              : "L'IA va calibrer la progressivité du TSS semaine après semaine."}
          </p>
        </div>

        {/* BLOC SELECTION DES SPORTIFS */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-[10px] uppercase tracking-wider font-black text-slate-400 block">Disciplines cibles</span>
            <button 
              onClick={selectTriathlon}
              type="button"
              className="text-[9px] font-bold text-blue-400 hover:text-blue-300 uppercase tracking-wider"
            >
              Sélection Triathlon
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'bike', label: '🚴 Cyclisme', color: 'emerald', accent: 'accent-emerald-500', bg: 'bg-emerald-950/20 border-emerald-500/30 text-emerald-400' },
              { id: 'run', label: '🏃 Course à pied', color: 'orange', accent: 'accent-orange-500', bg: 'bg-orange-950/20 border-orange-500/30 text-orange-400' },
              { id: 'swim', label: '🏊 Natation', color: 'sky', accent: 'accent-sky-500', bg: 'bg-sky-950/20 border-sky-500/30 text-sky-400' },
              { id: 'strength', label: '🏋️ Renforcement', color: 'violet', accent: 'accent-violet-500', bg: 'bg-violet-950/20 border-violet-500/30 text-violet-400' }
            ].map((sport) => (
              <button
                key={sport.id}
                onClick={() => toggleSport(sport.id)}
                type="button"
                className={`p-2.5 rounded-xl border text-[11px] font-bold text-left flex items-center justify-between transition-all ${sports[sport.id] ? sport.bg : 'bg-slate-950 border-slate-800 text-slate-500'}`}
              >
                <span>{sport.label}</span>
                <input 
                  type="checkbox" 
                  checked={sports[sport.id]} 
                  readOnly 
                  className={`rounded border-slate-800 ${sport.accent} h-3 w-3`} 
                />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SECTION 3 : OBJECTIF / FOCUS TECHNIQUE */}
      <div className="bg-slate-950/30 border border-slate-800/60 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <label htmlFor="target-toggle" className="text-[10px] uppercase tracking-wider font-black text-slate-400 flex items-center gap-1.5 cursor-pointer">
            <Target size={13} className="text-blue-500" /> Préparer une compétition ou une échéance majeure
          </label>
          <input 
            id="target-toggle"
            type="checkbox" 
            checked={hasTargetEvent} 
            onChange={(e) => setHasTargetEvent(e.target.checked)}
            className="rounded border-slate-800 accent-blue-500 h-3.5 w-3.5 cursor-pointer"
          />
        </div>

        {hasTargetEvent && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 animate-fadeIn text-[11px]">
            <input 
              type="text" 
              aria-label="Nom de l'échéance"
              placeholder="Nom de l'évènement (ex: La Ferté Macé)" 
              value={targetEventName}
              onChange={(e) => setTargetEventName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-2.5 py-2 focus:border-blue-500 focus:outline-none placeholder:text-slate-600"
            />
            <input 
              type="date" 
              aria-label="Date de l'échéance"
              value={targetEventDate}
              onChange={(e) => setTargetEventDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-2.5 py-2 focus:border-blue-500 focus:outline-none"
            />
          </div>
        )}
      </div>

      {/* SECTION 4 : CONTEXTE LIBRE */}
      <div>
        <label htmlFor="notes-textarea" className="text-[10px] uppercase tracking-wider font-black text-slate-500 block mb-1.5">
          Contraintes de la semaine ou retours de sensations
        </label>
        <textarea
          id="notes-textarea"
          rows="2"
          value={customContext}
          onChange={(e) => setCustomContext(e.target.value)}
          placeholder="Ex: Dispo uniquement entre milieu et deux le mardi, focus foncier en endurance fondamentale, fatigue accumulée sur les ischios..."
          className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-[11px] rounded-xl px-3 py-2.5 focus:border-blue-500 focus:outline-none placeholder:text-slate-600 resize-none"
        />
      </div>

      {/* BOUTON D'ACTION DYNAMIQUE */}
      <button
        onClick={handleAction}
        disabled={loading || !Object.values(sports).some(Boolean)}
        type="button"
        className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-[11px] py-3.5 rounded-xl font-black tracking-wider uppercase transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-950/40 disabled:opacity-30 disabled:pointer-events-none"
      >
        {loading ? (
          <>
            <svg className="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>
              {mode === 'generate_week' 
                ? `Modélisation du plan (${durationWeeks} sem.) en cours...` 
                : 'Calcul de l\'ajustement de fatigue...'}
            </span>
          </>
        ) : (
          <>
            <span>
              {mode === 'generate_week' 
                ? `Générer les ${durationWeeks} semaines` 
                : 'Ajuster le bloc selon la fatigue'}
            </span>
            <ArrowRight size={13} />
          </>
        )}
      </button>
    </div>
  );
}