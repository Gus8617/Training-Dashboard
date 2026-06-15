require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database'); 
const app = express();


// 1. LOGGER DE DEBUG
app.use((req, res, next) => {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
    next();
});

// 2. MIDDLEWARES
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3. CONFIGURATION CORS
const allowedOrigins = [
  'https://www.training-dashboard.com', 
  'https://training-dashboard.com',
  /^http:\/\/localhost(:\d+)?$/, 
  /^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/
];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.some(pattern => 
            typeof pattern === 'string' ? pattern === origin : pattern.test(origin)
        )) {
            callback(null, true);
        } else {
            callback(new Error('CORS bloqué pour cette origine'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true
}));

// 4. LOGIQUE MÉTIER (CRON)
require('./cron');

// 5. ROUTES API

const authRoutes = require('./routes/auth');
const dataRoutes = require('./routes/data');
const devRoutes = require('./routes/dev');
const planningRoutes = require('./routes/planning');
const { syncAll } = require('./services/strava.service');
const { sendTelegramMessage, generateDailyReport } = require('./services/telegram.service');
const { syncGarminHealth } = require('./services/garmin.service');
const constraintsRouter = require('./routes/constraints');
const recurringSessionsRouter = require('./routes/recurringSessions');


app.use('/api/planning', planningRoutes);
app.use('/api/constraints', constraintsRouter);
app.use('/api/recurring-sessions', recurringSessionsRouter);

app.use('/auth', authRoutes);
app.use('/api', dataRoutes);
app.use('/debug', devRoutes);

// --- ROUTE SYNCHRO STRAVA (Unique et propre) ---
app.get('/api/sync-strava', async (req, res) => {
    try {
        // ID 1 par défaut pour ton usage perso ou req.user.id
        const userId = req.query.userId || 1; 
        
        res.json({ message: `Synchronisation lancée pour l'utilisateur ${userId}` });

        console.log(`🔄 [${new Date().toLocaleTimeString()}] Synchro Strava en cours...`);
        await syncAll(userId);
        console.log("✅ Synchro Strava terminée.");
    } catch (error) {
        console.error("❌ Erreur lors de la synchro:", error);
    }
});

// --- ROUTE SYNCHRO GARMIN ---
app.get('/api/sync-health', async (req, res) => {
    try {
        const userId = req.query.userId || 1;
        
        // On lance la synchro (souvent asynchrone car long)
        // Si ton service utilise Garmin, c'est ici qu'il travaille
        await syncGarminHealth(userId); 
        
        res.json({ success: true, message: `Synchro Santé lancée pour l'utilisateur ${userId}` });
    } catch (error) {
        console.error("❌ Erreur Synchro Santé:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// --- ROUTE TEST TELEGRAM (Celle qui fonctionne !) ---
app.get('/api/test-telegram', (req, res) => {
    try {
        const userId = req.query.userId || 1; // On récupère l'ID du Cron
        const { sendTelegramMessage, generateDailyReport } = require('./services/telegram.service');
        
        // On récupère les infos de l'user pour avoir son vrai prénom dans le rapport
        const user = db.prepare("SELECT firstname FROM users WHERE id = ?").get(userId);
        if (!user) return res.status(404).json({ error: "Utilisateur non trouvé" });

        const fitnessRows = db.prepare("SELECT * FROM daily_fitness WHERE user_id = ? ORDER BY date DESC LIMIT 2").all(userId);
        const healthRows = db.prepare("SELECT * FROM health WHERE user_id = ? ORDER BY date DESC LIMIT 1").all(userId);

        if (fitnessRows.length === 0) {
            return res.status(404).json({ error: "Aucune donnée fitness." });
        }

        const report = generateDailyReport(
            { firstname: user.firstname }, 
            [...fitnessRows].reverse(), 
            healthRows
        );

        sendTelegramMessage(report)
            .then(() => res.json({ success: true, message: `Rapport envoyé pour ${user.firstname}` }))
            .catch(err => res.status(500).json({ error: "Erreur Telegram: " + err.message }));

    } catch (err) {
        console.error("❌ Erreur /api/test-telegram :", err.message);
        res.status(500).json({ error: err.message });
    }
});
app.get('/api/test-activity', (req, res) => {
    const lastActivity = db.prepare("SELECT * FROM activities ORDER BY date DESC LIMIT 1").get();
    const { formatActivityMessage, sendTelegramMessage } = require('./services/telegram.service');
    
    const msg = formatActivityMessage(lastActivity);
    sendTelegramMessage(msg);
    res.send("Résumé envoyé !");
});

app.post('/api/sync/all', async (req, res) => {
    try {
        const { userId } = req.body;
        console.log(`🌙 Maintenance nocturne pour l'user ${userId}`);
        
        // Ici on peut imaginer un recalcul des scores CTL/ATL/TSB
        // ou une synchro profonde de l'historique
        await syncAll(userId); 
        
        res.json({ success: true, message: "Maintenance terminée" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/ping', (req, res) => res.json({ status: 'pong', time: new Date() }));

// 6. FICHIERS STATIQUES (FRONTEND)
const distPath = path.join(__dirname, '../frontend/dist');
app.use(express.static(distPath));

// 7. GESTION DES ERREURS API (Placée APRES les routes valides)
app.use(['/api', '/auth'], (req, res) => {
    console.log(`⚠️  404 API sur : ${req.originalUrl}`);
    res.status(404).json({ error: `Route API introuvable` });
});

// 8. CATCH-ALL REACT
/*app.get(/^(?!\/auth|\/api).*$/, (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
});*/

app.get(/^(?!\/auth|\/api|\/debug).*$/, (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Serveur actif sur le port ${PORT}`);
});