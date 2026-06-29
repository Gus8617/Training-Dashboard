// src/services/coachAgent.js
const Groq = require('groq-sdk');
const db = require('../database');

let groq = null;

const COACH_TOOLS = [
    {
        type: "function",
        function: {
            name: "get_athlete_metrics",
            description: "Récupère les dernières métriques de fatigue, TSB, et statut HRV de l'athlète.",
            parameters: { type: "object", properties: {} }
        }
    },
    {
        type: "function",
        function: {
            name: "get_current_planning",
            description: "Récupère les séances d'entraînement planifiées entre deux dates au format YYYY-MM-DD.",
            parameters: {
                type: "object",
                properties: {
                    startDate: { type: "string", description: "Date de début (YYYY-MM-DD)" },
                    endDate: { type: "string", description: "Date de fin (YYYY-MM-DD)" }
                },
                required: ["startDate", "endDate"]
            }
        }
    }
];

async function askCoach(userMessage) {
    try {
        if (!groq) {
            if (!process.env.GROQ_API_KEY) throw new Error("GROQ_API_KEY manquante");
            groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
        }

        let messages = [
            {
                role: "system",
                content: `Tu es un entraîneur expert en triathlon (Natation, Cyclisme, Course à pied, Renforcement). Ton but est de concevoir des blocs d'entraînement sur-mesure via une discussion interactive avec l'athlète.

                CONSIGNES DE DISCUSSION :
                - Adapte le volume et le type de séance selon les requêtes de l'athlète ou l'analyse de son TSB/HRV.
                - Reste technique (zones d'intensité LIT/MIT/HIT, TSS, PMA, Seuil).
                
                RÈGLE DE FORMATAGE ABSOLUE : Tu dois obligatoirement répondre sous la forme d'un objet JSON pur respectant cette structure exacte :
                {
                  "message_coach": "Ton retour textuel (explications des choix, conseils de gestion de fatigue, questions à l'athlète).",
                  "is_final_program": false, 
                  "program_name": "Nom du cycle ou du bloc (ex: Bloc Foncier - Cycle Alterné)",
                  "version": "1.1",
                  "sessions": [
                    {
                      "date": "YYYY-MM-DD",
                      "day_name": "Lundi|Mardi|Mercredi|Jeudi|Vendredi|Samedi|Dimanche",
                      "week_number": 1,
                      "week_focus": "Focus global de la semaine (ex: Développement PMA)",
                      "title": "Titre clair de la séance",
                      "type": "Bike|Swim|Run|Strength",
                      "start_time": "08:00",
                      "target_duration_seconds": 3600,
                      "target_load_tss": 65,
                      "target_intensity_zone": "LIT|MIT|HIT",
                      "indoor": false,
                      "equipment": "Ex: Vélo de route, Plaquettes & Pull-buoy, ou Aucun",
                      "description": "Détail complet du corps de séance (Échauffement, Blocs d'intensité, Récupération)."
                    }
                  ]
                }`
            },
            {
                role: "user",
                content: userMessage
            }
        ];

        let response = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: messages,
            tools: COACH_TOOLS,
            tool_choice: "auto"
        });

        const responseMessage = response.choices[0].message;

        if (responseMessage.tool_calls) {
            messages.push(responseMessage);

            for (const toolCall of responseMessage.tool_calls) {
                const functionName = toolCall.function.name;
                const functionArgs = JSON.parse(toolCall.function.arguments);
                let functionResult = "";

                console.log(`🤖 L'IA appelle l'outil : ${functionName}`, functionArgs);

                if (functionName === "get_athlete_metrics") {
                    const metrics = db.prepare("SELECT tsb, hrv_baseline, hrv FROM daily_fitness ORDER BY date DESC LIMIT 1").get();
                    functionResult = JSON.stringify(metrics || { tsb: 0, hrv: "unknown", hrv_baseline: "unknown" });
                } 
                else if (functionName === "get_current_planning") {
                    const sessions = db.prepare("SELECT * FROM training_plan WHERE date BETWEEN ? AND ?").all(functionArgs.startDate, functionArgs.endDate);
                    functionResult = JSON.stringify(sessions);
                }

                messages.push({
                    tool_call_id: toolCall.id,
                    role: "tool",
                    name: functionName,
                    content: functionResult
                });
            }

            const finalResponse = await groq.chat.completions.create({
                model: "llama-3.3-70b-versatile",
                messages: messages,
                response_format: { type: "json_object" }
            });

            return JSON.parse(finalResponse.choices[0].message.content);
        }

        messages.push(responseMessage);
        const forceJsonResponse = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: messages,
            response_format: { type: "json_object" }
        });

        return JSON.parse(forceJsonResponse.choices[0].message.content);

    } catch (error) {
        console.error("🔥 Erreur Agent Groq Tools:", error);
        throw error;
    }
}

