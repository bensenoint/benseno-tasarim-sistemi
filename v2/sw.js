/* Benseno v2 — network-first service worker.
   Amaç: yüklenebilir PWA + çevrimdışı app-shell. Canlı veri bayatlamasın diye
   her zaman önce ağ denenir; ağ yoksa cache'ten döner. Sadece same-origin GET. */
const CACHE = 'benseno-v2-shell';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Sadece kendi origin'imiz (API/font/CDN'e dokunma)
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(req)
      .then(res => {
        // Başarılı yanıtı app-shell cache'ine yaz
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then(hit => hit || caches.match('./'))
      )
  );
});
