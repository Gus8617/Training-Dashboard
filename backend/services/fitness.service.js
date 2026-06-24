const db = require('../database');

async function computeFitness(userId) {
    console.log(`\n--- 📈 CALCUL FITNESS & READINESS (CUSTOM SCORE) : User ${userId} ---`);

    // 1. Récupération des données d'activités avec le custom_score
    const activities = db.prepare(`
        SELECT date, custom_score 
        FROM activities 
        WHERE user_id = ? 
        ORDER BY date ASC
    `).all(userId);

    // 2. Récupération des données de santé (HRV, Sommeil, RHR)
    const healthData = db.prepare(`
        SELECT date, hrv, quality, restingHR 
        FROM health 
        WHERE user_id = ? 
        ORDER BY date ASC
    `).all(userId);

    // Groupement des activités par jour
    const dailyActivities = {};
    activities.forEach(a => {
        dailyActivities[a.date] = (dailyActivities[a.date] || 0) + (a.custom_score || 0);
    });

    const dailyHealth = {};
    healthData.forEach(h => { dailyHealth[h.date] = h; });

    // Initialisation des compteurs et fenêtres glissantes
    let ctl = 0;
    let atl = 0;
    const hrvWindow = [];
    const rhrWindow = []; 
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 360); 
    const endDate = new Date();

    // 🎯 FIX : Déclaration de la requête préparée SQLITE (Qui manquait dans ton scope)
    const insertFitness = db.prepare(`
        INSERT OR REPLACE INTO daily_fitness (
            user_id, date, total_suffer_score, ctl, atl, tsb, 
            quality, hrv, hrv_baseline, resting_hr, resting_hr_baseline, readiness_score
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) 
    `);

    // Boucle de traitement chronologique sur 360 jours
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const tss = dailyActivities[dateStr] || 0;
        
        const health = dailyHealth[dateStr];
        const currentHRV = health?.hrv || null;
        const currentRHR = health?.restingHR || null;
        const sleepQuality = health?.quality || 0;

        // --- BASELINES ROBUSTES (Fenêtre de 21 jours) ---
        let rhrBaseline = 0;
        if (currentRHR) {
            rhrWindow.push(currentRHR);
            if (rhrWindow.length > 21) rhrWindow.shift();
            rhrBaseline = rhrWindow.reduce((a, b) => a + b, 0) / rhrWindow.length;
        }

        let hrvBaseline = 0;
        if (currentHRV) {
            hrvWindow.push(currentHRV);
            if (hrvWindow.length > 21) hrvWindow.shift();
            hrvBaseline = hrvWindow.reduce((a, b) => a + b, 0) / hrvWindow.length;
        }

        // --- MODÈLE PHYSIOLOGIQUE (TSB) ---
        const tsb = ctl - atl;
        
        ctl = ctl + (tss - ctl) / 42;
        atl = atl + (tss - atl) / 7;

        // --- CALCUL DU READINESS SCORE SÉCURISÉ ---
        let scorePhysique = 50; 
        let tssModifier = tsb * 1.2; 
        scorePhysique += Math.max(-30, Math.min(25, tssModifier));

        let scoreSante = 50; 
        let santePenalties = 0;

        // Évaluation HRV
        if (currentHRV && hrvBaseline > 0) {
            const hrvDiff = (currentHRV / hrvBaseline);
            if (hrvDiff < 0.88) santePenalties += 25; 
            else if (hrvDiff < 0.94) santePenalties += 10; 
            else if (hrvDiff > 1.04) scoreSante += 5; 
        }

        // Évaluation RHR
        if (currentRHR && rhrBaseline > 0) {
            if (currentRHR > rhrBaseline * 1.06) santePenalties += 15; 
        }

        // Évaluation Sommeil
        if (sleepQuality > 0) {
            if (sleepQuality < 45) santePenalties += 25;
            else if (sleepQuality < 68) santePenalties += 10;
            else if (sleepQuality > 85) scoreSante += 5;
        }

        // Limitation de l'impact cumulé des mauvaises métriques (Amortisseur)
        scoreSante -= Math.min(40, santePenalties); 

        // Score Final Pondéré
        let readiness = (scorePhysique * 0.55) + (scoreSante * 0.45);

        // Sécurité sommeil ultra-court
        if (health?.duration && health.duration < 16200) { 
            readiness -= 15;
        }

        const finalReadiness = Math.max(10, Math.min(100, Math.round(readiness)));

        // Insertion en base de données SQLite
        insertFitness.run(
            userId, 
            dateStr, 
            tss.toFixed(1), 
            ctl.toFixed(2), 
            atl.toFixed(2), 
            tsb.toFixed(2),
            sleepQuality, 
            currentHRV,
            hrvBaseline > 0 ? hrvBaseline.toFixed(1) : 0, 
            currentRHR, 
            rhrBaseline > 0 ? rhrBaseline.toFixed(1) : 0, 
            finalReadiness
        );
    }
    console.log("✅ Fitness et Readiness mis à jour avec succès.");
}

module.exports = { computeFitness };