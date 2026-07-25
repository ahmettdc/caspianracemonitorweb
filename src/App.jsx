import { useState, useMemo, useEffect, useRef, Fragment } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ResponsiveContainer } from "recharts";
import { firebaseReady, touchUserProfile, watchUserDoc,
  requestAccess, watchAllUsers, setUserAllowed, updateProfile,
  createTeam, joinTeam, watchMyTeams, watchTeam,
  setTeamRole, toggleTeamBadge, leaveTeam, setTeamMemberName,
  sendChat, watchChat, deleteChat, renameTeam, syncMyTeamName,
  createSeason, deleteSeason, watchSeasons,
  createRace, updateRace, deleteRace, watchRaces,
  raceStateGet, raceStateSet, raceStateSubscribe } from "./storage";
import { signInGoogle, signOut, watchAuth, authReady } from "./auth";
import { CHANGELOG } from "./changelog";

/* ============================================================
   CASPIAN MOTORSPORT — RACE MONITOR  ·  Faz 2
   Faz 2: Yarış odası + gerçek zamanlı takım senkronizasyonu.
   - Oda verisi paylaşımlı depoda "room:KOD" anahtarında tutulur
   - Yazma: değişiklikten 800ms sonra (debounce), rev sayacı ile
   - Okuma: 3 sn'de bir poll; uzak rev daha yeniyse uygula
   - Çakışma: son yazan kazanır (last-write-wins)
   Faz 1 çekirdeği (aşağıda) değişmedi:
   Excel V1.28 hesap mantığının birebir taşınması:
   - STINT: stint süresi = tur × ort. tur süresi (veya manuel override)
     pit = (yakıt? F9) + (pit lane? F8) + lastik sayısı × F10
   - CODE80: aynı motor, lastik süresi F10/4
   - SON STİNT YAKITI: kalan tur = countdown / tur süresi
     yakıt = (kalan tur + extra lap) × tüketim
   - TOPLAM TUR: stint sayısı × stint turu × traffic error rate
   Tüm durum tek bir JSON objesinde tutulur (Faz 2 senkronizasyona hazır).
   ============================================================ */

/* ---------- zaman yardımcıları ---------- */
const parseHMS = (s) => {
  if (!s) return 0;
  const p = String(s).trim().split(":").map((x) => parseFloat(x.replace(",", ".")) || 0);
  if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
  if (p.length === 2) return p[0] * 60 + p[1];
  return p[0] || 0;
};
const parseLap = (s) => {
  // "3:59.50" veya "3:59,50" → saniye
  if (!s) return 0;
  const t = String(s).trim().replace(",", ".");
  const p = t.split(":");
  if (p.length === 2) return (parseFloat(p[0]) || 0) * 60 + (parseFloat(p[1]) || 0);
  return parseFloat(t) || 0;
};
const fmtHMS = (sec) => {
  const neg = sec < 0;
  let s = Math.abs(Math.round(sec));
  const h = Math.floor(s / 3600); s -= h * 3600;
  const m = Math.floor(s / 60); s -= m * 60;
  return `${neg ? "-" : ""}${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};
const msToLocalInput = (ms) => {
  // epoch → izleyicinin yerel saatinde datetime-local metni (YYYY-MM-DDTHH:MM)
  if (!ms || isNaN(ms)) return "";
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const fmtLap = (sec) => {
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, "0")}`;
};

/* ---------- varsayılan durum (Excel'deki mevcut değerler) ---------- */
const DEFAULT_STATE = {
  raceTime: "2:24:00",
  avgLap: "3:59.50",
  strategies: { A: 8, B: 9, C: 10, D: 11 },
  chosen: "D",
  multiclass: false,   // multiclass yarış — lider bitiş modeli devrede
  leaderClass: "hypercar", // multiclass'ta en hızlı sınıf
  streamUrl: "",       // canlı yayın (YouTube) linki
  weather: "dry",      // en güncel hava (seçici vurgusu için; asıl kaynak weatherLog)
  weatherLog: [],      // kronolojik hava: [{ t: yarış-göreli sn, w }] — boş = tüm dry
  leaderLap: "",       // lider tur zamanı (competitive) — yarış sonu bayrağı bundan
  pitLaneTime: 22,
  fuelTime: 42,
  actualPits: [], // gerçekleşen pit giriş zamanları (ms) — canlı plan düzeltme
  pitRepairs: [], // işaretli pit başına manuel tamir süresi (sn) — plan pit süresine eklenir
  autoOvr: [],    // pit tuşuyla otomatik yazılan override'ların işareti (geri al/sıfırla için)
  // --- pist & araç seçimi ---
  track: "",        // TRACKS id
  carClass: "",     // "hypercar" | "gt3"
  car: "",          // CARS[carClass] id
  // --- Virtual Energy sistemi (LMU) ---
  // Depo her zaman %100 VE'dir. Gerçek yakıt = VE% × fuelRatio.
  // Örn: ratio 0.84 → %100 = 84.0 L taşınan yakıt.
  fuelRatio: 0.86,     // L / %1 — gerçek yakıt karşılığı
  consumption: 8.97,   // %/tur — virtual energy tüketimi
  extraLap: 1,
  lastStintCountdown: "0:08:10",
  code80TimeLeft: "1:48:30",
  code80LastStint: "0:18:11",
  // Faz 3 — lastik stratejisi
  tyreLimit: 26,
  tyreQual: ["1", "2", "3", "4"],
  tyreStints: Array.from({ length: 14 }, () => ["", "", "", ""]),
  // Faz 3 — pilotlar
  raceStartMs: Math.floor(Date.now() / 60000) * 60000, // mutlak epoch — her istemci kendi yerelinde gösterir
  roster: [],
  driverAssign: Array.from({ length: 14 }, () => ""),
  // stint başına pit ayarları (index 0 = 1. pit)
  pits: Array.from({ length: 14 }, () => ({
    fuel: true, lane: true, tyres: [false, false, false, false],
  })),
  overrides: Array.from({ length: 14 }, () => ""), // opsiyonel stint süresi "hh:mm:ss"
  stintLaps: Array.from({ length: 14 }, () => ""), // opsiyonel stint ort. tur "m:ss.00"
  // Faz 4 — telemetri (MoTeC)
  telemetry: { A: null, B: null, C: null, D: null },
};

/* ---------- Faz 4: MoTeC telemetri ayrıştırma ---------- */
const SLOT_COLORS = { A: "#40D68C", B: "#F0604D", C: "#F2A33C", D: "#6694FF" };

/* ---------- pist & araç seçimi ---------- */
const APP_VERSION = "v1.3";   // tek kaynak — sürüm yazısı buradan
const REPO_URL = "https://github.com/ahmettdc/caspianracemonitorweb";
const SEEN_VER_KEY = "rm_seen_version";
const ASSET = import.meta.env.BASE_URL + "assets/";
const AV = "?v=3"; // görsel sürümü — dosya güncellenince artır (önbellek kırma)
const TRACKS = [
  { id: "lemans", name: "Le Mans" },
  { id: "spa", name: "Spa-Francorchamps" },
  { id: "spa-endurance", name: "Spa (Endurance)" },
  { id: "monza", name: "Monza" },
  { id: "imola", name: "Imola" },
  { id: "silverstone", name: "Silverstone" },
  { id: "paulricard", name: "Paul Ricard" },
  { id: "portimao", name: "Portimão" },
  { id: "barcelona", name: "Barcelona" },
  { id: "bahrain", name: "Bahrain" },
  { id: "lusail", name: "Lusail" },
  { id: "fuji", name: "Fuji" },
  { id: "cota", name: "COTA" },
  { id: "sebring", name: "Sebring" },
  { id: "interlagos", name: "Interlagos" },
  { id: "daytona", name: "Daytona" },
  { id: "lagunaseca", name: "Laguna Seca" },
  { id: "watkinsglen", name: "Watkins Glen" },
  { id: "roadatlanta", name: "Road Atlanta" },
  { id: "longbeach", name: "Long Beach" },
  { id: "indianapolis", name: "Indianapolis" },
];
/* Pit yolu geçiş süreleri (sn) — LMU Endurance Planner v1.3 verisi.
   Pist seçilince pitLaneTime otomatik bu değere ayarlanır (elle değiştirilebilir).
   Listede olmayan pistlerde (Daytona vb.) mevcut değer korunur. */
const PIT_LANE_TIMES = {
  bahrain: 27, cota: 23, fuji: 33, imola: 34, interlagos: 27,
  lemans: 31, lusail: 28, monza: 28, portimao: 31, sebring: 32,
  silverstone: 23, spa: 21, "spa-endurance": 53, paulricard: 23, barcelona: 23,
};
/* Layout varyantları için görsel eşlemesi (spa-endurance → spa görselleri) */
const TRACK_ASSET = (id) => ({ "spa-endurance": "spa" }[id] || id);
const CARS = {
  hypercar: [
    { id: "toyota", name: "Toyota GR010" },
    { id: "ferrari", name: "Ferrari 499P" },
    { id: "porsche", name: "Porsche 963" },
    { id: "cadillac", name: "Cadillac V-Series.R" },
    { id: "bmw", name: "BMW M Hybrid V8" },
    { id: "alpine", name: "Alpine A424" },
    { id: "peugeot", name: "Peugeot 9X8" },
    { id: "astonmartin", img: "aston", name: "Aston Martin Valkyrie" },
    { id: "lamborghini", name: "Lamborghini SC63" },
    { id: "isotta", name: "Isotta Fraschini Tipo 6" },
    { id: "glickenhaus", name: "Glickenhaus SCG 007" },
    { id: "vanderwell", name: "Vanwall Vandervell 680" },
    { id: "genesis", name: "Genesis GMR-001" },
  ],
  lmp2: [
    { id: "oreca", img: "oreca07", name: "Oreca 07 Gibson" },
  ],
  lmp3: [
    { id: "ligier", name: "Ligier JS P320" },
    { id: "duqueine", name: "Duqueine D08" },
    { id: "adess", name: "ADESS AD25" },
  ],
  gte: [
    { id: "ferrari", name: "Ferrari 488 GTE Evo" },
    { id: "porsche", name: "Porsche 911 RSR-19" },
    { id: "aston", name: "Aston Martin Vantage AMR" },
    { id: "corvette", name: "Corvette C8.R" },
  ],
  gt3: [
    { id: "ferrari", name: "Ferrari 296 GT3" },
    { id: "porsche", name: "Porsche 911 GT3 R" },
    { id: "bmw", name: "BMW M4 GT3" },
    { id: "mercedes", name: "Mercedes-AMG GT3" },
    { id: "mclaren", name: "McLaren 720S GT3" },
    { id: "corvette", name: "Corvette Z06 GT3.R" },
    { id: "lexus", name: "Lexus RC F GT3" },
    { id: "ford", name: "Ford Mustang GT3" },
    { id: "aston", name: "Aston Martin Vantage GT3" },
  ],
};
/* ---------- i18n: Türkçe metin anahtar, EN sözlükten çevrilir ---------- */
const EN = {
  // lobi
  "Adın": "Your Name", "örn. Ahmet": "e.g. John",
  "🏁 Yeni Oda Kur": "🏁 Create New Room",
  "veya mevcut odaya katıl": "or join an existing room",
  "Oda Kodu": "Room Code", "PIN (düzenleme)": "PIN (edit access)",
  "boş = izleyici": "empty = viewer", "Odaya Katıl": "Join Room",
  "PIN'siz katılan izler, PIN'li katılan düzenler.": "Join without PIN to view, with PIN to edit.",
  "Oda kullanmadan solo devam et →": "Continue solo without a room →",
  // pist & araç
  "1 · Pist Seç": "1 · Select Track", "2 · Sınıf Seç": "2 · Select Class",
  "Pist verisi": "Track data",
  "3 · Araç Seç": "3 · Select Car",
  "✓ Devam Et — Yarış Dataları": "✓ Continue — Race Data",
  "Devam etmek için pist ve araç seç": "Select a track and car to continue",
  "Seçim yapmadan geç →": "Skip selection →", "Solo mod": "Solo mode",
  // data ekranı
  "— kodu takıma şimdiden gönderebilirsin": "— you can share the code with your team now",
  "Solo mod — datalar sadece bu cihazda": "Solo mode — data stays on this device",
  "✓ Devam Et — Arayüze Geç": "✓ Continue — Open Interface",
  "Merak etme, tüm bu değerleri arayüzün sol kolonundan her an değiştirebilirsin.":
    "Don't worry — you can change all of these anytime from the left column.",
  // data kartları
  "Yarış · Data": "Race · Data", "Stint Turları — A / B / C / D": "Stint Laps — A / B / C / D",
  "Seçili Strateji": "Selected Strategy", "Yarış Başlangıcı": "Race Start",
  "Start Tarih & Saat": "Start Date & Time", "Hesaplanan Bitiş": "Calculated Finish",
  "Canlı yarış modu, pilot planı ve geri sayım bu zamana göre çalışır.":
    "Live race mode, driver plan and countdown are based on this time.",
  "Pit · Süreler (s)": "Pit · Times (s)", "lastik": "tyres",
  
  "VE Tüketim (%/tur)": "VE Usage (%/lap)",
  "%100 = Taşınan Yakıt": "100% = Fuel Carried",
  // teambar
  "ADIN": "NAME", "Oda Kur": "Create Room", "ODA KODU": "ROOM CODE",
  "PIN (opsiyonel)": "PIN (optional)", "Katıl": "Join",
  "👁 İZLEYİCİ": "👁 VIEWER", "✎ DÜZENLEYİCİ": "✎ EDITOR",
  "Odadan Ayrıl": "Leave Room", "Senkronize": "In sync",
  "Düzenleme PIN'i: ": "Edit PIN: ",
  " (sadece düzenleyecek kişilere ver)": " (share only with editors)",
  "Son güncelleme: ": "Last update: ", "sen": "you",
  "Yazma hatası — tekrar denenecek": "Write error — will retry",
  "Geçerli bir oda kodu gir": "Enter a valid room code",
  "PIN hatalı — izleyici olarak katılmak için PIN alanını boş bırak":
    "Wrong PIN — leave PIN empty to join as viewer",
  // canlı şerit & pit board
  "Start'a": "To Start", "Kalan Süre": "Time Remaining", "Pit Çıkışı": "Pit Exit",
  "Sıradaki Pit": "Next Pit", "Direksiyonda": "At the Wheel", "Durum": "Status",
  "🏁 YARIŞ BİTTİ": "🏁 RACE FINISHED", "Yarış zamanı ayarlanmadı": "Race time not set",
  "Pilotlar sekmesinden başlangıç zamanını gir": "Set the start time in the Drivers tab",
  "Son Pit VE": "Final Pit VE", "Pilot Değişimi": "Driver Change",
  "Sıradaki pit: ": "Next pit: ",
  // sekmeler
  "Son Stint Yakıtı": "Final Stint Fuel", "Lastik": "Tyres", "Pilotlar": "Drivers",
  "Telemetri": "Telemetry",
  // stint kartı
  "Code 80 Kalan": "Code 80 Remaining", "Yarış Süresi": "Race Time",
  "Strateji": "Strategy", "Stint Sayısı": "Stint Count",
  "Tahmini Toplam Tur": "Est. Total Laps",
  "S1 START LASTİKLERİ": "S1 STARTING TYRES",
  "QUAL İLE BAŞLA": "START ON QUAL", "4 YENİ": "4 NEW",
  "2 YENİ ÖN": "2 NEW FRONT", "2 YENİ ARKA": "2 NEW REAR",
  "2 YENİ SOL": "2 NEW LEFT", "2 YENİ SAĞ": "2 NEW RIGHT", "TEMİZLE": "CLEAR",
  "⚠ Başlangıç lastiği seçilmedi — önce buradan başla, pit seçimleri buna zincirlenir":
    "⚠ No starting tyres selected — start here first, pit choices chain from this",
  "Tur": "Laps", "VE İht.": "VE Req.", "Pit Ayarı": "Pit Setup",
  /* --- rehber turu --- */
  "Rehberi başlat": "Start the guide", "Rehber": "Guide",
  "Takım düğmesi": "Team button",
  "Takvimi ve üyeleri yönetmek her an buradan — yarışın ortasında bile. Rozetler de burada atanır.":
    "Manage the calendar and members any time from here — even mid-race. Badges are assigned here too.",
  "Sohbet düğmesi": "Chat button",
  "Genel ve takım kanalları. Okunmamış mesaj varsa üzerinde kırmızı sayı belirir.":
    "General and team channels. A red counter appears when there are unread messages.",
  "Profilin ve rozetlerin": "Your profile and badges",
  "Yanındaki simgeler yetkini gösterir: 👑 Takım Sahibi yönetir, 🎧 Yarış Mühendisi datayı değiştirir, direksiyon (Sürücü) yalnızca izler, 🛡 Admin her şeye erişir. Adına tıklayıp profili düzenlersin; ⏻ çıkış yapar.":
    "The icons next to your name show your permissions: 👑 Team Owner manages, 🎧 Race Engineer edits data, the steering wheel (Driver) only views, 🛡 Admin has full access. Click your name to edit the profile; ⏻ signs out.",
  "Şimdi sekmeleri tek tek gezelim — rehber her birini senin için açacak.":
    "Now let's walk through the tabs one by one — the guide opens each for you.",
  "📊 Dashboard — Stint Programı": "📊 Dashboard — Stint Schedule",
  "Planın özeti: her stintin bitiş saati, kalan süre ve pilotu. Yarış başlayınca satırlar canlı ilerler.":
    "The plan at a glance: each stint's end time, time left and driver. Rows advance live once the race starts.",
  "Yarış sonuna kalan süreye göre son dolumda alınması gereken VE yüzdesi — extra lap ve bayrak payı dahil. Pit'te mühendisin baktığı tek sayı budur.":
    "The VE percentage to take at the final stop based on the time left — extra lap and flag margin included. The one number the engineer watches in the pits.",
  "📋 Stint — Önce start lastiği": "📋 Stint — Start tyres first",
  "Her satır bir stint: tur, VE ihtiyacı, pit ayarı, pilot. Ort. Tur sütununa değer yazarsan o stint o tempoyla hesaplanır (hava çarpanı uygulanmaz); Override süreyi kilitler.":
    "Each row is a stint: laps, VE need, pit setup, driver. A value in Avg Lap makes that stint use that pace (no weather multiplier); Override locks the duration.",
  "⚡ Son Stint Hesaplayıcı": "⚡ Last Stint Calculator",
  "Yarış sonu geri sayımını gir (canlıda otomatik) — kalan tur ve gereken VE hesaplanır. Ondalık tur yukarı yuvarlanır, trafik payı için.":
    "Enter the countdown to the finish (automatic when live) — remaining laps and required VE are computed. Fractional laps round up as traffic margin.",
  "Lastik Stratejisi": "Tyre Strategy",
  "Limit sayacı, stint bazlı köşe tablosu ve hızlı atama. Wet lastikler limitten düşmez; siyah kutu eski kuru lastiği geri takar.":
    "Limit counter, per-stint corner table and quick assign. Wet tyres don't count against the limit; the black box refits a used dry tyre.",
  "Kadroyu elle yaz ya da takım üyelerinden tek tıkla ekle. Stintlere atadıkça toplam sürüş süresi ve yüzde dağılımı hesaplanır.":
    "Type the roster or add team members in one click. As you assign stints, total drive time and the split are computed.",
  "📈 Telemetri": "📈 Telemetry",
  "MoTeC dosyanı bırak — tur raporu da ham kanal log'u da okunur. %105 kuralı yavaş turları otomatik eler, medyan tur tek tıkla DATA'ya yazılır.":
    "Drop your MoTeC file — lap reports and raw channel logs both work. The 105% rule filters slow laps, and the median lap writes to DATA in one click.",
  "Admin": "Admin", "Hava": "Air", "Pit Board": "Pit Board",
  "Takvim dışı": "Off-calendar",
  "Race Monitor'a hoş geldin! 🏁": "Welcome to Race Monitor! 🏁",
  "Bu araç, LMU endurance yarışlarında pit wall'unuz: stint planı, yakıt, lastik ve canlı takip. 1 dakikada temel akışı gösterelim.":
    "This is your pit wall for LMU endurance racing: stint planning, fuel, tyres and live tracking. Let's cover the basics in a minute.",
  "Yarış Takvimi": "Race Calendar",
  "Takımının yaklaşan yarışları burada, şampiyonaya göre gruplu. Bir yarışa tıkla — pist, araç ve süre önceden hazır, direkt pit wall açılır.":
    "Your team's upcoming races, grouped by championship. Click one — track, car and duration are prepared, the pit wall opens right away.",
  "Sezon ve yarış eklemek, üyeleri ve rozetleri yönetmek burada. 🎧 Mühendis rozeti datayı değiştirebilir, sürücüler yalnızca görür.":
    "Add seasons and races, manage members and badges here. The 🎧 Engineer badge can edit data; drivers only view.",
  "🌍 Genel ve 🏢 Takım kanalları burada. Yarış açıkken ayrıca yarışa özel bir sohbet sekmesi belirir.":
    "🌍 General and 🏢 Team channels live here. With a race open, a race-specific chat tab appears too.",
  "Uygulama sık güncellenir — yeni sürümde kırmızı nokta belirir, notları buradan okursun. Rehberi de buradan yeniden başlatabilirsin.":
    "The app updates often — a red dot appears on new versions, read the notes here. You can restart this guide from here as well.",
  "Pit Wall'a hoş geldin": "Welcome to the Pit Wall",
  "Soldaki panel yarışın datası, sağı canlı plan. Kısaca gezelim — her şeyi değiştirdiğin anda takım arkadaşların da görür.":
    "The left panel holds the race data, the right side is the live plan. Quick walkthrough — anything you change, your teammates see instantly.",
  "Yarış süresi, ortalama tur, tüketim ve A/B/C/D stint stratejileri. Tüm plan bu değerlerden hesaplanır; telemetriden tek tıkla doldurabilirsin.":
    "Race time, average lap, consumption and the A/B/C/D stint strategies. The whole plan derives from these; telemetry can fill them in one click.",
  "Zemin değişince buradan işaretle — plan tur tur karma havayı hesaplar. İleri saatli planlı geçiş de ekleyebilirsin.":
    "Mark surface changes here — the plan walks lap by lap through mixed weather. You can schedule future transitions too.",
  "Sekmeler": "Tabs",
  "📊 Dashboard özet, 📋 Stint plan tablosu, ⚡ son stint yakıtı, lastik ve pilot yönetimi, 📈 telemetri ve 💬 yarış sohbeti.":
    "📊 Dashboard overview, 📋 stint plan table, ⚡ last-stint fuel, tyre and driver management, 📈 telemetry and 💬 race chat.",
  "Önce start lastiği": "Start tyres first",
  "S1 lastiklerini buradan seç — pit'lerdeki lastik seçimleri buna zincirlenir. Tekli, ikili ve dörtlü hızlı seçenekler hazır.":
    "Pick the S1 tyres here — pit tyre choices chain onto them. Single, double and full-set quick options are ready.",
  "Stint Tablosu": "Stint Table",
  "Her satır bir stint: tur, VE ihtiyacı, pit ayarı, pilot. Ort. Tur sütununa değer yazarsan o stint o tempoyla hesaplanır; Override süreyi kilitler.":
    "Each row is a stint: laps, VE need, pit setup, driver. Enter a value in Avg Lap and that stint uses that pace; Override locks the duration.",
  "Yarış canlıyken tam ekran pit board: geri sayım, sıradaki pit ve PIT YAPILDI butonu. Gerçek pitler plana işlenir, sapma görünür.":
    "Full-screen pit board while racing: countdown, next pit and the PIT DONE button. Real pits feed back into the plan, deviation is shown.",
  "PDF çıktısı": "PDF export",
  "Stint programını takıma dağıtmak için tek tık — başlık sezon ve yarış adından otomatik gelir. Bu kadar! İyi yarışlar. 🏁":
    "One click to share the stint schedule — the title comes from the season and race name automatically. That's it! Good racing. 🏁",
  "Ort. Tur": "Avg Lap",
  "Boş: yarış datasındaki ortalama tur kullanılır":
    "Empty: uses the average lap from Race Data",
  "Bu stint girilen tur süresiyle hesaplanıyor — hava çarpanı uygulanmaz":
    "This stint uses the lap time you entered — no weather multiplier applied",
  "Otomatiğe dön": "Back to automatic",
  "Toplam VE": "Total VE", "yakıt": "fuel",
  // dashboard
  "⏱ Yarış": "⏱ Race", "Kalan": "Remaining", "Tahmini Tur": "Est. Laps",
  "📋 Stint Programı": "📋 Stint Schedule", 
  "Kullanılan Lastik": "Tyres Used", "Kalan Lastik": "Tyres Left",
  "Son Stint VE": "Final Stint VE", "Pilot Dağılımı": "Driver Split",
  "Araç": "Car", "Pist": "Track", "Pit lane": "Pit lane",
  "Sıradaki stint lastikleri:": "Next stint tyres:",
  // lastik sekmesi
  "Lastik Stratejisi": "Tyre Strategy", "Lastik Limiti (adet)": "Tyre Limit (count)",
  "— hızlı —": "— quick —", "🆕 4 Yeni": "🆕 4 New",
  "⟳ Öncekiyle Devam": "⟳ Carry Over", "Önler Yeni": "New Fronts",
  "Arkalar Yeni": "New Rears", "Sollar Yeni": "New Lefts", "Sağlar Yeni": "New Rights",
  "✕ Temizle": "✕ Clear", "Tümünü Temizle": "Clear All", "Hızlı Atama": "Quick Assign",
  "Yeni lastik (1 kez)": "New tyre (1 use)", "2 kez (duplicate)": "2 uses (duplicate)",
  "Qual lastiği tekrar": "Qual tyre reused", "3 kez": "3 uses", "4+ kez": "4+ uses",
  "Değişmedi — önceki lastikle devam": "Unchanged — carries previous tyre",
  // pilotlar
  "Yarış Bitişi": "Race Finish", "Pilot Kadrosu": "Driver Roster",
  "Henüz pilot yok — aşağıdan ekle.": "No drivers yet — add below.",
  "Pilot adı": "Driver name", "Ekle": "Add", "Süre": "Duration", "Pilot": "Driver",
  "— seç —": "— select —", "Toplam Süre": "Total Time",
  "Atamaları Temizle": "Clear Assignments",
  "Geçerli bir yarış başlangıç zamanı gir.": "Enter a valid race start time.",
  // telemetri
  "Telemetri İçe Aktar (MoTeC)": "Import Telemetry (MoTeC)",
  "Tur Süresi": "Lap Time", "(başlıksız)": "(untitled)",
  "Tur süresi sütunu seçilmeli": "Select the lap time column",
  "Stint Analizi": "Stint Analysis", "DATA'ya uygula": "Apply to DATA", "Sil": "Delete",
  "Karşılaştırma": "Comparison", "Ort. Fark": "Avg. Gap", "Hızlı Olan": "Faster",
  "Dahil": "Incl.",
  "Tur satırı bulunamadı ('Out Lap', 'Lap 1'...)": "No lap rows found ('Out Lap', 'Lap 1'...)",
  // son stint yakıtı
  "YARIŞ SONU": "RACE END", "CODE 80 SONU": "CODE 80 END",
  "Zemin / Hava": "Track / Weather", "Efektif tur": "Effective lap", "yakıt": "fuel",
  "şu an": "now", "değişim": "changes", "Hava Durumu": "Weather",
  "Yükleniyor…": "Loading…", "Devam etmek için giriş yapın.": "Sign in to continue.",
  "Erişim izni bekleniyor": "Access pending",
  "Üyeler": "Members", "Üye Yönetimi": "Member Management", "Kullanıcı yönetimi": "User management",
  "Kayıt yok.": "No records.", "erişim var": "has access", "beklemede": "pending",
  "talep yok": "no request", "Onayla": "Approve", "İzni Al": "Revoke",
  "Onaylanan kişi sayfayı yenilemeden erişir.": "Approved users get access without refreshing.",
  "Tarayıcı açılır pencereyi engelledi. Bu site için açılır pencerelere izin verip tekrar deneyin.": "Your browser blocked the popup. Allow popups for this site and try again.",
  "Hesabınız kayıtlı ancak bu araç için henüz yetkilendirilmedi. Takım yöneticisiyle iletişime geçin.": "Your account is registered but not yet authorised for this tool. Contact your team manager.",
  "Google ile giriş yap": "Sign in with Google", "Çıkış yap": "Sign out",
  "Caspian Motorsport · pit wall aracı": "Caspian Motorsport · pit wall tool",
  "Planlı geçiş ekle": "Add planned change", "Ekle": "Add",
  "canlı": "live", "planlı": "planned", "Son": "Last",
  "Yarış saati (başlangıçtan itibaren)": "Race time (from start)",
  "Son X dk için geçiş zamanı": "Transition time for last X min",
  "Session Countdown (h:mm:ss)": "Session Countdown (h:mm:ss)",
  "Henüz hava geçişi yok. Aşağıdan planlı geçiş ekleyin veya soldaki butonlarla canlı değiştirin.": "No weather changes yet. Add a planned change below, or switch live with the buttons on the left.",
  "Şu anki zemin — canlı değişim buradan": "Current surface — switch live here",
  "Geçmiş / Planlı geçişler": "History / Planned changes", "Tur −1": "Lap −1", "Tur +1": "Lap +1",
  "Otomatiğe dön": "Back to auto", "Önce süre override'ı temizle": "Clear time override first",
  "Tur override aktif — önce onu temizle": "Lap override active — clear it first", "Hava Geçmişi": "Weather History", "Tümünü Sıfırla": "Reset All", "Sil": "Delete",
  "Dry": "Dry", "Damp": "Damp", "Slightly Wet": "Slightly Wet", "Wet": "Wet",
  "Canlı Yayın": "Live Stream", "YouTube linki": "YouTube link",
  "Köşeye taşı": "Move to corner", "Küçült": "Minimise", "Büyüt": "Expand",
  "Boyutlandırmak için sürükle": "Drag to resize",
  "Start tarih-saatini gir — geri sayım ve canlı stint takibi buna göre çalışır. Saat her üyeye kendi saat diliminde gösterilir.":
    "Enter the start date and time — the countdown and live stint tracking run from it. Everyone sees it in their own timezone.",
  "Pit · Süreler": "Pit · Times",
  "Pit lane geçişi ve tam depo dolum süresi. Dolum, alınan VE yüzdesine ölçeklenir; lastik süreleri LMU sabitleridir (1-2 lastik 5s, 3-4 lastik 12s).":
    "Pit lane transit and full-tank refuel time. Refuelling scales with the VE taken; tyre times are LMU constants (1-2 tyres 5s, 3-4 tyres 12s).",
  "Virtual Energy": "Virtual Energy",
  "LMU'da depo daima %100 VE'dir. Ratio, VE'nin kaç litreye denk geldiğini söyler — tüm yakıt hesapları bu orandan litreye çevrilir.":
    "In LMU the tank is always 100% VE. The ratio tells how many litres that equals — every fuel figure converts through it.",
  "YouTube linkini yapıştır — köşede yüzen mini oynatıcı açılır. Sekme değiştirsen de akmaya devam eder; köşesinden tutup boyutlandırabilirsin.":
    "Paste a YouTube link — a floating mini player opens in the corner. It keeps playing across tabs, and you can drag its grip to resize.",
  "Gizle (yenileyene dek)": "Hide (until refresh)",
  "Yayın köşedeki mini oynatıcıda gösteriliyor.":
    "The stream shows in the corner mini player.",
  "Geçerli bir YouTube linki yapıştırın; köşede mini oynatıcı açılır.":
    "Paste a valid YouTube link; a mini player opens in the corner.",
  "Yayın Dashboard'da gösteriliyor.": "Stream is shown on the Dashboard.",
  "Geçerli bir YouTube linki yapıştırın; Dashboard'da oynatıcı açılır.": "Paste a valid YouTube link; a player opens on the Dashboard.",
  "YouTube'da aç": "Open on YouTube",
  "Kalan Tur": "Laps Left", "Kullanılan kuru lastik no": "Used dry tyre no",
  "wet (limitsiz)": "wet (unlimited)",
  "⚠ %100'ü aşıyor — depo yetmez!": "⚠ Exceeds 100% — tank won't fit!",
  "gerçek yakıt": "real fuel",
  // ipuçları
  "Depo daima": "The tank is always treated as",
  "kabul edilir. Gerçek yakıt = VE × ratio → gerçek tüketim ≈":
    "VE. Real fuel = VE × ratio → real usage ≈",
  "L/tur": "L/lap", "%/tur": "%/lap", "tur + extra": "laps + extra",
  "lap": "lap", "gerçek": "actual",
  "Katılım çubuğunu gizle": "Hide join bar", "Katılım çubuğunu göster": "Show join bar",
  "Büyütmek için tıkla": "Click to enlarge",
  "tur": "laps", "Doldur": "Fill", "Sadece geçiş": "Pass-through only",
  "Paneli gizle": "Hide panel", "Paneli göster": "Show panel",
  "Lider Tur (m:ss.00)": "Leader Lap (m:ss.00)", "Lider bayrağı": "Leader flag",
  "Multiclass Yarış": "Multiclass Race", "Servis": "Service", "geçiş": "pass",
  "🌧 4 Wet": "🌧 4 Wet", "Qual'a Dön": "Back to Qual", "⟳ Devam": "⟳ Carry",
  "🆕 4 Yeni": "🆕 4 New", "Önler": "Fronts", "Arkalar": "Rears", "Sollar": "Lefts",
  "Sağlar": "Rights", "Q Qual": "Q Qual",
  "Yeni kuru": "New dry", "Qual'a dönüş": "Back to Qual",
  "Wet — limitten bağımsız, sınırsız": "Wet — unlimited, not counted in limit",
  "Taşı — tıkla: yeni kuru": "Carry — click: new dry",
  "Yeni kuru — tıkla: Qual'a dön": "New dry — click: back to Qual",
  "Qual lastiği — tıkla: wet": "Qual tyre — click: wet",
  "Wet (sınırsız) — tıkla: eski kuru": "Wet (unlimited) — click: used dry",
  "Eski kuru tekrar — tıkla: taşı": "Refit used dry — click: carry",
  "Eski kuru tekrar": "Refit used dry",
  "Saat her üyeye kendi yerel diliminde gösterilir.": "Times are shown to each member in their own timezone.",
  "son tur otomatik eklenir": "final lap added automatically",
  "Ratio'yu düşürmek daha az yakıt taşımak demektir (örn. 0.84 → %100 = 84.0 L).":
    "Lowering the ratio means carrying less fuel (e.g. 0.84 → 100% = 84.0 L).",
  "Pit süresi = FUEL": "Pit time = FUEL", "lastik ×": "tyres ×",
  "Son stintte pit hesaplanmaz. Override girilirse stint süresi manuel değere kilitlenir.":
    "No pit is calculated for the final stint. If an override is set, the stint time locks to it.",
  "Pit'te seçilen lastikler (FL/FR/RL/RR) Lastik sekmesindeki tabloya otomatik işlenir:":
    "Tyres selected at a pit (FL/FR/RL/RR) are written to the Tyres tab automatically:",
  "seçilen köşeye sonraki stint için yeni lastik atanır, seçim kaldırılırsa önceki lastikle devam edilir.":
    "the selected corner gets a new tyre for the next stint; deselecting carries the previous tyre over.",
  "Şu an: Stint": "Now: Stint", "(PIT'te)": "(in PIT)", "sıradaki pit": "next pit",
  "Her numara TEK bir lastiği temsil eder (set değil) — limit adet bazlıdır. Bir lastik ilk takıldığı köşeye kilitlenir ve diğer köşelerin menülerinden otomatik kalkar. Aynı lastik aynı köşede tekrar kullanılırsa hücre kullanım sayısına göre renklenir. Hızlı Atama ile tek tıkla 4 yeni / öncekiyle devam / kısmi değişim yapabilirsin.":
    "Each number represents ONE tyre (not a set) — the limit is per tyre. A tyre locks to the corner it is first fitted on and disappears from other corners' menus. Reusing a tyre on the same corner colors the cell by usage count. Quick Assign gives one-click 4 new / carry over / partial change.",
  "⚠ Köşe kuralı ihlali — lastik": "⚠ Corner rule violation — tyre",
  "birden fazla": "used on more than one corner.",
  "köşede kullanılmış. Bir lastik ilk takıldığı köşeye kilitlenir; hatalı hücreyi düzelt.":
    "A tyre locks to its first corner; fix the offending cell.",
  "⚠ Köşe ihlali: lastik": "⚠ Corner violation: tyre",
  "Start/Finish zamanları stint planından otomatik zincirlenir (pit süreleri dahil). Yarış bitişini aşan kısım süreye sayılmaz; tamamen yarış dışı kalan stintler soluk görünür.":
    "Start/Finish times chain automatically from the stint plan (pit times included). Time past the race finish doesn't count; fully out-of-race stints appear dimmed.",
  "Out lap ve dolum turları (yakıt Δ pozitif) otomatik hariç tutulur — Dahil kutusuyla elle değiştirebilirsin. Ortalamalar sadece dahil turlardan hesaplanır.":
    "Out laps and refuel laps (positive fuel Δ) are excluded automatically — override with the Incl. checkbox. Averages use included laps only.",
  "tur satırı bulundu. Sütun eşleşmesini kontrol et:": "lap rows found. Check the column mapping:",
  "ort. tur": "avg lap", "tur listesi": "lap list", "kalan tur": "laps left",
  "Aşınma": "Wear",
  "PİST": "TRACK", "& ARAÇ": "& CAR", "YARIŞ": "RACE", "DATALARI": "DATA",
  "Oda: ": "Room: ",
  "Solo mod — takım senkronizasyonu için ": "Solo mode — for team sync, ",
  "Kadrodan çıkar": "Remove from roster",
  "✔ PIT": "✔ PIT",
  "Araç PİT YOLUNA GİRDİĞİ an bas. Pit süresi plandan otomatik eklenir, sonraki stint pit çıkışıyla başlar.":
    "Press the moment the car ENTERS the pit lane. Pit duration is added from the plan; the next stint starts at pit exit.", "↩ Geri Al": "↩ Undo", "⟲ Sıfırla": "⟲ Reset",
  "sonu işaretlenecek": "will be marked", "Plan": "Plan", "Gerçek": "Actual",
  "geç": "late", "erken": "early", "Tüm pitler yapıldı": "All pits done",
  "Gerçek pit işaretlemelerini sıfırla?": "Reset all actual pit marks?",
  "Tamir (s)": "Repair (s)",
  "Stint Programı": "Stint Program", "Pilot Programı": "Driver Schedule",
  "PDF başlığı:": "PDF title:",
  "Pilot Toplamları": "Driver Totals",
  "Açılır pencere engellendi — tarayıcıdan izin ver": "Pop-up blocked — allow it in your browser",
  "📋 PLAN": "📋 PLAN",
  "Stint planından otomatik — sondan önceki stintin Time Left değeri":
    "Auto from the stint plan — Time Left of the second-to-last stint",
  "⚠ Lastik limiti doldu — yeni lastik seçilemez": "⚠ Tyre limit reached — no new tyres available",
  "🔴 CANLI": "🔴 LIVE", "Canlıdan otomatik — yarış saatinden hesaplanıyor":
    "Auto from live — calculated from the race clock",
  "odası bulunamadı — kodu kontrol et": "room not found — check the code",
  "Takım senkronizasyonu kapalı — ": "Team sync is off — ",
  " dosyasını doldur.": " needs to be filled in.",
  /* --- takım / sezon / yarış takvimi --- */
  "Takımlar": "Teams",
  "Takımlarım": "My Teams",
  "Takım Kur": "Create Team",
  "Takım Kur / Katıl": "Create / Join Team",
  "Takımı Görüntüle": "View Team",
  "Takım Üyeleri": "Team Members",
  "Takım bulunamadı": "Team not found",
  "Takım kurulamadı": "Could not create team",
  "Takımdan ayrıl": "Leave team",
  "Takımsız solo devam et →": "Continue solo without a team →",
  "Yeni takım adı": "New team name",
  "Katılım kodu": "Join code",
  "KATILIM KODU": "JOIN CODE",
  "Katılınamadı": "Could not join",
  "Henüz bir takımın yok. Yeni takım kur ya da katılım kodu ile katıl.":
    "You don't have a team yet. Create one or join with a join code.",
  "Takvimi & Takımı Yönet": "Manage Calendar & Team",
  "Takvime Dön": "Back to Calendar",
  "Yarış Takvimi": "Race Calendar",
  "Yaklaşan Yarışlar": "Upcoming Races",
  "Takvimde yarış yok.": "No races on the calendar.",
  "Takvimde yaklaşan yarış yok.": "No upcoming races on the calendar.",
  "Takvim dışı (tekli yarış)": "Off-calendar (one-off race)",
  "Solo mod — takım takvimi için lobiye dön.":
    "Solo mode — go back to the lobby for the team calendar.",
  "Sezon": "Season",
  "Sezonlar": "Seasons",
  "Sezon adı": "Season name",
  "Round": "Round",
  "Yarış": "Race",
  "Yarış Ekle": "Add Race",
  "Yarışı Düzenle": "Edit Race",
  "Yarış adı": "Race name",
  "Yarış silinsin mi?": "Delete this race?",
  "örn. 6 Hours of Spa": "e.g. 6 Hours of Spa",
  "Başlangıç (yerel saat)": "Start (local time)",
  "Sınıf": "Class",
  "Tümü": "All",
  /* --- hesap / profil / yetki --- */
  "Profil": "Profile",
  "Profili düzenle": "Edit profile",
  "Ad Soyad": "Full Name",
  "Takım / not (opsiyonel)": "Team / note (optional)",
  "Odalarda ve stint programında bu isim görünür.":
    "This name is shown in rooms and in the stint schedule.",
  "Devam etmek için giriş yapın veya kayıt olun.": "Sign in or register to continue.",
  "Google ile kayıt ol": "Sign up with Google",
  "Kayıt talebi gönder": "Send sign-up request",
  "Talebi Gönder": "Send Request",
  "Talebiniz alındı. Onaylandığında e-posta ile bilgilendirileceksiniz.":
    "Your request has been received. You'll be notified by email once it is approved.",
  "Talebiniz yöneticiye iletilecek. Onaylandığında e-posta ile bilgilendirileceksiniz.":
    "Your request will be sent to an administrator. You'll be notified by email once it is approved.",
  "Bağlantı hatası: ": "Connection error: ",
  "Düzenleyici yap": "Make editor",
  "İzleyici yap": "Make viewer",
  "PIN'leri yalnız düzenleyiciler görür.": "Only editors can see PINs.",
  "(sen)": "(you)",
  "isimsiz": "unnamed",
  /* --- rozetler --- */
  "Takım Sahibi": "Team Owner",
  "Sürücü": "Driver",
  "Yarış Mühendisi": "Race Engineer",
  /* --- genel --- */
  "Kaydet": "Save",
  "Vazgeç": "Cancel",
  "Düzenle": "Edit",
  "Aç": "Open",
  "Geçmiş": "History",
  "Bağlı": "Connected",
  "👁 İZLEYİCİ": "👁 VIEWER",
  "✎ DÜZENLEYİCİ": "✎ EDITOR",
  "Stint zaman çizelgesi": "Stint timeline",
  "Rozetleri atamak için üye satırındaki rozet düğmelerine bas.":
    "Use the badge buttons on a member row to assign them.",
  "Yakıt sütunu litre (VE % için orana bölünür)":
    "Fuel column is in litres (divided by the ratio for VE %)",
  "Yarış·Data'da yakıt oranı girilmeli": "Set the fuel ratio in Race Data",
  "en iyi": "best", "tur hariç": "laps excluded",
  "En iyi turun %105'ini aşan turların tikini kaldır":
    "Untick laps slower than 105% of the best lap",
  "1 YENİ": "1 NEW", "Tek yeni lastik": "Single new tyre",
  "Tek lastik": "Single tyre", "yeni": "new",
  "Takım Adı": "Team Name",
  "Yeni ad diğer üyelerde uygulamayı açtıklarında güncellenir.":
    "Other members will see the new name next time they open the app.",
  "korumalı": "protected",
  "Sohbet": "Chat", "Takım Sohbeti": "Team Chat",
  "Yarış Sohbeti": "Race Chat",
  "Bu yarışa özel kanal — takımın tamamı yazabilir, sürücüler dahil.":
    "Channel for this race — everyone on the team can post, drivers included.",
  "Genel": "General", "Takım": "Team",
  "Mesaj yaz…": "Write a message…", "Gönder": "Send",
  "Henüz mesaj yok — ilk yazan sen ol.": "No messages yet — be the first.",
  "Yetki": "Permission",
  "Düzenleyebilir": "Can edit", "Sadece görür": "View only",
  "Rozet yetkiyi belirler:": "Badges set permissions:",
  "yarış datasını değiştirebilir, üyelere dokunamaz":
    "can change race data, cannot manage members",
  "her şeyi görür, hiçbir şeyi değiştiremez": "sees everything, changes nothing",
  "rozetleri ve yetkileri yönetir": "manages badges and permissions",
  "datayı değiştirebilir": "can edit data", "sadece görür": "view only",
  "medyan tur": "median lap", "ort.": "avg",
  "Ortalamayı uygula": "Apply the average instead",
  "Sütun eşleşmesini düzenle": "Edit column mapping",
  "Kutu grafiği": "Box plot", "Tur tur": "Per lap",
  "Kutu = turların ortadaki %50'si (Q1–Q3), kalın çizgi medyan. Bıyıklar uç turlara, halkalar aykırı turlara işaret eder.":
    "Box = middle 50% of laps (Q1–Q3), thick line is the median. Whiskers reach the extreme laps, rings mark outliers.",
  "tur çözümlendi": "laps parsed",
  "Tur": "Lap", "Yakıt": "Fuel", "kısmi": "partial",
  "Ort/Max km/h": "Avg/Max km/h",
  "Kısmi tur: log'da sonraki tur yok, süre örneklerden hesaplandı.":
    "Partial lap: no following lap in the log, duration estimated from samples.",
  "VE karşılığı için Yarış·Data'da yakıt oranı girilmeli.":
    "Set the fuel ratio in Race Data to get the VE equivalent.",
  "Dosya tanınmadı — MoTeC tur raporu ya da ham kanal log'u bekleniyor":
    "File not recognised — expecting a MoTeC lap report or a raw channel log",
  "MoTeC tur istatistiklerini yapıştır veya dosya seç (CSV/TSV)":
    "Paste MoTeC lap stats or pick a file — raw channel logs work too (CSV/TSV)",
  "Neler değişti": "What's new",
  "ŞU AN": "CURRENT",
  "GitHub'da tüm değişiklikler ↗": "All changes on GitHub ↗",
  "Kapat": "Close",
  "Kadro": "Roster",
  "Takım": "Team",
  "Takımdan ekle": "Add from team",
  "Hava zaman çizelgesi": "Weather timeline",
};

