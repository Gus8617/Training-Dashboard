import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './components/LoginPage';
import Dashboard from './components/Dashboard';
import Connections from './components/Connections'; 
import CoachCalendar from './components/CoachCalendar'; 
import Navbar from './components/Navbar';
import Callback from './components/Callback';

// --- PLUS BESOIN DE CONFIGURER L'URL ICI ---
// En laissant une chaîne vide, le navigateur utilise l'hôte actuel.
const API_BASE_URL = ""; 

function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });

  const [globalLoading, setGlobalLoading] = useState(false);

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    setUser(null);
  };

  const handleGlobalSync = async () => {
    if (!user?.userId) return;
    setGlobalLoading(true);
    try {
      // Utilisation du chemin relatif /api/sync/all
      const response = await fetch(`${API_BASE_URL}/api/sync/all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.userId })
      });
      if (response.ok) {
        console.log("✅ Synchro réussie");
        window.location.reload(); 
      }
    } catch (err) {
      console.error("❌ Erreur réseau:", err);
    } finally {
      setGlobalLoading(false);
    }
  };

  // ... (Le reste de ton useEffect et du JSX reste identique)
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col overflow-x-hidden">
      {user && (
        <Navbar 
          user={user} 
          onLogout={handleLogout} 
          onSync={handleGlobalSync} 
          loading={globalLoading} 
        />
      )}
      
      <main className="flex-1 relative z-10 w-full overflow-x-hidden px-4 md:px-6">
        <div className="max-w-7xl mx-auto w-full"> 
          <Routes>
            <Route path="/" element={!user ? <LoginPage onLogin={handleLogin} /> : <Navigate to="/dashboard" />} />
            <Route path="/dashboard" element={user ? <Dashboard user={user} /> : <Navigate to="/" />} />
            <Route path="/coach" element={user ? <CoachCalendar user={user} /> : <Navigate to="/" />} />
            <Route path="/connections" element={user ? <Connections user={user} /> : <Navigate to="/" />} />
            <Route path="/callback" element={<Callback user={user} />} />
            <Route path="*" element={<Navigate to="/dashboard" />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

export default App;