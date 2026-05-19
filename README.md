# catalog-project
# 🎬 Cinematix – Catálogo Multimedia Inteligente

**Cinematix** es un catálogo web para gestionar tu colección personal de películas, series y animación. Construido con Node.js, Express y EJS, consume la API de TMDb para enriquecer metadatos, y permite filtrar, explorar y visualizar estadísticas de tu biblioteca. Ideal para cinéfilos que quieren organizar su contenido en un solo lugar.

![Vista previa del dashboard](https://via.placeholder.com/800x400?text=Demonstration+Screenshot) <!-- Reemplaza con una captura real -->

---

## ✨ Características principales

- **Catálogo completo** – Importa tus títulos desde un Excel (`CATALOGO_LIMPIO.xlsx`) o añádelos manualmente con búsqueda en TMDb.
- **Filtros avanzados** – Busca por título, género, año, rating mínimo y tipo (película/serie).
- **Dashboard estadístico** – Gráficos interactivos (distribución por tipo, evolución de rating, géneros más frecuentes) con Chart.js.
- **Modo oscuro/claro** – Interfaz adaptativa con TailwindCSS y persistencia en localStorage.
- **Paginación** – Navega por páginas de resultados (20 elementos por página).
- **Diseño profesional** – Inspirado en Netflix/Disney+, con carruseles horizontales y héroe destacado.
- **API REST integrada** – Endpoints documentados para obtener, filtrar y administrar los títulos.
- **Sin emojis** – Solo iconos Font Awesome para un look limpio y moderno.
- **Base de datos JSON** – Almacenamiento sencillo (archivo `db.json`), fácil de respaldar.

---

## 🛠️ Tecnologías utilizadas

| Tecnología       | Propósito                          |
|------------------|------------------------------------|
| Node.js + Express| Backend y servidor web             |
| EJS              | Motor de plantillas                |
| TailwindCSS      | Estilos responsivos y utilidades   |
| Chart.js         | Gráficos en el dashboard           |
| Axios            | Peticiones a TMDb                  |
| Font Awesome 6   | Iconos profesionales               |
| HTMX             | Filtros sin recargar la página     |
| SQLite (mejorado)| Persistencia en `db.json` con `fs` |

---

## 📦 Instalación local

Sigue estos pasos para tener el proyecto funcionando en tu máquina:

```bash
# 1. Clona el repositorio
git clone https://github.com/AldahirRamosPerez/catalog-project.git
cd catalog-project

# 2. Instala dependencias
npm install

# 3. Crea un archivo .env con tu clave de TMDb
echo "TMDB_API_KEY=tu_clave_aqui" > .env

# 4. (Opcional) Importa tus datos desde el Excel
# Asegúrate de tener el archivo CATALOGO_LIMPIO.xlsx en la ruta indicada en migrate.js
# Luego ejecuta:
npm run migrate

# 5. Inicia el servidor
npm start
# o en modo desarrollo con recarga automática:
npm run dev
