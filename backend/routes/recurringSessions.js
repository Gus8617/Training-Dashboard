const express = require('express');
const router = express.Router();
const db = require('../database');

// =========================================================================
// 🏊 RECUPERER TOUS LES RITUELS FIXES
// =========================================================================
router.get('/:userId', (req, res) => {
    try {
        const { userId } = req.params;
        const sessions = db.prepare(`
            SELECT * FROM recurring_sessions 
            WHERE user_id = ? 
            ORDER BY day_of_week ASC, start_time ASC
        `).all(userId);
        
        res.json({ success: true, sessions });
    } catch (error) {
        console.error("🔥 Erreur GET /api/recurring-sessions:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// =========================================================================
// 💾 ENREGISTRER OU METTRE À JOUR UN RITUEL
// =========================================================================
router.post('/save', (req, res) => {
    try {
        const { 
            user_id, day_of_week, week_alternation, title, type, 
            target_intensity_zone, target_duration, target_load, start_time, description, is_indoor 
        } = req.body;

        // Support de la clé alternative envoyée parfois par le front (userId ou user_id)
        const finalUserId = user_id || req.body.userId;

        if (!finalUserId || !title || !type) {
            return res.status(400).json({ success: false, error: "Champs requis manquants (userId, title ou type)." });
        }

        // Alignement avec le schéma : target_duration devient duration_seconds
        const insertStmt = db.prepare(`
            INSERT INTO recurring_sessions 
            (user_id, day_of_week, week_alternation, title, type, target_intensity_zone, duration_seconds, target_load, start_time, description, is_indoor)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        insertStmt.run(
            parseInt(finalUserId, 10), 
            day_of_week !== undefined && day_of_week !== null ? parseInt(day_of_week, 10) : 0, 
            week_alternation || 'all', 
            title, 
            type, 
            target_intensity_zone || 'LIT', 
            target_duration !== undefined && target_duration !== null ? parseInt(target_duration, 10) : 0, // En secondes
            target_load !== undefined && target_load !== null ? parseInt(target_load, 10) : 0, 
            start_time || null, 
            description || "",
            is_indoor !== undefined && is_indoor !== null ? parseInt(is_indoor, 10) : 0
        );

        res.json({ success: true, message: "Séance rituelle bloquée avec succès !" });
    } catch (error) {
        console.error("🔥 Erreur POST /api/recurring-sessions/save:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// =========================================================================
// 🗑️ SUPPRIMER UN RITUEL
// =========================================================================
router.delete('/delete/:id', (req, res) => {
    try {
        const { id } = req.params;
        db.prepare("DELETE FROM recurring_sessions WHERE id = ?").run(id);
        res.json({ success: true, message: "Séance rituelle supprimée." });
    } catch (error) {
        console.error("🔥 Erreur DELETE /api/recurring-sessions:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;