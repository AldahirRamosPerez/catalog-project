require('dotenv').config();
const express = require('express');
const path = require('path');
const axios = require('axios');
const { readDb, writeDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());


// Mapeo de términos a géneros normalizados (para mostrar en el selector)
const GENRE_MAPPING = {
  "Acción": ["action", "acción", "adventure"],
  "Aventura": ["adventure", "aventura"],
  "Animación": ["animation", "animación", "animated"],
  "Comedia": ["comedy", "comedia"],
  "Drama": ["drama"],
  "Fantasía": ["fantasy", "fantasía"],
  "Ciencia Ficción": ["science fiction", "sci-fi", "sf", "ciencia ficción"],
  "Terror": ["horror", "terror"],
  "Suspense": ["thriller", "suspense"],
  "Romance": ["romance"],
  "Familiar": ["family", "familiar", "kids", "infantil"],
  "Documental": ["documentary", "documental", "doc"],
  "Musical": ["music", "musical"],
  "Western": ["western"],
  "Crimen": ["crime", "crimen"],
  // ... otros géneros
  "Novelas": []   // No necesita keywords porque se trata de forma especial
};
// ======================
// API REST v1
// ======================

// Helper para extraer parámetros de query (paginación, filtros, orden)
function parseQueryParams(query) {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(5000, parseInt(query.limit) || 5000); // por defecto 5000;
  const skip = (page - 1) * limit;
  const sortBy = query.sortBy || 'created_at';
  const order = query.order === 'asc' ? 1 : -1;

  const filters = {};
  if (query.title) filters.title = query.title;
  if (query.media_type) filters.media_type = query.media_type;
  if (query.year) filters.year = parseInt(query.year);
  if (query.genre) filters.genre = query.genre;
  if (query.rating_min) filters.rating_min = parseFloat(query.rating_min);
  if (query.rating_max) filters.rating_max = parseFloat(query.rating_max);
  // NO agregues filtros por defecto (como categoria='Animation Series')
  return { page, limit, skip, sortBy, order, filters };
}
// Aplicar filtros a un array de títulos
function applyFilters(titles, filters) {
  let result = [...titles];

    // Filtro por título (búsqueda parcial, case-insensitive)
  if (filters.title && filters.title.trim() !== '') {
    const searchTerm = filters.title.trim().toLowerCase();
    result = result.filter(t => t.title && t.title.toLowerCase().includes(searchTerm));
  }
  // ... filtros existentes (title, media_type, year, rating_min, etc.)
  
  // Nuevo filtro de género (normalizado)
  if (filters.genre) {
    const targetGenre = filters.genre.trim(); // ej: "Acción"
    const keywords = GENRE_MAPPING[targetGenre] || [targetGenre.toLowerCase()];
    result = result.filter(t => {
      if (!t.genres) return false;
      const genresLower = t.genres.toLowerCase();
      return keywords.some(keyword => genresLower.includes(keyword));
    });
  }
  
  // Filtro por carpeta raíz (fuente)
  if (filters.fuente) {
  const fuentes = Array.isArray(filters.fuente) ? filters.fuente : [filters.fuente];
  result = result.filter(t => t.fuente && fuentes.includes(t.fuente));
}
  
  // Filtro "Novela"
  if (filters.es_novela) {
    result = result.filter(t => {
      return (t.categoria && t.categoria.toLowerCase() === 'novelas') ||
             (t.genres && t.genres.toLowerCase().includes('novela')) ||
             (t.title && t.title.toLowerCase().includes('novela'));
    });
  }
  
  // Filtro "En transmisión" (usando campo status)
  if (filters.en_transmision) {
    result = result.filter(t => {
      const status = t.status ? t.status.toLowerCase() : '';
      return status === 'returning series' || status === 'in production';
    });
  }
  
  return result;
}
// Ordenar
function sortTitles(titles, sortBy, order) {
  const field = sortBy === 'title' ? 'title' : (sortBy === 'year' ? 'year' : (sortBy === 'rating' ? 'rating' : 'created_at'));
  return [...titles].sort((a, b) => {
    let aVal = a[field] || '';
    let bVal = b[field] || '';
    if (field === 'created_at') {
      aVal = new Date(aVal).getTime();
      bVal = new Date(bVal).getTime();
    }
    if (order === 1) return aVal > bVal ? 1 : -1;
    return aVal < bVal ? 1 : -1;
  });
}

