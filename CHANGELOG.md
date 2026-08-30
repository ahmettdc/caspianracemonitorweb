# Changelog

## v2.2.4 — 2026-08-30

Eksik giderme.

### Telemetri: pist haritası kaydolmuyordu (grafikler kaydoluyordu)

- **Belirti:** v2.2.3 telemetri izlerini kalıcı hale getirdi; bir stint kaydedince gaz/fren/hız grafikleri yarışı kapatıp açınca geri geliyordu. Ancak **pist haritası** geri gelmiyordu — aynı stintin izinde harita boş kalıyordu. "Grafik kaydoldu ama harita kaydolmadı."
- **Kök neden:** Harita ve grafikler AYNI iz nesnesinde taşınıyor ve `traceCodec.packTrace` ile Firebase'e birlikte yazılıyor. Ama `.duckdb`/LMU haritası gerçek **GPS**'ten geliyor (`mapSrc:"gps"`): `x = boylam·cos(enlem)`, `y = enlem` → değerler ~0.15 ve ~47.95 gibi, hassasiyeti ondalıkta olan küçük sayılar. `packTrace` her kanalı `Math.round(v·scale)` ile kodluyordu ve `x`/`y` için `scale = 1` idi → 47.9500 → 48, 47.9512 → 48… turun **tüm** noktaları tek bir tam sayıya çöküyordu, dolayısıyla `hasMap` çizilebilir bir şekil bulamıyordu. Grafik kanalları (hız 0–300, gaz/fren 0–100) büyük tamsayı olduğu için yuvarlamadan etkilenmiyordu — bu yüzden yalnız harita kayboluyordu.
- **Çözüm (`src/traceCodec.js`, format v2):** `x`/`y` artık sabit `scale=1` yerine, turun kendi yayılımından türeyen **ortak** bir `mapK` ile ~1e5 tamsayı çözünürlüğüne ölçekleniyor (`x` ve `y` aynı ölçek → en-boy korunur), origin çıkarılıyor; `mapK/x0/y0` başlıkta saklanıyor. UI zaten fit-to-box normalize ettiği için mutlak konum değil yalnız şekil önemli, o da kayıpsıza yakın korunuyor (Le Mans için round-trip hatası ~0.03 m). Eski v1 stringleri (metre koordinatlı) hâlâ okunuyor; GPS'li stint yeniden kaydedilince v2 ile düzeliyor.
- **Doğrulama:** Yeni GPS regresyon testleri + 559 testin tümü geçiyor; gerçekçi Le Mans GPS turu paketlenmiş boyut 10.8 KB (< 40 KB Firebase yaprak sınırı), 300 noktanın 300'ü ayrışık.

### Telemetri: tasarım fişi (tele-paketi, 28 Ağu 2026) uyumu

Handoff paketi `handoff-spec/tele-paketi` (TELE-FİŞİ + tokens.css + referans görseller) uygulandı. Tüm tokenlar projede zaten tanımlıydı; ekran da bu tasarım sisteminden türemişti — bu yüzden iş, fişin **EK** bölümündeki farklara ve gözden kaçmış uyumsuzluklara odaklandı.

- **§İK — kategori ikonları.** Setup kategorilerinde kalan emojiler kaldırıldı: `elec` 💡 → `kontrol`, `engine` 🛢 → `anahtar`. Ayrıca fişteki eşlemeye göre **ters düşmüş** iki ikon düzeltildi: `susp` `ayar`→`mekanik`, `diff` `mekanik`→`ayar`. (`other` fişte yok → nötr madde imi korundu.)
- **§BS — "Bu seansın setup'ı" butonu (YENİ).** Seans kutusunda, seans satırlarının altına / alt aksiyon barının üstüne tam genişlikte buton. Fiş bunun için ayrı bir modal (`svOpen`) öngörüyordu; bu uygulamada setup içeriği zaten **sayfa-içi bir kart** (`SessionSetupBox`) olduğundan modal uydurmak yerine mevcut kart hedeflendi: `openSignal` sayacı kartı Detay'a açıp görünüme kaydırır. Dibe yaslama rolü (`margin-top:auto`) butona geçti, alt bar `12px` oldu — fişteki düzenin karşılığı.
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

**Doğrulama:** yeni `teleTab.render.test.jsx` (4 test) fişin görsel sözleşmesini kilitliyor — slot kartı görselleri, §BS butonunun koşullu görünürlüğü ve konumu, kroma tokenları (eski mavi-gri palet artık yok), boş durumda `.ld`/CSV metni geçmemesi. 572 testin tümü geçiyor.

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