const CAR_CLASSES = [
  ["hypercar", "Hypercar"], ["lmp2", "LMP2"], ["lmp3", "LMP3"],
  ["gte", "GTE"], ["gt3", "GT3"],
];
const trackName = (id) => TRACKS.find((t) => t.id === id)?.name || "";
const carName = (cls, id) => CARS[cls]?.find((c) => c.id === id)?.name || "";
/* araç görseli: dosya adı id'den farklıysa CARS girişindeki img alanı kullanılır */
const carImg = (cls, id) => {
  const c = CARS[cls]?.find((x) => x.id === id);
  return `${ASSET}cars/${cls}/${c?.img || id}.png`;
};
const isLapLabel = (c) => /^(out ?lap|in ?lap|lap ?\d+)$/i.test(String(c).trim());

const msFromCell = (v) => {
  const t = String(v).trim().replace(",", ".");
  if (/^\d+:\d{1,2}(\.\d+)?$/.test(t)) {
    const [m, s] = t.split(":");
    return Math.round(((+m) * 60 + (+s)) * 1000);
  }
  const n = parseFloat(t);
  if (isNaN(n)) return null;
  if (n > 20000) return Math.round(n);        // zaten milisaniye
  if (n > 30 && n < 1200) return Math.round(n * 1000); // saniye
  return null;
};

/* ---------- ham MoTeC kanal log'u (sample bazlı, 100 Hz, 200+ kanal) ----------
   MoTeC iki farklı çıktı verir:
   a) tur istatistiği raporu → "Out Lap / Lap 1" satırları (parseTelemetryText)
   b) ham kanal log'u → her satır bir örnek, tur bilgisi "Lap Number" kanalında
   Bu fonksiyon (b)'yi tur bazına indirger. */
const splitCsvLine = (line, delim) => {
  const out = []; let cur = ""; let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
};
const tnum = (v) => {
  const n = parseFloat(String(v == null ? "" : v).replace(",", "."));
  return isNaN(n) ? null : n;
};

function parseMotecLog(text) {
  const lines = text.split(/\r?\n/);
  if (lines.length < 20) return null;
  const head = lines.slice(0, 30).join("");
  const delim = (head.match(/;/g) || []).length > (head.match(/,/g) || []).length ? ";" : ",";

  let hi = -1, cols = null;
  for (let i = 0; i < Math.min(lines.length, 60); i++) {
    const c = splitCsvLine(lines[i], delim);
    if (c.length >= 8 && /^time$/i.test(c[0])) { hi = i; cols = c; break; }
  }
  if (hi === -1) return null;

  /* üst bilgi: "Venue","Spa",,,"Worksheet","" → hem 0-1 hem 4-5 çiftleri */
  const meta = {};
  for (let i = 0; i < hi; i++) {
    const c = splitCsvLine(lines[i], delim);
    for (const [k, v] of [[0, 1], [4, 5]]) {
      if (c[k] && c[v]) meta[c[k].toLowerCase()] = c[v];
    }
  }

  const find = (...res) => {
    for (const re of res) { const i = cols.findIndex((c) => re.test(c)); if (i >= 0) return i; }
    return -1;
  };
  const iLap = find(/^lap number$/i, /lap\s*num/i, /^lap$/i);
  if (iLap < 0) return null;
  const iTime = find(/^session elapsed time$/i, /elapsed/i, /^time$/i);
  const iFuel = find(/^fuel level$/i, /fuel\s*level/i, /^fuel$/i);
  const iLast = find(/^last laptime$/i, /last\s*lap\s*time/i);
  const iSpd = find(/^ground speed$/i, /^speed$/i);
  const iPit = find(/^in pits$/i, /^pitstatus$/i);
  const iWear = ["fl", "fr", "rl", "rr"].map((c) =>
    find(new RegExp(`^tyre wear ${c}$`, "i"), new RegExp(`wear\\s*${c}$`, "i")));
  const iTrk = find(/^track temperature$/i);
  const iAmb = find(/^ambient temperature$/i);

  const rows = [];
  for (let i = hi + 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const c = splitCsvLine(lines[i], delim);
    if (c.length < cols.length - 2 || tnum(c[0]) == null) continue;
    rows.push(c);
  }
  if (rows.length < 20) return null;

  const groups = [];
  let cur = null;
  for (const r of rows) {
    const ln = tnum(r[iLap]);
    if (ln == null) continue;
    if (!cur || cur.lap !== ln) { cur = { lap: ln, rows: [] }; groups.push(cur); }
    cur.rows.push(r);
  }

  const laps = groups.map((g, gi) => {
    const a = g.rows[0], z = g.rows[g.rows.length - 1];
    const t0 = tnum(a[iTime]), t1 = tnum(z[iTime]);
    const span = t0 != null && t1 != null ? t1 - t0 : null;
    /* gerçek tur süresi: sonraki turun başındaki "Last Laptime" kanalı */
    let official = null;
    const nx = groups[gi + 1];
    if (nx && iLast >= 0) {
      const v = tnum(nx.rows[Math.min(3, nx.rows.length - 1)][iLast]);
      if (v && v > 20 && v < 1200) official = v;
    }
    const f0 = iFuel >= 0 ? tnum(a[iFuel]) : null;
    const f1 = iFuel >= 0 ? tnum(z[iFuel]) : null;
    const spds = iSpd >= 0 ? g.rows.map((r) => tnum(r[iSpd])).filter((x) => x != null) : [];
    return {
      lap: g.lap, n: g.rows.length,
      sec: official != null ? official : span, official, span,
      fuelL: f0 != null && f1 != null && f0 > f1 ? f0 - f1 : null,
      w: iWear.map((wi) => {
        if (wi < 0) return null;
        const x = tnum(a[wi]), y = tnum(z[wi]);
        return x != null && y != null ? Math.abs(y - x) : null;
      }),
      pit: iPit >= 0 && g.rows.some((r) => (tnum(r[iPit]) || 0) > 0),
      avgSpd: spds.length ? spds.reduce((x, y) => x + y, 0) / spds.length : null,
      maxSpd: spds.length ? Math.max(...spds) : null,
      partial: official == null,
    };
  }).filter((l) => l.n >= 20 && l.sec != null && l.sec > 10);

  if (!laps.length) return null;
  const mid = rows[Math.floor(rows.length / 2)];
  return {
    motec: true, laps,
    meta: {
      venue: meta.venue || "",
      vehicle: meta["vehicle desc"] || meta.vehicle || "",
      driver: meta.driver || "", date: meta["log date"] || "",
      trk: iTrk >= 0 ? tnum(mid[iTrk]) : null,
      amb: iAmb >= 0 ? tnum(mid[iAmb]) : null,
    },
  };
}

function parseTelemetryText(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return null;
  /* Ayırıcıyı tırnak-duyarlı ayrıştırarak seç: MoTeC raporlarında ondalık virgül
     tırnak içinde geçer ("-4,174"), ham split bunları parçalar. */
  const cand = ["\t", ";", ","];
  const probe = lines.slice(0, 12);
  const delim = cand.map((d) => {
    const counts = probe.map((l) => splitCsvLine(l, d).length);
    return [d, Math.max(...counts)];
  }).sort((a, b) => b[1] - a[1])[0][0];
  const rows = lines.map((l) => splitCsvLine(l, delim));
  const firstLap = rows.findIndex((r) => r.some(isLapLabel));
  if (firstLap === -1) return { error: "Dosya tanınmadı — MoTeC tur raporu ya da ham kanal log'u bekleniyor" };
  const ncols = Math.max(...rows.map((r) => r.length));
  const headers = Array.from({ length: ncols }, (_, i) =>
    rows.slice(0, firstLap).map((h) => h[i] || "").join(" ").trim());
  const lapRows = rows.slice(firstLap).filter((r) => r.some(isLapLabel));
  return { headers, lapRows, ncols };
}

function guessMapping(parsed) {
  const { headers, lapRows, ncols } = parsed;
  const labelCol = (() => {
    const scores = Array.from({ length: ncols }, (_, i) =>
      lapRows.filter((r) => isLapLabel(r[i] || "")).length);
    return scores.indexOf(Math.max(...scores));
  })();
  const numStats = Array.from({ length: ncols }, (_, i) => {
    const vals = lapRows.map((r) => parseFloat(String(r[i] || "").replace(",", ".")))
      .filter((n) => !isNaN(n));
    if (!vals.length) return null;
    const abs = vals.map(Math.abs);
    return {
      i, n: vals.length,
      medAbs: abs.sort((a, b) => a - b)[Math.floor(abs.length / 2)],
      negRatio: vals.filter((v) => v < 0).length / vals.length,
    };
  }).filter(Boolean);
  const byHeader = (re) => headers.findIndex((h) => re.test(h));
  /* Tur süresi milisaniye (310127) ya da saniye (140.808) olabilir.
     Saniye durumunda yakıt seviyesi gibi sütunlar da aralığa düşer; ayırt etmek için
     en dar dağılımlı sütunu seçiyoruz — tur süreleri birbirine yakın, yakıt monoton düşer. */
  let timeCol = numStats.find((s) => s.medAbs > 30000 && s.medAbs < 3600000)?.i ?? -1;
  if (timeCol < 0) {
    const secCand = numStats
      .filter((s) => s.i !== labelCol && s.n === lapRows.length
        && s.medAbs > 30 && s.medAbs < 1200 && s.negRatio === 0)
      .map((s) => {
        const vals = lapRows.map((r) => parseFloat(String(r[s.i] || "").replace(",", ".")))
          .filter((n) => !isNaN(n));
        const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
        const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length);
        return { i: s.i, cv: mean ? sd / mean : 99 };
      })
      .sort((a, b) => a.cv - b.cv);
    if (secCand.length && secCand[0].cv < 0.25) timeCol = secCand[0].i;
  }
  let fuelCol = byHeader(/fuel.*(change|used|delta)/i);
  if (fuelCol === -1)
    fuelCol = numStats.find((s) => s.i !== timeCol && s.medAbs > 0.5 && s.medAbs < 40
      && s.negRatio > 0.5)?.i ?? -1;
  const wear = ["fl", "fr", "rl", "rr"].map((c) =>
    byHeader(new RegExp(`wear\\s*${c}.*change`, "i")));
  /* MoTeC "Fuel Level [l] Change" litre verir; eski raporlar VE % veriyordu. */
  const fuelIsLitre = fuelCol >= 0
    && /\[\s*l\s*\]|\(\s*l\s*\)|litre|liter/i.test(headers[fuelCol] || "");
  return { labelCol, timeCol, fuelCol, wear, fuelIsLitre };
}

/* ---------- çekirdek motor ---------- */
const EMPTY_PIT = { fuel: true, lane: true, tyres: [0, 0, 0, 0] };
const TYRE_2_SEC = 5;  // 1-2 lastik değişim süresi (LMU, sabit)
const TYRE_4_SEC = 12; // 3-4 lastik değişim süresi (LMU, sabit)
/* zemin/hava durumu: tur süresi çarpanı + yakıt tüketim çarpanı (LMU) */
/* direksiyon simgesi — Unicode'da direksiyon emojisi yok, rozet rengini devralır */
/* ============================================================
   REHBER TURU — ekranı karartır, sıradaki öğeyi ışıklandırır.
   steps: [{ sel, title, body, pos? }] — sel bulunamazsa adım atlanır.
   ============================================================ */
