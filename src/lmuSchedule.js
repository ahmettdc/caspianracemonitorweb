/* ============================================================
   lmuSchedule — Resmi Yarışlar için SAF türetme mantığı (status, filtre, sıralama)
   ------------------------------------------------------------
   ScheduleTab bu helper'ları useMemo ile kullanır; hepsi saf ve test edilebilir.
   Yalnızca /lmuSchedule veri modelinde GERÇEKTEN bulunan alanları kullanır:
     { id, kind, name, startMs, live, sr, srRank, trackId, trackRaw, classes[], lenSec, ... }
   season/round/championship-adı YOK → uydurulmaz. "Seri" = kind. Status hesaplanır.
   ============================================================ */

/* lmenüde bulunmayan süre için varsayılan (canlı penceresi tahmini). */
const DEFAULT_LEN_MS = 30 * 60 * 1000;

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
