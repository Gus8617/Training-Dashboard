// routes/planning.js
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

// =========================================================================
// 📅 1. GET /api/planning (REQUIS PAR LE CALENDRIER FRONTEND)
// =========================================================================
router.get('/', (req, res) => {
    try {
        const { startDate, view, userId } = req.query;
        
        if (!userId || !startDate) {
            return res.status(400).json({ success: false, error: "Paramètres manquants (userId ou startDate)." });
        }

        let sessions = [];
        // On convertit target_duration (secondes) en duration_minutes pour le Front
        const selectFields = `
            id, date, start_time, title, description, type, 
            (target_duration / 60) AS duration_minutes, 
            target_distance, target_load, target_intensity_zone, status, strava_id
        `;

        if (view === 'week') {
            const start = new Date(startDate);
            const end = new Date(start);
            end.setDate(start.getDate() + 7);
            const endDate = formatLocalYYYYMMDD(end);

            sessions = db.prepare(`
                SELECT ${selectFields}
                FROM training_plan 
                WHERE user_id = ? AND date >= ? AND date < ?
                ORDER BY date ASC, start_time ASC
            `).all(userId, startDate, endDate);
        } else {
            // Vue mensuelle
            sessions = db.prepare(`
                SELECT ${selectFields}
                FROM training_plan 
                WHERE user_id = ? AND date LIKE ?
                ORDER BY date ASC, start_time ASC
            `).all(userId, `${startDate.substring(0, 7)}%`);
        }

        // Récupération de l'état de fraîcheur Banister le plus récent
        const fitness = db.prepare(`
            SELECT ctl, atl, tsb FROM daily_fitness 
            WHERE user_id = ? 
            ORDER BY date DESC LIMIT 1
        `).get(userId) || { ctl: 45.2, atl: 38.0, tsb: 7.2 };

        res.json({
            success: true,
            days: sessions,
            fitness: {
                ctl: fitness.ctl,
                atl: fitness.atl,
                tsb: fitness.tsb,
                readiness_score: 85
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
        const start = new Date(startDate);
        const weekCoefficients = [1.0, 1.1, 1.2, 0.7]; // Surcharge progressive 3:1
        
        // Nettoyer l'ancien plan théorique sur la plage des 4 semaines (28 jours)
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
          `).run(userId, startDate, endDateStr);

        // Changement ici : Mappage exact avec tes vraies colonnes SQLite
        const insertSession = db.prepare(`
            INSERT INTO training_plan 
            (user_id, date, title, description, type, target_duration, target_load, target_intensity_zone, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'planned')
        `);

        const runTransaction = db.transaction((uId, startDateObj, baseHours) => {
            for (let w = 0; w < 4; w++) {
                const currentWeekHours = baseHours * weekCoefficients[w];
                const totalSeconds = currentWeekHours * 3600; // Stockage en SECONDES pur !

                const litSecondsTarget = totalSeconds * 0.80;
                const hitSecondsTarget = totalSeconds * 0.20;

                const mondayOfWeek = new Date(startDateObj);
                mondayOfWeek.setDate(startDateObj.getDate() + (w * 7));
                
                const formatDay = (daysToAdd) => {
                    const d = new Date(mondayOfWeek);
                    d.setDate(mondayOfWeek.getDate() + daysToAdd);
                    return formatLocalYYYYMMDD(d);
                };

                // 🗓️ Mardi : Séance HIT (VMA / PMA)
                const hitLoad = Math.round(currentWeekHours * 12);
                insertSession.run(
                    uId, formatDay(1), "PMA Développement", 
                    "Série de 30s/30s sur home-trainer ou côtes. Focus puissance max.", 
                    "Ride", Math.round(hitSecondsTarget), hitLoad, "HIT"
                );

                // 🗓️ Jeudi : Séance LIT (Endurance Fondamentale)
                const litRunLoad = Math.round(currentWeekHours * 8);
                insertSession.run(
                    uId, formatDay(3), "Footing Endurance Fondamentale", 
                    "Course à pied en aisance respiratoire stricte.", 
                    "Run", Math.round(litSecondsTarget * 0.35), litRunLoad, "LIT"
                );

                // 🗓️ Samedi : Natation Technique (LIT)
                insertSession.run(
                    uId, formatDay(5), "Natation Endurance & Technique", 
                    "Focus glisse, éducatifs puis blocs réguliers.", 
                    "Swim", Math.round(litSecondsTarget * 0.15), 30, "LIT"
                );

                // 🗓️ Dimanche : Sortie Longue (LIT)
                const longRideLoad = Math.round(currentWeekHours * 15);
                insertSession.run(
                    uId, formatDay(6), "Sortie Longue Aérobie", 
                    "Sortie foncière vélo pour construire la caisse.", 
                    "Ride", Math.round(litSecondsTarget * 0.50), longRideLoad, "LIT"
                );
            }
        });

        runTransaction(userId, start, targetWeeklyHours);
        return res.json({ success: true, message: "Bloc algorithmique de 4 semaines généré avec succès !" });

    } catch (err) {
        console.error("❌ Erreur génération plan :", err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

// =========================================================================
// ✍️ 3. POST /api/planning/session (ÉDITION / AJOUT MANUEL)
// =========================================================================
router.post('/session', (req, res) => {
    // Le front envoie duration_minutes, on le multiplie par 60 pour sauver en secondes (target_duration)
    const { id, user_id, date, start_time, title, description, type, duration_minutes, target_distance, target_load, target_intensity_zone, status } = req.body;
    const target_duration = duration_minutes ? duration_minutes * 60 : null;

    try {
        if (id) {
            db.prepare(`
                UPDATE training_plan 
                SET date = ?, start_time = ?, title = ?, description = ?, type = ?, target_duration = ?, target_distance = ?, target_load = ?, target_intensity_zone = ?, status = ?
                WHERE id = ? AND user_id = ?
            `).run(date, start_time, title, description, type, target_duration, target_distance, target_load, target_intensity_zone, status, id, user_id);
            return res.json({ success: true, message: "Séance mise à jour !" });
        } else {
            db.prepare(`
                INSERT INTO training_plan (user_id, date, start_time, title, description, type, target_duration, target_distance, target_load, target_intensity_zone, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(user_id, date, start_time, title, description, type, target_duration, target_distance, target_load, target_intensity_zone, status || 'planned');
            return res.json({ success: true, message: "Séance ajoutée au plan !" });
        }
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

// =========================================================================
// 🧠 4. POST /api/planning/reschedule (MOTEUR D'ARBITRAGE ADAPTATIF)
// =========================================================================
router.post('/reschedule', async (req, res) => {
    try {
        const { userId } = req.body;
        const today = new Date();
        const todayStr = formatLocalYYYYMMDD(today);
        const dayOfWeekToday = today.getDay(); 
        
        const currentWeekNum = getWeekNumber(today);
        const weekType = currentWeekNum % 2 === 0 ? 'even' : 'odd';

        // 1. Récupération des données Garmin / Élan du jour
        const fitness = db.prepare('SELECT readiness_score, hrv_status, tsb FROM daily_fitness WHERE user_id = ? AND date = ?').get(userId, todayStr);
        
        // 2. Récupération des contraintes appliquées pour AUJOURD'HUI
        const restrictionToday = db.prepare(`
            SELECT is_blocked FROM user_constraints 
            WHERE user_id = ? AND day_of_week = ?
              AND (specific_date = ? OR (specific_date IS NULL AND (week_alternation = 'all' OR week_alternation = ?)))
            LIMIT 1
        `).get(userId, dayOfWeekToday, todayStr, weekType);

        const currentRestriction = restrictionToday ? restrictionToday.is_blocked : 0; 

        // 3. Récupération de la séance prévue aujourd'hui
        const todaysSession = db.prepare('SELECT * FROM training_plan WHERE user_id = ? AND date = ? AND status = "planned"').get(userId, todayStr);

        if (!todaysSession) {
            return res.json({ success: true, message: "Aucune séance théorique planifiée pour aujourd'hui." });
        }

        // --- ARBITRAGE RÈGLE A : VERROU STRICT DE L'AGENDA (is_blocked = 2) ---
        if (currentRestriction === 2) {
            db.prepare('UPDATE training_plan SET status = "skipped", description = "[Arbitrage] Annulé pour cause d\'indisponibilité absolue." WHERE id = ?').run(todaysSession.id);
            return res.json({ success: true, message: "Agenda bloqué (Strict) : Séance annulée pour indisponibilité temporelle." });
        }

        // --- ARBITRAGE RÈGLE B : ENTRÉE EN CASERNE INDOOR (is_blocked = 1) ---
        if (currentRestriction === 1) {
            if (todaysSession.type === 'Run') {
                db.prepare(`
                    UPDATE training_plan 
                    SET title = "Renforcement de Substitution", 
                        type = "Strength",
                        description = "[Arbitrage Indoor] Séance CAP extérieure impossible. Remplacé par du Core/Gainage stable en intérieur.",
                        target_intensity_zone = "LIT",
                        target_load = 20
                    WHERE id = ?
                `).run(todaysSession.id);
                return res.json({ success: true, message: "Agenda Hybride : Course à pied extérieure mutée en renforcement intérieur." });
            } 
            
            if (todaysSession.type === 'Ride' && !todaysSession.description.includes('home-trainer')) {
                const newTitle = `${todaysSession.title} (Format Home-Trainer)`;
                const newDesc = `[Arbitrage Indoor] Transféré sur Home-Trainer : ${todaysSession.description}`;
                const newLoad = Math.round(todaysSession.target_load * 0.85); 

                db.prepare(`
                    UPDATE training_plan 
                    SET title = ?, description = ?, target_load = ?
                    WHERE id = ?
                `).run(newTitle, newDesc, newLoad, todaysSession.id);
                return res.json({ success: true, message: "Agenda Hybride : Sortie Vélo adaptée au format Home-Trainer." });
            }
        }

        // --- ARBITRAGE RÈGLE C : ALERTE PHYSIOLOGIQUE (Garmin Santé Basse) ---
        if (fitness && (fitness.readiness_score < 65 || fitness.hrv_status === 'low')) {
            if (todaysSession.target_intensity_zone === 'HIT') {
                db.prepare(`
                    UPDATE training_plan 
                    SET title = "Récupération Active Fatigué", 
                        description = "Alerte Fatigue / HRV Bas. Séance haute intensité (HIT) annulée pour protéger le système nerveux.", 
                        target_intensity_zone = "LIT", 
                        target_load = 15 
                    WHERE id = ?
                `).run(todaysSession.id);

                return res.json({ success: true, message: "Alerte Physiologique : Système nerveux fatigué. HIT dégradé en récupération active." });
            }
        }

        return res.json({ success: true, message: "Feu vert : Agenda et métriques physiologiques au vert. Séance maintenue." });
    } catch (error) {
        console.error("🔥 Erreur arbitrage:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;