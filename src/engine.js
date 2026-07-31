/* ============================================================
   STRATEJİ MOTORU — saf hesap mantığı (React/Firebase bağımsız)
   Le Mans Ultimate endurance stint/yakıt/hava planlaması.
   App.jsx buradan içe aktarır; birim testleri (engine.test.js)
   doğrudan bu modülü test eder.
   ============================================================ */

/* ---------- zaman & tur ayrıştırma / biçimleme ---------- */
export const parseHMS = (s) => {
  if (!s) return 0;
  const p = String(s).trim().split(":").map((x) => parseFloat(x.replace(",", ".")) || 0);
  if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
  if (p.length === 2) return p[0] * 60 + p[1];
  return p[0] || 0;
};
export const parseLap = (s) => {
  // "3:59.50" veya "3:59,50" → saniye
  if (!s) return 0;
  const t = String(s).trim().replace(",", ".");
  const p = t.split(":");
  if (p.length === 2) return (parseFloat(p[0]) || 0) * 60 + (parseFloat(p[1]) || 0);
  return parseFloat(t) || 0;
};
export const fmtHMS = (sec) => {
  const neg = sec < 0;
  let s = Math.abs(Math.round(sec));
  const h = Math.floor(s / 3600); s -= h * 3600;
  const m = Math.floor(s / 60); s -= m * 60;
  return `${neg ? "-" : ""}${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};
export const msToLocalInput = (ms) => {
  // epoch → izleyicinin yerel saatinde datetime-local metni (YYYY-MM-DDTHH:MM)
  if (!ms || isNaN(ms)) return "";
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
export const fmtLap = (sec) => {
  /* Tek noktada yuvarla (santisaniye) → saniye 60'a taşarsa dakikaya geçer
     ("1:60.00" hatası yok); işaret ayrı ele alınır (negatif delta doğru gösterilir). */
  const neg = sec < 0;
  const cs = Math.round(Math.abs(sec) * 100);   // toplam santisaniye
  const m = Math.floor(cs / 6000);
  const s = (cs - m * 6000) / 100;               // 0..59.99 — taşma olmaz
  return `${neg ? "-" : ""}${m}:${s.toFixed(2).padStart(5, "0")}`;
};

/* ---------- varsayılan durum (Excel'deki mevcut değerler) ---------- */
export const DEFAULT_STATE = {
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

/* ---------- pit & lastik sabitleri ---------- */
export const EMPTY_PIT = { fuel: true, lane: true, tyres: [0, 0, 0, 0] };
export const TYRE_2_SEC = 5;  // 1-2 lastik değişim süresi (LMU, sabit)
export const TYRE_4_SEC = 12; // 3-4 lastik değişim süresi (LMU, sabit)
export const MAX_STINTS = 64; // güvenlik tavanı (24h+ yarışlar için yeterli)

/* ---------- hava modeli ---------- */
export const WEATHER = {
  dry:   { lbl: "Dry",          ico: "☀️", lap: 1.00, fuel: 1.00, col: "#F5C84C" },
  damp:  { lbl: "Damp",         ico: "🌦", lap: 1.07, fuel: 1.00, col: "#8FD0E8" },
  slwet: { lbl: "Slightly Wet", ico: "🌧", lap: 1.09, fuel: 0.96, col: "#4D9FFF" },
  wet:   { lbl: "Wet",          ico: "⛈", lap: 1.13, fuel: 0.92, col: "#7B8FF7" },
};
export const wxLog = (st) => (st.weatherLog || []).slice().sort((a, b) => a.t - b.t);
export const wxAtRel = (log, rel) => {  // rel saniyedeki hava (kronolojik log)
  let cur = WEATHER.dry;
  for (const e of log) { if (e.t <= rel + 1e-6) cur = WEATHER[e.w] || cur; else break; }
  return cur;
};
export const WX = (st) => {  // en güncel (mevcut/gelecek) hava — UI ve son stint için
  const log = wxLog(st);
  return log.length ? (WEATHER[log[log.length - 1].w] || WEATHER.dry) : WEATHER.dry;
};
export const effLapSec = (st) => parseLap(st.avgLap) * WX(st).lap;
export const effCons = (st) => st.consumption * WX(st).fuel;

/* lastik köşe durumu: 0 taşı · 1 yeni kuru (sarı) · 2 Qual'a dön (mavi) · 3 wet (yeşil)
   · 4 eski kuru tekrar (siyah). Eski odalarda boolean olabilir → tyState normalize eder. */
export const tyState = (v) => (v === true ? 1 : v === false ? 0 : Number(v) || 0);

export function computePlan(st, mode /* "race" | "code80" */) {
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
export const migrate = (s) => {
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

export function lastStintFuel(countdownStr, st, flagExtra = 0) {
  const lapSec = effLapSec(st);
  const cd = parseHMS(countdownStr) + flagExtra; // lider bayrağına kadar geçen ek süre
  const lapsRaw = lapSec > 0 ? cd / lapSec : 0;
  const lapsLeft = Math.ceil(lapsRaw - 1e-6);  // ondalık tur yukarı yuvarlanır (trafik riski payı)
  const refuel = (lapsLeft + st.extraLap) * effCons(st);   // % VE
  const refuelL = refuel * st.fuelRatio;                      // gerçek litre
  return { lapsLeft, lapsRaw, refuel, refuelL };
}
