const fs = require('fs').promises;
const path = require('path');

const DB_PATH = path.join(__dirname, 'db.json');

async function readDb() {
  try {
    const data = await fs.readFile(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    // Si el archivo no existe, devolver estructura por defecto
    if (err.code === 'ENOENT') {
      return { titles: [] };
    }
    throw err;
  }
}

async function writeDb(data) {
  await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2));
}

module.exports = { readDb, writeDb };