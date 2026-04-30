# 📺 Sistema de Cartelería Digital — Smart TV TCL

Sistema de digital signage local para 2 Smart TVs TCL (Android/Google TV).
Servidor Node.js + Express con cliente HTML5/JS Vanilla y Service Worker para caché offline.

---

## 📁 Estructura de carpetas

```
digital-signage/
├── server.js              ← Servidor Node.js + Express
├── package.json
├── config.json            ← Texto de marquesina y URL del logo
│
├── media/                 ← 🎬 TUS VIDEOS Y LOGO VAN AQUÍ
│   ├── logo.png           ← Logotipo de tu empresa (PNG con fondo transparente)
│   ├── promo_01.mp4
│   ├── promo_02.mp4
│   └── ...
│
└── public/                ← Cliente web (servido estáticamente)
    ├── index.html         ← Reproductor HTML5
    └── sw.js              ← Service Worker (caché de videos)
```

---

## 🚀 Instalación y arranque

### Prerequisitos
- Node.js v18 o superior
- Conexión de red local (WiFi o LAN) que comparta el servidor con las TVs

### Pasos

```bash
# 1. Clona o copia la carpeta del proyecto
cd digital-signage

# 2. Instala dependencias
npm install

# 3. Agrega tus videos a la carpeta /media
#    Formatos soportados: .mp4, .webm, .ogg, .mov

# 4. Edita config.json con tu texto y logo

# 5. Inicia el servidor
npm start
```

El servidor arrancará en: `http://0.0.0.0:3000`

---

## 📡 Configurar las Smart TVs

### Obtener la IP del servidor
```bash
# En Linux/Mac:
ip addr show | grep "inet "

# En Windows:
ipconfig
```
Ejemplo: `192.168.1.100`

### En cada Smart TV TCL:
1. Abre el navegador integrado (Google TV Browser o cualquier app de browser)
2. Navega a: `http://192.168.1.100:3000`
3. El sistema cargará automáticamente, descargará los videos a memoria y comenzará la reproducción.

> 💡 **Tip:** Para máxima compatibilidad con el WebView de Android TV, usa videos en formato **H.264 + AAC en contenedor MP4**.

---

## ⚙️ Actualizar contenido sin reiniciar

### Agregar nuevos videos
1. Copia los archivos `.mp4` a la carpeta `/media/`
2. La próxima vez que la playlist complete un ciclo, las TVs detectarán automáticamente los nuevos videos.

### Cambiar el texto de la marquesina
1. Edita `config.json` y modifica `marqueeText`
2. Al finalizar el ciclo de playlist actual, las TVs cargarán el nuevo texto.

### Cambiar el logo
1. Reemplaza el archivo en `/media/logo.png` o apunta `logoUrl` a otro archivo
2. Edita `config.json` con la nueva ruta

---

## 🔌 Endpoints del servidor

| Endpoint | Descripción |
|---|---|
| `GET /` | Sirve el cliente HTML (reproductor) |
| `GET /api/playlist` | Lista de videos en `/media` (JSON) |
| `GET /api/config` | Contenido de `config.json` |
| `GET /api/health` | Estado del servidor (uptime) |
| `GET /media/:archivo` | Streaming de archivo de video/imagen |

---

## 🧠 Arquitectura del Service Worker

El SW implementa 3 estrategias de caché:

| Recurso | Estrategia | Descripción |
|---|---|---|
| `/media/*.mp4` | Cache First | Descarga completa antes de reproducir |
| `/api/*` | Network First | Intenta servidor; si falla, responde `{_offline: true}` |
| `index.html`, shell | Cache First | App siempre disponible offline |

**Flujo de precaché:**
1. El cliente obtiene la playlist del servidor
2. Envía mensaje `CACHE_VIDEOS` al SW con las URLs
3. El SW descarga cada video íntegro usando `fetch()` sin streaming parcial
4. Reporta progreso con mensajes `VIDEO_CACHED`
5. El reproductor inicia en paralelo (no espera caché completo)

---

## 🛡️ Resiliencia y manejo de errores

- **Servidor apagado en arranque:** El cliente reintenta cada 10 segundos indefinidamente.
- **Video corrupto o inaccesible:** Salta automáticamente al siguiente video.
- **Pérdida de red durante reproducción:** Usa videos desde Cache API; no muestra errores en pantalla.
- **config.json mal formado:** El servidor devuelve valores por defecto.
- **Logo no encontrado:** Se muestra texto alternativo "MI EMPRESA".

---

## 🔧 Variables de configuración (index.html)

```javascript
const API_BASE       = "";     // Cambiar si el servidor está en otro origen
const SYNC_RETRIES   = 3;      // Reintentos al sincronizar con el servidor
const RETRY_DELAY_MS = 5000;   // Milisegundos entre reintentos
const STATUS_HIDE_MS = 4000;   // Tiempo visible del indicador de estado
```

---

## 📺 Recomendaciones para TCL Android/Google TV

- **Formato de video:** MP4 (H.264 Baseline/Main Profile, AAC audio)
- **Resolución:** 1920×1080 (Full HD) o 3840×2160 (4K si la TV lo soporta)
- **Bitrate:** 8–15 Mbps para 1080p, evita archivos >2GB por video
- **Kiosk mode:** Considera instalar una app launcher que abra el browser automáticamente al encender la TV
- **Pantalla siempre activa:** En Ajustes → Pantalla → Tiempo de apagado → "Nunca"

---

## 🏠 Ejemplo de config.json

```json
{
  "marqueeText": "Bienvenidos — Horario: L-V 8AM-6PM — Tel: (503) 2222-3333",
  "logoUrl": "/media/logo.png"
}
```
