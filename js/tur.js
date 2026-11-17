/* Müşteriye gösterilen tur sayfası */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var params = new URLSearchParams(location.search);
  var slug = params.get('p') || '', taslakId = params.get('taslak') || '';
  var viewer = null, ilan = null, ayarlar = {}, otoTur = null, donuyor = true, dosyaUrl = null;
  var OTO_SURE = 15000;

  if (ST.dosyaKorumasi()) return;

  var yukle;
  if (taslakId) {
    // Bu telefondaki taslağı göster (yayınlamadan önizleme)
    $('btnGeri').href = 'cek.html#t=' + encodeURIComponent(taslakId);
    yukle = Depo.taslakAl(taslakId).then(function (t) {
      if (!t) throw new Error('Taslak bu cihazda bulunamadı');
      var p = STP.propertyOlustur(t), urls = {};
      return Promise.all((t.sahneler || []).map(function (s) {
        return Promise.all([Depo.dosyaAl(t.id + '/' + s.id), Depo.dosyaAl(t.id + '/' + s.id + '_k')]).then(function (b) {
          if (b[0]) urls[s.id + '.jpg'] = URL.createObjectURL(b[0]);
          if (b[1]) urls[s.id + '_thumb.jpg'] = URL.createObjectURL(b[1]);
        });
      })).then(function () { dosyaUrl = function (f) { return urls[f] || ''; }; p.taslak = true; return p; });
    });
  } else if (slug && /^[a-z0-9-_]+$/i.test(slug)) {
    dosyaUrl = function (f) { return 'tours/' + slug + '/' + f; };
    yukle = ST.getJSON('tours/' + slug + '/property.json');
  } else {
    yukle = Promise.reject(new Error('İlan bulunamadı'));
  }

  Promise.all([ST.getJSON('ayarlar.json').catch(function () { return {}; }), yukle]).then(function (r) {
    ayarlar = r[0] || {}; ilan = r[1]; baslat();
  }).catch(function (e) {
    var taslakMi = !!taslakId;
    $('baslik').textContent = taslakMi ? 'Bu tur bu telefonda bulunamadı' : 'Bu ilan bulunamadı';
    $('ustFiyat').textContent = taslakMi ? 'Silinmiş ya da başka bir telefonda kaydedilmiş olabilir.' : 'Link hatalı olabilir ya da ilan yayından kaldırılmış.';
    $('ipucu').classList.add('gizli');
    ['btnPaylas', 'btnMenu', 'btnPanel'].forEach(function (id) { var b = $(id); if (b) b.hidden = true; });
    var a = document.createElement('a'); a.className = 'btn btn-ana btn-buyuk'; a.href = taslakMi ? 'cek.html' : 'index.html';
    a.textContent = taslakMi ? 'Turlarıma git' : 'Tüm ilanları gör';
    a.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:6';
    document.body.appendChild(a);
    console.warn(e);
  });

  function baslat() {
    document.title = ilan.baslik + ' – 360° Sanal Tur';
    $('baslik').textContent = ilan.baslik;
    $('ustFiyat').textContent = ST.fiyatYaz(ilan);
    if (window.innerWidth >= 900) $('panel').classList.remove('kapali');
    paneliCiz(); turuKur(); seridiCiz(); butonlar(); ipucu();
  }

  function turuKur() {
    var sahneler = {};
    (ilan.sahneler || []).forEach(function (s) {
      var c = STP.sahneAyari(s, dosyaUrl(s.panorama));
      c.hotSpots = (s.noktalar || []).map(function (n) {
        var h = { pitch: n.pitch, yaw: n.yaw, cssClass: 'st-hs-kok', createTooltipFunc: ST.hotspotOlustur, createTooltipArgs: n };
        if (n.tip === 'gecis') { h.type = 'scene'; h.sceneId = n.hedef; } else h.type = 'info';
        return h;
      });
      sahneler[s.id] = c;
    });
    var ilk = new URLSearchParams(location.hash.slice(1)).get('oda');
    if (!ilk || !sahneler[ilk]) ilk = sahneler[ilan.ilkSahne] ? ilan.ilkSahne : Object.keys(sahneler)[0];
    if (!ilk) { $('baslik').textContent = 'Bu ilanda henüz oda yok'; return; }
    viewer = pannellum.viewer('panorama', {
      default: {
        firstScene: ilk, sceneFadeDuration: 800, autoLoad: true, autoRotate: -2,
        showControls: true, showFullscreenCtrl: false, showZoomCtrl: false, compass: false,
        minHfov: 40, maxHfov: 120,
        strings: {
          loadButtonLabel: 'Turu<br>Başlat', loadingLabel: 'Yükleniyor…', bylineLabel: '%s',
          noPanoramaError: 'Görsel bulunamadı.', fileAccessError: 'Görsel açılamadı.', malformedURLError: 'Görsel adresi hatalı.',
          iOS8WebGLError: 'Bu cihaz desteklenmiyor.', genericWebGLError: 'Tarayıcınız 3D görüntülemeyi desteklemiyor.',
          textureSizeError: 'Görsel bu cihaz için çok büyük.', unknownError: 'Bilinmeyen bir hata oluştu.'
        }
      },
      scenes: sahneler
    });
    STP.bagla(viewer);
    viewer.on('scenechange', sahneDegisti);
    viewer.on('load', function () { sahneDegisti(viewer.getScene()); });
    viewer.on('error', function (e) { console.error('Görüntüleyici:', e); });
    window.__viewer = viewer;
  }

  function sahneDegisti(id) {
    var s = (ilan.sahneler || []).filter(function (x) { return x.id === id; })[0];
    var i = (ilan.sahneler || []).indexOf(s);
    $('sahneAdi').textContent = s ? s.ad + '  ·  ' + (i + 1) + '/' + ilan.sahneler.length : '';
    Array.prototype.forEach.call(document.querySelectorAll('#serit button'), function (b) {
      var sec = b.dataset.id === id; b.classList.toggle('secili', sec);
      if (sec && b.scrollIntoView) b.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    });
    history.replaceState(null, '', location.search + '#oda=' + encodeURIComponent(id));
  }

  function seridiCiz() {
    var el = $('serit');
    (ilan.sahneler || []).forEach(function (s) {
      var b = document.createElement('button'); b.dataset.id = s.id; b.title = s.ad;
      var img = document.createElement('img'); img.alt = ''; img.src = dosyaUrl(s.kucuk || s.panorama);
      var sp = document.createElement('span'); sp.textContent = s.ad;
      b.appendChild(img); b.appendChild(sp);
      b.addEventListener('click', function () { if (viewer && viewer.getScene() !== s.id) viewer.loadScene(s.id); });
      el.appendChild(b);
    });
    if ((ilan.sahneler || []).length < 2) el.style.display = 'none';
  }

  function ipucu() {
    var k = $('ipucu'), gizle = function () { k.classList.add('gizli'); };
    $('panorama').addEventListener('pointerdown', gizle, { once: true });
    $('panorama').addEventListener('touchstart', gizle, { once: true, passive: true });
    setTimeout(gizle, 6000);
  }

  function paneliCiz() {
    var b = ilan.bilgiler || {}, h = [];
    h.push('<div class="tutamak"><b>İlan bilgileri</b><button class="btn-ikon btn-sade" id="panelKapat" aria-label="Kapat">✕</button></div>');
    h.push('<section><div style="display:flex;gap:6px;flex-wrap:wrap"><span class="rozet ana">' + ST.esc(ilan.durum || '') + '</span><span class="rozet">' + (ilan.tip === 'ticari' ? 'Dükkan / Ofis' : 'Konut') + '</span>' + (ilan.ornek ? '<span class="rozet ornek">Örnek ilan</span>' : '') + (ilan.taslak ? '<span class="rozet ornek">Taslak önizleme</span>' : '') + '</div>' +
      '<h2>' + ST.esc(ilan.baslik) + '</h2><div class="fiyat-buyuk">' + ST.esc(ST.fiyatYaz(ilan)) + '</div>' +
      '<div class="kucuk" style="font-size:15px">📍 ' + ST.esc(ST.konumYaz(ilan)) + '</div>' +
      (ilan.aciklama ? '<p class="aciklama">' + ST.esc(ilan.aciklama) + '</p>' : '') + '</section>');
    var kutular = ST.alanlarFor(ilan.tip).map(function (a) {
      var v = ST.degerYaz(a, b[a.k]);
      return v ? '<div><small>' + ST.esc(a.l) + '</small><b>' + ST.esc(v) + '</b></div>' : '';
    }).join('');
    if (kutular) h.push('<section><h3>Özellikler</h3><div class="ozellik-izgara">' + kutular + '</div></section>');
    if ((ilan.ozellikler || []).length) h.push('<section><h3>Öne çıkanlar</h3><div class="liste-ozellik">' + ilan.ozellikler.map(function (o) { return '<span>' + ST.esc(o) + '</span>'; }).join('') + '</div></section>');
    if (ilan.katPlani) h.push('<section class="kat-plani"><h3>Kat planı</h3><img id="katPlaniImg" alt="Kat planı" src="' + ST.esc(dosyaUrl(ilan.katPlani)) + '"></section>');
    var k = ilan.konum || {}, q = k.harita || ST.konumYaz(ilan);
    if (q) h.push('<section class="harita"><h3>Konum</h3><iframe loading="lazy" title="Harita" src="https://maps.google.com/maps?q=' + encodeURIComponent(q) + '&z=15&hl=tr&output=embed"></iframe>' +
      '<div class="dugmeler"><a class="btn" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q) + '">Haritada aç</a></div></section>');
    h.push(danismanKarti());
    h.push('<section class="kucuk">' + (ilan.ornek ? 'Örnek görseller: Poly Haven (CC0). ' : '') + 'Görüntüleyici: Pannellum.</section>');
    $('panel').innerHTML = h.join('');
    $('panelKapat').addEventListener('click', panelDegistir);
    var kp = $('katPlaniImg'); if (kp) kp.addEventListener('click', function () { modalAc('<h3>Kat planı</h3><img src="' + ST.esc(kp.src) + '" alt="Kat planı">'); });
  }

  function danismanKarti() {
    var d = Object.assign({}, ayarlar.danisman || {}, ilan.danisman || {});
    var yt = function (v) { return ST.yerTutucuMu(v) ? '<span class="yer-tutucu">' + ST.esc(v || '—') + '</span>' : ST.esc(v); };
    var bas = (d.ad && !ST.yerTutucuMu(d.ad)) ? d.ad.split(/\s+/).map(function (x) { return x[0]; }).slice(0, 2).join('') : '👤';
    var tel = (d.telefon && !ST.yerTutucuMu(d.telefon)) ? d.telefon.replace(/[^\d+]/g, '') : '';
    var wa = (d.whatsapp || '').replace(/\D/g, '');
    var mesaj = 'Merhaba, "' + ilan.baslik + '" ilanı hakkında bilgi almak istiyorum. ' + location.href.split('#')[0];
    return '<section><h3>Danışmanınız</h3><div class="danisman"><div class="foto"' + (d.foto ? ' style="background-image:url(\'' + ST.esc(d.foto) + '\')"' : '') + '>' + (d.foto ? '' : ST.esc(bas)) + '</div>' +
      '<div><div class="ad">' + yt(d.ad) + '</div><div class="alt">' + ST.esc(d.unvan || '') + '</div><div class="alt">' + yt(d.ofis) + '</div></div></div>' +
      '<div class="dugmeler"><a class="btn btn-wa btn-buyuk" ' + (wa ? 'href="https://wa.me/' + wa + '?text=' + encodeURIComponent(mesaj) + '" target="_blank" rel="noopener"' : 'aria-disabled="true"') + '>WhatsApp</a>' +
      '<a class="btn btn-ana btn-buyuk" ' + (tel ? 'href="tel:' + tel + '"' : 'aria-disabled="true"') + '>📞 Ara</a></div></section>';
  }

  function panelDegistir() { $('panel').classList.toggle('kapali'); setTimeout(function () { viewer && viewer.resize(); }, 300); }
  function menuKapat() { $('menu').classList.remove('acik'); }

  function butonlar() {
    $('btnPanel').addEventListener('click', panelDegistir);
    $('btnMenu').addEventListener('click', function (e) { e.stopPropagation(); $('menu').classList.toggle('acik'); });
    document.addEventListener('click', function (e) { if (!e.target.closest('#menu')) menuKapat(); });
    $('mDon').addEventListener('click', function () {
      menuKapat(); if (!viewer) return; donuyor = !donuyor;
      if (donuyor) viewer.startAutoRotate(-2); else viewer.stopAutoRotate();
      toast(donuyor ? 'Otomatik dönme açık' : 'Otomatik dönme kapalı');
    });
    $('mOtoTur').addEventListener('click', function () {
      menuKapat(); if (!viewer) return;
      if (otoTur) { clearInterval(otoTur); otoTur = null; this.textContent = '▶ Otomatik gezinti (sunum)'; toast('Otomatik gezinti durdu'); return; }
      this.textContent = '■ Otomatik gezintiyi durdur';
      viewer.startAutoRotate(-3); toast('Her ' + OTO_SURE / 1000 + ' saniyede bir sonraki odaya geçilecek');
      otoTur = setInterval(function () {
        var ids = ilan.sahneler.map(function (s) { return s.id; }), i = ids.indexOf(viewer.getScene());
        viewer.loadScene(ids[(i + 1) % ids.length]);
        setTimeout(function () { viewer.startAutoRotate(-3); }, 1200);
      }, OTO_SURE);
    });
    $('mTam').addEventListener('click', function () {
      menuKapat(); var el = document.documentElement;
      var acik = document.fullscreenElement || document.webkitFullscreenElement;
      var ac = el.requestFullscreen || el.webkitRequestFullscreen, kapat = document.exitFullscreen || document.webkitExitFullscreen;
      if (!(document.fullscreenEnabled || document.webkitFullscreenEnabled) || !ac) { // iPhone Safari tam ekranı desteklemez
        toast('iPhone\'da tam ekran için: Paylaş ⤴ › “Ana Ekrana Ekle”, sonra oradan açın.'); return;
      }
      if (acik) kapat.call(document); else { var r = ac.call(el); if (r && r.catch) r.catch(function () { toast('Tam ekran açılamadı'); }); }
    });
    $('mTum').addEventListener('click', function () { location.href = 'index.html'; });
    $('btnPaylas').addEventListener('click', function () {
      var url = location.href.split('#')[0];
      if (ilan.taslak) { toast('Bu bir taslak önizlemesi. Paylaşmak için önce yayınlayın.'); return; }
      if (navigator.share) { navigator.share({ title: ilan.baslik, text: ilan.baslik + ' – 360° sanal tur', url: url }).catch(function () {}); return; }
      modalAc('<h3>Paylaş</h3><input class="girdi" id="paylasUrl" readonly value="' + ST.esc(url) + '"><div class="dugmeler"><button class="btn-ana" id="kopyala">Linki kopyala</button><a class="btn btn-wa" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent(ilan.baslik + ' – 360° sanal tur: ' + url) + '">WhatsApp</a></div>');
      $('kopyala').addEventListener('click', function () {
        (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function () { toast('Link kopyalandı'); })
          .catch(function () { $('paylasUrl').select(); document.execCommand('copy'); toast('Link kopyalandı'); });
      });
    });
    $('mQR').addEventListener('click', function () {
      menuKapat(); var url = location.href.split('#')[0];
      var qr = qrcode(0, 'M'); qr.addData(url); qr.make(); var d = qr.createDataURL(8, 16);
      modalAc('<h3>QR kod</h3><p class="yardim">Broşüre, vitrin ilanına veya kartvizite ekleyin. Telefon kamerasıyla okutulunca tur açılır.</p><img alt="QR kod" src="' + d + '" style="width:260px;margin:0 auto"><div class="dugmeler"><a class="btn btn-ana btn-buyuk" download="qr-kod.gif" href="' + d + '">QR kodu indir</a></div>');
    });
    $('modalKapat').addEventListener('click', modalKapat);
    $('modal').addEventListener('click', function (e) { if (e.target === this) modalKapat(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { modalKapat(); menuKapat(); } });
  }
  function modalAc(h) { $('modalIcerik').innerHTML = h; $('modal').classList.add('acik'); }
  function modalKapat() { $('modal').classList.remove('acik'); }
  function toast(m) { var t = $('toast'); t.textContent = m; t.classList.add('goster'); clearTimeout(t._z); t._z = setTimeout(function () { t.classList.remove('goster'); }, 2600); }
})();
