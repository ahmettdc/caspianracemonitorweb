/* ============================================================
   ScheduleTab — Resmi yarışlar (lmugarage.com resmi LMU takvimi)
   ------------------------------------------------------------
   handoff-spec/ekranlar/14-resmi-yarislar.md — markup ve stil değerleri birebir;
   inline stil objeleri (koşullu renk/kenarlık) fişten alınır, renkler --rc-*
   tokenlarına bağlanır. Yeni veri katmanı YOK; tüm türetme SAF (src/lmuSchedule.js)
   ve useMemo'lu; raw races source-of-truth, filtreler ayrı state → derived list.
   Özet (next-race kartı + 3 sayaç) → tek araç çubuğu (arama + seri çipleri + 3 select)
   → güne göre bordürlü liste. Asset/helper: TRACK_ASSET/ASSET/AV; eksikse graceful.
   Render: src/ScheduleStandalone.jsx (Ana Menü → Resmi Yarışlar, bağımsız).
   ============================================================ */
import { useState, useEffect, useMemo } from "react";
import { TRACKS, TRACK_ASSET, ASSET, AV } from "../constants";
import { extHref } from "../tauriEnv";
import {
  groupByStatus, nextOfficialRace, deriveOptions, raceStatus,
  EMPTY_FILTERS, groupByDay,
} from "../lmuSchedule";

const trackName = (id) => (id && TRACKS.find((tk) => tk.id === id)?.name) || "";
const KIND_TR = { daily: "Günlük", weekly: "Haftalık", special: "Özel", championship: "Şampiyona" };

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

/* Geri sayımı sayı(büyük) + birim(küçük, soluk) parçalarına böl — fiş: sıradaki kart. */
function cdUnits(str) {
  const s = String(str);
  if (!/\d/.test(s)) return s;
  return s.split(/(\d+)/).filter(Boolean).map((p, i) => (/^\d+$/.test(p) ? p
    : <span key={i} style={{ fontSize: ".5em", color: "var(--rc-text-2)" }}>{p}</span>));
}

const disp = "var(--rc-font-display)";
const hideImg = (e) => { e.currentTarget.style.display = "none"; };

/* Küçük yuvarlak rozet (kind / sınıf çipi) — fişteki r.kind çipiyle aynı biçim. */
const pill = (color) => ({ fontSize: 10, textTransform: "uppercase", letterSpacing: ".08em",
  padding: "2px 8px", borderRadius: 99, border: "1px solid var(--rc-border)", color });

/* Tek yarış satırı — fiş: time → flag(26px) → track(52×32) → ad/meta → SR → cd → aksiyon.
   rowStyle/timeStyle/cdStyle koşulları (canlı/tamamlanan) fişte tanımlı değil;
   fişteki statik stil deseninden + FuelTab/DashTab konvansiyonundan yeniden kuruldu. */
