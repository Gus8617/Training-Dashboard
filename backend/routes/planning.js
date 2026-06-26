const express = require('express');
const router = express.Router();
const db = require('../database');

// Calcule le numéro de semaine ISO
function getWeekNumber(d) {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}

// Formate une date en YYYY-MM-DD local
function formatLocalYYYYMMDD(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Fonction utilitaire pour matcher les types de sport de manière générique
const isSportMatch = (typeA, typeB) => {
    const a = typeA?.toLowerCase();
    const b = typeB?.toLowerCase();
    if ((a === 'ride' || a === 'bike') && (b === 'ride' || b === 'bike')) return true;
    return a === b;
};

// =========================================================================
// 📅 1. GET /api/planning (CORRIGÉ : CORRÉLATION FLEXIBLE ET SÉCURISÉE)
// =========================================================================
router.get('/', (req, res) => {
    try {
        const { startDate, view, userId } = req.query;
        
        if (!userId || !startDate || typeof startDate !== 'string') {
            return res.status(400).json({ success: false, error: "Paramètres manquants ou invalides (userId ou startDate)." });
        }

        const numericUserId = parseInt(userId, 10);
        const start = new Date(startDate);
        if (isNaN(start.getTime())) {
            return res.status(400).json({ success: false, error: "Le format de la date est invalide." });
        }

        const end = new Date(start);
        let startDateStr = startDate;

        if (view === 'week') {
            end.setDate(start.getDate() + 7);
            startDateStr = formatLocalYYYYMMDD(start);
        } else {
            start.setDate(1); 
            end.setMonth(start.getMonth() + 1);
            end.setDate(1);
            startDateStr = formatLocalYYYYMMDD(start);
        }

        const endDateStr = formatLocalYYYYMMDD(end);

        // 1. Récupération du plan théorique sur la plage sélectionnée
        const selectFields = `
            id, date, start_time, title, description, type, 
            (target_duration / 60) AS duration_minutes, 
            target_duration, target_distance, target_load, target_intensity_zone, status, strava_id
        `;
        const plannedSessions = db.prepare(`
            SELECT ${selectFields}
            FROM training_plan 
            WHERE user_id = ? AND date >= ? AND date < ? AND status = 'planned'
            ORDER BY date ASC, start_time ASC
        `).all(numericUserId, startDateStr, endDateStr);

        // 2. Récupération des activités réelles Strava (Nettoyage strict pour éviter les fuites d'historique)
        const realActivities = db.prepare(`
            SELECT id, name, type, 
                   SUBSTR(date, 1, 10) AS date,
                   distance, moving_time, suffer_score, custom_score
            FROM activities 
            WHERE user_id = ? 
              AND SUBSTR(date, 1, 10) >= ? 
              AND SUBSTR(date, 1, 10) < ?
            ORDER BY date ASC
        `).all(numericUserId, startDateStr, endDateStr);

        let finalTimeline = [];

        // Boucle A : Corrélation avec une tolérance temporelle de 1 jour (Fuzzy Matching)
        plannedSessions.forEach(p => {
            const pDate = new Date(p.date);

            const matchIndex = realActivities.findIndex(act => {
                const actDate = new Date(act.date);
                // Calcul de la différence en jours
                const diffTime = Math.abs(actDate - pDate);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                // Match si même sport ET écart <= 1 jour (ex: séance prévue mardi faite le lundi soir ou mercredi)
                return diffDays <= 1 && isSportMatch(act.type, p.type);
            });
            
            let realizedData = null;
            if (matchIndex !== -1) {
                const match = realActivities[matchIndex];
                realizedData = {
                    id: match.id,
                    name: match.name,
                    duration_minutes: Math.round(match.moving_time / 60),
                    actual_load: match.custom_score || match.suffer_score || 0,
                    distance_km: match.distance ? Number(match.distance).toFixed(1) : null
                };
                realActivities.splice(matchIndex, 1); // Supprimé pour ne pas être dupliqué en Boucle B
            }

            let cleanType = p.type;
            if (cleanType.toLowerCase() === 'bike') cleanType = 'Ride';
            cleanType = cleanType.charAt(0).toUpperCase() + cleanType.slice(1).toLowerCase();

            finalTimeline.push({
                ...p,
                type: cleanType,
                duration_minutes: p.duration_minutes ? Math.round(p.duration_minutes) : null,
                is_unpredicted: false,
                realized: realizedData
            });
        });

        // Boucle B : Les activités réelles qui n'ont STRICTEMENT RIEN à voir avec le plan de cette semaine
        realActivities.forEach(act => {
            let cleanType = act.type || 'Ride';
            if (cleanType.toLowerCase() === 'bike') cleanType = 'Ride';
            cleanType = cleanType.charAt(0).toUpperCase() + cleanType.slice(1).toLowerCase();

            finalTimeline.push({
                id: `strava-${act.id}`,
                date: act.date,
                start_time: "00:00", 
                title: act.name,
                description: "Séance Strava non planifiée.",
                type: cleanType,
                duration_minutes: null,
                target_duration: null,
                target_distance: null,
                target_load: null,
                target_intensity_zone: null,
                status: "completed",
                strava_id: act.id,
                is_unpredicted: true,
                realized: {
                    id: act.id,
                    name: act.name,
                    duration_minutes: Math.round(act.moving_time / 60),
                    actual_load: act.custom_score || act.suffer_score || 0,
                    distance_km: act.distance ? Number(act.distance).toFixed(1) : null
                }
            });
        });

        // Tri final chronologique
        finalTimeline.sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time));

        const fitness = db.prepare(`
            SELECT ctl, atl, tsb FROM daily_fitness 
            WHERE user_id = ? 
            ORDER BY date DESC LIMIT 1
        `).get(numericUserId) || { ctl: 45.2, atl: 38.0, tsb: 7.2 };

        res.json({
            success: true,
            days: finalTimeline,
            fitness: {
                ctl: fitness.ctl,
                atl: fitness.atl,
                tsb: fitness.tsb,
                readiness_score: fitness.tsb > 0 ? 85 : 65
            }
        });
    } catch (error) {
        console.error("🔥 Erreur GET /api/planning:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});
// =========================================================================
// 🚀 2. POST /api/planning/generate (BLOC PROGRESSIF PLANIFIÉ)
// =========================================================================
router.post('/generate', (req, res) => {
    const { userId, targetWeeklyHours, startDate } = req.body;
    
    if (!userId || !targetWeeklyHours || !startDate) {
        return res.status(400).json({ success: false, error: "Paramètres manquants." });
    }

    try {
        const numericUserId = parseInt(userId, 10); // 🎯 FIX : Cast Id
        const start = new Date(startDate);
        const weekCoefficients = [1.0, 1.1, 1.2, 0.7]; 
        
        const endRange = new Date(start);
        endRange.setDate(start.getDate() + 28);
        const endDateStr = formatLocalYYYYMMDD(endRange);
        
        db.prepare(`
            DELETE FROM training_plan 
            WHERE user_id = ? 
              AND date >= ? 
              AND date < ? 
              AND status = 'planned'
              AND strava_id IS NULL
          `).run(numericUserId, startDate, endDateStr);

        const insertSession = db.prepare(`
            INSERT INTO training_plan 
            (user_id, date, start_time, title, description, type, target_duration, target_load, target_intensity_zone, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'planned')
        `);

        const runTransaction = db.transaction((uId, startDateObj, baseHours) => {
            for (let w = 0; w < 4; w++) {
                const currentWeekHours = baseHours * weekCoefficients[w];
                const totalSeconds = currentWeekHours * 3600;
                const litSecondsTarget = totalSeconds * 0.80;
                const hitSessionSeconds = Math.min(3600, (totalSeconds * 0.12)); 

                const mondayOfWeek = new Date(startDateObj);
                mondayOfWeek.setDate(startDateObj.getDate() + (w * 7));
                
                const formatDay = (daysToAdd) => {
                    const d = new Date(mondayOfWeek);
                    d.setDate(mondayOfWeek.getDate() + daysToAdd);
                    return formatLocalYYYYMMDD(d);
                };

                // 🗓️ Mardi : Séance HIT
                const hitLoad = Math.round(currentWeekHours * 10);
                insertSession.run(
                    uId, formatDay(1), "18:30", "PMA Développement", 
                    "Échauffement 20 min. Corps de séance : 2 séries de 8x (30s max / 30s récup). Récupération 10 min.", 
                    "Ride", Math.round(hitSessionSeconds), hitLoad, "HIT"
                );

                // 🗓️ Jeudi : Footing LIT
                const litRunLoad = Math.round(currentWeekHours * 7);
                insertSession.run(
                    uId, formatDay(3), "18:45", "Footing Endurance Fondamentale", 
                    "Course à pied en aisance respiratoire stricte. Relâchement postural.", 
                    "Run", Math.round(litSecondsTarget * 0.35), litRunLoad, "LIT"
                );

                // 🗓️ Samedi : Natation Technique
                insertSession.run(
                    uId, formatDay(5), "09:00", "Natation Endurance & Technique", 
                    "Focus glisse, éducatifs (brique, un bras) puis blocs réguliers allure M.", 
                    "Swim", Math.round(litSecondsTarget * 0.15), 30, "LIT"
                );

                // 🗓️ Dimanche : Sortie Longue
                const longRideLoad = Math.round(currentWeekHours * 14);
                insertSession.run(
                    uId, formatDay(6), "08:30", "Sortie Longue Aérobie", 
                    "Sortie foncière route pour construire la caisse. Option bosses au train sans basculer in HIT.", 
                    "Ride", Math.round(litSecondsTarget * 0.50), longRideLoad, "LIT"
                );
            }
        });

        runTransaction(numericUserId, start, targetWeeklyHours);
        return res.json({ success: true, message: "Bloc algorithmique de 4 semaines généré avec succès !" });

    } catch (err) {
        console.error("❌ Erreur génération plan :", err);
        return res.status(500).json({ success: false, error: err.message });
    }
});


// =========================================================================
// 🧠 3. POST /api/planning/reschedule (MOTEUR D'ARBITRAGE ADAPTATIF)
// =========================================================================
router.post('/reschedule', async (req, res) => {
    try {
        const { userId } = req.body;
        const isPreview = req.query.preview === 'true'; // 🎯 Détection du mode Preview

        if (!userId) return res.status(400).json({ success: false, error: "userId requis." });

        const numericUserId = parseInt(userId, 10);
        const today = new Date();
        const todayStr = formatLocalYYYYMMDD(today);
        const dayOfWeekToday = today.getDay(); 
        
        const currentWeekNum = getWeekNumber(today);
        const weekType = currentWeekNum % 2 === 0 ? 'even' : 'odd';

        const fitness = db.prepare(`
            SELECT readiness_score, tsb, hrv, hrv_baseline 
            FROM daily_fitness 
            WHERE user_id = ? AND date = ?
        `).get(numericUserId, todayStr);
        
        // Calcul dynamique du statut HRV si les données existent
        let calculatedHrvStatus = 'balanced';
        if (fitness && fitness.hrv && fitness.hrv_baseline) {
            const hrvRatio = fitness.hrv / fitness.hrv_baseline;
            if (hrvRatio < 0.85) {
                calculatedHrvStatus = 'low';
            }
        }

        const restrictionToday = db.prepare(`
            SELECT is_blocked FROM user_constraints 
            WHERE user_id = ? AND day_of_week = ?
              AND (specific_date = ? OR (specific_date IS NULL AND (week_alternation = 'all' OR week_alternation = ?)))
            LIMIT 1
        `).get(numericUserId, dayOfWeekToday, todayStr, weekType);

        const currentRestriction = restrictionToday ? Number(restrictionToday.is_blocked) : 0; 
        const todaysSession = db.prepare("SELECT * FROM training_plan WHERE user_id = ? AND date = ? AND status = 'planned'").get(numericUserId, todayStr);
        if (!todaysSession) {
            return res.json({ success: true, message: "Aucune séance théorique planifiée pour aujourd'hui.", modifications: [] });
        }

        // Structure pour stocker la modification si elle a lieu
        let modification = null;

        // 1️⃣ Arbitrage Option 2 : Indisponibilité Absolue (Bloqué Strict)
        if (currentRestriction === 2) {
            modification = {
                date: todayStr,
                type: todaysSession.type,
                title: todaysSession.title,
                old_load: todaysSession.target_load || 0,
                new_load: 0,
                reason: "Indisponibilité absolue (Agenda bloqué)"
            };

            if (!isPreview) {
                db.prepare('UPDATE training_plan SET status = "skipped", description = "[Arbitrage] Annulé pour cause d\'indisponibilité absolue." WHERE id = ?').run(todaysSession.id);
            }
        }

        // 2️⃣ Arbitrage Option 1 : Agenda Hybride (Repli en intérieur)
        else if (currentRestriction === 1) {
            if (todaysSession.type === 'Run') {
                modification = {
                    date: todayStr,
                    type: "Strength", // Devient du renfo
                    title: "Renforcement de Substitution",
                    old_load: todaysSession.target_load || 0,
                    new_load: 20,
                    reason: "Repli Indoor : CAP extérieure mutée en Renfo"
                };

                if (!isPreview) {
                    db.prepare(`
                        UPDATE training_plan 
                        SET title = ?, type = "Strength", description = "[Arbitrage Indoor] Séance CAP extérieure impossible. Remplacé par du Core/Gainage stable en intérieur.", target_duration = 2700, target_intensity_zone = "LIT", target_load = 20
                        WHERE id = ?
                    `).run(modification.title, todaysSession.id);
                }
            } 
            
            else if (todaysSession.type === 'Ride' && !todaysSession.description.includes('home-trainer')) {
                const newTitle = `${todaysSession.title} (Format Home-Trainer)`;
                const newLoad = Math.round((todaysSession.target_load || 0) * 0.85);

                modification = {
                    date: todayStr,
                    type: todaysSession.type,
                    title: newTitle,
                    old_load: todaysSession.target_load || 0,
                    new_load: newLoad,
                    reason: "Repli Indoor : Vélo adapté sur Home-Trainer (-15% TSS)"
                };

                if (!isPreview) {
                    const newDesc = `[Arbitrage Indoor] Transféré sur Home-Trainer : ${todaysSession.description}`;
                    db.prepare(`
                        UPDATE training_plan 
                        SET title = ?, description = ?, target_load = ?
                        WHERE id = ?
                    `).run(newTitle, newDesc, newLoad, todaysSession.id);
                }
            }
        }

        // 3️⃣ Arbitrage Physiologique : HRV ou fatigue nerveuse
        else if (fitness && (fitness.readiness_score < 65 || calculatedHrvStatus === 'low')) {
            if (todaysSession.target_intensity_zone === 'HIT') {
                modification = {
                    date: todayStr,
                    type: todaysSession.type,
                    title: "Récupération Active Fatigué",
                    old_load: todaysSession.target_load || 0,
                    new_load: 15,
                    reason: `Alerte Fatigue (Readiness: ${fitness.readiness_score}, HRV: ${calculatedHrvStatus})`
                };

                if (!isPreview) {
                    db.prepare(`
                        UPDATE training_plan 
                        SET title = ?, description = "Alerte Fatigue / HRV Bas. Séance haute intensité (HIT) annulée pour protéger le système nerveux.", target_intensity_zone = "LIT", target_load = 15 
                        WHERE id = ?
                    `).run(modification.title, todaysSession.id);
                }
            }
        }

        // Renvoi de la réponse adaptée au mode (Preview vs Commit)
        if (isPreview) {
            return res.json({
                success: true,
                preview: true,
                modifications: modification ? [modification] : [],
                message: modification ? "Ajustement détecté par le moteur." : "Feu vert : Rien à modifier pour aujourd'hui."
            });
        } else {
            return res.json({
                success: true,
                message: modification ? `Moteur exécuté : ${modification.reason}` : "Feu vert : Agenda et métriques au vert. Séance maintenue."
            });
        }

    } catch (error) {
        console.error("🔥 Erreur arbitrage:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;