import React, { useState, useEffect } from 'react';
import { Activity, CheckCircle, AlertCircle, Save, ExternalLink, Mail, Loader2 } from 'lucide-react';

export default function Connections({ user }) {
    // 🎯 AJOUTE TON VRAI CLIENT ID ICI (ex: 123456)
    // Cela rend le bouton fonctionnel instantanément sans dépendre d'une route BDD
    const [globalClientId] = useState(161132); 

    const [garminForm, setGarminForm] = useState({ email: '', password: '' });
    const [status, setStatus] = useState({ stravaLinked: false, garminLinked: false });
    const [loading, setLoading] = useState(true);

    // 1. On charge uniquement ce qui est disponible
    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const res = await fetch(`/auth/user-status/${user.userId}`);
                
                if (res.ok) {
                    const data = await res.json();
                    setStatus({
                        stravaLinked: data.strava_connected || !!data.refresh_token,
                        garminLinked: !!data.garmin_email
                    });
                    if (data.garmin_email) {
                        setGarminForm(prev => ({ ...prev, email: data.garmin_email }));
                    }
                }
            } catch (err) {
                console.warn("⚠️ Pas de route user-status fonctionnelle, affichage par défaut.");
            } finally {
                // On force l'arrêt du chargement quoi qu'il arrive
                setLoading(false);
            }
        };
        
        if (user?.userId) {
            fetchStatus();
        } else {
            setLoading(false);
        }
    }, [user.userId]);

    // 2. Redirection directe vers Strava
    const handleStravaLink = () => {
        const scope = "activity:read_all";
        const redirectUri = `${window.location.origin}/callback`;

        console.log(`[Strava] Redirection avec le Client ID: ${globalClientId}`);
        window.location.href = `https://www.strava.com/oauth/authorize?client_id=${globalClientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;
    };

    // 3. Sauvegarder les identifiants Garmin
    const handleGarminSave = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch('/auth/update-garmin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.userId, ...garminForm })
            });

            if (res.ok) {
                alert("✅ Identifiants Garmin enregistrés !");
                setStatus(prev => ({ ...prev, garminLinked: true }));
                setGarminForm(prev => ({ ...prev, password: '' })); 
            }
        } catch (err) { 
            console.error(err); 
        }
    };

    if (loading) {
        return (
            <div className="min-h-[50vh] flex flex-col items-center justify-center text-white gap-3">
                <Loader2 className="animate-spin text-orange-500" size={32} />
                <p className="text-sm text-slate-400">Chargement de la page...</p>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto p-6 space-y-6 pb-24">
            <h2 className="text-2xl font-black text-white">Paramètres de connexion</h2>

            {/* CARTE STRAVA */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl">
                <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-3">
                        <Activity className="text-orange-500" />
                        <div className="flex flex-col">
                            <h3 className="font-bold text-white text-lg">Strava API</h3>
                            <p className="text-slate-500 text-xs">Synchronisation automatique</p>
                        </div>
                    </div>
                    {status.stravaLinked ? (
                        <span className="flex items-center gap-1 text-[10px] bg-green-500/10 text-green-500 px-3 py-1 rounded-full border border-green-500/20 font-bold uppercase">
                            <CheckCircle size={12} /> Lié
                        </span>
                    ) : (
                        <span className="flex items-center gap-1 text-[10px] bg-red-500/10 text-red-500 px-3 py-1 rounded-full border border-red-500/20 font-bold uppercase">
                            <AlertCircle size={12} /> Non connecté
                        </span>
                    )}
                </div>

                <div className="space-y-4">
                    <p className="text-slate-400 text-sm leading-relaxed">
                        L'authentification s'effectue sur la plateforme officielle Strava. Aucun identifiant ou clé secrète ne vous sera demandé.
                    </p>
                    <button 
                        onClick={handleStravaLink} 
                        className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black py-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-600/20"
                    >
                        <span>{status.stravaLinked ? "METTRE À JOUR LA LIAISON STRAVA" : "CONNECTER MON COMPTE STRAVA"}</span>
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

                <form onSubmit={handleGarminSave} className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest ml-1">Email</label>
                        <input 
                            type="email"
                            className="w-full bg-slate-800/50 border border-white/5 rounded-xl p-3 text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                            value={garminForm.email}
                            onChange={e => setGarminForm({...garminForm, email: e.target.value})}
                            placeholder="athlete@email.com"
                            required
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
                            required
                        />
                    </div>
                    <button 
                        type="submit"
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
                    >
                        <Save size={18} />
                        ENREGISTRER GARMIN
                    </button>
                </form>
            </div>
        </div>
    );
}