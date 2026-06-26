import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

export default function StravaCallback() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState('loading'); 

    useEffect(() => {
        const finalizeExchange = async () => {
            const code = searchParams.get('code');
            
            // On récupère l'id de l'utilisateur connecté (depuis ton localStorage ou ton contexte d'authentification)
            const storedUser = localStorage.getItem('temp_user') || localStorage.getItem('user');
            const user = storedUser ? JSON.parse(storedUser) : null;

            if (!code || !user?.id) {
                console.error("❌ Code OAuth manquant ou utilisateur non connecté");
                setStatus('error');
                return;
            }

            try {
                // Appel à ta route nettoyée (on passe uniquement le code et l'userId)
                const res = await fetch('/auth/finalize-strava', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        code, 
                        userId: user.id
                    })
                });

                if (res.ok) {
                    setStatus('success');
                    // Nettoyage éventuel du user temporaire si nécessaire
                    localStorage.removeItem('temp_user'); 
                    
                    // Redirection vers le dashboard après 2 secondes pour laisser l'utilisateur voir le succès
                    setTimeout(() => navigate('/dashboard'), 2000);
                } else {
                    setStatus('error');
                }
            } catch (err) {
                console.error("❌ Erreur lors de l'échange de jetons Strava:", err);
                setStatus('error');
            }
        };

        finalizeExchange();
    }, [searchParams, navigate]);

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-4">
            <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] shadow-2xl text-center">
                {status === 'loading' && (
                    <div className="flex flex-col items-center gap-4">
                        <Loader2 className="animate-spin text-orange-500" size={44} />
                        <h2 className="text-xl font-bold">Synchronisation avec Strava...</h2>
                        <p className="text-slate-400 text-sm">Échange des clés d'accès sécurisées en cours.</p>
                    </div>
                )}

                {status === 'success' && (
                    <div className="flex flex-col items-center gap-4">
                        <CheckCircle className="text-green-500" size={44} />
                        <h2 className="text-xl font-bold text-green-500">Connexion réussie !</h2>
                        <p className="text-slate-400 text-sm">Ton compte Strava est maintenant lié. Redirection...</p>
                    </div>
                )}

                {status === 'error' && (
                    <div className="flex flex-col items-center gap-4">
                        <XCircle className="text-red-500" size={44} />
                        <h2 className="text-xl font-bold text-red-500">Échec de la liaison</h2>
                        <p className="text-slate-400 text-sm mb-2">Le code d'autorisation a expiré ou la configuration serveur est incorrecte.</p>
                        <button 
                            onClick={() => navigate('/connections')}
                            className="bg-slate-800 hover:bg-slate-700 text-white font-medium text-sm py-3 px-6 rounded-xl transition"
                        >
                            Retourner aux réglages
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}