function normalizeGenre(genreStr) {
  if (!genreStr) return null;
  const lower = genreStr.trim().toLowerCase();
  // Primero buscar mapeo exacto
  if (GENRE_MAPPING[lower]) return GENRE_MAPPING[lower];
  // Si no, buscar coincidencia parcial (ej. "action comedy" -> "Action")
  for (const [key, value] of Object.entries(GENRE_MAPPING)) {
    if (lower.includes(key)) return value;
  }
  // Si nada, devolver el original capitalizado (para no perder información)
  return genreStr.charAt(0).toUpperCase() + genreStr.slice(1).toLowerCase();
}

// GET /api/v1/titles
app.get('/api/v1/titles', async (req, res) => {
  const db = await readDb();
  let titles = db.titles;
  const { page, limit, skip, sortBy, order, filters } = parseQueryParams(req.query);

  // 🔥 Si el género es "Novelas", lo convertimos en filtro por fuente (carpeta raíz)
  if (filters.genre && filters.genre.toLowerCase() === 'novelas') {
    // Buscamos todas las carpetas raíz (fuente) de los títulos que tienen categoría "Novelas"
    const novelasFuentes = [...new Set(
      db.titles
        .filter(t => t.categoria && t.categoria.toLowerCase() === 'novelas')
        .map(t => t.fuente)
        .filter(f => f)  // eliminar nulos
    )];
    if (novelasFuentes.length) {
      // Reemplazamos el filtro de género por un filtro de fuente (array)
      filters.fuente = novelasFuentes;
      delete filters.genre;  // eliminar el genre para que no interfiera
    } else {
      // Si no hay ninguna novela definida, devolvemos vacío
      return res.status(200).json({ data: [], pagination: { page, limit, total: 0, pages: 0 }, filters });
    }
  }

  titles = applyFilters(titles, filters);
  const total = titles.length;
  titles = sortTitles(titles, sortBy, order);
  const paginated = titles.slice(skip, skip + limit);

  if (req.headers['hx-request']) {
    return res.render('partials/title_grid', { titles: paginated });
  }
  res.json({
    data: paginated,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    filters: req.query
  });
});

app.get('/api/v1/fuentes', async (req, res) => {
  const db = await readDb();
  const fuentes = [...new Set(db.titles.map(t => t.fuente).filter(f => f))];
  res.json(fuentes.sort());
});

// GET /api/v1/titles/:id
app.get('/api/v1/titles/:id', async (req, res) => {
  const db = await readDb();
  const id = parseInt(req.params.id);
  const title = db.titles.find(t => t.id === id);
  if (!title) return res.status(404).json({ error: 'Title not found' });
  res.json(title);
});

// POST /api/v1/titles (crear)
app.post('/api/v1/titles', async (req, res) => {
  const db = await readDb();
  const newId = db.titles.length ? Math.max(...db.titles.map(t => t.id)) + 1 : 1;
  const newTitle = {
    id: newId,
    title: req.body.title,
    original_title: req.body.original_title || null,
    media_type: req.body.media_type,
    year: req.body.year,
    rating: req.body.rating || null,
    genres: req.body.genres || null,
    overview: req.body.overview || null,
    poster_url: req.body.poster_url || null,
    director: req.body.director || null,
    cast: req.body.cast || null,
    budget: req.body.budget || null,
    revenue: req.body.revenue || null,
    runtime: req.body.runtime || null,
    created_at: new Date().toISOString(),
    // otros campos opcionales...
  };
  db.titles.push(newTitle);
  await writeDb(db);
  res.status(201).json(newTitle);
});

// PUT /api/v1/titles/:id (reemplazar todo)
app.put('/api/v1/titles/:id', async (req, res) => {
  const db = await readDb();
  const id = parseInt(req.params.id);
  const index = db.titles.findIndex(t => t.id === id);
  if (index === -1) return res.status(404).json({ error: 'Not found' });
  const updated = { ...req.body, id, created_at: db.titles[index].created_at };
  db.titles[index] = updated;
  await writeDb(db);
  res.json(updated);
});

// PATCH /api/v1/titles/:id (actualización parcial)
app.patch('/api/v1/titles/:id', async (req, res) => {
  const db = await readDb();
  const id = parseInt(req.params.id);
  const index = db.titles.findIndex(t => t.id === id);
  if (index === -1) return res.status(404).json({ error: 'Not found' });
  const old = db.titles[index];
  const updated = { ...old, ...req.body, id };
  db.titles[index] = updated;
  await writeDb(db);
  res.json(updated);
});

