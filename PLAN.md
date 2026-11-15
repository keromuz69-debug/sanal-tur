# 360° Sanal Tur Sistemi – Plan ve Kullanım Rehberi

> Hedef: İstanbul Avrupa Yakası'ndaki daire ve ticari portföyü, müşteriye **tek bir link** ile odadan odaya gezdirmek; ilan bilgilerini, kat planını, konumu ve danışman iletişimini aynı ekranda göstermek.

---

## 1. Ne kuruldu? (v1 – hazır)
- **Portföy sayfası** (`index.html`): tüm ilanlar, kapak görseli, filtre (Daire/Ticari, Satılık/Kiralık), arama (ilçe/mahalle).
- **Sanal tur** (`tur.html?p=ilan`): odalar arası oklar, bilgi noktaları, oda şeridi, otomatik dönme, **Otomatik Tur (sunum modu)** – müşteri karşısında ekranı TV'ye yansıtıp elinizi sürmeden tüm odaları gezdirir, tam ekran, telefonda jiroskop (telefonu çevirerek bakma), ilan paneli, kat planı, harita, WhatsApp butonu, paylaş ve **QR kod**.
- **Editör** (`editor.html`): kod yazmadan yeni tur → ZIP.
- Sunucu, veritabanı, aylık ücret **yok**. Ücretsiz statik hosting yeterli.

---

## 2. Çekim: Hangi ekipman?

| Seçenek | Artı | Eksi | Öneri |
|---|---|---|---|
| **Insta360 X3 / X4 / X5** | Tek tuşla 360°, uygulaması HDR ve otomatik birleştirme yapıyor, video da çekiyor (Reels için ideal) | Orta bütçe | **En iyi fiyat/performans** – hem tur hem Reels |
| **Ricoh Theta (SC2, X vb.)** | Emlak sektöründe çok yaygın, kullanımı basit, HDR modu iyi | Video kalitesi Insta360'tan zayıf | Sadece fotoğraf odaklıysanız |
| **Telefon + panorama uygulaması** | Ek maliyet yok | 360° küre birleştirmesi zahmetli, dikiş hataları, tavan/zemin eksik kalır, profesyonel görünmez | Sadece deneme amaçlı |
| **DSLR + balıkgözü lens + panoramik kafa** | En yüksek kalite | Pahalı, yavaş, bilgisayarda birleştirme (PTGui vb.) | Lüks/ticari büyük projeler için ileride |

> Fiyatlar sık değiştiği için satın almadan önce Hepsiburada/Trendyol/Amazon ve resmi distribütör fiyatlarını karşılaştırın; ikinci el Insta360 X3 iyi bir başlangıçtır.
> Google'ın eski “Street View” telefon uygulaması artık kullanılmıyor; telefonla çekecekseniz 360° birleştirme yapan güncel bir uygulama seçin, ama ciddi kullanım için 360° kamera öneriyoruz.

**Gerekli küçük ekipman**
- **Monopod/ışık ayağı** (ayakları ince, görüntüde az görünen “invisible selfie stick” veya hafif ışık standı) – 360° kameralarda sopa otomatik siliniyor.
- Telefon (kamerayı uzaktan tetiklemek için uygulama).
- Yedek batarya + mikrofiber bez (lens parmak izi = bulanık panorama).

