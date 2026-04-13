require('dotenv').config();
const { GarminConnect } = require('garmin-connect');
const fs = require('fs');
const path = require('path');

async function syncGarminHistory() {
  try {
    const client = new GarminConnect({
        username: process.env.GARMIN_EMAIL,
        password: process.env.GARMIN_PASSWORD,
    });
    await client.login();
    console.log("✅ Authentifié ! Début de la synchro historique (30 jours)...");

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const sleepDataArray = [];

    // On boucle sur les dates
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      
      try {
        const dateObj = new Date(dateStr + 'T12:00:00Z');
        const sleepData = await client.getSleepData(dateObj);
        
        if (sleepData?.dailySleepDTO?.sleepTimeSeconds) {
          const sleep = sleepData.dailySleepDTO;
          console.log(`📥 Données récupérées pour le ${dateStr}`);
          
          sleepDataArray.push({
            date: dateStr,
            duration: Math.round(sleep.sleepTimeSeconds / 60),
            quality: sleep.sleepScores?.overall?.value || sleep.sleepScore || 0,
            deepSleep: Math.round((sleep.deepSleepSeconds || 0) / 60),
            lightSleep: Math.round((sleep.lightSleepSeconds || 0) / 60),
            remSleep: Math.round((sleep.remSleepSeconds || 0) / 60),
            awake: Math.round((sleep.awakeSleepSeconds || 0) / 60),
            hrv: sleepData.avgOvernightHrv || null,
            restingHR: sleepData.restingHeartRate || null
          });
        }
      } catch (err) {
        // Jour sans données ou erreur API, on passe au suivant
      }
    }

    // SAUVEGARDE DANS LE FICHIER JSON
    const filePath = path.join(__dirname, '../data/health.json');
    fs.writeFileSync(filePath, JSON.stringify(sleepDataArray, null, 2));

    console.log(`\n✨ Terminé ! ${sleepDataArray.length} nuits enregistrées dans health.json`);

  } catch (error) {
    console.error('❌ Erreur sync Garmin:', error.message);
  }
}

syncGarminHistory();