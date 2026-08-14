# Caspian Race Control — Gelişim Önerisi ve Yol Haritası (2026)

> Hazırlık: v1.8.2 kod tabanı incelemesi üzerine. Bu belge bir **strateji ve
> yön belgesidir** — tek tek issue'lara bölünmeden önce ortak resmi çizer.
> Amaç: aracın "stint planlayıcı"dan **canlı karar destek sistemi**ne evrilmesi.

---

## 1) Yönetici Özeti

Caspian Race Control bugün olgun, yayında ve gerçek takımlar tarafından
kullanılan bir üründür: sağlam bir Virtual Energy strateji motoru, Firebase ile
anlık takım senkronizasyonu, Tauri masaüstü + otomatik updater, hafif Python
canlı köprü, telemetri içe aktarma (MoTeC/DuckDB/.ld) ve LMU resmi yarış takvimi
entegrasyonu var. Temel sağlam.

Bir sonraki sıçrama **veriyi karara çevirmek**. Bugün araç mükemmel bir
*planlama* ve *gösterme* aracı; ama yarış sırasında "**şimdi mi girsem?**",
"**FCY'de girsem ne kazanırım?**", "**rakip undercut yaparsa ne olur?**"
sorularına cevap vermiyor. Endurance yarışının kazanıldığı yer tam olarak burası.

Bu belge üç eksende bir yol haritası önerir:

1. **Teknik temel** — 2.840 satırlık `App.jsx` ve 2.131 satırlık `changelog.js`
   gibi büyüyen tekil dosyaları sürdürülebilir hale getir; motor/state için tip
   güvenliği ve test kapsamı.
2. **Canlı karar desteği (amiral gemisi)** — adaptif yakıt/enerji tahmini, FCY /
   güvenlik aracı pit optimizasyonu, undercut/overcut, "şimdi gir" önerisi,
   pilot sürüş-süresi regülasyon takibi.
3. **Analiz derinliği + platform genişlemesi** — telemetriden lastik aşınma
   eğrisi öğrenme, referans tur/pilot karşılaştırma, PWA tablet pit-wall modu,
   masaüstü çok-platform, bulut röle ve Discord entegrasyonu.

---

## 2) Mevcut Durum Değerlendirmesi

### 2.1 Güçlü yönler
- **Sağlam strateji motoru** (`engine.js`): Virtual Energy modeli, karma hava
  (kronolojik log), lider bitiş modeli, son stint hesaplayıcı — saf ve test
  edilebilir (`engine.test.js`).
- **Anlık senkronizasyon**: Firebase `onValue`, epoch-tabanlı zaman (saat dilimi
  doğru), oda kodu + PIN'li rol yönetimi.
- **Gerçek canlı veri**: rF2 paylaşımlı bellek → köprü → RTDB → web pit-wall;
  donma azaltıcı optimizasyonlar (düşük öncelik, REST opsiyonel).
- **Masaüstü dağıtımı olgun**: Tauri, imzalı updater, `latest.json`, sistem
  tarayıcısı + loopback OAuth (WebView2 kısıtını çözmüş).
- **Ürün disiplini**: 36 test dosyası, oxlint, CI (web + desktop + Firebase
  kuralları), ayrıntılı changelog, TR/EN i18n, erişilebilirlik (ARIA sekmeler).

### 2.2 Teknik borç ve riskler
| Alan | Durum | Risk |
|------|-------|------|
| `App.jsx` (2.840 satır) | Tekil dev bileşen, prop-drilling | Değişiklik maliyeti ↑, regresyon riski ↑ |
| `changelog.js` (2.131 satır) | Bundle içinde kaynak metin | Başlangıç paketini şişirir |
| `styles.js` (1.192 satır) | Elle CSS string | Tema/tasarım tutarlılığı elle |
| Tip güvenliği yok | Saf JS/JSX (~24.5k satır) | Yeniden düzenleme riskli, IDE desteği zayıf |
| Test kapsamı | İyi ama motor/canlı odaklı; e2e yok | Kritik akışlarda regresyon görülmez |
| Hata izleme yok | Prod'da çökme görünmez | Kullanıcı bildirimine bağımlı |
| Köprü ayrı (Python) | İkinci dağıtım hattı | Sürüm/uyum yükü, sürücü PC'sinde kurulum |
| Güvenlik | Oda PIN "kriptografik değil" (README notu) | Hassas veri konmamalı; App Check önerili |

### 2.3 Ürün boşlukları (fırsat)
Kodda **arama** ile doğrulandı — şu an **yok**:
- Undercut / overcut hesabı, "şimdi gir" önerisi, FCY/güvenlik aracı optimizeri
- Canlı tüketime göre **adaptif** yakıt/enerji tahmini (plan sabit kalıyor)
- Hava durumu tahmini / ıslak-kuru geçiş turu olasılığı
- Rakip pit penceresi çıkarımı (rakiplerin stratejisini tahmin)
- Pilot sürüş-süresi / dinlenme regülasyon takibi (endurance kuralları)
- Sezon/şampiyona takibi, paylaşılabilir strateji şablonları

