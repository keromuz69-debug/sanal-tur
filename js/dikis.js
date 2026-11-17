/* Ana iş parçacığı: kareleri işçiye gönderir, birleşmiş panoramayı JPEG olarak döndürür */
(function (w) {
  'use strict';
  function kareVerisi(k) {
    if (k.imageData) return Promise.resolve(k.imageData);
    return createImageBitmap(k.blob).then(function (bmp) {
      var c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
      var x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(bmp, 0, 0);
      var d = x.getImageData(0, 0, c.width, c.height); bmp.close && bmp.close(); c.width = c.height = 0; return d;
    });
  }
  // kareler: [{blob | imageData, yaw?, pitch?, roll?}]  ->  {blob, gen, yuk, haov, vaov, vOffset, dongu, uyarilar, sure}
  function birlestir(kareler, ilerleme, secenek) {
    return Promise.all(kareler.map(kareVerisi)).then(function (veriler) {
      var W = veriler[0].width, H = veriler[0].height;
      var gonder = veriler.map(function (d, i) {
        var src = d;
        if (d.width !== W || d.height !== H) { // boyut farklıysa eşitle
          var c = document.createElement('canvas'); c.width = W; c.height = H; var x = c.getContext('2d');
          var t = document.createElement('canvas'); t.width = d.width; t.height = d.height; t.getContext('2d').putImageData(d, 0, 0);
          x.drawImage(t, 0, 0, W, H); src = x.getImageData(0, 0, W, H);
        }
        return { w: W, h: H, data: src.data, yaw: kareler[i].yaw, pitch: kareler[i].pitch, roll: kareler[i].roll };
      });
      return new Promise(function (res, rej) {
        var isci;
        try { isci = new Worker('js/dikis-worker.js'); } catch (e) { rej(new Error('Bu tarayıcı arka plan işlemeyi desteklemiyor')); return; }
        isci.onmessage = function (e) {
          var m = e.data;
          if (m.tip === 'ilerleme') { if (ilerleme) ilerleme(m.yuzde, m.mesaj); }
          else if (m.tip === 'hata') { isci.terminate(); rej(new Error(m.mesaj)); }
          else if (m.tip === 'sonuc') {
            isci.terminate();
            var s = m.sonuc, c = document.createElement('canvas'); c.width = s.w; c.height = s.h;
            c.getContext('2d').putImageData(new ImageData(s.data, s.w, s.h), 0, 0);
            c.toBlob(function (b) {
              c.width = c.height = 0;
              res({ blob: b, gen: s.w, yuk: s.h, haov: s.haov, vaov: s.vaov, vOffset: s.vOffset, dongu: s.dongu, uyarilar: s.uyarilar, sure: s.sure, odak: s.odak, odakKaynak: s.odakKaynak, basarisizCift: s.basarisizCift });
            }, 'image/jpeg', 0.88);
          }
        };
        isci.onerror = function (e) { isci.terminate(); rej(new Error(e.message || 'Birleştirme hatası')); };
        isci.postMessage({ tip: 'dikis', kareler: gonder, secenek: secenek || {} }, gonder.map(function (g) { return g.data.buffer; }));
      });
    });
  }
  w.STDikis = { birlestir: birlestir };
})(window);
