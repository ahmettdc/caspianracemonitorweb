import { useState, useRef, useEffect } from "react";
import { fmtLap, fmtHMS, fmtGap, WEATHER, wetnessLevel, rainLevel, rubberPct } from "../engine";
import { WetIcon } from "../WetIcon";
import { Ring } from "../components";
import { DESKTOP_RELEASE_URL, ASSET, classId, classAccent, brandKey, manufacturerKey } from "../constants";
import { isTauri } from "../tauriEnv";
import { liveLapsSubscribe, liveSecSubscribe, liveDrvSubscribe, liveTyreSubscribe,
  serverNow } from "../storage";
import { driverAtLap } from "../liveLaps";
import { binKey } from "../trackShape";
import { demoLive } from "../liveDemo";
import { CALIB_WORDS, addSample, thresholdsFrom, exportPayload } from "../wxCalib";
import { tyreTitle, teleStale } from "../tyreInfo";
import { compoundAxles, compoundInfo, parseTyreLog } from "../tyreCompound";
import TrackMap from "./TrackMap";
import PosChart from "./PosChart";
import StrategyBar from "./StrategyBar";

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
/* gap biçimi → engine.fmtGap (taşma düzeltmesi + birim testli) */
const gap = fmtGap;

/* son güncelleme yaşından bağlantı durumu.
   ts SERVER-hizalı yazılır (liveBridge) → burada da serverNow() ile karşılaştırılır;
   yoksa yazan/izleyen PC saat farkı yanlış "bağlantı koptu" veriyordu. */
function connOf(ts) {
  if (!ts) return { cls: "off", lbl: "bağlı değil" };
  const dt = serverNow() - ts;
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

/* Tek hamur ikonu (assets/tyre-compound/<cls>.png) — ClassBadge deseni: ikon
   yüklenmezse renkli disk + harf yedeği. size: ikon yüksekliği (px). */
function CompoundIcon({ info, size }) {
  const [err, setErr] = useState(false);
  if (info.cls && !err) {
    return <img src={`${ASSET}tyre-compound/${info.cls}.png`} alt={info.label}
      style={{ height: size, verticalAlign: "middle" }} onError={() => setErr(true)} />;
  }
  const box = Math.round(size * 0.82);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3,
      verticalAlign: "middle" }}>
      <span style={{ display: "inline-block", width: box, height: box, borderRadius: "50%",
        border: `2px solid ${info.color}`, fontSize: box * 0.55, lineHeight: `${box - 4}px`,
        textAlign: "center", color: info.color, fontWeight: 700 }}>{info.short[0]}</span>
      {!info.cls && <span style={{ fontSize: 11, color: "var(--dim)" }}>{info.short}</span>}
    </span>
  );
}

/* Ön/arka hamur ikon(lar)ı — ön≠arka ise (crossover) iki ikon yan yana. Paylaşımlı
   bellek yalnız ön/arka verir (sol/sağ yok). size: ön ikon yüksekliği. */
function CompoundIcons({ ax }) {
  return (<>
    <CompoundIcon info={ax.front} size={20} />
    {ax.split && <>
      <span style={{ color: "var(--dim)", fontSize: 11 }}>/</span>
      <CompoundIcon info={ax.rear} size={16} />
    </>}
  </>);
}

/* Birleşik LASTİK hücresi: hamur ikonu/ikonları + en kötü aşınma %. Renkli nokta yok,
   pit değişim rozeti yok (o artık "+" tur geçmişinde). Tooltip: hamur (ön/arka) +
   köşe-köşe aşınma. Bayat telemetride soluk. Veri yoksa "—". */
