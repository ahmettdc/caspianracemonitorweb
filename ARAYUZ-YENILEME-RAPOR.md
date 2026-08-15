# Caspian Race Monitor — Arayüz Yenileme Raporu

Mevcut proje (React 18 + Vite) ile yeni tasarım paketinin
(`design_handoff_race_monitor_ui/`) karşılaştırması, alınan kararlar ve uygulama yol haritası.

---

## 1. Bağlam
Kullanıcı, **Caspian Race Monitor** (LMU yarış mühendisliği aracı; React 18 + Vite, sınıf-tabanlı
CSS `src/styles.js`, Firebase, i18n TR/EN) arayüzünü baştan tasarladı
(`Yeni Tasarım.dc.html` + `README.md` handoff). Amaç: pit duvarı okunabilirliği ve bilgi
hiyerarşisini iyileştirmek. Prototip tek dosyada inline stillerle yazılmış; hedef **yüksek-sadakatli
koyu tasarımı mevcut sınıf-tabanlı CSS düzenine çevirmek**, tüm veri akışını
(engine/liveBridge/setupPool/storage) koruyarak ekranları güncellemek.

---

## 2. Karşılaştırma — üç kova

### A) Projede VAR, yeni arayüzde YOK / düşürülmüş
| # | Özellik | Not |
|---|---------|-----|
| 1 | **Açık (light) tema** | Projede koyu+açık toggle var; tasarım yalnız koyu (0 light token). |
| 2 | **İnteraktif rehberli tur** (spotlight `TourOverlay`) | ~38 adım; tasarımda statik ipucu kutularına indirgenmiş. |
| 3 | **Büyük Pano** (tam ekran canlı pano) | Projede LiveTab'de `⛶ Büyük Pano`; tasarımda atlanmış. |
| 4 | **EN/İngilizce çeviriler** | Proje çift dilli; prototip TR-only. |
| 5 | **Global yoğunluk (density) geçişi** | Projede uygulama geneli; tasarımda yalnız canlı tabloya özel. |
| 6 | **Kimlik/erişim + admin "Üye Yönetimi"** | Login, erişim talebi/onay, admin onay ekranları tasarımda yok. |
| 7 | **Hava geçmişi / planlı geçiş defteri** | Projede kayıt defteri + "Son 30/60/90 dk"; panelde tam karşılığı yok. |
| 8 | **Yüzen YouTube mini-oynatıcı** | Taşınabilir/boyutlandırılabilir oynatıcı tasarımda tarif edilmemiş. |

### B) Yeni arayüzde VAR, projede YOK / gerçekten yeni
| # | Özellik | Not |
|---|---------|-----|
| 1 | **Pilot uygunluk/müsaitlik ızgarası** | Stint×pilot; uygun-değil → atama kalkar, amber uyarı. Projede yok. |
| 2 | **Rakip karşılaştırma tepsisi** | Saha satırına tıkla → alttan delta paneli (son tur/AVG5/S1–S3/enerji). |
| 3 | **Yarış datası — sahnelenmiş Uygula/Geri al** | + "Bu değişiklik neyi etkiler" önizlemesi + "N alan değişti". |
| 4 | **Rehber kutuları** | Statik ekran-içi ipucu bileşeni (turun yanında). |
| 5 | **Sistematik boş durumlar** | Takvim/telemetri/sohbet/kadro/saha/setup için tasarlanmış. |
| 6 | **Zengin A4 PDF dashboard raporu** | Mevcut PDF yalnız stint/pilot programı; yeni rapor KPI+dağılım+not. |
| 7 | **İzleyici modu görsel sistemi** | Rol mantığı zaten var; rozet + tutarlı pasifleştirme yeni. |
| 8 | **Yapısal değişimler** | Takım & Sohbet tam sayfa; birleşik sticky yarış çubuğu; Ana Menü yeni düzeni. |

### C) İkisinde de VAR — sadece yeniden tasarlanmış (boşluk değil)
Pit Board · Setup pencereleri (içerik/karşılaştırma/yükleme) · Tur geçmişi (LapsModal) ·
Pist haritası · Pozisyon grafiği · Strateji çubuğu · Telemetri tur karşılaştırma ·
Komut paleti (Ctrl+K) · Setup havuzu · Sezon/yarış düzenleme.

---

## 3. Kararlar (kullanıcı onayı)
- **Korunacak (prototipin düşürdüğü):** açık tema (yeni token'ların açık karşılıkları üretilir) ·
  opsiyonel interaktif tur (statik ipuçlarına ek) · Büyük Pano · yoğunluk **yalnız canlı tabloya**
  daraltılır (global toggle kaldırılır).
- **Taşınacak/korunacak:** hava geçmişi + planlı geçiş defteri · yüzen YouTube mini-oynatıcı ·
  EN/İngilizce çeviriler (çift dilli kal) · kimlik/erişim + admin onay ekranları (mevcut haliyle).
- **Kapsam dışı:** responsive (<1080px/tablet) · erişilebilirlik turu (odak halkaları, SR etiketleri) ·
  pilot sürüş süresi kuralı (projede de yok).

---

## 4. Yol haritası (workstream'ler)
- **WS0 — Token + kabuk:** yeni `--*` token'ları + açık tema karşılıkları (`src/styles.js`),
  tipografi/animasyon ölçekleri, birleşik sticky yarış çubuğu + 76px sol ray (`src/App.jsx`).
- **WS1 — Ekran portu (redesign):** Canlı → Dashboard/Stint/Yakıt → Telemetri → Lastik/Pilot →
  Setup → Takım/Sohbet → Ana Menü/Resmi Yarışlar → Pit Board. (Screen map: `src/tabs/*`,
  `src/components.jsx`, `src/App.jsx`.)
- **WS2 — Yeni özellikler:** uygunluk ızgarası · karşılaştırma tepsisi · sahneli yarış datası paneli ·
  rehber kutuları · boş durumlar · A4 PDF raporu · izleyici görsel sistemi.
- **WS3 — Korunanlar:** açık tema · opsiyonel tur (`data-tour` yeniden bağla) · Büyük Pano ·
  yoğunluk daraltma · hava geçmişi · mini-oynatıcı · EN çevirileri · auth/admin.
- **Doğrulama:** `npm run dev` görsel karşılaştırma · `npm test` (vitest) · TR/EN · koyu/açık tema ·
  `src/liveDemo.js` ile canlı akış.

**Önerilen sıra:** WS0 → WS1 (büyükten küçüğe) → WS2 → WS3 → EN + doğrulama.
Her ekran ayrı commit; `claude/proje-arayuz-karsilastir-nhpryg` dalına.

---

## 5. Uygulama prompt'u
Claude design/Code oturumuna yapıştırmak için kendi kendine yeten talimat:
**`ARAYUZ-YENILEME-PROMPT.md`** dosyasına bakın.
