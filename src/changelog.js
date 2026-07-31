/* ============================================================
   SÜRÜM NOTLARI — uygulama içi "ℹ Neler değişti" penceresi
   En yeni sürüm en üstte olacak şekilde ekle.
   APP_VERSION (App.jsx) buradaki ilk kaydın "v" alanıyla aynı olmalı.
   ============================================================ */
export const CHANGELOG = [
  {
    v: "v1.4.43",
    date: "2026-07-31",
    tr: [
      "🧹 İç yeniden düzenleme (davranış aynı): App.jsx bölme 6. tur — telemetri (MoTeC içe aktarma, %105 kuralı, stint analizi, kutu/çizgi grafik) useTelemetry hook dosyasına çıkarıldı; kullanılmayan ölü kod temizlendi. Kullanıcı arayüzü değişmedi",
    ],
    en: [
      "🧹 Internal refactor (same behavior): App.jsx split round 6 — telemetry (MoTeC import, 105% rule, stint analysis, box/line chart) moved into the useTelemetry hook file; dead code removed. No UI change",
    ],
  },
  {
    v: "v1.4.42",
    date: "2026-07-31",
    tr: [
      "🧹 İç yeniden düzenleme (davranış aynı): App.jsx bölme 5. tur — işbirlikçi yarış-durumu senkronizasyonu (debounce yazma + canlı dinleme, son yazan kazanır) useRaceSync hook dosyasına çıkarıldı. Kullanıcı arayüzü ve senkron davranışı değişmedi",
    ],
    en: [
      "🧹 Internal refactor (same behavior): App.jsx split round 5 — collaborative race-state sync (debounced write + live listen, last-writer-wins) moved into the useRaceSync hook file. No UI or sync behavior change",
    ],
  },
  {
    v: "v1.4.41",
    date: "2026-07-31",
    tr: [
      "🧹 İç yeniden düzenleme (davranış aynı): App.jsx bölme 4. tur — setup deposu (liste, yükleme, indirme, süzgeç) useSetups hook dosyasına çıkarıldı. Kullanıcı arayüzü değişmedi",
    ],
    en: [
      "🧹 Internal refactor (same behavior): App.jsx split round 4 — the setup library (list, upload, download, filter) moved into the useSetups hook file. No UI change",
    ],
  },
  {
    v: "v1.4.40",
    date: "2026-07-31",
    tr: [
      "🧹 İç yeniden düzenleme (davranış aynı hedefleniyor): App.jsx bölme 3. tur — sohbet mantığı (kanallar, okunmamış sayacı, bildirim sesi, okundu takibi) useChat hook dosyasına çıkarıldı. Kullanıcı arayüzü değişmedi",
    ],
    en: [
      "🧹 Internal refactor (behavior intended identical): App.jsx split round 3 — chat logic (channels, unread counter, notification sound, read tracking) moved into the useChat hook file. No UI change",
    ],
  },
  {
    v: "v1.4.39",
    date: "2026-07-31",
    tr: [
      "🧹 İç yeniden düzenleme (davranış aynı): App.jsx bölme 2. tur — takım/sezon/yarış abonelikleri (useTeams) kendi hook dosyasına çıkarıldı. Kullanıcı arayüzü değişmedi",
    ],
    en: [
      "🧹 Internal refactor (same behavior): App.jsx split round 2 — team/season/race subscriptions (useTeams) moved into their own hook file. No UI change",
    ],
  },
  {
    v: "v1.4.38",
    date: "2026-07-31",
    tr: [
      "🧹 İç yeniden düzenleme (davranış aynı): App.jsx büyük dosyası kademeli olarak parçalara ayrılıyor — bu turda canlı timing aboneliği + yakıt öğrenici (useLive), yüzen mini oynatıcı (useMiniPlayer) ve kimlik doğrulama (useAuth) kendi hook dosyalarına çıkarıldı. Kullanıcı arayüzü değişmedi",
    ],
    en: [
      "🧹 Internal refactor (same behavior): the large App.jsx is being split up incrementally — this round the live-timing subscription + fuel learner (useLive), the floating mini player (useMiniPlayer) and authentication (useAuth) moved into their own hook files. No UI change",
    ],
  },
  {
    v: "v1.4.37",
    date: "2026-07-31",
    tr: [
      "🔧 Canlı köprü güvenilirlik iyileştirmeleri (arayüz değişmez): köprü artık paylaşımlı bellek / LMU REST / araç sayısı / VE durumunu teşhis ediyor — arayüzde gösterilmez, sorun olursa köprü durum noktasının üstüne gelince (hover) ve tarayıcı konsolunda görünür",
      "🧪 Tek-yazıcı seçimi (aktif sürücü) mantığı ayrı bir modüle alınıp birim testleriyle korundu; canlı köprü yaşam döngüsü ayrı bir hook'a taşındı (iç iyileştirme, davranış aynı)",
    ],
    en: [
      "🔧 Live bridge reliability improvements (no UI change): the bridge now diagnoses shared memory / LMU REST / car count / VE status — hidden from the UI, surfaced on hovering the bridge status dot and in the browser console if something's wrong",
      "🧪 The single-writer (active-driver) election logic was moved to its own module and locked down with unit tests; the live bridge lifecycle moved into a dedicated hook (internal cleanup, same behavior)",
    ],
  },
  {
    v: "v1.4.36",
    date: "2026-07-31",
    tr: [
      "🛰 Canlı Timing artık aynı yarışta birden çok masaüstü köprüsünü (ör. ayrı PC'lerdeki co-sürücüler) tek kaynağa indiriyor: arabayı o an gerçekten süren PC canlıyı yazar, izleyen/bekleyen PC'ler 'Beklemede' durumuna geçer — veri artık iki köprü arasında çakışmaz",
      "🔄 Sürücü devri kesintisiz: A arabayı B'ye devredip oyunu kapattığında canlı kaynağı otomatik B'ye geçer (aktif sürücü öncelikli; kaynak birkaç saniyede el değiştirir). Canlı Köprü kartında 'Canlı kaynak' / 'Beklemede' göstergesi eklendi",
    ],
    en: [
      "🛰 Live Timing now funnels multiple desktop bridges in the same race (e.g. co-drivers on separate PCs) to a single source: the PC actually driving the car writes live, while watching/waiting PCs go to 'Standby' — data no longer clashes between two bridges",
      "🔄 Seamless driver handover: when A hands the car to B and closes the game, the live source automatically moves to B (active driver takes priority; the source changes hands within a few seconds). Added a 'Live source' / 'Standby' indicator on the Live Bridge card",
    ],
  },
  {
    v: "v1.4.35",
    date: "2026-07-31",
    tr: [
      "🌐 Canlı Timing sekmesinin İngilizce çevirisi tamamlandı: başlıklar, tablo sütunları (Saha, Konum, Aralık…), Kendi Araç, Pist Haritası, Pozisyon Grafiği, Strateji ve tüm ipuçları/tooltip'ler artık İngilizce. Seans fazı (Yeşil→Green, FCY…), seans tipi (Yarış→Race, Antrenman→Practice…) ve bağlantı durumu (gecikmeli→delayed…) etiketleri de çevrildi",
    ],
    en: [
      "🌐 Completed the English translation of the Live Timing tab: headers, table columns (Field, Location, Interval…), Own Car, Track Map, Position Chart, Strategy and all hints/tooltips are now in English. Session phase (Yeşil→Green, FCY…), session type (Yarış→Race, Antrenman→Practice…) and connection status (gecikmeli→delayed…) labels are translated too",
    ],
  },
  {
    v: "v1.4.34",
    date: "2026-07-31",
    tr: [
      "🎬 Canlı sekmesine 'Demo' düğmesi geri geldi: açınca arayüz sahte veriyle dolar (tablo, VE, sektör, logolar, trackmap, kendi araç, strateji) — oyun/köprü gerekmez, Firebase'e yazmaz (takım görmez). UI düzenlemek için; düğmeyle kapatınca gerçek veriye döner",
    ],
    en: [
      "🎬 The 'Demo' button is back on the Live tab: turn it on to fill the UI with fake data (table, VE, sectors, logos, track map, own car, strategy) — no game/bridge needed, doesn't write to Firebase (team won't see it). For editing the UI; toggle off to return to real data",
    ],
  },
  {
    v: "v1.4.33",
    date: "2026-07-31",
    tr: [
      "🏎 Kendi Araç kartında lastik verileri artık aracın üstten görselinin (cartop) etrafında 4 köşede gösteriliyor: sıcaklık · basınç · aşınma (renkli kutu). Gövdeye hasar tonu uygulanmıyor — araç görseli net görünür",
    ],
    en: [
      "🏎 Own Car card now shows tyre data at the four corners around the top-down car image: temperature · pressure · wear (colored box). No damage tint on the body — the car image shows cleanly",
    ],
  },
  {
    v: "v1.4.32",
    date: "2026-07-31",
    tr: [
      "🛣 Pist sıcaklığının yanına yol ikonu eklendi (hava sıcaklığındaki güneş gibi)",
    ],
    en: [
      "🛣 Added a road icon next to the track temperature (like the sun next to air temp)",
    ],
  },
  {
    v: "v1.4.31",
    date: "2026-07-30",
    tr: [
      "⏱ Tur listesi penceresinde (satır sonu '+') artık her tur için S1 / S2 / S3 sektör süreleri de gösteriliyor — köprü çalışırken tur-tur birikir",
    ],
    en: [
      "⏱ The lap-list window (row-end '+') now shows S1 / S2 / S3 sector times for each lap too — accumulated lap by lap while the bridge runs",
    ],
  },
  {
    v: "v1.4.30",
    date: "2026-07-30",
    tr: [
      "🔋 Kendi Araç kartında artık iki halka: VE (Sanal Enerji) büyük ve yeşil (yakıttan önemli), Yakıt sarı. 'NRG' adı her yerde 'VE' oldu",
    ],
    en: [
      "🔋 The Own Car card now has two rings: VE (Virtual Energy) large and green (more important than fuel), Fuel yellow. 'NRG' renamed to 'VE' everywhere",
    ],
  },
  {
    v: "v1.4.29",
    date: "2026-07-30",
    tr: [
      "🔋 Virtual Energy (NRG) artık dolu geliyor: köprü LMU canlı standings API'sinden (veFraction) her aracın VE'sini çekiyor",
      "🏁 Kendi aracının takım adı (ör. 'EYT TEAM GT3 #34') ve numarası da düzeltildi — custom livery katalogda olmadığı için eksikti; artık canlı standings'ten geliyor. Kendi araç marka logosu (911 → Porsche) da eklendi",
    ],
    en: [
      "🔋 Virtual Energy (NRG) now populates: the bridge reads each car's VE (veFraction) from LMU's live standings API",
      "🏁 Your own car's team name (e.g. 'EYT TEAM GT3 #34') and number are fixed too — they were missing because a custom livery isn't in the catalog; now they come from live standings. Own-car brand logo (911 → Porsche) added as well",
    ],
  },
  {
    v: "v1.4.28",
    date: "2026-07-30",
    tr: [
      "🏁 Takım adları düzeltildi: artık 'grup 13' yerine gerçek takım adı gösteriliyor. Marka logoları ve araç numarası (#34) da eklendi — hepsi LMU araç kataloğundan (getAllVehicles) çekilip canlı araçlarla eşleniyor",
      "ℹ️ Not: Virtual Energy (NRG) bu katalogda yok; canlı VE için ayrı bir çalışma sürüyor",
    ],
    en: [
      "🏁 Fixed team names: real team name now shows instead of 'group 13'. Brand logos and car number (#34) added too — all pulled from the LMU car catalog (getAllVehicles) and matched to live cars",
      "ℹ️ Note: Virtual Energy (NRG) isn't in this catalog; live VE is a separate work in progress",
    ],
  },
  {
    v: "v1.4.27",
    date: "2026-07-30",
    tr: [
      "🏭 Canlı Timing saha tablosunda araçların marka logoları (pilot adının yanında) — LMU araç modelinden türetilir",
      "👥 Pilot ↔ Takım geçişi: tablo başlığındaki 'Pilot' yazısına tıkla, sütun takım adına döner (LMU pit grubundan)",
      "🏁 Seans tipi başlıkta gösteriliyor (Antrenman / Sıralama / Yarış / Isınma)",
      "↔️ Pist Haritası ve Kendi Araç kartı artık yan yana (geniş ekranda); dar ekranda alt alta",
    ],
    en: [
      "🏭 Brand logos for cars in the Live Timing field table (next to the driver name) — derived from the LMU car model",
      "👥 Driver ↔ Team toggle: click 'Driver' in the table header to switch the column to team name (from the LMU pit group)",
      "🏁 Session type shown in the header (Practice / Qualifying / Race / Warmup)",
      "↔️ Track Map and Own Car card are now side by side (on wide screens); stacked on narrow screens",
    ],
  },
  {
    v: "v1.4.26",
    date: "2026-07-30",
    tr: [
      "🔋 Virtual Energy (NRG) eklendi: paylaşımlı bellekte olmadığı için köprü LMU'nun kendi yerel API'sinden (localhost:6397) çekiyor. Kendi Araç kartında ve saha tablosunda NRG % görünür (yüksek yeşil → düşük kırmızı). LMU'da API/eklentiler açık olmalı; kapalıysa '—' gösterir",
    ],
    en: [
      "🔋 Added Virtual Energy (NRG): since it isn't in shared memory, the bridge reads it from LMU's own local API (localhost:6397). NRG % shows on the Own Car card and the field table (green high → red low). LMU's API/plugins must be enabled; if off, it shows '—'",
    ],
  },
  {
    v: "v1.4.25",
    date: "2026-07-30",
    tr: [
      "⚡ Canlı köprü artık OTOMATİK: masaüstünde oyun açıkken kendiliğinden bağlanır, koparsa ~4 sn'de bir yeniden dener (oyun sonradan açılırsa da bağlanır). Elle 'Başlat/Durdur' ve 'Mock veri' butonu kaldırıldı — köprü kartı yalnız durumu gösterir",
      "🔇 Oyun/seans kapalıyken artık boş kare yazılmıyor (Firebase kotası korunur)",
    ],
    en: [
      "⚡ The live bridge is now AUTOMATIC: on desktop it connects by itself when the game is open and retries every ~4s if it drops (also connects if the game opens later). The manual 'Start/Stop' and 'Mock data' controls are removed — the bridge card only shows status",
      "🔇 No more empty frames written while the game/session is closed (saves Firebase usage)",
    ],
  },
  {
    v: "v1.4.24",
    date: "2026-07-30",
    tr: [
      "🗺 Pist Haritası daireleri büyütüldü ve içine sınıf-içi pozisyon numarası yazıldı — kim sınıfında kaçıncı bir bakışta okunur (renk = sınıf, beyaz halka = sen)",
    ],
    en: [
      "🗺 Track Map dots are bigger and now show the in-class position number inside — read each car's class position at a glance (color = class, white ring = you)",
    ],
  },
  {
    v: "v1.4.23",
    date: "2026-07-30",
    tr: [
      "🎯 Canlı Timing'e Strateji rozetleri eklendi (kendi araç için): Önünde/Arkanda (araç kodu + fark), Temiz hava (en yakın araca zaman), Trafik (±3s içinde kaç araç) ve Pit çıkışı tahmini (şimdi pit'e girersen ~hangi sıra). Pistine göre 'pit kaybı' (saniye) girilir, hatırlanır. Ek veri gerekmez, gap'lerden hesaplanır",
    ],
    en: [
      "🎯 Added Strategy chips to Live Timing (for your own car): Ahead/Behind (car code + gap), Clean air (time to nearest car), Traffic (how many cars within ±3s) and a Pit-exit estimate (what position you'd rejoin if you pit now). Enter your track's 'pit loss' (seconds), remembered. No extra data — computed from the gaps",
    ],
  },
  {
    v: "v1.4.22",
    date: "2026-07-30",
    tr: [
      "📈 Canlı Timing'e Pozisyon Grafiği eklendi: her aracın tur-tur pozisyonu çizgi grafiğinde (Y ekseni ters, P1 üstte), renk = sınıf, kalın #960018 = sen, 'P' = pit turu. Köprü çalışırken tur-tur birikir ve kalıcıdır (tüm takım aynı grafiği görür, geç açan da geçmişi görür)",
    ],
    en: [
      "📈 Added a Position Chart to Live Timing: each car's position lap by lap as a line chart (Y axis reversed, P1 on top), color = class, thick #960018 = you, 'P' = pit lap. It accumulates lap by lap while the bridge runs and is persistent (the whole team sees the same chart, latecomers see the history)",
    ],
  },
  {
    v: "v1.4.21",
    date: "2026-07-30",
    tr: [
      "🗺 Canlı Timing'e Pist Haritası eklendi: dış halka araçları pist üzerindeki konuma göre gösterir (S/F tepede), iç şekil gerçek devreyi çizer (araçların dünya konumlarından birkaç saniyede oluşur). Renk = sınıf, beyaz halka = sen, beyaz kenar = pit",
      "🔧 Köprü artık araç konumlarını (pist mesafesi + dünya koordinatları) ve pist uzunluğunu da gönderiyor",
    ],
    en: [
      "🗺 Added a Track Map to Live Timing: the outer ring shows cars by their position on track (S/F at top), the inner shape draws the real circuit (built from cars' world positions in a few seconds). Color = class, white ring = you, white edge = pit",
      "🔧 The bridge now also sends car positions (track distance + world coordinates) and track length",
    ],
  },
  {
    v: "v1.4.20",
    date: "2026-07-30",
    tr: [
      "🌡 Kendi Araç kartında lastik ısısı '-273°' ve basınç '0 KPA' hatası düzeltildi — oyun değeri doldurmadığında (garajda/pitte) artık '—' gösteriliyor; araç piste çıkınca gerçek ısı/basınç geliyor",
      "🎯 Kendi Araç yakıt/lastik/bileşim verisi artık oyuncunun aracıyla mID üzerinden kesin eşleşiyor (önceden nadiren lider aracın verisine düşebiliyordu)",
    ],
    en: [
      "🌡 Fixed tyre temperature showing '-273°' and pressure '0 KPA' on the Own Car card — when the game doesn't provide a value (in garage/pit) it now shows '—'; real temperature/pressure appears once the car is on track",
      "🎯 Own Car fuel/tyre/compound data is now matched to your own car precisely via mID (previously it could rarely fall back to the leader's car data)",
    ],
  },
  {
    v: "v1.4.19",
    date: "2026-07-30",
    tr: [
      "🐛 İngilizce dilde 'Neler değişti' penceresini açınca uygulamanın çökmesi düzeltildi — son sürümlerin İngilizce çevirisi eksikti; artık eksikse Türkçe metne düşüyor (çökme yok) ve tüm v1.4.x notlarının İngilizcesi de eklendi",
    ],
    en: [
      "🐛 Fixed the app crashing when opening the 'What's new' window in English — recent versions were missing their English translation; it now falls back to Turkish text if a translation is missing (no crash), and English was added for all v1.4.x notes",
    ],
  },
  {
    v: "v1.4.18",
    date: "2026-07-30",
    tr: [
      "🐛 Masaüstü köprü gerçek oyun modunda 'No module named pyRfactor2SharedMemory' hatası düzeltildi — paylaşımlı bellek okuyucu artık uygulamaya gömülü geliyor (eskiden derlemede güvenilmez şekilde kuruluyordu). Oyun açıkken Başlat artık gerçek veriyi okur",
    ],
    en: [
      "🐛 Fixed the desktop bridge crashing in real-game mode with 'No module named pyRfactor2SharedMemory' — the shared-memory reader is now bundled into the app (it used to be installed unreliably at build time). Start now reads real data with the game open",
    ],
  },
  {
    v: "v1.4.17",
    date: "2026-07-30",
    tr: [
      "🔒 Canlı Timing sekmesi şimdilik yalnız site adminlerine görünür (test aşaması) — tamamlanınca tüm takım üyelerine açılacak",
    ],
    en: [
      "🔒 The Live Timing tab is temporarily visible to site admins only (testing phase) — it will open to all team members once it's ready",
    ],
  },
  {
    v: "v1.4.16",
    date: "2026-07-30",
    tr: [
      "📈 Tur zaman listesi (satır sonu '+') artık tüm yarışı kapsıyor — 50 tur sınırı kalktı. Tur geçmişi canlı kareden ayrılıp kalıcı bir düğüme her tur bir kez yazılıyor; '+' açılınca yalnız o aracın tüm turları yükleniyor (300+ tur sorunsuz). Canlı kare küçük kaldığı için Firebase kotası da korunuyor",
    ],
    en: [
      "📈 The lap-time list (row-end '+') now covers the whole race — the 50-lap limit is gone. Lap history is split off the live frame into a persistent node, written once per lap; opening '+' loads only that car's full history (300+ laps is fine). The live frame stays small, so Firebase usage is preserved",
    ],
  },
  {
    v: "v1.4.15",
    date: "2026-07-30",
    tr: [
      "➕ Canlı Timing saha tablosunda her aracın satır sonuna '+' butonu — tıklayınca o aracın o ana kadar attığı tüm turların zaman listesi küçük bir pencerede açılır (en yeni üstte; en hızlı tur mor, out/pit turu soluk sarı, best'e göre fark)",
      "ℹ️ Not: liste köprü çalışmaya başladığından itibaren tamamlanan turları içerir (oyunun paylaşımlı belleği geçmiş turların tamamını vermez); köprü yeniden başlarsa liste sıfırlanır",
    ],
    en: [
      "➕ A '+' button at the end of every car's row in the Live Timing field table — click it to open that car's full lap-time list in a small window (newest on top; fastest lap purple, out/pit laps dim yellow, delta to best)",
      "ℹ️ Note: the list contains laps completed since the bridge started (the game's shared memory doesn't provide the full lap history retroactively); it resets if the bridge restarts",
    ],
  },
  {
    v: "v1.4.14",
    date: "2026-07-30",
    tr: [
      "⏱ Canlı Timing'e AVG 5 (son 5 turun ortalaması), AVG (genel tur ortalaması) ve Stint (mevcut stint süresi) eklendi — hem saha tablosunda hem Kendi Araç kartında",
      "🧮 Bu üç değer köprüde (oyunun PC'sinde) tur-tur biriktirilerek hesaplanır → tüm takım için tutarlı; web geç açılsa/yenilense de doğru gelir. Out-lap ve pit turları ortalamadan elenir; stint süresi pit çıkışında sıfırlanır",
    ],
    en: [
      "⏱ Added AVG 5 (average of the last 5 laps), AVG (overall lap average) and Stint (current stint duration) to Live Timing — in both the field table and the Own Car card",
      "🧮 These three are accumulated lap by lap in the bridge (on the game PC) → consistent for the whole team; correct even if the web opens late or reloads. Out-laps and pit laps are excluded from the averages; the stint timer resets on pit exit",
    ],
  },
  {
    v: "v1.4.13",
    date: "2026-07-30",
    tr: [
      "📋 Canlı Timing saha tablosuna yeni sütunlar: Δ (son−en iyi), Konum (TRACK/PIT/GARAGE), her araç için Lastik aşınması (renkli nokta + %) ve Hasar (%). Aralık artık oyunun kendi 'öndeki araca fark' değerini kullanıyor (mTimeBehindNext)",
      "🏎 Kendi Araç kartına Hasar (%) eklendi",
      "ℹ️ Not: DR/SR rating ve sanal enerji (NRG) oyunun paylaşımlı belleğinde yok, çekilemez",
    ],
    en: [
      "📋 New columns in the Live Timing field table: Δ (last−best), Location (TRACK/PIT/GARAGE), per-car Tyre wear (colored dot + %) and Damage (%). Interval now uses the game's own 'gap to car ahead' value (mTimeBehindNext)",
      "🏎 Added Damage (%) to the Own Car card",
      "ℹ️ Note: DR/SR rating and virtual energy (NRG) are not in the game's shared memory and can't be read",
    ],
  },
  {
    v: "v1.4.12",
    date: "2026-07-30",
    tr: [
      "🛞 Canlı Timing'e eksik veriler eklendi: kendi aracın lastik bileşimi (soft/medium/hard) ve pit durak sayısı; saha tablosunda her araç için pit durak sayısı ve pozisyon değişim okları (▲ yükseldi / ▼ düştü)",
      "🖥️ 'Büyük Pano' (tam ekran) modu — timing'i uzaktan okunur büyük yazıyla göster; pit duvarında takımın izlemesi için",
    ],
    en: [
      "🛞 Added missing data to Live Timing: your car's tyre compound (soft/medium/hard) and pit-stop count; per-car pit-stop count and position-change arrows (▲ gained / ▼ dropped) in the field table",
      "🖥️ 'Big Board' (fullscreen) mode — show the timing in large, readable type for the team to watch from the pit wall",
    ],
  },
  {
    v: "v1.4.11",
    date: "2026-07-30",
    tr: [
      "📊 Canlı Timing zenginleştirildi: sınıf-içi pozisyon (Pn, sarı = sınıf lideri), 'Kendi sınıfım' filtresi, öndeki araca 'Aralık' sütunu, tur-altı araçlar için '+n Tur', seansın en hızlı turu tek araçta mor vurgu ve satır sol kenarında sınıf renk şeridi",
      "🏎 Kendi Araç kartına: mevcut tur canlı sayacı + S1/S2 sektörleri, PIT rozeti ve mevcut yakıtla ~kaç tur kaldığı tahmini (canlıdan öğrenilen tüketimle)",
    ],
    en: [
      "📊 Live Timing enriched: in-class position (Pn, yellow = class leader), a 'My class' filter, an 'Interval' column to the car ahead, '+n Laps' for lapped cars, the session's fastest lap highlighted purple on a single car, and a class color stripe on the left edge of each row",
      "🏎 Own Car card: a live current-lap timer + S1/S2 sectors, a PIT badge, and an estimate of how many laps the current fuel lasts (using consumption learned live)",
    ],
  },
  {
    v: "v1.4.10",
    date: "2026-07-30",
    tr: [
      "🏷 Canlı Timing sınıf sütununda artık uygulamanın kendi renkli rozet vektörleri (HY / P2 / P3 / GTE / GT3) kullanılıyor — pist/araç seçim ekranıyla birebir aynı görsel dil",
    ],
    en: [
      "🏷 The class column in Live Timing now uses the app's own colored badge vectors (HY / P2 / P3 / GTE / GT3) — the exact same visual language as the track/car picker",
    ],
  },
  {
    v: "v1.4.9",
    date: "2026-07-30",
    tr: [
      "🎨 Canlı Timing tablosunda sınıf (SINIF) çipleri artık kategoriye göre renkli: Hypercar kırmızı, LMP2 mavi, LMP3 mor, GTE amber, LMGT3/GT3 yeşil — sahayı sınıflara göre tek bakışta ayırt edersin",
    ],
    en: [
      "🎨 Class (SINIF) chips in the Live Timing table are now colored by category: Hypercar red, LMP2 blue, LMP3 purple, GTE amber, LMGT3/GT3 green — tell the field apart by class at a glance",
    ],
  },
  {
    v: "v1.4.8",
    date: "2026-07-30",
    tr: [
      "🈶 Masaüstünde 'Canlı Köprü' UTF-8 hatası düzeltildi (invalid utf-8 sequence) — köprü çıktısı Windows Türkçe kodlaması yüzünden bozuluyordu, artık UTF-8'e zorlanıyor. Mock test ve gerçek canlı köprü sorunsuz başlıyor",
    ],
    en: [
      "🈶 Fixed the 'Live Bridge' UTF-8 error on desktop (invalid utf-8 sequence) — the bridge output was being corrupted by the Windows Turkish encoding; it's now forced to UTF-8. Mock testing and the real live bridge start cleanly",
    ],
  },
  {
    v: "v1.4.7",
    date: "2026-07-30",
    tr: [
      "🛠 Masaüstünde 'Canlı Köprü Başlat' hatası düzeltildi (Command plugin:shell|spawn not allowed by ACL) — köprü izni eksikti, eklendi. Artık mock test ve gerçek canlı köprü başlıyor",
    ],
    en: [
      "🛠 Fixed the 'Start Live Bridge' error on desktop (Command plugin:shell|spawn not allowed by ACL) — a missing bridge permission was added. Mock testing and the real live bridge now start",
    ],
  },
  {
    v: "v1.4.6",
    date: "2026-07-30",
    tr: [
      "🧹 Ayrı 'Canlı Timing Köprüsü (.exe)' indirme butonu kaldırıldı — canlı timing artık Masaüstü Uygulamasının içinde. Canlı sekmesi ve lobi, oyunun PC'sine Masaüstü Uygulamasını kurup 'Canlı Köprü Başlat' demeye yönlendiriyor (config.ini / bot hesabı gerekmez)",
    ],
    en: [
      "🧹 Removed the separate 'Live Timing Bridge (.exe)' download button — live timing is now built into the Desktop App. The Live tab and lobby point you to install the Desktop App on the game PC and press 'Start Live Bridge' (no config.ini / bot account needed)",
    ],
  },
  {
    v: "v1.4.5",
    date: "2026-07-30",
    tr: [
      "🖥️ Masaüstü uygulaması artık kapatınca tamamen kapanmıyor: pencereyi (X) kapatınca Windows sistem tepsisine (saatin yanı) küçülüp arka planda çalışmaya devam ediyor — yanlışlıkla kapatıp canlı köprünün veri akışını kesme riski yok. Tepsi ikonuna tıklayınca geri gelir; gerçekten kapatmak için ikona sağ tık → 'Çıkış'. Ayrıca menüde 'Windows açılışında başlat' seçeneği (isteğe bağlı, varsayılan kapalı)",
    ],
    en: [
      "🖥️ The desktop app no longer quits when you close it: closing the window (X) minimizes it to the Windows system tray (by the clock) and it keeps running in the background — no risk of accidentally cutting the live bridge's data stream. Click the tray icon to bring it back; to really quit, right-click the icon → 'Exit'. There's also a 'Start on Windows login' option in the menu (optional, off by default)",
    ],
  },
  {
    v: "v1.4.4",
    date: "2026-07-30",
    tr: [
      "🛰 Canlı köprü artık masaüstü uygulamasının içinde: oyunun olduğu PC'de uygulamayı aç, giriş yap, yarışı aç, 'Canlı' sekmesinden tek tuşla 'Canlı Köprü Başlat'. Ayrı .exe indirmeye, bot hesabına ve izin listesine (bridgeBots) GEREK YOK — veri senin oturumunla yazılır. Takımın geri kalanı web/masaüstünden canlı timing'i anında görür",
    ],
    en: [
      "🛰 The live bridge is now inside the desktop app: on the game PC open the app, sign in, open the race, and press 'Start Live Bridge' from the 'Live' tab. No separate .exe download, bot account or allow-list (bridgeBots) needed — data is written under your own session. The rest of the team sees live timing instantly from web/desktop",
    ],
  },
  {
    v: "v1.4.3",
    date: "2026-07-30",
    tr: [
      "🖥️ Masaüstü uygulaması Google girişi tamamen yenilendi: giriş artık uygulamanın içinde değil, senin VARSAYILAN sistem tarayıcında açılıyor; onayladıktan sonra otomatik olarak uygulamaya dönüyor (güvenli loopback + PKCE). Gömülü tarayıcı popup/redirect'i engellediği için giriş başa dönüyordu, bu sorun giderildi",
    ],
    en: [
      "🖥️ Google sign-in on the desktop app was reworked: sign-in now opens in your DEFAULT system browser rather than inside the app, and returns to the app automatically after you approve (secure loopback + PKCE). The embedded browser was blocking the popup/redirect and bouncing sign-in back to the start — now fixed",
    ],
  },
  {
    v: "v1.4.1",
    date: "2026-07-30",
    tr: [
      "🖥️ Masaüstü uygulaması: Google ile giriş artık açılır pencere (popup) yerine yönlendirme (redirect) ile yapılıyor — WebView2 popup'ı engellediği için giriş açılmıyordu, düzeltildi",
    ],
    en: [
      "🖥️ Desktop app: Google sign-in now uses a redirect instead of a popup — WebView2 was blocking the popup so sign-in wouldn't open; fixed",
    ],
  },
  {
    v: "v1.4",
    date: "2026-07-25",
    tr: [
      "🎓 İnteraktif rehber: ilk girişte kendiliğinden açılır, sekmeleri senin için açıp her bölümü tek tek anlatır (lobi 5, pit wall 20 adım). Lobide ve header'da Rehber düğmesi",
      "💬 Sohbete bildirim sesi — klasik MSN mesaj tınısı; 🔔/🔕 ile aç-kapa, tercih hatırlanır",
      "📺 Canlı yayın köşede yüzen mini oynatıcıya taşındı: dört köşeye taşınır, tutamaçla 240–1080px boyutlandırılır, küçültünce ses akmaya devam eder, sekme değişse de kesilmez",
      "📋 Stint tablosuna stint başına 'Ort. Tur' sütunu — değer girilirse o stint o tempoyla hesaplanır, hava çarpanı süreye uygulanmaz (yakıtta korunur)",
      "🛞 Tek lastik seçenekleri (FL/FR/RL/RR) — S1 start şeridinde ve pit hızlı atama menüsünde",
      "📈 Telemetride %105 kuralı: en iyi turun %105'ini aşan turlar otomatik hariç tutulur; kartta sınır ve hariç sayısı görünür, %105 düğmesiyle yeniden uygulanır",
      "Lobide yarışlar şampiyonaya göre gruplu, sezon süzgeci ve takım başlığı eklendi",
      "Takım adı sonradan değiştirilebilir (Takımı Yönet → Takım Adı); üyelerde otomatik güncellenir",
      "Rehber üst çubuğu da tanıtır: takım/sohbet düğmeleri ve rozetlerin yetki anlamları",
      "EN dilinde büyük İ sorunu giderildi (STİNT → STINT) — belge dili arayüz diline bağlandı",
      "Sekmelere ikonlar; üst çubuktan rol rozetleri kaldırıldı (yetki profil rozetlerinden belli)",
      "Adminler birbirinin erişim iznini kaldıramaz; admin satırları 'korumalı' işaretli",
    ],
    en: [
      "🎓 Interactive guide: opens on first visit, switches tabs for you and explains every section (5 lobby + 20 pit-wall steps). Guide button in the lobby and header",
      "💬 Chat notification sound — the classic MSN message tone; toggle with 🔔/🔕, preference remembered",
      "📺 Live stream moved to a floating mini player: dockable to any corner, resizable 240–1080px via the grip, keeps playing when minimised or when you switch tabs",
      "📋 Per-stint 'Avg Lap' column in the stint table — enter a value and that stint uses that pace; no weather multiplier on time (kept for fuel)",
      "🛞 Single-tyre options (FL/FR/RL/RR) on the S1 start strip and the pit quick-assign menu",
      "📈 105% rule in telemetry: laps slower than 105% of the best are auto-excluded; the card shows the limit and count, re-apply with the %105 button",
      "Lobby races grouped by championship, with a season filter and a team header",
      "Team names can be renamed (Manage Team → Team Name); members update automatically",
      "The guide also covers the top bar: team/chat buttons and what each badge permits",
      "Fixed the Turkish capital-İ leak in English (STİNT → STINT) — document language now follows the UI language",
      "Icons on every tab; role chips removed from the top bar (badges on your profile show permissions)",
      "Admins can no longer revoke each other's access; admin rows are marked protected",
    ],
  },
  {
    v: "v1.3",
    date: "2026-07-25",
    tr: [
      "Takım sohbeti: 🌍 Genel ve 🏢 Takım kanalları üst çubuktaki 💬 düğmesinde, 🏁 Yarış Sohbeti kendi sekmesinde — her yarışın arşivi ayrı",
      "Okunmamış mesaj sayacı kanal bazında; sekmede ve düğmede rozet olarak görünür",
      "Rozetler artık yetkiyi belirliyor: 🎧 Yarış Mühendisi datayı değiştirir, 🛞 Sürücü yalnızca görür, 👑 Takım Sahibi yetkileri yönetir",
      "Sürücü rozeti direksiyon simgesi, mühendis rozeti kulaklık oldu",
      "Admin de rozet atayabiliyor; üyeler UID yerine isimleriyle listeleniyor",
      "Adminler birbirinin erişim iznini kaldıramaz",
      "Telemetri ham MoTeC kanal log'unu ve Channel Report'u okuyor — tırnaklı CSV, saniye cinsinden tur süresi, litre→VE dönüşümü",
      "Kutu grafiği (box plot): çeyrekler, medyan, bıyıklar ve aykırı turlar; tur tur çizgi grafiğine geçiş düğmesi",
      "Medyan birincil istatistik oldu — tek yavaş tur planı bozmuyor, DATA'ya medyan uygulanıyor",
      "Lobide yarışlar şampiyonaya göre gruplanıyor, sezon süzgeci ve takım başlığı eklendi",
      "Takım adı sonradan değiştirilebiliyor",
      "Sekmelerin hepsinde ikon; üst çubuktaki rol rozetleri kaldırıldı",
    ],
    en: [
      "Team chat: 🌍 General and 🏢 Team channels behind the 💬 button, 🏁 Race Chat in its own tab — each race keeps its own history",
      "Unread counters per channel, shown as badges on the tab and the button",
      "Badges now set permissions: 🎧 Race Engineer edits data, 🛞 Driver only views, 👑 Team Owner manages permissions",
      "Driver badge is now a steering wheel, engineer badge a headset",
      "Admins can assign badges too; members are listed by name instead of UID",
      "Admins can no longer revoke each other's access",
      "Telemetry reads raw MoTeC channel logs and Channel Reports — quoted CSV, lap times in seconds, litres converted to VE",
      "Box plot: quartiles, median, whiskers and outliers, with a toggle back to the per-lap line chart",
      "Median is now the primary statistic — one slow lap no longer skews the plan, and Apply to DATA uses it",
      "Races in the lobby are grouped by championship, with a season filter and a team header",
      "Team names can be changed after creation",
      "Icons on every tab; role chips removed from the top bar",
    ],
  },
  {
    v: "v1.2",
    date: "2026-07-25",
    tr: [
      "Pilot atama menüsüne takım üyeleri eklendi — kadro ve takım ayrı gruplarda, takımdan seçilen isim otomatik kadroya girer",
      "Pilot kadrosunun altına “Takımdan ekle” hızlı butonları",
      "PDF başlığı artık sorulmuyor: sezon · round · yarış adı otomatik yazılıyor, belge tipi alt satıra taşındı",
      "İngilizce dilde Türkçe kalan 64 metin çevrildi (takım, sezon, takvim, profil ve kayıt ekranları)",
      "Rol rozeti, pit etiketleri ve zaman çizelgesi açıklamaları da dile duyarlı hale geldi",
      "Yarış açılırken oluşan çökme giderildi (eski oda değişkenlerinden kalan referanslar)",
    ],
    en: [
      "Team members now appear in the driver assignment menu — roster and team in separate groups, picking a team member adds them to the roster automatically",
      "“Add from team” quick buttons under the driver roster",
      "PDF no longer asks for a title: season · round · race name is filled in automatically, document type moved to the sub-line",
      "64 strings that stayed Turkish in English mode are now translated (team, season, calendar, profile and sign-up screens)",
      "Role badges, pit labels and timeline descriptions are language-aware too",
      "Fixed the crash when opening a race (leftover references from the old room system)",
    ],
  },
  {
    v: "v1.1",
    date: "2026-07-24",
    tr: [
      "Takım sistemi: takım kur veya katılım koduyla katıl, üye rolleri (sahip / düzenleyici / izleyici)",
      "Oda kodu ve PIN kaldırıldı — erişim artık takım üyeliğinden geliyor",
      "Sezonlar ve yarış takvimi: yarışı önceden pist, araç, süre ve başlangıç saatiyle hazırla",
      "Lobi yaklaşan yarışları listeliyor, tek tıkla açılıyor — pist/araç seçimi tekrar sorulmuyor",
      "Rozetler: 👑 Takım Sahibi, 🏎 Sürücü, 🎧 Yarış Mühendisi — bir üyeye birden fazla rozet atanabilir",
      "Kayıtta Ad Soyad soruluyor; isim profilden değiştirilebiliyor ve stint programında görünüyor",
    ],
    en: [
      "Team system: create a team or join with a code, with member roles (owner / editor / viewer)",
      "Room codes and PINs removed — access now comes from team membership",
      "Seasons and a race calendar: set up a race in advance with track, car, duration and start time",
      "The lobby lists upcoming races and opens them in one click — no more re-picking track and car",
      "Badges: 👑 Team Owner, 🏎 Driver, 🎧 Race Engineer — a member can hold several at once",
      "Full name is asked at sign-up, can be changed from the profile, and shows in the stint schedule",
    ],
  },
  {
    v: "v1.0",
    date: "2026-07-23",
    tr: [
      "İlk kararlı sürüm — Le Mans Ultimate endurance yarışları için pit wall aracı",
      "Virtual Energy modeli: depo daima %100 VE, gerçek yakıt orandan türetilir",
      "Son Stint Hesaplayıcı ve multiclass lider bitiş modeli (bayrak liderde)",
      "Hava durumu: Dry / Damp / Slightly Wet / Wet, kronolojik log ve planlı geçişler",
      "Beş durumlu lastik yönetimi, lastik limiti takibi, wet lastikler limit dışı",
      "Canlı pit board, pit işaretleme ve plan-gerçek sapma göstergesi",
      "LMU referans verisi (Ohne Speed): 21 pist krokisi, araç görselleri, otomatik tempo",
      "PDF çıktısı: stint tablosu, servis çipleri, pilot dağılımı ve pist krokisi",
      "Google ile giriş + admin onaylı erişim listesi",
    ],
    en: [
      "First stable release — a pit wall tool for Le Mans Ultimate endurance racing",
      "Virtual Energy model: the tank is always 100% VE, real fuel is derived from a ratio",
      "Last Stint Calculator and the multiclass leader-flag finish model",
      "Weather: Dry / Damp / Slightly Wet / Wet, with a chronological log and planned transitions",
      "Five-state tyre management, tyre limit tracking, wet tyres exempt from the limit",
      "Live pit board, pit marking and a plan-vs-actual delta indicator",
      "LMU reference data (Ohne Speed): 21 track maps, car artwork, automatic pace fill",
      "PDF output: stint table, service chips, driver distribution and track map",
      "Google sign-in with an admin-approved access list",
    ],
  },
];
