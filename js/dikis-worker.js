/* Panorama birleştirme işçisi (Web Worker).
   Kareler -> ORB öznitelik eşleme -> odak tahmini (homografi) -> küresel (equirectangular) projeksiyon
   -> eğim (roll) + öteleme hizalama -> döngü kapatma -> pozlama eşitleme -> 2 bantlı yumuşak geçiş -> temiz kırpma */
'use strict';
var cv = null, cvP = null;
function cvYukle() {
  if (cvP) return cvP;
  cvP = new Promise(function (res, rej) {
    try { importScripts('../vendor/opencv/opencv.js'); } catch (e) { rej(new Error('OpenCV yüklenemedi: ' + e.message)); return; }
    var c = self.cv;
    if (typeof c === 'function' && !c.Mat) { try { c = c(); } catch (e) {} }
    var bitti = false;
    // Not: Emscripten modülü "then" içerir; Promise'e doğrudan verilirse sonsuz döngüye girer -> sarmalayarak çöz
    var hazir = function (m) { if (bitti) return; if (m && m.Mat && m.ORB) { bitti = true; cv = m; self.cv = m; res({ hazir: true }); } };
    if (c && c.Mat && c.ORB) { hazir(c); return; }
    if (c && typeof c.then === 'function') { try { c.then(function (m) { hazir(m && m.Mat ? m : c); }); } catch (e) {} }
    else if (c) c.onRuntimeInitialized = function () { hazir(c); };
    var n = 0, z = setInterval(function () { n++; var m = self.cv; if (m && m.Mat && m.ORB) { clearInterval(z); hazir(m); } else if (n > 600) { clearInterval(z); if (!bitti) rej(new Error('OpenCV başlatılamadı')); } }, 50);
  });
  return cvP;
}
function ilerle(y, m) { self.postMessage({ tip: 'ilerleme', yuzde: Math.round(y), mesaj: m }); }

self.onmessage = function (e) {
  var d = e.data;
  if (d.tip !== 'dikis') return;
  var t0 = Date.now();
  ilerle(1, 'Hazırlanıyor…');
  cvYukle().then(function () {
    var sonuc = birlestir(d.kareler, d.secenek || {});
    sonuc.sure = Date.now() - t0;
    self.postMessage({ tip: 'sonuc', sonuc: sonuc }, [sonuc.data.buffer]);
  }).catch(function (err) { self.postMessage({ tip: 'hata', mesaj: err && err.message ? err.message : String(err) }); });
};

/* ---------- yardımcılar ---------- */
function medyan(a) { if (!a.length) return NaN; var b = a.slice().sort(function (x, y) { return x - y; }); var m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; }
function sinir(x, a, b) { return x < a ? a : x > b ? b : x; }

function ozellikCikar(k, W, H) {
  var src = cv.matFromImageData({ data: k.data, width: W, height: H });
  var gri = new cv.Mat(); cv.cvtColor(src, gri, cv.COLOR_RGBA2GRAY); src.delete();
  var s = Math.min(1, 1000 / Math.max(W, H));
  var kucuk = new cv.Mat(); cv.resize(gri, kucuk, new cv.Size(Math.round(W * s), Math.round(H * s)), 0, 0, cv.INTER_AREA); gri.delete();
  var clahe = new cv.CLAHE(2.0, new cv.Size(8, 8)); var esit = new cv.Mat(); clahe.apply(kucuk, esit); clahe.delete(); kucuk.delete();
  var orb; try { orb = new cv.ORB(3000, 1.2, 8); } catch (e) { try { orb = new cv.ORB(3000); } catch (e2) { orb = new cv.ORB(); } }
  var kp = new cv.KeyPointVector(), des = new cv.Mat(), maske = new cv.Mat();
  orb.detectAndCompute(esit, maske, kp, des);
  var n = kp.size(), xy = new Float32Array(n * 2);
  for (var i = 0; i < n; i++) { var p = kp.get(i).pt; xy[2 * i] = p.x / s; xy[2 * i + 1] = p.y / s; }
  orb.delete(); kp.delete(); maske.delete(); esit.delete();
  return { xy: xy, des: des, n: n };
}