function TourOverlay({ steps, onClose, lang }) {
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState(null);
  /* act'li adımlar hedefi render eder (sekme açar) — DOM'da olmasa da tutulur */
  const live = steps.filter((st2) => !st2.sel || st2.act || document.querySelector(st2.sel));
  const step = live[idx];

  useEffect(() => {
    if (!step) return undefined;
    if (step.act) step.act();                       // sekmeyi aç
    let el = null;
    const measure = () => {
      el = step.sel ? document.querySelector(step.sel) : null;
      if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
      if (!el) { setRect(null); return; }
      const r = el.getBoundingClientRect();
      setRect({ x: r.left - 8, y: r.top - 8, w: r.width + 16, h: r.height + 16 });
    };
    const t0 = setTimeout(measure, 340);            // sekme + scroll otursun
    const t1 = setTimeout(measure, 800);            // sidebar animasyonu bitince tekrar
    const remeasure = () => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      setRect({ x: r.left - 8, y: r.top - 8, w: r.width + 16, h: r.height + 16 });
    };
    window.addEventListener("resize", remeasure);
    window.addEventListener("scroll", remeasure, true);
    return () => { clearTimeout(t0); clearTimeout(t1);
      window.removeEventListener("resize", remeasure);
      window.removeEventListener("scroll", remeasure, true); };
  }, [idx, step]);

  useEffect(() => {
    const k = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" || e.key === "Enter") setIdx((i) => Math.min(i + 1, live.length - 1));
      if (e.key === "ArrowLeft") setIdx((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [live.length, onClose]);

  if (!step) { onClose(); return null; }
  const last = idx === live.length - 1;
  const vw = window.innerWidth, vh = window.innerHeight;
  /* balon konumu: hedefin altına; sığmazsa üstüne; hedef yoksa ortaya */
  const CW = Math.min(360, vw - 24);
  let cx = vw / 2 - CW / 2, cy = vh / 2 - 90;
  if (rect) {
    cx = Math.max(12, Math.min(rect.x + rect.w / 2 - CW / 2, vw - CW - 12));
    cy = rect.y + rect.h + 14;
    if (cy > vh - 190) cy = Math.max(12, rect.y - 178);
  }
  return (
    <div className="tourwrap" onClick={onClose}>
      {rect && <div className="tourhole" style={{
        left: rect.x, top: rect.y, width: rect.w, height: rect.h }} />}
      {!rect && <div className="tourdim" />}
      <div className="tourcard" style={{ left: cx, top: cy, width: CW }}
        onClick={(e) => e.stopPropagation()}>
        <div className="tourstep">{idx + 1} / {live.length}</div>
        <h3>{step.title}</h3>
        <p>{step.body}</p>
        <div className="tourbtns">
          <button className="histbtn" onClick={onClose}>
            {lang === "en" ? "Skip" : "Geç"}</button>
          <span style={{ flex: 1 }} />
          {idx > 0 && <button className="histbtn"
            onClick={() => setIdx(idx - 1)}>←</button>}
          <button className="gbtn ubtn"
            onClick={() => (last ? onClose() : setIdx(idx + 1))}>
            {last ? (lang === "en" ? "Done ✓" : "Bitti ✓")
              : (lang === "en" ? "Next →" : "İleri →")}</button>
        </div>
      </div>
    </div>
  );
}

function Wheel({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      style={{ verticalAlign: -2 }} aria-hidden="true">
      <circle cx="12" cy="12" r="9.3" />
      <circle cx="12" cy="12" r="2.8" fill="currentColor" stroke="none" />
      <path d="M2.9 12h6.3M14.8 12h6.3M12 14.8v6.3" />
    </svg>
  );
}

/* kullanıcı rozetleri */
const BADGES = {
  admin:    { lbl: "Admin",            ico: "🛡", col: "#E11D2E", bg: "rgba(225,29,46,.14)" },
  owner:    { lbl: "Takım Sahibi",     ico: "👑", col: "#C9A227", bg: "rgba(201,162,39,.14)" },
  driver:   { lbl: "Sürücü",           ico: <Wheel />, col: "#26C6DA", bg: "rgba(38,198,218,.14)" },
  engineer: { lbl: "Yarış Mühendisi",  ico: "🎧", col: "#F2C94C", bg: "rgba(242,201,76,.14)" },
};
/* Rozet listesi: sahiplik ve admin otomatik, diğerleri takım sahibince atanır.
   badges[uid] eski sürümde metin, yenisinde { driver:true, ... } olabilir. */
const teamBadgesOf = (team, uid, udocLocal) => {
  const out = [];
  if (udocLocal?.admin) out.push(BADGES.admin);
  if (team?.members?.[uid] === "owner") out.push(BADGES.owner);
  const b = team?.badges?.[uid];
  const ids = typeof b === "string" ? [b] : Object.keys(b || {}).filter((k) => b[k]);
  ids.forEach((id) => { if (BADGES[id] && !out.includes(BADGES[id])) out.push(BADGES[id]); });
  return out;
};
const hasBadge = (team, uid, id) => {
  const b = team?.badges?.[uid];
  return typeof b === "string" ? b === id : !!b?.[id];
};

const WEATHER = {
  dry:   { lbl: "Dry",          ico: "☀️", lap: 1.00, fuel: 1.00, col: "#F5C84C" },
  damp:  { lbl: "Damp",         ico: "🌦", lap: 1.07, fuel: 1.00, col: "#8FD0E8" },
  slwet: { lbl: "Slightly Wet", ico: "🌧", lap: 1.09, fuel: 0.96, col: "#4D9FFF" },
  wet:   { lbl: "Wet",          ico: "⛈", lap: 1.13, fuel: 0.92, col: "#7B8FF7" },
};
const wxLog = (st) => (st.weatherLog || []).slice().sort((a, b) => a.t - b.t);
const wxAtRel = (log, rel) => {  // rel saniyedeki hava (kronolojik log)
  let cur = WEATHER.dry;
  for (const e of log) { if (e.t <= rel + 1e-6) cur = WEATHER[e.w] || cur; else break; }
  return cur;
};
const WX = (st) => {  // en güncel (mevcut/gelecek) hava — UI ve son stint için
  const log = wxLog(st);
  return log.length ? (WEATHER[log[log.length - 1].w] || WEATHER.dry) : WEATHER.dry;
};
const effLapSec = (st) => parseLap(st.avgLap) * WX(st).lap;
const effCons = (st) => st.consumption * WX(st).fuel;
/* lastik köşe durumu: 0 taşı · 1 yeni kuru (sarı) · 2 Qual'a dön (mavi) · 3 wet (yeşil)
   · 4 eski kuru tekrar (siyah). Eski odalarda boolean olabilir → tyState normalize eder. */
const tyState = (v) => (v === true ? 1 : v === false ? 0 : Number(v) || 0);
const MAX_STINTS = 64; // güvenlik tavanı (24h+ yarışlar için yeterli)

function computePlan(st, mode /* "race" | "code80" */) {
  const raceSec = mode === "race" ? parseHMS(st.raceTime) : parseHMS(st.code80TimeLeft);
  const baseLap = parseLap(st.avgLap);
  const baseCons = st.consumption;
  const log = wxLog(st);
  const wxAt = (rel) => wxAtRel(log, rel);
  const endWx = wxAt(raceSec);                 // yarış sonu havası (bayrak/son stint)
  const lapSec = baseLap * endWx.lap;          // gelecek/end temposu (pct için)
  const cons = baseCons * endWx.fuel;
  const laps = st.strategies[st.chosen] || 0;
  /* bir stintin tur-tur yürüyen hesabı: cumStart'tan başlayıp her turun havasını
     o anki zamandan alır → süre + toplam % VE (karma hava doğru) */
  /* fixLap: o stint için elle girilen ortalama tur süresi (sn).
     Girildiğinde hava çarpanı UYGULANMAZ — kullanıcı zaten o koşulun turunu yazıyor.
     Yakıt tarafında hava çarpanı korunur (ıslakta tüketim fiziksel olarak düşer). */
  const walkFull = (cumStart, nLaps, fixLap) => {
    let sec = 0, fuel = 0;
    for (let L = 0; L < nLaps; L++) {
      const wx = wxAt(cumStart + sec);
      sec += fixLap > 0 ? fixLap : baseLap * wx.lap;
      fuel += baseCons * wx.fuel;
    }
    return { sec, laps: nLaps, fuel };
  };
  const walkByTime = (cumStart, dur, addBayrak, fixLap) => {
    let sec = 0, fuel = 0, L = 0;
    while (L < 1000) {
      const wx = wxAt(cumStart + sec);
      const lap = fixLap > 0 ? fixLap : baseLap * wx.lap;
      if (sec + lap > dur + 1e-6) break;
      sec += lap; fuel += baseCons * wx.fuel; L++;
    }
    if (addBayrak) { fuel += baseCons * wxAt(cumStart + sec).fuel; L += 1; }
    return { laps: L, fuel };
  };
  const tyreSecOf = (cnt) => {
    const base = cnt <= 0 ? 0 : cnt <= 2 ? TYRE_2_SEC : TYRE_4_SEC; // LMU sabit kademe
    return mode === "race" ? base : base / 4; // CODE80: ÷4
  };
  const repairs = st.pitRepairs || [];
  const buildRows = (fuelSecFn) => {
    const rows = [];
    let cum = 0;
    for (let i = 0; i < MAX_STINTS; i++) {
      const ovr = parseHMS(st.overrides[i] || "");
      const fixLap = parseLap(st.stintLaps?.[i] || "") || 0;  // stinte özel tur süresi
      const startLeft = raceSec - cum;                     // stint başında kalan süre
      if (startLeft <= 0) break;
      let stintSec, lapsInStint, fuelUnits, isLast;
      if (ovr > 0) {                                       // manuel override (süre kilidi)
        isLast = ovr >= startLeft - 0.5;
        stintSec = isLast ? startLeft : ovr;
        const wb = walkByTime(cum, stintSec, isLast, fixLap);
        lapsInStint = Math.max(1, wb.laps); fuelUnits = wb.fuel;
      } else if ((Number(st.lapOverrides?.[i]) || 0) > 0) { // manuel tur sayısı
        const nl = Math.max(1, Math.round(Number(st.lapOverrides[i])));
        const full = walkFull(cum, nl, fixLap);
        isLast = (cum + full.sec) >= raceSec - 0.5;
        stintSec = full.sec; lapsInStint = nl; fuelUnits = full.fuel;
      } else {
        const full = walkFull(cum, laps, fixLap);         // tam stint (tur limitli)
        isLast = full.sec >= startLeft - 0.5;
        if (isLast) {
          stintSec = startLeft;
          const wb = walkByTime(cum, startLeft, true, fixLap);
          lapsInStint = Math.max(1, wb.laps); fuelUnits = wb.fuel;
        } else {
          stintSec = full.sec; lapsInStint = full.laps; fuelUnits = full.fuel;
        }
      }
      cum += stintSec;
      const p = st.pits[i] || EMPTY_PIT;
      const tyreCount = p.tyres.reduce((a, v) => a + (tyState(v) > 0 ? 1 : 0), 0);
      const repairSec = Number(repairs[i]) || 0;
      /* pit süresi: LANE her zaman dahil + fuel (doldurduğu sonraki stintin VE %'sine ölçekli) + lastik + tamir */
      const fuelSec = p.fuel ? (fuelSecFn ? fuelSecFn(i) : st.fuelTime) : 0;
      const pitSec = isLast ? 0
        : st.pitLaneTime + fuelSec + tyreSecOf(tyreCount) + repairSec;
      const endStint = cum + (isLast ? 0 : pitSec);
      rows.push({
        idx: i + 1,
        fixLap,
        stintSec, pitSec, tyreCount, repairSec,
        endSec: endStint,
        timeLeft: raceSec - endStint,
        lapsInStint,
        isLast,
        fuelNeed: fuelUnits,
      });
      cum = endStint;
      if (isLast) break;
    }
    return rows;
  };
  /* lider bitiş modeli: süre dolunca lider turunu tamamlar (T_flag),
     biz T_flag'ten sonraki ilk geçişte biteriz */
  const leadSec = (st.multiclass ? (parseLap(st.leaderLap) || baseLap) : baseLap) * endWx.lap;
  const flagExtra = leadSec > 0
    ? Math.ceil(raceSec / leadSec - 1e-9) * leadSec - raceSec : 0;
  /* pit dolum süresi = 42s × (doldurulan stintin VE ihtiyacı %). Her pit, kendisinden
     SONRAKİ stintin VE'sini yükler; son stint için extra lap + bayrak payı dahil edilir.
     Pit süreleri son stint sınırını kaydırabildiği için sabitlenene dek yinele. */
  const pctForPit = (rws, i) => {
    const next = rws[i + 1];
    if (!next || lapSec <= 0) return 100;
    if (next.isLast) {
      const cd = rws[i].timeLeft + flagExtra;
      const lapsLeft = Math.max(1, Math.ceil(cd / lapSec - 1e-9));
      return Math.min(100, Math.max(0, (lapsLeft + st.extraLap) * cons));
    }
    return Math.min(100, Math.max(0, next.fuelNeed));
  };
  let rows = buildRows(null);
  let lastRefuelPct = null;
  for (let iter = 0; iter < 5; iter++) {
    const prev = rows;
    rows = buildRows((i) => st.fuelTime * pctForPit(prev, i) / 100);
    const li = rows.length - 2;
    const pct = li >= 0 ? pctForPit(rows, li) : null;
    if (lastRefuelPct !== null && pct !== null && Math.abs(pct - lastRefuelPct) < 0.05) {
      lastRefuelPct = pct; break;
    }
    lastRefuelPct = pct;
  }
  const fullStints = rows.length;
  const totalLaps = rows.reduce((a, r) => a + r.lapsInStint, 0);
  return { rows, raceSec, lapSec, laps, fullStints, totalLaps, flagExtra, lastRefuelPct };
}

/* eski oda kayıtlarına yeni alanları güvenle ekler */
const migrate = (s) => {
  const m = { ...DEFAULT_STATE, ...s };
  if (!m.raceStartMs && s && s.raceStart) {
    const t = Date.parse(s.raceStart);
    if (!isNaN(t)) m.raceStartMs = t;
  }
  if (!Array.isArray(m.lapOverrides)) m.lapOverrides = Array(MAX_STINTS).fill("");
  if (!Array.isArray(m.stintLaps)) m.stintLaps = Array(MAX_STINTS).fill("");
  if (!Array.isArray(m.weatherLog)) m.weatherLog = [];
  if (!m.weatherLog.length && s && s.weather && s.weather !== "dry")
    m.weatherLog = [{ t: 0, w: s.weather }]; // eski "tüm yarış" seçimi
  return m;
};

function lastStintFuel(countdownStr, st, flagExtra = 0) {
  const lapSec = effLapSec(st);
  const cd = parseHMS(countdownStr) + flagExtra; // lider bayrağına kadar geçen ek süre
  const lapsRaw = lapSec > 0 ? cd / lapSec : 0;
  const lapsLeft = Math.ceil(lapsRaw - 1e-6);  // ondalık tur yukarı yuvarlanır (trafik riski payı)
  const refuel = (lapsLeft + st.extraLap) * effCons(st);   // % VE
  const refuelL = refuel * st.fuelRatio;                      // gerçek litre
  return { lapsLeft, lapsRaw, refuel, refuelL };
}

/* ---------- UI parçaları ---------- */
const css = `
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600&display=swap');
:root{
  --bg:#120C0E; --panel:#1C1315; --panel2:#261719; --line:#3D242B;
  --txt:#F2E9EB; --dim:#A78F95; --teal:#D24357; --car:#960018; --green:#40D68C;
  --yellow:#F2C94C; --red:#F0604D; --purple:#BB8CF5;
}
.rc *{box-sizing:border-box}
.rc{min-height:100vh;background:var(--bg);color:var(--txt);
  font-family:'Inter',system-ui,sans-serif;font-size:13px;padding:0 0 40px}
.rc .mono{font-family:'IBM Plex Mono',monospace}
.rc .disp{font-family:'Barlow Condensed',sans-serif;letter-spacing:.04em}
.rc header{display:flex;align-items:center;gap:12px;padding:14px 20px;
  border-bottom:1px solid var(--line)}
.rc header h1{margin:0;font-size:26px;font-weight:700;text-transform:uppercase;line-height:1}
.rc header h1 b{color:var(--teal)}
.rc header .ver{color:var(--dim);font-size:12px;margin-left:-4px;align-self:flex-end;
  padding-bottom:2px}
.rc .grid{display:grid;grid-template-columns:300px 1fr;gap:16px;padding:16px 20px;
  align-items:start;transition:grid-template-columns .28s ease,gap .28s ease}
.rc .grid.noside{grid-template-columns:0px 1fr;gap:0}
.rc .sidecol{overflow:hidden;min-width:0}
.rc .sideinner{width:300px;transition:opacity .22s ease}
.rc .grid.noside .sideinner{opacity:0;pointer-events:none}
.rc .sidetoggle{position:fixed;left:0;top:50%;transform:translateY(-50%);z-index:40;
  width:20px;height:72px;padding:0;border:1px solid var(--line);border-left:none;
  border-radius:0 10px 10px 0;background:var(--panel2);color:var(--dim);
  cursor:pointer;font-size:11px;line-height:1;transition:color .15s,border-color .15s}
.rc .sidetoggle:hover{color:var(--teal);border-color:var(--teal)}
@media(max-width:900px){.rc .grid{grid-template-columns:1fr}.rc .sidetoggle{display:none}}
.rc .card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px}
.rc .card h2{margin:0 0 10px;font-size:15px;text-transform:uppercase;
  font-family:'Barlow Condensed';letter-spacing:.08em;color:var(--teal)}
.rc label{display:block;color:var(--dim);font-size:11px;margin:8px 0 3px;
  text-transform:uppercase;letter-spacing:.05em}
.rc input[type=text],.rc input[type=number],.rc input[type=datetime-local]{width:100%;background:var(--panel2);
  border:1px solid var(--line);border-radius:6px;color:var(--txt);
  padding:6px 8px;font-family:'IBM Plex Mono',monospace;font-size:13px}
.rc input:focus{outline:2px solid var(--teal);outline-offset:-1px}
/* sayı alanlarında yukarı/aşağı ok her zaman görünür (madde: elle girme yerine tıkla) */
.rc input[type=number]{-moz-appearance:auto;appearance:auto}
.rc input[type=number]::-webkit-inner-spin-button,
.rc input[type=number]::-webkit-outer-spin-button{
  -webkit-appearance:inner-spin-button;appearance:auto;opacity:1;
  height:24px;cursor:pointer;filter:invert(.85) hue-rotate(300deg)}
.rc .row2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.rc .row4{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.rc .strat{display:flex;gap:6px;margin-top:4px}
.rc .strat button{flex:1;padding:7px 0;border-radius:6px;border:1px solid var(--line);
  background:var(--panel2);color:var(--dim);font-family:'Barlow Condensed';
  font-size:15px;font-weight:600;cursor:pointer}
.rc .strat button.on{background:var(--car);color:#FFE9ED;border-color:var(--teal)}
.rc .tabs{display:flex;gap:8px;margin-bottom:12px}
.rc .tabs button{padding:8px 16px;border-radius:8px 8px 0 0;border:1px solid var(--line);
  border-bottom:none;background:transparent;color:var(--dim);cursor:pointer;
  font-family:'Barlow Condensed';font-size:16px;font-weight:600;letter-spacing:.05em;
  text-transform:uppercase}
.rc .tabs button.on{background:var(--panel);color:var(--txt);border-color:var(--teal)}
.rc table{width:100%;border-collapse:collapse}
.rc th{color:var(--dim);font-size:10px;text-transform:uppercase;letter-spacing:.06em;
  text-align:left;padding:6px 8px;border-bottom:1px solid var(--line)}
.rc td{padding:7px 8px;border-bottom:1px solid #2E1D21;font-family:'IBM Plex Mono',monospace;
  font-size:12.5px}
.rc tr.last td{background:rgba(64,214,140,.06)}
.rc .neg{color:var(--red)} .rc .pos{color:var(--green)}
.rc .chip{display:inline-block;padding:1px 7px;border-radius:99px;font-size:11px;
  border:1px solid var(--line);color:var(--dim)}
.rc .tyrebox{display:inline-flex;gap:3px;margin-right:8px}
.rc .tyrebox button{width:26px;height:22px;border-radius:4px;border:1px solid var(--line);
  background:var(--panel2);color:var(--dim);font-size:9px;cursor:pointer;
  font-family:'IBM Plex Mono'}
.rc .tyrebox button.on{background:var(--yellow);color:#3A2E00;border-color:var(--yellow)}
.rc .tyrebox button.qual{background:#4D9FFF;color:#04213F;border-color:#4D9FFF}
.rc .tyrebox button.wet{background:#7FE3A0;color:#0C3A1F;border-color:#7FE3A0}
.rc .tyrebox button.used{background:#0B0D12;color:#E8E8EE;border-color:#6B7280;
  box-shadow:inset 0 0 0 1px #2a2e38}
.rc .pitopt{display:inline-flex;gap:4px}
.rc .pitopt button{padding:2px 8px;border-radius:4px;border:1px solid var(--line);
  background:var(--panel2);color:var(--dim);font-size:10px;cursor:pointer}
.rc .pitopt button:disabled{opacity:.35;cursor:not-allowed}
.rc .pitopt button.on{background:var(--car);color:#FFE9ED;border-color:var(--teal)}
.rc .ovr{width:82px!important;padding:3px 6px!important;font-size:11px!important}
.rc .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));
  gap:10px;margin-bottom:14px}
.rc .kpi{background:var(--panel2);border:1px solid var(--line);border-radius:8px;padding:10px}
.rc .kpi .v{font-family:'Barlow Condensed';font-size:24px;font-weight:700;line-height:1}
.rc .kpi .l{color:var(--dim);font-size:10px;text-transform:uppercase;letter-spacing:.06em;
  margin-top:4px}
.rc .timeline{height:34px;display:flex;border-radius:6px;overflow:hidden;
  border:1px solid var(--line);margin:4px 0 14px}
.rc .timeline .seg{position:relative;min-width:2px}
.rc .timeline .seg span{position:absolute;inset:0;display:flex;align-items:center;
  justify-content:center;font-family:'Barlow Condensed';font-size:12px;font-weight:700;
  color:#FFE3E8;letter-spacing:.02em;overflow:hidden}
.rc .timeline .pit{background:var(--yellow)}
.rc .hint{color:var(--dim);font-size:11px;margin-top:6px;line-height:1.5}
.rc .warn{color:var(--yellow)}
.rc .fuelbig{font-family:'Barlow Condensed';font-size:52px;font-weight:700;
  color:var(--green);line-height:1;margin:6px 0}
.rc .teambar{display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-start;gap:8px;
  padding:10px 20px;border-bottom:1px solid var(--line);background:var(--panel)}
.rc .teambar.collapsed{padding:5px 20px}
.rc .bartoggle{background:var(--panel2);border:1px solid var(--line);border-radius:6px;
  color:var(--dim);cursor:pointer;padding:2px 12px;font-size:11px;line-height:1.4;
  font-family:'IBM Plex Mono'}
.rc .bartoggle:hover{color:var(--txt);border-color:var(--teal)}
.rc .teambar input{width:110px;background:var(--panel2);border:1px solid var(--line);
  border-radius:6px;color:var(--txt);padding:6px 8px;font-family:'IBM Plex Mono';
  font-size:12px;text-transform:uppercase}
.rc .teambar button{padding:6px 12px;border-radius:6px;border:1px solid var(--teal);
  background:transparent;color:var(--teal);cursor:pointer;font-family:'Barlow Condensed';
  font-size:14px;font-weight:600;letter-spacing:.05em;text-transform:uppercase}
.rc .teambar button.solid{background:var(--car);color:#FFE9ED}
.rc .teambar button.leave{border-color:var(--red);color:var(--red)}
.rc .dot{width:9px;height:9px;border-radius:99px;display:inline-block}
.rc .dot.on{background:var(--green);box-shadow:0 0 6px var(--green)}
.rc .dot.off{background:var(--dim)}
.rc .roomcode{font-family:'IBM Plex Mono';font-weight:600;font-size:15px;
  color:var(--yellow);letter-spacing:.15em}
.rc .syncinfo{color:var(--dim);font-size:11px;margin-left:auto}
/* --- lobi --- */
.rc .lobby{min-height:100vh;display:flex;align-items:center;justify-content:center;
  padding:20px;background:radial-gradient(ellipse at 50% 0%,#2A0D14 0%,var(--bg) 60%)}
.rc .logo{display:block;margin:0 auto 14px;max-width:280px;width:70%;height:auto;
  filter:drop-shadow(0 6px 18px rgba(0,0,0,.5))}
.rc header img.hlogo{height:38px;width:auto;display:block;filter:drop-shadow(0 2px 6px rgba(0,0,0,.4))}
.rc .pitboard img.plogo{position:absolute;bottom:18px;left:50%;transform:translateX(-50%);
  height:34px;width:auto;opacity:.85}
.rc .lobby .box{width:100%;max-width:430px;background:var(--panel);
  border:1px solid var(--line);border-radius:14px;padding:30px 28px}
.rc .lobby h1{margin:0;font-size:30px;font-weight:700;text-transform:uppercase;
  text-align:center;font-family:'Barlow Condensed';letter-spacing:.04em}
.rc .lobby h1 b{color:var(--teal)}
.rc .lobby .sub{text-align:center;color:var(--dim);font-size:12px;margin:4px 0 22px}
.rc .lobby .bigbtn{width:100%;padding:12px;border-radius:8px;border:1px solid var(--teal);
  background:var(--car);color:#FFE9ED;cursor:pointer;font-family:'Barlow Condensed';
  font-size:18px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;margin-top:8px}
.rc .lobby .bigbtn.ghost{background:transparent;color:var(--teal);border-color:var(--teal)}
.rc .lobby .bigbtn:disabled{opacity:.5;cursor:wait}
.rc .lobby .divider{display:flex;align-items:center;gap:10px;color:var(--dim);
  margin:20px 0 8px;font-size:10px;text-transform:uppercase;letter-spacing:.12em}
.rc .lobby .divider::before,.rc .lobby .divider::after{
  content:"";flex:1;height:1px;background:var(--line)}
.rc .lobby .solo{display:block;width:100%;margin-top:22px;background:none;border:none;
  color:var(--dim);cursor:pointer;font-size:12px;text-decoration:underline;
  text-underline-offset:3px}
.rc .lobby .solo:hover{color:var(--txt)}
.rc .lobby .lmsg{margin-top:12px;color:var(--yellow);font-size:12px;text-align:center;
  min-height:16px}
/* --- pist & araç seçimi --- */
.rc .picksec{margin-top:18px}
.rc .picksec h3{margin:0 0 8px;font-size:12px;text-transform:uppercase;
  letter-spacing:.08em;color:var(--dim);font-family:'Barlow Condensed';font-size:15px}
.rc .trackgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px}
.rc .trackgrid button{display:flex;align-items:center;gap:8px;padding:9px 10px;
  border-radius:8px;border:1px solid var(--line);background:var(--panel2);
  color:var(--txt);cursor:pointer;font-size:12px;text-align:left}
.rc .trackgrid button img{width:22px;height:auto;border-radius:2px;flex-shrink:0}
.rc .trackgrid button.on{border-color:var(--teal);background:rgba(150,0,24,.25);
  color:var(--teal);font-weight:600}
.rc .classtoggle{display:flex;gap:8px}
.rc .wxsel{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:4px 0 2px}
.rc .wxsel button{padding:6px 2px;border:1px solid var(--line);border-radius:8px;
  background:var(--panel2);color:var(--dim);cursor:pointer;font-size:11px;line-height:1.3;
  text-align:center;transition:border-color .15s,color .15s}
.rc .wxsel button small{font-family:'DM Mono',monospace;opacity:.8;font-size:10px}
.rc .wxsel button.on{background:rgba(255,255,255,.05)}
.rc .minibtn{width:22px;height:22px;padding:0;border:1px solid var(--line);border-radius:6px;
  background:var(--panel2);color:var(--txt);cursor:pointer;font-size:13px;line-height:1}
.rc .minibtn:hover{border-color:var(--teal);color:var(--teal)}
.rc .histbtn{border:1px solid var(--line);border-radius:8px;background:var(--panel2);
  color:var(--txt);cursor:pointer;font-size:12px;padding:5px 12px;transition:border-color .15s}
.rc .histbtn:hover{border-color:var(--teal);color:var(--teal)}
.rc .gbtn{display:inline-flex;align-items:center;gap:10px;margin:0 auto;padding:11px 22px;
  border:1px solid var(--line);border-radius:10px;background:#fff;color:#1f1f1f;
  font-family:'Barlow Condensed';font-size:16px;letter-spacing:.04em;text-transform:uppercase;
  font-weight:600;cursor:pointer;transition:box-shadow .18s,transform .12s}
.rc .gbtn:hover{box-shadow:0 6px 20px rgba(0,0,0,.45);transform:translateY(-1px)}
.rc .gbtn:active{transform:scale(.98)}
.rc .adminbtn{position:relative;align-self:center;display:inline-flex;align-items:center;gap:5px;
  background:var(--panel2);border:1px solid var(--line);border-radius:8px;color:var(--txt);
  cursor:pointer;font-size:12px;padding:5px 11px}
.rc .adminbtn:hover{border-color:var(--teal);color:var(--teal)}
.rc .adminbtn .badge{position:absolute;top:-6px;right:-6px;background:var(--car);color:#fff;
  border-radius:9px;font-size:10px;padding:1px 6px;line-height:1.4}
.rc .lobbyteams{margin-bottom:14px;text-align:left}
.rc .lrace{display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;margin-bottom:6px;
  border:1px solid var(--line);border-radius:10px;background:var(--panel2);cursor:pointer;
  transition:border-color .15s,transform .12s;text-align:left}
.rc .lrace:hover{border-color:var(--teal);transform:translateX(2px)}
.rc .lrace.next{border-color:var(--car);background:rgba(150,0,24,.14)}
.rc .lrace .lrtrack{width:54px;height:34px;object-fit:contain;opacity:.85;flex:0 0 auto}
.rc .lrace .lrinfo{display:flex;flex-direction:column;flex:1;min-width:0;gap:1px}
.rc .lrace .lrinfo b{font-size:13px;color:var(--txt);overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap}
.rc .lrace .lrmeta{font-size:11px;color:var(--dim);overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap}
.rc .lrace .lrdate{font-size:10.5px;color:var(--teal);letter-spacing:.03em}
.rc .tmroom .rmeta{display:block;font-size:10.5px;color:var(--dim);font-weight:400}
.rc .lroom{display:flex;align-items:center;gap:9px;width:100%;padding:10px 12px;margin-bottom:6px;
  border:1px solid var(--line);border-radius:10px;background:var(--panel2);cursor:pointer;
  transition:border-color .15s,transform .12s}
.rc .lroom:hover{border-color:var(--teal);transform:translateX(2px)}
.rc .lroom .rcode{font-weight:700;color:var(--teal);letter-spacing:.08em;font-size:13px}
.rc .lroom .rlabel{flex:1;font-size:12px;color:var(--txt);overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap;text-align:left}
.rc .lroom .rrole{font-size:9px;text-transform:uppercase;letter-spacing:.05em;padding:2px 7px;
  border-radius:5px;border:1px solid var(--line);color:var(--dim)}
.rc .lroom .rrole.ed{color:var(--green);border-color:rgba(46,204,113,.4)}
.rc .lroom .rgo{color:var(--dim);font-size:15px}
.rc .tmtabs{display:flex;gap:6px;padding:10px 14px 0;flex-wrap:wrap}
.rc .tmtabs button{padding:5px 12px;border:1px solid var(--line);border-radius:8px;
  background:var(--panel2);color:var(--dim);cursor:pointer;font-size:12px}
.rc .tmtabs button.on{border-color:var(--car);color:#FFD9E0;background:rgba(150,0,24,.22)}
.rc .tmsec{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--car);
  font-weight:700;margin:6px 0 7px}
.rc .tmroom{display:flex;align-items:center;gap:9px;padding:7px 9px;border-radius:8px;
  background:rgba(255,255,255,.03);margin-bottom:5px}
.rc .tmroom .rcode{font-weight:700;color:var(--teal);letter-spacing:.08em}
.rc .tmroom .rlabel{flex:1;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rc .tmroom .rpin{font-size:11px;color:var(--yellow)}
.rc .tmroom .rpin.dim{color:var(--dim)}
.rc .tmroom .ubtn{padding:4px 12px;font-size:11px}
.rc .tmadd{display:flex;gap:6px;margin-top:8px;align-items:center}
.rc .tmadd input{margin:0}
.rc .tmmem{display:flex;align-items:center;gap:9px;padding:5px 9px;font-size:12px}
.rc .tmmem .mbadges{display:inline-flex;gap:3px;flex:0 0 auto}
.rc .btgl{width:26px;height:24px;padding:0;border:1px solid var(--line);border-radius:6px;
  background:var(--panel2);color:var(--dim);cursor:pointer;font-size:12px;line-height:1;
  opacity:.5;transition:opacity .15s}
.rc .btgl.on{opacity:1}
.rc .btgl:hover{opacity:1}
.rc .tmmem .mrole{font-size:10px;text-transform:uppercase;letter-spacing:.05em;padding:2px 8px;
  border-radius:6px;border:1px solid var(--line);color:var(--dim)}
.rc .tmmem .muid{color:var(--muted);font-size:11px}
.rc .tmfoot{display:flex;gap:6px;padding:10px 14px;border-top:1px solid var(--line);
  align-items:center;flex-wrap:wrap}
.rc .tmfoot input{margin:0;flex:1;min-width:120px}
.rc .urow{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:8px}
.rc .urow:nth-child(odd){background:rgba(255,255,255,.03)}
.rc .urow img,.rc .urow .uav{width:32px;height:32px;border-radius:50%;object-fit:cover;flex:0 0 auto;
  background:var(--panel2);display:flex;align-items:center;justify-content:center;color:var(--dim)}
.rc .urow .uinfo{display:flex;flex-direction:column;min-width:0;flex:1}
.rc .urow .uinfo b{font-size:13px}
.rc .urow .umail{font-size:11px;color:var(--dim);overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap}
.rc .urow .unote{font-size:11px;color:var(--muted);font-style:italic}
.rc .urow .ustat{font-size:10px;text-transform:uppercase;letter-spacing:.05em;padding:2px 8px;
  border-radius:6px;border:1px solid var(--line);color:var(--dim);white-space:nowrap}
.rc .urow .ustat.ok{color:var(--green);border-color:rgba(46,204,113,.4)}
.rc .urow .ustat.wait{color:var(--yellow);border-color:rgba(242,201,76,.4)}
.rc .urow .ubtn{padding:5px 14px;font-size:12px;background:var(--green);color:#04240F;border:none}
.rc .userchip{display:inline-flex;align-items:center;gap:7px;align-self:center;
  background:var(--panel2);border:1px solid var(--line);border-radius:20px;padding:3px 5px 3px 3px}
.rc .userchip img{width:24px;height:24px;border-radius:50%;object-fit:cover}
.rc .ubadge{font-size:12px;line-height:1;padding:3px 6px;border-radius:6px;border:1px solid}
.rc .bchip{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;
  padding:5px 12px;border-radius:8px;border:1px solid;margin-bottom:14px;letter-spacing:.03em}
.rc .bsel{width:auto;min-width:130px;font-size:11px;padding:3px 6px;margin:0}
.rc .userchip .unamebtn{background:none;border:none;color:var(--txt);font-size:12px;cursor:pointer;
  max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:2px 2px}
.rc .userchip .unamebtn:hover{color:var(--teal);text-decoration:underline}
.rc .userchip .uname{font-size:12px;color:var(--txt);max-width:150px;overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap}
.rc .userchip button{background:none;border:none;color:var(--dim);cursor:pointer;
  font-size:13px;padding:2px 6px;border-radius:6px}
.rc .userchip button:hover{color:var(--car);background:rgba(150,0,24,.15)}
.rc .lapcell{display:inline-flex;align-items:center;gap:4px}
.rc .lapcell b{min-width:20px;text-align:center;font-variant-numeric:tabular-nums}
.rc .lapcell b.lapman{color:var(--teal)}
.rc .lapstep{width:18px;height:18px;padding:0;border:1px solid var(--line);border-radius:5px;
  background:var(--panel2);color:var(--txt);cursor:pointer;font-size:12px;line-height:1}
.rc .lapstep:hover:not(:disabled){border-color:var(--teal);color:var(--teal)}
.rc .lapstep:disabled{opacity:.3;cursor:not-allowed}
.rc .lapclr{width:16px;height:16px;padding:0;border:none;border-radius:4px;
  background:transparent;color:var(--dim);cursor:pointer;font-size:11px}
.rc .lapclr:hover{color:var(--car)}
.rc .wxmodal{position:fixed;inset:0;z-index:1000;background:rgba(10,6,10,.72);
  backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;
  padding:20px;animation:lbfade .18s ease}
.rc .wxmbox{background:var(--panel);border:1px solid var(--line);border-radius:14px;
  width:min(440px,94vw);max-height:80vh;display:flex;flex-direction:column;overflow:hidden;
  animation:lbzoom .26s cubic-bezier(.2,.85,.3,1.12)}
.rc .wxmhead{display:flex;align-items:center;justify-content:space-between;
  padding:12px 16px;border-bottom:1px solid var(--line);font-family:'Barlow Condensed';
  font-size:18px;letter-spacing:.04em;text-transform:uppercase}
.rc .wxmlist{overflow:auto;padding:8px}
.rc .wxrow{display:flex;align-items:center;gap:9px;padding:8px 10px;border-radius:8px}
.rc .wxrow:nth-child(odd){background:rgba(255,255,255,.03)}
.rc .wxrow .wxdot{width:11px;height:11px;border-radius:3px;flex:0 0 auto}
.rc .wxrow .wxnm{font-weight:600;min-width:96px}
.rc .wxrow .wxml{color:var(--dim);font-size:12px}
.rc .wxrow .wxat{margin-left:auto;color:var(--muted);font-size:12px}
.rc .wxmfoot{padding:10px 16px;border-top:1px solid var(--line);display:flex;
  justify-content:flex-end}
.rc .wxsrc{font-size:9px;text-transform:uppercase;letter-spacing:.06em;padding:1px 6px;
  border-radius:5px;border:1px solid}
.rc .wxsrc.live{color:var(--teal);border-color:rgba(38,198,218,.4);background:rgba(38,198,218,.1)}
.rc .wxsrc.plan{color:#c9a227;border-color:rgba(201,162,39,.4);background:rgba(201,162,39,.1)}
.rc .wxrow .wxat{margin-left:auto}
.rc .wxmplan{padding:10px 16px;border-top:1px solid var(--line)}
.rc .wxmptitle{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--dim);
  margin-bottom:7px}
.rc .wxmprow{display:flex;gap:6px;align-items:center}
.rc .wxmprow select{flex:1}
.rc .wxmprow input{width:90px;text-align:center}
.rc .wxmquick{display:flex;gap:6px;margin-top:7px}
.rc .wxbar{position:relative;display:flex;height:16px;margin-top:4px;border-radius:6px;
  overflow:hidden;border:1px solid var(--line)}
.rc .wxbar .wseg{position:relative;min-width:2px;display:flex;align-items:center;
  justify-content:center;font-size:9px;transition:width .4s ease}
.rc .wxbar .wseg span{opacity:.85;filter:drop-shadow(0 0 1px rgba(0,0,0,.5))}
.rc .wxbar .wseg.rain::after{content:"";position:absolute;inset:0;
  background:repeating-linear-gradient(115deg,rgba(255,255,255,.22) 0 2px,
    transparent 2px 9px);background-size:200% 100%;animation:wxrain 1.1s linear infinite}
@keyframes wxrain{from{background-position:0 0}to{background-position:-36px 0}}
.rc .classtoggle button{flex:1;display:flex;align-items:center;justify-content:center;
  gap:8px;padding:10px;border-radius:8px;border:1px solid var(--line);
  background:var(--panel2);color:var(--dim);cursor:pointer;
  font-family:'Barlow Condensed';font-size:16px;font-weight:600;letter-spacing:.05em}
.rc .classtoggle button img{width:26px;height:auto}
.rc .classtoggle button.on{border-color:var(--teal);background:rgba(150,0,24,.25);
  color:var(--teal)}
.rc .cargrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px}
.rc .cargrid button{padding:10px 10px 8px;border-radius:10px;border:1px solid var(--line);
  background:var(--panel2);cursor:pointer;color:var(--dim);font-size:11.5px}
.rc .cargrid button img{width:100%;height:auto;margin-bottom:6px;
  filter:drop-shadow(0 4px 8px rgba(0,0,0,.45))}
.rc .cargrid button.on{border-color:var(--teal);background:rgba(150,0,24,.20);
  color:var(--txt);font-weight:600}
.rc .lteam{display:flex;align-items:center;gap:6px;font-size:14px;font-weight:700;
  color:var(--txt);padding:8px 10px;margin-bottom:10px;border-radius:8px;
  background:var(--panel2);border:1px solid var(--line)}
.rc .lseason{font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;
  color:var(--dim);margin:10px 0 4px 2px;display:flex;align-items:center;gap:8px}
.rc .lseason::after{content:"";flex:1;height:1px;background:var(--line)}
.rc .floatstream{position:fixed;z-index:900;width:320px;background:var(--panel);
  border:1px solid var(--line);border-radius:10px;overflow:hidden;
  box-shadow:0 10px 34px rgba(0,0,0,.55)}
.rc .floatstream.br{right:16px;bottom:16px}
.rc .floatstream.bl{left:16px;bottom:16px}
.rc .floatstream.tr{right:16px;top:110px}
.rc .floatstream.tl{left:16px;top:110px}
.rc .floatstream .fshead{display:flex;align-items:center;gap:6px;
  padding:5px 8px;background:var(--panel2);border-bottom:1px solid var(--line)}
.rc .floatstream .fsgrip{cursor:nwse-resize;color:var(--dim);font-size:12px;
  padding:0 2px;user-select:none;touch-action:none}
.rc .floatstream .fsgrip:hover{color:var(--teal)}
.rc .floatstream .fsshield{position:absolute;inset:0;z-index:2}
.rc .floatstream .fstitle{font-size:10.5px;letter-spacing:.1em;color:var(--muted);
  font-family:"Chakra Petch",sans-serif;margin-right:auto}
.rc .floatstream .fsbtns{display:flex;gap:2px;align-items:center}
.rc .floatstream .fsbtns button,.rc .floatstream .fsbtns a{background:none;border:0;
  color:var(--dim);cursor:pointer;font-size:11px;padding:1px 4px;line-height:1;
  text-decoration:none}
.rc .floatstream .fsbtns button:hover,.rc .floatstream .fsbtns a:hover{color:var(--teal)}
.rc .floatstream .fsbtns button.on{color:var(--red)}
.rc .floatstream .fsbody{aspect-ratio:16/9;background:#000;position:relative}
.rc .floatstream .fsbody iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.rc .floatstream.min{width:210px}
.rc .floatstream.min .fsbody{display:none}
.rc .tourbtn{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;
  border-radius:6px;border:1px solid var(--line);background:var(--panel2);
  color:var(--muted);font-size:11.5px;cursor:pointer;transition:.15s;
  align-self:center;white-space:nowrap}
.rc .tourbtn:hover{border-color:var(--teal);color:var(--teal)}
.rc .tourwrap{position:fixed;inset:0;z-index:3000}
.rc .tourdim{position:absolute;inset:0;background:rgba(8,4,8,.78)}
.rc .tourhole{position:absolute;border-radius:12px;
  box-shadow:0 0 0 9999px rgba(8,4,8,.78), 0 0 0 2px var(--red),
    0 0 22px rgba(150,0,24,.55);transition:all .28s ease;pointer-events:none}
.rc .tourcard{position:absolute;background:var(--panel);border:1px solid var(--red);
  border-radius:12px;padding:14px 16px;box-shadow:0 12px 40px rgba(0,0,0,.6);
  transition:all .28s ease}
.rc .tourcard h3{margin:0 0 6px;font-size:15px;color:var(--red);
  font-family:"Chakra Petch",sans-serif;letter-spacing:.04em}
.rc .tourcard p{margin:0 0 12px;font-size:12.5px;line-height:1.55;color:var(--txt)}
.rc .tourstep{font-size:10px;color:var(--dim);letter-spacing:.14em;margin-bottom:4px}
.rc .tourbtns{display:flex;gap:8px;align-items:center}
.rc .chattabs{display:flex;gap:4px;padding:8px 12px 0;border-bottom:1px solid var(--line);
  overflow-x:auto}
.rc .ctab{position:relative;background:none;border:1px solid var(--line);border-bottom:0;
  border-radius:8px 8px 0 0;color:var(--dim);font-size:11.5px;padding:6px 12px;
  cursor:pointer;white-space:nowrap;max-width:180px;overflow:hidden;text-overflow:ellipsis}
.rc .ctab.on{color:var(--red);border-color:var(--red);background:var(--panel2)}
.rc .ctab .cdot{position:absolute;top:1px;right:2px;background:var(--red);color:#fff;
  border-radius:8px;font-size:9px;padding:0 4px;line-height:13px}
.rc .chatwrap{display:flex;flex-direction:column;height:min(62vh,460px)}
.rc .chatlist{flex:1;overflow-y:auto;padding:10px 14px;display:flex;
  flex-direction:column;gap:9px}
.rc .cmsg{max-width:78%;align-self:flex-start}
.rc .cmsg.me{align-self:flex-end}
.rc .cmsg .who{font-size:10.5px;color:var(--dim);margin:0 0 2px 2px;
  display:flex;gap:6px;align-items:center}
.rc .cmsg.me .who{justify-content:flex-end;margin:0 2px 2px 0}
.rc .cmsg .bub{background:var(--panel2);border:1px solid var(--line);
  border-radius:12px;padding:7px 11px;font-size:13px;line-height:1.45;
  white-space:pre-wrap;word-break:break-word}
.rc .cmsg.me .bub{background:rgba(150,0,24,.22);border-color:rgba(150,0,24,.55)}
.rc .cmsg .del{background:none;border:0;color:var(--dim);cursor:pointer;
  font-size:10px;padding:0 2px;opacity:0;transition:.15s}
.rc .cmsg:hover .del{opacity:1}
.rc .cmsg .del:hover{color:var(--red)}
.rc .chatbar{display:flex;gap:8px;padding:10px 14px;border-top:1px solid var(--line)}
.rc .chatbar input{flex:1;margin:0;text-transform:none;letter-spacing:0}
.rc .chatday{align-self:center;font-size:10px;color:var(--dim);
  border:1px solid var(--line);border-radius:10px;padding:1px 9px}
.rc .infobtn{position:relative;width:26px;height:26px;flex:0 0 26px;padding:0;
  border-radius:50%;border:1px solid var(--line);background:var(--panel2);
  color:var(--muted);font:700 14px/1 Georgia,serif;cursor:pointer;
  display:inline-flex;align-items:center;justify-content:center;transition:.15s}
.rc .infobtn:hover{border-color:var(--red);color:var(--red)}
.rc .infobtn .nd{position:absolute;top:-2px;right:-2px;width:8px;height:8px;
  border-radius:50%;background:var(--red);border:1px solid var(--panel)}
.rc .clgv{padding:12px 16px 4px;border-top:1px solid var(--line)}
.rc .clgv:first-child{border-top:0}
.rc .clgv h4{margin:0 0 2px;font-size:14px;letter-spacing:.04em}
.rc .clgv h4 .cur{margin-left:8px;font-size:10px;padding:1px 6px;border-radius:4px;
  border:1px solid var(--red);color:var(--red);letter-spacing:.08em;vertical-align:2px}
.rc .clgv .cdate{color:var(--dim);font-size:11px;margin-bottom:8px}
.rc .clgv ul{margin:0 0 10px;padding-left:18px}
.rc .clgv li{font-size:12.5px;line-height:1.55;color:var(--txt);margin-bottom:4px}
.rc .langsw{display:inline-flex;gap:4px;margin-left:auto;align-self:center}
.rc .langsw button{padding:3px 9px;border-radius:5px;border:1px solid var(--line);
  background:var(--panel2);color:var(--dim);font-size:11px;cursor:pointer;font-weight:600}
.rc .langsw button.on{border-color:var(--teal);color:var(--teal)}
.rc .hdsel{display:inline-flex;align-items:center;gap:7px;color:var(--dim);font-size:12px;align-self:center}
.rc .hdsel img.flag{width:18px;height:auto;border-radius:2px}
.rc .hdsel img.car{height:22px;width:auto}
.rc .viewonly input,.rc .viewonly .strat button,.rc .viewonly .tyrebox button,
.rc .viewonly .pitopt button,.rc .viewonly select,.rc .viewonly .card .act
{pointer-events:none;opacity:.55}
.rc .viewonly .tabs button{pointer-events:auto;opacity:1}
.rc .viewonly textarea,.rc .viewonly input[type=file],.rc .viewonly input[type=checkbox]{pointer-events:none;opacity:.55}
.rc textarea:focus{outline:2px solid var(--teal)}
.rc select{background:var(--panel2);border:1px solid var(--line);border-radius:6px;
  color:var(--txt);padding:5px 6px;font-family:'IBM Plex Mono';font-size:12px}
.rc .tin{width:56px!important;text-align:center}
.rc .drvsel{min-width:96px;max-width:120px;padding:4px 6px}
.rc .tsel{width:76px;text-align:center;background:transparent!important}
.rc td.tcarry .tsel{color:var(--dim);font-style:italic;opacity:.75}
.rc td.terr{background:rgba(240,96,77,.18);outline:2px solid var(--red);outline-offset:-2px}
.rc td.t2{background:rgba(242,201,76,.22)}
.rc td.tq{background:rgba(102,148,255,.25)}
.rc td.t3{background:rgba(232,132,42,.30)}
.rc td.t4{background:rgba(220,38,38,.42)}
.rc td.tw{background:rgba(127,227,160,.22)}
.rc td.t4 input{color:var(--red);border-color:var(--red)}
.rc .act{padding:6px 12px;border-radius:6px;border:1px solid var(--line);
  background:var(--panel2);color:var(--txt);cursor:pointer;font-size:12px}
.rc .act.danger{border-color:var(--red);color:var(--red)}
.rc .rchip{display:inline-flex;align-items:center;gap:6px;padding:3px 8px;
  border-radius:99px;border:1px solid var(--line);background:var(--panel2);
  margin:0 6px 6px 0;font-size:12px}
.rc .rchip b{cursor:pointer;color:var(--red)}
.rc .legend{display:flex;flex-wrap:wrap;gap:10px;margin-top:10px;font-size:11px;color:var(--dim)}
.rc .legend i{display:inline-block;width:12px;height:12px;border-radius:3px;
  margin-right:4px;vertical-align:-2px;border:1px solid var(--line)}
/* --- code 80 sarı efekt --- */
.rc .card.c80{border-color:rgba(242,201,76,.55);
  box-shadow:0 0 0 1px rgba(242,201,76,.18),0 0 26px rgba(242,201,76,.08)}
.rc .card.c80 h2{color:var(--yellow)}
.rc .card.c80 .kpi{border-color:rgba(242,201,76,.30)}
.rc .tabs button.on.c80t{border-color:var(--yellow);color:var(--yellow)}
/* --- canlı mod --- */
.rc .livestrip{display:flex;flex-wrap:wrap;align-items:center;gap:16px;
  padding:8px 20px;border-bottom:1px solid var(--line);background:#210B10}
.rc .livestrip .big{font-family:'Barlow Condensed';font-size:22px;font-weight:700}
.rc .livestrip .lbl{color:var(--dim);font-size:10px;text-transform:uppercase;
  letter-spacing:.07em;display:block}
@keyframes rcpulse{0%,100%{opacity:1}50%{opacity:.35}}
.rc .pulse{animation:rcpulse 1.1s ease-in-out infinite;color:var(--yellow)}
@media (prefers-reduced-motion: reduce){.rc .pulse{animation:none}}
.rc .timeline{position:relative}
.rc .nowline{position:absolute;top:-4px;bottom:-4px;width:2px;background:#fff;
  box-shadow:0 0 8px #fff;z-index:2}
.rc tr.live td{background:rgba(150,0,24,.16);border-left:3px solid var(--teal)}
.rc tr.pitsoon td{background:rgba(242,201,76,.12)}
/* --- pit board --- */
.rc .pitboard{position:fixed;inset:0;z-index:50;
  background:radial-gradient(1100px 550px at 50% -12%,#131820 0%,#05070A 62%);
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:3vh;text-align:center;padding:4vh 4vw}
.rc .pitboard .huge{font-family:'Barlow Condensed';font-weight:700;
  font-size:clamp(70px,18vw,220px);line-height:.95;color:var(--green);
  font-variant-numeric:tabular-nums}
.rc .pitboard .mid{font-family:'Barlow Condensed';font-weight:600;
  font-size:clamp(28px,6vw,64px);color:var(--txt)}
.rc .pitboard .plbl{color:var(--dim);font-size:clamp(12px,2vw,18px);
  text-transform:uppercase;letter-spacing:.15em}
.rc .pitboard .close{position:absolute;top:16px;right:20px;font-size:26px;
  background:none;border:1px solid var(--line);border-radius:8px;color:var(--dim);
  width:44px;height:44px;cursor:pointer}
.rc .pbrow{display:flex;gap:1.6vw;flex-wrap:wrap;justify-content:center}
.rc .pitboard .pbcard{background:rgba(255,255,255,.035);border:1px solid var(--line);
  border-radius:16px;padding:1.4vh 2.6vw;min-width:170px}
.rc .pitboard .chips{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;
  align-items:center}
.rc .pitboard .chip2{font-family:'Barlow Condensed';font-weight:700;letter-spacing:.08em;
  padding:5px 16px;border-radius:9px;font-size:clamp(15px,2.4vw,22px);line-height:1;
  border:1px solid}
.rc .pitboard .chip2.fuel{color:var(--green);border-color:var(--green);
  background:rgba(46,204,113,.12)}
.rc .pitboard .chip2.tyre{color:var(--teal);border-color:var(--teal);
  background:rgba(38,198,218,.10)}
.rc .pitboard .chip2.none{color:var(--dim);border-color:var(--line);
  background:rgba(255,255,255,.03)}
/* --- dashboard --- */
.rc .dgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}
.rc .infocard{text-align:center}
.rc .infocard .disp{justify-content:center}
.rc .infocard .hint{text-align:center}
/* tıklanabilir kart + büyütme (lightbox) animasyonları */
.rc .infocard.clickable{cursor:zoom-in;transition:transform .18s ease,border-color .18s ease,
  box-shadow .18s ease}
.rc .infocard.clickable:hover{transform:translateY(-3px) scale(1.02);border-color:var(--teal);
  box-shadow:0 8px 24px rgba(0,0,0,.45)}
.rc .infocard.clickable:active{transform:scale(.98)}
.rc .lightbox{position:fixed;inset:0;z-index:1000;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:14px;padding:32px;cursor:zoom-out;
  background:rgba(10,6,10,.88);backdrop-filter:blur(5px);animation:lbfade .22s ease}
.rc .lightbox img{max-width:90vw;max-height:78vh;object-fit:contain;
  animation:lbzoom .3s cubic-bezier(.2,.85,.3,1.12);
  filter:drop-shadow(0 16px 48px rgba(0,0,0,.75))}
.rc .lightbox .lbcap{font-family:'Barlow Condensed';font-size:20px;letter-spacing:.05em;
  text-transform:uppercase;color:var(--txt);animation:lbfade .4s ease}
.rc .lightbox .lbclose{position:absolute;top:18px;right:22px;background:var(--panel2);
  border:1px solid var(--line);border-radius:8px;color:var(--txt);font-size:16px;
  padding:6px 12px;cursor:pointer}
.rc .lightbox .lbclose:hover{border-color:var(--car);color:#FFE9ED}
@keyframes lbfade{from{opacity:0}to{opacity:1}}
@keyframes lbzoom{from{transform:scale(.5);opacity:0}to{transform:scale(1);opacity:1}}
/* lightbox tempo kademeleri paneli */
.rc .lbtiers{background:var(--panel2);border:1px solid var(--line);border-radius:12px;
  padding:12px 18px;min-width:320px;cursor:default;animation:lbzoom .3s cubic-bezier(.2,.85,.3,1.12)}
.rc .lbtr{display:flex;align-items:center;gap:10px;padding:3px 0;font-size:13px}
.rc .lbtr i{width:10px;height:10px;border-radius:3px;flex:0 0 auto}
.rc .lbtr .lbl{flex:1;letter-spacing:.06em;font-size:11px;color:var(--muted);
  text-transform:uppercase}
.rc .lbtr b{font-size:14px}
.rc .lbtr:first-child .lbl{color:var(--txt);font-weight:700}
.rc .lbtr:first-child{border-bottom:1px solid var(--line);padding-bottom:6px;margin-bottom:4px}
.rc .lbsrc{margin-top:8px;padding-top:6px;border-top:1px solid var(--line);font-size:9.5px;
  color:var(--muted);letter-spacing:.04em}
`;

function Num({ v, onC, step = 0.01, w }) {
  return <input type="number" step={step} value={v} style={w ? { width: w } : {}}
    onChange={(e) => onC(parseFloat(e.target.value) || 0)} />;
}

/* pilot dağılımı için donut grafik */
const PIE_COLORS = ["#2DD4BF", "#F2C94C", "#960018", "#9B6DFF", "#4C9AFF",
  "#FF8A3D", "#59C36A", "#EC5CA6", "#00B8D9", "#C0CA33"];
function Donut({ data, size = 190, thickness = 34 }) {
  const total = data.reduce((a, d) => a + d.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="rgba(255,255,255,.06)" strokeWidth={thickness} />
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        {data.map((d, i) => {
          const dash = (d.value / total) * c;
          const el = (
            <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none"
              stroke={d.color} strokeWidth={thickness}
              strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={-acc}>
              <title>{`${d.name}: ${((d.value / total) * 100).toFixed(1)}%`}</title>
            </circle>
          );
          acc += dash;
          return el;
        })}
      </g>
      <text x="50%" y="47%" textAnchor="middle" fill="var(--txt)"
        style={{ fontFamily: "'Barlow Condensed'", fontSize: 30, fontWeight: 700 }}>
        {data.length}</text>
      <text x="50%" y="60%" textAnchor="middle" fill="var(--dim)"
        style={{ fontFamily: "'Barlow Condensed'", fontSize: 12, letterSpacing: ".1em" }}>
        PİLOT</text>
    </svg>
  );
}

/* marka şimşek logosu (favicon.svg) — Virtual Energy simgesi olarak ⚡ yerine kullanılır */
/* Kutu grafiği (box plot): kutu = Q1–Q3, orta çizgi = medyan,
   bıyıklar 1.5×IQR içindeki en uç turlara uzanır, dışındakiler nokta olarak çizilir. */
const quantile = (sorted, q) => {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
};

function BoxPlot({ series, fmt, height = 300 }) {
  const stats = series.map((s) => {
    const v = [...s.values].sort((a, b) => a - b);
    if (!v.length) return null;
    const q1 = quantile(v, 0.25), med = quantile(v, 0.5), q3 = quantile(v, 0.75);
    const iqr = q3 - q1;
    const inl = v.filter((x) => x >= q1 - 1.5 * iqr && x <= q3 + 1.5 * iqr);
    return {
      ...s, q1, med, q3,
      lo: inl.length ? inl[0] : v[0],
      hi: inl.length ? inl[inl.length - 1] : v[v.length - 1],
      out: v.filter((x) => x < q1 - 1.5 * iqr || x > q3 + 1.5 * iqr),
      n: v.length,
    };
  }).filter(Boolean);
  if (!stats.length) return null;

  const W = 760, H = height, padL = 78, padR = 18, padT = 18, padB = 40;
  const all = stats.flatMap((s) => [s.lo, s.hi, ...s.out]);
  let min = Math.min(...all), max = Math.max(...all);
  const pad = Math.max((max - min) * 0.12, 400);
  min -= pad; max += pad;
  const y = (v) => padT + (H - padT - padB) * (1 - (v - min) / (max - min));
  const band = (W - padL - padR) / stats.length;
  const bw = Math.min(78, band * 0.44);
  const ticks = Array.from({ length: 5 }, (_, i) => min + ((max - min) * i) / 4);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}
      style={{ overflow: "visible" }} role="img">
      {ticks.map((tv, i) => (
        <g key={i}>
          <line x1={padL} x2={W - padR} y1={y(tv)} y2={y(tv)}
            stroke="#2B3542" strokeDasharray="3 3" />
          <text x={padL - 8} y={y(tv) + 4} textAnchor="end"
            fill="#8C97A5" fontSize="11" fontFamily="IBM Plex Mono">{fmt(tv)}</text>
        </g>
      ))}
      {stats.map((s, i) => {
        const cx = padL + band * (i + 0.5);
        const lx = cx - bw / 2 - 7;
        const lbl = (v, key) => (
          <text key={key} x={lx} y={y(v) + 3.5} textAnchor="end" fill={s.color}
            fontSize="10.5" fontFamily="IBM Plex Mono">{fmt(v)}</text>
        );
        return (
          <g key={s.key}>
            <line x1={cx} x2={cx} y1={y(s.hi)} y2={y(s.q3)} stroke={s.color} strokeWidth="1.5" />
            <line x1={cx} x2={cx} y1={y(s.q1)} y2={y(s.lo)} stroke={s.color} strokeWidth="1.5" />
            <line x1={cx - 13} x2={cx + 13} y1={y(s.hi)} y2={y(s.hi)} stroke={s.color} strokeWidth="1.5" />
            <line x1={cx - 13} x2={cx + 13} y1={y(s.lo)} y2={y(s.lo)} stroke={s.color} strokeWidth="1.5" />
            <rect x={cx - bw / 2} y={y(s.q3)} width={bw} height={Math.max(2, y(s.q1) - y(s.q3))}
              fill={s.color} fillOpacity="0.22" stroke={s.color} strokeWidth="1.5" rx="2" />
            <line x1={cx - bw / 2} x2={cx + bw / 2} y1={y(s.med)} y2={y(s.med)}
              stroke={s.color} strokeWidth="2.5" />
            {s.out.map((o, oi) => (
              <circle key={oi} cx={cx} cy={y(o)} r="2.6" fill="none"
                stroke={s.color} strokeWidth="1.2" strokeOpacity="0.75" />
            ))}
            {[[s.hi, "hi"], [s.q3, "q3"], [s.med, "md"], [s.q1, "q1"], [s.lo, "lo"]]
              .map(([v, k]) => lbl(v, k))}
            <text x={cx} y={H - padB + 20} textAnchor="middle" fill={s.color}
              fontSize="12" fontWeight="700">{s.label}</text>
            <text x={cx} y={H - padB + 34} textAnchor="middle" fill="#8C97A5" fontSize="10">
              n={s.n}</text>
          </g>
        );
      })}
    </svg>
  );
}

