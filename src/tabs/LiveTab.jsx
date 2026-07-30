import { useState, useRef, useEffect } from "react";
import { fmtLap, fmtHMS } from "../engine";
import { Ring } from "../components";
import { DESKTOP_RELEASE_URL, ASSET, classId, classAccent } from "../constants";
import { isTauri } from "../tauriEnv";

/* Canlı Timing — LMU köprüsünün yazdığı teams/{tid}/live/{rid} düğümünü gösterir.
   Köprü .exe oyunun PC'sinde çalışır, paylaşımlı bellekten okuyup Firebase'e yazar;
   web burada yalnız salt-okunur dinler. Bağlantı yoksa bilgilendirir. */

const lap = (v) => (v > 0 ? fmtLap(v) : "—");
/* lastik diş oranı (0..1) → renk: yeşil→sarı→kırmızı (OwnCar ile aynı eşik) */
const wearColor = (w) => (w == null ? "var(--dim)"
  : w < 0.4 ? "var(--red)" : w < 0.7 ? "var(--yellow)" : "var(--green)");
const gap = (v) => {
  if (!(v > 0)) return "—";
  if (v < 60) return `+${v.toFixed(1)}`;
  const m = Math.floor(v / 60);
  return `+${m}:${(v - m * 60).toFixed(1).padStart(4, "0")}`;
};

/* son güncelleme yaşından bağlantı durumu */
function connOf(ts) {
  if (!ts) return { cls: "off", lbl: "bağlı değil" };
  const dt = Date.now() - ts;
  if (dt < 6000) return { cls: "on", lbl: "canlı" };
  if (dt < 30000) return { cls: "lag", lbl: "gecikmeli" };
  return { cls: "off", lbl: "bağlantı koptu" };
}

/* Sınıf rozeti — pick ekranındaki renkli vektör (assets/class/<id>.png).
   Görsel yüklenmezse sınıf adını nötr çip olarak gösterir. */
function ClassBadge({ raw }) {
  const [err, setErr] = useState(false);
  const id = classId(raw);
  if (id && !err) {
    return (
      <img src={`${ASSET}class/${id}.png`} alt={raw || ""} title={raw || ""}
        style={{ height: 18, verticalAlign: "middle", borderRadius: 3 }}
        onError={() => setErr(true)} />
    );
  }
  return <span className="chip" style={{ fontSize: 10 }}>{raw || "—"}</span>;
}

/* Bir aracın o ana kadar attığı turların zaman listesi (satırdaki "+" ile açılır).
   Köprü çalışırken tamamlanan turlar; en yeni üstte. En hızlı tur mor, out/pit
   turu (best'in %110'undan büyük) soluk. wxmodal desenini yeniden kullanır. */