// DELETE /api/v1/titles/:id
app.delete('/api/v1/titles/:id', async (req, res) => {
  const db = await readDb();
  const id = parseInt(req.params.id);
  const newTitles = db.titles.filter(t => t.id !== id);
  if (newTitles.length === db.titles.length) {
    return res.status(404).json({ error: 'Not found' });
  }
  db.titles = newTitles;
  await writeDb(db);
  res.status(204).send();
});

// GET /api/v1/genres (lista única de géneros)
app.get('/api/v1/genres', async (req, res) => {
  const fixedGenres = Object.keys(GENRE_MAPPING);
  res.json(fixedGenres);
});
// GET /api/v1/years (años disponibles)
app.get('/api/v1/years', async (req, res) => {
  const db = await readDb();
  const years = [...new Set(db.titles.filter(t => t.year).map(t => t.year))].sort((a,b) => a-b);
  res.json(years);
});

// GET /api/v1/stats
app.get('/api/v1/stats', async (req, res) => {
  const db = await readDb();
  const titles = db.titles;
  const total = titles.length;
  const avgRating = total ? (titles.reduce((s,t) => s + (t.rating || 0), 0) / total).toFixed(2) : 0;
  const typeCount = {};
  titles.forEach(t => { typeCount[t.media_type] = (typeCount[t.media_type] || 0) + 1; });
  res.json({ total, avgRating: parseFloat(avgRating), typeCount });
});

// Middleware para inyectar la db en cada request (opcional, pero útil)
app.use(async (req, res, next) => {
  req.db = await readDb();
  next();
});

// ------------------ Rutas ------------------

// Ruta principal
// Ruta principal (sirve la página vacía, los datos vendrán por API)
app.get('/', async (req, res) => {
  const db = await readDb();
  const titles = db.titles.slice(0, 20); // solo los primeros 20
  const recentTitles = [...db.titles].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,5);
  res.render('index', { titles, recentTitles });
});
// Dashboard con filtros
app.get('/dashboard', async (req, res) => {
  const { type, year_min, year_max } = req.query;
  const db = await readDb();
  let titles = db.titles;

  // Función auxiliar para normalizar tipos (si tienes valores mixtos)
  const normalizeType = (t) => {
    const val = t.media_type ? t.media_type.toLowerCase() : '';
    if (val === 'movie' || val === 'pelicula' || val === 'película') return 'movie';
    if (val === 'tv' || val === 'serie' || val === 'series') return 'tv';
    if (val === 'anime') return 'anime';
    return val;
  };

  if (type && type !== 'todos') {
    titles = titles.filter(t => normalizeType(t) === type);
  }
  if (year_min) {
    titles = titles.filter(t => t.year && t.year >= parseInt(year_min));
  }
  if (year_max) {
    titles = titles.filter(t => t.year && t.year <= parseInt(year_max));
  }

  const total = titles.length;
  const avgRating = total ? (titles.reduce((s, t) => s + (t.rating || 0), 0) / total).toFixed(1) : 0;
  const typeCounts = {};
  titles.forEach(t => { typeCounts[t.media_type] = (typeCounts[t.media_type] || 0) + 1; });

  const recent = [...titles]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 8);

  // Evolución rating por año
  const yearRatings = {};
  titles.forEach(t => {
    if (t.year && t.rating) {
      if (!yearRatings[t.year]) yearRatings[t.year] = { sum: 0, count: 0 };
      yearRatings[t.year].sum += t.rating;
      yearRatings[t.year].count++;
    }
  });
  const ratingOverYears = Object.entries(yearRatings)
    .map(([year, data]) => ({ year: parseInt(year), avg: data.sum / data.count }))
    .sort((a, b) => a.year - b.year);

  // Top 5 géneros
  const genreCount = {};
  titles.forEach(t => {
    if (t.genres) {
      t.genres.split('|').forEach(g => {
        const clean = g.trim();
        if (clean) genreCount[clean] = (genreCount[clean] || 0) + 1;
      });
    }
  });
  const topGenres = Object.entries(genreCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  const globalYears = db.titles.filter(t => t.year).map(t => t.year);
  const minYear = globalYears.length ? Math.min(...globalYears) : 1900;
  const maxYear = globalYears.length ? Math.max(...globalYears) : new Date().getFullYear();

  const selectedType = type || 'todos';
  const selectedMin = year_min || '';
  const selectedMax = year_max || '';

  res.render('dashboard', {
    total,
    avg: avgRating,
    typeCounts,
    recent,
    ratingOverYears: JSON.stringify(ratingOverYears),
    topGenres,
    minYear,
    maxYear,
    selectedType,
    selectedMin,
    selectedMax,
    titles  // necesario para calcular porcentajes en la vista
  });
});

