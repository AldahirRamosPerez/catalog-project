const XLSX = require('xlsx');
const { readDb, writeDb } = require('./db');

const EXCEL_PATH = 'D:/0 & 1/mi_catalogo/output/excel/CATALOGO_LIMPIO.xlsx'; // Cambia si es necesario

function cleanValue(val) {
  if (val === undefined || val === null || val === '') return null;
  if (typeof val === 'string') return val.trim() || null;
  return val;
}

async function migrate() {
  console.log('📂 Leyendo Excel...');
  const workbook = XLSX.readFile(EXCEL_PATH);
  const titles = [];

  for (const sheet of workbook.SheetNames) {
    console.log(`📄 Hoja: ${sheet}`);
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheet]);
    for (const row of rows) {
      titles.push({
        id: null,
        title: cleanValue(row.titulo_oficial),
        original_title: cleanValue(row.titulo_original),
        media_type: cleanValue(row.tipo),
        year: cleanValue(row.anio),
        categoria: sheet,
        rating: cleanValue(row.rating),
        rating_imdb: cleanValue(row.rating_imdb),
        rating_anime: cleanValue(row.rating_anime),
        votes_imdb: cleanValue(row.votos_imdb),
        genres: cleanValue(row.generos_tmdb),
        overview: cleanValue(row.sinopsis),
        poster_url: cleanValue(row.poster_url),
        director: cleanValue(row.director_creador),
        cast: cleanValue(row.reparto),
        budget: cleanValue(row.budget),
        revenue: cleanValue(row.revenue),
        runtime: cleanValue(row.runtime),
        production_companies: cleanValue(row.production_companies),
        production_countries: cleanValue(row.production_countries),
        tagline: cleanValue(row.tagline),
        adult: cleanValue(row.adult),
        episodes: cleanValue(row.episodios),
        studio: cleanValue(row.estudio),
        number_of_seasons: cleanValue(row.number_of_seasons),
        number_of_episodes: cleanValue(row.number_of_episodes),
        popularidad: cleanValue(row.popularidad),
        idioma: cleanValue(row.idioma),
        fuente: cleanValue(row.fuente),
        ruta: cleanValue(row.ruta),
        status: cleanValue(row.status),
        vote_count: cleanValue(row.vote_count),
        created_at: new Date().toISOString()
      });
    }
  }

  // Asignar IDs autoincrementales
  titles.forEach((t, idx) => { t.id = idx + 1; });

  await writeDb({ titles });
  console.log(`✅ Migrados ${titles.length} títulos a db.json`);
}

migrate().catch(console.error);