function RaceRow({ r, t, lang, now, onPlan, isLast }) {
  const status = raceStatus(r, now);
  const live = status === "live";
  const tName = trackName(r.trackId) || r.trackRaw || "—";
  const cd = status === "upcoming" ? countdown(r.startMs, now, t) : relDay(r.startMs, now, t);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px",
      borderBottom: isLast ? "none" : "1px solid var(--rc-line-soft)",
      background: live ? "rgba(150,0,24,.14)" : "transparent" }}>
      <span style={{ fontFamily: disp, fontSize: 15, fontWeight: 700, minWidth: 44, flex: "0 0 auto",
        fontVariantNumeric: "tabular-nums",
        color: live ? "var(--rc-ok)" : status === "completed" ? "var(--rc-text-3)" : "var(--rc-text)" }}>
        {fmtClock(r.startMs, lang)}</span>

      {r.trackId && (
        <img src={`${ASSET}flags/${TRACK_ASSET(r.trackId)}.png${AV}`} alt="" onError={hideImg}
          style={{ width: 26, borderRadius: 3, border: "1px solid var(--rc-border)", flex: "0 0 auto" }} />
      )}
      {r.trackId && (
        <img src={`${ASSET}tracks/${TRACK_ASSET(r.trackId)}.png${AV}`} alt="" onError={hideImg}
          style={{ width: 52, height: 32, objectFit: "contain", opacity: .75, flex: "0 0 auto" }} />
      )}

      <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0, flex: 1 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <b style={{ fontFamily: disp, fontWeight: 700, fontSize: 17, whiteSpace: "nowrap",
            overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</b>
          {live && (
            <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".09em",
              padding: "2px 8px", borderRadius: 99, border: "1px solid var(--rc-ok)",
              color: "var(--rc-ok)", whiteSpace: "nowrap", flex: "0 0 auto" }}>● {t("Canlı")}</span>
          )}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={pill("var(--rc-text-3)")}>{t(KIND_TR[r.kind] || r.kind)}</span>
          {(r.classes || []).map((c) => (
            <span key={c} style={pill("var(--rc-text-2)")}>{c}</span>
          ))}
          <span style={{ fontSize: 11.5, color: "var(--rc-text-3)" }}>{tName}</span>
        </span>
      </span>

      {r.sr && (
        <span style={{ fontFamily: disp, fontSize: 12, fontWeight: 700, padding: "3px 9px",
          borderRadius: 99, border: "1px solid var(--rc-border)", color: "var(--rc-text-2)",
          whiteSpace: "nowrap", flex: "0 0 auto" }}>SR {r.sr}</span>
      )}

      <span style={{ fontFamily: disp, fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums",
        color: status === "upcoming" ? "var(--rc-warn)" : "var(--rc-text-3)",
        textAlign: "right", minWidth: 58, flex: "0 0 auto" }}>{cd}</span>

      <span style={{ display: "flex", gap: 6, flex: "0 0 auto" }}>
        {r.url && (
          <a {...extHref(r.url)} title={t("lmugarage'da aç")}
            style={{ padding: "7px 12px", borderRadius: 9, border: "1px solid var(--rc-border)",
              background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer",
              fontSize: 12, textDecoration: "none", lineHeight: 1 }}>↗</a>
        )}
        {onPlan && (
          <button onClick={() => onPlan(r)}
            style={{ padding: "7px 12px", borderRadius: 9, border: "1px solid var(--rc-brand-bright)",
              background: "var(--rc-brand)", color: "var(--rc-on-brand)", cursor: "pointer",
              fontSize: 12, whiteSpace: "nowrap" }}>📋 {t("Planla")}</button>
        )}
      </span>
    </div>
  );
}

/* Gün bölümü — başlık (relatif gün · N yarış + hairline) + bordürlü satır listesi.
   data-testid/data-cnt: görünmez test kancaları (kaynak fişte yok; class üretmemek
   için data-attr olarak eklendi — stili etkilemez). */
