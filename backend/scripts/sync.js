
const { syncAll } = require('../services/strava.service');

async function run() {
    const userId = 3; // L'ID de Florian
    console.log("🚀 Lancement manuel de la synchronisation...");
    
    try {
        const report = await syncAll(userId);
        console.log(`✅ Réussite ! ${report.count} activités traitées.`);
        process.exit(0); // On ferme le script proprement
    } catch (err) {
        console.error("❌ Le script a échoué :", err.message);
        process.exit(1);
    }
}

run();