import React, { useState, useEffect } from 'react';
import { Activity, CheckCircle, AlertCircle, Save, ExternalLink, Mail, Lock } from 'lucide-react';

export default function Connections({ user }) {
    const [stravaForm, setStravaForm] = useState({ client_id: '', client_secret: '' });
    const [garminForm, setGarminForm] = useState({ email: '', password: '' });
    const [status, setStatus] = useState({ stravaLinked: false, garminLinked: false });
    const [loading, setLoading] = useState(true);

    // 1. Charger l'état actuel depuis la BDD (URL Relative)
    useEffect(() => {
        const fetchStatus = async () => {
            try {
                // Utilisation du chemin relatif /auth/...
                const res = await fetch(`/auth/user-status/${user.userId}`);
                const data = await res.json();
                if (res.ok) {
                    setStatus({
                        stravaLinked: !!data.refresh_token,
                        garminLinked: !!data.garmin_email
                    });
                    
                    if (data.client_id) setStravaForm(prev => ({ ...prev, client_id: data.client_id }));
                    if (data.garmin_email) setGarminForm(prev => ({ ...prev, email: data.garmin_email }));
                }
            } catch (err) {
                console.error("Erreur chargement status", err);
            } finally {
                setLoading(false);
            }
        };
        fetchStatus();
    }, [user.userId]);

    // 2. Sauvegarder les credentials Strava (URL Relative)
    const handleStravaLink = async () => {
        if (!stravaForm.client_id || !stravaForm.client_secret) {
            return alert("Veuillez remplir le Client ID et le Client Secret.");
        }
        try {
            const res = await fetch('/auth/update-strava-credentials', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.userId, ...stravaForm })
            });

            if (res.ok) {
                const scope = "read,activity:read_all";
                // window.location.origin récupère automatiquement http://192.168.x.x:3000 ou http://localhost:5173
                const redirectUri = `${window.location.origin}/callback`;
                window.location.href = `https://www.strava.com/oauth/authorize?client_id=${stravaForm.client_id}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;
            }
        } catch (err) { console.error(err); }
    };

    // 3. Sauvegarder les credentials Garmin (URL Relative)
    const handleGarminSave = async () => {
        if (!garminForm.email || !garminForm.password) {
            return alert("Veuillez remplir l'email et le mot de passe Garmin Connect.");
        }
        try {
            const res = await fetch('/auth/update-garmin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.userId, ...garminForm })
            });

            if (res.ok) {
                alert("✅ Identifiants Garmin enregistrés avec succès !");
                setStatus(prev => ({ ...prev, garminLinked: true }));
                setGarminForm(prev => ({ ...prev, password: '' })); 
            }
        } catch (err) { console.error(err); }
    };

    // ... (Le reste du JSX reste identique à ton code)
    return (
        <div className="max-w-2xl mx-auto p-6 space-y-6 pb-24">
            <h2 className="text-2xl font-black text-white">Paramètres de connexion</h2>

            {/* CARTE STRAVA */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl">
                <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-3">
                        <Activity className="text-orange-500" />
                        <h3 className="font-bold text-white text-lg">Strava API</h3>
                    </div>
                    {status.stravaLinked ? (
                        <span className="flex items-center gap-1 text-[10px] bg-green-500/10 text-green-500 px-3 py-1 rounded-full border border-green-500/20 font-bold uppercase">
                            <CheckCircle size={12} /> Lié
                        </span>
                    ) : (
                        <span className="flex items-center gap-1 text-[10px] bg-red-500/10 text-red-500 px-3 py-1 rounded-full border border-red-500/20 font-bold uppercase">
                            <AlertCircle size={12} /> Non configuré
                        </span>
                    )}
                </div>

                <div className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest ml-1">Client ID</label>
                        <input 
                            className="w-full bg-slate-800/50 border border-white/5 rounded-xl p-3 text-white outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                            value={stravaForm.client_id}
                            onChange={e => setStravaForm({...stravaForm, client_id: e.target.value})}
                            placeholder="123456"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest ml-1">Client Secret</label>
                        <input 
                            type="password"
                            className="w-full bg-slate-800/50 border border-white/5 rounded-xl p-3 text-white outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                            placeholder="••••••••••••••••"
                            onChange={e => setStravaForm({...stravaForm, client_secret: e.target.value})}
                        />
                    </div>
                    <button onClick={handleStravaLink} className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-600/20">
                        {status.stravaLinked ? "METTRE À JOUR LA LIAISON" : "LIER MON COMPTE STRAVA"}
                        <ExternalLink size={16} />
                    </button>
                </div>
            </div>

            {/* CARTE GARMIN */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl">
                <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-600 p-1.5 rounded-lg">
                            <Mail className="text-white" size={18} />
                        </div>
                        <h3 className="font-bold text-white text-lg">Garmin Connect</h3>
                    </div>
                    {status.garminLinked ? (
                        <span className="flex items-center gap-1 text-[10px] bg-blue-500/10 text-blue-400 px-3 py-1 rounded-full border border-blue-500/20 font-bold uppercase">
                            <CheckCircle size={12} /> Configuré
                        </span>
                    ) : (
                        <span className="flex items-center gap-1 text-[10px] bg-slate-800 text-slate-500 px-3 py-1 rounded-full border border-slate-700 font-bold uppercase">
                            En attente
                        </span>
                    )}
                </div>

                <div className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest ml-1">Email</label>
                        <input 
                            className="w-full bg-slate-800/50 border border-white/5 rounded-xl p-3 text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                            value={garminForm.email}
                            onChange={e => setGarminForm({...garminForm, email: e.target.value})}
                            placeholder="athlete@email.com"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest ml-1">Mot de passe</label>
                        <input 
                            type="password"
                            className="w-full bg-slate-800/50 border border-white/5 rounded-xl p-3 text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                            placeholder="••••••••••••••••"
                            value={garminForm.password}
                            onChange={e => setGarminForm({...garminForm, password: e.target.value})}
                        />
                    </div>
                    <button onClick={handleGarminSave} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20">
                        <Save size={18} />
                        ENREGISTRER GARMIN
                    </button>
                </div>
            </div>
        </div>
    );
}