const express = require('express');
const router = express.Router();
const db = require('../database'); 

// =========================================================================
// 🔒 1. RECUPERER LES CONTRAINTES D'UN UTILISATEUR (CORRIGÉ)
// =========================================================================
router.get('/:userId', (req, res) => {
    try {
        const { userId } = req.params;
        const { weekType } = req.query;

        if (!userId) {
            return res.status(400).json({ success: false, error: "userId manquant." });
        }

        const queryStr = `SELECT * FROM user_constraints WHERE user_id = ? ORDER BY day_of_week ASC, start_time ASC`;
        const rawConstraints = db.prepare(queryStr).all(userId);
        
        // On traite les données de manière sécurisée AVANT d'envoyer la réponse
        const constraints = rawConstraints
            .map(c => {
                const dayValue = (c.day_of_week === -1 || c.day_of_week === null) ? null : Number(c.day_of_week);
                const dateValue = (c.specific_date === "" || c.specific_date === null) ? null : c.specific_date;
                return {
                    ...c,
                    day_of_week: dayValue,
                    dayOfWeek: dayValue,
                    specific_date: dateValue,
                    specificDate: dateValue,
                    start_time: c.start_time,
                    startTime: c.start_time,
                    end_time: c.end_time,
                    endTime: c.end_time,
                    // Ici on garde la valeur brute pour le front (0, 1 ou 2)
                    is_blocked: Number(c.is_blocked),
                    isBlocked: Number(c.is_blocked),
                    week_alternation: c.week_alternation || 'all',
                    weekAlternation: c.week_alternation || 'all'
                };
            })
            .filter(c => {
                if (c.specific_date) return true;
                return (!weekType || weekType === 'all' || c.week_alternation === 'all' || c.week_alternation === weekType);
            });

        // ENVOI UNIQUE DE LA REPONSE
        return res.json({ success: true, constraints });

    } catch (error) {
        console.error("🔥 Erreur GET /api/constraints:", error);
        // On vérifie si les headers ne sont pas déjà envoyés avant de répondre
        if (!res.headersSent) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }
});

