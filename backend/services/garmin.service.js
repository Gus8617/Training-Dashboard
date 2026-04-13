const { GarminConnect } = require('garmin-connect');
const db = require('../database');
const { decrypt } = require('./auth.service');

// Fonction utilitaire pour ralentir les appels (Anti-Ban)
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function calculateSleepQuality(s) {
    if (!s.sleepTimeSeconds || s.sleepTimeSeconds < 3600) return 0;
    let score = 0;
    const durationScore = Math.min((s.sleepTimeSeconds / 28800) * 50, 50);
    score += durationScore;
    const deepRatio = s.deepSleepSeconds / s.sleepTimeSeconds;
    const deepScore = Math.min((deepRatio / 0.15) * 25, 25);
    score += deepScore;
    const remRatio = s.remSleepSeconds / s.sleepTimeSeconds;
    const remScore = Math.min((remRatio / 0.20) * 25, 25);
    score += remScore;
    if (s.awakeSleepSeconds > 900) {
        const penalty = Math.floor((s.awakeSleepSeconds - 900) / 300);
        score -= penalty;
    }
    return Math.max(0, Math.min(Math.round(score), 100));
}

function extractSleepData(sleepData, dateStr) {
    // 1. Sécurité de base
    if (!sleepData || !sleepData.dailySleepDTO) {
      return null;
    }
  
    const sleep = sleepData.dailySleepDTO;
    
    // 2. Vérification de la durée (Garmin renvoie parfois 0 si la montre n'a pas détecté de dodo)
    if (!sleep.sleepTimeSeconds || sleep.sleepTimeSeconds <= 0) {
      console.log(`⚠️ Données de sommeil vides pour ${dateStr}`);
      return null;
    }
  
    // 3. Extraction intelligente des scores
    // Note: Garmin utilise parfois .value ou .score selon les versions d'API
    const sleepQuality = sleep.sleepScores?.overall?.value 
                      || sleep.sleepScore 
                      || 0;
  
    // 4. HRV et Resting HR (On cherche à plusieurs endroits possibles)
    const hrvValue = sleepData.avgOvernightHrv 
                  || sleepData.hrvSummary?.lastNightAvg 
                  || null;
  
    const restingHR = sleepData.restingHeartRate 
                   || sleep.restingHeartRate 
                   || null;
  
    return {
      date: dateStr,
      duration: Math.round(sleep.sleepTimeSeconds / 60), // Conversion en minutes pour la BDD
      quality: sleepQuality,
      deepSleep: Math.round((sleep.deepSleepSeconds || 0) / 60),
      lightSleep: Math.round((sleep.lightSleepSeconds || 0) / 60),
      remSleep: Math.round((sleep.remSleepSeconds || 0) / 60),
      awake: Math.round((sleep.awakeSleepSeconds || 0) / 60),
      hrv: hrvValue,
      restingHR: restingHR
    };
  }

async function syncGarminHealth(userId) {
    let syncedCount = 0;
    console.log(`\n--- 💤 SYNC GARMIN DYNAMIQUE : User ${userId} ---`);
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    if (!user || !user.garmin_email || !user.garmin_password) return { count: 0 };

    // 1. Récupérer les dates déjà présentes en BDD pour cet utilisateur
    const existingRecords = db.prepare("SELECT date FROM health WHERE user_id = ? AND duration > 0").all(userId);
    const existingSet = new Set(existingRecords.map(row => row.date));

    // 2. Définir les priorités (Les 3 derniers jours pour MAJ du HRV/Sommeil)
    const priorityDates = [];
    for (let i = 0; i < 3; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        priorityDates.push(d.toISOString().split('T')[0]);
    }

    // 3. Identifier les "trous" dans le passé (Rampage/Backfill)
    const gapDates = [];
    let cursor = new Date();
    cursor.setDate(cursor.getDate() - 1); // On commence l'inspection à partir d'hier

    // On cherche les 5 trous les plus récents dans l'historique
    for (let i = 0; i < 365; i++) { // Sécurité max : 1 an en arrière
        const dateStr = cursor.toISOString().split('T')[0];
        
        if (!existingSet.has(dateStr) && !priorityDates.includes(dateStr)) {
            gapDates.push(dateStr);
        }

        if (gapDates.length >= 5) break; 
        cursor.setDate(cursor.getDate() - 1);
    }

    // 4. Fusionner les cibles (Priorités d'abord pour avoir le dashboard frais)
    const missingDates = [...new Set([...priorityDates, ...gapDates])];

    console.log(`[Garmin] Planning : ${priorityDates.length} MAJ + ${gapDates.length} trous trouvés.`);
    if (missingDates.length === 0) return { count: 0 };

    try {
        const client = new GarminConnect({
            username: decrypt(user.garmin_email),
            password: decrypt(user.garmin_password),
        });
        await client.login();
        console.log("✅ Connecté à Garmin.");

        for (const dateStr of missingDates) {
            try {
                const dateObj = new Date(dateStr);
                const rawSleep = await client.getSleepData(dateObj);
                const extracted = extractSleepData(rawSleep, dateStr);
                
                if (extracted) {
                    db.prepare(`
                        INSERT OR REPLACE INTO health (
                            user_id, date, duration, quality, deepSleep, lightSleep, remSleep, awake, hrv, restingHR
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `).run(
                        userId, dateStr, extracted.duration, extracted.quality,
                        extracted.deepSleep, extracted.lightSleep, extracted.remSleep,
                        extracted.awake, extracted.hrv, extracted.restingHR
                    );
                    syncedCount++;
                    console.log(`✅ Synchro ${priorityDates.includes(dateStr) ? 'MAJ' : 'TROU'} : ${dateStr}`);
                }
            
                await delay(2500); // Anti-ban

            } catch (dayError) {
                if (dayError.message.includes('429')) {
                    console.error("🛑 Rate Limit Garmin ! Arrêt immédiat.");
                    break;
                }
                console.error(`❌ Erreur date ${dateStr}:`, dayError.message);
            }
        }
    } catch (err) {
        console.error("❌ Erreur Login Garmin:", err.message);
    }
    return { count: syncedCount };
}

module.exports = { syncGarminHealth };