app.get('/title/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const title = req.db.titles.find(t => t.id === id);
  if (!title) return res.status(404).send('No encontrado');
  res.render('detail', { title });
});

app.get('/add', (req, res) => {
  res.render('add');
});

app.get('/api/v1/titles', async (req, res) => {
  const db = await readDb();
  let titles = db.titles;

  // Log para ver cuántos títulos hay en total
  console.log(`Total en DB: ${titles.length}`);

  // Obtener parámetros de la query
  const { page, limit, skip, sortBy, order, filters } = parseQueryParams(req.query);
  console.log('Filtros recibidos:', filters);

  // Aplicar filtros solo si se especificaron
  let filteredTitles = titles;
  if (Object.keys(filters).length > 0) {
    filteredTitles = applyFilters(titles, filters);
    console.log(`Después de filtrar: ${filteredTitles.length} títulos`);
  } else {
    console.log('Sin filtros, se devuelven todos los títulos');
  }

  const total = filteredTitles.length;
  const sorted = sortTitles(filteredTitles, sortBy, order);
  const paginated = sorted.slice(skip, skip + limit);

  // Log de ejemplo de los primeros títulos (para ver si hay acción)
  if (paginated.length > 0) {
    console.log('Primer título:', paginated[0].title, paginated[0].categoria);
  }

  if (req.headers['hx-request']) {
    return res.render('partials/title_grid', { titles: paginated });
  }

  res.json({
    data: paginated,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    filters: req.query
  });
});

app.get('/api/external/search', async (req, res) => {
  const { query, media_type = 'movie' } = req.query;
  if (!query || query.length < 2) return res.json([]);
  const url = `https://api.themoviedb.org/3/search/${media_type}`;
  const params = { api_key: process.env.TMDB_API_KEY, query, language: 'es-MX' };
  const response = await axios.get(url, { params });
  const results = response.data.results.slice(0,10).map(item => ({
    external_id: `tmdb:${item.id}`,
    title: item.title || item.name,
    year: (item.release_date || item.first_air_date || '').slice(0,4),
    poster: item.poster_path ? `https://image.tmdb.org/t/p/w200${item.poster_path}` : null
  }));
  res.json(results);
});

app.delete('/api/titles/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const db = await readDb();
  const newTitles = db.titles.filter(t => t.id !== id);
  await writeDb({ titles: newTitles });
  res.json({ ok: true });
});

app.get('/export/excel', async (req, res) => {
  // Implementación opcional usando 'xlsx' para generar archivo
  res.send('Exportación aún no implementada');
});

