import React, { useState } from 'react';
import { Activity, LogOut, RefreshCw, Settings, LayoutDashboard, Calendar, BarChart3, Menu, X } from 'lucide-react'; // 👈 Ajout de BarChart3
import { Link, useLocation } from 'react-router-dom';

export default function Navbar({ user, onLogout, onSync, loading }) {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const isActive = (path) => location.pathname === path;

  const closeMenu = () => setIsOpen(false);

  return (
    <nav className="w-full border-b border-white/5 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-50 h-16 flex items-center">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between relative">
        
        {/* 1. BLOC GAUCHE : LOGO */}
        <div className="flex items-center gap-3 z-10">
          <div className="bg-orange-600 p-1.5 rounded-lg shrink-0">
            <Activity size={20} className="text-white" />
          </div>
          <span className="lg:block font-black text-xl tracking-tighter uppercase text-white">
            Training<span className="text-orange-500"> Dashboard</span>
          </span>
        </div>

        {/* 2. BLOC CENTRAL : NAVIGATION (Desktop) */}
        <div className="hidden lg:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 items-center gap-1">
          <NavLink to="/dashboard" icon={<LayoutDashboard size={14} />} label="Tableau de bord" active={isActive('/dashboard')} />
          <NavLink to="/coach" icon={<Calendar size={14} />} label="Coach" active={isActive('/coach')} />
          <NavLink to="/stats" icon={<BarChart3 size={14} />} label="Analyses" active={isActive('/stats')} /> {/* 👈 Nouvel onglet */}
          <NavLink to="/connections" icon={<Settings size={14} />} label="Applications" active={isActive('/connections')} />
        </div>
  
        {/* 3. BLOC DROITE : ACTIONS */}
        <div className="flex items-center gap-2 z-10">
          {/* SYNC DESKTOP */}
          <button 
            onClick={onSync} 
            className="hidden lg:flex items-center gap-2 px-4 py-2 rounded-full border border-orange-500/30 text-orange-500 text-[11px] font-black uppercase hover:bg-orange-500/10 transition-colors"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Sync</span>
          </button>

          {/* SYNC MOBILE */}
          <button 
            onClick={onSync} 
            className="lg:hidden p-2 text-orange-500 bg-orange-500/10 rounded-full"
            title="Synchroniser"
          >
            <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
          </button>
  
          {/* BURGER */}
          <button 
            className="lg:hidden p-2 text-slate-400 hover:text-white" 
            onClick={() => setIsOpen(true)}
          >
            <Menu size={28} />
          </button>
  
          {/* PROFIL (Desktop) */}
          <div className="hidden lg:flex items-center gap-4 border-l border-slate-800 pl-4 ml-2">
            <span className="text-sm font-black text-white">{user?.firstname}</span>
            <button onClick={onLogout} className="text-slate-500 hover:text-red-500 transition-colors">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </div>
  
      {/* --- MENU MOBILE --- */}
      <div 
        className={`fixed inset-0 w-full h-screen z-[99999] flex flex-col p-6 transition-all duration-300 ease-in-out lg:hidden
          ${isOpen ? "translate-x-0 opacity-100" : "translate-x-full opacity-0 pointer-events-none"}`}
        style={{ backgroundColor: '#020617' }}
      >
        <div className="flex justify-between items-center mb-10">
          <span className="font-black text-2xl uppercase text-white">Menu</span>
          <button onClick={closeMenu} className="p-3 bg-white/10 rounded-full text-white">
            <X size={32} />
          </button>
        </div>
  
        <div className="flex flex-col gap-4">
          <MobileNavLink to="/dashboard" icon={<LayoutDashboard size={24} />} label="Tableau de bord" onClick={closeMenu} />
          <MobileNavLink to="/coach" icon={<Calendar size={24} />} label="Coach" onClick={closeMenu} />
          <MobileNavLink to="/stats" icon={<BarChart3 size={24} />} label="Analyses" onClick={closeMenu} /> {/* 👈 Nouveau lien mobile */}
          <MobileNavLink to="/connections" icon={<Settings size={24} />} label="Applications" onClick={closeMenu} />
        </div>
  
        <div className="mt-auto pb-10 border-t border-white/10 pt-6 flex justify-between items-center">
          <div>
             <p className="text-slate-500 text-xs font-bold uppercase">Athlète</p>
             <p className="text-white text-xl font-black">{user?.firstname}</p>
          </div>
          <button onClick={onLogout} className="p-4 bg-red-500/10 text-red-500 rounded-2xl">
            <LogOut size={28} />
          </button>
        </div>
      </div>
    </nav>
  );
}

// Sous-composants
function NavLink({ to, icon, label, active, color = "white" }) {
  const activeStyles = {
    white: "bg-white/10 text-white shadow-sm",
    blue: "bg-blue-600/20 text-blue-400 shadow-sm",
    orange: "bg-orange-600/20 text-orange-500 shadow-sm"
  };
  return (
    <Link to={to} className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all ${active ? activeStyles[color] : "text-slate-500 hover:text-slate-300"}`}>
      {icon} {label}
    </Link>
  );
}

// MobileNavLink reste identique
function MobileNavLink({ to, icon, label, onClick }) {
  return (
    <Link to={to} onClick={onClick} className="flex items-center gap-5 p-5 bg-white/5 rounded-2xl text-lg font-bold text-white active:bg-orange-600 transition-all">
      <div className="text-orange-500">{icon}</div>
      {label}
    </Link>
  );
}