// =========================================================================
// 💾 2. ENREGISTRER UNE OU PLUSIEURS CONTRAINTES (SUPPORT RECURRENCE MULTI-JOURS)
// =========================================================================
router.post('/save', (req, res) => {
    const { 
        user_id, userId, mode, day_of_week, dayOfWeek,
        specific_date, specificDate, start_time, startTime,
        end_time, endTime, is_blocked, isBlocked, week_alternation, weekAlternation
    } = req.body;

    const finalUserId = user_id || userId;
    if (!finalUserId) {
        return res.status(400).json({ success: false, error: "Le paramètre user_id ou userId est obligatoire." });
    }

    try {
        const rawDate = specific_date || specificDate;
        const finalWeekAlternation = week_alternation || weekAlternation || 'all';
        const finalStartTime = start_time || startTime || "00:00";
        const finalEndTime = end_time || endTime || "23:59";
        const rawBlocked = is_blocked !== undefined ? is_blocked : isBlocked;
        const finalIsBlocked = (rawBlocked !== undefined && rawBlocked !== null) ? parseInt(rawBlocked, 10) : 0;

        // Préparation du statement d'upsert basé sur la PRIMARY KEY composite de ta table
        const stmt = db.prepare(`
            INSERT INTO user_constraints (
                user_id, day_of_week, specific_date, start_time, end_time, is_blocked, week_alternation
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT DO UPDATE SET 
                end_time = excluded.end_time,
                is_blocked = excluded.is_blocked
        `);

        // --- CAS 1 : DATE SPÉCIFIQUE ---
        if (mode === 'date' || (rawDate && rawDate.trim() !== "")) {
            stmt.run(
                parseInt(finalUserId, 10), 
                -1, // Pas de jour de semaine récurrent
                rawDate.trim(), 
                finalStartTime, 
                finalEndTime, 
                finalIsBlocked, 
                finalWeekAlternation
            );
        } 
        // --- CAS 2 : RÉCURRENCE HEBDOMADAIRE ---
        else {
            const rawDay = day_of_week !== undefined ? day_of_week : dayOfWeek;
            
            // Si le Front envoie un tableau de jours sélectionnés [1, 2, 4...]
            if (Array.isArray(rawDay)) {
                const insertTransaction = db.transaction((daysList) => {
                    for (const day of daysList) {
                        stmt.run(
                            parseInt(finalUserId, 10), 
                            Number(day), 
                            "", // Pas de date spécifique
                            finalStartTime, 
                            finalEndTime, 
                            finalIsBlocked, 
                            finalWeekAlternation
                        );
                    }
                });
                insertTransaction(rawDay);
            } 
            // Si le Front n'envoie qu'une seule valeur numérique/string simple
            else if (rawDay !== undefined && rawDay !== null) {
                stmt.run(
                    parseInt(finalUserId, 10), 
                    Number(rawDay), 
                    "", 
                    finalStartTime, 
                    finalEndTime, 
                    finalIsBlocked, 
                    finalWeekAlternation
                );
            } else {
                return res.status(400).json({ success: false, error: "Aucun jour ou date valide fourni pour l'enregistrement." });
            }
        }

        return res.json({ success: true, message: "Créneau(x) de disponibilité enregistré(s)." });
    } catch (error) {
        console.error("🔥 Erreur /api/constraints/save unitaire:", error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

// =========================================================================
// 🗑️ 3. SUPPRIMER UNE CONTRAINTE (TOLÉRANT AUX NULLS ET FORMATS MIXTES)
// =========================================================================
router.delete('/delete', (req, res) => {
    const userId = req.body.userId || req.query.userId || req.body.user_id;
    const dayOfWeek = req.body.day_of_week !== undefined ? req.body.day_of_week : (req.body.dayOfWeek ?? req.query.dayOfWeek);
    const weekAlternation = req.body.week_alternation || req.body.weekAlternation || req.query.weekAlternation || 'all';
    const specificDate = req.body.specific_date || req.body.specificDate || req.query.specificDate || "";
    const startTime = req.body.start_time || req.body.startTime || req.query.startTime || "00:00";

    if (!userId) {
        return res.status(400).json({ success: false, error: "Le paramètre userId est obligatoire." });
    }

    try {
        let finalDayOfWeek = -1;
        let finalSpecificDate = "";

        // Réalignement sur notre structure anti-NULL SQLite
        if (specificDate && specificDate.trim() !== "" && specificDate !== "null") {
            finalSpecificDate = specificDate.trim();
            finalDayOfWeek = -1;
        } else if (dayOfWeek !== null && dayOfWeek !== undefined && dayOfWeek !== "null") {
            finalDayOfWeek = Number(dayOfWeek);
            finalSpecificDate = "";
        }

        // Requête de suppression robuste (gère la structure propre et nettoie les anciens NULL physiques)
        const stmt = db.prepare(`
            DELETE FROM user_constraints
            WHERE user_id = ?
              AND (day_of_week = ? OR (day_of_week IS NULL AND ? = -1))
              AND (specific_date = ? OR (specific_date IS NULL AND ? = ''))
              AND start_time = ?
              AND week_alternation = ?
        `);

        const result = stmt.run(
            parseInt(userId, 10), 
            finalDayOfWeek, 
            finalDayOfWeek,
            finalSpecificDate, 
            finalSpecificDate,
            startTime, 
            weekAlternation
        );

        console.log(`🗑️ Suppression exécutée. Lignes nettoyées : ${result.changes}`);

        return res.json({ success: true, message: "Contrainte d'agenda supprimée." });
    } catch (error) {
        console.error("🔥 Erreur dans DELETE /api/constraints/delete:", error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;