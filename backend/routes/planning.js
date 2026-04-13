const express = require('express');
const router = express.Router();
const db = require('../database');

// Récupérer le planning d'un utilisateur
router.get('/:userId', (req, res) => {
    try {
        const { userId } = req.params;
        const plan = db.prepare(`
            SELECT * FROM training_plan 
            WHERE user_id = ? 
            AND date >= date('now', '-7 days')
            ORDER BY date ASC
        `).all(userId);
        res.json(plan);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Ajouter une séance planifiée
router.post('/add', (req, res) => {
    const { userId, date, title, description, type, planned_tss } = req.body;
    try {
        const info = db.prepare(`
            INSERT INTO training_plan (user_id, date, title, description, type, planned_tss)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(userId, date, title, description, type, planned_tss);
        
        res.json({ success: true, id: info.lastInsertRowid });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Supprimer une séance
router.delete('/:id', (req, res) => {
    try {
        db.prepare("DELETE FROM training_plan WHERE id = ?").run(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;