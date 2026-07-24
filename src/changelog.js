/* ============================================================
   SÜRÜM NOTLARI — uygulama içi "ℹ Neler değişti" penceresi
   En yeni sürüm en üstte olacak şekilde ekle.
   APP_VERSION (App.jsx) buradaki ilk kaydın "v" alanıyla aynı olmalı.
   ============================================================ */
export const CHANGELOG = [
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
      "Rozetler: 👑 Takım Sahibi, 🏎 Sürücü, 📐 Yarış Mühendisi — bir üyeye birden fazla rozet atanabilir",
      "Kayıtta Ad Soyad soruluyor; isim profilden değiştirilebiliyor ve stint programında görünüyor",
    ],
    en: [
      "Team system: create a team or join with a code, with member roles (owner / editor / viewer)",
      "Room codes and PINs removed — access now comes from team membership",
      "Seasons and a race calendar: set up a race in advance with track, car, duration and start time",
      "The lobby lists upcoming races and opens them in one click — no more re-picking track and car",
      "Badges: 👑 Team Owner, 🏎 Driver, 📐 Race Engineer — a member can hold several at once",
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
