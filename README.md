# 360° Sanal Tur Sistemi – v1

RE/MAX danışmanları için daire ve ticari gayrimenkul sunumunda kullanılacak, sunucu/veritabanı gerektirmeyen statik bir 360° sanal tur sitesi.

## İçerik
| Dosya | Ne işe yarar |
|---|---|
| `index.html` | Ana sayfa: iki büyük buton (**Yeni Tur Oluştur**, **Turlarım**) + yayındaki ilanlar |
| `cek.html` | **Çek ve Kaydet** – telefon için 4 adımlı sihirbaz: 1 Bilgiler → 2 Odaları çek/yükle → 3 Önizle → 4 Gönder. Taslaklar telefonda kalıcı saklanır (IndexedDB), geçiş okları oda sırasına göre otomatik konur, tur dosyası (ZIP) indirilir veya Paylaş menüsüyle gönderilir |
| `tur.html?p=KLASOR` | Sanal tur: odalar arası geçiş okları, bilgi noktaları, oda şeridi, otomatik döndürme, **Otomatik Tur (sunum modu)**, tam ekran, telefonda jiroskop, ilan bilgi paneli, kat planı, Google Harita, danışman kartı + WhatsApp, paylaş, QR kod |
| `editor.html` | Gelişmiş düzenleyici (bilgisayar için): okları ve bilgi noktalarını tek tek elle yerleştirme, yayındaki turu açıp düzenleme |
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

## Telefonla yeni tur (önerilen yol)
1. Ana sayfada **Yeni Tur Oluştur**.
2. **Bilgiler:** tip (Daire / Dükkan-Ofis), başlık, satılık/kiralık, fiyat, ilçe/mahalle. Diğerleri “Daha fazla bilgi” altında.
3. **Odalar:** oda adını seç → **Panorama Çek** (kamera açılır, Panorama moduna geçin) veya **Galeriden Seç**. Telefonun normal panorama fotoğrafları (geniş şerit) ve 360° kamera fotoğrafları kabul edilir; her oda eklenince hemen önizlenir.
4. **Önizle:** odalar arası kırmızı oklar otomatik gelir; isterseniz taşıyın, bilgi noktası ekleyin, “Müşteri gibi tam ekran gör”.
5. **Gönder:** “Bu telefonda tam ekran aç” ile müşteriye hemen gösterin; yayın için tur dosyasını indirip/paylaşıp siteye ekleyin.

Taslaklar sadece o telefonun tarayıcısında saklanır (tarayıcı verileri silinirse gider). Yayın için tur dosyasını göndermeyi unutmayın.

### Telefon panoraması nasıl gösteriliyor?
Normal telefon panoraması 360° küre değil, geniş bir şerittir. Sistem en/boy oranından yatay açıyı tahmin eder (dikey açı varsayılan 65°, “Gelişmiş”ten ayarlanır; Android Google Kamera fotoğraflarında dosyadaki panorama bilgisi okunur). Görüntüleyici bu odalarda sağa-sola ve yukarı-aşağı bakışı fotoğrafın sınırlarıyla kısıtlar, böylece boş/siyah alan görünmez.

## Bilgisayardan yeni ilan (gelişmiş)
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
                  "tur": "kure | genis", "haov": 260, "vaov": 65, "vOffset": 0,   // "genis" = telefon panoraması (kısmi)
                  "noktalar": [ { "tip": "gecis", "hedef": "balkon", "yaw": 2, "pitch": -6, "metin": "Balkon" },
                                { "tip": "bilgi", "yaw": 60, "pitch": -10, "baslik": "Geniş salon", "metin": "..." } ] } ]
}
```
Alan listeleri `js/common.js` içindeki `ALANLAR` nesnesinde; yeni alan eklemek için tek satır yeterli.
