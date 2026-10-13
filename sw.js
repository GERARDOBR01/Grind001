/* Service worker: la app funciona sin internet.
   Archivos de la app: primero la red (para recibir actualizaciones), si falla, la copia guardada.
   Detector de pose (vendor/): primero la copia guardada (pesa ~15 MB y no cambia). */
const V = 'serie-v2';
const SHELL = ['./', './index.html', './manifest.webmanifest', './js/foods.js', './js/nutri.js', './js/poses.js', './js/movil.js',
  './icons/icon-192.png', './icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;       // Open Food Facts y demás: directo a la red
  if (u.pathname.includes('/vendor/')){
    e.respondWith(caches.open(V).then(c => c.match(e.request).then(r => r || fetch(e.request).then(res => { if (res.ok) c.put(e.request, res.clone()); return res; }))));
    return;
  }
  e.respondWith(fetch(e.request).then(res => { if (res.ok){ const cp = res.clone(); caches.open(V).then(c => c.put(e.request, cp)); } return res; })
    .catch(() => caches.match(e.request, {ignoreSearch:true}).then(r => r || caches.match('./index.html'))));
});