### Çekim ipuçları
1. **Kamera yüksekliği ≈ 150–160 cm** (göz hizası). Her odada aynı yükseklik → geçişler doğal görünür.
2. **Odanın ortasına** yakın koyun; duvara/mobilyaya 1 m'den yakın olmasın (dikiş hatası).
3. **Siz kadrajdan çıkın**: uzaktan tetikleyin, başka odaya geçin veya kapının arkasına saklanın.
4. **Işık**: tüm lambaları açın, perdeleri açın. Pencere çok parlaksa **HDR modunu** açın. Gün ortası (11:00–15:00) en dengeli.
5. **Hazırlık**: yatakları toplayın, tezgâhları boşaltın, klozet kapağını kapatın, kişisel eşyaları/fotoğrafları kaldırın, aynalarda yansımanıza dikkat edin.
6. **Sıra**: Kapı girişi → hol → salon → mutfak → yatak odaları → banyolar → balkon/teras → bina girişi/otopark/manzara. Ticari için: cephe/vitrin → giriş → ana alan → arka bölümler → WC/mutfak → depo → otopark.
7. **Kapı aralarından** de çekim yapın (geçiş noktasını koymak kolaylaşır).
8. Her mekânda **2 kare** çekin (yedek). Bir daire ≈ 15–25 dakika.
9. **Gizlilik**: Kiracılı mülkte kişisel eşyalar, plaka, belge görünmesin; dışarıdan komşu yüzleri bulanıklaştırın.

---

## 2b. Sadece telefonla (360° kamera olmadan)
`cek.html` (ana sayfada **Yeni Tur Oluştur**) telefonun kendi **Panorama** modunu kullanır:
- **iPhone:** Kamera › modları kaydırıp **PANO**. Telefonu dik tutun, okun yönünde yavaşça dönün (iPhone en fazla ~240–270° çeker).
- **Android:** Kamera › Diğer/Daha fazla › **Panorama** (Samsung, Xiaomi, Pixel'de isimler değişebilir).
- “Panorama Çek” butonu bazı telefonlarda kamerayı **sadece normal fotoğraf modunda** açar (özellikle iPhone Safari). Bu durumda panoramayı Kamera uygulamasında çekip **Galeriden Seç** kullanın.
- Sonuç tam küre değildir: tavan ve zemin görünmez, sadece etrafa dönülerek bakılır. Müşteri sunumu için yeterli; daha etkileyici sonuç için 360° kamera önerilir.

## 3. Çekimden yayına iş akışı (bir ilan ≈ 30–45 dk)
1. **Çek** (yukarıdaki ipuçları).
2. **Aktar**: Insta360 / Theta uygulamasından fotoğrafları **“360° fotoğraf / equirectangular JPG”** olarak dışa aktarın (2:1 oran, ör. 5760×2880). Ufku düzeltme (horizon leveling) açık olsun.
3. (Opsiyonel) **Düzelt**: Lightroom/Snapseed ile parlaklık-kontrast. Kenarları **kırpmayın** (2:1 oran bozulur).
4. **Dosya adları**: `salon.jpg`, `mutfak.jpg`, `yatak-odasi-1.jpg` gibi verin → editör oda adını dosya adından alır.
5. **Editör** (`editor.html`): fotoğrafları yükle → geçiş ve bilgi noktalarını koy → formu doldur → **ZIP indir**.
6. **Siteye ekle**: ZIP'teki `tours` klasörünü sitenin ana klasörüne kopyala (üzerine yaz).
7. **Yayınla** (bkz. Bölüm 4) → link hazır: `https://siteniz/tur.html?p=ilan-klasoru`.
8. **Kontrol**: Telefondan açıp tüm okları deneyin.

> Editör “4096 px'e küçült” seçeneği varsayılan açık: bazı telefonlar daha büyük panoramayı açamaz. Masaüstünde daha net görüntü isterseniz kapatabilirsiniz (8192 px'i aşmayın).

---

## 4. Yayınlama (hosting) – hepsi ücretsiz başlar

| Seçenek | Nasıl | Not |
|---|---|---|
| **Netlify Drop** (en kolay) | https://app.netlify.com/drop → `sanal-tur` klasörünü sürükle-bırak | 1 dakika. Ücretsiz hesap açınca site kalıcı olur; güncellemede yeniden sürükleyin |
| **Cloudflare Pages** | dash.cloudflare.com → Workers & Pages → Pages → “Upload assets” → klasörü yükle | Türkiye'de hızlı, cömert ücretsiz kota |
| **GitHub Pages** | GitHub'da depo aç → dosyaları yükle → Settings › Pages › “Deploy from branch” | `.nojekyll` dosyası hazır. Depo herkese açık olur (fotoğraflar da) |
| **Kendi alan adınız** | ör. `turlar.adinizsoyadiniz.com` veya `sanaltur.ofisadi.com` | Alan adı yıllık ücretli; üç servisin de “Custom domain” ayarı var, SSL otomatik |

