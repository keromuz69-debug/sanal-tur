/* Panorama işleme, görüntüleyici ayarları, otomatik geçiş okları ve ZIP dışa aktarma (ortak) */
(function (w) {
  'use strict';
  var VARSAYILAN_DIKEY = 65;   // telefon panoramasının dikey görüş açısı (derece, tahmini)
  var MAKS_KURE = 4096, MAKS_GENIS = 6000, KALITE = 0.85;

  function xmpOku(file) {
    var parca = file.slice(0, 512 * 1024);
    var p = parca.arrayBuffer ? parca.arrayBuffer() : new Response(parca).arrayBuffer();
    return p.then(function (buf) {
      var t = new TextDecoder('latin1').decode(buf);
      var al = function (ad) {
        var m = t.match(new RegExp('GPano:' + ad + '\\s*=\\s*"([^"]+)"')) || t.match(new RegExp('<GPano:' + ad + '>([^<]+)<'));
        return m ? m[1] : null;
      };
      var proj = al('ProjectionType');
      if (!proj) return null;
      return {
        proj: proj.toLowerCase(),
        tamG: +al('FullPanoWidthPixels') || 0, tamY: +al('FullPanoHeightPixels') || 0,
        kesG: +al('CroppedAreaImageWidthPixels') || 0, kesY: +al('CroppedAreaImageHeightPixels') || 0,
        ust: +al('CroppedAreaTopPixels') || 0
      };
    }).catch(function () { return null; });
  }

  // Görselin türünü ve açılarını tahmin et
  function analiz(gen, yuk, xmp, dikeyAci) {
    var oran = gen / yuk;
    if (xmp && xmp.proj === 'equirectangular' && xmp.tamG && xmp.kesG) {
      var haov = Math.min(360, 360 * xmp.kesG / xmp.tamG), vaov = Math.min(180, 180 * xmp.kesY / (xmp.tamY || xmp.tamG / 2));
      var vOffset = 90 - (180 * (xmp.ust + xmp.kesY / 2) / (xmp.tamY || xmp.tamG / 2));
      if (haov > 355 && vaov > 175) return { tur: 'kure', haov: 360, vaov: 180, vOffset: 0, kaynak: 'xmp' };
      return { tur: 'genis', haov: r1(haov), vaov: r1(vaov), vOffset: r1(vOffset), kaynak: 'xmp' };
    }
    if (Math.abs(oran - 2) < 0.06) return { tur: 'kure', haov: 360, vaov: 180, vOffset: 0, kaynak: 'oran' };
    var d = dikeyAci || VARSAYILAN_DIKEY;
    if (oran < 1.3) d = Math.min(d, 60); // neredeyse kare foto: normal fotoğraf
    var h = Math.min(360, oran * d);
    if (h > 345) h = 360;
    return { tur: 'genis', haov: r1(h), vaov: d, vOffset: 0, kaynak: 'tahmin' };
  }
  function r1(x) { return Math.round(x * 10) / 10; }

  function resimYukle(file) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () { res({ img: img, url: url }); };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('Görsel açılamadı (desteklenmeyen biçim olabilir; HEIC ise telefonda "En Uyumlu" ayarını seçin)')); };
      img.src = url;
    });
  }
  function ciz(img, sx, sy, sw, sh, dw, dh, q) {
    var c = document.createElement('canvas'); c.width = dw; c.height = dh;
    var x = c.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);
    return new Promise(function (res, rej) { c.toBlob(function (b) { c.width = c.height = 0; b ? res(b) : rej(new Error('Sıkıştırma başarısız')); }, 'image/jpeg', q); });
  }

  // Dosyayı telefonda sıkıştırır; {blob, kucuk, gen, yuk, tur, haov, vaov, vOffset, uyari}
  function isle(file, secenek) {
    secenek = secenek || {};
    return Promise.all([xmpOku(file), resimYukle(file)]).then(function (r) {
      var xmp = r[0], img = r[1].img, G = img.naturalWidth, Y = img.naturalHeight;
      var a = analiz(G, Y, xmp, secenek.dikeyAci);
      if (secenek.zorlaTur === 'kure') a = { tur: 'kure', haov: 360, vaov: 180, vOffset: 0, kaynak: 'elle' };
      if (secenek.zorlaTur === 'genis' && a.tur === 'kure') {
        var d = secenek.dikeyAci || VARSAYILAN_DIKEY, h = Math.min(360, (G / Y) * d);
        a = { tur: 'genis', haov: r1(h > 345 ? 360 : h), vaov: d, vOffset: 0, kaynak: 'elle' };
      }
      var maks = a.tur === 'kure' ? MAKS_KURE : MAKS_GENIS;
      var dg = Math.min(G, maks), dy = Math.round(dg * Y / G);
      var uyari = '';
      if (a.tur === 'genis' && a.haov < 100) uyari = 'Bu fotoğraf dar görünüyor (yaklaşık ' + Math.round(a.haov) + '°). Daha iyi sonuç için telefonda Panorama modunda odanın etrafında dönerek çekin.';
      return Promise.all([
        ciz(img, 0, 0, G, Y, dg, dy, KALITE),
        kucukResim(img, G, Y)
      ]).then(function (b) {
        URL.revokeObjectURL(r[1].url);
        return { blob: b[0], kucuk: b[1], gen: dg, yuk: dy, tur: a.tur, haov: a.haov, vaov: a.vaov, vOffset: a.vOffset, kaynak: a.kaynak, uyari: uyari };
      });
    });
  }
  function kucukResim(img, G, Y) { // ortadan 2:1 kesit, 480x240
    var hedefOran = 2, sw = G, sh = Y;
    if (G / Y > hedefOran) sw = Y * hedefOran; else sh = G / hedefOran;
    return ciz(img, (G - sw) / 2, (Y - sh) / 2, sw, sh, 480, 240, 0.78);
  }

  // property.json sahnesi -> Pannellum sahne ayarı
  function sahneAyari(s, panoramaUrl) {
    var c = { type: 'equirectangular', panorama: panoramaUrl, yaw: s.yaw || 0, pitch: s.pitch || 0, hfov: s.hfov || 100 };
    var haov = +s.haov || 360, vaov = +s.vaov || 180;
    if (s.tur === 'genis' || haov < 360 || vaov < 180) {
      var vo = +s.vOffset || 0;
      c.haov = haov; c.vaov = vaov; c.vOffset = vo;
      c.minPitch = vo - vaov / 2; c.maxPitch = vo + vaov / 2;
      if (haov < 360) { c.minYaw = -haov / 2; c.maxYaw = haov / 2; c.yaw = Math.max(c.minYaw, Math.min(c.maxYaw, c.yaw)); }
      c.pitch = Math.max(c.minPitch, Math.min(c.maxPitch, c.pitch));
      c.hfov = Math.min(c.hfov, haov, 100);
      c.maxHfov = Math.min(110, haov);
      c.minHfov = 30;
      c.backgroundColor = [0.08, 0.1, 0.14];
      c.avoidShowingBackground = true; // görünüm, panoramanın dışına (boş alana) taşmasın
    }
    return c;
  }

  // Oda sırasına göre otomatik ileri/geri okları
  function varsayilanOk(s, yon) {
    var genis = s.tur === 'genis' || (+s.haov || 360) < 360;
    var haov = +s.haov || 360, vaov = +s.vaov || 180;
    var p = genis ? -(vaov / 2) * 0.45 : -18;
    if (haov >= 360) return { yaw: yon === 'ileri' ? (s.yaw || 0) : norm((s.yaw || 0) + 180), pitch: p };
    return { yaw: (yon === 'ileri' ? 1 : -1) * haov / 2 * 0.72, pitch: p };
  }
  function norm(y) { while (y > 180) y -= 360; while (y < -180) y += 360; return y; }
  function okluNoktalar(sahneler, i, okAdlari) {
    var s = sahneler[i], n = [];
    okAdlari = okAdlari || {};
    if (sahneler[i + 1]) { var a = (s.ok && s.ok.ileri) || varsayilanOk(s, 'ileri'); n.push({ tip: 'gecis', hedef: sahneler[i + 1].id, yaw: r1(a.yaw), pitch: r1(a.pitch), metin: sahneler[i + 1].ad, oto: 'ileri' }); }
    if (i > 0) { var b = (s.ok && s.ok.geri) || varsayilanOk(s, 'geri'); n.push({ tip: 'gecis', hedef: sahneler[i - 1].id, yaw: r1(b.yaw), pitch: r1(b.pitch), metin: sahneler[i - 1].ad, oto: 'geri' }); }
    return n.concat((s.bilgiNoktalari || []).map(function (x) { return { tip: 'bilgi', yaw: x.yaw, pitch: x.pitch, baslik: x.baslik, metin: x.metin || '' }; }));
  }

  // Taslak -> property.json
  function propertyOlustur(t) {
    var il = t.ilan || {}, ss = t.sahneler || [];
    var p = {
      id: t.slug || ST.slugify(il.baslik), tip: il.tip === 'ticari' ? 'ticari' : 'daire', durum: il.durum || 'Satılık',
      baslik: il.baslik || 'Başlıksız ilan', aciklama: il.aciklama || '',
      fiyat: il.fiyat === '' || il.fiyat == null ? null : Number(il.fiyat), paraBirimi: il.paraBirimi || 'TL',
      konum: il.konum || {}, bilgiler: il.bilgiler || {}, ozellikler: il.ozellikler || [], katPlani: '',
      kapak: ss[0] ? ss[0].id + '_thumb.jpg' : '', ilkSahne: ss[0] ? ss[0].id : '',
      sahneler: ss.map(function (s, i) {
        var o = { id: s.id, ad: s.ad, panorama: s.id + '.jpg', kucuk: s.id + '_thumb.jpg', tur: s.tur || 'kure', yaw: s.yaw || 0, pitch: s.pitch || 0, hfov: s.hfov || 100 };
        if (s.tur === 'genis') { o.haov = s.haov; o.vaov = s.vaov; o.vOffset = s.vOffset || 0; }
        o.noktalar = okluNoktalar(ss, i).map(function (n) { var c = Object.assign({}, n); delete c.oto; return c; });
        return o;
      })
    };
    if (il.fiyatEk) p.fiyatEk = il.fiyatEk;
    if (il.danisman && Object.keys(il.danisman).length) p.danisman = il.danisman;
    return p;
  }

  // ZIP: tours/<slug>/... + tours/index.json (editörle aynı biçim)
  function zipOlustur(p, dosyalar, ilerleme) {
    var zip = new JSZip(), k = zip.folder('tours').folder(p.id);
    k.file('property.json', JSON.stringify(p, null, 2));
    dosyalar.forEach(function (d) { k.file(d.ad, d.blob); });
    return ST.getJSON('tours/index.json').catch(function () { return { ilanlar: [] }; }).then(function (ix) {
      ix.ilanlar = ix.ilanlar || [];
      if (ix.ilanlar.indexOf(p.id) === -1) ix.ilanlar.unshift(p.id);
      zip.folder('tours').file('index.json', JSON.stringify(ix, null, 2));
      zip.file('NASIL-YUKLENIR.txt', 'Bu ZIP\'in içindeki "tours" klasörünü sanal tur sitesinin ana klasörüne kopyalayın (mevcut tours klasörüyle birleştirin, index.json\'ın üzerine yazın) ve siteyi yeniden yayınlayın.\n\nTur adresi: tur.html?p=' + p.id + '\n');
      return zip.generateAsync({ type: 'blob', compression: 'STORE' }, ilerleme);
    });
  }

  // Yükleme/oda değişiminde görüş açısını yeniden sınırla (boş alan görünmesin)
  function bagla(viewer) {
    var duzelt = function () { try { viewer.setHfov(viewer.getHfov() - 0.01, false); } catch (e) {} };
    viewer.on('load', function () { duzelt(); setTimeout(duzelt, 50); });
    return viewer;
  }

  w.STP = { bagla: bagla, VARSAYILAN_DIKEY: VARSAYILAN_DIKEY, isle: isle, analiz: analiz, sahneAyari: sahneAyari, okluNoktalar: okluNoktalar, varsayilanOk: varsayilanOk, propertyOlustur: propertyOlustur, zipOlustur: zipOlustur };
})(window);
