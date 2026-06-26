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
    password TEXT,
    strava_athlete_id TEXT, -- ID unique de l'athlète retourné par Strava
    access_token TEXT,
    refresh_token TEXT,
    expires_at INTEGER,
    garmin_email TEXT,
    garmin_password TEXT
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

// 📅 5. Table des séances planifiées (Schéma fusionné et indexé)
db.exec(`
  CREATE TABLE IF NOT EXISTS training_plan (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,                     -- YYYY-MM-DD
    start_time TEXT,                        -- ex: "12:00"
    title TEXT,                             -- ex: "PMA Développement"
    description TEXT,                       -- Détails des blocs
    type TEXT,                              -- 'Run', 'Ride', 'Swim', 'Strength'
    
    -- Objectifs théoriques (Target) -> TOUT EN SECONDES OU UNITÉS PURES
    target_duration INTEGER,                -- Durée prévue en SECONDES (ex: 3600 pour 1h)
    target_distance REAL,                   -- Distance prévue en km
    target_load INTEGER,                    -- Charge théorique (TSS attendu)
    target_intensity_zone TEXT,             -- 'LIT', 'MIT', 'HIT'
    
    -- Suivi & Réalité
    status TEXT DEFAULT 'planned',          -- 'planned', 'completed', 'skipped', 'mutated'
    strava_id TEXT UNIQUE,                  -- Clé de liaison vers l'activité réelle
    recurring_session_id INTEGER,           -- Lie la séance à un rituel fixe (NULL si algo)
    
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (strava_id) REFERENCES activities(id),
    FOREIGN KEY (recurring_session_id) REFERENCES recurring_sessions(id) ON DELETE SET NULL
  );

  -- 🎯 Index composite crucial pour la vélocité des requêtes par plages du calendrier (Semaine / Mois)
  CREATE INDEX IF NOT EXISTS idx_training_plan_user_date 
  ON training_plan (user_id, date);
`);

//db.exec(`DROP TABLE IF EXISTS user_constraints;`);

// 6. TABLE DES CONTRAINTES TEMPORELLES (Dispos & Verrous)
db.exec(`
  CREATE TABLE IF NOT EXISTS user_constraints (
    user_id INTEGER NOT NULL,
    day_of_week INTEGER,                -- 0 (Dimanche) à 6 (Samedi), NULL si specific_date
    specific_date TEXT,                 -- "YYYY-MM-DD", NULL si récurrent
    start_time TEXT NOT NULL,           -- ex: "12:00"
    end_time TEXT NOT NULL,             -- ex: "13:30"
    is_blocked INTEGER DEFAULT 0,       -- CHANGEMENT : 0 = Libre, 1 = Hybride (Indoor only), 2 = Lock strict
    week_alternation TEXT DEFAULT 'all',-- 'all', 'even', 'odd'
    PRIMARY KEY (user_id, day_of_week, specific_date, start_time, week_alternation),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// 7. TABLE DES ENTRAÎNEMENTS FIXES RITUELS (Ex: Natation Club le Mardi)
db.exec(`
  CREATE TABLE IF NOT EXISTS recurring_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    day_of_week INTEGER NOT NULL,       -- 0 à 6
    week_alternation TEXT DEFAULT 'all', -- 'all', 'even', 'odd' (pour la natation une semaine sur deux par exemple)
    title TEXT NOT NULL,                -- ex: "Natation Club - Seuil"
    type TEXT NOT NULL,                 -- "Swim", "Bike", "Run", "Strength"
    target_intensity_zone TEXT,        -- "LIT", "MIT", "HIT"
    duration_seconds INTEGER NOT NULL,  -- ex: 60
    target_load INTEGER DEFAULT 0,      -- Le fameux TSS associé (ex: 45)
    start_time TEXT,                    -- ex: "19:30" (optionnel, pour l'affichage)
    description TEXT,
    is_indoor DEFAULT 0,                 -- 0 = Outdoor, 1 = Indoor (ex: Piscine)
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

module.exports = db;