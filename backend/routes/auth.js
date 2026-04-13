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
        // C'est ici que ça se joue : on envoie userId ET firstname
        res.json({ 
            userId: user.id, 
            firstname: user.firstname, 
            success: true 
        });
    } else {
        res.status(401).json({ error: "Identifiants incorrects" });
    }
});

/// routes/auth.js
router.post('/register', async (req, res) => {
    const { firstname, password } = req.body;
    try {
        const hash = await bcrypt.hash(password, 10);
        // On crée l'utilisateur avec seulement son nom et pass
        const result = db.prepare(`
            INSERT INTO users (firstname, password) VALUES (?, ?)
        `).run(firstname, hash);

        res.json({ userId: result.lastInsertRowid, firstname, success: true });
    } catch (err) {
        res.status(500).json({ error: "Ce prénom est déjà utilisé" });
    }
});

router.post('/update-strava-credentials', (req, res) => {
    const { userId, client_id, client_secret } = req.body;

    try {
        const stmt = db.prepare(`
            UPDATE users 
            SET client_id = ?, client_secret = ? 
            WHERE id = ?
        `);
        
        // On utilise ta fonction encrypt() pour le secret
        stmt.run(client_id, encrypt(client_secret), userId);
        
        res.json({ success: true, message: "Identifiants API enregistrés" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erreur lors de la mise à jour BDD" });
    }
});

router.get('/user-status/:userId', (req, res) => {
    const { userId } = req.params;
    try {
        const user = db.prepare("SELECT client_id, refresh_token, garmin_email, garmin_password FROM users WHERE id = ?").get(userId);
        if (user) {
            res.json({
                client_id: user.client_id,
                refresh_token: !!user.refresh_token, // On renvoie juste true/false
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

router.post('/finalize-strava', async (req, res) => {
    const { userId, code } = req.body;

    try {
        // 1. Récupérer le client_id et client_secret (chiffré) en BDD
        const user = db.prepare("SELECT client_id, client_secret FROM users WHERE id = ?").get(userId);
        
        if (!user || !user.client_id || !user.client_secret) {
            return res.status(400).json({ error: "Identifiants API manquants en BDD" });
        }

        // 2. Échange du code contre les tokens auprès de Strava
        const response = await axios.post('https://www.strava.com/oauth/token', {
            client_id: user.client_id,
            client_secret: decrypt(user.client_secret), // On déchiffre pour Strava
            code: code,
            grant_type: 'authorization_code'
        });

        const { refresh_token, access_token, expires_at } = response.data;

        // 3. Sauvegarder le précieux REFRESH_TOKEN (chiffré)
        db.prepare(`
            UPDATE users 
            SET refresh_token = ?, access_token = ?, expires_at = ? 
            WHERE id = ?
        `).run(encrypt(refresh_token), encrypt(access_token), expires_at, userId);

        console.log(`🚀 AUTOMATISATION PRÊTE : Refresh Token stocké pour l'user ${userId}`);
        res.json({ success: true });

    } catch (err) {
        console.error("❌ Erreur échange Strava:", err.response?.data || err.message);
        res.status(500).json({ error: "Échec de l'échange de tokens" });
    }
});

router.post('/update-garmin', (req, res) => {

    // ✅ On extrait 'email' et 'password' (noms envoyés par le front)
    const { userId, email, password } = req.body;

    if (!userId || !email || !password) {
        console.error("❌ Données manquantes dans la requête");
        return res.status(400).json({ error: "Données manquantes" });
    }

    try {
        const stmt = db.prepare(`
            UPDATE users 
            SET garmin_email = ?, garmin_password = ? 
            WHERE id = ?
        `);
        
        // On chiffre les deux pour Garmin (données sensibles)
        // Attention : On utilise les variables extraites ci-dessus
        stmt.run(encrypt(email), encrypt(password), userId);
        
        console.log(`✅ BDD mise à jour pour l'user ${userId}`);
        res.json({ success: true, message: "Identifiants Garmin enregistrés" });
    } catch (err) {
        console.error("🔥 Erreur SQL:", err.message);
        res.status(500).json({ error: "Erreur lors de la mise à jour BDD" });
    }
});

module.exports = router;