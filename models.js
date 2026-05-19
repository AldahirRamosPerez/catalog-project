const { getDb } = require('./db');

async function initTables() {
  const db = await getDb();
  await db.exec(`
    CREATE TABLE IF NOT EXISTS titles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      original_title TEXT,
      media_type TEXT,
      year INTEGER,
      categoria TEXT,
      rating REAL,
      rating_imdb REAL,
      rating_anime REAL,
      votes_imdb TEXT,
      genres TEXT,
      overview TEXT,
      poster_url TEXT,
      director TEXT,
      cast TEXT,
      budget INTEGER,
      revenue INTEGER,
      runtime INTEGER,
      production_companies TEXT,
      production_countries TEXT,
      tagline TEXT,
      adult TEXT,
      episodes INTEGER,
      studio TEXT,
      number_of_seasons INTEGER,
      number_of_episodes INTEGER,
      popularidad REAL,
      idioma TEXT,
      fuente TEXT,
      ruta TEXT,
      status TEXT,
      vote_count INTEGER,
      external_id TEXT UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('Tabla "titles" lista');
}

module.exports = { initTables };