function eslestir(A, B) {
  var sonuc = { a: [], b: [] };
  if (A.n < 10 || B.n < 10) return sonuc;
  var bf = new cv.BFMatcher(cv.NORM_HAMMING, false), mm = new cv.DMatchVectorVector();
  bf.knnMatch(A.des, B.des, mm, 2);
  var kullanildi = {};
  for (var i = 0; i < mm.size(); i++) {
    var v = mm.get(i); if (v.size() < 2) continue;
    var m0 = v.get(0), m1 = v.get(1);
    if (m0.distance < 0.78 * m1.distance && !kullanildi[m0.trainIdx]) {
      kullanildi[m0.trainIdx] = 1;
      sonuc.a.push(A.xy[2 * m0.queryIdx], A.xy[2 * m0.queryIdx + 1]);
      sonuc.b.push(B.xy[2 * m0.trainIdx], B.xy[2 * m0.trainIdx + 1]);
    }
  }
  bf.delete(); mm.delete();
  return sonuc;
}

// OpenCV detail::focalsFromHomography uyarlaması (merkezlenmiş koordinatlar)
function odakHomografiden(es, cx, cy) {
  var n = es.a.length / 2; if (n < 20) return null;
  var a = new Float32Array(n * 2), b = new Float32Array(n * 2);
  for (var i = 0; i < n; i++) { a[2 * i] = es.a[2 * i] - cx; a[2 * i + 1] = es.a[2 * i + 1] - cy; b[2 * i] = es.b[2 * i] - cx; b[2 * i + 1] = es.b[2 * i + 1] - cy; }
  var mb = cv.matFromArray(n, 1, cv.CV_32FC2, b), ma = cv.matFromArray(n, 1, cv.CV_32FC2, a), ic = new cv.Mat();
  var Hm = cv.findHomography(mb, ma, cv.RANSAC, 3, ic);
  mb.delete(); ma.delete();
  var icSay = 0; for (var j = 0; j < ic.rows; j++) icSay += ic.data[j] ? 1 : 0; ic.delete();
  if (Hm.empty() || icSay < 20) { Hm.delete(); return null; }
  var h = Array.prototype.slice.call(Hm.data64F); Hm.delete();
  var s = h[8] || 1; h = h.map(function (x) { return x / s; });
  function sec(d1, d2, v1, v2) {
    var ok1 = isFinite(v1) && v1 > 0, ok2 = isFinite(v2) && v2 > 0;
    if (ok1 && ok2) return Math.sqrt(Math.abs(d1) > Math.abs(d2) ? v1 : v2);
    if (ok1) return Math.sqrt(v1); if (ok2) return Math.sqrt(v2); return null;
  }
  var d1 = h[6] * h[7], d2 = (h[7] - h[6]) * (h[7] + h[6]);
  var f1 = sec(d1, d2, -(h[0] * h[1] + h[3] * h[4]) / d1, (h[0] * h[0] + h[3] * h[3] - h[1] * h[1] - h[4] * h[4]) / d2);
  d1 = h[0] * h[3] + h[1] * h[4]; d2 = h[0] * h[0] + h[1] * h[1] - h[3] * h[3] - h[4] * h[4];
  var f0 = sec(d1, d2, -h[2] * h[5] / d1, (h[5] * h[5] - h[2] * h[2]) / d2);
  if (f0 && f1) return Math.sqrt(f0 * f1);
  return f0 || f1;
}

