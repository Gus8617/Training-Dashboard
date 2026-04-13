const db = require('../database');

async function computeFitness() {
    console.log("📈 Calcul des scores Fitness (CTL/ATL/TSB)...");

    // 1. Récupérer toutes les activités et les grouper par jour
    const dailyActivities = db.prepare(`
        SELECT date(date) as day, SUM(suffer_score) as daily_suffer 
        FROM activities 
        GROUP BY day 
        ORDER BY day ASC
    `).all();

    // 2. Récupérer la plage complète de dates (pour ne pas avoir de trous)
    if (dailyActivities.length === 0) return console.log("⚠️ Aucune activité trouvée.");
    
    const firstDate = new Date(dailyActivities[0].day);
    const lastDate = new Date();
    const sufferMap = new Map(dailyActivities.map(a => [a.day, a.daily_suffer]));

    let lastCTL = 0;
    let lastATL = 0;

    const upsertFitness = db.prepare(`
        INSERT INTO daily_fitness (date, total_suffer_score, ctl, atl, tsb)
        VALUES (@date, @score, @ctl, @atl, @tsb)
        ON CONFLICT(date) DO UPDATE SET 
            total_suffer_score=excluded.total_suffer_score,
            ctl=excluded.ctl, atl=excluded.atl, tsb=excluded.tsb
    `);

    // 3. Boucle jour par jour pour calculer l'historique
    for (let d = new Date(firstDate); d <= lastDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const daySuffer = sufferMap.get(dateStr) || 0;

        // Formules de Banister
        // CTL : constante de temps 42 jours
        // ATL : constante de temps 7 jours
        const currentCTL = lastCTL + (daySuffer - lastCTL) * (1 - Math.exp(-1 / 42));
        const currentATL = lastATL + (daySuffer - lastATL) * (1 - Math.exp(-1 / 7));
        const currentTSB = lastCTL - lastATL; // La forme est basée sur les scores d'hier

        upsertFitness.run({
            date: dateStr,
            score: daySuffer,
            ctl: currentCTL.toFixed(2),
            atl: currentATL.toFixed(2),
            tsb: currentTSB.toFixed(2)
        });

        lastCTL = currentCTL;
        lastATL = currentATL;
    }

    console.log("✅ Table daily_fitness mise à jour.");
}

computeFitness();