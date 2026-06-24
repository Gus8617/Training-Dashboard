// src/components/coach/ActiveProgramManager.jsx
import React, { useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import { Trash2, Edit3, ShieldAlert, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import EditWorkoutModal from './EditWorkoutModal';

const ActiveProgramManager = forwardRef(({ getTypeColor }, ref) => {
  const [sessions, setSessions] = useState([]);
  const [editingSession, setEditingSession] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // 🎯 ÉTAPE 1 : État pour gérer la date pivot du calendrier (initialisé au 1er du mois en cours)
  const [currentAnchorDate, setCurrentAnchorDate] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  // Convertit une date en YYYY-MM-DD local propre pour l'API
  const formatYYYYMMDD = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Récupère le nom du mois pour l'affichage (ex: "Juin 2026")
  const getMonthLabel = (date) => {
    return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  };

  const fetchActiveProgram = async () => {
    setLoading(true);
    try {
      const startDateStr = formatYYYYMMDD(currentAnchorDate);
      
      // 📡 Appel calé sur le mois sélectionné
      const res = await fetch(`/api/planning?startDate=${startDateStr}&view=month&userId=1`);
      const data = await res.json();
      if (data.success) {
        setSessions(data.days || []);
      }
    } catch (err) {
      console.error("Erreur récupération via l'endpoint de planification:", err);
    } finally {
      setLoading(false);
    }
  };

  // Expose la méthode au parent
  useImperativeHandle(ref, () => ({
    fetchActiveProgram
  }));

  // 🎯 ÉTAPE 2 : Déclenche le fetch dès que le mois pivot change
  useEffect(() => {
    fetchActiveProgram();
  }, [currentAnchorDate]);

  useEffect(() => {
    window.addEventListener('reload-calendar', fetchActiveProgram);
    return () => window.removeEventListener('reload-calendar', fetchActiveProgram);
  }, [currentAnchorDate]); // Dépendance mise à jour pour le listener global

  // 🎯 ÉTAPE 3 : Fonctions de navigation d'un mois à l'autre
  const handlePrevMonth = () => {
    setCurrentAnchorDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentAnchorDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  // --- Reste de tes handlers (Update, Delete, Clear) identiques ---
  const handleUpdateSession = async (id, updatedData) => {
    try {
      const res = await fetch(`/api/program/session/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 1, ...updatedData })
      });
      if (res.ok) {
        setEditingSession(null);
        fetchActiveProgram();
        window.dispatchEvent(new Event('reload-calendar'));
      }
    } catch (err) {
      alert("Erreur lors de la modification.");
    }
  };

  const handleDeleteSession = async (id) => {
    if (typeof id === 'string' && id.startsWith('strava-')) {
      alert("Impossible de supprimer une activité réelle Strava depuis le plan théorique.");
      return;
    }
    if (!window.confirm("Supprimer définitivement cette séance du programme ?")) return;
    try {
      const res = await fetch(`/api/program/session/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 1 })
      });
      if (res.ok) {
        fetchActiveProgram();
        window.dispatchEvent(new Event('reload-calendar'));
      }
    } catch (err) {
      alert("Erreur lors de la suppression.");
    }
  };

  const handleClearFullProgram = async () => {
    if (!window.confirm("⚠️ ATTENTION : Es-tu sûr de vouloir purger INTÉGRALEMENT ton programme théorique à venir ?")) return;
    try {
      const res = await fetch('/api/program/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 1 })
      });
      if (res.ok) {
        alert("Programme entièrement réinitialisé.");
        fetchActiveProgram();
        window.dispatchEvent(new Event('reload-calendar'));
      }
    } catch (err) {
      alert("Erreur réseau lors du wipe.");
    }
  };

  return (
    <div className="bg-slate-900/40 border border-slate-800 rounded-2xl flex flex-col overflow-hidden h-[450px]">
      
      {/* 📌 ZONE FIXE : Header + Navigation (Ne défile jamais) */}
      <div className="p-5 border-b border-slate-800 bg-slate-900/20 space-y-3 shrink-0">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-blue-500" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">
              Flux Calendrier & Strava ({sessions.length} entrées)
            </h3>
          </div>

          {/* 🎯 "Purger le prévu" modifié visuellement pour indiquer qu'il cible le mois affiché */}
          {sessions.some(s => !s.is_unpredicted) && (
            <button
              onClick={handleClearFullProgram}
              className="bg-rose-950/40 hover:bg-rose-900/60 border border-rose-900/50 text-rose-400 font-bold text-[9px] uppercase tracking-wider px-3 py-1.5 rounded-xl transition-all flex items-center gap-1"
              title="Purger uniquement les séances prévues de ce mois"
            >
              <ShieldAlert size={11} /> Purger le mois
            </button>
          )}
        </div>

        {/* BARRE DE NAVIGATION FIXE */}
        <div className="flex items-center justify-center gap-2 bg-slate-950 border border-slate-800/80 p-1.5 rounded-xl max-w-xs mx-auto">
          <button
            onClick={handlePrevMonth}
            className="p-1 hover:bg-slate-900 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
            title="Mois précédent"
          >
            <ChevronLeft size={16} />
          </button>
          
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 px-4 min-w-[120px] text-center font-mono">
            {getMonthLabel(currentAnchorDate)}
          </span>

          <button
            onClick={handleNextMonth}
            className="p-1 hover:bg-slate-900 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
            title="Mois suivant"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* 📜 ZONE DÉFILANTE : La liste des séances (Restaurée à 100%) */}
      <div className="flex-1 overflow-y-auto min-h-0 bg-slate-950/10 font-mono text-[11px] divide-y divide-slate-900/60">
        {loading ? (
          <div className="text-center text-slate-500 py-12">Agrégation du calendrier et de Strava...</div>
        ) : sessions.length === 0 ? (
          <div className="text-center text-slate-500 py-12 font-sans text-[11px]">
            Aucun entraînement ou activité détectée pour ce mois.
          </div>
        ) : (
          sessions.map((session) => {
            const isMatch = !!session.realized;
            const isImprovisé = session.is_unpredicted;

            return (
              <div 
                key={session.id} 
                className={`p-3 flex items-center justify-between gap-4 transition-colors ${
                  isImprovisé 
                    ? 'bg-violet-950/10 hover:bg-violet-950/20' // Strava seul
                    : isMatch 
                      ? 'bg-emerald-950/10 hover:bg-emerald-950/20' // Match parfait
                      : 'hover:bg-slate-900/20' // Prévu seul
                }`}
              >
                {/* BLOC DE GAUCHE : Étiquettes et Titres */}
                <div className="flex items-center gap-4 min-w-0">
                  <span className="text-slate-500 font-bold w-20 shrink-0 text-[10px]">{session.date}</span>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wide border shrink-0 ${getTypeColor(session.type)}`}>
                    {session.type}
                  </span>
                  
                  <div className="truncate min-w-0">
                    <h4 className="text-slate-200 font-sans font-semibold truncate text-xs" title={isImprovisé ? session.realized.name : session.title}>
                      {isImprovisé ? session.realized.name : session.title}
                    </h4>
                    
                    {isMatch && (
                      <p className="text-[10px] text-emerald-400 font-sans mt-0.5 truncate">
                        ✓ Matché : <span className="italic">"{session.realized.name}"</span>
                        {session.realized.distance_km && ` (${session.realized.distance_km} km)`}
                      </p>
                    )}
                    {isImprovisé && (
                      <p className="text-[10px] text-violet-400 font-sans mt-0.5">
                        ⚠️ Sortie Strava non planifiée
                      </p>
                    )}
                  </div>
                </div>

                {/* BLOC DE DROITE : Données comparatives restaurées */}
                <div className="flex items-center gap-6 shrink-0">
                  {/* Comparatif Durée */}
                  <div className="text-right hidden sm:block w-20">
                    <span className="text-[8px] block uppercase tracking-wider text-slate-500 font-sans font-bold">Durée</span>
                    {isImprovisé ? (
                      <span className="text-violet-400 font-bold">{session.realized.duration_minutes}m</span>
                    ) : isMatch ? (
                      <span className="text-slate-400">
                        {session.duration_minutes}m<span className="text-emerald-400 font-bold">→{session.realized.duration_minutes}m</span>
                      </span>
                    ) : (
                      <span className="text-slate-400">{session.duration_minutes}m</span>
                    )}
                  </div>

                  {/* Comparatif Charge / TSS */}
                  <div className="text-right w-16">
                    <span className="text-[8px] block uppercase tracking-wider text-slate-500 font-sans font-bold">Charge</span>
                    {isImprovisé ? (
                      <span className="text-violet-400 font-bold">{session.realized.actual_load} <span className="text-[9px] font-sans">TSS</span></span>
                    ) : isMatch ? (
                      <span className="text-slate-400">
                        {session.target_load}<span className="text-emerald-400 font-bold">/{session.realized.actual_load}</span>
                      </span>
                    ) : (
                      <span className="text-slate-600 font-bold">{session.target_load || 0} <span className="text-[9px] font-sans text-slate-700">TSS</span></span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 border-l border-slate-800/80 pl-3 w-14 justify-end">
                    {!isImprovisé ? (
                      <>
                        <button
                          onClick={() => setEditingSession(session)}
                          className="text-slate-500 hover:text-blue-400 p-1.5 transition-colors"
                          title="Modifier la séance prévue"
                        >
                          <Edit3 size={12} />
                        </button>
                        <button
                          onClick={() => handleDeleteSession(session.id)}
                          className="text-slate-500 hover:text-rose-500 p-1.5 transition-colors"
                          title="Supprimer la séance"
                        >
                          <Trash2 size={12} />
                        </button>
                      </>
                    ) : (
                      <span className="text-[9px] text-slate-600 font-sans font-bold select-none pr-1">STRAVA</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL CONTEXTUELLE */}
      {editingSession && (
        <EditWorkoutModal
          session={editingSession}
          onClose={() => setEditingSession(null)}
          onSave={handleUpdateSession}
        />
      )}
    </div>
  );
});

export default ActiveProgramManager;