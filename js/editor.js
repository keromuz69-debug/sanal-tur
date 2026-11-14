/* Tur editörü: panorama yükle, nokta yerleştir, property.json / ZIP dışa aktar */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var form = $('form');
  var tip = 'daire';
  var sahneler = [];      // {id, ad, yaw, pitch, hfov, noktalar[], blob, ext, url, thumbBlob, thumbUrl}
  var secili = -1;
  var ilkSahne = null;
  var katPlani = null;    // {blob, ext, url}
  var viewer = null;
  var mod = null;         // 'gecis' | 'bilgi' | null
  var degisti = false;
  var slugElle = false;

  ST.dosyaKorumasi();

  /* ---------- Form ---------- */
  function alanlariCiz() {
    var mevcut = alanDegerleri();
    $('ozBaslik').textContent = '3 · ' + (tip === 'ticari' ? 'Ticari Özellikler' : 'Daire Özellikleri');
    $('alanlar').innerHTML = ST.alanlarFor(tip).map(function (a) {
      var dl = a.o ? '<datalist id="dl_' + a.k + '">' + a.o.map(function (o) { return '<option>' + ST.esc(o) + '</option>'; }).join('') + '</datalist>' : '';
      return '<label>' + ST.esc(a.l) + '<input data-alan="' + a.k + '"' + (a.t === 'number' ? ' type="number" min="0"' : '') + (a.o ? ' list="dl_' + a.k + '"' : '') + '>' + dl + '</label>';
    }).join('');
    alanDoldur(mevcut);
    $('ozCipler').innerHTML = ST.HAZIR_OZELLIKLER[tip].map(function (o) { return '<button type="button">' + ST.esc(o) + '</button>'; }).join('');
    Array.prototype.forEach.call(document.querySelectorAll('.tip-secici button'), function (b) { b.classList.toggle('aktif', b.dataset.tip === tip); });
  }
  function alanDegerleri() {
    var o = {};
    Array.prototype.forEach.call(document.querySelectorAll('[data-alan]'), function (i) {
      if (i.value !== '') o[i.dataset.alan] = i.type === 'number' ? Number(i.value) : i.value;
    });
    return o;
  }
  function alanDoldur(o) {
    Array.prototype.forEach.call(document.querySelectorAll('[data-alan]'), function (i) { i.value = o[i.dataset.alan] != null ? o[i.dataset.alan] : ''; });
  }
  document.querySelector('.tip-secici').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    tip = b.dataset.tip; alanlariCiz(); degisti = true;
  });
  $('ozCipler').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var ta = form.elements.ozellikler;
    var liste = ta.value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    if (liste.indexOf(b.textContent) === -1) liste.push(b.textContent);
    ta.value = liste.join('\n'); degisti = true;
  });
  form.addEventListener('input', function (e) {
    degisti = true;
    if (e.target.name === 'slug') slugElle = !!e.target.value;
    if (e.target.name === 'baslik' && !slugElle) form.elements.slug.value = ST.slugify(e.target.value);
    $('turAdres').textContent = 'tur.html?p=' + (form.elements.slug.value || '…');
  });
  function get(n) { var el = form.elements[n]; return el ? el.value.trim() : ''; }
  function set(n, v) { var el = form.elements[n]; if (el) el.value = v == null ? '' : v; }

  /* ---------- Görsel işleme ---------- */
  function gorselYukle(blob) {
    if (window.createImageBitmap) return createImageBitmap(blob);
    return new Promise(function (res, rej) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = rej; i.src = URL.createObjectURL(blob); });
  }
  function canvasBlob(img, w, h, q) {
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, w, h);
    return new Promise(function (res) { c.toBlob(res, 'image/jpeg', q); });
  }
  function panoramaIsle(file) {
    return gorselYukle(file).then(function (img) {
      var w = img.width, h = img.height, oran = w / h;
      var uyari = Math.abs(oran - 2) > 0.05 ? file.name + ': oran ' + oran.toFixed(2) + ':1 — 360° panorama 2:1 olmalı, görüntü bozuk görünebilir.' : '';
      var kucult = $('kucult').checked && w > 4096;
      var anaP = kucult ? canvasBlob(img, 4096, Math.round(4096 / oran), 0.85) : Promise.resolve(file);
      return Promise.all([anaP, canvasBlob(img, 480, Math.round(480 / oran), 0.78)]).then(function (r) {
        var ext = kucult ? 'jpg' : ({ 'image/png': 'png', 'image/webp': 'webp' }[file.type] || 'jpg');
        return { blob: r[0], ext: ext, thumbBlob: r[1], uyari: uyari, genislik: kucult ? 4096 : w };
      });
    });
  }
  function benzersizId(temel) {
    var id = ST.slugify(temel) || 'oda', n = 2, aday = id;
    while (sahneler.some(function (s) { return s.id === aday; })) aday = id + '-' + (n++);
    return aday;
  }
  function adTahmin(dosyaAdi) {
    var a = dosyaAdi.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
    return a.charAt(0).toLocaleUpperCase('tr') + a.slice(1);
  }

  $('panoDosya').addEventListener('change', function () {
    var dosyalar = Array.prototype.slice.call(this.files); this.value = '';
    if (!dosyalar.length) return;
    yukleniyor(true, 'Panoramalar işleniyor…');
    var zincir = Promise.resolve(), uyarilar = [];
    dosyalar.forEach(function (f, i) {
      zincir = zincir.then(function () {
        $('yukleniyorMetin').textContent = 'Panorama işleniyor (' + (i + 1) + '/' + dosyalar.length + '): ' + f.name;
        return panoramaIsle(f).then(function (r) {
          if (r.uyari) uyarilar.push(r.uyari);
          if (!$('kucult').checked && r.genislik > 8192) uyarilar.push(f.name + ': ' + r.genislik + ' px çok geniş; birçok telefonda açılmaz. Küçültme seçeneğini açın.');
          var ad = adTahmin(f.name);
          sahneEkle({ id: benzersizId(ad), ad: ad, yaw: 0, pitch: 0, hfov: 110, noktalar: [], blob: r.blob, ext: r.ext, thumbBlob: r.thumbBlob });
        });
      });
    });
    zincir.then(function () {
      yukleniyor(false); degisti = true;
      if (uyarilar.length) alert(uyarilar.join('\n'));
      sahneSec(secili < 0 ? 0 : sahneler.length - 1);
    }).catch(function (e) { yukleniyor(false); alert('Görsel işlenemedi: ' + e.message); });
  });

  function sahneEkle(s) {
    s.url = URL.createObjectURL(s.blob);
    s.thumbUrl = URL.createObjectURL(s.thumbBlob || s.blob);
    sahneler.push(s);
    if (!ilkSahne) ilkSahne = s.id;
    listeleriCiz();
  }

  /* ---------- Listeler ---------- */
  function listeleriCiz() {
    var el = $('sahneListe');
    if (!sahneler.length) { el.innerHTML = '<p style="color:var(--soluk);font-size:13px">Henüz panorama yok.</p>'; }
    else el.innerHTML = sahneler.map(function (s, i) {
      return '<div class="sahne-satir' + (i === secili ? ' secili' : '') + '" data-i="' + i + '">' +
        '<img src="' + s.thumbUrl + '" alt="" data-islem="sec" title="Bu odayı aç">' +
        '<input value="' + ST.esc(s.ad) + '" data-islem="ad" aria-label="Oda adı">' +
        '<div class="islemler">' + (s.id === ilkSahne ? '<span title="İlk oda">★</span>' : '') +
        '<button type="button" data-islem="yukari" title="Yukarı">▲</button><button type="button" data-islem="asagi" title="Aşağı">▼</button><button type="button" data-islem="sil" title="Sil">✕</button></div></div>';
    }).join('');
    kapakSecCiz();
    noktalariCiz();
  }
  $('sahneListe').addEventListener('click', function (e) {
    var t = e.target, satir = t.closest('.sahne-satir'); if (!satir) return;
    var i = +satir.dataset.i, islem = t.dataset.islem;
    if (islem === 'sec' || (!islem && t.tagName !== 'INPUT')) sahneSec(i);
    else if (islem === 'yukari' && i > 0) { tasi(i, i - 1); }
    else if (islem === 'asagi' && i < sahneler.length - 1) { tasi(i, i + 1); }
    else if (islem === 'sil') {
      if (!confirm('"' + sahneler[i].ad + '" silinsin mi? Bu odaya giden geçiş noktaları da silinir.')) return;
      var id = sahneler[i].id;
      sahneler.splice(i, 1);
      sahneler.forEach(function (s) { s.noktalar = s.noktalar.filter(function (n) { return n.hedef !== id; }); });
      if (ilkSahne === id) ilkSahne = sahneler[0] ? sahneler[0].id : null;
      degisti = true;
      sahneSec(Math.min(i, sahneler.length - 1));
    }
  });
  $('sahneListe').addEventListener('input', function (e) {
    if (e.target.dataset.islem !== 'ad') return;
    var i = +e.target.closest('.sahne-satir').dataset.i; sahneler[i].ad = e.target.value; degisti = true; kapakSecCiz(); noktaBaslik();
  });
  function tasi(a, b) {
    var s = sahneler.splice(a, 1)[0]; sahneler.splice(b, 0, s);
    if (secili === a) secili = b; else if (secili === b) secili = a;
    degisti = true; listeleriCiz();
  }
  function kapakSecCiz() {
    var sel = $('kapakSec'), onceki = sel.value;
    sel.innerHTML = '<option value="">(İlk odanın görseli)</option>' + sahneler.map(function (s) { return '<option value="' + s.id + '">' + ST.esc(s.ad) + '</option>'; }).join('');
    sel.value = onceki;
  }
  function noktaBaslik() {
    var s = sahneler[secili];
    $('noktaBaslik').textContent = s ? 'Noktalar – ' + s.ad : 'Noktalar';
  }
  function noktalariCiz() {
    noktaBaslik();
    var s = sahneler[secili], el = $('noktaListe');
    if (!s) { el.innerHTML = ''; return; }
    if (!s.noktalar.length) { el.innerHTML = '<p style="color:var(--soluk);font-size:13px;margin:0">Bu odada nokta yok. Üstteki <b>➜ Geçiş noktası</b> veya <b>ⓘ Bilgi noktası</b> butonuna basıp panoramaya tıklayın.</p>'; return; }
    el.innerHTML = s.noktalar.map(function (n, i) {
      var hedef = n.tip === 'gecis' ? (sahneler.filter(function (x) { return x.id === n.hedef; })[0] || {}).ad : '';
      var metin = n.tip === 'gecis' ? '→ ' + (n.metin || hedef || n.hedef) : (n.baslik || '') + (n.metin ? ' – ' + n.metin : '');
      return '<div class="nokta-satir"><span class="tip ' + (n.tip === 'gecis' ? 'g">➜' : 'b">i') + '</span><span class="metin" title="' + ST.esc(metin) + '">' + ST.esc(metin) + '</span>' +
        '<button type="button" data-n="' + i + '" data-islem="git">Bak</button><button type="button" data-n="' + i + '" data-islem="duzenle">Düzenle</button><button type="button" data-n="' + i + '" data-islem="sil">✕</button></div>';
    }).join('');
  }
  $('noktaListe').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var s = sahneler[secili], i = +b.dataset.n, n = s.noktalar[i];
    if (b.dataset.islem === 'sil') { s.noktalar.splice(i, 1); degisti = true; goruntuleyiciKur(true); noktalariCiz(); }
    else if (b.dataset.islem === 'duzenle') noktaFormu(n.tip, n.pitch, n.yaw, i);
    else if (b.dataset.islem === 'git' && viewer) viewer.lookAt(n.pitch, n.yaw, viewer.getHfov(), 600);
  });

  /* ---------- Görüntüleyici ---------- */
  function sahneSec(i) {
    secili = i; modAyarla(null);
    listeleriCiz();
    goruntuleyiciKur(false);
  }
  function goruntuleyiciKur(gorunumuKoru) {
    var s = sahneler[secili];
    var bakis = (gorunumuKoru && viewer) ? { yaw: viewer.getYaw(), pitch: viewer.getPitch(), hfov: viewer.getHfov() } : null;
    if (viewer) { try { viewer.destroy(); } catch (e) {} viewer = null; }
    $('edBos').style.display = s ? 'none' : '';
    if (!s) return;
    viewer = pannellum.viewer('edPanorama', {
      type: 'equirectangular', panorama: s.url, autoLoad: true,
      yaw: bakis ? bakis.yaw : s.yaw, pitch: bakis ? bakis.pitch : s.pitch, hfov: bakis ? bakis.hfov : s.hfov,
      minHfov: 40, maxHfov: 120, showControls: true, compass: false,
      hotSpots: s.noktalar.map(function (n, idx) {
        return {
          pitch: n.pitch, yaw: n.yaw, type: 'info', cssClass: 'st-hs-kok',
          createTooltipFunc: ST.hotspotOlustur, createTooltipArgs: n,
          clickHandlerFunc: function () {
            if (n.tip === 'gecis') {
              var j = sahneler.map(function (x) { return x.id; }).indexOf(n.hedef);
              if (j > -1 && confirm('"' + sahneler[j].ad + '" odasına geçilsin mi?\n(İptal: bu noktayı düzenle)')) sahneSec(j); else noktaFormu(n.tip, n.pitch, n.yaw, idx);
            }
          }
        };
      })
    });
    viewer.on('error', function (e) { console.error('Pannellum:', e); });
    window.__edViewer = viewer;
  }

  // Tıklama ile nokta yerleştirme (sürükleme ile karışmasın diye mesafe kontrolü)
  var basla = null;
  var alan = $('onizleme');
  alan.addEventListener('pointerdown', function (e) { basla = { x: e.clientX, y: e.clientY }; }, true);
  alan.addEventListener('pointerup', function (e) {
    if (!mod || !viewer || !basla) return;
    if (e.target.closest('.st-hs, .pnlm-controls-container')) return;
    if (Math.hypot(e.clientX - basla.x, e.clientY - basla.y) > 6) return;
    var c = viewer.mouseEventToCoords(e);
    var t = mod; modAyarla(null);
    noktaFormu(t, Math.round(c[0] * 10) / 10, Math.round(c[1] * 10) / 10, -1);
  }, true);

  function modAyarla(m) {
    mod = m;
    $('onizleme').classList.toggle('yerlestir', !!m);
    $('btnGecis').classList.toggle('aktif', m === 'gecis');
    $('btnBilgi').classList.toggle('aktif', m === 'bilgi');
    $('edMod').textContent = m === 'gecis' ? 'Geçiş okunun yerine tıklayın (genelde kapı / koridor) · Esc ile iptal' : 'Bilgi noktasının yerine tıklayın · Esc ile iptal';
  }
  $('btnGecis').addEventListener('click', function () {
    if (!sahneKontrol()) return;
    if (sahneler.length < 2) { toast('Geçiş noktası için en az 2 oda gerekir'); return; }
    modAyarla(mod === 'gecis' ? null : 'gecis');
  });
  $('btnBilgi').addEventListener('click', function () { if (sahneKontrol()) modAyarla(mod === 'bilgi' ? null : 'bilgi'); });
  $('btnBakis').addEventListener('click', function () {
    if (!sahneKontrol()) return;
    var s = sahneler[secili];
    s.yaw = Math.round(viewer.getYaw()); s.pitch = Math.round(viewer.getPitch()); s.hfov = Math.round(viewer.getHfov());
    degisti = true; toast('"' + s.ad + '" açılış bakışı kaydedildi');
  });
  $('btnIlk').addEventListener('click', function () {
    if (!sahneKontrol()) return;
    ilkSahne = sahneler[secili].id; degisti = true; listeleriCiz(); toast('Tur "' + sahneler[secili].ad + '" odasından başlayacak');
  });
  function sahneKontrol() { if (!viewer || secili < 0) { toast('Önce panorama ekleyin'); return false; } return true; }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { modAyarla(null); modalKapat(); } });

  function noktaFormu(t, pitch, yaw, duzenleIdx) {
    var s = sahneler[secili];
    var n = duzenleIdx > -1 ? s.noktalar[duzenleIdx] : { tip: t, pitch: pitch, yaw: yaw };
    var h = '<h3 style="margin-top:0">' + (t === 'gecis' ? '➜ Geçiş noktası' : 'ⓘ Bilgi noktası') + '</h3>';
    if (t === 'gecis') {
      var digerleri = sahneler.filter(function (x) { return x.id !== s.id; });
      h += '<label>Hangi odaya geçilsin?<select id="nfHedef">' + digerleri.map(function (x) { return '<option value="' + x.id + '"' + (x.id === n.hedef ? ' selected' : '') + '>' + ST.esc(x.ad) + '</option>'; }).join('') + '</select></label>' +
        '<label>Etiket (boşsa oda adı)<input id="nfMetin" value="' + ST.esc(n.metin || '') + '"></label>';
    } else {
      h += '<label>Başlık<input id="nfBaslik" placeholder="Örn. Ankastre mutfak" value="' + ST.esc(n.baslik || '') + '"></label>' +
        '<label>Açıklama (opsiyonel)<textarea id="nfMetin" rows="3" placeholder="Örn. Bosch ankastre set, granit tezgah">' + ST.esc(n.metin || '') + '</textarea></label>' +
        '<div class="oz-cipler" style="max-width:380px;margin-bottom:10px">' + ['Ankastre mutfak', 'Yerden ısıtma', 'Ebeveyn banyosu', 'Gömme dolap', 'Deniz manzarası', 'Isıcam PVC', 'Laminat parke', 'Klima', 'Vestiyer', 'Asma tavan', 'Vitrin cephesi', 'Tavan yüksekliği'].map(function (o) { return '<button type="button" class="nfHazir">' + o + '</button>'; }).join('') + '</div>';
    }
    h += '<p style="font-size:12px;color:var(--soluk)">Konum: yaw ' + n.yaw + '°, pitch ' + n.pitch + '°</p><div class="dugmeler"><button type="button" class="btn-ana" id="nfKaydet">Kaydet</button><button type="button" id="nfIptal">İptal</button></div>';
    modalAc(h);
    Array.prototype.forEach.call(document.querySelectorAll('.nfHazir'), function (b) { b.addEventListener('click', function () { $('nfBaslik').value = b.textContent; }); });
    var ilk = $('nfBaslik') || $('nfHedef'); if (ilk) ilk.focus();
    $('nfIptal').addEventListener('click', modalKapat);
    $('nfKaydet').addEventListener('click', function () {
      if (t === 'gecis') {
        if (!$('nfHedef').value) { alert('Hedef oda seçin'); return; }
        n.hedef = $('nfHedef').value; n.metin = $('nfMetin').value.trim();
        if (!n.metin) { var hd = sahneler.filter(function (x) { return x.id === n.hedef; })[0]; n.metin = hd ? hd.ad : ''; }
      } else {
        n.baslik = $('nfBaslik').value.trim(); n.metin = $('nfMetin').value.trim();
        if (!n.baslik) { alert('Başlık girin'); return; }
      }
      if (duzenleIdx < 0) s.noktalar.push(n);
      degisti = true; modalKapat(); goruntuleyiciKur(true); noktalariCiz();
    });
  }

  /* ---------- Kat planı ---------- */
  $('katPlaniDosya').addEventListener('change', function () {
    var f = this.files[0]; if (!f) return;
    katPlani = { blob: f, ext: (f.name.split('.').pop() || 'jpg').toLowerCase(), url: URL.createObjectURL(f) };
    katPlaniCiz(); degisti = true;
  });
  function katPlaniCiz() {
    $('katPlaniOnizleme').innerHTML = katPlani ? '<img src="' + katPlani.url + '" style="max-width:100%;border-radius:8px;border:1px solid var(--cizgi)"><br><button type="button" id="katPlaniSil">Kat planını kaldır</button>' : '';
    if (katPlani) $('katPlaniSil').addEventListener('click', function () { katPlani = null; $('katPlaniDosya').value = ''; katPlaniCiz(); });
  }

  /* ---------- Dışa aktarma ---------- */
  function slugAl() { var s = ST.slugify(get('slug') || get('baslik')); set('slug', s); return s; }
  function propertyOlustur() {
    var ozl = get('ozellikler').split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
    var dan = {}; ['ad', 'telefon', 'whatsapp'].forEach(function (k) { var v = get('danisman.' + k); if (v) dan[k] = v; });
    var kapakId = $('kapakSec').value || (sahneler[0] && sahneler[0].id);
    var p = {
      id: slugAl(), tip: tip, durum: get('durum'), baslik: get('baslik') || 'Başlıksız ilan', aciklama: get('aciklama'),
      fiyat: get('fiyat') === '' ? null : Number(get('fiyat')), paraBirimi: get('paraBirimi'), fiyatEk: get('fiyatEk') || undefined,
      konum: { il: get('konum.il'), ilce: get('konum.ilce'), mahalle: get('konum.mahalle'), harita: get('konum.harita') },
      bilgiler: alanDegerleri(), ozellikler: ozl,
      katPlani: katPlani ? 'kat-plani.' + katPlani.ext : '',
      kapak: kapakId ? kapakId + '_thumb.jpg' : '',
      ilkSahne: ilkSahne || (sahneler[0] && sahneler[0].id) || '',
      sahneler: sahneler.map(function (s) {
        return { id: s.id, ad: s.ad, panorama: s.id + '.' + s.ext, kucuk: s.id + '_thumb.jpg', yaw: s.yaw, pitch: s.pitch, hfov: s.hfov,
          noktalar: s.noktalar.map(function (n) { return n.tip === 'gecis' ? { tip: 'gecis', hedef: n.hedef, yaw: n.yaw, pitch: n.pitch, metin: n.metin } : { tip: 'bilgi', yaw: n.yaw, pitch: n.pitch, baslik: n.baslik, metin: n.metin }; }) };
      })
    };
    if (Object.keys(dan).length) p.danisman = dan;
    return p;
  }
  function indir(blob, ad) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = ad;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function kontrol() {
    var h = [];
    if (!get('baslik')) h.push('İlan başlığı boş.');
    if (!sahneler.length) h.push('Hiç panorama eklenmedi.');
    var yalniz = sahneler.length > 1 ? sahneler.filter(function (s) { return !s.noktalar.some(function (n) { return n.tip === 'gecis'; }); }) : [];
    if (yalniz.length) h.push('Geçiş noktası olmayan odalar: ' + yalniz.map(function (s) { return s.ad; }).join(', ') + ' (alttaki oda şeridinden yine de gezilebilir).');
    return h;
  }
  $('btnJson').addEventListener('click', function () {
    var p = propertyOlustur();
    indir(new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' }), 'property.json');
  });
  $('btnZip').addEventListener('click', function () {
    var h = kontrol();
    if (h.length && !confirm('Uyarılar:\n• ' + h.join('\n• ') + '\n\nYine de ZIP oluşturulsun mu?')) return;
    var p = propertyOlustur(), slug = p.id;
    yukleniyor(true, 'ZIP hazırlanıyor…');
    var zip = new JSZip(), klasor = zip.folder('tours').folder(slug);
    klasor.file('property.json', JSON.stringify(p, null, 2));
    sahneler.forEach(function (s) { klasor.file(s.id + '.' + s.ext, s.blob); klasor.file(s.id + '_thumb.jpg', s.thumbBlob || s.blob); });
    if (katPlani) klasor.file('kat-plani.' + katPlani.ext, katPlani.blob);
    ST.getJSON('tours/index.json').catch(function () { return { ilanlar: [] }; }).then(function (ix) {
      ix.ilanlar = ix.ilanlar || [];
      if (ix.ilanlar.indexOf(slug) === -1) ix.ilanlar.unshift(slug);
      zip.folder('tours').file('index.json', JSON.stringify(ix, null, 2));
      zip.file('NASIL-YUKLENIR.txt', 'Bu ZIP\'in içindeki "tours" klasörünü sanal tur sitenizin ana klasörüne kopyalayın (mevcut tours klasörüyle birleştirin, index.json\'ın üzerine yazın).\n' +
        'Ardından siteyi yeniden yayınlayın (Netlify: klasörü sürükle-bırak; GitHub Pages: dosyaları yükle/commit).\n\nTur adresi: tur.html?p=' + slug + '\n');
      return zip.generateAsync({ type: 'blob', compression: 'STORE' }, function (m) { $('yukleniyorMetin').textContent = 'ZIP hazırlanıyor… %' + Math.round(m.percent); });
    }).then(function (b) { yukleniyor(false); indir(b, 'sanal-tur-' + slug + '.zip'); degisti = false; toast('ZIP indirildi'); })
      .catch(function (e) { yukleniyor(false); alert('ZIP oluşturulamadı: ' + e.message); });
  });

  /* ---------- Mevcut turu açma ---------- */
  ST.getJSON('tours/index.json').then(function (ix) {
    (ix.ilanlar || []).forEach(function (s) { var o = document.createElement('option'); o.value = s; o.textContent = s; $('mevcutSec').appendChild(o); });
  }).catch(function () { $('mevcutSec').style.display = 'none'; });
  $('mevcutSec').addEventListener('change', function () {
    var slug = this.value; this.value = '';
    if (!slug) return;
    if (degisti && !confirm('Kaydedilmemiş değişiklikler kaybolacak. Devam edilsin mi?')) return;
    var taban = 'tours/' + slug + '/';
    yukleniyor(true, 'Tur yükleniyor…');
    ST.getJSON(taban + 'property.json').then(function (p) {
      var blob = function (f) { return fetch(taban + f).then(function (r) { if (!r.ok) throw new Error(f + ' bulunamadı'); return r.blob(); }); };
      return Promise.all((p.sahneler || []).map(function (s) {
        return Promise.all([blob(s.panorama), s.kucuk ? blob(s.kucuk).catch(function () { return null; }) : null]).then(function (r) {
          return { id: s.id, ad: s.ad, yaw: s.yaw || 0, pitch: s.pitch || 0, hfov: s.hfov || 110, noktalar: JSON.parse(JSON.stringify(s.noktalar || [])), blob: r[0], thumbBlob: r[1], ext: (s.panorama.split('.').pop() || 'jpg') };
        });
      })).then(function (ss) {
        var kp = p.katPlani ? blob(p.katPlani).then(function (b) { return { blob: b, ext: p.katPlani.split('.').pop(), url: URL.createObjectURL(b) }; }).catch(function () { return null; }) : Promise.resolve(null);
        return kp.then(function (k) { ilanYukle(p, ss, k, slug); });
      });
    }).then(function () { yukleniyor(false); toast('"' + slug + '" düzenleniyor'); })
      .catch(function (e) { yukleniyor(false); alert('Tur açılamadı: ' + e.message); });
  });

  function ilanYukle(p, ss, kp, slug) {
    form.reset();
    tip = p.tip === 'ticari' ? 'ticari' : 'daire'; alanlariCiz();
    ['baslik', 'durum', 'fiyat', 'paraBirimi', 'fiyatEk', 'aciklama'].forEach(function (k) { set(k, p[k]); });
    var k = p.konum || {}; ['il', 'ilce', 'mahalle', 'harita'].forEach(function (x) { set('konum.' + x, k[x]); });
    var d = p.danisman || {}; ['ad', 'telefon', 'whatsapp'].forEach(function (x) { set('danisman.' + x, d[x]); });
    set('ozellikler', (p.ozellikler || []).join('\n'));
    alanDoldur(p.bilgiler || {});
    set('slug', slug); slugElle = true; $('turAdres').textContent = 'tur.html?p=' + slug;
    sahneler = []; secili = -1; ilkSahne = p.ilkSahne || null;
    ss.forEach(sahneEkle);
    if (!ilkSahne && sahneler[0]) ilkSahne = sahneler[0].id;
    katPlani = kp; katPlaniCiz();
    kapakSecCiz(); $('kapakSec').value = (p.kapak || '').replace(/_thumb\.jpg$/, '');
    sahneSec(sahneler.length ? 0 : -1);
    degisti = false;
  }

  $('btnYeni').addEventListener('click', function () {
    if (degisti && !confirm('Kaydedilmemiş değişiklikler kaybolacak. Yeni ilana başlansın mı?')) return;
    form.reset(); tip = 'daire'; alanlariCiz(); sahneler = []; secili = -1; ilkSahne = null; katPlani = null; katPlaniCiz(); slugElle = false;
    listeleriCiz(); goruntuleyiciKur(false); degisti = false;
  });

  /* ---------- Yardımcılar ---------- */
  function modalAc(html) { $('modalIcerik').innerHTML = html; $('modal').classList.add('acik'); }
  function modalKapat() { $('modal').classList.remove('acik'); }
  $('modalKapat').addEventListener('click', modalKapat);
  function toast(m) { var t = $('toast'); t.textContent = m; t.classList.add('goster'); clearTimeout(t._z); t._z = setTimeout(function () { t.classList.remove('goster'); }, 2600); }
  function yukleniyor(a, m) { $('yukleniyor').classList.toggle('acik', a); if (m) $('yukleniyorMetin').textContent = m; }
  window.addEventListener('beforeunload', function (e) { if (degisti) { e.preventDefault(); e.returnValue = ''; } });

  alanlariCiz();
  listeleriCiz();
})();
