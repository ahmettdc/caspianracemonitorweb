# Handoff: Caspian Race Monitor — Arayüz Yenilemesi

## Overview
Bu paket, **Caspian Race Monitor** (LMU yarış mühendisliği aracı, `ahmettdc/caspianracemonitorweb`) arayüzünün baştan tasarlanmış halini içerir. Amaç: pit duvarında yarış sırasında kullanılan aracın okunabilirliğini ve bilgi hiyerarşisini iyileştirmek. Mevcut React + Vite projesindeki tüm sekmeler (Dashboard, Stint, Son Stint Yakıtı, Canlı Timing, Lastik, Pilotlar, Telemetri, Setup Havuzu, Takım, Sohbet, Resmi Yarışlar, Ana Menü) yeniden düzenlendi; ek olarak yarış datası paneli, pit board, PDF raporu ve ~20 pencere tasarlandı.

## About the Design Files
Bu paketteki dosyalar **HTML ile üretilmiş tasarım referanslarıdır** — görünüm ve davranışı gösteren prototiplerdir, doğrudan kopyalanacak üretim kodu değildir. Görev: bu HTML tasarımlarını **hedef kod tabanının mevcut ortamında yeniden oluşturmak**. Bu projede ortam hazır: **React 19.2 + Vite 8** (Tauri 2 masaüstü), sınıf tabanlı CSS (`src/styles.js` içinde tek büyük stil bloğu), CSS değişkenleriyle tema, Firebase (auth + storage), i18n (`src/i18n.js`, TR/EN).

Prototip tek bir dosyada (`Yeni Tasarım.dc.html`) inline stillerle yazıldı; hedefte bu **mevcut sınıf tabanlı CSS düzenine** çevrilmelidir — yeni `--*` token'ları `src/styles.js` içindeki `:root` bloğuna eklenir, bileşenler `src/tabs/*.jsx` ve `src/components.jsx` içinde güncellenir.

## Fidelity
**High-fidelity (hifi).** Renkler, tipografi, boşluklar, durum renkleri ve etkileşimler nihai değerlerdir; birebir uygulanmalıdır. Veriler örnek (mock) verilerdir — gerçek veri akışı mevcut projeden gelir (`liveBridge.js`, `engine.js`, `setupPool.js`, `storage.js`).

---

## Design Tokens

Mevcut projedeki `src/styles.js` token'ları korunmuştur; prototipte kullanılan tam liste:

### Renkler — zemin ve yüzey
| Token | Değer | Kullanım |
| --- | --- | --- |
| `--bg` | `#0B0708` | sayfa zemini |
| `--panel` | `#120C0E` | kart / tablo zemini |
| `--panel-alt` | `#150E10` | ikincil kart, alt şerit, açılır menü zemini |
| `--panel2` | `#1E1418` | girdi, düğme, hücre zemini |
| `--line` | `#34232A` | ana çizgi / çerçeve |
| `--line-soft` | `#241519` | tablo satır ayracı |
| `--line-softer` | `#1B1013` | iç liste ayracı |
| `--line-strong` | `#4A2F38` | vurgulu çerçeve, panel kenarı |
| `--line-dim` | `#5C3B44` | pasif ikon/çizgi |

### Renkler — marka ve metin
| Token | Değer | Kullanım |
| --- | --- | --- |
| `--car` | `#960018` | marka kırmızısı (birincil düğme zemini, kendi araç satırı) |
| `--accent` | `#D24357` | vurgu (başlıklar, aktif çerçeve, vites) |
| `--accent-soft` | `#C51E38` | rozet zemini (okunmamış sayacı) |
| `--txt` | `#F3EAEC` | ana metin |
| `--dim` | `#C9B3B9` | ikincil metin |
| `--muted` | `#A88C93` | etiket / üçüncül metin |
| `--faint` | `#6B4A52` | pasif metin |
| `--on-car` | `#FFE9ED` | marka zemin üstü metin |

### Renkler — durum
| Token | Değer | Kullanım |
| --- | --- | --- |
| `--green` | `#37D67A` | iyi / canlı / kişisel en iyi |
| `--yellow` | `#F5B23D` | uyarı, sarı bayrak, favori |
| `--red` | `#FF4D5E` | hata, ceza, kritik |
| `--purple` | `#B58BFF` | sınıf en iyi turu, telemetri vurgusu |
| `--blue` | `#4C9AFF` | LMP2, sürücü rozeti, karşılaştırma B |

### Sınıf renkleri (`src/constants.js` → `CLASS_ACCENT`, birebir korunmuştur)
`hypercar #E7443B` · `lmp2 #4C9AFF` · `lmp3 #B58BFF` · `gt3 #EF8A2B` · `gte #37D67A`