// Ham piksel -> küresel (radyan), c = eğim düzeltmesi
function kure(x, y, cx, cy, f, c) {
  var dx = x - cx, dy = y - cy, co = Math.cos(c), si = Math.sin(c);
  var xr = co * dx - si * dy, yr = si * dx + co * dy;
  return [Math.atan2(xr, f), Math.atan2(yr, Math.sqrt(xr * xr + f * f))];
}
function noktalariKure(es, cx, cy, f, ca, cb) {
  var n = es.a.length / 2, A = new Float64Array(n * 2), B = new Float64Array(n * 2);
  for (var i = 0; i < n; i++) {
    var p = kure(es.a[2 * i], es.a[2 * i + 1], cx, cy, f, ca), q = kure(es.b[2 * i], es.b[2 * i + 1], cx, cy, f, cb);
    A[2 * i] = p[0] * f; A[2 * i + 1] = p[1] * f; B[2 * i] = q[0] * f; B[2 * i + 1] = q[1] * f;
  }
  return { A: A, B: B, n: n };
}
// Benzerlik (dönme + öteleme) RANSAC: A ≈ R(al)·B + t
function donmeOteleme(P, esik) {
  var n = P.n, A = P.A, B = P.B; if (n < 8) return null;
  var enIyi = null, enSay = 0, rnd = tohum(n);
  for (var it = 0; it < 400; it++) {
    var i = Math.floor(rnd() * n), j = Math.floor(rnd() * n); if (i === j) continue;
    var vbx = B[2 * j] - B[2 * i], vby = B[2 * j + 1] - B[2 * i + 1], vax = A[2 * j] - A[2 * i], vay = A[2 * j + 1] - A[2 * i + 1];
    if (vbx * vbx + vby * vby < 900) continue;
    var al = Math.atan2(vay, vax) - Math.atan2(vby, vbx); al = Math.atan2(Math.sin(al), Math.cos(al));
    if (Math.abs(al) > 0.25) continue;
    var co = Math.cos(al), si = Math.sin(al);
    var tx = A[2 * i] - (co * B[2 * i] - si * B[2 * i + 1]), ty = A[2 * i + 1] - (si * B[2 * i] + co * B[2 * i + 1]);
    var say = 0;
    for (var k = 0; k < n; k++) { var ex = co * B[2 * k] - si * B[2 * k + 1] + tx - A[2 * k], ey = si * B[2 * k] + co * B[2 * k + 1] + ty - A[2 * k + 1]; if (ex * ex + ey * ey < esik * esik) say++; }
    if (say > enSay) { enSay = say; enIyi = { al: al, tx: tx, ty: ty }; }
  }
  if (!enIyi) return null;
  // içerdekilerle iyileştir (2B Procrustes)
  var ic = [], co2 = Math.cos(enIyi.al), si2 = Math.sin(enIyi.al);
  for (var m = 0; m < n; m++) { var ex2 = co2 * B[2 * m] - si2 * B[2 * m + 1] + enIyi.tx - A[2 * m], ey2 = si2 * B[2 * m] + co2 * B[2 * m + 1] + enIyi.ty - A[2 * m + 1]; if (ex2 * ex2 + ey2 * ey2 < esik * esik) ic.push(m); }
  var max = 0, may = 0, mbx = 0, mby = 0; ic.forEach(function (k) { max += A[2 * k]; may += A[2 * k + 1]; mbx += B[2 * k]; mby += B[2 * k + 1]; });
  max /= ic.length; may /= ic.length; mbx /= ic.length; mby /= ic.length;
  var sc = 0, sd = 0; ic.forEach(function (k) { var bx = B[2 * k] - mbx, by = B[2 * k + 1] - mby, ax = A[2 * k] - max, ay = A[2 * k + 1] - may; sc += bx * ay - by * ax; sd += bx * ax + by * ay; });
  var al2 = Math.atan2(sc, sd), c3 = Math.cos(al2), s3 = Math.sin(al2);
  return { al: al2, tx: max - (c3 * mbx - s3 * mby), ty: may - (s3 * mbx + c3 * mby), ic: ic, oran: ic.length / n };
}
// Sadece öteleme RANSAC: A ≈ B + t
function oteleme(P, esik) {
  var n = P.n, A = P.A, B = P.B; if (n < 8) return null;
  var enIyi = -1, enSay = 0;
  for (var i = 0; i < n; i++) {
    var tx = A[2 * i] - B[2 * i], ty = A[2 * i + 1] - B[2 * i + 1], say = 0;
    for (var k = 0; k < n; k++) { var ex = A[2 * k] - B[2 * k] - tx, ey = A[2 * k + 1] - B[2 * k + 1] - ty; if (ex * ex + ey * ey < esik * esik) say++; }
    if (say > enSay) { enSay = say; enIyi = i; }
  }
  var t0x = A[2 * enIyi] - B[2 * enIyi], t0y = A[2 * enIyi + 1] - B[2 * enIyi + 1], ic = [], sx = 0, sy = 0;
  for (var m = 0; m < n; m++) { var dx = A[2 * m] - B[2 * m], dy = A[2 * m + 1] - B[2 * m + 1]; if ((dx - t0x) * (dx - t0x) + (dy - t0y) * (dy - t0y) < esik * esik) { ic.push(m); sx += dx; sy += dy; } }
  return { tx: sx / ic.length, ty: sy / ic.length, ic: ic, oran: ic.length / n };
}
function tohum(s) { var x = 1234567 + s * 7919; return function () { x = (x * 1103515245 + 12345) & 0x7fffffff; return x / 0x7fffffff; }; }

