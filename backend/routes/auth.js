const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const axios = require('axios');
const db = require('../database');
const { encrypt, decrypt } = require('../services/auth.service');

// Connexion
router.post('/login', async (req, res) => {
    const { firstname, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE firstname = ?").get(firstname);
    
    if (user && await bcrypt.compare(password, user.password)) {
        res.json({ 
            userId: user.id, 
            firstname: user.firstname, 
            success: true 
        });
    } else {
        res.status(401).json({ error: "Identifiants incorrects" });
    }
});

// Inscription
router.post('/register', async (req, res) => {
    const { firstname, password } = req.body;
    try {
        const hash = await bcrypt.hash(password, 10);
        const result = db.prepare(`
            INSERT INTO users (firstname, password) VALUES (?, ?)
        `).run(firstname, hash);

        res.json({ userId: result.lastInsertRowid, firstname, success: true });
    } catch (err) {
        res.status(500).json({ error: "Ce prénom est déjà utilisé" });
    }
});

// Statut de connexion des services (allégé, type Garmin pour tout le monde)
router.get('/user-status/:userId', (req, res) => {
    const { userId } = req.params;
    try {
        const user = db.prepare("SELECT refresh_token, garmin_email, garmin_password FROM users WHERE id = ?").get(userId);
        if (user) {
            res.json({
                strava_connected: !!user.refresh_token, // True si déjà lié à Strava
                garmin_email: !!user.garmin_email,
                garmin_password: !!user.garmin_password
            });
        } else {
            res.status(404).json({ error: "Utilisateur non trouvé" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Finalisation de l'échange OAuth Strava (Mode Multi-Tenant avec le .env)
router.post('/finalize-strava', async (req, res) => {
    const { userId, code } = req.body;

    if (!code) {
        return res.status(400).json({ error: "Code OAuth manquant" });
    }

    // 🎯 Sécurité : On valide que le serveur possède ses propres clés d'application
    if (!process.env.STRAVA_CLIENT_ID || !process.env.STRAVA_CLIENT_SECRET) {
        console.error("❌ Configuration serveur : STRAVA_CLIENT_ID ou SECRET manquant dans le .env");
        return res.status(500).json({ error: "Configuration API serveur incorrecte" });
    }

    try {
        // Échange direct en utilisant les clés centralisées du serveur
        const response = await axios.post('https://www.strava.com/oauth/token', {
            client_id: process.env.STRAVA_CLIENT_ID,
            client_secret: process.env.STRAVA_CLIENT_SECRET, 
            code: code,
            grant_type: 'authorization_code'
        });

        const { refresh_token, access_token, expires_at, athlete } = response.data;

        // Sauvegarde des jetons personnels et de l'id athlète Strava
        db.prepare(`
            UPDATE users 
            SET strava_athlete_id = ?, refresh_token = ?, access_token = ?, expires_at = ? 
            WHERE id = ?
        `).run(athlete.id.toString(), encrypt(refresh_token), encrypt(access_token), expires_at, userId);

        console.log(`🚀 MULTI-TENANT OK : Compte Strava de ${athlete.firstname || 'User'} lié avec succès à l'user ${userId}`);
        res.json({ success: true });

    } catch (err) {
        console.error("❌ Erreur échange Strava Global:", err.response?.data || err.message);
        res.status(500).json({ error: "Échec de l'échange de tokens auprès de Strava" });
    }
});

// Liaison Garmin
router.post('/update-garmin', (req, res) => {
    const { userId, email, password } = req.body;

    if (!userId || !email || !password) {
        return res.status(400).json({ error: "Données manquantes" });
    }

    try {
        const stmt = db.prepare(`
            UPDATE users 
            SET garmin_email = ?, garmin_password = ? 
            WHERE id = ?
        `);
        
        stmt.run(encrypt(email), encrypt(password), userId);
        
        console.log(`✅ Identifiants Garmin mis à jour pour l'user ${userId}`);
        res.json({ success: true, message: "Identifiants Garmin enregistrés" });
    } catch (err) {
        console.error("🔥 Erreur SQL Garmin:", err.message);
        res.status(500).json({ error: "Erreur lors de la mise à jour BDD" });
    }
});

module.exports = router;