### Zemin ıslaklığı renkleri (`WX_COL`)
`dry #F5C84C` · `damp #8FD0E8` · `slwet #4D9FFF` · `wet #7B8FF7` · `xwet #5C6BC0`

### Lastik kullanım renkleri (`src/styles.js` `.t2/.tq/.t3/.t4/.tw/.terr` ile eşit)
`1× yeni #C9B3B9` · `2× #F2C94C` · `qual dönüşü #6694FF` · `3× #E8842A` · `4×+ #DC2626` · `wet #7FE3A0` · `ihlal #F0604D`

### Telemetri yuva renkleri (`SLOT_COLORS`)
`A #40D68C` · `B #F0604D` · `C #F2A33C` · `D #6694FF` — A/B iz renkleri: `A #ff5470`, `B #4d9fff`, imleç `#3ad07a`

### Pilot renkleri (`PIE_COLORS` alt kümesi)
`#E7443B` `#4C9AFF` `#37D67A` `#F5B23D` `#B58BFF` `#EF8A2B`

### Tipografi
- **Görüntü / sayı fontu:** `Rajdhani` 500/600/700 — tüm sayılar, başlıklar, tur süreleri, KPI değerleri. (ÖNEMLİ: prototipte eski `IBM Plex Mono` kullanımlarının **tamamı** Rajdhani'ye çevrildi; yalnızca telemetri yapıştırma alanı monospace kaldı.)
- **Metin fontu:** `Inter` 400/500/600 — gövde metni, etiketler, açıklamalar.
- Ölçek: sayfa başlığı 22px/700 uppercase `.06em`; kart başlığı 14–16px/700 uppercase `.08em`; gövde 12.5–13px; etiket 10px uppercase `.1em`; KPI 20–36px/700; HUD sayıları `clamp(30px,3.2vw,44px)` – `clamp(38px,4.2vw,60px)`.
- Sayılarda `font-variant-numeric: tabular-nums`.

### Ölçüler
- Yarıçap: 7 (küçük düğme) · 8–9 (düğme/girdi) · 10–12 (kart) · 14–16 (pencere) · 99 (çip)
- Boşluk: 5 · 6 · 8 · 10 · 12 · 14 · 16 · 20
- Kenar: 1px `--line`; vurgulu 1px `--line-strong`; kalın vurgu 2px `--accent`
- Gölge: pencere `0 24px 70px rgba(0,0,0,.6)`; tepsi `0 16px 46px rgba(0,0,0,.55)`; panel `-18px 0 50px rgba(0,0,0,.5)`
- Sidebar genişliği 76px; sağ panel 320px; yarış datası paneli `min(400px,94vw)`

### Animasyonlar (keyframes)
| Ad | Süre / eğri | Kullanım |
| --- | --- | --- |
| `rcin` | .26s ease-out | ekran girişinde 10px aşağıdan belirme |
| `rcfade` | .18s ease-out | pencere zemini |
| `rcpop` | .22s `cubic-bezier(.2,.9,.3,1.05)` | pencere gövdesi |
| `rcpulse` | 1.2s infinite | canlı çipi noktası |
| `rcalert` | 2.6s infinite | sıradaki pit halkası (amber) |
| `rcpb` / `rcpbc` | 5s ease-out | kişisel (yeşil) / sınıf (mor) en iyi tur satır parlaması |
| `rcspin` | .8s linear | yükleme göstergesi |
| Panel kaymaları | .28–.32s `cubic-bezier(.4,0,.2,1)` | sidebar, sağ panel, karşılaştırma tepsisi |
| Geçişler | .15–.18s ease | hover, çip, nav düğmesi |
| `prefers-reduced-motion` | — | tüm animasyon/geçişler .01ms'e iner |

---

## Screens / Views

### 1. Ana Menü (`src/App.jsx` lobi bölümü)
**Amaç:** yarış seçimi ve uygulamaya giriş.
**Düzen:** tam genişlik, ortalanmış dar kutu YOK. Üstte takım şeridi (logo çipi + diğer takımlar + "Kur & katıl"), sağda kullanıcı. Ana blok iki kolon: solda sıradaki yarış hero'su (`flex:1 1 620px`), sağda 2×2 hızlı eylem ızgarası (`flex:1 1 280px`) + tam genişlik "Resmi yarışlar" satırı.
**Hero:** marka gradienti `radial-gradient(120% 150% at 100% 0,rgba(150,0,24,.30),#150E10 65%)`, 1px `#C51E38` çerçeve, 16px yarıçap. "SIRADAKİ YARIŞ · R3" 11px uppercase `.14em` `--accent`; yarış adı `clamp(34px,4vw,52px)` Rajdhani 700; künye 13px `--dim`; geri sayım üç kutu (gün/saat/dakika, 24px/700) + yerel saat kutusu; birincil düğme "YARIŞI AÇ →" (18px padding, `--car` zemin) ve ikincil "Spa setupları (3)". Sağ bölmede bayrak (44px) + pist çizimi (max 230px), sol çizgi ayracı `rgba(74,47,56,.6)`.
**Hızlı eylemler:** 4 kart (Setup havuzu, Telemetri, Sohbet, Takım & takvim) — 20px SVG ikon `--accent`, 15px Rajdhani başlık, 11px alt metin. Hover: `translateY(-2px)`, çerçeve `#6B4A52`.
**Takvim:** segment (Yaklaşan / Geçmiş) + sezon çipleri + arama. Satır: tur no (16px, `--muted`), bayrak 28px, pist çizimi 56×34 (opacity .8), yarış adı 17px/700, künye 11.5px, tarih (mono → Rajdhani), durum çipi (sıradaki = `--accent`, canlı = `--green`, planlı/bitti = `--line`), "Aç" düğmesi (sıradaki için `--car`).
**Boş durum:** takvim boşsa kesikli çerçeveli blok — takvim ikonu, "Bu sezonda yarış yok", "＋ Yarış ekle" ve "Resmi yarışlar" düğmeleri.

### 2. Yarış çubuğu (tüm yarış ekranlarında sticky)
`position:sticky; top:0; z-index:20`, `linear-gradient(180deg,#1A1013,#120C0E)`, alt çizgi `--line`.
Bloklar (dikey çizgi ayraçlı): (a) bayrak 34px + yarış adı 22px/700 + künye 11px; izleyici modunda altında ortalanmış amber rozet (göz ikonu 15px + "İZLEYİCİ MODU", 11px uppercase). (b) Bayrağa kalan — `clamp(38px,4.2vw,60px)`, altında 3px ilerleme çubuğu. (c) Sıradaki pit — amber `clamp(30px,3.2vw,44px)`, `rcalert` nabız halkası, altında stint/pilot. (d) Pozisyon — P9 + sınıf pozisyonu (sınıf renginde). (e) Enerji — yeşil yüzde + çubuk. (f) Sağ blok: tam genişlik canlı durum düğmesi (yeşil, nabızlı nokta, açılır köprü paneli) + eşit genişlikte "⚙ Yarış datası" (değişiklik sayısı amber rozet) ve "📟 Pit Board".

### 3. Dashboard (`src/tabs/DashTab.jsx`)
İki kolon. Sol: araç + pist görsel kartı (tıklanınca büyütme penceresi — araçta tempo referans tablosu: HOTLAP mor `#b06ffc`, ALIEN `#16a34a`, COMPETITIVE `#65a30d`, GOOD `#ca8a04`, `#d97706`, MIDPACK `#ea580c`, `#f05252`, TAIL-ENDER `#dc2626`, OFFLINE `#991b1b`), altında stint programı tablosu. Sağ: 4 KPI kutusu (kalan, strateji·tur, stint, sıradaki pit), canlı durum satırı, lastik kartı (kullanılan/kalan + set çubukları), son stint VE kartı (36px yeşil yüzde), pilot dağılımı (pilot renkli çubuklar). Başlıkta 🖨 PDF düğmesi.

### 4. Stint planı (`src/tabs/StintTab.jsx`)
Tablo: # · pilot (renkli avatar + ad, "PİSTTE" çipi) · bitiş · kalan (+/− renkli) · lastik ışıkları · FUEL · tamir süresi · pit · not.
**Lastik ışıkları (FL/FR/RL/RR):** tek düğme, tıklandıkça 5 durum döner — **sarı** `U` eski kuru tekrar (`#F5B23D`) → **mavi** `W` wet (`#4C9AFF`) → **yeşil** `N` yeni kuru (`#37D67A`) → **siyah** `✕` değişim yok (zemin `#000`, metin `--txt`, iç çerçeve `#F3EAEC55`) → **pasif** `→` (kesikli çerçeve `#4A2F38`, metin `#5C3B44`, opacity .6).
Alt şerit: 🔗 Canlı senkron (Oto PIT / Oto saat), sağda "↩ Geri al" ve büyük "✔ PIT — S2" düğmesi (`clamp(20px,2.6vw,30px)`). PIT işaretlenince sağ kolonda yeşil onay kartı: plan/gerçek/sapma + her pit için tamir süresi girdisi; düğme "⛽ PIT YOLUNDA" olup pasifleşir, drift çipi (⏱ +3s) çıkar.

### 5. Son Stint Yakıtı (`src/tabs/FuelTab.jsx`)
Sol kart (marka gradienti): "Yarış sonu" + 📋 Plan anahtarı (açıkken geri sayım salt okunur, opacity .7), seans geri sayımı 22px girdi, üç kutu (kalan tur + ham değer, tüketim, extra lap), Bolt ikonu (30px, `--green`) + `clamp(34px,5vw,52px)` gereken yüzde + "(+1 lap)", altında litre karşılığı ve formül.
Sağ: "⚡ Canlıdan öğren" (tüketim/tur, VE/tur, depo + "Yakıt modeline uygula") ve "Senaryolar" — Planlanan / Tasarruflu / Agresif, her satırda düzenlenebilir %/tur girdisi, hesaplanan yüzde ve plandan fark.

### 6. Canlı Timing (`src/tabs/LiveTab.jsx`)
**Saha tablosu** — sütun sırası: Poz · Pilot · Tur · Gap · Son tur · Sektör · AVG5 · Enerji · VE/tur · Lastik · Stint · Hasar · Incident · Pit · +.
- Başlıklar sticky (`--panel` zemin, z-index 2); **Gap ⇄ Aralık**, **Son tur ⇄ En iyi**, **AVG5 ⇄ AVG** başlıkları tıklanabilir (`--accent`, kesikli alt çizgi, "⇄").
- Poz: Rajdhani 26px (pit duvarı modu) / 18px; yanında sınıf-içi pozisyon yalnız rakam olarak sınıf renginde (çerçevesiz).
- Pilot: marka logosu 26/20px + ad Rajdhani 21/15px + alt satır `#num · takım · SINIF Pn`.
- Satır sol kenarı 4px sınıf rengi; kendi araç `rgba(150,0,24,.28)`; kişisel en iyi → `rcpb` (yeşil 5s), sınıf en iyi → `rcpbc` (mor 5s).
- Incident sütunu "1.5x" biçiminde çarpan olarak yazılır (rozet yok).
- Satıra tıklama → alt sabit karşılaştırma tepsisi (son tur, AVG5, S1–S3, enerji; delta renkli). Kendi satırı tıklanamaz.
- Yoğunluk anahtarı: **Pit duvarı** (16–26px, seyrek satır) ↔ **Mühendis** (12.5px, sık satır) — sütunlar her iki modda görünür, yalnız ölçek değişir. Yoğunluk YALNIZ bu ekranda; global anahtar kaldırıldı.
- Süzme: **yalnız "Poz · Sınıf" başlığı** — tıkla → kendi sınıfın (başlık kalın), tekrar tıkla → tüm saha. Sınıf çip şeridi KALDIRILDI (upstream v1.8.19 davranışı). Sektör sütunu gizlenebilir (👁 düğmesi).
- Satır sonundaki **+** → tur geçmişi penceresi: pilot rozeti, tur no, süre, delta, sektörler, asfalt sıcaklığı, tutuş yüzdesi (renk eşikli), zemin ıslaklığı kendi renginde; en hızlı mor zemin, pit/out amber, pilot değişimi yeşil çip.
- **Pozisyon grafiği**: son 12 tur, kendi araç kalın `--car`, rakipler CVD-güvenli palet, çizgi sonunda araç numarası, imleçle gezinme (dikey çizgi + baloncuk).
- **Boş durum:** köprü verisi yoksa üstü çizili sinyal ikonu + "Canlı veri gelmiyor" + yeniden bağlan / köprü durumu + son paket saati.
- Bayrak göstergesi: Yeşil ↔ "S2 · S3" (amber, nabızlı) — haritada ilgili sektör yayı amber.

**Sağ panel (320px, kayarak kapanır):** pist koşulları tek satır (bayrak → sıcaklık → yağış → zemin + ıslaklık yüzdesi → tutuş), pist haritası (dış konum halkası + iç devre şekli, sınıf renkli noktalar, sınıf-içi pozisyon, kendi araç beyaz + `--car` halka, S1/S2 ayırıcı, PIT IN yeşil / PIT OUT mavi çizgi, ⛶ büyütme), kendi araç kartı (en iyi/son tur, yakıt, stint, hız + vites + gaz/fren), strateji, lastik sıcaklık/basınç/aşınma.

### 7. Lastik (`src/tabs/TyreTab.jsx`)
Limit stepper + Kullanılan / Kalan / Stint / Wet KPI'ları (kalan eksiye düşerse kart kırmızı). Set envanteri (her setin kullanım sayısı + kilitli köşe, kullanım rengine göre). Köşe matrisi: hücreye tıkla → boş → yeni set → wet → boş; taşınan hücre italik "⟳ 3". Satır sonunda "⚡ Hızlı atama" penceresi: 4 yeni / 4 wet / Qual'a dön · 2 yeni ön/arka/sol/sağ · tek teker FL/FR/RL/RR (yetersiz set varsa pasif + "yetersiz · N kaldı"), "⟳ Öncekiyle devam", "✕ Satırı temizle". Uygulanan aksiyon satırda çip olarak kalır. Altta 7 maddelik renk lejantı; aynı setin farklı köşede kullanımı → kırmızı ihlal uyarısı + kalın çerçeve.

### 8. Pilotlar (`src/tabs/DriversTab.jsx`)
Pilot kartları (renkli avatar, toplam süre, stint sayısı, yüzde çubuğu, stint çipleri), donut dağılım + lejant, stint programı — her satırda **açılır liste** ile pilot ataması (avatar + ad + ✓; son iki satırda liste yukarı açılır). **Uygunluk penceresi** (kalıcılık: yarış başına Firebase — `teams/{tid}/races/{rid}/avail/{driverId}: [stintNo…]`, owner/editor yazar, izleyici okur): ızgara varsayılan olarak tüm hücreler uygun (yeşil ✓), tıklayınca kırmızı ✕; uygun değil işaretlenen pilot o stintin listesinde soluk, üstü çizili ve tıklanamaz, mevcut ataması otomatik kalkar; bir stintte hiç uygun pilot kalmazsa amber uyarı. **Boş durum:** kadro boşsa "＋ Üye davet et".

### 9. Telemetri (`src/tabs/TeleTab.jsx`)
Stint yuvaları A–D (dolu/boş, medyan tur 32px Rajdhani, marka logosu + araç görseli). "⬆ Telemetri yükle" penceresi: hedef yuva, sürükle-bırak, yapıştırma alanı (monospace), yükleme durumları (.ld çözümleniyor / DuckDB indiriliyor / hata), yüklü dosya listesi (tür rozeti, boyut, atandığı yuva, sil).
Stint analizi: **tur tur** çizgi grafiği (her turda nokta + iki turda bir süre etiketi) ↔ **kutu grafiği** (Q1–Q3 kutusu, kalın medyan + süre, bıyıklarda en iyi/en kötü, tur noktaları, altta medyan/en iyi/IQR/yayılım kartları). Üç KPI (fark, medyan VE, aşınma) Rajdhani 26px.
Çözümlenen turlar tablosu + sütun eşleme paneli + %105 filtresi + "Stint X olarak kaydet". Seans kartı (araç + pist görseli, marka gradienti, pist/araç/pilot/sıcaklık/tur).
**Tur karşılaştırma:** A/B kaynak + tur seçimi, Δ rozeti, sektör rozeti, ▶/⏸ + 0.5×/1×/2× + kaydırıcı (60ms tick, hız çarpanı), imleç değer paneli (hız/gaz/fren/vites/RPM/direksiyon, A/B + fark), mini pist haritası (delta renkli segment: A hızlı `#ff5470`, B hızlı `#4d9fff`, nötr `#7a8797`; S/F + sektör çizgileri, numaralı apex'ler, imleç noktası, ⛶ büyütme), 7 kanal izi (zaman-delta alanı: üstü kırmızı, altı mavi dolgulu; hız, gaz, fren, vites, RPM, direksiyon), sektör farkı ve viraj analizi tabloları, 📄 PDF. Fare ile gezinme, tekerlekle yakınlaştırma (imleç sabit, min 30 örnek), ← → adım (Shift ×10), Space oynat.

### 10. Setup Havuzu (`src/App.jsx` + `SetupTable`/`SetupCards`)
Filtre çipleri + sıralama (Tur / Tarih / Yükleyen, ▲▼) + görünüm anahtarı ⊞/☰.
**Kart görünümü:** pist bazlı gruplar; kartta arka planda maskeyle şeffaflaşan pist çizimi (`mask-image: linear-gradient(200deg,...)`, opacity .16) ve önde araç görseli; tur süresi 36px (sınıf en hızlısı yeşil), koşul çipi, marka+sınıf+araç, dosya adı, yükleyen/tarih, ★ favori, sürüm rozeti, ⚖ / İçerik / İndir. Hover `translateY(-3px)`.
**Liste görünümü:** ızgara `26px minmax(120px,1.2fr) 96px 1fr 92px 88px 168px` — yıldız, dosya + sürüm rozeti + not, sabit 62px koşul çipi, araç, tur, yükleyen, işlemler; favoriler amber zeminli, seçili satır marka renginde.
**Setup yükle penceresi:** sürükle-bırak + canlı önizleme kartı (pist çizimi + araç + bayrak), bayraklı pist ızgarası, koşul (Kuru/Wet) ve seans (Yarış/Sıralama) segmentleri, sınıf/araç, şampiyona · LMU sürümü · tur zamanı · **pilot** (kadrodan otomatik tamamlama) · not, dosya seçilince mor "✨ Dosyadan algılandı" bildirimi.
**Setup içeriği penceresi:** künye şeridi (bayrak, pist, araç görseli, yükleyen · şampiyona · sürüm, en iyi tur), amber not şeridi, "Öne çıkanlar" 4 sütunlu ızgara (ön/arka çiftleri tek kutuda "52 / 68 mm"; TC, TC Cut, TC Slip Angle, ABS), kategori çipleri (boş kategoriler gizli), kategori kartları (Aero, Lastik, Süspansiyon, Geometri, Fren, Diferansiyel, Elektronik, Motor & yakıt) — ön/arka aynıysa tek değer, **asimetrikse** "sol / sağ" ve satır başlığında amber "SOL/SAĞ" rozeti.
**Karşılaştırma penceresi:** iki setup başlığı (A kırmızı / B mavi zemin, tur farkı), "N alan farklı · M alan aynı", "Yalnız farklar" anahtarı, fark satırları (sol amber işaret, A → B, sayısal delta), kategori başlığında fark sayısı, "Farkları kopyala".
**Boş durum:** filtre sonuç vermezse duruma göre başlık + "İlk setupu yükle" / "Filtreleri temizle".

### 11. Takım (`TeamModal` yerine tam sayfa)
**Not — tam sayfaya taşınanlar:** Takım · Sohbet · Telemetri · Setup havuzu. Dördü de modal kabuğundan çıkar, sol raydan erişilen ekran olur; App.jsx'te tek yönlendirme, tarayıcı geri tuşu ve Tauri aynı davranır.

Sol: logo yükleme alanı (140×140 kesikli, sürükle-bırak etiketi, Değiştir/Kaldır, format notu), takım adı + künye, katılım kodu kartı, araç görselleri kartı (sınıf/araç seçimi + side/top önizleme + varsayılan notu).
Sağ: üye tablosu (avatar, rol çipi, 🛞/🎧 yetki düğmeleri, son görülme, ⋯ menüsü: sahipliği devret / yeniden davet / çıkar), sezon takvimi (sezon çipleri + ＋ Sezon + ✎ Sezonu düzenle + ＋ Yarış ekle; satırda ▲▼✎✕ ve Aç), takım hareketleri akışı (renkli ikon + kim/ne/zaman), tehlikeli işlemler (ayrıl = amber, takımı sil = kırmızı).
**Davet penceresi:** katılım kodu kartı (32px kod, kopyala→"✓ Kopyalandı", yenile), davet bağlantısı, e-posta + rol seçimi (🛞/🎧, seçime göre açıklama), bekleyen davetler (gönderim zamanı, süre, rol, tekrar gönder / iptal).
**Sezon düzenleme penceresi:** ad/yıl/varsayılan sınıf, yarış listesi (ad yerinde düzenlenebilir, ▲▼✕, canlı vurgulu), ＋ Yarış ekle, "Sezonu sil".

### 12. Sohbet (`ChatPanel`)
İki kolon: kanal listesi (ikon, ad, okunmamış rozeti, son mesaj önizlemesi, saat) + konuşma (baloncuklar 14.5px, kendi mesajlar marka tonunda sağda, 500 karakter sayaçlı yazma alanı). **Boş durum:** "Henüz mesaj yok — ilk yazan sen ol."

### 13. Resmi Yarışlar (`src/tabs/ScheduleTab.jsx`)
Sıradaki yarış hero'su + geri sayım + toplam/yaklaşan/canlı sayaçları; **güne göre** gruplu liste (Bugün / Yarın / tarih): saat 16px, bayrak + pist çizimi, yarış adı 17px, seri ve sınıf çipleri, SR rozeti (A mor, B+ mavi), geri sayım, "📋 Planla"; canlı satır yeşil zemin + nabız çipi, sıradaki marka zemininde. Seri çipleriyle süzme çalışır.

### 14. Yarış Datası Paneli (sağdan kayan, tüm yarış ekranlarında)
`min(400px,94vw)`, `translateX(102%) → 0`, .28s. Bölümler: Race Time · Avg Lap (+ "⚡ Canlı AVG5 — uygula") · Seçili strateji A–D + pit sayıları (stepper) · Multiclass (sınıf açılır listesi: logo + ad + ✓, seçili sınıfın tur zamanı girdisi) + Extra lap · Yarış başlangıcı (datetime + hesaplanan bitiş) · Hava durumu (5 zemin ikonu + çarpan) · Pit süreleri (pit line, yakıt & VE, lastik limiti) · Sanal enerji (VE kullanımı, yakıt oranı, "%100 = 86.0 L") · "Bu değişiklik neyi etkiler" listesi. Alt şerit: "N alan değişti" + Geri al + Uygula. Sayısal alanlarda − / + stepper (tam sayı veya 0.01 adım).

### 15. Pit Board (tam ekran)
Büyük geri sayım, pilot, sıradaki pit, pozisyon; uzaktan okunacak ölçekte.

### 16. PDF Raporu (Dashboard → 🖨 PDF)
A4 (794px) beyaz sayfa önizlemesi + araç çubuğu (Yazdır / PDF indir / kapat).
Sayfa: logo + "2026 WEC · Round 3" (10px uppercase `.12em`) → "6H SPA" (26px, `--car`) → künye; araç + pist görselli şerit (`#FAF7F8` zemin, pist çizimi `invert(1) brightness(.35)`); 4 KPI; stint planı tablosu (güncel stint `#FBEEF1`); pilot dağılımı / yakıt & lastik / koşullar kolonları; mühendis notu (sol 3px `--car` kenar); altlık (sürüm, oluşturma, sayfa no).
Kâğıt paleti: metin `#151013`, ikincil `#5B5157`, üçüncül `#7A6F75`, çizgi `#E3DDDF` / `#EDE8E9`, vurgu `#960018`.

### 17. Rehber kutuları
Her ekranın üstünde tek satırlık ipucu bloğu (`rgba(181,139,255,.07)` zemin, `--line-strong` çerçeve): başlık 14px Rajdhani + açıklama 11.5px. İkon ve kapatma düğmesi yok. Metinler `GUIDES` sözlüğünde ekran kimliğine göre tutulur.

### 18. İzleyici modu
Rol `driver` olduğunda: yarış çubuğundaki yarış kutusunun altında ortalanmış amber rozet (göz ikonu + "İZLEYİCİ MODU"); Stint'te PIT ve oto-senkron pasif, Lastik'te atama ve temizleme kapalı, Yakıt'ta girdiler ve "uygula" pasif (+"👁 İzleyici modunda pasif" notu), Yarış datası panelinin gövdesi `opacity:.5; pointer-events:none`. Başka hiçbir yerde açıklama metni yok.

---

## Interactions & Behavior
- **Gezinme:** sol ray (76px) — Menü / Takım / Dash / Stint / Yakıt / Canlı / Lastik / Pilot / Tele / Setup, altta Sohbet + sürüm. Ray tıklamayla kayarak gizlenir (‹ / açma tırnağı).
- **Ekran geçişi:** `rcin` .26s (fade + 10px yükselme).
- **Pencereler:** zemin `rcfade`, gövde `rcpop`; dışa tıklama ve ✕ ile kapanır; katman sırası — normal pencere 1000, iç içe açılan (davet/sezon/karşılaştırma) 1010, PDF 1040, yarış ekle 1030, yarış datası paneli 45 (zemin 40).
- **Klavye:** Ctrl/Cmd+K komut paleti, Esc kapatma; Telemetri'de ← → imleç adımı (Shift ×10), Space oynat/duraklat.
- **Hover:** tablo satırı `rgba(255,255,255,.05)`; setup kartı `translateY(-3px)` + çerçeve `#6B4A52`; hızlı eylem kartı `translateY(-2px)`, basınca geri.
- **Sabit tepsi:** rakip seçilince alttan kayarak gelen karşılaştırma tepsisi (`translate(-50%,140%) → 0`).
- **Yükleme:** dönen gösterge + ilerleme çubuğu (`rcspin`), üç durum (.ld çözümleniyor / DuckDB indiriliyor / hata).

## State Management
Prototipteki durum değişkenleri (hedefte mevcut `st` / context yapısına bağlanmalı):
`screen` (ekran), `rail`/`side` (panel açık/kapalı), `density` (wall|engineer), `gapMode`, `lapMode`, `avgMode`, `sec` (sektör sütunu), `clsFilter`, `cmpCar` (karşılaştırma), `lapsFor` (tur geçmişi), `flagIdx`, `demo`, `feed` (canlı veri var/yok), `s1t` + `pitT` (lastik ışıkları), `tyGrid`/`tyLimit`/`tyTags`, `assign`/`avail` (pilot atama + uygunluk), `slot`/`teleCur`/`playing`/`pSpeed`/`zoom`/`f105`/`colMap`/`impSlot`/`impState` (telemetri), `poolFilter`/`poolSort`/`poolDir`/`poolView`/`stars`/`cmp` (setup havuzu), `svView`/`svCat`/`diffModal`/`diffOnly` (setup içeriği/karşılaştırma), `suModal`+`suTrack`/`suCond`/`suSess` (setup yükleme), `rd`/`rdN`/`rdWx`/`rdCls` (yarış datası paneli), `invModal`/`invRole`, `seasonModal`, `raceModal`/`rTrack`/`qual`, `pdf`, `pb` (pit board), `readOnly` (izleyici), `guide`, `scen` (yakıt senaryoları), boş durum anahtarları (`teleEmpty`, `calEmpty`, `chatEmpty`, `drvEmpty`).

## Assets
Tümü mevcut projeden (`public/assets/`), prototipe kopyalandı — yeni asset üretilmedi:
`logo.png` · `flags/*.png` · `tracks/*.png` · `class/{hypercar,lmp2,lmp3,gt3,gte}.png` · `brands/*.png` · `cars/<class>/<brand>.png` · `tyre-compound/{soft,medium,hard,wet}.png`
İkonlar: `src/components.jsx` içindeki `ICON_PATHS` (Lucide tabanlı) ve `WetIcon`/`GripIcon` SVG'leri birebir kullanıldı.

## Files
| Dosya | İçerik |
| --- | --- |
| `Yeni Tasarım.dc.html` | **Ana teslim** — yeni arayüzün tamamı, tıklanabilir |
| `Mevcut Arayüz.dc.html` | Mevcut arayüzün birebir kopyası (karşılaştırma referansı) |
| `Mevcut Ana Menü.dc.html` | Mevcut lobinin birebir kopyası |
| `github.md` | Repo bağlantısı + ekran → kaynak dosya eşlemesi + sync geçmişi |
| `ARAYUZ-YENILEME-PROMPT-v2.md` | **Uygulama talimatı** — kararlar netleşmiş sürüm (v1'e göre değişenler tablosu dahil) |
| `i18n-EN.md` | Yeni/değişen tüm metinlerin EN karşılıkları (mühendis buradan girer) |
| `i18n EN Sözlüğü.dc.html` | Aynı sözlüğün önizlenebilir hali |
| `public/assets/**` | Kullanılan görseller |
| `support.js` | Prototip çalışma zamanı (üretime taşınmaz) |

## Screen map (hangi ekran hangi kaynak dosyaya)
| Yeni ekran | Hedef dosya(lar) |
| --- | --- |
| Ana Menü | `src/App.jsx` (lobi bölümü, `RaceRow`) |
| Yarış çubuğu / kabuk | `src/App.jsx` (header + teambar + HUD), `src/styles.js` |
| Dashboard | `src/tabs/DashTab.jsx` |
| Stint planı | `src/tabs/StintTab.jsx` |
| Son Stint Yakıtı | `src/tabs/FuelTab.jsx` |
| Canlı Timing | `src/tabs/LiveTab.jsx`, `src/tabs/StrategyBar.jsx`, `src/tabs/PosChart.jsx`, `src/tabs/TrackMap.jsx` |
| Lastik | `src/tabs/TyreTab.jsx` |
| Pilotlar | `src/tabs/DriversTab.jsx` |
| Telemetri | `src/tabs/TeleTab.jsx`, `src/ldTrace.js`, `src/corners.js` |
| Setup havuzu + pencereler | `src/components.jsx` (`SetupForm`, `SetupTable`, `SetupCards`), `src/setupParse.js`, `src/setupPool.js` |
| Takım + davet + sezon | `src/components.jsx` (`TeamModal`, `CreateJoinModal`, `RaceEditModal`), `src/storage.js` |
| Sohbet | `src/components.jsx` (`ChatPanel`) |
| Resmi Yarışlar | `src/tabs/ScheduleTab.jsx`, `src/lmuSchedule.js` |
| Yarış datası paneli | `src/App.jsx` (`dataCards` bölümü) |
| Rehber kutuları | `src/components.jsx` (`TourOverlay` yerine ekran içi statik ipucu) |
| PDF raporu | yeni — `DashTab` içinden tetiklenir |

## Yapılmayanlar / açık kalanlar
1. **Tablet ve 1080p altı genişlikler** — tasarım geniş ekrana göre kurgulandı; saha tablosu ve iki kolonlu ekranlar 1024px altında denenmedi.
2. ~~EN çevirileri~~ **teslim edildi** → `i18n-EN.md` (10 bölüm + terim kararları). Mühendis çeviri üretmez; listede olmayan metin çıkarsa sorar. Uzun EN metinlerinde sabit genişlikli sütunlar kontrol edilmeli.
3. **Büyük Pano** (tam ekran canlı pano) — kullanıcı isteğiyle atlandı; düğmesi duruyor.
4. **Pilot sürüş süresi kuralı** (maksimum sürekli / toplam süre limitleri ve aşım uyarısı) — tasarlanmadı.
5. Erişilebilirlik: klavye odak halkaları ve ekran okuyucu etiketleri gözden geçirilmeli.
6. **Açık tema** — v2.0 tek koyu temayla çıkar; açık palet üretilmedi, header ☀/🌙 gizlenir (kod silinmez).

## Sürüm
Taban: `main` @ v1.8.20. Dal: `claude/arayuz-v2`. Teslim: main'e **v2.0.0** olarak merge (package.json + APP_VERSION + changelog kaydı).
