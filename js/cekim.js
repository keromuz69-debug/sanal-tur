/* Uygulama içi panorama çekimi: canlı kamera + yön sensörü + otomatik deklanşör.
   Kamera bir kez açılır; odalar art arda çekilir (her oda bitince arka planda birleştirilir). */
(function (w) {
  'use strict';
  var ADIM = 30;            // kareler arası hedef dönüş (derece)
  var HEDEF_KARE = 12;      // tam tur
  var UZUN = 1600;          // saklanan kare uzun kenarı (px) – iOS belleği için sınırlı
  var BINME = 0.34;         // soldaki rehber şeridi oranı
  var ODA_ADLARI = ['Salon', 'Mutfak', 'Yatak Odası', 'Banyo', 'Balkon', 'Giriş', 'Oda', 'Dükkan', 'Ofis'];

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  // Euler (alpha,beta,gamma) -> kameranın baktığı yön (yaw), eğim (pitch), yatay denge (roll)
  function yonHesapla(a, b, g) {
    var r = Math.PI / 180, cA = Math.cos(a * r), sA = Math.sin(a * r), cB = Math.cos(b * r), sB = Math.sin(b * r), cG = Math.cos(g * r), sG = Math.sin(g * r);
    var R = [ // R = Rz(a)·Rx(b)·Ry(g)
      [cA * cG - sA * sB * sG, -sA * cB, cA * sG + sA * sB * cG],
      [sA * cG + cA * sB * sG, cA * cB, sA * sG - cA * sB * cG],
      [-cB * sG, sB, cB * cG]
    ];
    var fx = -R[0][2], fy = -R[1][2], fz = -R[2][2];
    return { yaw: Math.atan2(fx, fy) / r, pitch: Math.asin(Math.max(-1, Math.min(1, fz))) / r, roll: Math.atan2(R[2][0], R[2][1]) / r };
  }

  // secenek: { hemen (dokunuş içinde çağrıldı), tekOda, ad, varsayilanAd(), odaBitti({kareler, ad}) , kapandi() }
  var acik = null;
  function ac(secenek) {
    if (acik) return acik; // aynı anda tek çekim ekranı
    secenek = secenek || {};
    var kareler = [], akis = null, yonVar = false, yonIzni = 'bilinmiyor', durum = 'baslangic';
    var sonYon = null, yawAcik = 0, oncekiYaw = null, sonCekimYaw = null, ornekler = [], kapandi = false, bekle = false, ilkDengeZ = 0;
    var secilenAd = secenek.ad || '', bitenOdaSayisi = 0;

    var kok = el('div', 'cekim');
    kok.innerHTML =
      '<video playsinline muted autoplay></video><canvas class="hayalet"></canvas><div class="flas"></div>' +
      '<div class="c-ust"><div class="c-ust-satir"><button class="btn-ikon cam" data-i="kapat" aria-label="Kapat">✕</button><div class="c-yonerge" id="cYonerge">Kamera açılıyor…</div><div class="c-sayac" id="cSayac">0/' + HEDEF_KARE + '</div></div>' +
      '<div class="c-cipler" id="cCipler"></div></div>' +
      '<div class="c-terazi"><div class="c-cizgi" id="cCizgi"></div><div class="c-arti"></div></div>' +
      '<div class="c-ok" id="cOk"><b>›</b><span>Sağa dön</span></div>' +
      '<div class="c-ipucu" id="cIpucu" style="display:none"></div>' +
      '<div class="c-alt"><button class="cam" data-i="sil" id="cSil" disabled>↶ Son kareyi sil</button>' +
      '<button class="c-deklansor" data-i="cek" id="cDek" aria-label="Kare çek"><svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="36" class="iz"/><circle cx="40" cy="40" r="36" class="ilerleme" id="cHalka"/></svg><span></span></button>' +
      '<button class="cam" data-i="bitir" id="cBitir" disabled>Bitir ✓</button></div>' +
      '<div class="c-panel" id="cPanel" hidden></div>';
    document.body.appendChild(kok);
    document.documentElement.classList.add('cekim-acik');
    var video = kok.querySelector('video'), hayalet = kok.querySelector('.hayalet'), hx = hayalet.getContext('2d');
    var $ = function (id) { return kok.querySelector('#' + id); };
    var CEVRE = 2 * Math.PI * 36; $('cHalka').style.strokeDasharray = CEVRE; $('cHalka').style.strokeDashoffset = CEVRE;

    function yonerge(t) { $('cYonerge').textContent = t; }
    function ipucu(t, tur) { var e = $('cIpucu'); if (e.textContent !== (t || '')) e.textContent = t || ''; e.className = 'c-ipucu' + (tur ? ' ' + tur : ''); e.style.display = t ? '' : 'none'; }
    function ad() { return secilenAd || (secenek.varsayilanAd ? secenek.varsayilanAd() : 'Oda'); }
    function ciplerCiz(kap) {
      var html = ODA_ADLARI.map(function (a) { return '<button type="button" data-ad="' + esc(a) + '"' + (a === secilenAd ? ' class="secili"' : '') + '>' + esc(a) + '</button>'; }).join('');
      if (secilenAd && ODA_ADLARI.indexOf(secilenAd) < 0) html = '<button type="button" class="secili" data-ad="' + esc(secilenAd) + '">' + esc(secilenAd) + '</button>' + html;
      kap.innerHTML = html;
    }
    ciplerCiz($('cCipler'));

    function boyutla() { hayalet.width = kok.clientWidth; hayalet.height = kok.clientHeight; hayaletCiz(); }
    w.addEventListener('resize', boyutla);

    kok.addEventListener('click', function (e) {
      var c = e.target.closest('[data-ad]');
      if (c) { secilenAd = secilenAd === c.dataset.ad ? '' : c.dataset.ad; $$(kok, '[data-ad]').forEach(function (x) { x.classList.toggle('secili', x.dataset.ad === secilenAd); }); adBaslik(); return; }
      var b = e.target.closest('[data-i]'); if (!b) return;
      var i = b.dataset.i;
      if (i === 'kapat') { if (durum !== 'cekim' || !kareler.length || confirm('Bu odanın çekimi iptal edilsin mi?')) kapat(false); }
      else if (i === 'basla') { panelGizle(); baslat(); }
      else if (i === 'cek') cek();
      else if (i === 'sil') sil();
      else if (i === 'bitir') { if (kareler.length) bitir(); else kapat(false); }
      else if (i === 'sonraki') { secilenAd = ''; yeniOda(); }
      else if (i === 'tekrar') { if (secenek.tekrar) secenek.tekrar(); bitenOdaSayisi--; secilenAd = tekrarAd; yeniOda(); }
      else if (i === 'tamam') kapat(false);
    });
    function $$(k, s) { return Array.prototype.slice.call(k.querySelectorAll(s)); }
    function adBaslik() { var h = kok.querySelector('.c-panel h3 b'); if (h) h.textContent = ad(); }

    function panel(html) { var p = $('cPanel'); p.innerHTML = html; p.hidden = false; kok.classList.add('panelli'); }
    function panelGizle() { $('cPanel').hidden = true; kok.classList.remove('panelli'); }

    // iOS: hareket izni ve kamera, kullanıcının dokunuşu içinde istenmeli
    var KISIT = { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 }, aspectRatio: { ideal: 4 / 3 } };
    var HARIC = /(ultra|tele|dual|triple|ikili|üçlü|çift|depth|derinlik)/i;
    function anaKamera(s) { // iPhone: ultra geniş / tele / sanal çoklu kamera yerine ana (1x) geniş kamera
      var tr = s.getVideoTracks()[0], etiket = (tr && tr.label) || '';
      if (!HARIC.test(etiket) || !navigator.mediaDevices.enumerateDevices) return s;
      return navigator.mediaDevices.enumerateDevices().then(function (l) {
        var ana = l.filter(function (d) { return d.kind === 'videoinput' && /(back|arka|rear)/i.test(d.label) && !HARIC.test(d.label); })[0];
        if (!ana) return s;
        s.getTracks().forEach(function (t) { t.stop(); });
        var k = Object.assign({}, KISIT, { deviceId: { exact: ana.deviceId } }); delete k.facingMode;
        return navigator.mediaDevices.getUserMedia({ audio: false, video: k });
      }).catch(function () { return s; });
    }
    function kameraIste() { // ayrıntılı istek reddedilirse sade istekle tekrar dene
      return navigator.mediaDevices.getUserMedia({ audio: false, video: KISIT }).catch(function (e) {
        if (e && /Overconstrained|NotSupported|NotReadable|TypeError|Abort/i.test(e.name)) return navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'environment' } });
        throw e;
      });
    }
    function kameraHata(e) {
      var n = e && e.name;
      if (n === 'NotAllowedError' || n === 'SecurityError') return 'Kamera izni verilmedi. iPhone: Ayarlar › Safari › Kamera › “İzin Ver”, sonra sayfayı yenileyin.';
      if (n === 'NotFoundError' || n === 'OverconstrainedError') return 'Bu cihazda kullanılabilir kamera bulunamadı.';
      if (n === 'NotReadableError' || n === 'AbortError') return 'Kamera şu an başka bir uygulama tarafından kullanılıyor. Diğer kamera uygulamalarını kapatıp tekrar deneyin.';
      return 'Kamera açılamadı. Sayfayı yenileyip tekrar deneyin ya da “Galeriden Seç”i kullanın.';
    }
    function kameraAc() {
      return kameraIste().then(anaKamera).then(function (s) {
        if (kapandi) { s.getTracks().forEach(function (t) { t.stop(); }); return; }
        if (akis) akis.getTracks().forEach(function (t) { t.stop(); });
        akis = s; video.srcObject = s;
        return video.play();
      });
    }
    // Uygulamadan çıkıp dönünce (iOS kamerayı durdurur) akışı yeniden başlat
    function gorunurluk() {
      if (document.hidden) { ornekler = []; ilkDengeZ = 0; return; }
      var tr = akis && akis.getVideoTracks()[0];
      if (akis && (!tr || tr.readyState === 'ended')) kameraAc().catch(function () { yonerge('Kamera yeniden açılamadı. Kapatıp tekrar deneyin.'); });
    }
    document.addEventListener('visibilitychange', gorunurluk);
    function sayfaGidiyor() { kapat(true); }
    w.addEventListener('pagehide', sayfaGidiyor);
    // Geri tuşu/hareketi: sayfadan çıkmak yerine çekim ekranını kapatsın
    try { history.pushState({ cekim: 1 }, ''); } catch (e) {}
    function geriTusu() { kapat(true); }
    w.addEventListener('popstate', geriTusu);
    var opencvIstendi = false;
    function opencvOnYukle() { // birleştirme kütüphanesini çekim sırasında önbelleğe al (zayıf internette bekleme olmasın)
      if (opencvIstendi || w.__opencvOnYuk) return; opencvIstendi = w.__opencvOnYuk = true;
      try { fetch('vendor/opencv/opencv.js', { cache: 'force-cache' }).catch(function () { w.__opencvOnYuk = false; }); } catch (e) {}
    }
    function baslat() {
      if (!w.isSecureContext) { yonerge('Kamera için güvenli bağlantı (https) gerekir.'); return; }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { yonerge('Bu tarayıcı uygulama içi kamerayı desteklemiyor. “Galeriden Seç”i kullanın.'); return; }
      var izinP = Promise.resolve('yok');
      try {
        if (w.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function') izinP = DeviceOrientationEvent.requestPermission().catch(function () { return 'denied'; });
        else if (w.DeviceOrientationEvent) izinP = Promise.resolve('granted');
      } catch (e) { izinP = Promise.resolve('denied'); }
      var kameraP = kameraIste();
      kameraP.catch(function () {});
      durum = 'cekim';
      izinP.then(function (s) {
        yonIzni = s;
        w.addEventListener('deviceorientation', yonGeldi, true); // izin yoksa olay gelmez; zararsız
        return kameraP;
      }).then(anaKamera).then(function (s) {
        if (kapandi) { s.getTracks().forEach(function (t) { t.stop(); }); return; }
        akis = s; video.srcObject = s;
        try { var tr = s.getVideoTracks()[0], cap = tr.getCapabilities ? tr.getCapabilities() : {}; if (cap.focusMode && cap.focusMode.indexOf('continuous') > -1) tr.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(function () {}); } catch (e) {}
        return video.play();
      }).then(function () {
        if (kapandi) return;
        boyutla(); guncelle();
        setTimeout(function () { if (!yonVar && !kapandi) ipucu(yonIzni === 'denied' && !yonVar ? 'Hareket izni verilmedi: her kareyi deklanşörle çekin, soldaki silik şeridi hizalayın.' : 'Yön sensörü bulunamadı: her kareyi deklanşörle çekin, soldaki silik şeridi hizalayın.', 'uyari'); }, 1500);
        opencvOnYukle();
        dongu();
      }).catch(function (e) {
        console.warn('kamera', e);
        var m = kameraHata(e);
        yonerge(m);
        panel('<h3>Kamera açılamadı</h3><p>' + esc(m) + '</p><p class="kucuk">Panoramayı telefonun kendi Kamera uygulamasında (PANO) çekip “Galeriden Seç” ile de ekleyebilirsiniz.</p><button class="btn btn-ana btn-buyuk btn-blok" data-i="tamam">Tamam</button>');
      });
    }

    function yonGeldi(ev) {
      if (ev.alpha == null || ev.beta == null) return;
      yonVar = true;
      var y = yonHesapla(ev.alpha, ev.beta, ev.gamma || 0);
      if (oncekiYaw !== null) { var d = ((y.yaw - oncekiYaw + 540) % 360) - 180; yawAcik += d; }
      oncekiYaw = y.yaw;
      sonYon = { yaw: yawAcik, pitch: y.pitch, roll: y.roll };
      var t = performance.now(); ornekler.push({ t: t, yaw: yawAcik }); while (ornekler.length && t - ornekler[0].t > 450) ornekler.shift();
    }
    function sabit() {
      if (ornekler.length < 3) return false;
      var mn = Infinity, mx = -Infinity; ornekler.forEach(function (o) { mn = Math.min(mn, o.yaw); mx = Math.max(mx, o.yaw); });
      return mx - mn < 1.6;
    }

    function dongu() {
      if (kapandi) return;
      requestAnimationFrame(dongu);
      if (durum !== 'cekim') return;
      if (w.innerWidth > w.innerHeight * 1.05) { ilkDengeZ = 0; ipucu('Telefonu dik (portre) tutun', 'uyari'); return; }
      if (!sonYon) return;
      var dengeli = Math.abs(sonYon.roll) < 6 && Math.abs(sonYon.pitch) < 18;
      var cz = $('cCizgi'); cz.style.transform = 'rotate(' + sonYon.roll.toFixed(1) + 'deg) translateY(' + (sonYon.pitch * 3).toFixed(0) + 'px)';
      cz.classList.toggle('iyi', dengeli);
      if (!kareler.length) { // ilk kare: düz ve sabit tutulunca kendiliğinden
        $('cOk').classList.add('sonuk');
        if (!dengeli) { ilkDengeZ = 0; ipucu(Math.abs(sonYon.roll) >= 6 ? 'Telefonu düz tutun (çizgi yeşil olsun)' : 'Telefonu dik tutun, ne yukarı ne aşağı', 'uyari'); return; }
        if (!sabit()) { ilkDengeZ = 0; ipucu('Sabit tutun…', 'iyi'); return; }
        if (!ilkDengeZ) ilkDengeZ = performance.now();
        if (performance.now() - ilkDengeZ < 1200) { ipucu('Sabit tutun… başlıyor', 'iyi'); return; }
        ilkDengeZ = 0; cek(); return;
      }
      var fark = sonYon.yaw - sonCekimYaw;
      $('cOk').classList.toggle('sonuk', !(fark < ADIM - 3));
      if (fark < -8) { ipucu('Sağa doğru dönün →', 'uyari'); return; }
      if (fark > ADIM + 12) { ipucu('Biraz fazla döndünüz, hafifçe sola dönün ←', 'uyari'); return; }
      if (fark < ADIM - 2) { ipucu('Yavaşça sağa dönün… ' + Math.max(0, Math.round(ADIM - fark)) + '°', ''); return; }
      if (!dengeli) { ipucu('Telefonu düz ve dik tutun', 'uyari'); return; }
      if (!sabit()) { ipucu('Sabit tutun…', 'iyi'); return; }
      cek();
    }

    function cek() {
      if (bekle || !video.videoWidth || durum !== 'cekim') return;
      bekle = true;
      var vw = video.videoWidth, vh = video.videoHeight, s = Math.min(1, UZUN / Math.max(vw, vh));
      var c = document.createElement('canvas'); c.width = Math.round(vw * s); c.height = Math.round(vh * s);
      c.getContext('2d').drawImage(video, 0, 0, c.width, c.height);
      var yon = sonYon ? { yaw: sonYon.yaw, pitch: sonYon.pitch, roll: sonYon.roll } : {};
      var kucuk = document.createElement('canvas'); kucuk.width = Math.round(c.width / 3); kucuk.height = Math.round(c.height / 3);
      kucuk.getContext('2d').drawImage(c, 0, 0, kucuk.width, kucuk.height);
      kok.querySelector('.flas').classList.add('acik'); setTimeout(function () { kok.querySelector('.flas').classList.remove('acik'); }, 140);
      if (navigator.vibrate) navigator.vibrate(30);
      c.toBlob(function (b) {
        c.width = c.height = 0;
        kareler.push({ blob: b, yaw: yon.yaw, pitch: yon.pitch, roll: yon.roll, kucuk: kucuk });
        sonCekimYaw = yonVar ? yon.yaw : null;
        guncelle(); hayaletCiz();
        bekle = false;
        var toplam = kareler.length > 1 && yonVar ? Math.abs(kareler[kareler.length - 1].yaw - kareler[0].yaw) : 0;
        if ((yonVar && toplam >= 360 - ADIM - 5) || kareler.length >= 16) { ipucu('Tam tur tamamlandı ✓', 'iyi'); durum = 'bitiyor'; setTimeout(bitir, 400); }
      }, 'image/jpeg', 0.92);
    }
    function sil() {
      if (!kareler.length) return;
      kareler.pop();
      var son = kareler[kareler.length - 1];
      sonCekimYaw = son && yonVar ? son.yaw : null;
      guncelle(); hayaletCiz();
    }
    function guncelle() {
      var n = kareler.length;
      $('cSayac').textContent = n + '/' + HEDEF_KARE;
      var oran = yonVar && n > 1 ? Math.min(1, (Math.abs(kareler[n - 1].yaw - kareler[0].yaw) + ADIM) / 360) : Math.min(1, n / HEDEF_KARE);
      $('cHalka').style.strokeDashoffset = CEVRE * (1 - oran);
      $('cSil').disabled = !n; $('cBitir').disabled = n === 1;
      $('cBitir').textContent = n ? 'Bitir (' + n + ') ✓' : 'Kapat';
      if (!n) yonerge(yonVar ? 'Olduğun yerde dur, telefonu dik tut. Çekim kendiliğinden başlar.' : 'Olduğun yerde dur, telefonu dik tut. İlk kare için deklanşöre bas.');
      else if (yonVar) yonerge('Yavaşça sağa dön. Kareler kendiliğinden çekilir.');
      else yonerge('Sağa dönün; soldaki silik görüntüyü canlı görüntüyle hizalayıp deklanşöre basın.');
    }
    function hayaletCiz() { // önceki karenin sağ kısmı ekranın solunda silik
      var W = hayalet.width, H = hayalet.height; hx.clearRect(0, 0, W, H);
      var son = kareler[kareler.length - 1]; if (!son || durum !== 'cekim') return;
      var k = son.kucuk, sc = Math.max(W / k.width, H / k.height), dw = k.width * sc, dh = k.height * sc, ox = (W - dw) / 2, oy = (H - dh) / 2;
      var gen = W * BINME;
      hx.save(); hx.beginPath(); hx.rect(0, 0, gen, H); hx.clip();
      hx.globalAlpha = 0.5; hx.drawImage(k, ox - (W - gen), oy, dw, dh); hx.restore();
      hx.strokeStyle = 'rgba(255,255,255,.9)'; hx.setLineDash([8, 6]); hx.lineWidth = 2; hx.beginPath(); hx.moveTo(gen, 0); hx.lineTo(gen, H); hx.stroke(); hx.setLineDash([]);
    }
    function bitir() {
      if (kareler.length < 2) { durum = 'cekim'; ipucu('En az 2 kare çekin', 'uyari'); return; }
      var odaAd = ad();
      var k = kareler.map(function (x) { return { blob: x.blob, yaw: yonVar ? x.yaw : undefined, pitch: yonVar ? x.pitch : undefined, roll: yonVar ? x.roll : undefined }; });
      kareler = []; sonCekimYaw = null; durum = 'ara'; hayaletCiz(); guncelle(); ipucu('');
      bitenOdaSayisi++;
      if (secenek.odaBitti) secenek.odaBitti({ kareler: k, ad: odaAd });
      if (secenek.tekOda) { kapat(false); return; }
      secilenAd = '';
      panel('<h3>✓ <b></b> çekildi</h3><p class="c-durum" id="cDurum">Arka planda birleştiriliyor… Siz sonraki odaya geçebilirsiniz.</p>' +
        '<button class="btn btn-ana btn-buyuk btn-blok" data-i="sonraki">📷 Sonraki Odayı Çek</button>' +
        '<div class="c-panel-alt"><button class="btn" data-i="tekrar">↺ Bu odayı tekrar çek</button><button class="btn" data-i="tamam">Bitti, odaları gör</button></div>');
      kok.querySelector('.c-panel h3 b').textContent = odaAd;
      tekrarAd = odaAd;
    }
    var tekrarAd = '';
    function yeniOda() {
      ciplerCiz($('cCipler'));
      panelGizle(); kareler = []; sonCekimYaw = null; ilkDengeZ = 0; durum = 'cekim'; guncelle(); hayaletCiz();
    }
    function kapat(gecmistenGeldi) {
      if (kapandi) return;
      kapandi = true; acik = null;
      w.removeEventListener('deviceorientation', yonGeldi, true); w.removeEventListener('resize', boyutla);
      document.removeEventListener('visibilitychange', gorunurluk); w.removeEventListener('pagehide', sayfaGidiyor); w.removeEventListener('popstate', geriTusu);
      if (gecmistenGeldi !== true && history.state && history.state.cekim) { try { history.back(); } catch (e) {} }
      video.srcObject = null;
      if (akis) akis.getTracks().forEach(function (t) { t.stop(); });
      kok.remove(); document.documentElement.classList.remove('cekim-acik');
      if (secenek.kapandi) secenek.kapandi(bitenOdaSayisi);
    }

    if (secenek.hemen) baslat();
    else {
      yonerge('Panorama çekimi');
      panel('<h3>Odanın ortasında durun</h3><p>Telefonu dik tutup yavaşça sağa döneceksiniz; kareler kendiliğinden çekilir.</p>' +
        '<p class="kucuk">Oda adını yukarıdan seçebilirsiniz (isteğe bağlı).</p>' +
        '<button class="btn btn-ana btn-buyuk btn-blok" data-i="basla">📷 Çekime Başla</button>');
    }
    var api = {
      durum: function (metin) { var d = kok.querySelector('#cDurum'); if (d) d.textContent = metin; },
      kapat: kapat,
      cek: cek, bitir: bitir, kareler: function () { return kareler; }
    };
    w.__cekim = api; acik = api;
    return api;
  }
  w.STCekim = { ac: ac, yonHesapla: yonHesapla, ODA_ADLARI: ODA_ADLARI };
})(window);
