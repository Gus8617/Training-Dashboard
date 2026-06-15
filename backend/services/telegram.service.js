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

const generateDailyReport = (user, fitness, health) => {
    const today = fitness[fitness.length - 1] || {};
    const yesterday = fitness[fitness.length - 2] || {};
    const lastHealth = health[health.length - 1] || {};

    // Calcul de la tendance TSB
    const tsbStatus = today.tsb > 5 ? "🟢 Frais" : today.tsb < -10 ? "🔴 Fatigué" : "🟡 Optimal";
    const hrvStatus = lastHealth.hrv > 60 ? "🚀 Excellente" : "📉 Basse"; // Adapte selon tes moyennes

    // GESTION DU READINESS SCORE (Couleur dynamique)
    let readinessEmoji = "⚪";
    if (today.readiness_score >= 80) readinessEmoji = "🟢";
    else if (today.readiness_score >= 50) readinessEmoji = "🟡";
    else if (today.readiness_score > 0) readinessEmoji = "🔴";

    return `
*📊 BILAN MATINAL - ${user.firstname}*
---------------------------
*🔥 PERFORMANCE*
• *Fitness (CTL) :* ${Math.round(today.ctl)}
• *Fatigue (ATL) :* ${Math.round(today.atl)}
• *Forme (TSB) :* ${Math.round(today.tsb)} (${tsbStatus})
• *Readiness :* ${readinessEmoji} ${today.readiness_score || 'N/A'}/100 

*💤 RÉCUPÉRATION*
• *Sommeil :* ${Math.floor(lastHealth.duration / 60)}h${lastHealth.duration % 60}m
• *HRV :* ${lastHealth.hrv} ms (${hrvStatus})

*🏃 CONSEIL DU JOUR*
${getCoachAdvice(today.tsb, lastHealth.hrv)}
---------------------------
[Ouvrir le Dashboard](https://training-dashboard.com)
    `;
};

const formatActivityMessage = (activity) => {
    // 1. DATE ET HEURE
    const dateObj = new Date(activity.date);
    const timeStr = dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const dateStr = dateObj.toLocaleDateString('fr-FR');

    // 2. LOGO DYNAMIQUE
    const logos = {
        'Run': '🏃',
        'VirtualRun': '🏃‍♂️',
        'Ride': '🚴',
        'VirtualRide': '🚴‍♂️',
        'Swim': '🏊',
        'WeightTraining': '🏋️',
        'Hike': '🥾',
        'Walk': '🚶'
    };
    const logo = logos[activity.type] || '✨';

    // 3. CALCUL PERFORMANCE
    // On part du principe que moving_time est en SECONDES en base
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

    // 4. ZONES CARDIAQUES AVEC COULEURS DASHBOARD
    const zoneColors = {
        0: '⚪', // Zone 1 - Récupération / Gris-Blanc
        1: '🔵', // Zone 2 - Endurance / Bleu
        2: '🟢', // Zone 3 - Tempo / Vert
        3: '🟡', // Zone 4 - Seuil / Jaune-Orange
        4: '🔴'  // Zone 5 - Anaérobie / Rouge
    };

    let zonesMsg = "";
    try {
        const zones = typeof activity.hr_zones === 'string' ? JSON.parse(activity.hr_zones) : activity.hr_zones;
        
        if (Array.isArray(zones) && zones.length >= 5 && zones[0].time !== undefined) {
            zonesMsg = zones.map((z, i) => {
                const zMin = Math.floor(z.time / 60) || 0;
                const zSec = z.time % 60 || 0;
                const color = zoneColors[i] || '⚫';
                return `${color} *Z${i + 1}* : ${zMin} min ${zSec < 10 ? '0' : ''}${zSec} sec`;
            }).join('\n');
        } else {
            zonesMsg = "Analyse cardio indisponible...";
        }
    } catch (e) {
        zonesMsg = "Zones non disponibles";
    }

    return `${logo} *${activity.name}*
📅 ${dateStr} à ${timeStr}
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

// Logique simple de coaching
function getCoachAdvice(tsb, hrv) {
    if (tsb < -15 && hrv < 50) return "⚠️ *REPOS FORCÉ* : Ta fatigue est haute et ta HRV est basse. Risque de blessure.";
    if (tsb > 0 && hrv > 65) return "⚡ *GO !* : Tu es frais et ta récupération est au top. C'est le moment d'une grosse séance.";
    if (tsb < -10) return "🧘 *ENDURANCE DOUCE* : Accumulation de fatigue. Reste en Zone 2 aujourd'hui.";
    return "✅ *TRAINING OK* : Séance normale prévue. Écoute tes sensations.";
}

module.exports = { sendTelegramMessage, generateDailyReport, formatActivityMessage };