import { useState, useMemo, useEffect, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ResponsiveContainer } from "recharts";
import { roomGet, roomSet, roomSubscribe, firebaseReady } from "./storage";

/* ============================================================
   CASPIAN MOTORSPORT — RACE CONTROL  ·  Faz 2
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
const nowLocal = () => {
  // datetime-local formatında şu an (yerel saat): YYYY-MM-DDTHH:MM
  const d = new Date();
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
  trafficRate: 0.99,
  pitLaneTime: 22,
  fuelTime: 43,
  tyreTime: 13,
  actualPits: [], // gerçekleşen pit giriş zamanları (ms) — canlı plan düzeltme
  // --- pist & araç seçimi ---
  track: "",        // TRACKS id
  carClass: "",     // "hypercar" | "gt3"
  car: "",          // CARS[carClass] id
  // --- Virtual Energy sistemi (LMU) ---
  // Depo her zaman %100 VE'dir. Gerçek yakıt = VE% × fuelRatio.
  // Örn: ratio 0.84 → %100 = 84.0 L taşınan yakıt.
  refuelSpeed: 2.33,   // %/s — dolum hızı
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
  raceStart: nowLocal(),
  roster: [],
  driverAssign: Array.from({ length: 14 }, () => ""),
  // stint başına pit ayarları (index 0 = 1. pit)
  pits: Array.from({ length: 14 }, () => ({
    fuel: true, lane: true, tyres: [false, false, false, false],
  })),
  overrides: Array.from({ length: 14 }, () => ""), // opsiyonel stint süresi "hh:mm:ss"
  // Faz 4 — telemetri (MoTeC)
  telemetry: { A: null, B: null, C: null, D: null },
};

/* ---------- Faz 4: MoTeC telemetri ayrıştırma ---------- */
const SLOT_COLORS = { A: "#40D68C", B: "#F0604D", C: "#F2A33C", D: "#6694FF" };

