const express = require('express');
const router = express.Router();
const db = require('../database');

router.post('/db/delete', (req, res) => {
    const { table, id, idColumn } = req.body;
    
    const anchorMap = {
        'activities': '#activities',
        'health': '#health',
        'daily_fitness': '#fitness',
        'users': '#users',
        'training_plan': '#planning',
        'user_constraints': '#constraints'
    };

    try {
        db.prepare(`DELETE FROM ${table} WHERE ${idColumn} = ?`).run(id);
        const referrer = req.get('Referrer') || '/debug/db';
        const cleanReferrer = referrer.split('#')[0];
        res.redirect(cleanReferrer + (anchorMap[table] || ''));
    } catch (err) {
        res.status(500).send("Erreur: " + err.message);
    }
});

router.get('/db', (req, res) => {
    try {
        const limit = 10;
        const pageAct = parseInt(req.query.pAct) || 1;
        const pageHealth = parseInt(req.query.pHealth) || 1;
        const pageFit = parseInt(req.query.pFit) || 1;
        const pagePlan = parseInt(req.query.pPlan) || 1; // Nouvelle pagination

        const offsetAct = (pageAct - 1) * limit;
        const offsetHealth = (pageHealth - 1) * limit;
        const offsetFit = (pageFit - 1) * limit;
        const offsetPlan = (pagePlan - 1) * limit;

        // Requêtes
        const activities = db.prepare("SELECT * FROM activities ORDER BY date DESC LIMIT ? OFFSET ?").all(limit, offsetAct);
        const health = db.prepare("SELECT * FROM health ORDER BY date DESC LIMIT ? OFFSET ?").all(limit, offsetHealth);
        const fitness = db.prepare("SELECT * FROM daily_fitness ORDER BY date DESC LIMIT ? OFFSET ?").all(limit, offsetFit);
        const planning = db.prepare("SELECT * FROM training_plan ORDER BY date DESC LIMIT ? OFFSET ?").all(limit, offsetPlan);
        const constraints = db.prepare("SELECT * FROM user_constraints").all();
        const users = db.prepare("SELECT * FROM users").all();

        const generateTable = (data, tableName, idColumn = 'id', currentPage, queryParam) => {
            if (!data || !data.length) return `<p style="color: #64748b; font-style: italic;">Aucune donnée dans la table ${tableName}.</p>`;
            const headers = Object.keys(data[0]);
            
            const prevPage = currentPage > 1 ? currentPage - 1 : null;
            const nextPage = data.length === limit ? currentPage + 1 : null;

            return `
                <table>
                    <thead>
                        <tr>
                            ${headers.map(h => `<th>${h}</th>`).join('')}
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.map(row => `
                            <tr>
                                ${headers.map(h => `<td>${row[h] !== null ? row[h] : '<span style="color:#475569">null</span>'}</td>`).join('')}
                                <td>
                                    <form method="POST" action="/debug/db/delete" onsubmit="return confirm('Supprimer cet enregistrement ?');" style="margin:0;">
                                        <input type="hidden" name="table" value="${tableName}">
                                        <input type="hidden" name="id" value="${row[idColumn]}">
                                        <input type="hidden" name="idColumn" value="${idColumn}">
                                        <button type="submit" class="btn-delete">Supprimer</button>
                                    </form>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div class="pagination">
                    ${prevPage ? `<a href="?${updateQuery(req.query, queryParam, prevPage)}">« Précédent</a>` : '<span class="disabled">« Précédent</span>'}
                    <span class="current">Page ${currentPage}</span>
                    ${nextPage ? `<a href="?${updateQuery(req.query, queryParam, nextPage)}">Suivant »</a>` : '<span class="disabled">Suivant »</span>'}
                </div>`;
        };

        function updateQuery(currentQuery, key, value) {
            const params = new URLSearchParams(currentQuery);
            params.set(key, value);
            const anchorMap = {
                'pAct': '#activities', 'pHealth': '#health', 'pFit': '#fitness',
                'pU': '#users', 'pPlan': '#planning', 'pConst': '#constraints'
            };
            return params.toString() + (anchorMap[key] || '');
        }

        let html = `
            <html>
            <head>
                <title>Debug Dashboard Coach</title>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; background: #020617; color: #e2e8f0; line-height: 1.5; }
                    table { border-collapse: collapse; width: 100%; margin-bottom: 10px; background: #0f172a; border-radius: 8px; overflow: hidden; }
                    th, td { border: 1px solid #1e293b; padding: 12px; text-align: left; font-size: 11px; }
                    th { background: #1d4ed8; color: white; text-transform: uppercase; letter-spacing: 0.05em; }
                    tr:hover { background: #1e293b; }
                    h1 { color: #f8fafc; font-size: 24px; margin-bottom: 30px; }
                    h2 { border-left: 4px solid #3b82f6; padding-left: 15px; margin-top: 50px; color: #94a3b8; font-size: 18px; text-transform: uppercase; }
                    .btn-delete { background: #7f1d1d; color: #fecaca; border: 1px solid #991b1b; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 10px; }
                    .btn-delete:hover { background: #b91c1c; color: white; }
                    .pagination { margin-bottom: 40px; display: flex; gap: 8px; align-items: center; }
                    .pagination a { background: #1e293b; color: #94a3b8; text-decoration: none; padding: 6px 12px; border-radius: 6px; font-size: 12px; border: 1px solid #334155; }
                    .pagination a:hover { background: #334155; color: white; }
                    .pagination .current { font-weight: bold; background: #3b82f6; color: white; padding: 6px 12px; border-radius: 6px; font-size: 12px; }
                    .pagination .disabled { color: #475569; font-size: 12px; padding: 6px 12px; }
                    .badge-coach { background: #10b981; color: white; padding: 2px 8px; border-radius: 10px; font-size: 10px; margin-left: 10px; vertical-align: middle; }
                </style>
            </head>
            <body>
                <h1>🔎 Debug Center : Intelligence Artificielle & Base de Données</h1>
                
                <h2 id="users">👤 Utilisateurs</h2>
                ${generateTable(users, 'users', 'id', 1, 'pU')}

                <h2 id="planning">📅 Planning Entraînement <span class="badge-coach">COACH AI</span></h2>
                ${generateTable(planning, 'training_plan', 'id', pagePlan, 'pPlan')}

                <h2 id="constraints">🔐 Contraintes & Créneaux <span class="badge-coach">COACH AI</span></h2>
                ${generateTable(constraints, 'user_constraints', 'user_id', 1, 'pConst')}

                <h2 id="activities">🏃 Activités (Strava)</h2>
                ${generateTable(activities, 'activities', 'id', pageAct, 'pAct')}

                <h2 id="health">😴 Santé (Vitals)</h2>
                ${generateTable(health, 'health', 'date', pageHealth, 'pHealth')}

                <h2 id="fitness">📈 Fitness (Forme)</h2>
                ${generateTable(fitness, 'daily_fitness', 'date', pageFit, 'pFit')}
            </body>
            </html>`;
        res.send(html);
    } catch (err) {
        res.status(500).send("Erreur de base de données : " + err.message);
    }
});

module.exports = router;