/* ============================================================
   ScheduleTab — Resmi Yarış Merkezi (lmugarage.com resmi LMU takvimi)
   ------------------------------------------------------------
   Basit liste DEĞİL: özet + arama + seri/status/sınıf/pist/SR filtreleri +
   kronolojik LIVE/UPCOMING/COMPLETED bölümleri + bilgi yoğun kartlar.
   Tüm türetme SAF (src/lmuSchedule.js) ve useMemo'lu; raw races source-of-truth,
   filtreler ayrı state → derived list. Yalnız veri modelinde bulunan alanlar kullanılır.
   Asset/helper: TRACK_FLAG/TRACK_ASSET/TRACKS (mevcut sistem); eksikse graceful fallback.
   Kaynak: lmugarage.com (resmi olmayan topluluk projesi) — atıf altta.
   ============================================================ */
import { useState, useEffect, useMemo } from "react";
import { TRACKS, TRACK_ASSET, ASSET, AV } from "../constants";
import { extHref } from "../tauriEnv";
import {
  groupByStatus, nextOfficialRace, deriveOptions, raceStatus,
  filtersActive, EMPTY_FILTERS,
} from "../lmuSchedule";

const trackName = (id) => (id && TRACKS.find((tk) => tk.id === id)?.name) || "";
const KIND_TR = { daily: "Günlük", weekly: "Haftalık", special: "Özel", championship: "Şampiyona" };
const STATUS_TR = { live: "Canlı", upcoming: "Yaklaşan", completed: "Tamamlandı" };

const DAY = 86400000;
const startOfDay = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };

/* Relative tarih etiketi ("Bugün"/"Yarın"/"3 gün") — yanında kesin tarih ayrıca gösterilir. */
function relDay(ms, now, t) {
  const diff = Math.round((startOfDay(ms) - startOfDay(now)) / DAY);
  if (diff === 0) return t("Bugün");
  if (diff === 1) return t("Yarın");
  if (diff === -1) return t("Dün");
  if (diff > 1) return `${diff} ${t("gün")}`;
  return `${Math.abs(diff)} ${t("gün önce")}`;
}
function countdown(ms, now, t) {
  const s = Math.floor((ms - now) / 1000);
  if (s <= 0) return t("başlıyor");
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), d = Math.floor(h / 24);
  if (d >= 1) return `${d}${t("g")} ${h % 24}h`;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
const fmtClock = (ms, lang) => new Date(ms)
  .toLocaleTimeString(lang === "en" ? "en-GB" : "tr-TR", { hour: "2-digit", minute: "2-digit" });
const fmtDate = (ms, lang) => new Date(ms)
  .toLocaleDateString(lang === "en" ? "en-GB" : "tr-TR", { weekday: "short", day: "2-digit", month: "short" });

