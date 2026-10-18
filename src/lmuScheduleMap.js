/* ============================================================
   lmuScheduleMap — lmuportal.com resmi LMU yarış takvimi → /lmuSchedule yapısı
   ------------------------------------------------------------
   SAF ve BAĞIMSIZ: dış bağımlılık yok (lmuParse.js/lmuLaptimes.js deseni), böylece
   hem GitHub Action scraper'ı (scripts/scrape-lmu-schedule.mjs) hem vitest testi
   aynı fonksiyonu kullanır. Web uygulaması bu dosyayı İÇE AKTARMAZ — takvim verisi
   RTDB'den (/lmuSchedule) okunur; burası yalnız scraper/test tarafıdır.

   NEDEN lmuportal (eski lmugarage HTML kazımasının yerine): lmugarage çalışmadığı
   için resmi yarışlar çekilemiyordu (sayfa boş, yaklaşan yarış yok). lmuportal'ın
   herkese açık Supabase API'si yapısal JSON verir — daily/special/championship
   seansları, pist, sınıf, SR, süreler, lastik. Çıktı ŞEKLİ aynı tutuldu →
   frontend (ScheduleTab, lmuSchedule.js, useLmuSchedule) değişmeden çalışır.

   §1 (veri dürüstlüğü): tarihi/pisti çözülemeyen kayıt LİSTEYE GİRMEZ (uydurma yok,
   lmuParse.js ile aynı ilke). Hava verisi (sky kodları) güvenilir ikon eşlemesi
   olmadığından TAŞINMAZ.
   ============================================================ */

/* Pist etiketi → Caspian TRACKS id'si (lmuParse.js/lmuLaptimes.js ile aynı liste;
   bağımsız kalsın diye kopya). İlk eşleşen kazanır; eşleşmezse "" + trackRaw korunur. */
const TRACK_KEYWORDS = [
  [/sarthe|le\s*mans|lemans/, "lemans"],
  [/paul\s*ricard|ricard/, "paulricard"],
  [/spa/, "spa"],
  [/monza/, "monza"],
  [/imola/, "imola"],
  [/silverstone/, "silverstone"],
  [/portimao|portimão|algarve/, "portimao"],
  [/barcelona|catalunya/, "barcelona"],
  [/bahrain|sakhir/, "bahrain"],
  [/lusail|losail|qatar/, "lusail"],
  [/fuji/, "fuji"],
  [/cota|americas|austin/, "cota"],
  [/sebring/, "sebring"],
  [/interlagos|paulo|sao\s*paulo/, "interlagos"],
  [/daytona/, "daytona"],
  [/laguna/, "lagunaseca"],
  [/watkins/, "watkinsglen"],
  [/atlanta/, "roadatlanta"],
  [/long\s*beach/, "longbeach"],
  [/indianapolis|indy/, "indianapolis"],
];

