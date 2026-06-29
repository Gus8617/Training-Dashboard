const express = require('express');
const router = express.Router();
// ✅ On importe la fonction de génération structurée
const { askCoach, generateStructuredProgram } = require('../services/coachAgent');

// 1. Ton endpoint existant pour le chat textuel classique
router.post('/chat', async (req, res) => {
    try {
        const { message } = req.body;
        const aiResponse = await askCoach(message); 
        res.json({ success: true, data: aiResponse });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 2. Le NOUVEL endpoint requis par ton composant AICoachAssistant
router.post('/coach-engine', async (req, res) => {
    try {
        // On récupère le payload complet envoyé par le front-end
        const criteria = req.body;
        
        // ✅ On appelle la fonction dédiée aux blocs structurés en lui passant l'objet
        const aiResponse = await generateStructuredProgram(criteria); 
        
        // On renvoie la réponse formatée pour ton front (qui attend { success: true, text: {...} })
        res.json({ 
            success: true, 
            text: aiResponse 
        });

    } catch (error) {
        console.error("🔥 Erreur sur l'endpoint /coach-engine :", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;