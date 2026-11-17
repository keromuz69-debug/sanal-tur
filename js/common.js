/* Sanal Tur – ortak yardımcılar (portföy, tur ve editör sayfaları kullanır) */
(function (w) {
  'use strict';

  // Alan tanımları: viewer ve editör aynı listeyi kullanır.
  var ALANLAR = {
    ortak: [
      { k: 'brutM2', l: 'Brüt m²', t: 'number' },
      { k: 'netM2', l: 'Net m²', t: 'number' },
      { k: 'kat', l: 'Bulunduğu Kat' },
      { k: 'katSayisi', l: 'Binadaki Kat Sayısı', t: 'number' },
      { k: 'binaYasi', l: 'Bina Yaşı', t: 'number' },
      { k: 'isinma', l: 'Isınma', o: ['Doğalgaz (Kombi)', 'Merkezi', 'Merkezi (Pay Ölçer)', 'Yerden Isıtma', 'Klima', 'VRF Klima', 'Soba', 'Yok'] },
      { k: 'aidat', l: 'Aidat (TL)', t: 'number' },
      { k: 'tapu', l: 'Tapu Durumu', o: ['Kat Mülkiyetli', 'Kat İrtifaklı', 'Hisseli Tapu', 'Arsa Tapulu', 'Kooperatif'] },
      { k: 'krediyeUygun', l: 'Krediye Uygun', o: ['Evet', 'Hayır', 'Bilinmiyor'] }
    ],
    daire: [
      { k: 'odaSayisi', l: 'Oda Sayısı', o: ['1+0', '1+1', '2+1', '3+1', '3+2', '4+1', '4+2', '5+1', '5+2', '6+'] },
      { k: 'banyoSayisi', l: 'Banyo Sayısı', t: 'number' },
      { k: 'balkon', l: 'Balkon', o: ['Var', 'Yok'] },
      { k: 'esyali', l: 'Eşyalı', o: ['Evet', 'Hayır'] },
      { k: 'siteIcinde', l: 'Site İçerisinde', o: ['Evet', 'Hayır'] }
    ],
    ticari: [
      { k: 'kullanimAlani', l: 'Kullanım Alanı', o: ['Ofis', 'Dükkan / Mağaza', 'Ofis / Mağaza', 'Depo', 'Atölye', 'Restoran / Kafe', 'Plaza Katı', 'Komple Bina', 'Diğer'] },
      { k: 'tavanYuksekligi', l: 'Tavan Yüksekliği' },
      { k: 'cephe', l: 'Cephe' },
      { k: 'vitrinCephe', l: 'Vitrin Cephesi' },
      { k: 'otopark', l: 'Otopark' },
      { k: 'ruhsat', l: 'Ruhsat / İskân' },
      { k: 'wcMutfak', l: 'WC / Mutfak' }
    ]
  };

  // Hangi tipte hangi alanlar gösterilir (sıra önemli)
  function alanlarFor(tip) {
    return tip === 'ticari' ? ALANLAR.ticari.concat(ALANLAR.ortak) : ALANLAR.daire.concat(ALANLAR.ortak);
  }

  var HAZIR_OZELLIKLER = {
    daire: ['Asansör', 'Kapalı otopark', 'Açık otopark', 'Ankastre mutfak', 'Yerden ısıtma', 'Ebeveyn banyosu', 'Giyinme odası', 'Çelik kapı', 'Isı yalıtımı', 'Isıcam PVC', 'Klima', 'Deniz manzarası', 'Site içi', 'Havuz', 'Spor salonu', '7/24 güvenlik', 'Kapıcı', 'Metroya yakın', 'Marmaray\'a yakın', 'Metrobüse yakın', 'Okula yakın', 'Sahile yakın', 'Depreme dayanıklı (yeni yönetmelik)', 'Akıllı ev', 'Kiler', 'Teras'],
    ticari: ['Cadde cephe', 'Köşe konum', 'Geniş vitrin', 'Jeneratör', 'Asansör', 'Yük asansörü', 'Kapalı otopark', '7/24 güvenlik', 'Yangın merdiveni', 'Sprinkler sistemi', 'Fiber internet altyapısı', 'Asma tavan', 'Yükseltilmiş döşeme', 'Klima', 'Engelli erişimi', 'Metroya yakın', 'Metrobüse yakın', 'TIR girişine uygun', 'Kiracılı', 'Boş teslim']
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fiyatYaz(p) {
    if (p.fiyat == null || p.fiyat === '') return 'Fiyat için arayınız';
    var n = Number(p.fiyat);
    var s = isNaN(n) ? String(p.fiyat) : new Intl.NumberFormat('tr-TR').format(n);
    var pb = p.paraBirimi || 'TL';
    var sym = { TL: '₺', USD: '$', EUR: '€', GBP: '£' }[pb];
    return (sym ? s + ' ' + sym : s + ' ' + pb) + (p.fiyatEk ? ' ' + p.fiyatEk : '');
  }

  function degerYaz(alan, v) {
    if (v == null || v === '') return '';
    if (alan.k === 'aidat') return new Intl.NumberFormat('tr-TR').format(Number(v)) + ' ₺';
    if (alan.k === 'brutM2' || alan.k === 'netM2') return v + ' m²';
    if (alan.k === 'binaYasi') return Number(v) === 0 ? 'Sıfır bina' : v + ' yıl';
    return String(v);
  }

  function konumYaz(p) {
    var k = p.konum || {};
    return [k.mahalle, k.ilce, k.il].filter(Boolean).join(', ');
  }

  function yerTutucuMu(s) {
    return !s || /^\s*\[.*\]\s*$/.test(String(s));
  }

  function getJSON(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(url + ' yüklenemedi (' + r.status + ')');
      return r.json();
    });
  }

  function slugify(s) {
    var map = { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'İ': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u', 'Ç': 'c', 'Ğ': 'g', 'Ö': 'o', 'Ş': 's', 'Ü': 'u' };
    return String(s || '').replace(/[çğıİöşüÇĞÖŞÜ]/g, function (c) { return map[c]; })
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'ilan';
  }

  // Pannellum hotspot görünümü (tur + editör ortak)
  function hotspotOlustur(div, args) {
    div.classList.add('st-hs', args.tip === 'gecis' ? 'st-hs-gecis' : 'st-hs-bilgi');
    var ikon = document.createElement('span');
    ikon.className = 'st-hs-ikon';
    ikon.textContent = args.tip === 'gecis' ? '➜' : 'i';
    div.appendChild(ikon);
    var et = document.createElement('div');
    et.className = 'st-hs-etiket';
    if (args.tip === 'gecis') {
      et.textContent = args.metin || 'Geçiş';
    } else {
      var b = document.createElement('strong'); b.textContent = args.baslik || '';
      et.appendChild(b);
      if (args.metin) { var m = document.createElement('span'); m.textContent = args.metin; et.appendChild(m); }
    }
    div.appendChild(et);
    if (args.tip === 'bilgi') {
      // mobilde dokunarak aç/kapat
      div.addEventListener('click', function (e) { div.classList.toggle('acik'); e.stopPropagation(); });
    }
  }

  function dosyaKorumasi() {
    if (location.protocol === 'file:') {
      var d = document.createElement('div');
      d.className = 'st-uyari';
      d.innerHTML = '<b>Dikkat:</b> Sayfayı doğrudan dosyadan açtınız. Tarayıcı güvenliği nedeniyle panoramalar bu şekilde yüklenemez. ' +
        'Klasördeki <code>baslat.bat</code> (Windows) veya <code>baslat.command</code> (Mac) dosyasını çalıştırın ya da siteyi Netlify / GitHub Pages gibi bir yere yükleyin. Ayrıntılar: PLAN.md';
      document.body.insertBefore(d, document.body.firstChild);
      return true;
    }
    return false;
  }

  w.ST = {
    ALANLAR: ALANLAR, alanlarFor: alanlarFor, HAZIR_OZELLIKLER: HAZIR_OZELLIKLER,
    esc: esc, fiyatYaz: fiyatYaz, degerYaz: degerYaz, konumYaz: konumYaz, yerTutucuMu: yerTutucuMu,
    getJSON: getJSON, slugify: slugify, hotspotOlustur: hotspotOlustur, dosyaKorumasi: dosyaKorumasi
  };
  // Çevrimdışı destek (https veya localhost'ta)
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    w.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
})(window);
