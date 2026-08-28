# Changelog

## v2.2.2 — 2026-08-28

Hotfix.

### Race data: kayıtlı avgLap/consumption LMU temposuna dönüyordu (ASIL KÖK NEDEN)
- **Belirti:** Yarış sırasında sağ panelden değiştirilen race data (`avgLap`, `consumption`) yarış yeniden açılınca eski/LMU değerine "geri dönüyordu".
- **Kök neden:** `App.jsx`'teki "pist/araç seçimi değişince LMU referans temposunu varsayılan yaz" efekti (`lmuPrevSel` + `up({avgLap, consumption})`). `openRace` bir yarışı yüklerken `st.track`/`carClass`/`car`'ı boş→gerçek değiştirdiği için efekt bunu KULLANICI SEÇİMİ sanıp `lmuSuggest.avgLap`/`consumption`'ı KAYITLI değerin üzerine yazıyor, ardından push edip sunucuyu da bozuyordu. "İlk yüklemede ezmez" koruması yalnız ilk mount'u atlıyordu, `openRace` yüklemesini değil. (Kalıcılık/yazım sağlamdı; teşhis yaz/oku round-trip'i ile doğrulandı.)
- **Çözüm:** `openRace` yüklenen yarışın pist/araç imzasını `lmuPrevSel.current`'a SENKRON yazar (efekt çalışmadan önce) → efekt bunu "değişiklik değil" görüp atlar; kayıtlı `avgLap`/`consumption` korunur. Kurulumda (pick) pist/araç seçince LMU varsayılanını yazma davranışı aynen korunur. (`App.jsx openRace` + `lmuPrevSel` efekti)

### Kalıcılık sağlamlaştırma (yardımcı — ani kapanmaya karşı)
- Yukarıdaki asıl kök neden yanlış teşhisle önce kalıcılık sanılmıştı; o araştırmadan gelen ve zararsız kalan iki iyileştirme korundu: (1) **Kapanışta flush** — `visibilitychange`(hidden)/`pagehide`'da bekleyen 800 ms debounce'lu yazım hemen gönderilir. (2) **Cihaz-yerel ayna** — `st` her düzenlemede rev/dirty damgasıyla `localStorage`'a yazılır; `openRace` yalnız ayna `dirty` VE `mirror.rev === remote.rev` ise güvenle geri yükler (rev eşleşmesi ekip verisini ezmez). (`storage.js`, `useRaceSync.js`, `App.jsx openRace`; test: `raceStateMirror.test.js`)

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
