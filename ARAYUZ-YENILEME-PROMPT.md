# Caspian Race Monitor — Arayüz Yenileme Uygulama Prompt'u

Aşağıdaki blok, Claude design/Code oturumuna yapıştırılmak üzere kendi kendine yeten talimattır.
Kararlar `ARAYUZ-YENILEME-RAPOR.md` içinde gerekçelendirilmiştir.

---

```
Sen bir kıdemli frontend mühendisisin. Görevin: ahmettdc/caspianracemonitorweb (React 18 + Vite)
projesinin arayüzünü, elimdeki yüksek-sadakatli tasarım paketine göre yeniden inşa etmek.

## Kaynak referanslar (tek doğruluk kaynağı)
- design_handoff_race_monitor_ui/Yeni Tasarım.dc.html  → tıklanabilir, birebir uygulanacak tasarım
- design_handoff_race_monitor_ui/README.md             → design tokens, ekranlar, davranış, state
- design_handoff_race_monitor_ui/github.md             → ekran → kaynak dosya eşlemesi
Renkler, tipografi, boşluk, durum renkleri ve etkileşimler NİHAİ değerlerdir; birebir uygula.
Verilerin tümü mock'tur — gerçek veri akışı mevcut projeden gelir.

## Değişmez kurallar
1. YENİ VERİ KATMANI YOK. Prototip mock'unu mevcut st/context durumuna bağla. Mantık:
   src/engine.js, src/liveBridge.js, src/setupPool.js, src/storage.js, src/setupParse.js,
   src/corners.js, src/ldTrace.js.
2. Stil, mevcut sınıf-tabanlı düzene çevrilir: yeni --* token'ları src/styles.js :root'a eklenir
   (README "Design Tokens"), inline stil kullanma.
3. Renk/sınıf token'ları src/constants.js (CLASS_ACCENT, SLOT_COLORS, PIE_COLORS, TRACKS, CARS,
   PIT_LANE_TIMES) ve mevcut styles.js değerleri BİREBİR korunur.
4. Yeni asset üretme; hepsi public/assets/** içinde. İkonlar components.jsx ICON_PATHS + WetIcon/GripIcon.
5. i18n TR/EN korunur: tüm yeni/değişen metinler için src/i18n.js EN sözlüğüne karşılık ekle.
6. Her ekran ayrı commit; dal: claude/proje-arayuz-karsilastir-nhpryg.

## Ekran → hedef dosya eşlemesi
- Ana Menü → src/App.jsx (lobi + RaceRow): iki kolon hero + 2×2 hızlı eylem + takvim
- Birleşik sticky yarış çubuğu + 76px sol ray → src/App.jsx (header+teambar+HUD birleştir), styles.js
- Dashboard → src/tabs/DashTab.jsx (KPI/lastik/VE/pilot dağılımı + lightbox + LMU tempo tablosu)
- Stint → src/tabs/StintTab.jsx (S1 lastik ışıkları, timeline + pilot/hava şeridi, plan tablosu, 🔧 tamir)
- Yakıt → src/tabs/FuelTab.jsx (yarış sonu, 📋 Plan otomatiği, canlıdan öğren, senaryolar)
- Canlı → src/tabs/LiveTab.jsx, StrategyBar.jsx, PosChart.jsx, TrackMap.jsx
- Lastik → src/tabs/TyreTab.jsx (köşe matrisi, hızlı atama PENCERESİ, ihlal uyarısı)
- Pilotlar → src/tabs/DriversTab.jsx
- Telemetri → src/tabs/TeleTab.jsx (+ corners.js, ldTrace.js)
- Setup havuzu + pencereler → src/components.jsx (SetupForm/SetupTable/SetupCards + içerik/karşılaştırma/yükleme)
- Takım (TAM SAYFA) + davet/sezon → src/components.jsx (TeamModal/CreateJoinModal/RaceEditModal), storage.js
- Sohbet (TAM SAYFA) → src/components.jsx (ChatPanel/ChatModal)
- Resmi Yarışlar → src/tabs/ScheduleTab.jsx, lmuSchedule.js
- Pit Board → src/App.jsx pitboard overlay, styles.js

## GERÇEKTEN YENİ — sıfırdan kur
- Pilot uygunluk/müsaitlik ızgarası (DriversTab, yeni `avail` state): stint×pilot ızgarası, varsayılan
  uygun; uygun-değil işaretle → o stintin pilot listesinde soluk/üstü çizili + mevcut atama otomatik
  kalkar; uygun pilot kalmazsa amber uyarı.
- Rakip karşılaştırma tepsisi (LiveTab, `cmpCar`): saha satırına tıkla → alttan kayan tepsi
  (son tur/AVG5/S1–S3/enerji, delta renkli). Kendi satır tıklanamaz.
- Yarış datası paneli (App.jsx dataCards → sağdan kayan panel): sahnelenmiş değişiklik + "Bu
  değişiklik neyi etkiler" listesi + "N alan değişti" + Uygula/Geri al (anında uygulama YOK).
- Rehber kutuları (components.jsx yeni bileşen, GUIDES sözlüğü): her ekranın üstünde tek satır ipucu.
- Sistematik boş durumlar: teleEmpty/calEmpty/chatEmpty/drvEmpty + saha-veri-yok + setup-sonuç-yok.
- Zengin A4 PDF raporu (DashTab tetikler): mevcut print desenini genişlet (App.jsx exportPdf ~L493 +
  TeleTab gizli-iframe window.print ~L453); KPI + stint tablosu + pilot dağılımı + koşullar + not + kâğıt paleti.
- İzleyici modu görsel sistemi: mevcut editor/viewer rolü + DenyToast üstüne "İZLEYİCİ MODU" rozeti +
  her ekranda tutarlı opacity/pointer-events pasifleştirme.

## KORU / TAŞI (mevcut, düşürme)
- Açık tema: yeni token'ların açık karşılıklarını üret; header ☀/🌙 + komut paleti korunur.
- Opsiyonel interaktif tur: src/tourSteps.js adımlarını yeni DOM'a yeniden bağla (data-tour çıpaları);
  "Rehberi başlat" korunur. Statik ipuçları hep açık.
- Büyük Pano: LiveTab ⛶ Büyük Pano tam ekran modu korunur.
- Yoğunluk: global toggle KALDIR; yalnız LiveTab "Pit duvarı ↔ Mühendis" density.
- Hava geçmişi/planlı geçiş: mevcut hava kayıt modalını yarış datası panelinin hava bölümüne entegre et
  ("Son 30/60/90 dk" hızlı planlı geçiş korunur).
- Yüzen YouTube mini-oynatıcı: mevcut mini-player'ı yeni kabuğa yerleştir.
- Kimlik/erişim + admin "Üye Yönetimi": mevcut haliyle koru (redesign dışı).

## KAPSAM DIŞI (yapma)
- Responsive <1080px/tablet · erişilebilirlik odak halkaları & SR etiketleri · pilot sürüş süresi kuralı.

## Doğrulama
- npm install && npm run dev → her ekranı Yeni Tasarım.dc.html ile görsel karşılaştır.
- npm test (vitest) geçmeli; değişen bileşenlerin *.render.test.jsx testlerini güncelle.
- TR↔EN, koyu↔açık tema, Ctrl/Cmd+K paleti; yeni özelliklerin manuel akışı; liveDemo.js ile canlı akış.

## Çalışma sırası
WS0 (token+kabuk) → WS1 ekranlar (Canlı → Dashboard/Stint → Telemetri → Setup → Takım/Sohbet →
Ana Menü/Resmi Yarışlar) → WS2 yeni özellikler → WS3 korunanlar → EN + doğrulama.
Küçük, gözden geçirilebilir commit'ler halinde ilerle; her ekran bittiğinde referansla karşılaştır.
```
