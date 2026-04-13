const express = require('express');
const router = express.Router();
const db = require('../database');
const { syncAll } = require('../services/strava.service');
const { syncGarminHealth } = require('../services/garmin.service');
const { computeFitness } = require('../services/fitness.service');

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

router.post('/sync/all', async (req, res) => {
  const { userId } = req.body; 

  if (!userId) {
      return res.status(400).json({ error: "UserId manquant" });
  }

  try {
      console.log(`🚀 Lancement de la synchro complète pour l'user ${userId}`);

      // 1. On synchronise les activités Strava
      const stravaResult = await syncAll(userId);
      
      // 2. On synchronise la santé Garmin
      const garminResult = await syncGarminHealth(userId);

      // 3. Calcul des metriques fitness
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

module.exports = router;