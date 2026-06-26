/**
 * MOTEUR ADAPTATIF D'ENTRAÎNEMENT
 * Ajuste le planning théorique (JSON) en fonction de la réalité physiologique (TSB / HRV)
 */

// Constantes de tolérance pour un triathlète
const TSB_CRITICAL_ZONE = -25; // Seuil de surmenage
const HRV_BASE_LINE = 63;      // Ta moyenne de référence (en ms)

function computeAdaptiveSession(plannedSession, currentFitness, currentHealth) {
    if (!plannedSession) return null;
    
    // Si c'est un jour de repos prévu, on ne le surcharge pas sauf fraîcheur extrême
    if (plannedSession.type === 'Rest' || plannedSession.tss_target === 0) {
        if (currentFitness.tsb > 10 && currentHealth.hrv > (HRV_BASE_LINE + 5)) {
            return {
                ...plannedSession,
                advice: "🧘 Repos prévu, mais tes voyants sont au vert fluo. Si tu as des fourmis dans les jambes : option Zone 2 active (30-45 min)."
            };
        }
        return { ...plannedSession, advice: "🛌 Repos programmé. Relâche la pression." };
    }

    let tssModifier = 1.0;
    let durationModifier = 1.0;
    let adaptiveAdvice = "✅ Séance nominale. Respecte les blocs d'intensité.";

    const tsb = currentFitness.tsb;
    const hrv = currentHealth.hrv || HRV_BASE_LINE;
    const sleepScore = currentHealth.sleep_score || 80;

    // --- SCÉNARIO 1 : SURMENAGE OU SOUS-RÉCUPÉRATION CRITIQUE ---
    if (tsb < TSB_CRITICAL_ZONE || hrv < (HRV_BASE_LINE * 0.85)) {
        return {
            ...plannedSession,
            name: `[ADAPTÉ - RÉCUP] ${plannedSession.name}`,
            tss_target: Math.round(plannedSession.tss_target * 0.4),
            duration_target: Math.round(plannedSession.duration_target * 0.5),
            advice: "🛑 ALERTE MODIFICATION : Fatigue systémique ou nerveuse trop haute. La séance est bridée en endurance fondamentale (Z1/Z2) à volume réduit."
        };
    }

    // --- SCÉNARIO 2 : FATIGUE ACCUMULÉE MAIS PHYSIOLOGIE STABLE (Surcharge saine) ---
    if (tsb >= TSB_CRITICAL_ZONE && tsb <= -10) {
        if (hrv >= HRV_BASE_LINE) {
            adaptiveAdvice = "🔥 Charge active : Le TSB baisse mais ta HRV montre que ton système nerveux encaisse. Maintiens la séance telle quelle.";
        } else {
            // Le corps fatigue nerveusement : on baisse l'intensité, on garde le volume
            tssModifier = 0.8;
            adaptiveAdvice = "🧘 Prudence : Fatigue nerveuse naissante (HRV en baisse). Coupe les intensités hautes (Z4/Z5), reste en Zone 2 linéaire.";
        }
    }

    // --- SCÉNARIO 3 : MAUVAISE NUIT PUREMENT PONCTUELLE ---
    if (sleepScore < 65 && tsb > -10) {
        tssModifier = 0.85;
        durationModifier = 0.9;
        adaptiveAdvice = "💤 Nuit compliquée : Ton potentiel est là mais la vigilance est basse. Séance légèrement rabotée pour limiter le stress métabolique.";
    }

    // --- SCÉNARIO 4 : SUPER-FORME / RETARD DE CHARGE ---
    if (tsb > 5 && hrv > (HRV_BASE_LINE + 3)) {
        tssModifier = 1.15; // On s'autorise à pousser un peu plus
        adaptiveAdvice = "⚡ FEU VERT : Fraîcheur optimale et excellente HRV. Tu peux rallonger tes blocs de d'intensité ou ajouter 15 minutes à ta sortie.";
    }

    return {
        ...plannedSession,
        tss_target: Math.round(plannedSession.tss_target * tssModifier),
        duration_target: Math.round(plannedSession.duration_target * durationModifier),
        advice: adaptiveAdvice
    };
}

module.exports = { computeAdaptiveSession };