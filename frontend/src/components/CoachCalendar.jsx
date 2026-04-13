import React, { useState, useEffect } from 'react';
import { 
  Bike, Waves, Zap, Dumbbell, ChevronLeft, ChevronRight, 
  Plus, X, Calendar as CalendarIcon, Activity as ActivityIcon, Target 
} from 'lucide-react';

const CoachCalendar = ({ user }) => {
  const [plans, setPlans] = useState([]);
  const [activities, setActivities] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);

  const SPORT_CONFIG = {
    run: { color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/20', icon: <ActivityIcon size={12} /> },
    ride: { color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: <Bike size={12} /> },
    swim: { color: 'text-cyan-500', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', icon: <Waves size={12} /> },
    yoga: { color: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-purple-500/20', icon: <Zap size={12} /> },
    strength: { color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20', icon: <Dumbbell size={12} /> },
    default: { color: 'text-slate-400', bg: 'bg-slate-400/10', border: 'border-slate-400/20', icon: <ActivityIcon size={12} /> }
  };

  const [newSession, setNewSession] = useState({
    date: new Date().toISOString().split('T')[0],
    title: '',
    type: 'run',
    planned_tss: 50
  });

  useEffect(() => {
    fetchData();
  }, [user.userId, currentDate]);

  const fetchData = async () => {
    try {
      const [planRes, activityRes] = await Promise.all([
        fetch(`/api/planning/${user.userId}`),
        fetch(`/api/activities`)
      ]);
      const planData = await planRes.json();
      const activityData = await activityRes.json();
      setPlans(planData);
      setActivities(activityData);
    } catch (err) {
      console.error("Erreur chargement données:", err);
    }
  };

  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    let startDay = firstDayOfMonth.getDay();
    startDay = startDay === 0 ? 6 : startDay - 1; 

    const days = [];
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDay; i > 0; i--) { 
        days.push({ day: prevMonthLastDay - i + 1, currentMonth: false, fullDate: "" }); 
    }

    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
    for (let i = 1; i <= lastDayOfMonth; i++) {
      const dateObj = new Date(year, month, i);
      const dateStr = new Date(dateObj.getTime() - (dateObj.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      days.push({ day: i, currentMonth: true, fullDate: dateStr });
    }

    const remainingSlots = 42 - days.length;
    for (let i = 1; i <= remainingSlots; i++) { 
        days.push({ day: i, currentMonth: false, fullDate: "" }); 
    }
    return days;
  };

  const changeMonth = (offset) => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1);
    setCurrentDate(newDate);
  };

  const handleAddSession = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/planning/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newSession, userId: user.userId })
      });
      if (response.ok) {
        setIsModalOpen(false);
        fetchData();
      }
    } catch (err) { console.error(err); }
  };

  const deleteSession = async (id) => {
    if (!window.confirm("Supprimer cette séance ?")) return;
    await fetch(`/api/planning/${id}`, { method: 'DELETE' });
    fetchData();
  };

  const daysLabels = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
  const calendarDays = getDaysInMonth();

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      
      {/* HEADER NAVIGATION STABILISÉ */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-slate-900/50 p-6 rounded-[2rem] border border-white/5 gap-4 shadow-2xl backdrop-blur-md">
        <div className="flex items-center gap-6">
          <div className="bg-blue-600/20 p-4 rounded-2xl text-blue-500">
            <CalendarIcon size={28} />
          </div>
          <div>
            <h2 className="text-3xl font-black text-white uppercase tracking-tighter italic leading-none">
              Planning
            </h2>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-1">
              Optimisation de charge
            </p>
          </div>
        </div>

        {/* CONTROLEUR DE DATE FIXE */}
        <div className="flex items-center bg-slate-950 p-1 rounded-2xl border border-white/5 min-w-[300px] justify-between shadow-inner">
          <button onClick={() => changeMonth(-1)} className="p-3 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-all active:scale-90">
            <ChevronLeft size={20} />
          </button>

          <div className="flex flex-col items-center px-4">
            <span className="text-white font-black uppercase text-sm tracking-tighter italic">
              {currentDate.toLocaleDateString('fr-FR', { month: 'long' })}
            </span>
            <span className="text-slate-500 font-bold text-[10px] tabular-nums">
              {currentDate.getFullYear()}
            </span>
          </div>

          <button onClick={() => changeMonth(1)} className="p-3 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-all active:scale-90">
            <ChevronRight size={20} />
          </button>
          
          <div className="w-[1px] h-8 bg-white/5 mx-1" />

          <button 
            onClick={() => setCurrentDate(new Date())} 
            title="Aujourd'hui"
            className="p-3 hover:bg-blue-600/20 rounded-xl text-blue-500 transition-all active:scale-90"
          >
            <Target size={20} />
          </button>
        </div>

        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-2xl font-black uppercase text-[11px] tracking-widest transition-all flex items-center gap-2 shadow-lg shadow-blue-600/30 active:scale-95 whitespace-nowrap"
        >
          <Plus size={18} /> Séance
        </button>
      </div>

      {/* GRILLE */}
      <div className="bg-slate-900/30 border border-white/5 rounded-[2.5rem] overflow-hidden backdrop-blur-xl shadow-2xl">
        <div className="grid grid-cols-7 border-b border-white/5 bg-slate-900/80">
          {daysLabels.map(label => (
            <div key={label} className="py-4 text-center text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {calendarDays.map((dateObj, idx) => {
            const dayPlans = plans.filter(p => p.date === dateObj.fullDate);
            const dayActivities = activities.filter(a => a.date.split('T')[0] === dateObj.fullDate);
            const isToday = dateObj.fullDate === new Date().toISOString().split('T')[0];

            return (
              <div key={idx} className={`min-h-[160px] border-r border-b border-white/5 p-2 transition-all 
                ${!dateObj.currentMonth ? 'opacity-5 bg-transparent' : 'hover:bg-white/[0.01]'} 
                ${(idx + 1) % 7 === 0 ? 'border-r-0' : ''}`}>
                
                <div className="flex justify-between items-center mb-2">
                  <span className={`text-[10px] font-black ${isToday ? 'bg-blue-600 text-white w-6 h-6 flex items-center justify-center rounded-lg shadow-lg' : 'text-slate-500'}`}>
                    {dateObj.day}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {dayActivities.map(act => {
                    const type = act.type?.toLowerCase().includes('run') ? 'run' : 
                                 act.type?.toLowerCase().includes('ride') || act.type?.toLowerCase().includes('cycling') ? 'ride' :
                                 act.type?.toLowerCase().includes('swim') ? 'swim' : 'default';
                    const config = SPORT_CONFIG[type] || SPORT_CONFIG.default;
                    return (
                      <div key={act.id} className={`${config.bg} ${config.border} border p-1.5 rounded-lg border-l-2`}>
                        <div className="flex items-center justify-between">
                          <div className={`flex items-center gap-1 ${config.color}`}>{config.icon}</div>
                          <span className="text-[7px] font-black text-white/40">{(act.distance / 1000).toFixed(1)}k</span>
                        </div>
                        <p className="text-white text-[8px] font-bold truncate uppercase mt-0.5">{act.name}</p>
                      </div>
                    );
                  })}

                  {dayPlans.map(s => {
                    const type = s.type?.toLowerCase() || 'default';
                    const config = SPORT_CONFIG[type] || SPORT_CONFIG.default;
                    return (
                      <div key={s.id} className="group relative bg-slate-800/40 border border-white/10 p-1.5 rounded-lg border-dashed">
                        <button onClick={() => deleteSession(s.id)} className="absolute -top-1 -right-1 bg-red-500 text-white p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"><X size={10} /></button>
                        <div className="flex items-center gap-1">
                           <div className={config.color}>{config.icon}</div>
                           <span className={`text-[7px] font-black uppercase tracking-tighter ${config.color}`}>{s.type}</span>
                        </div>
                        <p className="text-slate-200 text-[8px] font-bold truncate uppercase italic opacity-70">{s.title}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* LOGIQUE DE PLANIFICATION : Suggestion */}
      <div className="bg-blue-600/10 border border-blue-500/20 p-6 rounded-3xl">
        <h4 className="text-white font-black uppercase text-xs tracking-widest mb-2 italic">Analyse du bloc actuel</h4>
        <p className="text-slate-400 text-sm leading-relaxed">
          Le mois de <span className="text-blue-400 font-bold capitalize">{currentDate.toLocaleDateString('fr-FR', { month: 'long' })}</span> comporte {plans.length} séances planifiées. 
          Pour un entraînement optimal, essayez de maintenir une alternance entre séances intenses (TSS élevé) et récupération.
        </p>
      </div>
    </div>
  );
};

export default CoachCalendar;