function LapsModal({ t, row, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  const laps = Array.isArray(row.laps) ? row.laps : [];
  const from = row.lapsFrom || 1;
  const best = laps.length ? Math.min(...laps.filter((v) => v > 0)) : 0;
  // en yeni üstte: tur no = from + index
  const items = laps.map((sec, i) => ({ n: from + i, sec })).reverse();
  return (
    <div className="wxmodal" onClick={onClose} role="dialog" aria-modal="true">
      <div className="wxmbox" onClick={(e) => e.stopPropagation()}>
        <div className="wxmhead">
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ClassBadge raw={row.carClass} /> {row.driver || "—"}
            <span style={{ fontSize: 12, color: "var(--dim)", textTransform: "none",
              letterSpacing: 0 }}>· {laps.length} {t("tur")}</span>
          </span>
          <button className="act" style={{ fontSize: 12, padding: "2px 10px" }}
            onClick={onClose}>✕</button>
        </div>
        <div className="wxmlist">
          {!items.length && <div className="hint">{t("Henüz tamamlanmış tur yok.")}</div>}
          {items.map(({ n, sec }) => {
            const isBest = sec > 0 && sec === best;
            const isOut = best > 0 && sec > best * 1.10;
            return (
              <div key={n} className="wxrow">
                <span className="wxnm" style={{ minWidth: 64, color: "var(--dim)" }}>
                  {t("Tur")} {n}</span>
                <span className="mono" style={{ fontSize: 15, fontWeight: isBest ? 700 : 500,
                  color: isBest ? "var(--purple)" : isOut ? "var(--yellow)" : "var(--txt)" }}>
                  {fmtLap(sec)}</span>
                <span className="wxat mono">
                  {isBest ? "★" : best > 0 ? `+${(sec - best).toFixed(2)}` : ""}</span>
              </div>
            );
          })}
        </div>
        <div className="wxmfoot">
          <button className="act" onClick={onClose}>{t("Kapat")}</button>
        </div>
      </div>
    </div>
  );
}

function OwnCar({ t, own, liveFuelObs }) {
  const cap = own.fuelCapacity > 0 ? own.fuelCapacity : 0;
  const frac = cap ? Math.max(0, Math.min(1, own.fuel / cap)) : 0;
  const corners = [["FL", "fl"], ["FR", "fr"], ["RL", "rl"], ["RR", "rr"]];
  const ty = own.tyres || {};
  // Mevcut yakıtla ~kaç tur kaldığı — App'in canlı öğrenicisinden (litre/tur).
  const lpl = liveFuelObs?.litersPerLap;
  const lapsLeft = (lpl > 0 && own.fuel > 0) ? Math.floor(own.fuel / lpl) : null;
  const sec = (v) => (v > 0 ? `${v.toFixed(1)}` : "—");
  // lastik bileşimi (ön/arka aynıysa tek göster)
  const tc = own.tyreCompound || {};
  const compound = tc.front && tc.rear
    ? (tc.front === tc.rear ? tc.front : `${tc.front}/${tc.rear}`)
    : (tc.front || tc.rear || "");
  return (
    <div className="card" data-tour="ownlive" style={{ marginBottom: 12 }}>
      <h2 style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        🏎 {t("Kendi Araç")}
        {compound && <span className="chip" style={{ fontSize: 11, color: "var(--teal)",
          borderColor: "var(--teal)" }}>🛞 {compound}</span>}
        {own.inPits && <span className="chip"
          style={{ color: "var(--yellow)", borderColor: "var(--yellow)", fontSize: 11 }}>PIT</span>}
      </h2>
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <Ring value={frac} size={92} thickness={9} fs={22} color="var(--green)"
            big={cap ? `${Math.round(frac * 100)}%` : "—"} />
          <div className="l" style={{ color: "var(--dim)", fontSize: 11 }}>
            {t("Yakıt")} {own.fuel != null ? `${own.fuel.toFixed(1)} L` : "—"}
            {cap ? ` / ${cap.toFixed(0)}` : ""}</div>
          {lapsLeft != null && (
            <div className="l" style={{ color: "var(--teal)", fontSize: 11, fontWeight: 600 }}>
              ~{lapsLeft} {t("tur")}</div>
          )}
        </div>
        <div className="kpis" style={{ flex: 1, minWidth: 220, marginBottom: 0 }}>
          <div className="kpi"><div className="v">{own.position || "—"}</div>
            <div className="l">{t("Pozisyon")}</div></div>
          <div className="kpi"><div className="v mono">
            {own.curLapSec > 0 ? fmtLap(own.curLapSec) : "—"}</div>
            <div className="l">{t("Mevcut Tur")}</div></div>
          <div className="kpi"><div className="v mono">{lap(own.lastLapSec)}</div>
            <div className="l">{t("Son Tur")}</div></div>
          <div className="kpi"><div className="v mono" style={{ color: "var(--purple)" }}>
            {lap(own.bestLapSec)}</div><div className="l">{t("En İyi")}</div></div>
          <div className="kpi"><div className="v">{own.lapsDone ?? "—"}</div>
            <div className="l">{t("Tur")}</div></div>
          <div className="kpi"><div className="v">{own.pitStops ?? "—"}</div>
            <div className="l">{t("Pit")}</div></div>
          <div className="kpi"><div className="v" style={{ color: (own.damage || 0) > 0.15
            ? "var(--red)" : (own.damage || 0) > 0.02 ? "var(--yellow)" : "var(--txt)" }}>
            {own.damage != null ? `${Math.round(own.damage * 100)}%` : "—"}</div>
            <div className="l">{t("Hasar")}</div></div>
          <div className="kpi"><div className="v mono" style={{ fontSize: 15 }}>
            {sec(own.s1)} <span style={{ color: "var(--dim)" }}>/</span> {sec(own.s2)}</div>
            <div className="l">S1 / S2</div></div>
          <div className="kpi"><div className="v mono">{lap(own.avg5Sec)}</div>
            <div className="l">AVG5</div></div>
          <div className="kpi"><div className="v mono">{lap(own.avgSec)}</div>
            <div className="l">AVG</div></div>
          <div className="kpi"><div className="v mono">
            {own.stintSec > 0 ? fmtHMS(own.stintSec) : "—"}</div>
            <div className="l">{t("Stint")}</div></div>
        </div>
      </div>
      <div className="row4" style={{ marginTop: 12 }}>
        {corners.map(([lbl, k]) => {
          const c = ty[k] || {};
          const wear = c.wear != null ? Math.round(c.wear * 100) : null;
          return (
            <div key={k} className="kpi" style={{ textAlign: "center" }}>
              <div className="l" style={{ marginTop: 0 }}>{lbl}</div>
              <div className="v" style={{ fontSize: 18,
                color: wear != null && wear < 40 ? "var(--red)"
                  : wear != null && wear < 70 ? "var(--yellow)" : "var(--green)" }}>
                {wear != null ? `${wear}%` : "—"}</div>
              <div className="l" style={{ marginTop: 2 }}>
                {c.tempC != null ? `${Math.round(c.tempC)}°` : "—"}
                {c.pressKpa != null ? ` · ${Math.round(c.pressKpa)}kPa` : ""}</div>
            </div>
          );
        })}
      </div>
      <div className="hint">{t("Lastik: kalan diş % (yeşil→sarı→kırmızı) · sıcaklık · basınç. Köprüden salt-okunur gelir.")}</div>
    </div>
  );
}

/* Masaüstü uygulamasında canlı köprüyü buradan başlat/durdur.
   Oyunun çalıştığı PC'de: giriş yap → yarışı aç → Başlat. Sidecar oyunun
   paylaşımlı belleğini okur, veri senin oturumunla yazılır (bot gerekmez). */
function BridgeControl({ t, bridge, canEdit, onStart, onStop }) {
  const [mock, setMock] = useState(false);
  const running = !!bridge?.running;
  const phase = bridge?.phase || "idle";
  const dot = phase === "running" ? "var(--green)"
    : phase === "error" ? "var(--red)"
      : phase === "starting" ? "var(--yellow)" : "var(--muted)";
  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <h2 style={{ display: "flex", alignItems: "center", gap: 10 }}>
        🛰 {t("Canlı Köprü")}
        <span style={{ width: 9, height: 9, borderRadius: "50%", background: dot,
          boxShadow: `0 0 8px ${dot}` }} />
      </h2>
      {!canEdit ? (
        <div className="hint">{t("Köprüyü başlatmak için takımda owner/editor olmalısın (yalnız görüntüleyicisin).")}</div>
      ) : (
        <>
          <div className="hint" style={{ marginBottom: 10 }}>
            {t("Bu bilgisayarda oyun (LMU) açıkken Başlat'a bas — köprü oyunu okuyup canlı timing'i takımla paylaşır. Ayrı .exe ve bot hesabı gerekmez.")}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            {!running ? (
              <button className="bigbtn" onClick={() => onStart(mock)}
                style={{ width: "auto", padding: "10px 20px" }}>
                ▶ {t("Canlı Köprü Başlat")}</button>
            ) : (
              <button className="act" onClick={onStop}
                style={{ padding: "10px 20px", borderColor: "var(--red)", color: "var(--red)" }}>
                ■ {t("Durdur")}</button>
            )}
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12,
              color: "var(--dim)", cursor: "pointer" }}>
              <input type="checkbox" checked={mock} disabled={running}
                onChange={(e) => setMock(e.target.checked)} />
              {t("Mock veri (oyunsuz test)")}
            </label>
          </div>
          {bridge?.msg && (
            <div className="hint" style={{ marginTop: 8,
              color: phase === "error" ? "var(--red)" : "var(--dim)" }}>
              {running || phase === "error" ? "• " : ""}{bridge.msg}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function LiveTab({ t, live, bridge, canEdit,
  onStartBridge, onStopBridge, liveFuelObs }) {
  const [myClassOnly, setMyClassOnly] = useState(false);
  const [big, setBig] = useState(false);
  const [lapsFor, setLapsFor] = useState(null);   // "+" ile açılan tur listesi satırı
  const rootRef = useRef(null);
  const playerRowRef = useRef(null);
  const posRef = useRef({});   // sürücü → son pozisyon
  const dirRef = useRef({});   // sürücü → 'up'|'down' (son değişim yönü kalır)
  // uzun grid'de oyuncu satırını görünür tut (canlı güncellemede)
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    playerRowRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [live?.own?.position, myClassOnly]);
  // pozisyon değişim yönünü izle (kare kare) → ▲/▼ okları
  useEffect(() => {
    const f = Array.isArray(live?.field) ? live.field : [];
    for (const c of f) {
      const prev = posRef.current[c.driver];
      if (prev != null && c.pos > 0 && prev !== c.pos) {
        dirRef.current[c.driver] = prev > c.pos ? "up" : "down";
      }
      if (c.pos > 0) posRef.current[c.driver] = c.pos;
    }
  }, [live?.ts]);
  // büyük pano (tam ekran)
  const toggleBig = () => {
    const el = rootRef.current;
    if (!document.fullscreenElement) {
      Promise.resolve(el?.requestFullscreen?.()).then(() => setBig(true)).catch(() => setBig(true));
    } else {
      Promise.resolve(document.exitFullscreen?.()).catch(() => {});
    }
  };
  useEffect(() => {
    const onFs = () => setBig(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const bridgeCard = isTauri ? (
    <BridgeControl t={t} bridge={bridge} canEdit={canEdit}
      onStart={onStartBridge} onStop={onStopBridge} />
  ) : null;

  if (!live || !live.ts) {
    return (
      <div data-tour="livecard">
        {bridgeCard}
        <div className="card">
          <h2>📡 {t("Canlı Timing")}</h2>
          <div className="hint" style={{ lineHeight: 1.7 }}>
            {isTauri
              ? t("Köprü henüz veri göndermedi. Yukarıdan 'Canlı Köprü Başlat'a bas (oyun açıkken). Yarış başlayınca bu ekran canlı dolar.")
              : <>
                {t("Canlı timing, oyunun çalıştığı PC'deki Masaüstü Uygulaması ile gelir:")}
                <br />1. {t("rFactor2 paylaşımlı bellek eklentisi LMU'da kurulu olmalı (zaten ekte).")}
                <br />2. {t("Masaüstü Uygulamasını oyunun PC'sine kur, giriş yap, yarışı aç, 'Canlı' sekmesinden 'Canlı Köprü Başlat'a bas.")}
                <br />3. {t("Yarış başlayınca bu ekran (ve tüm takım) canlı dolar.")}
              </>}
          </div>
          {!isTauri && (
            <div style={{ marginTop: 12 }}>
              <a className="bigbtn" href={DESKTOP_RELEASE_URL} target="_blank" rel="noopener noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: 8, width: "auto",
                  padding: "10px 18px", textDecoration: "none" }}>
                🖥 {t("Masaüstü Uygulamasını İndir")}</a>
            </div>
          )}
        </div>
      </div>
    );
  }
  const conn = connOf(live.ts);
  const s = live.session || {};
  const own = live.own || null;
  const fieldAll = Array.isArray(live.field) ? live.field : [];
  const ageSec = Math.max(0, Math.round((Date.now() - live.ts) / 1000));

  // türetilmiş: sınıf-içi pozisyon, seans en hızlı turu, oyuncu sınıfı
  const leaderLaps = fieldAll[0]?.lapsDone ?? 0;
  const fastestBest = Math.min(
    ...fieldAll.map((c) => c.bestSec).filter((v) => v > 0), Infinity);
  const playerClass = classId(fieldAll.find((c) => c.isPlayer)?.carClass);
  const classCounts = {};
  const rows = fieldAll.map((c, i) => {
    const id = classId(c.carClass);
    classCounts[id] = (classCounts[id] || 0) + 1;
    const prevGap = fieldAll[i - 1]?.gapSec;
    // öndeki araca fark: köprü intervalSec verdiyse onu kullan, yoksa gap farkı
    const interval = (c.intervalSec != null && c.intervalSec > 0) ? c.intervalSec
      : (i > 0 && c.gapSec > 0 && prevGap > 0) ? c.gapSec - prevGap : null;
    const lapsDown = Math.max(0, leaderLaps - (c.lapsDone ?? 0));
    const delta = (c.lastSec > 0 && c.bestSec > 0) ? c.lastSec - c.bestSec : null;
    return { c, i, id, classPos: classCounts[id], interval, lapsDown, delta,
      isFastest: c.bestSec > 0 && c.bestSec === fastestBest };
  });
  const shown = myClassOnly && playerClass
    ? rows.filter((r) => r.id === playerClass) : rows;

  return (
    <div data-tour="livecard" ref={rootRef} className={big ? "bigboard" : ""}>
      {!big && bridgeCard}
      <div className="card" style={{ marginBottom: 12 }}>
        <h2 style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          📡 {t("Canlı Timing")}
          <span className={`livebadge ${conn.cls}`}>
            <i /> {t(conn.lbl)} · {ageSec}s</span>
          {document.fullscreenEnabled && (
            <button className="act" style={{ marginLeft: "auto", fontSize: 11, padding: "3px 10px" }}
              onClick={toggleBig}>{big ? t("✕ Küçült") : t("⛶ Büyük Pano")}</button>
          )}
        </h2>
        <div className="kpis" style={{ marginBottom: 0 }}>
          <div className="kpi"><div className="v disp">{s.flag ? t(s.flag) : (s.phase || "—")}</div>
            <div className="l">{t("Bayrak / Faz")}</div></div>
          <div className="kpi"><div className="v mono">
            {s.timeLeftSec != null ? fmtHMS(s.timeLeftSec) : "—"}</div>
            <div className="l">{t("Kalan")}</div></div>
          <div className="kpi"><div className="v">{s.trackTemp != null ? `${Math.round(s.trackTemp)}°` : "—"}
            <span style={{ fontSize: 13, color: "var(--dim)" }}> {t("pist")}</span></div>
            <div className="l">{t("Pist Sıcaklığı")}</div></div>
          <div className="kpi"><div className="v">
            {s.raining ? `🌧 ${t("Yağmur")}` : `☀️ ${t("Kuru")}`}</div>
            <div className="l">{t("Hava")} {s.ambientTemp != null ? `${Math.round(s.ambientTemp)}°` : ""}</div></div>
        </div>
      </div>

      {own && <OwnCar t={t} own={own} liveFuelObs={liveFuelObs} />}

      <div className="card">
        <h2 style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          🏁 {t("Saha")} ({shown.length})
          {playerClass && (
            <button className={`act${myClassOnly ? " on" : ""}`}
              style={{ fontSize: 11, padding: "3px 10px",
                ...(myClassOnly && { borderColor: "var(--teal)", color: "var(--teal)" }) }}
              onClick={() => setMyClassOnly((v) => !v)}>
              {myClassOnly ? t("Tüm saha") : t("Kendi sınıfım")}</button>
          )}
        </h2>
        {!shown.length && <div className="hint">{t("Henüz araç verisi yok.")}</div>}
        {shown.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table aria-label={t("Canlı timing tablosu")}>
              <thead><tr>
                <th>#</th><th>{t("Pilot")}</th><th>{t("Sınıf")}</th><th>{t("Tur")}</th>
                <th>{t("Son")}</th><th>{t("En İyi")}</th><th>AVG5</th><th>AVG</th>
                <th>Δ</th><th>Gap</th><th>{t("Aralık")}</th><th>{t("Konum")}</th>
                <th>Stint</th><th>{t("Lastik")}</th><th>{t("Hasar")}</th><th>Pit</th>
                <th aria-label={t("Turlar")}></th>
              </tr></thead>
              <tbody>
                {shown.map(({ c, i, id, classPos, interval, lapsDown, delta, isFastest }) => {
                  const acc = classAccent(c.carClass);
                  return (
                    <tr key={c.pos ?? i} ref={c.isPlayer ? playerRowRef : null}
                      className={c.isPlayer ? "live" : ""}
                      style={!c.isPlayer && acc ? { borderLeft: `3px solid ${acc}` } : undefined}>
                      <td className="disp" style={{ fontSize: 15, whiteSpace: "nowrap" }}>
                        {c.pos ?? i + 1}
                        {dirRef.current[c.driver] === "up" && <span
                          style={{ color: "var(--green)", fontSize: 10, marginLeft: 3 }}>▲</span>}
                        {dirRef.current[c.driver] === "down" && <span
                          style={{ color: "var(--red)", fontSize: 10, marginLeft: 3 }}>▼</span>}
                      </td>
                      <td style={{ fontFamily: "'Inter',system-ui,sans-serif" }}>{c.driver || "—"}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <ClassBadge raw={c.carClass} />
                        {id && <span style={{ fontSize: 10, marginLeft: 5,
                          color: classPos === 1 ? "var(--yellow)" : "var(--dim)",
                          fontWeight: classPos === 1 ? 700 : 400 }}>P{classPos}</span>}
                      </td>
                      <td>{c.lapsDone ?? "—"}</td>
                      <td>{lap(c.lastSec)}</td>
                      <td style={{ color: isFastest ? "var(--purple)" : "var(--dim)",
                        fontWeight: isFastest ? 700 : 400 }}>{lap(c.bestSec)}</td>
                      <td style={{ color: "var(--dim)" }}>{lap(c.avg5Sec)}</td>
                      <td style={{ color: "var(--dim)" }}>{lap(c.avgSec)}</td>
                      <td style={{ color: delta == null ? "var(--dim)"
                        : delta <= 0 ? "var(--green)" : "var(--red)", fontSize: 12 }}>
                        {delta == null ? "—" : `${delta > 0 ? "+" : ""}${delta.toFixed(2)}`}</td>
                      <td>{i === 0 ? t("Lider") : lapsDown >= 1 ? `+${lapsDown} ${t("Tur")}` : gap(c.gapSec)}</td>
                      <td style={{ color: "var(--dim)" }}>{interval != null ? gap(interval) : "—"}</td>
                      <td style={{ fontSize: 11, color: c.location === "PIT" ? "var(--yellow)"
                        : c.location === "GARAGE" ? "var(--red)" : "var(--dim)" }}>
                        {c.location ? t(c.location) : "—"}</td>
                      <td className="mono" style={{ color: "var(--dim)", fontSize: 12 }}>
                        {c.stintSec > 0 ? fmtHMS(c.stintSec) : "—"}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {c.tyreWear != null ? <>
                          <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: "50%",
                            background: wearColor(c.tyreWear), marginRight: 5, verticalAlign: "middle" }} />
                          <span style={{ color: "var(--dim)", fontSize: 12 }}>{Math.round(c.tyreWear * 100)}%</span>
                        </> : "—"}</td>
                      <td style={{ fontSize: 12, color: (c.damage || 0) > 0.15 ? "var(--red)"
                        : (c.damage || 0) > 0.02 ? "var(--yellow)" : "var(--dim)" }}>
                        {c.damage != null ? `${Math.round(c.damage * 100)}%` : "—"}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {c.inPits && <span className="chip" style={{ marginRight: 4,
                          color: "var(--yellow)", borderColor: "var(--yellow)" }}>PIT</span>}
                        <span style={{ color: "var(--dim)" }}>{c.pitStops ?? "—"}</span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {c.laps?.length > 0 && (
                          <button className="act" title={t("Tur zamanları")}
                            aria-label={t("Tur zamanları")}
                            style={{ fontSize: 14, lineHeight: 1, padding: "1px 8px" }}
                            onClick={() => setLapsFor(c)}>+</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="hint">{t("Gap: lidere · Aralık: öndeki araca · Pn: sınıf-içi sıra (sarı = sınıf lideri) · mor: seansın en hızlı turu · satır sonundaki + ile o aracın tur zamanları. Veriler köprü ile canlı gelir; tüm takım aynı anda görür.")}</div>
      </div>
      {lapsFor && <LapsModal t={t} row={lapsFor} onClose={() => setLapsFor(null)} />}
    </div>
  );
}
