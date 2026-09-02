# Changelog

## v2.4.0 — 2026-09-01

### Yeni ekran: Strateji Karşılaştırma (yarış öncesi karar aracı)

Kaynak: takımın kendi Excel'i — `Caspian_Motorsport_Race_Control_V1.28.xlsm`,
`TEAMS STRATEGY` (takım kayıt defteri) + `STRATEGY COMP` (karşılaştırma) sayfaları.
Kullanıcının tarifi: **"yarış sırasında kullanmayacağız, yarıştan önce doğru
stratejiye karar vermek için"**.

- **Oyun PC'si maliyeti: SIFIR** (CLAUDE.md §0 denetimi). Ekran yarış sırasında
  çalışmıyor; yeni REST isteği yok, yeni thread/timer yok, yayın hızı değişmiyor,
  Firebase karesi büyümüyor. Girdiler tamamen kullanıcının elle girdiği plan
  verisi, tek istisna "Planımdan ekle" — o da uygulamanın ZATEN hesapladığı
  `computePlan` çıktısını okuyor, köprüden bir şey istemiyor.

- **Model** (`src/stratComp.js`, saf modül, 46 test):

  ```
  tempo  = ortalamaTur × toplamTur
  sabit  = pitAdet × pitYolu + tamServis × (pitAdet − 1) + sonPitYakıtı
         + lastikAdet × lastikSüresi + ceza + hasar
  TOPLAM = tempo + sabit
  ```

  Excel'in sayıları birebir üretiliyor ve testle kilitlendi: dosyadaki
  `#4 PESCARA SRT` ↔ `#75 CASPIAN MOTORSPORT` karşılaştırmasında
  `D16 STRATEGY RESULT = +47.0` ve `D17 TOTAL RESULT = −13.9`, ara değerler
  `D12 = −0.350 sn/tur`, `B16 = −60.9 sn`.

- **Katmanlar:** hesap `stratComp.js` · durum `state.js` reducer'ları
  (`applyStratAdd/Up/Del`, `stratPick`) · ekran `tabs/StratCompTab.jsx`.
  Kalıcılık için kural değişikliği GEREKMEDİ: oda durumu zaten tek bir
  `stateJson` olarak `teams/{tid}/raceState/{rid}` altına yazılıyor, yeni alanlar
  (`stratTeams`, `stratLaps`, `stratA`, `stratB`) oraya doğrudan giriyor ve
  `migrate` ile eski odalarda kendini onarıyor.

### Excel'in üç gerçek kırığı — taşınmadı, düzeltildi

Model taşınırken kaynak dosya formül seviyesinde okundu; üç kırık bulundu ve
hiçbiri koda geçirilmedi.

1. **Eksik veri sıfır sayılıyordu.** `STRATEGY COMP`'un `XLOOKUP`'larında
   `if_not_found` yok ve kayıt defterindeki 25 takımın **23'ü boştu** (yalnız
   satır 2 ve 3 dolu). Boş bir takım seçilince ortalama tur `0` okunuyor,
   `D12 = (0 − 2:02.5) × 86400 = −122.5 sn/tur` çıkıyor ve 174 turluk yarışta
   `TOTAL RESULT = −21.867 sn` (≈ 6 saat) gibi **tamamen uydurma** bir sonuç
   üretiliyordu — üstelik negatif olduğu için koşullu biçim onu **yeşile**
   boyuyordu. CLAUDE.md §1'in adını koyduğu `Number(null) === 0` tuzağının
   Excel'deki karşılığı. Artık zorunlu alanı eksik takım **hesaplanmıyor**:
   `teamTime()` `ok:false` ve `missing[]` döndürüyor, ekran eksik alanları
   adıyla listeliyor, tek bir sayı bile göstermiyor.
   Ceza ve hasar bunun dışında: boş bırakılmaları "yok" (0 sn) olarak okunuyor
   — yarış öncesi normal durum bu ve kural ekranda yazılı.

2. **Renkler kullanıcının kendi takımı aleyhine okunuyordu.** Koşullu biçim
   `D12`, `B16`, `D16:D17` üzerinde `<0 → yeşil`, `>0 → kırmızı`; ama tüm
   deltalar `sol − sağ` yönünde ve kullanıcının takımı **sağda** duruyordu.
   Sonuç: `D17 = −13.9` (rakip önde) yeşil, `D16 = +47` (biz öndeyiz) kırmızı.
   Artık kazanan **adıyla** yazılıyor ("#4 PESCARA SRT 13.9 sn önde"); renk
   yalnız o cümleyi tekrarlıyor.

3. **Paneller simetrik görünüp simetrik değildi.** Sağ panelde tempo terimi
   sabit `0` yazılıydı (`I16`, `K12`) ve sağın `STRATEGY TIME` toplamı (`I17`)
   o terimi hiç içermiyordu, solunki (`B17`) içeriyordu — yani sağ taraf sessizce
   "referans"tı ve takımların yerini değiştirmek sonucu bozardı. Mutlak süre
   kurgusu (her takım için toplam yarış süresi, sonra fark) aynı sayıları
   üretiyor ama simetrik ve ikiden fazla takıma ölçekleniyor; testle kilitlendi
   ("takımların yeri değişince sonuç yalnız işaret değiştirir").

İki küçük kırık daha bulundu ve yeni ekranda karşılığı yok: livery `XLOOKUP`'ı
boyut uyuşmazlığı yüzünden `#VALUE!` döndürüyordu (arama `A2:A25` 24 satır,
dönüş `B2:B20` 19 satır) ve açılır listenin aralığı `A2:A25` olduğu için
defterdeki son takım (`#306 BOYD TRANSPORT RC`, `A26`) hiç seçilemiyordu —
yeni seçici defterin tamamını gösteriyor.

### "Planımdan ekle" — son durak yakıtı artık elle girilmiyor

Excel'de kendi satırınızın on alanı elle giriliyordu ve dosyada tam da bu yüzden
bir kalem eksik kalmıştı: `FUEL TIME (LAST PIT)` hâlâ **tam servis (40 sn)**
yazıyordu, oysa sayfanın kendi notu `F4:G5`'te bunu **"ÖNEMLİ!"** diye
işaretliyor — son durakta yalnız bitirmeye yetecek yakıt alınır. Rakip satırında
7 sn girilmişti, bizimkinde girilmemişti.

Uygulama bu değeri zaten hesaplıyor: `computePlan` `lastRefuelPct` döndürüyor.
`seedFromPlan()` satırı ondan kuruyor (`fuelFull × lastRefuelPct / 100`), ayrıca
pit/stint sayısını, pit yolu süresini, lastik değişen durak sayısını ve havaya
göre düzeltilmiş ortalama turu plandan alıyor.

Etkinin büyüklüğü: dosyadaki karşılaştırmada bu tek hücre 40 → 7 olduğunda
`TOTAL RESULT` **−13.9 sn'den +19.1 sn'ye** dönüyor, yani sonuç işaret
değiştiriyor. Plan geçersizse (`invalid`) `seedFromPlan` `null` dönüyor ve satır
eklenmiyor — yarım plandan satır uydurulmuyor.

**Lastik süresi kaynağı bilinçli seçildi:** `TYRE_4_SEC` (12 sn), yani
`computePlan`'ın pit sürelerini kurarken kullandığı sabit. `DEFAULT_STATE`'teki
`tyreChangeT34` lastik PLANLAYICISININ ayrı, kullanıcı düzenlenebilir değeri;
ikisini karıştırmak karşılaştırmayı kendi planından koparırdı.

### Excel'de ölü duran iki sütun işe koşuldu

- `STINT NUMBERS` hiçbir formüle girmiyordu. Artık pit sayısıyla çapraz
  doğrulanıyor: stint ≠ pit + 1 ise satırda uyarı işareti çıkıyor. Aynı şekilde
  lastik değişimi durak sayısını geçemez. Uyarılar **hesabı durdurmuyor**, yalnız
  veri girişi hatasını gösteriyor.
- `TOTAL BALLAST` de hiçbir hesaba girmiyordu ve **hâlâ girmiyor** — ama bu kez
  bilinçli ve yazılı: oyun kg → sn/tur karşılığını vermiyor, uydurmak yerine
  sütun bilgi amaçlı bırakıldı ve tooltip'te sebebi yazıyor (CLAUDE.md §1).

### İki kullanım, tek ekran: rakip karşılaştırması ve "A planı mı B planı mı"

Kullanıcı bildirimi: *"bazen A planı B planından hangisi hızlı demek için de
bakıyoruz"*. Model aynı — değişen tohumlama ve etiketler.

- **Varyant tohumlama.** `st.strategies` zaten dört varyant taşıyor
  (`{A: 8, B: 9, C: 10, D: 11}` — stint başına tur) ama `computePlan` yalnız
  `st.chosen` olanı kuruyordu. "Planımdan ekle"nin yanına her varyant için düğme
  kondu; basılan varyantın planı `computePlan({ ...st, chosen: key })` ile
  kurulup satır olarak ekleniyor.
- **Plan TIKLANINCA hesaplanıyor.** Dört varyantı her renderda kurmak
  `computePlan`'ı (tur-tur yürüyüş + sabit-nokta döngüsü) dörde katlardı; bu
  dosya v2.3.0'da tam bu yüzden üç çağrıyı bire indirmişti ve maliyet canlı
  yarışta da ödenirdi. Düğmelerin aktifliği ucuz bir ön kontrolden okunuyor
  (`strategyOptions` — `invalid` koşulunun yürümeden bakılabilen kısmı), seçili
  varyant için zaten hesaplanmış `racePlan` yeniden kullanılıyor.
- **Etiketler nötrleştirildi:** "Takım A/B" → "A/B", "Takım kayıt defteri" →
  "Kayıt defteri", "N takım" → "N satır", ad sütunu "Ad", yer tutucu "Takım ya da
  plan adı". Aynı ekran hem rakip hem kendi planlarınız için okunuyor.

**Modellenmeyen şey etiketlendi (CLAUDE.md §1).** İki satırın ortalama turu
birebir aynıysa sonuç kutusunda uyarı çıkıyor. Bu, iki planı da uygulamadan
tohumlayınca OLAĞAN durumdur: `computePlan` tek bir efektif tur süresi kullanır
(`effLapSec`), uzun stintin yakıt yükü ve lastik yaşı yüzünden yavaşlamasını
modellemez. Uyarı olmasaydı araç "az durak hep kazanır" derdi — uzun stintin
gerçek bedeli görünmeden. Uyarı, gerçek tempo farkı biliniyorsa ortalama turun
satır başına elle girilmesini söylüyor.

### Pist + sınıf seçici — pit yolu ve ortalama tur otomatik

Kullanıcı bildirimi: *"pisti de seçebilelim böylece pit yolu süresi ve ortalama
average lap süreleri otomatik gelebilir biz gerekirse üstünden değiştiririz"*.

- **İki alan da GERÇEK kaynaktan** (uydurma yok, CLAUDE.md §1):
  - pit yolu → `PIT_LANE_TIMES[pist]` (LMU Endurance Planner verisi)
  - ortalama tur → `lmuData.data[pist][sınıf].avgLap` — uygulamanın zaten
    günlük çektiği "Ohne Speed" tempo tablosu (`public/assets/lmu-data.json`,
    `.github/workflows/lmu-laptimes.yml`). ~1.02 "Good" temposu.
- **Saf yardımcı** `trackDefaults(trackId, classId, lmuData, pitLaneTimes)`
  (stratComp.js, 6 test): her alan BAĞIMSIZ `null` döner — pit yolu verisi olan
  ama LMU'da olmayan pistte ortalama tur boş kalır, tersi de. UI "veri yok"
  yazar, o alanı boş bırakır.
- **Öneri, kilit değil.** "Boş satır" eklerken pit yolu + ortalama tur hazır
  gelir (yalnız verisi olan alan); kullanıcı üstüne yazabilir. Plan-tohumlu
  satırlar bundan etkilenmez — onların değeri kendi planından (daha doğru) gelir.
- **Pist boşsa mevcut yarışa düşer** (`st.stratTrack || st.track`,
  `st.stratClass || st.carClass`) — bir yarış açıkken seçim tekrarına gerek yok.
- Yeni durum alanları `stratTrack` · `stratClass` (migrate ile eski odalar
  kendini onarır). Pist listesi `TRACKS`, sınıf listesi `CAR_CLASSES`.

### Ekran tasarım fişine göre yeniden kuruldu (hifi port)

Kaynak: `design_handoff_strateji_karsilastirma` — "birebir port" (fidelity:
hifi) kuralıyla geldi. Ölçüler, boşluklar, yazı tipleri, metinler ve
etkileşimler prototipten (`Strateji Karşılaştırma.dc.html`) alındı.