export function normLabel(s) {
  return String(s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function mapTrackId(rawLabel) {
  const n = normLabel(rawLabel);
  if (!n) return "";
  for (const [re, id] of TRACK_KEYWORDS) if (re.test(n)) return id;
  return "";
}

/* lmuportal sınıf etiketi → uygulama sınıf id'si (ScheduleTab clsCol ve CAR_CLASSES
   ile uyumlu). Bilinmeyen → "" (atılır, uydurma sınıf gösterilmez). */
const CLASS_MAP = {
  hyper: "hypercar", hypercar: "hypercar", lmh: "hypercar",
  gt3: "gt3", lmgt3: "gt3",
  gte: "gte",
  lmp2: "lmp2", lmp2_elms: "lmp2",
  lmp3: "lmp3",
};

export function mapClassId(rawClass) {
  const n = normLabel(rawClass).replace(/\s+/g, "_");
  return CLASS_MAP[n] || "";
}

export function mapClasses(arr) {
  const out = [];
  for (const c of (arr || [])) {
    const id = mapClassId(c);
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}

/* Dakika → kısa etiket ("4h" / "40m" / "1h30m"). 0/geçersiz → "". */
export function lenLabel(minutes) {
  const m = Math.round(Number(minutes));
  if (!Number.isFinite(m) || m <= 0) return "";
  const h = Math.floor(m / 60), r = m % 60;
  if (h <= 0) return `${m}m`;
  return r ? `${h}h${r}m` : `${h}h`;
}

/* Şampiyona round adı → pist etiketi. "Round 2: Interlagos" → "Interlagos".
   İki nokta yoksa tüm metin döner. */
export function trackFromRound(roundName) {
  const s = String(roundName || "");
  const i = s.indexOf(":");
  return (i >= 0 ? s.slice(i + 1) : s).trim();
}

/* setup değeri → fixedSetup bool|null ("Fixed"→true, "Open"→false, bilinmez→null). */
function fixedOf(setup) {
  const n = normLabel(setup);
  if (n === "fixed") return true;
  if (n === "open") return false;
  return null;
}

/* Ortak yapıcı: tek normalize edilmiş girdiden /lmuSchedule yarış nesnesi.
   Zorunlu: id, kind, name, startIso, trackRaw. startIso çözülemezse → null (atılır). */
function makeRace(x) {
  const startMs = Date.parse(x.startIso);
  if (!x.id || !Number.isFinite(startMs)) return null;   // tarihsiz/id'siz → atla (§1)
  const raceSec = x.raceMin > 0 ? Math.round(x.raceMin * 60) : null;
  const qualSec = x.qualMin > 0 ? Math.round(x.qualMin * 60) : null;
  const practiceSec = x.practiceMin > 0 ? Math.round(x.practiceMin * 60) : null;
  const tyreSets = x.tyreSets > 0 ? x.tyreSets : null;
  const fixed = fixedOf(x.setup);
  const weekend = {};
  if (practiceSec != null) weekend.practiceSec = practiceSec;
  if (qualSec != null) weekend.qualSec = qualSec;
  if (raceSec != null) weekend.raceSec = raceSec;
  if (tyreSets != null) weekend.tyreSets = tyreSets;
  if (fixed != null) weekend.fixedSetup = fixed;
  if (x.fuel > 0) weekend.fuel = x.fuel;
  return {
    id: String(x.id),
    kind: normLabel(x.kind) || "daily",
    name: String(x.name || "").trim(),
    startIso: x.startIso,
    startMs,
    live: false,                               // durum client-side (startMs+lenSec vs now)
    sr: x.srReq || "",
    srRank: x.srReq || "",
    trackId: mapTrackId(x.trackRaw),
    trackRaw: String(x.trackRaw || "").trim(),
    classes: mapClasses(x.classesRaw),
    lenSec: raceSec,
    lenLabel: lenLabel(x.raceMin),
    qualSec,                                   // officialRaceToForm bunu okur
    tyreSets,                                  // officialRaceToForm bunu okur (st.tyreLimit)
    ...(Object.keys(weekend).length ? { weekend } : {}),
    url: x.url || "",
  };
}

const BASE = "https://lmuportal.com";
const TYPE_PAGE = { daily: "/upcoming", weekly: "/weekly", special: "/special", championship: "/championships" };

/* race_event satırı (race_series join'li) → yarış nesnesi | null. */
export function raceFromEvent(ev) {
  const s = ev?.race_series || {};
  const kind = normLabel(s.type) || "daily";
  return makeRace({
    id: ev.event_id,
    kind,
    name: ev.series_name || s.series_name || "",
    startIso: ev.race_starts_at,
    trackRaw: s.track_friendly,
    classesRaw: s.car_classes,
    srReq: s.sr_requirement,
    raceMin: s.race_duration_minutes,
    qualMin: s.qualifying_duration_minutes,
    practiceMin: s.practice_duration_minutes,
    tyreSets: s.tyre_allowance,
    setup: s.setup,
    fuel: s.fuel_multiplier,
    url: BASE + (TYPE_PAGE[kind] || "/upcoming"),
  });
}

/* championship_event satırı (championship_series join'li) → yarış nesnesi | null.
   Pist round_name'den gelir (seri tablosunda pist yok — sezon çok pistli). */
export function raceFromChampEvent(ev) {
  const s = ev?.championship_series || {};
  return makeRace({
    id: ev.event_id,
    kind: "championship",
    name: s.series_name || ev.round_name || "",
    startIso: ev.race_starts_at,
    trackRaw: trackFromRound(ev.round_name),
    classesRaw: s.car_classes,
    srReq: s.sr_requirement,
    raceMin: s.race_duration_minutes,
    qualMin: s.qualifying_duration_minutes,
    practiceMin: s.practice_duration_minutes,
    tyreSets: s.tyres_available,
    setup: s.setup,
    fuel: s.fuel_multiplier,
    url: BASE + TYPE_PAGE.championship,
  });
}

/* race_event + championship_event satır dizilerinden /lmuSchedule races[] kurar.
   null (çözülemeyen) elenir; id ile dedupe (ilk kazanır); startMs'e göre sıralı. */
export function buildSchedule({ events = [], champEvents = [] } = {}) {
  const races = [];
  const seen = new Set();
  const add = (r) => { if (r && !seen.has(r.id)) { seen.add(r.id); races.push(r); } };
  for (const ev of events) add(raceFromEvent(ev));
  for (const ev of champEvents) add(raceFromChampEvent(ev));
  races.sort((a, b) => a.startMs - b.startMs);
  return races;
}
