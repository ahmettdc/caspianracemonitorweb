import { useState, useRef, useEffect } from "react";
import { fmtLap, fmtHMS } from "../engine";
import { Ring } from "../components";
import { DESKTOP_RELEASE_URL, ASSET, classId, classAccent, brandKey, manufacturerKey,
  trackName, TRACK_ASSET } from "../constants";
import { isTauri } from "../tauriEnv";
import { liveLapsSubscribe } from "../storage";
import TrackMap from "./TrackMap";
import PosChart from "./PosChart";
import StrategyBar from "./StrategyBar";
import CarDiagram from "./CarDiagram";
import { demoFrame } from "./liveDemo";

/* Canlı Timing — LMU köprüsünün yazdığı teams/{tid}/live/{rid} düğümünü gösterir.
   Köprü .exe oyunun PC'sinde çalışır, paylaşımlı bellekten okuyup Firebase'e yazar;
   web burada yalnız salt-okunur dinler. Bağlantı yoksa bilgilendirir. */

const lap = (v) => (v > 0 ? fmtLap(v) : "—");
/* lastik diş oranı (0..1) → renk: yeşil→sarı→kırmızı (OwnCar ile aynı eşik) */
const wearColor = (w) => (w == null ? "var(--dim)"
  : w < 0.4 ? "var(--red)" : w < 0.7 ? "var(--yellow)" : "var(--green)");
/* virtual energy % → renk: yüksek yeşil, düşük kırmızı */
const veColor = (v) => (v == null ? "var(--dim)"
  : v > 50 ? "var(--green)" : v > 20 ? "var(--yellow)" : "var(--red)");
const gap = (v) => {
  if (!(v > 0)) return "—";
  if (v < 60) return `+${v.toFixed(1)}`;
  const m = Math.floor(v / 60);
  return `+${m}:${(v - m * 60).toFixed(1).padStart(4, "0")}`;
};

/* Seans durumu → bayrak bandı ({cls, label}) veya normal yarışta null.
   flag: Green|Yellow|FCY (rf2_source), phase: Yeşil|FCY|Durduruldu|Bitti… */
function flagState(s, t) {
  const flag = s.flag, phase = s.phase;
  if (phase === "Durduruldu") return { cls: "red", label: `🔴 ${t("KIRMIZI BAYRAK")}` };
  if (phase === "Bitti") return { cls: "finish", label: `🏁 ${t("YARIŞ BİTTİ")}` };
  if (flag === "FCY" || phase === "FCY") return { cls: "fcy", label: `🟠 ${t("FULL COURSE YELLOW / SC")}` };
  if (flag === "Yellow") return { cls: "yellow", label: `🟡 ${t("SARI BAYRAK")}` };
  return null;   // Green / Yeşil / normal → bant yok
}

/* Lastik bileşimi adı → renk (soft kırmızı, medium sarı, hard beyaz, wet mavi, inter yeşil) */
function compoundColor(n) {
  const s = String(n || "").toLowerCase();
  if (/soft|yumu|kırmız|\bred\b/.test(s)) return "var(--red)";
  if (/medium|orta/.test(s)) return "var(--yellow)";
  if (/hard|sert/.test(s)) return "#E4E4EA";
  if (/inter/.test(s)) return "var(--green)";
  if (/wet|yağ|rain|ıslak/.test(s)) return "#4D9FFF";
  return "var(--teal)";
}

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

/* Araç markası logosu (assets/brands/<key>.png). Önce LMU katalog manufacturer'ı
   (temiz: "Cadillac"), yoksa vehicleName parser'ı denenir; dosya yoksa gizlenir. */
function Brand({ manufacturer, vehicleName }) {
  const [i, setI] = useState(0);
  const cands = [];
  const mk = manufacturerKey(manufacturer);
  if (mk) cands.push(`${ASSET}brands/${mk}.png`);
  const vk = brandKey(vehicleName);
  const vUrl = vk ? `${ASSET}brands/${vk}.png` : "";
  if (vUrl && !cands.includes(vUrl)) cands.push(vUrl);
  const url = cands[i];
  if (!url) return null;
  return <img src={url} alt="" title={manufacturer || vehicleName || ""}
    style={{ height: 16, width: 16, objectFit: "contain", verticalAlign: "middle",
      marginRight: 6 }} onError={() => setI((x) => x + 1)} />;
}

