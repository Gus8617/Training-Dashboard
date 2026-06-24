// src/components/coach/JsonImporter.jsx
import React, { useRef } from 'react';
import { Upload } from 'lucide-react';

export default function JsonImporter({ onImportSuccess }) {
  const fileInputRef = useRef(null);

  const handleJsonImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const programData = JSON.parse(event.target.result);
        const res = await fetch('/api/program/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: 1, programData })
        });

        const data = await res.json();
        if (data.success) {
          alert("Le programme théorique a été injecté sans doublons !");
          if (onImportSuccess) onImportSuccess();
        } else {
          alert(`Erreur : ${data.error}`);
        }
      } catch (err) {
        alert("Erreur de parsing du fichier JSON.");
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
      <div>
        <h3 className="text-xs font-black uppercase tracking-wider text-blue-400">Injecteur de macro-programme externe</h3>
        <p className="text-[11px] text-slate-500 mt-0.5">Importe ton fichier structuré au format JSON pour peupler instantanément ton calendrier théorique.</p>
      </div>
      <input type="file" accept=".json" ref={fileInputRef} onChange={handleJsonImport} className="hidden" />
      <button 
        onClick={() => fileInputRef.current?.click()} 
        className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] uppercase tracking-wider px-5 py-2.5 rounded-xl transition-all flex items-center gap-2"
      >
        <Upload size={12} /> Importer Plan JSON
      </button>
    </div>
  );
}