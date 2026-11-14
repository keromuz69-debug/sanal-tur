# 360° Sanal Tur Sistemi – v1

RE/MAX danışmanları için daire ve ticari gayrimenkul sunumunda kullanılacak, sunucu/veritabanı gerektirmeyen statik bir 360° sanal tur sitesi.

## İçerik
| Dosya | Ne işe yarar |
|---|---|
| `index.html` | Portföy sayfası – tüm ilanlar kapak görseliyle, arama ve Daire/Ticari, Satılık/Kiralık filtresi |
| `tur.html?p=KLASOR` | Sanal tur: odalar arası geçiş okları, bilgi noktaları, oda şeridi, otomatik döndürme, **Otomatik Tur (sunum modu)**, tam ekran, telefonda jiroskop, ilan bilgi paneli, kat planı, Google Harita, danışman kartı + WhatsApp, paylaş, QR kod |
| `editor.html` | Kod yazmadan yeni tur hazırlama: 360° fotoğraf yükle → odaları adlandır → panoramaya tıklayarak geçiş/bilgi noktası koy → bilgileri doldur → **ZIP indir** |
| `ayarlar.json` | Ofis adı ve danışman bilgileri (köşeli parantezli **[YER TUTUCU]** alanları kendi bilgilerinizle doldurun) |
| `tours/index.json` | Portföyde listelenecek ilan klasörleri |
| `tours/<ilan>/property.json` | Bir ilanın tüm bilgileri + sahneler + noktalar |
| `PLAN.md` | Çekim rehberi, iş akışı, yayınlama, paylaşım ve yol haritası |
| `KAYNAKLAR.md` | Kütüphane ve görsel lisansları |

## Hemen deneyin
`index.html`'e **çift tıklamak çalışmaz** (tarayıcı güvenliği panoramaları engeller). Bunun yerine:
- **Windows:** `baslat.bat` çift tıklayın (Python gerekir) → tarayıcıda `http://localhost:8000`
- **Mac:** `baslat.command` (ilk seferde sağ tık › Aç)
- **En kolayı:** klasörü https://app.netlify.com/drop sayfasına sürükleyin → saniyeler içinde internette yayında.

## Yeni ilan ekleme (kod yok)
1. Siteyi açın → sağ üstte **✎ Yeni Tur Oluştur** (editor.html)
2. **＋ Panorama ekle** ile 360° fotoğrafları seçin (2:1 oranlı JPG). Oda adlarını alttaki listeden düzeltin.
3. Her odada **➜ Geçiş noktası**'na basın, panoramada kapının olduğu yere tıklayın, hedef odayı seçin. **ⓘ Bilgi noktası** ile “Ankastre mutfak”, “Yerden ısıtma” gibi notlar ekleyin.
4. **◎ Açılış bakışı yap** ile odanın ilk açıldığındaki yönü, **★ İlk oda yap** ile turun başlangıç odasını belirleyin.
5. Soldaki formda Daire/Ticari seçin, fiyat, m², kat, aidat, tapu vb. doldurun.
6. **⬇ ZIP indir** → ZIP içindeki `tours` klasörünü sitenin ana klasörüne kopyalayın (üzerine yazın) → siteyi tekrar yükleyin.

Mevcut bir turu düzenlemek için editörde sağ üstteki **“Mevcut turu düzenle…”** listesini kullanın.

## property.json özeti
```json
{
  "tip": "daire | ticari", "durum": "Satılık", "baslik": "...", "fiyat": 12500000, "paraBirimi": "TL",
  "konum": { "il": "İstanbul", "ilce": "Bakırköy", "mahalle": "...", "harita": "Google Maps arama metni" },
  "bilgiler": { "brutM2": 140, "netM2": 120, "odaSayisi": "3+1", "kat": "3", "binaYasi": 8, "isinma": "...", "aidat": 1500, "tapu": "...",
                "kullanimAlani": "(ticari)", "tavanYuksekligi": "(ticari)", "cephe": "...", "otopark": "...", "ruhsat": "..." },
  "ozellikler": ["Asansör", "..."], "katPlani": "kat-plani.jpg", "kapak": "salon_thumb.jpg", "ilkSahne": "giris",
  "danisman": { "ad": "(opsiyonel – boşsa ayarlar.json)" },
  "sahneler": [ { "id": "salon", "ad": "Salon", "panorama": "salon.jpg", "kucuk": "salon_thumb.jpg", "yaw": 0, "pitch": 0, "hfov": 110,
                  "noktalar": [ { "tip": "gecis", "hedef": "balkon", "yaw": 2, "pitch": -6, "metin": "Balkon" },
                                { "tip": "bilgi", "yaw": 60, "pitch": -10, "baslik": "Geniş salon", "metin": "..." } ] } ]
}
```
Alan listeleri `js/common.js` içindeki `ALANLAR` nesnesinde; yeni alan eklemek için tek satır yeterli.