function Bolt({ size = 16, color = "var(--green)" }) {
  return (
    <svg width={size} height={size * 46 / 48} viewBox="0 0 48 46" fill="none"
      style={{ verticalAlign: "-2px", flexShrink: 0 }} aria-hidden="true">
      <path fill={color} d="M25.946 44.938c-.664.845-2.021.375-2.021-.698V33.937a2.26 2.26 0 0 0-2.262-2.262H10.287c-.92 0-1.456-1.04-.92-1.788l7.48-10.471c1.07-1.497 0-3.578-1.842-3.578H1.237c-.92 0-1.456-1.04-.92-1.788L10.013.474c.214-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.471c-1.07 1.498 0 3.579 1.842 3.579h11.377c.943 0 1.473 1.088.89 1.83L25.947 44.94z" />
    </svg>
  );
}

function ytId(url) {
  if (!url) return null;
  const m = String(url).match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|live\/|embed\/|shorts\/)|v=)([\w-]{11})/);
  return m ? m[1] : null;
}

function Tyre({ size = 16 }) {
  return (
    <img src={`${ASSET}tyre.png`} alt="" aria-hidden="true"
      style={{ height: size, width: "auto", verticalAlign: "-2px", flexShrink: 0 }}
      onError={(e) => { e.currentTarget.style.display = "none"; }} />
  );
}

