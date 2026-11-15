/* Telefonda kalıcı taslak deposu (IndexedDB). Sunucu yok; her şey bu cihazda saklanır. */
(function (w) {
  'use strict';
  var DB_AD = 'sanalTur', SURUM = 1, dbP = null;
  function ac() {
    if (dbP) return dbP;
    dbP = new Promise(function (res, rej) {
      if (!w.indexedDB) return rej(new Error('Bu tarayıcı kayıt (IndexedDB) desteklemiyor'));
      var r = indexedDB.open(DB_AD, SURUM);
      r.onupgradeneeded = function () {
        var db = r.result;
        if (!db.objectStoreNames.contains('taslaklar')) db.createObjectStore('taslaklar', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('dosyalar')) db.createObjectStore('dosyalar');
      };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
    return dbP;
  }
  function islem(depo, mod, fn) {
    return ac().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction(depo, mod), st = tx.objectStore(depo), sonuc;
        var r = fn(st);
        if (r) r.onsuccess = function () { sonuc = r.result; };
        tx.oncomplete = function () { res(sonuc); };
        tx.onerror = tx.onabort = function () { rej(tx.error || new Error('Kayıt hatası')); };
      });
    });
  }
  var Depo = {
    taslakListe: function () {
      return islem('taslaklar', 'readonly', function (s) { return s.getAll(); })
        .then(function (l) { return (l || []).sort(function (a, b) { return (b.guncelleme || 0) - (a.guncelleme || 0); }); });
    },
    taslakAl: function (id) { return islem('taslaklar', 'readonly', function (s) { return s.get(id); }); },
    taslakKaydet: function (t) { t.guncelleme = Date.now(); return islem('taslaklar', 'readwrite', function (s) { return s.put(t); }); },
    taslakSil: function (id) {
      return islem('taslaklar', 'readwrite', function (s) { return s.delete(id); }).then(function () {
        return islem('dosyalar', 'readwrite', function (s) { return s.delete(IDBKeyRange.bound(id + '/', id + '/\uffff')); });
      });
    },
    dosyaKaydet: function (k, blob) { return islem('dosyalar', 'readwrite', function (s) { return s.put(blob, k); }); },
    dosyaAl: function (k) { return islem('dosyalar', 'readonly', function (s) { return s.get(k); }); },
    dosyaSil: function (k) { return islem('dosyalar', 'readwrite', function (s) { return s.delete(k); }); },
    kaliciIste: function () { try { if (navigator.storage && navigator.storage.persist) return navigator.storage.persist(); } catch (e) {} return Promise.resolve(false); },
    yeniId: function () { return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  };
  w.Depo = Depo;
})(window);
