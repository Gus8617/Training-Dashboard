const router = require('express').Router();
const db = require('../database'); // Instance better-sqlite3

// ==========================================
// 1. IMPORTATION / MISE À JOUR DU PLANNING
// ==========================================
router.post('/import', (req, res) => {
  const { userId, programData } = req.body;

  // Extraction propre du tableau de sessions
  let targetSessions = Array.isArray(programData) ? programData : (programData?.sessions || null);

  if (!userId || !targetSessions || !Array.isArray(targetSessions) || targetSessions.length === 0) {
    return res.status(400).json({ success: false, error: "Données manquantes ou format de sessions incorrect." });
  }

  try {
    const numericUserId = parseInt(userId, 10);
    const dates = targetSessions.map(s => s.date).filter(Boolean).sort();
    const minDate = dates[0];
    const maxDate = dates[dates.length - 1];

    if (!minDate || !maxDate) {
      return res.status(400).json({ success: false, error: "Certaines séances n'ont pas de date valide." });
    }

    const deleteOldStmt = db.prepare(`
      DELETE FROM training_plan WHERE user_id = ? AND date BETWEEN ? AND ? AND status = 'planned'
    `);

    const insertStmt = db.prepare(`
      INSERT INTO training_plan (
        user_id, date, start_time, title, description, type, 
        target_duration, target_load, target_intensity_zone, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'planned')
    `);

    const runTransaction = db.transaction((sessionsList) => {
      deleteOldStmt.run(numericUserId, minDate, maxDate);

      for (const session of sessionsList) {
        // Normalisation stricte de la casse (ex: Ride, Run, Swim)
        let sessionType = session.type || 'Ride';
        if (sessionType.toLowerCase() === 'bike') sessionType = 'Ride';
        sessionType = sessionType.charAt(0).toUpperCase() + sessionType.slice(1).toLowerCase();

        let durationSeconds = null;
        if (session.target_duration_seconds !== undefined && session.target_duration_seconds !== null) {
          durationSeconds = Number(session.target_duration_seconds);
        } else if (session.duration_minutes) {
          durationSeconds = Number(session.duration_minutes) * 60;
        }

        let loadTss = null;
        if (session.target_load_tss !== undefined && session.target_load_tss !== null) {
          loadTss = Number(session.target_load_tss);
        } else if (session.target_load) {
          loadTss = Number(session.target_load);
        }

        insertStmt.run(
          numericUserId,
          session.date,
          session.start_time || null,
          session.title || `${sessionType} Théorique`,
          session.description || null,
          sessionType,
          durationSeconds,
          loadTss,
          session.target_intensity_zone || null
        );
      }
    });

    runTransaction(targetSessions);

    res.json({ 
      success: true, 
      message: `Planning théorique mis à jour du ${minDate} au ${maxDate} (${targetSessions.length} séances insérées).` 
    });

  } catch (error) {
    console.error("❌ Erreur lors de l'importation :", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 2. PUT : MODIFIER UNE SEULE UNIQUE SÉANCE
// ==========================================
router.put('/session/:id', (req, res) => {
  const { id } = req.params;
  const { title, type, duration_minutes, target_load, target_intensity_zone, description } = req.body;

  try {
    let sessionType = type || 'Ride';
    if (sessionType.toLowerCase() === 'bike') sessionType = 'Ride';
    sessionType = sessionType.charAt(0).toUpperCase() + sessionType.slice(1).toLowerCase();
    
    const targetDurationSeconds = duration_minutes ? Number(duration_minutes) * 60 : null;

    const stmt = db.prepare(`
      UPDATE training_plan 
      SET 
        title = ?, 
        type = ?, 
        target_duration = ?, 
        target_load = ?, 
        target_intensity_zone = ?, 
        description = ?
      WHERE id = ?
    `);

    const result = stmt.run(
      title || null,
      sessionType,
      targetDurationSeconds,
      target_load !== undefined ? Number(target_load) : null,
      target_intensity_zone || null,
      description || null,
      id
    );

    if (result.changes > 0) {
      return res.json({ success: true, message: "Séance mise à jour avec succès." });
    } else {
      return res.status(404).json({ success: false, error: "Séance introuvable." });
    }
  } catch (error) {
    console.error("❌ Erreur lors de la modification de la séance :", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 3. DELETE : SUPPRIMER UNE SEULE SÉANCE UNIQUE
// ==========================================
router.delete('/session/:id', (req, res) => {
  const sessionId = req.params.id;
  
  try {
    const stmt = db.prepare("DELETE FROM training_plan WHERE id = ?");
    const result = stmt.run(sessionId);
    
    if (result.changes > 0) {
      return res.json({ success: true, message: "Séance supprimée avec succès." });
    } else {
      return res.status(404).json({ success: false, error: "Séance introuvable." });
    }
  } catch (error) {
    console.error("❌ Erreur lors de la suppression de la séance :", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 4. POST : PURGER L'INTÉGRALITÉ DU PLAN FUTUR
// ==========================================
router.post('/clear', (req, res) => {
  const { userId, startDate, endDate } = req.body;
  
  if (!userId) {
    return res.status(400).json({ success: false, error: "userId manquant." });
  }

  try {
    const numericUserId = parseInt(userId, 10);
    let result;
    
    if (startDate && endDate) {
      const stmt = db.prepare(`
        DELETE FROM training_plan 
        WHERE user_id = ? 
          AND date BETWEEN ? AND ? 
          AND status = 'planned'
      `);
      result = stmt.run(numericUserId, startDate, endDate);
    } else {
      const stmt = db.prepare("DELETE FROM training_plan WHERE user_id = ? AND status = 'planned'");
      result = stmt.run(numericUserId);
    }
    
    return res.json({ success: true, message: `${result.changes} séances supprimées du plan théorique.` });
  } catch (error) {
    console.error("❌ Erreur lors de la purge globale :", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 5. POST : AJOUT MANUEL D'UNE SÉANCE UNIQUE
// ==========================================
router.post('/session', (req, res) => {
  const { userId, date, type, title, duration_minutes, target_load, target_intensity_zone, description } = req.body;

  if (!userId || !date) {
    return res.status(400).json({ success: false, error: "userId et date sont requis." });
  }

  try {
    const numericUserId = parseInt(userId, 10);
    let sessionType = type || 'Ride';
    if (sessionType.toLowerCase() === 'bike') sessionType = 'Ride';
    sessionType = sessionType.charAt(0).toUpperCase() + sessionType.slice(1).toLowerCase();

    const targetDurationSeconds = duration_minutes ? Number(duration_minutes) * 60 : null;

    const stmt = db.prepare(`
      INSERT INTO training_plan (
        user_id, date, type, title, description, 
        target_duration, target_load, target_intensity_zone, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'planned')
    `);

    const result = stmt.run(
      numericUserId,
      date,
      sessionType,
      title || `${sessionType} Théorique`,
      description || null,
      targetDurationSeconds,
      target_load !== undefined ? Number(target_load) : null,
      target_intensity_zone || null
    );

    return res.json({ 
      success: true, 
      message: "Séance ajoutée avec succès.",
      sessionId: result.lastInsertRowid 
    });
  } catch (error) {
    console.error("❌ Erreur lors de l'ajout manuel de la séance :", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;