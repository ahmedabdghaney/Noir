// نوار سينما — minimal same-origin shell cache for installed PWA mode.

const CACHE_NAME = 'noir-v2';

// ملفات نحفظها للتشغيل بدون إنترنت (الواجهة فقط، مو الفيديوهات)
const PRECACHE = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE).catch(() => {}))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Never intercept writes or third-party media, auth, font, and API traffic.
  if (e.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) {
    return;
  }

  // باقي الطلبات: شبكة أولاً، وإذا فشلت نرجع من الكاش
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        // نحدّث الكاش بالنسخة الجديدة بشكل صامت
        if (res.ok && e.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((cached) => cached || Response.error()))
  );
});
