import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle } from 'lucide-react';

export default function Callback({ user }) {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState('loading'); 

    useEffect(() => {
        const finalize = async () => {
            const code = searchParams.get('code');
            if (!code) return setStatus('error');

            try {
                // CORRECTION : On utilise le chemin relatif /auth/...
                // Cela permet au navigateur de taper sur l'IP du Raspberry (ou localhost en dev via proxy)
                const res = await fetch('/auth/finalize-strava', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        userId: user.userId, 
                        code: code 
                    })
                });

                if (res.ok) {
                    setStatus('success');
                    setTimeout(() => navigate('/connections'), 2000);
                } else {
                    setStatus('error');
                }
            } catch (err) {
                console.error("Erreur finalize-strava:", err);
                setStatus('error');
            }
        };

        if (user?.userId) {
            finalize();
        }
    }, [searchParams, user?.userId, navigate]);

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
            {status === 'loading' && (
                <>
                    <Loader2 className="animate-spin text-orange-500 mb-4" size={40} />
                    <p className="font-bold">Finalisation de la liaison Strava...</p>
                </>
            )}
            {status === 'success' && (
                <>
                    <CheckCircle className="text-green-500 mb-4" size={40} />
                    <p className="font-bold text-green-500">Compte lié avec succès !</p>
                </>
            )}
            {status === 'error' && (
                <div className="text-center">
                    <p className="text-red-500 mb-4">Erreur lors de la liaison.</p>
                    <button 
                        onClick={() => navigate('/connections')}
                        className="text-sm bg-slate-800 px-4 py-2 rounded-xl"
                    >
                        Retour aux réglages
                    </button>
                </div>
            )}
        </div>
    );
}