// Ruta de búsqueda/filtros (página completa)
app.get('/explore', async (req, res) => {
  const { q, type, year_min, year_max, genre, rating_min } = req.query;
  const db = await readDb();
  let titles = db.titles;

  // Filtro por título (búsqueda parcial, case-insensitive)
  if (q && q.trim()) {
    const search = q.trim().toLowerCase();
    titles = titles.filter(t => t.title && t.title.toLowerCase().includes(search));
  }

  // Filtro por tipo (movie, tv, anime)
  if (type && type !== 'todos') {
    titles = titles.filter(t => t.media_type === type);
  }

  // Filtro por año mínimo
  if (year_min && year_min !== '') {
    const minYear = parseInt(year_min);
    if (!isNaN(minYear)) {
      titles = titles.filter(t => t.year && t.year >= minYear);
    }
  }

  // Filtro por año máximo
  if (year_max && year_max !== '') {
    const maxYear = parseInt(year_max);
    if (!isNaN(maxYear)) {
      titles = titles.filter(t => t.year && t.year <= maxYear);
    }
  }

  // Filtro por género (coincidencia exacta en el array de géneros)
  if (genre && genre !== '') {
    titles = titles.filter(t => t.genres && t.genres.split('|').map(g => g.trim()).includes(genre));
  }

  // Filtro por rating mínimo (CORREGIDO)
  if (rating_min && rating_min !== '') {
    const minRating = parseFloat(rating_min);
    if (!isNaN(minRating)) {
      titles = titles.filter(t => {
        if (t.rating === undefined || t.rating === null) return false;
        const ratingNum = parseFloat(t.rating);
        return !isNaN(ratingNum) && ratingNum >= minRating;
      });
    }
  }

  // Obtener lista única de géneros (para el selector)
  const allGenres = new Set();
  db.titles.forEach(t => {
    if (t.genres) {
      t.genres.split('|').forEach(g => {
        const clean = g.trim();
        if (clean) allGenres.add(clean);
      });
    }
  });
  const genreList = Array.from(allGenres).sort();

  // Obtener rangos de años globales (para los selectores)
  const years = db.titles.filter(t => t.year).map(t => t.year);
  const minYearGlobal = years.length ? Math.min(...years) : 1900;
  const maxYearGlobal = years.length ? Math.max(...years) : new Date().getFullYear();

  // Pasar los títulos filtrados y los metadatos a la vista
  res.render('explore', {
    titles,
    filters: { q, type, year_min, year_max, genre, rating_min },
    genreList,
    minYearGlobal,
    maxYearGlobal
  });
});
// Ruta que devuelve solo los resultados (para HTMX)
app.get('/api/search', async (req, res) => {
  const { q, type, year_min, year_max, genre, rating_min } = req.query;
  const db = await readDb();
  let titles = db.titles;

  // mismos filtros que arriba...
  if (q && q.trim()) {
    const search = q.trim().toLowerCase();
    titles = titles.filter(t => t.title && t.title.toLowerCase().includes(search));
  }
  if (type && type !== 'todos') {
    titles = titles.filter(t => t.media_type === type);
  }
  if (year_min) {
    titles = titles.filter(t => t.year && t.year >= parseInt(year_min));
  }
  if (year_max) {
    titles = titles.filter(t => t.year && t.year <= parseInt(year_max));
  }
  if (genre && genre !== '') {
    titles = titles.filter(t => t.genres && t.genres.split('|').map(g => g.trim()).includes(genre));
  }
  if (rating_min) {
    titles = titles.filter(t => t.rating && t.rating >= parseFloat(rating_min));
  }

  res.render('partials/search_results_grid', { titles });
});
// Ruta para el dashboard con filtros
app.get('/dashboard', async (req, res) => {
  const { type, year_min, year_max } = req.query;
  let db = await readDb();
  let titles = db.titles;

  // Aplicar filtros
  if (type && type !== 'todos') {
    titles = titles.filter(t => t.media_type === type);
  }
  if (year_min) {
    titles = titles.filter(t => t.year && t.year >= parseInt(year_min));
  }
  if (year_max) {
    titles = titles.filter(t => t.year && t.year <= parseInt(year_max));
  }

  const total = titles.length;
  const avgRating = titles.reduce((s,t) => s + (t.rating || 0), 0) / (total || 1);
  const typeCounts = {};
  titles.forEach(t => { typeCounts[t.media_type] = (typeCounts[t.media_type] || 0) + 1; });
  
  // Últimos 8 añadidos
  const recent = [...titles].sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).slice(0,8);

  // Evolución rating por año
  const yearRatings = {};
  titles.forEach(t => {
    if (t.year && t.rating) {
      if (!yearRatings[t.year]) yearRatings[t.year] = { sum: 0, count: 0 };
      yearRatings[t.year].sum += t.rating;
      yearRatings[t.year].count++;
    }
  });
  const ratingOverYears = Object.entries(yearRatings)
    .map(([year, data]) => ({ year: parseInt(year), avg: data.sum / data.count }))
    .sort((a,b) => a.year - b.year);

  // Top 5 géneros
  const genreCount = {};
  titles.forEach(t => {
    if (t.genres) {
      t.genres.split('|').forEach(g => {
        const clean = g.trim();
        if (clean) genreCount[clean] = (genreCount[clean] || 0) + 1;
      });
    }
  });
  const topGenres = Object.entries(genreCount)
    .sort((a,b) => b[1] - a[1])
    .slice(0,5)
    .map(([name, count]) => ({ name, count }));

  // Años globales (sin filtrar) para los selectores
  const globalYears = db.titles.filter(t => t.year).map(t => t.year);
  const minYear = globalYears.length ? Math.min(...globalYears) : 1900;
  const maxYear = globalYears.length ? Math.max(...globalYears) : new Date().getFullYear();

  // Valores seleccionados (para mantener en el formulario)
  const selectedType = type || 'todos';
  const selectedMin = year_min || '';
  const selectedMax = year_max || '';

  // Porcentaje con póster
  const withPoster = titles.filter(t => t.poster_url).length;
  const posterPercent = total ? Math.round(withPoster / total * 100) : 0;

  res.render('dashboard', {
    total,
    avg: avgRating.toFixed(1),
    typeCounts,
    recent,
    ratingOverYears: JSON.stringify(ratingOverYears),
    topGenres,
    minYear,
    maxYear,
    selectedType,
    selectedMin,
    selectedMax,
    posterPercent,
    // También pasamos los títulos filtrados por si se necesitan en la plantilla
    titles
  });
});

app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));