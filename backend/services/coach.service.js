// services/coach.service.js
const db = require('../database');
const { computeFitness } = require('./fitness.service');

/**
 * Analyse l'historique récent pour détecter les séances manquées,
 * applique les règles de récupération physiologiques et réajuste le plan.
 * @param {number|string} userId - L'ID de l'utilisateur
 */
async function handleMissedSessions(userId) {
    console.log(`\n--- 🧠 ARBITRAGE DU COACHING HYBRIDE : User ${userId} ---`);

    // 1. Trouver les séances "planned" loupées (date passée, pas de strava_id)
    const todayStr = new Date().toISOString().split('T')[0];
    const missed = db.prepare(`
        SELECT * FROM training_plan 
        WHERE user_id = ? AND date < ? AND status = 'planned' AND strava_id IS NULL
    `).all(userId, todayStr);

    if (missed.length === 0) {
        console.log("✅ Aucune séance planifiée manquée détectée.");
        return { success: true, missedDetected: 0, shifted: 0, skipped: 0 };
    }

    console.log(`⚠️ ${missed.length} séance(s) manquée(s) détectée(s). Analyse de l'état de fatigue...`);

    // 2. Récupérer le dernier état de forme/santé calculé par fitness.service
    const healthState = db.prepare(`
        SELECT readiness_score, ctl, tsb FROM daily_fitness 
        WHERE user_id = ? AND date <= ? 
        ORDER BY date DESC LIMIT 1
    `).get(userId, todayStr) || { readiness_score: 60, ctl: 0, tsb: 0 };

    console.log(`📊 État de l'athlète -> Readiness: ${healthState.readiness_score}/100 | CTL: ${parseFloat(healthState.ctl).toFixed(1)} | TSB: ${parseFloat(healthState.tsb).toFixed(1)}`);

    let shiftedCount = 0;
    let skippedCount = 0;

    // Préparation des requêtes SQL pour optimiser les performances de la boucle
    const updateToSkipped = db.prepare(`UPDATE training_plan SET status = 'skipped' WHERE id = ?`);
    const shiftToNewDate = db.prepare(`UPDATE training_plan SET date = ? WHERE id = ?`);

    for (const session of missed) {
        console.log(`\n🔍 Analyse de la séance : [${session.type.toUpperCase()}] "${session.title}" (Target Load: ${session.target_load || session.planned_tss || 0})`);

        const sessionLoad = session.target_load || session.planned_tss || 0;

        // REGLE 1 : Séance lourde (> 50 TSS) + Récupération dans le rouge (< 50)
        // On ne surcharge pas le corps, on supprime la séance pour laisser le système nerveux récupérer.
        if (sessionLoad > 50 && healthState.readiness_score < 50) {
            updateToSkipped.run(session.id);
            console.log(`❌ SÉANCE SUPPRIMÉE : Risque de surentraînement élevé ou immunité basse (Readiness < 50).`);
            skippedCount++;
        } 
        // REGLE 2 : C'est une séance cool (Récup/Endurance fondamentale) ou la forme générale est bonne
        // On essaie de la décaler à un moment plus propice.
        else {
            const nextAvailableDate = fallbackToNextAvailableDay(userId, todayStr, session.type);
            shiftToNewDate.run(nextAvailableDate, session.id);
            console.log(`🔄 SÉANCE DÉCALÉE : Transférée au ${nextAvailableDate}.`);
            shiftedCount++;
        }
    }

    // 3. RECASCADING : Comme le calendrier à venir a bougé, on force le recalcul
    // des courbes prédictives CTL/ATL/TSB pour éviter tout décalage visuel.
    await computeFitness(userId);

    return {
        success: true,
        missedDetected: missed.length,
        shifted: shiftedCount,
        skipped: skippedCount
    };
}

/**
 * Algorithme glissant cherchant le prochain jour d'entraînement valide
 * en fonction des contraintes de l'utilisateur et de la densité du planning.
 */
function fallbackToNextAvailableDay(userId, fromDateStr, sportType) {
    let target = new Date(fromDateStr);

    // On cherche un créneau idéal sur les 7 prochains jours
    for (let i = 0; i < 7; i++) {
        const dateStr = target.toISOString().split('T')[0];
        const dayOfWeek = target.getDay(); // 0 = Dimanche, 1 = Lundi...

        // A. Vérification de l'emploi du temps (jours bloqués pro/perso)
        // On vérifie s'il existe une table ou une config utilisateur pour ce jour de la semaine
        const constraint = db.prepare(`
            SELECT is_blocked FROM user_constraints 
            WHERE user_id = ? AND day_of_week = ?
        `).get(userId, dayOfWeek);

        if (constraint && constraint.is_blocked === 1) {
            target.setDate(target.getDate() + 1);
            continue; // Journée bloquée, on passe à la suivante
        }

        // B. Éviter la surcharge (Maximum 2 séances planifiées par jour)
        const dailyCount = db.prepare(`
            SELECT COUNT(*) as count FROM training_plan 
            WHERE user_id = ? AND date = ? AND status = 'planned'
        `).get(userId, dateStr);

        if (dailyCount.count >= 2) {
            target.setDate(target.getDate() + 1);
            continue; // Déjà trop chargé, on cherche le jour d'après
        }

        // Si toutes les conditions sont validées, on prend cette date !
        return dateStr;
    }

    // Fallback de sécurité extrême : Si les 7 prochains jours sont pleins, on pousse à demain
    const tomorrow = new Date(fromDateStr);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
}

module.exports = { handleMissedSessions };