function DaySection({ dayMs, races, t, lang, now, onPlan }) {
  if (!races.length) return null;
  const dayLbl = relDay(dayMs, now, t);
  const exact = new Date(dayMs).toLocaleDateString(lang === "en" ? "en-GB" : "tr-TR",
    { day: "numeric", month: "long", weekday: "short" });
  return (
    <div style={{ marginTop: 18 }}>
      <div data-testid="sch-day"
        style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <span style={{ fontFamily: disp, textTransform: "uppercase", letterSpacing: ".05em",
          fontSize: 14, fontWeight: 700, color: "var(--rc-text)" }}>{dayLbl}</span>
        <span style={{ fontSize: 11.5, color: "var(--rc-text-3)" }}>
          {exact} · <span data-cnt="sch-cnt">{races.length}</span> {t("yarış")}</span>
        <span style={{ flex: 1, height: 1, background: "var(--rc-line-soft)" }} />
      </div>
      <div style={{ border: "1px solid var(--rc-border)", borderRadius: 12,
        background: "var(--rc-surface)", overflow: "hidden" }}>
        {races.map((r, i) => (
          <RaceRow key={r.id} r={r} t={t} lang={lang} now={now} onPlan={onPlan}
            isLast={i === races.length - 1} />
        ))}
      </div>
    </div>
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

  const opts = useMemo(() => deriveOptions(races, trackName), [races]);
  const grouped = useMemo(
    () => groupByStatus(races, filters, now, trackName), [races, filters, now]);
  /* Liste güne göre; grouped ise yalnız üstteki özet sayaçlarını (canlı) besliyor. */
  const daily = useMemo(
    () => groupByDay(races, filters, now, trackName), [races, filters, now]);
  const next = useMemo(() => nextOfficialRace(races, now), [races, now]);
  const upcomingTotal = useMemo(
    () => races.filter((r) => raceStatus(r, now) === "upcoming").length, [races, now]);
  const empty = grouped.matchedCount === 0;

  /* --- yeniden kullanılan stil objeleri (fiş: 14-resmi-yarislar.md) --- */
  const statTile = (border) => ({ flex: 1, background: "var(--rc-surface-2)",
    border: `1px solid ${border || "var(--rc-border)"}`, borderRadius: 12,
    padding: 14, textAlign: "center" });
  const statNum = { fontFamily: disp, fontWeight: 700, fontSize: 26, lineHeight: 1 };
  const statLbl = { color: "var(--rc-text-3)", fontSize: 10, textTransform: "uppercase",
    letterSpacing: ".09em", marginTop: 2 };
  const selStyle = { background: "var(--rc-surface-3)", border: "1px solid var(--rc-border)",
    borderRadius: 9, color: "var(--rc-text)", padding: "8px 10px", fontSize: 12 };
  /* Seri çipi (fişteki k.style yeri) — aktif/pasif renk mantığı fişte tanımlı değil;
     FuelTab toggle desenine göre yeniden kuruldu. */
  const chipStyle = (on) => ({ padding: "7px 12px", borderRadius: 9, fontSize: 12, cursor: "pointer",
    border: `1px solid ${on ? "var(--rc-brand-bright)" : "var(--rc-border)"}`,
    background: on ? "var(--rc-brand)" : "var(--rc-surface-3)",
    color: on ? "var(--rc-on-brand)" : "var(--rc-text-3)" });

  return (
    <div data-tour="scheduletab" style={{ padding: "18px 20px 40px", animation: "rcin .26s ease-out" }}>
      {/* --- başlık --- */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontFamily: disp, textTransform: "uppercase", letterSpacing: ".06em",
          fontSize: 22, fontWeight: 700 }}>{t("Resmi yarışlar")}</h2>
        <span style={{ color: "var(--rc-text-3)", fontSize: 12 }}>
          {updatedAt ? <>{t("Güncellendi")} {fmtClock(updatedAt, lang)} · </> : null}
          {t("kaynak")}{" "}
          <a {...extHref("https://lmugarage.com")}
            style={{ color: "var(--rc-brand-bright)" }}>lmugarage.com</a>
        </span>
      </div>

      {/* --- özet: sıradaki yarış kartı + 3 sayaç --- */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
        {next && (
          <div style={{ flex: "1 1 380px", minWidth: 0, border: "1px solid var(--rc-brand-deep)",
            borderRadius: 14,
            background: "radial-gradient(120% 160% at 100% 0,rgba(150,0,24,.26),var(--rc-surface-2) 62%)",
            padding: "16px 18px", display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0, flex: 1 }}>
              <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".14em",
                color: "var(--rc-brand-bright)", fontWeight: 600 }}>{t("Sıradaki resmi yarış")}</span>
              <span style={{ fontFamily: disp, fontWeight: 700, fontSize: 26, lineHeight: 1.05 }}>
                {next.name}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12,
                color: "var(--rc-text-2)" }}>
                {next.trackId && (
                  <img src={`${ASSET}flags/${TRACK_ASSET(next.trackId)}.png${AV}`} alt="" onError={hideImg}
                    style={{ width: 20, borderRadius: 2 }} />
                )}
                {trackName(next.trackId) || next.trackRaw || "—"}
                {next.lenLabel ? ` · ${next.lenLabel}` : ""}
                {next.sr ? ` · SR ${next.sr}` : ""}
              </span>
            </div>
            <div style={{ textAlign: "right", flex: "0 0 auto" }}>
              <div style={{ fontFamily: disp, fontWeight: 700, fontSize: 38, lineHeight: 1,
                color: "var(--rc-warn)", fontVariantNumeric: "tabular-nums" }}>
                {cdUnits(countdown(next.startMs, now, t))}</div>
              <div style={{ fontSize: 11, color: "var(--rc-text-3)", fontFamily: disp }}>
                {fmtClock(next.startMs, lang)} · {relDay(next.startMs, now, t)}</div>
            </div>
          </div>
        )}
        <div style={{ flex: "0 1 300px", display: "flex", gap: 10 }}>
          <div style={statTile()}>
            <div style={statNum}>{races.length}</div>
            <div style={statLbl}>{t("Toplam")}</div>
          </div>
          <div style={statTile()}>
            <div style={statNum}>{upcomingTotal}</div>
            <div style={statLbl}>{t("Yaklaşan")}</div>
          </div>
          <div style={statTile("rgba(55,214,122,.4)")}>
            <div style={{ ...statNum, color: "var(--rc-ok)" }}>{grouped.live.length}</div>
            <div style={statLbl}>{t("Canlı")}</div>
          </div>
        </div>
      </div>

      {/* --- araç çubuğu: arama + seri çipleri + sınıf/pist/SR select --- */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
        <input type="search" value={filters.q} onChange={(e) => setF("q", e.target.value)}
          placeholder={t("Yarış, pist veya seri ara…")}
          style={{ background: "var(--rc-surface-3)", border: "1px solid var(--rc-border)",
            borderRadius: 9, color: "var(--rc-text)", fontSize: 13, padding: "9px 13px", width: 260 }} />
        <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button onClick={() => setF("series", "all")}
            style={chipStyle(filters.series === "all")}>{t("Tümü")}</button>
          {opts.series.map((k) => (
            <button key={k} onClick={() => setF("series", k)}
              style={chipStyle(filters.series === k)}>{t(KIND_TR[k] || k)}</button>
          ))}
        </span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select value={filters.cls} onChange={(e) => setF("cls", e.target.value)} style={selStyle}>
            <option value="all">{t("Tüm sınıflar")}</option>
            {opts.classes.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filters.track} onChange={(e) => setF("track", e.target.value)} style={selStyle}>
            <option value="all">{t("Tüm pistler")}</option>
            {opts.tracks.map((tk) => <option key={tk.value} value={tk.value}>{tk.label}</option>)}
          </select>
          <select value={filters.sr} onChange={(e) => setF("sr", e.target.value)} style={selStyle}>
            <option value="all">{t("SR: hepsi")}</option>
            {opts.srRanks.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </span>
      </div>

      {/* --- içerik: güne göre bordürlü liste + boş/yükleniyor halleri --- */}
      {loading && (
        <div style={{ padding: "12px 0", color: "var(--rc-text-3)", fontSize: 13 }}>
          {t("Takvim yükleniyor…")}</div>
      )}
      {!loading && races.length === 0 && (
        <div style={{ padding: "12px 0", color: "var(--rc-text-3)", fontSize: 13 }}>
          {t("Takvim henüz yüklenmedi — birkaç dakika içinde güncellenir.")}</div>
      )}
      {!loading && races.length > 0 && empty && (
        <div style={{ padding: "24px 0", textAlign: "center", color: "var(--rc-text-3)", fontSize: 13 }}>
          {t("Filtrelere uyan yarış yok.")}</div>
      )}
      {!loading && !empty && daily.map((d) => (
        <DaySection key={d.dayKey} dayMs={d.dayMs} races={d.races}
          t={t} lang={lang} now={now} onPlan={onPlan} />
      ))}
    </div>
  );
}
