/* ============================================================
   ScheduleTab — lmugarage.com resmi LMU yarış takvimi ("Yarışlar" sekmesi)
   ------------------------------------------------------------
   RTDB /lmuSchedule verisini (useLmuSchedule) gösterir: canlı + yaklaşan resmi
   yarışlar, geri sayımla. Her satırda "Bu yarışa planla" → App'in planlama
   köprüsünü çağırır (pist/sınıf/süre + setup süzgeci + Stint sekmesi).

   Kaynak: lmugarage.com (resmi olmayan topluluk projesi) — atıf altta.
   ============================================================ */
import { useState, useEffect } from "react";
import { TRACKS, TRACK_FLAG } from "../constants";

const trackName = (id, raw) =>
  (id && TRACKS.find((tk) => tk.id === id)?.name) || raw || "—";

/* lmugarage etkinlik türü → Türkçe etiket (i18n kaynağı Türkçe; t() İngilizceye çevirir). */
const KIND_TR = { daily: "Günlük", weekly: "Haftalık", special: "Özel", championship: "Şampiyona" };

/* Geri sayım: startMs - now → "2h 14m" / "14m" / "başlıyor". Birimler dil-nötr (h/m). */
function countdown(startMs, now, t) {
  if (!startMs) return "";
  const s = Math.floor((startMs - now) / 1000);
  if (s <= 0) return t("başlıyor");
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const fmtLocal = (ms) => {
  if (!ms) return "—";
  const d = new Date(ms);
  return d.toLocaleString([], {
    weekday: "short", hour: "2-digit", minute: "2-digit",
  });
};

function RaceRow({ r, now, t, onPlan }) {
  return (
    <div className="sched-row" style={{
      display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
      padding: "10px 12px", borderBottom: "1px solid var(--line)",
    }}>
      <div style={{ minWidth: 96 }}>
        <div style={{ fontWeight: 600 }}>{fmtLocal(r.startMs)}</div>
        <div className="hint" style={{ fontSize: 12 }}>
          {r.live
            ? <span style={{ color: "var(--live, #F0604D)", fontWeight: 700 }}>● {t("Canlı")}</span>
            : `⏳ ${countdown(r.startMs, now, t)}`}
        </div>
      </div>

      <div style={{ flex: "1 1 180px", minWidth: 160 }}>
        <div style={{ fontWeight: 600 }}>{r.name}</div>
        <div className="hint" style={{ fontSize: 12 }}>
          {TRACK_FLAG?.[r.trackId] ? `${TRACK_FLAG[r.trackId]} ` : ""}
          {trackName(r.trackId, r.trackRaw)}
          {r.kind ? ` · ${t(KIND_TR[r.kind] || cap(r.kind))}` : ""}
        </div>
      </div>

      <div className="chips" style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {(r.classes || []).map((c) => (
          <span key={c} className="badge badge-class" data-class={c}>{c}</span>
        ))}
      </div>

      {r.sr && (
        <span className="rating" data-rank={r.srRank} title={t("Güvenlik derecesi şartı")}
          style={{ fontSize: 12, opacity: 0.9 }}>
          SR {r.sr}
        </span>
      )}

      {r.lenLabel && (
        <span className="hint" style={{ fontSize: 12, minWidth: 48 }}>⏱ {r.lenLabel}</span>
      )}

      <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
        {r.url && (
          <a className="act" href={r.url} target="_blank" rel="noopener noreferrer"
            title={t("lmugarage'da aç")} style={{ textDecoration: "none" }}>↗</a>
        )}
        <button className="act" onClick={() => onPlan(r)} title={t("Bu yarışa planla")}>
          📋 {t("Planla")}
        </button>
      </div>
    </div>
  );
}

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export default function ScheduleTab({ t, live = [], upcoming = [], updatedAt, loading, onPlan }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const empty = !loading && live.length === 0 && upcoming.length === 0;

  return (
    <div className="card" data-tour="scheduletab">
      <h2 style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        🏁 {t("Resmi Yarış Takvimi")}
        {updatedAt && (
          <span className="hint" style={{ fontSize: 12, fontWeight: 400, marginLeft: "auto" }}>
            {t("Güncellendi")}: {new Date(updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </h2>
      <div className="hint" style={{ marginBottom: 8 }}>
        {t("Le Mans Ultimate resmi günlük/haftalık yarışları. Bir yarışa \"Planla\" ile stint/yakıt planını hazırla.")}
      </div>

      {loading && <div className="hint">{t("Takvim yükleniyor…")}</div>}
      {empty && <div className="hint">{t("Takvim henüz yüklenmedi — birkaç dakika içinde güncellenir.")}</div>}

      {live.length > 0 && (
        <>
          <h3 style={{ margin: "12px 0 4px" }}>● {t("Şu An Canlı")}</h3>
          <div style={{ border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden" }}>
            {live.map((r) => <RaceRow key={r.id} r={r} now={now} t={t} onPlan={onPlan} />)}
          </div>
        </>
      )}

      {upcoming.length > 0 && (
        <>
          <h3 style={{ margin: "12px 0 4px" }}>⏳ {t("Yaklaşan")}</h3>
          <div style={{ border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden" }}>
            {upcoming.map((r) => <RaceRow key={r.id} r={r} now={now} t={t} onPlan={onPlan} />)}
          </div>
        </>
      )}

      <div className="hint" style={{ marginTop: 10, fontSize: 12 }}>
        {t("Kaynak")}:{" "}
        <a href="https://lmugarage.com" target="_blank" rel="noopener noreferrer">lmugarage.com</a>{" "}
        — {t("resmi olmayan topluluk projesi.")}
      </div>
    </div>
  );
}
