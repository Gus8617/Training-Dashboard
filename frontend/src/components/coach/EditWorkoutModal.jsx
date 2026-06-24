// src/components/coach/EditWorkoutModal.jsx
import React, { useState } from 'react';

export default function EditWorkoutModal({ session, onClose, onSave }) {
  const [formData, setFormData] = useState({
    title: session.title || '',
    type: session.type || 'ride',
    duration_minutes: session.duration_minutes || 0,
    target_load: session.target_load || 0,
    target_intensity_zone: session.target_intensity_zone || 'LIT',
    description: session.description || ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(session.id, formData);
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">
            Modifier la séance du <span className="font-mono text-blue-400">{session.date}</span>
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 font-mono text-sm">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-sans">
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Titre</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:border-blue-500 outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Sport</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:border-blue-500 outline-none"
              >
                <option value="ride">🚴 Vélo</option>
                <option value="run">🏃 Course</option>
                <option value="swim">🏊 Natation</option>
                <option value="strength">🏋️ Renforcement</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Zone d'intensité</label>
              <select
                value={formData.target_intensity_zone}
                onChange={(e) => setFormData({ ...formData, target_intensity_zone: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:border-blue-500 outline-none"
              >
                <option value="LIT">Zone LIT (Endurance)</option>
                <option value="MIT">Zone MIT (Seuil)</option>
                <option value="HIT">Zone HIT (PMA/I5)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 font-mono">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1 font-sans">Durée (min)</label>
              <input
                type="number"
                value={formData.duration_minutes}
                onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) || 0 })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1 font-sans">Charge cible (TSS)</label>
              <input
                type="number"
                value={formData.target_load}
                onChange={(e) => setFormData({ ...formData, target_load: parseInt(e.target.value) || 0 })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Description / Exercices</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows="3"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:border-blue-500 outline-none resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="bg-slate-950 border border-slate-800 text-slate-400 font-bold px-4 py-2 rounded-xl hover:bg-slate-800"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="bg-blue-600 text-white font-black px-4 py-2 rounded-xl hover:bg-blue-500 shadow-md"
            >
              Enregistrer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}