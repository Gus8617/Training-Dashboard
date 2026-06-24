const axios = require('axios');
const db = require('../database');
const { encrypt, decrypt } = require('../services/auth.service');
const { formatActivityMessage, sendTelegramMessage } = require('./telegram.service');

// Utilitaire pour respecter les quotas API Strava
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 1. Gestion du rafraîchissement du Token Strava
 */
async function getStravaAccessToken(user) {
    const now = Math.floor(Date.now() / 1000);
    
    if (!user.access_token || (user.expires_at - now) < 300) {
        console.log(`[Strava] Token expiré pour ${user.firstname}, rafraîchissement...`);
        try {
            const response = await axios.post('https://www.strava.com/oauth/token', {
                client_id: user.client_id,
                client_secret: decrypt(user.client_secret),
                refresh_token: decrypt(user.refresh_token),
                grant_type: 'refresh_token'
            });

            const { access_token, refresh_token, expires_at } = response.data;

            db.prepare(`
                UPDATE users 
                SET access_token = ?, expires_at = ?, refresh_token = ? 
                WHERE id = ?
            `).run(encrypt(access_token), expires_at, encrypt(refresh_token), user.id);

            return access_token;
        } catch (err) {
            console.error("❌ Erreur Strava Refresh API:", err.response?.data || err.message);
            return null;
        }
    }
    return decrypt(user.access_token);
}

/**
 * 2. Calcul du score basé sur les zones cardiaques
 */
function calculateCustomScore(distributionBuckets) {
    if (!distributionBuckets || distributionBuckets.length === 0) return 0;
    
    // Z1 (Récup), Z2 (Endurance), Z3 (Tempo), Z4 (Seuil), Z5 (PMA+)
    // 1h à 100% du seuil (Z4) doit donner environ 100 points. 100 / 60 min = ~1.65
    const weights = [0.5, 1.0, 1.4, 1.7, 3.2]; 
    
    const score = distributionBuckets.reduce((total, bucket, index) => {
        const minutes = (bucket.time || 0) / 60;
        const weight = weights[index] || 0.5;
        return total + (minutes * weight);
    }, 0);
    
    return parseFloat(score.toFixed(2));
}

/**
 * 3. Récupération des zones HR (Bouchage des scores manquants)
 */
async function fetchMissingZones(accessToken, userId, limit = 80) {
    const pending = db.prepare(`
        SELECT id FROM activities 
        WHERE user_id = ? AND (hr_zones = '[]' OR hr_zones IS NULL)
        ORDER BY date DESC LIMIT ?
    `).all(userId, limit);

    const totalToProcess = db.prepare(`
        SELECT COUNT(*) as count FROM activities 
        WHERE user_id = ? AND (hr_zones = '[]' OR hr_zones IS NULL)
    `).get(userId).count;

    if (pending.length === 0) {
        console.log("✅ Toutes les activités ont déjà leurs scores cardiaques.");
        return;
    }

    console.log(`[Zones] Traitement de ${pending.length} activités. (Reste total à traiter : ${totalToProcess})`);

    const updateStmt = db.prepare(`UPDATE activities SET hr_zones = ?, custom_score = ? WHERE id = ?`);

    for (const act of pending) {
        try {
            await sleep(250); // Sécurité anti-spam API
            const response = await axios.get(
                `https://www.strava.com/api/v3/activities/${act.id}/zones`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );

            const hrZones = response.data.find(z => z.type === 'heartrate');
            
            if (hrZones && hrZones.distribution_buckets) {
                const distribution = hrZones.distribution_buckets;
                const score = calculateCustomScore(distribution);
                updateStmt.run(JSON.stringify(distribution), score, act.id.toString());
                console.log(`   🔸 ID ${act.id} score calculé : ${score}`);
            } else {
                updateStmt.run(JSON.stringify([{info: 'no_hr'}]), 0, act.id.toString());
                console.log(`   🔹 ID ${act.id} marqué sans cardio.`);
            }
        } catch (err) {
            if (err.response?.status === 429) {
                console.error("⚠️ Quota Strava atteint (429). Pause forcée.");
                break;
            }
            console.error(`❌ Erreur zones ID ${act.id}:`, err.message);
        }
    }
}