function TyreCell({ c, t }) {
  const ax = compoundAxles(c.tyreComp);
  const stale = teleStale(c.teleLag);
  const wear = c.tyreWear != null ? `%${Math.round(c.tyreWear * 100)}` : null;
  if (!ax && wear == null) return <span style={{ color: "var(--dim)" }}>—</span>;
  const lbl = (info) => (info.cls ? t(info.label) : info.raw);
  const compTitle = ax
    ? (ax.split ? `${t("Ön")}: ${lbl(ax.front)} · ${t("Arka")}: ${lbl(ax.rear)}` : lbl(ax.front))
    : "";
  const title = [compTitle, tyreTitle(c, t)].filter(Boolean).join("\n");
  return (
    <span style={{ opacity: stale ? 0.4 : 1, whiteSpace: "nowrap",
      display: "inline-flex", alignItems: "center", gap: 4 }} title={title}>
      {ax && <CompoundIcons ax={ax} />}
      {wear && <span style={{ color: "var(--dim)", fontSize: 12 }}>{wear}</span>}
    </span>
  );
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
  const [secMap, setSecMap] = useState(null);   // {n: "s1,s2,s3"} livesec'ten
  const [drvMap, setDrvMap] = useState(null);   // {n: "ad"} livedrv'den (SEYREK)
  const [tyreMap, setTyreMap] = useState(null); // {n: "adet|hamur"} livetyre'den (pit turu)
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  // açıkken o aracın tur geçmişini + sektörlerini + pilotlarını dinle
  useEffect(() => {
    if (!row?.lapKey) {
      setLapMap(null); setSecMap(null); setDrvMap(null); setTyreMap(null); return undefined;
    }
    const off1 = liveLapsSubscribe(tid, rid, row.lapKey, setLapMap);
    const off2 = liveSecSubscribe(tid, rid, row.lapKey, setSecMap);
    const off3 = liveDrvSubscribe(tid, rid, row.lapKey, setDrvMap);
    const off4 = liveTyreSubscribe(tid, rid, row.lapKey, setTyreMap);
    return () => { off1(); off2(); off3(); off4(); };
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
      <div className="wxmbox laps" onClick={(e) => e.stopPropagation()}>
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
            const sc = secMap && secMap[n]
              ? String(secMap[n]).split(",").map(Number) : null;
            /* PİLOT (endurance driver swap): livedrv seyrek — o tur için geçerli ad
               ileri doldurmayla bulunur. Bir önceki turdan farklıysa DEĞİŞİM satırı. */
            const drv = driverAtLap(drvMap, n);
            const swap = !!drv && drv !== driverAtLap(drvMap, n - 1);
            const shortDrv = drv ? drv.split(/\s+/).pop() : "";
            /* PİT: bu turda lastik değişimi/durak varsa "N× hamur ikonu" (livetyre). */
            const pit = tyreMap && tyreMap[n] ? parseTyreLog(tyreMap[n]) : null;
            return (
              <div key={n} className="wxrow" style={{ flexWrap: "wrap",
                ...(swap && { borderTop: "1px solid var(--teal)" }) }}>
                <span className="wxnm" style={{ minWidth: 56, color: "var(--dim)" }}>
                  {t("Tur")} {n}</span>
                <span title={drv || undefined} style={{ minWidth: 76, fontSize: 12,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  color: swap ? "var(--teal)" : "var(--dim)",
                  fontWeight: swap ? 700 : 400 }}>
                  {shortDrv || "—"}</span>
                <span className="mono" style={{ fontSize: 15, fontWeight: isBest ? 700 : 500,
                  color: isBest ? "var(--purple)" : isOut ? "var(--yellow)" : "var(--txt)" }}>
                  {fmtLap(sec)}</span>
                <span className="wxat mono">
                  {isBest ? "★" : best > 0 ? `+${(sec - best).toFixed(2)}` : ""}</span>
                {pit && (
                  <span title={pit.n > 0
                    ? `${t("Pit")}: ${pit.n} ${t("lastik")}${pit.comp ? ` · ${pit.comp}` : ""}`
                    : t("Pit (yalnız yakıt/servis)")}
                    style={{ display: "inline-flex", alignItems: "center", gap: 3,
                      fontSize: 11, color: "var(--yellow)" }}>
                    {pit.n > 0 ? <>
                      {pit.n}×
                      {(() => { const info = compoundInfo(pit.comp);
                        return info ? <CompoundIcon info={info} size={16} /> : null; })()}
                    </> : <span className="chip" style={{ fontSize: 10,
                      color: "var(--yellow)", borderColor: "var(--yellow)" }}>PIT</span>}
                  </span>
                )}
                {sc && sc.length === 3 && sc.every((v) => v > 0) && (
                  <span className="mono" style={{ flexBasis: "100%", paddingLeft: 56,
                    fontSize: 11, color: "var(--dim)" }}>
                    S1 {sc[0].toFixed(1)} · S2 {sc[1].toFixed(1)} · S3 {sc[2].toFixed(1)}</span>
                )}
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

/* Sürüş panosu pedal çubuğu — gaz (yeşil) / fren (kırmızı). val 0..1; yoksa "—". */
function PedalBar({ label, val, color }) {
  const has = val != null && Number.isFinite(Number(val));
  const pct = Math.round(Math.max(0, Math.min(1, Number(val) || 0)) * 100);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span className="l" style={{ width: 34, fontSize: 11, color: "var(--dim)" }}>{label}</span>
      <div style={{ flex: 1, height: 10, background: "var(--line)", borderRadius: 5, overflow: "hidden" }}>
        {/* köprü ~2.5 Hz kare atar; geçiş ~kare aralığı (0.4s) + linear → çubuk bir
            sonraki kareye kadar sabit hızla akar (snap+donma yerine akıcı) */}
        <div style={{ width: `${has ? pct : 0}%`, height: "100%", background: color,
          transition: "width .4s linear" }} />
      </div>
      <span className="mono" style={{ width: 38, textAlign: "right", fontSize: 11 }}>
        {has ? `${pct}%` : "—"}</span>
    </div>
  );
}

/* Vites: -1=R, 0=N, 1+=n; veri yoksa "—". */
const gearLabel = (g) => (g == null ? "—" : g === -1 ? "R" : g === 0 ? "N" : String(g));

function OwnCar({ t, own, liveFuelObs }) {
  const cap = own.fuelCapacity > 0 ? own.fuelCapacity : 0;
  const frac = cap ? Math.max(0, Math.min(1, own.fuel / cap)) : 0;
  const veFrac = own.virtualEnergy != null
    ? Math.max(0, Math.min(1, own.virtualEnergy / 100)) : 0;
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
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
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
            {sec(own.s1)} <span style={{ color: "var(--dim)" }}>/</span> {sec(own.s2)}
            <span style={{ color: "var(--dim)" }}>/</span> {sec(own.s3)}</div>
            <div className="l">S1 / S2 / S3</div></div>
          <div className="kpi"><div className="v mono">{lap(own.avg5Sec)}</div>
            <div className="l">AVG5</div></div>
          <div className="kpi"><div className="v mono">{lap(own.avgSec)}</div>
            <div className="l">AVG</div></div>
          <div className="kpi"><div className="v mono">
            {own.stintSec > 0 ? fmtHMS(own.stintSec) : "—"}</div>
            <div className="l">{t("Stint")}</div></div>
        </div>
      </div>
      {/* Sürüş panosu: hız · vites · gaz/fren çubukları · RPM (canlı telemetri) */}
      <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap",
        marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
        <div style={{ textAlign: "center", minWidth: 76 }}>
          <div className="disp" style={{ fontSize: 30, lineHeight: 1 }}>
            {own.speedKph != null ? own.speedKph : "—"}</div>
          <div className="l" style={{ color: "var(--dim)", fontSize: 11 }}>km/h · {t("Hız")}</div>
        </div>
        <div style={{ textAlign: "center", minWidth: 52 }}>
          <div className="disp" style={{ fontSize: 30, lineHeight: 1, color: "var(--teal)" }}>
            {gearLabel(own.gear)}</div>
          <div className="l" style={{ color: "var(--dim)", fontSize: 11 }}>{t("Vites")}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: "1 1 220px", minWidth: 200 }}>
          <PedalBar label={t("Gaz")} val={own.throttle} color="var(--green)" />
          <PedalBar label={t("Fren")} val={own.brake} color="var(--red)" />
          {own.rpmMax > 0 && (() => {
            const r = Math.max(0, Math.min(1, (own.rpm || 0) / own.rpmMax));
            const col = r > 0.92 ? "var(--red)" : r > 0.8 ? "var(--yellow)" : "var(--teal)";
            return (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="l" style={{ width: 34, fontSize: 11, color: "var(--dim)" }}>RPM</span>
                <div style={{ flex: 1, height: 6, background: "var(--line)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${Math.round(r * 100)}%`, height: "100%", background: col,
                    transition: "width .4s linear" }} />
                </div>
                <span className="mono" style={{ width: 46, textAlign: "right", fontSize: 11,
                  color: "var(--dim)" }}>{own.rpm || 0}</span>
              </div>
            );
          })()}
        </div>
      </div>
      {/* Araç üstten görseli + 4 köşede lastik verisi (sıcaklık/basınç/aşınma). */}
      <div style={{ position: "relative", height: 300, margin: "14px auto 0", maxWidth: 360 }}>
        <img src={`${ASSET}cartop/default.png`} alt={t("Kendi Araç")}
          style={{ height: "100%", width: "auto", display: "block", margin: "0 auto" }} />
        {corners.map(([lbl, k]) => {
          const c = ty[k] || {};
          const wear = c.wear != null ? Math.round(c.wear * 100) : null;
          const pos = { fl: { top: 46, left: 4 }, fr: { top: 46, right: 4 },
            rl: { bottom: 46, left: 4 }, rr: { bottom: 46, right: 4 } }[k];
          return (
            <div key={k} style={{ position: "absolute", textAlign: "center",
              minWidth: 54, ...pos }}>
              <div className="mono" style={{ fontSize: 13, fontWeight: 700 }}>
                {c.tempC != null ? `${Math.round(c.tempC)}°` : "—"}</div>
              <div style={{ fontSize: 10, color: "var(--dim)" }}>
                {c.pressKpa != null ? `${Math.round(c.pressKpa)} kPa` : "—"}</div>
              <div style={{ marginTop: 3, display: "inline-block", minWidth: 30,
                padding: "2px 7px", borderRadius: 6, fontWeight: 800, fontSize: 14,
                color: "#0b0708", background: wearColor(c.wear) }}>
                {wear != null ? wear : "—"}</div>
              <div style={{ fontSize: 9, color: "var(--dim)", marginTop: 1 }}>{lbl}</div>
            </div>
          );
        })}
      </div>
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
      : phase === "starting" || phase === "standby" ? "var(--yellow)" : "var(--muted)";
  const writerBy = bridge?.writerBy || "";
  // gizli teşhis: yalnız durum noktasının hover tooltip'inde (arayüzde satır olarak
  // gösterilmez). "VE gelmiyor / veri yok" gibi durumları sessizce açıklar.
  const d = bridge?.diag;
  const diagTitle = d
    ? `paylaşımlı-bellek ${d.shm ? "✓" : "✗"} · araç ${d.cars ?? 0} · LMU-REST ${d.lmu ? "✓" : "✗"} · VE ${d.ve ?? 0}`
    : undefined;
  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <h2 style={{ display: "flex", alignItems: "center", gap: 10 }}>
        🛰 {t("Canlı Köprü")}
        <span title={diagTitle} style={{ width: 9, height: 9, borderRadius: "50%", background: dot,
          boxShadow: `0 0 8px ${dot}`, cursor: diagTitle ? "help" : "default" }} />
        <span style={{ fontSize: 11, color: "var(--dim)", fontWeight: 400 }}>{t("otomatik")}</span>
      </h2>
      {canEdit && phase === "standby" && (
        <div className="hint" style={{ marginTop: 6, color: "var(--yellow)" }}>
          ⏸ {t("Beklemede")}{writerBy ? ` — ${writerBy} ${t("yayınlıyor")}` : ""} · {t("aktif sürücü canlıyı yazıyor")}
        </div>
      )}
      {canEdit && phase === "running" && writerBy && (
        <div className="hint" style={{ marginTop: 6, color: "var(--dim)" }}>
          🛰 {t("Canlı kaynak")}: {writerBy}
        </div>
      )}
      {canEdit && bridge?.msg && phase !== "standby" && (
        <div className="hint" style={{ marginTop: 6,
          color: phase === "error" ? "var(--red)" : "var(--dim)" }}>
          • {bridge.msg}
        </div>
      )}
    </div>
  );
}

