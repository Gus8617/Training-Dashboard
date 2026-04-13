const db = require('../database');

async function computeFitness(userId) {
    console.log(`\n--- 📈 CALCUL FITNESS & READINESS (CUSTOM SCORE) : User ${userId} ---`);

    // 1. On récupère le custom_score (recalculé par zones) au lieu du suffer_score Strava
    const activities = db.prepare(`
        SELECT date, custom_score 
        FROM activities 
        WHERE user_id = ? 
        ORDER BY date ASC
    `).all(userId);

    const healthData = db.prepare(`
        SELECT date, hrv, quality, restingHR 
        FROM health 
        WHERE user_id = ? 
        ORDER BY date ASC
    `).all(userId);

    // Groupement des activités par jour
    const dailyActivities = {};
    activities.forEach(a => {
        // On utilise custom_score, fallback à 0 si pas encore calculé
        dailyActivities[a.date] = (dailyActivities[a.date] || 0) + (a.custom_score || 0);
    });

    const dailyHealth = {};
    healthData.forEach(h => { dailyHealth[h.date] = h; });

    // Initialisation
    let ctl = 0;
    let atl = 0;
    const hrvWindow = [];
    const rhrWindow = []; 
    
    // On remonte assez loin pour stabiliser le CTL (Fitness)
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 360); 
    const endDate = new Date();

    const insertFitness = db.prepare(`
        INSERT OR REPLACE INTO daily_fitness (
            user_id, date, total_suffer_score, ctl, atl, tsb, 
            quality, hrv, hrv_baseline, resting_hr, resting_hr_baseline, readiness_score
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) 
    `);

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        
        // On utilise notre score basé sur les zones cardiaques
        const tss = dailyActivities[dateStr] || 0;
        
        const health = dailyHealth[dateStr];
        const currentHRV = health?.hrv || null;
        const currentRHR = health?.restingHR || null;
        const sleepQuality = health?.quality || 0;

        // --- BASINES (MOYENNES GLISSANTES 7j) ---
        let rhrBaseline = 0;
        if (currentRHR) {
            rhrWindow.push(currentRHR);
            if (rhrWindow.length > 7) rhrWindow.shift();
            rhrBaseline = rhrWindow.reduce((a, b) => a + b, 0) / rhrWindow.length;
        }

        let hrvBaseline = 0;
        if (currentHRV) {
            hrvWindow.push(currentHRV);
            if (hrvWindow.length > 7) hrvWindow.shift();
            hrvBaseline = hrvWindow.reduce((a, b) => a + b, 0) / hrvWindow.length;
        }

        // --- MODÈLE PHYSIOLOGIQUE (TSB DE LA VEILLE) ---
        const tsb = ctl - atl;
        
        // Mise à jour des constantes avec le Custom TSS
        ctl = ctl + (tss - ctl) / 42;
        atl = atl + (tss - atl) / 7;

        // --- CALCUL DU READINESS SCORE (LOGIQUE AMÉLIORÉE) ---
        let readiness = 60; // Base neutre
        
        // 1. Influence du TSB (Charge physique)
        readiness += Math.max(-20, Math.min(20, tsb)); 

        // 2. Influence HRV (Fatigue nerveuse)
        if (currentHRV && hrvBaseline > 0) {
            const hrvDiff = (currentHRV / hrvBaseline);
            if (hrvDiff < 0.90) readiness -= 25; 
            else if (hrvDiff > 1.05) readiness += 10;
        }

        // 3. Influence RHR (Stress cardio)
        if (currentRHR && rhrBaseline > 0) {
            if (currentRHR > rhrBaseline * 1.08) readiness -= 15;
        }

        // 4. Influence Sommeil (Pénalités progressives)
        if (sleepQuality > 0) {
            if (sleepQuality < 40) {
                readiness -= 35; // Palier CRITIQUE (ton cas du 15/01)
            } else if (sleepQuality < 65) {
                readiness -= 15; // Mauvaise nuit classique
            } else if (sleepQuality > 85) {
                readiness += 10; // Excellente nuit
            }
        }

        // 5. Bonus : Sécurité sur la Durée (si disponible)
        if (health?.duration && health.duration < 15000) { // Moins de 4h (en sec)
            readiness -= 20;
        }

        const finalReadiness = Math.max(5, Math.min(100, Math.round(readiness)));

        insertFitness.run(
            userId, 
            dateStr, 
            tss.toFixed(1), // On stocke le custom TSS total du jour
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
    console.log("✅ Fitness mis à jour avec le Custom Score.");
}

module.exports = { computeFitness };