/* ---------- pist & araç seçimi ---------- */
const ASSET = import.meta.env.BASE_URL + "assets/";
const TRACKS = [
  { id: "lemans", name: "Le Mans" },
  { id: "spa", name: "Spa-Francorchamps" },
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
const CARS = {
  hypercar: [
    { id: "toyota", name: "Toyota GR010" },
    { id: "ferrari", name: "Ferrari 499P" },
    { id: "porsche", name: "Porsche 963" },
    { id: "cadillac", name: "Cadillac V-Series.R" },
    { id: "bmw", name: "BMW M Hybrid V8" },
    { id: "alpine", name: "Alpine A424" },
    { id: "peugeot", name: "Peugeot 9X8" },
    { id: "astonmartin", name: "Aston Martin Valkyrie" },
  ],
  lmp2: [
    { id: "oreca", name: "Oreca 07 Gibson" },
  ],
  lmp3: [
    { id: "ligier", name: "Ligier JS P320" },
    { id: "duqueine", name: "Duqueine D08" },
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
  "Pit · Süreler (s)": "Pit · Times (s)", "Tyre (adet başı)": "Tyre (per tyre)",
  "Hesaplanan Fuel Süresi": "Calculated Fuel Time",
  "VE Tüketim (%/tur)": "VE Usage (%/lap)", "Dolum Hızı (%/s)": "Refuel Rate (%/s)",
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
  "🛞 S1 START LASTİKLERİ": "🛞 S1 STARTING TYRES",
  "QUAL İLE BAŞLA": "START ON QUAL", "4 YENİ": "4 NEW",
  "2 YENİ ÖN": "2 NEW FRONT", "2 YENİ ARKA": "2 NEW REAR",
  "2 YENİ SOL": "2 NEW LEFT", "2 YENİ SAĞ": "2 NEW RIGHT", "TEMİZLE": "CLEAR",
  "⚠ Başlangıç lastiği seçilmedi — önce buradan başla, pit seçimleri buna zincirlenir":
    "⚠ No starting tyres selected — start here first, pit choices chain from this",
  "Tur": "Laps", "VE İht.": "VE Req.", "Pit Ayarı": "Pit Setup",
  "Toplam VE": "Total VE", "yakıt": "fuel",
  // dashboard
  "⏱ Yarış": "⏱ Race", "Kalan": "Remaining", "Tahmini Tur": "Est. Laps",
  "📋 Stint Programı": "📋 Stint Schedule", "🛞 Lastik": "🛞 Tyres",
  "Kullanılan Lastik": "Tyres Used", "Kalan Lastik": "Tyres Left",
  "Son Stint VE": "Final Stint VE", "Pilot Dağılımı": "Driver Split",
  "Sıradaki stint lastikleri:": "Next stint tyres:",
  // lastik sekmesi
  "Lastik Stratejisi": "Tyre Strategy", "Lastik Limiti (adet)": "Tyre Limit (count)",
  "— hızlı —": "— quick —", "🆕 4 Yeni": "🆕 4 New",
  "⟳ Öncekiyle Devam": "⟳ Carry Over", "Önler Yeni": "New Fronts",
  "Arkalar Yeni": "New Rears", "Sollar Yeni": "New Lefts", "Sağlar Yeni": "New Rights",
  "✕ Temizle": "✕ Clear", "Tümünü Temizle": "Clear All", "Hızlı Atama": "Quick Assign",
  "Yeni lastik (1 kez)": "New tyre (1 use)", "2 kez (duplicate)": "2 uses (duplicate)",
  "Qual lastiği tekrar": "Qual tyre reused", "3 kez": "3 uses", "4+ kez": "4+ uses",
  // pilotlar
  "Yarış Bitişi": "Race Finish", "Pilot Kadrosu": "Driver Roster",
  "Henüz pilot yok — aşağıdan ekle.": "No drivers yet — add below.",
  "Pilot adı": "Driver name", "Ekle": "Add", "Süre": "Duration", "Pilot": "Driver",
  "— seç —": "— select —", "Toplam Süre": "Total Time",
  "Atamaları Temizle": "Clear Assignments",
  "Geçerli bir yarış başlangıç zamanı gir.": "Enter a valid race start time.",
  // telemetri
  "Telemetri İçe Aktar (MoTeC)": "Import Telemetry (MoTeC)",
  "MoTeC tur istatistiklerini yapıştır veya dosya seç (CSV/TSV)":
    "Paste MoTeC lap statistics or choose a file (CSV/TSV)",
  "Tur Süresi": "Lap Time", "(başlıksız)": "(untitled)",
  "Tur süresi sütunu seçilmeli": "Select the lap time column",
  "Stint Analizi": "Stint Analysis", "DATA'ya uygula": "Apply to DATA", "Sil": "Delete",
  "Karşılaştırma": "Comparison", "Ort. Fark": "Avg. Gap", "Hızlı Olan": "Faster",
  "Dahil": "Incl.",
  "Tur satırı bulunamadı ('Out Lap', 'Lap 1'...)": "No lap rows found ('Out Lap', 'Lap 1'...)",
  // son stint yakıtı
  "YARIŞ SONU": "RACE END", "CODE 80 SONU": "CODE 80 END",
  "Kalan Tur": "Laps Left", "Dolum Süresi": "Refuel Time",
  "⚠ %100'ü aşıyor — depo yetmez!": "⚠ Exceeds 100% — tank won't fit!",
  "gerçek yakıt": "real fuel",
  // ipuçları
  "Fuel süresi ipucu = %100 VE / dolum hızı": "Fuel time hint = 100% VE / refuel rate",
  "CODE80'de lastik süresi otomatik ÷4 uygulanır.": "In CODE80 tyre time is automatically ÷4.",
  "Depo daima": "The tank is always treated as",
  "kabul edilir. Gerçek yakıt = VE × ratio → gerçek tüketim ≈":
    "VE. Real fuel = VE × ratio → real usage ≈",
  "L/tur": "L/lap", "%/tur": "%/lap", "tur + extra": "laps + extra", "dolum ≈": "refuel ≈",
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
  "✔ PIT YAPILDI": "✔ PIT DONE",
  "Araç PİT YOLUNA GİRDİĞİ an bas. Pit süresi plandan otomatik eklenir, sonraki stint pit çıkışıyla başlar.":
    "Press the moment the car ENTERS the pit lane. Pit duration is added from the plan; the next stint starts at pit exit.", "↩ Geri Al": "↩ Undo", "⟲ Sıfırla": "⟲ Reset",
  "sonu işaretlenecek": "will be marked", "Plan": "Plan", "Gerçek": "Actual",
  "geç": "late", "erken": "early", "Tüm pitler yapıldı": "All pits done",
  "Gerçek pit işaretlemelerini sıfırla?": "Reset all actual pit marks?",
  "⚠ Lastik limiti doldu — yeni lastik seçilemez": "⚠ Tyre limit reached — no new tyres available",
  "🔴 CANLI": "🔴 LIVE", "Canlıdan otomatik — yarış saatinden hesaplanıyor":
    "Auto from live — calculated from the race clock",
  "odası bulunamadı — kodu kontrol et": "room not found — check the code",
  "Takım senkronizasyonu kapalı — ": "Team sync is off — ",
  " dosyasını doldur.": " needs to be filled in.",
};

const CAR_CLASSES = [
  ["hypercar", "Hypercar"], ["lmp2", "LMP2"], ["lmp3", "LMP3"],
  ["gte", "GTE"], ["gt3", "GT3"],
];
const trackName = (id) => TRACKS.find((t) => t.id === id)?.name || "";
const carName = (cls, id) => CARS[cls]?.find((c) => c.id === id)?.name || "";
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

function parseTelemetryText(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return null;
  const cand = ["\t", ";", ","];
  const delim = cand.map((d) => [d, lines.slice(0, 8).reduce((a, l) =>
    a + (l.split(d).length - 1), 0)]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = lines.map((l) => l.split(delim).map((c) => c.trim()));
  const firstLap = rows.findIndex((r) => r.some(isLapLabel));
  if (firstLap === -1) return { error: "Tur satırı bulunamadı ('Out Lap', 'Lap 1'...)" };
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
  let timeCol = numStats.find((s) => s.medAbs > 30000 && s.medAbs < 3600000)?.i ?? -1;
  let fuelCol = byHeader(/fuel.*change/i);
  if (fuelCol === -1)
    fuelCol = numStats.find((s) => s.i !== timeCol && s.medAbs > 0.5 && s.medAbs < 40
      && s.negRatio > 0.5)?.i ?? -1;
  const wear = ["fl", "fr", "rl", "rr"].map((c) =>
    byHeader(new RegExp(`wear\\s*${c}.*change`, "i")));
  return { labelCol, timeCol, fuelCol, wear };
}

/* ---------- çekirdek motor ---------- */
const EMPTY_PIT = { fuel: true, lane: true, tyres: [false, false, false, false] };
const MAX_STINTS = 64; // güvenlik tavanı (24h+ yarışlar için yeterli)

function computePlan(st, mode /* "race" | "code80" */) {
  const raceSec = mode === "race" ? parseHMS(st.raceTime) : parseHMS(st.code80TimeLeft);
  const lapSec = parseLap(st.avgLap);
  const laps = st.strategies[st.chosen] || 0;
  const tyreUnit = mode === "race" ? st.tyreTime : st.tyreTime / 4; // Excel CODE80: M6/4
  const rows = [];
  let cum = 0;
  for (let i = 0; i < MAX_STINTS; i++) {
    const ovr = parseHMS(st.overrides[i] || "");
    const stintSec = ovr > 0 ? ovr : laps * lapSec;
    const startLeft = raceSec - cum;
    if (startLeft <= 0) break;
    cum += stintSec;
    const p = st.pits[i] || EMPTY_PIT;
    const tyreCount = p.tyres.filter(Boolean).length;
    const isLast = raceSec - cum <= 0;
    const pitSec = isLast ? 0
      : (p.fuel ? st.fuelTime : 0) + (p.lane ? st.pitLaneTime : 0) + tyreCount * tyreUnit;
    const endStint = cum + (isLast ? 0 : pitSec);
    rows.push({
      idx: i + 1,
      stintSec, pitSec, tyreCount,
      endSec: endStint,
      timeLeft: raceSec - endStint,
      lapsInStint: ovr > 0 ? Math.floor(stintSec / lapSec) : laps,
      isLast,
      fuelNeed: (ovr > 0 ? stintSec / lapSec : laps) * st.consumption,
    });
    cum = endStint;
    if (isLast) break;
  }
  const fullStints = rows.length;
  const totalLaps = fullStints * laps * st.trafficRate; // Excel C174 mantığı
  return { rows, raceSec, lapSec, laps, fullStints, totalLaps };
}

/* eski oda kayıtlarına yeni alanları güvenle ekler */
const migrate = (s) => ({ ...DEFAULT_STATE, ...s });

function lastStintFuel(countdownStr, st) {
  const lapSec = parseLap(st.avgLap);
  const cd = parseHMS(countdownStr);
  const lapsLeft = lapSec > 0 ? cd / lapSec : 0;
  const refuel = (lapsLeft + st.extraLap) * st.consumption;   // % VE
  const refuelL = refuel * st.fuelRatio;                      // gerçek litre
  return { lapsLeft, refuel, refuelL, refuelSec: refuel / st.refuelSpeed };
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
.rc header{display:flex;align-items:baseline;gap:14px;padding:16px 20px 12px;
  border-bottom:1px solid var(--line)}
.rc header h1{margin:0;font-size:26px;font-weight:700;text-transform:uppercase}
.rc header h1 b{color:var(--teal)}
.rc header .ver{color:var(--dim);font-size:12px}
.rc .grid{display:grid;grid-template-columns:300px 1fr;gap:16px;padding:16px 20px;
  align-items:start}
@media(max-width:900px){.rc .grid{grid-template-columns:1fr}}
.rc .card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px}
.rc .card h2{margin:0 0 10px;font-size:15px;text-transform:uppercase;
  font-family:'Barlow Condensed';letter-spacing:.08em;color:var(--teal)}
.rc label{display:block;color:var(--dim);font-size:11px;margin:8px 0 3px;
  text-transform:uppercase;letter-spacing:.05em}
.rc input[type=text],.rc input[type=number],.rc input[type=datetime-local]{width:100%;background:var(--panel2);
  border:1px solid var(--line);border-radius:6px;color:var(--txt);
  padding:6px 8px;font-family:'IBM Plex Mono',monospace;font-size:13px}
.rc input:focus{outline:2px solid var(--teal);outline-offset:-1px}
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
  justify-content:center;font-family:'Barlow Condensed';font-size:13px;font-weight:600;
  color:#FFE3E8}
.rc .timeline .pit{background:var(--yellow)}
.rc .hint{color:var(--dim);font-size:11px;margin-top:6px;line-height:1.5}
.rc .warn{color:var(--yellow)}
.rc .fuelbig{font-family:'Barlow Condensed';font-size:52px;font-weight:700;
  color:var(--green);line-height:1;margin:6px 0}
.rc .teambar{display:flex;flex-wrap:wrap;align-items:center;gap:8px;
  padding:10px 20px;border-bottom:1px solid var(--line);background:var(--panel)}
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
.rc header img.hlogo{height:40px;width:auto;filter:drop-shadow(0 2px 6px rgba(0,0,0,.4))}
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
.rc .langsw{display:inline-flex;gap:4px;margin-left:auto}
.rc .langsw button{padding:3px 9px;border-radius:5px;border:1px solid var(--line);
  background:var(--panel2);color:var(--dim);font-size:11px;cursor:pointer;font-weight:600}
.rc .langsw button.on{border-color:var(--teal);color:var(--teal)}
.rc .hdsel{display:inline-flex;align-items:center;gap:7px;color:var(--dim);font-size:12px}
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
.rc .tsel{width:76px;text-align:center;background:transparent!important}
.rc td.terr{background:rgba(240,96,77,.18);outline:2px solid var(--red);outline-offset:-2px}
.rc td.t2{background:rgba(242,201,76,.22)}
.rc td.tq{background:rgba(102,148,255,.25)}
.rc td.t3{background:rgba(240,96,77,.28)}
.rc td.t4{background:#05070A}
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
.rc .pitboard{position:fixed;inset:0;background:#05070A;z-index:50;
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:4vh;text-align:center;padding:4vh 4vw}
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
.rc .pbrow{display:flex;gap:6vw;flex-wrap:wrap;justify-content:center}
/* --- dashboard --- */
.rc .dgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}
`;

function Num({ v, onC, step = 0.01, w }) {
  return <input type="number" step={step} value={v} style={w ? { width: w } : {}}
    onChange={(e) => onC(parseFloat(e.target.value) || 0)} />;
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
  const [entered, setEntered] = useState(false); // lobi geçildi mi (solo/oda)
  const [pickDone, setPickDone] = useState(false); // pist/araç seçimi tamamlandı mı
  const [setupDone, setSetupDone] = useState(false); // data giriş adımı tamamlandı mı
  const [userName, setUserName] = useState("");
  const [room, setRoom] = useState("");          // aktif oda kodu
  const [joinCode, setJoinCode] = useState("");
  const [joinPin, setJoinPin] = useState("");
  const [role, setRole] = useState("editor");    // "editor" | "viewer"
  const [roomPin, setRoomPin] = useState("");    // odanın PIN'i (sadece editörler bilir)
  const [syncMsg, setSyncMsg] = useState("");
  const [lastSync, setLastSync] = useState(null); // {by, at}
  const sync = useRef({ rev: 0, applying: false, timer: null });
  const stRef = useRef(st);
  stRef.current = st;
  const pinRef = useRef("");
  pinRef.current = roomPin;

  const pushState = async (code) => {
    try {
      const rev = sync.current.rev + 1;
      const payload = {
        stateJson: JSON.stringify(stRef.current), rev, pin: pinRef.current,
        updatedBy: userName || "isimsiz",
        updatedAt: Date.now(),
      };
      await roomSet(code, payload);
      sync.current.rev = rev; setLastSync({ by: t("sen"), at: Date.now() }); setSyncMsg("");
    } catch (e) { setSyncMsg(t("Yazma hatası — tekrar denenecek")); }
  };

  const schedulePush = () => {
    if (!room || role !== "editor" || sync.current.applying) return;
    clearTimeout(sync.current.timer);
    sync.current.timer = setTimeout(() => pushState(room), 800);
  };

  // her state değişiminde (kullanıcı kaynaklı) paylaş
  useEffect(() => { schedulePush(); /* eslint-disable-next-line */ }, [st]);

  // odayı anlık dinle (Firebase onValue — polling'e gerek yok)
  useEffect(() => {
    if (!room) return;
    const off = roomSubscribe(room, (remote) => {
      if (remote.rev > sync.current.rev) {
        sync.current.applying = true;
        sync.current.rev = remote.rev;
        setSt(migrate(JSON.parse(remote.stateJson)));
        setLastSync({ by: remote.updatedBy, at: remote.updatedAt });
        setTimeout(() => { sync.current.applying = false; }, 50);
      }
    });
    return () => off();
  }, [room]);

  const createRoom = async () => {
    const code = Array.from({ length: 5 }, () =>
      "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
    const pin = String(Math.floor(1000 + Math.random() * 9000));
    sync.current.rev = 0;
    setRoomPin(pin);
    pinRef.current = pin;
    setRole("editor");
    setRoom(code);
    setSyncMsg("");
    await pushState(code);
  };

  const joinRoom = async () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) { setSyncMsg(t("Geçerli bir oda kodu gir")); return; }
    try {
      const remote = await roomGet(code);
      if (!remote) { setSyncMsg(`"${code}" ${t("odası bulunamadı — kodu kontrol et")}`); return; }
      const asEditor = joinPin.trim() !== "" && joinPin.trim() === remote.pin;
      if (joinPin.trim() !== "" && !asEditor) {
        setSyncMsg(t("PIN hatalı — izleyici olarak katılmak için PIN alanını boş bırak"));
        return;
      }
      sync.current.applying = true;
      sync.current.rev = remote.rev;
      setSt(migrate(JSON.parse(remote.stateJson)));
      setLastSync({ by: remote.updatedBy, at: remote.updatedAt });
      setTimeout(() => { sync.current.applying = false; }, 50);
      setRole(asEditor ? "editor" : "viewer");
      setRoomPin(asEditor ? remote.pin : "");
      pinRef.current = asEditor ? remote.pin : "";
      setRoom(code);
      setJoinPin("");
      setSyncMsg("");
      setSetupDone(true); // odaya katılan data girmez — mevcut oda verisi kullanılır
      setPickDone(true);  // pist/araç seçimi de odadan gelir
    } catch (e) { setSyncMsg(`"${code}" ${t("odası bulunamadı — kodu kontrol et")}`); }
  };

  const leaveRoom = () => {
    setRoom(""); setRole("editor"); setRoomPin(""); pinRef.current = "";
    setLastSync(null); setSyncMsg(""); setEntered(false); setPickDone(false); setSetupDone(false); // lobiye dön
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
    const turningOn = !s.pits[i].tyres[t];
    const pits = s.pits.map((p, j) => {
      if (j !== i) return p;
      const tyres = [...p.tyres]; tyres[t] = !tyres[t];
      return { ...p, tyres };
    });
    /* Lastik tablosu senkronu: pit i = S(i+1) sonu → lastik S(i+2)'ye takılır
       AÇIK: o köşeye yeni (kullanılmamış) numara · KAPALI: önceki stintten devam */
    let tyreStints = s.tyreStints;
    const next = i + 1; // tyreStints index'i (S(i+2) satırı)
    if (next < s.tyreStints.length) {
      const prevVal = String((s.tyreStints[i] || [])[t] || "").trim();
      const curVal = String((s.tyreStints[next] || [])[t] || "").trim();
      let val;
      if (turningOn) {
        if (curVal && curVal !== prevVal) {
          val = curVal; // kullanıcı zaten farklı bir lastik atamış — dokunma
        } else {
          const used = new Set();
          s.tyreQual.forEach((v) => { const k = String(v).trim(); if (k) used.add(k); });
          s.tyreStints.forEach((r) => r.forEach((v) => {
            const k = String(v).trim(); if (k) used.add(k); }));
          if (used.size >= s.tyreLimit) return s0; // lastik kalmadı → seçim engellenir
          let n = 1; while (used.has(String(n))) n++;
          val = String(n);
        }
      } else {
        val = prevVal; // değişim iptal → önceki stintin lastiğiyle devam
      }
      tyreStints = s.tyreStints.map((r, j) =>
        j === next ? r.map((c, ci) => (ci === t ? val : c)) : r);
    }
    return { ...s, pits, tyreStints };
  });
  const upOvr = (i, val) => setSt((s0) => {
    const s = grow(s0, i + 2);
    const overrides = [...s.overrides]; overrides[i] = val;
    return { ...s, overrides };
  });

  const mode = tab === "code80" ? "code80" : "race";
  const plan = useMemo(() => computePlan(st, mode), [st, mode]);
  const racePlan = useMemo(() => computePlan(st, "race"), [st]);
  const lsf = useMemo(() => lastStintFuel(st.lastStintCountdown, st), [st]);
  const lsf80 = useMemo(() => lastStintFuel(st.code80LastStint, st), [st]);
  const totalVE = st.consumption * plan.totalLaps + st.extraLap * st.consumption; // % VE (DATA I2)
  const totalFuelL = totalVE * st.fuelRatio;            // gerçek litre karşılığı
  const fuelCarried = 100 * st.fuelRatio;               // %100 = taşınan yakıt (L)
  const realPerLap = st.consumption * st.fuelRatio;     // gerçek tüketim L/tur
  const fuelTimeCalc = 100 / st.refuelSpeed;            // boş→dolu süresi (DATA H19)
  const TY = ["FL", "FR", "RL", "RR"];

  /* ---------- Faz 3: lastik stratejisi ---------- */
  /* stint bazlı hızlı lastik atama
     FL=0 FR=1 RL=2 RR=3 · fresh: kullanılmamış en küçük numaralar */
  const quickTyre = (rowIdx, action) => setSt((s0) => {
    const s = grow(s0, rowIdx + 2);
    const used = new Set();
    s.tyreQual.forEach((v) => { const k = String(v).trim(); if (k) used.add(k); });
    s.tyreStints.forEach((r) => r.forEach((v) => {
      const k = String(v).trim(); if (k) used.add(k); }));
    let n = 1;
    const fresh = () => { while (used.has(String(n))) n++; used.add(String(n)); return String(n); };
    const prev = rowIdx === 0 ? s.tyreQual : (s.tyreStints[rowIdx - 1] || ["", "", "", ""]);
    const FRESH_AT = {
      new4: [0, 1, 2, 3], fronts: [0, 1], rears: [2, 3],
      lefts: [0, 2], rights: [1, 3],
    }[action];
    if (FRESH_AT && used.size + FRESH_AT.length > s.tyreLimit)
      return s0; // yeterli yeni lastik yok → aksiyon engellenir
    let row;
    if (action === "clear") row = ["", "", "", ""];
    else if (action === "carry") row = [...prev];
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
        return k !== "" && k !== pv[ci];
      });
      pits = s.pits.map((p, j) => (j === rowIdx - 1 ? { ...p, tyres: flags } : p));
    }
    return { ...s, tyreStints, pits };
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
      const flag = k !== "" && k !== prevV;
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
      if (r.row === -1) qualSets.add(k);
      (posCols[k] = posCols[k] || new Set()).add(ci);
    }));
    const conflicts = Object.keys(posCols).filter((k) => posCols[k].size > 1);
    const conflictSet = new Set(conflicts);
    const cellCls = (v) => {
      const k = String(v).trim();
      if (!k) return "";
      if (conflictSet.has(k)) return "terr";
      const c = counts[k];
      if (c >= 4) return "t4";
      if (c === 3) return "t3";
      if (c === 2) return qualSets.has(k) ? "tq" : "t2";
      return "";
    };
    // sütun ci için seçilebilir mi: hiç kullanılmamış YA DA sadece bu sütunda kullanılmış
    const allowedIn = (k, ci) => !posCols[k] || (posCols[k].size === 1 && posCols[k].has(ci));
    const used = Object.keys(counts).length;
    return { rows, cellCls, used, counts, allowedIn, conflicts, available: st.tyreLimit - used };
  }, [st.tyreQual, st.tyreStints, st.tyreLimit, racePlan.rows.length]);

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
    return { ...s, driverAssign };
  });
  const clearAssign = () => setSt((s) => ({
    ...s, driverAssign: s.driverAssign.map(() => ""),
  }));

  const driverPlan = useMemo(() => {
    const startMs = Date.parse(st.raceStart);
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
  }, [st.raceStart, st.driverAssign, racePlan]);

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
  const [rawTele, setRawTele] = useState("");
  const [parsed, setParsed] = useState(null);   // {headers, lapRows, ncols} | {error}
  const [mapping, setMapping] = useState(null); // {labelCol,timeCol,fuelCol,wear:[4]}
  const fmtMs = (ms) => fmtLap(ms / 1000);

  const doParse = (text) => {
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
      return {
        label, ms,
        fuel: isNaN(fuelRaw) ? null : Math.abs(fuelRaw),
        w: w.map((x) => (isNaN(x) ? null : x)),
        use: ms != null && !/^out/i.test(label) && !refuel,
      };
    }).filter((l) => l.ms != null);
    if (!laps.length) return;
    setSt((s) => ({ ...s, telemetry: { ...s.telemetry, [slot]: { laps, name: `Stint ${slot}` } } }));
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
      out[sl] = {
        laps: used.length, totalMs: used.reduce((a, l) => a + l.ms, 0),
        avgMs, avgFuel, avgW,
        tankLaps: avgFuel ? 100 / avgFuel : null, // %100 VE ile atılabilecek tur
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
    const startMs = Date.parse(st.raceStart);
    if (isNaN(startMs) || !racePlan.rows.length) return { status: "idle" };
    const raceMs = racePlan.raceSec * 1000;
    const finishMs = startMs + raceMs;
    if (now < startMs) return { status: "pre", toStart: startMs - now, startMs, finishMs, raceMs };
    if (now >= finishMs) return { status: "done", startMs, finishMs, raceMs };
    const ap = (st.actualPits || []).filter(Number.isFinite);
    /* planlanan pit başlangıçları (saf plan, sapma hesabı için) */
    const plannedPitStart = [];
    { let c = startMs;
      for (const r of racePlan.rows) {
        c += r.stintSec * 1000; plannedPitStart.push(c); c += r.pitSec * 1000;
      } }
    /* zincir: yapılmış pitlerde GERÇEK zaman esas alınır, kalan plan oradan akar */
    let cur = startMs, phase = "stint", stintIdx = racePlan.rows.length - 1, phaseEnd = finishMs;
    for (let i = 0; i < racePlan.rows.length; i++) {
      const r = racePlan.rows[i];
      if (i < ap.length) { // bu pit gerçekleşti → gerçek giriş + plan pit süresi
        cur = ap[i] + r.pitSec * 1000;
        if (now < cur) { phase = "pit"; stintIdx = i; phaseEnd = cur; break; }
        continue;
      }
      const sEnd = cur + r.stintSec * 1000;
      if (now < sEnd) { phase = "stint"; stintIdx = i; phaseEnd = sEnd; break; }
      const pEnd = sEnd + r.pitSec * 1000;
      if (now < pEnd) { phase = "pit"; stintIdx = i; phaseEnd = pEnd; break; }
      cur = pEnd;
    }
    const lastDev = ap.length
      ? ap[ap.length - 1] - plannedPitStart[ap.length - 1] : null;
    return {
      status: "live", phase, stintIdx, phaseEnd,
      pitsDone: ap.length, plannedPitStart, lastDev,
      remaining: finishMs - now, elapsed: now - startMs,
      nextPitIn: phaseEnd - now, raceMs, startMs, finishMs,
      driver: st.driverAssign[stintIdx] || "",
      nextDriver: st.driverAssign[stintIdx + 1] || "",
    };
  }, [now, st.raceStart, st.driverAssign, st.actualPits, racePlan]);

  /* --- gerçek pit işaretleme (sadece düzenleyici) --- */
  const canEdit = !room || role === "editor";
  const markPit = () => up({ actualPits: [...(st.actualPits || []), Date.now()] });
  const unmarkPit = () => up({ actualPits: (st.actualPits || []).slice(0, -1) });
  const resetPits = () => {
    if (confirm(t("Gerçek pit işaretlemelerini sıfırla?"))) up({ actualPits: [] });
  };
  const fmtDev = (ms) => {
    const a = Math.abs(ms) / 1000, m = Math.floor(a / 60), sec = Math.floor(a % 60);
    return `${m}:${String(sec).padStart(2, "0")} ${ms >= 0 ? t("geç") : t("erken")}`;
  };
  const pitSoon = liveInfo.status === "live" && liveInfo.phase === "stint"
    && liveInfo.nextPitIn < 300000;
  /* canlı yarışta kalan süre (sn) — son stint yakıtı otomatik countdown için */
  const liveRemainSec = useMemo(() => {
    const start = new Date(st.raceStart).getTime();
    if (isNaN(start)) return null;
    const end = start + plan.raceSec * 1000;
    if (now < start || now >= end) return null;
    return Math.floor((end - now) / 1000);
  }, [st.raceStart, plan.raceSec, now]);
  const [autoCd, setAutoCd] = useState(true); // canlıdan otomatik countdown

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

  /* ---------- ortak data kartları (setup + ana arayüz sol kolon) ---------- */
  const dataCards = (<>
    <div className="card">
      <h2>{t("Yarış · Data")}</h2>
      <div className="row2">
        <div><label>Race Time (h:mm:ss)</label>
          <input type="text" value={st.raceTime} onChange={(e) => up({ raceTime: e.target.value })} /></div>
        <div><label>Avg Lap (m:ss.00)</label>
          <input type="text" value={st.avgLap} onChange={(e) => up({ avgLap: e.target.value })} /></div>
      </div>
      <label>{t("Stint Turları — A / B / C / D")}</label>
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
        <div><label>Traffic Error Rate</label>
          <Num v={st.trafficRate} onC={(v) => up({ trafficRate: v })} /></div>
        <div><label>Extra Lap</label>
          <Num v={st.extraLap} step={1} onC={(v) => up({ extraLap: v })} /></div>
      </div>
    </div>

    <div className="card" style={{ marginTop: 12 }}>
      <h2>{t("Yarış Başlangıcı")}</h2>
      <div className="row2">
        <div><label>{t("Start Tarih & Saat")}</label>
          <input type="datetime-local" value={st.raceStart}
            onChange={(e) => up({ raceStart: e.target.value })} /></div>
        <div><label>{t("Hesaplanan Bitiş")}</label>
          <div className="mono" style={{ padding: "6px 0" }}>
            {driverPlan ? fmtClock(driverPlan.finishMs, driverPlan.startMs) : "—"}</div></div>
      </div>
      <div className="hint">{t("Canlı yarış modu, pilot planı ve geri sayım bu zamana göre çalışır.")}</div>
    </div>

    <div className="card" style={{ marginTop: 12 }}>
      <h2>{t("Pit · Süreler (s)")}</h2>
      <div className="row2">
        <div><label>Pit Line</label><Num v={st.pitLaneTime} onC={(v) => up({ pitLaneTime: v })} /></div>
        <div><label>⛽ Fuel</label><Num v={st.fuelTime} onC={(v) => up({ fuelTime: v })} /></div>
      </div>
      <div className="row2">
        <div><label>{t("Tyre (adet başı)")}</label><Num v={st.tyreTime} onC={(v) => up({ tyreTime: v })} /></div>
        <div><label>{t("Hesaplanan Fuel Süresi")}</label>
          <div className="mono" style={{ padding: "6px 0" }}>{fuelTimeCalc.toFixed(1)} s</div></div>
      </div>
      <div className="row2">
        <div><label>🛞 {t("Lastik Limiti (adet)")}</label>
          <Num v={st.tyreLimit} step={1} onC={(v) => up({ tyreLimit: v })} /></div>
        <div />
      </div>
      <div className="hint">{t("Fuel süresi ipucu = %100 VE / dolum hızı")} (100% / {st.refuelSpeed} %/s). {t("CODE80'de lastik süresi otomatik ÷4 uygulanır.")}</div>
    </div>

    <div className="card" style={{ marginTop: 12 }}>
      <h2>⚡ Virtual Energy · Data</h2>
      <div className="row2">
        <div><label>⚡ {t("VE Tüketim (%/tur)")}</label><Num v={st.consumption} onC={(v) => up({ consumption: v })} /></div>
        <div><label>Fuel Ratio (L / %1)</label><Num v={st.fuelRatio} onC={(v) => up({ fuelRatio: v })} /></div>
      </div>
      <div className="row2">
        <div><label>⛽ {t("Dolum Hızı (%/s)")}</label><Num v={st.refuelSpeed} onC={(v) => up({ refuelSpeed: v })} /></div>
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
  </>);

  /* ---------- lobi: oda kur / katıl / solo ---------- */
  if (!room && !entered) {
    return (
      <div className="rc">
        <style>{css}</style>
        <div className="lobby">
          <div className="box">
            <div className="langsw" style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
              {["tr", "en"].map((l) => (
                <button key={l} className={lang === l ? "on" : ""}
                  onClick={() => switchLang(l)}>{l.toUpperCase()}</button>
              ))}
            </div>
            <img className="logo" src={`${ASSET}logo.png`} alt="Caspian Motorsport" />
            <h1><b>RACE</b> CONTROL</h1>
            <div className="sub">carmine · v0.8</div>

            {firebaseReady ? (<>
              <label>{t("Adın")}</label>
              <input type="text" placeholder={t("örn. Ahmet")} value={userName}
                onChange={(e) => setUserName(e.target.value)} />

              <button className="bigbtn" onClick={createRoom}>
                {t("🏁 Yeni Oda Kur")}
              </button>

              <div className="divider">{t("veya mevcut odaya katıl")}</div>

              <div className="row2">
                <div>
                  <label>{t("Oda Kodu")}</label>
                  <input type="text" placeholder="ABC12" value={joinCode} maxLength={6}
                    style={{ textTransform: "uppercase" }}
                    onChange={(e) => setJoinCode(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && joinRoom()} />
                </div>
                <div>
                  <label>{t("PIN (düzenleme)")}</label>
                  <input type="text" placeholder={t("boş = izleyici")} value={joinPin} maxLength={4}
                    onChange={(e) => setJoinPin(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && joinRoom()} />
                </div>
              </div>
              <button className="bigbtn ghost" onClick={joinRoom}>
                {t("Odaya Katıl")}
              </button>
              <div className="lmsg">{syncMsg}</div>
              <div className="hint" style={{ textAlign: "center" }}>
                {t("PIN'siz katılan izler, PIN'li katılan düzenler.")}
              </div>
            </>) : (
              <div className="hint" style={{ textAlign: "center", marginBottom: 8 }}>
                {t("Takım senkronizasyonu kapalı — ")}<b>src/firebase-config.js</b>{t(" dosyasını doldur.")}
              </div>
            )}

            <button className="solo" onClick={() => setEntered(true)}>
              {t("Oda kullanmadan solo devam et →")}
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
              {room ? (<>{t("Oda: ")}<b className="roomcode">{room}</b>
                {roomPin && <> · PIN: <b className="roomcode">{roomPin}</b></>}</>)
                : t("Solo mod")}
            </div>

            <div className="picksec">
              <h3>{t("1 · Pist Seç")}</h3>
              <div className="trackgrid">
                {TRACKS.map((t) => (
                  <button key={t.id} className={st.track === t.id ? "on" : ""}
                    onClick={() => up({ track: t.id })}>
                    <img src={`${ASSET}flags/${t.id}.png`} alt="" />{t.name}
                  </button>
                ))}
              </div>
            </div>

            {st.track && (
              <img key={st.track} src={`${ASSET}tracks/${st.track}.png`} alt=""
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
                    <img src={`${ASSET}cars/${cls}/${c.id}.png`} alt="" loading="lazy"
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
              {room ? (<>
                Oda: <b className="roomcode">{room}</b>
                {roomPin && <> · PIN: <b className="roomcode">{roomPin}</b></>}
                {" "}{t("— kodu takıma şimdiden gönderebilirsin")}
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
      <header>
        <img className="hlogo" src={`${ASSET}logo.png`} alt="Caspian Motorsport" />
        <h1 className="disp" style={{ fontSize: 20 }}>RACE CONTROL</h1>
        <span className="ver">carmine · v0.8</span>
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
              <img className="car" src={`${ASSET}cars/${st.carClass}/${st.car}.png`} alt=""
                onError={(e) => { e.currentTarget.style.display = "none"; }} />
              {carName(st.carClass, st.car)}</>}
          </span>
        )}
      </header>

      <div className="teambar">
        <span className={`dot ${room ? "on" : "off"}`} title={room ? "Bağlı" : t("Solo mod")} />
        {!room ? (firebaseReady ? (<>
          <input type="text" placeholder={t("ADIN")} value={userName}
            onChange={(e) => setUserName(e.target.value)} style={{ textTransform: "none" }} />
          <button className="solid" onClick={createRoom}>{t("Oda Kur")}</button>
          <input type="text" placeholder={t("ODA KODU")} value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)} maxLength={6} />
          <input type="text" placeholder={t("PIN (opsiyonel)")} value={joinPin}
            onChange={(e) => setJoinPin(e.target.value)} maxLength={4} style={{ width: 120 }} />
          <button onClick={joinRoom}>{t("Katıl")}</button>
          <span className="syncinfo">{t("PIN'siz katılan izler, PIN'li katılan düzenler.")}</span>
        </>) : (
          <span className="syncinfo" style={{ marginLeft: 0 }}>
            {t("Solo mod — takım senkronizasyonu için ")}<b>src/firebase-config.js</b>{t(" dosyasını doldur.")}
          </span>
        )) : (<>
          <span>ODA: <span className="roomcode">{room}</span></span>
          <span className="chip" style={role === "viewer"
            ? { borderColor: "var(--yellow)", color: "var(--yellow)" }
            : { borderColor: "var(--green)", color: "var(--green)" }}>
            {role === "viewer" ? "👁 İZLEYİCİ" : "✎ DÜZENLEYİCİ"}
          </span>
          {role === "editor" && roomPin &&
            <span className="syncinfo" style={{ marginLeft: 0 }}>
              {t("Düzenleme PIN'i: ")}<b className="roomcode" style={{ fontSize: 13 }}>{roomPin}</b>{t(" (sadece düzenleyecek kişilere ver)")}
            </span>}
          <button className="leave" onClick={leaveRoom}>{t("Odadan Ayrıl")}</button>
          <span className="syncinfo">
            {lastSync ? `${t("Son güncelleme: ")}${lastSync.by} · ${new Date(lastSync.at).toLocaleTimeString(lang === "en" ? "en-GB" : "tr-TR")}` : t("Senkronize")}
          </span>
        </>)}
        {syncMsg && <span style={{ color: "var(--yellow)" }}>{syncMsg}</span>}
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
            <div><span className="lbl">{liveInfo.phase === "pit" ? "Pit Çıkışı" : "Sıradaki Pit"}</span>
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
            onClick={() => setPitboard(true)}>📟 Pit Board</button>
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
              <div>
                <div className="plbl">{liveInfo.phase === "pit" ? "Pit Çıkışı" : "Sıradaki Pit"}</div>
                <div className={`mid mono ${pitSoon ? "pulse" : ""}`}
                  style={{ color: pitSoon ? "var(--yellow)" : "var(--txt)" }}>
                  {fmtHMS(liveInfo.nextPitIn / 1000)}</div>
              </div>
              <div>
                <div className="plbl">Stint</div>
                <div className="mid">{liveInfo.stintIdx + 1} / {racePlan.fullStints}</div>
              </div>
              {upcomingIsLast && (
                <div>
                  <div className="plbl">⚡ {t("Son Pit VE")}</div>
                  <div className="mid" style={{ color: "var(--green)" }}>
                    {lsf.refuel.toFixed(1)}%</div>
                </div>
              )}
            </div>
            {(liveInfo.driver || liveInfo.nextDriver) && (
              <div>
                <div className="plbl">{t("Pilot Değişimi")}</div>
                <div className="mid">
                  {liveInfo.driver || "?"} <span style={{ color: "var(--teal)" }}>→</span>{" "}
                  {liveInfo.nextDriver || "?"}
                </div>
              </div>
            )}
            {upcomingPit && !racePlan.rows[liveInfo.stintIdx]?.isLast && (
              <div className="plbl">
                {t("Sıradaki pit: ")}{upcomingPit.fuel ? "FUEL " : ""}{upcomingPit.lane ? "· LANE " : ""}
                {upcomingPit.tyres.some(Boolean) &&
                  <>· 🛞 {TY.filter((_, i) => upcomingPit.tyres[i]).join(" ")}</>}
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
                    {t("✔ PIT YAPILDI")} — S{liveInfo.pitsDone + 1}
                  </button>
                ) : (
                  <div className="plbl" style={{ color: "var(--green)" }}>
                    ✔ {t("Tüm pitler yapıldı")}</div>
                )}
                {liveInfo.lastDev != null && (
                  <div className="plbl" style={{ textTransform: "none" }}>
                    P{liveInfo.pitsDone}: {t("Plan")}{" "}
                    <span className="mono">{fmtClock(liveInfo.plannedPitStart[liveInfo.pitsDone - 1])}</span>
                    {" · "}{t("Gerçek")}{" "}
                    <span className="mono">{fmtClock(st.actualPits[liveInfo.pitsDone - 1])}</span>
                    {" → "}
                    <b style={{ color: Math.abs(liveInfo.lastDev) > 60000
                      ? "var(--yellow)" : "var(--green)" }}>
                      {fmtDev(liveInfo.lastDev)}</b>
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

      <div className={`grid ${role === "viewer" && room ? "viewonly" : ""}`}>
        {/* ================= SOL: DATA ================= */}
        <div>
          {dataCards}
        </div>

        {/* ================= SAĞ: SEKMELER ================= */}
        <div>
          <div className="tabs">
            {[["dash", "Dashboard"], ["stint", "Stint"], ["code80", "Code 80"],
              ["fuel", t("Son Stint Yakıtı")], ["tyre", t("Lastik")], ["drivers", t("Pilotlar")],
              ["tele", t("Telemetri")]].map(([k, l]) => (
              <button key={k} className={`${tab === k ? "on" : ""} ${k === "code80" && tab === k ? "c80t" : ""}`}
                onClick={() => setTab(k)}>{l}</button>
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
                  <span className="disp" style={{ fontSize: 14, letterSpacing: ".06em",
                    color: "var(--teal)" }}>{t("🛞 S1 START LASTİKLERİ")}</span>
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

              <div className="timeline" role="img" aria-label="Stint zaman çizelgesi">
                {timeline.map((s, i) => (
                  <div key={i} className={`seg ${s.cls}`}
                    style={{ width: `${s.w}%`, background: s.cls ? undefined : s.bg }}>
                    {s.label && s.w > 4 && <span>{s.label}</span>}
                  </div>
                ))}
                {liveInfo.status === "live" && mode === "race" && (
                  <div className="nowline" style={{
                    left: `${Math.min(100, (liveInfo.elapsed / liveInfo.raceMs) * 100)}%` }} />
                )}
              </div>

              <table>
                <thead><tr>
                  <th>#</th><th>Stint</th><th>{t("Tur")}</th><th>⚡ {t("VE İht.")}</th>
                  <th>{t("Pit Ayarı")}</th><th>Pit</th><th>End Stint</th><th>Time Left</th>
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
                      <td>{r.lapsInStint}</td>
                      <td className={r.fuelNeed > 100 ? "neg" : ""}
                        title={`≈ ${(r.fuelNeed * st.fuelRatio).toFixed(1)} L`}>
                        {r.fuelNeed.toFixed(1)}%</td>
                      <td>
                        {r.isLast ? <span className="chip">FINISH 🏁</span> : (<>
                          <span className="tyrebox">
                            {TY.map((corner, ti) => (
                              <button key={corner} className={(st.pits[i] || EMPTY_PIT).tyres[ti] ? "on" : ""}
                                disabled={!(st.pits[i] || EMPTY_PIT).tyres[ti] && tyreInfo.available <= 0}
                                title={!(st.pits[i] || EMPTY_PIT).tyres[ti] && tyreInfo.available <= 0
                                  ? t("⚠ Lastik limiti doldu — yeni lastik seçilemez") : undefined}
                                onClick={() => upTyre(i, ti)}>{corner}</button>
                            ))}
                          </span>
                          <span className="pitopt">
                            <button className={(st.pits[i] || EMPTY_PIT).fuel ? "on" : ""}
                              onClick={() => upPit(i, { fuel: !(st.pits[i] || EMPTY_PIT).fuel })}>FUEL</button>
                            <button className={(st.pits[i] || EMPTY_PIT).lane ? "on" : ""}
                              onClick={() => upPit(i, { lane: !(st.pits[i] || EMPTY_PIT).lane })}>LANE</button>
                          </span>
                        </>)}
                      </td>
                      <td>{r.isLast ? "—" : fmtHMS(r.pitSec)}</td>
                      <td>{fmtHMS(r.endSec)}</td>
                      <td className={r.timeLeft < 0 ? "neg" : "pos"}>{fmtHMS(r.timeLeft)}</td>
                      <td><input className="ovr" type="text" placeholder="h:mm:ss"
                        value={st.overrides[i] || ""} onChange={(e) => upOvr(i, e.target.value)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="hint">
                {t("Pit süresi = FUEL")}({st.fuelTime}s) + LANE({st.pitLaneTime}s) {t("lastik ×")}
                {tab === "code80" ? ` ${(st.tyreTime / 4).toFixed(2)}s (Code 80: ÷4)` : ` ${st.tyreTime}s`}.
                {t("Son stintte pit hesaplanmaz. Override girilirse stint süresi manuel değere kilitlenir.")}{" "}
                {t("Pit'te seçilen lastikler (FL/FR/RL/RR) Lastik sekmesindeki tabloya otomatik işlenir:")}{" "}
                {t("seçilen köşeye sonraki stint için yeni lastik atanır, seçim kaldırılırsa önceki lastikle devam edilir.")}
              </div>
            </div>
          )}

          {tab === "dash" && (
            <div className="dgrid">
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
                <h2>{t("📋 Stint Programı")}</h2>
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
                <h2>{t("🛞 Lastik")}</h2>
                <div className="kpis" style={{ gridTemplateColumns: "1fr 1fr" }}>
                  <div className="kpi"><div className="v">{tyreInfo.used}/{st.tyreLimit}</div>
                    <div className="l">{t("Kullanılan Lastik")}</div></div>
                  <div className="kpi"><div className="v"
                    style={{ color: tyreInfo.available < 0 ? "var(--red)" : "var(--green)" }}>
                    {tyreInfo.available}</div><div className="l">{t("Kalan Lastik")}</div></div>
                </div>
                {liveInfo.status === "live" && st.tyreStints[liveInfo.stintIdx + 1] && (
                  <div className="hint">{t("Sıradaki stint lastikleri:")}{" "}
                    <b className="mono">
                      {st.tyreStints[liveInfo.stintIdx + 1].map((v) => v || "–").join(" / ")}
                    </b></div>
                )}
                {tyreInfo.conflicts.length > 0 &&
                  <div className="hint" style={{ color: "var(--red)" }}>
                    {t("⚠ Köşe ihlali: lastik")} {tyreInfo.conflicts.join(", ")}</div>}
              </div>

              <div className="card">
                <h2>⚡ {t("Son Stint VE")}</h2>
                <div className="fuelbig" style={{ fontSize: 40 }}>{lsf.refuel.toFixed(1)}%</div>
                <div className="hint">
                  ≈ {lsf.refuelL.toFixed(1)} L · {lsf.lapsLeft.toFixed(2)} {t("tur + extra")} {st.extraLap} · {t("dolum ≈")} {lsf.refuelSec.toFixed(0)}s
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
          )}

          {tab === "tyre" && (
            <div className="card">
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
              <table>
                <thead><tr><th>Stint</th><th>FL</th><th>FR</th><th>RL</th><th>RR</th><th>{t("Hızlı Atama")}</th></tr></thead>
                <tbody>
                  {tyreInfo.rows.map((r) => (
                    <tr key={r.label}>
                      <td className="disp" style={{ fontSize: 14 }}>{r.label}</td>
                      {r.vals.map((v, ci) => (
                        <td key={ci} className={tyreInfo.cellCls(v)}>
                          <select className="tsel" value={String(v)}
                            onChange={(e) => upTyreCell(r.row, ci, e.target.value)}>
                            <option value="">—</option>
                            {Array.from({ length: Math.max(0, st.tyreLimit) }, (_, n) => {
                              const k = String(n + 1);
                              const cur = String(v).trim() === k;
                              if (!cur && !tyreInfo.allowedIn(k, ci)) return null; // köşe kilidi
                              const c = tyreInfo.counts[k] || 0;
                              const cls = tyreInfo.cellCls(k);
                              const OPT = {
                                t2:   { bg: "#8A6E1A", fg: "#FFE9A8", dot: "🟡" },
                                tq:   { bg: "#2B4A8F", fg: "#CFE0FF", dot: "🔵" },
                                t3:   { bg: "#7A2A20", fg: "#FFC9C0", dot: "🔴" },
                                t4:   { bg: "#000000", fg: "#F0604D", dot: "⚫" },
                                terr: { bg: "#7A2A20", fg: "#FFC9C0", dot: "⚠️" },
                              }[cls];
                              return <option key={k} value={k}
                                style={OPT ? { background: OPT.bg, color: OPT.fg } : {}}>
                                {OPT ? `${OPT.dot} ` : ""}{k}{c > 0 ? ` · ${c}x` : ""}
                              </option>;
                            })}
                          </select>
                        </td>
                      ))}
                      <td>
                        {r.row >= 0 && (
                          <select className="tsel" style={{ width: 118, textAlign: "left" }}
                            value="" onChange={(e) => {
                              if (e.target.value) quickTyre(r.row, e.target.value);
                            }}>
                            <option value="">{t("— hızlı —")}</option>
                            <option value="new4" disabled={tyreInfo.available < 4}>{t("🆕 4 Yeni")}</option>
                            <option value="carry">{t("⟳ Öncekiyle Devam")}</option>
                            <option value="fronts" disabled={tyreInfo.available < 2}>{t("Önler Yeni")}</option>
                            <option value="rears" disabled={tyreInfo.available < 2}>{t("Arkalar Yeni")}</option>
                            <option value="lefts" disabled={tyreInfo.available < 2}>{t("Sollar Yeni")}</option>
                            <option value="rights" disabled={tyreInfo.available < 2}>{t("Sağlar Yeni")}</option>
                            <option value="clear">{t("✕ Temizle")}</option>
                          </select>
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
                  <input type="datetime-local" value={st.raceStart}
                    onChange={(e) => up({ raceStart: e.target.value })} />
                </div>
                <div>
                  <label>{t("Yarış Bitişi")}</label>
                  <div className="mono" style={{ padding: "6px 0" }}>
                    {driverPlan ? fmtClock(driverPlan.finishMs, driverPlan.startMs) : "—"}
                  </div>
                </div>
              </div>

              <label>{t("Pilot Kadrosu")}</label>
              <div style={{ marginBottom: 4 }}>
                {st.roster.map((n) => (
                  <span className="rchip" key={n}>{n}
                    <b onClick={() => removeDriver(n)} title={t("Kadrodan çıkar")}>×</b></span>
                ))}
                {st.roster.length === 0 &&
                  <span className="hint">{t("Henüz pilot yok — aşağıdan ekle.")}</span>}
              </div>
              <div style={{ display: "flex", gap: 8, maxWidth: 340, marginBottom: 14 }}>
                <input type="text" placeholder={t("Pilot adı")} value={newDriver}
                  onChange={(e) => setNewDriver(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addDriver()} />
                <button className="act" onClick={addDriver}>{t("Ekle")}</button>
              </div>

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
                            {st.roster.map((n) => <option key={n} value={n}>{n}</option>)}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {Object.keys(driverPlan.totals).length > 0 && (
                  <table style={{ marginTop: 16, maxWidth: 480 }}>
                    <thead><tr><th>{t("Pilot")}</th><th>Stint</th><th>{t("Toplam Süre")}</th><th>%</th></tr></thead>
                    <tbody>
                      {st.roster.filter((n) => driverPlan.totals[n]).map((n) => {
                        const t = driverPlan.totals[n];
                        return (
                          <tr key={n}>
                            <td>{n}</td><td>{t.stints}</td>
                            <td>{fmtHMS(t.ms / 1000)}</td>
                            <td className="pos">
                              {driverPlan.grandMs ? ((t.ms / driverPlan.grandMs) * 100).toFixed(1) : "0"}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
                <div style={{ marginTop: 12 }}>
                  <button className="act danger" onClick={clearAssign}>{t("Atamaları Temizle")}</button>
                </div>
                <div className="hint">{t("Start/Finish zamanları stint planından otomatik zincirlenir (pit süreleri dahil). Yarış bitişini aşan kısım süreye sayılmaz; tamamen yarış dışı kalan stintler soluk görünür.")}</div>
              </>)}
              {!driverPlan && <div className="hint warn">{t("Geçerli bir yarış başlangıç zamanı gir.")}</div>}
            </div>
          )}

          {tab === "tele" && (
            <div>
              <div className="card">
                <h2>{t("Telemetri İçe Aktar (MoTeC)")}</h2>
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
                {parsed && !parsed.error && mapping && (<>
                  <div className="hint">
                    {parsed.lapRows.length} {t("tur satırı bulundu. Sütun eşleşmesini kontrol et:")}
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "6px 0" }}>
                    {[["Tur Süresi", "timeCol"], ["VE Δ (%)", "fuelCol"]].map(([lbl, key]) => (
                      <div key={key}>
                        <label style={{ margin: 0 }}>{lbl}</label>
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
                            {fmtMs(s.avgMs)}</div>
                          <div className="l">Stint {sl} {t("ort. tur")} · {s.laps} {t("Tur")}</div>
                          <div className="hint" style={{ marginTop: 4 }}>
                            {s.avgFuel != null && <>⚡ {s.avgFuel.toFixed(2)} %/tur VE
                              {s.tankLaps && <> · %100 ≈ {Math.floor(s.tankLaps)} tur</>}<br /></>}
                            {s.avgW.some((w) => w != null) &&
                              <>🛞 {s.avgW.map((w) => w == null ? "–" : w.toFixed(1)).join(" / ")} {t("%/tur")}</>}
                          </div>
                          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                            <button className="act" style={{ fontSize: 11 }}
                              onClick={() => up({
                                avgLap: fmtMs(s.avgMs),
                                ...(s.avgFuel != null
                                  ? { consumption: +s.avgFuel.toFixed(2) } : {}),
                              })}>{t("DATA'ya uygula")}</button>
                            <button className="act danger" style={{ fontSize: 11 }}
                              onClick={() => removeSlot(sl)}>{t("Sil")}</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

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

                  {loadedSlots.length > 1 && baseSlot && slotStats[baseSlot] && !slotStats[baseSlot].empty && (
                    <table style={{ maxWidth: 460, marginTop: 10 }}>
                      <thead><tr><th>{t("Karşılaştırma")}</th><th>{t("Ort. Fark")}</th><th>{t("Hızlı Olan")}</th></tr></thead>
                      <tbody>
                        {loadedSlots.slice(1).map((sl) => {
                          const a = slotStats[baseSlot], b = slotStats[sl];
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
            <div className="row2" style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr" }}>
              {[
                [t("YARIŞ SONU"), st.lastStintCountdown, (v) => up({ lastStintCountdown: v }), lsf],
                [t("CODE 80 SONU"), st.code80LastStint, (v) => up({ code80LastStint: v }), lsf80],
              ].map(([title, val, setVal, r]) => {
                const isAuto = autoCd && liveRemainSec != null;
                const eff = isAuto ? fmtHMS(liveRemainSec) : val;
                const rr = isAuto ? lastStintFuel(eff, st) : r;
                return ([title, eff, setVal, rr]);
              }).map(([title, val, setVal, r]) => (
                <div className={`card ${title.includes("CODE 80") ? "c80" : ""}`} key={title}>
                  <h2>⛽ {t("Son Stint Yakıtı")} · {title}</h2>
                  <label>{t("Session Countdown (h:mm:ss)")}{" "}
                    {liveRemainSec != null && (
                      <button className={autoCd ? "chip" : ""}
                        style={{ marginLeft: 6, padding: "2px 8px", borderRadius: 6, fontSize: 10,
                          border: "1px solid var(--line)", cursor: "pointer",
                          background: autoCd ? "var(--car)" : "var(--panel2)",
                          color: autoCd ? "#FFE9ED" : "var(--dim)" }}
                        title={t("Canlıdan otomatik — yarış saatinden hesaplanıyor")}
                        onClick={() => setAutoCd(!autoCd)}>{t("🔴 CANLI")}</button>
                    )}
                  </label>
                  <input type="text" value={val} readOnly={autoCd && liveRemainSec != null}
                    style={autoCd && liveRemainSec != null ? { opacity: .7 } : undefined}
                    onChange={(e) => setVal(e.target.value)} />
                  <div className="kpis" style={{ marginTop: 12 }}>
                    <div className="kpi"><div className="v mono">{r.lapsLeft.toFixed(2)}</div>
                      <div className="l">{t("Kalan Tur")}</div></div>
                    <div className="kpi"><div className="v mono">{r.refuelSec.toFixed(0)}s</div>
                      <div className="l">{t("Dolum Süresi")}</div></div>
                  </div>
                  <div className="fuelbig">{r.refuel.toFixed(1)}%</div>
                  <div className="hint">
                    ≈ <b className="mono" style={{ color: "var(--green)" }}>{r.refuelL.toFixed(1)} L</b> {t("gerçek yakıt")} ·
                    ({t("kalan tur")} {r.lapsLeft.toFixed(2)} + extra {st.extraLap}) × {st.consumption} {t("%/tur")}
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
