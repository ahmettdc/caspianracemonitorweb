# Caspian Race Monitor — çalışma kuralları

## 0. EN ÜST ÖNCELİK: OYUN DONMAMALI

Bu projenin köprüsü (`bridge/`) **sürücünün oyun PC'sinde**, yarış sırasında çalışır.
Orada bir takılma yarışı bitirir. **Hiçbir özellik bu riske değmez.**

Bu kural diğer her şeyi ezer: doğruluk, tazelik, yeni veri, "daha iyi olurdu" —
hepsinden önce gelir. Bir özellik ancak oyun PC'sindeki yükü ölçülebilir şekilde
artırmıyorsa eklenir.

### Donmanın bilinen sebepleri (sahada ölçüldü, tahmin değil)

1. **LMU REST API** (`127.0.0.1:6397`) — oyunun KENDİ localhost sunucusuna istek atar.
   Donmanın **en güçlü sebebi**. Durum sürüm sürüm değişti, bugünkü gerçek şu
   (v2.4.1'de kod okunarak doğrulandı — bu paragraf eskiden koda uymuyordu):
   - **Arayüz (`gui.py`) yolunda REST AÇIK**, yenileme 3 sn sabit. v1.7.3'te bilinçli
     olarak açıldı; gerekçe v1.4.140'taki **fetch-once** düzeltmesi (katalog/gökyüzü
     sözlüğü artık bir kez çekilip önbelleğe alınıyor, her karede değil). Kullanıcı
     toggle'ı o sürümde arayüzden kaldırıldı.
   - **`--nogui` / CLI yolunda varsayılan KAPALI** — `[rate] rest_on` okunur, yoksa false.
     Not: arayüz `save()` çağrıldığında config'e `rest_on = true` yazar, yani arayüz bir
     kez çalıştıktan sonra CLI yolu da açık başlar.
   - **`--no-rest` her yolda REST'i kapatır** (v2.4.1). Öncesinde bayrak `launch()`'a
     hiç geçirilmiyordu, yani arayüz/çift tıklama yolunda ve `--dump`/`--dump-wx`
     teşhis komutlarında **sessizce yok sayılıyordu**. Donma şüphesinde başvurulacak
     kaldıraç budur.
   - REST kapalıyken pozisyon/tur/gap/lastik **ve bayraklar** (sarı/FCY dahil, v2.2.4)
     çalışır. Yalnız **VE%** ve **gerçek takım adı** REST'e bağlıdır.
   - Yeni bir özellik REST gerektiriyorsa: **önce paylaşımlı bellekte var mı diye bak.**
     v2.2.4'te bayrak tam da böyle REST'ten shmem'e taşındı. Bu kural değişmedi —
     REST'in açık olması yeni REST çağrısı eklemeyi serbest bırakmaz.
2. **WebView2 / Chromium** — masaüstü uygulaması gömer, oyunun GPU/çekirdekleriyle
   yarışır. Sürüş PC'sinde **hafif köprü .exe** (tarayıcısız) önerilir.
3. **Yüksek yayın hızı** — `[rate] hz` varsayılan **2** (0.5 sn periyot), 0.2–10 arası
   klamplı. Bu değeri **kendiliğinden artırma.** Sektör/pit sınırı hassasiyeti gibi
   şeyler için "hz'i yükseltelim" cazip gelir; gelmesin — sapma birkaç metre, donma
   yarış demektir.

Köprü ayrıca **düşük öncelikte** çalışır (oyun çekişmede kazanır) — bu da korunacak.

### Yeni özellik eklerken yapılacak denetim

Oyun PC'sindeki maliyeti **ölç, tahmin etme.** Sorular:

- Yeni bir **REST/ağ isteği** var mı? → varsa neredeyse kesin HAYIR.
- Yeni bir **thread / timer / poller** var mı? → varsa gerekçelendir.
- **Yayın hızı** değişiyor mu? → hayır.
- Paylaşımlı bellekten **ek alan okumak** ucuzdur (aynı mmap, sadece `getattr`) — bu
  genelde güvenli yoldur.
- Firebase **kare boyutu** ne kadar büyüyor? Ölç: `json.dumps(frame)` ile önce/sonra.

Örnek (v2.3.0 denetimi): `bestSectors` + `tyreChange` + `timeIntoLap`/`estLapTime`
eklendi → kare 14 araçta +1.324 B (%12), araç başına ~95 B, 40 araçlık gridde
**~7.4 KB/sn** (2 Hz). `_best_sectors` CPU'su 128 araç için **~0.2 ms/sn** (bir
çekirdeğin %0.02'si). Yeni REST yok, yeni thread yok, hız değişmedi. → kabul edildi.

Not: paylaşımlı bellekten ek alan okumak bu projede tercih edilen yoldur — v2.3.0'da
relative hesabı mesafeden oyunun kendi `mTimeIntoLap` alanına taşındı ve maliyeti
araç başına 2 `getattr` oldu. REST'e uzanmak yerine önce struct'a bak.

## 1. Veri dürüstlüğü

Oyun bir veriyi vermiyorsa **uydurma.** Bu projede tekrar tekrar bu hataya düşülmüş
ve her seferinde geri alınmış:

- Gerçek incident (temas + track-cut) sayısı bu veri yolunda **yok** — sütun "Ceza"
  diye dürüstçe adlandırıldı (v2.2.4).
- `Number(null) === 0` tuzağı: eksik `lapDist` "S/F çizgisinde" sayılıp makul görünen
  ama uydurma bir relative farkı üretiyordu (v2.3.0'da elendi).
- Sektör/pit sınırları **gözlenir**, gözlem yoksa **çizilmez** — varsayılan/tahmini
  oran yok (`trackSectors.js`, `TrackMap.jsx`).
- Modellenmiş değerler etiketlenir ("Turlardan modellenmiş tahmin (gerçek okuma değil)").

## 2. Yapı

- Mantık **saf modüllere** çıkar (`liveSectors.js`, `liveSort.js`, `liveRelative.js`,
  `trackSectors.js` deseni), React/Firebase bağımsız + doğrudan testli.
- Köprü testleri bağımlılıksız çalışır: `python3 bridge/test_*.py`.
- JS testleri: `npx vitest run`. Build: `npm run build`.
- Yorumlar **Türkçe** ve "neden" anlatır — bu kod tabanında yorumlar kök-neden kaydıdır.

## 3. Sürüm yükseltirken güncellenecek yerler

`package.json` · `src-tauri/tauri.conf.json` · `public/sw.js` (CACHE adı) ·
`src/constants.js` (APP_VERSION) · `src/changelog.js` (TR+EN) · `CHANGELOG.md`

`sw.js` CACHE adı unutulursa kullanıcılar **eski sürümü görmeye devam eder** (v2.2.4'te
yaşandı).