export default function App() {
  const [st, setSt] = useState(DEFAULT_STATE);
  const [tab, setTab] = useState("dash");

  /* ---------- Faz 2: takım senkronizasyonu + yetki ---------- */
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem("crm-lang") || "tr"; } catch { return "tr"; }
  });
  const t = (str) => (lang === "en" ? (EN[str] ?? str) : str);
  const switchLang = (l) => {
    setLang(l);
    try { localStorage.setItem("crm-lang", l); } catch {}
  };
  /* CSS text-transform:uppercase harf kurallarını belge diline göre uygular.
     lang="tr" sabit kalırsa İngilizce'de de i → İ olur (STİNT, PİT...). */
  useEffect(() => {
    document.documentElement.lang = lang === "en" ? "en" : "tr";
  }, [lang]);
  const [entered, setEntered] = useState(false); // lobi geçildi mi (solo/oda)
  const [pickDone, setPickDone] = useState(false); // pist/araç seçimi tamamlandı mı
  const [setupDone, setSetupDone] = useState(false); // data giriş adımı tamamlandı mı
  const [userName, setUserName] = useState("");
  const [curRace, setCurRace] = useState("");    // aktif yarış id (takım içinde)
  const [role, setRole] = useState("editor");    // "editor" | "viewer" (takım rolünden)
  const [syncMsg, setSyncMsg] = useState("");
  const [lastSync, setLastSync] = useState(null); // {by, at}
  const sync = useRef({ rev: 0, applying: false, timer: null });
  const stRef = useRef(st);
  stRef.current = st;

  const pushState = async (rid) => {
    try {
      const rev = sync.current.rev + 1;
      await raceStateSet(curTeamRef.current, rid, {
        stateJson: JSON.stringify(stRef.current), rev,
        updatedBy: userName || "isimsiz", updatedAt: Date.now(),
      });
      sync.current.rev = rev; setLastSync({ by: t("sen"), at: Date.now() }); setSyncMsg("");
    } catch (e) { setSyncMsg(t("Yazma hatası — tekrar denenecek")); }
  };

  const schedulePush = () => {
    if (!curRace || role !== "editor" || sync.current.applying) return;
    clearTimeout(sync.current.timer);
    sync.current.timer = setTimeout(() => pushState(curRace), 800);
  };

  // her state değişiminde (kullanıcı kaynaklı) paylaş
  useEffect(() => { schedulePush(); /* eslint-disable-next-line */ }, [st]);

  // odayı anlık dinle (Firebase onValue — polling'e gerek yok)
  useEffect(() => {
    if (!curRace) return;
    const off = raceStateSubscribe(curTeamRef.current, curRace, (remote) => {
      if (remote.rev > sync.current.rev) {
        sync.current.applying = true;
        sync.current.rev = remote.rev;
        setSt(migrate(JSON.parse(remote.stateJson)));
        setLastSync({ by: remote.updatedBy, at: remote.updatedAt });
        setTimeout(() => { sync.current.applying = false; }, 50);
      }
    });
    return () => off();
  }, [curRace]);

  /* ---------- YARIŞ AÇ / KAPAT (oda kodu ve PIN yok) ---------- */
  const openRace = async (rid) => {
    if (!curTeam || !rid) return;
    try {
      const remote = await raceStateGet(curTeam, rid);
      sync.current.applying = true;
      sync.current.rev = remote?.rev || 0;
      if (remote?.stateJson) {
        setSt(migrate(JSON.parse(remote.stateJson)));
        setLastSync({ by: remote.updatedBy, at: remote.updatedAt });
      }
      setCurRace(rid);
      setRole(canEditTeam ? "editor" : "viewer");
      setEntered(true); setPickDone(true); setSetupDone(true);
      setTeamOpen(false); setSyncMsg("");
      setTimeout(() => { sync.current.applying = false; }, 60);
    } catch (e) { setSyncMsg(t("Bağlantı hatası: ") + e.message); }
  };

  const leaveRace = () => {
    setCurRace(""); setRole("editor"); setLastSync(null); setSyncMsg("");
    setEntered(false); setPickDone(false); setSetupDone(false);
  };

  const up = (patch) => setSt((s) => ({ ...s, ...patch }));
  /* dizileri gerektiği kadar uzatır (14 stint sınırını kaldırır) */
  const grow = (s, n) => ({
    ...s,
    pits: s.pits.length >= n ? s.pits
      : [...s.pits, ...Array.from({ length: n - s.pits.length },
          () => ({ fuel: true, lane: true, tyres: [false, false, false, false] }))],
    overrides: s.overrides.length >= n ? s.overrides
      : [...s.overrides, ...Array(n - s.overrides.length).fill("")],
    tyreStints: s.tyreStints.length >= n ? s.tyreStints
      : [...s.tyreStints, ...Array.from({ length: n - s.tyreStints.length }, () => ["", "", "", ""])],
    driverAssign: s.driverAssign.length >= n ? s.driverAssign
      : [...s.driverAssign, ...Array(n - s.driverAssign.length).fill("")],
  });

  const upPit = (i, patch) => setSt((s0) => {
    const s = grow(s0, i + 2);
    const pits = s.pits.map((p, j) => (j === i ? { ...p, ...patch } : p));
    return { ...s, pits };
  });
  const upTyre = (i, t) => setSt((s0) => {
    const s = grow(s0, i + 3); // i+1 satırına lastik yazılabilir
    /* tık döngüsü: 0 taşı → 1 yeni kuru → 2 Qual'a dön → 3 wet → 0.
       Yeni kuru için limit doluysa 1 atlanır (2'ye geçilir). */
    const cur = tyState(s.pits[i].tyres[t]);
    const planLen = computePlan(s, "race").rows.length;
    const usedDry = new Set();
    s.tyreQual.forEach((v) => { const k = String(v).trim(); if (k && k !== "W") usedDry.add(k); });
    s.tyreStints.slice(0, planLen).forEach((r) => r.forEach((v) => {
      const k = String(v).trim(); if (k && k !== "W") usedDry.add(k); }));
    let nextState = (cur + 1) % 5;
    if (nextState === 1 && usedDry.size >= s.tyreLimit) nextState = 2;
    const pits = s.pits.map((p, j) => {
      if (j !== i) return p;
      const tyres = [...p.tyres]; tyres[t] = nextState;
      return { ...p, tyres };
    });
    /* Lastik tablosu senkronu: pit i = S(i+1) sonu → lastik S(i+2)'ye takılır
       1: yeni numara · 2: o köşenin Qual numarası · 3: "W" · 0: önceki stintten devam */
    let tyreStints = s.tyreStints;
    const next = i + 1; // tyreStints index'i (S(i+2) satırı)
    if (next < s.tyreStints.length) {
      const prevVal = String((s.tyreStints[i] || [])[t] || "").trim();
      let val;
      if (nextState === 1) {
        let n = 1; while (usedDry.has(String(n))) n++;
        val = String(n);
      } else if (nextState === 2) {
        val = String((s.tyreQual || [])[t] || "").trim();
      } else if (nextState === 3) {
        val = "W";
      } else if (nextState === 4) {
        /* eski (kullanılmış) kuru lastiği tekrar tak:
           bu köşenin geçmişinde en son kullanılan, öncekinden farklı numara */
        const hist = [];
        for (let j = i; j >= 0; j--) {
          const v = String((s.tyreStints[j] || [])[t] || "").trim();
          if (v && v !== "W") hist.push(v);
        }
        const q = String((s.tyreQual || [])[t] || "").trim();
        if (q) hist.push(q);
        val = hist.find((v) => v !== prevVal) || q || prevVal;
      } else {
        val = prevVal; // taşı
      }
      tyreStints = s.tyreStints.map((r, j) =>
        j === next ? r.map((c, ci) => (ci === t ? val : c)) : r);
    }
    return { ...s, pits, tyreStints };
  });
  const upOvr = (i, val) => setSt((s0) => {
    const s = grow(s0, i + 2);
    const overrides = [...s.overrides]; overrides[i] = val;
    const patch = { overrides };
    if (parseHMS(val) > 0) { // time override girildi → lap override'ı temizle
      const lapOverrides = [...(s.lapOverrides || [])]; lapOverrides[i] = "";
      patch.lapOverrides = lapOverrides;
    }
    return { ...s, ...patch };
  });
  /* Tur manuel override: computed'dan başlayıp ±adım; time override'ı temizler */
  const bumpLaps = (i, curLaps, delta) => setSt((s0) => {
    const s = grow(s0, i + 2);
    const lapOverrides = [...(s.lapOverrides || [])];
    const base = Number(lapOverrides[i]) || curLaps;
    lapOverrides[i] = String(Math.max(1, base + delta));
    const overrides = [...s.overrides]; overrides[i] = ""; // karşılıklı dışlama
    return { ...s, lapOverrides, overrides };
  });
  const clearLaps = (i) => setSt((s0) => {
    const lapOverrides = [...(s0.lapOverrides || [])]; lapOverrides[i] = "";
    return { ...s0, lapOverrides };
  });

  const mode = tab === "code80" ? "code80" : "race";
  const plan = useMemo(() => computePlan(st, mode), [st, mode]);
  const racePlan = useMemo(() => computePlan(st, "race"), [st]);
  const lsf = useMemo(() => lastStintFuel(st.lastStintCountdown, st, computePlan(st, "race").flagExtra), [st]);
  const lsf80 = useMemo(() => lastStintFuel(st.code80LastStint, st), [st]);
  const totalVE = effCons(st) * plan.totalLaps + st.extraLap * effCons(st); // % VE (DATA I2)
  const totalFuelL = totalVE * st.fuelRatio;            // gerçek litre karşılığı
  const fuelCarried = 100 * st.fuelRatio;               // %100 = taşınan yakıt (L)
  const realPerLap = st.consumption * st.fuelRatio;     // gerçek tüketim L/tur
  const TY = ["FL", "FR", "RL", "RR"];

  /* ---------- Faz 3: lastik stratejisi ---------- */
  /* stint bazlı hızlı lastik atama
     FL=0 FR=1 RL=2 RR=3 · fresh: kullanılmamış en küçük numaralar */
  const quickTyre = (rowIdx, action) => setSt((s0) => {
    const s = grow(s0, rowIdx + 2);
    const planLen = computePlan(s, "race").rows.length;
    const used = new Set();
    s.tyreQual.forEach((v) => { const k = String(v).trim(); if (k && k !== "W") used.add(k); });
    s.tyreStints.slice(0, planLen).forEach((r) => r.forEach((v) => {
      const k = String(v).trim(); if (k && k !== "W") used.add(k); }));
    let n = 1;
    const fresh = () => { while (used.has(String(n))) n++; used.add(String(n)); return String(n); };
    const prev = rowIdx === 0 ? s.tyreQual : (s.tyreStints[rowIdx - 1] || ["", "", "", ""]);
    const FRESH_AT = {
      new4: [0, 1, 2, 3], fronts: [0, 1], rears: [2, 3],
      lefts: [0, 2], rights: [1, 3],
      fl: [0], fr: [1], rl: [2], rr: [3],   // tek lastik
    }[action];
    if (FRESH_AT && used.size + FRESH_AT.length > s.tyreLimit)
      return s0; // yeterli yeni lastik yok → aksiyon engellenir
    let row;
    if (action === "clear") row = ["", "", "", ""];
    else if (action === "carry") row = [...prev];
    else if (action === "wet4") row = ["W", "W", "W", "W"];
    else if (action === "qual4") row = s.tyreQual.map((v) => String(v || "").trim());
    else row = [0, 1, 2, 3].map((ci) =>
      FRESH_AT.includes(ci) ? fresh() : String(prev[ci] || "").trim());
    const tyreStints = s.tyreStints.map((r, i) => (i === rowIdx ? row : r));
    /* pit butonu senkronu: S(rowIdx+1)'den önceki pit = pits[rowIdx-1]
       önceki stintten farklı lastik taşıyan köşe = o pitte değişim var */
    let pits = s.pits;
    if (rowIdx >= 1) {
      const pv = prev.map((v) => String(v || "").trim());
      const flags = row.map((v, ci) => {
        const k = String(v || "").trim();
        const qualV = String((s.tyreQual || [])[ci] || "").trim();
        const seen = s.tyreQual.some((x) => String(x).trim() === k) ||
          s.tyreStints.slice(0, rowIdx).some((r2) =>
            (r2 || []).some((x) => String(x).trim() === k));
        return k === "" || k === pv[ci] ? 0 : k === "W" ? 3
          : k === qualV ? 2 : seen ? 4 : 1;
      });
      pits = s.pits.map((p, j) => (j === rowIdx - 1 ? { ...p, tyres: flags } : p));
    }
    return { ...s, tyreStints, pits };
  });

  /* stinte özel ortalama tur süresi (boş → yarış datasındaki ortalama kullanılır) */
  const upStintLap = (i, v) => setSt((s0) => {
    const s = grow(s0, i + 2);
    const stintLaps = [...(s.stintLaps || [])];
    stintLaps[i] = v;
    return { ...s, stintLaps };
  });

  const upTyreCell = (row, col, val) => setSt((s0) => {
    const s = grow(s0, row + 2);
    if (row === -1) {
      const tyreQual = [...s.tyreQual]; tyreQual[col] = val;
      return { ...s, tyreQual };
    }
    const tyreStints = s.tyreStints.map((r, i) =>
      i === row ? r.map((c, j) => (j === col ? val : c)) : r);
    /* pit butonu senkronu (S1'in öncesinde pit yok, o hariç) */
    let pits = s.pits;
    if (row >= 1) {
      const prevV = String((s.tyreStints[row - 1] || [])[col] ?? "").trim();
      const k = String(val).trim();
      const qualV = String((s.tyreQual || [])[col] || "").trim();
      const seenBefore = (kk) => {
        if (s.tyreQual.some((v) => String(v).trim() === kk)) return true;
        for (let j = 0; j < row; j++)
          if ((s.tyreStints[j] || []).some((v) => String(v).trim() === kk)) return true;
        return false;
      };
      const flag = k === "" || k === prevV ? 0 : k === "W" ? 3
        : k === qualV ? 2 : seenBefore(k) ? 4 : 1;
      pits = s.pits.map((p, j) => {
        if (j !== row - 1) return p;
        const tyres = [...p.tyres]; tyres[col] = flag;
        return { ...p, tyres };
      });
    }
    return { ...s, tyreStints, pits };
  });
  const clearTyres = () => setSt((s) => ({
    ...s,
    tyreQual: ["1", "2", "3", "4"],
    tyreStints: s.tyreStints.map(() => ["", "", "", ""]),
  }));

  /* boş hücre = o köşede lastik değişmedi → önceki stintten (yoksa Qual'dan) taşınan lastik.
     Depoya yazılmaz, sadece görsel; fiziksel olarak aynı lastik olduğu için sayıma girmez. */
  const carriedAt = (rowIndex, col) => {
    for (let j = rowIndex - 1; j >= 0; j--) {
      const v = String((st.tyreStints[j] || [])[col] || "").trim();
      if (v) return v;
    }
    return String((st.tyreQual || [])[col] || "").trim();
  };
  const tyreInfo = useMemo(() => {
    const rows = [{ label: "Qual", row: -1, vals: st.tyreQual }];
    for (let i = 0; i < racePlan.rows.length; i++)
      rows.push({ label: `S${i + 1}`, row: i, vals: st.tyreStints[i] || ["", "", "", ""] });
    const counts = {}; const qualSets = new Set();
    const posCols = {}; // set no → kullanıldığı sütunlar (köşe kilidi)
    rows.forEach((r) => r.vals.forEach((v, ci) => {
      const k = String(v).trim();
      if (!k) return;
      counts[k] = (counts[k] || 0) + 1;
      if (k === "W") return; // wet: sınırsız — limit/çakışma dışında
      if (r.row === -1) qualSets.add(k);
      (posCols[k] = posCols[k] || new Set()).add(ci);
    }));
    const conflicts = Object.keys(posCols).filter((k) => posCols[k].size > 1);
    const conflictSet = new Set(conflicts);
    const cellCls = (v) => {
      const k = String(v).trim();
      if (!k) return "";
      if (k === "W") return "tw";
      if (conflictSet.has(k)) return "terr";
      const c = counts[k];
      if (c >= 4) return "t4";
      if (c === 3) return "t3";
      if (c === 2) return qualSets.has(k) ? "tq" : "t2";
      return "";
    };
    // sütun ci için seçilebilir mi: hiç kullanılmamış YA DA sadece bu sütunda kullanılmış
    const allowedIn = (k, ci) => !posCols[k] || (posCols[k].size === 1 && posCols[k].has(ci));
    const usedList = Object.keys(counts).filter((k) => k !== "W")
      .sort((a, b) => (Number(a) || 0) - (Number(b) || 0));
    const used = usedList.length;
    const wetUsed = counts["W"] || 0;
    return { rows, cellCls, used, usedList, wetUsed, counts, allowedIn, conflicts,
      available: st.tyreLimit - used };
  }, [st.tyreQual, st.tyreStints, st.tyreLimit, racePlan.rows.length]);

  /* hızlı lastik atamada satır başına son seçilen aksiyon (rozet gösterimi) */
  const [qsel, setQsel] = useState({});
  const QSEL_LBL = {
    new4: "🆕 4 Yeni", carry: "⟳ Devam", fronts: "Önler", rears: "Arkalar",
    lefts: "Sollar", rights: "Sağlar", wet4: "🌧 4 Wet", qual4: "Q Qual", clear: "✕",
    fl: "FL", fr: "FR", rl: "RL", rr: "RR",
  };

  /* ---------- Faz 3: pilotlar ---------- */
  const [newDriver, setNewDriver] = useState("");
  const addDriver = () => {
    const n = newDriver.trim();
    if (!n || st.roster.includes(n)) return;
    setSt((s) => ({ ...s, roster: [...s.roster, n] }));
    setNewDriver("");
  };
  const removeDriver = (n) => setSt((s) => ({
    ...s,
    roster: s.roster.filter((x) => x !== n),
    driverAssign: s.driverAssign.map((a) => (a === n ? "" : a)),
  }));
  const assignDriver = (i, n) => setSt((s0) => {
    const s = grow(s0, i + 2);
    const driverAssign = [...s.driverAssign]; driverAssign[i] = n;
    /* takımdan seçilen isim kadroda yoksa otomatik kadroya eklensin
       (toplam süre / dağılım tablosu kadro üzerinden hesaplanıyor) */
    const roster = n && !s.roster.includes(n) ? [...s.roster, n] : s.roster;
    return { ...s, driverAssign, roster };
  });
  const clearAssign = () => setSt((s) => ({
    ...s, driverAssign: s.driverAssign.map(() => ""),
  }));

  const driverPlan = useMemo(() => {
    const startMs = st.raceStartMs;
    if (isNaN(startMs)) return null;
    const finishMs = startMs + racePlan.raceSec * 1000;
    const rows = [];
    let cur = startMs;
    for (const r of racePlan.rows) {
      const s0 = cur;
      const f0 = s0 + r.stintSec * 1000;                 // Excel C: kapatılmamış bitiş
      const dur = Math.max(0, Math.min(f0, finishMs) - s0); // Excel D (FARK): yarış bitişiyle kırpılır
      rows.push({ idx: r.idx, start: s0, finish: f0, dur });
      cur = f0 + r.pitSec * 1000;
    }
    const totals = {};
    rows.forEach((r, i) => {
      const d = st.driverAssign[i];
      if (!d) return;
      totals[d] = totals[d] || { stints: 0, ms: 0 };
      totals[d].stints += 1; totals[d].ms += r.dur;
    });
    const grandMs = Object.values(totals).reduce((a, t) => a + t.ms, 0);
    return { rows, startMs, finishMs, totals, grandMs };
  }, [st.raceStartMs, st.driverAssign, racePlan]);

  const fmtClock = (ms, refMs) => {
    const d = new Date(ms);
    const t = d.toLocaleTimeString(lang === "en" ? "en-GB" : "tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    if (refMs != null && new Date(refMs).toDateString() !== d.toDateString()) {
      const date = d.toLocaleDateString(lang === "en" ? "en-GB" : "tr-TR",
        { day: "2-digit", month: "2-digit" });
      return `${date} ${t}`; // gün değişti → tarih + saat
    }
    return t;
  };

  /* ---------- Faz 4: telemetri ---------- */
  const [slot, setSlot] = useState("A");
  const [chartMode, setChartMode] = useState("box"); // "box" | "line"
  const [rawTele, setRawTele] = useState("");
  const [parsed, setParsed] = useState(null);   // {headers, lapRows, ncols} | {error}
  const [mapping, setMapping] = useState(null); // {labelCol,timeCol,fuelCol,wear:[4]}
  const fmtMs = (ms) => fmtLap(ms / 1000);

  const doParse = (text) => {
    const m = parseMotecLog(text);          // önce ham kanal log'u dene
    if (m) { setParsed(m); setMapping(null); return; }
    const p = parseTelemetryText(text);
    setParsed(p);
    if (p && !p.error) setMapping(guessMapping(p));
  };
  const onTeleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => { setRawTele(String(rd.result)); doParse(String(rd.result)); };
    rd.readAsText(f);
  };

  /* %105 kuralı: dahil turlar içinde en iyisini bul, %105'ini aşanların tikini kaldır.
     Trafik, sarı bayrak, hata yapılan turlar ortalamayı ve medyanı bozmasın diye. */
  const P105 = 1.05;
  const apply105 = (laps) => {
    const cand = laps.filter((l) => l.use && l.ms > 0);
    if (cand.length < 2) return laps;
    const best = Math.min(...cand.map((l) => l.ms));
    const lim = best * P105;
    return laps.map((l) => (l.use && l.ms > lim ? { ...l, use: false } : l));
  };
  const apply105Slot = (sl) => setSt((s) => {
    const t0 = s.telemetry[sl];
    if (!t0) return s;
    return { ...s, telemetry: { ...s.telemetry, [sl]: { ...t0, laps: apply105(t0.laps) } } };
  });

  /* ham log → mevcut tur modeline çevir (yakıt litre → VE %) */
  const saveMotec = () => {
    if (!parsed?.motec) return;
    const ratio = st.fuelRatio > 0 ? st.fuelRatio : null;
    const laps = parsed.laps.map((l) => ({
      label: `Lap ${l.lap}`,
      ms: Math.round(l.sec * 1000),
      fuel: l.fuelL != null && ratio ? +(l.fuelL / ratio).toFixed(2) : null,
      fuelL: l.fuelL != null ? +l.fuelL.toFixed(2) : null,
      w: l.w.map((x) => (x == null ? null : +x.toFixed(2))),
      avgSpd: l.avgSpd != null ? Math.round(l.avgSpd) : null,
      maxSpd: l.maxSpd != null ? Math.round(l.maxSpd) : null,
      partial: !!l.partial, pit: !!l.pit,
      use: !l.pit,
    }));
    setSt((s) => ({ ...s, telemetry: { ...s.telemetry,
      [slot]: { laps: apply105(laps), name: `Stint ${slot}`, src: parsed.meta } } }));
    setRawTele(""); setParsed(null); setMapping(null);
  };

  const saveSlot = () => {
    if (!parsed || parsed.error || !mapping || mapping.timeCol < 0) return;
    const laps = parsed.lapRows.map((r) => {
      const label = String(r[mapping.labelCol] || "").trim();
      const ms = msFromCell(r[mapping.timeCol]);
      const fuelRaw = mapping.fuelCol >= 0
        ? parseFloat(String(r[mapping.fuelCol] || "").replace(",", ".")) : NaN;
      const w = mapping.wear.map((wi) => wi >= 0
        ? parseFloat(String(r[wi] || "").replace(",", ".")) : NaN);
      const refuel = !isNaN(fuelRaw) && fuelRaw > 0; // pozitif değişim = dolum turu
      const abs = isNaN(fuelRaw) ? null : Math.abs(fuelRaw);
      const lit = mapping.fuelIsLitre && st.fuelRatio > 0;
      return {
        label, ms,
        fuel: abs == null ? null : (lit ? +(abs / st.fuelRatio).toFixed(2) : abs),
        fuelL: lit ? +abs.toFixed(2) : null,
        w: w.map((x) => (isNaN(x) ? null : x)),
        use: ms != null && !/^out/i.test(label) && !refuel,
      };
    }).filter((l) => l.ms != null);
    if (!laps.length) return;
    setSt((s) => ({ ...s, telemetry: { ...s.telemetry,
      [slot]: { laps: apply105(laps), name: `Stint ${slot}` } } }));
    setRawTele(""); setParsed(null); setMapping(null);
  };

  const toggleLap = (sl, li) => setSt((s) => {
    const t = s.telemetry[sl]; if (!t) return s;
    const laps = t.laps.map((l, i) => (i === li ? { ...l, use: !l.use } : l));
    return { ...s, telemetry: { ...s.telemetry, [sl]: { ...t, laps } } };
  });
  const removeSlot = (sl) => setSt((s) => ({
    ...s, telemetry: { ...s.telemetry, [sl]: null } }));

  const slotStats = useMemo(() => {
    const out = {};
    for (const sl of ["A", "B", "C", "D"]) {
      const t = st.telemetry[sl]; if (!t) continue;
      const used = t.laps.filter((l) => l.use);
      if (!used.length) { out[sl] = { empty: true }; continue; }
      const avgMs = used.reduce((a, l) => a + l.ms, 0) / used.length;
      const fuels = used.filter((l) => l.fuel != null);
      const avgFuel = fuels.length ? fuels.reduce((a, l) => a + l.fuel, 0) / fuels.length : null;
      const avgW = [0, 1, 2, 3].map((c) => {
        const ws = used.filter((l) => l.w[c] != null);
        return ws.length ? ws.reduce((a, l) => a + l.w[c], 0) / ws.length : null;
      });
      /* Medyan: tek yavaş tur (trafik, sarı bayrak, ısınma) ortalamayı bozar,
         medyan tipik turu verir — plan için daha sağlam. */
      const med = (arr) => {
        if (!arr.length) return null;
        const v = [...arr].sort((a, b) => a - b);
        return quantile(v, 0.5);
      };
      const medMs = med(used.map((l) => l.ms));
      const medFuel = med(used.filter((l) => l.fuel != null).map((l) => l.fuel));
      const medW = [0, 1, 2, 3].map((c) => med(used.filter((l) => l.w[c] != null).map((l) => l.w[c])));
      const bestMs = Math.min(...used.map((l) => l.ms));
      out[sl] = {
        laps: used.length, totalMs: used.reduce((a, l) => a + l.ms, 0),
        avgMs, avgFuel, avgW,
        medMs, medFuel, medW,
        bestMs, lim105: bestMs * 1.05,
        dropped: t.laps.filter((l) => !l.use).length,
        tankLaps: medFuel ? 100 / medFuel : (avgFuel ? 100 / avgFuel : null),
      };
    }
    return out;
  }, [st.telemetry]);

  const chartData = useMemo(() => {
    const maxLap = Math.max(0, ...["A", "B", "C", "D"]
      .map((sl) => st.telemetry[sl]?.laps.length || 0));
    return Array.from({ length: maxLap }, (_, i) => {
      const row = { lap: i + 1 };
      for (const sl of ["A", "B", "C", "D"]) {
        const l = st.telemetry[sl]?.laps[i];
        if (l && l.use) row[sl] = +(l.ms / 1000).toFixed(3);
      }
      return row;
    });
  }, [st.telemetry]);

  const loadedSlots = ["A", "B", "C", "D"].filter((sl) => st.telemetry[sl]);
  const baseSlot = loadedSlots[0];

  /* ---------- canlı yarış modu ---------- */
  const [now, setNow] = useState(Date.now());
  const [pitboard, setPitboard] = useState(false);
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  const liveInfo = useMemo(() => {
    const startMs = st.raceStartMs;
    if (isNaN(startMs) || !racePlan.rows.length) return { status: "idle" };
    const raceMs = racePlan.raceSec * 1000;
    const finishMs = startMs + raceMs;
    if (now < startMs) return { status: "pre", toStart: startMs - now, startMs, finishMs, raceMs };
    if (now >= finishMs) return { status: "done", startMs, finishMs, raceMs };
    /* actualPits SEYREK: ap[i] = stint i sonunda gerçek pit girişi (ms) veya boş.
       İşaretlenmeyen pitler otomatik plandan ilerler (kayma olmaz). */
    const ap = st.actualPits || [];
    const auto = st.autoOvr || [];
    const plannedPitStart = [];
    { let c = startMs;
      for (const r of racePlan.rows) {
        const sSec = auto[r.idx - 1] ? racePlan.laps * racePlan.lapSec : r.stintSec;
        c += sSec * 1000; plannedPitStart.push(c); c += r.pitSec * 1000;
      } }
    /* zincir: her stint gerçek pit varsa oradan biter, yoksa plandan */
    let cur = startMs, phase = "stint", stintIdx = racePlan.rows.length - 1;
    let phaseEnd = finishMs, stintStartMs = startMs;
    for (let i = 0; i < racePlan.rows.length; i++) {
      const r = racePlan.rows[i];
      const realEnd = Number.isFinite(ap[i]) ? ap[i] : null;
      const sEnd = realEnd != null ? realEnd : cur + r.stintSec * 1000;
      if (now < sEnd) { phase = "stint"; stintIdx = i; phaseEnd = sEnd; stintStartMs = cur; break; }
      const pEnd = sEnd + r.pitSec * 1000;
      if (now < pEnd) { phase = "pit"; stintIdx = i; phaseEnd = pEnd; stintStartMs = cur; break; }
      cur = pEnd;
    }
    let lastPitIdx = -1;
    for (let i = 0; i < ap.length; i++) if (Number.isFinite(ap[i])) lastPitIdx = i;
    const lastDev = lastPitIdx >= 0 && plannedPitStart[lastPitIdx] != null
      ? ap[lastPitIdx] - plannedPitStart[lastPitIdx] : null;
    const pitsDone = ap.filter(Number.isFinite).length;
    return {
      status: "live", phase, stintIdx, phaseEnd, stintStartMs,
      pitsDone, lastPitIdx, plannedPitStart, lastDev,
      remaining: finishMs - now, elapsed: now - startMs,
      nextPitIn: phaseEnd - now, raceMs, startMs, finishMs,
      driver: st.driverAssign[stintIdx] || "",
      nextDriver: st.driverAssign[stintIdx + 1] || "",
    };
  }, [now, st.raceStartMs, st.driverAssign, st.actualPits, st.pitRepairs, st.autoOvr, racePlan]);

  /* --- gerçek pit işaretleme (sadece düzenleyici) --- */
  const canEdit = !curRace || role === "editor";
  const markPit = () => {
    if (liveInfo.status !== "live") return;
    const nowMs = Date.now();
    const i = liveInfo.stintIdx; // şu an sürülen (bitirilmekte olan) stint
    const actualPits = [...(st.actualPits || [])];
    while (actualPits.length <= i) actualPits.push(null);
    actualPits[i] = nowMs;
    const patch = { actualPits };
    /* gerçek stint süresini o stintin override'ına yaz → plan gerçeğe kilitlenir */
    const durSec = Math.round((nowMs - liveInfo.stintStartMs) / 1000);
    if (durSec > 0) {
      const overrides = [...(st.overrides || [])];
      while (overrides.length <= i) overrides.push("");
      overrides[i] = fmtHMS(durSec);
      const autoOvr = [...(st.autoOvr || [])];
      while (autoOvr.length <= i) autoOvr.push(false);
      autoOvr[i] = true;
      patch.overrides = overrides;
      patch.autoOvr = autoOvr;
    }
    up(patch);
  };
  const unmarkPit = () => {
    const ap = [...(st.actualPits || [])];
    let idx = -1;
    for (let i = 0; i < ap.length; i++) if (Number.isFinite(ap[i])) idx = i;
    if (idx < 0) return;
    ap[idx] = null;
    while (ap.length && !Number.isFinite(ap[ap.length - 1])) ap.pop();
    const patch = { actualPits: ap };
    if ((st.autoOvr || [])[idx]) { // sadece otomatik yazılan override silinir
      const overrides = [...(st.overrides || [])]; overrides[idx] = "";
      const autoOvr = [...(st.autoOvr || [])]; autoOvr[idx] = false;
      patch.overrides = overrides; patch.autoOvr = autoOvr;
    }
    up(patch);
  };
  const resetPits = () => {
    if (!confirm(t("Gerçek pit işaretlemelerini sıfırla?"))) return;
    const overrides = (st.overrides || []).map((v, i) => ((st.autoOvr || [])[i] ? "" : v));
    up({ actualPits: [], pitRepairs: [], autoOvr: [], overrides });
  };
  const setRepair = (i, v) => {
    const arr = [...(st.pitRepairs || [])];
    while (arr.length <= i) arr.push(0);
    arr[i] = Math.max(0, Number(v) || 0);
    up({ pitRepairs: arr });
  };
  const fmtDev = (ms) => {
    const a = Math.abs(ms) / 1000, m = Math.floor(a / 60), sec = Math.floor(a % 60);
    return `${m}:${String(sec).padStart(2, "0")} ${ms >= 0 ? t("geç") : t("erken")}`;
  };
  /* --- PDF çıktısı: yazdırma penceresi açar, tarayıcının "PDF olarak kaydet"i kullanılır --- */
  const exportPdf = (kind) => {
    const esc = (x) => String(x ?? "").replace(/[&<>]/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
    /* PDF başlığı: seçili yarıştan otomatik — Sezon · Round N · Yarış Adı */
    const rcInfo = races[curRace] || {};
    const seasonNm = seasons[rcInfo.seasonId]?.name || "";
    const raceNm = rcInfo.name || (rcInfo.trackId ? trackName(rcInfo.trackId) : "");
    const docTitle = [seasonNm, rcInfo.round ? `Round ${rcInfo.round}` : "", raceNm]
      .filter(Boolean).join(" · ");
    /* araç + pist görselleri için mutlak URL (yeni pencerede relatif çözülmez) */
    const abs = (p) => new URL(p, window.location.href).href;
    const carUrl = st.car ? abs(carImg(st.carClass, st.car)) : "";
    const trackUrl = st.track ? abs(`${ASSET}tracks/${TRACK_ASSET(st.track)}.png`) : "";
    const logoUrl = abs(`${ASSET}logo.png`);
    const classUrl = st.carClass ? abs(`${ASSET}class/${st.carClass}.png`) : "";
    /* cols: her sütun için hücre class'ı (renk tonu); rowCls: satır class'ı üreten fn */
    const mkTable = (head, rows, cols = [], rowCls = null) => {
      const hh = head.map((h, i) => `<th class="${cols[i] || ""}">${esc(h)}</th>`).join("");
      const bb = rows.map((r, ri) => {
        const cls = rowCls ? rowCls(ri) : "";
        return `<tr class="${cls}">${r.map((c, i) =>
          `<td class="${cols[i] || ""}">${
            c && typeof c === "object" && "html" in c ? c.html : esc(c)}</td>`).join("")}</tr>`;
      }).join("");
      return `<table><thead><tr>${hh}</tr></thead><tbody>${bb}</tbody></table>`;
    };
    let title, html;
    if (kind === "stint") {
      title = `${t("Stint Programı")} · ${st.chosen}-${racePlan.laps}`;
      const rows = racePlan.rows;
      const TYN = ["FL", "FR", "RL", "RR"];
      const svcCell = (i, isLast) => {
        if (isLast) return { html: `<span class="svc n">🏁</span>` };
        const pit = st.pits[i] || EMPTY_PIT;
        const parts = [];
        TYN.forEach((c, ti) => {
          const sv = tyState(pit.tyres[ti]);
          if (sv === 1) parts.push(`<span class="svc t">${c}</span>`);
          else if (sv === 2) parts.push(`<span class="svc q">${c}</span>`);
          else if (sv === 3) parts.push(`<span class="svc w">${c}</span>`);
          else if (sv === 4) parts.push(`<span class="svc u">${c}</span>`);
        });
        if (pit.fuel) parts.push(`<span class="svc f">⚡VE</span>`);
        return { html: parts.length ? parts.join("") : `<span class="svc n">${esc(t("geçiş"))}</span>` };
      };
      html = mkTable(
        ["#", "Stint", t("Tur"), "Start", "Finish", t("Pilot"), t("Servis"), "Pit", "End Stint", "Time Left"],
        rows.map((r, i) => {
          const dp = driverPlan?.rows?.[i];
          return [
            r.idx, fmtHMS(r.stintSec), r.lapsInStint,
            dp ? fmtClock(dp.start, driverPlan.startMs) : "—",
            dp ? fmtClock(dp.finish, driverPlan.startMs) : "—",
            st.driverAssign[i] || "—",
            svcCell(i, r.isLast),
            r.isLast ? "🏁 FINISH" : fmtHMS(r.pitSec) + (r.repairSec > 0 ? ` (+${r.repairSec}s)` : ""),
            fmtHMS(r.endSec), fmtHMS(r.timeLeft),
          ];
        }),
        ["c-idx", "", "c-lap", "c-clk", "c-clk", "c-drv", "c-svc", "c-pit", "", "c-left"],
        (ri) => rows[ri].isLast ? "r-last" : "");
    } else {
      if (!driverPlan) { alert(t("Pilotlar sekmesinden başlangıç zamanını gir")); return; }
      title = t("Pilot Programı");
      const rows = driverPlan.rows;
      html = mkTable(
        ["#", "Start", "Finish", t("Süre"), t("Pilot")],
        rows.map((r, i) => [
          r.idx, fmtClock(r.start, driverPlan.startMs), fmtClock(r.finish, driverPlan.startMs),
          fmtHMS(r.dur / 1000), st.driverAssign[i] || "—",
        ]),
        ["c-idx", "", "", "c-lap", "c-drv"],
        (ri) => rows[ri].isLast ? "r-last" : "");
      const tot = (st.roster || []).filter((n) => driverPlan.totals[n]);
      if (tot.length) {
        html += `<h2>${esc(t("Pilot Toplamları"))}</h2>` + mkTable(
          [t("Pilot"), "Stint", t("Toplam Süre"), "%"],
          tot.map((n) => {
            const d = driverPlan.totals[n];
            return [n, d.stints, fmtHMS(d.ms / 1000), driverPlan.grandMs
              ? `${((d.ms / driverPlan.grandMs) * 100).toFixed(1)}%` : "—"];
          }),
          ["c-drv", "c-idx", "", "c-ve"]);
      }
    }
    /* A4 alt bilgi kartları: stint/tur, son stint VE, pilot dağılım donut'u */
    const donutCard = (() => {
      if (!driverPlan || !Object.keys(driverPlan.totals).length) return "";
      const names = (st.roster || []).filter((n) => driverPlan.totals[n]);
      const size = 110, th2 = 20, r2 = (size - th2) / 2, c2 = 2 * Math.PI * r2;
      let acc = 0;
      const segs = names.map((n, i) => {
        const dash = (driverPlan.totals[n].ms / (driverPlan.grandMs || 1)) * c2;
        const s = `<circle cx="${size / 2}" cy="${size / 2}" r="${r2}" fill="none"
          stroke="${PIE_COLORS[i % PIE_COLORS.length]}" stroke-width="${th2}"
          stroke-dasharray="${dash} ${c2 - dash}" stroke-dashoffset="${-acc}"/>`;
        acc += dash; return s;
      }).join("");
      const legend = names.map((n, i) => {
        const ms = driverPlan.totals[n].ms;
        const p = driverPlan.grandMs ? ((ms / driverPlan.grandMs) * 100).toFixed(0) : "0";
        return `<div class="lg"><i style="background:${PIE_COLORS[i % PIE_COLORS.length]}"></i>${esc(n)} ${p}% · <b class="mono">${fmtHMS(Math.round(ms / 1000))}</b></div>`;
      }).join("");
      return `<div class="bcard"><div class="bt">${esc(t("Pilot Dağılımı"))}</div>
       <div style="display:flex;align-items:center;gap:12px;justify-content:center">
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
         <g transform="rotate(-90 ${size / 2} ${size / 2})">${segs}</g></svg>
        <div>${legend}</div></div></div>`;
    })();
    const bottomBar = `<div class="bbar">
 <div class="bcard"><div class="bt">Stint · ${esc(t("Tahmini Tur"))}</div>
  <div class="bv">${racePlan.fullStints} <span>stint</span></div>
  <div class="bv">${racePlan.totalLaps.toFixed(0)} <span>${esc(t("tur"))}</span></div></div>
 <div class="bcard"><div class="bt">⚡ ${esc(t("Son Stint VE"))}</div>
  <div class="bv" style="color:#0d7a43">${planLsf.refuel.toFixed(1)}%</div>
  <div class="bv"><span>+${st.extraLap} lap · ≈ ${planLsf.refuelL.toFixed(1)} L</span></div></div>
 ${donutCard}
 ${trackUrl ? `<div class="trackcard"><img src="${trackUrl}" alt="">
  <div class="tcap">${esc(trackName(st.track))}</div></div>` : ""}
</div>`;
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) { alert(t("Açılır pencere engellendi — tarayıcıdan izin ver")); return; }
    w.document.write(`<!doctype html><html><head><meta charset="utf-8">
<title>${esc(docTitle || title)}</title>
<style>
 *{box-sizing:border-box}
 body{font-family:Arial,Helvetica,sans-serif;color:#1a1113;margin:26px;font-size:12px}
 h1{font-size:19px;margin:0 0 2px;letter-spacing:.04em;text-transform:uppercase}
 h1 b{color:#960018} h2{font-size:13px;margin:20px 0 4px;text-transform:uppercase;color:#960018}
 .sub{color:#777;margin:0 0 16px;font-size:11px;border-bottom:2px solid #960018;padding-bottom:8px}
 table{border-collapse:collapse;width:100%;margin-top:6px}
 th,td{border:1px solid #d9c9cd;padding:5px 9px;text-align:left;font-variant-numeric:tabular-nums}
 th{background:#960018;color:#fff;font-size:10.5px;text-transform:uppercase;letter-spacing:.05em}
 tbody tr:nth-child(even) td{background:#faf6f7}
 /* sütun tonları */
 td.c-idx,th.c-idx{text-align:center;font-weight:700;background:#f2e6e8}
 td.c-lap,th.c-lap{text-align:center}
 td.c-ve{background:#eafaf1;color:#0d7a43;font-weight:600}
 th.c-ve{background:#2c9c63}
 td.c-clk{background:#eaf1fb;color:#1b5fae;font-weight:600}
 th.c-clk{background:#3b78c2}
 td.c-svc{white-space:nowrap}
 th.c-svc{background:#7a4dbc}
 .svc{display:inline-block;border-radius:5px;padding:1px 6px;font-size:9px;font-weight:700;
   margin:0 1px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
 .svc.t{background:#f5c84c;color:#4a3200;border:1px solid #d9a92c}
 .svc.f{background:#c01030;color:#fff;border:1px solid #8e0a22}
 .svc.n{background:#efe9ea;color:#8a7f81;border:1px solid #d9c9cd}
 .svc.q{background:#4d9fff;color:#04213f;border:1px solid #2b7fe0}
 .svc.w{background:#7fe3a0;color:#0c3a1f;border:1px solid #4fc47e}
 .svc.u{background:#1a1c22;color:#e8e8ee;border:1px solid #3a3d46}
 td.c-drv{background:#eef4fb;font-weight:600}
 th.c-drv{background:#2f6fb0}
 td.c-pit{background:#fef7e6}
 th.c-pit{background:#c9982a}
 td.c-left{font-weight:600}
 th.c-left{background:#5a3d8a}
 tbody tr.r-last td{background:#fde8ea!important;font-weight:700;color:#960018}
 /* üst başlık: logo + araç; pist sağ altta büyük sabit kutu */
 .hd{display:flex;align-items:center;gap:16px;border-bottom:2px solid #960018;
   padding-bottom:12px;margin-bottom:14px}
 .hd .logo{height:52px;width:auto;flex:0 0 auto}
 .hd .txt{flex:1 1 auto}
 .hd .carbox{width:210px;height:88px;display:flex;align-items:center;justify-content:center;
   flex:0 0 auto}
 .hd .carbox img{max-width:100%;max-height:88px;object-fit:contain}
 /* alt şerit: bilgi kartları + pist kutusu tek hizalı satır */
 .bbar{display:grid;grid-template-columns:1fr 1fr;gap:10px;align-items:stretch;
   margin-top:16px;page-break-inside:avoid;break-inside:avoid}
 .bcard{flex:1;border:1px solid #d9c9cd;border-radius:10px;padding:10px 12px;background:#faf6f7;
   display:flex;flex-direction:column;justify-content:center;
   -webkit-print-color-adjust:exact;print-color-adjust:exact}
 .bcard .bt{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#960018;
   font-weight:700;margin-bottom:6px}
 .bcard .bv{font-size:21px;font-weight:800;line-height:1.25}
 .bcard .bv span{font-size:10.5px;color:#777;font-weight:600}
 .bcard .lg{font-size:10px;display:flex;align-items:center;gap:4px;margin:2px 0;white-space:nowrap}
 .bcard .lg i{display:inline-block;width:9px;height:9px;border-radius:2px}
 .trackcard{background:#14101a;border-radius:10px;padding:10px 12px;
   display:flex;flex-direction:column;align-items:center;justify-content:center;
   -webkit-print-color-adjust:exact;print-color-adjust:exact}
 .trackcard img{max-width:100%;max-height:140px;object-fit:contain}
 .trackcard .tcap{color:#e8dfe2;font-size:10px;letter-spacing:.08em;
   text-transform:uppercase;margin-top:6px}
 .brand{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#960018;font-weight:700}
 .brand b{color:#1a1113}
 .ptitle{font-size:22px;font-weight:800;margin:2px 0 4px;letter-spacing:.01em}
 @media print{body{margin:9mm}
   th{-webkit-print-color-adjust:exact;print-color-adjust:exact}
   td,.trackcard,.bcard{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<div class="hd">
 <img class="logo" src="${logoUrl}" alt="" onerror="this.style.display='none'">
 <div class="txt">
  <div class="brand"><b>CASPIAN</b> MOTORSPORT · RACE MONITOR</div>
  <div class="ptitle">${esc(docTitle || title)}</div>
  <div style="color:#777;font-size:11px">${esc(title)} · ${esc(new Date().toLocaleString(lang === "en" ? "en-GB" : "tr-TR"))}${
      st.raceStartMs ? " · Start: " + esc(new Date(st.raceStartMs).toLocaleString(lang === "en" ? "en-GB" : "tr-TR")) : ""}${
      st.track ? " · " + esc(trackName(st.track)) : ""}${
      st.car ? " · " + esc(carName(st.carClass, st.car)) : ""}</div>
 </div>
 ${classUrl ? `<img src="${classUrl}" alt="" style="height:30px;flex:0 0 auto"
   onerror="this.style.display='none'">` : ""}
 ${carUrl ? `<div class="carbox"><img src="${carUrl}" alt=""></div>` : ""}
</div>
${html}
${bottomBar}
<script>window.onload=function(){window.print()}<\/script></body></html>`);
    w.document.close();
  };
  const pitSoon = liveInfo.status === "live" && liveInfo.phase === "stint"
    && liveInfo.nextPitIn < 300000;
  /* son stint countdown — canlıdan DEĞİL, stint planından: sondan önceki stintin Time Left'i.
     Pit tuşu override yazdıkça racePlan güncellenir, bu değer gerçeğe göre kayar. */
  const planLastCd = racePlan.rows.length >= 2
    ? racePlan.rows[racePlan.rows.length - 2].timeLeft
    : racePlan.raceSec;
  /* son stint VE — plandan (elle girilen countdown yerine gerçek kalan süreden) */
  const planLsf = lastStintFuel(fmtHMS(planLastCd), st, racePlan.flagExtra);
  const [autoCd, setAutoCd] = useState(true); // plandan otomatik countdown
  const [barOpen, setBarOpen] = useState(true); // oda katılım çubuğu aç/kapa
  const [sideOpen, setSideOpen] = useState(true); // sol data sidebar aç/kapa
  /* ---- kimlik doğrulama (Google) ---- */
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authErr, setAuthErr] = useState("");
  const [udoc, setUdoc] = useState(null);   // null=yükleniyor, {}=kayıt yok
  const [authMode, setAuthMode] = useState("in"); // "in" giriş | "up" kayıt
  const [regNote, setRegNote] = useState("");
  const [regName, setRegName] = useState("");
  useEffect(() => watchAuth((u) => { setUser(u); setAuthLoading(false); }), []);
  useEffect(() => {
    if (!user) { setUdoc(null); return; }
    setRegName((v) => v || user.displayName || "");
    touchUserProfile(user).catch(() => {});
    return watchUserDoc(user.uid, (d) => setUdoc(d));
  }, [user]);
  /* oda üyelik adı: kayıtta verilen ad soyad (yoksa Google adı) */
  useEffect(() => {
    const n = (udoc?.fullName || user?.displayName || "").trim();
    if (n) setUserName(n);
  }, [udoc, user]);
  const access = udoc?.allowed === true;
  const isAdmin = udoc?.admin === true;
  const [adminOpen, setAdminOpen] = useState(false);
  const [profOpen, setProfOpen] = useState(false);
  /* ---- takımlar ---- */
  const [teamOpen, setTeamOpen] = useState(false);
  const [myTeams, setMyTeams] = useState({});
  const [curTeam, setCurTeam] = useState("");      // seçili takım id
  const [teamData, setTeamData] = useState(null);
  const [tForm, setTForm] = useState({ name: "", join: "" });
  const [seasons, setSeasons] = useState({});
  const [races, setRaces] = useState({});
  const [curSeason, setCurSeason] = useState("");   // "" = tümü
  const [rForm, setRForm] = useState(null);          // yarış ekleme/düzenleme formu
  const [tErr, setTErr] = useState("");
  const [profName, setProfName] = useState("");
  useEffect(() => {
    if (!user || !access) return;
    return watchMyTeams(user.uid, (t) => {
      setMyTeams(t || {});
      setCurTeam((c) => c || Object.keys(t || {})[0] || "");
    });
  }, [user, access]);
  const curTeamRef = useRef("");
  curTeamRef.current = curTeam;
  useEffect(() => {
    if (!curTeam) { setTeamData(null); setSeasons({}); setRaces({}); return; }
    const o1 = watchTeam(curTeam, setTeamData);
    const o2 = watchSeasons(curTeam, (x) => setSeasons(x || {}));
    const o3 = watchRaces(curTeam, (x) => setRaces(x || {}));
    return () => { o1(); o2(); o3(); };
  }, [curTeam]);
  /* ---- sohbet: genel / takım / yarış kanalları ---- */
  /* ---- rehber turu ---- */
  const [tour, setTour] = useState(null);            // "lobby" | "main" | null
  const TOUR_L = "rm_tour_lobby", TOUR_M = "rm_tour_main";
  const seenTour = (k) => { try { return localStorage.getItem(k) === "1"; } catch { return true; } };
  const markTour = (k) => { try { localStorage.setItem(k, "1"); } catch { /* yoksay */ } };

  /* ---- yüzen mini oynatıcı ---- */
  const [streamCorner, setStreamCorner] = useState(() => {
    try { return localStorage.getItem("rm_stream_corner") || "br"; } catch { return "br"; }
  });                                                 // br | bl | tr | tl
  const [streamMin, setStreamMin] = useState(false);  // tek satıra küçült
  const [streamW, setStreamW] = useState(() => {
    try { return Math.min(1080, Math.max(240,
      +(localStorage.getItem("rm_stream_w") || 320))); } catch { return 320; }
  });
  const [streamDrag, setStreamDrag] = useState(false);
  const dragRef = useRef(null);   // { startX, startW, dir }

  /* tutamaçtan sürükleyerek boyutlandır — yükseklik 16:9'dan kendiliğinden gelir */
  const startResize = (e) => {
    e.preventDefault();
    const dir = streamCorner === "br" || streamCorner === "tr" ? -1 : 1;
    dragRef.current = { startX: e.clientX, startW: streamW, dir };
    setStreamDrag(true);
    const move = (ev) => {
      const d = dragRef.current; if (!d) return;
      const w = d.startW + (ev.clientX - d.startX) * d.dir;
      setStreamW(Math.min(Math.min(1080, window.innerWidth - 32), Math.max(240, w)));
    };
    const upFn = () => {
      dragRef.current = null;
      setStreamDrag(false);
      setStreamW((w) => {
        try { localStorage.setItem("rm_stream_w", String(Math.round(w))); }
        catch { /* yoksay */ }
        return w;
      });
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", upFn);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", upFn);
  };
  const moveStream = (c) => {
    setStreamCorner(c);
    try { localStorage.setItem("rm_stream_corner", c); } catch { /* yoksay */ }
  };

  const [lobSeason, setLobSeason] = useState("all"); // lobide şampiyona süzgeci
  const [tnEdit, setTnEdit] = useState(null);        // takım adı düzenleme metni
  const [chatOpen, setChatOpen] = useState(false);
  const [chatChan, setChatChan] = useState("team");
  const [chatAll, setChatAll] = useState({});   // { path: [mesajlar] }
  const [chatText, setChatText] = useState("");
  const [chatSeen, setChatSeen] = useState(() => {   // { path: sonGörülenTs }
    try { return JSON.parse(localStorage.getItem("rm_chat_seen_v2") || "{}"); }
    catch { return {}; }
  });
  const chatEndRef = useRef(null);
  const raceEndRef = useRef(null);

  const myRole = teamData?.members?.[user?.uid] || "";
  const canEditTeam = myRole === "owner" || myRole === "editor";
  /* rozet/rol yönetimi: takım sahibi veya site admini */
  const canManageTeam = myRole === "owner" || isAdmin;
  /* not: yetki rozetten türer — 🎧 mühendis editor, 🛞 sürücü/rozetsiz viewer */
  const myBadges = teamBadgesOf(teamData, user?.uid, udoc);

  /* Kendi görünen adımı takım düğümüne yaz — diğer üyeler pilot listesinde görsün */
  useEffect(() => {
    if (!curTeam || !user?.uid || !teamData?.members?.[user.uid]) return;
    const nm = (userName || "").trim();
    if (!nm || teamData?.names?.[user.uid] === nm) return;
    setTeamMemberName(curTeam, user.uid, nm).catch(() => {});
  }, [curTeam, user, userName, teamData]);

  /* Rozet yetkiyi belirler: 🎧 Mühendis → editor (datayı değiştirir),
     🛞 Sürücü / rozetsiz → viewer (sadece görür). Takım sahibi her zaman owner.
     Firebase kuralları rolü baz aldığı için rozet değişince rol de yazılır. */
  /* Kanallar. Yazma yetkisi role bağlı değil — sürücüler de konuşur. */
  /* Pencerede genel + takım; yarış sohbeti kendi sekmesinde (Telemetri'nin sağında) */
  const chatChans = useMemo(() => {
    const out = [{ id: "global", lbl: "Genel", ico: "🌍", path: "globalChat" }];
    if (curTeam) out.push({ id: "team", lbl: "Takım", ico: "🏢",
      path: `teams/${curTeam}/chat` });
    return out;
  }, [curTeam]);

  const raceChan = useMemo(() => (curTeam && curRace
    ? { id: "race", ico: "🏁", lbl: races[curRace]?.name || "",
      path: `teams/${curTeam}/raceChat/${curRace}` }
    : null), [curTeam, curRace, races]);

  const allChans = useMemo(() => (raceChan ? [...chatChans, raceChan] : chatChans),
    [chatChans, raceChan]);

  /* açık olmayan kanalları da dinliyoruz — okunmamış sayacı için */
  useEffect(() => {
    if (!user) { setChatAll({}); return; }
    const offs = allChans.map((c) =>
      watchChat(c.path, (msgs) => setChatAll((a) => ({ ...a, [c.path]: msgs }))));
    return () => offs.forEach((f) => f && f());
  }, [user, allChans]);

  /* seçili kanal kaybolursa (yarıştan çıkınca) geçerli bir kanala düş */
  useEffect(() => {
    if (!chatChans.some((c) => c.id === chatChan)) {
      setChatChan(chatChans[chatChans.length - 1]?.id || "global");
    }
  }, [chatChans, chatChan]);

  const curChan = chatChans.find((c) => c.id === chatChan) || chatChans[0];
  const chatMsgs = (curChan && chatAll[curChan.path]) || [];
  const unreadOf = (c) => ((chatAll[c.path] || [])
    .filter((m) => (m.at || 0) > (chatSeen[c.path] || 0) && m.uid !== user?.uid).length);
  const chatUnread = chatChans.reduce((a, c) => a + unreadOf(c), 0);
  const raceUnread = raceChan ? unreadOf(raceChan) : 0;

  /* yarış sekmesi açıkken o kanalı okundu say */
  useEffect(() => {
    if (tab !== "rchat" || !raceChan) return;
    const ms = chatAll[raceChan.path] || [];
    const last = ms.length ? (ms[ms.length - 1].at || 0) : 0;
    if (last && (chatSeen[raceChan.path] || 0) < last) {
      const next = { ...chatSeen, [raceChan.path]: last };
      setChatSeen(next);
      try { localStorage.setItem("rm_chat_seen_v2", JSON.stringify(next)); }
      catch { /* yoksay */ }
    }
    raceEndRef.current?.scrollIntoView({ block: "end" });
  }, [tab, raceChan, chatAll, chatSeen]);

  useEffect(() => {
    if (!chatOpen || !curChan) return;
    const last = chatMsgs.length ? (chatMsgs[chatMsgs.length - 1].at || 0) : Date.now();
    if ((chatSeen[curChan.path] || 0) < last) {
      const next = { ...chatSeen, [curChan.path]: last };
      setChatSeen(next);
      try { localStorage.setItem("rm_chat_seen_v2", JSON.stringify(next)); }
      catch { /* yoksay */ }
    }
    chatEndRef.current?.scrollIntoView({ block: "end" });
  }, [chatOpen, chatMsgs, curChan, chatSeen]);

  const doSendTo = async (chan) => {
    const v = chatText.trim();
    if (!v || !chan) return;
    setChatText("");
    try { await sendChat(chan.path, user, userName, v); }
    catch (e) { console.warn("mesaj gönderilemedi:", e?.message); }
  };

  /* Sohbet gövdesi — hem pencerede hem yarış sekmesinde kullanılır */
  const chatBody = (chan, h) => {
    const msgs = (chan && chatAll[chan.path]) || [];
    return (
      <div className="chatwrap" style={h ? { height: h } : undefined}>
        <div className="chatlist">
          {!msgs.length && (
            <div className="hint" style={{ margin: "auto", textAlign: "center" }}>
              {t("Henüz mesaj yok — ilk yazan sen ol.")}</div>
          )}
          {msgs.map((m, i) => {
            const me = m.uid === user?.uid;
            const prev = msgs[i - 1];
            const newDay = !prev || new Date(prev.at || 0).toDateString()
              !== new Date(m.at || 0).toDateString();
            return (
              <Fragment key={m.id}>
                {newDay && <div className="chatday">
                  {new Date(m.at || 0).toLocaleDateString(lang === "en" ? "en-GB" : "tr-TR",
                    { day: "2-digit", month: "long" })}</div>}
                <div className={`cmsg ${me ? "me" : ""}`}>
                  <div className="who">
                    {!me && <b>{teamData?.names?.[m.uid] || m.name || t("isimsiz")}</b>}
                    <span>{fmtClock(m.at || 0)}</span>
                    {(me || canManageTeam) && (
                      <button className="del" title={t("Sil")}
                        onClick={() => deleteChat(chan.path, m.id).catch(() => {})}>✕</button>
                    )}
                  </div>
                  <div className="bub">{m.text}</div>
                </div>
              </Fragment>
            );
          })}
          <div ref={chan === curChan ? chatEndRef : raceEndRef} />
        </div>
        <div className="chatbar">
          <input type="text" value={chatText} maxLength={500}
            placeholder={t("Mesaj yaz…")}
            onChange={(e) => setChatText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doSendTo(chan); }
            }} />
          <button className="gbtn ubtn" disabled={!chatText.trim()}
            style={{ opacity: chatText.trim() ? 1 : .45 }}
            onClick={() => doSendTo(chan)}>{t("Gönder")}</button>
        </div>
      </div>
    );
  };

  const chatModal = chatOpen && user && curChan && (
    <div className="wxmodal" onClick={() => setChatOpen(false)}>
      <div className="wxmbox" style={{ width: "min(560px,94vw)" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="wxmhead">
          <span>💬 {t("Sohbet")}</span>
          <button className="lbclose" onClick={() => setChatOpen(false)}>✕</button>
        </div>
        <div className="chattabs">
          {chatChans.map((c) => {
            const u2 = unreadOf(c);
            return (
              <button key={c.id} className={`ctab ${c.id === chatChan ? "on" : ""}`}
                onClick={() => setChatChan(c.id)}>
                {c.ico} {c.id === "team" ? (teamData?.meta?.name || t(c.lbl)) : t(c.lbl)}
                {u2 > 0 && c.id !== chatChan && <b className="cdot">{u2 > 9 ? "9+" : u2}</b>}
              </button>
            );
          })}
        </div>
        {chatBody(curChan)}
      </div>
    </div>
  );

  /* Mini oynatıcı: sekmeden bağımsız, köşede sabit. iframe hep aynı ağaçta kalır,
     küçültünce yalnız gizlenir — yayın kesilmez. */
  const streamPlayer = curRace && ytId(st.streamUrl) && (
    <div className={`floatstream ${streamCorner} ${streamMin ? "min" : ""}`}
      style={streamMin ? undefined : { width: streamW }}>
      <div className="fshead">
        <span className="fsgrip" title={t("Boyutlandırmak için sürükle")}
          onPointerDown={startResize}>⤡</span>
        <span className="fstitle">📺 {t("Canlı Yayın")}</span>
        <span className="fsbtns">
          {[["tl", "◤"], ["tr", "◥"], ["bl", "◣"], ["br", "◢"]].map(([c, ch]) => (
            <button key={c} className={streamCorner === c ? "on" : ""}
              title={t("Köşeye taşı")} onClick={() => moveStream(c)}>{ch}</button>
          ))}
          <button title={streamMin ? t("Büyüt") : t("Küçült")}
            onClick={() => setStreamMin(!streamMin)}>{streamMin ? "▢" : "—"}</button>
          <a href={st.streamUrl} target="_blank" rel="noreferrer"
            title={t("YouTube'da aç")}>↗</a>
        </span>
      </div>
      <div className="fsbody">
        {streamDrag && <div className="fsshield" />}
        <iframe title="stream"
          src={`https://www.youtube.com/embed/${ytId(st.streamUrl)}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen />
      </div>
    </div>
  );

  const chatBtn = user && (
    <button className="adminbtn" data-tour="hchat" onClick={() => setChatOpen(true)}
      title={t("Takım Sohbeti")}>
      💬 {t("Sohbet")}
      {chatUnread > 0 && <b className="badge">{chatUnread > 99 ? "99+" : chatUnread}</b>}
    </button>
  );

  /* Takım adı değişince kendi users/{uid}/teams kopyamı tazele — lobideki
     takım sekmeleri bu kopyayı okuyor, yoksa eski ad takılı kalır. */
  useEffect(() => {
    const nm = teamData?.meta?.name;
    if (!curTeam || !user?.uid || !nm) return;
    if (myTeams[curTeam] === nm) return;
    syncMyTeamName(user.uid, curTeam, nm).catch(() => {});
  }, [curTeam, user, teamData, myTeams]);

  /* ilk girişte lobi turu, ilk yarış açılışında ana tur kendiliğinden başlar */
  useEffect(() => {
    if (!user || !udoc?.allowed) return;
    if (!curRace && !entered && !seenTour(TOUR_L)) {
      const t0 = setTimeout(() => setTour("lobby"), 700);
      return () => clearTimeout(t0);
    }
    return undefined;
  }, [user, udoc, curRace, entered]);
  useEffect(() => {
    if (!curRace || !seenTour(TOUR_L) || seenTour(TOUR_M)) return undefined;
    const t0 = setTimeout(() => setTour("main"), 900);
    return () => clearTimeout(t0);
  }, [curRace]);

  const closeTour = () => {
    markTour(tour === "lobby" ? TOUR_L : TOUR_M);
    setTour(null);
  };

  const tourSteps = tour === "lobby" ? [
    { title: t("Race Monitor'a hoş geldin! 🏁"),
      body: t("Bu araç, LMU endurance yarışlarında pit wall'unuz: stint planı, yakıt, lastik ve canlı takip. 1 dakikada temel akışı gösterelim.") },
    { sel: "[data-tour='races']", title: t("Yarış Takvimi"),
      body: t("Takımının yaklaşan yarışları burada, şampiyonaya göre gruplu. Bir yarışa tıkla — pist, araç ve süre önceden hazır, direkt pit wall açılır.") },
    { sel: "[data-tour='manage']", title: t("Takvimi & Takımı Yönet"),
      body: t("Sezon ve yarış eklemek, üyeleri ve rozetleri yönetmek burada. 🎧 Mühendis rozeti datayı değiştirebilir, sürücüler yalnızca görür.") },
    { sel: "[data-tour='chat']", title: t("Sohbet"),
      body: t("🌍 Genel ve 🏢 Takım kanalları burada. Yarış açıkken ayrıca yarışa özel bir sohbet sekmesi belirir.") },
    { sel: "[data-tour='info']", title: t("Neler değişti"),
      body: t("Uygulama sık güncellenir — yeni sürümde kırmızı nokta belirir, notları buradan okursun. Rehberi de buradan yeniden başlatabilirsin.") },
  ] : [
    { title: t("Pit Wall'a hoş geldin"),
      body: t("Soldaki panel yarışın datası, sağı canlı plan. Kısaca gezelim — her şeyi değiştirdiğin anda takım arkadaşların da görür.") },
    /* --- üst çubuk --- */
    { sel: "[data-tour='hteam']", title: t("Takım düğmesi"),
      body: t("Takvimi ve üyeleri yönetmek her an buradan — yarışın ortasında bile. Rozetler de burada atanır.") },
    { sel: "[data-tour='hchat']", title: t("Sohbet düğmesi"),
      body: t("Genel ve takım kanalları. Okunmamış mesaj varsa üzerinde kırmızı sayı belirir.") },
    { sel: "[data-tour='uchip']", title: t("Profilin ve rozetlerin"),
      body: t("Yanındaki simgeler yetkini gösterir: 👑 Takım Sahibi yönetir, 🎧 Yarış Mühendisi datayı değiştirir, direksiyon (Sürücü) yalnızca izler, 🛡 Admin her şeye erişir. Adına tıklayıp profili düzenlersin; ⏻ çıkış yapar.") },
    { sel: "[data-tour='data']", act: () => setSideOpen(true),
      title: t("Yarış · Data"),
      body: t("Yarış süresi, ortalama tur, tüketim ve A/B/C/D stint stratejileri. Tüm plan bu değerlerden hesaplanır; telemetriden tek tıkla doldurabilirsin.") },
    { sel: "[data-tour='wx']", act: () => setSideOpen(true),
      title: t("Hava Durumu"),
      body: t("Zemin değişince buradan işaretle — plan tur tur karma havayı hesaplar. İleri saatli planlı geçiş de ekleyebilirsin.") },
    { sel: "[data-tour='rstart']", act: () => setSideOpen(true),
      title: t("Yarış Başlangıcı"),
      body: t("Start tarih-saatini gir — geri sayım ve canlı stint takibi buna göre çalışır. Saat her üyeye kendi saat diliminde gösterilir.") },
    { sel: "[data-tour='pittimes']", act: () => setSideOpen(true),
      title: t("Pit · Süreler"),
      body: t("Pit lane geçişi ve tam depo dolum süresi. Dolum, alınan VE yüzdesine ölçeklenir; lastik süreleri LMU sabitleridir (1-2 lastik 5s, 3-4 lastik 12s).") },
    { sel: "[data-tour='ve']", act: () => setSideOpen(true),
      title: t("Virtual Energy"),
      body: t("LMU'da depo daima %100 VE'dir. Ratio, VE'nin kaç litreye denk geldiğini söyler — tüm yakıt hesapları bu orandan litreye çevrilir.") },
    { sel: "[data-tour='stream']", act: () => setSideOpen(true),
      title: t("Canlı Yayın"),
      body: t("YouTube linkini yapıştır — köşede yüzen mini oynatıcı açılır. Sekme değiştirsen de akmaya devam eder; köşesinden tutup boyutlandırabilirsin.") },
    { sel: "[data-tour='tabs']", title: t("Sekmeler"),
      body: t("Şimdi sekmeleri tek tek gezelim — rehber her birini senin için açacak.") },
    /* --- Dashboard --- */
    { sel: "[data-tour='dash-prog']", act: () => setTab("dash"),
      title: t("📊 Dashboard — Stint Programı"),
      body: t("Planın özeti: her stintin bitiş saati, kalan süre ve pilotu. Yarış başlayınca satırlar canlı ilerler.") },
    { sel: "[data-tour='dash-lsf']", act: () => setTab("dash"),
      title: t("Son Stint VE"),
      body: t("Yarış sonuna kalan süreye göre son dolumda alınması gereken VE yüzdesi — extra lap ve bayrak payı dahil. Pit'te mühendisin baktığı tek sayı budur.") },
    /* --- Stint --- */
    { sel: "[data-tour='s1']", act: () => setTab("stint"),
      title: t("📋 Stint — Önce start lastiği"),
      body: t("S1 lastiklerini buradan seç — pit'lerdeki lastik seçimleri buna zincirlenir. Tekli, ikili ve dörtlü hızlı seçenekler hazır.") },
    { sel: "[data-tour='stinttable']", act: () => setTab("stint"),
      title: t("Stint Tablosu"),
      body: t("Her satır bir stint: tur, VE ihtiyacı, pit ayarı, pilot. Ort. Tur sütununa değer yazarsan o stint o tempoyla hesaplanır (hava çarpanı uygulanmaz); Override süreyi kilitler.") },
    /* --- Son Stint Yakıtı --- */
    { sel: "[data-tour='fuelcalc']", act: () => setTab("fuel"),
      title: t("⚡ Son Stint Hesaplayıcı"),
      body: t("Yarış sonu geri sayımını gir (canlıda otomatik) — kalan tur ve gereken VE hesaplanır. Ondalık tur yukarı yuvarlanır, trafik payı için.") },
    /* --- Lastik --- */
    { sel: "[data-tour='tyrecard']", act: () => setTab("tyre"),
      title: t("Lastik Stratejisi"),
      body: t("Limit sayacı, stint bazlı köşe tablosu ve hızlı atama. Wet lastikler limitten düşmez; siyah kutu eski kuru lastiği geri takar.") },
    /* --- Pilotlar --- */
    { sel: "[data-tour='roster']", act: () => setTab("drivers"),
      title: t("Pilot Kadrosu"),
      body: t("Kadroyu elle yaz ya da takım üyelerinden tek tıkla ekle. Stintlere atadıkça toplam sürüş süresi ve yüzde dağılımı hesaplanır.") },
    /* --- Telemetri --- */
    { sel: "[data-tour='teleimport']", act: () => setTab("tele"),
      title: t("📈 Telemetri"),
      body: t("MoTeC dosyanı bırak — tur raporu da ham kanal log'u da okunur. %105 kuralı yavaş turları otomatik eler, medyan tur tek tıkla DATA'ya yazılır.") },
    { sel: "[data-tour='pitboard']", title: t("Pit Board"),
      body: t("Yarış canlıyken tam ekran pit board: geri sayım, sıradaki pit ve PIT YAPILDI butonu. Gerçek pitler plana işlenir, sapma görünür.") },
    { sel: "[data-tour='pdf']", title: t("PDF çıktısı"),
      body: t("Stint programını takıma dağıtmak için tek tık — başlık sezon ve yarış adından otomatik gelir. Bu kadar! İyi yarışlar. 🏁") },
  ];

  const tourOverlay = tour && (
    <TourOverlay steps={tourSteps} onClose={closeTour} lang={lang} />
  );

  const wantRole = (uid) => (hasBadge(teamData, uid, "engineer") ? "editor" : "viewer");
  const setBadge = async (uid, id, on) => {
    if (!curTeam) return;
    try {
      await toggleTeamBadge(curTeam, uid, id, on);
      const cur = teamData?.badges?.[uid];
      const bs = typeof cur === "string" ? { [cur]: true } : { ...(cur || {}) };
      bs[id] = on;
      if (teamData?.members?.[uid] !== "owner") {
        await setTeamRole(curTeam, uid, bs.engineer ? "editor" : "viewer");
      }
    } catch (e) { console.warn("rozet/rol yazılamadı:", e?.message); }
  };

  /* Rozetler yetkiye bağlanmadan önce atanmış üyelerde rol eski kalmış olabilir.
     Sahip/admin takımı açtığında rolleri rozetlerden bir kez hizala. */
  useEffect(() => {
    if (!curTeam || !canManageTeam || !teamData?.members) return;
    Object.entries(teamData.members).forEach(([uid, r]) => {
      if (r === "owner") return;
      const w = wantRole(uid);
      if (r !== w) setTeamRole(curTeam, uid, w).catch(() => {});
    });
  }, [curTeam, canManageTeam, teamData]);
  const roleLabel = (r) => (r === "owner" ? "Takım Sahibi"
    : r === "editor" ? "Düzenleyebilir" : "Sadece görür");

  /* Takımdaki pilotlar — rozetli olanlar önce, kadroda olmayanlar ayrı grupta */
  const teamDrivers = useMemo(() => {
    const names = teamData?.names || {};
    const list = Object.entries(names)
      .map(([uid, nm]) => ({ uid, nm: String(nm || "").trim() }))
      .filter((x) => x.nm)
      .sort((a, b) => {
        const da = hasBadge(teamData, a.uid, "driver") ? 0 : 1;
        const db2 = hasBadge(teamData, b.uid, "driver") ? 0 : 1;
        return da - db2 || a.nm.localeCompare(b.nm, "tr");
      })
      .map((x) => x.nm);
    return Array.from(new Set(list));
  }, [teamData]);

  const [allUsers, setAllUsers] = useState({});
  useEffect(() => {
    if (!isAdmin || !adminOpen) return;
    return watchAllUsers((u) => setAllUsers(u || {}));
  }, [isAdmin, adminOpen]);
  const doSignIn = async (mode = "in") => {
    setAuthErr(""); setAuthMode(mode);
    try { await signInGoogle(); }
    catch (e) {
      setAuthErr(e?.message === "POPUP_BLOCKED"
        ? t("Tarayıcı açılır pencereyi engelledi. Bu site için açılır pencerelere izin verip tekrar deneyin.")
        : (e?.message || String(e)));
    }
  };
  /* ---- sürüm notları penceresi ---- */
  const [verOpen, setVerOpen] = useState(false);
  const [seenVer, setSeenVer] = useState(() => {
    try { return localStorage.getItem(SEEN_VER_KEY) || ""; } catch { return ""; }
  });
  const openVersions = () => {
    setVerOpen(true);
    try { localStorage.setItem(SEEN_VER_KEY, APP_VERSION); } catch { /* yoksay */ }
    setSeenVer(APP_VERSION);
  };
  const verNew = seenVer !== APP_VERSION;
  const infoBtn = (
    <button className="infobtn" data-tour="info" onClick={openVersions}
      title={t("Neler değişti")} aria-label={t("Neler değişti")}>
      i{verNew && <span className="nd" />}
    </button>
  );
  const versionModal = verOpen && (
    <div className="wxmodal" onClick={() => setVerOpen(false)}>
      <div className="wxmbox" style={{ width: "min(560px,94vw)" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="wxmhead">
          <span>ℹ {t("Neler değişti")}</span>
          <button className="lbclose" onClick={() => setVerOpen(false)}>✕</button>
        </div>
        <div className="wxmlist" style={{ padding: 0, maxHeight: "62vh" }}>
          {CHANGELOG.map((c) => (
            <div className="clgv" key={c.v}>
              <h4>{c.v}{c.v === APP_VERSION &&
                <span className="cur">{t("ŞU AN")}</span>}</h4>
              <div className="cdate">{c.date}</div>
              <ul>{(lang === "en" ? c.en : c.tr).map((x, i) => <li key={i}>{x}</li>)}</ul>
            </div>
          ))}
        </div>
        <div className="wxmfoot" style={{ justifyContent: "space-between" }}>
          <span style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <a className="hint" href={`${REPO_URL}/commits/main`}
              target="_blank" rel="noreferrer"
              style={{ color: "var(--muted)" }}>{t("GitHub'da tüm değişiklikler ↗")}</a>
            <button className="hint" style={{ background: "none", border: 0,
              color: "var(--teal)", cursor: "pointer", padding: 0,
              textDecoration: "underline" }}
              onClick={() => { setVerOpen(false); setTour(curRace ? "main" : "lobby"); }}>
              🎓 {t("Rehberi başlat")}</button>
          </span>
          <button className="histbtn" onClick={() => setVerOpen(false)}>{t("Kapat")}</button>
        </div>
      </div>
    </div>
  );

  const [wxHist, setWxHist] = useState(false); // hava geçmişi penceresi
  const [wxPlanW, setWxPlanW] = useState("wet"); // planlı geçiş: hava
  const [wxPlanT, setWxPlanT] = useState("");    // planlı geçiş: yarış saati
  const [zoom, setZoom] = useState(null); // "car" | "track" | null — kart büyütme (lightbox)
  /* LMU referans verisi (Ohne Speed tablosundan gömülü JSON) */
  const [lmuData, setLmuData] = useState(null);
  useEffect(() => {
    fetch(`${ASSET}lmu-data.json`).then((r) => (r.ok ? r.json() : null))
      .then((j) => setLmuData(j)).catch(() => {});
  }, []);
  const lmuSuggest = (() => {
    const d = lmuData?.data?.[st.track];
    if (!d) return null;
    return d[`${st.carClass}:${st.car}`] || d[st.carClass] || null;
  })();
  /* pist/araç değişince LMU temposunu varsayılan olarak yaz (ilk yüklemede
     kayıtlı değeri ezmez; kullanıcı sonradan elle değiştirebilir) */
  const lmuPrevSel = useRef(null);
  useEffect(() => {
    const sel = `${st.track}|${st.carClass}|${st.car}`;
    if (lmuPrevSel.current === null) { lmuPrevSel.current = sel; return; }
    if (lmuPrevSel.current === sel) return;
    lmuPrevSel.current = sel;
    if (lmuSuggest?.avgLap) up({ avgLap: lmuSuggest.avgLap,
      ...(lmuSuggest.consumption != null ? { consumption: lmuSuggest.consumption } : {}) });
  }, [st.track, st.carClass, st.car, lmuData]);
  /* multiclass: lider turu = seçili lider sınıfın COMPETITIVE (1.01) temposu */
  useEffect(() => {
    if (!st.multiclass) return;
    const e = lmuData?.data?.[st.track]?.[st.leaderClass];
    const v = e?.tiers?.c101 || e?.avgLap;
    if (v && v !== st.leaderLap) up({ leaderLap: v });
  }, [st.multiclass, st.leaderClass, st.track, lmuData]);
  useEffect(() => {
    if (!zoom) return;
    const onKey = (e) => { if (e.key === "Escape") setZoom(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoom]);

  const upcomingPit = liveInfo.status === "live" ? (st.pits[liveInfo.stintIdx] || EMPTY_PIT) : null;
  const upcomingIsLast = liveInfo.status === "live"
    && liveInfo.stintIdx >= racePlan.rows.length - 2;

  const timeline = plan.rows.flatMap((r) => {
    const segs = [{
      w: (r.stintSec / plan.raceSec) * 100, cls: "", label: `S${r.idx}`,
      bg: r.idx % 2 ? "var(--car)" : "#5E0B18",
    }];
    if (r.pitSec > 0) segs.push({ w: (r.pitSec / plan.raceSec) * 100, cls: "pit", label: "" });
    return segs;
  });

  /* yarış ekleme / düzenleme penceresi */
  const raceForm = rForm && (
    <div className="wxmodal" onClick={() => setRForm(null)}>
      <div className="wxmbox" style={{ width: "min(560px,95vw)" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="wxmhead">
          <span>🏁 {rForm.rid ? t("Yarışı Düzenle") : t("Yarış Ekle")}</span>
          <button className="lbclose" onClick={() => setRForm(null)}>✕</button>
        </div>
        <div style={{ padding: "12px 16px", maxHeight: "62vh", overflow: "auto" }}>
          <div className="row2">
            <div><label>{t("Sezon")}</label>
              <select value={rForm.seasonId || ""}
                onChange={(e) => setRForm({ ...rForm, seasonId: e.target.value || null })}>
                <option value="">{t("Takvim dışı (tekli yarış)")}</option>
                {Object.entries(seasons).map(([sid, se]) => (
                  <option key={sid} value={sid}>{se.name}</option>
                ))}
              </select></div>
            <div><label>{t("Round")}</label>
              <input type="number" value={rForm.round || ""}
                onChange={(e) => setRForm({ ...rForm, round: e.target.value })} /></div>
          </div>
          <label>{t("Yarış adı")}</label>
          <input type="text" value={rForm.name || ""} style={{ textTransform: "none" }}
            placeholder={t("örn. 6 Hours of Spa")}
            onChange={(e) => setRForm({ ...rForm, name: e.target.value })} />
          <div className="row2">
            <div><label>{t("Pist")}</label>
              <select value={rForm.trackId || ""}
                onChange={(e) => setRForm({ ...rForm, trackId: e.target.value })}>
                <option value="">—</option>
                {TRACKS.map((tr) => (
                  <option key={tr.id} value={tr.id}>{tr.name}</option>
                ))}
              </select></div>
            <div><label>{t("Yarış Süresi")}</label>
              <input type="text" value={rForm.raceTime || ""} placeholder="6:00:00"
                onChange={(e) => setRForm({ ...rForm, raceTime: e.target.value })} /></div>
          </div>
          <div className="row2">
            <div><label>{t("Sınıf")}</label>
              <select value={rForm.carClass || ""}
                onChange={(e) => setRForm({ ...rForm, carClass: e.target.value, carId: "" })}>
                {CAR_CLASSES.map(([id, nm]) => (
                  <option key={id} value={id}>{nm}</option>
                ))}
              </select></div>
            <div><label>{t("Araç")}</label>
              <select value={rForm.carId || ""}
                onChange={(e) => setRForm({ ...rForm, carId: e.target.value })}>
                <option value="">—</option>
                {(CARS[rForm.carClass] || []).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select></div>
          </div>
          <label>{t("Başlangıç (yerel saat)")}</label>
          <input type="datetime-local" value={msToLocalInput(rForm.startsAt || Date.now())}
            onChange={(e) => {
              const v = new Date(e.target.value).getTime();
              if (!isNaN(v)) setRForm({ ...rForm, startsAt: v });
            }} />
        </div>
        <div className="wxmfoot" style={{ gap: 8 }}>
          <button className="histbtn" onClick={() => setRForm(null)}>{t("Vazgeç")}</button>
          <button className="gbtn ubtn" onClick={async () => {
            const payload = {
              seasonId: rForm.seasonId || null,
              round: rForm.round ? Number(rForm.round) : null,
              name: rForm.name || "", trackId: rForm.trackId || "",
              carClass: rForm.carClass || "", carId: rForm.carId || "",
              raceTime: rForm.raceTime || "", startsAt: rForm.startsAt || 0,
            };
            if (rForm.rid) {
              await updateRace(curTeam, rForm.rid, payload).catch(() => {});
            } else {
              /* yarış verisi önceden hazırlanır: pist/araç/süre/başlangıç dolu gelir */
              const init = migrate({
                ...DEFAULT_STATE,
                track: payload.trackId, carClass: payload.carClass, car: payload.carId,
                raceTime: payload.raceTime || DEFAULT_STATE.raceTime,
                raceStartMs: payload.startsAt || Date.now(),
                pitLaneTime: PIT_LANE_TIMES[payload.trackId] ?? DEFAULT_STATE.pitLaneTime,
              });
              await createRace(curTeam, payload, init, user?.uid).catch(() => {});
            }
            setRForm(null);
          }}>{t("Kaydet")}</button>
        </div>
      </div>
    </div>
  );

  /* takım penceresi — hem lobide hem ana arayüzde kullanılır */
  const teamModal = teamOpen && user && (
        <div className="wxmodal" onClick={() => setTeamOpen(false)}>
          <div className="wxmbox" style={{ width: "min(680px,95vw)" }}
            onClick={(e) => e.stopPropagation()}>
            <div className="wxmhead">
              <span>🏢 {t("Takımlar")}</span>
              <button className="lbclose" onClick={() => setTeamOpen(false)}>✕</button>
            </div>

            {/* takım seçici */}
            {Object.keys(myTeams).length > 0 && (
              <div className="tmtabs">
                {Object.entries(myTeams).map(([tid, nm]) => (
                  <button key={tid} className={curTeam === tid ? "on" : ""}
                    onClick={() => setCurTeam(tid)}>{nm}</button>
                ))}
              </div>
            )}

            <div className="wxmlist" style={{ padding: "10px 14px" }}>
              {!curTeam && (
                <div className="hint" style={{ marginBottom: 12 }}>
                  {t("Henüz bir takımın yok. Yeni takım kur ya da katılım kodu ile katıl.")}
                </div>
              )}

              {curTeam && teamData && (<>
                {/* takım adı */}
                <div className="tmsec">{t("Takım Adı")}</div>
                {tnEdit === null ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8,
                    marginBottom: 10 }}>
                    <b style={{ fontSize: 15 }}>{teamData?.meta?.name || "—"}</b>
                    {canManageTeam && (
                      <button className="minibtn" style={{ width: "auto", padding: "0 8px" }}
                        onClick={() => setTnEdit(teamData?.meta?.name || "")}>
                        {t("Düzenle")}</button>
                    )}
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 8, marginBottom: 10, maxWidth: 420 }}>
                    <input type="text" value={tnEdit} maxLength={40} autoFocus
                      style={{ textTransform: "none", margin: 0 }}
                      onChange={(e) => setTnEdit(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Escape") setTnEdit(null); }} />
                    <button className="gbtn ubtn" disabled={!tnEdit.trim()}
                      style={{ opacity: tnEdit.trim() ? 1 : .45 }}
                      onClick={async () => {
                        const nm = tnEdit.trim();
                        setTnEdit(null);
                        try {
                          await renameTeam(curTeam, nm);
                          await syncMyTeamName(user.uid, curTeam, nm);
                        } catch (e) { console.warn("ad değiştirilemedi:", e?.message); }
                      }}>{t("Kaydet")}</button>
                    <button className="histbtn"
                      onClick={() => setTnEdit(null)}>{t("Vazgeç")}</button>
                  </div>
                )}
                {tnEdit !== null && (
                  <div className="hint" style={{ marginTop: -6, marginBottom: 10 }}>
                    {t("Yeni ad diğer üyelerde uygulamayı açtıklarında güncellenir.")}</div>
                )}

                {/* sezonlar */}
                <div className="tmsec">{t("Sezonlar")}</div>
                <div className="tmtabs" style={{ padding: "0 0 8px" }}>
                  <button className={curSeason === "" ? "on" : ""}
                    onClick={() => setCurSeason("")}>{t("Tümü")}</button>
                  {Object.entries(seasons).map(([sid, se]) => (
                    <button key={sid} className={curSeason === sid ? "on" : ""}
                      onClick={() => setCurSeason(sid)}>{se.name}</button>
                  ))}
                  {canEditTeam && (
                    <button onClick={async () => {
                      const nm = window.prompt(t("Sezon adı"), `${new Date().getFullYear()} WEC`);
                      if (nm) await createSeason(curTeam, nm, new Date().getFullYear())
                        .catch(() => {});
                    }}>+ {t("Sezon")}</button>
                  )}
                </div>

                {/* yarış takvimi */}
                <div className="tmsec">{t("Yarış Takvimi")}</div>
                {Object.entries(races)
                  .filter(([, r]) => !curSeason || r.seasonId === curSeason)
                  .sort(([, a], [, b]) => (a.startsAt || 0) - (b.startsAt || 0))
                  .map(([rid, r]) => (
                    <div key={rid} className="tmroom">
                      {r.round ? <span className="rcode mono">R{r.round}</span> : null}
                      <span className="rlabel">
                        <b>{r.name || trackName(r.trackId) || "—"}</b>
                        <span className="rmeta">
                          {r.trackId ? trackName(r.trackId) : ""}
                          {r.raceTime ? ` · ${r.raceTime}` : ""}
                          {r.startsAt ? ` · ${new Date(r.startsAt)
                            .toLocaleString(lang === "en" ? "en-GB" : "tr-TR",
                              { day: "2-digit", month: "2-digit", hour: "2-digit",
                                minute: "2-digit" })}` : ""}
                        </span>
                      </span>
                      <button className="gbtn ubtn" onClick={() => openRace(rid)}>
                        {t("Aç")}</button>
                      {canEditTeam && (<>
                        <button className="minibtn" title={t("Düzenle")}
                          onClick={() => setRForm({ rid, ...r })}>✎</button>
                        <button className="minibtn" title={t("Sil")}
                          onClick={() => { if (window.confirm(t("Yarış silinsin mi?")))
                            deleteRace(curTeam, rid).catch(() => {}); }}>✕</button>
                      </>)}
                    </div>
                  ))}
                {Object.keys(races).length === 0 && (
                  <div className="hint">{t("Takvimde yarış yok.")}</div>
                )}
                {canEditTeam && (
                  <button className="gbtn ubtn" style={{ width: "100%", marginTop: 8 }}
                    onClick={() => setRForm({
                      rid: null, seasonId: curSeason || null, round: "", name: "",
                      trackId: st.track || "", carClass: st.carClass || "hypercar",
                      carId: st.car || "", raceTime: st.raceTime || "6:00:00",
                      startsAt: Date.now(),
                    })}>
                    ➕ {t("Yarış Ekle")}
                  </button>
                )}

                {/* üyeler */}
                <div className="tmsec" style={{ marginTop: 16 }}>{t("Takım Üyeleri")}</div>
                {canManageTeam && (
                  <div className="hint" style={{ marginBottom: 6, lineHeight: 1.6 }}>
                    {t("Rozet yetkiyi belirler:")}<br />
                    🎧 {t("Yarış Mühendisi")} — {t("yarış datasını değiştirebilir, üyelere dokunamaz")}<br />
                    <span style={{ verticalAlign: -2 }}><Wheel size={12} /></span> {t("Sürücü")}
                    {" "}— {t("her şeyi görür, hiçbir şeyi değiştiremez")}<br />
                    👑 {t("Takım Sahibi")} — {t("rozetleri ve yetkileri yönetir")}
                  </div>
                )}
                {Object.entries(teamData.members || {}).map(([uid, role]) => {
                  const mbs = teamBadgesOf(teamData, uid, null);
                  return (
                    <div key={uid} className="tmmem">
                      <span className="mbadges">
                        {mbs.length ? mbs.map((b) => (
                          <span key={b.lbl} className="ubadge" title={t(b.lbl)}
                            style={{ color: b.col, background: b.bg, borderColor: b.col }}>
                            {b.ico}</span>
                        )) : <span className="ubadge" style={{ opacity: .25 }}>·</span>}
                      </span>
                      <span className="mrole" title={t("Yetki")}>{t(roleLabel(role))}</span>
                      <span className="muid">
                        {teamData?.names?.[uid]
                          ? <>{teamData.names[uid]}
                            {uid === user.uid && <> {t("(sen)")}</>}</>
                          : <span className="mono">
                            {uid === user.uid ? t("(sen)") : uid.slice(0, 10) + "…"}</span>}
                      </span>
                      {canManageTeam && (
                        <span style={{ marginLeft: "auto", display: "flex", gap: 5,
                          alignItems: "center" }}>
                          {["driver", "engineer"].map((id) => {
                            const on = hasBadge(teamData, uid, id);
                            const b = BADGES[id];
                            return (
                              <button key={id} className={`btgl ${on ? "on" : ""}`}
                                title={`${t(b.lbl)} — ${t(id === "engineer"
                                  ? "datayı değiştirebilir" : "sadece görür")}`}
                                style={on ? { color: b.col, borderColor: b.col,
                                  background: b.bg } : undefined}
                                onClick={() => setBadge(uid, id, !on)}>
                                {b.ico}
                              </button>
                            );
                          })}
                        </span>
                      )}
                    </div>
                  );
                })}
                <div className="hint" style={{ marginTop: 8 }}>
                  {t("Katılım kodu")}: <b className="mono">{teamData?.meta?.joinCode || "—"}</b>
                  {" · "}{t("PIN'leri yalnız düzenleyiciler görür.")}
                </div>
                {myRole !== "owner" && (
                  <div style={{ marginTop: 10 }}>
                    <button className="histbtn" onClick={() => {
                      leaveTeam(curTeam, user.uid).catch(() => {}); setCurTeam("");
                    }}>{t("Takımdan ayrıl")}</button>
                  </div>
                )}
              </>)}
            </div>

            {/* kur / katıl */}
            <div className="tmfoot">
              <input placeholder={t("Yeni takım adı")} value={tForm.name}
                onChange={(e) => setTForm({ ...tForm, name: e.target.value })}
                style={{ textTransform: "none" }} />
              <button className="histbtn" disabled={!tForm.name.trim()}
                onClick={async () => {
                  setTErr("");
                  try {
                    const tid = await createTeam(user, tForm.name.trim(), userName);
                    setCurTeam(tid); setTForm({ ...tForm, name: "" });
                  } catch (e) { setTErr(t("Takım kurulamadı")); }
                }}>{t("Takım Kur")}</button>
              <input placeholder={t("KATILIM KODU")} maxLength={6} value={tForm.join}
                onChange={(e) => setTForm({ ...tForm, join: e.target.value.toUpperCase() })}
                style={{ width: 130 }} />
              <button className="histbtn" disabled={tForm.join.trim().length < 4}
                onClick={async () => {
                  setTErr("");
                  try {
                    const tid = await joinTeam(user, tForm.join, userName);
                    setCurTeam(tid); setTForm({ ...tForm, join: "" });
                  } catch (e) {
                    setTErr(e.message === "NOT_FOUND" ? t("Takım bulunamadı") : t("Katılınamadı"));
                  }
                }}>{t("Katıl")}</button>
            </div>
            {tErr && <div className="hint" style={{ color: "var(--red)", padding: "0 14px 10px" }}>
              {tErr}</div>}
          </div>
        </div>
      );

  /* ---------- ortak data kartları (setup + ana arayüz sol kolon) ---------- */
  const dataCards = (<>
    <div className="card" data-tour="data">
      <h2>{t("Yarış · Data")}</h2>
      <div className="row2">
        <div><label>Race Time (h:mm:ss)</label>
          <input type="text" value={st.raceTime} onChange={(e) => up({ raceTime: e.target.value })} /></div>
        <div><label>Avg Lap (m:ss.00)</label>
          <input type="text" value={st.avgLap} onChange={(e) => up({ avgLap: e.target.value })} /></div>
      </div>
      <div className="row4">
        {["A", "B", "C", "D"].map((k) => (
          <Num key={k} v={st.strategies[k]} step={1}
            onC={(v) => up({ strategies: { ...st.strategies, [k]: v } })} />
        ))}
      </div>
      <label>{t("Seçili Strateji")}</label>
      <div className="strat">
        {["A", "B", "C", "D"].map((k) => (
          <button key={k} className={st.chosen === k ? "on" : ""}
            onClick={() => up({ chosen: k })}>{k} · {st.strategies[k]}</button>
        ))}
      </div>
      <div className="row2">
        <div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <input type="checkbox" checked={st.multiclass} style={{ width: "auto", margin: 0 }}
              onChange={(e) => up({ multiclass: e.target.checked })} />
            {t("Multiclass Yarış")}
          </label>
          <select value={st.leaderClass} disabled={!st.multiclass}
            style={!st.multiclass ? { opacity: .45 } : undefined}
            onChange={(e) => up({ leaderClass: e.target.value })}>
            {CAR_CLASSES.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        </div>
        <div><label>Extra Lap</label>
          <Num v={st.extraLap} step={1} onC={(v) => up({ extraLap: v })} /></div>
      </div>
      {st.multiclass && (
        <div className="row2">
          <div><label>🏁 {t("Lider Tur (m:ss.00)")}</label>
            <input type="text" value={st.leaderLap} placeholder={st.avgLap}
              onChange={(e) => up({ leaderLap: e.target.value })} /></div>
          <div />
        </div>
      )}
      {st.multiclass && racePlan.flagExtra > 0.5 && (
        <div className="hint">🏁 {t("Lider bayrağı")}: +{racePlan.flagExtra.toFixed(0)}s → {t("son tur otomatik eklenir")}</div>
      )}
    </div>

    <div className="card" data-tour="rstart" style={{ marginTop: 12 }}>
      <h2>{t("Yarış Başlangıcı")}</h2>
      <label>{t("Start Tarih & Saat")}</label>
      <input type="datetime-local" value={msToLocalInput(st.raceStartMs)}
        onChange={(e) => { const t = new Date(e.target.value).getTime();
          if (!isNaN(t)) up({ raceStartMs: t }); }} />
      <div style={{ marginTop: 10, background: "var(--panel2)",
        border: "1px solid var(--line)", borderRadius: 8, padding: "8px 12px",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span className="hint" style={{ margin: 0 }}>🏁 {t("Hesaplanan Bitiş")}</span>
        <b className="mono" style={{ fontSize: 15, color: "var(--green)" }}>
          {driverPlan ? fmtClock(driverPlan.finishMs, driverPlan.startMs) : "—"}</b>
      </div>
      <div className="hint">{t("Canlı yarış modu, pilot planı ve geri sayım bu zamana göre çalışır.")} 🌍 {t("Saat her üyeye kendi yerel diliminde gösterilir.")}</div>
    </div>

    <div className="card" data-tour="wx" style={{ marginTop: 12 }}>
      <h2>🌦 {t("Hava Durumu")}</h2>
      <div className="hint" style={{ marginTop: 0, marginBottom: 6 }}>
        {t("Şu anki zemin — canlı değişim buradan")}</div>
      <div className="wxsel">
        {Object.entries(WEATHER).map(([id, w]) => (
          <button key={id} className={st.weather === id ? "on" : ""}
            style={st.weather === id ? { borderColor: w.col, color: w.col } : undefined}
            onClick={() => {
              const el = liveInfo.status === "live"
                ? Math.max(0, Math.round(liveInfo.elapsed / 1000)) : 0;
              let past = (st.weatherLog || []).filter((e) => e.t < el - 0.5);
              const future = (st.weatherLog || []).filter((e) => e.t > el + 0.5);
              if (el < 1) past = [];
              const log = [...past, { t: el, w: id, src: "live" }, ...future]
                .sort((a, b) => a.t - b.t);
              const cur = wxAtRel(log, el);
              up({ weather: Object.keys(WEATHER).find((k) => WEATHER[k] === cur) || id,
                weatherLog: log });
            }}>
            {w.ico} {t(w.lbl)}<br /><small>×{w.lap.toFixed(2)}</small>
          </button>
        ))}
      </div>
      {WX(st).lap > 1 && (
        <div className="hint">
          {t("Efektif tur")} ({t("şu an")}): <b className="mono">{st.avgLap}</b> ×{WX(st).lap.toFixed(2)} ={" "}
          <b className="mono" style={{ color: WX(st).col }}>{fmtLap(effLapSec(st))}</b>
          {WX(st).fuel < 1 && <> · ⚡ {t("yakıt")} −{((1 - WX(st).fuel) * 100).toFixed(0)}%</>}
        </div>
      )}
      <div className="hint" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
        <button className="histbtn" onClick={() => setWxHist(true)}>
          🕒 {t("Geçmiş / Planlı geçişler")}
          {(st.weatherLog || []).length > 0 ? ` (${st.weatherLog.length})` : ""}</button>
      </div>
    </div>

    <div className="card" data-tour="pittimes" style={{ marginTop: 12 }}>
      <h2>{t("Pit · Süreler (s)")}</h2>
      <div className="row2">
        <div><label>Pit Line</label><Num v={st.pitLaneTime} onC={(v) => up({ pitLaneTime: v })} />
          {st.track && PIT_LANE_TIMES[st.track] != null && (
            <div className="hint">{t("Pist verisi")}: {PIT_LANE_TIMES[st.track]}s · {trackName(st.track)}</div>
          )}</div>
        <div><label style={{ display: "flex", alignItems: "center", gap: 5 }}>
          ⛽ Fuel &amp; <Bolt size={13} /> VE</label>
          <Num v={st.fuelTime} onC={(v) => up({ fuelTime: v })} /></div>
      </div>
      <div className="row2">
        <div><label style={{ display: "flex", alignItems: "center", gap: 5 }}><Tyre size={15} /> {t("Lastik Limiti (adet)")}</label>
          <Num v={st.tyreLimit} step={1} onC={(v) => up({ tyreLimit: v })} /></div>
        <div />
      </div>
    </div>

    <div className="card" data-tour="ve" style={{ marginTop: 12 }}>
      <h2>⚡ Virtual Energy · Data</h2>
      <div className="row2">
        <div><label>⚡ {t("VE Tüketim (%/tur)")}</label><Num v={st.consumption} onC={(v) => up({ consumption: v })} /></div>
        <div><label>Fuel Ratio (L / %1)</label><Num v={st.fuelRatio} onC={(v) => up({ fuelRatio: v })} /></div>
      </div>
      <div className="row2">
        <div><label>⛽ {t("%100 = Taşınan Yakıt")}</label>
          <div className="mono" style={{ padding: "6px 0", color: "var(--green)" }}>
            {fuelCarried.toFixed(1)} L</div></div>
      </div>
      <div className="hint">
        {t("Depo daima")} <b>%100 VE</b> {t("kabul edilir. Gerçek yakıt = VE × ratio → gerçek tüketim ≈")}{" "}
        <b className="mono">{realPerLap.toFixed(2)} {t("L/tur")}</b>.{" "}
        {t("Ratio'yu düşürmek daha az yakıt taşımak demektir (örn. 0.84 → %100 = 84.0 L).")}
      </div>
    </div>

    <div className="card" data-tour="stream" style={{ marginTop: 12 }}>
      <h2>📺 {t("Canlı Yayın")}</h2>
      <label>{t("YouTube linki")}</label>
      <input type="text" value={st.streamUrl} placeholder="https://youtube.com/watch?v=..."
        onChange={(e) => up({ streamUrl: e.target.value })} />
      <div className="hint">
        {ytId(st.streamUrl)
          ? <>✅ {t("Yayın köşedeki mini oynatıcıda gösteriliyor.")}</>
          : t("Geçerli bir YouTube linki yapıştırın; köşede mini oynatıcı açılır.")}
      </div>
    </div>
  </>);

  /* ---------- giriş kapısı: oturum yoksa uygulama açılmaz ---------- */
  if (authReady && (authLoading || !user)) {
    return (
      <div className="rc">
        <style>{css}</style>
        {teamModal}{raceForm}
        <div className="lobby">
          <div className="box" style={{ textAlign: "center" }}>
            <img className="logo" src={`${ASSET}logo.png`} alt="Caspian Motorsport" />
            <h1><b>RACE</b> MONITOR</h1>
            <div className="sub">{APP_VERSION}</div>
            {authLoading ? (
              <div className="hint" style={{ marginTop: 22 }}>{t("Yükleniyor…")}</div>
            ) : (<>
              <div className="hint" style={{ margin: "18px 0 14px" }}>
                {t("Devam etmek için giriş yapın veya kayıt olun.")}</div>
              <button className="gbtn" onClick={() => doSignIn("in")}>
                <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.7-2 5-4.4 6.6v5.5h7.1c4.2-3.8 6.6-9.5 6.6-16.1z"/>
                  <path fill="#34A853" d="M24 46c6 0 11-2 14.6-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.5 2.1-5.8 0-10.7-3.9-12.4-9.1H4.3v5.7C7.9 41 15.4 46 24 46z"/>
                  <path fill="#FBBC05" d="M11.6 28.1c-.4-1.3-.7-2.7-.7-4.1s.3-2.8.7-4.1v-5.7H4.3C2.8 17.1 2 20.4 2 24s.8 6.9 2.3 9.8l7.3-5.7z"/>
                  <path fill="#EA4335" d="M24 10.8c3.3 0 6.2 1.1 8.5 3.3l6.3-6.3C35 4.2 30 2 24 2 15.4 2 7.9 7 4.3 14.2l7.3 5.7c1.7-5.2 6.6-9.1 12.4-9.1z"/>
                </svg>
                {t("Google ile giriş yap")}
              </button>
              <div style={{ marginTop: 10 }}>
                <button className="histbtn" onClick={() => doSignIn("up")}>
                  {t("Google ile kayıt ol")}</button>
              </div>
              {authErr && <div className="hint" style={{ color: "var(--red)", marginTop: 10 }}>
                {authErr}</div>}
              <div className="hint" style={{ marginTop: 18, fontSize: 11 }}>
                {t("Caspian Motorsport · pit wall aracı")}</div>
            </>)}
          </div>
        </div>
      </div>
    );
  }

  /* ---------- erişim kapısı: giriş var ama izin yok ---------- */
  if (authReady && user && !access) {
    return (
      <div className="rc">
        <style>{css}</style>
        {teamModal}{raceForm}
        <div className="lobby">
          <div className="box" style={{ textAlign: "center" }}>
            <img className="logo" src={`${ASSET}logo.png`} alt="Caspian Motorsport" />
            <h1><b>RACE</b> MONITOR</h1>
            {udoc === null ? (
              <div className="hint" style={{ marginTop: 22 }}>{t("Yükleniyor…")}</div>
            ) : !udoc.requested ? (<>
              {/* henüz kayıt talebi göndermemiş */}
              <div style={{ fontSize: 34, margin: "14px 0 6px" }}>📝</div>
              <div className="disp" style={{ fontSize: 18, marginBottom: 8 }}>
                {t("Kayıt talebi gönder")}</div>
              <div className="hint" style={{ marginBottom: 12 }}>
                {t("Talebiniz yöneticiye iletilecek. Onaylandığında e-posta ile bilgilendirileceksiniz.")}
              </div>
              <div className="userchip" style={{ margin: "0 auto 12px", display: "inline-flex" }}>
                {user.photoURL && <img src={user.photoURL} alt="" referrerPolicy="no-referrer" />}
                <span className="uname" style={{ maxWidth: 230 }}>{user.email}</span>
              </div>
              <input type="text" placeholder={t("Ad Soyad")}
                value={regName} onChange={(e) => setRegName(e.target.value)}
                style={{ marginBottom: 8, textTransform: "none" }} />
              <input type="text" placeholder={t("Takım / not (opsiyonel)")}
                value={regNote} onChange={(e) => setRegNote(e.target.value)}
                style={{ marginBottom: 12, textTransform: "none" }} />
              <button className="gbtn" style={{ background: "var(--car)", color: "#fff",
                  opacity: regName.trim() ? 1 : .45 }}
                disabled={!regName.trim()}
                onClick={() => requestAccess(user, regNote, regName.trim()).catch(() => {})}>
                {t("Talebi Gönder")}</button>
              <div style={{ marginTop: 12 }}>
                <button className="histbtn" onClick={signOut}>{t("Çıkış yap")}</button>
              </div>
            </>) : (<>
              <div style={{ fontSize: 34, margin: "14px 0 6px" }}>🔒</div>
              <div className="disp" style={{ fontSize: 18, marginBottom: 8 }}>
                {t("Erişim izni bekleniyor")}</div>
              <div className="hint" style={{ marginBottom: 16 }}>
                {t("Talebiniz alındı. Onaylandığında e-posta ile bilgilendirileceksiniz.")}
              </div>
              <div className="userchip" style={{ margin: "0 auto 10px", display: "inline-flex" }}>
                {user.photoURL && <img src={user.photoURL} alt="" referrerPolicy="no-referrer" />}
                <span className="uname" style={{ maxWidth: 230 }}>{user.email}</span>
              </div>
              <div className="hint mono" style={{ fontSize: 10, wordBreak: "break-all",
                marginBottom: 14 }}>
                UID: {user.uid}
              </div>
              <div>
                <button className="histbtn" onClick={signOut}>{t("Çıkış yap")}</button>
              </div>
            </>)}
          </div>
        </div>
      </div>
    );
  }

  /* ---------- lobi: takım takvimi ---------- */
  if (!curRace && !entered) {
    const now = Date.now();
    const list = Object.entries(races)
      .sort(([, a], [, b]) => (a.startsAt || 0) - (b.startsAt || 0));
    const allUp = list.filter(([, r]) => (r.startsAt || 0) >= now - 6 * 3600e3);
    const allPast = list.filter(([, r]) => (r.startsAt || 0) < now - 6 * 3600e3).reverse();
    /* Şampiyonalar karışmasın: sezona göre grupla, istenirse süz. */
    const sidOf = ([, r]) => r.seasonId || "";
    const sName = (sid) => (sid ? (seasons[sid]?.name || t("Sezon")) : t("Takvim dışı"));
    const seasonIds = Array.from(new Set(list.map(sidOf)));      // takvim sırasına göre
    const inFilter = (e) => lobSeason === "all" || sidOf(e) === lobSeason;
    const upcoming = allUp.filter(inFilter);
    const past = allPast.filter(inFilter);
    const nextRid = allUp.length ? allUp[0][0] : null;
    const upGroups = Array.from(new Set(upcoming.map(sidOf)))
      .map((sid) => ({ sid, name: sName(sid),
        items: upcoming.filter((e) => sidOf(e) === sid) }));
    const RaceRow = ([rid, r], isNext) => (
      <button key={rid} className={`lrace ${isNext ? "next" : ""}`}
        onClick={() => openRace(rid)}>
        {r.trackId && (
          <img className="lrtrack" src={`${ASSET}tracks/${TRACK_ASSET(r.trackId)}.png${AV}`}
            alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} />
        )}
        <span className="lrinfo">
          <b>{r.round ? `R${r.round} · ` : ""}{r.name || trackName(r.trackId) || "—"}</b>
          <span className="lrmeta">
            {r.trackId ? trackName(r.trackId) : ""}
            {r.raceTime ? ` · ${r.raceTime}` : ""}
            {r.carId ? ` · ${carName(r.carClass, r.carId)}` : ""}
          </span>
          {r.startsAt ? (
            <span className="lrdate">{new Date(r.startsAt)
              .toLocaleString(lang === "en" ? "en-GB" : "tr-TR",
                { weekday: "short", day: "2-digit", month: "short",
                  hour: "2-digit", minute: "2-digit" })}</span>
          ) : null}
        </span>
        <span className="rgo">→</span>
      </button>
    );

    return (
      <div className="rc">
        <style>{css}</style>
        {teamModal}{raceForm}{versionModal}{chatModal}{tourOverlay}
        <div className="lobby">
          <div className="box" style={{ maxWidth: 560 }}>
            <div className="langsw" style={{ display: "flex", justifyContent: "flex-end",
              alignItems: "center", gap: 6, marginBottom: 6 }}>
              <button className="tourbtn" onClick={() => setTour("lobby")}
                title={t("Rehberi başlat")}>🎓 {t("Rehber")}</button>
              {["tr", "en"].map((l) => (
                <button key={l} className={lang === l ? "on" : ""}
                  onClick={() => switchLang(l)}>{l.toUpperCase()}</button>
              ))}
              {infoBtn}
            </div>
            <img className="logo" src={`${ASSET}logo.png`} alt="Caspian Motorsport" />
            <h1><b>RACE</b> MONITOR</h1>
            <div className="sub">{APP_VERSION}</div>

            {firebaseReady ? (<>
              <div className="hint" style={{ marginBottom: 10 }}>
                👤 {userName || t("isimsiz")}</div>

              {Object.keys(myTeams).length === 0 ? (
                <button className="bigbtn ghost" onClick={() => setTeamOpen(true)}>
                  🏢 {t("Takım Kur / Katıl")}
                </button>
              ) : (<>
                {Object.keys(myTeams).length > 1 && (
                  <div className="tmtabs" style={{ padding: "0 0 10px" }}>
                    {Object.entries(myTeams).map(([tid, nm]) => (
                      <button key={tid} className={curTeam === tid ? "on" : ""}
                        onClick={() => setCurTeam(tid)}>{nm}</button>
                    ))}
                  </div>
                )}

                <div className="lobbyteams" data-tour="races">
                  {/* hangi takımın takvimine baktığın belli olsun */}
                  <div className="lteam">🏢 {teamData?.meta?.name
                    || myTeams[curTeam] || t("Takım")}</div>
                  <div className="tmsec">🏁 {t("Yaklaşan Yarışlar")}</div>
                  {seasonIds.length > 1 && (
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
                      {[["all", t("Tümü")], ...seasonIds.map((sid) => [sid, sName(sid)])]
                        .map(([v, l]) => (
                          <button key={v} className="act" style={{ fontSize: 11,
                            ...(lobSeason === v
                              ? { borderColor: "var(--red)", color: "var(--red)" } : {}) }}
                            onClick={() => setLobSeason(v)}>{l}</button>
                        ))}
                    </div>
                  )}
                  {upcoming.length === 0
                    ? <div className="hint">{t("Takvimde yaklaşan yarış yok.")}</div>
                    : upGroups.map((g) => (
                      <div key={g.sid || "none"}>
                        {seasonIds.length > 1 && (
                          <div className="lseason">{g.name}</div>
                        )}
                        {g.items.map((e) => RaceRow(e, e[0] === nextRid))}
                      </div>
                    ))}

                  {past.length > 0 && (<>
                    <div className="tmsec" style={{ marginTop: 12 }}>
                      {t("Geçmiş")}</div>
                    {past.slice(0, 5).map((e) => (
                      <div key={e[0]}>
                        {seasonIds.length > 1 && lobSeason === "all" && (
                          <div className="lseason">{sName(sidOf(e))}</div>
                        )}
                        {RaceRow(e, false)}
                      </div>
                    ))}
                  </>)}

                  <button className="histbtn" data-tour="manage"
                    style={{ marginTop: 10, width: "100%" }}
                    onClick={() => setTeamOpen(true)}>
                    ⚙ {canEditTeam ? t("Takvimi & Takımı Yönet") : t("Takımı Görüntüle")}</button>
          <button className="histbtn" data-tour="chat" onClick={() => setChatOpen(true)}
            style={{ marginTop: 8, width: "100%" }}>
            💬 {t("Sohbet")}{chatUnread > 0 && <> · {chatUnread}</>}</button>
                </div>
              </>)}

              <div className="lmsg">{syncMsg}</div>
            </>) : (
              <div className="hint" style={{ textAlign: "center", marginBottom: 8 }}>
                {t("Takım senkronizasyonu kapalı — ")}<b>src/firebase-config.js</b>{t(" dosyasını doldur.")}
              </div>
            )}

            <button className="solo" onClick={() => setEntered(true)}>
              {t("Takımsız solo devam et →")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- setup 1: pist & araç seçimi ---------- */
  if (!pickDone) {
    const cls = st.carClass || "hypercar";
    return (
      <div className="rc">
        <style>{css}</style>
        <div className="lobby" style={{ alignItems: "flex-start", paddingTop: 40 }}>
          <div className="box" style={{ maxWidth: 720 }}>
            <img className="logo" style={{ maxWidth: 190 }} src={`${ASSET}logo.png`} alt="" />
            <h1><b>{t("PİST")}</b> {t("& ARAÇ")}</h1>
            <div className="sub">
              {curRace ? (<>{t("Yarış")}: <b className="roomcode">{races[curRace]?.name || curRace}</b></>)
                : t("Solo mod")}
            </div>

            <div className="picksec">
              <h3>{t("1 · Pist Seç")}</h3>
              <div className="trackgrid">
                {TRACKS.map((t) => (
                  <button key={t.id} className={st.track === t.id ? "on" : ""}
                    onClick={() => up({ track: t.id,
                      ...(PIT_LANE_TIMES[t.id] != null ? { pitLaneTime: PIT_LANE_TIMES[t.id] } : {}) })}>
                    <img src={`${ASSET}flags/${TRACK_ASSET(t.id)}.png`} alt="" />{t.name}
                  </button>
                ))}
              </div>
            </div>

            {st.track && (
              <img key={st.track} src={`${ASSET}tracks/${TRACK_ASSET(st.track)}.png${AV}`} alt=""
                style={{ display: "block", margin: "14px auto 0", maxWidth: "100%",
                  maxHeight: 220, filter: "drop-shadow(0 4px 12px rgba(0,0,0,.5))" }}
                onError={(e) => { e.currentTarget.style.display = "none"; }} />
            )}

            <div className="picksec">
              <h3>{t("2 · Sınıf Seç")}</h3>
              <div className="classtoggle">
                {CAR_CLASSES.map(([id, name]) => (
                  <button key={id} className={cls === id ? "on" : ""}
                    onClick={() => up({ carClass: id, car: "" })}>
                    <img src={`${ASSET}class/${id}.png`} alt=""
                      onError={(e) => { e.currentTarget.style.display = "none"; }} />{name}
                  </button>
                ))}
              </div>
            </div>

            <div className="picksec">
              <h3>{t("3 · Araç Seç")}</h3>
              <div className="cargrid">
                {CARS[cls].map((c) => (
                  <button key={c.id} className={st.car === c.id ? "on" : ""}
                    onClick={() => up({ carClass: cls, car: c.id })}>
                    <img src={carImg(cls, c.id)} alt="" loading="lazy"
                      onError={(e) => { e.currentTarget.style.display = "none"; }} />
                    {c.name}
                  </button>
                ))}
              </div>
            </div>

            <button className="bigbtn" style={{ marginTop: 20 }}
              disabled={!st.track || !st.car}
              onClick={() => setPickDone(true)}>
              {t("✓ Devam Et — Yarış Dataları")}
            </button>
            <div className="lmsg">
              {(!st.track || !st.car) && t("Devam etmek için pist ve araç seç")}
            </div>
            <button className="solo" onClick={() => setPickDone(true)}>
              {t("Seçim yapmadan geç →")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- setup 2: yarış datalarını gir ---------- */
  if (!setupDone) {
    return (
      <div className="rc">
        <style>{css}</style>
        <div className="lobby" style={{ alignItems: "flex-start", paddingTop: 40 }}>
          <div className="box" style={{ maxWidth: 560 }}>
            <img className="logo" style={{ maxWidth: 190 }} src={`${ASSET}logo.png`} alt="" />
            <h1><b>{t("YARIŞ")}</b> {t("DATALARI")}</h1>
            <div className="sub">
              {st.track && <><img className="flag" style={{ width: 16, verticalAlign: -2, marginRight: 4 }}
                src={`${ASSET}flags/${st.track}.png`} alt="" />
                {trackName(st.track)}{st.car && <> · {carName(st.carClass, st.car)}</>} — </>}
              {curRace ? (<>
                {t("Yarış")}: <b className="roomcode">{races[curRace]?.name || curRace}</b>
              </>) : t("Solo mod — datalar sadece bu cihazda")}
            </div>

            {dataCards}

            <button className="bigbtn" style={{ marginTop: 18 }}
              onClick={() => setSetupDone(true)}>
              {t("✓ Devam Et — Arayüze Geç")}
            </button>
            <div className="hint" style={{ textAlign: "center", marginTop: 8 }}>
              {t("Merak etme, tüm bu değerleri arayüzün sol kolonundan her an değiştirebilirsin.")}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rc">
      <style>{css}</style>
      {teamModal}{raceForm}{versionModal}{chatModal}{tourOverlay}{streamPlayer}
      {profOpen && user && (
        <div className="wxmodal" onClick={() => setProfOpen(false)}>
          <div className="wxmbox" style={{ width: "min(420px,94vw)" }}
            onClick={(e) => e.stopPropagation()}>
            <div className="wxmhead">
              <span>👤 {t("Profil")}</span>
              <button className="lbclose" onClick={() => setProfOpen(false)}>✕</button>
            </div>
            <div style={{ padding: "14px 16px" }}>
              <div className="userchip" style={{ marginBottom: 14 }}>
                {user.photoURL && <img src={user.photoURL} alt="" referrerPolicy="no-referrer" />}
                <span className="uname" style={{ maxWidth: 260 }}>{user.email}</span>
              </div>
              {myBadges.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                  {myBadges.map((b) => (
                    <span key={b.lbl} className="bchip" style={{ color: b.col,
                      background: b.bg, borderColor: b.col, marginBottom: 0 }}>
                      {b.ico} {t(b.lbl)}
                    </span>
                  ))}
                </div>
              )}
              <label>{t("Ad Soyad")}</label>
              <input type="text" value={profName} style={{ textTransform: "none" }}
                onChange={(e) => setProfName(e.target.value)} />
              <div className="hint" style={{ marginTop: 6 }}>
                {t("Odalarda ve stint programında bu isim görünür.")}</div>
            </div>
            <div className="wxmfoot" style={{ gap: 8 }}>
              <button className="histbtn" onClick={() => setProfOpen(false)}>{t("Vazgeç")}</button>
              <button className="gbtn ubtn" disabled={!profName.trim()}
                style={{ opacity: profName.trim() ? 1 : .45 }}
                onClick={async () => {
                  const n = profName.trim().slice(0, 60);
                  await updateProfile(user.uid, { fullName: n }).catch(() => {});
                  setUserName(n); setProfOpen(false);
                }}>{t("Kaydet")}</button>
            </div>
          </div>
        </div>
      )}
      {adminOpen && isAdmin && (
        <div className="wxmodal" onClick={() => setAdminOpen(false)}>
          <div className="wxmbox" style={{ width: "min(620px,95vw)" }}
            onClick={(e) => e.stopPropagation()}>
            <div className="wxmhead">
              <span>👥 {t("Üye Yönetimi")}</span>
              <button className="lbclose" onClick={() => setAdminOpen(false)}>✕</button>
            </div>
            <div className="wxmlist">
              {Object.entries(allUsers).length === 0 && (
                <div className="hint" style={{ padding: 12 }}>{t("Kayıt yok.")}</div>
              )}
              {Object.entries(allUsers)
                .sort(([, a], [, b]) => (b?.requestedAt || 0) - (a?.requestedAt || 0))
                .map(([uid, u]) => (
                  <div key={uid} className="urow">
                    {u?.photo
                      ? <img src={u.photo} alt="" referrerPolicy="no-referrer" />
                      : <span className="uav">?</span>}
                    <span className="uinfo">
                      <b>{u?.name || "—"}</b>
                      <span className="umail">{u?.email || uid}</span>
                      {u?.note && <span className="unote">“{u.note}”</span>}
                    </span>
                    <span className={`ustat ${u?.allowed ? "ok" : u?.requested ? "wait" : ""}`}>
                      {u?.admin === true
                        ? <>🛡 {t("Admin")}</>
                        : u?.allowed ? t("erişim var") : u?.requested ? t("beklemede") : t("talep yok")}
                    </span>
                    {/* adminler birbirinin iznine dokunamaz — kurallar da engelliyor */}
                    {uid !== user.uid && u?.admin !== true && (
                      <button className={u?.allowed ? "histbtn" : "gbtn ubtn"}
                        onClick={() => setUserAllowed(uid, !u?.allowed).catch(() => {})}>
                        {u?.allowed ? t("İzni Al") : t("Onayla")}
                      </button>
                    )}
                    {uid !== user.uid && u?.admin === true && (
                      <span className="hint" style={{ fontSize: 10.5 }}>
                        {t("korumalı")}</span>
                    )}
                  </div>
                ))}
            </div>
            <div className="wxmfoot">
              <span className="hint" style={{ marginRight: "auto", fontSize: 11 }}>
                {t("Onaylanan kişi sayfayı yenilemeden erişir.")}</span>
            </div>
          </div>
        </div>
      )}
      {wxHist && (
        <div className="wxmodal" onClick={() => setWxHist(false)}>
          <div className="wxmbox" onClick={(e) => e.stopPropagation()}>
            <div className="wxmhead">
              <span>🕒 {t("Hava Geçmişi")}</span>
              <button className="lbclose" onClick={() => setWxHist(false)}>✕</button>
            </div>
            <div className="wxmlist">
              {!(st.weatherLog || []).length && (
                <div className="hint" style={{ padding: "10px 6px" }}>
                  {t("Henüz hava geçişi yok. Aşağıdan planlı geçiş ekleyin veya soldaki butonlarla canlı değiştirin.")}
                </div>
              )}
              {(st.weatherLog || []).map((e, i) => {
                const wx = WEATHER[e.w] || WEATHER.dry;
                const isFuture = liveInfo.status === "live"
                  && e.t > liveInfo.elapsed / 1000 + 1;
                return (
                  <div key={i} className="wxrow">
                    <span className="wxdot" style={{ background: wx.col }} />
                    <span className="wxnm" style={{ color: wx.col }}>{wx.ico} {t(wx.lbl)}</span>
                    <span className={`wxsrc ${e.src === "plan" ? "plan" : "live"}`}>
                      {e.src === "plan" ? t("planlı") : t("canlı")}
                      {isFuture ? " ⏳" : ""}</span>
                    <span className="wxat mono">@{fmtHMS(e.t)}</span>
                    <button className="minibtn" title={t("Sil")}
                      onClick={() => {
                        const log = st.weatherLog.filter((_, j) => j !== i);
                        up({ weather: log.length ? log[log.length - 1].w : "dry",
                          weatherLog: log });
                      }}>✕</button>
                  </div>
                );
              })}
            </div>
            <div className="wxmplan">
              <div className="wxmptitle">➕ {t("Planlı geçiş ekle")}</div>
              <div className="wxmprow">
                <select value={wxPlanW} onChange={(e) => setWxPlanW(e.target.value)}>
                  {Object.entries(WEATHER).map(([id, w]) => (
                    <option key={id} value={id}>{w.ico} {t(w.lbl)}</option>
                  ))}
                </select>
                <input type="text" placeholder="s:dd:ss" value={wxPlanT}
                  onChange={(e) => setWxPlanT(e.target.value)}
                  title={t("Yarış saati (başlangıçtan itibaren)")} />
                <button className="histbtn" onClick={() => {
                  const tt = parseHMS(wxPlanT);
                  if (tt <= 0) return;
                  const log = [...(st.weatherLog || []).filter((e) => Math.abs(e.t - tt) > 0.5),
                    { t: tt, w: wxPlanW, src: "plan" }].sort((a, b) => a.t - b.t);
                  up({ weather: WX({ weatherLog: log }).lap ? st.weather : st.weather,
                    weatherLog: log });
                  setWxPlanT("");
                }}>{t("Ekle")}</button>
              </div>
              <div className="wxmquick">
                {[["30 dk", 30], ["60 dk", 60], ["90 dk", 90]].map(([lbl, mn]) => (
                  <button key={mn} className="minibtn" style={{ width: "auto", padding: "0 8px" }}
                    title={t("Son X dk için geçiş zamanı")}
                    onClick={() => {
                      const tt = Math.max(0, parseHMS(st.raceTime) - mn * 60);
                      setWxPlanT(fmtHMS(tt));
                    }}>{t("Son")} {lbl}</button>
                ))}
              </div>
            </div>
            <div className="wxmfoot">
              <button className="histbtn" onClick={() => {
                up({ weather: "dry", weatherLog: [] }); setWxHist(false);
              }}>{t("Tümünü Sıfırla")}</button>
            </div>
          </div>
        </div>
      )}
      <header>
        <img className="hlogo" src={`${ASSET}logo.png`} alt="Caspian Motorsport" />
        <h1 className="disp" style={{ fontSize: 20 }}>RACE MONITOR</h1>
        <span className="ver">{APP_VERSION}</span>
        <button className="tourbtn" onClick={() => setTour("main")}
          title={t("Rehberi başlat")}>🎓</button>
        {infoBtn}
        <span className="langsw">
          {["tr", "en"].map((l) => (
            <button key={l} className={lang === l ? "on" : ""}
              onClick={() => switchLang(l)}>{l.toUpperCase()}</button>
          ))}
        </span>
        {(st.track || st.car) && (
          <span className="hdsel">
            {st.track && <><img className="flag" src={`${ASSET}flags/${st.track}.png`} alt="" />
              {trackName(st.track)}</>}
            {st.car && <>
              <img className="car" src={carImg(st.carClass, st.car)} alt=""
                onError={(e) => { e.currentTarget.style.display = "none"; }} />
              {carName(st.carClass, st.car)}</>}
          </span>
        )}
        {access && (
          <button className="adminbtn" data-tour="hteam"
            onClick={() => setTeamOpen(true)} title={t("Takımlarım")}>
            🏢 {teamData?.meta?.name || t("Takımlar")}
          </button>
        )}
        {chatBtn}
        {isAdmin && (
          <button className="adminbtn" onClick={() => setAdminOpen(true)}
            title={t("Kullanıcı yönetimi")}>
            👥 {t("Üyeler")}
            {Object.values(allUsers).filter((u) => u?.requested && u?.allowed !== true).length > 0 &&
              <b className="badge">{Object.values(allUsers)
                .filter((u) => u?.requested && u?.allowed !== true).length}</b>}
          </button>
        )}
        {user && (
          <span className="userchip" data-tour="uchip" title={user.email || ""}>
            {user.photoURL && <img src={user.photoURL} alt="" referrerPolicy="no-referrer" />}
            {myBadges.map((b) => (
              <span key={b.lbl} className="ubadge" title={t(b.lbl)}
                style={{ color: b.col, background: b.bg, borderColor: b.col }}>
                {b.ico}</span>
            ))}
            <button className="unamebtn" title={t("Profili düzenle")}
              onClick={() => { setProfName(userName || user.displayName || ""); setProfOpen(true); }}>
              {userName || user.displayName || user.email}</button>
            <button onClick={signOut} title={t("Çıkış yap")}>⏻</button>
          </span>
        )}
      </header>

      <div className={`teambar ${barOpen ? "" : "collapsed"}`}>
        <span className={`dot ${curRace ? "on" : "off"}`} title={curRace ? t("Bağlı") : t("Solo mod")} />
        {!barOpen && !curRace && <span className="syncinfo" style={{ marginLeft: 0 }}>
          {t("Solo mod")}</span>}
        <button className="bartoggle"
          onClick={() => setBarOpen(!barOpen)}
          title={barOpen ? t("Katılım çubuğunu gizle") : t("Katılım çubuğunu göster")}>
          {barOpen ? "▲" : "▼"}</button>
        {barOpen && (<>
        {!curRace ? (
          <span className="syncinfo" style={{ marginLeft: 0 }}>
            {t("Solo mod — takım takvimi için lobiye dön.")}
          </span>
        ) : (<>
          <span>{t("YARIŞ")}: <span className="roomcode">
            {races[curRace]?.name || trackName(races[curRace]?.trackId) || curRace}</span></span>
          {/* rol rozeti yok — yetki takım rozetlerinden (🛞 sürücü / 🎧 mühendis) belli */}
          {teamData?.meta?.name && (
            <span className="syncinfo" style={{ marginLeft: 0 }}>
              🏢 {teamData.meta.name}</span>
          )}
          <button className="leave" onClick={leaveRace}>{t("Takvime Dön")}</button>
          <span className="syncinfo">
            {lastSync ? `${t("Son güncelleme: ")}${lastSync.by} · ${new Date(lastSync.at).toLocaleTimeString(lang === "en" ? "en-GB" : "tr-TR")}` : t("Senkronize")}
          </span>
        </>)}
        {syncMsg && <span style={{ color: "var(--yellow)" }}>{syncMsg}</span>}
        </>)}
      </div>

      {liveInfo.status !== "idle" && (
        <div className="livestrip">
          {liveInfo.status === "pre" && (<>
            <div><span className="lbl">{t("Start'a")}</span>
              <span className="big mono" style={{ color: "var(--yellow)" }}>
                {fmtHMS(liveInfo.toStart / 1000)}</span></div>
          </>)}
          {liveInfo.status === "live" && (<>
            <div><span className="lbl">{t("Kalan Süre")}</span>
              <span className="big mono" style={{ color: "var(--green)" }}>
                {fmtHMS(liveInfo.remaining / 1000)}</span></div>
            <div><span className="lbl">Stint</span>
              <span className="big">{liveInfo.stintIdx + 1}/{racePlan.fullStints}
                {liveInfo.phase === "pit" && <span style={{ color: "var(--yellow)" }}> · PIT</span>}
              </span></div>
            <div><span className="lbl">{liveInfo.phase === "pit" ? t("Pit Çıkışı") : t("Sıradaki Pit")}</span>
              <span className={`big mono ${pitSoon ? "pulse" : ""}`}>
                {fmtHMS(liveInfo.nextPitIn / 1000)}</span></div>
            {liveInfo.driver && <div><span className="lbl">{t("Direksiyonda")}</span>
              <span className="big">{liveInfo.driver}</span></div>}
          </>)}
          {liveInfo.status === "done" && (
            <div><span className="lbl">{t("Durum")}</span>
              <span className="big" style={{ color: "var(--green)" }}>{t("🏁 YARIŞ BİTTİ")}</span></div>
          )}
          <button className="act" style={{ marginLeft: "auto" }}
            data-tour="pitboard" onClick={() => setPitboard(true)}>📟 Pit Board</button>
        </div>
      )}

      {pitboard && (
        <div className="pitboard" onClick={() => setPitboard(false)}>
          <button className="close" onClick={() => setPitboard(false)}>✕</button>
          <img className="plogo" src={`${ASSET}logo.png`} alt="" />
          {liveInfo.status === "pre" && (<>
            <div className="plbl">{t("Start'a")}</div>
            <div className="huge" style={{ color: "var(--yellow)" }}>
              {fmtHMS(liveInfo.toStart / 1000)}</div>
          </>)}
          {liveInfo.status === "done" && <div className="huge">🏁</div>}
          {liveInfo.status === "idle" && (<>
            <div className="plbl">{t("Yarış zamanı ayarlanmadı")}</div>
            <div className="mid">{t("Pilotlar sekmesinden başlangıç zamanını gir")}</div>
          </>)}
          {liveInfo.status === "live" && (<>
            <div>
              <div className="plbl">{t("Kalan Süre")}</div>
              <div className="huge">{fmtHMS(liveInfo.remaining / 1000)}</div>
            </div>
            <div className="pbrow">
              <div className="pbcard">
                <div className="plbl">{liveInfo.phase === "pit" ? t("Pit Çıkışı") : t("Sıradaki Pit")}</div>
                <div className={`mid mono ${pitSoon ? "pulse" : ""}`}
                  style={{ color: pitSoon ? "var(--yellow)" : "var(--txt)" }}>
                  {fmtHMS(liveInfo.nextPitIn / 1000)}</div>
              </div>
              <div className="pbcard">
                <div className="plbl">Stint</div>
                <div className="mid">{liveInfo.stintIdx + 1} / {racePlan.fullStints}</div>
              </div>
              {upcomingIsLast && (
                <div className="pbcard">
                  <div className="plbl" style={{ display: "flex", alignItems: "center",
                    justifyContent: "center", gap: 4 }}><Bolt size={14} /> {t("Son Pit VE")}</div>
                  <div className="mid" style={{ color: "var(--green)" }}>
                    {planLsf.refuel.toFixed(1)}%</div>
                </div>
              )}
            </div>
            {(liveInfo.driver || liveInfo.nextDriver) && (
              <div className="pbcard">
                <div className="plbl">{t("Pilot Değişimi")}</div>
                <div className="mid">
                  {liveInfo.driver || "?"} <span style={{ color: "var(--teal)" }}>→</span>{" "}
                  {liveInfo.nextDriver || "?"}
                </div>
              </div>
            )}
            {upcomingPit && !racePlan.rows[liveInfo.stintIdx]?.isLast && (
              <div className="chips">
                <span className="plbl">{t("Sıradaki pit: ")}</span>
                {upcomingPit.fuel && <span className="chip2 fuel"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Bolt size={17} /> VE</span>}
                {TY.filter((_, i) => upcomingPit.tyres[i]).map((c) => (
                  <span key={c} className="chip2 tyre"
                    style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <Tyre size={17} /> {c}</span>
                ))}
                {!upcomingPit.fuel && !upcomingPit.tyres.some(Boolean) && (
                  <span className="chip2 none">{t("Sadece geçiş")}</span>
                )}
              </div>
            )}

            {/* --- gerçek pit işaretleme: sadece düzenleyici --- */}
            {canEdit && (
              <div onClick={(e) => e.stopPropagation()}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                {liveInfo.pitsDone < racePlan.rows.length - 1 ? (
                  <button onClick={markPit}
                    title={t("Araç PİT YOLUNA GİRDİĞİ an bas. Pit süresi plandan otomatik eklenir, sonraki stint pit çıkışıyla başlar.")}
                    style={{ padding: "16px 34px", borderRadius: 12, cursor: "pointer",
                      background: "var(--car)", color: "#FFE9ED", border: "2px solid var(--teal)",
                      fontFamily: "'Barlow Condensed'", fontSize: 26, fontWeight: 700,
                      letterSpacing: ".06em" }}>
                    {t("✔ PIT")} — S{liveInfo.stintIdx + 1}
                  </button>
                ) : (
                  <div className="plbl" style={{ color: "var(--green)" }}>
                    ✔ {t("Tüm pitler yapıldı")}</div>
                )}
                {liveInfo.lastDev != null && (
                  <div className="plbl" style={{ textTransform: "none" }}>
                    P{liveInfo.lastPitIdx + 1}: {t("Plan")}{" "}
                    <span className="mono">{fmtClock(liveInfo.plannedPitStart[liveInfo.lastPitIdx])}</span>
                    {" · "}{t("Gerçek")}{" "}
                    <span className="mono">{fmtClock(st.actualPits[liveInfo.lastPitIdx])}</span>
                    {" → "}
                    <b style={{ color: Math.abs(liveInfo.lastDev) > 60000
                      ? "var(--yellow)" : "var(--green)" }}>
                      {fmtDev(liveInfo.lastDev)}</b>
                  </div>
                )}
                {liveInfo.pitsDone > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4,
                    alignItems: "center" }}>
                    {(st.actualPits || []).map((v, i) => Number.isFinite(v) ? (
                      <div key={i} className="plbl"
                        style={{ display: "flex", alignItems: "center", gap: 6,
                          textTransform: "none" }}>
                        P{i + 1} 🔧 {t("Tamir (s)")}
                        <input type="number" min="0" step="1"
                          value={(st.pitRepairs || [])[i] || ""}
                          placeholder="0"
                          onChange={(e) => setRepair(i, e.target.value)}
                          style={{ width: 64, padding: "3px 6px", borderRadius: 6,
                            background: "var(--panel2)", color: "var(--text)",
                            border: "1px solid var(--line)", fontSize: 13,
                            textAlign: "right" }} />
                        {(Number((st.pitRepairs || [])[i]) || 0) > 0 && (
                          <span style={{ color: "var(--yellow)", fontSize: 12 }}>
                            +{Number(st.pitRepairs[i])}s</span>
                        )}
                      </div>
                    ) : null)}
                  </div>
                )}
                {liveInfo.pitsDone > 0 && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={unmarkPit}
                      style={{ padding: "4px 12px", borderRadius: 6, cursor: "pointer",
                        background: "var(--panel2)", color: "var(--dim)",
                        border: "1px solid var(--line)", fontSize: 12 }}>
                      {t("↩ Geri Al")}</button>
                    <button onClick={resetPits}
                      style={{ padding: "4px 12px", borderRadius: 6, cursor: "pointer",
                        background: "var(--panel2)", color: "var(--dim)",
                        border: "1px solid var(--line)", fontSize: 12 }}>
                      {t("⟲ Sıfırla")}</button>
                  </div>
                )}
              </div>
            )}
          </>)}
        </div>
      )}

      <div className={`grid ${sideOpen ? "" : "noside"} ${role === "viewer" && curRace ? "viewonly" : ""}`}>
        <button className={`sidetoggle ${sideOpen ? "" : "closed"}`}
          onClick={() => setSideOpen(!sideOpen)}
          title={sideOpen ? t("Paneli gizle") : t("Paneli göster")}>
          {sideOpen ? "◀" : "▶"}</button>
        {/* ================= SOL: DATA ================= */}
        <div className="sidecol">
          <div className="sideinner">{dataCards}</div>
        </div>

        {/* ================= SAĞ: SEKMELER ================= */}
        <div>
          <div className="tabs" data-tour="tabs">
            {[["dash", "Dashboard", "\u{1F4CA}"], ["stint", "Stint", "\u{1F4CB}"],
              /* ["code80", "Code 80"], — şimdilik arayüzden gizli, kod korunuyor */
              ["fuel", t("Son Stint Yakıtı"), "\u26A1"],
              ["tyre", t("Lastik"), <Tyre size={12} />],
              ["drivers", t("Pilotlar"), <Wheel size={12} />],
              ["tele", t("Telemetri"), "\u{1F4C8}"],
              ...(raceChan ? [["rchat", t("Yarış Sohbeti"), "\u{1F4AC}"]] : [])]
              .map(([k, l, ico]) => (
              <button key={k} className={`${tab === k ? "on" : ""} ${k === "code80" && tab === k ? "c80t" : ""}`}
                onClick={() => setTab(k)} style={{ position: "relative" }}>
                <span style={{ marginRight: 6 }}>{ico}</span>{l}
                {k === "rchat" && raceUnread > 0 && tab !== "rchat" &&
                  <b className="cdot" style={{ position: "absolute", top: 2, right: 3 }}>
                    {raceUnread > 9 ? "9+" : raceUnread}</b>}
              </button>
            ))}
          </div>

          {(tab === "stint" || tab === "code80") && (
            <div className={`card ${tab === "code80" ? "c80" : ""}`}>
              <div className="kpis">
                <div className="kpi"><div className="v mono">{fmtHMS(plan.raceSec)}</div>
                  <div className="l">{tab === "code80" ? "Code 80 Kalan" : "Yarış Süresi"}</div></div>
                <div className="kpi"><div className="v" style={{ color: "var(--teal)" }}>{st.chosen}-{plan.laps}</div>
                  <div className="l">{t("Strateji")}</div></div>
                <div className="kpi"><div className="v">{plan.fullStints}</div>
                  <div className="l">{t("Stint Sayısı")}</div></div>
                <div className="kpi"><div className="v">{plan.totalLaps.toFixed(1)}</div>
                  <div className="l">{t("Tahmini Toplam Tur")}</div></div>
                <div className="kpi"><div className="v" style={{ color: "var(--green)" }}>{totalVE.toFixed(0)}%</div>
                  <div className="l">⚡ {t("Toplam VE")} · {totalFuelL.toFixed(1)} L {t("yakıt")}</div></div>
              </div>

              {tab === "stint" && (
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
                  border: "1px solid var(--line)", borderRadius: 8, padding: "8px 12px",
                  marginBottom: 12, background: "var(--panel2)" }}>
                  <span className="disp" data-tour="s1" style={{ fontSize: 14,
                    letterSpacing: ".06em", color: "var(--teal)" }}>
                    <Tyre size={13} /> {t("S1 START LASTİKLERİ")}</span>
                  <span className="mono" style={{ fontSize: 12 }}>
                    {TY.map((corner, ci) =>
                      `${corner}:${String(st.tyreStints[0]?.[ci] || "–")}`).join("  ")}
                  </span>
                  <span className="pitopt">
                    <button onClick={() => quickTyre(0, "carry")}>{t("QUAL İLE BAŞLA")}</button>
                    <button disabled={tyreInfo.available < 4}
                      onClick={() => quickTyre(0, "new4")}>{t("4 YENİ")}</button>
                    <button disabled={tyreInfo.available < 2}
                      onClick={() => quickTyre(0, "fronts")}>{t("2 YENİ ÖN")}</button>
                    <button disabled={tyreInfo.available < 2}
                      onClick={() => quickTyre(0, "rears")}>{t("2 YENİ ARKA")}</button>
                    <button disabled={tyreInfo.available < 2}
                      onClick={() => quickTyre(0, "lefts")}>{t("2 YENİ SOL")}</button>
                    <button disabled={tyreInfo.available < 2}
                      onClick={() => quickTyre(0, "rights")}>{t("2 YENİ SAĞ")}</button>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4,
                      marginLeft: 4, paddingLeft: 8, borderLeft: "1px solid var(--line)" }}>
                      <span style={{ fontSize: 10.5, color: "var(--dim)",
                        letterSpacing: ".08em" }}>{t("1 YENİ")}</span>
                      {TY.map((c, ci) => (
                        <button key={c} disabled={tyreInfo.available < 1}
                          title={`${t("Tek yeni lastik")} — ${c}`}
                          onClick={() => quickTyre(0, ["fl", "fr", "rl", "rr"][ci])}>{c}</button>
                      ))}
                    </span>
                    <button onClick={() => quickTyre(0, "clear")}>{t("TEMİZLE")}</button>
                  </span>
                  {tyreInfo.available <= 0 && (
                    <span className="hint warn" style={{ margin: 0 }}>
                      {t("⚠ Lastik limiti doldu — yeni lastik seçilemez")}
                    </span>
                  )}
                  {!(st.tyreStints[0] || []).some((v) => String(v).trim()) && (
                    <span className="hint warn" style={{ margin: 0 }}>
                      {t("⚠ Başlangıç lastiği seçilmedi — önce buradan başla, pit seçimleri buna zincirlenir")}
                    </span>
                  )}
                </div>
              )}

              <div className="timeline" role="img" aria-label={t("Stint zaman çizelgesi")}>
                {timeline.map((s, i) => (
                  <div key={i} className={`seg ${s.cls}`}
                    style={{ width: `${s.w}%`, background: s.cls ? undefined : s.bg }}>
                    {s.label && s.w > 1.8 && <span>{s.label}</span>}
                  </div>
                ))}
                {liveInfo.status === "live" && mode === "race" && (
                  <div className="nowline" style={{
                    left: `${Math.min(100, (liveInfo.elapsed / liveInfo.raceMs) * 100)}%` }} />
                )}
              </div>

              {(() => {
                /* hava kronolojisi: doğrudan log'dan, yarış süresi üzerinden
                   (stint sınırlarından bağımsız → canlı + planlı her geçiş görünür) */
                const log = wxLog(st);
                const total = plan.raceSec || parseHMS(st.raceTime) || 1;
                const cuts = [0, ...log.map((e) => e.t).filter((tt) => tt > 0.5 && tt < total - 0.5),
                  total].sort((a, b) => a - b);
                const segs = [];
                for (let i = 0; i < cuts.length - 1; i++) {
                  const a = cuts[i], b = cuts[i + 1];
                  if (b - a < 0.5) continue;
                  segs.push({ w: (b - a) / total * 100, wx: wxAtRel(log, (a + b) / 2) });
                }
                if (!segs.some((x) => x.wx.lap > 1)) return null; // hep dry → çubuk gizli
                return (
                  <div className="wxbar" role="img" aria-label={t("Hava zaman çizelgesi")}>
                    {segs.map((s2, i) => (
                      <div key={i} className={`wseg ${s2.wx.lap > 1 ? "rain" : ""}`}
                        style={{ width: `${s2.w}%`, background: s2.wx.col }}
                        title={`${t(s2.wx.lbl)} ×${s2.wx.lap.toFixed(2)}`}>
                        {s2.w > 6 && <span>{s2.wx.ico}</span>}
                      </div>
                    ))}
                    {liveInfo.status === "live" && mode === "race" && (
                      <div className="nowline" style={{
                        left: `${Math.min(100, (liveInfo.elapsed / liveInfo.raceMs) * 100)}%` }} />
                    )}
                  </div>
                );
              })()}

              <table data-tour="stinttable">
                <thead><tr>
                  <th>#</th><th>Stint</th><th>{t("Tur")}</th><th>⚡ {t("VE İht.")}</th>
                  <th>{t("Ort. Tur")}</th>
                  <th>{t("Pit Ayarı")}</th><th>{t("Pilot")}</th><th>Pit</th><th>End Stint</th><th>Time Left</th>
                  <th>Override</th>
                </tr></thead>
                <tbody>
                  {plan.rows.map((r, i) => (
                    <tr key={i} className={[
                      r.isLast ? "last" : "",
                      liveInfo.status === "live" && mode === "race" && i === liveInfo.stintIdx
                        ? (pitSoon ? "live pitsoon" : "live") : "",
                    ].join(" ").trim()}>
                      <td className="disp" style={{ fontSize: 15 }}>{r.idx}</td>
                      <td>{fmtHMS(r.stintSec)}</td>
                      <td>{(() => {
                        const timeLocked = parseHMS(st.overrides[i] || "") > 0;
                        const lapOvr = (Number(st.lapOverrides?.[i]) || 0) > 0;
                        if (r.isLast) return r.lapsInStint;
                        return (
                          <span className="lapcell">
                            <button className="lapstep" disabled={timeLocked}
                              title={timeLocked ? t("Önce süre override'ı temizle") : t("Tur −1")}
                              onClick={() => bumpLaps(i, r.lapsInStint, -1)}>−</button>
                            <b className={lapOvr ? "lapman" : ""}>{r.lapsInStint}</b>
                            <button className="lapstep" disabled={timeLocked}
                              title={timeLocked ? t("Önce süre override'ı temizle") : t("Tur +1")}
                              onClick={() => bumpLaps(i, r.lapsInStint, 1)}>+</button>
                            {lapOvr && <button className="lapclr" title={t("Otomatiğe dön")}
                              onClick={() => clearLaps(i)}>✕</button>}
                          </span>
                        );
                      })()}</td>
                      <td className={r.fuelNeed > 100 ? "neg" : ""}
                        title={`≈ ${(r.fuelNeed * st.fuelRatio).toFixed(1)} L`}>
                        {r.fuelNeed.toFixed(1)}%</td>
                      <td>
                        <input className="ovr" type="text" style={{ width: 78 }}
                          placeholder={st.avgLap || "m:ss.00"}
                          title={r.fixLap > 0
                            ? t("Bu stint girilen tur süresiyle hesaplanıyor — hava çarpanı uygulanmaz")
                            : t("Boş: yarış datasındaki ortalama tur kullanılır")}
                          value={(st.stintLaps || [])[i] || ""}
                          onChange={(e) => upStintLap(i, e.target.value)} />
                        {r.fixLap > 0 && (
                          <button className="minibtn" title={t("Otomatiğe dön")}
                            style={{ marginLeft: 4 }}
                            onClick={() => upStintLap(i, "")}>✕</button>
                        )}
                      </td>
                      <td>
                        {r.isLast ? <span className="chip">FINISH 🏁</span> : (<>
                          <span className="tyrebox">
                            {TY.map((corner, ti) => {
                              const stv = tyState((st.pits[i] || EMPTY_PIT).tyres[ti]);
                              return (
                                <button key={corner}
                                  className={["", "on", "qual", "wet", "used"][stv]}
                                  title={[t("Taşı — tıkla: yeni kuru"),
                                    t("Yeni kuru — tıkla: Qual'a dön"),
                                    t("Qual lastiği — tıkla: wet"),
                                    t("Wet (sınırsız) — tıkla: eski kuru"),
                                    t("Eski kuru tekrar — tıkla: taşı")][stv]}
                                  onClick={() => upTyre(i, ti)}>{corner}</button>
                              );
                            })}
                          </span>
                          <span className="pitopt">
                            <button className={(st.pits[i] || EMPTY_PIT).fuel ? "on" : ""}
                              onClick={() => upPit(i, { fuel: !(st.pits[i] || EMPTY_PIT).fuel })}>FUEL</button>
                          </span>
                        </>)}
                      </td>
                      <td>
                        <select className="drvsel" value={st.driverAssign[i] || ""}
                          onChange={(e) => assignDriver(i, e.target.value)}>
                          <option value="">—</option>
                          {(st.roster || []).map((n) => <option key={n} value={n}>{n}</option>)}
                        </select>
                      </td>
                      <td>{r.isLast ? "—" : (<>
                        {fmtHMS(r.pitSec)}
                        {r.repairSec > 0 && <span style={{ color: "var(--yellow)",
                          fontSize: 11, marginLeft: 4 }}>🔧+{r.repairSec}s</span>}
                      </>)}</td>
                      <td>{fmtHMS(r.endSec)}</td>
                      <td className={r.timeLeft < 0 ? "neg" : "pos"}>{fmtHMS(r.timeLeft)}</td>
                      <td><input className="ovr" type="text" placeholder="h:mm:ss"
                        disabled={(Number(st.lapOverrides?.[i]) || 0) > 0}
                        title={(Number(st.lapOverrides?.[i]) || 0) > 0
                          ? t("Tur override aktif — önce onu temizle") : undefined}
                        value={st.overrides[i] || ""} onChange={(e) => upOvr(i, e.target.value)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="hint">
                {t("Pit süresi = FUEL")}({st.fuelTime}s) + LANE({st.pitLaneTime}s) + {t("lastik")}
                {tab === "code80"
                  ? ` (1-2: ${(TYRE_2_SEC / 4).toFixed(2)}s · 3-4: ${(TYRE_4_SEC / 4).toFixed(2)}s · Code 80: ÷4)`
                  : ` (1-2: ${TYRE_2_SEC}s · 3-4: ${TYRE_4_SEC}s)`}.
                {t("Son stintte pit hesaplanmaz. Override girilirse stint süresi manuel değere kilitlenir.")}{" "}
                {t("Pit'te seçilen lastikler (FL/FR/RL/RR) Lastik sekmesindeki tabloya otomatik işlenir:")}{" "}
                {t("seçilen köşeye sonraki stint için yeni lastik atanır, seçim kaldırılırsa önceki lastikle devam edilir.")}
              </div>
            </div>
          )}

          {tab === "dash" && (<>
            <div style={{ display: "flex", justifyContent: "flex-end", margin: "0 0 10px" }}>
              <button onClick={() => exportPdf("stint")}
                style={{ padding: "5px 16px", borderRadius: 6, cursor: "pointer",
                  background: "var(--panel2)", color: "var(--txt)",
                  border: "1px solid var(--line)", fontSize: 12 }}
                  data-tour="pdf">🖨 PDF</button>
            </div>
            <div className="dgrid">
              {st.car && (
                <div className="card infocard clickable" onClick={() => setZoom("car")}
                  title={t("Büyütmek için tıkla")}>
                  <h2>🏎 {t("Araç")}</h2>
                  <img src={carImg(st.carClass, st.car)} alt=""
                    style={{ display: "block", width: "100%", maxHeight: 140,
                      objectFit: "contain", margin: "8px 0 10px",
                      filter: "drop-shadow(0 4px 12px rgba(0,0,0,.5))" }}
                    onError={(e) => { e.currentTarget.style.display = "none"; }} />
                  <div className="disp" style={{ fontSize: 17 }}>{carName(st.carClass, st.car)}</div>
                  <div className="hint" style={{ display: "flex", alignItems: "center",
                    justifyContent: "center", gap: 6 }}>
                    <img src={`${ASSET}class/${st.carClass}.png`} alt="" style={{ height: 16 }}
                      onError={(e) => { e.currentTarget.style.display = "none"; }} />
                    {(CAR_CLASSES.find(([id]) => id === st.carClass) || [, st.carClass])[1]}</div>
                </div>
              )}

              {st.track && (
                <div className="card infocard clickable" onClick={() => setZoom("track")}
                  title={t("Büyütmek için tıkla")}>
                  <h2>📍 {t("Pist")}</h2>
                  <img key={st.track} src={`${ASSET}tracks/${TRACK_ASSET(st.track)}.png${AV}`} alt=""
                    style={{ display: "block", width: "100%", maxHeight: 160,
                      objectFit: "contain", margin: "8px 0 10px",
                      filter: "drop-shadow(0 4px 12px rgba(0,0,0,.5))" }}
                    onError={(e) => { e.currentTarget.style.display = "none"; }} />
                  <div className="disp" style={{ fontSize: 17, display: "flex",
                    alignItems: "center", gap: 6 }}>
                    <img className="flag" style={{ width: 22 }} src={`${ASSET}flags/${st.track}.png`}
                      alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                    {trackName(st.track)}</div>
                  {PIT_LANE_TIMES[st.track] != null && (
                    <div className="hint">{t("Pit lane")}: {PIT_LANE_TIMES[st.track]}s</div>
                  )}
                  {WX(st).lap > 1 && (
                    <div className="hint" style={{ color: WX(st).col, fontWeight: 600 }}>
                      {WX(st).ico} {t(WX(st).lbl)} · ×{WX(st).lap.toFixed(2)}
                      {(st.weatherLog || []).length > 1 && <> · {st.weatherLog.length} {t("değişim")}</>}</div>
                  )}
                </div>
              )}

              {zoom && (
                <div className="lightbox" onClick={() => setZoom(null)}>
                  <button className="lbclose" onClick={() => setZoom(null)}>✕</button>
                  <img src={zoom === "car"
                      ? carImg(st.carClass, st.car)
                      : `${ASSET}tracks/${TRACK_ASSET(st.track)}.png${AV}`}
                    alt="" style={zoom === "car" ? { maxHeight: "40vh" } : undefined}
                    onError={() => setZoom(null)} />
                  <div className="lbcap" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {zoom === "car" && (
                      <img src={`${ASSET}class/${st.carClass}.png`} alt="" style={{ height: 20 }}
                        onError={(e) => { e.currentTarget.style.display = "none"; }} />
                    )}
                    {zoom === "car"
                      ? `${carName(st.carClass, st.car)} · ${(CAR_CLASSES.find(([id]) => id === st.carClass) || [, st.carClass])[1]}`
                      : `${trackName(st.track)}${PIT_LANE_TIMES[st.track] != null ? ` · Pit lane ${PIT_LANE_TIMES[st.track]}s` : ""}`}
                  </div>
                  {zoom === "car" && (() => {
                    const d = lmuData?.data?.[st.track];
                    const carE = d?.[`${st.carClass}:${st.car}`];
                    const clsE = d?.[st.carClass];
                    const tiers = clsE?.tiers;
                    const hot = carE?.hot || clsE?.hot;
                    if (!tiers && !hot) return null;
                    const ROWS = [
                      ["HOTLAP", hot, "#b06ffc"],
                      ["ALIEN · 100%", tiers?.alien, "#16a34a"],
                      ["COMPETITIVE · 1.01", tiers?.c101, "#65a30d"],
                      ["GOOD · 1.02", tiers?.c102, "#ca8a04"],
                      ["· 1.03", tiers?.c103, "#d97706"],
                      ["MIDPACK · 1.04", tiers?.c104, "#ea580c"],
                      ["· 1.05", tiers?.c105, "#f05252"],
                      ["TAIL-ENDER · 1.06", tiers?.c106, "#dc2626"],
                      ["OFFLINE · 1.07", tiers?.c107, "#991b1b"],
                    ].filter(([, v]) => v);
                    return (
                      <div className="lbtiers" onClick={(e) => e.stopPropagation()}
                        title={lmuData?.source}>
                        {ROWS.map(([lbl, v, col]) => (
                          <div key={lbl} className="lbtr">
                            <i style={{ background: col }} />
                            <span className="lbl">{lbl}</span>
                            <b className="mono" style={{ color: col }}>{v}</b>
                          </div>
                        ))}
                        <div className="lbsrc">{trackName(st.track)} · {lmuData?.source}</div>
                      </div>
                    );
                  })()}
                </div>
              )}

              <div className="card">
                <h2>{t("⏱ Yarış")}</h2>
                <div className="kpis" style={{ gridTemplateColumns: "1fr 1fr" }}>
                  <div className="kpi"><div className="v mono" style={{ color: "var(--green)" }}>
                    {liveInfo.status === "live" ? fmtHMS(liveInfo.remaining / 1000)
                      : fmtHMS(racePlan.raceSec)}</div>
                    <div className="l">{liveInfo.status === "live" ? "Kalan" : "Yarış Süresi"}</div></div>
                  <div className="kpi"><div className="v" style={{ color: "var(--teal)" }}>
                    {st.chosen}-{racePlan.laps}</div><div className="l">{t("Strateji")}</div></div>
                  <div className="kpi"><div className="v">{racePlan.fullStints}</div>
                    <div className="l">Stint</div></div>
                  <div className="kpi"><div className="v">{racePlan.totalLaps.toFixed(0)}</div>
                    <div className="l">{t("Tahmini Tur")}</div></div>
                </div>
                {liveInfo.status === "live" && (
                  <div className="hint">
                    {t("Şu an: Stint")} {liveInfo.stintIdx + 1}
                    {liveInfo.phase === "pit" ? " " + t("(PIT'te)") : ""} ·{" "}
                    {t("sıradaki pit")} <b className={pitSoon ? "pulse" : "mono"}>
                      {fmtHMS(liveInfo.nextPitIn / 1000)}</b>
                    {liveInfo.driver && <> · 🏎 {liveInfo.driver}</>}
                  </div>
                )}
              </div>

              <div className="card">
                <h2 data-tour="dash-prog">{t("📋 Stint Programı")}</h2>
                <table>
                  <thead><tr><th>#</th><th>End</th><th>Left</th><th>{t("Pilot")}</th></tr></thead>
                  <tbody>
                    {racePlan.rows.map((r, i) => (
                      <tr key={i} className={[
                        r.isLast ? "last" : "",
                        liveInfo.status === "live" && i === liveInfo.stintIdx ? "live" : "",
                      ].join(" ").trim()}>
                        <td>{r.idx}</td>
                        <td>{fmtHMS(r.endSec)}</td>
                        <td className={r.timeLeft < 0 ? "neg" : "pos"}>{fmtHMS(r.timeLeft)}</td>
                        <td>{st.driverAssign[i] || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="card">
                <h2 style={{ display: "flex", alignItems: "center", gap: 7 }}><Tyre size={18} /> {t("Lastik")}</h2>
                <div className="kpis" style={{ gridTemplateColumns: "1fr 1fr" }}>
                  <div className="kpi"><div className="v">{tyreInfo.used}/{st.tyreLimit}</div>
                    <div className="l">{t("Kullanılan Lastik")}</div></div>
                  <div className="kpi"><div className="v"
                    style={{ color: tyreInfo.available < 0 ? "var(--red)" : "var(--green)" }}>
                    {tyreInfo.available}</div><div className="l">{t("Kalan Lastik")}</div></div>
                </div>
                {liveInfo.status === "live" && racePlan.rows[liveInfo.stintIdx + 1] && (
                  <div className="hint">{t("Sıradaki stint lastikleri:")}{" "}
                    <b className="mono">
                      {[0, 1, 2, 3].map((ci) => {
                        const raw = String((st.tyreStints[liveInfo.stintIdx + 1] || [])[ci] || "").trim();
                        return raw || `⟳${carriedAt(liveInfo.stintIdx + 1, ci) || "–"}`;
                      }).join(" / ")}
                    </b></div>
                )}
                {tyreInfo.conflicts.length > 0 &&
                  <div className="hint" style={{ color: "var(--red)" }}>
                    {t("⚠ Köşe ihlali: lastik")} {tyreInfo.conflicts.join(", ")}</div>}
              </div>

              <div className="card">
                <h2 style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Bolt /> <span data-tour="dash-lsf">{t("Son Stint VE")}</span></h2>
                <div className="fuelbig" style={{ fontSize: 40 }}>
                  {planLsf.refuel.toFixed(1)}%
                  <span style={{ fontSize: 18, color: "var(--dim)", marginLeft: 8 }}>
                    (+{st.extraLap} {t("lap")})</span>
                </div>
                <div className="hint">
                  ≈ {planLsf.refuelL.toFixed(1)} L · {planLsf.lapsLeft} {t("tur + extra")} {st.extraLap} <span style={{ color: "var(--dim)" }}>({planLsf.lapsRaw.toFixed(2)} {t("gerçek")})</span>
                </div>
                {driverPlan && Object.keys(driverPlan.totals).length > 0 && (<>
                  <label style={{ marginTop: 10 }}>{t("Pilot Dağılımı")}</label>
                  {st.roster.filter((n) => driverPlan.totals[n]).map((n) => {
                    const t = driverPlan.totals[n];
                    const pct = driverPlan.grandMs ? (t.ms / driverPlan.grandMs) * 100 : 0;
                    return (
                      <div key={n} style={{ marginBottom: 4 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                          <span>{n}</span><span className="mono">{pct.toFixed(1)}%</span>
                        </div>
                        <div style={{ height: 5, background: "var(--panel2)", borderRadius: 3 }}>
                          <div style={{ width: `${pct}%`, height: "100%",
                            background: "var(--teal)", borderRadius: 3 }} />
                        </div>
                      </div>
                    );
                  })}
                </>)}
              </div>
            </div>
          </>)}

          {tab === "tyre" && (
            <div className="card" data-tour="tyrecard">
              <h2>{t("Lastik Stratejisi")}</h2>
              <div className="kpis">
                <div className="kpi">
                  <label style={{ margin: 0 }}>{t("Lastik Limiti (adet)")}</label>
                  <Num v={st.tyreLimit} step={1} onC={(v) => up({ tyreLimit: v })} />
                </div>
                <div className="kpi"><div className="v">{tyreInfo.used}</div>
                  <div className="l">{t("Kullanılan Lastik")}</div></div>
                <div className="kpi"><div className="v"
                  style={{ color: tyreInfo.available < 0 ? "var(--red)" : "var(--green)" }}>
                  {tyreInfo.available}</div>
                  <div className="l">{t("Kalan Lastik")}</div></div>
                <div className="kpi"><div className="v">{racePlan.fullStints}</div>
                  <div className="l">{t("Stint Sayısı")}</div></div>
              </div>
              <div className="hint" style={{ marginTop: 2 }}>
                {t("Kullanılan kuru lastik no")}: {tyreInfo.usedList.length
                  ? tyreInfo.usedList.join(", ") : "—"}
                {" "}<b>({tyreInfo.used}/{st.tyreLimit})</b>
                {tyreInfo.wetUsed > 0 && <> · 🌧 {t("wet (limitsiz)")}: {tyreInfo.wetUsed}</>}
              </div>
              <table>
                <thead><tr><th>Stint</th><th>FL</th><th>FR</th><th>RL</th><th>RR</th><th>{t("Hızlı Atama")}</th></tr></thead>
                <tbody>
                  {tyreInfo.rows.map((r) => (
                    <tr key={r.label}>
                      <td className="disp" style={{ fontSize: 14 }}>{r.label}</td>
                      {r.vals.map((v, ci) => {
                        const empty = !String(v).trim();
                        const carried = r.row >= 0 && empty ? carriedAt(r.row, ci) : "";
                        return (
                        <td key={ci} className={`${tyreInfo.cellCls(v)} ${carried ? "tcarry" : ""}`}>
                          <select className="tsel" value={String(v)}
                            onChange={(e) => upTyreCell(r.row, ci, e.target.value)}>
                            <option value="">{carried ? `⟳ ${carried}` : "—"}</option>
                            <option value="W" style={{ background: "#0C3A1F", color: "#7FE3A0" }}>
                              🌧 W</option>
                            {Array.from({ length: Math.max(0, st.tyreLimit) }, (_, n) => {
                              const k = String(n + 1);
                              const cur = String(v).trim() === k;
                              if (!cur && !tyreInfo.allowedIn(k, ci)) return null; // köşe kilidi
                              const c = tyreInfo.counts[k] || 0;
                              const cls = tyreInfo.cellCls(k);
                              const OPT = {
                                t2:   { bg: "#8A6E1A", fg: "#FFE9A8", dot: "🟡" },
                                tq:   { bg: "#2B4A8F", fg: "#CFE0FF", dot: "🔵" },
                                t3:   { bg: "#8A5A1A", fg: "#FFDCA8", dot: "🟠" },
                                t4:   { bg: "#7A2020", fg: "#FFC9C0", dot: "🔴" },
                                terr: { bg: "#7A2A20", fg: "#FFC9C0", dot: "⚠️" },
                              }[cls];
                              return <option key={k} value={k}
                                style={OPT ? { background: OPT.bg, color: OPT.fg } : {}}>
                                {OPT ? `${OPT.dot} ` : ""}{k}{c > 0 ? ` · ${c}x` : ""}
                              </option>;
                            })}
                          </select>
                        </td>
                        );
                      })}
                      <td>
                        {r.row >= 0 && (<span style={{ display: "inline-flex",
                          alignItems: "center", gap: 6 }}>
                          <select className="tsel" style={{ width: 118, textAlign: "left" }}
                            value="" onChange={(e) => {
                              if (e.target.value) {
                                quickTyre(r.row, e.target.value);
                                setQsel((q) => ({ ...q, [r.row]: e.target.value }));
                              }
                            }}>
                            <option value="">{t("— hızlı —")}</option>
                            <option value="new4" disabled={tyreInfo.available < 4}>{t("🆕 4 Yeni")}</option>
                            <option value="wet4">{t("🌧 4 Wet")}</option>
                            <option value="qual4">{t("Qual'a Dön")}</option>
                            <option value="carry">{t("⟳ Öncekiyle Devam")}</option>
                            <option value="fronts" disabled={tyreInfo.available < 2}>{t("Önler Yeni")}</option>
                            <option value="rears" disabled={tyreInfo.available < 2}>{t("Arkalar Yeni")}</option>
                            <option value="lefts" disabled={tyreInfo.available < 2}>{t("Sollar Yeni")}</option>
                            <option value="rights" disabled={tyreInfo.available < 2}>{t("Sağlar Yeni")}</option>
                            <optgroup label={t("Tek lastik")}>
                              {[["fl", "FL"], ["fr", "FR"], ["rl", "RL"], ["rr", "RR"]].map(([v, l]) => (
                                <option key={v} value={v} disabled={tyreInfo.available < 1}>
                                  {l} {t("yeni")}</option>
                              ))}
                            </optgroup>
                            <option value="clear">{t("✕ Temizle")}</option>
                          </select>
                          {qsel[r.row] && (
                            <span className="chip" style={{ fontSize: 10, opacity: .85 }}>
                              {t(QSEL_LBL[qsel[r.row]] || qsel[r.row])}</span>
                          )}
                        </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="legend">
                <span><i style={{ background: "var(--panel2)" }} />{t("Yeni lastik (1 kez)")}</span>
                <span><i style={{ background: "rgba(242,201,76,.5)" }} />{t("2 kez (duplicate)")}</span>
                <span><i style={{ background: "rgba(102,148,255,.5)" }} />{t("Qual lastiği tekrar")}</span>
                <span><i style={{ background: "rgba(240,96,77,.5)" }} />{t("3 kez")}</span>
                <span><i style={{ background: "#000" }} />{t("4+ kez")}</span>
                <span><i style={{ background: "transparent", border: "1px dashed var(--dim)" }} />
                  ⟳ {t("Değişmedi — önceki lastikle devam")}</span>
                <span style={{ marginLeft: 10 }}>
                  <i style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3,
                    background: "var(--yellow)", marginRight: 4 }} />{t("Yeni kuru")}</span>
                <span style={{ marginLeft: 10 }}>
                  <i style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3,
                    background: "#4D9FFF", marginRight: 4 }} />{t("Qual'a dönüş")}</span>
                <span style={{ marginLeft: 10 }}>
                  <i style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3,
                    background: "#7FE3A0", marginRight: 4 }} />{t("Wet — limitten bağımsız, sınırsız")}</span>
                <span style={{ marginLeft: 10 }}>
                  <i style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3,
                    background: "#0B0D12", border: "1px solid #6B7280", marginRight: 4 }} />{t("Eski kuru tekrar")}</span>
              </div>
              {tyreInfo.conflicts.length > 0 &&
                <div className="hint" style={{ color: "var(--red)" }}>
                  {t("⚠ Köşe kuralı ihlali — lastik")} {tyreInfo.conflicts.join(", ")} {t("birden fazla")}{" "}
                  {t("köşede kullanılmış. Bir lastik ilk takıldığı köşeye kilitlenir; hatalı hücreyi düzelt.")}
                </div>}
              <div style={{ marginTop: 12 }}>
                <button className="act danger" onClick={clearTyres}>{t("Tümünü Temizle")}</button>
              </div>
              <div className="hint">{t("Her numara TEK bir lastiği temsil eder (set değil) — limit adet bazlıdır. Bir lastik ilk takıldığı köşeye kilitlenir ve diğer köşelerin menülerinden otomatik kalkar. Aynı lastik aynı köşede tekrar kullanılırsa hücre kullanım sayısına göre renklenir. Hızlı Atama ile tek tıkla 4 yeni / öncekiyle devam / kısmi değişim yapabilirsin.")}</div>
            </div>
          )}

          {tab === "drivers" && (
            <div className="card">
              <h2>Pilotlar</h2>
              <div className="row2" style={{ maxWidth: 420 }}>
                <div>
                  <label>{t("Yarış Başlangıcı")}</label>
                  <input type="datetime-local" value={msToLocalInput(st.raceStartMs)}
                    onChange={(e) => { const t = new Date(e.target.value).getTime();
                      if (!isNaN(t)) up({ raceStartMs: t }); }} />
                </div>
                <div>
                  <label>{t("Yarış Bitişi")}</label>
                  <div className="mono" style={{ padding: "6px 0" }}>
                    {driverPlan ? fmtClock(driverPlan.finishMs, driverPlan.startMs) : "—"}
                  </div>
                </div>
              </div>

              <label data-tour="roster">{t("Pilot Kadrosu")}</label>
              <div style={{ marginBottom: 4 }}>
                {st.roster.map((n) => (
                  <span className="rchip" key={n}>{n}
                    <b onClick={() => removeDriver(n)} title={t("Kadrodan çıkar")}>×</b></span>
                ))}
                {st.roster.length === 0 &&
                  <span className="hint">{t("Henüz pilot yok — aşağıdan ekle.")}</span>}
              </div>
              <div style={{ display: "flex", gap: 8, maxWidth: 340, marginBottom: 8 }}>
                <input type="text" placeholder={t("Pilot adı")} value={newDriver}
                  onChange={(e) => setNewDriver(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addDriver()} />
                <button className="act" onClick={addDriver}>{t("Ekle")}</button>
              </div>
              {teamDrivers.filter((n) => !st.roster.includes(n)).length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <span className="hint" style={{ marginRight: 6 }}>
                    {t("Takımdan ekle")}:</span>
                  {teamDrivers.filter((n) => !st.roster.includes(n)).map((n) => (
                    <button key={n} className="act" style={{ marginRight: 6, marginTop: 4 }}
                      onClick={() => setSt((s) => s.roster.includes(n)
                        ? s : { ...s, roster: [...s.roster, n] })}>+ {n}</button>
                  ))}
                </div>
              )}

              {driverPlan && (<>
                <table>
                  <thead><tr>
                    <th>#</th><th>Start</th><th>Finish</th><th>{t("Süre")}</th><th>{t("Pilot")}</th>
                  </tr></thead>
                  <tbody>
                    {driverPlan.rows.map((r, i) => (
                      <tr key={i} style={r.dur === 0 ? { opacity: .45 } : {}}>
                        <td className="disp" style={{ fontSize: 15 }}>{r.idx}</td>
                        <td>{fmtClock(r.start, driverPlan.startMs)}</td>
                        <td>{fmtClock(r.finish, driverPlan.startMs)}</td>
                        <td>{fmtHMS(r.dur / 1000)}</td>
                        <td>
                          <select value={st.driverAssign[i] || ""}
                            onChange={(e) => assignDriver(i, e.target.value)}>
                            <option value="">{t("— seç —")}</option>
                            {st.roster.length > 0 && (
                              <optgroup label={t("Kadro")}>
                                {st.roster.map((n) =>
                                  <option key={n} value={n}>{n}</option>)}
                              </optgroup>
                            )}
                            {teamDrivers.filter((n) => !st.roster.includes(n)).length > 0 && (
                              <optgroup label={teamData?.meta?.name || t("Takım")}>
                                {teamDrivers.filter((n) => !st.roster.includes(n)).map((n) =>
                                  <option key={n} value={n}>{n}</option>)}
                              </optgroup>
                            )}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {Object.keys(driverPlan.totals).length > 0 && (() => {
                  const names = st.roster.filter((n) => driverPlan.totals[n]);
                  const colorOf = (n) => PIE_COLORS[names.indexOf(n) % PIE_COLORS.length];
                  const pieData = names.map((n) => ({
                    name: n, value: driverPlan.totals[n].ms, color: colorOf(n),
                  }));
                  return (
                  <div style={{ display: "flex", gap: 22, marginTop: 16, flexWrap: "wrap",
                    alignItems: "center" }}>
                    <Donut data={pieData} />
                    <table style={{ maxWidth: 480, flex: "1 1 340px", margin: 0 }}>
                      <thead><tr><th></th><th>{t("Pilot")}</th><th>Stint</th>
                        <th>{t("Toplam Süre")}</th><th>%</th></tr></thead>
                      <tbody>
                        {names.map((n) => {
                          const d = driverPlan.totals[n];
                          return (
                            <tr key={n}>
                              <td style={{ width: 18, padding: "0 0 0 6px" }}>
                                <span style={{ display: "inline-block", width: 12, height: 12,
                                  borderRadius: 3, background: colorOf(n) }} /></td>
                              <td>{n}</td><td>{d.stints}</td>
                              <td>{fmtHMS(d.ms / 1000)}</td>
                              <td className="pos">
                                {driverPlan.grandMs ? ((d.ms / driverPlan.grandMs) * 100).toFixed(1) : "0"}%
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  );
                })()}
                <div style={{ marginTop: 12 }}>
                  <button className="act danger" onClick={clearAssign}>{t("Atamaları Temizle")}</button>
                </div>
                <div className="hint">{t("Start/Finish zamanları stint planından otomatik zincirlenir (pit süreleri dahil). Yarış bitişini aşan kısım süreye sayılmaz; tamamen yarış dışı kalan stintler soluk görünür.")}</div>
              </>)}
              {!driverPlan && <div className="hint warn">{t("Geçerli bir yarış başlangıç zamanı gir.")}</div>}
            </div>
          )}

          {tab === "rchat" && raceChan && (
            <div className="card">
              <h2>🏁 {races[curRace]?.name || t("Yarış Sohbeti")}</h2>
              <div className="hint" style={{ marginBottom: 6 }}>
                {t("Bu yarışa özel kanal — takımın tamamı yazabilir, sürücüler dahil.")}</div>
              <div style={{ border: "1px solid var(--line)", borderRadius: 10,
                overflow: "hidden" }}>
                {chatBody(raceChan, "min(58vh,440px)")}
              </div>
            </div>
          )}

          {tab === "tele" && (
            <div>
              <div className="card">
                <h2 data-tour="teleimport">{t("Telemetri İçe Aktar (MoTeC)")}</h2>
                <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                  {["A", "B", "C", "D"].map((sl) => (
                    <button key={sl} className="act"
                      style={slot === sl
                        ? { borderColor: SLOT_COLORS[sl], color: SLOT_COLORS[sl], fontWeight: 700 }
                        : {}}
                      onClick={() => setSlot(sl)}>
                      Stint {sl}{st.telemetry[sl] ? " ●" : ""}
                    </button>
                  ))}
                </div>
                <label>{t("MoTeC tur istatistiklerini yapıştır veya dosya seç (CSV/TSV)")}</label>
                <textarea value={rawTele}
                  onChange={(e) => { setRawTele(e.target.value); doParse(e.target.value); }}
                  placeholder={"Out Lap\t310127\t-6.403 ...\nLap 1\t237350\t-6.36 ..."}
                  style={{ width: "100%", height: 90, background: "var(--panel2)",
                    border: "1px solid var(--line)", borderRadius: 6, color: "var(--txt)",
                    fontFamily: "IBM Plex Mono", fontSize: 11, padding: 8 }} />
                <div style={{ margin: "6px 0" }}>
                  <input type="file" accept=".csv,.tsv,.txt" onChange={onTeleFile} />
                </div>
                {parsed?.error && <div className="hint warn">⚠ {t(parsed.error)}</div>}
                {parsed?.motec && (<>
                  <div className="hint" style={{ marginTop: 4 }}>
                    <b>{parsed.laps.length}</b> {t("tur çözümlendi")}
                    {parsed.meta.venue && <> · {parsed.meta.venue}</>}
                    {parsed.meta.vehicle && <> · {parsed.meta.vehicle}</>}
                    {parsed.meta.driver && <> · {parsed.meta.driver}</>}
                    {parsed.meta.trk != null && <> · {t("Pist")} {parsed.meta.trk.toFixed(0)}°C</>}
                    {parsed.meta.amb != null && <> / {t("Hava")} {parsed.meta.amb.toFixed(0)}°C</>}
                  </div>
                  <div style={{ overflowX: "auto", margin: "8px 0" }}>
                    <table style={{ fontSize: 11.5 }}>
                      <thead><tr>
                        <th>{t("Tur")}</th><th>{t("Süre")}</th><th>{t("Yakıt")}</th>
                        <th>VE %</th><th>{t("Aşınma")} FL/FR/RL/RR</th><th>{t("Ort/Max km/h")}</th>
                      </tr></thead>
                      <tbody>
                        {parsed.laps.map((l) => (
                          <tr key={l.lap}>
                            <td>{l.lap}{l.pit ? " 🅿" : ""}
                              {l.partial && <span className="hint" style={{ marginLeft: 4 }}>
                                {t("kısmi")}</span>}</td>
                            <td className="mono">{fmtLap(l.sec)}</td>
                            <td className="mono">{l.fuelL != null ? `${l.fuelL.toFixed(2)} L` : "—"}</td>
                            <td className="mono">{l.fuelL != null && st.fuelRatio > 0
                              ? `${(l.fuelL / st.fuelRatio).toFixed(2)}` : "—"}</td>
                            <td className="mono">{l.w.map((x) =>
                              x == null ? "—" : x.toFixed(1)).join(" / ")}</td>
                            <td className="mono">{l.avgSpd != null
                              ? `${Math.round(l.avgSpd)} / ${Math.round(l.maxSpd)}` : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {parsed.laps.some((l) => l.partial) && (
                    <div className="hint">{t("Kısmi tur: log'da sonraki tur yok, süre örneklerden hesaplandı.")}</div>
                  )}
                  {!(st.fuelRatio > 0) && (
                    <div className="hint warn">{t("VE karşılığı için Yarış·Data'da yakıt oranı girilmeli.")}</div>
                  )}
                  <button className="act" style={{ borderColor: SLOT_COLORS[slot],
                    color: SLOT_COLORS[slot], marginTop: 4 }} onClick={saveMotec}>
                    {lang === "en" ? <>Save as Stint {slot}</> : <>Stint {slot} olarak kaydet</>}
                  </button>
                </>)}
                {parsed && !parsed.error && !parsed.motec && mapping && (<>
                  <div className="hint">
                    {parsed.lapRows.length} {t("tur satırı bulundu. Sütun eşleşmesini kontrol et:")}
                  </div>
                  {mapping.fuelCol >= 0 && (
                    <div className="hint" style={{ marginTop: 2 }}>
                      <label style={{ display: "inline-flex", alignItems: "center", gap: 5,
                        margin: 0, textTransform: "none", letterSpacing: 0 }}>
                        <input type="checkbox" checked={!!mapping.fuelIsLitre}
                          onChange={(e) => setMapping({ ...mapping, fuelIsLitre: e.target.checked })} />
                        {t("Yakıt sütunu litre (VE % için orana bölünür)")}
                      </label>
                      {mapping.fuelIsLitre && !(st.fuelRatio > 0) &&
                        <span className="warn" style={{ marginLeft: 8 }}>
                          {t("Yarış·Data'da yakıt oranı girilmeli")}</span>}
                    </div>
                  )}
                  <details style={{ margin: "6px 0" }}>
                  <summary style={{ cursor: "pointer", color: "var(--muted)", fontSize: 12 }}>
                    {t("Sütun eşleşmesini düzenle")}</summary>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "6px 0" }}>
                    {[["Tur Süresi", "timeCol"], ["VE Δ (%)", "fuelCol"]].map(([lbl, key]) => (
                      <div key={key}>
                        <label style={{ margin: 0 }}>{t(lbl)}</label>
                        <select value={mapping[key]}
                          onChange={(e) => setMapping({ ...mapping, [key]: +e.target.value })}>
                          <option value={-1}>—</option>
                          {parsed.headers.map((h, i) =>
                            <option key={i} value={i}>{i}: {h || t("(başlıksız)")}</option>)}
                        </select>
                      </div>
                    ))}
                    {["FL", "FR", "RL", "RR"].map((c, ci) => (
                      <div key={c}>
                        <label style={{ margin: 0 }}>{t("Aşınma")} {c}</label>
                        <select value={mapping.wear[ci]}
                          onChange={(e) => {
                            const wear = [...mapping.wear]; wear[ci] = +e.target.value;
                            setMapping({ ...mapping, wear });
                          }}>
                          <option value={-1}>—</option>
                          {parsed.headers.map((h, i) =>
                            <option key={i} value={i}>{i}: {h || t("(başlıksız)")}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                  </details>
                  <button className="act" style={{ borderColor: SLOT_COLORS[slot],
                    color: SLOT_COLORS[slot] }} onClick={saveSlot}
                    disabled={mapping.timeCol < 0}>
                    {lang === "en" ? <>Save as Stint {slot}</> : <>Stint {slot} olarak kaydet</>}
                  </button>
                  {mapping.timeCol < 0 &&
                    <span className="hint warn" style={{ marginLeft: 8 }}>{t("Tur süresi sütunu seçilmeli")}</span>}
                </>)}
              </div>

              {loadedSlots.length > 0 && (
                <div className="card" style={{ marginTop: 12 }}>
                  <h2>{t("Stint Analizi")}</h2>
                  <div className="kpis">
                    {loadedSlots.map((sl) => {
                      const s = slotStats[sl];
                      if (!s || s.empty) return null;
                      return (
                        <div className="kpi" key={sl} style={{ borderColor: SLOT_COLORS[sl] }}>
                          <div className="v" style={{ color: SLOT_COLORS[sl], fontSize: 19 }}>
                            {fmtMs(s.medMs)}</div>
                          <div className="l">Stint {sl} {t("medyan tur")} · {s.laps} {t("Tur")}</div>
                          <div className="hint" style={{ marginTop: 4 }}>
                            {s.medFuel != null && <>⚡ {s.medFuel.toFixed(2)} %/tur VE
                              {s.tankLaps && <> · %100 ≈ {Math.floor(s.tankLaps)} tur</>}<br /></>}
                            {s.medW.some((w) => w != null) &&
                              <><Tyre size={13} /> {s.medW.map((w) => w == null ? "–" : w.toFixed(1)).join(" / ")} {t("%/tur")}<br /></>}
                            <span style={{ opacity: .7 }}>{t("ort.")} {fmtMs(s.avgMs)}
                              {s.avgFuel != null && <> · {s.avgFuel.toFixed(2)} %/tur</>}<br />
                              {t("en iyi")} {fmtMs(s.bestMs)} · %105 ≤ {fmtMs(s.lim105)}
                              {s.dropped > 0 && <> · {s.dropped} {t("tur hariç")}</>}</span>
                          </div>
                          <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                            <button className="act" style={{ fontSize: 11 }}
                              onClick={() => up({
                                avgLap: fmtMs(s.medMs),
                                ...(s.medFuel != null
                                  ? { consumption: +s.medFuel.toFixed(2) } : {}),
                              })}>{t("DATA'ya uygula")}</button>
                            <button className="act" style={{ fontSize: 11, opacity: .75 }}
                              title={t("Ortalamayı uygula")}
                              onClick={() => up({
                                avgLap: fmtMs(s.avgMs),
                                ...(s.avgFuel != null
                                  ? { consumption: +s.avgFuel.toFixed(2) } : {}),
                              })}>{t("ort.")}</button>
                            <button className="act" style={{ fontSize: 11, opacity: .75 }}
                              title={t("En iyi turun %105'ini aşan turların tikini kaldır")}
                              onClick={() => apply105Slot(sl)}>%105</button>
                            <button className="act danger" style={{ fontSize: 11 }}
                              onClick={() => removeSlot(sl)}>{t("Sil")}</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ display: "flex", gap: 6, margin: "4px 0 2px" }}>
                    {[["box", "Kutu grafiği"], ["line", "Tur tur"]].map(([m, lbl]) => (
                      <button key={m} className="act" style={{ fontSize: 11,
                        ...(chartMode === m ? { borderColor: "var(--teal)", color: "var(--teal)" } : {}) }}
                        onClick={() => setChartMode(m)}>{t(lbl)}</button>
                    ))}
                  </div>
                  {chartMode === "box" ? (
                    <div style={{ margin: "6px 0 2px" }}>
                      <BoxPlot height={300} fmt={(v) => fmtLap(v / 1000)}
                        series={loadedSlots.map((sl) => ({
                          key: sl, label: `Stint ${sl}`, color: SLOT_COLORS[sl],
                          values: st.telemetry[sl].laps.filter((l) => l.use).map((l) => l.ms),
                        })).filter((s) => s.values.length)} />
                      <div className="hint">
                        {t("Kutu = turların ortadaki %50'si (Q1–Q3), kalın çizgi medyan. Bıyıklar uç turlara, halkalar aykırı turlara işaret eder.")}
                      </div>
                    </div>
                  ) : (
                  <div style={{ height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid stroke="#2B3542" strokeDasharray="3 3" />
                        <XAxis dataKey="lap" stroke="#8C97A5" fontSize={11} />
                        <YAxis stroke="#8C97A5" fontSize={11} domain={["auto", "auto"]}
                          tickFormatter={(v) => fmtLap(v)} width={70} />
                        <Tooltip contentStyle={{ background: "#1F2731", border: "1px solid #2B3542" }}
                          labelFormatter={(l) => `Tur ${l}`}
                          formatter={(v, n) => [fmtLap(v), `Stint ${n}`]} />
                        <Legend formatter={(v) => `Stint ${v}`} />
                        {loadedSlots.map((sl) => (
                          <Line key={sl} dataKey={sl} stroke={SLOT_COLORS[sl]}
                            dot={false} strokeWidth={2} connectNulls />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  )}

                  {loadedSlots.length > 1 && baseSlot && slotStats[baseSlot] && !slotStats[baseSlot].empty && (
                    <table style={{ maxWidth: 460, marginTop: 10 }}>
                      <thead><tr><th>{t("Karşılaştırma")}</th><th>{t("Ort. Fark")}</th><th>{t("Hızlı Olan")}</th></tr></thead>
                      <tbody>
                        {loadedSlots.slice(1).map((sl) => {
                          const a = slotStats[baseSlot], b = slotStats[sl];
                          /* karşılaştırma medyan üzerinden */
                          if (!b || b.empty) return null;
                          const d = (a.avgMs - b.avgMs) / 1000; // + ise rakip hızlı
                          return (
                            <tr key={sl}>
                              <td>Stint {baseSlot} vs Stint {sl}</td>
                              <td className={d > 0 ? "neg" : "pos"}>{Math.abs(d).toFixed(3)}s/tur</td>
                              <td style={{ color: SLOT_COLORS[d > 0 ? sl : baseSlot] }}>
                                Stint {d > 0 ? sl : baseSlot}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}

                  {loadedSlots.map((sl) => (
                    <details key={sl} style={{ marginTop: 10 }}>
                      <summary style={{ cursor: "pointer", color: SLOT_COLORS[sl] }}>
                        Stint {sl} — {t("tur listesi")} ({st.telemetry[sl].laps.length})</summary>
                      <table style={{ maxWidth: 560 }}>
                        <thead><tr>
                          <th>{t("Dahil")}</th><th>{t("Tur")}</th><th>{t("Süre")}</th><th>VE %</th><th>FL/FR/RL/RR</th>
                        </tr></thead>
                        <tbody>
                          {st.telemetry[sl].laps.map((l, li) => (
                            <tr key={li} style={l.use ? {} : { opacity: .4 }}>
                              <td><input type="checkbox" checked={l.use}
                                onChange={() => toggleLap(sl, li)} /></td>
                              <td>{l.label}</td>
                              <td>{fmtMs(l.ms)}</td>
                              <td>{l.fuel != null ? l.fuel.toFixed(2) : "–"}</td>
                              <td>{l.w.map((w) => w == null ? "–" : w.toFixed(1)).join(" / ")}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </details>
                  ))}
                  <div className="hint">{t("Out lap ve dolum turları (yakıt Δ pozitif) otomatik hariç tutulur — Dahil kutusuyla elle değiştirebilirsin. Ortalamalar sadece dahil turlardan hesaplanır.")}</div>
                </div>
              )}
            </div>
          )}

          {tab === "fuel" && (
            <div className="row2" data-tour="fuelcalc"
              style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr" }}>
              {[
                [t("YARIŞ SONU"), st.lastStintCountdown, (v) => up({ lastStintCountdown: v }), lsf, true],
                /* [t("CODE 80 SONU"), ...] — şimdilik gizli, kod korunuyor (lsf80) */
              ].map(([title, val, setVal, r, canAuto]) => {
                const isAuto = canAuto && autoCd;
                const eff = isAuto ? fmtHMS(planLastCd) : val;
                const rr = isAuto ? lastStintFuel(eff, st, racePlan.flagExtra) : r;
                return ([title, eff, setVal, rr, isAuto, canAuto]);
              }).map(([title, val, setVal, r, isAuto, canAuto]) => (
                <div className={`card ${title.includes("CODE 80") ? "c80" : ""}`} key={title}>
                  <h2>⛽ {t("Son Stint Yakıtı")} · {title}</h2>
                  <label>{t("Session Countdown (h:mm:ss)")}{" "}
                    {canAuto && (
                      <button className={autoCd ? "chip" : ""}
                        style={{ marginLeft: 6, padding: "2px 8px", borderRadius: 6, fontSize: 10,
                          border: "1px solid var(--line)", cursor: "pointer",
                          background: autoCd ? "var(--car)" : "var(--panel2)",
                          color: autoCd ? "#FFE9ED" : "var(--dim)" }}
                        title={t("Stint planından otomatik — sondan önceki stintin Time Left değeri")}
                        onClick={() => setAutoCd(!autoCd)}>{t("📋 PLAN")}</button>
                    )}
                  </label>
                  <input type="text" value={val} readOnly={isAuto}
                    style={isAuto ? { opacity: .7 } : undefined}
                    onChange={(e) => setVal(e.target.value)} />
                  <div className="kpis" style={{ marginTop: 12 }}>
                    <div className="kpi"><div className="v mono">{r.lapsLeft}</div>
                      <div className="l">{t("Kalan Tur")} <span style={{ color: "var(--dim)" }}>({r.lapsRaw.toFixed(2)})</span></div></div>
                  </div>
                  <div className="fuelbig" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Bolt size={30} />{r.refuel.toFixed(1)}%
                    <span style={{ fontSize: 18, color: "var(--dim)" }}>
                      (+{st.extraLap} {t("lap")})</span></div>
                  <div className="hint">
                    ≈ <b className="mono" style={{ color: "var(--green)" }}>{r.refuelL.toFixed(1)} L</b> {t("gerçek yakıt")} ·
                    ({t("kalan tur")} {r.lapsLeft} + extra {st.extraLap}) × {st.consumption} {t("%/tur")}
                    {r.refuel > 100 &&
                      <> · <b className="warn">{t("⚠ %100'ü aşıyor — depo yetmez!")}</b></>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
