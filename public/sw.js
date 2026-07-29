/* ============================================================
   Caspian Race Control — Service Worker (elle, bağımlılıksız)
   Amaç: pit-wall'ın çevrimdışı/kararsız bağlantıda da açılması.
   - App shell + statik varlıklar: cache-first (talep üzerine cache'lenir)
   - Gezinme (SPA): network-first, düşerse cache'lenmiş index.html
   - Firebase / Google (cross-origin): dokunulmaz, her zaman ağdan
   Sürüm değişince CACHE adını artır → eski cache temizlenir.
   ============================================================ */
const CACHE = "crc-v2";
const APP_SHELL = ["./", "./index.html", "./favicon.png", "./favicon.svg", "./manifest.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(APP_SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;                 // yalnız okuma isteklerini önbellekle
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;  // firebase/google → ağa bırak

  if (req.mode === "navigate") {                    // SPA gezinme: ağ önce
    e.respondWith(fetch(req).catch(() => caches.match("./index.html")));
    return;
  }

  // statik varlıklar: cache önce, yoksa ağdan al + cache'le.
  // ÖNEMLİ: JS/CSS gibi varlık istekleri BAŞARISIZ olursa index.html (HTML)
  // DÖNDÜRÜLMEZ — aksi halde dinamik import "text/html is not a valid MIME"
  // hatası verir. Yalnız gezinme (navigate) index.html'e düşer (yukarıda).
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res && res.ok && res.type === "basic") {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    }).catch(() => Response.error())),
  );
});
