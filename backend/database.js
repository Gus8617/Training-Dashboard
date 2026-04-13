const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'data/training.db'));

// Configuration de la performance SQLite
db.pragma('journal_mode = WAL');

// 1. Table des utilisateurs (Credentials Strava chiffrés)
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    firstname TEXT UNIQUE,
    password TEXT, -- On stockera le hash ici
    client_id TEXT,
    client_secret TEXT,
    refresh_token TEXT,
    access_token TEXT,
    garmin_email TEXT,
    garmin_password TEXT,
    expires_at INTEGER
  );
`);

// 2. Table des activités (Source: Strava)
db.exec(`
    CREATE TABLE IF NOT EXISTS activities (
    id TEXT PRIMARY KEY,
    user_id INTEGER, 
    name TEXT,
    type TEXT,
    date TEXT,
    distance REAL,
    moving_time INTEGER,
    average_hr INTEGER,
    suffer_score REAL DEFAULT 0,
    custom_score FLOAT DEFAULT 0,
    hr_zones TEXT,
    total_elevation_gain REAL DEFAULT 0,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

// 3. Table de la santé (Source: Garmin)
db.exec(`
  CREATE TABLE IF NOT EXISTS health (
    user_id INTEGER,
    date TEXT PRIMARY KEY,
    duration INTEGER,
    quality INTEGER,
    deepSleep INTEGER,
    lightSleep INTEGER,
    remSleep INTEGER,
    awake INTEGER,
    hrv REAL,
    restingHR INTEGER,
    body_battery INTEGER
  );
`);

// 4. Table des scores de Fitness

db.exec(`
  CREATE TABLE IF NOT EXISTS daily_fitness (
    user_id INTEGER,
    date TEXT,
    total_suffer_score REAL DEFAULT 0,
    ctl REAL DEFAULT 0, -- Fitness (42j)
    atl REAL DEFAULT 0, -- Fatigue (7j)
    tsb REAL DEFAULT 0, -- Forme (CTL - ATL)
    quality INTEGER DEFAULT 0, -- Qualité de sommeil
    hrv,
    hrv_baseline REAL DEFAULT 0, -- Moyenne glissante HRV
    readiness_score INTEGER, -- Score global (0-100)
    resting_hr,
    resting_hr_baseline,
    PRIMARY KEY (user_id, date)
  );
`);

// 5. Table des séances planifiées
db.exec(`
  CREATE TABLE IF NOT EXISTS training_plan (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,          -- Liaison avec ta table users
    date TEXT NOT NULL,                -- YYYY-MM-DD
    title TEXT,
    description TEXT,
    type TEXT,                         -- 'run', 'ride', 'swim', 'yoga'
    planned_tss INTEGER,               -- Charge théorique
    status TEXT DEFAULT 'planned',     -- 'planned', 'completed', 'skipped'
    strava_id TEXT,                    -- Sera rempli quand Strava détectera la séance
    FOREIGN KEY (user_id) REFERENCES users(id)
    );`
);

// 6. Table des contraintes (ton emploi du temps)
db.exec(`
  CREATE TABLE IF NOT EXISTS user_constraints (
    user_id INTEGER NOT NULL,
    day_of_week INTEGER,               -- 0-6
    start_time TEXT,                   -- ex: "12:00"
    end_time TEXT,                     -- ex: "13:30"
    is_blocked BOOLEAN DEFAULT 0,
    PRIMARY KEY (user_id, day_of_week, start_time),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );`
);

module.exports = db;