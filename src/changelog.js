/* ============================================================
   SÜRÜM NOTLARI — uygulama içi "ℹ Neler değişti" penceresi
   En yeni sürüm en üstte olacak şekilde ekle.
   APP_VERSION (App.jsx) buradaki ilk kaydın "v" alanıyla aynı olmalı.
   ============================================================ */
export const CHANGELOG = [
  {
    v: "v1.4.17",
    date: "2026-07-30",
    tr: [
      "🔒 Canlı Timing sekmesi şimdilik yalnız site adminlerine görünür (test aşaması) — tamamlanınca tüm takım üyelerine açılacak",
    ],
  },
  {
    v: "v1.4.16",
    date: "2026-07-30",
    tr: [
      "📈 Tur zaman listesi (satır sonu '+') artık tüm yarışı kapsıyor — 50 tur sınırı kalktı. Tur geçmişi canlı kareden ayrılıp kalıcı bir düğüme her tur bir kez yazılıyor; '+' açılınca yalnız o aracın tüm turları yükleniyor (300+ tur sorunsuz). Canlı kare küçük kaldığı için Firebase kotası da korunuyor",
    ],
  },
  {
    v: "v1.4.15",
    date: "2026-07-30",
    tr: [
      "➕ Canlı Timing saha tablosunda her aracın satır sonuna '+' butonu — tıklayınca o aracın o ana kadar attığı tüm turların zaman listesi küçük bir pencerede açılır (en yeni üstte; en hızlı tur mor, out/pit turu soluk sarı, best'e göre fark)",
      "ℹ️ Not: liste köprü çalışmaya başladığından itibaren tamamlanan turları içerir (oyunun paylaşımlı belleği geçmiş turların tamamını vermez); köprü yeniden başlarsa liste sıfırlanır",
    ],
  },
  {
    v: "v1.4.14",
    date: "2026-07-30",
    tr: [
      "⏱ Canlı Timing'e AVG 5 (son 5 turun ortalaması), AVG (genel tur ortalaması) ve Stint (mevcut stint süresi) eklendi — hem saha tablosunda hem Kendi Araç kartında",
      "🧮 Bu üç değer köprüde (oyunun PC'sinde) tur-tur biriktirilerek hesaplanır → tüm takım için tutarlı; web geç açılsa/yenilense de doğru gelir. Out-lap ve pit turları ortalamadan elenir; stint süresi pit çıkışında sıfırlanır",
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
  },
  {
    v: "v1.4.12",
    date: "2026-07-30",
    tr: [
      "🛞 Canlı Timing'e eksik veriler eklendi: kendi aracın lastik bileşimi (soft/medium/hard) ve pit durak sayısı; saha tablosunda her araç için pit durak sayısı ve pozisyon değişim okları (▲ yükseldi / ▼ düştü)",
      "🖥️ 'Büyük Pano' (tam ekran) modu — timing'i uzaktan okunur büyük yazıyla göster; pit duvarında takımın izlemesi için",
    ],
  },
  {
    v: "v1.4.11",
    date: "2026-07-30",
    tr: [
      "📊 Canlı Timing zenginleştirildi: sınıf-içi pozisyon (Pn, sarı = sınıf lideri), 'Kendi sınıfım' filtresi, öndeki araca 'Aralık' sütunu, tur-altı araçlar için '+n Tur', seansın en hızlı turu tek araçta mor vurgu ve satır sol kenarında sınıf renk şeridi",
      "🏎 Kendi Araç kartına: mevcut tur canlı sayacı + S1/S2 sektörleri, PIT rozeti ve mevcut yakıtla ~kaç tur kaldığı tahmini (canlıdan öğrenilen tüketimle)",
    ],
  },
  {
    v: "v1.4.10",
    date: "2026-07-30",
    tr: [
      "🏷 Canlı Timing sınıf sütununda artık uygulamanın kendi renkli rozet vektörleri (HY / P2 / P3 / GTE / GT3) kullanılıyor — pist/araç seçim ekranıyla birebir aynı görsel dil",
    ],
  },
  {
    v: "v1.4.9",
    date: "2026-07-30",
    tr: [
      "🎨 Canlı Timing tablosunda sınıf (SINIF) çipleri artık kategoriye göre renkli: Hypercar kırmızı, LMP2 mavi, LMP3 mor, GTE amber, LMGT3/GT3 yeşil — sahayı sınıflara göre tek bakışta ayırt edersin",
    ],
  },
  {
    v: "v1.4.8",
    date: "2026-07-30",
    tr: [
      "🈶 Masaüstünde 'Canlı Köprü' UTF-8 hatası düzeltildi (invalid utf-8 sequence) — köprü çıktısı Windows Türkçe kodlaması yüzünden bozuluyordu, artık UTF-8'e zorlanıyor. Mock test ve gerçek canlı köprü sorunsuz başlıyor",
    ],
  },
  {
    v: "v1.4.7",
    date: "2026-07-30",
    tr: [
      "🛠 Masaüstünde 'Canlı Köprü Başlat' hatası düzeltildi (Command plugin:shell|spawn not allowed by ACL) — köprü izni eksikti, eklendi. Artık mock test ve gerçek canlı köprü başlıyor",
    ],
  },
  {
    v: "v1.4.6",
    date: "2026-07-30",
    tr: [
      "🧹 Ayrı 'Canlı Timing Köprüsü (.exe)' indirme butonu kaldırıldı — canlı timing artık Masaüstü Uygulamasının içinde. Canlı sekmesi ve lobi, oyunun PC'sine Masaüstü Uygulamasını kurup 'Canlı Köprü Başlat' demeye yönlendiriyor (config.ini / bot hesabı gerekmez)",
    ],
  },
  {
    v: "v1.4.5",
    date: "2026-07-30",
    tr: [
      "🖥️ Masaüstü uygulaması artık kapatınca tamamen kapanmıyor: pencereyi (X) kapatınca Windows sistem tepsisine (saatin yanı) küçülüp arka planda çalışmaya devam ediyor — yanlışlıkla kapatıp canlı köprünün veri akışını kesme riski yok. Tepsi ikonuna tıklayınca geri gelir; gerçekten kapatmak için ikona sağ tık → 'Çıkış'. Ayrıca menüde 'Windows açılışında başlat' seçeneği (isteğe bağlı, varsayılan kapalı)",
    ],
  },
  {
    v: "v1.4.4",
    date: "2026-07-30",
    tr: [
      "🛰 Canlı köprü artık masaüstü uygulamasının içinde: oyunun olduğu PC'de uygulamayı aç, giriş yap, yarışı aç, 'Canlı' sekmesinden tek tuşla 'Canlı Köprü Başlat'. Ayrı .exe indirmeye, bot hesabına ve izin listesine (bridgeBots) GEREK YOK — veri senin oturumunla yazılır. Takımın geri kalanı web/masaüstünden canlı timing'i anında görür",
    ],
  },
  {
    v: "v1.4.3",
    date: "2026-07-30",
    tr: [
      "🖥️ Masaüstü uygulaması Google girişi tamamen yenilendi: giriş artık uygulamanın içinde değil, senin VARSAYILAN sistem tarayıcında açılıyor; onayladıktan sonra otomatik olarak uygulamaya dönüyor (güvenli loopback + PKCE). Gömülü tarayıcı popup/redirect'i engellediği için giriş başa dönüyordu, bu sorun giderildi",
    ],
  },
  {
    v: "v1.4.1",
    date: "2026-07-30",
    tr: [
      "🖥️ Masaüstü uygulaması: Google ile giriş artık açılır pencere (popup) yerine yönlendirme (redirect) ile yapılıyor — WebView2 popup'ı engellediği için giriş açılmıyordu, düzeltildi",
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
