import React, { useState } from 'react';
import { Lock, User, ArrowRight, Loader2 } from 'lucide-react';

export default function LoginPage({ onLogin }) {
    const [isRegister, setIsRegister] = useState(false);
    const [loading, setLoading] = useState(false);
    
    const [formData, setFormData] = useState({
        firstname: '',
        password: ''
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        const API_URL = "/auth"; 
        const endpoint = isRegister ? '/register' : '/login';
        
        console.log(`[Frontend] Tentative vers ${endpoint} pour: ${formData.firstname}`);

        try {
            const res = await fetch(`${API_URL}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            
            const data = await res.json();
            
            if (res.ok) {
                console.log("✅ Connexion réussie :", data);
                onLogin(data); 
            } else {
                alert(data.error || "Erreur de connexion");
            }
        } catch (err) {
            console.error("❌ Erreur réseau :", err);
            alert("Serveur injoignable");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] shadow-2xl">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-black text-white mb-2">
                        {isRegister ? 'Créer un compte' : 'Connexion'}
                    </h1>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="relative">
                        <User className="absolute left-4 top-3.5 text-slate-500" size={18} />
                        <input 
                            className="w-full bg-slate-800/50 border border-slate-700 rounded-2xl p-3.5 pl-12 text-white outline-none focus:ring-2 focus:ring-orange-500 transition"
                            placeholder="Prénom"
                            value={formData.firstname}
                            required
                            disabled={loading}
                            onChange={e => setFormData({...formData, firstname: e.target.value})}
                        />
                    </div>

                    <div className="relative">
                        <Lock className="absolute left-4 top-3.5 text-slate-500" size={18} />
                        <input 
                            type="password"
                            className="w-full bg-slate-800/50 border border-slate-700 rounded-2xl p-3.5 pl-12 text-white outline-none focus:ring-2 focus:ring-orange-500 transition"
                            placeholder="Mot de passe"
                            value={formData.password}
                            required
                            disabled={loading}
                            onChange={e => setFormData({...formData, password: e.target.value})}
                        />
                    </div>

                    <button 
                        disabled={loading}
                        className="w-full bg-white text-black font-black p-4 rounded-2xl transition hover:bg-slate-200 mt-6 flex items-center justify-center gap-2 disabled:opacity-70 disabled:hover:bg-white"
                    >
                        {loading ? (
                            <>
                                <span>CHARGEMENT...</span>
                                <Loader2 className="animate-spin" size={20} />
                            </>
                        ) : (
                            <>
                                <span>{isRegister ? "S'INSCRIRE" : "SE CONNECTER"}</span>
                                <ArrowRight size={20} />
                            </>
                        )}
                    </button>
                </form>

                <button 
                    disabled={loading}
                    onClick={() => setIsRegister(!isRegister)}
                    className="w-full text-slate-500 text-sm mt-6 hover:text-white transition disabled:opacity-50"
                >
                    {isRegister ? "Déjà un compte ? Connexion" : "Pas de compte ? Créer mon profil"}
                </button>
            </div>
        </div>
    );
}