/* ---------- ana işlem ---------- */
function birlestir(kareler, sec) {
  var n = kareler.length, W = kareler[0].w, H = kareler[0].h, cx = W / 2, cy = H / 2;
  var uyarilar = [], RAD = Math.PI / 180;
  if (n < 2) throw new Error('En az 2 kare gerekli');
  var uzunFov = (sec.uzunKenarFov || 64) * RAD;
  var fTahmin = (Math.max(W, H) / 2) / Math.tan(uzunFov / 2);

  // 1) öznitelikler
  var oz = [];
  for (var i = 0; i < n; i++) { oz.push(ozellikCikar(kareler[i], W, H)); ilerle(3 + 37 * (i + 1) / n, 'Kareler inceleniyor (' + (i + 1) + '/' + n + ')…'); }

  // 2) eşleşmeler: ardışık + kapanış (son -> ilk)
  var cift = [];
  for (var k = 0; k < n - 1; k++) cift.push({ a: k, b: k + 1, es: eslestir(oz[k], oz[k + 1]) });
  var yawToplam = null;
  if (kareler.every(function (x) { return typeof x.yaw === 'number'; })) {
    yawToplam = 0; for (var y = 1; y < n; y++) { var dyw = kareler[y].yaw - kareler[y - 1].yaw; dyw = ((dyw + 540) % 360) - 180; yawToplam += Math.abs(dyw); }
  }
  var kapanis = n >= 5 ? { a: n - 1, b: 0, es: eslestir(oz[n - 1], oz[0]) } : null;
  oz.forEach(function (o) { o.des.delete(); });
  ilerle(48, 'Kareler eşleştiriliyor…');

  // 3) odak tahmini
  var odaklar = [];
  cift.forEach(function (c) { var fh = odakHomografiden(c.es, cx, cy); if (fh && fh > fTahmin * 0.5 && fh < fTahmin * 2) odaklar.push(fh); });
  var f = fTahmin, odakKaynak = 'tahmin';
  if (odaklar.length >= 2 || (odaklar.length === 1 && n === 2)) { f = medyan(odaklar); odakKaynak = 'homografi'; }
  else if (yawToplam && n > 1) {
    // cihaz yönünden: ardışık karelerde ortalama yatay kayma / yaw farkı
    var oranlar = [];
    cift.forEach(function (c) {
      var dx = []; for (var q = 0; q < c.es.a.length; q += 2) dx.push(c.es.a[q] - c.es.b[q]);
      var dyaw = Math.abs(((kareler[c.b].yaw - kareler[c.a].yaw + 540) % 360) - 180) * RAD;
      if (dx.length > 15 && dyaw > 0.1) oranlar.push(medyan(dx) / Math.tan(dyaw));
    });
    var fy = medyan(oranlar); if (fy > fTahmin * 0.5 && fy < fTahmin * 2) { f = fy; odakKaynak = 'yon'; }
  }

  // 4) hizalama (odak döngüsel iyileştirme ile)
  var esik = 3.0, poz, dongu = false;
  for (var tur = 0; tur < 3; tur++) {
    poz = hizala(cift, kapanis, kareler, f, cx, cy, esik, uyarilar, yawToplam, tur === 0);
    dongu = poz.dongu;
    if (!dongu || Math.abs(poz.toplam - 2 * Math.PI) < 0.01) break;
    f = f * poz.toplam / (2 * Math.PI); odakKaynak += '+dongu';
  }
  ilerle(55, 'Hizalandı, görüntü oluşturuluyor…');

  // 5) pozlama kazançları (eşleşen noktaların renklerinden)
  var kazanc = pozlamaKazanci(cift, kapanis && dongu ? kapanis : null, kareler, W, H, poz);

  // 6) çıktı boyutu
  var maxGen = sec.maxGen || 6000;
  var sinirlar = kareler.map(function (_, i) { return kareSinir(W, H, cx, cy, f, poz.c[i]); });
  var thMin = Infinity, thMax = -Infinity, phMin = Infinity, phMax = -Infinity;
  for (var s = 0; s < n; s++) {
    thMin = Math.min(thMin, poz.th[s] + sinirlar[s].t0); thMax = Math.max(thMax, poz.th[s] + sinirlar[s].t1);
    phMin = Math.min(phMin, poz.ph[s] + sinirlar[s].p0); phMax = Math.max(phMax, poz.ph[s] + sinirlar[s].p1);
  }
  var fo, Wout, orijin;
  if (dongu) { fo = Math.min(f, maxGen / (2 * Math.PI)); Wout = Math.round(2 * Math.PI * fo); orijin = thMin; }
  else { fo = Math.min(f, maxGen / (thMax - thMin)); Wout = Math.ceil((thMax - thMin) * fo); orijin = thMin; }
  var Hout = Math.ceil((phMax - phMin) * fo);
  var maxPiksel = sec.maxPiksel || 16e6; // iOS Safari tuval/bellek sınırı
  if (Wout * Hout > maxPiksel) { var oran = Math.sqrt(maxPiksel / (Wout * Hout)); fo *= oran; Wout = dongu ? Math.round(2 * Math.PI * fo) : Math.ceil((thMax - thMin) * fo); Hout = Math.ceil((phMax - phMin) * fo); }
  var out = new Uint8ClampedArray(Wout * Hout * 4);

  // 7) çizim + harmanlama
  for (var r = 0; r < n; r++) {
    ciz(out, Wout, Hout, kareler[r], W, H, cx, cy, f, fo, poz, r, orijin, phMin, kazanc[r], dongu, sinirlar);
    ilerle(55 + 38 * (r + 1) / n, 'Birleştiriliyor (' + (r + 1) + '/' + n + ')…');
  }

  // 8) kırpma
  var kr = kirp(out, Wout, Hout, dongu);
  var cw = kr.x1 - kr.x0, ch = kr.y1 - kr.y0, son = new Uint8ClampedArray(cw * ch * 4);
  for (var yy = 0; yy < ch; yy++) son.set(out.subarray(((yy + kr.y0) * Wout + kr.x0) * 4, ((yy + kr.y0) * Wout + kr.x1) * 4), yy * cw * 4);
  for (var a4 = 3; a4 < son.length; a4 += 4) son[a4] = 255;
  // ufuk: kareler ortalama düz tutulduysa ph ortalaması; cihaz eğimi varsa onu kullan
  var ufuk = 0, say = 0;
  for (var u = 0; u < n; u++) { var p = typeof kareler[u].pitch === 'number' ? kareler[u].pitch * RAD : 0; ufuk += poz.ph[u] + p; say++; }
  ufuk /= say;
  var merkezPh = phMin + (kr.y0 + ch / 2) / fo;
  ilerle(100, 'Tamamlandı');
  return {
    w: cw, h: ch, data: son, dongu: dongu,
    haov: dongu ? 360 : Math.min(360, cw / fo / RAD), vaov: Math.min(180, ch / fo / RAD), vOffset: -(merkezPh - ufuk) / RAD,
    odak: f, odakKaynak: odakKaynak, uyarilar: uyarilar, kareSayisi: n, basarisizCift: poz.basarisiz
  };
}