**Dikkat:**
- Jiroskop (telefonu çevirerek bakma) özelliği iPhone'da yalnızca **https** adreste çalışır – yukarıdaki servislerin hepsi https verir.
- Panorama başına ~1–3 MB; 10 odalı tur ≈ 20 MB. Ücretsiz kotalar onlarca ilan için yeterli.
- Satılan/kiralanan ilanı kaldırmak için `tours/index.json` listesinden silin (klasörü de silebilirsiniz).
- Ofisinizin/RE/MAX'ın marka ve web kullanım kurallarını kontrol edin; resmi logoyu kurumsal kimlik dosyasından ekleyin.

---

## 5. Paylaşım

**WhatsApp**
- Tur sayfasında **⤴ Paylaş** → WhatsApp. Telefonlarda doğrudan paylaşım menüsü açılır.
- Hazır mesaj şablonu:
  > Merhaba [Müşteri Adı], konuştuğumuz **Bakırköy 3+1** dairenin 360° sanal turu: [link] — Odaları telefonunuzdan gezebilirsiniz. Yerinde görmek isterseniz uygun gününüzü yazın. [Adınız], RE/MAX [Ofis]
- WhatsApp Business'ta bu mesajı **hızlı yanıt** olarak kaydedin (`/tur`).
- `ayarlar.json` → `danisman.whatsapp` alanına numaranızı (905XXXXXXXXX) yazınca turdaki **“WhatsApp ile Yaz”** butonu müşteriyi ilan adı ve linkle birlikte size yönlendirir.

**Instagram**
- Bio'ya portföy linki (`index.html`) veya Linktree.
- Hikâyede **Bağlantı çıkartması** ile tur linki.
- Reels: Insta360'ın 360° videosundan “reframe” ile dikey video çıkarın, açıklamaya “Sanal tur linki bio'da / DM'den isteyin” yazın.
- Gönderide QR kodu kullanmayın (telefonda okutulamaz); QR basılı materyal içindir.

**QR kod**
- Tur sayfasında **▦ QR** → indir. Bunu kullanın:
  - Vitrin/pencere “SATILIK” afişine
  - Broşür ve kartvizitin arkasına
  - Açık ev (open house) günü kapıya
  - sahibinden/emlakjet ilan fotoğraflarından birine (platform kurallarına uygunsa) “360° tur için okutun”
- QR'ı en az **3×3 cm** basın, altına kısa link yazın.

**Sunum anında**
- Ofiste veya müşteri evinde: laptopu TV'ye bağlayın → tur → **▶ Otomatik Tur** → her oda 15 sn döner, sonra bir sonrakine geçer. Soru gelince durdurup ilgili bilgi noktasını gösterin.

---

## 6. Yol haritası

