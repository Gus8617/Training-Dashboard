// src/services/insightsAgent.js
const Groq = require('groq-sdk');
const db = require('../database');

let groq = null;

async function generateDailyInsight() {
    try {
        if (!groq) {
            if (!process.env.GROQ_API_KEY) throw new Error("GROQ_API_KEY manquante");
            groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
        }

        const metrics = db.prepare(`
            SELECT 
                f.date, f.readiness_score, f.hrv, f.hrv_baseline, f.resting_hr, f.resting_hr_baseline, f.atl, f.ctl, f.tsb, 
                h.duration as sleep_duration_seconds
            FROM daily_fitness f
            LEFT JOIN health h ON f.user_id = h.user_id AND f.date = h.date
            ORDER BY f.date DESC LIMIT 1
        `).get();

        if (!metrics) return null;

        let sleepString = "Non disponible";
        if (metrics.sleep_duration_seconds) {
            const hours = Math.floor(metrics.sleep_duration_seconds / 3600);
            const minutes = Math.round((metrics.sleep_duration_seconds % 3600) / 60);
            sleepString = `${hours}h${minutes > 0 ? minutes : ''}`;
        }

        const systemPrompt = `Tu es l'assistant de performance d'un triathlète de haut niveau. Analyse ses métriques.
Tu dois obligatoirement répondre sous la forme d'un objet JSON strict avec la structure suivante :
{
  "status": "Alerte fatigue" ou "Feu vert" ou "Récupération",
  "statusColor": "amber" ou "emerald" ou "rose",
  "intro": "Une phrase d'accroche percutante qui résume l'état de forme général.",
  "whyBullets": [
    "Première puce : Analyse croisée du HRV et RHR par rapport aux baselines (ex: Système nerveux impacté par...)",
    "Deuxième puce : Impact de la nuit de sommeil sur la récupération nerveuse et musculaire.",
    "Troisième puce : Lecture de l'équilibre de charge (ATL/CTL/TSB) pour expliquer la dynamique de fatigue."
  ],
  "whatToDo": "Directive d'entraînement claire et stratégique (ex: décaler le bloc de PMA, endurance fondamentale LIT uniquement, ou maintien du plan)."
}

RÈGLES IMPORTANTES :
- L'analyse dans 'whyBullets' doit être technique, croisée et expliquée (causes/effets), mais découpée en 3 ou 4 puces courtes et ultra-lisibles.
- Reste parfaitement aligné avec les données transmises.`;

        const userPrompt = `Données : Readiness ${metrics.readiness_score}/100, Sommeil ${sleepString}, RHR ${metrics.resting_hr} (base: ${metrics.resting_hr_baseline}), HRV ${metrics.hrv} (base: ${metrics.hrv_baseline}), ATL ${Math.round(metrics.atl)}, CTL ${Math.round(metrics.ctl)}, TSB ${Math.round(metrics.tsb)}.`;

        const response = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            response_format: { type: "json_object" },
            temperature: 0.3
        });

        return JSON.parse(response.choices[0].message.content);
    } catch (error) {
        console.error("🔥 Erreur lors de la génération de l'insight :", error);
        throw error;
    }
}

module.exports = { generateDailyInsight };