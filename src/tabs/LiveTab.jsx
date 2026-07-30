import { useState } from "react";
import { fmtLap, fmtHMS } from "../engine";
import { Ring } from "../components";
import { DESKTOP_RELEASE_URL } from "../constants";
import { isTauri } from "../tauriEnv";

/* Canlı Timing — LMU köprüsünün yazdığı teams/{tid}/live/{rid} düğümünü gösterir.
   Köprü .exe oyunun PC'sinde çalışır, paylaşımlı bellekten okuyup Firebase'e yazar;
   web burada yalnız salt-okunur dinler. Bağlantı yoksa bilgilendirir. */

const lap = (v) => (v > 0 ? fmtLap(v) : "—");
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

function OwnCar({ t, own }) {
  const cap = own.fuelCapacity > 0 ? own.fuelCapacity : 0;
  const frac = cap ? Math.max(0, Math.min(1, own.fuel / cap)) : 0;
  const corners = [["FL", "fl"], ["FR", "fr"], ["RL", "rl"], ["RR", "rr"]];
  const ty = own.tyres || {};
  return (
    <div className="card" data-tour="ownlive" style={{ marginBottom: 12 }}>
      <h2>🏎 {t("Kendi Araç")}</h2>
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <Ring value={frac} size={92} thickness={9} fs={22} color="var(--green)"
            big={cap ? `${Math.round(frac * 100)}%` : "—"} />
          <div className="l" style={{ color: "var(--dim)", fontSize: 11 }}>
            {t("Yakıt")} {own.fuel != null ? `${own.fuel.toFixed(1)} L` : "—"}
            {cap ? ` / ${cap.toFixed(0)}` : ""}</div>
        </div>
        <div className="kpis" style={{ flex: 1, minWidth: 220, marginBottom: 0 }}>
          <div className="kpi"><div className="v">{own.position || "—"}</div>
            <div className="l">{t("Pozisyon")}</div></div>
          <div className="kpi"><div className="v mono">{lap(own.lastLapSec)}</div>
            <div className="l">{t("Son Tur")}</div></div>
          <div className="kpi"><div className="v mono" style={{ color: "var(--purple)" }}>
            {lap(own.bestLapSec)}</div><div className="l">{t("En İyi")}</div></div>
          <div className="kpi"><div className="v">{own.lapsDone ?? "—"}</div>
            <div className="l">{t("Tur")}</div></div>
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
  onStartBridge, onStopBridge }) {
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
  const field = Array.isArray(live.field) ? live.field : [];
  const ageSec = Math.max(0, Math.round((Date.now() - live.ts) / 1000));

  return (
    <div data-tour="livecard">
      {bridgeCard}
      <div className="card" style={{ marginBottom: 12 }}>
        <h2 style={{ display: "flex", alignItems: "center", gap: 10 }}>
          📡 {t("Canlı Timing")}
          <span className={`livebadge ${conn.cls}`}>
            <i /> {t(conn.lbl)} · {ageSec}s</span>
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

      {own && <OwnCar t={t} own={own} />}

      <div className="card">
        <h2>🏁 {t("Saha")} ({field.length})</h2>
        {!field.length && <div className="hint">{t("Henüz araç verisi yok.")}</div>}
        {field.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table aria-label={t("Canlı timing tablosu")}>
              <thead><tr>
                <th>#</th><th>{t("Pilot")}</th><th>{t("Sınıf")}</th><th>{t("Tur")}</th>
                <th>{t("Son")}</th><th>{t("En İyi")}</th><th>Gap</th><th>Pit</th>
              </tr></thead>
              <tbody>
                {field.map((c, i) => (
                  <tr key={c.pos ?? i} className={c.isPlayer ? "live" : ""}>
                    <td className="disp" style={{ fontSize: 15 }}>{c.pos ?? i + 1}</td>
                    <td style={{ fontFamily: "'Inter',system-ui,sans-serif" }}>{c.driver || "—"}</td>
                    <td><span className="chip" style={{ fontSize: 10 }}>{c.carClass || "—"}</span></td>
                    <td>{c.lapsDone ?? "—"}</td>
                    <td>{lap(c.lastSec)}</td>
                    <td style={{ color: "var(--purple)" }}>{lap(c.bestSec)}</td>
                    <td>{i === 0 ? t("Lider") : gap(c.gapSec)}</td>
                    <td>{c.inPits ? <span className="chip"
                      style={{ color: "var(--yellow)", borderColor: "var(--yellow)" }}>PIT</span> : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="hint">{t("Veriler oyundan (rFactor2 paylaşımlı bellek) köprü ile Firebase üzerinden gelir — tüm takım aynı anda görür.")}</div>
      </div>
    </div>
  );
}
