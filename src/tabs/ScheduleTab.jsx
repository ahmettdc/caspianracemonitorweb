/* ============================================================
   ScheduleTab — Resmi Yarışlar (v2.0 · handoff-spec/ekranlar/14-resmi-yarislar.md)
   ------------------------------------------------------------
   Hero (sıradaki resmi yarış) + özet + arama/seri/sınıf/pist/SR filtreleri +
   GÜN gruplu ajanda satırları. Türetme SAF (src/lmuSchedule.js) + useMemo.
   Renkler var(--rc-*). Kaynak: lmugarage.com (resmi olmayan topluluk projesi).
   ============================================================ */
import { useState, useEffect, useMemo } from "react";
import { TRACKS, TRACK_ASSET, ASSET, AV } from "../constants";
import { extHref } from "../tauriEnv";
import { Icon } from "../components";
import {
  groupByStatus, nextOfficialRace, deriveOptions, raceStatus, EMPTY_FILTERS,
} from "../lmuSchedule";

const trackName = (id) => (id && TRACKS.find((tk) => tk.id === id)?.name) || "";
const KIND_TR = { daily: "Günlük", weekly: "Haftalık", special: "Özel", championship: "Şampiyona" };
const CLS_COL = { hypercar: "var(--rc-cls-hypercar)", gt3: "var(--rc-cls-gt3)", lmp2: "var(--rc-cls-lmp2)", lmp3: "var(--rc-cls-lmp3)", gte: "var(--rc-cls-gte)" };
const clsCol = (c) => CLS_COL[String(c).toLowerCase()] || "var(--rc-text-3)";

const DAY = 86400000;
const startOfDay = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
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
  if (d >= 1) return `${d}${t("g")} ${h % 24}${t("s")}`;
  return h > 0 ? `${h}${t("s")} ${m}${t("dk")}` : `${m}${t("dk")}`;
}
const fmtClock = (ms, lang) => new Date(ms)
  .toLocaleTimeString(lang === "en" ? "en-GB" : "tr-TR", { hour: "2-digit", minute: "2-digit" });
const fmtDate = (ms, lang) => new Date(ms)
  .toLocaleDateString(lang === "en" ? "en-GB" : "tr-TR", { day: "2-digit", month: "long" });

/* Saniye → kısa süre ("4m"→"4dk", "3600"→"1s"). 0/negatif → null. */
const durMin = (sec, t = (x) => x) => {
  const m = Math.round((sec || 0) / 60);
  if (m <= 0) return null;
  return m >= 60 ? `${Math.floor(m / 60)}${t("s")}${m % 60 ? ` ${m % 60}${t("dk")}` : ""}` : `${m}${t("dk")}`;
};
const WX_ICON = { sun: "☀️", cloud: "☁️", rain: "🌧️", storm: "⛈️", fog: "🌫️" };
const wxIcon = (c) => WX_ICON[c] || "•";
/* "Race weekend" paneli → { sessions:[{label,dur,wx[]}], stats:[[etiket,değer]] }.
   r.weekend (scraper) yoksa düz alanlara (qualSec/tyreSets) düşer → veri zenginleşene
   dek en azından onlar görünür. Yalnız var olan alanlar döner. */
