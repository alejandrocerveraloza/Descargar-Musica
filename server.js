import express from 'express';
import cors from 'cors';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';
import { unlink, access, writeFile, chmod } from 'fs/promises';
import { fileURLToPath } from 'url';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json());

const YTDLP_PATH = path.join(__dirname, 'yt-dlp');

// Descargar / actualizar yt-dlp
async function ensureYtDlp() {
  try {
    await access(YTDLP_PATH);
    console.log('yt-dlp ya existe, intentando actualizar...');
    // Intentamos actualizarlo
    try {
      await execFileAsync(YTDLP_PATH, ['-U'], { timeout: 60000 });
      console.log('yt-dlp actualizado');
    } catch (e) {
      console.log('No se pudo actualizar, usamos la versión actual');
    }
    return;
  } catch {}

  console.log('Descargando yt-dlp...');
  const url = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';
  const res = await fetch(url);
  if (!res.ok) throw new Error('No se pudo descargar yt-dlp');
  
  const buffer = Buffer.from(await res.arrayBuffer());
  await writeFile(YTDLP_PATH, buffer);
  await chmod(YTDLP_PATH, 0o755);
  console.log('yt-dlp descargado correctamente');
}

app.get('/', async (req, res) => {
  try {
    await ensureYtDlp();
    res.json({ status: 'ok', message: 'MusicHub API funcionando' });
  } catch (err) {
    res.json({ status: 'error', message: err.message });
  }
});

app.get('/api/info', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: 'Falta el parámetro url' });

  try {
    await ensureYtDlp();

    const { stdout } = await execFileAsync(YTDLP_PATH, [
      url,
      '--dump-json',
      '--no-playlist',
      '--no-warnings',
      '--extractor-args', 'youtube:player_client=android'
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

app.get('/api/download', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: 'Falta el parámetro url' });

  const tempFile = path.join(os.tmpdir(), `${randomUUID()}.%(ext)s`);
  const outputFile = path.join(os.tmpdir(), `${randomUUID()}.mp3`);

  try {
    await ensureYtDlp();

    // Usamos el cliente android (funciona mejor contra bloqueos)
    await execFileAsync(YTDLP_PATH, [
      url,
      '-x',
      '--audio-format', 'mp3',
      '--audio-quality', '0',
      '-o', outputFile,
      '--no-playlist',
      '--no-warnings',
      '--force-overwrites',
      '--extractor-args', 'youtube:player_client=android'
    ], { timeout: 180000 });

    // Nombre del archivo
    let filename = 'audio.mp3';
    try {
      const { stdout } = await execFileAsync(YTDLP_PATH, [
        url,
        '--dump-json',
        '--no-playlist',
        '--no-warnings',
        '--extractor-args', 'youtube:player_client=android'
      ], { timeout: 30000 });

      const info = JSON.parse(stdout);
      const artist = (info.uploader || info.channel || 'Unknown').replace(/[\\/:*?"<>|]/g, '');
      const title = (info.title || 'audio').replace(/[\\/:*?"<>|]/g, '');
      filename = `${artist} - ${title}.mp3`;
    } catch {}

    res.download(outputFile, filename, async () => {
      try { await unlink(outputFile); } catch {}
    });

  } catch (err) {
    console.error(err);
    try { await unlink(outputFile); } catch {}
    res.status(500).json({
      error: 'Error al descargar el audio',
      details: err.message
    });
  }
});

const PORT = process.env.PORT || 3000;

ensureYtDlp()
  .then(() => {
    app.listen(PORT, () => console.log(`MusicHub API escuchando en puerto ${PORT}`));
  })
  .catch(err => {
    console.error(err);
    app.listen(PORT, () => console.log(`API escuchando (con errores) en puerto ${PORT}`));
  });
