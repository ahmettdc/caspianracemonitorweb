repo: ahmettdc/caspianracemonitorweb
branch: main

## Last sync
date: 2026-08-16T05:28:00Z
tree: 140802896a76
upstream version: v1.8.20 (package.json 1.8.20 · changelog v1.8.20)

### Updated in this project
- Canlı Timing saha tablosunda "Poz · Sınıf" başlığı artık kendi sınıfım süzgeci (upstream v1.8.19): tıklanınca yalnız GT3 satırları kalır, başlık teal olur — sınıf çipleri olduğu gibi kaldı
- Upstream v1.8.20 karşılaştırıldı: Gap↔Aralık, Son↔En İyi, AVG5↔AVG birleşik sütunları ve Δ sütununun kalkması projede zaten uygulanmış
- Yakıt sekmesi src/tabs/FuelTab.jsx'ten kuruldu (yarış sonu geri sayımı, 📋 Plan otomatiği, gereken VE/litre, canlıdan öğren, senaryolar)
- İzleyici modu: sidebar'dan rol geçişi, düzenleme alanları ve aksiyonlar pasifleşiyor
- Her bölüme kısa rehber kutusu (12 ekran)
- Takım sekmesi sidebar'da Dash'in üstüne alındı
- Setup içeriği penceresi src/setupParse.js (SUMMARY_MAP, SETUP_CATS, categorizeSetup) yapısına göre kuruldu: künye şeridi, öne çıkanlar, kategori çipleri, ön·arka birleşik satırlar
- Setup yükle penceresi (SetupForm) + pilot alanı
- Setup yükle penceresi src/components.jsx (SetupForm) temel alınarak kuruldu: sürükle-bırak + dosya seçici, bayraklı pist grid'i, canlı pist/araç önizlemesi, koşul ve seans segmentleri, sınıf/araç, şampiyona · sürüm · tur zamanı · not, dosyadan otomatik algılama bildirimi
- Telemetri sekmesi src/tabs/TeleTab.jsx'ten baştan kuruldu: çözümlenen tur tablosu + sütun eşleme, %105 filtresi, seans kutusu; Tur Karşılaştırma (A/B seçimi, Δ rozeti, oynatma 0.5/1/2×, imleç değer paneli, mini pist haritası + ⛶ büyüt, 7 kanal izi, sektör tablosu, viraj analizi, PDF)
- Pilotlar sekmesi src/tabs/DriversTab.jsx'ten yeniden kuruldu: pilot kartları (PIE_COLORS + süre/stint/%), tıklamalı stint programı (select yerine pilot çipleri), donut + lejant, kadro yönetimi ve takım havuzu
- Lastik hücre renkleri styles.js .t2/.tq/.t3/.t4/.tw/.terr ile eşitlendi (2× #F2C94C, qual #6694FF, 3× #E8842A, 4×+ #DC2626, wet #7FE3A0, ihlal #F0604D + kalın çerçeve)
- Lastik sekmesi src/tabs/TyreTab.jsx'ten yeniden kuruldu: limit stepper + kullanılan/kalan/stint KPI'ları, set envanteri, köşe matrisi (tıkla-döngü), satır bazlı hızlı atama, kullanım renk lejantı, köşe kilidi ihlali uyarısı
- public/assets/cartop/default.png projeye kopyalandı; kendi araç kartı üstten görünüm + dört köşe lastik verisine geçti (changelog.js:1854 deseni)
- Lastik köşeleri: aşınma % (renk eşikli), iç sıcaklık, basınç kPa — birim başlıkta, değerler tek satır
- Zemin göstergesine ham ıslaklık yüzdesi; pist koşulları sırası bayrak/sıcaklık/hava/zemin/tutuş
- Tüm pencerelere açılma animasyonu (fade + pop)
- Kendi araç kartına dört köşe lastik verisi eklendi (aşınma % · iç sıcaklık · basınç), liveDemo.js own.tyres şemasına göre — araç görselinin çevresinde
- Zemin göstergesine ham ıslaklık yüzdesi eklendi; pist koşulları sırası bayrak/sıcaklık/hava/zemin/tutuş
- Tüm pencerelere açılma animasyonu (fade + pop) eklendi
- Pist koşulları Saha başlığına tek satır olarak taşındı; engine.js RAIN_LEVELS'a göre yağış göstergesi eklendi (zeminden ayrı)
- TrackMap eksikleri tamamlandı: PIT IN / PIT OUT çizgileri, hareket yönü oku, iç şekilde sektör ayırıcıları, durum rozetleri
- Pist haritası src/tabs/TrackMap.jsx'ten yeniden kuruldu: dış konum halkası (S/F tepede), iç devre şekli, sınıf renkli noktalar, oyuncu beyaz/#960018 halka, S1/S2 ayırıcıları, pit giriş işareti, ⛶ Büyüt penceresi
- Harita sağ panelin en üstüne alındı; lejant (sınıflar · Sen · Pit giriş) eklendi
- Canlı Timing'e pozisyon grafiği, rakip karşılaştırma ve veri-yok boş durumu eklendi
- Saha tablosu sütunları yeniden sıralandı (Poz/Pilot/Tur/Gap/Son Tur/Sektör/AVG5/Enerji/VE-tur/Lastik/Stint/Hasar/Incident/Pit)

## Screen map
| Ekran | Kaynak dosyalar |
| --- | --- |
| Mevcut Ana Menü | src/App.jsx (1658-1890 lobi + RaceRow), src/styles.js (.lobby, .mm*, .lrace) |
| Mevcut Arayüz — kabuk | src/App.jsx (1313-1432, 2196-2660), src/styles.js, src/components.jsx (Icon, Btn, Ring) |
| Mevcut Arayüz — Canlı Timing | src/tabs/LiveTab.jsx, src/tabs/StrategyBar.jsx, src/GripIcon.jsx, src/WetIcon.jsx, src/constants.js (CLASS_ACCENT) |
| Mevcut Arayüz — Setup Havuzu | src/App.jsx (2660-2760), src/components.jsx (SetupTable, SetupCards) |
| Mevcut Arayüz — Takım Yönetimi | src/components.jsx (TeamModal 1670-1940) |
| Yeni Tasarım — Ana Menü | src/App.jsx lobi, src/components.jsx (CreateJoinModal 1552-1612) |
| Yeni Tasarım — Dashboard | src/tabs/DashTab.jsx (KPI, stint programı, lastik, VE, pilot dağılımı, lightbox + LMU tempo tablosu) |
| Yeni Tasarım — Canlı Timing / Standings | src/tabs/LiveTab.jsx (saha tablosu, gap/interval, son/en iyi, AVG/AVG5, VE, VE/tur, lastik, ceza, tur geçmişi) |
| Yeni Tasarım — Telemetri | src/tabs/TeleTab.jsx (TraceCompareCard, TraceRow, TrackMini, slotStats, mapping), src/corners.js, src/ldTrace.js, src/constants.js (SLOT_COLORS) |
| Yeni Tasarım — Pilotlar | src/tabs/DriversTab.jsx (driverPlan.totals, stintsOf, drvsched, Donut/drvlegend), src/constants.js (PIE_COLORS) |
| Yeni Tasarım — Lastik stratejisi | src/tabs/TyreTab.jsx (tyreInfo/cellCls/allowedIn/carriedAt, quickTyre, conflicts) |
| Yeni Tasarım — Pist haritası | src/tabs/TrackMap.jsx (dış halka + iç şekil, dot/sectorMark/pitMark, ⛶ Büyüt) |
| Yeni Tasarım — Köprü durumu (canlı çipi) | src/tabs/LiveTab.jsx (477-533 Canlı Köprü kartı, 753-773 kayıt/bridgeVer satırları) |
| Yeni Tasarım — Pit Board | src/App.jsx (2422-2513 pitboard overlay), src/styles.js (.pitboard) |
| Yeni Tasarım — Stint planı | src/tabs/StintTab.jsx (KPI, S1 lastikleri, timeline + pilot/hava şeridi, plan tablosu, 🔧 tamir) |
| Yeni Tasarım — Pist & Araç seçimi | src/App.jsx (1937-2010 pick ekranı), src/constants.js (TRACKS, CAR_CLASSES, CARS, PIT_LANE_TIMES) |
| Yeni Tasarım — Yarış Dataları + Hava geçişi | src/App.jsx (1313-1432 dataCards, weatherLog/WEATHER) |
| Yeni Tasarım — Neler değişti | src/components.jsx (VersionModal 907-960), src/changelog.js |
| Yeni Tasarım — Profil / Bildirimler | src/components.jsx (ProfileModal, TeamModal rol rozetleri) |
| Yeni Tasarım — Resmi Yarışlar | src/tabs/ScheduleTab.jsx, src/lmuSchedule.js (veri modeli) |
| Yeni Tasarım — Sohbet | src/components.jsx (ChatModal 1076-1165) |
| Yeni Tasarım — Telemetri | src/tabs/TeleTab.jsx, src/constants.js (SLOT_COLORS) |
| Yeni Tasarım — Setup / Takım | src/components.jsx (SetupTable, TeamModal) |

## Sync history
### 2026-08-15T21:26:31Z
- Yakıt sekmesi, izleyici modu, rehber kutuları, Setup pencereleri, Telemetri ve Pilotlar sekmeleri kaynak dosyalardan kuruldu

### 2026-08-15T18:04:40Z
- Upstream'de değişiklik yok (main...main boş); src/constants.js değerleri projeyle aynı

### 2026-08-15T18:00:12Z
- Upstream'de değişiklik yok — izlenen kaynak dosyalar son senkronla aynı
- StintTab ve Standings sütunları karşılaştırıldı: proje güncel

### 2026-08-15T17:40:15Z
- "Neler değişti" penceresi src/changelog.js'ten gerçek sürüm notlarıyla kuruldu
- Ana menü tamamlandı: dil, rehber, hesap menüsü, güncelleme şeridi, solo mod, yarış ekle/sil, boş durumlar
- Resmi Yarışlar ekranı güne göre gruplu olarak yeniden tasarlandı (ScheduleTab)
- Sohbet ve Telemetri ekranları modal yerine tam sayfa olarak kuruldu
- Takım ekranına logo yükleme alanı ve varsayılan araç görselleri eklendi (assets/cars/gt3)
