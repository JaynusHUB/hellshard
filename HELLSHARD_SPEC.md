# HELLSHARD — Oyun Brief'i

> Bu dosya projenin tek gerçek kaynağıdır. Her faz başında bu dosya ve `PROGRESS.md` okunur.

## 1. Vizyon
Metroidvania-lite açık dünya (birbirine bağlı bölgeler, gizli geçitler, boss arenaları) + roguelite koşu katmanı (XP, seviye atlama, 3'lü yükseltme seçimi, silah evrimi). Her koşu seed'li: dünya yerleşimi, gizli alanlar, hazineler ve dekorasyon seed'den üretilir; aynı seed aynı dünyayı verir.
Koşu hedefi: bölge boss'larını yen, Hellshard parçalarını topla, parçalar tamamlanınca final kapıya ulaş (final boss = stretch). Süre ilerledikçe zorluk artar; ölünce sonuç ekranı.
Öncelik sırası: (1) tasarım ve atmosfer, (2) akıcı/gecikmesiz oynanış, (3) tatmin edici savaş hissi, (4) detaylı 2D dünya, (5) yoğun düşmanda performans, (6) karakter derinliği ve tekrar oynanabilirlik, (7) hatasız, modüler, bakımı kolay kod.

## 2. Teknik gereksinimler
- Three.js r187 (npm: three@0.187.0; sürümün var olduğunu doğrula, yoksa en yakın kararlı sürümü kullan ve bana bildir). WebGLRenderer, ES modules, Vite + vanilla JS (mevcut package.json varsa koru).
- 2D bakış: OrthographicCamera, yan görünüm. Sprite'lar ve tile'lar düz quad'lar.
- Pixel art asla bulanıklaşmasın: NearestFilter (mag+min), mipmap kapalı, doğru colorSpace, atlas taşmasını (texture bleeding) önle, canvas'ta image-rendering: pixelated.
- Piksel-mükemmel render: oyun düşük dahili çözünürlüğe (config'te, varsayılan ~480x270, tile boyutuna göre ayarlanabilir) render edilir, TAMSAYI ölçekle büyütülür, gerekirse letterbox. Kamera ve sprite konumları piksel gridine snap'lenir; ekran sarsıntısı da tam piksel ofsetiyle yapılır.
- Sabit zaman adımlı (60 Hz) simülasyon + render interpolasyonu; sekme arka plana gidince spiral-of-death koruması.
- Dış CDN yok; her şey yerelden çalışsın. npm run dev ve npm run build hatasız olmalı.
- Tüm metinler tek bir strings dosyasında (en + tr); varsayılan dil İngilizce.

## 3. Asset paketleri ve sanat kuralları
KAPSAM: public/assets altında şu kaynaklar kullanılır:
- cemetery, church, swamp → Gothicvania paketleri (OpenGameArt)
- dungeon → ThePixelist 2D Medieval Castle Dungeon Tileset
- "fantasy forest map" → Killuakage Fantasy Forest Pixel Tileset (klasör adında boşluk var; yolları buna göre işle)
- cemetery/demo altındaki paketlenmiş sesler ve Tiled haritası
- Final ve audio klasörleri yalnızca kaynak havuzudur; oyuna yeni bir varlık eklenirse CREDITS.md ve ASSET_REPORT.md güncellenir.
Anokolisa Forest 16x16 ve Szadiart Rocky World bu projede YOK; referans verme. Mimari paket-bağımsız olsun: ileride paket eklenirse sadece ASSET_MANIFEST.json + bölge tanımı güncellensin, motor koduna dokunulmasın.
Kurallar:
- Tile boyutlarını ve sprite frame gridlerini kodla/görsel inceleyerek otomatik tespit et; tahmin etme, PNG'lere bak.
- Paketleri "stil ailelerine" ayır (tile boyutu, palet, outline, piksel yoğunluğu). Uyuşmayan stiller aynı bölgede/sahnede ASLA karışmasın. Bir sahnede tek piksel yoğunluğu olsun; sprite'lara asla tamsayı olmayan ölçek uygulama. Farklı aileler ayrı bölgelerdir; aralarında kapı, mağara girişi, portal veya kapı + fade geçişi olsun.
- Dungeon ve Forest paketleri muhtemelen sadece tileset; kahraman/düşman/boss sprite'ları büyük ihtimalle Gothicvania'dan gelecek. Faz 0'da bu sprite'ların bu tileset'lerle ölçek ve stil uyumunu değerlendir. Uyumluysa kullan. Uyumsuzsa çözüm üret (örn. palet normalizasyonu, bölgeyi iç mekan/farklı atmosferle ayrıştırma) ve çözümü raporla; çirkin karışım yapma.
- Gameplay fiziği tek bir "world tile" biriminde çalışsın; görsel ölçek paket başına normalize edilsin.
- Her bölge bir biyoma ve ona uygun düşman/prop havuzuna bağlı olsun.
- Yeterli kahraman/boss sprite'ı yoksa: palet değişimi/tint + farklı silah efektleri ile ayrıştır, hangi sprite'ın kime atandığını raporla. Programcı-sanatı çirkin placeholder üretme; zorunluysa işaretle.
- Her paketin lisans/readme dosyasını oku, CREDITS.md oluştur, kısıtlama varsa söyle.

## 4. Oyuncu kontrolü
A/D veya ok tuşları: hareket. Space/W: zıplama (coyote time, jump buffer, değişken zıplama yüksekliği, ivmeli hareket). Shift: dash (i-frame, eğilme/hızlanma efekti). J: temel saldırı (basılı tut = tekrar). K: ağır saldırı (hazırlık → darbe → toparlanma). L: özel yetenek (bekleme süreli). Esc: duraklat.
Fizik sabitleri (maks zıplama yüksekliği/mesafesi, dash mesafesi) tek config'te tutulur; seviye üretimi bu sınırlara göre yapılır.

## 5. Karakterler (4 adet, gerçekten oynanabilir)
Her biri için: ad, sprite/animasyon seti, kısa açıklama, başlangıç istatistikleri, özel yetenek, zorluk, saldırı stili, kendine özgü renk ve efektler. Seçim, o karakterin mekaniklerini gerçekten devreye sokar. Veri src/data/characters.js'te.
- Kael the Frostbow — menzilli, Frost Arrows; özel: buz tuzağı/duvarı. Orta.
- Brakk the Berserker — yakın dövüş, Berserker Cleave; özel: Blood Rage (hasar + can çalma). Kolay-orta.
- Seraphine the Frostweaver — büyü, Ice Orb; özel: kısa blink + buz patlaması. Zor.
- Nyx the Shadowblade — hızlı, Shadow Blades; özel: Shadow Step (ışınlanma dash'i, i-frame). Orta-zor.
Başlangıçta 2 karakter açık, diğerleri başarım/Hellshard ile açılır.

## 6. Savaş hissi (en önemli bölüm)
- Saldırı başında belirgin animasyon/hareket tepkisi; ağır saldırıda hazırlık-darbe-toparlanma.
- İsabette kısa, kontrollü parçacık patlaması + hitstop (1-4 frame) + hasar alan düşmanda beyaz/kırmızı flaş (instance attribute ile, yeni materyal yok).
- Uygun saldırılarda geri tepme; kritik vuruşta daha güçlü vurgu (büyük sayı, farklı parçacık, biraz daha uzun hitstop).
- Mermi/silah izlerinde yön vurgulayan trail efektleri.
- Düşman ölümü: sprite'ın kendi piksel renklerinden parçalanma efekti (tür başına farklı: buz kırılması, kıvılcım, gölge dumanı vb.).
- Önemli saldırılarda kısa ve kontrollü kamera sarsıntısı.
- Oyuncu hasar alınca belirgin ama görüşü kapatmayan geri bildirim (kenar vinyeti, kısa flaş, geri tepme, i-frame yanıp sönme).
- Ayarlar: ekran sarsıntısı %, flaş yoğunluğu %, hasar sayıları aç/kapa. Efektler görüşü asla kapatmasın.
- Ses: WebAudio ile sentezlenen SFX (swing, hit, crit, ölüm, dash, level-up, XP toplama, boss uyarısı); master/SFX/müzik ses ayarları. Müzik opsiyonel (ambient drone olabilir).

## 7. Düşmanlar ve yapay zekâ
En az 6 (paketler yeterliyse 8) normal tür (yerde yürüyen, zıplayan/atılan, uçan, menzilli, kamikaze/charger, tank, küçük sürü vb.) + en az 2 elit tür; biyoma bağlı havuzlar. Sprite çeşitliliği yetmezse aynı stil ailesi içinde palet/ölçek varyantları ve davranış farklarıyla çeşitle, raporla. Her birinin farklı: sağlık, hız, hasar, saldırı menzili, bekleme süresi, silüet, ölüm efekti, davranış mantığı. Veri src/data/enemies.js'te.
AI durum makinesi: Spawn → Chase → Attack (windup → strike) → Recover → Chase → Dead. Platform uyarlamaları: uçanlar için hover/dive, menzilliler için Retreat/Keep-distance, yerdekiler için uçurum ve duvar algısı.

## 8. Boss sistemi
En az 2 (tercihen 3) boss, her biri bir bölgede kilitlenen arenada. Normal düşmandan belirgin büyük, sağlık çubuğu, en az 2 faz, saldırı ön işaretleri (telegraph), farklı animasyonlar. Oyuncunun kaçması, pozisyon alması ve yeteneklerini kullanması gerekmeli. Ödül: Hellshard parçası + garantili yükseltme sandığı. Boss boyutunda sprite yoksa en büyük düşmanı kullan; silüet/efekt/dövüş mantığıyla ayrıştır ve bildir.

## 9. Roguelite gelişim
- Düşmanlar XP kristali düşürür; manyetik toplama; XP dolunca oyun durur, 3 rastgele yükseltme gösterilir (tıklama veya 1/2/3 tuşu), seçim sonrası oyun devam eder.
- Havuz (hepsi gerçek mekanik; maxLevel ve üst sınırlar src/config/upgrades.js'te): Attack Speed, Critical Chance, Critical Damage, Frost Power, Projectile Count, Area Damage, Movement Speed, Max Health, Armor, Life Recovery, XP Gain, Magnet Range, Dash Cooldown. Aynı yükseltme çok kez alınabilir; makul üst sınırlar (örn. Crit Chance %60, Armor %50 azaltım, Dash CD -%50).
- Evrim: silah Lv5 + eşleşen pasif → evrim kartı. Frost Arrows + Frost Power → Piercing Glacier; Berserker Cleave + Life Recovery → Bloodstorm; Ice Orb + Area Damage → Frozen Nova; Shadow Blades + Critical Chance → Void Reaper. Evrilmiş silah görsel ve mekanik olarak belirgin farklı olmalı.
- Meta ilerleme (localStorage): Hellshard para birimi, karakter kilitleri, birkaç kalıcı küçük bonus, en az 10 gerçekten tetiklenen başarım.
- Sonuç ekranı: hayatta kalınan süre, yenilen düşman, yenilen boss'lar, kazanılan XP, açılan başarımlar, en güçlü yükseltmeler.

## 10. Dünya ve harita
- Aktif sürüm iki bölge içerir: Cemetery (paketlenmiş Tiled) ve Church (prosedürel). Swamp, dungeon ve forest ileride geri eklenebilir; assetleri `public/assets` altında durur. Kaldırılan Dungeon Gate ve Gate Warden aktif oyunda yoktur.
- Aktif kampanya rotası: Cemetery (paketlenmiş Tiled) → Church (prosedürel). Mourning Maw ve Seraph of Ash birer Hellshard düşürür; son bölgedeki boss sandığı açılınca run victory ile biter.
- Chunk/oda tabanlı üretim: elle tasarlanmış şablonlar + seed'li varyasyon. Üretilen her yol oyuncunun hareket zarfına göre ULAŞILABİLİR olmalı; bunu doğrulayan script yaz (npm run validate:world — 1..100 seed).
- Gizli içerik: kırılabilir duvarlar, sahte duvarlar (içinden geçilir, ince görsel ipucu), gizli mağaralar, hazine sandıkları (koşuya özgü rastgele ödül), risk/ödül sunakları, boss arenaları.
- Canlı dünya (YALNIZCA paketlerde ilgili tile/frame varsa): animasyonlu su ve şelale (atlas frame animasyonu, tek zaman uniform'u; tile başına JS yok), hareketli platformlar (oyuncuyu taşır), tuzak/dikenler, parallax arka planlar, uzakta sise karışan katmanlar. Pakette su frame'i yoksa: paket paletiyle basit tek-uniform dalga efekti yap veya özelliği atla ve raporla.
- Dekorasyon üst üste yığılmasın, ana yollar ve savaş alanları kapanmasın, oyuncu harita dışına çıkamasın. Harita boyutu ve yoğunluk config'te.

## 11. Dalga ve zorluk
Tüm süreler src/config/difficulty.js'te kolay değiştirilebilir: 0-2 dk öğretici düşmanlar; 2-5 dk daha fazla düşman + ilk özel türler; 5-8 dk dayanıklılar ve yoğun sürüler; 8-12 dk elitler ve tehlikeli kombinasyonlar; 12+ dk boss'lar ve artan zorluk.
Zorluk sadece düşman canıyla artmasın: yeni türler, kombinasyonlar, yoğunluk ve özel olaylar (Hellshard Surge hücumu, pusu, elit sürü) değişsin.
Spawn direktörü: düşman başına maliyet, saniyelik bütçe, bölge yoğunluk çarpanı, ekran dışında geçerli zemin/hava noktasında spawn, maksimum aktif düşman sınırı. Kare süresi sürekli yüksekse spawn hızı ve limit kontrollü düşsün, düzelince yavaşça toparlansın.

## 12. Animasyon ve VFX
Karakterler kayarak hareket etmesin: koşu gövde hareketi, saldırı hazırlık/darbe, hasar tepkisi, dash eğilmesi, kontrollü ölüm animasyonu. Paketlerdeki frame animasyonlarını kullan; eksik olanı squash-and-stretch ile tamamla.
Parçacık efektleri (hepsi havuzlanmış): buz kırılması, ateş/kıvılcım, gölge sisi, darbe, XP parıltısı, ölüm, boss telegraph, büyü trail'i, kritik patlama. Efekt başına yeni geometri/materyal oluşturma yok.

## 13. Arayüz (HTML/CSS overlay)
Ana menü, karakter seçimi (animasyonlu önizleme + istatistikler), HUD (can, XP, seviye, süre, öldürme, özel yetenek ve dash bekleme, boss barı, silah/evrim ikonları), level-up kartları, duraklatma, ayarlar (seed girişi dahil), sonuç ekranı, başarımlar. Responsive; piksel fontu yerel (lisansı uygun) veya CSS fallback; ikonlar pixelated.

## 14. Performans hedefi
Orta seviye dizüstünde 60 FPS: ~150 aktif düşman + ~500 parçacık. Teknikler: atlas başına InstancedMesh (instance başına uv/flip/tint/flash attribute), statik tile'lar chunk başına birleştirilmiş mesh, chunk culling, spatial hash ile çarpışma, sıcak yolda sıfır allocation, nesne havuzları, kaynakları dispose et. F3 ile debug overlay (FPS, draw call, entity/parçacık sayısı, spawn bütçesi).

## 15. Kod kuralları
Modüler yapı: src/core, render, world, entities, combat, systems, ui, config, data. Modül ~400 satırı geçmesin; magic number yok, ayarlar config'te. Saf mantık için (RNG, upgrade üst sınırları, dünya doğrulama) vitest ile birkaç gerçek test.

## 16. Fazlar
FAZ 0 — Keşif ve plan (kod yok): public/assets altını recursive tara; her paket için dosya özeti, PNG boyutları, tile boyutu, spritesheet frame grid ve animasyon frame sayıları, kategoriler (tile/arka plan/kahraman/düşman/boss/prop), lisans dosyaları. PNG'leri görsel olarak aç ve incele. Stil ailesi/uyumluluk analizi, biyom–paket eşlemesi, bölge geçiş planı, tile normalizasyon stratejisi, 4 karakter için sprite atama önerisi. three sürümünü doğrula, Vite'ı hazırla. Çıktılar: ASSET_MANIFEST.json, ASSET_REPORT.md, ARCHITECTURE.md, CREDITS.md taslağı. Kritik bulgu (örn. ölçek uyumsuzluğu) varsa özetle, makul varsayımla devam et.
FAZ 1 — Çekirdek: render hattı (pixel-perfect), game loop, input, kamera, tilemap render (Cemetery), oyuncu hareketi (coyote/buffer/dash), debug overlay.
FAZ 2 — Savaş çekirdeği: 1 karakter, 1-2 düşman, tam geri bildirim seti (hitstop, flaş, geri tepme, parçacık havuzu, sarsıntı, hasar sayıları, SFX). → İlk oynanabilir dilim.
FAZ 3 — Düşman sistemi: AI durum makinesi, tüm normal/elit türler, spawn direktörü ve bütçe, XP kristalleri, level-up ve yükseltme havuzu.
FAZ 4 — 4 karakter, evrimler, menü/seçim/HUD/ayarlar/sonuç ekranı, meta ilerleme, başarımlar.
FAZ 5 — Dünya: chunk üretimi, doğrulama scripti, 5 bölge ve bağlantıları, geçişler, gizli alanlar, hazineler, animasyonlu su/şelale (pakete göre), hareketli platformlar, parallax/sis.
FAZ 6 — Boss'lar, arenalar, olaylar ve zorluk zaman çizelgesi, (stretch) final kapı.
FAZ 7 — Cila ve performans: profilleme, adaptif spawn, denge, ses cilası, harita ekranı (stretch), CREDITS, README.