---

## 3) Vizyon

> **"Planla → İzle" aracından "Planla → İzle → Karar Ver" pit-wall'ına."**

Hedef kullanıcı deneyimi: yarış mühendisi ekranın karşısında oturuyor; araç
sadece durumu göstermiyor, **bir sonraki en iyi hamleyi öneriyor** ve bunu
gerekçesiyle sunuyor. FCY düştüğünde ekran "şimdi gir: +18 sn kazanç, pencere
2 tur" diyor. Rakip erken pit yaptığında "undercut riski: 6 sn, cevap turu = 3"
uyarısı çıkıyor. Yarış bitince tek tıkla stint-stint aşınma ve tüketim raporu.

---

## 4) Yol Haritası (Fazlı)

Sürümleme mevcut semver ile hizalı (bugün 1.8.2).

### Faz 0 — Teknik Temel Sağlamlaştırma · `v1.9.x` · ~4–6 hafta
Yeni özellik hızını kalıcı olarak artıran yatırım. Kullanıcıya görünmez ama
sonraki her fazı ucuzlatır.

- **`App.jsx` ayrıştırma**: alanlara göre Context'ler — `RaceContext`,
  `LiveContext`, `AuthTeamContext`. Prop-drilling → context + reducer.
  Hedef: `App.jsx` < 800 satır, tab bileşenleri kendi state kancasını alır.
- **`changelog.js` bundle dışına**: JSON'a taşı, `VersionModal` açılınca lazy
  fetch. Başlangıç paketi küçülür.
- **Kademeli tip güvenliği**: önce `jsconfig.json` + `checkJs` ile motor/state
  dosyalarına JSDoc tipleri; kritik saf modülleri (`engine`, `state`,
  `liveLaps`, `lmuParse`) `.ts`'e taşı. Tüm repo değil — riskli çekirdek önce.
- **Test kapsamı**: `engine` + `state` için hedef ~%80; `computePlan`,
  `lastStintFuel`, karma hava senaryoları için tablo testleri.
- **e2e duman testi (Playwright)**: solo modda "yarış oluştur → stint planla →
  PDF" ve "demo canlı → pano" akışları. (Ortamda Chromium hazır.)
- **Opt-in hata izleme**: hafif, gizlilik-dostu çökme raporu (kullanıcı onaylı).

### Faz 1 — Canlı Karar Desteği (Amiral Gemisi) · `v2.0` · ~8–10 hafta
Aracın kimliğini değiştiren faz.

- **Adaptif yakıt/enerji tahmini**: canlı VE tüketiminden gerçek stint
  uzunluğunu tahmin et; plan sapıyorsa "planlanan 11 tur → gerçek 10 tur, 1 tur
  erken pit" uyarısı. Motor zaten VE modeline sahip; canlı gözlemle besle.
- **FCY / Güvenlik Aracı pit optimizeri**: yavaş tur altında pit kaybı düşer;
  "şimdi gir → net kazanç +X sn, pencere Y tur" hesabı. Endurance'ta en yüksek
  etkili özellik.
- **Undercut / Overcut**: seçili rakibe göre "cevap turu" ve tahmini kazanç/kayıp.
- **"Şimdi gir?" öneri rozeti**: yakıt penceresi + lastik durumu + trafik +
  rakip pozisyonunu birleştiren tek net tavsiye (gerekçeli).
- **Pilot sürüş-süresi takibi**: toplam/kesintisiz sürüş süresi, zorunlu
  dinlenme, sürücü değişim uyarısı (endurance regülasyonları).
- **Sesli çağrı (TTS) — opsiyonel**: "Box this lap", "Fuel only" gibi çağrılar;
  gürültülü ortamda ekrana bakmadan.

### Faz 2 — Telemetri & Analiz Derinliği · `v2.1` · ~6–8 hafta
- **Lastik aşınma eğrisi öğrenme**: içe aktarılan/canlı tur sürelerinden stint
  içi degradasyon eğrisi çıkar; strateji motoruna geri besle (tahmini stint
  hızı düşüşü).
- **Referans tur & pilot karşılaştırma**: delta trace, fren noktası/gaz izi
  karşılaştırma (mevcut hayalet altyapısı üzerine).
- **Setup ↔ telemetri korelasyonu**: bir setup değişiminin sektör/aşınmaya
  etkisini yan yana.
- **Yarış sonrası rapor**: stint-stint tüketim, aşınma, tutarlılık, pit özeti →
  paylaşılabilir tek sayfa (PDF/PNG + link).

