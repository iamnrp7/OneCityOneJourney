const V = 'journey-v5', F = ['./', 'index.html', 'style.css', 'app.js', 'lib/metro.js', 'lib/journey.js', ...['stations', 'timetable_trips', 'bus_near_metro', 'bus_departures_near_metro', 'brts_fares', 'service_rules', 'bus_routes', 'bus_stops', 'bus_route_stops', 'bus_stop_routes'].map(n => `data/${n}.json`)];
self.addEventListener('install', e => e.waitUntil(caches.open(V).then(c => c.addAll(F)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x)))).then(() => clients.claim())));
// network-first (fresh when online), cache fallback (works in airplane mode)
self.addEventListener('fetch', e => { if (e.request.method !== 'GET') return; e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(V).then(x => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request, { ignoreSearch: true }))); });