function hizala(cift, kapanis, kareler, f, cx, cy, esik, uyarilar, yawToplam, uyar) {
  var n = kareler.length, RAD = Math.PI / 180;
  // a) eğim (roll) farkları
  var c = [0], al = [];
  cift.forEach(function (p, i) {
    var r = donmeOteleme(noktalariKure(p.es, cx, cy, f, 0, 0), esik * 1.5);
    al.push(r && r.ic.length >= 12 ? r.al : 0);
    c.push(c[i] + al[i]);
  });
  var kapR = null;
  if (kapanis && yawToplam !== null && yawToplam < 250) kapanis = null;   // cihaz 250°'den az dönüş diyorsa döngü arama
  if (kapanis) { kapR = donmeOteleme(noktalariKure(kapanis.es, cx, cy, f, 0, 0), esik * 1.5); if (kapR && kapR.ic.length < 15) kapR = null; }
  if (kapR) { var art = c[n - 1] + kapR.al; for (var i = 0; i < n; i++) c[i] -= art * i / n; }
  var ort = c.reduce(function (s, x) { return s + x; }, 0) / n; c = c.map(function (x) { return x - ort; });

  // b) öteleme (eğim düzeltilmiş)
  var th = [0], ph = [0], basarisiz = 0, dxler = [];
  var sonuclar = cift.map(function (p) { var r = oteleme(noktalariKure(p.es, cx, cy, f, c[p.a], c[p.b]), esik); return r && r.ic.length >= 12 && r.oran > 0.15 ? r : null; });
  sonuclar.forEach(function (r) { if (r) dxler.push(r.tx / f); });
  var ortDx = dxler.length ? medyan(dxler) : 30 * RAD;
  sonuclar.forEach(function (r, i) {
    var dth, dph;
    if (r) { dth = r.tx / f; dph = r.ty / f; }
    else {
      basarisiz++;
      var yk = kareler[i + 1], yo = kareler[i];
      dth = (typeof yk.yaw === 'number' && typeof yo.yaw === 'number') ? Math.abs(((yk.yaw - yo.yaw + 540) % 360) - 180) * RAD : ortDx;
      dph = 0;
    }
    th.push(th[i] + dth); ph.push(ph[i] + dph);
  });
  if (basarisiz && uyar) uyarilar.push(basarisiz + ' kare çiftinde yeterli ortak nokta bulunamadı; bu geçişler telefonun yön sensörüne göre yerleştirildi, ek yeri belli olabilir.');

  // c) döngü kapatma
  var dongu = false, toplam = th[n - 1];
  if (kapanis) {
    var kr = oteleme(noktalariKure(kapanis.es, cx, cy, f, c[n - 1], c[0]), esik);
    if (kr && kr.ic.length >= 15 && kr.oran > 0.15) {
      var tum = th[n - 1] + kr.tx / f;
      if (tum > 2 * Math.PI * 0.8 && tum < 2 * Math.PI * 1.25) {
        dongu = true; toplam = tum;
        var s = 2 * Math.PI / tum, rph = ph[n - 1] + kr.ty / f;
        for (var j = 0; j < n; j++) { th[j] *= s; ph[j] -= rph * j / n; }
      }
    }
  }
  // d) dalga düzeltme (dönme ekseni eğikse oluşan eğri)
  if (n >= 3) {
    if (dongu) {
      var sa = 0, sb = 0; for (var k = 0; k < n; k++) { sa += ph[k] * Math.sin(th[k]); sb += ph[k] * Math.cos(th[k]); }
      sa *= 2 / n; sb *= 2 / n; for (var m = 0; m < n; m++) ph[m] -= sa * Math.sin(th[m]) + sb * Math.cos(th[m]);
    } else {
      var mt = 0, mp = 0; for (var q = 0; q < n; q++) { mt += th[q]; mp += ph[q]; } mt /= n; mp /= n;
      var num = 0, den = 0; for (var w = 0; w < n; w++) { num += (th[w] - mt) * (ph[w] - mp); den += (th[w] - mt) * (th[w] - mt); }
      var egim = den > 1e-9 ? num / den : 0; if (Math.abs(egim) < 0.35) for (var z = 0; z < n; z++) ph[z] -= egim * (th[z] - mt);
    }
  }
  return { c: c, th: th, ph: ph, dongu: dongu, toplam: toplam, basarisiz: basarisiz, sonuclar: sonuclar };
}

