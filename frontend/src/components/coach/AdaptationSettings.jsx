import React, { useState, useEffect } from 'react';
import { Sliders, Clock, Trash2, CalendarDays, Dumbbell } from 'lucide-react';

const DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const SPORTS = [
  { value: 'Swim', label: '🏊 Natation' },
  { value: 'Bike', label: '🚴 Vélo' },
  { value: 'Run', label: '🏃 Course' },
  { value: 'Strength', label: '🏋️ Renfo' }
];

// =========================================================================
// 🔓 SOUS-COMPOSANT 1 : PLAGES HORAIRES (DISPOS / VERROUS)
// =========================================================================
function AvailabilityManager({ userId, currentWeekStartDate, isCurrentWeekEven }) {
  const [availabilities, setAvailabilities] = useState([]);
  const [mode, setMode] = useState('date'); // 'date' ou 'recurring'
  const [startMins, setStartMins] = useState(720); // 12:00
  const [endMins, setEndMins] = useState(810);   // 13:30
  const [form, setForm] = useState({ 
    recurrence_type: 'weekdays',
    day_of_week: 1, 
    specific_date: new Date().toISOString().split('T')[0],
    is_blocked: 0, 
    week_alternation: 'all'
  });

  const minsToHHMM = (mins) => {
    const h = Math.floor(mins / 60).toString().padStart(2, '0');
    const m = (mins % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  };

  const handleStartChange = (val) => {
    const newStart = parseInt(val, 10);
    setStartMins(newStart);
    if (newStart >= endMins) setEndMins(Math.min(newStart + 30, 1425));
  };

  const fetchAvailabilities = async () => {
    try {
      const weekType = isCurrentWeekEven ? 'even' : 'odd';
      const res = await fetch(`/api/constraints/${userId}?startDate=${currentWeekStartDate}&weekType=${weekType}`);
      const data = await res.json();
      if (data.success) setAvailabilities(data.constraints);
    } catch (err) { console.error("Erreur chargement contraintes:", err); }
  };

  useEffect(() => { fetchAvailabilities(); }, [currentWeekStartDate, isCurrentWeekEven, userId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      let daysPayload = -1;

      // Détermination des jours à envoyer selon le type de récurrence choisi
      if (mode === 'recurring') {
        if (form.recurrence_type === 'weekdays') {
          // Du Lundi (1) au Vendredi (5)
          daysPayload = [1, 2, 3, 4, 5];
        } else if (form.recurrence_type === 'all_days') {
          // Les 7 jours de la semaine : Dimanche (0) à Samedi (6)
          daysPayload = [0, 1, 2, 3, 4, 5, 6];
        } else {
          // Mode 'single' : Un seul jour sélectionné dans le <select>
          daysPayload = parseInt(form.day_of_week, 10);
        }
      }

      const payload = {
        user_id: parseInt(userId, 10),
        mode: mode,
        day_of_week: daysPayload, // Envoie le chiffre unique OU le tableau [1,2,3,4,5]
        specific_date: mode === 'date' ? form.specific_date : null,
        start_time: minsToHHMM(startMins),
        end_time: minsToHHMM(endMins),
        is_blocked: parseInt(form.is_blocked, 10),
        week_alternation: mode === 'recurring' ? form.week_alternation : 'all'
      };

      const res = await fetch('/api/constraints/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (data.success) {
        fetchAvailabilities();
      } else {
        alert(`Erreur: ${data.error}`);
      }
    } catch (err) { 
      console.error("Erreur soumission contrainte:", err); 
    }
  };

  const handleDelete = async (slot) => {

    try {
      await fetch('/api/constraints/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId, 
          day_of_week: slot.day_of_week, 
          specific_date: slot.specific_date || "",
          start_time: slot.start_time, 
          week_alternation: slot.week_alternation || 'all'
        })
      });
      fetchAvailabilities();
    } catch (err) { console.error(err); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
      <form onSubmit={handleSubmit} className="lg:col-span-1 space-y-4 bg-slate-950 p-4 rounded-xl border border-slate-800/80">
        <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 w-full">
          <button type="button" onClick={() => setMode('date')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${mode === 'date' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400'}`}>Date Précise</button>
          <button type="button" onClick={() => setMode('recurring')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${mode === 'recurring' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400'}`}>Récurrent</button>
        </div>

        {mode === 'date' ? (
          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1">Date exacte</label>
            <input type="date" value={form.specific_date} onChange={e => setForm({...form, specific_date: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm text-white" />
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">Répétition</label>
              <div className="grid grid-cols-3 gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
                {['weekdays', 'single', 'all_days'].map(t => (
                  <button key={t} type="button" onClick={() => setForm({...form, recurrence_type: t})} className={`py-1.5 text-[10px] font-bold rounded-md uppercase ${form.recurrence_type === t ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>
                    {t === 'weekdays' ? 'Semaine' : t === 'single' ? '1 Jour' : '7j/7'}
                  </button>
                ))}
              </div>
            </div>

            {form.recurrence_type === 'single' && (
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">Jour de la semaine</label>
                <select value={form.day_of_week} onChange={e => setForm({...form, day_of_week: parseInt(e.target.value, 10)})} className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm text-slate-200">
                  {DAYS.map((name, idx) => <option key={idx} value={idx}>{name}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">Alternance Semaines</label>
              <div className="grid grid-cols-3 gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
                {['all', 'even', 'odd'].map(a => (
                  <button key={a} type="button" onClick={() => setForm({...form, week_alternation: a})} className={`py-1.5 text-[10px] font-black rounded-md uppercase ${form.week_alternation === a ? 'bg-purple-600 text-white' : 'text-slate-400'}`}>
                    {a === 'all' ? 'Toutes' : a === 'even' ? 'Paires' : 'Impaires'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-3">
          <div className="flex justify-between text-xs font-mono font-bold text-indigo-400">
            <span>Intervalle</span>
            <span>{minsToHHMM(startMins)} - {minsToHHMM(endMins)}</span>
          </div>
          <input type="range" min="300" max="1380" step="15" value={startMins} onChange={e => handleStartChange(e.target.value)} className="w-full h-2 bg-slate-800 rounded-lg appearance-none accent-indigo-500" />
          <input type="range" min="330" max="1425" step="15" value={endMins} onChange={e => setEndMins(parseInt(e.target.value, 10))} className="w-full h-2 bg-slate-800 rounded-lg appearance-none accent-indigo-500" />
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-300">Type de disponibilité sur ce créneau</label>
          <div className="grid grid-cols-1 gap-2">
            <div 
              onClick={() => setForm({...form, is_blocked: 0})}
              className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all select-none ${form.is_blocked === 0 ? 'bg-emerald-950/20 border-emerald-500/50 text-emerald-300' : 'bg-slate-900/40 border-slate-800 text-slate-400'}`}
            >
              <div className={`w-2 h-2 rounded-full ${form.is_blocked === 0 ? 'bg-emerald-400' : 'bg-slate-600'}`} />
              <div className="text-xs leading-tight">
                <span className="font-bold block">Créneau Ouvert</span>
                <p className="text-[11px] opacity-70 mt-0.5">Idéal pour n'importe quel type de séance (extérieure incluse).</p>
              </div>
            </div>

            <div 
              onClick={() => setForm({...form, is_blocked: 1})}
              className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all select-none ${form.is_blocked === 1 ? 'bg-amber-950/20 border-amber-500/50 text-amber-300' : 'bg-slate-900/40 border-slate-800 text-slate-400'}`}
            >
              <div className={`w-2 h-2 rounded-full ${form.is_blocked === 1 ? 'bg-amber-400' : 'bg-slate-600'}`} />
              <div className="text-xs leading-tight">
                <span className="font-bold block">Hybride / Indoor Uniquement</span>
                <p className="text-[11px] opacity-70 mt-0.5">Pas de sortie route/CAP. Home Trainer ou renforcement uniquement.</p>
              </div>
            </div>

            <div 
              onClick={() => setForm({...form, is_blocked: 2})}
              className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all select-none ${form.is_blocked === 2 ? 'bg-rose-950/20 border-rose-500/50 text-rose-300' : 'bg-slate-900/40 border-slate-800 text-slate-400'}`}
            >
              <div className={`w-2 h-2 rounded-full ${form.is_blocked === 2 ? 'bg-rose-400' : 'bg-slate-600'}`} />
              <div className="text-xs leading-tight">
                <span className="font-bold block">Verrouillé Strict</span>
                <p className="text-[11px] opacity-70 mt-0.5">Indisponibilité totale ou repos. Le coach n'y touchera pas.</p>
              </div>
            </div>
          </div>
        </div>

        <button type="submit" className="w-full bg-indigo-600 py-3 rounded-xl text-xs font-bold text-white shadow-lg">Enregistrer le créneau</button>
      </form>

      <div className="lg:col-span-2 space-y-2 max-h-[480px] overflow-y-auto pr-1">
        {availabilities.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-slate-800 rounded-xl text-slate-500 text-xs uppercase tracking-wider font-mono">
            Aucune contrainte sur cette semaine
          </div>
        ) : (
          availabilities.map((c, i) => (
            <div key={i} className="flex justify-between items-center p-3 bg-slate-950 border border-slate-800 rounded-xl">
              <div>
                <span className="font-bold text-xs text-slate-200 flex items-center gap-1">
                  {c.specific_date ? <CalendarDays size={12} className="text-indigo-400"/> : null}
                  {DAYS[c.day_of_week] || (c.day_of_week === -1 && "Date Spécifique")}
                </span>
                <div className="flex items-center gap-2 mt-1 text-xs">
                  <span className="font-mono bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 font-bold text-slate-400">{c.start_time} - {c.end_time}</span>
                  {c.week_alternation && c.week_alternation !== 'all' && (
                    <span className="text-[9px] px-1.5 bg-purple-500/10 text-purple-400 rounded uppercase font-black">
                      S. {c.week_alternation === 'even' ? 'Paire' : 'Impaire'}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {c.is_blocked === 2 ? (
                  <span className="text-[10px] bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded border border-rose-500/20 font-bold">Lock Strict</span>
                ) : c.is_blocked === 1 ? ( // <--- Vérifie bien que c'est 1 ici
                  <span className="text-[10px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded border border-amber-500/20 font-bold">Indoor Only</span>
                ) : (
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 font-bold">Open Slot</span>
                )}
                <button onClick={() => handleDelete(c)} className="p-2 text-slate-500 hover:text-rose-400"><Trash2 size={14} /></button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// =========================================================================
// 🏋️ SOUS-COMPOSANT 2 : ENTRAÎNEMENTS FIXES & RITUELS
// =========================================================================
function RecurringSessionsManager({ userId }) {
  const [sessions, setSessions] = useState([]);
  
  const initialFormState = {
    day_of_week: 2, 
    week_alternation: 'all',
    title: '',
    type: 'Swim',
    target_intensity_zone: 'LIT',
    target_duration: 3600, // 60 minutes par défaut, stockées en secondes
    target_load: 45,
    start_time: '19:30',
    description: ''
  };

  const [form, setForm] = useState(initialFormState);

  const fetchSessions = async () => {
    try {
      const res = await fetch(`/api/recurring-sessions/${userId}`);
      const data = await res.json();
      if (data.success) setSessions(data.sessions);
    } catch (err) { console.error("Erreur rituels:", err); }
  };

  useEffect(() => { fetchSessions(); }, [userId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return alert("Donne un titre à la séance (ex: Club Natation)");
    
    try {
      const payload = {
        user_id: parseInt(userId, 10),
        day_of_week: parseInt(form.day_of_week, 10),
        week_alternation: form.week_alternation || 'all',
        title: form.title.trim(),
        type: form.type,
        target_intensity_zone: form.target_intensity_zone || 'LIT',
        target_duration: parseInt(form.target_duration, 10), // Déjà en secondes !
        target_load: parseInt(form.target_load, 10) || 0,
        start_time: form.start_time?.trim() || null,
        description: form.description?.trim() || ""
      };

      const res = await fetch('/api/recurring-sessions/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (data.success) {
        fetchSessions();
        setForm(initialFormState); 

      } else {
        alert(`Erreur: ${data.error}`);
      }
    } catch (err) { 
      console.error("Erreur soumission rituel:", err); 
    }
  };

  const handleDelete = async (id) => {
    try {
      await fetch(`/api/recurring-sessions/delete/${id}`, { method: 'DELETE' });
      fetchSessions();
    } catch (err) { console.error(err); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
      <form onSubmit={handleSubmit} className="lg:col-span-1 space-y-4 bg-slate-950 p-4 rounded-xl border border-slate-800/80">
        <div>
          <label className="block text-[11px] font-bold text-slate-400 mb-1">Nom de l'entraînement</label>
          <input type="text" placeholder="ex: Natation Club - Seuil" value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm text-white" />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1">Jour</label>
            <select value={form.day_of_week} onChange={e => setForm({...form, day_of_week: parseInt(e.target.value, 10)})} className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200">
              {DAYS.map((name, idx) => <option key={idx} value={idx}>{name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1">Heure (Optionnel)</label>
            <input type="text" placeholder="19:30" value={form.start_time} onChange={e => setForm({...form, start_time: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-center font-mono text-white" />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-400 mb-1">Discipline</label>
          <div className="grid grid-cols-2 gap-1.5">
            {SPORTS.map(s => (
              <button key={s.value} type="button" onClick={() => setForm({...form, type: s.value})} className={`py-2 text-xs font-bold rounded-xl border transition-all ${form.type === s.value ? 'bg-indigo-600 border-indigo-500 text-white shadow' : 'bg-slate-900 border-slate-800 text-slate-400'}`}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1">Durée (min)</label>
            {/* L'input affiche des minutes à l'utilisateur, mais met à jour l'état en secondes */}
            <input 
              type="number" 
              value={form.target_duration / 60} 
              onChange={e => setForm({...form, target_duration: (parseInt(e.target.value, 10) || 0) * 60})} 
              className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-center font-mono text-white" 
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1">Charge estimée (TSS)</label>
            <input type="number" value={form.target_load} onChange={e => setForm({...form, target_load: parseInt(e.target.value, 10)})} className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-center font-mono text-indigo-400 font-bold" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1">Zone d'intensité</label>
            <select value={form.target_intensity_zone} onChange={e => setForm({...form, target_intensity_zone: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-slate-200">
              <option value="LIT">Fond / Endurance (LIT)</option>
              <option value="MIT">Tempo / Seuil (MIT)</option>
              <option value="HIT">Fractionné / VMA (HIT)</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1">Alternance</label>
            <select value={form.week_alternation} onChange={e => setForm({...form, week_alternation: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-purple-400 font-bold">
              <option value="all">Toutes les semaines</option>
              <option value="even">Semaines Paires</option>
              <option value="odd">Semaines Impaires</option>
            </select>
          </div>
        </div>

        <button type="submit" className="w-full bg-indigo-600 py-3.5 rounded-xl text-xs font-bold text-white shadow-lg">Bloquer cet entraînement ritualisé</button>
      </form>

      <div className="lg:col-span-2 space-y-2 max-h-[480px] overflow-y-auto pr-1">
        {!sessions || sessions.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-slate-800 rounded-xl text-slate-500 text-xs uppercase tracking-wider font-mono">
            Aucune séance rituelle enregistrée
          </div>
        ) : (
          sessions.map((s) => {
            const currentId = s.session_id || s.id;
            const displayMinutes = s.target_duration ? Math.round(s.target_duration / 60) : 0;

            return (
              <div key={currentId} className="flex justify-between items-center p-3.5 bg-slate-950 border border-slate-800 rounded-xl hover:border-slate-700 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-lg">
                    {s.type === 'Swim' ? '🏊' : s.type === 'Bike' ? '🚴' : s.type === 'Run' ? '🏃' : '🏋️'}
                  </div>
                  <div>
                    <span className="font-extrabold text-sm text-slate-200 block">{s.title}</span>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400 mt-1">
                      <span className="font-bold text-indigo-400">{DAYS[s.day_of_week]}</span>
                      {s.start_time && <span className="font-mono text-slate-500">à {s.start_time}</span>}
                      <span className="w-1 h-1 rounded-full bg-slate-700"></span>
                      <span className="font-mono bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 text-[11px] text-slate-300 font-bold">{displayMinutes} min</span>
                      <span className="font-mono text-indigo-400 font-black bg-indigo-500/5 px-1.5 border border-indigo-500/10 rounded text-[11px]">{s.target_load} TSS</span>
                      {s.week_alternation && s.week_alternation !== 'all' && (
                        <span className="text-[10px] px-1.5 bg-purple-500/10 text-purple-400 rounded uppercase font-black">
                          S. {s.week_alternation === 'even' ? 'Paire' : 'Impaire'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => handleDelete(currentId)} 
                  className="p-2 text-slate-500 hover:text-rose-400 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function SettingsTabs({ userId = 1, currentWeekStartDate, isCurrentWeekEven }) {
  const [subTab, setSubTab] = useState('times');

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 text-slate-100 max-w-5xl mx-auto shadow-xl">
      <div className="border-b border-slate-800 pb-4 mb-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-lg font-black tracking-tight text-slate-100 flex items-center gap-2">
            <Sliders size={18} className="text-indigo-500"/> Panneau de Configuration
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Ajuste tes filtres et rituels d'entraînement</p>
        </div>

        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 w-full sm:w-auto">
          <button onClick={() => setSubTab('times')} className={`flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${subTab === 'times' ? 'bg-indigo-600 text-white font-black' : 'text-slate-400'}`}>
            <Clock size={13}/> Heures & Dispos
          </button>
          <button onClick={() => setSubTab('sessions')} className={`flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${subTab === 'sessions' ? 'bg-indigo-600 text-white font-black' : 'text-slate-400'}`}>
            <Dumbbell size={13}/> Séances Fixes / Club
          </button>
        </div>
      </div>

      {subTab === 'times' ? (
        <AvailabilityManager userId={userId} currentWeekStartDate={currentWeekStartDate} isCurrentWeekEven={isCurrentWeekEven} />
      ) : (
        <RecurringSessionsManager userId={userId} />
      )}
    </div>
  );
}