function RaceCard({ r, now, t, lang, onPlan }) {
  const status = raceStatus(r, now);
  const tName = trackName(r.trackId) || r.trackRaw || "—";
  return (
    <div className="sch-card" data-status={status}>
      <div className="sch-when">
        <span className="sch-badge" data-status={status}>
          {status === "live" && <span className="sch-dot" aria-hidden="true" />}
          {t(STATUS_TR[status])}
        </span>
        <span className="sch-time">{fmtClock(r.startMs, lang)}</span>
        <span className="sch-date">{fmtDate(r.startMs, lang)}</span>
        <span className="sch-rel">
          {status === "upcoming" ? `⏳ ${countdown(r.startMs, now, t)}` : relDay(r.startMs, now, t)}
        </span>
      </div>

      <div className="sch-thumb" aria-hidden="true">
        {r.trackId
          ? <img src={`${ASSET}tracks/${TRACK_ASSET(r.trackId)}.png${AV}`} alt=""
              onError={(e) => { e.currentTarget.style.display = "none"; }} />
          : null}
      </div>

      <div className="sch-main">
        <div className="sch-title">{r.name}</div>
        <div className="sch-sub">
          <span className="sch-kind">{t(KIND_TR[r.kind] || r.kind)}</span>
          {(r.classes || []).map((c) => (
            <span key={c} className="sch-cls" data-class={c}>{c}</span>
          ))}
        </div>
        <div className="sch-venue">
          {r.trackId
            ? <img className="sch-flag" src={`${ASSET}flags/${TRACK_ASSET(r.trackId)}.png${AV}`}
                alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} />
            : <span aria-hidden="true">📍 </span>}
          {tName}
          {r.lenLabel ? <span className="sch-len">· ⏱ {r.lenLabel}</span> : null}
        </div>
      </div>

      <div className="sch-side">
        {r.sr && (
          <span className="sch-sr" data-rank={r.srRank} title={t("Güvenlik derecesi şartı")}>
            SR {r.sr}
          </span>
        )}
        <div className="sch-actions">
          {r.url && (
            <a className="sch-open" {...extHref(r.url)}
              title={t("lmugarage'da aç")}>↗</a>
          )}
          {onPlan && (
            <button className="sch-open" onClick={() => onPlan(r)} title={t("Bu yarışa planla")}>📋</button>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ id, icon, label, races, now, t, lang, onPlan }) {
  if (!races.length) return null;
  return (
    <>
      <h3 className="sch-sec" data-sec={id}>{icon} {t(label)} <span className="sch-cnt">{races.length}</span></h3>
      <div className="sch-list">
        {races.map((r) => <RaceCard key={r.id} r={r} now={now} t={t} lang={lang} onPlan={onPlan} />)}
      </div>
    </>
  );
}

export default function ScheduleTab({ t, lang = "tr", races = [], updatedAt, loading, onPlan }) {
  const [now, setNow] = useState(() => Date.now());
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);
  const setF = (k, v) => setFilters((f) => ({ ...f, [k]: v }));
  const clear = () => setFilters(EMPTY_FILTERS);

  const opts = useMemo(() => deriveOptions(races, trackName), [races]);
  const grouped = useMemo(
    () => groupByStatus(races, filters, now, trackName), [races, filters, now]);
  const next = useMemo(() => nextOfficialRace(races, now), [races, now]);

  const active = filtersActive(filters);
  const upcomingTotal = useMemo(
    () => races.filter((r) => raceStatus(r, now) === "upcoming").length, [races, now]);
  const showSec = (s) => filters.status === "all" || filters.status === s;
  const empty = grouped.matchedCount === 0;

  return (
    <div className="card sch" data-tour="scheduletab">
      <div className="sch-head">
        <h2>🏁 {t("Resmi Yarış Takvimi")}</h2>
        {updatedAt && (
          <span className="hint sch-upd">
            {t("Güncellendi")}: {fmtClock(updatedAt, lang)}
          </span>
        )}
      </div>

      {/* özet — mevcut verilerden hesaplanır (hardcoded değil) */}
      <div className="sch-summary">
        <div className="sch-stat"><span className="n">{races.length}</span><span className="l">{t("Toplam")}</span></div>
        <div className="sch-stat"><span className="n">{upcomingTotal}</span><span className="l">{t("Yaklaşan")}</span></div>
        <div className="sch-stat"><span className="n">{grouped.live.length}</span><span className="l">{t("Canlı")}</span></div>
        {next && (
          <div className="sch-next">
            <span className="l">🏁 {t("Sıradaki Resmi Yarış")}</span>
            <span className="nm">{next.name}</span>
            <span className="mt">
              {next.trackId && <img className="sch-flag" src={`${ASSET}flags/${TRACK_ASSET(next.trackId)}.png${AV}`}
                alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} />}
              {trackName(next.trackId) || next.trackRaw} · {fmtDate(next.startMs, lang)} {fmtClock(next.startMs, lang)}
              {" · "}⏳ {countdown(next.startMs, now, t)}
            </span>
          </div>
        )}
      </div>

      {/* araç çubuğu — arama + filtreler (dar ekranda ikinci satıra sarar) */}
      <div className="sch-tools">
        <input className="sch-search" type="search" value={filters.q}
          onChange={(e) => setF("q", e.target.value)}
          placeholder={t("Yarış, pist veya seri ara…")} />
        {active && (
          <button className="sch-clear" onClick={clear}>✕ {t("Filtreleri Temizle")}</button>
        )}
      </div>

      {/* seri (kind) — birincil eksen: çipler */}
      {opts.series.length > 1 && (
        <div className="mmchips sch-series">
          <button className={`mmchip ${filters.series === "all" ? "on" : ""}`}
            onClick={() => setF("series", "all")}>{t("Tümü")}</button>
          {opts.series.map((k) => (
            <button key={k} className={`mmchip ${filters.series === k ? "on" : ""}`}
              onClick={() => setF("series", k)}>{t(KIND_TR[k] || k)}</button>
          ))}
        </div>
      )}

      {/* ikincil filtreler: dropdown'lar */}
      <div className="sch-selrow">
        <label className="sch-sel">{t("Durum")}
          <select value={filters.status} onChange={(e) => setF("status", e.target.value)}>
            <option value="all">{t("Tümü")}</option>
            {["live", "upcoming", "completed"].map((s) => (
              <option key={s} value={s}>{t(STATUS_TR[s])}</option>
            ))}
          </select>
        </label>
        {opts.classes.length > 0 && (
          <label className="sch-sel">{t("Sınıf")}
            <select value={filters.cls} onChange={(e) => setF("cls", e.target.value)}>
              <option value="all">{t("Tümü")}</option>
              {opts.classes.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        )}
        {opts.tracks.length > 0 && (
          <label className="sch-sel">{t("Pist")}
            <select value={filters.track} onChange={(e) => setF("track", e.target.value)}>
              <option value="all">{t("Tümü")}</option>
              {opts.tracks.map((tk) => <option key={tk.value} value={tk.value}>{tk.label}</option>)}
            </select>
          </label>
        )}
        {opts.srRanks.length > 0 && (
          <label className="sch-sel">SR
            <select value={filters.sr} onChange={(e) => setF("sr", e.target.value)}>
              <option value="all">{t("Tümü")}</option>
              {opts.srRanks.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        )}
      </div>

      {/* içerik */}
      {loading && <div className="hint" style={{ padding: "12px 0" }}>{t("Takvim yükleniyor…")}</div>}
      {!loading && races.length === 0 && (
        <div className="hint" style={{ padding: "12px 0" }}>
          {t("Takvim henüz yüklenmedi — birkaç dakika içinde güncellenir.")}</div>
      )}
      {!loading && races.length > 0 && empty && (
        <div className="sch-empty">
          <div className="sch-empty-i">🔍</div>
          <div>{t("Filtrelere uyan yarış yok.")}</div>
          {active && <button className="sch-clear" onClick={clear}>✕ {t("Filtreleri Temizle")}</button>}
        </div>
      )}

      {!loading && !empty && (<>
        {showSec("live") && <Section id="live" icon="🔴" label="Şu An Canlı" races={grouped.live} now={now} t={t} lang={lang} onPlan={onPlan} />}
        {showSec("upcoming") && <Section id="upcoming" icon="⏳" label="Yaklaşan" races={grouped.upcoming} now={now} t={t} lang={lang} onPlan={onPlan} />}
        {showSec("completed") && <Section id="completed" icon="🏁" label="Tamamlanan" races={grouped.completed} now={now} t={t} lang={lang} onPlan={onPlan} />}
      </>)}

      <div className="hint sch-src">
        {t("Kaynak")}:{" "}
        <a {...extHref("https://lmugarage.com")}>lmugarage.com</a>{" "}
        — {t("resmi olmayan topluluk projesi.")}
      </div>
    </div>
  );
}