function pozlamaKazanci(cift, kapanis, kareler, W, H, poz) {
  var n = kareler.length, logG = [[0, 0, 0]];
  function ornek(k, x, y) {
    var d = kareler[k].data, r = 0, g = 0, b = 0, s = 0;
    for (var yy = -2; yy <= 2; yy++) for (var xx = -2; xx <= 2; xx++) {
      var px = sinir(Math.round(x) + xx, 0, W - 1), py = sinir(Math.round(y) + yy, 0, H - 1), o = (py * W + px) * 4;
      r += d[o]; g += d[o + 1]; b += d[o + 2]; s++;
    }
    return [r / s, g / s, b / s];
  }
  function oran(p) {
    var sa = [0, 0, 0], sb = [0, 0, 0], m = Math.min(p.es.a.length / 2, 600);
    for (var i = 0; i < m; i++) {
      var A = ornek(p.a, p.es.a[2 * i], p.es.a[2 * i + 1]), B = ornek(p.b, p.es.b[2 * i], p.es.b[2 * i + 1]);
      for (var ch = 0; ch < 3; ch++) { sa[ch] += A[ch]; sb[ch] += B[ch]; }
    }
    return sa.map(function (v, ch) { return m > 10 && sb[ch] > 0 ? sinir(Math.log(v / sb[ch]), -0.7, 0.7) : 0; });
  }
  cift.forEach(function (p, i) { var o = oran(p); logG.push(logG[i].map(function (v, ch) { return v + o[ch]; })); });
  if (kapanis) { var ok = oran(kapanis); for (var ch = 0; ch < 3; ch++) { var art = logG[n - 1][ch] + ok[ch]; for (var i = 0; i < n; i++) logG[i][ch] -= art * i / n; } }
  var ort = [0, 1, 2].map(function (ch) { return logG.reduce(function (s, g) { return s + g[ch]; }, 0) / n; });
  return logG.map(function (g) { return g.map(function (v, ch) { return Math.exp(v - ort[ch]); }); });
}

function kareSinir(W, H, cx, cy, f, c) {
  var t0 = Infinity, t1 = -Infinity, p0 = Infinity, p1 = -Infinity;
  for (var i = 0; i <= 40; i++) {
    var u = i / 40, pts = [[u * W, 0], [u * W, H], [0, u * H], [W, u * H]];
    pts.forEach(function (p) { var s = kure(p[0], p[1], cx, cy, f, c); t0 = Math.min(t0, s[0]); t1 = Math.max(t1, s[0]); p0 = Math.min(p0, s[1]); p1 = Math.max(p1, s[1]); });
  }
  var ic = kure(0, cy, cx, cy, f, 0), dis = kure(W, cy, cx, cy, f, 0);
  return { t0: t0, t1: t1, p0: p0, p1: p1, sol: ic[0], sag: dis[0] };
}

