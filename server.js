import express from 'express';
import cors from 'cors';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';
import { unlink, access, writeFile, chmod } from 'fs/promises';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { fileURLToPath } from 'url';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json());

const YTDLP_PATH = path.join(__dirname, 'yt-dlp');

// Descargar yt-dlp si no existe
async function ensureYtDlp() {
  try {
    await access(YTDLP_PATH);
    console.log('yt-dlp ya existe');
    return;
  } catch {}

  console.log('Descargando yt-dlp...');
  
  const url = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';
  const res = await fetch(url);
  
  if (!res.ok) throw new Error('No se pudo descargar yt-dlp');
  
  const buffer = Buffer.from(await res.arrayBuffer());
  await writeFile(YTDLP_PATH, buffer);
  await chmod(YTDLP_PATH, 0o755); // Dar permisos de ejecución
  
  console.log('yt-dlp descargado correctamente');
}

// Health check
app.get('/', async (req, res) => {
  try {
    await ensureYtDlp();
    res.json({ status: 'ok', message: 'MusicHub API funcionando', ytDlp: true });
  } catch (err) {
    res.json({ status: 'ok', message: 'API viva pero yt-dlp falló', error: err.message });
  }
});

// Información del vídeo
app.get('/api/info', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: 'Falta el parámetro url' });

  try {
    await ensureYtDlp();
    
    const { stdout } = await execFileAsync(YTDLP_PATH, [
      url,
      '--dump-json',
      '--no-playlist',
      '--no-warnings'
    ], { timeout: 60000 });

    const info = JSON.parse(stdout);
    
    res.json({
      title: info.title || 'Sin título',
      artist: info.uploader || info.channel || info.creator || 'Desconocido',
      duration: info.duration || 0,
      thumbnail: info.thumbnail || null,
      id: info.id
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudo obtener la información', details: err.message });
  }
});

// Descargar MP3
app.get('/api/download', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: 'Falta el parámetro url' });

  const tempFile = path.join(os.tmpdir(), `${randomUUID()}.mp3`);

  try {
    await ensureYtDlp();

    // Descargar solo el audio
    await execFileAsync(YTDLP_PATH, [
      url,
      '-x',
      '--audio-format', 'mp3',
      '--audio-quality', '0',
      '-o', tempFile,
      '--no-playlist',
      '--no-warnings',
      '--force-overwrites'
    ], { timeout: 180000 }); // 3 minutos máximo

    // Intentar sacar buen nombre
    let filename = 'audio.mp3';
    try {
      const { stdout } = await execFileAsync(YTDLP_PATH, [
        url, '--dump-json', '--no-playlist', '--no-warnings'
      ], { timeout: 30000 });
      
      const info = JSON.parse(stdout);
      const artist = (info.uploader || info.channel || 'Unknown').replace(/[\\/:*?"<>|]/g, '');
      const title = (info.title || 'audio').replace(/[\\/:*?"<>|]/g, '');
      filename = `${artist} - ${title}.mp3`;
    } catch {}

    res.download(tempFile, filename, async () => {
      try { await unlink(tempFile); } catch {}
    });

  } catch (err) {
    console.error(err);
    try { await unlink(tempFile); } catch {}
    res.status(500).json({ 
      error: 'Error al descargar el audio', 
      details: err.message 
    });
  }
});

const PORT = process.env.PORT || 3000;

// Arrancamos y descargamos yt-dlp
ensureYtDlp()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`MusicHub API escuchando en puerto ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Error crítico al preparar yt-dlp:', err);
    app.listen(PORT, () => {
      console.log(`API escuchando (sin yt-dlp) en puerto ${PORT}`);
    });
  });