### Faz 3 — Platform Genişlemesi · `v2.2` · ~6–8 hafta
- **PWA / tablet pit-wall modu**: mühendis tablet/telefondan izlesin; büyük
  pano + öneri rozetleri dokunmatik optimize.
- **Masaüstü çok-platform**: mevcut Windows'a ek macOS/Linux Tauri derlemeleri.
- **Bulut röle (opsiyonel)**: köprünün her sürücünün Firebase'ine değil, hafif
  bir röleye yazması — kurulum sürtünmesini azaltır.
- **Discord entegrasyonu**: yarış başı/pit/FCY bildirimleri takım kanalına.

### Faz 4 — Topluluk & Sezon · `v2.3`
- **Şampiyona/sezon takibi**: çoklu yarış, puan, sonuç tablosu.
- **Paylaşılabilir şablonlar**: pist/araç ön ayarları ve strateji şablonları
  için topluluk havuzu (mevcut setup havuzu deseni üzerine).

---

## 5) Öncelik Matrisi (Etki × Efor)

| Özellik | Etki | Efor | Öncelik |
|---------|:----:|:----:|:-------:|
| FCY / Güvenlik aracı pit optimizeri | Çok yüksek | Orta | **P0** |
| Adaptif yakıt/enerji tahmini | Çok yüksek | Orta | **P0** |
| `App.jsx` ayrıştırma + context | Yüksek (dolaylı) | Orta | **P0** |
| "Şimdi gir?" öneri rozeti | Yüksek | Orta | P1 |
| Undercut / overcut | Yüksek | Orta | P1 |
| Pilot sürüş-süresi takibi | Orta-Yüksek | Düşük | **P1 (hızlı kazanç)** |
| Lastik aşınma eğrisi öğrenme | Yüksek | Yüksek | P2 |
| Kademeli TypeScript (çekirdek) | Yüksek (dolaylı) | Orta | P1 |
| `changelog.js` bundle dışı | Orta | Düşük | **Hızlı kazanç** |
| Yarış sonrası rapor | Orta-Yüksek | Orta | P2 |
| PWA tablet modu | Yüksek | Orta-Yüksek | P2 |
| TTS sesli çağrı | Orta | Düşük | Hızlı kazanç |
| Discord entegrasyonu | Orta | Düşük-Orta | P3 |
| Şampiyona/sezon | Orta | Yüksek | P3 |

**Hızlı kazançlar (bir hafta içinde, düşük risk):** `changelog.js` bundle dışı ·
pilot sürüş-süresi takibi · TTS çağrı iskeleti.

---

## 6) Başarı Kriterleri

- **Karar hızı**: FCY anında "gir/kalma" kararına saniyeler içinde ulaşılabilir
  olması (öneri rozetiyle ölçülebilir kullanım).
- **Tahmin doğruluğu**: adaptif tahminin gerçek pit turuna sapması ≤ ±0.5 tur
  (yarış sonrası raporla ölçülür).
- **Sürdürülebilirlik**: `App.jsx` < 800 satır; çekirdek modüller tipli;
  motor/state kapsamı ≥ %80.
- **Kararlılık**: opt-in hata izleme ile prod çökme oranının görünür + düşürülür
  olması.

---

## 7) İlk 30 / 60 / 90 Gün

- **0–30 gün**: `changelog.js` bundle dışı (hızlı kazanç) → `App.jsx` context
  ayrıştırmasının ilk dilimi (Live + Race context) → motor/state test kapsamı →
  Playwright duman testi. Paralel: **pilot sürüş-süresi takibi** (görünür hızlı
  kazanç).
- **30–60 gün**: **Adaptif yakıt/enerji tahmini** ve **FCY pit optimizeri** —
  motorun canlı gözlemle beslenmesi; `v2.0-beta` canlı sekmesinde.
- **60–90 gün**: **Undercut/overcut + "şimdi gir?" öneri rozeti**, TTS çağrı,
  çekirdek modüllerin TypeScript'e taşınması. `v2.0` yayını + changelog.

---

## 8) Açık Karar Noktaları (senin önceliğin)

Bu belge geniş tuttu; uygulama sırasını netleştirmek için birkaç yön:

1. **Odak**: Önce **canlı karar desteği** (kullanıcıya en görünür) mi, yoksa
   **teknik temel** (sonraki her şeyi hızlandırır) mı ağırlıklı başlasın?
2. **Kapsam**: Yalnız LMU/rF2'de derinleşmek mi, yoksa erkenden **başka oyunlara**
   (iRacing/ACC) genişlemek mi?
3. **Platform**: Masaüstü öncelikli kalsın mı, yoksa **tablet/PWA pit-wall**
   erken mi gelsin?
4. **Topluluk**: Sezon/şampiyona ve paylaşılan şablonlar bu yıl kapsamda mı?

Bir yön seçersen, o fazı issue-issue kırıp uygulamaya başlayabilirim.
