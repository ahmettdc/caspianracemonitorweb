import { useState, useRef, useEffect } from "react";
import { fmtLap, fmtHMS, fmtGap, WEATHER, wetnessLevel, rainLevel, rubberPct } from "../engine";
import { WetIcon } from "../WetIcon";
import { GripIcon, gripColor } from "../GripIcon";
import { TrackTempIcon } from "../TrackTempIcon";
import { Icon } from "../components";
import { confirmDialog } from "../confirm";
import { DESKTOP_RELEASE_URL, BRIDGE_EXE_URL, ASSET, classId, classAccent, brandKey, manufacturerKey } from "../constants";
import { isTauri } from "../tauriEnv";
import { liveLapsSubscribe, liveSecSubscribe, liveDrvSubscribe, liveTyreSubscribe,
  liveCondSubscribe, liveHistoryClearAll, serverNow } from "../storage";
import { driverAtLap, parseLapCond, capLapEntries } from "../liveLaps";
import { detectFlashes, carKey } from "../liveFlash";
import { binKey } from "../trackShape";
import { demoLive } from "../liveDemo";
import { tyreTitle, teleStale } from "../tyreInfo";
import { compoundAxles, parseTyreLog } from "../tyreCompound";
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
/* son turun S1·S2·S3 sektör süreleri (kompakt). Geçersiz/eksik → "—". */
const secStr = (sc) => (Array.isArray(sc) && sc[0] > 0 && sc[1] > 0 && sc[2] > 0
  ? `${sc[0].toFixed(1)}·${sc[1].toFixed(1)}·${sc[2].toFixed(1)}` : "—");

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

/* Birleşik LASTİK hücresi: hamur ikonu/ikonları (ön/arka) + DÖRT KÖŞE aşınma % (FL·FR /
   RL·RR, renkli 2×2). Köşe-köşe HAMUR oyunda yok (yalnız ön/arka) — bu yüzden 4 köşe
   yalnız AŞINMA için. tyres4 yoksa tek "en kötü" aşınmaya düşer. Bayat telemetride soluk. */
