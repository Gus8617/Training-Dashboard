const axios = require('axios');

const sendTelegramMessage = async (message) => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    const url = `https://api.telegram.org/bot${token}/sendMessage`;

    try {
        await axios.post(url, {
            chat_id: chatId,
            text: message,
            parse_mode: 'Markdown'
        });
        console.log("✅ Rapport Telegram envoyé");
    } catch (error) {
        console.error("❌ Erreur envoi Telegram:", error.response?.data || error.message);
    }
};

/**
 * Génère un rapport matinal complet avec analyse croisée et prochaine séance
 */
const generateDailyReport = (user, fitness, health, nextSession = null) => {
    const today = fitness[fitness.length - 1] || {};
    const lastHealth = health[health.length - 1] || {};

    // 1. ANALYSE STATUT DYNAMIQUE (Zone cible TSB : -10 à -20)
    let tsbStatus = "🟡 Zone Neutre";
    if (today.tsb >= -20 && today.tsb <= -10) tsbStatus = "🔥 Zone Optimale (Surcharge saine)";
    else if (today.tsb < -25) tsbStatus = "🚨 Surchorbi / Surmenage";
    else if (today.tsb > 5) tsbStatus = "🟢 Désentraînement / Fraîcheur haute";

    // Évaluation HRV (Basé sur tes moyennes constatées ~63ms)
    const hrvStatus = lastHealth.hrv > 65 ? "📈 Excellente" : lastHealth.hrv < 55 ? "📉 Basse" : "✨ Stable";

    // Couleur du Readiness Score
    let readinessEmoji = "⚪";
    if (today.readiness_score >= 80) readinessEmoji = "🟢";
    else if (today.readiness_score >= 50) readinessEmoji = "🟡";
    else if (today.readiness_score > 0) readinessEmoji = "🔴";

    // 2. TEXTE DE LA PROCHAINE SÉANCE PLANIFIÉE
    let planningMsg = "📅 *PLANNING :* Aucune séance planifiée prochainement.";
    if (nextSession) {
        const logos = { 'Run': '🏃', 'Ride': '🚴', 'Swim': '🏊', 'WeightTraining': '🏋️' };
        const logo = logos[nextSession.type] || '📅';
        
        // Formatage du jour (Aujourd'hui, Demain ou Date)
        const sessionDate = new Date(nextSession.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' });
        planningMsg = `🎯 *PROCHAINE SÉANCE (${sessionDate}) :*\n${logo} *${nextSession.name || nextSession.type}*\n⏱️ Objectif : ${nextSession.duration_target || 'N/A'} min | 📊 Charge visée : ${nextSession.tss_target || '?'} TSS`;
    }

    return `
*📊 BILAN MATINAL - ${user.firstname}*
---------------------------
*💪 MÉTRIQUES DE PERFORMANCE*
• *Fitness (CTL) :* ${Math.round(today.ctl)}
• *Fatigue (ATL) :* ${Math.round(today.atl)}
• *Forme (TSB) :* ${Math.round(today.tsb)} 
👉 _${tsbStatus}_

*💤 ÉTATS PHYSIOLOGIQUES*
• *Readiness :* ${readinessEmoji} *${today.readiness_score || 'N/A'}/100*
• *Sommeil :* ${Math.floor(lastHealth.duration / 60)}h${lastHealth.duration % 60}m (${lastHealth.sleep_score || '?'}%)
• *HRV Nocturne :* ${lastHealth.hrv} ms (${hrvStatus})
• *Pouls au Repos :* ${lastHealth.rhr || '?'} bpm

*🧠 CONSEIL DU COACH PERSONNALISÉ*
${getAdvancedCoachAdvice(today.tsb, lastHealth.hrv, lastHealth.sleep_score)}

---------------------------
${planningMsg}
---------------------------
🔗 [Ouvrir le Dashboard](https://training-dashboard.com)
    `;
};

/**
 * Logique de conseil avancée croisant la fatigue systémique (TSB) et nerveuse (HRV)
 */
function getAdvancedCoachAdvice(tsb, hrv, sleepScore) {
    // Cas 1 : Fatigue cardiaque et nerveuse critique
    if (tsb < -25 && hrv < 55) {
        return "🛑 *STOP - REPOS IMPÉRATIF* : Ton TSB plonge et ton système nerveux (HRV) sature. Aujourd'hui, c'est off ou récupération ultra-passive pour éviter la blessure.";
    }
    // Cas 2 : Sur-stock de fraîcheur / Reprise
    if (tsb > 5 && hrv > 65) {
        return "⚡ *VOYANTS AU VERT* : Tu as sur-récupéré. C'est la journée idéale pour placer un bloc de haute intensité (PMA / Seuils) ou une grosse sortie longue.";
    }
    // Cas 3 : TSB bas (fatigue normale d'entraînement) mais HRV solide
    if (tsb <= -10 && tsb >= -22 && hrv >= 60) {
        return "✅ *TRAINING ZONE ACTIVE* : La charge s'accumule mais ton corps l'encaisse parfaitement (HRV stable). Tu peux suivre ton planning et charger aujourd'hui.";
    }
    // Cas 4 : TSB correct mais mauvaise nuit / chute HRV
    if (hrv < 54 || (sleepScore && sleepScore < 65)) {
        return "🧘 *PRUDENCE NERVEUSE* : Ton niveau de forme théorique est bon, mais la récupération brute a péché cette nuit. Privilégie une séance en endurance fondamentale (Zone 2) sans intensité.";
    }
    // Cas 5 : Désentraînement passif
    if (tsb > 8 && hrv <= 62) {
        return "⏳ *DESENTRAÎNEMENT DISCRET* : Ta fatigue est totalement effacée, mais ta HRV stagne. Il est temps de remettre du volume ou une stimulation pour réveiller le moteur.";
    }

    return "🏃 *SENSATIONS REINES* : Les métriques sont stables. Ajuste l'intensité de ta séance directement en fonction de tes premières minutes d'échauffement.";
}

// formatActivityMessage reste inchangé
const formatActivityMessage = (activity) => {
    const dateObj = new Date(activity.date);
    const dateStr = dateObj.toLocaleDateString('fr-FR', {
        weekday: 'long', // ex: "mardi"
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    const logos = {
        'Run': '🏃', 'VirtualRun': '🏃‍♂️', 'Ride': '🚴', 'VirtualRide': '🚴‍♂️',
        'Swim': '🏊', 'WeightTraining': '🏋️', 'Hike': '🥾', 'Walk': '🚶'
    };
    const logo = logos[activity.type] || '✨';

    const totalSeconds = activity.moving_time;
    const durationMin = Math.floor(totalSeconds / 60);
    const durationSec = totalSeconds % 60;

    let performanceStr = "";
    if (activity.type.includes('Run')) {
        const paceDecimal = (totalSeconds / 60) / activity.distance;
        const paceMin = Math.floor(paceDecimal);
        const paceSec = Math.round((paceDecimal - paceMin) * 60);
        performanceStr = `⚡️ Allure : ${paceMin}:${paceSec < 10 ? '0' : ''}${paceSec} min/km`;
    } else {
        const speed = (activity.distance / (totalSeconds / 3600)).toFixed(1);
        performanceStr = `🚲 Vitesse : ${speed} km/h`;
    }

    const effortScore = activity.custom_score || activity.suffer_score || 0;
    const zoneColors = { 0: '⚪', 1: '🔵', 2: '🟢', 3: '🟡', 4: '🔴' };

    let zonesMsg = "";
    try {
        const zones = typeof activity.hr_zones === 'string' ? JSON.parse(activity.hr_zones) : activity.hr_zones;
        if (Array.isArray(zones) && zones.length >= 5 && zones[0].time !== undefined) {
            zonesMsg = zones.map((z, i) => {
                const zMin = Math.floor(z.time / 60) || 0;
                const zSec = z.time % 60 || 0;
                return `${zoneColors[i] || '⚫'} *Z${i + 1}* : ${zMin} min ${zSec < 10 ? '0' : ''}${zSec} sec`;
            }).join('\n');
        } else { zonesMsg = "Analyse cardio indisponible..."; }
    } catch (e) { zonesMsg = "Zones non disponibles"; }

    return `${logo} *${activity.name}*
📅 ${dateStr}
📍 Type : ${activity.type}

📏 Distance : ${activity.distance.toFixed(2)} km
⏱️ Temps : ${durationMin} min ${durationSec < 10 ? '0' : ''}${durationSec} sec
${performanceStr}
❤️ FC Moy : ${activity.average_hr || '?'} bpm
🔥 Effort : ${Math.round(effortScore)}
🏔️ D+ : ${Math.round(activity.total_elevation_gain)} m

📊 *Temps dans les zones FC :*
${zonesMsg}`;
};

module.exports = { sendTelegramMessage, generateDailyReport, formatActivityMessage };