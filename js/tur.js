/* Tur görüntüleme sayfası */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var params = new URLSearchParams(location.search);
  var slug = params.get('p') || '';
  var viewer = null, ilan = null, ayarlar = {}, otoTurZamanlayici = null, donuyor = true;
  var OTO_TUR_SURE = 15000;

  if (ST.dosyaKorumasi()) return;
  if (!slug || !/^[a-z0-9-_]+$/i.test(slug)) { $('baslik').textContent = 'İlan bulunamadı'; $('panel').innerHTML = '<section>Adres çubuğunda <code>?p=ilan-klasoru</code> eksik. <a href="index.html">Portföye dön</a></section>'; return; }
  var taban = 'tours/' + slug + '/';

  Promise.all([
    ST.getJSON('ayarlar.json').catch(function () { return {}; }),
    ST.getJSON(taban + 'property.json')
  ]).then(function (r) {
    ayarlar = r[0] || {}; ilan = r[1];
    baslat();
  }).catch(function (e) {
    $('baslik').textContent = 'İlan yüklenemedi';
    $('panel').innerHTML = '<section>' + ST.esc(e.message) + '</section>';
    console.error(e);
  });

  function baslat() {
    document.title = ilan.baslik + ' – 360° Sanal Tur';
    $('baslik').textContent = ilan.baslik;
    $('ustFiyat').textContent = ST.fiyatYaz(ilan);
    if (ilan.ornek) $('ornekRozet').innerHTML = '<span class="rozet sari">Örnek ilan</span>';
    if (window.innerWidth <= 820) $('panel').classList.add('kapali');
    paneliCiz();
    turuKur();
    seridiCiz();
    butonlar();
  }

  function turuKur() {
    var sahneler = {};
    (ilan.sahneler || []).forEach(function (s) {
      sahneler[s.id] = {
        type: 'equirectangular',
        panorama: taban + s.panorama,
        yaw: s.yaw || 0, pitch: s.pitch || 0, hfov: s.hfov || 110,
        hotSpots: (s.noktalar || []).map(function (n) {
          var h = { pitch: n.pitch, yaw: n.yaw, cssClass: 'st-hs-kok', createTooltipFunc: ST.hotspotOlustur, createTooltipArgs: n };
          if (n.tip === 'gecis') { h.type = 'scene'; h.sceneId = n.hedef; } else { h.type = 'info'; }
          return h;
        })
      };
    });
    var hash = new URLSearchParams(location.hash.slice(1));
    var ilk = hash.get('sahne');
    if (!ilk || !sahneler[ilk]) ilk = ilan.ilkSahne && sahneler[ilan.ilkSahne] ? ilan.ilkSahne : Object.keys(sahneler)[0];
    if (!ilk) { $('panorama').innerHTML = '<div class="bos" style="color:#fff">Bu ilanda henüz panorama yok.</div>'; return; }
    viewer = pannellum.viewer('panorama', {
      default: {
        firstScene: ilk,
        sceneFadeDuration: 900,
        autoLoad: true,
        autoRotate: -2,
        autoRotateInactivityDelay: 6000,
        showControls: true,
        showFullscreenCtrl: true,
        showZoomCtrl: true,
        orientationOnByDefault: false,
        compass: false,
        minHfov: 40, maxHfov: 120,
        strings: {
          loadButtonLabel: 'Panoramayı<br>Yükle', loadingLabel: 'Yükleniyor…',
          bylineLabel: '%s', noPanoramaError: 'Panorama görseli belirtilmemiş.',
          fileAccessError: '%s dosyasına erişilemedi.', malformedURLError: 'Panorama adresi hatalı.',
          iOS8WebGLError: 'iOS 8 WebGL sorunu nedeniyle yalnızca düşük çözünürlüklü gösterim yapılabilir.',
          genericWebGLError: 'Tarayıcınız WebGL desteklemiyor.',
          textureSizeError: 'Panorama bu cihaz için fazla büyük (%s px). Cihaz en fazla %s px destekliyor. Görseli 4096 px genişliğe küçültün.',
          unknownError: 'Bilinmeyen hata. Tarayıcı konsoluna bakın.'
        }
      },
      scenes: sahneler
    });
    viewer.on('scenechange', sahneDegisti);
    viewer.on('load', function () { sahneDegisti(viewer.getScene()); });
    viewer.on('error', function (e) { console.error('Pannellum:', e); });
    window.__viewer = viewer; // test ve hata ayıklama için
  }

  function sahneDegisti(id) {
    var s = (ilan.sahneler || []).filter(function (x) { return x.id === id; })[0];
    $('sahneAdi').textContent = s ? s.ad : '';
    Array.prototype.forEach.call(document.querySelectorAll('#serit button'), function (b) {
      b.classList.toggle('secili', b.dataset.id === id);
      if (b.dataset.id === id && b.scrollIntoView) b.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    });
    history.replaceState(null, '', '#sahne=' + encodeURIComponent(id));
  }

  function seridiCiz() {
    var el = $('serit');
    (ilan.sahneler || []).forEach(function (s) {
      var b = document.createElement('button');
      b.dataset.id = s.id; b.title = s.ad;
      var img = document.createElement('img'); img.alt = ''; img.loading = 'lazy'; img.src = taban + (s.kucuk || s.panorama);
      var sp = document.createElement('span'); sp.textContent = s.ad;
      b.appendChild(img); b.appendChild(sp);
      b.addEventListener('click', function () { if (viewer && viewer.getScene() !== s.id) viewer.loadScene(s.id); });
      el.appendChild(b);
    });
    if ((ilan.sahneler || []).length < 2) el.style.display = 'none';
  }

  function paneliCiz() {
    var b = ilan.bilgiler || {}, h = [];
    h.push('<section><div>' + '<span class="rozet kirmizi">' + ST.esc(ilan.durum || '') + '</span> <span class="rozet">' + (ilan.tip === 'ticari' ? 'Ticari' : 'Daire / Konut') + '</span>' + (ilan.ornek ? ' <span class="rozet sari">Örnek</span>' : '') + '</div>' +
      '<h2 style="margin-top:8px">' + ST.esc(ilan.baslik) + '</h2>' +
      '<div class="fiyat-buyuk">' + ST.esc(ST.fiyatYaz(ilan)) + '</div>' +
      '<div class="konum" style="color:var(--soluk);font-size:14px">📍 ' + ST.esc(ST.konumYaz(ilan)) + '</div>' +
      (ilan.aciklama ? '<p class="aciklama">' + ST.esc(ilan.aciklama) + '</p>' : '') + '</section>');

    var satirlar = ST.alanlarFor(ilan.tip).map(function (a) {
      var v = ST.degerYaz(a, b[a.k]);
      return v ? '<tr><td>' + ST.esc(a.l) + '</td><td>' + ST.esc(v) + '</td></tr>' : '';
    }).join('');
    if (satirlar) h.push('<section><h3>' + (ilan.tip === 'ticari' ? 'Ticari Özellikler' : 'Daire Özellikleri') + '</h3><table class="tablo">' + satirlar + '</table></section>');

    if ((ilan.ozellikler || []).length) h.push('<section><h3>Öne Çıkanlar</h3><div class="cipler">' + ilan.ozellikler.map(function (o) { return '<span>' + ST.esc(o) + '</span>'; }).join('') + '</div></section>');

    if (ilan.katPlani) h.push('<section class="kat-plani"><h3>Kat Planı</h3><img id="katPlaniImg" alt="Kat planı" src="' + ST.esc(taban + ilan.katPlani) + '"></section>');

    var k = ilan.konum || {};
    var haritaQ = k.harita || ST.konumYaz(ilan);
    if (haritaQ) h.push('<section class="harita"><h3>Konum</h3><iframe loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Harita" src="https://maps.google.com/maps?q=' + encodeURIComponent(haritaQ) + '&z=15&hl=tr&output=embed"></iframe>' +
      '<div class="dugmeler"><a class="btn" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(haritaQ) + '">Google Haritalar\'da aç</a></div></section>');

    h.push(danismanKarti());
    h.push('<section style="font-size:12px;color:var(--soluk)">Tur: Pannellum (MIT). ' + (ilan.ornek ? 'Örnek görseller: Poly Haven (CC0).' : '') + '</section>');
    $('panel').innerHTML = h.join('');
    var kp = $('katPlaniImg');
    if (kp) kp.addEventListener('click', function () { modalAc('<img src="' + ST.esc(kp.src) + '" alt="Kat planı">'); });
  }

  function danismanKarti() {
    var d = Object.assign({}, ayarlar.danisman || {}, ilan.danisman || {});
    var yt = function (v) { return ST.yerTutucuMu(v) ? '<span class="yer-tutucu" title="ayarlar.json içinden doldurun">' + ST.esc(v || '[doldurulmadı]') + '</span>' : ST.esc(v); };
    var bas = (d.ad && !ST.yerTutucuMu(d.ad)) ? d.ad.split(/\s+/).map(function (x) { return x[0]; }).slice(0, 2).join('') : '?';
    var tel = (d.telefon && !ST.yerTutucuMu(d.telefon)) ? d.telefon.replace(/[^\d+]/g, '') : '';
    var wa = (d.whatsapp || '').replace(/\D/g, '');
    var mesaj = 'Merhaba, "' + ilan.baslik + '" ilanı hakkında bilgi almak istiyorum. ' + location.href.split('#')[0];
    return '<section><h3>Danışmanınız</h3><div class="danisman">' +
      '<div class="foto"' + (d.foto ? ' style="background-image:url(\'' + ST.esc(d.foto) + '\')"' : '') + '>' + (d.foto ? '' : ST.esc(bas)) + '</div>' +
      '<div><div class="ad">' + yt(d.ad) + '</div><div class="alt">' + ST.esc(d.unvan || '') + '</div><div class="alt">' + yt(d.ofis) + '</div>' +
      '<div class="alt">☎ ' + yt(d.telefon) + '</div>' + (d.eposta ? '<div class="alt">✉ ' + yt(d.eposta) + '</div>' : '') + '</div></div>' +
      '<div class="dugmeler">' +
        '<a class="btn btn-wa" ' + (wa ? 'href="https://wa.me/' + wa + '?text=' + encodeURIComponent(mesaj) + '" target="_blank" rel="noopener"' : 'aria-disabled="true" title="ayarlar.json > danisman.whatsapp alanını doldurun"') + '>WhatsApp ile Yaz</a>' +
        '<a class="btn btn-ana" ' + (tel ? 'href="tel:' + tel + '"' : 'aria-disabled="true"') + '>Ara</a>' +
      '</div></section>';
  }

  function butonlar() {
    $('btnPanel').addEventListener('click', function () { $('panel').classList.toggle('kapali'); setTimeout(function () { viewer && viewer.resize(); }, 300); });
    $('btnDon').classList.add('aktif');
    $('btnDon').addEventListener('click', function () {
      if (!viewer) return;
      donuyor = !donuyor;
      if (donuyor) viewer.startAutoRotate(-2); else viewer.stopAutoRotate();
      this.classList.toggle('aktif', donuyor);
    });
    $('btnOtoTur').addEventListener('click', function () {
      if (!viewer) return;
      if (otoTurZamanlayici) { clearInterval(otoTurZamanlayici); otoTurZamanlayici = null; this.classList.remove('aktif'); toast('Otomatik tur durdu'); return; }
      this.classList.add('aktif');
      viewer.startAutoRotate(-3); donuyor = true; $('btnDon').classList.add('aktif');
      toast('Sunum modu: her ' + (OTO_TUR_SURE / 1000) + ' sn\'de bir sonraki oda');
      otoTurZamanlayici = setInterval(function () {
        var ids = (ilan.sahneler || []).map(function (s) { return s.id; });
        var i = ids.indexOf(viewer.getScene());
        viewer.loadScene(ids[(i + 1) % ids.length]);
        setTimeout(function () { viewer.startAutoRotate(-3); }, 1200);
      }, OTO_TUR_SURE);
    });
    $('btnPaylas').addEventListener('click', function () {
      var url = location.href.split('#')[0];
      if (navigator.share) { navigator.share({ title: ilan.baslik, text: ilan.baslik + ' – 360° sanal tur', url: url }).catch(function () {}); return; }
      var wa = 'https://wa.me/?text=' + encodeURIComponent(ilan.baslik + ' – 360° sanal tur: ' + url);
      modalAc('<h3>Bağlantıyı paylaş</h3><input id="paylasUrl" style="width:100%;padding:8px" readonly value="' + ST.esc(url) + '">' +
        '<div class="dugmeler"><button class="btn-ana" id="kopyala">Kopyala</button><a class="btn btn-wa" target="_blank" rel="noopener" href="' + ST.esc(wa) + '">WhatsApp\'ta paylaş</a></div>');
      $('kopyala').addEventListener('click', function () { kopyala(url); });
    });
    $('btnQR').addEventListener('click', function () {
      var url = location.href.split('#')[0];
      var qr = qrcode(0, 'M'); qr.addData(url); qr.make();
      var dataUrl = qr.createDataURL(8, 16);
      modalAc('<h3>QR Kod</h3><p style="font-size:13px;color:var(--soluk);max-width:320px">İlan broşürüne, vitrin ilanına veya Instagram hikâyesine ekleyin. Telefon kamerasıyla okutunca tur açılır.</p><div id="qr"><img alt="QR kod" src="' + dataUrl + '" width="280"></div>' +
        '<div class="dugmeler" style="justify-content:center"><a class="btn btn-ana" download="qr-' + ST.esc(slug) + '.gif" href="' + dataUrl + '">QR\'ı indir</a></div>');
    });
    $('modalKapat').addEventListener('click', modalKapat);
    $('modal').addEventListener('click', function (e) { if (e.target === this) modalKapat(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') modalKapat(); });
  }

  function kopyala(t) {
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { toast('Bağlantı kopyalandı'); })
      .catch(function () { var i = $('paylasUrl'); if (i) { i.select(); document.execCommand('copy'); toast('Bağlantı kopyalandı'); } });
  }
  function modalAc(html) { $('modalIcerik').innerHTML = html; $('modal').classList.add('acik'); }
  function modalKapat() { $('modal').classList.remove('acik'); }
  function toast(m) { var t = $('toast'); t.textContent = m; t.classList.add('goster'); clearTimeout(t._z); t._z = setTimeout(function () { t.classList.remove('goster'); }, 2500); }
})();
