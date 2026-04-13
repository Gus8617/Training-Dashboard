const cron = require('node-cron');
const axios = require('axios');
const db = require('./database'); // On importe db pour lister les users

const PORT = process.env.PORT || 3000;
const BASE_URL = `http://127.0.0.1:${PORT}`;

// Fonction utilitaire pour récupérer tous les IDs d'utilisateurs
const getAllUserIds = () => {
    try {
        const users = db.prepare("SELECT id FROM users").all();
        return users.map(u => u.id);
    } catch (err) {
        console.error("❌ Impossible de récupérer les utilisateurs:", err.message);
        return [];
    }
};

/**
 * 1. SYNCHRO STRAVA (Toutes les heures)
 */
cron.schedule('0 * * * *', async () => {
    const userIds = getAllUserIds();
    console.log(`🏃 [Cron] Synchro Strava pour ${userIds.length} utilisateur(s)...`);
    
    for (const id of userIds) {
        try {
            await axios.get(`${BASE_URL}/api/sync-strava?userId=${id}`);
            console.log(`✅ Strava OK pour User ${id}`);
        } catch (error) {
            console.error(`❌ Erreur Strava User ${id}:`, error.message);
        }
    }
}, { timezone: "Europe/Paris" });

/**
 * 2. SYNCHRO SANTÉ (08h30)
 */
cron.schedule('30 8 * * *', async () => {
    const userIds = getAllUserIds();
    console.log(`😴 [Cron] Synchro Santé pour ${userIds.length} utilisateur(s)...`);
    
    for (const id of userIds) {
        try {
            await axios.get(`${BASE_URL}/api/sync-health?userId=${id}`);
            console.log(`✅ Santé OK pour User ${id}`);
        } catch (error) {
            console.error(`❌ Erreur Santé User ${id}:`, error.message);
        }
    }
}, { timezone: "Europe/Paris" });

/**
 * 3. RAPPORT TELEGRAM (09h05)
 */
cron.schedule('5 9 * * *', async () => {
    const userIds = getAllUserIds();
    console.log(`📨 [Cron] Envoi des rapports pour ${userIds.length} utilisateur(s)...`);
    
    for (const id of userIds) {
        try {
            // Note : ta route test-telegram doit accepter un userId en query 
            // ex: app.get('/api/test-telegram', (req, res) => { const userId = req.query.userId || 1; ... })
            await axios.get(`${BASE_URL}/api/test-telegram?userId=${id}`);
            console.log(`✅ Rapport envoyé pour User ${id}`);
        } catch (error) {
            console.error(`❌ Erreur Rapport User ${id}:`, error.message);
        }
    }
}, { timezone: "Europe/Paris" });

/**
 * 4. MAINTENANCE (03h00)
 */
cron.schedule('0 3 * * *', async () => {
    const userIds = getAllUserIds();
    console.log(`🌙 [Cron] Maintenance pour ${userIds.length} utilisateur(s)...`);
    
    for (const id of userIds) {
        try {
            await axios.post(`${BASE_URL}/api/sync/all`, { userId: id });
        } catch (error) {
            console.error(`❌ Erreur Maintenance User ${id}:`, error.message);
        }
    }
}, { timezone: "Europe/Paris" });

console.log("🚀 Chef d'orchestre Cron Dynamique démarré");