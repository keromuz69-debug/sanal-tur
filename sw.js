/* Çevrimdışı destek: uygulama dosyaları ağdan (yoksa önbellekten), kütüphaneler (vendor/) önbellekten.
   Böylece çekim ve birleştirme, bir kez açıldıktan sonra zayıf/olmayan internette de çalışır. */
var SURUM = 'sanaltur-v17';
var CEKIRDEK = ['./', 'index.html', 'cek.html', 'tur.html', 'css/style.css', 'js/common.js', 'js/depo.js', 'js/panorama.js', 'js/cek.js', 'js/cekim.js', 'js/dikis.js', 'js/dikis-worker.js', 'js/tur.js',
  'vendor/pannellum/pannellum.js', 'vendor/pannellum/pannellum.css', 'vendor/jszip/jszip.min.js', 'manifest.webmanifest', 'img/ikon-180.png'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(SURUM).then(function (c) { return c.addAll(CEKIRDEK).catch(function () {}); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (l) { return Promise.all(l.filter(function (k) { return k !== SURUM; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || r.headers.has('range')) return;
  if (/\/tours\/.*\.(jpe?g|png|webp)$/i.test(u.pathname)) return; // büyük ilan görselleri önbelleğe alınmaz (telefon hafızası taslaklara kalsın)
  if (/\/vendor\//.test(u.pathname)) { // sürümlü kütüphaneler: önce önbellek
    e.respondWith(caches.open(SURUM).then(function (c) {
      return c.match(r, { ignoreSearch: true }).then(function (m) {
        return m || fetch(r).then(function (y) { if (y.ok) c.put(r, y.clone()); return y; });
      });
    }));
    return;
  }
  e.respondWith(fetch(r).then(function (y) { // önce ağ, olmazsa önbellek
    if (y.ok) { var k = y.clone(); caches.open(SURUM).then(function (c) { c.put(r, k); }); }
    return y;
  }).catch(function () { return caches.match(r, { ignoreSearch: true }).then(function (m) { return m || caches.match('index.html'); }); }));
});