function weekendData(r, t) {
  const wk = r.weekend || {};
  const wx = wk.weather || {};
  const W = {
    practiceSec: wk.practiceSec,
    qualSec: wk.qualSec ?? r.qualSec,
    raceSec: wk.raceSec,
    grid: wk.grid, privateQuali: wk.privateQuali, fixedSetup: wk.fixedSetup,
    tyreSets: wk.tyreSets ?? r.tyreSets,
    tlPoints: wk.tlPoints, fuel: wk.fuel, tyreWear: wk.tyreWear, warmers: wk.warmers,
  };
  const sessions = [];
  const addS = (sec, label, key) => { const d = durMin(sec, t); if (d) sessions.push({ label, dur: d, wx: wx[key] || [] }); };
  addS(W.practiceSec, t("Antr."), "practice");
  addS(W.qualSec, t("Sıralama"), "qualifying");
  addS(W.raceSec, t("Yarış"), "race");
  const yn = (b) => (b ? t("Evet") : t("Hayır"));
  /* Kategorize (handoff · Resmi Yarışlar): FORMAT (grid/özel sıralama/sabit setup) ve
     KURALLAR (lastik seti/TL puanı/yakıt/aşınma/ısıtıcı) ayrı sütunlar. */
  const format = [];
  if (W.grid != null) format.push([t("Grid"), String(W.grid)]);
  if (W.privateQuali != null) format.push([t("Özel sıralama"), yn(W.privateQuali)]);
  if (W.fixedSetup != null) format.push([t("Sabit setup"), yn(W.fixedSetup)]);
  const rules = [];
  if (W.tyreSets != null) rules.push([t("Lastik seti"), String(W.tyreSets)]);
  if (W.tlPoints != null) rules.push([t("TL puanı"), String(W.tlPoints)]);
  if (W.fuel != null) rules.push([t("Yakıt"), `×${W.fuel}`]);
  if (W.tyreWear != null) rules.push([t("Aşınma"), `×${W.tyreWear}`]);
  if (W.warmers != null) rules.push([t("Isıtıcı"), W.warmers ? t("Var") : t("Yok")]);
  const statGroups = [];
  if (format.length) statGroups.push({ title: t("Format"), items: format });
  if (rules.length) statGroups.push({ title: t("Kurallar"), items: rules });
  return { sessions, statGroups };
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
  // seri/sınıf/pist/SR/arama süz (durumdan bağımsız), sonra GÜN grupla
  const grouped = useMemo(
    () => groupByStatus(races, { ...filters, status: "all" }, now, trackName), [races, filters, now]);
  const next = useMemo(() => nextOfficialRace(races, now), [races, now]);
  const upcomingTotal = useMemo(
    () => races.filter((r) => raceStatus(r, now) === "upcoming").length, [races, now]);

  const days = useMemo(() => {
    // canlı yarışları başlangıç-günü eşiğinden muaf tut (gece yarısını geçen endurance
    // yarışı düne ait olsa da bugünün grubuna girer) → 'Canlı: N' ile ajanda tutarlı.
    const flat = [...grouped.live, ...grouped.upcoming]
      .filter((r) => raceStatus(r, now) === "live" || startOfDay(r.startMs) >= startOfDay(now));
    const byDay = {};
    for (const r of flat) { const k = Math.max(startOfDay(r.startMs), raceStatus(r, now) === "live" ? startOfDay(now) : 0); (byDay[k] ||= []).push(r); }
    return Object.keys(byDay).map(Number).sort((a, b) => a - b).map((k) => ({
      key: k, day: relDay(k, now, t).toLocaleUpperCase(lang === "en" ? "en" : "tr"),
      date: fmtDate(k, lang), races: byDay[k].sort((a, b) => a.startMs - b.startMs),
    }));
  }, [grouped, now, lang, t]);

  const sel = { background: "var(--rc-surface-3)", border: "1px solid var(--rc-border)", borderRadius: 9, color: "var(--rc-text)", padding: "8px 10px", fontSize: 12 };
  const chip = (on) => ({
    padding: "7px 14px", borderRadius: 99, cursor: "pointer", fontSize: 12.5,
    border: `1px solid ${on ? "var(--rc-brand-bright)" : "var(--rc-border)"}`,
    background: on ? "rgba(150,0,24,.22)" : "var(--rc-surface-3)", color: on ? "var(--rc-text)" : "var(--rc-text-2)",
  });
  const heroMin = next ? Math.max(0, Math.floor((next.startMs - now) / 60000)) : 0;
  // özet sayaçlar: üçü de ham `races` (filtreden bağımsız genel özet) → tutarlı.
  const liveTotal = races.filter((r) => raceStatus(r, now) === "live").length;

  return (
    <div style={{ padding: "18px 20px 40px", fontFamily: "var(--rc-font-ui)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontFamily: "var(--rc-font-display)", textTransform: "uppercase", letterSpacing: ".06em", fontSize: 22, fontWeight: 700 }}>{t("Resmi Yarışlar")}</h2>
        <span style={{ color: "var(--rc-text-3)", fontSize: 12 }}>{updatedAt ? `${t("Güncellendi")} ${fmtClock(updatedAt, lang)} · ` : ""}{t("kaynak")} <a {...extHref("https://lmugarage.com")} style={{ color: "var(--rc-brand-bright)" }}>lmugarage.com</a></span>
      </div>

      {/* hero + özet */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
        <div style={{ flex: "1 1 380px", minWidth: 0, border: "1px solid var(--rc-brand-deep)", borderRadius: 14, background: "radial-gradient(120% 160% at 100% 0,rgba(150,0,24,.26),var(--rc-surface-2) 62%)", padding: "16px 18px", display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0, flex: 1 }}>
            <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".14em", color: "var(--rc-brand-bright)", fontWeight: 600 }}>{t("Sıradaki resmi yarış")}</span>
            <span style={{ fontFamily: "var(--rc-font-display)", fontWeight: 700, fontSize: 26, lineHeight: 1.05 }}>{next?.name || "—"}</span>
            {next && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--rc-text-2)" }}>
                {next.trackId && <img src={`${ASSET}flags/${TRACK_ASSET(next.trackId)}.png${AV}`} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} style={{ width: 20, borderRadius: 2 }} />}
                {[trackName(next.trackId) || next.trackRaw, next.lenLabel, next.sr && `SR ${next.sr}`].filter(Boolean).join(" · ")}
              </span>
            )}
          </div>
          {next && (
            <div style={{ textAlign: "right", flex: "0 0 auto" }}>
              <div style={{ fontFamily: "var(--rc-font-display)", fontWeight: 700, fontSize: 38, lineHeight: 1, color: "var(--rc-warn)", fontVariantNumeric: "tabular-nums" }}>{heroMin < 100 ? heroMin : heroMin < 1440 ? Math.floor(heroMin / 60) : Math.floor(heroMin / 1440)}<span style={{ fontSize: ".45em", color: "var(--rc-text-2)" }}> {heroMin < 100 ? t("dk") : heroMin < 1440 ? t("sa") : t("g")}</span></div>
              <div style={{ fontSize: 11, color: "var(--rc-text-3)", fontFamily: "var(--rc-font-display)" }}>{fmtClock(next.startMs, lang)} · {relDay(next.startMs, now, t).toLowerCase()}</div>
            </div>
          )}
        </div>
        <div style={{ flex: "0 1 300px", display: "flex", gap: 10 }}>
          {[[races.length, t("Toplam"), null], [upcomingTotal, t("Yaklaşan"), null], [liveTotal, t("Canlı"), "var(--rc-ok)"]].map(([n, l, col]) => (
            <div key={l} style={{ flex: 1, background: "var(--rc-surface-2)", border: `1px solid ${col ? "rgba(55,214,122,.4)" : "var(--rc-border)"}`, borderRadius: 12, padding: 14, textAlign: "center" }}>
              <div style={{ fontFamily: "var(--rc-font-display)", fontWeight: 700, fontSize: 26, lineHeight: 1, color: col || "var(--rc-text)" }}>{n}</div>
              <div style={{ color: "var(--rc-text-3)", fontSize: 10, textTransform: "uppercase", letterSpacing: ".09em", marginTop: 2 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* filtreler */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
        <input type="search" value={filters.q} onChange={(e) => setF("q", e.target.value)} placeholder={t("Yarış, pist veya seri ara…")}
          style={{ background: "var(--rc-surface-3)", border: "1px solid var(--rc-border)", borderRadius: 9, color: "var(--rc-text)", fontSize: 13, padding: "9px 13px", width: 260 }} />
        <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button onClick={() => setF("series", "all")} style={chip(filters.series === "all")}>{t("Tümü")}</button>
          {opts.series.map((k) => (
            <button key={k} onClick={() => setF("series", k)} style={chip(filters.series === k)}>{t(KIND_TR[k] || k)}</button>
          ))}
        </span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
          {opts.classes.length > 0 && (
            <select value={filters.cls} onChange={(e) => setF("cls", e.target.value)} style={sel}>
              <option value="all">{t("Tüm sınıflar")}</option>
              {opts.classes.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          {opts.tracks.length > 0 && (
            <select value={filters.track} onChange={(e) => setF("track", e.target.value)} style={sel}>
              <option value="all">{t("Tüm pistler")}</option>
              {opts.tracks.map((tk) => <option key={tk.value} value={tk.value}>{tk.label}</option>)}
            </select>
          )}
          {opts.srRanks.length > 0 && (
            <select value={filters.sr} onChange={(e) => setF("sr", e.target.value)} style={sel}>
              <option value="all">{t("SR: hepsi")}</option>
              {opts.srRanks.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
        </span>
      </div>

      {loading && <div style={{ padding: "12px 0", color: "var(--rc-text-3)", fontSize: 13 }}>{t("Takvim yükleniyor…")}</div>}
      {!loading && races.length === 0 && (
        <div style={{ padding: "12px 0", color: "var(--rc-text-3)", fontSize: 13 }}>{t("Takvim henüz yüklenmedi — birkaç dakika içinde güncellenir.")}</div>
      )}
      {!loading && races.length > 0 && days.length === 0 && (
        <div style={{ padding: "28px 0", textAlign: "center", color: "var(--rc-text-3)" }}><Icon name="yakinlastir" size={14} /> {t("Filtrelere uyan yarış yok.")}</div>
      )}

      {days.map((d) => (
        <div key={d.key} style={{ marginTop: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ fontFamily: "var(--rc-font-display)", fontWeight: 700, fontSize: 13, letterSpacing: ".08em" }}>{d.day}</span>
            <span style={{ fontSize: 11.5, color: "var(--rc-text-3)" }}>{d.date} · {d.races.length} {t("yarış")}</span>
            <span style={{ flex: 1, height: 1, background: "var(--rc-line-soft)" }} />
          </div>
          <div style={{ border: "1px solid var(--rc-border)", borderRadius: 12, background: "var(--rc-surface)", overflow: "hidden" }}>
            {d.races.map((r, i) => {
              const st = raceStatus(r, now), live = st === "live";
              return (
                <div key={r.id} style={{ display: "flex", flexDirection: "column", gap: 9, padding: "12px 14px", borderTop: i > 0 ? "1px solid var(--rc-line-soft)" : "none", background: live ? "rgba(55,214,122,.05)" : "transparent" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontFamily: "var(--rc-font-display)", fontWeight: 700, fontSize: 15, color: live ? "var(--rc-ok)" : "var(--rc-text-2)", width: 46, flex: "0 0 auto" }}>{fmtClock(r.startMs, lang)}</span>
                  {r.trackId && <img src={`${ASSET}flags/${TRACK_ASSET(r.trackId)}.png${AV}`} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} style={{ width: 26, borderRadius: 3, border: "1px solid var(--rc-border)", flex: "0 0 auto" }} />}
                  {r.trackId && <img src={`${ASSET}tracks/${TRACK_ASSET(r.trackId)}.png${AV}`} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} style={{ width: 52, height: 32, objectFit: "contain", opacity: .75, flex: "0 0 auto" }} />}
                  <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0, flex: "1 1 200px" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                      <b style={{ fontFamily: "var(--rc-font-display)", fontWeight: 700, fontSize: 17, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</b>
                      {live && <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, padding: "2px 8px", borderRadius: 99, border: "1px solid var(--rc-ok)", color: "var(--rc-ok)", flex: "0 0 auto" }}>● {t("Canlı")}</span>}
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".08em", padding: "2px 8px", borderRadius: 99, border: "1px solid var(--rc-border)", color: "var(--rc-text-3)" }}>{t(KIND_TR[r.kind] || r.kind)}</span>
                      {(r.classes || []).map((c) => (
                        <span key={c} style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".05em", padding: "2px 8px", borderRadius: 99, border: `1px solid ${clsCol(c)}`, color: clsCol(c) }}>{c}</span>
                      ))}
                      <span style={{ fontSize: 11.5, color: "var(--rc-text-3)" }}>{[trackName(r.trackId) || r.trackRaw, r.lenLabel].filter(Boolean).join(" · ")}</span>
                    </span>
                  </span>
                  {r.sr && <span style={{ fontFamily: "var(--rc-font-display)", fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em", padding: "3px 9px", borderRadius: 8, border: "1px solid var(--rc-border-strong)", color: "var(--rc-text-2)", flex: "0 0 auto", whiteSpace: "nowrap" }}>SR {r.sr}</span>}
                  <span style={{ fontFamily: "var(--rc-font-display)", fontSize: 12.5, color: live ? "var(--rc-ok)" : "var(--rc-text-3)", flex: "0 0 auto", whiteSpace: "nowrap", minWidth: 54, textAlign: "right" }}>{live ? t("başlıyor") : countdown(r.startMs, now, t)}</span>
                  <span style={{ display: "flex", gap: 6, flex: "0 0 auto" }}>
                    {r.url && <a {...extHref(r.url)} title={t("lmugarage'da aç")} style={{ display: "inline-grid", placeItems: "center", width: 32, height: 32, borderRadius: 9, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text-2)", textDecoration: "none", fontSize: 12 }}>↗</a>}
                    {onPlan && <button onClick={() => onPlan(r)} title={t("Bu yarışa planla")}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 9, cursor: "pointer", fontSize: 12, whiteSpace: "nowrap",
                        border: `1px solid ${live ? "var(--rc-brand-bright)" : "var(--rc-border)"}`, background: live ? "var(--rc-brand)" : "var(--rc-surface-3)", color: live ? "var(--rc-on-brand)" : "var(--rc-text-2)" }}><Icon name="plan" size={14} /> {t("Planla")}</button>}
                  </span>
                  </div>
                  {(() => {
                    /* 2. satır — "Race weekend" detayları, KATEGORİZE (handoff · Resmi Yarışlar):
                       SEANSLAR / FORMAT / KURALLAR sütunları; ada hizalı (padding-left:160). */
                    const { sessions, statGroups } = weekendData(r, t);
                    if (!sessions.length && !statGroups.length) return null;
                    const cat = (title, body) => (
                      <div key={title} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                        <span style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".12em", color: "var(--rc-text-3)" }}>{title}</span>
                        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "5px 6px" }}>{body}</div>
                      </div>
                    );
                    return (
                      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: "10px 22px", paddingLeft: 160 }}>
                        {sessions.length > 0 && cat(t("Seanslar"), sessions.map((s) => (
                          <span key={s.label} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 8, background: "var(--rc-surface-2)", border: "1px solid var(--rc-border)", whiteSpace: "nowrap" }}>
                            <i style={{ fontStyle: "normal", fontSize: 9.5, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--rc-text-3)" }}>{s.label}</i>
                            <b style={{ fontFamily: "var(--rc-font-display)", fontSize: 12, fontWeight: 700, color: "var(--rc-text)" }}>{s.dur}</b>
                            {s.wx.length > 0 && <span style={{ fontSize: 9, letterSpacing: "-1px", opacity: .9 }}>{s.wx.map(wxIcon).join("")}</span>}
                          </span>
                        )))}
                        {statGroups.map((g) => cat(g.title, g.items.map(([k, v]) => (
                          <span key={k} style={{ display: "inline-flex", alignItems: "baseline", gap: 4, padding: "3px 9px", borderRadius: 8, background: "var(--rc-surface-2)", border: "1px solid var(--rc-border)", whiteSpace: "nowrap" }}>
                            <i style={{ fontStyle: "normal", fontSize: 9.5, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--rc-text-3)" }}>{k}</i>
                            <b style={{ fontFamily: "var(--rc-font-display)", fontSize: 12, fontWeight: 700, color: "var(--rc-text)" }}>{v}</b>
                          </span>
                        ))))}
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