/* Bir aracın tüm yarış boyunca attığı turların zaman listesi (satırdaki "+" ile açılır).
   Geçmiş kalıcı livelaps düğümünden (teams/{tid}/livelaps/{rid}/{lapKey}) talep üzerine
   okunur → tüm yarış (300+ tur) kapsanır. En yeni üstte; en hızlı tur mor, out/pit turu
   (best'in %110'undan büyük) soluk. wxmodal desenini yeniden kullanır. */
function LapsModal({ t, tid, rid, row, onClose }) {
  const [lapMap, setLapMap] = useState(null);   // {n: sec} livelaps'ten
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  // açıkken o aracın tüm tur geçmişini dinle (kapanınca abonelik biter)
  useEffect(() => {
    if (!row?.lapKey) { setLapMap(null); return undefined; }
    const off = liveLapsSubscribe(tid, rid, row.lapKey, setLapMap);
    return off;
  }, [tid, rid, row?.lapKey]);
  // {n: sec} → [{n, sec}] sayısal sıralı; en yeni üstte
  const entries = lapMap && typeof lapMap === "object"
    ? Object.entries(lapMap).map(([n, sec]) => ({ n: +n, sec: +sec }))
      .filter((e) => e.sec > 0).sort((a, b) => a.n - b.n)
    : [];
  const best = entries.length ? Math.min(...entries.map((e) => e.sec)) : 0;
  const items = entries.slice().reverse();
  return (
    <div className="wxmodal" onClick={onClose} role="dialog" aria-modal="true">
      <div className="wxmbox" onClick={(e) => e.stopPropagation()}>
        <div className="wxmhead">
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ClassBadge raw={row.carClass} /> {row.driver || "—"}
            <span style={{ fontSize: 12, color: "var(--dim)", textTransform: "none",
              letterSpacing: 0 }}>· {entries.length} {t("tur")}</span>
          </span>
          <button className="act" style={{ fontSize: 12, padding: "2px 10px" }}
            onClick={onClose}>✕</button>
        </div>
        <div className="wxmlist">
          {lapMap == null && <div className="hint">{t("Tur geçmişi yükleniyor…")}</div>}
          {lapMap != null && !items.length && <div className="hint">{t("Henüz tamamlanmış tur yok.")}</div>}
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

/* Tek KPI kutusu — OwnCar gruplarında yeniden kullanılır. */
function Kpi({ v, l, color, mono, fs }) {
  return (
    <div className="kpi">
      <div className={`v${mono ? " mono" : ""}`}
        style={{ ...(color && { color }), ...(fs && { fontSize: fs }) }}>{v}</div>
      <div className="l">{l}</div>
    </div>
  );
}

function OwnCar({ t, own, liveFuelObs }) {
  const [det, setDet] = useState(false);   // "Detay" → ikincil tempo metrikleri
  const cap = own.fuelCapacity > 0 ? own.fuelCapacity : 0;
  const frac = cap ? Math.max(0, Math.min(1, own.fuel / cap)) : 0;
  const veFrac = own.virtualEnergy != null
    ? Math.max(0, Math.min(1, own.virtualEnergy / 100)) : 0;
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
    <div className="card" data-tour="ownlive">
      <h2 style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        🏎 {t("Kendi Araç")}
        {compound && <span className="chip" style={{ fontSize: 11,
          color: compoundColor(tc.front || tc.rear),
          borderColor: compoundColor(tc.front || tc.rear) }}>🛞 {compound}</span>}
        {own.inPits && <span className="chip"
          style={{ color: "var(--yellow)", borderColor: "var(--yellow)", fontSize: 11 }}>PIT</span>}
        <button className={`act${det ? " on" : ""}`}
          style={{ marginLeft: "auto", fontSize: 11, padding: "3px 10px",
            ...(det && { borderColor: "var(--teal)", color: "var(--teal)" }) }}
          onClick={() => setDet((v) => !v)}>{det ? t("Detay ▾") : t("Detay ▸")}</button>
      </h2>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-start" }}>
        {/* VE (Sanal Enerji) yakıttan önemli → önce ve daha büyük, yeşil */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <Ring value={veFrac} size={104} thickness={11} fs={26} color="var(--green)"
            big={own.virtualEnergy != null ? `${Math.round(own.virtualEnergy)}%` : "—"} />
          <div className="l" style={{ color: "var(--dim)", fontSize: 11 }}>VE ({t("Sanal Enerji")})</div>
        </div>
        {/* Yakıt → sarı, biraz küçük */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <Ring value={frac} size={84} thickness={9} fs={20} color="var(--yellow)"
            big={cap ? `${Math.round(frac * 100)}%` : "—"} />
          <div className="l" style={{ color: "var(--dim)", fontSize: 11 }}>
            {t("Yakıt")} {own.fuel != null ? `${own.fuel.toFixed(1)} L` : "—"}
            {cap ? ` / ${cap.toFixed(0)}` : ""}</div>
          {lapsLeft != null && (
            <div className="l" style={{ color: "var(--teal)", fontSize: 11, fontWeight: 600 }}>
              ~{lapsLeft} {t("tur")}</div>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 220, display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="kpigroup">
            <div className="gh">{t("Yarış")}</div>
            <div className="kpigrid">
              <Kpi v={own.position || "—"} l={t("Pozisyon")} />
              <Kpi v={own.lapsDone ?? "—"} l={t("Tur")} />
              <Kpi v={own.pitStops ?? "—"} l={t("Pit")} />
              <Kpi mono v={own.stintSec > 0 ? fmtHMS(own.stintSec) : "—"} l={t("Stint")} />
            </div>
          </div>
          <div className="kpigroup">
            <div className="gh">{t("Tempo")}</div>
            <div className="kpigrid">
              <Kpi mono v={lap(own.lastLapSec)} l={t("Son Tur")} />
              <Kpi mono color="var(--purple)" v={lap(own.bestLapSec)} l={t("En İyi")} />
              {det && <Kpi mono v={own.curLapSec > 0 ? fmtLap(own.curLapSec) : "—"} l={t("Mevcut Tur")} />}
              {det && <Kpi mono fs={15}
                v={<>{sec(own.s1)} <span style={{ color: "var(--dim)" }}>/</span> {sec(own.s2)}</>}
                l="S1 / S2" />}
              {det && <Kpi mono v={lap(own.avg5Sec)} l="AVG5" />}
              {det && <Kpi mono v={lap(own.avgSec)} l="AVG" />}
            </div>
          </div>
          <div className="kpigroup">
            <div className="gh">{t("Durum")}</div>
            <div className="kpigrid">
              <Kpi v={own.damage != null ? `${Math.round(own.damage * 100)}%` : "—"} l={t("Hasar")}
                color={(own.damage || 0) > 0.15 ? "var(--red)"
                  : (own.damage || 0) > 0.02 ? "var(--yellow)" : "var(--txt)"} />
            </div>
          </div>
        </div>
      </div>
      <div className="kpigroup" style={{ marginTop: 10 }}>
        <div className="gh">{t("Lastik & Hasar")}</div>
        <CarDiagram t={t} tyres={ty} damage={own.damage} compound={tc} />
      </div>
      <div className="hint">{t("Lastik: kalan diş % (yeşil→sarı→kırmızı) · sıcaklık · basınç. Gövde tonu = hasar. Köprüden salt-okunur gelir.")}</div>
    </div>
  );
}

/* Canlı köprü durum kartı (yalnız gösterim). Köprü masaüstünde OTOMATİK çalışır
   (App.jsx yönetir): oyunun PC'sinde uygulama açık + owner/editor + yarış seçiliyse
   kendiliğinden bağlanır, koparsa ~4 sn'de bir yeniden dener. Elle başlatma yok. */
function BridgeControl({ t, bridge, canEdit }) {
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
        <span style={{ fontSize: 11, color: "var(--dim)", fontWeight: 400 }}>{t("otomatik")}</span>
      </h2>
      <div className="hint">
        {canEdit
          ? t("Bu bilgisayarda oyun (LMU) açıkken köprü kendiliğinden bağlanır ve canlı timing'i takımla paylaşır. Elle başlatmaya gerek yok; oyun kapalıyken bekler, açılınca otomatik başlar.")
          : t("Köprü otomatik çalışır; veri yazmak için takımda owner/editor olman gerekir (yalnız görüntüleyicisin).")}
      </div>
      {canEdit && bridge?.msg && (
        <div className="hint" style={{ marginTop: 6,
          color: phase === "error" ? "var(--red)" : "var(--dim)" }}>
          • {bridge.msg}
        </div>
      )}
    </div>
  );
}

/* Kompakt üst şerit — eski Seans başlık kartı + Köprü kartını tek ince satırda birleştirir.
   Köprü durumu küçük bir nokta olur; mesaj/detay yalnız tıklayınca açılır (masaüstünde). */
function LiveTopBar({ t, s, conn, ageSec, big, toggleBig, bridge, canEdit, showBridge,
  trackId, demo, onDemo }) {
  const [bExp, setBExp] = useState(false);
  const [imgOk, setImgOk] = useState(true);
  const phase = bridge?.phase || "idle";
  const dot = phase === "running" ? "var(--green)"
    : phase === "error" ? "var(--red)"
      : phase === "starting" ? "var(--yellow)" : "var(--muted)";
  const trackImg = trackId && imgOk ? `${ASSET}tracks/${TRACK_ASSET(trackId)}.png` : "";
  return (
    <div className="livebar">
      <div className="lbtitle">
        {trackImg && <img className="lbtrack" src={trackImg} alt=""
          onError={() => setImgOk(false)} />}
        📡 {t("Canlı Timing")}
        {trackId && <span className="lbtrackname">{trackName(trackId)}</span>}
        {s.sessionType && <span className="chip" style={{ fontSize: 11,
          borderColor: "var(--teal)", color: "var(--teal)", fontWeight: 700 }}>
          {t(s.sessionType)}</span>}
        <span className={`livebadge ${conn.cls}`}><i /> {t(conn.lbl)} · {ageSec}s</span>
        {demo && <span className="demobadge">DEMO</span>}
      </div>
      <div className="lbstats">
        <div className="livestat">
          <b className="disp">{s.flag ? t(s.flag) : (s.phase || "—")}</b>
          <span>{t("Bayrak / Faz")}</span></div>
        <div className="livestat">
          <b className="mono">{s.timeLeftSec != null ? fmtHMS(s.timeLeftSec) : "—"}</b>
          <span>{t("Kalan")}</span></div>
        <div className="livestat">
          <b>{s.trackTemp != null ? `${Math.round(s.trackTemp)}°` : "—"}</b>
          <span>{t("Pist Sıc.")}</span></div>
        <div className="livestat">
          <b>{s.raining ? "🌧" : "☀️"} {s.ambientTemp != null ? `${Math.round(s.ambientTemp)}°` : ""}</b>
          <span>{t("Hava")}</span></div>
      </div>
      <div className="lbright">
        <button className={`act${demo ? " on" : ""}`} title={t("Temsili veri modu")}
          style={{ fontSize: 11, padding: "3px 10px",
            ...(demo && { borderColor: "var(--yellow)", color: "var(--yellow)" }) }}
          onClick={onDemo}>{demo ? t("● Demo") : t("Demo")}</button>
        {showBridge && (
          <span className="lbbridge" title={t("Canlı Köprü")}
            onClick={() => setBExp((v) => !v)}>
            <i style={{ background: dot, boxShadow: `0 0 8px ${dot}` }} /> 🛰</span>
        )}
        {document.fullscreenEnabled && (
          <button className="act" style={{ fontSize: 11, padding: "3px 10px" }}
            onClick={toggleBig}>{big ? t("✕ Küçült") : t("⛶ Büyük Pano")}</button>
        )}
      </div>
      {showBridge && bExp && (
        <div className="hint" style={{ width: "100%", marginTop: 4,
          color: phase === "error" ? "var(--red)" : "var(--dim)" }}>
          🛰 {canEdit
            ? (bridge?.msg || t("Bu bilgisayarda oyun (LMU) açıkken köprü kendiliğinden bağlanır ve canlı timing'i takımla paylaşır. Elle başlatmaya gerek yok."))
            : t("Köprü otomatik çalışır; veri yazmak için takımda owner/editor olman gerekir (yalnız görüntüleyicisin).")}
        </div>
      )}
    </div>
  );
}

export default function LiveTab({ t, live, bridge, canEdit, liveFuelObs, tid, rid, trackId }) {
  const [myClassOnly, setMyClassOnly] = useState(false);
  const [big, setBig] = useState(false);
  const [lapsFor, setLapsFor] = useState(null);   // "+" ile açılan tur listesi satırı
  const [showTeam, setShowTeam] = useState(false); // Pilot ↔ Takım sütun geçişi
  // Saha tablosu: çekirdek sütunlar hep görünür; ikincil sütunlar "Detay" ile açılır
  const [detailed, setDetailed] = useState(() => {
    try { return localStorage.getItem("rm_live_cols") === "1"; } catch { return false; }
  });
  const toggleDetailed = () => setDetailed((v) => {
    const nv = !v;
    try { localStorage.setItem("rm_live_cols", nv ? "1" : "0"); } catch { /* yoksay */ }
    return nv;
  });
  // DEMO modu: oyun/köprü yokken ekranı temsili veriyle doldurur (Firebase'e dokunmaz)
  const [demo, setDemo] = useState(() => {
    try { return localStorage.getItem("rm_live_demo") === "1"; } catch { return false; }
  });
  const [demoLive, setDemoLive] = useState(null);
  const demoT0 = useRef(0);
  const toggleDemo = () => setDemo((v) => {
    const nv = !v;
    try { localStorage.setItem("rm_live_demo", nv ? "1" : "0"); } catch { /* yoksay */ }
    return nv;
  });
  useEffect(() => {
    if (!demo) { setDemoLive(null); demoT0.current = 0; return undefined; }
    if (!demoT0.current) demoT0.current = Date.now();
    const tick = () => {
      const el = 1800 + (Date.now() - demoT0.current) / 1000;   // ~30dk'dan başlat (tur/gap yayılı)
      setDemoLive({ ts: Date.now(), ...demoFrame(el) });
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [demo]);
  const rootRef = useRef(null);
  const playerRowRef = useRef(null);
  const posRef = useRef({});   // sürücü → son pozisyon
  const dirRef = useRef({});   // sürücü → 'up'|'down' (son değişim yönü kalır)
  const srcLive = demo ? demoLive : live;   // effect'ler için demo-farkında kaynak
  // uzun grid'de oyuncu satırını görünür tut (canlı güncellemede)
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    playerRowRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [srcLive?.own?.position, myClassOnly]);
  // pozisyon değişim yönünü izle (kare kare) → ▲/▼ okları
  useEffect(() => {
    const f = Array.isArray(srcLive?.field) ? srcLive.field : [];
    for (const c of f) {
      const prev = posRef.current[c.driver];
      if (prev != null && c.pos > 0 && prev !== c.pos) {
        dirRef.current[c.driver] = prev > c.pos ? "up" : "down";
      }
      if (c.pos > 0) posRef.current[c.driver] = c.pos;
    }
  }, [srcLive?.ts]);
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
    <BridgeControl t={t} bridge={bridge} canEdit={canEdit} />
  ) : null;

  // görüntülenen kaynak: demo açıksa temsili veri, değilse gerçek canlı
  const view = demo ? (demoLive || { ts: Date.now(), ...demoFrame(1800) }) : live;

  if (!view || !view.ts) {
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
          <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="bigbtn" onClick={toggleDemo}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, width: "auto",
                padding: "10px 18px", cursor: "pointer" }}>
              ▶ {t("Temsili Veri (Demo)")}</button>
            {!isTauri && (
              <a className="bigbtn" href={DESKTOP_RELEASE_URL} target="_blank" rel="noopener noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: 8, width: "auto",
                  padding: "10px 18px", textDecoration: "none" }}>
                🖥 {t("Masaüstü Uygulamasını İndir")}</a>
            )}
          </div>
          <div className="hint" style={{ marginTop: 8 }}>
            {t("Demo: oyun olmadan ekranı temsili yarış verisiyle doldurur (yalnız görüntü, takımla paylaşılmaz).")}
          </div>
        </div>
      </div>
    );
  }
  const conn = demo ? { cls: "on", lbl: "demo" } : connOf(view.ts);
  const s = view.session || {};
  const own = view.own || null;
  const fieldAll = Array.isArray(view.field) ? view.field : [];
  const ageSec = Math.max(0, Math.round((Date.now() - view.ts) / 1000));

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

  // bayrak/durum bandı (normal yarışta null) + pano kenar glow sınıfı
  const fs = flagState(s, t);
  // sınıf lejantı: alandaki sınıflar + araç sayısı (pozisyon sırasını koru)
  const classLegend = [];
  const seenCls = new Set();
  for (const c of fieldAll) {
    const id = classId(c.carClass);
    if (id && !seenCls.has(id)) { seenCls.add(id); classLegend.push(c.carClass); }
  }
  const rootCls = [big ? "bigboard" : "", "liveui", fs ? `board-${fs.cls}` : ""]
    .filter(Boolean).join(" ");

  return (
    <div data-tour="livecard" ref={rootRef} className={rootCls}>
      <LiveTopBar t={t} s={s} conn={conn} ageSec={ageSec} big={big} toggleBig={toggleBig}
        bridge={bridge} canEdit={canEdit} showBridge={isTauri && !big} trackId={trackId}
        demo={demo} onDemo={toggleDemo} />

      {fs && <div className={`flagbanner fb-${fs.cls}`}>{fs.label}</div>}

      {!big && <StrategyBar t={t} field={fieldAll} />}

      {/* Kendi Araç (sol) + Pist haritası (sağ) yan yana; dar ekranda alt alta */}
      <div className="panelrow">
        {own && <OwnCar t={t} own={own} liveFuelObs={liveFuelObs} />}
        {s.trackLength > 0 && fieldAll.some((c) => c.posX != null) && (
          <TrackMap t={t} field={fieldAll} trackLength={s.trackLength} />
        )}
      </div>

      <div className="card">
        <h2 style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          🏁 {t("Saha")} ({shown.length})
          {playerClass && (
            <button className={`act${myClassOnly ? " on" : ""}`}
              style={{ marginLeft: "auto", fontSize: 11, padding: "3px 10px",
                ...(myClassOnly && { borderColor: "var(--teal)", color: "var(--teal)" }) }}
              onClick={() => setMyClassOnly((v) => !v)}>
              {myClassOnly ? t("Tüm saha") : t("Kendi sınıfım")}</button>
          )}
          <button className={`act${detailed ? " on" : ""}`}
            title={t("AVG5 · AVG · VE · Δ · Stint · Lastik · Hasar sütunları")}
            style={{ marginLeft: playerClass ? 0 : "auto", fontSize: 11, padding: "3px 10px",
              ...(detailed && { borderColor: "var(--teal)", color: "var(--teal)" }) }}
            onClick={toggleDetailed}>{detailed ? t("Detay ▾") : t("Detay ▸")}</button>
        </h2>
        {classLegend.length > 1 && (
          <div className="clslegend">
            {classLegend.map((cl) => (
              <span key={cl} className="clschip"
                style={{ borderColor: classAccent(cl) || "var(--line)" }}>
                <span className="clsdot" style={{ background: classAccent(cl) || "var(--muted)" }} />
                <ClassBadge raw={cl} />
              </span>
            ))}
          </div>
        )}
        {!shown.length && <div className="hint">{t("Henüz araç verisi yok.")}</div>}
        {shown.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table aria-label={t("Canlı timing tablosu")}>
              <thead><tr>
                <th>#</th>
                <th><button onClick={() => setShowTeam((v) => !v)}
                  title={t("Pilot / Takım değiştir")}
                  style={{ background: "none", border: 0, color: "inherit", font: "inherit",
                    cursor: "pointer", padding: 0, textDecoration: "underline dotted" }}>
                  {showTeam ? t("Takım") : t("Pilot")}</button></th>
                <th>{t("Sınıf")}</th><th>{t("Tur")}</th>
                <th>{t("Son")}</th><th>{t("En İyi")}</th>
                {detailed && <><th>AVG5</th><th>AVG</th><th>VE</th><th>Δ</th></>}
                <th>Gap</th><th>{t("Aralık")}</th><th>{t("Konum")}</th>
                {detailed && <><th>Stint</th><th>{t("Lastik")}</th><th>{t("Hasar")}</th></>}
                <th>Pit</th>
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
                        <span className={c.pos >= 1 && c.pos <= 3 ? `pod pod-${c.pos}` : ""}>
                          {c.pos ?? i + 1}</span>
                        {dirRef.current[c.driver] === "up" && <span
                          style={{ color: "var(--green)", fontSize: 10, marginLeft: 3 }}>▲</span>}
                        {dirRef.current[c.driver] === "down" && <span
                          style={{ color: "var(--red)", fontSize: 10, marginLeft: 3 }}>▼</span>}
                      </td>
                      <td style={{ fontFamily: "'Inter',system-ui,sans-serif", whiteSpace: "nowrap" }}>
                        <Brand manufacturer={c.manufacturer} vehicleName={c.vehicleName} />
                        {c.number != null && <span style={{ color: "var(--dim)", fontSize: 11,
                          marginRight: 5 }}>#{c.number}</span>}
                        {showTeam ? (c.team || c.driver || "—") : (c.driver || "—")}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <ClassBadge raw={c.carClass} />
                        {id && <span style={{ fontSize: 10, marginLeft: 5,
                          color: classPos === 1 ? "var(--yellow)" : "var(--dim)",
                          fontWeight: classPos === 1 ? 700 : 400 }}>P{classPos}</span>}
                      </td>
                      <td>{c.lapsDone ?? "—"}</td>
                      <td>{lap(c.lastSec)}</td>
                      <td style={{ color: isFastest ? "var(--purple)" : "var(--dim)",
                        fontWeight: isFastest ? 700 : 400, whiteSpace: "nowrap" }}>
                        {lap(c.bestSec)}
                        {isFastest && c.bestSec > 0 && <span className="badge-fl">FL</span>}</td>
                      {detailed && <>
                        <td style={{ color: "var(--dim)" }}>{lap(c.avg5Sec)}</td>
                        <td style={{ color: "var(--dim)" }}>{lap(c.avgSec)}</td>
                        <td style={{ color: veColor(c.virtualEnergy), fontSize: 12 }}>
                          {c.virtualEnergy != null ? `${Math.round(c.virtualEnergy)}%` : "—"}</td>
                        <td style={{ color: delta == null ? "var(--dim)"
                          : delta <= 0 ? "var(--green)" : "var(--red)", fontSize: 12 }}>
                          {delta == null ? "—" : `${delta > 0 ? "+" : ""}${delta.toFixed(2)}`}</td>
                      </>}
                      <td>{i === 0 ? t("Lider") : lapsDown >= 1 ? `+${lapsDown} ${t("Tur")}` : gap(c.gapSec)}</td>
                      <td style={{ color: "var(--dim)" }}>{interval != null ? gap(interval) : "—"}</td>
                      <td style={{ fontSize: 11, color: c.location === "PIT" ? "var(--yellow)"
                        : c.location === "GARAGE" ? "var(--red)" : "var(--dim)" }}>
                        {c.location ? t(c.location) : "—"}</td>
                      {detailed && <>
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
                      </>}
                      <td style={{ whiteSpace: "nowrap" }}>
                        {c.inPits && <span className="chip" style={{ marginRight: 4,
                          color: "var(--yellow)", borderColor: "var(--yellow)" }}>PIT</span>}
                        <span style={{ color: "var(--dim)" }}>{c.pitStops ?? "—"}</span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {c.lapsDone > 0 && c.lapKey && (
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
      {!big && !demo && <PosChart t={t} tid={tid} rid={rid} field={fieldAll} />}

      {!demo && lapsFor && <LapsModal t={t} tid={tid} rid={rid} row={lapsFor}
        onClose={() => setLapsFor(null)} />}
    </div>
  );
}