### v1.1 (kısa vadede, küçük işler)
- [ ] `ayarlar.json` danışman bilgilerini doldurmak, gerçek logo eklemek
- [ ] Örnek ilanları `tours/index.json`'dan çıkarmak, ilk gerçek ilanı çekmek
- [ ] Netlify/Cloudflare'de yayına almak + alan adı
- [ ] İlan başına sosyal medya önizlemesi (WhatsApp'ta link atınca kapak görseli çıksın – her ilana küçük bir HTML sayfası üretmek gerekir)

### v1.5 (bu sürümde eklendi)
- [x] Telefon için adım adım “Çek ve Kaydet” sihirbazı, taslakların telefonda kalıcı saklanması
- [x] Telefon panoraması (kısmi panorama) desteği
- [x] Taslağı yayınlamadan müşteriye telefonda tam ekran gösterme
- [ ] Bulutta kayıt + tek dokunuşla yayınlama (ücretsiz Supabase/Firebase ile; kullanıcı hesabı gerekir)
- [ ] Deneysel: tarayıcı içinde kamerayla rehberli çekim ve birleştirme (yapılmadı – telefonun kendi panorama modu daha kaliteli)

### v2 (pazarlama gücü)
- **Markalı filigran / logo** panoramanın zemin noktasında (kamera sopasının göründüğü yeri logolu bir daire kaplar)
- **Talep (lead) formu**: “Randevu iste” → Formspree/Netlify Forms/Google Form ile e-postanıza gelsin (sunucusuz)
- **Ziyaretçi istatistikleri**: hangi ilan kaç kez açıldı, hangi odada ne kadar kalındı (Plausible / Umami / Google Analytics 4 – KVKK aydınlatma metni gerekir)
- **Şifreli / özel turlar**: sadece linki bilen müşteri görsün (Cloudflare Access veya basit parola)
- **Çoklu danışman** desteği (ofis portalı: her ilanda farklı danışman)
- **Öncesi/sonrası** (boş daire ↔ yapay zekâ ile döşenmiş “sanal mobilya” görünümü)
- **Ses**: her odaya kısa anlatım; **yapay zekâ seslendirme** (metni yazın → TTS ile Türkçe ses dosyası → oda açılınca çalar)
- **Mini harita**: kat planı üzerinde “buradasınız” noktaları, plana tıklayınca o odaya geçiş
- **Mesafe ölçümleri / m² etiketleri** oda üzerinde

### v3 (ileri seviye)
- **Dollhouse / 3D model** (Matterport tarzı): 3D tarama için Matterport, Insta360 + 3D yazılımları veya iPhone LiDAR uygulamaları (Polycam vb.); ya da web'de kendi 3D görüntüleyicimizle
- **Reels / video dışa aktarma**: turu otomatik olarak dikey 9:16 videoya çevirip (oda oda dönen kamera + yazılar + müzik + yapay zekâ seslendirme) Instagram/TikTok'a hazır MP4 üretmek
- **Çok dilli tur** (TR/EN/AR/RU – yabancı yatırımcılar için; Avrupa yakasında özellikle Başakşehir, Esenyurt, Beylikdüzü projeleri)
- **Canlı ortak tur**: danışman ve müşteri aynı turda, danışman yönlendirirken müşteri ekranı takip eder (görüntülü görüşme ile)
- **Portal entegrasyonu**: ilan bilgilerini tek yerden girip sahibinden/emlakjet/hepsiemlak ilanlarına ve web sitesine aktarma
- **Yapay zekâ ile ilan metni**: property.json'dan otomatik ilan açıklaması ve sosyal medya metni

---

## 7. Bilinen sınırlamalar (v1)
- Sayfayı dosyadan çift tıklayarak açmak çalışmaz; yerel sunucu (`baslat.bat`) veya hosting gerekir.
- “Çek ve Kaydet” taslakları **sadece o telefonun tarayıcısında** saklanır; tarayıcı verisi temizlenirse veya başka telefona geçilirse görünmez. Gelişmiş düzenleyicide (bilgisayar) otomatik kayıt yok.
- Telefon panoramasının yatay açısı tahmindir (dikey açı ~65° varsayılır); görüntü basık/uzamış görünürse “Gelişmiş › dikey açı” ile ayarlanır.
- ZIP'i siteye eklemek manuel (kopyala + yeniden yükle). v2'de Netlify/GitHub'a tek tık yükleme eklenebilir.
- Google Harita gömme, Google'ın anahtarsız “embed” adresini kullanır; Google bu davranışı değiştirirse “Google Haritalar'da aç” butonu çalışmaya devam eder.
- Portföy sayfası tüm ilanların JSON'unu yükler; yüzlerce ilana çıkınca sayfalama gerekir.
