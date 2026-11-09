import express from 'express';
import cors from 'cors';
import YTDlpWrap from 'yt-dlp-wrap';
import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';
import { unlink } from 'fs/promises';

const app = express();
app.use(cors());
app.use(express.json());

const ytDlp = new YTDlpWrap();

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'MusicHub API funcionando' });
});

// Obtener información del vídeo
app.get('/api/info', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: 'Falta el parámetro url' });

  try {
    const info = await ytDlp.getVideoInfo(url);
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

// Descargar el audio en MP3
app.get('/api/download', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: 'Falta el parámetro url' });

  const tempFile = path.join(os.tmpdir(), `${randomUUID()}.mp3`);

  try {
    await ytDlp.execPromise([
      url,
      '-x',
      '--audio-format', 'mp3',
      '--audio-quality', '0',
      '-o', tempFile,
      '--no-playlist',
      '--no-warnings',
      '--force-overwrites'
    ]);

    // Intentamos poner un buen nombre de archivo
    let filename = 'audio.mp3';
    try {
      const info = await ytDlp.getVideoInfo(url);
      const artist = (info.uploader || info.channel || 'Unknown').replace(/[\\/:*?"<>|]/g, '');
      const title = (info.title || 'audio').replace(/[\\/:*?"<>|]/g, '');
      filename = `${artist} - ${title}.mp3`;
    } catch {}

    res.download(tempFile, filename, async (err) => {
      try {
        await unlink(tempFile);
      } catch {}
    });

  } catch (err) {
    console.error(err);
    try { await unlink(tempFile); } catch {}
    res.status(500).json({ error: 'Error al descargar el audio', details: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`MusicHub API escuchando en puerto ${PORT}`);
});