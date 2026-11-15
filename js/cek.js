/* Çek ve Kaydet: telefonda adım adım tur oluşturma sihirbazı */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var $$ = function (s, k) { return Array.prototype.slice.call((k || document).querySelectorAll(s)); };
  var t = null;            // açık taslak
  var adim = 0;
  var urller = {};         // sahneId -> {pano, kucuk}
  var onizViewer = null, modalViewer = null, onizSecili = 0, yerlestirMod = null;
  var kayitZ = null;
  var ODA_ADLARI = {
    daire: ['Giriş', 'Salon', 'Mutfak', 'Yatak Odası', 'Çocuk Odası', 'Banyo', 'WC', 'Balkon', 'Teras', 'Koridor'],
    ticari: ['Cephe / Vitrin', 'Giriş', 'Ana Alan', 'Ofis', 'Toplantı Odası', 'Mutfak', 'WC', 'Depo', 'Otopark']
  };
  var BILGI_HAZIR = ['Ankastre mutfak', 'Yerden ısıtma', 'Ebeveyn banyosu', 'Gömme dolap', 'Deniz manzarası', 'Isıcam pencere', 'Klima', 'Laminat parke', 'Vestiyer', 'Geniş vitrin', 'Yüksek tavan'];

  ST.dosyaKorumasi();
  Depo.kaliciIste();

  /* ---------- Yönlendirme ---------- */
  function rota() {
    var h = new URLSearchParams(location.hash.slice(1));
    if (location.hash === '#yeni') return yeniTaslak();
    var id = h.get('t');
    if (id) {
      var a = +h.get('a') || 1;
      if (t && t.id === id) return git(a, true);
      return Depo.taslakAl(id).then(function (x) {
        if (!x) { toast('Taslak bulunamadı'); return git(0); }
        t = x; urlleriYukle().then(function () { git(a, true); });
      });
    }
    t = null; git(0, true);
  }
  window.addEventListener('hashchange', rota);

  function git(n, hashtenGeldi) {
    if (n > 1 && !t) n = 0;
    if (n > 2 && t && !t.sahneler.length) { toast('Önce en az bir oda ekleyin'); n = 2; }
    adim = n;
    if (!hashtenGeldi) { var h = n === 0 ? '' : '#t=' + t.id + '&a=' + n; if (location.hash !== h) { history.pushState(null, '', h || location.pathname); } }
    $$('.adim').forEach(function (s) { s.classList.remove('acik'); });
    $('ekran' + n).classList.add('acik');
    $('adimlar').hidden = n === 0; $('altCubuk').hidden = n === 0;
    $$('#adimlar .a').forEach(function (b) { var k = +b.dataset.adim; b.classList.toggle('tamam', k < n); b.classList.toggle('simdi', k === n); });
    $('ustBaslik').textContent = n === 0 ? 'Turlarım' : (t.ilan.baslik || 'Yeni tur');
    $('btnUstGeri').href = n === 0 ? 'index.html' : '#';
    $('btnIleri').textContent = ['', 'Devam: Odaları çek →', 'Devam: Önizle →', 'Devam: Gönder →', '✓ Bitti, Turlarıma dön'][n];
    if (n !== 3) onizKapat();
    if (n === 0) listeCiz();
    if (n === 1) bilgiDoldur();
    if (n === 2) odalarCiz();
    if (n === 3) onizAc();
    if (n === 4) gonderCiz();
    window.scrollTo(0, 0);
  }
  $('btnUstGeri').addEventListener('click', function (e) { if (adim > 0) { e.preventDefault(); git(adim > 1 ? adim - 1 : 0); } });
  $('btnGeri').addEventListener('click', function () { git(Math.max(0, adim - 1)); });
  $('btnIleri').addEventListener('click', function () {
    if (adim === 1 && !(t.ilan.baslik || '').trim()) { $('fBaslik').focus(); toast('Lütfen bir ilan başlığı yazın'); return; }
    if (adim === 2 && !t.sahneler.length) { toast('En az bir oda ekleyin'); return; }
    if (adim === 4) return git(0);
    git(adim + 1);
  });
  $$('#adimlar .a').forEach(function (b) { b.addEventListener('click', function () { if (adim === 1 && !(t.ilan.baslik || '').trim()) { toast('Önce ilan başlığını yazın'); return; } git(+b.dataset.adim); }); });

  /* ---------- Kayıt ---------- */
  function kaydet(hemen) {
    if (!t) return Promise.resolve();
    $('kayitDurum').textContent = 'Kaydediliyor…';
    clearTimeout(kayitZ);
    var yap = function () { return Depo.taslakKaydet(t).then(function () { $('kayitDurum').textContent = '✓ Kaydedildi'; }).catch(function (e) { $('kayitDurum').textContent = '⚠ Kaydedilemedi'; console.error(e); }); };
    if (hemen) return yap();
    kayitZ = setTimeout(yap, 400); return Promise.resolve();
  }
  function yeniTaslak() {
    t = { id: Depo.yeniId(), olusturma: Date.now(), slug: '', slugElle: false, ilan: { tip: 'daire', durum: 'Satılık', baslik: '', fiyat: '', paraBirimi: 'TL', konum: { il: 'İstanbul' }, bilgiler: {}, ozellikler: [] }, sahneler: [] };
    urller = {};
    return kaydet(true).then(function () { history.replaceState(null, '', '#t=' + t.id + '&a=1'); git(1, true); });
  }
  function urlleriYukle() {
    Object.keys(urller).forEach(function (k) { URL.revokeObjectURL(urller[k].pano); URL.revokeObjectURL(urller[k].kucuk); });
    urller = {};
    return Promise.all(t.sahneler.map(function (s) {
      return Promise.all([Depo.dosyaAl(t.id + '/' + s.id), Depo.dosyaAl(t.id + '/' + s.id + '_k')]).then(function (b) {
        urller[s.id] = { pano: b[0] ? URL.createObjectURL(b[0]) : '', kucuk: b[1] ? URL.createObjectURL(b[1]) : '' };
      });
    }));
  }

  /* ---------- 0: Turlarım ---------- */
  function listeCiz() {
    Depo.taslakListe().then(function (l) {
      var el = $('taslakListe');
      if (!l.length) { el.innerHTML = '<div class="bos"><div class="ikon">📷</div><b>Henüz tur yok</b><br>“Yeni Tur Oluştur”a dokunarak ilk turunuzu hazırlayın.</div>'; return; }
      el.innerHTML = '';
      l.forEach(function (x) {
        var d = document.createElement('div'); d.className = 'taslak';
        d.innerHTML = '<div class="resim">🏠</div><div class="yazi"><b>' + ST.esc(x.ilan.baslik || 'Başlıksız tur') + '</b><small>' + x.sahneler.length + ' oda · ' + zamanYaz(x.guncelleme) + '</small></div>' +
          '<button class="btn-ikon btn-sade" aria-label="Sil">🗑</button>';
        d.querySelector('.yazi').addEventListener('click', function () { location.hash = 't=' + x.id + '&a=' + (x.sahneler.length ? 2 : 1); });
        d.querySelector('.resim').addEventListener('click', function () { location.hash = 't=' + x.id + '&a=' + (x.sahneler.length ? 2 : 1); });
        d.querySelector('button').addEventListener('click', function () { taslakSil(x); });
        if (x.sahneler[0]) Depo.dosyaAl(x.id + '/' + x.sahneler[0].id + '_k').then(function (b) { if (b) { var r = d.querySelector('.resim'); r.style.backgroundImage = 'url(' + URL.createObjectURL(b) + ')'; r.textContent = ''; } });
        el.appendChild(d);
      });
    });
  }
  function zamanYaz(ms) {
    var f = (Date.now() - ms) / 60000;
    if (f < 1) return 'az önce'; if (f < 60) return Math.round(f) + ' dk önce'; if (f < 1440) return Math.round(f / 60) + ' saat önce';
    return new Date(ms).toLocaleDateString('tr-TR');
  }
  function taslakSil(x) {
    if (!confirm('“' + (x.ilan.baslik || 'Başlıksız tur') + '” silinsin mi? Bu işlem geri alınamaz.')) return;
    Depo.taslakSil(x.id).then(function () { toast('Silindi'); if (t && t.id === x.id) { t = null; git(0); } else listeCiz(); });
  }
  $('btnYeni').addEventListener('click', function () { yeniTaslak(); });
  ST.getJSON('tours/index.json').then(function (ix) {
    (ix.ilanlar || []).forEach(function (s) { var o = document.createElement('option'); o.value = s; o.textContent = s; $('yayindanAl').appendChild(o); });
  }).catch(function () {});
  $('yayindanAl').addEventListener('change', function () {
    var slug = this.value; this.value = ''; if (!slug) return;
    yukleniyor(true, 'İlan telefona alınıyor…');
    var taban = 'tours/' + slug + '/';
    ST.getJSON(taban + 'property.json').then(function (p) {
      var yeni = { id: Depo.yeniId(), olusturma: Date.now(), slug: slug, slugElle: true,
        ilan: { tip: p.tip, durum: p.durum, baslik: p.baslik, aciklama: p.aciklama, fiyat: p.fiyat, paraBirimi: p.paraBirimi, fiyatEk: p.fiyatEk, konum: p.konum || {}, bilgiler: p.bilgiler || {}, ozellikler: p.ozellikler || [], danisman: p.danisman }, sahneler: [] };
      var ilk = p.sahneler.filter(function (s) { return s.id === p.ilkSahne; })[0];
      var sira = ilk ? [ilk].concat(p.sahneler.filter(function (s) { return s !== ilk; })) : p.sahneler;
      return Promise.all(sira.map(function (s) {
        return Promise.all([fetch(taban + s.panorama).then(function (r) { return r.blob(); }), fetch(taban + (s.kucuk || s.panorama)).then(function (r) { return r.blob(); })]).then(function (b) {
          return Promise.all([Depo.dosyaKaydet(yeni.id + '/' + s.id, b[0]), Depo.dosyaKaydet(yeni.id + '/' + s.id + '_k', b[1])]).then(function () {
            return { id: s.id, ad: s.ad, tur: s.tur || ((s.haov && s.haov < 360) ? 'genis' : 'kure'), haov: s.haov || 360, vaov: s.vaov || 180, vOffset: s.vOffset || 0, yaw: s.yaw || 0, pitch: s.pitch || 0, hfov: s.hfov || 100,
              bilgiNoktalari: (s.noktalar || []).filter(function (n) { return n.tip === 'bilgi'; }), ok: {} };
          });
        });
      })).then(function (ss) { yeni.sahneler = ss; t = yeni; return kaydet(true); });
    }).then(function () { yukleniyor(false); urlleriYukle().then(function () { location.hash = 't=' + t.id + '&a=1'; }); toast('İlan telefona alındı. Geçiş okları oda sırasına göre yeniden oluşturuldu.'); })
      .catch(function (e) { yukleniyor(false); alert('Alınamadı: ' + e.message); });
  });

  /* ---------- 1: Bilgiler ---------- */
  function bilgiDoldur() {
    var il = t.ilan;
    $$('#tipSec button').forEach(function (b) { b.classList.toggle('secili', b.dataset.tip === il.tip); });
    $$('#durumSec button').forEach(function (b) { b.classList.toggle('secili', b.dataset.d === il.durum); });
    $('fBaslik').value = il.baslik || '';
    $('fFiyat').value = il.fiyat != null && il.fiyat !== '' ? new Intl.NumberFormat('tr-TR').format(il.fiyat) : '';
    fiyatOn();
    $('fIlce').value = (il.konum || {}).ilce || ''; $('fMahalle').value = (il.konum || {}).mahalle || '';
    $('fAciklama').value = il.aciklama || ''; $('fHarita').value = (il.konum || {}).harita || '';
    $('fPara').value = il.paraBirimi || 'TL'; $('fFiyatEk').value = il.fiyatEk || '';
    ekAlanlarCiz();
  }
  function ekAlanlarCiz() {
    var il = t.ilan, b = il.bilgiler || {};
    $('ekAlanlar').innerHTML = ST.alanlarFor(il.tip).map(function (a) {
      var v = b[a.k] != null ? b[a.k] : '';
      if (a.o) return '<label class="alan">' + ST.esc(a.l) + '<select data-alan="' + a.k + '"><option value="">—</option>' + a.o.map(function (o) { return '<option' + (String(v) === o ? ' selected' : '') + '>' + ST.esc(o) + '</option>'; }).join('') + (v && a.o.indexOf(String(v)) < 0 ? '<option selected>' + ST.esc(v) + '</option>' : '') + '</select></label>';
      return '<label class="alan">' + ST.esc(a.l) + '<input data-alan="' + a.k + '"' + (a.t === 'number' ? ' inputmode="numeric"' : '') + ' value="' + ST.esc(v) + '"></label>';
    }).join('');
    var sec = il.ozellikler || [];
    var liste = ST.HAZIR_OZELLIKLER[il.tip].concat(sec.filter(function (o) { return ST.HAZIR_OZELLIKLER[il.tip].indexOf(o) < 0; }));
    $('ozCipler').innerHTML = liste.map(function (o) { return '<button type="button"' + (sec.indexOf(o) > -1 ? ' class="secili"' : '') + '>' + ST.esc(o) + '</button>'; }).join('');
  }
  function fiyatOn() { var n = sayiAl($('fFiyat').value); $('fiyatOn').textContent = n ? ST.fiyatYaz({ fiyat: n, paraBirimi: $('fPara').value, fiyatEk: $('fFiyatEk').value }) : ''; }
  function sayiAl(s) { var d = String(s || '').replace(/[^\d]/g, ''); return d ? Number(d) : ''; }
  $('tipSec').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; t.ilan.tip = b.dataset.tip; bilgiDoldur(); kaydet(); });
  $('durumSec').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; t.ilan.durum = b.dataset.d; $$('#durumSec button').forEach(function (x) { x.classList.toggle('secili', x === b); }); kaydet(); });
  $('ozCipler').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var o = b.textContent, l = t.ilan.ozellikler = t.ilan.ozellikler || [], i = l.indexOf(o);
    if (i > -1) l.splice(i, 1); else l.push(o);
    b.classList.toggle('secili', i < 0); kaydet();
  });
  $('ekran1').addEventListener('input', function (e) {
    var il = t.ilan, el = e.target; il.konum = il.konum || {};
    if (el.id === 'fBaslik') { il.baslik = el.value; $('ustBaslik').textContent = el.value || 'Yeni tur'; if (!t.slugElle) t.slug = ST.slugify(el.value); }
    else if (el.id === 'fFiyat') { var n = sayiAl(el.value); il.fiyat = n; el.value = n ? new Intl.NumberFormat('tr-TR').format(n) : ''; fiyatOn(); }
    else if (el.id === 'fIlce') il.konum.ilce = el.value;
    else if (el.id === 'fMahalle') il.konum.mahalle = el.value;
    else if (el.id === 'fAciklama') il.aciklama = el.value;
    else if (el.id === 'fHarita') il.konum.harita = el.value;
    else if (el.id === 'fFiyatEk') { il.fiyatEk = el.value; fiyatOn(); }
    else if (el.dataset.alan) { var v = el.value.trim(); if (v === '') delete il.bilgiler[el.dataset.alan]; else il.bilgiler[el.dataset.alan] = el.inputMode === 'numeric' ? (sayiAl(v) === '' ? v : sayiAl(v)) : v; }
    kaydet();
  });
  $('fPara').addEventListener('change', function () { t.ilan.paraBirimi = this.value; fiyatOn(); kaydet(); });

  /* ---------- 2: Odalar ---------- */
  function odalarCiz() {
    var el = $('odaListe'); el.innerHTML = '';
    $('nasilCekilir').open = !t.sahneler.length;
    t.sahneler.forEach(function (s, i) {
      var d = document.createElement('div'); d.className = 'oda';
      d.innerHTML = '<img class="resim" alt="" src="' + ((urller[s.id] || {}).kucuk || '') + '">' +
        '<div class="yazi"><input value="' + ST.esc(s.ad) + '" aria-label="Oda adı"><div class="sira">' + (i + 1) + '. oda · ' + (s.tur === 'kure' ? '360° tam küre' : 'Panorama ~' + Math.round(s.haov) + '°') + '</div></div>' +
        '<div class="islemler"><button class="btn-ikon btn-sade" data-i="yukari" aria-label="Yukarı taşı"' + (i ? '' : ' disabled') + '>↑</button><button class="btn-ikon btn-sade" data-i="sil" aria-label="Sil">🗑</button></div>';
      d.querySelector('img').addEventListener('click', function () { odaOnizle(i, false); });
      d.querySelector('input').addEventListener('input', function () { s.ad = this.value; kaydet(); });
      d.querySelector('[data-i=yukari]').addEventListener('click', function () { var x = t.sahneler.splice(i, 1)[0]; t.sahneler.splice(i - 1, 0, x); okSifirla(); kaydet(); odalarCiz(); });
      d.querySelector('[data-i=sil]').addEventListener('click', function () { odaSil(i); });
      el.appendChild(d);
    });
    $('siradakiBaslik').textContent = t.sahneler.length ? (t.sahneler.length + 1) + '. oda' : 'İlk oda';
    var kullanilan = t.sahneler.map(function (s) { return s.ad; });
    var oneriler = ODA_ADLARI[t.ilan.tip].filter(function (a) { return kullanilan.indexOf(a) < 0; });
    $('odaAdCipler').innerHTML = oneriler.slice(0, 8).map(function (a, i) { return '<button type="button"' + (i === 0 ? ' class="secili"' : '') + '>' + a + '</button>'; }).join('');
    $('odaAd').value = oneriler[0] || '';
  }
  function okSifirla() { t.sahneler.forEach(function (s) { s.ok = {}; }); }
  $('odaAdCipler').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    $$('#odaAdCipler button').forEach(function (x) { x.classList.toggle('secili', x === b); });
    $('odaAd').value = b.textContent;
  });
  $('dikeyAci').addEventListener('input', function () { $('dikeyDeger').textContent = this.value + '°'; });
  function odaSil(i) {
    var s = t.sahneler[i];
    if (!confirm('“' + s.ad + '” silinsin mi?')) return;
    t.sahneler.splice(i, 1); okSifirla();
    Depo.dosyaSil(t.id + '/' + s.id); Depo.dosyaSil(t.id + '/' + s.id + '_k');
    kaydet(true); odalarCiz(); modalKapat();
  }
  ['dosyaKamera', 'dosyaGaleri'].forEach(function (id) {
    $(id).addEventListener('change', function () {
      var dosyalar = Array.prototype.slice.call(this.files); this.value = '';
      if (dosyalar.length) dosyalariIsle(dosyalar, null);
    });
  });
  function benzersizId(ad) {
    var b = ST.slugify(ad) || 'oda', id = b, n = 2;
    while (t.sahneler.some(function (s) { return s.id === id; })) id = b + '-' + n++;
    return id;
  }
  // degistirIdx: yeniden çekimde mevcut odanın görselini değiştirir
  function dosyalariIsle(dosyalar, degistirIdx) {
    var secenek = { zorlaTur: $('zorlaTur').value, dikeyAci: +$('dikeyAci').value };
    var zincir = Promise.resolve(), son = -1, uyarilar = [];
    yukleniyor(true, 'Panorama hazırlanıyor…');
    dosyalar.forEach(function (f, k) {
      zincir = zincir.then(function () {
        $('yukleniyorMetin').textContent = dosyalar.length > 1 ? 'Panorama hazırlanıyor (' + (k + 1) + '/' + dosyalar.length + ')…' : 'Panorama hazırlanıyor…';
        return STP.isle(f, secenek).then(function (r) {
          if (r.uyari) uyarilar.push(r.uyari);
          var s;
          if (degistirIdx != null) {
            s = t.sahneler[degistirIdx];
            s.yaw = 0; s.pitch = 0; s.hfov = 100; s.bilgiNoktalari = []; s.ok = {};
          } else {
            var ad = k === 0 ? ($('odaAd').value.trim() || ('Oda ' + (t.sahneler.length + 1))) : ('Oda ' + (t.sahneler.length + 1));
            s = { id: benzersizId(ad), ad: ad, yaw: 0, pitch: 0, hfov: 100, bilgiNoktalari: [], ok: {} };
            t.sahneler.push(s);
          }
          s.tur = r.tur; s.haov = r.haov; s.vaov = r.vaov; s.vOffset = r.vOffset; s.gen = r.gen; s.yuk = r.yuk;
          son = t.sahneler.indexOf(s);
          if (urller[s.id]) { URL.revokeObjectURL(urller[s.id].pano); URL.revokeObjectURL(urller[s.id].kucuk); }
          urller[s.id] = { pano: URL.createObjectURL(r.blob), kucuk: URL.createObjectURL(r.kucuk) };
          return Promise.all([Depo.dosyaKaydet(t.id + '/' + s.id, r.blob), Depo.dosyaKaydet(t.id + '/' + s.id + '_k', r.kucuk)]);
        });
      });
    });
    zincir.then(function () { return kaydet(true); }).then(function () {
      yukleniyor(false); odalarCiz();
      if (son > -1) odaOnizle(son, true, uyarilar.join(' '));
    }).catch(function (e) { yukleniyor(false); alert('Fotoğraf işlenemedi: ' + e.message); console.error(e); });
  }
  function odaOnizle(i, yeniEklendi, uyari) {
    var s = t.sahneler[i];
    modalAc('<h3>' + (yeniEklendi ? '✓ ' + ST.esc(s.ad) + ' eklendi' : ST.esc(s.ad)) + '</h3>' +
      (uyari ? '<p class="kucuk" style="background:#FFF7E0;padding:10px;border-radius:10px">' + ST.esc(uyari) + '</p>' : '') +
      '<div class="onizleme-alan" style="height:46vh;min-height:260px"><div id="modalPano"></div></div>' +
      '<p class="kucuk" style="margin:8px 0 0">' + (s.tur === 'kure' ? '360° tam küre fotoğraf' : 'Telefon panoraması · yaklaşık ' + Math.round(s.haov) + '° geniş açı') + '. Parmağınızla sürükleyin.</p>' +
      '<div class="dugmeler"><label class="btn" for="dosyaYeniden">↺ Yeniden çek</label><button class="btn-ana" id="mTamam">Tamam</button></div>' +
      '<input type="file" id="dosyaYeniden" accept="image/*" hidden>');
    $('mTamam').addEventListener('click', modalKapat);
    $('dosyaYeniden').addEventListener('change', function () { var f = this.files[0]; if (f) { modalKapat(); dosyalariIsle([f], i); } });
    if (modalViewer) try { modalViewer.destroy(); } catch (e) {}
    var c = STP.sahneAyari(s, urller[s.id].pano); c.autoLoad = true; c.showControls = false; c.autoRotate = -3;
    modalViewer = pannellum.viewer('modalPano', c);
    STP.bagla(modalViewer);
    window.__modalViewer = modalViewer;
  }

  /* ---------- 3: Önizle ---------- */
  function onizAc() {
    if (onizSecili >= t.sahneler.length) onizSecili = 0;
    $('musteriGibi').href = 'tur.html?taslak=' + encodeURIComponent(t.id);
    var el = $('miniSerit'); el.innerHTML = '';
    t.sahneler.forEach(function (s, i) {
      var b = document.createElement('button'); b.type = 'button';
      b.innerHTML = '<img alt="" src="' + urller[s.id].kucuk + '"><span>' + (i + 1) + '. ' + ST.esc(s.ad) + '</span>';
      b.addEventListener('click', function () { onizSecili = i; onizCiz(false); });
      el.appendChild(b);
    });
    onizCiz(false);
  }
  function onizKapat() { modYerlestir(null); if (onizViewer) { try { onizViewer.destroy(); } catch (e) {} onizViewer = null; } }
  function onizCiz(gorunumKoru) {
    var s = t.sahneler[onizSecili]; if (!s) return;
    $$('#miniSerit button').forEach(function (b, i) { b.classList.toggle('secili', i === onizSecili); });
    $('onizOdaAd').textContent = (onizSecili + 1) + '. ' + s.ad;
    $('tIleri').hidden = !t.sahneler[onizSecili + 1];
    $('tGeri').hidden = onizSecili === 0;
    var bakis = gorunumKoru && onizViewer ? { yaw: onizViewer.getYaw(), pitch: onizViewer.getPitch(), hfov: onizViewer.getHfov() } : null;
    if (onizViewer) { try { onizViewer.destroy(); } catch (e) {} }
    var c = STP.sahneAyari(s, urller[s.id].pano);
    if (bakis) { c.yaw = bakis.yaw; c.pitch = bakis.pitch; c.hfov = bakis.hfov; }
    c.autoLoad = true; c.showControls = false;
    c.hotSpots = STP.okluNoktalar(t.sahneler, onizSecili).map(function (n) {
      return { pitch: n.pitch, yaw: n.yaw, type: 'info', cssClass: 'st-hs-kok', createTooltipFunc: ST.hotspotOlustur, createTooltipArgs: n,
        clickHandlerFunc: function () { if (n.tip === 'gecis' && !yerlestirMod) { onizSecili = t.sahneler.map(function (x) { return x.id; }).indexOf(n.hedef); onizCiz(false); } } };
    });
    onizViewer = pannellum.viewer('onizPano', c);
    STP.bagla(onizViewer);
    window.__onizViewer = onizViewer;
    bilgiListeCiz();
  }
  function bilgiListeCiz() {
    var s = t.sahneler[onizSecili], l = s.bilgiNoktalari || [];
    $('bilgiListe').innerHTML = l.length ? '<div class="bolum-baslik" style="margin-top:6px">Bilgi noktaları</div>' + l.map(function (n, i) {
      return '<div class="nokta"><span>ⓘ</span><span class="metin"><b>' + ST.esc(n.baslik) + '</b>' + (n.metin ? '<br><span class="kucuk">' + ST.esc(n.metin) + '</span>' : '') + '</span><button class="btn-ikon btn-sade" data-i="' + i + '" aria-label="Sil">🗑</button></div>';
    }).join('') : '<p class="kucuk" style="margin:0">Bu odada bilgi noktası yok. Örn. “Ankastre mutfak” gibi notları göstermek için ekleyin.</p>';
    $$('#bilgiListe button').forEach(function (b) { b.addEventListener('click', function () { s.bilgiNoktalari.splice(+b.dataset.i, 1); kaydet(); onizCiz(true); }); });
  }
  function modYerlestir(m) {
    yerlestirMod = m;
    $('onizAlan').classList.toggle('yerlestir', !!m);
    $('yerlestirUyari').textContent = m === 'bilgi' ? 'Bilgi noktasının yerine dokunun' : m ? 'Okun yeni yerine dokunun (genelde kapı)' : '';
    ['tBilgi', 'tIleri', 'tGeri'].forEach(function (id) { $(id).classList.remove('aktif'); });
    if (m) $({ bilgi: 'tBilgi', ileri: 'tIleri', geri: 'tGeri' }[m]).classList.add('aktif');
    if (m) $('onizAlan').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  $('tBilgi').addEventListener('click', function () { modYerlestir(yerlestirMod === 'bilgi' ? null : 'bilgi'); });
  $('tIleri').addEventListener('click', function () { modYerlestir(yerlestirMod === 'ileri' ? null : 'ileri'); });
  $('tGeri').addEventListener('click', function () { modYerlestir(yerlestirMod === 'geri' ? null : 'geri'); });
  $('tBaslangic').addEventListener('click', function () {
    if (!onizViewer) return; var s = t.sahneler[onizSecili];
    s.yaw = Math.round(onizViewer.getYaw()); s.pitch = Math.round(onizViewer.getPitch()); s.hfov = Math.round(onizViewer.getHfov());
    kaydet(); toast('“' + s.ad + '” bu açıdan başlayacak');
  });
  var basla = null;
  $('onizAlan').addEventListener('pointerdown', function (e) { basla = { x: e.clientX, y: e.clientY }; }, true);
  $('onizAlan').addEventListener('pointerup', function (e) {
    if (!yerlestirMod || !onizViewer || !basla) return;
    if (Math.hypot(e.clientX - basla.x, e.clientY - basla.y) > 8) return;
    var c = onizViewer.mouseEventToCoords(e), s = t.sahneler[onizSecili], m = yerlestirMod;
    var k = { pitch: Math.round(c[0] * 10) / 10, yaw: Math.round(c[1] * 10) / 10 };
    modYerlestir(null);
    if (m === 'bilgi') return bilgiFormu(k);
    s.ok = s.ok || {}; s.ok[m] = k; kaydet(); onizCiz(true); toast('Ok taşındı');
  }, true);
  function bilgiFormu(k) {
    modalAc('<h3>ⓘ Bilgi noktası</h3><div class="cipler" style="margin-bottom:12px">' + BILGI_HAZIR.map(function (o) { return '<button type="button" class="hz">' + o + '</button>'; }).join('') + '</div>' +
      '<label>Başlık<input id="bBaslik" placeholder="Örn. Ankastre mutfak"></label><label>Açıklama (isteğe bağlı)<textarea id="bMetin" rows="2" placeholder="Örn. Bosch ankastre set"></textarea></label>' +
      '<div class="dugmeler"><button id="bIptal">Vazgeç</button><button class="btn-ana" id="bKaydet">Ekle</button></div>');
    $$('.hz').forEach(function (b) { b.addEventListener('click', function () { $('bBaslik').value = b.textContent; }); });
    $('bIptal').addEventListener('click', modalKapat);
    $('bKaydet').addEventListener('click', function () {
      var bs = $('bBaslik').value.trim(); if (!bs) { toast('Başlık yazın'); return; }
      var s = t.sahneler[onizSecili]; s.bilgiNoktalari = s.bilgiNoktalari || [];
      s.bilgiNoktalari.push({ yaw: k.yaw, pitch: k.pitch, baslik: bs, metin: $('bMetin').value.trim() });
      kaydet(); modalKapat(); onizCiz(true); toast('Bilgi noktası eklendi');
    });
  }

  /* ---------- 4: Gönder ---------- */
  function gonderCiz() {
    if (!t.slug) t.slug = ST.slugify(t.ilan.baslik);
    var il = t.ilan;
    $('ozetBaslik').textContent = il.baslik || 'Başlıksız';
    $('ozetAlt').textContent = [ST.fiyatYaz(il), t.sahneler.length + ' oda', ST.konumYaz(il)].filter(Boolean).join(' · ');
    $('ozetResim').style.backgroundImage = t.sahneler[0] ? 'url(' + urller[t.sahneler[0].id].kucuk + ')' : '';
    $('btnGoster').href = 'tur.html?taslak=' + encodeURIComponent(t.id);
    $('fSlug').value = t.slug;
    var d = il.danisman || {}; $('fDanAd').value = d.ad || ''; $('fDanTel').value = d.telefon || ''; $('fDanWa').value = d.whatsapp || '';
    linkYaz();
    var paylasilir = !!(navigator.canShare && window.File && navigator.canShare({ files: [new File([''], 'a.zip', { type: 'application/zip' })] }));
    $('btnPaylasZip').hidden = !paylasilir;
    $('btnIndirZip').classList.toggle('btn-ana', !paylasilir);
  }
  function linkYaz() { $('turLink').textContent = location.origin + location.pathname.replace(/cek\.html$/, '') + 'tur.html?p=' + t.slug; }
  $('ekran4').addEventListener('input', function (e) {
    var el = e.target, il = t.ilan;
    if (el.id === 'fSlug') { t.slug = ST.slugify(el.value); t.slugElle = true; linkYaz(); }
    else if (/^fDan/.test(el.id)) { il.danisman = il.danisman || {}; var k = { fDanAd: 'ad', fDanTel: 'telefon', fDanWa: 'whatsapp' }[el.id]; if (el.value.trim()) il.danisman[k] = el.value.trim(); else delete il.danisman[k]; }
    kaydet();
  });
  $('fSlug').addEventListener('change', function () { this.value = t.slug; });
  function zipHazirla() {
    if (!t.slug) t.slug = ST.slugify(t.ilan.baslik);
    var p = STP.propertyOlustur(t);
    yukleniyor(true, 'Tur dosyası hazırlanıyor…');
    return Promise.all(t.sahneler.map(function (s) {
      return Promise.all([Depo.dosyaAl(t.id + '/' + s.id), Depo.dosyaAl(t.id + '/' + s.id + '_k')]).then(function (b) {
        return [{ ad: s.id + '.jpg', blob: b[0] }, { ad: s.id + '_thumb.jpg', blob: b[1] }];
      });
    })).then(function (l) {
      return STP.zipOlustur(p, [].concat.apply([], l), function (m) { $('yukleniyorMetin').textContent = 'Tur dosyası hazırlanıyor… %' + Math.round(m.percent); });
    }).then(function (blob) { yukleniyor(false); return { blob: blob, ad: 'sanal-tur-' + p.id + '.zip' }; }, function (e) { yukleniyor(false); throw e; });
  }
  $('btnIndirZip').addEventListener('click', function () {
    zipHazirla().then(function (z) {
      var a = document.createElement('a'); a.href = URL.createObjectURL(z.blob); a.download = z.ad; document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000); toast('Tur dosyası indirildi');
    }).catch(function (e) { alert('Hazırlanamadı: ' + e.message); });
  });
  $('btnPaylasZip').addEventListener('click', function () {
    zipHazirla().then(function (z) {
      var f = new File([z.blob], z.ad, { type: 'application/zip' });
      return navigator.share({ files: [f], title: t.ilan.baslik, text: t.ilan.baslik + ' – 360° sanal tur dosyası' });
    }).catch(function (e) { if (e && e.name !== 'AbortError') alert('Paylaşılamadı: ' + e.message + '\n“Tur dosyasını indir” seçeneğini deneyin.'); });
  });
  $('btnTaslakSil').addEventListener('click', function () { taslakSil(t); });

  /* ---------- Yardımcılar ---------- */
  function modalAc(h) { $('modalIcerik').innerHTML = h; $('modal').classList.add('acik'); }
  function modalKapat() { $('modal').classList.remove('acik'); if (modalViewer) { try { modalViewer.destroy(); } catch (e) {} modalViewer = null; } }
  $('modalKapat').addEventListener('click', modalKapat);
  $('modal').addEventListener('click', function (e) { if (e.target === this) modalKapat(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { modalKapat(); modYerlestir(null); } });
  function toast(m) { var x = $('toast'); x.textContent = m; x.classList.add('goster'); clearTimeout(x._z); x._z = setTimeout(function () { x.classList.remove('goster'); }, 2600); }
  function yukleniyor(a, m) { $('yukleniyor').classList.toggle('acik', a); if (m) $('yukleniyorMetin').textContent = m; }

  rota();
})();