// Génération structurée mappée sur les nouveaux inputs du formulaire
async function generateStructuredProgram(criteria) {
    try {
        if (!groq) {
            if (!process.env.GROQ_API_KEY) throw new Error("GROQ_API_KEY manquante");
            groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
        }

        // =========================================================================
        // 1. DÉTECTION DU PROGRAMME EN COURS / HISTORIQUE RENTRÉ EN BDD
        // =========================================================================
        // On ne regarde désormais que les séances passées ou d'aujourd'hui
        const lastSession = db.prepare(`
            SELECT date 
            FROM training_plan 
            WHERE date <= date('now')
            ORDER BY date DESC LIMIT 1
        `).get();

        // Formatage YYYY-MM-DD propre et sans surprise
        const formatISO = (d) => {
            const pad = (n) => String(n).padStart(2, '0');
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        };

        const daysFr = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

        // Par défaut, si pas de BDD, on commence DEMAIN
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);

        let startCalendarDate = formatISO(tomorrow); 
        let startDayName = daysFr[tomorrow.getDay()];
        let nextWeekNumberStart = 1;
        let pastContextString = "L'athlète démarre un tout nouveau cycle d'entraînement.";

        if (lastSession) {
            const parts = lastSession.date.split('-');
            const lastDate = new Date(parts[0], parts[1] - 1, parts[2]);
            
            // Vérification de la fraîcheur (si moins de 14 jours)
            const now = new Date();
            const diffTime = Math.abs(now - lastDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays <= 14) {
                lastDate.setDate(lastDate.getDate() + 1); // Le lendemain de la dernière séance
                startCalendarDate = formatISO(lastDate);
                startDayName = daysFr[lastDate.getDay()];
                nextWeekNumberStart = 2; 
            }
            
            const lastSevenDays = db.prepare(`
                SELECT type, title 
                FROM training_plan 
                ORDER BY date DESC LIMIT 7
            `).all();

            pastContextString = `L'athlète enchaîne après sa dernière séance enregistrée du ${lastSession.date}. 
            Voici ses dernières séances : ${JSON.stringify(lastSevenDays)}`;
        }

        // 2. CADRAGE DE LA DURÉE
        const totalWeeksToGenerate = Math.min(Number(criteria.durationWeeks) || 3, 4); 
        const totalDaysExpected = totalWeeksToGenerate * 7;
        const maxWeekNumberEnd = nextWeekNumberStart + totalWeeksToGenerate - 1;

        const modeLabel = criteria.mode === 'catch_up' ? "AJUSTEMENT FATIGUE" : "PROGRESSION FONCIÈRE THÉORIQUE";
        const sportsFocus = criteria.sportsSelected ? criteria.sportsSelected.join(', ') : 'Bike, Run, Swim';
        
        let targetEventString = "Aucun objectif majeur à court terme.";
        if (criteria.targetEvent && criteria.targetEvent.name) {
            targetEventString = `OBJECTIF FINAL : ${criteria.targetEvent.name} le ${criteria.targetEvent.date}.`;
        }

        // 3. CONSTRUCTION DU PROMPT AVEC CONTEXTE DE CONTINUITÉ
        let messages = [
            {
                role: "system",
                content: `Tu es le moteur algorithmique d'un coach de triathlon. Ton but est de générer la SUITE du plan d'entraînement sous format JSON strict.
                
                CONTEXTE DE CONTINUITÉ (TRÈS IMPORTANT) :
                ${pastContextString}
                
                DONNÉES DE L'ATHLÈTE :
                - CTL : ${criteria.metrics?.ctl || 65} | TSB : ${criteria.metrics?.tsb || -5}
                - Target TSS Hebdomadaire cible : ${criteria.metrics?.weeklyTssTarget || 450}
                
                CRITÈRES DE GÉNÉRATION IMPOSÉS :
                - Mode : ${modeLabel}
                - Durée à générer : EXACTEMENT ${totalWeeksToGenerate} semaine(s) complète(s) de 7 jours (soit ${totalDaysExpected} jours civils continus).
                - Date de début absolue (index 0) : "${startCalendarDate}".
                - RÈGLE DE CHRONOLOGIE : Tu dois obligatoirement générer la suite des dates jour après jour, de manière continue et consécutive, sans sauter aucun jour. S'il n'y a pas d'entraînement un jour donné, crée une session avec "type": "Rest", "title": "Repos" et "target_load_tss": 0.
                - Les numéros de semaine ('week_number') pour ce bloc doivent aller de ${nextWeekNumberStart} à ${maxWeekNumberEnd}.
                - Disciplines exclusives : ${sportsFocus}.
                - Contraintes athlète : ${criteria.customNotes || 'Aucune.'}
                ${targetEventString}

                CONSIGNE DE DESCRIPTION DES SÉANCES :
                Le champ "description" doit être rédigé de façon technique et complète. Décompose obligatoirement en : ÉCHAUFFEMENT, CORPS DE SÉANCE (séries, répétitions, zones LIT/MIT/HIT), et RÉCUPÉRATION.

                RÈGLE DE FORMATAGE : Réponds uniquement en JSON pur.
                {
                  "message_coach": "Analyse de la transition avec le bloc précédent et progression appliquée.",
                  "is_final_program": true,
                  "program_name": "Continuité Plan - Semaines ${nextWeekNumberStart} à ${maxWeekNumberEnd}",
                  "sessions": [
                    {
                      "date": "${startCalendarDate}",
                      "day_name": "Lundi", 
                      "week_number": ${nextWeekNumberStart},
                      "week_focus": "Focus de la semaine",
                      "title": "Nom de la séance",
                      "type": "Bike|Swim|Run|Strength",
                      "start_time": "08:00",
                      "target_duration_seconds": 3600,
                      "target_load_tss": 70,
                      "target_intensity_zone": "LIT",
                      "indoor": false,
                      "equipment": "Aucun",
                      "description": "ÉCHAUFFEMENT : ... \\nCORPS DE SÉANCE : ... \\nRÉCUPÉRATION : ..."
                    }
                  ]
                }`
            },
            {
                role: "user",
                content: `Génère la suite du plan : exactement ${totalDaysExpected} sessions ordonnées du ${startCalendarDate} au numéro de semaine ${maxWeekNumberEnd}.`
            }
        ];

        // 4. APPEL À L'API GROQ
        const response = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: messages,
            response_format: { type: "json_object" }
        });

        return JSON.parse(response.choices[0].message.content);

    } catch (error) {
        console.error("🔥 Erreur génération programme chaîné:", error);
        throw error;
    }
}

module.exports = { askCoach, generateStructuredProgram };