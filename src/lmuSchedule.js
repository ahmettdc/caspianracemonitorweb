/* ============================================================
   lmuSchedule — Resmi Yarışlar için SAF türetme mantığı (status, filtre, sıralama)
   ------------------------------------------------------------
   ScheduleTab bu helper'ları useMemo ile kullanır; hepsi saf ve test edilebilir.
   Yalnızca /lmuSchedule veri modelinde GERÇEKTEN bulunan alanları kullanır:
     { id, kind, name, startMs, live, sr, srRank, trackId, trackRaw, classes[], lenSec,
       qualSec?, tyreSets?, weekend?{practiceSec,qualSec,raceSec,grid,privateQuali,
       fixedSetup,tyreSets,tlPoints,fuel,tyreWear,warmers}, ... }
   weekend = "Race weekend" paneli (scraper detay sayfasından); yalnız var olan alanlar.
   season/round/championship-adı YOK → uydurulmaz. "Seri" = kind. Status hesaplanır.
   ============================================================ */

/* lmenüde bulunmayan süre için varsayılan (canlı penceresi tahmini). */
const DEFAULT_LEN_MS = 30 * 60 * 1000;

/* Saniye → "H:MM:SS" (DEFAULT_STATE.raceTime stiliyle; parseHMS toleranslı okur). */
const hmsOf = (sec) => {
  let s = Math.max(0, Math.round(sec || 0));
  const h = Math.floor(s / 3600); s -= h * 3600;
  const m = Math.floor(s / 60); s -= m * 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

/* Seans sonrası formasyon/grid gap (dk) — LMU'da resmi listelenen saat SEANS
   (sıralama) başıdır; gerçek yarış (yeşil bayrak) sıralama + bu kadar sonra başlar. */
export const OFFICIAL_FORMATION_MIN = 5;
/* Sıralama süresi bilinmediğinde (detay çekilememişse) son çare tahmini (dk).
   Normalde r.qualSec detay sayfasından gelir → gerçek değer kullanılır. */
export const OFFICIAL_QUAL_DEFAULT_MIN = 15;

/* Resmi yarış kaydını "Yarış Ekle" formuna (rForm) çevir — SAF, ÖN AYAR.
   Kaynak (lmugarage) yalnız pist/başlangıç/süre/sınıf-listesi taşır → belirli ARAÇ
   YOK: carId boş bırakılır (kullanıcı formda seçer). Çok sınıflı etkinlikte (ör.
   Hypercar+LMGT3) ilk EŞLEŞEN sınıf ön-seçilir (kullanıcı değiştirebilir). Süre yalnız
   günlük/haftalık kayıtlarda var (special/championship → null) → fallbackRaceTime.
   trackId eşleşmediyse boş kalır → kullanıcı formdaki pist listesinden seçer.

   ÖNEMLİ — YARIŞ BAŞI: resmi saat (startMs) SEANS başıdır; gerçek yarış başı =
   seans + sıralama süresi + formasyon (5 dk). Sıralama süresi artık takvim verisinden
   gelir (r.qualSec — scraper detay sayfasından "Race weekend" panelini çeker); yoksa
   son çare tahmine (OFFICIAL_QUAL_DEFAULT_MIN) düşülür. Değer form üzerinden gösterilir
   ve düzeltilebilir (RaceEditModal). Ör. seans 14:00, sıralama 8 dk → yarış başı 14:13.
   Çağıran `qualMin` verirse (test/elle) o önceliklidir. */
export function officialRaceToForm(r, { seasonId = null, fallbackRaceTime = "2:24:00",
  classId, qualMin = null, formationMin = OFFICIAL_FORMATION_MIN } = {}) {
  const norm = typeof classId === "function" ? classId : (x) => x;
  const cls = (r?.classes || []).map(norm).find(Boolean) || "hypercar";
  const sessionStartMs = r?.startMs || Date.now();
  const qFromData = r?.qualSec > 0 ? Math.round(r.qualSec / 60) : null;   // takvim detayı
  const qPick = qualMin != null ? qualMin : (qFromData != null ? qFromData : OFFICIAL_QUAL_DEFAULT_MIN);
  const q = Math.max(0, Number(qPick) || 0);
  return {
    rid: null,
    seasonId: seasonId || null,
    round: "",
    name: r?.name || "",
    trackId: r?.trackId || "",
    carClass: cls,
    carId: "",
    raceTime: r?.lenSec > 0 ? hmsOf(r.lenSec) : fallbackRaceTime,
    sessionStartMs,                                          // resmi seans (sıralama) başı
    qualMin: q,                                             // kullanıcı düzeltebilir
    startsAt: sessionStartMs + (q + formationMin) * 60000,  // gerçek yarış başı (yeşil bayrak)
    tyreSets: r?.tyreSets > 0 ? r.tyreSets : null,          // lastik seti sınırı → st.tyreLimit
  };
}

/* Yarış durumu — mevcut saat (now, ms) ile başlangıç+süreye göre HESAPLANIR.
   "upcoming" | "live" | "completed". startMs yoksa güvenli varsayılan: upcoming. */
export function raceStatus(r, now) {
  const start = r?.startMs;
  if (!start) return "upcoming";
  if (now < start) return "upcoming";
  const end = start + (r.lenSec ? r.lenSec * 1000 : DEFAULT_LEN_MS);
  if (now <= end) return "live";
  /* Süre bilinmiyorsa ve scraper anlık "live" dediyse, pencere içinde canlı say. */
  if (!r.lenSec && r.live && now <= start + DEFAULT_LEN_MS) return "live";
  return "completed";
}

/* Aranabilir serbest metin — ada, pist, seri, sınıf, SR üzerinde eşleşir. */
export function raceHaystack(r, trackName) {
  return [
    r.name, r.kind, r.trackRaw, trackName ? trackName(r.trackId) : r.trackId,
    (r.classes || []).join(" "), r.sr, r.srRank,
  ].filter(Boolean).join(" ").toLowerCase();
}

/* Tek yarış için filtre yüklemi (AND mantığı). filters alanları "all"/"" ise geçer.
   trackName: (id)=>ad — arama için opsiyonel. */
export function matchesFilters(r, filters, now, trackName) {
  const f = filters || {};
  if (f.series && f.series !== "all" && r.kind !== f.series) return false;
  if (f.status && f.status !== "all" && raceStatus(r, now) !== f.status) return false;
  if (f.cls && f.cls !== "all" && !(r.classes || []).includes(f.cls)) return false;
  if (f.track && f.track !== "all" && (r.trackId || r.trackRaw) !== f.track) return false;
  if (f.sr && f.sr !== "all" && r.srRank !== f.sr) return false;
  const q = (f.q || "").trim().toLowerCase();
  if (q && !raceHaystack(r, trackName).includes(q)) return false;
  return true;
}

/* Kronolojik sıralama. dir "asc" (yaklaşan) | "desc" (geçmiş). Aynı anda birden çok
   yarış varsa DETERMİNİSTİK ikincil sıralama id ile (round değil — round alanı yok). */
export function sortByStart(list, dir = "asc") {
  const s = dir === "desc" ? -1 : 1;
  return [...list].sort((a, b) => {
    const da = (a.startMs || 0) - (b.startMs || 0);
    if (da) return s * da;
    return String(a.id).localeCompare(String(b.id));
  });
}

/* Filtrelenmiş listeyi status'a göre gruplar (her grup kendi içinde kronolojik). */
export function groupByStatus(races, filters, now, trackName) {
  const matched = (races || []).filter((r) => matchesFilters(r, filters, now, trackName));
  const live = sortByStart(matched.filter((r) => raceStatus(r, now) === "live"), "asc");
  const upcoming = sortByStart(matched.filter((r) => raceStatus(r, now) === "upcoming"), "asc");
  const completed = sortByStart(matched.filter((r) => raceStatus(r, now) === "completed"), "desc");
  return { live, upcoming, completed, matchedCount: matched.length };
}

/* Sıradaki resmi yarış — en yakın gelecekteki (upcoming) yarış. Yoksa null. */
export function nextOfficialRace(races, now) {
  return sortByStart(
    (races || []).filter((r) => raceStatus(r, now) === "upcoming"), "asc")[0] || null;
}

/* Filtre seçenekleri — YALNIZ veride bulunan değerlerden türetilir (uydurma yok). */
export function deriveOptions(races, trackName) {
  const list = races || [];
  const series = [...new Set(list.map((r) => r.kind).filter(Boolean))];
  const classes = [...new Set(list.flatMap((r) => r.classes || []))];
  const srRanks = [...new Set(list.map((r) => r.srRank).filter(Boolean))];
  const trackMap = new Map();
  for (const r of list) {
    const key = r.trackId || r.trackRaw;
    if (key && !trackMap.has(key)) {
      trackMap.set(key, (trackName && trackName(r.trackId)) || r.trackRaw || key);
    }
  }
  const tracks = [...trackMap.entries()].map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
  return { series, classes, srRanks, tracks };
}

export const EMPTY_FILTERS = { series: "all", status: "all", cls: "all", track: "all", sr: "all", q: "" };

export const filtersActive = (f) =>
  !!f && (f.series !== "all" || f.status !== "all" || f.cls !== "all"
    || f.track !== "all" || f.sr !== "all" || (f.q || "").trim() !== "");