**Yeni bölümler:** iki "hero" plan kartı (araç görseli · hayalet numara · sınıf
rozeti · tahmini bitiş) · ortada karar kartı (kazanan adı, büyük fark, kazanana
doğru büyüyen çubuk, tempo/sabit istatistik kutuları, breakeven satırı) ·
**sabit kayıp dağılımı çubuğu** (pit yolu/yakıt/lastik/ceza/hasar, iki plan
ORTAK ölçekte, sıfır kalem çizilmez, %11'den dar dilimde yazı gizlenir) ·
salt-okunur kayıt defteri + satır düzenleme penceresi · araç görselli sıralama ·
−/+ tur sayacı.

**Renkler: fişin hex'leri = uygulamanın tokenları.** Fiş "app tokenlarını
kullanma" diyor; karşılaştırıldığında fişteki **24 rengin 24'ü** `styles.js`'te
zaten aynı değerle tanımlı çıktı (tasarım uygulamanın kendi paletiyle çizilmiş).
Bu yüzden token üzerinden yazıldı: koyu temada renk fişle birebir aynı, açık
tema da bozulmuyor. Token karşılığı olmayan tek renk `#FFE2B0` (amber uyarı
metni) → `--rc-warn-text` olarak eklendi (v2.3.1 lastik fişindeki desen).
Fontlar zaten uyuyordu: `index.html` Rajdhani + IBM Plex Mono + Inter'i fişin
istediği ağırlıklarla yüklüyor.

**Fişten üç bilinçli sapma** (hepsi kodda işaretli):

1. **Hesap prototipten değil, `stratComp.js`'ten.** Fişin "Calculation model"i
   zaten bu modülden kopyalanmış (README öyle diyor) ve modül Excel'in
   sayılarına karşı test edilmiş. Prototipin `seed()`'i ise pit yolu 24 /
   yakıt 40 / ort. tur "2:02.400" gibi SABİT değerler yazıyor — README bunu
   *"placeholder demo data · wire the real register to the app's data source"*
   diye işaretliyor. "Planımdan ekle" gerçek `computePlan` çıktısını kullanır.
2. **Seçim listeleri gerçek veriden.** Prototip 5 GT3 aracını sabit yazıyor;
   burada uygulamanın `CARS`/`CAR_CLASSES` listesi ve `teamAssets.carImageSrc`
   (takımın yüklediği görsel varsa o) kullanılır.
3. **Pist + sınıf seçici korundu.** Prototipin başlığında bayrak ve "6H Spa"
   alt yazısı var ama seçici yok — fiş, seçicinin eklendiği commit'ten önceki
   PR'a bakıyor. Seçici başlığa fişin diliyle yerleştirildi; bayrak ve alt yazı
   seçili pistten gelir.

Düzenleme penceresi ayrı bileşene çıkarıldı (`RowEditModal`): sekmedeki
`editIdx` YEREL state olduğu için (kalıcı değil — TyreTab deseni) statik render
onu açamıyordu; ayrılınca pencere de doğrudan test edilebildi.

### Kod incelemesinde bulunan 7 hata düzeltildi

Hepsi bu sürümün kendi kodunda; `/code-review` taraması + sayısal doğrulama.

**1. Tohumlanan satır planın temposunu yanlış alıyordu** (`stratComp.js`).
`seedFromPlan` ortalama tur olarak `plan.lapSec` kullanıyordu — bu değer
engine'de `baseLap × endWx.lap`, yani yalnız yarış SONU havasının çarpanı.
Kuru→ıslak bir planda bu tüm yarışa uygulanınca tempo şişiyordu: 6 saatlik
dry→xwet planda ölçüldü, satır **22.356 sn** diyordu, planın gerçek stint
toplamı **20.750 sn** (+1.606 sn ≈ **27 dakika**). Artık ortalama tur
`Σ stintSec / totalLaps`.

**2. Yakıt ve lastik plandan kopuktu** (`stratComp.js`). Tohum her durağa tam
servis yakıt ve her lastik durağına `TYRE_4_SEC` (12 sn) yazıyordu. Oysa
`computePlan` yakıtı durak başına ÖLÇEKLER (sonraki stintin VE %'si), `pits[i].fuel`
kapalıysa hiç eklemez, ve 1-2 lastikte `TYRE_2_SEC` (5 sn) kullanır. Ölçülen:
2 lastikli + bir yakıtsız duraklı planda lastik **84 sn** yerine gerçek **35 sn**,
yakıt **293** yerine **249**, sabit kayıp **531** yerine **438**. Alanlar artık
`plan.rows`tan geri çıkarılıyor (`pitSec − pitYolu − lastikSn − tamir`), plan
tamir süresi de HASAR alanına yazılıyor.

**Sözleşme testle kilitlendi:** tohumlanan satırın toplamı = planın kendi yarış
süresi. Dört senaryoda uçtan uca ölçüldü (düz kuru · dry→xwet · 2 lastik +
yakıtsız durak · tamirli): sapma **< 0.7 sn** (yuvarlama).

**3. Tek satırlık defterde satır KENDİSİYLE karşılaştırılıyordu**
(`StratCompTab.jsx`). `stratPick` A ve B'yi de 0'a kırpınca ekran
"İki strateji eşit · 0.0" yazıyordu — hiç karşılaştırma yokken üretilmiş
uydurma bir "sonuç". Artık `sameRow` denetimi var ve iki ayrı uyarı çıkıyor.

**4. "Plandan doldur" kullanıcının verisini siliyordu** (`App.jsx`).
`stratSeedInto` yalnız kimlik alanlarını hariç tutuyordu; girilen **ceza** ve
**balast** sessizce siliniyordu. Artık korunuyor; hasar yalnız planda gerçekten
tamir varsa yazılıyor.

**5. MoTeC/Avrupa tur yazımı reddediliyordu** (`stratComp.js`). `engine.parseLap`
`"2.02.500"` biçimini uygulamanın her yerinde kabul ediyor; `parseLapSec`
etmiyordu ve satır "ort. tur eksik" görünüyordu — kullanıcı yalnız BİÇİMİN
yanlış olduğunu göremiyordu.

**6. Adsız ama verisi tam satır kayboluyordu** (`stratComp.js`). `rankTeams` ad
şartı koyduğu için böyle bir satır ne sıralamaya ne de "sıralamaya girmeyen
(eksik veri)" listesine giriyordu. Sekme onu zaten "Satır N" diye adlandırıyor.

**7. Ölü dışa aktarımlar + zayıf indeks kırpma** (`StratCompTab.jsx`).
`compareTeams` ve `state.stratPick` dışa aktarılmış ve test edilmişti ama sekme
ikisini de yeniden yazıyordu; yerel kırpma tam sayı olmayan indeksi geçirip
`teams[1.5]` okumasına izin veriyordu. İkisi de artık kullanılıyor, delta
matematiği tek yerde.

### Doğrulama

- **901 JS testi** (52 → 54 dosya; öncesi 797, +104). Yeni: `stratComp.test.js` 61 ·
  `stratCompTab.render.test.jsx` 31 · `state.test.js` +12 reducer testi. Yukarıdaki
  yedi hatanın her biri regresyon testiyle kilitlendi.
- Excel'in sayıları regresyon kilidi olarak testte: `+47.0` · `−13.9` ·
  `−0.350 sn/tur` · `−60.9 sn` · son-pit kaldıracının işaret değiştirmesi
  (`+19.1`) · boş takımın `ok:false` dönmesi.
- `npm run build` temiz · `npx oxlint src` yeni uyarı üretmiyor (i18n kopya
  anahtar sayısı 25 → 25, yani hiçbir mevcut çeviri ezilmedi; "Ceza" anahtarı
  Canlı Timing'in `"Pen."` sütununa ait olduğu için yeni sütun "Ceza süresi"
  adıyla ayrıldı).

## v2.3.1 — 2026-09-01

_Geliştirme sürüyor — bu sürüme iş eklendikçe bölümler büyüyecek._

### DriverMode butonu — masaüstünden hafif köprüye tek tıkla geçiş

- **Belirti:** sürüş PC'sinde masaüstü uygulaması WebView2 taşıdığı için oyunla
  çekişiyor (CLAUDE.md §0, donma sebebi #2) ve README tam da bu yüzden sürüş PC'si
  için tarayıcısız köprüyü öneriyor — ama uygulamadan köprüye geçmenin bir yolu
  YOKTU; kullanıcı uygulamayı elle kapatıp exe'yi elle bulmak zorundaydı.
- **Aslında arka uç HAZIRDI:** `src-tauri/src/lib.rs` içindeki `launch_bridge_and_quit`
  komutu yazılmış ve `invoke_handler`'a kayıtlıydı, `CaspianLiveBridge.exe` de
  `bundle.resources` ile kuruluma gömülüydü (desktop.yml derleyip kopyalıyor) —
  yalnız ÖN YÜZDE ÇAĞIRAN YOKTU. Bu değişiklik o bağlantıyı kuruyor.
- **UI:** üst barda TR/EN ile Rehber arasında, marka renginde `kask` ikonlu buton.
  Yalnız `isTauri` iken çizilir (web'de anlamı yok).
- **Neden `invoke` + ShellExecute:** köprü sidecar olarak (`Command.sidecar`)
  başlatılsaydı uygulamanın ÇOCUĞU olurdu ve biz kapanınca ölürdü. Rust tarafı
  `opener().open_path()` kullanıyor → bağımsız süreç, Race Monitor kapansa da yaşar.
  Komut ayrıca `parent_app.txt` bırakıyor, köprüdeki "Race Engineer'a Dön" onu okuyor.
- **Onay soruluyor:** buton uygulamayı KAPATIYOR ve üst barda tek tıkla erişiliyor;
  yarış ortasında kazara tıklamak mühendisin ekranını götürürdü. Uygulamanın kendi
  `confirmDialog`'u kullanıldı (native `window.confirm` değil) ve metinde geri dönüş
  yolu ("Race Engineer'a Dön") yazıyor — karar bilinçli olsun.
- **Sessiz başarısızlık yok:** invoke hata dönerse (eski kurulum, exe kaynakta yok)
  sebep butonun yanında yazılır — kullanıcı tıklayıp hiçbir şey olmadığını görmez.

### Lastik ekranı v2.3.1 tasarımına geçirildi

Kaynak: `design_handoff_lastik/fis/06-lastik.md` ("birebir uygula" kuralıyla geldi —
markup yapısı ve stil değerleri fişten kopyalandı, türetilmedi).

- **Tokenlar:** fişte "token yok — sor" işaretli sekiz renk `styles.js` `:root`'a
  eklendi: `--rc-tread-1…5` (fişin kendi önerisi; üç kademesi zaten tokenli olduğu
  için hex tekrarlanmadı, mevcut token'a bağlandı), `--rc-danger-4`,
  `--rc-danger-soft`, `--rc-surface-6`, `--rc-surface-7`, `--rc-text-6`,
  `--rc-on-set`, `--rc-tint-danger`. Renkler fişten birebir; yalnız ad verildi.
  Not: paketteki `tokens/tokens.css`, projedeki `styles.js` ile **birebir aynıydı**
  (115 token, sıfır fark) → ayrıca alınmadı.
- **Üst şerit** tek karta indi (limit stepper · numaralı set bütçesi · köşe aşınma
  stepper'ları · toplam değişim süresi). 5 KPI kartı ve "Set envanteri" çip şeridi
  kaldırıldı (26 sette ölçeklenmiyordu).
- **Aşınma tur+köşe bazlı** (`tyreWearC: number[4]`, adım %0.1/tur, 0-20).
  Göç kuralı fişten: 8'in üstündeki değer eski stint-bazlı kayıttır, `v / stintLaps`
  ile tura çevrilir; hiç değer yoksa `tyreWearPerStint` köşe eğilimiyle
  (`TY_WEAR_BIAS`) ölçeklenir → mevcut kullanıcı planları elle müdahale istemez.
- **Patlak** (`tyrePop: {"satır:köşe": true}`): hücre + set kutusu + başlık rozeti
  üçü birden güncellenir (fişin kabul kriteri, testle kilitlendi). Süre eklemez.
  - **Fişin açığı kapatıldı** (kullanıcı bildirimi): fiş "patlayan set yeniden
    kullanılamaz" diyor ve set kutusu ipucu da bunu yazıyor, ama verdiği
    `tyPickSets` kodu bunu HİÇ uygulamıyordu — yalnız köşe kilidine bakıyordu ve
    patlak set sonraki stintlerde geri seçilebiliyordu. Kural saf modüle çıkarıldı
    (`tyrePlanCalc.popRows` / `popBlockedAt`, 12 test) ve SATIRA duyarlı: yasak
    yalnız patladığı satırdan SONRASI içindir — patladığı satır ve öncesi geçerli
    okumadır, lastik o sırada gerçekten araçtaydı. Seçicide kilit + "patlak"
    etiketi; "Qual'a dön" hızlı ataması da patlak seti geri getiremiyor.
- Defter ve hücre seçimi **pencereye** taşındı; hücre artık buton, altında diş barı.
- `readOnly` (izleyici) prop'u App.jsx'ten geçirildi — yazma eylemleri görsel olarak
  da pasif.

**Fişten üç bilinçli sapma (hepsi kodda işaretlendi):**

1. **Boş defterde "plana uyuyor" iddiası kaldırıldı.** Fişin markup'ı karşılaştırma
   çipini KOŞULSUZ çiziyor; defter boşken bu, hiçbir şey gerçekleşmemişken uyum
   İDDİA etmek olurdu — CLAUDE.md §1'in yasakladığı ve v2.3.0'da özellikle
   düzeltilmiş hata sınıfı. Çip ve Plan↔Gerçek bölümü yalnız gerçek kayıt varken
   çizilir.
2. **`tyPitNote` yalnız plan boşken.** Fişin markup'ında bu değer hiç yer almıyordu
   ama kabul kriteri "plan boşken 'hiçbir pitte lastik değişmiyor'" diyor; referans
   görselde (plan DOLU) böyle bir satır yok. İkisini uzlaştıran okuma uygulandı.

3. **Otomatik "PATLAK" etiketi kaldırıldı** (kullanıcı bildirimi). Fiş, diş eksiye
   düşen hücreye de `tr.blowout` üzerinden "PATLAK" yazıyordu. Artık AÇIK bir patlak
   seçimi (`tyrePop`) olduğu için iki ayrı şey aynı adı taşıyordu ve hiç
   dokunulmamış TAŞIMA hücreleri patlak görünüyordu. Kapasite aşımı artık "%0"
   okunuyor (sayı yine kırmızı → set bitti sinyali duruyor), gerekçe tooltip'te
   korundu; PATLAK/PATLADI yalnız işaretlenen hücrede. Testle kilitlendi.

**Gerçek veriye bağlanan yerler** (fişteki sabitler prototip örneğiydi): satırlar
`racePlan`'dan (`tyreInfo.rows`, sabit 8 değil) · ızgara `tyreQual`+`tyreStints`'ten ·
yazımlar projenin reducer'larından (`upTyreCell`/`quickTyre` — `syncPitTyres` orada
çalışır, ızgarayı doğrudan yazmak pit bayraklarını bayat bırakırdı) · defter
Firebase'den · `TY_STINT_LAPS` gerçek plandan (yoksa fişin 19'una düşer).

**Doğrulama:** 788 JS testi · `npm run build` · render sözleşmesi yeni düzene göre
yeniden yazıldı (12 test: boş-defter koruması, diş barı, patlak üçlüsü, izleyici
modu) · çıktı Chromium'da render edilip `gorseller/06-lastik-*.png` ile
karşılaştırıldı: diş yüzdeleri (%66·%72·%68·%73 / %32·%43·%35·%47 / %15·%3·%20),
satır süreleri ve patlak gösterimi referansla birebir.

### Tur başı aşınma ölçülmüyordu (yalnız "en kötü köşe" anlık dişi vardı)

> **Durum notu (aynı sürüm içinde):** bu bölümün eklediği `livewear` düğümü ve
> köprü yazımı YERİNDE ve çalışıyor. Ancak üstteki tasarım fişi bu ekranı yeniden
> kurarken "ölçülen" butonunu kendi formülüne bağladı (köşe başına
> `(1 − diş) / tur`, anlık okumadan) ve kullanıcı fişe tam sadakat seçti → `lapWear.js`
> şu an UI'dan çağrılmıyor. Modül ve 20 testi korundu, veri birikmeye devam ediyor;
> okuyucu tarafı ileride bağlanabilir. Kartın render testi (`lapWear.render.test.jsx`)
> kart kalktığı için silindi.


- **Belirti:** Lastik sekmesindeki tek aşınma sayısı `measuredWear`den geliyordu
  (`tyrePlanCalc.js`). İki kör noktası vardı: dört köşeyi `Math.min(...)` ile
  **en kötüye** indiriyordu (asimetrik aşınma — ör. sağ virajı bol pistte ön-sol —
  hiç görünmüyordu) ve hızı **anlık dişten** çıkardığı için stint ortalamasıydı
  (degradasyonun döndüğü an okunamıyordu). Çıktısı da tek bir yerde, öneri
  butonunda kullanılıyordu.
- **Neden yapılamamıştı:** köşe başına gerçek hız için **tur-tur** diş serisi
  gerekir; hiçbir yerde tutulmuyordu. Veri ise zaten karedeydi (`tyres4`).

- **Köprü — YENİ DÜĞÜM `livewear`:** `{lapKey}/{n} = "fl,fr,rl,rr"` (diş 0..1,
  3 ondalık). `livesec` deseni birebir: **tur başına bir kez, yalnız en yeni tur**.
  Kaynak `tyres4` zaten karede olduğu için **yeni paylaşımlı-bellek okuması, REST
  isteği, thread ve hız değişimi YOK.**
  - **İKİ YAZICI YOL DA güncellendi** — `bridge/harvest.py` (hafif .exe) *ve*
    `src/liveBridge.js` (masaüstü sidecar), koşullar birebir aynı. v2.3.0'da bir
    alan yalnız birine eklenip diğeri atlanmıştı (`tyreChange`); tekrarlanmadı.
  - Online rakipte `_wear4` `None` döner (oyun rakip aşınmasını yaymaz) → **hiç
    yazılmaz**, uydurma veri üretilmez. Aralık dışı/bozuk okuma da yazılmaz.

- **Maliyet denetimi (ölçüldü, tahmin değil — CLAUDE.md §0):**
  | Ölçüm | Sonuç |
  |---|---|
  | Canlı kare (2 Hz yayın) | 7684 B → 7684 B — **0 B fark** |
  | `livewear` yazımı | 48 B/araç/tur (seyrek, tur başına) |
  | 40 araçlık grid, ~1.5 tur/dk | **~48 B/sn** |
  Karşılaştırma: v2.3.0'da kabul edilen denetim 2 Hz karede ~7.4 KB/sn idi; bu
  ekleme onun ~150'de biri ve **2 Hz kareye hiç dokunmuyor**.

- **Web (`src/lapWear.js`, yeni):** `wearSeries` · `cornerSegments` · `cornerRate` ·
  `wearRates` · `lapsLeft` · `limitingCorner`.
  - **Segment sınırı VERİDEN okunur.** Lastik değişimi dişi YÜKSELTİR; sınırı
    `livetyre`den türetmek cazipti ama **yanlış** olurdu: o düğüm yalnız "kaç
    lastik" tutar, **hangi köşe** olduğunu tutmaz. Sınır doğrudan ölçümden
    okunuyor (diş artışı > `RESET_EPS`) → **2-lastik değişiminde yalnız gerçekten
    değişen köşeler sıfırlanır**, diğer ikisinin geçmişi korunur (testli).
  - Hız **tur numarasından** hesaplanır (örnek sayısından değil) → seride boşluk
    varsa bozulmaz. `recent` yalnız pencere dönemden GERÇEKTEN kısaysa üretilir.
  - **`Number(null) === 0` tuzağı** (CLAUDE.md §1'in adıyla uyardığı, v2.3.0'da
    `lapDist`te yaşanan hata) testle yakalandı: eksik diş 0'a çöküp "0 tur kaldı"
    diyordu — makul görünen ama uydurma bir sonuç, üstelik pit duvarına yanlışlıkla
    "hemen gir" dedirtir. Yokluk artık sayıya çevrilmeden elenir.
- **UI (`TyreTab.jsx`):** köşe başına %/tur + kalan diş + kalan tur + trend
  (`↑ hızlanıyor` / `↓ yavaşlıyor`), başlıkta pit penceresini belirleyen köşe.
  Öneri butonu artık bu gerçek ölçümden beslenir, **eski `measuredWear` yedek
  olarak korundu** (eski köprü / kayıt henüz birikmemişken buton kaybolmasın).
  KALAN TUR ekranda **modellenmiş tahmin** olarak etiketlendi (doğrusal varsayım).
- **Kapsam:** Firebase kuralı + `deleteTeam` + `liveHistoryClearAll` + `LAP_NODES`
  (seans sıfırlaması) hepsine `livewear` eklendi. Testler: `lapWear.test.js` (20),
  `lapWear.render.test.jsx` (5), köprü tarafında 2 yeni test.
- **Bilinen sınır:** demo modu Firebase'e yazmaz → kart demoda boş kalır (mevcut
  lastik defteri de aynı sınırda, `liveDemo.js` bunu zaten belirtiyor).

## v2.3.0 — 2026-08-31

Live Timing standings genişletmesi. Referans olarak TinyPedal'ın `Standings`/`Relative`
widget'ları tarandı (`docs/customization.md`); kopyalanmadı — bizimki bir **pit duvarı
web uygulaması**, onunki bir **sürücü overlay'i**, bu yüzden yalnız bizim bağlamımızda
karşılığı olanlar alındı. Karşılaştırmada bizde ZATEN olduğu görülenler (canlı pist
haritası `TrackMap.jsx`, marka logosu, pit durak sayısı, trafik rozetleri
`StrategyBar.jsx`, VE/tur, tur geçmişi) tekrar yapılmadı.

### Sektör süreleri renklendirilmiyordu

- **Belirti:** `Sektör` sütunu S1·S2·S3'ü düz `--rc-text-2`/`--dim` ile yazıyordu. Sayı
  vardı, **anlam yoktu** — hangi sektörün rekor olduğu görünmüyordu. Klasik timing
  tower'ın en çok kullanılan sinyali eksikti.
- **Neden yapılamamıştı:** karar için sektör bazlı **kişisel en iyi** gerekir; köprü
  yalnız `lastSectors` (son tur) ve `curSectors` (anlık) gönderiyordu. Paylaşımlı
  bellekte veri vardı (`mBestSector1`, `mBestSector2`, `mBestLapTime`) ama okunmuyordu.
- **Köprü (`rf2_source.py`):** `_best_sectors(v)` — struct **kümülatif** verir
  (`mBestSector2` = en iyi S1+S2), tekil süreye çevrilir: `b2 = mBestSector2 − mBestSector1`,
  `b3 = mBestLapTime − mBestSector2`. Her araca `bestSectors: [b1,b2,b3]` eklendi.
  - **Zincir tutarlılığı:** `b3` kümülatif `b12`'ye dayanır. `b12` yırtık okunmuşsa
    (`b12 < b1`) `lap − b12` **makul görünen ama uydurma** bir S3 üretiyordu; `b2`
    geçerli değilse `b3` de üretilmiyor (testle kilitlendi).
  - **Bilinçli kabul:** oyun bu üç alanı bağımsız en iyiler olarak tutar → `b2`/`b3`
    farklı turlardan gelebilir, yani "teorik en iyi"ye yakındır. Timing tower'ların
    kişisel-best ölçütü zaten budur.
- **Web (`src/liveSectors.js`, yeni):** `classBestSectors` (sınıf başına en hızlı
  sektörler) + `sectorTone` + `sectorTones`. Renk semantiği **`liveFlash.js` ile birebir
  aynı** tutuldu — aynı ekranda iki farklı "mor" anlamı olmasın: MOR = sınıf rekoru,
  YEŞİL = kişisel rekor, mor yeşili ezer.
  - Sınıf rekoru **süzgeçten önce, tüm sahadan** hesaplanır: "kendi sınıfım" açıkken de
    rekor gerçek rekordur, süzülmüş listenin en iyisi değil.
- **UI:** `SectorCell` bileşeni — sektör başına ayrı renkli span. Eski `secStr`/`liveSecStr`
  düz-string yardımcıları ölü kod olarak kaldırıldı (renk üretimi string'e sığmıyor).
  Anlık/son-tur seçimi ve "üçü birden geçerli değilse —" davranışı **birebir korundu**.

### Saha tablosunda sıralama ve arama YOKTU

- **Belirti:** sıra tamamen köprünün `pos` alanıydı; kolon başlığından sıralama ve arama
  kutusu hiç yoktu. 40+ araçlık sahada "en çok hasar alan", "kim kaç kez pitledi",
  "AVG5'i en iyi" soruları gözle taranarak cevaplanıyordu.
- **Çözüm (`src/liveSort.js`, yeni):** `sortRows` + `matchQuery` + `fold`.
  - **Eksik veri her zaman sona gider.** Yön ters çevrilince `null`/`Infinity`'nin büyük
    sayı gibi başa çıkması klasik hatadır; değeri olmayan satırlar ayrı toplanıp sona
    eklenir (iki yönde de testli).
  - **Eşitlikte yarış pozisyonu çözer** → kare kare gelen veride satırlar birbirinin
    yerine zıplamaz (hepsi 0 ceza olan bir sahada bu görünür bir hataydı).
  - **Takaslı sütunlar ekranda GÖRÜNEN değere göre sıralanır** (`gapMode`/`lapMode`/
    `avgMode`/`showTeam` context olarak geçer) — kullanıcı ne görüyorsa ona göre sıralar.
  - Arama Türkçe katlamalı (`setupPool.slugPart` deseni): `sahin` → `Şahin`, `agri` → `Ağrı`.
  - **Sağlamlık:** canlı kare Firebase'den gelir ve bozuk satır taşıyabilir; `posOf`
    null-güvenli (testin yakaladığı gerçek çökme).
- **UI:** mevcut takas düğmeleri (`Pilot↔Takım`, `Gap↔Aralık`, `Son↔En İyi`, `AVG5↔AVG`,
  sınıf süzgeci) **korundu** — sıralama ayrı ve küçük bir ok düğmesi, eski davranış hiç
  değişmedi. Üçüncü tık varsayılana (yarış sırası) döner.

### Relative (pist konumuna göre yakın saha) yoktu

- **Belirti:** kod tabanında "relative" kelimesi hiç geçmiyordu. Sıralama tablosu yarış
  sırasını gösterir; tur-altı bir araç sıralamada 15 satır aşağıdadır ama **pistte tam
  önümüzde** olabilir — trafik/mavi bayrak/undercut kararları sıralamadan okunamaz.
- **Yöntem — mesafe DEĞİL, ZAMAN.** İlk uygulama farkı tur içi mesafeden türetiyordu
  (`(otherDist − meDist) / trackLength × turSüresi`). Bu **sabit hız varsayar**: 500 m
  düzlükte ~6 sn, 500 m şikan kompleksinde ~20 sn eder → hata tam da relative'in en
  çok gerektiği yerde (yavaş virajlar, trafik) büyür.
  - **TinyPedal kaynağı incelendi** (`tinypedal/module/module_relative.py`,
    `get_vehicles_info`): mesafeyi **hiç kullanmıyor**, oyunun kendi alanlarını okuyor —
    `diff = opponent.mTimeIntoLap − player.mTimeIntoLap`, `mEstimatedLapTime` modülünde
    sarmalanır. rF2 struct'ının kendi notu da eşleşmeyi söylüyor: `mEstimatedLapTime` =
    *"estimated laptime used for 'time behind' and 'time into lap'"*.
  - Köprü artık araç başına `timeIntoLap` + `estLapTime` gönderiyor (aynı zaten
    haritalanmış struct'tan 2 `getattr`; yeni REST/thread/hız değişikliği YOK).
  - **Mesafe yolu YEDEK olarak kalıyor:** köprü `.exe` kullanıcı tarafından ayrı
    güncelleniyor, sahadaki eski sürümler yeni alanları göndermez → özellik kaybolmaz,
    yalnız o kare yaklaşık olur. Eksik alan **araç bazında** ele alınır (bir araç
    yedeğe düşerken diğerleri zaman yolunda kalır).
- **`0` geçerli, `-1` değil.** `mTimeIntoLap` tam `0.0` olabilir (araç S/F'yi yeni
  geçmiş). Köprüde `float(...) or -1.0` yazılırsa `0.0` falsy olduğu için geçerli okuma
  "veri yok"a döner — bu hata geliştirme sırasında yapıldı, testle kilitlendi. Web
  tarafında da eşik `>= 0` (oyunun `-1` nöbetçisi "yok" demektir).
- **Yapı:** `wrapTime` (zaman, birincil) · `wrapDist` (mesafe, yedek) · `relGapSec` ·
  `refLap` (AVG5 → AVG → son tur → en iyi) · `relativeRows` (oyuncu ±3).
  - İşaret konvansiyonu TinyPedal ile birebir doğrulandı: widget metni `-data[0]` ile
    yazıyor → **− önümüzde, + arkamızda**. Pencere yapısı da aynı (N önde, oyuncu, N arkada).
  - TinyPedal iki ayrı liste tutar (ahead `[0,L)` / behind `[−L,0)`); bizde tek ±pencere
    olduğu için **kısa yol** seçilir (yarım tur eşiği) — aynı sayının iki gösteriminden
    biri, sapma değil.
  - **`Number(null) === 0` tuzağı:** açık kontrol olmadan `lapDist`i eksik bir araç
    "S/F çizgisinde" sayılıp makul görünen ama tamamen **uydurma** bir relative farkı
    üretiyordu → eksik veri elenir (testin yakaladığı gerçek hata).
  - Pit/garajdaki araçlar elenir (pist boşluğunu yanlış gösterirler); **oyuncunun kendisi
    pit'te olsa bile listede kalır**.
- **Kalan doğruluk sınırı:** `mEstimatedLapTime` oyunun tahminidir ve araç/setup'a göre
  değişebilir (struct notu bunu açıkça söylüyor); sınıflar arası farkta hâlâ yaklaşıklık
  payı vardır. Ama artık sabit-hız varsayımı yok.
- **UI:** `Relative` düğmesi yalnız kendi aracımız sahadayken **ve** `trackLength`
  biliniyorken görünür (tıklayıp boş liste görmeyelim). Bu modda `Gap` sütunu ± relatif
  saniyeye döner ve **metin araması uygulanmaz** (arama kutusu gizlenir) — "etrafımdaki
  araçlar"ı ada göre süzmek anlamsız bir kesişim üretir.

### Yazılmış ama hiç bağlanmamış iki özellik

- **Lastik 4 köşe ızgarası:** `TyreCell`'in 2×2 dalı v2.2.4'te de yazılıydı ama hücre
  `single` prop'uyla çağrıldığı için yalnız **en kötü köşe** görünüyordu — "hangi lastik
  bitti" cevapsızdı. `single` kaldırıldı; `tyres4` yoksa bileşen kendiliğinden tek
  aşınmaya düşer (davranış korunur).
- **Pit lastik değişim rozeti:** `tyreInfo.tyreChangeBadge()` yazılı **ve testliydi**
  (11 test) ama hiçbir yerden import edilmiyordu; üstelik köprü verisi
  `liveBridge.js:245`'te "tabloda gösterilmiyor" gerekçesiyle **kareden siliniyordu**.
  Silme kaldırıldı, rozet Pit sütununa bağlandı: `4` / `2 ÖN` / yakıt-only durakta `0`.
  Boyut: araç başına tek küçük nesne, Firebase yaprak sınırının çok altında.
  - **KAPSAM SINIRI (uçtan uca ölçüldü, tahmin değil).** `Aggregator.tyre_change`
    girdileri `tyres4` + `tyreComp`; **ikisi de TELEMETRİDEN** gelir
    (`_wear4(tv)` / `_compound(tv)`). Online yarışta rakip telemetrisi simüle
    edilmez — dört teker tam `1.0`'a donar ve `_wear4` bunu bilerek `None` sayar
    (v1.4.65 kararı). Sonuç: **rozet online'da rakiplerin çoğunda ÇIKMAZ.**
    Gerçek Aggregator'la ölçülen davranış:

    | Senaryo | Sonuç |
    |---|---|
    | Kendi araç, 4 lastik | `{n:4}` → `4` |
    | Kendi araç, 2 ön | `{n:2, corners:[fl,fr]}` → `2 ÖN` |
    | Yakıt-only durak | `{n:0}` → `0` |
    | Bileşim slick→wet (aşınma sıçraması küçük) | `{n:4, comp:"Wet"}` → `4` |
    | **Online rakip, aşınma okunamıyor, bileşim sabit** | **`None` → rozet yok** |
    | Online rakip, bileşim değişmiş | `{n:4, comp:"Wet"}` → `4` |

    Yani: **kendi aracımızda ve offline/AI yarışlarda tam**, online'da rakipte
    yalnız bileşim değişimi. Veri yoksa rozet çizilmez — uydurma yok.

### `own` kendi araç kartı: pilot adı ve sınıf HİÇ gelmiyordu

- **Belirti:** "Kendi Araç" kartı her zaman jenerik `Kendi Araç` yazıyor, sınıf rengi hiç
  görünmüyordu.
- **Kök neden:** `RF2Source` `own`'ı oyuncunun **TELEMETRY** kaydından kurar; `driver` ve
  `carClass` ise yalnız **SCORING** satırında bulunur. `LiveTab.jsx:312-318` üçünü de
  okuyordu ama köprü hiçbirini göndermiyordu (`own` anahtarları: fuel, tyres, throttle,
  gear, rpm, position, s1/s2/s3, location…). `team`/`manufacturer`/`number` ise LMU REST
  zenginleştirmesinde **yalnız field satırlarına** ekleniyordu — `own`'a hiç ulaşmıyordu.
- **Neden fark edilmemişti:** `liveDemo.js` bu alanları elle veriyordu (`team`,
  `manufacturer`, `number`) → demo yolunda kart doluymuş gibi görünüyordu.
- **Çözüm:** `Aggregator.read` — oyuncunun **kendi field satırı** (REST zenginleştirmesi
  sonrası) hepsini taşır, oradan kopyalanır. Yalnız `own`'da **eksik** olan doldurulur
  (`vehicleName` gibi doğrudan okunan alanlar ezilmez, testli). Demo da gerçek davranışı
  yansıtacak şekilde hizalandı.

### Yarış durumu (DNF/DSQ) ve pit AŞAMASI okunmuyordu

TinyPedal kaynağı tarandıktan sonra eklendi. İkisi de **`rF2VehicleScoring`** alanı →
telemetri değil, yani **online yarışta rakipler için de güvenilir** (rakip telemetrisi
donabiliyor; `tyreInfo.teleStale` tam da onun için var).

- **`mFinishStatus`** (struct: `0=none, 1=finished, 2=dnf, 3=dq`) — okunmuyordu, bu
  yüzden **yarışı bırakan araç tabloda hâlâ yarışıyormuş gibi duruyordu**: gap'i donuyor
  ama satır normal görünüyor, "kim hâlâ sahada" sorusu gözle çıkarılamıyordu.
  - `DNF`/`DSQ` çipi + satır soluklaştırma (`opacity .45`). Veri donduğu için gap/tur
    değerleri olduğu gibi bırakılır, yalnız satır yarışmadığını belli eder.
  - **`FIN` çipi bilinçli olarak YOK:** yarış bitince **herkes** `1` olur, bilgi taşımaz.
    `isRetired` da yalnız 2/3'ü "bırakmış" sayar.
- **`mPitState`** (struct: `0=none, 1=request, 2=entering, 3=stopped, 4=exiting`) —
  Pit sütunu tek düz `PIT` çipi yerine **aşama** gösteriyor: `ÇAĞRI · GİRİŞ · DURDU · ÇIKIŞ`.
  - Asıl kazanım **`1` (request)**: bu kod araç **HÂLÂ PİSTTEYKEN** gelir → *"rakip pit
    çağırdı ama henüz girmedi"*. Undercut'a karşı erken uyarı olduğu için diğer
    aşamalardan **ayrı renkte** (`--rc-warn`, kalın).
- **Geriye uyum:** köprü `.exe` ayrı güncelleniyor; eski sürümler bu alanları göndermez.
  `pitChip` alan yoksa **eski `inPits` davranışına düşer** (düz `PIT`), `finishLabel`
  `null` döner → özellik sessizce kaybolur, hiçbir şey bozulmaz.
- **Uydurma yok:** bilinmeyen/bozuk kod (`9`, `-1`, `1.5`, metin) etiket üretmez.
  `Number(null) === 0` tuzağı burada da geçerli — `0` **geçerli** bir koddur ("durum
  yok"), eksik veriden açıkça ayrılır.
- **Yapı:** `src/liveStatus.js` (saf) + `liveStatus.test.js` (13 test).

### Pist haritası: çözünürlük iki katına, çizgi karışımı azaltıldı

TinyPedal'ın harita kaydı (`module_mapping.py`) incelendi. O, **sürücünün kendi tek
temiz turunu** kaydedip pist başına SVG olarak diske yazıyor ve dosya varsa bir daha
kayıt yapmıyor. **Bu yöntem bizde yapısal olarak çalışmaz:** TinyPedal sürücünün
PC'sindeki overlay, bizim uygulamayı ise **sürmeyen** insanlar izliyor — yarış
mühendisinin kendi turu yok. "Tüm araçlardan biriktirme" doğru seçim ve korundu.
Ondan alınan iki iyileştirme:

- **`NB` 240 → 480.** 5 km'lik pistte kutu başına ~21 m'den **~10,4 m**'ye iner;
  virajlar daha az düzleşir. 480 **pratik tavan**: Firebase yaprak sınırı
  (`MAX_STR` 8800, kural `.validate < 9000`) 600 kutuda kırpıyor.
- **Koordinat biçimi tam metreye indirildi** (`toFixed(1)` → `toFixed(0)`).
  Zorunluydu: 480 kutu × 1 ondalık, **en kötü durumda** (Nordschleife ölçeği
  ±10000 m, negatif koordinatlar) **9490 karakter** üretiyor ve `packBins` bunu
  sessizce kırpıyordu — paylaşılan şeklin kuyruğu düşerdi. Tam metreyle **7570**
  karakter (ölçüldü). Hassasiyet kaybı yok sayılır: harita ~300 px'lik kutuya
  normalize çiziliyor, 4 km pistte 1 px ≈ 13 m, yani 1 m bir pikselden ~13 kat ince.
  - **Geriye uyum:** `unpackBins` `Number()` ile ayrıştırdığı için sahadaki eski
    ondalıklı kayıtlar aynen okunur; yalnız yeni yazımlar kısalır (testli).
- **Çizgi karışımı azaltıldı.** Kutuyu eskiden **ilk gelen araç** belirliyor ve bir
  daha güncellenmiyordu → farklı pilotların çizgileri karışıyor, tuhaf bir çizgi atan
  araç tüm seans boyunca kalıcı iz bırakabiliyordu. Artık **oyuncunun kendi çizgisi**
  mevcut bir kutuyu **bir kez** yükseltebiliyor (kendi çizgimiz tutarlıdır); oyuncu
  kutusu bir daha ezilmiyor. Paylaşılan kutular "oyuncunun" sayılmaz → kendi turumuz
  onları da yükseltebilir.
- **Yakalanan tuzak:** kutular v2.2.4'e kadar yalnız EKLENİYORDU, bu yüzden `binCount`
  tek başına yeterli bir "değişti mi" anahtarıydı (memo + Firebase paylaşımı ona
  bakıyordu). Yükseltme sayıyı değiştirmediği için bu iki yol iyileşmeyi **hiç
  görmezdi** — şekil ekranda eski kalır, paylaşılan kayıt hiç tazelenmezdi. Ayrı bir
  `rev` sayacı eklendi; memo ve kaydetme artık ona bakıyor.

**Oyun PC'si maliyeti: sıfır.** Bunların hepsi web tarafında (`TrackMap.jsx`,
`trackShape.js`); köprüye tek satır dokunulmadı, kare boyutu değişmedi.

### Haritada PİT ÇIKIŞ TAHMİNİ (yeni)

*"Durağım N saniye sürerse pistte kimin yanına çıkarım?"* — undercut/overcut kararının
tek sorusu. TinyPedal'da `widget/track_map.py` `draw_pitout_prediction` olarak var;
algoritma oradan alındı.

**Mantık** (her şey "tur içi zaman" ekseninde): pit çıkışına varana kadar geçecek süre
`Δ = (girişe kalan) + (pit yolunda geçen)`. Şu an tur-içi zamanı `T` olan araç Δ sonra
`T + Δ`'da olur; biz `t_exit`'te çıkacağımıza göre yanına çıkacağımız araç **şu an**
`T = t_exit + pitTimer − pitSüresi` konumundadır (tur boyunca sarmalı). Çember o
noktaya çizilir → yanındaki araç noktasına bakarak okunur.

- **Aday süreler otomatik:** `15 · 25 · 35 · 45 · 55 · 65` sn (TinyPedal varsayılanı:
  min 15 + artım 10 × 6 tahmin). Anlamı **pit girişinden pit çıkışına toplam süre** —
  ekranda yazan sayı da bu, gizli ofset yok.
- **Yalnız pit TALEBİ verilmişken** çizilir (`mPitState == 1`, bu sürümde eklendi):
  araç hâlâ pistte, karar hâlâ verilebilir. Pite girdikten sonra göstermek karar değil
  seyir olurdu.

**Eksik parçayı bu sürümün kendi verisi çözdü.** TinyPedal mesafe→zaman eğrisini
sürücünün **en iyi turundan** kaydediyor (deltabest); bizde öyle bir kayıt yok ve
**izleyicinin kendi turu da yok**. Ama köprü artık her araç için `timeIntoLap` +
`estLapTime` gönderiyor → sahadaki **her araç eğriye bir örnek veriyor**
(`zamanKesri = timeIntoLap / estLapTime`), harita kutularının aynı indeksinde
biriktiriliyor. Eğri kesir olduğu için **tempo-bağımsız** ve tüm sahadan hızla doluyor.

- **Doğruluk sınırı (dürüstçe):** eğri araçların **gerçek** turlarından gelir, temiz bir
  referans turdan değil — trafik/hata örnekleri ortalamaya karışır. Kutu ortalaması
  yumuşatır ama sıfırlamaz. Tahmin bir **yön** gösterir, saniye garantisi değil.
- **Uydurma yok:** pit giriş/çıkışı gözlenmemişse, tempo/pist uzunluğu yoksa ya da eğri
  **%35'ten az doluysa** hiçbir çember çizilmez.
- **Çizim yeri: yalnız DIŞ HALKA** (sahada denendikten sonraki kullanıcı kararı).
  İlk uygulamada hem dış halkada hem iç şekilde çember vardı; iç şekilde araç
  noktalarıyla üst üste biniyor ve aynı bilgi iki kez görünüyordu. Dış halka bu iş
  için zaten daha uygun: araçlar orada lapDist oranına göre düzgün dizili, çemberin
  hangi aracın hizasına düştüğü tek bakışta okunuyor. Saniye etiketi halkanın
  dışına yazılır (sektör / PIT IN etiketleriyle aynı yarıçap deseni).
- **Yapı:** karar mantığının tamamı `src/pitOut.js`'te (saf, 25 test); `TrackMap.jsx`'te
  yalnız çizim kaldı (CLAUDE.md §2).
- **Test notu:** proje jsdom/testing-library kullanmıyor, bileşen çok-render edilemiyor;
  bu yüzden render testleri yalnız "çizilmez" kapılarını doğrulayabiliyordu — özellik
  tamamen silinse de geçerlerdi. Bu yüzden POZİTİF yol `pitOutPoints` üzerinden saf
  olarak test edildi (üretilen 6 nokta, kutu ↔ mesafe tutarlılığı, eşiğin gerçekten
  doluluktan kaynaklandığı). Geriye kalan kapsanmayan kısım yalnız JSX→SVG eşlemesi.

**Oyun PC'si maliyeti: sıfır** — köprüye tek satır dokunulmadı, kare boyutu değişmedi;
eğri de tahmin de web tarafında.

### Vmax — seans en yüksek hızı (yeni sütun)

"Kim düzlükte hızlı" sorusu; kanat/sürükleme ve savunma/atak kararlarının girdisi.

- **Kaynak `mLocalVel` — ama SCORING'den, telemetriden DEĞİL.** Bu ayrım kritik:
  `mLocalVel` her iki yapıda da var; telemetri online'da rakiplerde bayatlar
  (`teleLag` / `tyreInfo.teleStale` tam da bunun için), scoring ise her araç için
  doludur. Zaten `mPos`'u buradan okuyup pist haritasını **tüm sahadan** kuruyoruz —
  aynı struct, aynı güvenilirlik. **TinyPedal hızı telemetriden okur**
  (`rf2_reader.py:1036`), rakip hızları onda bu yüzden güvenilmez; scoring'den
  okuyarak bu noktada ondan sağlam oluyoruz.
- Mevcut `_speed()` yardımcısı zaten geneldi (`mLocalVel` taşıyan herhangi bir nesne)
  — yalnız çağrıldığı yer değişti, yeni matematik yazılmadı.
- **Kümülatif maksimum `Aggregator`'da** (ceza sayacıyla aynı desen), seans değişince
  sıfırlanır — antrenmanın hızı yarışta görünmez.
- **Yırtık kare koruması:** paylaşımlı bellek yırtık okunduğunda saçma bir hız gelebilir
  ve maksimum **kalıcı olarak zehirlenir** (bir daha düşmez, yarış boyunca yanlış
  gösterir). `SPEED_SANE_MAX = 500` km/h üstü okuma maksimuma yazılmaz (LMU'nun en
  hızlı aracı ~340 km/h; sınır bilerek geniş). Testle kilitlendi.
- **Dürüstlük notu ekranda:** tooltip *"Slipstream'de atılan hız da buna dahildir"*
  diyor — tow'da görülen 340 km/h aracın kendi düz hızı değildir ve sayı bunu ayırt
  edemez. Karşılaştırılabilir ölçüm isteyen speed trap (herkes aynı noktada) ayrı bir
  iş; bilinçli olarak yapılmadı.
- Sütun sıralanabilir (`vmax`, varsayılan azalan); tooltip anlık hızı da gösterir.

### Pist haritası ayrı pencerede DONARAK ilerliyordu

- **Belirti (sahada bildirildi):** "⛶ Expand akıcı ama ⧉ ayrı pencerede donarak
  ilerliyor." Araçlar yumuşak kaymak yerine zıplayarak, düzensiz aralıklarla hareket
  ediyordu.
- **Kök neden — iki etken üst üste:**
  1. Ayrı pencere, karttaki svg'nin **`outerHTML`'ini kopyalıyordu**
     (`holder.innerHTML = svgRef.current.outerHTML`). Bu, tüm SVG düğümlerini **silip
     yeniden kuruyor.** Araç noktaları `transition: transform .5s linear` ile
     yumuşuyor; her karede yeni kurulan bir düğümün "önceki" konumu olmadığı için
     CSS geçişi **hiç çalışmıyordu** → araçlar zıpladı.
  2. Kopyalama **700 ms**'de bir yapılıyordu, veri ise **500 ms**'de (2 Hz) geliyor.
     İki ritim aynı fazda olmadığı için kimi kare atlanıyor, kimi iki kez çiziliyordu
     → düzensiz ilerleme.
- **Çözüm:** kopyalama tamamen kaldırıldı; pencerenin içine **canlı React portalı**
  ediliyor (zoom katmanının kullandığı desenin aynısı). Düğümler kalıcı olduğu için
  CSS geçişleri çalışıyor ve güncelleme **tam veri geldiğinde** oluyor — zamanlayıcı
  yok, Expand ile birebir aynı akıcılık.
- **Yan bulgu (düzeltildi):** ayrı pencerenin kendi stil sayfası olmadığı için SVG'nin
  kullandığı CSS değişkenleri (`--line2`, `--muted`, `--dim`, `--rc-surface-3`) orada
  **çözülmüyordu** — yol bandı/ızgara kayboluyor ya da yanlış renkte çiziliyordu. (Islak
  seansta sorun görünmüyordu çünkü ıslak yol rengi düz HEX.) Değişkenler artık ana
  belgeden okunup kabın üstüne yazılıyor, SVG içeriden miras alıyor.
- **Yan bulgu (düzeltildi):** ⧉'ye ikinci kez basmak aynı pencereye ikinci bir kap
  ekliyor ve **ikinci bir yoklayıcı** başlatıyordu; eskisi hiç durmadığı için her
  tıklama bir interval sızdırıyordu. Artık pencere açıksa yeniden kurulmuyor, öne
  getiriliyor; sökülmede yoklayıcı da kapatılıyor.

### "Kendi sınıfım" süzgeci artık haritayla SENKRON

`Poz · Sınıf` başlığına basınca tablo kendi sınıfımıza süzülüyordu ama **pist haritası
tüm sahayı göstermeye devam ediyordu** — iki panel aynı ekranda farklı şey anlatıyordu.
Artık süzgeç ikisini birden kapsıyor.

- **Yalnız ÇİZİM süzülür, biriktirme SÜZÜLMEZ.** `field` haritaya **tam** geçirilmeye
  devam ediyor; TrackMap içinde ayrı bir `shownCars` listesi yalnız nokta çizimi ve
  lejant için kullanılıyor. Pist şekli kutuları, sektör sınırı, pit giriş/çıkış
  gözlemleri ve mesafe→zaman eğrisi **tüm sahadan** birikiyor.
  - Neden önemli: süzülmüş listeyle biriktirseydik harita 14 araç yerine 3 araçla
    dolardı (kat kat yavaş) ve **süzgeç kapatıldığında bile eksik kalırdı** — kutular
    bir kez dolduktan sonra güncellenmediği için kalıcı bir boşluk oluşurdu.
  - Bu garanti testle kilitlendi: süzgeç açıkken kutu sayısı değişmemeli. (Biriktirme
    yanlışlıkla süzülünce testin kırmızıya döndüğü doğrulandı.)
- Sınıf-içi pozisyon numaraları (`P2` gibi) yine **tüm sahadan** hesaplanıyor — süzgeç
  açıkken de gerçek sınıf pozisyonu görünür.
- Pit çıkış tahmini de etkilenmez: oyuncu satırı süzülmemiş listeden bulunuyor.
- **Görünürlük (sahada "çalışmıyor" sanıldı):** süzgeç haritada uygulanıyordu ama
  hiçbir göstergesi yoktu. Demo sahasında 3 Hypercar + 11 GT3 var ve oyuncu GT3
  olduğundan süzgeç yalnız **3 noktayı** gizliyor (14 → 11); tabloda satırlar gidince
  bariz, haritada gözden kaçıyor. Başlığa **sınıf rozeti + kaç aracın gizlendiği**
  eklendi (`GT3 · 3 gizli`), hem kartta hem Büyük Pano'da.

### Sürüm öncesi kod incelemesinde bulunan 5 hata

Merge öncesi `origin/main..HEAD` incelendi; hepsi **bu sürümde eklenen** kodda.

1. **Takımın eski haritası bozuk okunuyordu (en ciddisi).** Kutu sayısı 240→480'e
   çıkarıldı ama paylaşılan kayıtta çözünürlük işareti yoktu. Kutu indeksinin anlamı
   NB'ye bağlıdır: index 120, 240 kutuda **yarım tur**, 480 kutuda **çeyrek tur**.
   Sonuç: v2.2.4'te kaydedilmiş şeklin tamamı yeni index uzayının ilk yarısına
   sıkışıyordu — üstelik 240 kutu "yeterince dolu" eşiğini (216) aştığı için **bozuk
   şekil hemen çiziliyor**, kendi aracı olmayan bir izleyicide hiç düzelmiyor ve
   yazma yetkisi olan istemci bozuk birleşimi **takıma geri yazıyordu**.
   → Paket artık `n480;` başlığı taşıyor; başlıksız kayıt v2.2.4 (240) varsayılıp
   **yeniden ölçekleniyor** (atılmıyor — takımın emeği korunuyor).
2. **Lastik rozeti hafif köprüde hiç görünmüyordu.** `liveBridge.js`'te (JS sidecar)
   silme kaldırılmıştı ama `bridge/harvest.py` hâlâ `tyreChange`'i kareden atıyordu.
   README sürüş PC'si için **tam da bu hafif `.exe`'yi öneriyor** → rozet asıl
   kullanılacağı yolda ölüydü.
3. **Relative sıralaması birim karıştırıyordu.** Anahtar bir satırda saniye, ötekinde
   metre oluyordu; `timeIntoLap`i eksik **tek bir araç** metre cinsinden dev bir
   anahtar alıp gerçekten çok daha önde olan araçların üstüne çıkıyor ve ±3
   penceresini yanlış sıralıyordu. → İki yol da **tur kesrine** indirgendi.
4. **Pit çıkış tahmininde `Number(null) === 0` tuzağı.** `lapDist`i eksik oyuncu
   "S/F çizgisinde" sayılıyor, altı çember de makul **görünen** ama uydurma konumlara
   çiziliyordu. CLAUDE.md §1'de kayıtlı, `wrapDist`te elenen tuzağın aynısı — yeni
   kodda tekrar yapılmış. → Açık kontrol eklendi (`0` geçerli kalır).
5. **Paylaşım eşiği az araçlı seansta ulaşılamıyordu.** 480 kutuda %90 = 432 kutu;
   2 Hz'de tek araç turda ancak ~`turSüresi×2` örnek üretir (100 sn turda ~200), yani
   şekil takımla **hiç paylaşılmıyordu**. → Eşik %75'e indirildi; kayıt `rev` arttıkça
   yenilendiği için şekil doldukça paylaşım da tazeleniyor.

Beşi için de regresyon testi yazıldı ve **her biri düzeltme geri alınınca kırmızıya
döndüğü doğrulanarak** kilitlendi.

### Lastik defteri (yeni) — kendi kendini dolduran GERÇEK kayıt

Lastik ekranındaki plan tablosunun iki yapısal sorunu var:

1. **Köşe başına HAMUR oyunda YOK.** Paylaşımlı bellek yalnız ön/arka verir
   (`mFrontTireCompoundName` / `mRearTireCompoundName`). Yani 4 sütunlu tablo,
   hiçbir yerde var olmayan bir ayrıntıyı kullanıcıdan istiyor.
2. **Hücredeki `N×` rozeti planın TOPLAMI.** Bir lastiğin birinci ve ikinci
   kullanımı birebir aynı görünüyor → *"yeni lastiği hangi stint kullandı"*
   okunamıyor (kullanıcı bildirimi).

Oysa gerçek kayıt **zaten tutuluyor**: köprü her pit değişimini
`livetyre/{rid}/{araç}/{tur} = "adet|hamur"` olarak yazıyor (`bridge/harvest.py`).
Lastik ekranı bundan haberdar değildi. Defter bu kaydı ilk kez okuyor — **elle
giriş yok, tahmin yok.**

- **Model: "lastik dönemi", set değil.** Oyun **set kimliği vermiyor**; uydurmak
  yerine iki değişim arasındaki tur aralığı tutulur. Her dönem başında ne
  takıldığını söyler: `4` → **YENİ** tam set · `2` → **aks** · `0` → yakıt-only.
  - **Yakıt-only durak dönem AÇMAZ** — lastik değişmediği için aynı lastikler
    devam eder; satır açsaydık defter "lastik değişti" diye yanlış okunurdu.
    Bilgi kaybolmasın diye dönem içinde sayılır.
  - Yarış başındaki ilk dönemin içeriği **bilinmiyor** → "Başlangıç" diye
    etiketlenir, "4 yeni" diye **uydurulmaz**.
- **Ekran:** tur aralığı + YENİ/aks çipi + hamur renginde şerit (genişlik tur
  sayısıyla orantılı) + "N tur · hamur · sürüyor". Sorunun kaynağı olan
  *"yeni lastik hangi stintte"* sorusu tanım gereği cevaplanıyor.
- **Sınırlar ekranda yazıyor** (CLAUDE.md §1): set kimliği oyundan gelmiyor,
  hamur köşe başına okunamıyor.
- **Mevcut plan tablosu DOKUNULMADAN duruyor** — defter üstüne eklendi, bir yarış
  boyunca ikisi yan yana kullanılıp sonra karar verilecek.
- **PLAN ↔ GERÇEK (adım 2).** Plan için **yeni veri modeli EKLENMEDİ.** Mevcut grid
  zaten "hangi stintte hangi köşe değişiyor"u kodluyor (`state.js`: boş hücre =
  taşı, dolu hücre = o köşede pit işlemi — v1.4.60 kullanıcı kararı), plan oradan
  **türetiliyor**. Böylece: mevcut plan olduğu gibi kullanılır (göç yok, veri kaybı
  yok), iki ayrı plan modeli yan yana yaşamaz, ve türetilen şekil defterinkiyle
  **aynı** olduğu için karşılaştırılabilir.
  - Çipler: `1. 4→4` (uyuyor) · `2. 4→2` (sapma) · `bekliyor` (planlandı, olmadı) ·
    `planda yok` (oldu, planlanmamıştı). Başlıkta `N sapma` / `plana uyuyor`.
  - **Eşleme SIRAYLA** (bilinçli sadeleştirme): plan stint numarasıyla, defter tur
    numarasıyla çalışır ve **planda tur numarası yoktur** → tur-hassas hizalama
    mümkün değil. Bu sınır ekranda yazıyor.
  - Defterin **"Başlangıç" dönemi eşlemeye girmez** — o bir değişim değil; girseydi
    tüm hizalama bir kayar ve her satır yanlış eşleşirdi (testle kilitli).
  - Defter boşken karşılaştırma **çizilmez** — hiçbir şey gerçekleşmemişken
    "plana uyuyor" demek boş bir uyum iddiası olurdu (testli).
- **Yapı:** `src/tyreLedger.js` (saf, 22 test) + render sözleşmesi (6 test).
  Canlı abonelik olmadan bileşen çok-render edilemediği için render testleri yalnız
  "çizilmez" kapılarını doğrular; **pozitif yol saf modülde** test edilir.
- **Oyun PC'si maliyeti: sıfır** — köprüye dokunulmadı, zaten yazılan düğüm okundu.

### Lastik planı: diş modeli + değişim süresi (TinyPedal planlayıcısından)

TinyPedal'ın `ui/tyre_strategy_planner.py` planlayıcısı incelendi. **Tablo yapısı
bizimkiyle neredeyse birebir** — 4 köşe × stint, köşe kilidi
(`enable_restricted_allocation`), stok limiti, wet muaf (`enable_limited_stock:
false`). Bağımsız olarak aynı modele varılmış. Fark, **üstüne ne hesapladığı**:

- **DİŞ MODELİ.** Hücre artık `Yeni–%70` / `%70–%40` yazıyor; diş eksiye düşerse
  **`PATLAK`**. Bir setin kaçıncı stintinde olduğu (`uses`) taşıma zinciri
  çözülerek bulunur. **Kullanıcının ilk sorusunun ("yeni lastiği hangi stint
  kullandı") doğrudan cevabı bu** — hücrede *"Yeni"* kelimesi birebir yazıyor.
- **DEĞİŞİM SÜRESİ sütunu.** `+4.5s` (1–2 lastik) / `+12.0s` (3–4). Eşik 2/3'te,
  TinyPedal'la aynı: bir tarafı değiştirmek dört lastikten belirgin ucuz. Toplam
  plan maliyeti KPI'da.
- **AŞINMAYI ÖLÇÜYORUZ — TinyPedal yazdırıyor.** O, `wear_per_stint`'i hamur başına
  kullanıcıya elle yazdırır (tahmin). Bizde canlı telemetri var: `measuredWear`
  taze setle başlayan **açık dönemden** gerçek tur-başı aşınmayı ölçer ve
  "ölçülen %38 →" düğmesiyle **öneri** olarak sunar. Otomatik yazmaz (kullanıcı
  kararı korunur).

**Bilinçli alınmayanlar** (uydurma yapmamak için):

| TinyPedal | Bizde | Neden |
|---|---|---|
| Hamur başına aşınma/başlangıç dişi | Tek bir "stint başına aşınma" % | Onun hücreleri HAMUR taşır, bizimkiler SET NUMARASI — eşleme yok |
| `Q-Soft` %90 başlangıç dişi | Yok, hepsi %100 | Oyun "bu set kaç tur görmüş" demiyor; kısmi set uydurulmaz |
| 9 kademeli renk rampası | 5 kademe | Okunabilirlik; yön aynı (yeşil→kırmızı) |

**Diğer sınırlar:** wet hücresi (`W`) diş hesabına **girmez** — `W` bir set değil,
yer tutucudur; iki ayrı `W` aynı fiziksel lastik olmadığı için saysaydık her biri
öncekinin üstüne aşınma biriktirir ve **uydurma bir "PATLAK"** üretirdi (testli).
Kısmi (2 lastik) değişimde iki köşenin geçmişi bilinmediğinden **ölçüm yapılmaz**,
tahmin üretilmez. Aşınma %0 iken diş metni **hiç çizilmez** — sahte kesinlik yok.

**Yapı:** `src/tyrePlanCalc.js` (saf, 17 test). **Oyun PC'si maliyeti: sıfır.**

### Kullanılmayan veri: tur sayacı

`session.totalLaps` köprüden beri geliyordu, hiçbir yerde okunmuyordu. Tur-tipi yarışta
başlıkta `42/68` gösteriliyor; `totalLaps` 0/None ise (süre-tipi yarış) **gizlenir** —
sahte `/0` yazılmaz.

### Doğrulama

- **JS:** 765 test geçiyor (583 → 765; **+182**). Yeni: `pitOut.test.js` (25),
  `trackMapPitOut.render.test.jsx` (5). Yeni: `liveSectors.test.js` (14),
  `liveSort.test.js` (16), `liveRelative.test.js` (29), `liveStatus.test.js` (13),
  `liveTabV230.render.test.jsx` (15); `trackShape.test.js` en-kötü-durum kırpma
  kilidiyle genişletildi.
  Render testleri sektör renklerini **kontrollü veriyle** doğrular — demo karesinde
  `var(--purple)` OwnCar'ın "En iyi" kutucuğunda da geçtiği için serbest arama yanlış
  pozitif verirdi; renkli span'in içindeki **sektör değerinin kendisi** aranıyor.
- **Köprü:** tüm paketler geçiyor; `_best_sectors` için 4, `own` düzeltmesi için 2,
  `mTimeIntoLap == 0` tuzağı için 1 yeni test.
- **Oyun PC'si maliyeti** (CLAUDE.md §0 denetimi, ölçüldü): kare 14 araçta +2.162 B
  (%19,6), araç başına ~154 B → 40 araçlık gridde **~12,1 KB/sn** (2 Hz).
  CPU: `_best_sectors` ~0,2 ms/sn, `_speed` ~83 µs/sn (128 araç) — toplam bir
  çekirdeğin binde birinin altı. **Yeni REST yok, yeni thread yok, yeni mmap yok,
  yayın hızı değişmedi, süreç önceliği aynı** — tüm yeni alanlar *zaten haritalanmış*
  Scoring struct'ından okunuyor. Harita ve pit çıkış tahmini tamamen web tarafında,
  köprüye maliyeti sıfır.
- `npm run build` temiz.
- **i18n:** 9 yeni anahtar TR/EN. Lastik rozeti anahtarları (`ÖnSol`, `Son pitte`, `ÖN`…)
  i18n'de zaten vardı — rozet yazılmış ama bağlanmamış olduğu için öksüz duruyorlardı.

## v2.2.4 — 2026-08-30

Eksik giderme.

### Telemetri: pist haritası kaydolmuyordu (grafikler kaydoluyordu)

- **Belirti:** v2.2.3 telemetri izlerini kalıcı hale getirdi; bir stint kaydedince gaz/fren/hız grafikleri yarışı kapatıp açınca geri geliyordu. Ancak **pist haritası** geri gelmiyordu — aynı stintin izinde harita boş kalıyordu. "Grafik kaydoldu ama harita kaydolmadı."
- **Kök neden:** Harita ve grafikler AYNI iz nesnesinde taşınıyor ve `traceCodec.packTrace` ile Firebase'e birlikte yazılıyor. Ama `.duckdb`/LMU haritası gerçek **GPS**'ten geliyor (`mapSrc:"gps"`): `x = boylam·cos(enlem)`, `y = enlem` → değerler ~0.15 ve ~47.95 gibi, hassasiyeti ondalıkta olan küçük sayılar. `packTrace` her kanalı `Math.round(v·scale)` ile kodluyordu ve `x`/`y` için `scale = 1` idi → 47.9500 → 48, 47.9512 → 48… turun **tüm** noktaları tek bir tam sayıya çöküyordu, dolayısıyla `hasMap` çizilebilir bir şekil bulamıyordu. Grafik kanalları (hız 0–300, gaz/fren 0–100) büyük tamsayı olduğu için yuvarlamadan etkilenmiyordu — bu yüzden yalnız harita kayboluyordu.
- **Çözüm (`src/traceCodec.js`, format v2):** `x`/`y` artık sabit `scale=1` yerine, turun kendi yayılımından türeyen **ortak** bir `mapK` ile ~1e5 tamsayı çözünürlüğüne ölçekleniyor (`x` ve `y` aynı ölçek → en-boy korunur), origin çıkarılıyor; `mapK/x0/y0` başlıkta saklanıyor. UI zaten fit-to-box normalize ettiği için mutlak konum değil yalnız şekil önemli, o da kayıpsıza yakın korunuyor (Le Mans için round-trip hatası ~0.03 m). Eski v1 stringleri (metre koordinatlı) hâlâ okunuyor; GPS'li stint yeniden kaydedilince v2 ile düzeliyor.
- **Doğrulama:** Yeni GPS regresyon testleri + 559 testin tümü geçiyor; gerçekçi Le Mans GPS turu paketlenmiş boyut 10.8 KB (< 40 KB Firebase yaprak sınırı), 300 noktanın 300'ü ayrışık.

### Setup havuzu: dosya adı standardı

- **Belirti:** Havuzdaki setup'lar yükleyenin ham dosya adıyla duruyordu (`setup_1.svm`, `Spa deneme (2).svm`). Havuz okunaksız, `searchSetups` `name` üzerinde çalıştığı için arama işlevsiz, indirilen dosya tanınmaz.
- **Standart:** `<pist>_<sınıf>-<araç>_<seans>-<koşul>_v<sürüm>.svm` → `spa_gt3-ferrari_r-dry_v3.svm`
  - **Sınıf neden ADDA:** araç id'leri sınıflar arası **tekil değil** — `ferrari` hem Hypercar 499P hem GT3 296. Sınıfsız iki farklı araç aynı adı alırdı (testle kilitlendi).
  - Boş alanlar segmentiyle **birlikte** düşer (`__` oluşmaz); Türkçe/aksanlı harfler ASCII'ye katlanır (`portimão`→`portimao`, `Şğıöüç`→`sgiouc`); sürümde baştaki `v` yinelenmez, nokta korunur (`V1.2`→`v1.2`); ad 72 karakterle sınırlı.
  - Kişi alanı **bilinçli olarak yok** (kullanıcı kararı) — kimin olduğu havuz arayüzünde zaten görünüyor.
- **TÜM kayıtlara uygulanması — yazma olmadan:** Kullanıcı isteği "havuzdaki mevcut kayıtları da toplu yeniden adlandır" idi. **Bu mümkün değil:** `globalSetups/$id` `.write` kuralı yalnız *oluşturma* (`!data.exists() && newData.exists()`) ve *admin silme* izni veriyor — mevcut kayıt hiç güncellenemiyor, sahibi bile. Kayıtlar bilinçli olarak değiştirilemez; bunu açmak güvenlik tasarımını bozardı.
  - Bunun yerine ad **okuma yolunda türetiliyor** (`withFileNames`, `watchSetups` çıktısına tek noktadan uygulanır) → eski/yeni tüm kayıtlar anında standart görünür; süzme, arama, sıralama, içerik penceresi ve **indirme** hepsi bu çıktıyı kullanır. Sıfır yazma, sıfır kural değişikliği, sıfır göç riski. Ham ad `origName`'de korunur.
  - Yeni yüklemelerde standart ad kayda **da** yazılır (veritabanı tutarlı kalsın); okuma yolu yine türettiği için ikisi ayrışmaz (türetme meta'dan olduğu için idempotent).
- **Çakışma:** Kişi alanı olmadığından iki pilotun aynı meta'sı aynı adı üretebilir. Aynı adı paylaşan kayıtların **tamamına** id'nin son 4 hanesi eklenir → sıralama değişse de ad sabit kalır (testli).
- **Yan bulgu (düzeltildi):** Telemetriden havuza kaydetme yolu (`saveTeleSetup`) `name` alanını **hiç set etmiyordu** — o kayıtlar havuzda adsız görünüyor, indirilince uzantısız `setup` oluyordu. Artık aynı standarttan besleniyor.
- **Doğrulama:** `setupPool.js`'e saf `setupFileName` / `withFileNames` + 11 yeni test (sınıf çakışması, boş segment, Türkçe katlama, sürüm biçimi, grup soneki kararlılığı, bozuk girdi). 583 testin tümü geçiyor.

### Dağıtım: yeni sürüm yayınlansa da kullanıcı ESKİSİNİ görüyordu

- **Belirti:** Deploy başarılı, sunucudaki paket yeni — ama tarayıcıda açınca ekran değişmemiş görünüyor. Saatler sonra kendiliğinden düzeliyor.
- **Kök neden (iki katman üst üste):**
  1. `index.html` `cache-control: max-age=3600` ile geliyor → tarayıcı bir saat boyunca ESKİ HTML'i kullanıyor. Varlık adları içerik-hash'li (`index-ZVVxviLi.js`) olduğundan eski HTML eski hash'leri işaret ediyor.
  2. Service worker'ın gezinme dalı "ağ önce" ama düz `fetch(req)` ile — bu istek **tarayıcının HTTP önbelleğinden** geçiyor, yani sunucuya hiç gitmiyor. Eski HTML'in işaret ettiği eski varlıklar da `fetch` dalındaki **cache-first** mantığıyla SW önbelleğinden servis ediliyor → zincir kapanıyor ve yeni sürüm hiç yüklenmiyor.
- **Çözüm:**
  - `public/sw.js`: gezinme artık `fetch(req, { cache: "reload" })` — HTTP önbelleğini atlayıp her seferinde sunucuya gider; çevrimdışıysa yine önbellekteki `index.html`'e düşer. `CACHE` adı sürümlendi (`crc-v2.2.4`) → yeni SW etkinleşince bayat app-shell temizlenir.
  - `firebase.json`: hosting başlıkları eklendi — `/` (kök) / `index.html` / `sw.js` / `manifest.webmanifest` `no-cache`, `assets/**` `immutable`. **Dikkat:** Firebase başlıkları rewrite HEDEFİNE değil **istek yoluna** göre eşler; yalnız `/index.html` yazmak kök isteğini (`/`) kapsamıyordu — sahada ölçülüp `/` kuralı ayrıca eklendi (hash'li olduğu için bir yıl güvenle önbelleklenir). Bu, önizleme kanallarını ve Firebase hosting'i kapsar; üretim GitHub Pages'te asıl düzeltmeyi SW değişikliği yapar.
- **Not:** Bu düzeltmenin kendisi eski SW tarafından servis edilebileceği için, kullanıcıların **son bir kez** zorla yenilemesi (Ctrl/Cmd+Shift+R) gerekebilir; sonrasında sürümler kendiliğinden gelir.

### Telemetri: tasarım fişi (tele-paketi, 28 Ağu 2026) uyumu

Handoff paketi `handoff-spec/tele-paketi` (TELE-FİŞİ + tokens.css + referans görseller) uygulandı. Tüm tokenlar projede zaten tanımlıydı; ekran da bu tasarım sisteminden türemişti — bu yüzden iş, fişin **EK** bölümündeki farklara ve gözden kaçmış uyumsuzluklara odaklandı.

- **§İK — kategori ikonları.** Setup kategorilerinde kalan emojiler kaldırıldı: `elec` 💡 → `kontrol`, `engine` 🛢 → `anahtar`. Ayrıca fişteki eşlemeye göre **ters düşmüş** iki ikon düzeltildi: `susp` `ayar`→`mekanik`, `diff` `mekanik`→`ayar`. (`other` fişte yok → nötr madde imi korundu.)
- **§BS + §İM-3 — "Bu seansın setup'ı" butonu (YENİ).** Seans kutusunda, seans satırlarının altına / alt aksiyon barının üstüne tam genişlikte buton; tıklayınca **Setup havuzundaki "İçerik" penceresinin birebir aynısı** (`SetupContentModal`) açılır — fişin §İM-3'te tarif ettiği davranış. Dibe yaslama rolü (`margin-top:auto`) butona geçti, alt bar `12px` oldu.
  - Sayfa-içi `SessionSetupBox` kartı ("Bu Seansın Setup'ı" bölümü) **kaldırıldı** — aynı içeriği iki ayrı yerde iki ayrı düzende gösteren ikinci bileşen ortadan kalktı; bileşen ve testleri silindi, öksüz kalan importlar temizlendi.
  - Pencere **hiç değiştirilmedi**: `.duckdb`'ye gömülü kurulum `duckSetupToSvm` + `textToB64` ile sentetik bir havuz kaydına (`su`) çevrilip modala verilir → havuzdan açılan pencereyle aynı kod yolu, aynı düzen, aynı kategori ikonları.
  - Tek ekleme: modala **opsiyonel** `onSave` prop'u. Seans setup'ı havuzda bir kayıt olmadığından "Havuza Kaydet" eylemi (kaldırılan kartta duruyordu) buraya taşındı. Havuzdan açılan pencere bu prop'u geçmez → **o pencere birebir eskisi gibi kaldı**.
- **Stint kartı görselleri.** Dolu yuvalarda marka logosu (26px, `brandLogo(meta.vehicle)`) + araç görseli (124×56). Görsel yoksa `onError` ile gizlenir.
- **Grafik kroması → tokenlar.** Recharts grafikleri Recharts varsayılanına yakın **mavi-gri** bir palet kullanıyordu (`#2B3542` ızgara · `#8C97A5` eksen · `#1F2731` tooltip) ve sıcak koyu temada yabancı duruyordu. Fişin "Renk → token" tablosuna hizalandı: ızgara `--rc-line-soft`, eksen `--rc-text-3`, tooltip `--rc-surface-3`/`--rc-border`, sektör ayırıcı `--rc-border-strong`, playhead `--rc-ok-3`, delta/viraj `--rc-warn-2`.
  - **Yakalanan regresyon:** PDF dışa aktarımı karttaki SVG'leri ayrı bir iframe belgesine kopyalıyor; orada uygulamanın `:root`'u olmadığı için `var(--rc-…)` çözülmez ve ızgara/eksen kaybolurdu. PDF stil bloğuna aynı tokenlar birebir değerlerle eklendi. `CA`/`CB` (A/B tur renkleri) aynı sebeple bilinçli olarak HEX bırakıldı.

**Fişten bilinçli sapmalar** (kullanıcı onayıyla — fiş "değer değiştirmen gerekiyorsa sor" diyor):

| Fiş | Karar | Gerekçe |
|---|---|---|
| Elle çizilmiş SVG kutu/çizgi + 7 iz grafiği | Recharts kalır, yalnız renkler hizalanır | Zoom/pan, tooltip, senkron imleç ve mevcut performans optimizasyonları korunur |
| `MoTeC · .ld · .duckdb · CSV` başlığı, ".ld veya .duckdb yükle" | `.duckdb` metni kalır | `.ld`/CSV desteği uygulamadan bilinçli kaldırılmıştı; fişin bu kısmı eski sürümden |
| "⚙ Sütun eşleme" paneli (`mapCols`) | Eklenmedi | CSV/metin ayrıştırıcısına aitti, artık ulaşılamaz |
| "Çözümlenen turlar" düz tablo | Stint başına açılır liste + dahil/hariç checkbox'ları korunur | `%105 filtre` bu seçimle çalışıyor; kaldırmak özellik kaybı olurdu |

**Doğrulama:** yeni `teleTab.render.test.jsx` (5 test) fişin görsel sözleşmesini kilitliyor — slot kartı görselleri, §BS butonunun koşullu görünürlüğü ve konumu, kroma tokenları (eski mavi-gri palet artık yok), seans setup kartının kalkıp yerine pencerenin gelmesi, boş durumda `.ld`/CSV metni geçmemesi. 572 testin tümü geçiyor.

### Live Timing: "Incident" sütunu yanlış veriyi yanlış biçimde gösteriyordu

- **Belirti:** Ceza/incident sütunu güvenilmezdi — sürücü cezasını çekince sıfırlanıyor, biçimi de anlamsızdı (`0.0x`).
- **Üç ayrı hata:**
  1. **Yanlış etiket.** Sütun `Incident` diyordu (üstelik `t()`'den geçmeyen sabit İngilizce), ama beslediği veri `c.penalties` → `mNumPenalties`. Struct başlığı açık: *"number of **outstanding** penalties"*. Bu incident değil, **bekleyen ceza borcu**.
  2. **Yanlış semantik.** "Outstanding" olduğu için drive-through çekilince **0'a geri düşüyor** → yarış boyunca alınan ceza sayısı hiçbir yerde görünmüyordu.
  3. **Yanlış biçim.** Tamsayı sayaç `${penalties.toFixed(1)}x` ile `1.0x` diye yazılıyordu — kümülatif bir "olay puanı çarpanı" izlenimi veriyordu.
  - İz: i18n'deki `"Bekleyen ceza"` ve `"Ceza sayısı…"` anahtarları öksüz kalmıştı — sütun bir noktada "Ceza"dan "Incident"a çevrilmiş ama veri kaynağı değişmemiş.
- **TinyPedal karşılaştırması (kaynak tarandı):**
  - Kümülatif cezayı **yükselen kenarlardan** biriktiriyor (`module_stats.py`): değer düşerse taban indirilir (servis edildi), yükselirse fark toplama eklenir. İlk örnekte yalnız taban alınır.
  - **Gerçek incident'ları paylaşımlı bellekteki results-stream METNİNDEN** ayrıştırıyor (`lmu_connector.py`): `<Incident …>` ve `<TrackLimits …>` satırlarını sayıyor. Bu 64 KB'lık `scoringStream` tamponu **yalnız LMU'nun NATIVE arayüzünde** (`LMU_Data`) var.
  - **rF2 eklenti yolunda TinyPedal'ın kendisi `incidents()` için sabit `0` döndürüyor** (`rf2_reader.py:888`) — çünkü rF2'de results-stream haritalanmıyor (`mResultsStreamPointer` yalnız 8 baytlık yer tutucu).
  - REST'te ceza/incident **hiç yok**: TinyPedal'ın LMU endpoint listesi yalnız hava/seans/garaj/pit veriyor; `/rest/watch/standings`'e hiç dokunmuyor.
- **Çözüm:**
  - `Aggregator`: `penaltiesTotal` — TinyPedal'ın yükselen-kenar algoritmasıyla **kümülatif** ceza. `penalties` (anlık bekleyen) ayrı alan olarak korunuyor. Seans değişiminde sıfırlanıyor, ilk karede yalnız taban alınıyor (yarışa geç katılınca şişmez). **REST'e ihtiyaç duymaz.**
  - `LiveTab`: sütun dürüstçe `t("Ceza")`; kümülatif toplam tamsayı olarak, 0 ise `—`; bekleyen ceza varsa kırmızı + `•`. Öksüz i18n anahtarları yeniden kullanımda; yanıltıcı `"Olay puanı…"` anahtarı silindi.
- **Bilinçli olarak YAPILMAYAN:** gerçek incident (temas + track-cut) sayımı. Kullandığımız transport rF2 eklentisi olduğu için bu veri oyun tarafından hiç sunulmuyor; uydurmak yerine sütun doğru adlandırıldı. İstenirse LMU native `LMU_Data` arayüzüne geçmek gerekir (104 araç + farklı ScoringInfo düzeni → tüm offsetler değişir, ayrı bir iş).
- **Doğrulama:** 4 yeni ceza regresyon testi (servis sonrası sıfırlanmama, ilk-kare tabanı, tek karede çoklu artış, alan yokluğu); tüm köprü paketleri + 568 JS testi geçiyor.

### Live Timing: sarı bayrak hiç görünmüyordu

- **Belirti:** Oyunda sarı bayrak sallanırken Live Timing yeşil gösteriyordu. FCY bazen geliyordu, **lokal sarı hiç gelmiyordu**.
- **Kök neden (zincir):**
  1. `bridge/main.py:398` — `rest_on` varsayılan **false** (v1.4.130'da oyun donması yüzünden kapatıldı, README bunu açıkça öneriyor) → `no_rest=True` → `rf2_source.py:322` `self.lmu = None`.
  2. `read()` içinde `rest_flag = None` → shmem yedeği `_flag_of()` devrede.
  3. `_flag_of()` (v1.4.74'ten beri) yalnız `"FCY"` ya da `"Green"` döndürüyordu — **`"Yellow"` döndüren tek bir kod yolu yoktu**. Lokal sarı varsayılan kurulumda *yapısal olarak imkânsızdı*.
  4. v1.4.74'te sektör sarıları kaldırılmıştı çünkü eski kod `mSectorFlag > 0` kullanıyordu; Invalid/başlatılmamış bayt (255) de "sarı" sayılınca GREEN'de üç sektör birden sarı görünüyor, yanlış full-yellow üretiyordu. Yani bir yanlış-pozitif düzeltilirken yerine daha büyük bir yanlış-negatif konmuş.
  5. Ek olarak REST açık olsaydı bile: `parse_session_flags` `/rest/watch/sessionInfo`'dan düz `GamePhase`/`YellowFlagState`/`SectorFlag` anahtarları **varsayıyor** (şekli hiç doğrulanmamış) ve REST sonucu shmem'i tamamen eziyordu (`if rest_flag:`) → sahte bir `"Green"` gerçek sarıyı maskeleyebiliyordu.
- **TinyPedal karşılaştırması (kaynak tarandı):** TinyPedal sarıyı **yalnız `mSectorFlag`'ten** okur ve **kesin eşitlik** kullanır — `any(data == 1 for data in sec_flag)` (`tinypedal/adapter/lmu_reader.py`). `mYellowFlagState` ve `mUnderYellow`'a hiç bakmaz. Ayrıca TinyPedal'ın LMU REST endpoint listesinde **bayrak verisi yoktur** (yalnız hava/seans/garaj/pit) → bayrağın tek gerçek kaynağı paylaşımlı bellektir.
- **Çözüm:**
  - `_sector_yellows()` (yeni) — `mSectorFlag[3]` → sarı sektör numaraları, TinyPedal'ın `== 1` predikatıyla. 255 (Invalid) artık sarı sayılmaz → v1.4.74'ü doğuran yanlış pozitif geri gelmez.
  - `_flag_of(phase, yellow, sectors)` — lokal sarıyı geri üretir; FCY (`GamePhase 6` / geçerli `mYellowFlagState`) önceliğini korur. **REST kapalıyken de çalışır** (asıl kazanım).
  - `_merge_flags()` (yeni) — shmem + REST birleştirilir: en güçlü bayrak kazanır, sektörler birleşir. Hiçbir kaynak diğerinin sarısını **bastıramaz** (eski `if rest_flag:` maskelemesi kalktı).
  - `_diag.flagRaw` genişletildi (`shm`/`out` eklendi) → sahada `--dump` ile ham bayt ↔ türetilen bayrak karşılaştırılabilir.
- **Transport doğrulaması:** Köprü rF2 Shared Memory Map Plugin yolunu kullanıyor (`$rFactor2SMMP_Scoring$`, 128 araç) — TinyPedal'ın "LMU legacy" modu. Struct hizalaması doğru, `mSectorFlag` eklenti tarafından doldurulur. (LMU'nun *native* `LMU_Data` arayüzü 104 araçlıdır ve alan düzeni farklıdır; oraya geçilirse offsetler kayar — bu yola girilmedi.)
- **Not:** REST varsayılan kapalı KALIYOR (donma önlemi) — bayrak artık ona ihtiyaç duymuyor. `config.example.ini` ve `bridge/README.md` buna göre düzeltildi.
- **Doğrulama:** Bayrak için 5 yeni regresyon testi (sektör sarısı üretimi, 255 yanlış-pozitif kilidi, FCY önceliği, REST maskeleme karşıtı birleştirme); tüm köprü test paketleri geçiyor.

### Telemetri: stint analizine üç stratejik metrik

- **Neden:** Stint analizi "tipik tur"u (medyan/ortalama) veriyordu ama endurance kararları için kritik olan tutarlılık, lastik düşüşü ve bırakılan süre görünmüyordu. Kutu grafiği yayılımı gösteriyordu ama sayı yoktu.
- **Eklenenler (`computeSlotStats`, `src/state.js`):**
  - **Tutarlılık** — kullanılan turların std sapması (ms). Özet kutucuğunda `±0.28 sn`. Düşük = istikrarlı tempo. <3 tur anlamsız → gizli.
  - **Tempo eğilimi** — tur süresi ~ stint-içi sıra doğrusal regresyon eğimi (ms/tur). `+` lastik düşüşü baskın (kırmızı), `−` yakıt hafiflemesi baskın (yeşil). Net etki — sürücünün hissettiği trend. <4 tur → gizli.
  - **Teorik en iyi tur** — kullanılan turların en iyi S1+S2+S3'lerinin toplamı; `bestMs − theoMs` = tek turda birleştirilemeyen "masada kalan" süre.
- **Gerçek sektör beacon'ları (`duckLaps`, `src/duckParse.js`):** `.duckdb`'deki `Last Sector1/2` olayları artık tur başına çıkarılıyor (`sectors=[s1,s2,s3]`, `s3 = resmi süre − s1 − s2`); yalnız tam turlarda, toplam tutarsızsa (glitch) `null`. Teorik en iyi tur bu gerçek beacon verisini kullanıyor (trace-kesri üçlüsü tahmininden daha isabetli).
- **Doğrulama:** duckParse + state için yeni testler; 568 testin tümü geçiyor.

## v2.2.3 — 2026-08-29

Hotfix.

### Sohbet: sol KANALLAR paneli + başlık çubukları görünmüyordu — GERÇEK KÖK NEDEN

- **Belirti:** Sohbet penceresinin sol kanal listesi (Genel, Takım…) ve sağ sütunun başlık çubuğu (kanal adı + ✕ kapat) görünmüyordu; yalnız mesajlar çiziliyordu. v2.2.1 ve v2.2.2'de iki kez "GPU/compositing hatası" teşhisiyle düzeltilmeye çalışıldı (`backdrop-filter` kaldırma, `isolation:isolate`, `rcpop`→`rcfade`, `translateZ(0)`); hiçbiri işe yaramadı çünkü teşhis yanlıştı.
- **Nasıl bulundu:** Ekran görüntüsünün piksel analizi, sol panelde 126.900 pikselin tek renk olduğunu (sd=0.00) gösterdi — metin karanlık değil, hiç çizilmemişti. Ardından kullanıcının cihazından `chatDiag` ölçümü alındı:

  | | x | y | w | h |
  |---|---|---|---|---|
  | pencere (kutu) | 376 | **157** | 940 | **660** |
  | sol panel | 376 | **−13** | 280 | **911** |
  | sağ sütun | 656 | **−13** | 659 | **911** |

  Çocuklar kutudan 251px uzun ve 170px yukarıdan başlıyordu; kutunun `scrollTop`'u sıfır değildi.

- **Kök neden (zincir):**
  1. Kutudaki `flexWrap:"wrap"`, flex **satırının** kutunun kesin yüksekliğine sığdırılmak yerine içeriğin doğal boyuna uzamasına izin veriyordu (mesaj listesi ne kadar uzunsa o kadar). `align-items:stretch` ile iki sütun da o boya çekiliyordu.
  2. Kutu böylece taşan içeriğe sahip oldu. `overflow:hidden` **kullanıcı** kaydırmasını engeller, **programatik** kaydırmayı engellemez.
  3. `useChat`'teki `chatEndRef.scrollIntoView({block:"end"})` (sohbeti en alta getirme) kaydırılabilir **tüm ataları** kaydırır — modal kutusu dahil.
  4. Sol başlık, kanal listesi ve sağ başlık kırpma çizgisinin üstüne itilip yok oluyordu. Aşağı uzanan mesajlar görünmeye devam ettiği için hata "sadece sol panel boş" gibi görünüyordu.

- **Çözüm:** `flexWrap:"nowrap"` — satır artık kutunun yüksekliğiyle sınırlı, kaydırma tasarlandığı yerde (ChatPanel'in kendi listesinde) kalıyor. Sütunlara `minHeight:0` (iç kaydırmanın flex'te doğru çalışması için şart), sol panele `flex:"0 1 280px"` (dar ekranda taşmak yerine küçülür).
- **Doğrulama (gerçek Chromium, 40 mesajlık sohbet):**

  | | önce | sonra |
  |---|---|---|
  | kutu `scrollTop` | **2182** | **0** |
  | kutu `scrollHeight`/`clientHeight` | 2921 / 658 | 658 / 658 |
  | sol başlık · kanal listesi · sağ başlık | **tamamen kırpıldı** | **görünür** |

  1691px, 1024px ve 700px genişliklerde temiz; mesaj listesi hâlâ en alta kayıyor.

### Sohbet: kanal adları koyu zeminde siyah çiziliyordu (ayrı ve gerçek hata)

- Kanal `<button>`'ları inline style'ında `color` vermiyordu. `<button>` metin rengini **miras almaz** — UA `color: buttontext` (siyah) atar; panel zemini `#120C0E` olduğu için kontrast **1.08:1** çıkıyordu.
- **Çözüm üç katman:** butona `color: var(--rc-text)`; global güvenlik ağı `.rc button,.rc input,.rc select,.rc textarea{color:inherit}` (denetim: 316 butonun 98'i `color` bildirmiyordu, hiçbirinin açık zemini yok); `:root{color-scheme:dark}` / `[data-theme="light"]{color-scheme:light}` ile UA varsayılanlarının tema ile hizalanması.

### Sohbet teşhis modülü (`chatDiag.js`)

- Pencere açılışında gerçek DOM ölçülür: her parça için kutu, çocuk sayısı, `innerHTML` uzunluğu + başı, renk/zemin **WCAG kontrastı**, `display/visibility/opacity`, `transform/clip/contain` ve `elementFromPoint` ile üstünü örten eleman testi. Sorun bulunursa konsola uyarı basar.
- Sorun tablette görüldüğü ve orada geliştirici konsolu açılamadığı için ölçüm **ekrana da basılabilir**: `?debug=chat` (en kolayı), `localStorage.rc_debug_chat="1"` veya konsolda `__rcChatDiag()`. Panel sabit renk + inline stille doğrudan `body`'ye çizilir — ölçtüğü hatadan kendisi etkilenmesin diye. "Kopyala" ile JSON panoya alınır.
- Ölçüm alınamazsa da panel çıkar ve `APP_VERSION` ile `data-rc-chat` işaretlerinin varlığını gösterir — eski/önbellekli paket böylece elenir.
- Ölçüm `rcfade` (.2s) giriş animasyonundan sonra (450 ms) alınır; erken ölçüm `opacity:0` yakalayıp yanlış alarm veriyordu. Örtme testi kendi panelini yok sayar.
- **Normal kullanımda kapalı:** pencere açılışındaki otomatik ölçüm yalnız hata ayıklama bayrağı açıkken çalışır (`?debug=chat` veya `localStorage.rc_debug_chat="1"`); bayraksız kullanıcıda sıfır log/panel/maliyet. Konsoldan `__rcChatDiag()` her zaman elle çağrılabilir.

### Regresyon kilidi

`chatDiag.test.jsx` — 11 test: `flex-wrap:nowrap`, sütunlarda `min-height:0`, sol panelin küçülebilirliği, kanal butonlarının açık renk bildirmesi, altı `data-rc-chat` ölçüm hedefi, kontrast matematiği ve `styles.js`'teki iki global kural. Ayrıca `styles.js` bir template literal olduğu için CSS metninde ters tırnak kalmadığı doğrulanır (bu sürümde bir kez bu yüzden derleme kırıldı).

### Plan tablosu: süre override'ı stinti 1 tura düşürüp stint numaralarını kaydırıyordu

- **Belirti:** 3. stint uzun gidince elle 31 tura çekildi; ardından 4. stint 1 tur kabul edildi ve numaralar kaydı — kullanıcı 7. stintteyken uygulama 8. stinti gösteriyordu.
- **Kök neden:** OVERRIDE sütunu `h:mm:ss` bekler ama `parseHMS` çıplak sayıyı **saniye** okur (`"31"` → 31 sn). 31 sn'lik stintte `walkByTime` 0 tur döndürüp `Math.max(1, ·)` stinti **1 tura** düşürüyor; o stintin turları sonraki stintlere taşınca plan bir satır uzuyor ve tüm stint numaraları kayıyor. Yeniden üretildi: 9 satırlık plan 10 satıra çıkıyor, 4. satır 1 tur oluyor.
- **Çözüm:** İki mantıksız girdi sınıfı **yok sayılır** (`stintLaps`'teki "makul değilse yok say" deseniyle aynı): (1) **iki noktasız** her değer — birim belirsiz; (2) iki noktalı ama **bir turdan kısa** değer. İlk denemede yalnız "bir turdan kısa" eleniyordu ama bu YETMİYORDU: `120` sn bir turdan (106,5 sn) uzun olduğu için geçiyor ve yine 1 turluk stint + kayma üretiyordu — ölçülerek yakalandı ve kural genişletildi. `applyMarkPit`'in yazdığı otomatik değerler `fmtHMS` ile hep iki noktalıdır → etkilenmez. Satır `ovrIgnored` ile işaretlenir; hücre kırmızı çerçevelenir ve title doğru biçimi açıklar — girdi sessizce yutulmaz.
- **Doğrulama:** çıplak sayıların tamamı (`1`…`99999`) yok sayılıyor ve plan satır sayısı değişmiyor; `0:53:15` / `53:15` / `0:43:20` / `1:10:00` çalışmaya devam ediyor.

### Plan tablosu: elle girilen süre override'ı "otomatik" sayılıp siliniyordu

- **Kök neden:** `applyBumpLaps` `overrides[i]`'yi temizlerken `autoOvr[i]` bayrağını düşürmüyordu; `applyUpOvr` de elle giriş yaparken bayrağı sıfırlamıyordu. Gerçek pit işaretlenmiş bir stintte bayrak bayat kalınca, kullanıcının elle yazdığı değer hâlâ otomatik sayılıyor ve sözleşmesi *"elle girilen override'ları KORUR"* olan `applyResetPits` (ve `applyUnmarkPit`) onu siliyordu.
- **Çözüm:** İkisi de `autoOvr[i]`'yi düşürür (ortak `clearAuto` yardımcısı). Elle girilen değer artık sıfırlamalarda korunur.
- **Regresyon kilidi:** `state.test.js` +4 test — kısa override yok sayılır ve plan kaymaz, geçerli override çalışmaya devam eder, `bumpLaps` bayrağı düşürür, elle girilen `resetPits`'te korunur.

### Telemetri: pist haritası + gaz/fren grafikleri artık KALICI (bulut)

- **Belirti:** Telemetri sekmesindeki pist haritası ve gaz/fren grafikleri program kapatılıp açılınca kayboluyordu.
- **Sebep (bug değil, eksik kalıcılık):** Harita/grafik verisi (`cmpData`) yüklenen `.duckdb` dosyasının bellekteki kopyasından oturum-içi hesaplanıyor, hiçbir yere yazılmıyordu. Kalıcı olan tek şey `st.telemetry[slot]` (tur süreleri/yakıt/aşınma). Ham iz ~100 KB/tur — race state'e (800 ms'de yazılıyor) gömülemez.
- **Çözüm:** Bir stint kaydedilince o stintin turlarının izi kompaktlanıp **ayrı** bir Firebase yoluna (`teams/{tid}/teleTrace/{rid}/{slot}`) yazılır; yarış açılınca bir kez okunup geri yüklenir. Takım üyeleri de görür.
- **Kompakt kodlama (`traceCodec.js`):** `buildTrace` çıktısı ↔ string. `dist`/`frac` saklanmaz (len/N'den türetilir); kanallar yuvarlanmış tamsayı, null korunur, olmayan kanal yazılmaz. Nokta sayısı 300 (harita+delta için yeterli), tüm izler aynı N → `buildCompare` index-hizalı. Sonuç: ~9 KB/tur, 30 tur × 4 stint ≈ 1 MB. Yaprak başına 40 KB sınırı; stint başına en fazla 80 (en hızlı) tur.
- **Yeni/değişen:** `traceCodec.js` (+test, 11), `storage.js` (`teleTraceSet/GetAll/Remove`, `deleteRace`/`deleteTeam` temizliği), `firebase-rules.json` (`teleTrace` yolu + boyut validasyonu + rules testi), `useTelemetry.js` (imzaya `curTeam/curRace/role`; async kayıt + ilerleme; yükleme; `cmpSources`/`resolveSrc`/`cmpData` kalıcı-iz dallandırması; `removeSlot` temizliği), `App.jsx` (hook `useTeams`'ten sonra çağrılır — TDZ; solo telemetri örneği persistence'sız), `TeleTab.jsx` (kaydetme durum göstergesi).
- **Kapsam:** Yalnız `.duckdb`; yalnız editör/sahip yazar (üye okur); eski yarışlarda `teleTrace` yok → sorunsuz (migration gerekmez).
- **Test sınırı:** Kompakt kodlama, format sözleşmesi ve `buildCompare` uyumu birim testlerle doğrulandı. Gerçek `.duckdb` dosyasıyla uçtan uca akış (yükle → kaydet → yarışı kapat/aç → harita+gaz/fren) önizlemede kullanıcı testinde doğrulanmalı. Firebase kural testi bu ortamda emülatör indirilemediği için CI'da koşar.

## v2.2.2 — 2026-08-28

Hotfix.

### Race data: kayıtlı avgLap/consumption LMU temposuna dönüyordu (ASIL KÖK NEDEN)
- **Belirti:** Yarış sırasında sağ panelden değiştirilen race data (`avgLap`, `consumption`) yarış yeniden açılınca eski/LMU değerine "geri dönüyordu".
- **Kök neden:** `App.jsx`'teki "pist/araç seçimi değişince LMU referans temposunu varsayılan yaz" efekti (`lmuPrevSel` + `up({avgLap, consumption})`). `openRace` bir yarışı yüklerken `st.track`/`carClass`/`car`'ı boş→gerçek değiştirdiği için efekt bunu KULLANICI SEÇİMİ sanıp `lmuSuggest.avgLap`/`consumption`'ı KAYITLI değerin üzerine yazıyor, ardından push edip sunucuyu da bozuyordu. "İlk yüklemede ezmez" koruması yalnız ilk mount'u atlıyordu, `openRace` yüklemesini değil. (Kalıcılık/yazım sağlamdı; teşhis yaz/oku round-trip'i ile doğrulandı.)
- **Çözüm:** `openRace` yüklenen yarışın pist/araç imzasını `lmuPrevSel.current`'a SENKRON yazar (efekt çalışmadan önce) → efekt bunu "değişiklik değil" görüp atlar; kayıtlı `avgLap`/`consumption` korunur. Kurulumda (pick) pist/araç seçince LMU varsayılanını yazma davranışı aynen korunur. (`App.jsx openRace` + `lmuPrevSel` efekti)

### Kalıcılık sağlamlaştırma (yardımcı)
- Asıl kök neden önce yanlışlıkla kalıcılık sanılmıştı; o araştırmadan gelen ve zararsız kalan tek iyileştirme korundu: **Kapanışta flush** — `useRaceSync` artık `visibilitychange`(hidden)/`pagehide` olaylarında bekleyen 800 ms debounce'lu yazımı HEMEN gönderir; böylece normal kapatma/sekme değişiminde son düzenleme beklemeden Firebase'e ulaşır. (`useRaceSync.js`)

### Sohbet penceresi — sol panel (devam)
- v2.2.1'de `backdrop-filter` kaldırılıp `isolation: isolate` eklenmişti ama sol 'KANALLAR' paneli bazı GPU'larda hâlâ boş kalabiliyordu. Geriye kalan tetikleyici, kutunun TRANSFORM tabanlı giriş animasyonuydu (`rcpop`: `translateY`+`scale`) — kırpılmış (`overflow:hidden` + `borderRadius`) kutuda geçici bir compositing katmanı oluşturup iki yan-yana kaydırma panelinin ilkini boyamadan bırakıyordu. Bu modalin animasyonu yalnız-opaklık (`rcfade`) yapıldı; ayrıca sol panele açık opak arka plan (`--rc-surface`) ve kendi stacking katmanı (`position:relative; zIndex:1`) verildi. Diğer modaller tek sütun oldukları için `rcpop` kullanmaya devam ediyor. (`ChatModal`, `components.jsx`)

### Canlı Timing — eski köprü kutusu kaldırıldı
- Canlı Timing üstündeki eski durum/uyarı kartı (`BridgeControl`) ve yardımcı `CopyBtn` silindi; köprü artık otomatik yönetildiği için kutu gereksizdi. Kullanılmayan `bridge`/`canBridge` prop'ları `LiveTab` imzasından ve `App.jsx`'teki çağrıdan temizlendi.

## v2.2.1 — 2026-08-28

Hotfix.

### Üst bar
- 'Bağlı değil' çipinde bağlantı kopmuşken yanında görünen süre bilgisi (`· {age}s`) kaldırıldı; süre yalnızca canlı/gecikmeli durumda gösteriliyor. Bağlı değilken çip sadece "bağlı değil" yazar.

### Sohbet penceresi
- Overlay'deki `backdrop-filter: blur(5px)` kaldırıldı (arka plan opaklığı `.74`→`.86` ile telafi edildi) ve pencere kutusuna `isolation: isolate` eklendi. Bazı GPU/tarayıcı kombinasyonlarında iki yan-yana kaydırma panelli + bulanık overlay bileşiminin sol 'KANALLAR' panelini boş bırakan katman (compositing) hatasını gideriyor. Masaüstü/mobil düzen aynı kaldı.

### Telemetri kalıcılığı
- **Bağımsız Telemetri** (Ana Menü → Telemetri) yarışa/Firebase'e bağlı olmadığından yüklenen stint'ler artık cihaz-yerel `localStorage`'da (`rm_tele_solo_v1`) tutuluyor; yalnız `telemetry` alanı saklanır (ham .duckdb izi değil). Box plot + SEANS + çözülen turlar sayfa yenilense de kalır. `App.jsx` `teleSt` init'i localStorage'dan okur, değişince yazar.
- `useRaceSync.pushState` eskiden "tekrar denenecek" yazıp aslında denemiyordu → yarış içi telemetri gibi büyük yazımlarda geçici hata veriyi sessizce düşürebiliyordu. Artık gerçek exponential backoff (1/2/4/8 sn, 4 deneme) ile tekrar deniyor; yeni bir düzenleme bekleyen retry'ı iptal ediyor.

### Navigasyon
- **Ana menüden sekme açılmama (aralıklı)**: `openRace` yarışa girişi `raceStateGet` (uzak durum çekme) çağrısının başarısına bağlıyordu; bu ağ çağrısı geçici düşünce (özellikle canlı timing'in yoğun Firebase trafiği sonrası) `catch` çalışıp `setCurRace`/`setEntered` hiç ateşlenmiyor, kullanıcı lobide kalıyordu — Takım (ayrı ekran) çalışırken Dash/Stint/Canlı vb. "açılmıyordu". Artık giriş fetch'ten bağımsız: çağrı denenip düşse bile yarışa giriliyor, asıl durum `raceStateSubscribe`'dan geliyor.

### Arayüz düzeltmeleri
- **Setup Havuzu kartları**: dar ekranda footer butonları (İçerik/İndir/✕) `overflow:hidden` ile kırpılıyordu. Footer artık `flex-wrap` ile gerektiğinde alt satıra kayıyor; kart min genişliği 300→340px. (`SetupCards`, `components.jsx`)
- **Canlı timing SECTOR sütunu**: başlığı artık toggle — tıklayınca sütun daralıp `·` gösteriyor (`Sektör ‹` → `S ›`), tekrar tıklayınca S1·S2·S3 süreleri geri geliyor. `secOpen` state, `LiveTab.jsx`.
- **Canlı timing SECTOR — ANLIK sektör**: sütun artık son tamamlanan tur yerine, aracın bu turda sektör çizgisini geçtiği AN oluşan süreyi gösteriyor. Köprü (`rf2_source.py`) shared-memory `mCurSector1`/`mCurSector2`'den `curSectors=[s1,s2]` üretir (geçilmeyen sektör `null`); web (`liveSecStr`, `LiveTab.jsx`) en az S1 geçilmişse canlı `s1·s2·—`, yoksa son turun `lastSectors`'ına düşer. Demo (`liveDemo.js`) tur-içi ilerlemeye göre curSectors üretir. Geriye dönük uyumlu: `curSectors` göndermeyen eski köprüde davranış eskisi gibi (son tur).

### Telemetri — yalnız .duckdb
- CSV/MoTeC metin (yapıştırma + `.csv/.tsv/.txt`) desteği kaldırıldı; telemetri artık **yalnızca `.duckdb`** kabul ediyor. `useTelemetry.onTeleFile` `.duckdb` dışı dosyaları reddediyor; `TeleTab`'ten yapıştırma alanı, sütun-eşleme arayüzü ve `.csv/.tsv/.txt` accept filtresi çıkarıldı, etiketler ".duckdb" olarak güncellendi.

### Güncelleme penceresi (yeni)
- Eski üst güncelleme şeritleri (web amber şeridi + Tauri `UpdateBanner`) kaldırıldı; yerine ortada beliren `UpdateModal` geldi (`handoff-spec/guncelleme-penceresi-paketi` fişine göre). 452px kart, üst gradyan şerit, ikon karosu, sürüm geçişi (eski → yeni + boyut), changelog'dan öne çıkanlar, "Tüm değişiklikler" (VersionModal'ı açar).
- Üç faz: `idle → downloading → ready`. Masaüstünde (Tauri) gerçek indirme yüzdesi + "Yeniden başlat"; web'de "Şimdi güncelle" = sayfayı yenile.
- Dil `lang` prop'undan gelir (modalde seçici yok). "Sonra" sürümü `dismissed` işaretler; kritik sürümde (`critical`) "Sonra"/✕/Esc gizli/kilitli. Odak tuzağı + arka plan kaydırma kilidi.
- Yeni: `src/UpdateModal.jsx`, `src/useUpdater.js`; `gp*` keyframe'leri `styles.js`'e eklendi. Silinen: `src/UpdateBanner.jsx`.

## v2.2.0 — 2026-08-27

Yeni özellikler ve düzeltmeler.

### Araç görselleri
- 32 araç için yeni **yandan (webp)** görseller ve artık her araca **özel üstten** görsel (eskiden tek jenerik üstten görsel vardı) — `carImg` `.webp`'e taşındı, `carTopImg` + `CAR_TOP_DEFAULT` eklendi; `teamAssets` üstten fallback'i araca özel çözer, eksikse `<img onError>` ile default'a düşer.
- Yeni araçlar: **GT3 Lamborghini Huracán GT3 EVO2**, **LMP3 Ginetta G61-LT-P3**.

### İngilizce mod (i18n)
- EN'de Türkçe kalan **~328 metin** çevrildi (kart başlıkları, tab etiketleri, tooltip'ler, mesajlar).
- İlk açılışta "EN seçili ama Türkçe görünüyor" parlaması giderildi: EN sözlüğü (lazy) inene dek **dile nötr yükleme ekranı**; catch + 8 sn güvenlik ağı.

### Telemetri
- **SEANS paneli** artık bayrak + araç + pist şekli ve pist/araç/pilot/sıcaklık satırları gösterir.
- Stint kaydında meta yanlış anahtara (`src`) yazılıyordu; `meta`'ya yazılacak şekilde düzeltildi → `.duckdb`'deki **pilot ve sıcaklık** artık görünür. Dosya meta'sı eksikse pist/araç yarış bağlamından türetilir.

### Resmi Yarışlar
- Yarış satırının "hafta sonu" detayları **SEANSLAR / FORMAT / KURALLAR** sütunları hâlinde kategorize edildi.

### Takım
- Ana sayfadaki takım çipi artık takımın **yüklediği özel logoyu** gösterir (varsayılan Caspian logosu yerine).

### Caspian Live Bridge (masaüstü hafif köprü)
- Arayüz yeniden tasarlandı: kartlı kurulum akışı (Hesap → Yayın Hedefi → Gönderim), canlı yayın görünümü (durum şeridi + araç/yakıt-VE/tur/gecikme metrikleri), varsayılan İngilizce + **EN/TR** geçişi (`config.ini [ui] lang`). Tüm işlevler korundu.

## v2.1.1 — 2026-08-26

Hotfix sürümü — arayüz cilası ve düzeltmeler.

### İkon seti
- **68 parçalık çizgi-SVG ikon seti** (`src/iconset.jsx`): nav rayı, üst çubuk, komut paleti, eylem düğmeleri ve durum bantlarındaki emoji/dingbat ikonları tema-uyumlu vektörlerle değiştirildi. `currentColor` ile renk kapsayıcıdan gelir; boya göre stroke-width. Nav ve komut paleti aynı ekran ikonunu paylaşır.
- **Track temp termometre ikonu** (`TrackTempIcon`): cıva sıcaklığa göre dolar, ısıya göre renklenir.

### Canlı yarış
- Pist haritasında **pit giriş çizgisi** görünürlüğü düzeltildi (giriş/çıkış pit alanına göre saptanır; 'PIT IN' çizgisi).
- POZİSYON kartına **sınıf-içi sıra** eklendi (ör. `P7 · GT3 1`).

### Strateji
- Elle tur override'lı son stint bayrağa çok yakın bitince oluşan **hayalet son pit** ve yanlış "plan tamamlanamadı" uyarısı düzeltildi.

### Üye yönetimi
- "Son görülme" **göreli zaman** (şimdi · N dk · N sa · dün · g.aa); arama **Türkçe karakter duyarsız**; "Beklemede" filtre çipi hep vurgulu.

### Arayüz
- Yarış açılışı doğrudan **Stint** sekmesine iner.
- Eksik **sekme geçiş animasyonları** tamamlandı (Stint, Dashboard, Pilotlar, Telemetri, Yarış Sohbeti).

## v1.0.0 — 2026-07-23

İlk kararlı sürüm. Le Mans Ultimate endurance yarışları için pit wall / strateji aracı.

### Strateji motoru
- **Virtual Energy modeli**: depo daima %100 VE, gerçek yakıt `VE × ratio` ile türetilir
- Stint planlayıcı: A/B/C/D tur stratejileri, tur ve süre bazlı override (karşılıklı dışlama korumalı)
- **Son Stint Hesaplayıcı**: kalan süreye göre VE ihtiyacı, ondalık tur yukarı yuvarlama, extra lap payı
- **Lider bitiş modeli** (multiclass): `T_flag = ceil(T / L_lider) × L_lider` — bayrak liderde, son tur otomatik eklenir
- Pit süresi: pit lane + dolum + lastik + hasar/tamir; **dolum süresi doldurulan stintin VE ihtiyacına ölçekli**
- Lastik değişim süreleri sabit: 1-2 lastik 5s, 3-4 lastik 12s

### Hava durumu
- Dört zemin durumu: Dry ×1.00, Damp ×1.07, Slightly Wet ×1.09, Wet ×1.13; ıslakta yakıt −%8'e kadar
- **Kronolojik hava log'u**: her değişim zaman damgasıyla saklanır (dry→wet→dry korunur)
- Plan tur tur yürüyerek karma havayı hesaplar — stint içi geçişler doğru bölünür
- Canlı değişim + **planlı geçiş** (ileri tarihli, "son 60 dk wet" kısayolu); ikisi çakışmaz
- Stint çubuğunun altında animasyonlu hava kronoloji çubuğu

### Lastik yönetimi
- Beş durumlu köşe döngüsü: taşı / yeni kuru / Qual'a dön / wet / eski kuru tekrar
- Wet lastikler limitten bağımsız ve sınırsız
- Lastik limiti takibi, kullanım sayısına göre renk (3 kullanım turuncu, 4+ kırmızı), hızlı atama

### Canlı yarış
- Mutlak zamanlı geri sayım, stint takibi, pit board (tam ekran)
- **Pit işaretleme**: stint-indeksli seyrek kayıt — atlanan pit otomatik ilerler, kayma olmaz
- Sapma göstergesi (plan vs gerçek), tamir süresi girişi

### Takım ve veri
- Firebase ile çok kullanıcılı oda senkronizasyonu (oda kodu + PIN'li editör erişimi)
- **Google ile giriş** + admin onaylı erişim listesi; üye yönetimi paneli
- Saat dilimi doğru: mutlak epoch saklanır, her üye kendi yerelinde görür
- **LMU referans verisi** (Ohne Speed): 14 pist × 5 sınıf + araç bazlı tempo, seçime göre otomatik doldurma
- 21 pist krokisi, araç görselleri, sınıf rozetleri (WEC renk kodları)

### Çıktı ve arayüz
- PDF: stint tablosu (Start/Finish saatleri, servis çipleri), takım logosu, 2×2 bilgi kartları, pist krokisi
- Pilot süre dağılımı (donut) ve stint programı
- Katlanabilir sol panel, YouTube canlı yayın gömme, TR/EN dil desteği
- Telemetri (MoTeC CSV) içe aktarma
