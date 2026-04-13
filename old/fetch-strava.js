require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const STRAVA_URL = "https://www.strava.com/api/v3";

async function getAccessToken() {
    const response = await axios.post('https://www.strava.com/oauth/token', {
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        refresh_token: process.env.STRAVA_REFRESH_TOKEN,
        grant_type: 'refresh_token'
    });
    return response.data.access_token;
}

async function fetchAll() {
    try {
        const token = await getAccessToken();
        const headers = { Authorization: `Bearer ${token}` };

        console.log("🚀 Récupération des dernières activités...");
        const { data: activities } = await axios.get(`${STRAVA_URL}/athlete/activities?per_page=10`, { headers });

        const detailedActivities = [];

        for (const activity of activities) {
    console.log(`📦 Traitement : ${activity.name}`);
    
    let hrZonesData = [];
    try {
        const { data: zones } = await axios.get(`${STRAVA_URL}/activities/${activity.id}/zones`, { headers });
        
        // CORRECTION ICI : 'heartrate' au lieu de 'heart_rate'
        const hrObject = zones.find(z => z.type === 'heartrate');
        if (hrObject) {
            hrZonesData = hrObject.distribution_buckets;
        }
    } catch (err) {
        console.log(`⚠️ Pas de zones pour ${activity.name}`);
    }

    detailedActivities.push({
        id: activity.id,
        name: activity.name,
        type: activity.type,
        distance: (activity.distance / 1000).toFixed(2), // Conversion en km
        moving_time: Math.floor(activity.moving_time / 60), // Conversion en min
        start_date: activity.start_date,
        average_heartrate: activity.average_heartrate,
        suffer_score: activity.suffer_score || 0,
        hr_zones: hrZonesData
    });
}
        // Sauvegarde dans le dossier data/
        const filePath = path.join(__dirname, '../data/activities.json');
        
        // Créer le dossier data s'il n'existe pas
        if (!fs.existsSync(path.join(__dirname, '../data'))) {
            fs.mkdirSync(path.join(__dirname, '../data'));
        }

        fs.writeFileSync(filePath, JSON.stringify(detailedActivities, null, 2));
        console.log(`✅ Succès ! ${detailedActivities.length} activités stockées dans data/activities.json`);

    } catch (error) {
        console.error("❌ Erreur :", error.response ? error.response.data : error.message);
    }
}

fetchAll();