// src/components/coach/CoachWorkspace.jsx
import React, { useState, useRef } from 'react';
import { Upload, Sliders, LayoutGrid, Eye, AlertTriangle, Plus, X, CalendarDays, EyeOff } from 'lucide-react';
import SettingsTabs from '../settings/SettingsTabs';
import ActiveProgramManager from './ActiveProgramManager';
import AICoachAssistant from './AICoachAssistant';

const DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

const TYPE_COLORS = {
  swim: 'text-sky-400 bg-sky-950/40 border-sky-900/50',
  ride: 'text-emerald-400 bg-emerald-950/40 border-emerald-900/50',
  bike: 'text-emerald-400 bg-emerald-950/40 border-emerald-900/50',
  run: 'text-orange-400 bg-orange-950/40 border-orange-900/50',
  strength: 'text-violet-400 bg-violet-950/40 border-violet-900/50'
};

const getTypeColor = (type) => TYPE_COLORS[type?.toLowerCase()] || 'text-slate-400 bg-slate-950/40 border-slate-900/50';

function getWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}

export default function CoachWorkspace() {
  const [activeSubTab, setActiveSubTab] = useState('generator');
  const [loading, setLoading] = useState(false);
  const [previewSessions, setPreviewSessions] = useState([]);
  const [isCalendarVisible, setIsCalendarVisible] = useState(false);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newSession, setNewSession] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'Ride',
    title: '',
    duration_minutes: '',
    target_load: '',
    target_intensity_zone: 'LIT',
    description: ''
  });

  const fileInputRef = useRef(null);
  const programManagerRef = useRef(null);

  const today = new Date();
  const currentWeekNum = getWeekNumber(today);
  const isCurrentWeekEven = currentWeekNum % 2 === 0;

  const getStartDateStr = () => {
    const d = new Date(today);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const processAndSetPreview = (rawData) => {
    if (!rawData) return;
    
    const sessionsArray = rawData.sessions && Array.isArray(rawData.sessions) 
      ? rawData.sessions 
      : (Array.isArray(rawData) ? rawData : null);

    if (sessionsArray) {
      const normalized = sessionsArray.map(s => ({
        ...s,
        title: s.title || s.name || 'Séance sans titre',
        duration_minutes: s.duration_minutes || s.duration || null,
        target_load: s.target_load || s.tss || null
      }));
      setPreviewSessions(normalized);
    } else {
      alert("Format de données invalide. Un tableau de séances ou un objet contenant une clé 'sessions' est requis.");
    }
  };

  const handleJsonLoadPreview = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsedData = JSON.parse(event.target.result);
        processAndSetPreview(parsedData);
      } catch (err) {
        alert("Erreur de parsing du fichier JSON.");
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = async () => {
    if (previewSessions.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch('/api/program/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 1, programData: previewSessions }) 
      });
      const data = await res.json();
      if (data.success) {
        alert("Le planning théorique a été mis à jour avec succès !");
        setPreviewSessions([]);
        programManagerRef.current?.fetchActiveProgram();
        window.dispatchEvent(new Event('reload-calendar'));
      } else {
        alert(`Erreur serveur: ${data.error}`);
      }
    } catch (err) {
      alert("Erreur réseau lors de l'importation.");
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAddManualSession = async (e) => {
    e.preventDefault();
    
    const payload = {
      userId: 1,
      ...newSession,
      duration_minutes: newSession.duration_minutes ? parseInt(newSession.duration_minutes, 10) : null,
      target_load: newSession.target_load ? parseInt(newSession.target_load, 10) : null,
    };

    try {
      const res = await fetch('/api/program/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setIsAddModalOpen(false);
        setNewSession({
          date: new Date().toISOString().split('T')[0],
          type: 'Ride',
          title: '',
          duration_minutes: '',
          target_load: '',
          target_intensity_zone: 'LIT',
          description: ''
        });
        programManagerRef.current?.fetchActiveProgram();
        window.dispatchEvent(new Event('reload-calendar'));
      } else {
        alert(`Erreur : ${data.error}`);
      }
    } catch (err) {
      alert("Erreur réseau lors de la création de la séance.");
    }
  };

  return (
    <div className="space-y-6">
      {/* SOUS-NAVBAR DU CO-PILOTE COACH */}
      <div className="flex justify-between items-center border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-md font-black uppercase tracking-tight text-slate-100">
            Coach Workspace <span className="text-blue-500">Intelligence</span>
          </h2>
          <p className="text-[11px] text-slate-500">Injecte des blocs d'entraînement complexes et pilote ta progression via l'IA.</p>
        </div>
        
        <nav className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button 
            onClick={() => setActiveSubTab('generator')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${activeSubTab === 'generator' ? 'bg-blue-600 text-white font-black' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <LayoutGrid size={12} /> Assistant & Injecteur
          </button>
          <button 
            onClick={() => setActiveSubTab('constraints')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${activeSubTab === 'constraints' ? 'bg-amber-600 text-slate-950 font-black' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <Sliders size={12} /> Contraintes Hebdo
          </button>
        </nav>
      </div>

      {activeSubTab === 'generator' ? (
        <div className="space-y-6">
          {/* SECTION : INJECTEUR / CHARGEUR JSON */}
          <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-blue-400">Gestion et Injection des Programmes</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Ajoute une séance ciblée manuellement ou charge un calendrier complet via fichier JSON.</p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <input 
                type="file" 
                accept=".json" 
                ref={fileInputRef}
                onChange={handleJsonLoadPreview} 
                className="hidden" 
              />
              
              {/* Le bouton de toggle est ici */}
              <button
                type="button"
                onClick={() => setIsCalendarVisible(!isCalendarVisible)}
                className={`border text-[10px] uppercase tracking-wider px-3 py-2.5 rounded-xl font-bold transition-all flex items-center justify-center gap-1.5 ${isCalendarVisible ? 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-300' : 'bg-blue-950/40 border-blue-800/60 text-blue-400 hover:bg-blue-900/30'}`}
              >
                {isCalendarVisible ? <EyeOff size={13} /> : <CalendarDays size={13} />}
                <span>{isCalendarVisible ? "Masquer flux" : "Afficher flux"}</span>
              </button>

              <button 
                onClick={() => setIsAddModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-500 text-white font-black text-[10px] uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-900/20"
              >
                <Plus size={12} /> Créer une séance
              </button>
              <button 
                onClick={() => fileInputRef.current?.click()} 
                className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-[10px] uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-md"
              >
                <Upload size={12} /> Charger JSON
              </button>
            </div>
          </div>

          {/* SÉCURITÉ : VUE DE CONFIRMATION DES SÉANCES */}
          {previewSessions.length > 0 && (
            <div className="bg-slate-900 border border-blue-500/30 rounded-2xl p-5 space-y-4 shadow-xl shadow-blue-950/5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Eye size={16} className="text-blue-400" />
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-200">Séances en attente de validation ({previewSessions.length})</h4>
                    <p className="text-[10px] text-amber-500 flex items-center gap-1 mt-0.5 font-medium">
                      <AlertTriangle size={10} /> Valider écrasera le programme théorique existant sur la période correspondante.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setPreviewSessions([])} className="bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 font-bold text-[9px] uppercase tracking-wider px-4 py-2 rounded-xl transition-all">Annuler</button>
                  <button onClick={handleConfirmImport} disabled={loading} className="bg-blue-600 hover:bg-blue-500 text-white font-black text-[9px] uppercase tracking-wider px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 shadow-md">{loading ? "Injection..." : "Confirmer et Injecter"}</button>
                </div>
              </div>
              <div className="max-h-[250px] overflow-y-auto border border-slate-800/60 bg-slate-950/50 rounded-xl font-mono text-[11px] divide-y divide-slate-900">
                {previewSessions.map((session, idx) => (
                  <div key={idx} className="p-3 flex items-center justify-between gap-4 hover:bg-slate-900/40 transition-colors">
                    <div className="flex items-center gap-4">
                      <span className="text-slate-500 font-bold w-20">{session.date}</span>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wide border ${getTypeColor(session.type)}`}>{session.type}</span>
                      <span className="text-slate-300 font-sans font-medium truncate max-w-[200px] sm:max-w-[350px]">{session.title}</span>
                    </div>
                    <div className="flex items-center gap-6 shrink-0 text-right">
                      {session.duration_minutes && <span className="text-slate-400">{session.duration_minutes} min</span>}
                      {session.target_load && <span className="text-blue-400 font-bold">{session.target_load} TSS</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MANAGER DU PROGRAMME PREVISIONNEL EN COURS */}
          {isCalendarVisible && (
            <div className="transition-all animate-fadeIn">
              <ActiveProgramManager ref={programManagerRef} getTypeColor={getTypeColor} />
            </div>
          )}

          {/* GENERATEUR ET ADAPTATEUR IA UNIQUE */}
          <div className="w-full">
            <AICoachAssistant 
              currentContext={{
                userId: 1,
                startDate: getStartDateStr(),
                isWeekEven: isCurrentWeekEven
              }}
              onGenerationSuccess={(generatedData) => {
                processAndSetPreview(generatedData);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }} 
            />
          </div>
        </div>
      ) : (
        <SettingsTabs userId={1} currentWeekStartDate={getStartDateStr()} isCurrentWeekEven={isCurrentWeekEven} DAYS={DAYS} />
      )}

      {/* MODALE : CREATION MANUELLE */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 relative space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-100 flex items-center gap-2"><Plus size={14} className="text-blue-500" /> Planifier une séance unitaire</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-200"><X size={16} /></button>
            </div>
            <form onSubmit={handleAddManualSession} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold uppercase tracking-wide text-[10px] mb-1">Date</label>
                  <input type="date" required value={newSession.date} onChange={(e) => setNewSession({...newSession, date: e.target.value})} className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-2" />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold uppercase tracking-wide text-[10px] mb-1">Sport</label>
                  <select value={newSession.type} onChange={(e) => setNewSession({...newSession, type: e.target.value})} className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-2">
                    <option value="Ride">🚴 Cyclisme (Ride)</option>
                    <option value="Run">🏃 Course à pied (Run)</option>
                    <option value="Swim">🏊 Natation (Swim)</option>
                    <option value="Strength">🏋️ Renforcement (Strength)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-slate-400 font-bold uppercase tracking-wide text-[10px] mb-1">Titre de la séance</label>
                <input type="text" required placeholder="Ex: Seuil 3x10min" value={newSession.title} onChange={(e) => setNewSession({...newSession, title: e.target.value})} className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-2" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold uppercase tracking-wide text-[10px] mb-1">Durée (min)</label>
                  <input type="number" placeholder="60" value={newSession.duration_minutes} onChange={(e) => setNewSession({...newSession, duration_minutes: e.target.value})} className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-2" />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold uppercase tracking-wide text-[10px] mb-1">Charge (TSS)</label>
                  <input type="number" placeholder="55" value={newSession.target_load} onChange={(e) => setNewSession({...newSession, target_load: e.target.value})} className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-2" />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold uppercase tracking-wide text-[10px] mb-1">Zone d'Intensité</label>
                  <select value={newSession.target_intensity_zone} onChange={(e) => setNewSession({...newSession, target_intensity_zone: e.target.value})} className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-2">
                    <option value="LIT">🟢 LIT (Basse)</option>
                    <option value="MIT">🟡 MIT (Modérée)</option>
                    <option value="HIT">🔴 HIT (Haute)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-slate-400 font-bold uppercase tracking-wide text-[10px] mb-1">Description</label>
                <textarea rows="3" placeholder="Détails..." value={newSession.description} onChange={(e) => setNewSession({...newSession, description: e.target.value})} className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-2" />
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-800 pt-3">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="bg-slate-950 border border-slate-800 text-slate-400 px-4 py-2 rounded-xl">Annuler</button>
                <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-xl">Enregistrer la séance</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}