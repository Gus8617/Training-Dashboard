const express = require('express');
const router = express.Router();
const db = require('../database');
const { syncAll } = require('../services/strava.service');
const { syncGarminHealth } = require('../services/garmin.service');
const { computeFitness } = require('../services/fitness.service');

// =========================================================================
// 📑 CORE MONITORING & SYNCHRONISATION (REMIS EXACTEMENT COMME AVANT)
// =========================================================================

router.get('/status', (req, res) => {
    const counts = {
        activities: db.prepare("SELECT COUNT(*) as count FROM activities").get().count,
        health: db.prepare("SELECT COUNT(*) as count FROM health").get().count,
        fitness: db.prepare("SELECT COUNT(*) as count FROM daily_fitness").get().count
    };
    res.json({ status: "OK", counts });
});

router.get('/activities', (req, res) => {
    const activities = db.prepare("SELECT * FROM activities ORDER BY date DESC").all();
    res.json(activities.map(a => ({ ...a, hr_zones: a.hr_zones ? JSON.parse(a.hr_zones) : [] })));
});

router.get('/fitness', (req, res) => {
    res.json(db.prepare("SELECT * FROM daily_fitness ORDER BY date ASC").all());
});

router.get('/health', (req, res) => {
    res.json(db.prepare("SELECT * FROM health ORDER BY date ASC").all());
});

// Reprise stricte de ton ancienne méthode
router.post('/sync/all', async (req, res) => {
    const { userId } = req.body || {}; 

    if (!userId) {
        return res.status(400).json({ error: "UserId manquant" });
    }

  try {
      console.log(`🚀 Lancement de la synchro complète pour l'user ${userId}`);

      // 1. On synchronise les activités Strava
      const stravaResult = await syncAll(userId);
      
      // 2. On synchronise la santé Garmin
      const garminResult = await syncGarminHealth(userId);

      // 3. Calcul des metriques fitness (Remplissage daily_fitness)
      const calcResult = await computeFitness(userId);

      res.json({ 
          success: true, 
          strava: stravaResult.count,
          garmin: garminResult ? garminResult.count : 0,
          fitness: calcResult,
          message: "Synchronisation globale terminée avec succès." 
      });
  } catch (err) {
      console.error("🔥 Erreur synchro globale:", err);
      res.status(500).json({ 
          success: false, 
          error: "Erreur lors de la synchronisation globale" 
      });
  }
});

router.get('/stats/annual', (req, res) => {
    try {
      const stats = db.prepare(`
        SELECT 
          type, 
          COUNT(*) as count, 
          SUM(CAST(distance AS FLOAT)) as total_distance, 
          SUM(CAST(moving_time AS INT)) as total_duration
        FROM activities 
        WHERE date LIKE '2026-%'
        GROUP BY type
      `).all();
  
      res.json(stats.map(s => ({
        type: s.type,
        count: s.count || 0,
        total_distance: s.total_distance || 0,
        total_duration: s.total_duration || 0
      })));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
});

// =========================================================================
// 🔓 GESTION DES CONTRAINTES & DISPONIBILITÉS (`user_constraints`)
// =========================================================================

router.get('/constraints/:userId', (req, res) => {
    try {
        const { userId } = req.params;
        const { weekType } = req.query;

        let constraints;
        if (weekType) {
            constraints = db.prepare(`
                SELECT *, rowid as slot_id FROM user_constraints 
                WHERE user_id = ? 
                AND (specific_date IS NOT NULL OR week_alternation = 'all' OR week_alternation = ?)
                ORDER BY specific_date ASC, day_of_week ASC, start_time ASC
            `).all(userId, weekType);
        } else {
            constraints = db.prepare(`
                SELECT *, rowid as slot_id FROM user_constraints 
                WHERE user_id = ?
                ORDER BY day_of_week ASC, start_time ASC
            `).all(userId);
        }

        res.json({ success: true, constraints });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/constraints/save-batch', (req, res) => {
    try {
        const { user_id, days, start_time, end_time, specific_date, is_blocked, week_alternation } = req.body;

        const deleteExistingStmt = db.prepare(`
            DELETE FROM user_constraints 
            WHERE user_id = ? AND day_of_week = ? AND (specific_date = ? OR (specific_date IS NULL AND ? IS NULL)) AND start_time = ? AND week_alternation = ?
        `);
        
        const insertStmt = db.prepare(`
            INSERT INTO user_constraints (user_id, day_of_week, specific_date, start_time, end_time, is_blocked, week_alternation)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        const runBatch = db.transaction((userId, targetDays, targetDate, start, end, blocked, alternation) => {
            if (targetDate) {
                const d = new Date(targetDate);
                const dayOfWeek = d.getDay(); 
                deleteExistingStmt.run(userId, dayOfWeek, targetDate, targetDate, start, 'all');
                insertStmt.run(userId, dayOfWeek, targetDate, start, end, blocked, 'all');
            } else {
                for (const day of targetDays) {
                    deleteExistingStmt.run(userId, day, null, null, start, alternation);
                    insertStmt.run(userId, day, null, start, end, blocked, alternation);
                }
            }
        });

        runBatch(user_id, days, specific_date || null, start_time, end_time, is_blocked || 0, week_alternation || 'all');
        res.json({ success: true, message: "Règles d'arbitrage enregistrées avec succès." });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.delete('/constraints/delete', (req, res) => {
    try {
        const { user_id, day_of_week, specific_date, start_time, week_alternation } = req.body;

        const stmt = db.prepare(`
            DELETE FROM user_constraints 
            WHERE user_id = ? 
            AND day_of_week = ? 
            AND (specific_date = ? OR (specific_date IS NULL AND ? IS NULL)) 
            AND start_time = ?
            AND week_alternation = ?
        `);
        
        const info = stmt.run(user_id, day_of_week, specific_date || null, specific_date || null, start_time, week_alternation || 'all');

        if (info.changes > 0) {
            res.json({ success: true, message: "Créneau supprimé." });
        } else {
            res.status(404).json({ success: false, error: "Créneau introuvable." });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// =========================================================================
// 🏊 GESTION DES ENTRAÎNEMENTS FIXES RITUELS (`recurring_sessions`)
// =========================================================================

router.get('/recurring-sessions/:userId', (req, res) => {
    try {
        const { userId } = req.params;
        const sessions = db.prepare(`
            SELECT *, id as session_id FROM recurring_sessions 
            WHERE user_id = ? 
            ORDER BY day_of_week ASC, start_time ASC
        `).all(userId);
        
        res.json({ success: true, sessions });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/recurring-sessions/save', (req, res) => {
    try {
        const { 
            user_id, day_of_week, week_alternation, title, 
            type, target_intensity_zone, duration_minutes, target_load, start_time, description 
        } = req.body;

        const stmt = db.prepare(`
            INSERT INTO recurring_sessions 
            (user_id, day_of_week, week_alternation, title, type, target_intensity_zone, duration_minutes, target_load, start_time, description)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(user_id, day_of_week, week_alternation || 'all', title, type, target_intensity_zone, duration_minutes || 0, target_load || 0, start_time, description || null);
        res.json({ success: true, message: "Session rituelle enregistrée." });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.delete('/recurring-sessions/delete/:id', (req, res) => {
    try {
        const { id } = req.params;
        const info = db.prepare(`DELETE FROM recurring_sessions WHERE id = ?`).run(id);

        if (info.changes > 0) {
            res.json({ success: true, message: "Session rituelle supprimée." });
        } else {
            res.status(404).json({ success: false, error: "Session rituelle introuvable." });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;