const CALIB_KEY = "caspian.wxCalib";

/* 🌦 HAVA KALİBRASYONU — oyundaki KELİMEYİ o anki yüzdeyle damgala.
   Kademe eşiklerimiz (Damp/Slightly Wet/…) TAHMİN: oyun ıslaklığı ne paylaşımlı
   bellekte ne de REST'inde kelime olarak veriyor (yalnız 0..1 sayı) → tek doğrulama
   yolu ölçüm. Kayıt YEREL (localStorage), Firebase'e gitmez; kapalı gelir. */
function WxCalib({ t, s }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(() => {
    try { return JSON.parse(localStorage.getItem(CALIB_KEY)) || []; } catch { return []; }
  });
  const save = (list) => {
    setRows(list);
    try { localStorage.setItem(CALIB_KEY, JSON.stringify(list)); } catch { /* kota / gizli mod */ }
  };
  const dl = () => {
    const body = exportPayload(rows,
      { track: s?.trackName || "", session: s?.sessionType || "" });
    const url = URL.createObjectURL(new Blob([body], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `wx-calib-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const pct = (v) => (v == null || v === "" || !Number.isFinite(Number(v))
    ? "—" : `%${Math.round(Number(v))}`);
  const sum = thresholdsFrom(rows);

  if (!open) {
    return (
      <button className="act" style={{ fontSize: 11, padding: "3px 10px", marginTop: 8 }}
        onClick={() => setOpen(true)}>🌦 {t("Hava Kalibrasyonu")}</button>
    );
  }
  return (
    <div style={{ marginTop: 8, padding: 10, border: "1px solid var(--line)", borderRadius: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <b style={{ fontSize: 12 }}>🌦 {t("Hava Kalibrasyonu")}</b>
        <span className="mono" style={{ fontSize: 15 }}>
          💧 {pct(s?.wetness)} · 🌧 {pct(s?.rain)}</span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <button className="act" style={{ fontSize: 11, padding: "2px 8px" }}
            onClick={dl} disabled={!rows.length}>⬇ {t("Dışa aktar")}</button>
          <button className="act" style={{ fontSize: 11, padding: "2px 8px" }}
            onClick={() => save([])} disabled={!rows.length}>{t("Temizle")}</button>
          <button className="act" style={{ fontSize: 11, padding: "2px 8px" }}
            onClick={() => setOpen(false)}>{t("Kapat")}</button>
        </span>
      </div>
      <div className="hint" style={{ margin: "6px 0" }}>
        {t("Oyundaki zemin durumu yazısı değiştiğinde aynı kelimeye bas — o anın yüzdesi kaydedilir. Birkaç damga sonra dışa aktarıp gönder, eşikleri ölçüme göre düzeltelim.")}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {CALIB_WORDS.map((w) => (
          <button key={w} className="act" style={{ fontSize: 11, padding: "3px 9px" }}
            onClick={() => save(addSample(rows, w, s))}>{w}</button>
        ))}
      </div>
      {sum.length > 0 && (
        <div className="mono" style={{ fontSize: 11, marginTop: 8, color: "var(--dim)" }}>
          {rows.length} {t("damga")} · {sum.map((x) => `${x.word}: %${x.min}–%${x.max} (${x.n})`).join("  |  ")}
        </div>
      )}
    </div>
  );
}

export default function LiveTab({ t, live: liveProp, bridge, canEdit, liveFuelObs, tid, rid }) {
  const [myClassOnly, setMyClassOnly] = useState(false);
  const [big, setBig] = useState(false);
  const [lapsFor, setLapsFor] = useState(null);   // "+" ile açılan tur listesi satırı
  const [showTeam, setShowTeam] = useState(false); // Pilot ↔ Takım sütun geçişi
  // DEMO: yerel sahte veri (oyun/köprü/Firebase gerekmez) — UI düzenlemek için
  const [demo, setDemo] = useState(false);
  const [demoData, setDemoData] = useState(null);
  useEffect(() => {
    if (!demo) { setDemoData(null); return undefined; }
    const t0 = Date.now();
    const tick = () => setDemoData(demoLive((Date.now() - t0) / 1000));
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [demo]);
  const live = demo ? demoData : liveProp;
  const demoBtn = (
    <button className={`act${demo ? " on" : ""}`}
      onClick={() => setDemo((v) => !v)}
      style={{ fontSize: 11, padding: "3px 10px",
        ...(demo && { borderColor: "var(--yellow)", color: "var(--yellow)" }) }}>
      🎬 {demo ? t("Demo kapat") : t("Demo")}</button>
  );
  const rootRef = useRef(null);
  const posRef = useRef({});   // sürücü → son pozisyon
  const dirRef = useRef({});   // sürücü → 'up'|'down' (son değişim yönü kalır)
  /* NOT: Oyuncu satırına otomatik kaydırma (scrollIntoView) KALDIRILDI — biz tur
     atmayınca pozisyon değiştikçe sürekli tetikleniyor ve sayfayı kendiliğinden
     aşağı çekiyordu (kullanıcı şikayeti). Satır zaten vurgulu (className "live"). */
  // pozisyon değişim yönünü izle (kare kare) → ▲/▼ okları
  useEffect(() => {
    const f = Array.isArray(live?.field) ? live.field : [];
    for (const c of f) {
      /* ARAÇ kimliğiyle anahtarla (lapKey): sürücü adı pilot değişiminde değişir ve
         aynı isimli iki araç çakışırdı. */
      const k = c.lapKey || c.driver;
      const prev = posRef.current[k];
      if (prev != null && c.pos > 0 && prev !== c.pos) {
        dirRef.current[k] = prev > c.pos ? "up" : "down";
      }
      if (c.pos > 0) posRef.current[k] = c.pos;
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
    <BridgeControl t={t} bridge={bridge} canEdit={canEdit} />
  ) : null;

  /* Bağlantı durumunu erken-return'den ÖNCE hesapla: veri GELDİKTEN sonra köprü/oyun
     durursa kare tazelenmez → "off" (bağlantı koptu). Bu durumda tam UI'ı eski (bayat)
     veriyle göstermek "açık/canlı" izlenimi veriyordu → boş-durum kartına düşülür.
     "lag" (6-30 sn geçici tık) korunur; kısa hıçkırıkta pano titremesin. */
  const conn = live?.ts ? connOf(live.ts) : { cls: "off", lbl: "bağlı değil" };
  const staleOff = !!live?.ts && conn.cls === "off";
  if (!live || !live.ts || staleOff) {
    const ageSec = live?.ts ? Math.max(0, Math.round((serverNow() - live.ts) / 1000)) : 0;
    const ageTxt = ageSec < 90 ? `${ageSec} ${t("sn")}` : `${Math.round(ageSec / 60)} ${t("dk")}`;
    return (
      <div data-tour="livecard">
        {bridgeCard}
        <div className="card">
          <h2 style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            📡 {t("Canlı Timing")}
            {staleOff && <span className="livebadge off"><i /> {t("çevrimdışı")}</span>}
            <span style={{ marginLeft: "auto" }}>{demoBtn}</span></h2>
          <div className="hint" style={{ lineHeight: 1.7 }}>
            {staleOff
              ? <>⚠ {t("Canlı veri akışı durdu")} — {t("son veri")} {ageTxt} {t("önce")}.{" "}
                {t("Oyun ya da köprü kapanmış olabilir.")}</>
              : isTauri
              ? t("Köprü henüz veri göndermedi. Yukarıdan 'Canlı Köprü Başlat'a bas (oyun açıkken). Yarış başlayınca bu ekran canlı dolar.")
              : <>
                {t("Canlı timing, oyunun çalıştığı PC'deki Masaüstü Uygulaması ile gelir:")}
                <br />1. {t("rFactor2 paylaşımlı bellek eklentisi LMU'da kurulu olmalı (zaten ekte).")}
                <br />2. {t("Masaüstü Uygulamasını oyunun PC'sine kur, giriş yap, yarışı aç, 'Canlı' sekmesinden 'Canlı Köprü Başlat'a bas.")}
                <br />3. {t("Yarış başlayınca bu ekran (ve tüm takım) canlı dolar.")}
              </>}
          </div>
          {!isTauri && !staleOff && (
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
  const s = live.session || {};
  const own = live.own || null;
  const fieldAll = Array.isArray(live.field) ? live.field : [];
  const ageSec = Math.max(0, Math.round((serverNow() - live.ts) / 1000));

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
    /* prevGap >= 0: liderin gapSec'i 0 olduğu için ">0" şartı P2'de yedeği hep
       kapatıyordu (Aralık sütunu "—" kalıyordu). */
    const interval = (c.intervalSec != null && c.intervalSec > 0) ? c.intervalSec
      : (i > 0 && c.gapSec > 0 && prevGap >= 0) ? c.gapSec - prevGap : null;
    /* tur-altı: oyunun YETKİLİ alanı (mLapsBehindLeader). Lider-tur eksi araç-tur
       çıkarması, lider S/F'yi geçip diğeri geçmeden önceki pencerede aynı turdaki
       aracı yanlışlıkla "+1 Tur" gösteriyordu. Köprü vermezse (eski .exe) eskiye düş. */
    const lapsDown = c.lapsBehind != null
      ? Math.max(0, c.lapsBehind) : Math.max(0, leaderLaps - (c.lapsDone ?? 0));
    const lapsDownNext = c.lapsBehindNext != null ? Math.max(0, c.lapsBehindNext) : 0;
    const delta = (c.lastSec > 0 && c.bestSec > 0) ? c.lastSec - c.bestSec : null;
    return { c, i, id, classPos: classCounts[id], interval, lapsDown, lapsDownNext, delta,
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
          <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            {demoBtn}
            {document.fullscreenEnabled && (
              <button className="act" style={{ fontSize: 11, padding: "3px 10px" }}
                onClick={toggleBig}>{big ? t("✕ Küçült") : t("⛶ Büyük Pano")}</button>
            )}
          </span>
        </h2>
        <div className="kpis" style={{ marginBottom: 0 }}>
          <div className="kpi"><div className="v disp">{s.sessionType ? t(s.sessionType) : "—"}</div>
            <div className="l">{t("Seans")}</div></div>
          <div className="kpi"><div className="v disp" style={{
            color: s.flag === "Green" ? "var(--green)"
              : (s.flag === "Yellow" || s.flag === "FCY") ? "var(--yellow)" : undefined }}>
            {s.flag ? t(s.flag) : (s.phase || "—")}
            {s.flag === "Yellow" && s.yellowSectors?.length > 0 && (
              <span style={{ fontSize: 13 }}> S{s.yellowSectors.join("·S")}</span>
            )}</div>
            <div className="l">{t("Bayrak / Faz")}</div></div>
          <div className="kpi"><div className="v mono">
            {s.timeLeftSec != null ? fmtHMS(s.timeLeftSec) : "—"}</div>
            <div className="l">{t("Kalan")}</div></div>
          <div className="kpi"><div className="v">🛣 {s.trackTemp != null ? `${Math.round(s.trackTemp)}°` : "—"}
            <span style={{ fontSize: 13, color: "var(--dim)" }}> {t("pist")}</span></div>
            <div className="l">{t("Pist")} · {t("Ortam")} {s.ambientTemp != null ? `${Math.round(s.ambientTemp)}°` : "—"}</div></div>
          <div className="kpi"><div className="v">
            {/* oyunun kelimesi (yüzde tooltip'te) — sayı yerine ad daha okunur */}
            {(() => {
              const lv = rainLevel(s.rain);
              if (!lv) return s.raining ? `🌧 ${t("Yağmur")}` : `☀️ ${t("Kuru")}`;
              return <span title={`%${Math.round(s.rain)}`}>{lv.ico} {t(lv.lbl)}</span>;
            })()}</div>
            <div className="l">{t("Yağmur")}</div></div>
          <div className="kpi"><div className="v">
            {(() => {
              const id = wetnessLevel(s.wetness);
              if (!id) return "—";
              // ikon HERO (büyük), kelime daha küçük etiket — kullanıcı isteği
              return <span title={`%${Math.round(s.wetness)}`}
                style={{ color: WEATHER[id].col, display: "inline-flex", alignItems: "center", gap: 8 }}>
                <WetIcon id={id} size={34} title={t(WEATHER[id].lbl)} />
                <span style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.05 }}>
                  {t(WEATHER[id].lbl)}</span></span>;
            })()}</div>
            <div className="l">{t("Zemin ıslaklığı")}</div></div>
          {/* Tutuş (rubber) — TinyPedal gibi turlardan MODELLENMİŞ tahmin, gerçek
              okuma değil (title'da "tahmini"). Sahadaki tüm araçların tur toplamı. */}
          <div className="kpi"><div className="v">
            {fieldAll.length > 0
              ? <span title={t("Turlardan modellenmiş tahmin (gerçek okuma değil)")}>
                  🛞 %{rubberPct(s.sessionType, fieldAll.reduce((a, c) => a + (c.lapsDone || 0), 0))}</span>
              : "—"}</div>
            <div className="l">{t("Tutuş")}</div></div>
        </div>
        {canEdit && !big && <WxCalib t={t} s={s} />}
      </div>

      {/* Strateji artık Pist Haritası kutusunun İÇİNDE en üstte (aşağıda topSlot).
          Harita yoksa (trackLength/posX gelmemiş) kaybolmasın diye yedek: bağımsız. */}
      {!big && !(s.trackLength > 0 && fieldAll.some((c) => c.posX != null)) && (
        <StrategyBar t={t} field={fieldAll} />
      )}

      {/* Pist haritası (sol, strateji üstünde) + Kendi Araç (sağ) yan yana */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
        {s.trackLength > 0 && fieldAll.some((c) => c.posX != null) && (
          <div style={{ flex: "1 1 360px", minWidth: 300 }}>
            <TrackMap t={t} field={fieldAll} trackLength={s.trackLength}
              tid={tid} trackKey={binKey(s.trackName, s.trackLength)} canSave={canEdit}
              topSlot={!big ? <StrategyBar t={t} field={fieldAll} embedded /> : null} />
          </div>
        )}
        {own && (
          <div style={{ flex: "1 1 420px", minWidth: 300 }}>
            <OwnCar t={t} own={own} liveFuelObs={liveFuelObs} />
          </div>
        )}
      </div>

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
                <th>#</th>
                <th><button onClick={() => setShowTeam((v) => !v)}
                  title={t("Pilot / Takım değiştir")}
                  style={{ background: "none", border: 0, color: "inherit", font: "inherit",
                    cursor: "pointer", padding: 0, textDecoration: "underline dotted" }}>
                  {showTeam ? t("Takım") : t("Pilot")}</button></th>
                <th>{t("Sınıf")}</th><th>{t("Tur")}</th>
                <th>{t("Son")}</th><th>{t("En İyi")}</th><th>AVG5</th><th>AVG</th>
                <th>VE</th>
                <th>Δ</th><th>Gap</th><th>{t("Aralık")}</th><th>{t("Konum")}</th>
                <th>Stint</th><th>{t("Lastik")}</th>
                <th>{t("Hasar")}</th><th>Pit</th>
                <th aria-label={t("Turlar")}></th>
              </tr></thead>
              <tbody>
                {shown.map(({ c, i, id, classPos, interval, lapsDown, lapsDownNext,
                  delta, isFastest }) => {
                  const acc = classAccent(c.carClass);
                  return (
                    <tr key={c.pos ?? i}
                      className={c.isPlayer ? "live" : ""}
                      style={!c.isPlayer && acc ? { borderLeft: `3px solid ${acc}` } : undefined}>
                      <td className="disp" style={{ fontSize: 15, whiteSpace: "nowrap" }}>
                        {c.pos ?? i + 1}
                        {dirRef.current[c.lapKey || c.driver] === "up" && <span
                          style={{ color: "var(--green)", fontSize: 10, marginLeft: 3 }}>▲</span>}
                        {dirRef.current[c.lapKey || c.driver] === "down" && <span
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
                        fontWeight: isFastest ? 700 : 400 }}>{lap(c.bestSec)}</td>
                      <td style={{ color: "var(--dim)" }}>{lap(c.avg5Sec)}</td>
                      <td style={{ color: "var(--dim)" }}>{lap(c.avgSec)}</td>
                      <td style={{ color: veColor(c.virtualEnergy), fontSize: 12 }}>
                        {c.virtualEnergy != null ? `${Math.round(c.virtualEnergy)}%` : "—"}</td>
                      <td style={{ color: delta == null ? "var(--dim)"
                        : delta <= 0 ? "var(--green)" : "var(--red)", fontSize: 12 }}>
                        {delta == null ? "—" : `${delta > 0 ? "+" : ""}${delta.toFixed(2)}`}</td>
                      <td>{i === 0 ? t("Lider") : lapsDown >= 1 ? `+${lapsDown} ${t("Tur")}` : gap(c.gapSec)}</td>
                      <td style={{ color: "var(--dim)" }}>
                        {lapsDownNext >= 1 ? `+${lapsDownNext} ${t("Tur")}`
                          : interval != null ? gap(interval) : "—"}</td>
                      <td style={{ fontSize: 11, color: c.location === "PIT" ? "var(--yellow)"
                        : c.location === "GARAGE" ? "var(--red)" : "var(--dim)" }}>
                        {c.location ? t(c.location) : "—"}</td>
                      <td className="mono" style={{ color: "var(--dim)", fontSize: 12 }}>
                        {c.stintSec > 0 ? fmtHMS(c.stintSec) : "—"}</td>
                      {/* Lastik (birleşik): hamur ikonu + en kötü aşınma %. Renkli nokta
                          yok. Pit lastik değişimi artık "+" tur geçmişinde. Tooltip'te
                          hamur (ön/arka) + köşe-köşe aşınma; bayat telemetride soluk. */}
                      <td><TyreCell c={c} t={t} /></td>
                      <td style={{ fontSize: 12, color: (c.damage || 0) > 0.15 ? "var(--red)"
                        : (c.damage || 0) > 0.02 ? "var(--yellow)" : "var(--dim)" }}>
                        {c.damage != null ? `${Math.round(c.damage * 100)}%` : "—"}</td>
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
      </div>
      {!big && <PosChart t={t} tid={tid} rid={rid} field={fieldAll} />}

      {lapsFor && <LapsModal t={t} tid={tid} rid={rid} row={lapsFor}
        onClose={() => setLapsFor(null)} />}
    </div>
  );
}
