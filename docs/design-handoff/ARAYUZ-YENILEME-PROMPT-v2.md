# Caspian Race Monitor — Arayüz Yenileme Uygulama Prompt'u (v2 · kararlar netleşmiş)

Bu dosya `ARAYUZ-YENILEME-PROMPT.md`'nin yerini alır. Değişenler dosya sonundaki
"v1'e göre değişenler" bölümünde listelidir. Aşağıdaki blok, Claude Code oturumuna
yapıştırılmak üzere kendi kendine yeten talimattır.

---

```
Sen bir kıdemli frontend mühendisisin. Görevin: ahmettdc/caspianracemonitorweb
(React 19.2 + Vite 8, Tauri 2 masaüstü) projesinin arayüzünü, elimdeki yüksek-sadakatli
tasarım paketine göre yeniden inşa etmek. Bu çalışma ürünün v2.0 sürümüdür.

## Kaynak referanslar (tek doğruluk kaynağı)
- design_handoff_race_monitor_ui/Yeni Tasarım.dc.html  → tıklanabilir, birebir uygulanacak tasarım
- design_handoff_race_monitor_ui/README.md             → design tokens, ekranlar, davranış, state
- design_handoff_race_monitor_ui/github.md             → ekran → kaynak dosya eşlemesi
- design_handoff_race_monitor_ui/i18n-EN.md            → yeni/değişen metinlerin EN karşılıkları (hazır verilir)
Renkler, tipografi, boşluk, durum renkleri ve etkileşimler NİHAİ değerlerdir; birebir uygula.
Verilerin tümü mock'tur — gerçek veri akışı mevcut projeden gelir.

## Başlangıç noktası
- Taban: main @ v1.8.20. Yeni dal: `claude/arayuz-v2`.
- Teslim: main'e v2.0.0 olarak merge. Merge öncesi package.json version → 2.0.0,
  App.jsx APP_VERSION → v2.0.0, changelog.js'e v2.0.0 kaydı (TR+EN) eklenir.
- Tasarım v1.8.20 tablosunun üzerine kuruludur: Gap↔Aralık, Son↔En İyi, AVG5↔AVG
  birleşik sütunları ve Δ sütununun olmaması KORUNUR — geri alma.

## Değişmez kurallar
1. YENİ VERİ KATMANI YOK — tek istisna aşağıdaki "pilot müsaitliği". Prototip mock'unu
   mevcut state/context'e bağla. Mantık: src/engine.js, src/liveBridge.js, src/setupPool.js,
   src/storage.js, src/setupParse.js, src/corners.js, src/ldTrace.js.
2. TAM TOKEN DÖNÜŞÜMÜ: tasarımdaki her stil değeri src/styles.js :root'ta bir --* token'ına
   çevrilir ve sınıf-tabanlı kural olarak yazılır. Bileşen dosyalarında inline stil KULLANMA
   (tek istisna: hesaplanan değerler — çubuk genişliği %, SVG koordinatı, canlı renk eşiği).
   Sıra: WS0'da token seti + kabuk sınıfları tamamlanır, ekranlar ondan sonra başlar.
   Token adları README "Design Tokens" tablosundan; yeni ad uydurma.
3. Renk/sınıf token'ları src/constants.js (CLASS_ACCENT, SLOT_COLORS, PIE_COLORS, TRACKS,
   CARS, PIT_LANE_TIMES) ve mevcut styles.js değerleri BİREBİR korunur.
4. Yeni asset üretme; hepsi public/assets/** içinde. İkonlar components.jsx ICON_PATHS +
   WetIcon/GripIcon.
5. i18n TR/EN korunur. EN metinleri hazır verilir (i18n-EN.md) — çeviri üretme, o dosyadaki
   karşılıkları src/i18n.js'e gir. Listede olmayan bir metin ürettiysen bana sor.
6. Her ekran ayrı commit; küçük ve gözden geçirilebilir.

## Ekran → hedef dosya eşlemesi
- Ana Menü → src/App.jsx (lobi + RaceRow): iki kolon hero + 2×2 hızlı eylem + takvim
- Birleşik sticky yarış çubuğu + 76px sol ray → src/App.jsx (header+teambar+HUD birleştir), styles.js
- Dashboard → src/tabs/DashTab.jsx (KPI/lastik/VE/pilot dağılımı + lightbox + LMU tempo tablosu)
- Stint → src/tabs/StintTab.jsx (S1 lastik ışıkları, timeline + pilot/hava şeridi, plan tablosu, 🔧 tamir)
- Yakıt → src/tabs/FuelTab.jsx (yarış sonu, 📋 Plan otomatiği, canlıdan öğren, senaryolar)
- Canlı → src/tabs/LiveTab.jsx, StrategyBar.jsx, PosChart.jsx, TrackMap.jsx
- Lastik → src/tabs/TyreTab.jsx (köşe matrisi, hızlı atama PENCERESİ, ihlal uyarısı)
- Pilotlar → src/tabs/DriversTab.jsx
- Resmi Yarışlar → src/tabs/ScheduleTab.jsx, lmuSchedule.js
- Pit Board → src/App.jsx pitboard overlay, styles.js

### Modal → TAM SAYFA taşınacaklar (dördü de)
Takım yönetimi · Sohbet · Telemetri · Setup havuzu.
- Her biri sol raydan erişilen tam sayfa ekran olur; modal kabuğu (wxmodal/mbox) kalkar.
- App.jsx'te ekran yönlendirmesi tek yerde toplanır; tarayıcı geri tuşu ve masaüstü (Tauri)
  aynı davranır. Açık pencereyi kapatmak yerine önceki ekrana dönülür.
- Kaynak: components.jsx TeamModal/CreateJoinModal/RaceEditModal, ChatPanel/ChatModal,
  SetupForm/SetupTable/SetupCards, src/tabs/TeleTab.jsx.

## Saha tablosu — sınıf süzgeci (NET KARAR)
Süzgeç TEK noktada: "Poz · Sınıf" sütun başlığı. Tıkla → yalnız kendi sınıfın (başlık kalın),
tekrar tıkla → tüm saha. Tasarımdaki sınıf çipleri (Tümü/Hypercar/LMP2/GT3) KALDIRILDI —
tablonun üstüne çip şeridi ekleme. PosChart bu süzgece bağlı kalır (v1.8.16 davranışı).

## GERÇEKTEN YENİ — sıfırdan kur
- Pilot uygunluk/müsaitlik ızgarası (DriversTab): stint×pilot ızgarası, varsayılan uygun;
  uygun-değil işaretle → o stintin pilot listesinde soluk/üstü çizili + mevcut atama otomatik
  kalkar; uygun pilot kalmazsa amber uyarı.
  KALICILIK: yarış başına Firebase'de saklanır → teams/{tid}/races/{rid}/avail/{driverId}: [stintNo…]
  (mevcut stint/pilot düğümlerinin deseni). storage.js'e okuma/yazma + abonelik, firebase
  kurallarına yazma izni (owner/editor) ve tip/boyut doğrulaması eklenir; izleyici salt-okur.
  Bu, "yeni veri katmanı yok" kuralının bilinçli tek istisnasıdır.
- Rakip karşılaştırma tepsisi (LiveTab, `cmpCar`): saha satırına tıkla → alttan kayan tepsi
  (son tur/AVG5/S1–S3/enerji, delta renkli). Kendi satır tıklanamaz.
- Yarış datası paneli (App.jsx dataCards → sağdan kayan panel): SAHNELE + UYGULA modeli.
  Alan değişiklikleri yerel taslakta tutulur, Firebase'e yazılmaz; panelde "Bu değişiklik neyi
  etkiler" listesi + "N alan değişti" + Uygula / Geri al. Uygula'ya basılmadan hiçbir şey
  kaydedilmez; panel kapatılırken bekleyen değişiklik varsa onay sorulur. Mevcut anında
  kaydetme yolu bu ekran için devre dışı bırakılır (diğer ekranlarda dokunulmaz).
- Rehber kutuları (components.jsx yeni bileşen, GUIDES sözlüğü): her ekranın üstünde tek satır ipucu.
- Sistematik boş durumlar: teleEmpty/calEmpty/chatEmpty/drvEmpty + saha-veri-yok + setup-sonuç-yok.
- Zengin A4 PDF raporu (DashTab tetikler): mevcut print desenini genişlet (App.jsx exportPdf ~L493 +
  TeleTab gizli-iframe window.print ~L453); KPI + stint tablosu + pilot dağılımı + koşullar + not
  + kâğıt paleti.
- İzleyici modu görsel sistemi: mevcut editor/viewer rolü + DenyToast üstüne "İZLEYİCİ MODU"
  rozeti + her ekranda tutarlı opacity/pointer-events pasifleştirme.

## KORU / TAŞI (mevcut, düşürme)
- Opsiyonel interaktif tur: src/tourSteps.js adımlarını yeni DOM'a yeniden bağla (data-tour
  çıpaları); "Rehberi başlat" korunur. Statik ipuçları hep açık.
- Büyük Pano: LiveTab ⛶ Büyük Pano tam ekran modu korunur.
- Hava geçmişi/planlı geçiş: mevcut hava kayıt modalını yarış datası panelinin hava bölümüne
  entegre et ("Son 30/60/90 dk" hızlı planlı geçiş korunur).
- Yüzen YouTube mini-oynatıcı: mevcut mini-player'ı yeni kabuğa yerleştir.
- Kimlik/erişim + admin "Üye Yönetimi": mevcut haliyle koru (redesign dışı).

## KALDIRILANLAR
- Global yoğunluk anahtarı KALKAR; yoğunluk yalnız LiveTab'de ("Pit duvarı ↔ Mühendis").
- AÇIK TEMA bu turda kapsam dışı: v2.0 tek koyu temayla çıkar. Header ☀/🌙 anahtarı gizlenir
  (kod silinmez, açık tema token'ları sonraki turda üretilecek). Komut paletindeki tema
  komutu da gizlenir.
- Saha tablosu sınıf çip şeridi (yukarıdaki karar).

## KAPSAM DIŞI (yapma)
- Responsive <1080px / tablet · erişilebilirlik odak halkaları & SR etiketleri · pilot sürüş
  süresi kuralı · açık tema.

## Doğrulama
- npm install && npm run dev → her ekranı Yeni Tasarım.dc.html ile görsel karşılaştır.
- npm test (vitest) geçmeli; değişen bileşenlerin *.render.test.jsx testlerini güncelle.
  Yeni: müsaitlik ızgarası mantığı ve sahnelenmiş panel için birim testi yaz.
- npm run test:rules → müsaitlik düğümünün Firebase kurallarını doğrula (owner/editor yazar,
  izleyici okur).
- TR↔EN, Ctrl/Cmd+K paleti, izleyici modu; liveDemo.js ile canlı akış; Tauri build'de tam
  sayfa geçişleri + geri davranışı.

## Çalışma sırası
WS0 token seti + kabuk (sticky yarış çubuğu, 76px sol ray, sayfa yönlendirmesi)
→ WS1 ekranlar: Canlı → Dashboard/Stint → Telemetri → Setup → Takım/Sohbet → Ana Menü/Resmi Yarışlar
→ WS2 yeni özellikler (müsaitlik, karşılaştırma tepsisi, yarış datası paneli, PDF, boş durumlar)
→ WS3 korunanlar (tur, Büyük Pano, hava, mini-oynatıcı)
→ WS4 EN sözlüğü + doğrulama + v2.0.0 sürüm kaydı.
Her ekran bittiğinde referansla karşılaştır.
```