function TyreCell({ c, t, single }) {
  const ax = compoundAxles(c.tyreComp);
  const stale = teleStale(c.teleLag);
  const t4 = Array.isArray(c.tyres4) && c.tyres4.length >= 4 ? c.tyres4 : null;
  const wear = c.tyreWear != null ? `%${Math.round(c.tyreWear * 100)}` : null;
  if (!ax && !t4 && wear == null) return <span style={{ color: "var(--dim)" }}>—</span>;
  const lbl = (info) => (info.cls ? t(info.label) : info.raw);
  const compTitle = ax
    ? (ax.split ? `${t("Ön")}: ${lbl(ax.front)} · ${t("Arka")}: ${lbl(ax.rear)}` : lbl(ax.front))
    : "";
  const title = [compTitle, tyreTitle(c, t)].filter(Boolean).join("\n");
  const pct = (f) => (f != null ? Math.round(f * 100) : "—");
  /* single: fişteki tek-lastik gösterimi → hamur ikonu + tek aşınma/sağlık %
     (en kötü köşe: en düşük değer). */
  if (single) {
    const one = c.tyreWear != null ? c.tyreWear
      : (t4 ? Math.min(...t4.filter((x) => x != null)) : null);
    return (
      <span style={{ opacity: stale ? 0.4 : 1, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 7 }} title={title}>
        {ax && <CompoundIcons ax={ax} />}
        {one != null && <b style={{ color: wearColor(one), fontFamily: "var(--rc-font-display)", fontSize: 12.5 }}>%{Math.round(one * 100)}</b>}
      </span>
    );
  }
  return (
    <span style={{ opacity: stale ? 0.4 : 1, whiteSpace: "nowrap",
      display: "inline-flex", alignItems: "center", gap: 5 }} title={title}>
      {ax && <CompoundIcons ax={ax} />}
      {t4 ? (
        <span style={{ display: "inline-grid", gridTemplateColumns: "auto auto", gap: "0 4px",
          fontSize: 10, lineHeight: 1.15, fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>
          <span style={{ color: wearColor(t4[0]) }}>{pct(t4[0])}</span>
          <span style={{ color: wearColor(t4[1]) }}>{pct(t4[1])}</span>
          <span style={{ color: wearColor(t4[2]) }}>{pct(t4[2])}</span>
          <span style={{ color: wearColor(t4[3]) }}>{pct(t4[3])}</span>
        </span>
      ) : (wear && <span style={{ color: "var(--dim)", fontSize: 12 }}>{wear}</span>)}
    </span>
  );
}

/* Araç markası logosu (assets/brands/<key>.png). Önce LMU katalog manufacturer'ı
   (temiz: "Cadillac"), yoksa vehicleName parser'ı denenir; dosya yoksa gizlenir. */
function Brand({ manufacturer, vehicleName }) {
  const [i, setI] = useState(0);
  const cands = [];
  const push = (k) => { if (k) { const u = `${ASSET}brands/${k}.png`; if (!cands.includes(u)) cands.push(u); } };
  // 1) katalog manufacturer'ının ham normalizasyonu ("Porsche"→porsche, "Mercedes-AMG"→mercedesamg)
  push(manufacturerKey(manufacturer));
  // 2) manufacturer'ı da ALT-DİZE eşle: çok kelimeli adlar ("Chevrolet Corvette Z06"→corvette,
  //    "Ford Mustang"→ford) ham normalizasyonda dosya bulamıyordu → logo hiç çıkmıyordu.
  push(brandKey(manufacturer));
  // 3) son çare: araç modeli adından ("BMW M4 GT3"→bmw)
  push(brandKey(vehicleName));
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
function LapsModal({ t, tid, rid, row, canEdit, demo, onClose }) {
  const [lapMap, setLapMap] = useState(null);   // {n: sec} livelaps'ten
  const [secMap, setSecMap] = useState(null);   // {n: "s1,s2,s3"} livesec'ten
  const [drvMap, setDrvMap] = useState(null);   // {n: "ad"} livedrv'den (SEYREK)
  const [tyreMap, setTyreMap] = useState(null); // {n: "adet|hamur"} livetyre'den (pit turu)
  const [condMap, setCondMap] = useState(null); // {n: "temp,wet,grip"} livecond'dan (pist koşulu)
  const [cleared, setCleared] = useState(false); // v1.6.3 — elle temizleme geri bildirimi
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  // açıkken o aracın tur geçmişini + sektörlerini + pilotlarını dinle
  useEffect(() => {
    if (!row?.lapKey) {
      setLapMap(null); setSecMap(null); setDrvMap(null); setTyreMap(null); setCondMap(null);
      return undefined;
    }
    /* DEMO: Firebase yerine sentetik tur geçmişi üret → "+" penceresinin yeni
       tasarımı gerçek veri olmadan önizlenebilir (best/pit/out lap, pilot değişimi,
       sektör, koşul). Gerçek yarışta bu blok atlanır. */
    if (demo) {
      const done = Math.max(6, row.lapsDone || 46);
      const from = Math.max(1, done - 45);
      const base = row.bestSec || 88.2;
      const main = row.driver || "Kerem Yılmaz";
      const second = "Ahmet Demirci";
      const lm = {}, sm = {}, dm = {}, tm = {}, cm = {};
      dm[from] = second;              // stint 1 (seyrek: yalnız değişim turlarında)
      dm[done - 9] = main;            // pilot değişimi
      for (let nn = from; nn <= done; nn++) {
        const isPit = nn === done - 4, isOut = nn === done - 3, isBest = nn === done - 6;
        let sec = base + 0.4 + Math.abs(Math.sin(nn * 1.3)) * 1.9;
        if (isBest) sec = base;
        if (isPit) sec = base + 64;
        if (isOut) sec = base + 22;
        lm[nn] = +sec.toFixed(3);
        sm[nn] = `${(sec * 0.25).toFixed(1)},${(sec * 0.44).toFixed(1)},${(sec * 0.31).toFixed(1)}`;
        if (isPit) tm[nn] = "4|Medium";
        const temp = 39 - Math.floor((done - nn) / 6);
        const wet = nn < from + 2 ? 62 : nn < from + 4 ? 40 : 0;   // başta ıslak → kuruyor
        const grip = Math.min(96, 71 + (nn - from));
        cm[nn] = `${temp},${wet},${grip}`;
      }
      setLapMap(lm); setSecMap(sm); setDrvMap(dm); setTyreMap(tm); setCondMap(cm);
      return undefined;
    }
    // boş/silinmiş düğüm (null) → {}: "yükleniyor…" yerine "tur yok" göstersin
    const off1 = liveLapsSubscribe(tid, rid, row.lapKey, (v) => setLapMap(v || {}));
    const off2 = liveSecSubscribe(tid, rid, row.lapKey, setSecMap);
    const off3 = liveDrvSubscribe(tid, rid, row.lapKey, setDrvMap);
    const off4 = liveTyreSubscribe(tid, rid, row.lapKey, setTyreMap);
    const off5 = liveCondSubscribe(tid, rid, row.lapKey, setCondMap);
    return () => { off1(); off2(); off3(); off4(); off5(); };
  }, [tid, rid, row?.lapKey, demo, row?.lapsDone, row?.bestSec, row?.driver]);
  /* v1.6.3 — BAYAT-VERİ KORUMASI: yalnız aracın GÜNCEL lapsDone'una kadar olan turlar.
     Araç kimliği (c{mID}) oyun tarafından yeniden kullanıldığından, aynı yarışın önceki
     koşusundan kalan turlar/pilotlar ("Vanthoor" hayaleti) yazıcı temizlemesi ateşlenmediyse
     burada görünüyordu. Cap OKUYUCU tarafında → yazıcının sürümünden bağımsız, tüm
     izleyicilerde anında etkili. row TAZE kareden gelir (LiveTab freshRow lookup) →
     modal açıkken yeni turlar da görünür. */
  const capped = capLapEntries(lapMap, row?.lapsDone);
  // {n: sec} → [{n, sec}] sayısal sıralı; en yeni üstte
  const entries = capped && typeof capped === "object"
    ? Object.entries(capped).map(([n, sec]) => ({ n: +n, sec: +sec }))
      .filter((e) => e.sec > 0).sort((a, b) => a.n - b.n)
    : [];
  const best = entries.length ? Math.min(...entries.map((e) => e.sec)) : 0;
  const avg = entries.length ? entries.reduce((a, e) => a + e.sec, 0) / entries.length : 0;
  const items = entries.slice().reverse();
  /* pilot avatar rengi — ada göre kararlı palet (fişteki DRV_COL karşılığı) */
  const DRVP = ["#4C9AFF", "#F5B23D", "#37D67A", "#B58BFF", "#EF8A2B", "#F0506E", "#22C1C3"];
  const drvColor = (nm) => { const s = String(nm || ""); let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return DRVP[h % DRVP.length]; };
  const initialsOf = (nm) => String(nm || "").trim().split(/\s+/).map((w) => w[0] || "").slice(0, 2).join("").toUpperCase() || "—";
  const clearHistory = async () => {
    if (!(await confirmDialog({ title: t("Tur geçmişini temizle"), message: t("Bu yarışın tüm '+' tur geçmişi silinsin mi? (Yeni turlar yine kaydedilir.)"), confirmText: t("Temizle"), danger: true }))) return;
    try { await liveHistoryClearAll(tid, rid); setCleared(true); } catch { /* yoksay */ }
  };
  return (
    <div onClick={onClose} role="dialog" aria-modal="true"
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(10,6,10,.74)", backdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, animation: "rcfade .18s ease" }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: "min(880px,96vw)", maxHeight: "84vh", background: "var(--rc-surface)", border: "1px solid var(--rc-border-strong)", borderRadius: 16, overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 24px 70px rgba(0,0,0,.6)", animation: "rcpop .24s cubic-bezier(.2,.9,.3,1.1)" }}>
        {/* başlık */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "15px 20px", borderBottom: "1px solid var(--rc-border)", flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--rc-font-display)", textTransform: "uppercase", letterSpacing: ".07em", fontSize: 18, fontWeight: 700 }}>{t("Tur geçmişi")}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--rc-text-2)", marginRight: "auto" }}>{row.number != null ? `#${row.number} · ` : ""}{entries.length} {t("tur")}</span>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 9, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 15, lineHeight: 1 }}>✕</button>
        </div>
        {/* liste */}
        <div style={{ overflowY: "auto" }}>
          {lapMap == null && <div style={{ padding: "16px 20px", color: "var(--rc-text-3)", fontSize: 12.5 }}>{t("Tur geçmişi yükleniyor…")}</div>}
          {lapMap != null && !items.length && <div style={{ padding: "16px 20px", color: "var(--rc-text-3)", fontSize: 12.5 }}>{t("Henüz tamamlanmış tur yok.")}</div>}
          {items.map(({ n, sec }) => {
            const isBest = sec > 0 && sec === best;
            const isOut = best > 0 && sec > best * 1.10;
            const sc = secMap && secMap[n] ? String(secMap[n]).split(",").map(Number) : null;
            const drv = driverAtLap(drvMap, n) || row.driver;
            const swap = !!driverAtLap(drvMap, n) && driverAtLap(drvMap, n) !== driverAtLap(drvMap, n - 1);
            const pit = tyreMap && tyreMap[n] ? parseTyreLog(tyreMap[n]) : null;
            const cond = condMap ? parseLapCond(condMap[n]) : null;
            const condWx = cond && cond.wet != null ? wetnessLevel(cond.wet) : null;
            const tag = swap ? t("Pilot değişimi") : pit ? "PİT" : isOut ? "OUT LAP" : null;
            const tagCol = swap ? "var(--rc-ok)" : "var(--rc-warn)";
            return (
              <div key={n} style={{ display: "flex", alignItems: "center", gap: 14, padding: "9px 20px", borderBottom: "1px solid var(--rc-line-soft)",
                background: isBest ? "rgba(181,139,255,.10)" : (pit || isOut) ? "rgba(245,178,61,.08)" : "transparent" }}>
                <b style={{ fontFamily: "var(--rc-font-display)", fontWeight: 700, fontSize: 15, width: 32, color: "var(--rc-text-3)", flex: "0 0 auto" }}>{n}</b>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7, width: 132, flex: "0 0 auto" }}>
                  <span style={{ width: 20, height: 20, borderRadius: "50%", flex: "0 0 auto", background: drvColor(drv), color: "#0B0708", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 9 }}>{initialsOf(drv)}</span>
                  <span style={{ fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: swap ? "var(--rc-ok)" : "var(--rc-text-2)" }}>{drv || "—"}</span>
                </span>
                <b style={{ fontFamily: "var(--rc-font-display)", fontSize: 14.5, width: 76, flex: "0 0 auto", color: isBest ? "var(--purple)" : (pit || isOut) ? "var(--rc-warn)" : "var(--rc-text)" }}>{fmtLap(sec)}</b>
                <span style={{ fontFamily: "var(--rc-font-display)", fontSize: 12, width: 60, flex: "0 0 auto", color: (pit || isOut) ? "var(--rc-border-strong)" : isBest ? "var(--rc-ok)" : "var(--rc-danger)" }}>{(pit || isOut) ? "—" : isBest ? "−0.00" : `+${(sec - best).toFixed(2)}`}</span>
                <span title="S1 · S2 · S3" style={{ fontFamily: "var(--rc-font-display)", fontSize: 11.5, color: "var(--rc-text-3)", flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sc && sc.length === 3 && sc.every((v) => v > 0) ? `${sc[0].toFixed(1)} · ${sc[1].toFixed(1)} · ${sc[2].toFixed(1)}` : ""}</span>
                {/* etiket (OUT LAP / PİT / Pilot değişimi) KOŞUL bloğunun SOLUNDA:
                    böylece koşul (sıcaklık/tutuş/ıslaklık) tüm satırlarda sağda hizalı
                    kalır, etiketli satırlarda kayma olmaz. */}
                {tag && <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".08em", padding: "2px 9px", borderRadius: 99, flex: "0 0 auto", whiteSpace: "nowrap", border: `1px solid ${tagCol}`, color: tagCol }}>{tag}</span>}
                <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "flex-end", gap: 9, flex: "0 0 auto", width: 150, fontSize: 11, color: "var(--rc-text-3)" }}>
                  {cond && (<>
                    {cond.temp != null && <span title={t("Asfalt sıcaklığı")} style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><TrackTempIcon temp={cond.temp} size={12} /> {cond.temp}°</span>}
                    {cond.grip != null && <span title={t("Yol tutuş")} style={{ color: gripColor(cond.grip) }}>%{cond.grip}</span>}
                    {cond.wet != null && (condWx
                      ? <span title={t("Zemin ıslaklığı")} style={{ display: "inline-flex", alignItems: "center", gap: 3, color: WEATHER[condWx].col }}><WetIcon id={condWx} size={12} /> {t(WEATHER[condWx].lbl)}</span>
                      : <span title={t("Zemin ıslaklığı")}>💧 %{cond.wet}</span>)}
                  </>)}
                </span>
              </div>
            );
          })}
        </div>
        {/* alt: en hızlı · ortalama + temizle */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderTop: "1px solid var(--rc-border)", background: "var(--rc-surface-2)" }}>
          <span style={{ fontSize: 11.5, color: "var(--rc-text-3)" }}>{t("En hızlı")} <b style={{ fontFamily: "var(--rc-font-display)", color: "var(--purple)" }}>{best > 0 ? fmtLap(best) : "—"}</b> · {t("ortalama")} <b style={{ fontFamily: "var(--rc-font-display)", color: "var(--rc-text)" }}>{avg > 0 ? fmtLap(avg) : "—"}</b></span>
          {cleared && <span style={{ color: "var(--rc-ok)", fontSize: 11.5 }}>✓ {t("temizlendi")}</span>}
          {canEdit && tid && rid && (
            <button onClick={clearHistory} title={t("Bu yarışın '+' tur geçmişini (eski koşulardan kalan turlar/pilotlar) sıfırla")}
              style={{ marginLeft: "auto", padding: "8px 14px", borderRadius: 9, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 12 }}><Icon name="sil" size={14} /> {t("Tur geçmişini temizle")}</button>
          )}
        </div>
      </div>
    </div>
  );
}

