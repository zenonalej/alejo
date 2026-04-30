/**
 * ============================================================
 *  SERVICE WORKER — sw.js
 *  Cache API para descarga y reproducción offline de videos
 * ============================================================
 *
 *  Estrategia:
 *  - Archivos de shell (HTML, CSS, JS): Cache First
 *  - Videos /media/*: Cache First con descarga en background
 *  - API (/api/*): Network First con fallback silencioso
 */

const CACHE_VERSION = "signage-v1";
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const VIDEO_CACHE = `${CACHE_VERSION}-videos`;

// Archivos de la "app shell" que siempre deben estar en caché
const SHELL_ASSETS = ["/", "/index.html"];

// ─── Install ────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  console.log("[SW] Instalando...");
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => {
        console.log("[SW] Shell assets cacheados.");
        return self.skipWaiting(); // Activa inmediatamente sin esperar reload
      })
  );
});

// ─── Activate ───────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  console.log("[SW] Activando...");
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("signage-") && key !== SHELL_CACHE && key !== VIDEO_CACHE)
            .map((key) => {
              console.log("[SW] Eliminando caché obsoleta:", key);
              return caches.delete(key);
            })
        )
      )
      .then(() => self.clients.claim())
  );
});

// ─── Fetch ──────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Ignorar peticiones que no son GET
  if (event.request.method !== "GET") return;

  // ── Estrategia para videos: Cache First ──────────────────
  if (url.pathname.startsWith("/media/")) {
    event.respondWith(cacheFirstVideo(event.request));
    return;
  }

  // ── Estrategia para API: Network First ───────────────────
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirstAPI(event.request));
    return;
  }

  // ── Estrategia para shell: Cache First ───────────────────
  event.respondWith(cacheFirstShell(event.request));
});

// ─── Mensaje desde el cliente: pre-cachear videos ──────────
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "CACHE_VIDEOS") {
    const urls = event.data.urls || [];
    event.waitUntil(precacheVideos(urls));
  }
});

// ═══════════════════════════════════════════════════════════
//  Funciones de estrategia
// ═══════════════════════════════════════════════════════════

/**
 * Cache First para videos.
 * Si no está en caché, lo descarga completamente antes de
 * devolverlo, garantizando reproducción fluida sin buffering.
 */
async function cacheFirstVideo(request) {
  const cache = await caches.open(VIDEO_CACHE);
  const cached = await cache.match(request);

  if (cached) {
    console.log("[SW] Video desde caché:", request.url);
    return cached;
  }

  console.log("[SW] Descargando video a caché:", request.url);
  try {
    // Descarga completa (sin streaming parcial) para garantizar
    // que el video esté íntegro antes de reproducirse
    const response = await fetch(request.url, {
      cache: "no-store", // Evita doble caché del browser
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    // Clona antes de guardar: la respuesta solo puede leerse una vez
    const responseToCache = response.clone();
    await cache.put(request, responseToCache);
    console.log("[SW] Video cacheado exitosamente:", request.url);

    return response;
  } catch (err) {
    console.error("[SW] Error descargando video:", err.message);
    // Devuelve respuesta vacía para no bloquear el reproductor
    return new Response(null, { status: 503, statusText: "Video no disponible offline" });
  }
}

/**
 * Pre-cachea una lista de URLs de videos en background.
 * Llamado desde el cliente al obtener la playlist.
 */
async function precacheVideos(urls) {
  const cache = await caches.open(VIDEO_CACHE);
  const results = { cached: 0, skipped: 0, errors: 0 };

  for (const url of urls) {
    try {
      const existing = await cache.match(url);
      if (existing) {
        results.skipped++;
        console.log("[SW] Ya en caché, saltando:", url);
        continue;
      }

      console.log("[SW] Pre-cacheando:", url);
      const response = await fetch(url, { cache: "no-store" });

      if (response.ok) {
        await cache.put(url, response);
        results.cached++;

        // Notifica al cliente el progreso
        const clients = await self.clients.matchAll();
        clients.forEach((client) => {
          client.postMessage({
            type: "VIDEO_CACHED",
            url,
            progress: results,
            total: urls.length,
          });
        });
      } else {
        results.errors++;
      }
    } catch (err) {
      results.errors++;
      console.error("[SW] Error pre-cacheando", url, err.message);
    }
  }

  console.log("[SW] Pre-caché completado:", results);

  // Notifica finalización al cliente
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({ type: "PRECACHE_COMPLETE", results, total: urls.length });
  });
}

/**
 * Network First para la API.
 * Intenta red primero; si falla, no rompe la app (retorna null JSON).
 */
async function networkFirstAPI(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch {
    // Servidor no disponible — el cliente manejará el fallback
    return new Response(JSON.stringify({ _offline: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * Cache First para archivos del shell (HTML, assets estáticos).
 */
async function cacheFirstShell(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("<h1>Sin conexión</h1>", {
      headers: { "Content-Type": "text/html" },
    });
  }
}