// Maskeli kutu bulanıklaştırma (düşük frekans bandı için)
function kutuBulanik(src, w, h, r) {
  var tmp = new Float32Array(w * h), dst = new Float32Array(w * h), x, y, acc;
  for (y = 0; y < h; y++) {
    var o = y * w; acc = 0;
    for (x = -r; x <= r; x++) acc += src[o + sinir(x, 0, w - 1)];
    for (x = 0; x < w; x++) { tmp[o + x] = acc; acc += src[o + Math.min(x + r + 1, w - 1)] - src[o + Math.max(x - r, 0)]; }
  }
  for (x = 0; x < w; x++) {
    acc = 0;
    for (y = -r; y <= r; y++) acc += tmp[sinir(y, 0, h - 1) * w + x];
    for (y = 0; y < h; y++) { dst[y * w + x] = acc; acc += tmp[Math.min(y + r + 1, h - 1) * w + x] - tmp[Math.max(y - r, 0) * w + x]; }
  }
  return dst;
}

function ciz(out, Wout, Hout, kare, W, H, cx, cy, f, fo, poz, k, orijin, phMin, g, dongu, sinirlar) {
  var n = poz.th.length, sn = sinirlar[k], c = poz.c[k], co = Math.cos(c), si = Math.sin(c);
  var u0 = Math.floor((poz.th[k] + sn.t0 - orijin) * fo) - 2, u1 = Math.ceil((poz.th[k] + sn.t1 - orijin) * fo) + 2;
  var v0 = Math.max(0, Math.floor((poz.ph[k] + sn.p0 - phMin) * fo) - 2), v1 = Math.min(Hout, Math.ceil((poz.ph[k] + sn.p1 - phMin) * fo) + 2);
  var fw = u1 - u0, fh = v1 - v0; if (fw <= 0 || fh <= 0) return;
  var mx = new cv.Mat(fh, fw, cv.CV_32FC1), my = new cv.Mat(fh, fw, cv.CV_32FC1), ax = mx.data32F, ay = my.data32F;
  for (var v = 0; v < fh; v++) {
    var phi = (v + v0) / fo + phMin - poz.ph[k], sp = Math.sin(phi), cp = Math.cos(phi);
    for (var u = 0; u < fw; u++) {
      var th = (u + u0) / fo + orijin - poz.th[k], X = Math.sin(th) * cp, Z = Math.cos(th) * cp, i = v * fw + u;
      if (Z <= 0.05) { ax[i] = -10; ay[i] = -10; continue; }
      var xr = f * X / Z, yr = f * sp / Z;
      ax[i] = cx + co * xr + si * yr; ay[i] = cy - si * xr + co * yr;
    }
  }
  var src = cv.matFromImageData({ data: kare.data, width: W, height: H }), dst = new cv.Mat();
  cv.remap(src, dst, mx, my, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar(0, 0, 0, 0));
  src.delete(); mx.delete(); my.delete();
  var B = dst.data; // RGBA, fw x fh

  // geçiş bölgeleri (sütun, açılmış koordinat)
  var Lsol = -Infinity, Rsol = -Infinity, Lsag = Infinity, Rsag = Infinity;
  if (k > 0) { Lsol = (poz.th[k] + sn.sol - orijin) * fo; Rsol = (poz.th[k - 1] + sinirlar[k - 1].sag - orijin) * fo; }
  if (dongu && k === n - 1) { Lsag = (poz.th[0] + sinirlar[0].sol - orijin) * fo + Wout; Rsag = (poz.th[k] + sn.sag - orijin) * fo; }
  var r = Math.max(4, Math.round(fo * 0.012));

  function bolge(bas, son, ters) {
    var a0 = Math.max(u0, Math.floor(bas)), a1 = Math.min(u1, Math.ceil(son)); if (a1 - a0 < 3) return [a0, a0];
    var w = a1 - a0, N = w * fh, ch, j, x, y;
    var Am = new Float32Array(N), Bm = new Float32Array(N), Ac = [], Bc = [];
    for (ch = 0; ch < 3; ch++) { Ac.push(new Float32Array(N)); Bc.push(new Float32Array(N)); }
    for (y = 0; y < fh; y++) for (x = 0; x < w; x++) {
      j = y * w + x; var uo = ((x + a0) % Wout + Wout) % Wout, oo = ((y + v0) * Wout + uo) * 4, bo = (y * fw + (x + a0 - u0)) * 4;
      Am[j] = out[oo + 3] > 250 ? 1 : 0; Bm[j] = B[bo + 3] > 250 ? 1 : 0;
      for (ch = 0; ch < 3; ch++) { Ac[ch][j] = out[oo + ch] * Am[j]; Bc[ch][j] = Math.min(255, B[bo + ch] * g[ch]) * Bm[j]; }
    }
    var bAm = kutuBulanik(Am, w, fh, r), bBm = kutuBulanik(Bm, w, fh, r), lA = [], lB = [];
    for (ch = 0; ch < 3; ch++) { lA.push(kutuBulanik(Ac[ch], w, fh, r)); lB.push(kutuBulanik(Bc[ch], w, fh, r)); }
    var mid = (bas + son) / 2, dar = Math.max(6, (son - bas) * 0.2);
    for (y = 0; y < fh; y++) for (x = 0; x < w; x++) {
      j = y * w + x; var ux = x + a0; if (!Bm[j]) continue;
      var uo2 = ((ux % Wout) + Wout) % Wout, o2 = ((y + v0) * Wout + uo2) * 4;
      if (!Am[j]) { for (ch = 0; ch < 3; ch++) out[o2 + ch] = Bc[ch][j]; out[o2 + 3] = 255; continue; }
      var gen = sinir((ux - bas) / (son - bas), 0, 1), d = sinir((ux - (mid - dar / 2)) / dar, 0, 1);
      if (ters) { gen = 1 - gen; d = 1 - d; }
      for (ch = 0; ch < 3; ch++) {
        var la = lA[ch][j] / Math.max(bAm[j], 1e-3), lb = lB[ch][j] / Math.max(bBm[j], 1e-3);
        var dusuk = (1 - gen) * la + gen * lb, yuksek = (1 - d) * (Ac[ch][j] - la) + d * (Bc[ch][j] - lb);
        out[o2 + ch] = dusuk + yuksek;
      }
      out[o2 + 3] = 255;
    }
    return [a0, a1];
  }
  var sol = Rsol > Lsol ? bolge(Lsol, Rsol, false) : [u0, u0];
  var sag = Rsag > Lsag ? bolge(Lsag, Rsag, true) : [u1, u1];
  // geri kalan: doğrudan yaz (önceki karelerin üstüne yazmadan, sadece boş veya bu karenin ana bölgesi)
  for (var yy = 0; yy < fh; yy++) {
    for (var xx = u0; xx < u1; xx++) {
      if ((xx >= sol[0] && xx < sol[1]) || (xx >= sag[0] && xx < sag[1])) continue;
      var bo2 = (yy * fw + (xx - u0)) * 4; if (B[bo2 + 3] <= 250) continue;
      var uo3 = ((xx % Wout) + Wout) % Wout, o3 = ((yy + v0) * Wout + uo3) * 4;
      if (out[o3 + 3] > 250 && xx < sol[0]) continue; // soldaki önceki kareye dokunma
      out[o3] = Math.min(255, B[bo2] * g[0]); out[o3 + 1] = Math.min(255, B[bo2 + 1] * g[1]); out[o3 + 2] = Math.min(255, B[bo2 + 2] * g[2]); out[o3 + 3] = 255;
    }
  }
  dst.delete();
}