---

## v1'e göre değişenler

| Konu | v1 | v2 (karar) |
| --- | --- | --- |
| Çerçeve sürümü | "React 18 + Vite" | React 19.2 + Vite 8 + Tauri 2 (gerçek değerler) |
| Dal / teslim | `claude/proje-arayuz-karsilastir-nhpryg` | main @ v1.8.20'den `claude/arayuz-v2`; main'e **v2.0.0** olarak merge |
| Stil stratejisi | "inline kullanma" (belirsiz) | **Tam token dönüşümü**, WS0'da token seti bitirilir |
| Pilot müsaitliği | "yeni veri katmanı yok" ile çelişiyordu | Firebase'de **yarış başına kalıcı**; kuralın bilinçli tek istisnası, şema + kural + test yazılı |
| Yarış datası paneli | çelişkili | **Sahnele + Uygula**; bu ekranda anında kaydetme kapatılır |
| Açık tema | "koru, açık karşılıkları üret" | **Kapsam dışı**; ☀/🌙 gizlenir, kod silinmez |
| Tam sayfa | Takım + Sohbet | **Takım · Sohbet · Telemetri · Setup havuzu** (dördü) |
| Sınıf süzgeci | belirsiz (çip + başlık çakışması) | **Yalnız başlık süzgeci**; çipler tasarımdan da kaldırıldı |
| EN metinleri | mühendise bırakılmıştı | **Hazır verilir** (`i18n-EN.md`), çeviri üretmek yasak |
| v1.8.19/20 | söylenmemişti | Birleşik sütunlar + Δ'nın yokluğu korunur uyarısı eklendi |
| Yoğunluk | "global kaldır" | Aynı karar, "KALDIRILANLAR" başlığı altında netleşti |
