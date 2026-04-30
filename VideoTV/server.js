/**
 * ============================================================
 *  DIGITAL SIGNAGE SERVER — server.js
 *  Node.js + Express — Servidor de Cartelería Digital Local
 * ============================================================
 */

const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Rutas base ────────────────────────────────────────────
const MEDIA_DIR = path.join(__dirname, "media");
const PUBLIC_DIR = path.join(__dirname, "public");
const CONFIG_FILE = path.join(__dirname, "config.json");

// Extensiones de video aceptadas
const VIDEO_EXTENSIONS = [".mp4", ".webm", ".ogg", ".mov"];

// ─── Middleware ────────────────────────────────────────────

// Habilita CORS para que el cliente HTML pueda consumir la API
// (útil si el cliente se sirve desde otro origen durante desarrollo)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

// Sirve la carpeta /public como raíz estática (index.html, sw.js, etc.)
app.use(express.static(PUBLIC_DIR));

// Sirve los archivos de /media bajo la ruta /media con headers adecuados
// para streaming de video (Accept-Ranges)
app.use(
  "/media",
  (req, res, next) => {
    res.set("Accept-Ranges", "bytes");
    next();
  },
  express.static(MEDIA_DIR)
);

// ─── API: Lista de reproducción ────────────────────────────

/**
 * GET /api/playlist
 * Lee el directorio /media, filtra los archivos de video
 * y devuelve un JSON con la lista ordenada alfabéticamente.
 *
 * Respuesta:
 * {
 *   "videos": [
 *     { "name": "promo_01.mp4", "url": "/media/promo_01.mp4" },
 *     ...
 *   ],
 *   "generatedAt": "2025-01-15T10:30:00.000Z"
 * }
 */
app.get("/api/playlist", (req, res) => {
  fs.readdir(MEDIA_DIR, (err, files) => {
    if (err) {
      console.error("[playlist] Error leyendo /media:", err.message);
      return res.status(500).json({ error: "No se pudo leer el directorio de medios." });
    }

    const videos = files
      .filter((file) => {
        const ext = path.extname(file).toLowerCase();
        return VIDEO_EXTENSIONS.includes(ext);
      })
      .sort() // Orden alfanumérico consistente
      .map((file) => ({
        name: file,
        url: `/media/${encodeURIComponent(file)}`,
      }));

    console.log(`[playlist] ${videos.length} video(s) encontrado(s).`);

    res.json({
      videos,
      generatedAt: new Date().toISOString(),
    });
  });
});

// ─── API: Configuración ────────────────────────────────────

/**
 * GET /api/config
 * Lee y devuelve config.json en tiempo real (sin caché),
 * permitiendo actualizar marqueeText o logoUrl sin reiniciar.
 */
app.get("/api/config", (req, res) => {
  fs.readFile(CONFIG_FILE, "utf8", (err, data) => {
    if (err) {
      console.error("[config] Error leyendo config.json:", err.message);
      // Devuelve valores por defecto en lugar de un error 500
      return res.json({
        marqueeText: "Bienvenido — Sistema de Cartelería Digital",
        logoUrl: "/media/logo.png",
      });
    }

    try {
      const config = JSON.parse(data);
      res.json(config);
    } catch (parseErr) {
      console.error("[config] JSON inválido en config.json:", parseErr.message);
      res.status(500).json({ error: "config.json tiene formato inválido." });
    }
  });
});

// ─── Ruta raíz ─────────────────────────────────────────────

// Redirige / a index.html explícitamente (por si acaso)
app.get("/", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

// ─── Health check ───────────────────────────────────────────

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// ─── Inicio del servidor ───────────────────────────────────

app.listen(PORT, "0.0.0.0", () => {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║   DIGITAL SIGNAGE SERVER — INICIADO      ║");
  console.log(`║   Puerto  : http://0.0.0.0:${PORT}           ║`);
  console.log(`║   Medios  : ${MEDIA_DIR}`);
  console.log(`║   Cliente : ${PUBLIC_DIR}`);
  console.log("╚══════════════════════════════════════════╝");
});