function kirp(out, W, H, dongu) {
  var ust = new Int32Array(W), alt = new Int32Array(W), x, y;
  for (x = 0; x < W; x++) {
    var t = -1, b = -1;
    for (y = 0; y < H; y++) if (out[(y * W + x) * 4 + 3] > 250) { t = y; break; }
    for (y = H - 1; y >= 0; y--) if (out[(y * W + x) * 4 + 3] > 250) { b = y + 1; break; }
    ust[x] = t; alt[x] = b;
  }
  var x0 = 0, x1 = W;
  if (!dongu) {
    var aciklik = []; for (x = 0; x < W; x++) aciklik.push(ust[x] < 0 ? 0 : alt[x] - ust[x]);
    var m = medyan(aciklik.filter(function (a) { return a > 0; }));
    while (x0 < W && aciklik[x0] < 0.9 * m) x0++;
    while (x1 > x0 && aciklik[x1 - 1] < 0.9 * m) x1--;
  }
  var y0 = 0, y1 = H;
  for (x = x0; x < x1; x++) { if (ust[x] >= 0) { y0 = Math.max(y0, ust[x]); y1 = Math.min(y1, alt[x]); } }
  // iç boşluk kontrolü: tamamen dolu satır aralığına daralt
  var dolu = function (yy) { for (var xx = x0; xx < x1; xx += 3) if (out[(yy * W + xx) * 4 + 3] <= 250) return false; return true; };
  while (y0 < y1 && !dolu(y0)) y0++;
  while (y1 > y0 && !dolu(y1 - 1)) y1--;
  if (y1 - y0 < 20 || x1 - x0 < 20) { x0 = 0; x1 = W; y0 = 0; y1 = H; }
  return { x0: x0, x1: x1, y0: y0, y1: y1 };
}