async function syncAll(userId) {
    console.log(`\n🚀 Lancement de la synchronisation intelligente (User ${userId})`);
    
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    const accessToken = await getStravaAccessToken(user);
    if (!accessToken) return { success: false, error: "Auth failed" };

    const lastActivity = db.prepare("SELECT date FROM activities WHERE user_id = ? ORDER BY date DESC LIMIT 1").get(userId);
    const afterTimestamp = lastActivity ? Math.floor(new Date(lastActivity.date).getTime() / 1000) - 86400 : 0;

    const insertAct = db.prepare(`
        INSERT OR IGNORE INTO activities (
            id, user_id, name, type, date, distance, 
            moving_time, average_hr, suffer_score, hr_zones, total_elevation_gain
        ) VALUES (@id, @user_id, @name, @type, @date, @distance, 
                  @moving_time, @average_hr, @suffer_score, @hr_zones, @total_elevation_gain)
    `);

    let page = 1;
    let totalNew = 0;
    let hasMore = true;
    let activitiesToSend = []; // 🚩 On va stocker les nouvelles activités ici

    while (hasMore) {
        try {
            const url = `https://www.strava.com/api/v3/athlete/activities?per_page=50&page=${page}&after=${afterTimestamp}`;
            const { data: activities } = await axios.get(url, { headers: { Authorization: `Bearer ${accessToken}` } });

            if (!activities || activities.length === 0) {
                hasMore = false;
                break;
            }

            let insertedInPage = 0;
            const syncTransaction = db.transaction((acts) => {
                for (const a of acts) {
                    const data = {
                        id: a.id.toString(),
                        user_id: userId,
                        name: a.name,
                        type: a.type,
                        date: a.start_date.split('T')[0],
                        distance: parseFloat((a.distance / 1000).toFixed(2)),
                        moving_time: Math.round(a.moving_time), // On garde les secondes pour le calcul précis de l'allure
                        average_hr: Math.round(a.average_heartrate) || null,
                        suffer_score: a.suffer_score || a.relative_effort || 0,
                        hr_zones: JSON.stringify([]),
                        total_elevation_gain: a.total_elevation_gain || 0 
                    };

                    const res = insertAct.run(data);
                    
                    if (res.changes > 0) {
                        insertedInPage++;
                        // 🚩 On n'envoie pas le message dans la transaction (car async), on stocke pour après
                        activitiesToSend.push(data); 
                    }
                }
            });

            syncTransaction(activities);
            totalNew += insertedInPage;
            
            console.log(`📄 Page ${page} : ${insertedInPage} nouvelles activités.`);

            if (activities.length < 50) hasMore = false;
            else page++;

        } catch (err) {
            console.error("❌ Erreur fetch:", err.message);
            hasMore = false;
        }
    }

    // --- PHASE 2 : RÉCUPÉRATION DES ZONES & ENVOI TELEGRAM ---
    await fetchMissingZones(accessToken, userId, 80);

    // 🚩 Une fois les zones récupérées en base, on envoie les messages
    if (activitiesToSend.length > 0) {
        console.log(`📩 Envoi de ${activitiesToSend.length} résumés à Telegram...`);
        for (const act of activitiesToSend) {
            // On recharge l'activité depuis la base pour avoir les zones toutes fraîches
            const updatedAct = db.prepare("SELECT * FROM activities WHERE id = ?").get(act.id);
            const message = formatActivityMessage(updatedAct);
            await sendTelegramMessage(message);
        }
    }

    const finalCount = db.prepare("SELECT COUNT(*) as count FROM activities WHERE user_id = ?").get(userId).count;
    console.log(`\n✨ Synchro terminée. Total en base : ${finalCount} activités.`);
    
    return { success: true, newActivities: totalNew, totalInDb: finalCount };
}

module.exports = { syncAll };