/* Vites: -1=R, 0=N, 1+=n; veri yoksa "—". */
const gearLabel = (g) => (g == null ? "—" : g === -1 ? "R" : g === 0 ? "N" : String(g));

function OwnCar({ t, own, liveFuelObs, topSrc = "" }) {
  const corners = [["FL", "fl"], ["FR", "fr"], ["RL", "rl"], ["RR", "rr"]];
  const ty = own.tyres || {};
  const acc = classAccent(own.carClass);
  const clsRaw = own.carClass || "";
  // Mevcut yakıtla ~kaç tur kaldığı — App'in canlı öğrenicisinden (litre/tur).
  const lpl = liveFuelObs?.litersPerLap;
  const lapsLeft = (lpl > 0 && own.fuel > 0) ? Math.floor(own.fuel / lpl) : null;
  const tempCol = (v) => (v == null ? "var(--dim)" : v > 100 ? "var(--red)" : v > 92 ? "var(--yellow)" : "var(--green)");
  const name = [own.number != null ? `#${own.number}` : "", own.driver || t("Kendi Araç")].filter(Boolean).join(" ");
  const statBox = { background: "var(--rc-surface-3)", border: "1px solid var(--rc-border)", borderRadius: 10, padding: "10px 12px" };
  const statV = (col) => ({ fontFamily: "var(--rc-font-display)", fontSize: 20, fontWeight: 600, ...(col ? { color: col } : {}) });
  const statL = { color: "var(--rc-text-3)", fontSize: 10, textTransform: "uppercase", letterSpacing: ".08em", marginTop: 3 };
  const pedal = (label, val, color) => {
    const pct = Math.round(Math.max(0, Math.min(1, Number(val) || 0)) * 100);
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 40, fontSize: 10, color: "var(--rc-text-3)", textTransform: "uppercase", letterSpacing: ".08em" }}>{label}</span>
        <div style={{ flex: 1, height: 8, background: "var(--rc-line-soft)", borderRadius: 4, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${val != null ? pct : 0}%`, background: color, transition: "width .4s linear" }} />
        </div>
      </div>
    );
  };
  // v2.1 — handoff-spec/ekranlar/02-canli-timing.md #55 kartı: lastik ızgarası + araç
  // görseli + istatistik kutuları + hız/vites/pedal. Veriler canlı own'dan.
  return (
    <div data-tour="ownlive" style={{ border: "1px solid var(--rc-border-strong)", borderRadius: 12,
      background: "radial-gradient(120% 160% at 100% 0,rgba(150,0,24,.20),var(--rc-surface-2) 62%)", padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ fontFamily: "var(--rc-font-display)", textTransform: "uppercase", letterSpacing: ".08em", fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
        {own.inPits && <span className="chip" style={{ color: "var(--yellow)", borderColor: "var(--yellow)", fontSize: 10 }}>PIT</span>}
        {clsRaw && <span style={{ marginLeft: "auto", fontSize: 10, padding: "2px 8px", borderRadius: 99, border: `1px solid ${acc || "var(--rc-border-strong)"}`, color: acc || "var(--rc-text-3)" }}>{clsRaw.toUpperCase()}</span>}
      </div>
      {/* Lastik ızgarası + orta araç görseli */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 62px 1fr", gap: "8px 12px", alignItems: "center", marginBottom: 12 }}>
        {corners.map(([lbl, k], idx) => {
          const c = ty[k] || {};
          const left = idx % 2 === 0;
          const wear = c.wear != null ? Math.round(c.wear * 100) : null;
          return (
            <div key={k} style={{ gridColumn: left ? 1 : 3, gridRow: idx < 2 ? 1 : 2, background: "var(--rc-surface-3)", border: "1px solid var(--rc-border)", borderRadius: 9, padding: "7px 9px", textAlign: left ? "left" : "right" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: left ? "flex-start" : "flex-end" }}>
                {left && <span style={{ fontSize: 9.5, color: "var(--rc-text-3)", letterSpacing: ".09em", fontFamily: "var(--rc-font-display)" }}>{lbl}</span>}
                <b style={{ fontFamily: "var(--rc-font-display)", fontSize: 17, fontWeight: 700, lineHeight: 1, color: wearColor(c.wear) }}>{wear != null ? `%${wear}` : "—"}</b>
                {!left && <span style={{ fontSize: 9.5, color: "var(--rc-text-3)", letterSpacing: ".09em", fontFamily: "var(--rc-font-display)" }}>{lbl}</span>}
              </div>
              <div style={{ display: "flex", gap: 7, marginTop: 3, whiteSpace: "nowrap", fontFamily: "var(--rc-font-display)", fontSize: 11.5, justifyContent: left ? "flex-start" : "flex-end" }}>
                <span style={{ color: tempCol(c.tempC) }} title={t("İç lastik sıcaklığı")}>{c.tempC != null ? `${Math.round(c.tempC)}°` : "—°"}</span>
                <span style={{ color: "var(--rc-text-3)" }} title={t("Lastik basıncı")}>{c.pressKpa != null ? Math.round(c.pressKpa) : "—"}<span style={{ fontSize: 9 }}> kPa</span></span>
              </div>
            </div>
          );
        })}
        <img src={topSrc || `${ASSET}cartop/default.png`} alt=""
          onError={(e) => { if (!e.currentTarget.dataset.fb) { e.currentTarget.dataset.fb = "1"; e.currentTarget.src = `${ASSET}cartop/default.png`; } }}
          style={{ gridColumn: 2, gridRow: "1 / span 2", width: 62, height: 128, objectFit: "contain", display: "block", filter: "drop-shadow(0 6px 16px rgba(0,0,0,.5))" }} />
      </div>
      {/* İstatistik kutuları */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={statBox}><div style={statV("var(--purple)")}>{lap(own.bestLapSec)}</div><div style={statL}>{t("En iyi")}</div></div>
        <div style={statBox}><div style={statV()}>{lap(own.lastLapSec)}</div><div style={statL}>{t("Son tur")}</div></div>
        <div style={statBox}><div style={statV("var(--rc-warn)")}>{own.fuel != null ? `${own.fuel.toFixed(1)} L` : "—"}</div><div style={statL}>{t("Yakıt")}{lapsLeft != null ? ` · ~${lapsLeft} ${t("tur")}` : ""}</div></div>
        <div style={statBox}><div style={statV()}>{own.stintSec > 0 ? fmtHMS(own.stintSec) : "—"}</div><div style={statL}>{t("Stint süresi")}</div></div>
      </div>
      {/* Hız · vites · pedal */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
        <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: 66, height: 52, borderRadius: 11, border: "1px solid var(--rc-border-strong)", background: "var(--rc-surface-3)" }}>
          <span style={{ fontFamily: "var(--rc-font-display)", fontSize: 26, fontWeight: 700, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{own.speedKph != null ? own.speedKph : "—"}</span>
          <span style={{ fontSize: 9, color: "var(--rc-text-3)", textTransform: "uppercase", letterSpacing: ".09em" }}>km/h</span>
        </div>
        <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: 52, height: 52, borderRadius: 11, border: "1px solid var(--rc-border-strong)", background: "var(--rc-surface-3)" }}>
          <span style={{ fontFamily: "var(--rc-font-display)", fontSize: 26, fontWeight: 700, lineHeight: 1, color: "var(--rc-brand-bright)" }}>{gearLabel(own.gear)}</span>
          <span style={{ fontSize: 9, color: "var(--rc-text-3)", textTransform: "uppercase", letterSpacing: ".09em" }}>{t("Vites")}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 7 }}>
          {pedal(t("Gaz"), own.throttle, "var(--green)")}
          {pedal(t("Fren"), own.brake, "var(--red)")}
        </div>
      </div>
    </div>
  );
}

/* Canlı köprü durum kartı (yalnız gösterim). Köprü masaüstünde OTOMATİK çalışır
   (App.jsx yönetir): oyunun PC'sinde uygulama açık + owner/editor + yarış seçiliyse
   kendiliğinden bağlanır, koparsa ~4 sn'de bir yeniden dener. Elle başlatma yok. */
function BridgeControl({ t, bridge, canBridge, canEdit, tid, rid }) {
  const phase = bridge?.phase || "idle";
  const [cleared, setCleared] = useState(false);
  const dot = phase === "running" ? "var(--green)"
    : phase === "error" ? "var(--red)"
      : phase === "starting" || phase === "standby" ? "var(--yellow)" : "var(--muted)";
  const writerBy = bridge?.writerBy || "";
  // gizli teşhis: yalnız durum noktasının hover tooltip'inde (arayüzde satır olarak
  // gösterilmez). "VE gelmiyor / veri yok" gibi durumları sessizce açıklar.
  const d = bridge?.diag;
  const diagTitle = d
    ? `eklenti ${d.shm ? `✓${d.shmVersion ? ` v${d.shmVersion}` : ""}` : "✗"} · araç ${d.cars ?? 0} · LMU-REST ${d.lmu ? "✓" : "✗"} · VE ${d.ve ?? 0}`
    : undefined;
  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <h2 style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 0 10px", fontFamily: "var(--rc-font-display)", textTransform: "uppercase", letterSpacing: ".08em", fontSize: 16, fontWeight: 700 }}>
        <Icon name="kopru" size={16} /> {t("Canlı Köprü")}
        <span title={diagTitle} style={{ width: 9, height: 9, borderRadius: "50%", background: dot,
          boxShadow: `0 0 8px ${dot}`, cursor: diagTitle ? "help" : "default" }} />
        <span style={{ fontSize: 11, color: "var(--dim)", fontWeight: 400 }}>{t("otomatik")}</span>
      </h2>
      {canBridge && phase === "standby" && (
        <div className="hint" style={{ marginTop: 6, color: "var(--yellow)" }}>
          <Icon name="duraklat" size={14} /> {t("Beklemede")}{writerBy ? ` — ${writerBy} ${t("yayınlıyor")}` : ""} · {t("aktif sürücü canlıyı yazıyor")}
        </div>
      )}
      {canBridge && phase === "running" && writerBy && (
        <div className="hint" style={{ marginTop: 6, color: "var(--dim)" }}>
          <Icon name="kopru" size={14} /> {t("Canlı kaynak")}: {writerBy}
        </div>
      )}
      {canBridge && bridge?.msg && phase !== "standby" && (
        <div className="hint" style={{ marginTop: 6,
          color: phase === "error" ? "var(--red)" : "var(--dim)" }}>
          • {t(bridge.msg)}
        </div>
      )}
      {/* PERFORMANS (v1.4.97): oyun eklentisi bizim OKUMADIĞIMIZ buffer'ları da yazıyorsa
          (FFB+Graphics saniyede 400'er kez) oyunda takılma yapar. Ayarı biz YAZMAYIZ —
          başka araçların (CrewChief/SimHub/TinyPedal) ihtiyacını bilemeyiz; öneririz. */}
      {canBridge && d?.plugin?.wastedFps > 0 && d.plugin.suggest != null && (
        <div className="hint warn" style={{ marginTop: 6 }}>
          <Icon name="simsek" size={14} /> {t("Oyun eklentisi saniyede")} ~{d.plugin.wastedFps} {t("kez bu uygulamanın okumadığı veriyi yazıyor")}
          {" "}({d.plugin.wasted.join(", ")}) — {t("bu, oyunda takılmaya yol açar.")}
          {" "}<b>CustomPluginVariables.JSON</b> → <code>UnsubscribedBuffersMask: {d.plugin.suggest}</code>
          {" "}<CopyBtn text={String(d.plugin.suggest)} t={t} />
          <div style={{ marginTop: 2 }}>
            {t("Oyunu kapatıp değiştir, sonra aç. Diğer araçların bu veriye ihtiyaç duyabilir — en güvenli değerle başla.")}
          </div>
        </div>
      )}
      {/* v1.6 — "+" tur geçmişini elle temizle: aynı takvim yarışını TEKRAR koşarken
          köprü yarış ORTASINDA açıldıysa oto-temizleme ateşlenmez (lapsDone>0). Bu düğme
          o rid'in tüm canlı geçmişini (livelaps/pos/sec/drv/tyre/cond) sıfırlar. Yalnız
          owner/editor; yeni turlar normal birikmeye devam eder. */}
      {canEdit && tid && rid && (
        <div className="hint" style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
          <button className="act" style={{ fontSize: 11, padding: "3px 8px" }}
            title={t("Bu yarışın '+' tur geçmişini (eski koşulardan kalan turlar/pilotlar) sıfırla")}
            onClick={async () => {
              if (!(await confirmDialog({ title: t("Tur geçmişini temizle"), message: t("Bu yarışın tüm '+' tur geçmişi silinsin mi? (Yeni turlar yine kaydedilir.)"), confirmText: t("Temizle"), danger: true }))) return;
              try { await liveHistoryClearAll(tid, rid); setCleared(true); setTimeout(() => setCleared(false), 2500); }
              catch { /* yoksay */ }
            }}><Icon name="sil" size={12} /> {t("Tur geçmişini temizle")}</button>
          {cleared && <span style={{ color: "var(--green)" }}>✓ {t("temizlendi")}</span>}
        </div>
      )}
    </div>
  );
}

/* Küçük kopyala düğmesi — panoya yaz + kısa geri bildirim (köprü ayar değeri için). */
function CopyBtn({ text, t }) {
  const [ok, setOk] = useState(false);
  return (
    <button className="act" style={{ fontSize: 10, padding: "1px 6px" }}
      onClick={() => {
        try {
          navigator.clipboard?.writeText(text);
          setOk(true);
          setTimeout(() => setOk(false), 1500);
        } catch { /* pano yok (izin/eski tarayıcı) — değer zaten ekranda yazılı */ }
      }}>{ok ? `✓ ${t("kopyalandı")}` : `⧉ ${t("kopyala")}`}</button>
  );
}

export default function LiveTab({ t, live: liveProp, bridge, canEdit, canBridge = false,
  liveFuelObs, lapCapture, tid, rid,
  isAdmin = false, ownTopSrc = "" }) {
  const [myClassOnly, setMyClassOnly] = useState(false);
  const [big, setBig] = useState(false);
  const [lapsFor, setLapsFor] = useState(null);   // "+" ile açılan tur listesi satırı
  const [showTeam, setShowTeam] = useState(false); // Pilot ↔ Takım sütun geçişi
  const [lapMode, setLapMode] = useState(false);   // Son ↔ En İyi tek sütun geçişi
  const [avgMode, setAvgMode] = useState(false);   // AVG5 ↔ AVG tek sütun geçişi
  const [gapMode, setGapMode] = useState(false);   // Gap ↔ Aralık tek sütun geçişi
  const [side, setSide] = useState(true);          // sağ yan panel (harita/kendi araç/strateji) aç/kapa
  const [cmpCar, setCmpCar] = useState(null);      // satıra tıklayınca kendi pilotla karşılaştırma
  // DEMO: yerel sahte veri (oyun/köprü/Firebase gerekmez) — UI düzenlemek için
  const [demo, setDemo] = useState(false);
  const [demoData, setDemoData] = useState(null);
  const demoOn = demo;
  useEffect(() => {
    if (!demoOn) { setDemoData(null); return undefined; }
    const t0 = Date.now();
    const tick = () => setDemoData(demoLive((Date.now() - t0) / 1000));
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [demoOn]);
  const live = demoOn ? demoData : liveProp;
  /* 🎬 Demo düğmesi yalnız adminlerde: normal kullanıcılar için gizlenir. */
  const demoBtn = isAdmin ? (
    <button className={`act${demo ? " on" : ""}`}
      onClick={() => setDemo((v) => !v)}
      style={{ fontSize: 11, padding: "3px 10px",
        ...(demo && { borderColor: "var(--yellow)", color: "var(--yellow)" }) }}>
      <Icon name="kayit" size={13} /> {demo ? t("Demo kapat") : t("Demo")}</button>
  ) : null;
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
  // Satır flash: bestSec iyileşince MOR (sınıf rekoru) / YEŞİL (kişisel rekor) yak.
  const bestRef = useRef({});          // aracKey → son bestSec (kare kare karşılaştır)
  const flashTimers = useRef({});      // aracKey → temizleme timer'ı
  const [flash, setFlash] = useState({});   // aracKey → "purple" | "green"
  useEffect(() => {
    const { flashes, nextBest } = detectFlashes(
      Array.isArray(live?.field) ? live.field : [], bestRef.current);
    bestRef.current = nextBest;
    const keys = Object.keys(flashes);
    if (!keys.length) return;
    setFlash((f) => ({ ...f, ...flashes }));
    for (const k of keys) {
      if (flashTimers.current[k]) clearTimeout(flashTimers.current[k]);
      flashTimers.current[k] = setTimeout(() => {
        setFlash((f) => { const n = { ...f }; delete n[k]; return n; });
        delete flashTimers.current[k];
      }, 5100);   // CSS animasyonu (5 sn) + küçük tampon
    }
  }, [live?.ts]);
  useEffect(() => () => {   // unmount: bekleyen timer'ları temizle
    for (const k of Object.keys(flashTimers.current)) clearTimeout(flashTimers.current[k]);
  }, []);
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
    <BridgeControl t={t} bridge={bridge} canBridge={canBridge}
      canEdit={canEdit} tid={tid} rid={rid} />
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
        {/* v2.0 boş durum (handoff 02-canli-timing · noFeed) — gerçek içerik korundu */}
        <div style={{ border: "1px solid var(--rc-border)", borderRadius: 12, background: "var(--rc-surface)", padding: "52px 24px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="var(--rc-border-strong)" strokeWidth="1.6" strokeLinecap="round">
            <path d="M4.6 8a10 10 0 0 1 14.8 0M7.6 11a6 6 0 0 1 8.8 0" />
            <circle cx="12" cy="15" r="1.7" fill="var(--rc-border-strong)" stroke="none" />
            <path d="M3 3l18 18" stroke="var(--rc-warn)" strokeWidth="1.8" />
          </svg>
          <div style={{ fontFamily: "var(--rc-font-display)", fontWeight: 700, fontSize: 20, letterSpacing: ".02em" }}>
            {staleOff ? t("Canlı veri akışı durdu") : t("Canlı veri gelmiyor")}</div>
          <div style={{ fontSize: 12.5, color: "var(--rc-text-3)", lineHeight: 1.7, maxWidth: 460 }}>
            {staleOff
              ? <>{t("Oyun ya da köprü kapanmış olabilir.")} {t("Sürüş PC'sinde köprüyü başlat; bağlanınca saha tablosu kendiliğinden dolar.")}</>
              : isTauri
              ? t("Köprü henüz veri göndermedi. Yukarıdan 'Canlı Köprü Başlat'a bas (oyun açıkken). Yarış başlayınca bu ekran canlı dolar.")
              : t("Köprü çalışmıyor ya da oyun seansta değil. Canlı timing, oyunun çalıştığı PC'deki Masaüstü Uygulaması ile gelir; kur, giriş yap, yarışı aç ve 'Canlı Köprü Başlat'a bas.")}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginTop: 4 }}>
            {!isTauri ? (<>
              <a href={DESKTOP_RELEASE_URL} target="_blank" rel="noopener noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 18px", borderRadius: 10, border: "1px solid var(--rc-brand-bright)", background: "var(--rc-brand)", color: "var(--rc-on-brand)", cursor: "pointer", fontSize: 13, fontWeight: 600, textDecoration: "none" }}><Icon name="masaustu" size={14} /> {t("Masaüstü Uygulamasını İndir")}</a>
              <a href={BRIDGE_EXE_URL} target="_blank" rel="noopener noreferrer"
                title={t("Oyunun çalıştığı PC için: tarayıcı motoru yok → oyunu yormaz.")}
                style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 16px", borderRadius: 10, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 13, textDecoration: "none" }}><Icon name="tuy" size={14} /> {t("Hafif Köprüyü İndir (.exe)")}</a>
            </>) : demoBtn}
            {!isTauri && demoBtn}
          </div>
          {staleOff && !!live?.ts && (
            <div style={{ fontSize: 11, color: "var(--rc-border-strong)", fontFamily: "var(--rc-font-display)", marginTop: 2 }}>
              {t("son veri")} {ageTxt} {t("önce")}</div>
          )}
        </div>
      </div>
    );
  }
  const s = live.session || {};
  const isRace = s.sessionType === "Yarış";   // pozisyon grafiği yalnız YARIŞ seansında anlamlı
  const own = live.own || null;
  const fieldAll = Array.isArray(live.field) ? live.field : [];
  /* KARŞILAŞTIRMA: kendi pilot satırı (meRow) varsa başka satıra tıklayınca alt
     tepside kendi pilotumuzla kıyaslanır. cmpCar snapshot; taze kareden tazelenir. */
  const meRow = fieldAll.find((c) => c.isPlayer) || null;
  const cmpFresh = cmpCar
    ? (fieldAll.find((c) => carKey(c) === carKey(cmpCar)) || cmpCar) : null;
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
    return { c, i, id, classPos: classCounts[id], interval, lapsDown, lapsDownNext,
      isFastest: c.bestSec > 0 && c.bestSec === fastestBest };
  });
  const shown = myClassOnly && playerClass
    ? rows.filter((r) => r.id === playerClass) : rows;
  /* Gap mini-çubuğu ölçeği (fişteki barFill görseli): en büyük gap'e göre orantı. */
  const maxGap = Math.max(1, ...shown.map((r) => r.c.gapSec || 0));
  /* Tıklanabilir sütun başlığı stili (Pilot↔Takım, Sınıf süzgeci, Son↔En İyi, AVG5↔AVG). */
  const thBtn = { background: "none", border: 0, color: "inherit", font: "inherit",
    cursor: "pointer", padding: 0, textDecoration: "underline dotted" };

  /* Bayrak rengi (canlı s.flag'a bağlı, salt-okunur) */
  const flagCol = s.flag === "Green" ? "var(--rc-ok)"
    : (s.flag === "Yellow" || s.flag === "FCY") ? "var(--rc-warn)" : "var(--rc-text-2)";
  const clsCount = Object.keys(classCounts).length;
  const hchip = { display: "inline-flex", alignItems: "center", gap: 7 };
  const hchipV = { fontFamily: "var(--rc-font-display)", fontSize: 17, fontWeight: 700, lineHeight: 1 };
  return (
    <div data-tour="livecard" ref={rootRef} className={big ? "bigboard" : ""}>
      {!big && bridgeCard}
      {/* v2.1 — handoff-spec/ekranlar/02-canli-timing.md: 2 kolon (sol: Saha başlık +
          tablo + pozisyon grafiği · sağ: harita/kendi araç/strateji yan paneli).
          Görsel düzen fişle birebir; TÜM veriler canlı köprüden gelir (mock değil). */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start", animation: "rcin .26s ease-out" }}>

        {/* ================= SOL: SAHA + TABLO + GRAFİK ================= */}
        <div style={{ flex: "1 1 720px", minWidth: 0, border: "1px solid var(--rc-border)", borderRadius: 12, background: "var(--rc-surface)", overflow: "hidden" }}>

          {/* Saha başlık çubuğu (bayrak · sıcaklık · yağış · ıslaklık · tutuş) */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: "1px solid var(--rc-border)", flexWrap: "wrap" }}>
            <span style={{ fontFamily: "var(--rc-font-display)", textTransform: "uppercase", letterSpacing: ".08em", fontSize: 15, fontWeight: 700 }}>{t("Saha")}</span>
            <span style={{ color: "var(--rc-text-3)", fontSize: 12 }}>{fieldAll.length} {t("araç")} · {clsCount} {t("sınıf")}</span>
            <span className={`livebadge ${conn.cls}`} data-tour="liveconn"><i /> {t(conn.lbl)} · {ageSec}s</span>

            <span style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", paddingLeft: 16, marginLeft: 2, borderLeft: "1px solid var(--rc-border)" }}>
              <span style={{ ...hchip, color: flagCol }} title={t("Bayrak / Faz")}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" style={{ flex: "0 0 auto" }}><path d="M5.6 3.2v17.6" stroke="var(--rc-border-hi)" strokeWidth="1.8" strokeLinecap="round" /><path d="M7 4.4c3.4-1.8 6.8 1.8 10.2 0v7.8c-3.4 1.8-6.8-1.8-10.2 0V4.4Z" fill={flagCol} opacity=".9" /></svg>
                <span style={{ ...hchipV, color: flagCol }}>{s.flag ? t(s.flag) : (s.phase || "—")}{s.flag === "Yellow" && s.yellowSectors?.length > 0 ? ` S${s.yellowSectors.join("·S")}` : ""}</span>
              </span>
              <span style={hchip} title={t("Kalan")}>
                <span style={{ fontSize: 10, color: "var(--rc-text-3)", textTransform: "uppercase", letterSpacing: ".08em" }}>{t("Kalan")}</span>
                <span style={hchipV}>{s.timeLeftSec != null ? fmtHMS(s.timeLeftSec) : "—"}</span>
              </span>
              <span style={hchip} title={t("Pist / ortam sıcaklığı")}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" style={{ flex: "0 0 auto" }}><rect x="9.1" y="2.6" width="5.8" height="13" rx="2.9" stroke="var(--rc-brand-bright)" strokeWidth="1.6" /><path d="M12 6.4v6.2" stroke="var(--rc-brand-bright)" strokeWidth="1.6" strokeLinecap="round" /><circle cx="12" cy="17.6" r="3.6" fill="var(--rc-brand-bright)" opacity=".85" /></svg>
                <span style={hchipV}>{s.trackTemp != null ? `${Math.round(s.trackTemp)}°` : "—"}<span style={{ fontSize: 11, color: "var(--rc-text-3)" }}> / {s.ambientTemp != null ? `${Math.round(s.ambientTemp)}°` : "—"}</span></span>
              </span>
              {(() => {
                const lv = rainLevel(s.rain);
                return (
                  <span style={hchip} title={t("Yağış")}>
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" style={{ flex: "0 0 auto" }}><circle cx="12" cy="9.4" r="4.2" fill="var(--rc-warn-2)" /><g stroke="var(--rc-warn-2)" strokeWidth="1.5" strokeLinecap="round"><path d="M12 1.6v2.2M12 15v2.2M4.4 9.4H2.2M21.8 9.4h-2.2M6.6 4l-1.5-1.5M18.9 16.3l-1.5-1.5M17.4 4l1.5-1.5M5.1 16.3l1.5-1.5" /></g></svg>
                    <span style={hchipV}>{lv ? t(lv.lbl) : s.raining ? t("Yağmur") : t("Yağmur yok")}</span>
                  </span>
                );
              })()}
              {(() => {
                const id = wetnessLevel(s.wetness);
                return (
                  <span style={hchip} title={t("Zemin ıslaklığı")}>
                    {id ? <WetIcon id={id} size={19} /> : <svg width="19" height="19" viewBox="0 0 24 24" fill="none" style={{ flex: "0 0 auto" }}><path d="M8.5 21.2h7" stroke="var(--rc-neutral-2)" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="1.2 2.6" /><path d="M12 3.4c0 0-5.1 6.4-5.1 9.6a5.1 5.1 0 0 0 10.2 0c0-3.2-5.1-9.6-5.1-9.6Z" stroke="var(--rc-neutral)" strokeWidth="1.5" strokeLinejoin="round" /></svg>}
                    <span style={{ ...hchipV, color: id ? WEATHER[id].col : undefined }}>{id ? t(WEATHER[id].lbl) : t("Kuru")}{s.wetness != null ? <span style={{ fontSize: 12, fontWeight: 500, color: "var(--rc-text-3)" }}> %{Math.round(s.wetness)}</span> : null}</span>
                  </span>
                );
              })()}
              {(() => {
                const g = fieldAll.length > 0 ? rubberPct(s.sessionType, fieldAll.reduce((a, c) => a + (c.lapsDone || 0), 0)) : null;
                return (
                  <span style={hchip} title={t("Turlardan modellenmiş tahmin (gerçek okuma değil)")}>
                    <GripIcon pct={g || 0} size={19} title={t("Tutuş")} />
                    <span style={{ ...hchipV, color: g != null ? gripColor(g) : "var(--rc-text-3)" }}>{g != null ? `%${g}` : "—"}</span>
                  </span>
                );
              })()}
            </span>

            <span style={{ marginLeft: "auto", display: "flex", gap: 6, flexWrap: "wrap" }}>
              {demoBtn}
              {document.fullscreenEnabled && (
                <button className="act" data-tour="livebig" style={{ fontSize: 11, padding: "3px 10px" }} onClick={toggleBig}>{big ? t("✕ Küçült") : <><Icon name="buyut" size={12} /> {t("Büyük Pano")}</>}</button>
              )}
            </span>
          </div>
          {/* kayıt göstergesi (okuyucu-tarafı hasat) */}
          {!demoOn && lapCapture?.writing && (
            <div className="hint" style={{ margin: 0, padding: "6px 16px", color: "var(--green)" }}><Icon name="kayit" size={14} /> {t("Tur geçmişi kaydediliyor")} · {lapCapture.cars} {t("araç")} · {lapCapture.laps} {t("tur")}</div>
          )}
          {!demoOn && !live.bridgeVer && (
            <div className="hint warn" style={{ margin: 0, padding: "6px 16px" }}><Icon name="uyari" size={14} /> {t("Köprü eski sürüm — sürüş PC'sinde köprüyü güncelle (kayıt yine web'den yapılıyor)")}</div>
          )}

          {/* Saha tablosu — canlı köprü verisi (kolonlar/veri değişmedi) */}
          {!shown.length && <div className="hint" style={{ padding: 16 }}>{t("Henüz araç verisi yok.")}</div>}
          {shown.length > 0 && (
            <div style={{ overflowX: "auto" }} data-tour="livefield">
            <table className="lttable" aria-label={t("Canlı timing tablosu")}>
              <thead><tr>
                <th>{playerClass ? (
                  <button onClick={() => setMyClassOnly((v) => !v)}
                    title={t("Kendi sınıfım süzgeci")}
                    style={{ ...thBtn, ...(myClassOnly && { color: "var(--teal)", fontWeight: 700 }) }}>
                    {t("Poz")} · {t("Sınıf")}</button>
                ) : `${t("Poz")} · ${t("Sınıf")}`}</th>
                <th><button onClick={() => setShowTeam((v) => !v)}
                  title={t("Pilot / Takım değiştir")} style={thBtn}>
                  {showTeam ? t("Takım") : t("Pilot")}</button></th>
                <th>{t("Tur")}</th>
                <th><button onClick={() => setGapMode((v) => !v)}
                  title={t("Gap / Aralık değiştir")} style={thBtn}>
                  {gapMode ? t("Aralık") : "Gap"} ⇄</button></th>
                <th><button onClick={() => setLapMode((v) => !v)}
                  title={t("Son / En İyi değiştir")} style={thBtn}>
                  {lapMode ? t("En İyi") : t("Son")} ⇄</button></th>
                <th>{t("Sektör")}</th>
                <th><button onClick={() => setAvgMode((v) => !v)}
                  title={t("AVG5 / AVG değiştir")} style={thBtn}>
                  {avgMode ? "AVG" : "AVG5"} ⇄</button></th>
                <th>{t("Enerji")}</th><th>{t("VE/tur")}</th>
                <th>{t("Lastik")}</th><th>Stint</th>
                <th>{t("Hasar")}</th><th>Incident</th><th>Pit</th>
                <th aria-label={t("Turlar")}></th>
              </tr></thead>
              <tbody>
                {shown.map(({ c, i, id, classPos, interval, lapsDown, lapsDownNext,
                  isFastest }) => {
                  const acc = classAccent(c.carClass);
                  const fl = flash[carKey(c)];   // "purple" | "green" | undefined
                  return (
                    /* key = STABİL araç kimliği (carKey), pozisyon DEĞİL: pozisyon
                       key'i her geçişte satırları söküp yeniden kuruyordu (görsel
                       hata state'leri sıfırlanıyor, img yeniden decode, flash
                       animasyonu yeniden başlıyordu). Stabil key ile React satırı
                       taşır. */
                    <tr key={carKey(c) ?? (c.pos ?? i)}
                      onClick={meRow && !c.isPlayer ? () => setCmpCar((p) => (p && carKey(p) === carKey(c) ? null : c)) : undefined}
                      className={[c.isPlayer ? "live" : "",
                        fl === "purple" ? "flashpurple" : fl === "green" ? "flashgreen" : ""]
                        .filter(Boolean).join(" ")}
                      style={{ ...(!c.isPlayer && acc ? { borderLeft: `3px solid ${acc}` } : {}),
                        ...(meRow && !c.isPlayer ? { cursor: "pointer" } : {}),
                        ...(cmpFresh && carKey(cmpFresh) === carKey(c) ? { background: "rgba(76,154,255,.12)" } : {}) }}>
                      {/* Poz · Sınıf: büyük genel pozisyon + küçük SINIF İÇİ pozisyon
                          (sınıf renginde) + yön oku. Sınıf logosu (HY/GT3) yok. */}
                      <td style={{ whiteSpace: "nowrap" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                          <b style={{ fontFamily: "var(--rc-font-display)", fontWeight: 700, fontSize: 18, lineHeight: 1, color: c.isPlayer ? "var(--rc-brand-bright)" : "var(--rc-text)" }}>{c.pos ?? i + 1}</b>
                          <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 1, lineHeight: 1 }}>
                            {id && <b style={{ fontFamily: "var(--rc-font-display)", fontWeight: 700, fontSize: 11.5, color: acc || "var(--rc-text-3)" }}>{classPos}</b>}
                            <span style={{ fontSize: 8.5, lineHeight: 1 }}>
                              {dirRef.current[c.lapKey || c.driver] === "up" && <span style={{ color: "var(--green)" }}>▲</span>}
                              {dirRef.current[c.lapKey || c.driver] === "down" && <span style={{ color: "var(--red)" }}>▼</span>}
                            </span>
                          </span>
                        </span>
                      </td>
                      {/* Pilot (fişteki r.tdName): marka logosu + isim / #no · takım (2 satır) */}
                      <td style={{ whiteSpace: "nowrap" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                          <Brand manufacturer={c.manufacturer} vehicleName={c.vehicleName} />
                          <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                            <span style={{ fontFamily: "var(--rc-font-ui)", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>{showTeam ? (c.team || c.driver || "—") : (c.driver || "—")}</span>
                            <span style={{ fontSize: 10.5, color: "var(--rc-text-3)", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {showTeam ? (c.driver || "") : `${c.number != null ? `#${c.number}` : ""}${c.number != null && c.team ? " · " : ""}${c.team || ""}`}</span>
                          </span>
                        </span></td>
                      <td>{c.lapsDone ?? "—"}</td>
                      {/* Gap/Aralık + mini çubuk (fişteki barTrack/barFill) */}
                      <td style={gapMode ? { color: "var(--dim)" } : undefined}>
                        <span style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "flex-end" }}>
                          <span>{gapMode
                            ? (lapsDownNext >= 1 ? `+${lapsDownNext} ${t("Tur")}`
                                : interval != null ? gap(interval) : "—")
                            : (i === 0 ? t("Lider") : lapsDown >= 1 ? `+${lapsDown} ${t("Tur")}`
                                : gap(c.gapSec))}</span>
                          <span style={{ width: 54, height: 4, background: "var(--rc-line-soft)", borderRadius: 2, overflow: "hidden" }}>
                            <i style={{ display: "block", height: "100%", width: `${Math.round(Math.min(1, (c.gapSec || 0) / maxGap) * 100)}%`, background: c.isPlayer ? "var(--rc-brand-bright)" : (acc || "var(--rc-text-3)") }} />
                          </span>
                        </span>
                      </td>
                      {/* Son/En İyi tek sütun (başlıktan geçiş); En İyi'de sınıf en hızlısı mor. */}
                      <td style={{ color: lapMode ? (isFastest ? "var(--purple)" : "var(--dim)") : undefined,
                        fontWeight: lapMode && isFastest ? 700 : 400 }}>
                        {lap(lapMode ? c.bestSec : c.lastSec)}</td>
                      <td className="mono" style={{ color: "var(--dim)", fontSize: 11 }}
                        title={t("Son turun S1·S2·S3 sektör süreleri")}>{secStr(c.lastSectors)}</td>
                      {/* AVG5/AVG tek sütun (başlıktan geçiş). */}
                      <td style={{ color: "var(--dim)" }}>{lap(avgMode ? c.avgSec : c.avg5Sec)}</td>
                      {/* Enerji (VE): çubuksuz, renkli % (fişteki yeni tasarım) */}
                      <td style={{ textAlign: "right" }}>
                        <b style={{ color: veColor(c.virtualEnergy), fontSize: 12.5, fontFamily: "var(--rc-font-display)" }}>{c.virtualEnergy != null ? `%${Math.round(c.virtualEnergy)}` : "—"}</b></td>
                      <td style={{ color: "var(--dim)", fontSize: 12 }}
                        title={t("Tur başına VE tüketimi")}>
                        {c.vePerLap != null ? `${c.vePerLap.toFixed(1)}%` : "—"}</td>
                      {/* Lastik: hamur ikonu + tek aşınma % (fişteki tek-lastik gösterimi) */}
                      <td><TyreCell c={c} t={t} single /></td>
                      <td className="mono" style={{ color: "var(--dim)", fontSize: 12 }}>
                        {c.stintSec > 0 ? fmtHMS(c.stintSec) : "—"}</td>
                      <td style={{ fontSize: 12, fontFamily: "var(--rc-font-display)", color: (c.damage || 0) > 0.15 ? "var(--red)"
                        : (c.damage || 0) > 0.02 ? "var(--yellow)" : "var(--dim)" }}>
                        {c.damage != null ? `%${Math.round(c.damage * 100)}` : "—"}</td>
                      {/* Incident: fişteki gibi "N.Nx" (çarpan/olay puanı) */}
                      <td style={{ textAlign: "right", fontFamily: "var(--rc-font-display)", fontSize: 12.5,
                        color: (c.penalties || 0) > 0 ? "var(--red)" : "var(--dim)", fontWeight: (c.penalties || 0) > 0 ? 700 : 400 }}
                        title={t("Olay puanı (cut/puan cezaları dahil)")}>
                        {`${(c.penalties || 0).toFixed(1)}x`}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {c.inPits && <span className="chip" style={{ marginRight: 4,
                          color: "var(--yellow)", borderColor: "var(--yellow)" }}>PIT</span>}
                        <span style={{ color: "var(--dim)" }}>{c.pitStops ?? "—"}</span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {c.lapsDone > 0 && c.lapKey && (
                          <button className="act" title={t("Tur zamanları")}
                            aria-label={t("Tur zamanları")}
                            /* rehber turu ilk satırın "+"ını vurgular */
                            data-tour={shown[0]?.c === c ? "livelapsbtn" : undefined}
                            style={{ fontSize: 14, lineHeight: 1, padding: "1px 8px" }}
                            onClick={(e) => { e.stopPropagation(); setLapsFor(c); }}>+</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
          {/* Pozisyon grafiği (sol kolonun altında) */}
          {!big && isRace && (
            <div style={{ padding: "14px 16px", borderTop: "1px solid var(--rc-border)" }}>
              <PosChart t={t} tid={tid} rid={rid} field={fieldAll} myClassOnly={myClassOnly} playerClass={playerClass} demo={demoOn} />
            </div>
          )}
        </div>

        {/* yan paneli aç düğmesi (panel kapalıyken) */}
        {!big && !side && (
          <button onClick={() => setSide(true)} title={t("Yan paneli aç")}
            style={{ position: "fixed", right: 0, top: 132, zIndex: 15, width: 26, height: 74, borderRadius: "10px 0 0 10px", border: "1px solid var(--rc-border-strong)", borderRight: "none", background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 14 }}>‹</button>
        )}

        {/* ================= SAĞ: YAN PANEL (harita · kendi araç · strateji) ================= */}
        {!big && (
          <div style={{ flex: side ? "0 0 340px" : "0 0 0px", minWidth: 0, overflow: "hidden", alignSelf: "stretch", transition: "flex-basis .32s cubic-bezier(.4,0,.2,1), min-width .32s cubic-bezier(.4,0,.2,1)" }}>
            <div style={{ width: 336, marginLeft: "auto", display: "flex", flexDirection: "column", gap: 12, transform: side ? "translateX(0)" : "translateX(102%)", opacity: side ? 1 : 0, transition: "transform .32s cubic-bezier(.4,0,.2,1), opacity .24s ease" }}>
              <button onClick={() => setSide(false)} style={{ alignSelf: "flex-end", display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 8, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text-3)", cursor: "pointer", fontSize: 11.5 }}>{t("Paneli kapat")} ›</button>
              {/* Sıra (kullanıcı isteği): 1) Pist haritası 2) Kendi araç 3) Strateji */}
              {s.trackLength > 0 && fieldAll.some((c) => c.posX != null) && (
                <TrackMap t={t} field={fieldAll} session={s} trackLength={s.trackLength}
                  tid={tid} trackKey={binKey(s.trackName, s.trackLength)} canSave={canEdit} />
              )}
              {own && <OwnCar t={t} own={own} liveFuelObs={liveFuelObs} topSrc={ownTopSrc} />}
              <StrategyBar t={t} field={fieldAll} />
            </div>
          </div>
        )}
      </div>

      {/* ===== KARŞILAŞTIRMA tepsisi (fişteki cmpTray) — kendi pilot ↔ tıklanan pilot ===== */}
      {cmpFresh && meRow && (() => {
        const sN = (arr, k) => (Array.isArray(arr) && arr[k] != null ? arr[k] : null);
        const fs = (v) => (v != null ? v.toFixed(1) : "—");
        const rows = [
          { label: t("Son tur"), mine: lap(meRow.lastSec), theirs: lap(cmpFresh.lastSec), d: (meRow.lastSec || 0) - (cmpFresh.lastSec || 0) },
          { label: "AVG5", mine: lap(meRow.avg5Sec), theirs: lap(cmpFresh.avg5Sec), d: (meRow.avg5Sec || 0) - (cmpFresh.avg5Sec || 0) },
          { label: "S1", mine: fs(sN(meRow.lastSectors, 0)), theirs: fs(sN(cmpFresh.lastSectors, 0)), d: (sN(meRow.lastSectors, 0) || 0) - (sN(cmpFresh.lastSectors, 0) || 0) },
          { label: "S2", mine: fs(sN(meRow.lastSectors, 1)), theirs: fs(sN(cmpFresh.lastSectors, 1)), d: (sN(meRow.lastSectors, 1) || 0) - (sN(cmpFresh.lastSectors, 1) || 0) },
          { label: "S3", mine: fs(sN(meRow.lastSectors, 2)), theirs: fs(sN(cmpFresh.lastSectors, 2)), d: (sN(meRow.lastSectors, 2) || 0) - (sN(cmpFresh.lastSectors, 2) || 0) },
          { label: t("Enerji"), mine: `%${Math.round(meRow.virtualEnergy || 0)}`, theirs: `%${Math.round(cmpFresh.virtualEnergy || 0)}`, d: (cmpFresh.virtualEnergy || 0) - (meRow.virtualEnergy || 0) },
        ];
        const myName = `${meRow.number != null ? `#${meRow.number} ` : ""}${meRow.driver || t("Kendi Araç")}`;
        const theirName = `${cmpFresh.number != null ? `#${cmpFresh.number} ` : ""}${cmpFresh.driver || "—"}`;
        return (
          <div style={{ position: "fixed", left: "50%", bottom: 18, zIndex: 60, width: "min(920px,94vw)", background: "var(--rc-surface-2)", border: "1px solid var(--rc-border-strong)", borderRadius: 14, overflow: "hidden", boxShadow: "0 16px 46px rgba(0,0,0,.55)", transform: "translateX(-50%)", animation: "rcin .24s ease-out" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 16px", borderBottom: "1px solid var(--rc-border)" }}>
              <span style={{ fontFamily: "var(--rc-font-display)", textTransform: "uppercase", letterSpacing: ".08em", fontSize: 13, fontWeight: 700 }}>{t("Karşılaştırma")}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                <b style={{ color: "var(--rc-text)" }}>{myName}</b>
                <span style={{ color: "var(--rc-border-strong)" }}>↔</span>
                <b style={{ color: "var(--rc-info)" }}>{theirName}</b>
              </span>
              <button onClick={() => setCmpCar(null)} style={{ marginLeft: "auto", width: 26, height: 26, borderRadius: 8, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 13, lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ display: "flex", overflowX: "auto" }}>
              {rows.map((r) => (
                <div key={r.label} style={{ flex: "1 1 118px", minWidth: 112, padding: "10px 14px", borderRight: "1px solid var(--rc-line-soft)" }}>
                  <div style={{ color: "var(--rc-text-3)", fontSize: 9.5, textTransform: "uppercase", letterSpacing: ".1em" }}>{r.label}</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginTop: 5 }}>
                    <b style={{ fontFamily: "var(--rc-font-display)", fontSize: 16 }}>{r.mine}</b>
                    <span style={{ fontFamily: "var(--rc-font-display)", fontSize: 12, color: r.d < 0 ? "var(--rc-ok)" : r.d > 0 ? "var(--rc-danger)" : "var(--rc-text-3)" }}>{`${r.d > 0 ? "+" : ""}${r.d.toFixed(2)}`}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--rc-info)", fontFamily: "var(--rc-font-display)", marginTop: 3, opacity: .85 }}>{r.theirs}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* v1.6.3 — satırı TAZE kareden bul: modal açıkken lapsDone canlı güncellenir →
          bayat-veri cap'i (capLapEntries) yeni turları anında gösterir, snapshot'ta
          takılı kalmaz. Araç kareden düşerse tıklama anındaki satıra düşülür. */}
      {lapsFor && (() => {
        const fk = lapsFor.lapKey || lapsFor.driver;
        const fresh = fieldAll.find((c) => (c.lapKey || c.driver) === fk) || lapsFor;
        return <LapsModal t={t} tid={tid} rid={rid} row={fresh} canEdit={canEdit}
          demo={demoOn} onClose={() => setLapsFor(null)} />;
      })()}
    </div>
  );
}
