import { useState, useRef, useEffect } from "react";
import { EmptyState } from "../shell";
import { fmtLap, fmtHMS, fmtGap, WEATHER, wetnessLevel, rainLevel, rubberPct } from "../engine";
import { WetIcon } from "../WetIcon";
import { GripIcon, gripColor } from "../GripIcon";
import { Ring } from "../components";
import { DESKTOP_RELEASE_URL, BRIDGE_EXE_URL, ASSET, classId, classAccent, brandKey, manufacturerKey } from "../constants";
import { isTauri } from "../tauriEnv";
import { liveLapsSubscribe, liveSecSubscribe, liveDrvSubscribe, liveTyreSubscribe,
  liveCondSubscribe, liveHistoryClearAll, serverNow } from "../storage";
import { driverAtLap, parseLapCond, capLapEntries } from "../liveLaps";
import { detectFlashes, carKey } from "../liveFlash";
import { binKey } from "../trackShape";
import { demoLive } from "../liveDemo";
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

/* Sınıf rozeti — pick ekranındaki renkli vektör (assets/class/<id>.png).
   Görsel yüklenmezse sınıf adını nötr çip olarak gösterir. */
/* Üstü çizili sinyal ikonu — canlı veri yokken boş durumun başında (README §6). */
function NoSignalIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M4.6 8a10 10 0 0 1 14.8 0M7.6 11a6 6 0 0 1 8.8 0" />
      <circle cx="12" cy="15" r="1.6" fill="currentColor" stroke="none" />
      <path d="M3 3 21 21" />
    </svg>
  );
}

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

/* Birleşik LASTİK hücresi: hamur ikonu/ikonları (ön/arka) + DÖRT KÖŞE aşınma % (FL·FR /
   RL·RR, renkli 2×2). Köşe-köşe HAMUR oyunda yok (yalnız ön/arka) — bu yüzden 4 köşe
   yalnız AŞINMA için. tyres4 yoksa tek "en kötü" aşınmaya düşer. Bayat telemetride soluk. */
/* Araç markası logosu (assets/brands/<key>.png). Önce LMU katalog manufacturer'ı
   (temiz: "Cadillac"), yoksa vehicleName parser'ı denenir; dosya yoksa gizlenir. */
function Brand({ manufacturer, vehicleName, className = "" }) {
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
  /* boyut sınıftan gelir (.brandimg varsayılan; saha tablosunda .fbrand yoğunluğa
     göre 26/20px ile ezer) — inline stil YOK. */
  return <img className={`brandimg ${className}`} src={url} alt=""
    title={manufacturer || vehicleName || ""} onError={() => setI((x) => x + 1)} />;
}

/* Rakip karşılaştırma tepsisi (v2.0) — saha satırına tıklayınca alttan kayar.
   Son tur · AVG5 · S1–S3 · enerji; fark renkli (yeşil = sen daha hızlısın).
   Kendi satırın tıklanamaz (LiveTab satır onClick'i player'da undefined). */
function CompareTray({ t, own, ownName, rival, onClose }) {
  if (!rival) return null;
  const secs = (x) => String(x || "").split(",").map((v) => Number(v) || null);
  /* own sektörleri s1/s2/s3 alanlarında taşınır — own'da `lastSectors` YOK (o yalnız
     field satırında var). Eskiden own?.lastSectors okunuyordu → SEN sütunu S1/S2/S3'te
     hep "—" çıkıyordu (delta yok). rival tarafı `lastSectors`'ı doğru kullanır. */
  const oS = [own?.s1, own?.s2, own?.s3].map((v) => (v > 0 ? v : null));
  const rS = secs(rival.lastSectors);
  const delta = (mine, his) =>
    (mine == null || his == null || !Number.isFinite(mine) || !Number.isFinite(his))
      ? null : mine - his;
  /* fiş: her hücrede KENDİ değerin (bold, üstte) + delta + rakip (mavi, ikincil altta).
     delta = kendi − rakip → kendin daha hızlı/düşükse yeşil (up). */
  const cell = (label, mine, his, fmt, higherBetter = false) => {
    const d = delta(mine, his);
    /* Renk "iyilik"e göre, sayı ham farka göre. Tur/sektör süreleri: düşük=iyi
       (d<0 yeşil). Enerji: yüksek=iyi — bu hücrede renk ters çevrilmeli yoksa
       VE'n rakipten fazlayken (avantaj) kırmızı görünüyordu (fiş bug). */
    const good = d == null ? 0 : higherBetter ? d : -d;
    return (
      <span className="cmpcell" key={label}>
        <span className="cmpk">{label}</span>
        <b className="cmpv">{fmt(mine)}</b>
        {d != null && (
          <span className={`cmpd ${good > 0 ? "up" : good < 0 ? "down" : ""}`}>
            {d > 0 ? "+" : ""}{d.toFixed(3)}
          </span>
        )}
        <span style={{ fontFamily: "var(--rc-font-display)", fontSize: 11,
          color: "var(--rc-delta)", opacity: 0.85 }}>{fmt(his)}</span>
      </span>
    );
  };
  const ownLbl = `${own?.number != null ? `#${own.number} ` : ""}${ownName || t("Sen")}`;
  return (
    <div className="cmptray open" role="region" aria-label={t("Karşılaştırma")}>
      <span className="cmphead">
        <b>{t("Karşılaştırma")}</b>
        <span className="fsub">{ownLbl} ↔ {rival.driver || "—"}</span>
      </span>
      {cell(t("Son tur"), own?.lastLapSec, rival.lastSec, lap)}
      {cell("AVG5", own?.avg5Sec, rival.avg5Sec, lap)}
      {[0, 1, 2].map((k) => cell(`S${k + 1}`, oS[k], rS[k],
        (v) => (v == null ? "—" : v.toFixed(3))))}
      {cell(t("Enerji"), own?.virtualEnergy, rival.virtualEnergy,
        (v) => (v == null ? "—" : `${Math.round(v)}%`), true)}
      <button className="rbbtn" onClick={onClose}
        aria-label={t("Karşılaştırmayı kapat")}>✕</button>
    </div>
  );
}

/* Bir aracın tüm yarış boyunca attığı turların zaman listesi (satırdaki "+" ile açılır).
   Geçmiş kalıcı livelaps düğümünden (teams/{tid}/livelaps/{rid}/{lapKey}) talep üzerine
   okunur → tüm yarış (300+ tur) kapsanır. En yeni üstte; en hızlı tur mor, out/pit turu
   (best'in %110'undan büyük) soluk. wxmodal desenini yeniden kullanır. */
function LapsModal({ t, tid, rid, row, canEdit, onClose }) {
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
    // boş/silinmiş düğüm (null) → {}: "yükleniyor…" yerine "tur yok" göstersin
    const off1 = liveLapsSubscribe(tid, rid, row.lapKey, (v) => setLapMap(v || {}));
    const off2 = liveSecSubscribe(tid, rid, row.lapKey, setSecMap);
    const off3 = liveDrvSubscribe(tid, rid, row.lapKey, setDrvMap);
    const off4 = liveTyreSubscribe(tid, rid, row.lapKey, setTyreMap);
    const off5 = liveCondSubscribe(tid, rid, row.lapKey, setCondMap);
    return () => { off1(); off2(); off3(); off4(); off5(); };
  }, [tid, rid, row?.lapKey]);
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
            /* PİST KOŞULU (livecond): o turdaki asfalt sıcaklığı · yol tutuş · zemin ıslaklığı */
            const cond = condMap ? parseLapCond(condMap[n]) : null;
            const condWx = cond && cond.wet != null ? wetnessLevel(cond.wet) : null;
            /* v1.8.15 — TEK SATIR kompakt: tüm alanlar inline (zorunlu satır kırması yok);
               dar ekranda yalnız doğal sarar. Sektör/koşul küçük punto, etiketler title'da. */
            return (
              <div key={n} className="wxrow laprow"
                style={swap ? { borderTop: "1px solid var(--teal)" } : undefined}>
                <span className="wxnm" style={{ minWidth: 46, color: "var(--dim)" }}>
                  {t("Tur")} {n}</span>
                {/* pilot YALNIZ değişim turunda (yer kazan) */}
                {swap && (
                  <span title={drv || undefined} style={{ maxWidth: 90, fontSize: 11,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    color: "var(--teal)", fontWeight: 700 }}>
                    {shortDrv}</span>
                )}
                <span className="mono" style={{ minWidth: 62, fontSize: 14,
                  fontWeight: isBest ? 700 : 500,
                  color: isBest ? "var(--purple)" : isOut ? "var(--yellow)" : "var(--txt)" }}>
                  {fmtLap(sec)}</span>
                <span className="mono" style={{ minWidth: 42, fontSize: 11, color: "var(--dim)" }}>
                  {isBest ? "★" : best > 0 ? `+${(sec - best).toFixed(2)}` : ""}</span>
                {sc && sc.length === 3 && sc.every((v) => v > 0) && (
                  <span className="mono"
                    title={`S1 ${sc[0].toFixed(1)} · S2 ${sc[1].toFixed(1)} · S3 ${sc[2].toFixed(1)}`}
                    style={{ fontSize: 10.5, color: "var(--dim)" }}>
                    {sc[0].toFixed(1)}·{sc[1].toFixed(1)}·{sc[2].toFixed(1)}</span>
                )}
                {cond && (
                  <span style={{ fontSize: 10.5, color: "var(--dim)", display: "inline-flex",
                    alignItems: "center", gap: 8 }}>
                    {cond.temp != null && <span title={t("Asfalt sıcaklığı")}>🛣 {cond.temp}°</span>}
                    {cond.grip != null && <span title={t("Yol tutuş")} style={{ display: "inline-flex",
                      alignItems: "center", gap: 2, color: gripColor(cond.grip) }}>
                      <GripIcon pct={cond.grip} size={12} /> %{cond.grip}</span>}
                    {cond.wet != null && (condWx
                      ? <span title={t("Zemin ıslaklığı")} style={{ display: "inline-flex",
                          alignItems: "center", gap: 2, color: WEATHER[condWx].col }}>
                          <WetIcon id={condWx} size={12} /> {t(WEATHER[condWx].lbl)}</span>
                      : <span title={t("Zemin ıslaklığı")}>💧 %{cond.wet}</span>)}
                  </span>
                )}
                {pit && (
                  <span title={pit.n > 0
                    ? `${t("Pit")}: ${pit.n} ${t("lastik")}${pit.comp ? ` · ${pit.comp}` : ""}`
                    : t("Pit (yalnız yakıt/servis)")}
                    style={{ display: "inline-flex", alignItems: "center", gap: 3,
                      fontSize: 11, color: "var(--yellow)" }}>
                    {pit.n > 0 ? <>
                      {pit.n}×
                      {(() => { const info = compoundInfo(pit.comp);
                        return info ? <CompoundIcon info={info} size={14} /> : null; })()}
                    </> : <span className="chip" style={{ fontSize: 10,
                      color: "var(--yellow)", borderColor: "var(--yellow)" }}>PIT</span>}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <div className="wxmfoot" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* v1.6.3 — bayat geçmişi ELLE sıfırla (owner/editor): köprü yarışın ortasında
              açıldıysa oto-temizleme ateşlenmez; bu düğme rid'in TÜM canlı geçmişini
              (livelaps/pos/sec/drv/tyre/cond) siler. Web + masaüstü. */}
          {canEdit && tid && rid && (
            <button className="act" style={{ marginRight: "auto", fontSize: 11 }}
              title={t("Bu yarışın '+' tur geçmişini (eski koşulardan kalan turlar/pilotlar) sıfırla")}
              onClick={async () => {
                if (!window.confirm(t("Bu yarışın tüm '+' tur geçmişi silinsin mi? (Yeni turlar yine kaydedilir.)"))) return;
                try { await liveHistoryClearAll(tid, rid); setCleared(true); }
                catch { /* yoksay */ }
              }}>🗑 {t("Tur geçmişini temizle")}</button>
          )}
          {cleared && <span className="hint" style={{ margin: 0, color: "var(--green)" }}>
            ✓ {t("temizlendi")}</span>}
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

function OwnCar({ t, own, liveFuelObs, topSrc = "" }) {
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
        <img src={topSrc || `${ASSET}cartop/default.png`} alt={t("Kendi Araç")}
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
      <h2 style={{ display: "flex", alignItems: "center", gap: 10 }}>
        🛰 {t("Canlı Köprü")}
        <span title={diagTitle} style={{ width: 9, height: 9, borderRadius: "50%", background: dot,
          boxShadow: `0 0 8px ${dot}`, cursor: diagTitle ? "help" : "default" }} />
        <span style={{ fontSize: 11, color: "var(--dim)", fontWeight: 400 }}>{t("otomatik")}</span>
      </h2>
      {canBridge && phase === "standby" && (
        <div className="hint" style={{ marginTop: 6, color: "var(--yellow)" }}>
          ⏸ {t("Beklemede")}{writerBy ? ` — ${writerBy} ${t("yayınlıyor")}` : ""} · {t("aktif sürücü canlıyı yazıyor")}
        </div>
      )}
      {canBridge && phase === "running" && writerBy && (
        <div className="hint" style={{ marginTop: 6, color: "var(--dim)" }}>
          🛰 {t("Canlı kaynak")}: {writerBy}
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
          ⚡ {t("Oyun eklentisi saniyede")} ~{d.plugin.wastedFps} {t("kez bu uygulamanın okumadığı veriyi yazıyor")}
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
              if (!window.confirm(t("Bu yarışın tüm '+' tur geçmişi silinsin mi? (Yeni turlar yine kaydedilir.)"))) return;
              try { await liveHistoryClearAll(tid, rid); setCleared(true); setTimeout(() => setCleared(false), 2500); }
              catch { /* yoksay */ }
            }}>🗑 {t("Tur geçmişini temizle")}</button>
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
  tourDemo, onGuide, isAdmin = false, ownTopSrc = "" }) {
  const [myClassOnly, setMyClassOnly] = useState(false);
  const [big, setBig] = useState(false);
  const [lapsFor, setLapsFor] = useState(null);   // "+" ile açılan tur listesi satırı
  const [showTeam, setShowTeam] = useState(false); // Pilot ↔ Takım sütun geçişi
  const [lapMode, setLapMode] = useState(false);   // Son ↔ En İyi tek sütun geçişi
  const [avgMode, setAvgMode] = useState(false);   // AVG5 ↔ AVG tek sütun geçişi
  const [gapMode, setGapMode] = useState(false);   // Gap ↔ Aralık tek sütun geçişi
  /* v2.0 — yoğunluk YALNIZ bu ekranda (global anahtar kaldırıldı):
     "Pit duvarı" (seyrek satır, büyük sayı) ↔ "Mühendis" (sık satır, 12.5px).
     Sütunlar iki modda da görünür, yalnız ölçek değişir. */
  const [density, setDensity] = useState(() => {
    try { return localStorage.getItem("crm-live-density") || "wall"; } catch { return "wall"; }
  });
  const wall = density === "wall";
  const toggleDensity = () => setDensity((d) => {
    const nx = d === "wall" ? "eng" : "wall";
    try { localStorage.setItem("crm-live-density", nx); } catch { /* özel mod */ }
    return nx;
  });
  const [secOn, setSecOn] = useState(true);        // Sektör sütunu gizlenebilir (👁)
  /* Sağ panel (320px) kayarak kapanır — tercih localStorage'da. */
  const [sideOn, setSideOn] = useState(() => {
    try { return localStorage.getItem("crm-live-side") !== "0"; } catch { return true; }
  });
  useEffect(() => {
    try { localStorage.setItem("crm-live-side", sideOn ? "1" : "0"); } catch { /* özel mod */ }
  }, [sideOn]);
  const [cmpCar, setCmpCar] = useState(null);      // rakip karşılaştırma tepsisi
  // DEMO: yerel sahte veri (oyun/köprü/Firebase gerekmez) — UI düzenlemek için
  const [demo, setDemo] = useState(false);
  const [demoData, setDemoData] = useState(null);
  /* tourDemo: rehber turu Canlı adımlarında demoyu geçici açar — veri yokken
     tablo/harita DOM'da olmadığı için adımların vurgulayacağı hedef kalmıyordu.
     Prop verilmezse davranış birebir eskisi gibi (yalnız kendi 🎬 düğmesi). */
  const demoOn = demo || !!tourDemo;
  useEffect(() => {
    if (!demoOn) { setDemoData(null); return undefined; }
    const t0 = Date.now();
    const tick = () => setDemoData(demoLive((Date.now() - t0) / 1000));
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [demoOn]);
  const live = demoOn ? demoData : liveProp;
  /* 🎬 Demo düğmesi yalnız adminlerde: normal kullanıcılar için gizlenir (rehber turu
     tourDemo ile herkes için çalışmaya devam eder — o ayrı bir yol). */
  const demoBtn = isAdmin ? (
    <button className={`act${demo ? " on" : ""}`} data-tour="livedemo"
      onClick={() => setDemo((v) => !v)}
      style={{ fontSize: 11, padding: "3px 10px",
        ...(demo && { borderColor: "var(--yellow)", color: "var(--yellow)" }) }}>
      🎬 {demo ? t("Demo kapat") : t("Demo")}</button>
  ) : null;
  /* yalnız Canlı bölümünü anlatan kısa rehber (9 adım) — App setTour("live") yapar */
  const guideBtn = onGuide && (
    <button className="act" style={{ fontSize: 11, padding: "3px 10px" }}
      onClick={onGuide} title={t("Canlı Timing rehberi")}>🎓</button>
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
        <div className="card">
          <h2 style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            📡 {t("Canlı Timing")}
            {staleOff && <span className="livebadge off"><i /> {t("çevrimdışı")}</span>}
            <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              {guideBtn}{demoBtn}</span></h2>
          {/* v2.0 sistematik boş durum (README §6 "Boş durum" + i18n-EN.md §2):
              üstü çizili sinyal ikonu + başlık + açıklama + yeniden bağlan /
              köprü durumu + son paket saati. Platforma özgü kurulum yönergeleri
              altta korunur (KORU/TAŞI). */}
          <EmptyState
            icon={<NoSignalIcon />}
            title={t("Canlı veri gelmiyor")}
            text={t("Köprü çalışmıyor ya da oyun seansta değil. Sürüş PC'sinde köprüyü başlat; bağlanınca saha tablosu kendiliğinden dolar.")}>
            <button className="rbbtn" onClick={() => window.location.reload()}>
              {t("Yeniden bağlan")}</button>
            {bridgeCard && <span className="ro-note">{t("Köprü durumu")} ↑</span>}
            {live?.ts && (
              <span className="fsub">
                {t("son paket")} · {ageSec < 90
                  ? `${ageSec} ${t("sn")}` : `${Math.round(ageSec / 60)} ${t("dk önce")}`}
              </span>
            )}
          </EmptyState>
          <div className="hint" style={{ lineHeight: 1.7, marginTop: 12 }}>
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
            <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <a className="bigbtn" href={DESKTOP_RELEASE_URL} target="_blank" rel="noopener noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: 8, width: "auto",
                  padding: "10px 18px", textDecoration: "none" }}>
                🖥 {t("Masaüstü Uygulamasını İndir")}</a>
              <a className="bigbtn ghost" href={BRIDGE_EXE_URL} target="_blank" rel="noopener noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: 8, width: "auto",
                  padding: "10px 18px", textDecoration: "none" }}
                title={t("Oyunun çalıştığı PC için: tarayıcı motoru yok → oyunu yormaz.")}>
                🪶 {t("Hafif Köprüyü İndir (.exe)")}</a>
            </div>
          )}
        </div>
      </div>
    );
  }
  const s = live.session || {};
  const isRace = s.sessionType === "Yarış";   // pozisyon grafiği yalnız YARIŞ seansında anlamlı
  const own = live.own || null;
  const fieldAll = Array.isArray(live.field) ? live.field : [];
  const ageSec = Math.max(0, Math.round((serverNow() - live.ts) / 1000));

  // türetilmiş: sınıf-içi pozisyon, seans en hızlı turu, oyuncu sınıfı
  const leaderLaps = fieldAll[0]?.lapsDone ?? 0;
  /* Sınıf başına en hızlı bestSec — "En İyi" sütununda mor = SINIF rekoru (liveFlash
     classBest ile aynı desen). Eskiden tek genel minimumdu → çok sınıflı yarışta yalnız
     genelin en hızlısı morlanıp sınıf rekorları (ör. en hızlı LMGT3) hiç morlanmıyordu. */
  const classFastest = {};
  for (const c of fieldAll) {
    if (c && c.bestSec > 0) {
      const cid = classId(c.carClass);
      classFastest[cid] = classFastest[cid] == null ? c.bestSec : Math.min(classFastest[cid], c.bestSec);
    }
  }
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
      isFastest: c.bestSec > 0 && c.bestSec === classFastest[id] };
  });
  const shown = myClassOnly && playerClass
    ? rows.filter((r) => r.id === playerClass) : rows;
  /* Tıklanabilir sütun başlığı stili (Pilot↔Takım, Sınıf süzgeci, Son↔En İyi, AVG5↔AVG). */
  const thBtn = { background: "none", border: 0, color: "inherit", font: "inherit",
    cursor: "pointer", padding: 0, textDecoration: "underline dotted" };

  /* --- fiş: 02-canli-timing.md — markup ve stil değerleri birebir; renkler --rc-*
     tokenlarına bağlı. Veri katmanı DEĞİŞMEDİ (yukarıdaki türetilmiş rows/shown/own…
     ve StrategyBar/TrackMap/PosChart/OwnCar çocukları korunur). Fişte tanımı olmayan
     taban th/td ve satır mini-bar stilleri DashTab desenindeki gibi yerelde kurulur
     (FLAG: fiş-dışı, tasarım diline uygun). --- */
  const disp = "var(--rc-font-display)";
  /* Gösterilen (süzülmüş) satırlardaki benzersiz sınıf sayısı — "kendi sınıfım"
     süzgeci açıkken araç sayısıyla birlikte sınıf sayısı da süzülsün (fiş bug:
     eskiden classCounts tüm sahadan sayıp süzgeçte "1 sınıf" yerine hepsini derdi). */
  const nClasses = new Set(shown.map((r) => r.id)).size;
  const pillBtn = { padding: "7px 13px", borderRadius: 99, cursor: "pointer", fontSize: 12,
    border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text-3)" };
  const th = { padding: "10px 12px", borderBottom: "1px solid var(--rc-border)", textAlign: "right",
    color: "var(--rc-text-3)", fontSize: 11, fontWeight: 600, textTransform: "uppercase",
    letterSpacing: ".08em", whiteSpace: "nowrap" };
  const thLeft = { ...th, textAlign: "left" };
  const thClick = { ...th, cursor: "pointer", color: "var(--rc-brand-bright)",
    textDecoration: "underline dotted", textUnderlineOffset: 3 };
  const thLeftClick = { ...thLeft, cursor: "pointer", color: "var(--rc-brand-bright)",
    textDecoration: "underline dotted", textUnderlineOffset: 3 };
  const thPos = { ...thLeftClick, fontWeight: myClassOnly ? 700 : 600 };
  const secHideBtn = { display: "inline-flex", alignItems: "center", justifyContent: "center",
    width: 20, height: 20, borderRadius: 6, cursor: "pointer", border: "1px solid var(--rc-border)",
    background: "var(--rc-surface-3)", color: "var(--rc-text-3)", padding: 0, verticalAlign: "middle" };
  const tdBase = { padding: "9px 12px", borderBottom: "1px solid var(--rc-line-soft)", textAlign: "right",
    fontFamily: "var(--rc-font-mono)", fontVariantNumeric: "tabular-nums", fontSize: wall ? 14 : 12.5 };
  const barTrack = { display: "inline-block", width: 46, height: 6, background: "var(--rc-line-soft)",
    borderRadius: 4, overflow: "hidden", verticalAlign: "middle", flex: "0 0 auto" };
  const barFill = (pct, col) => ({ display: "block", height: "100%",
    width: `${Math.max(0, Math.min(100, pct))}%`, background: col, borderRadius: 4 });
  const veCol = (v) => (v == null ? "var(--rc-text-3)"
    : v > 50 ? "var(--rc-ok)" : v > 20 ? "var(--rc-warn)" : "var(--rc-danger)");
  const wearCol = (w) => (w == null ? "var(--rc-text-3)"
    : w < 0.4 ? "var(--rc-danger)" : w < 0.7 ? "var(--rc-warn)" : "var(--rc-ok)");

  return (
    <div data-tour="livecard" ref={rootRef} className={big ? "bigboard" : ""}>
      {/* FLAG: fişte yok — köprü durum kartı (Tauri) yük taşıyor (bağlantı/teşhis/geçmiş temizleme). */}
      {!big && bridgeCard}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, padding: "16px 20px",
        alignItems: "flex-start", animation: "rcin .26s ease-out" }}>

        {/* ═══════════ SOL: Saha kartı ═══════════ */}
        <div data-tour="livefield" style={{ flex: "1 1 720px", minWidth: 0,
          border: "1px solid var(--rc-border)", borderRadius: 12, background: "var(--rc-surface)",
          overflow: "hidden" }}>

          {/* başlık: Saha + sayım + hava/bayrak/tutuş kümesi + kontroller */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
            borderBottom: "1px solid var(--rc-border)", flexWrap: "wrap" }}>
            <span style={{ fontFamily: disp, textTransform: "uppercase", letterSpacing: ".08em",
              fontSize: 15, fontWeight: 700 }}>{t("Saha")}</span>
            <span style={{ color: "var(--rc-text-3)", fontSize: 12 }}>
              {shown.length} {t("araç")} · {nClasses} {t("sınıf")}</span>

            <span style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
              paddingLeft: 16, marginLeft: 2, borderLeft: "1px solid var(--rc-border)" }}>
              {/* bayrak (salt-okunur: s.flag'den. FLAG: fişte döngüsel buton; veride bayrak sabit → gösterim) */}
              {(() => {
                const on = !!s.flag && s.flag !== "Green";
                const col = !s.flag ? "var(--rc-text-3)"
                  : (s.flag === "Yellow" || s.flag === "FCY") ? "var(--rc-flag-yellow)"
                  : s.flag === "Green" ? "var(--rc-ok)" : "var(--rc-brand-bright)";
                const lbl = s.flag ? t(s.flag) : (s.phase || "—");
                return (
                  <span title={t("Bayrak durumu")} style={{ display: "inline-flex", alignItems: "center",
                    gap: 7, border: `1px solid ${on ? col : "transparent"}`,
                    background: on ? "rgba(242,192,55,.10)" : "transparent", borderRadius: 9,
                    padding: on ? "3px 9px" : "3px 0",
                    animation: on ? "rcpulse 1.6s ease-in-out infinite" : "none" }}>
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" style={{ flex: "0 0 auto" }}>
                      <path d="M5.6 3.2v17.6" stroke="var(--rc-border-hi)" strokeWidth="1.8" strokeLinecap="round" />
                      <path d="M7 4.4c3.4-1.8 6.8 1.8 10.2 0v7.8c-3.4 1.8-6.8-1.8-10.2 0V4.4Z" fill={col} opacity=".9" />
                    </svg>
                    <span style={{ fontFamily: disp, fontSize: 17, fontWeight: 700, lineHeight: 1,
                      color: col, letterSpacing: on ? ".04em" : 0 }}>{lbl}{s.flag === "Yellow"
                      && s.yellowSectors?.length > 0 ? ` S${s.yellowSectors.join("·S")}` : ""}</span>
                  </span>
                );
              })()}
              {/* pist / ortam sıcaklığı */}
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}
                title={t("Pist / ortam sıcaklığı")}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" style={{ flex: "0 0 auto" }}>
                  <rect x="9.1" y="2.6" width="5.8" height="13" rx="2.9" stroke="var(--rc-brand-bright)" strokeWidth="1.6" />
                  <path d="M12 6.4v6.2" stroke="var(--rc-brand-bright)" strokeWidth="1.6" strokeLinecap="round" />
                  <circle cx="12" cy="17.6" r="3.6" fill="var(--rc-brand-bright)" opacity=".85" />
                </svg>
                <span style={{ fontFamily: disp, fontSize: 17, fontWeight: 700, lineHeight: 1 }}>
                  {s.trackTemp != null ? `${Math.round(s.trackTemp)}°` : "—"}
                  <span style={{ fontSize: 11, color: "var(--rc-text-3)" }}>
                    {" / "}{s.ambientTemp != null ? `${Math.round(s.ambientTemp)}°` : "—"}</span></span>
              </span>
              {/* yağış */}
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }} title={t("Yağış durumu")}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" style={{ flex: "0 0 auto" }}>
                  <circle cx="12" cy="9.4" r="4.2" fill="var(--rc-warn-2)" />
                  <g stroke="var(--rc-warn-2)" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M12 1.6v2.2M12 15v2.2M4.4 9.4H2.2M21.8 9.4h-2.2M6.6 4l-1.5-1.5M18.9 16.3l-1.5-1.5M17.4 4l1.5-1.5M5.1 16.3l1.5-1.5" />
                  </g>
                </svg>
                <span style={{ fontFamily: disp, fontSize: 17, fontWeight: 700, lineHeight: 1 }}>
                  {(() => { const rl = rainLevel(s.rain);
                    return rl ? t(rl.lbl) : (s.raining ? t("Yağmur") : t("Yağmur yok")); })()}</span>
              </span>
              {/* zemin ıslaklığı (WetIcon çocuğu) */}
              {(() => {
                const wid = wetnessLevel(s.wetness);
                return (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}
                    title={t("Zemin ıslaklığı")}>
                    {wid ? <WetIcon id={wid} size={19} title={t(WEATHER[wid].lbl)} />
                      : (<svg width="19" height="19" viewBox="0 0 24 24" fill="none" style={{ flex: "0 0 auto" }}>
                          <path d="M8.5 21.2h7" stroke="var(--rc-neutral-2)" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="1.2 2.6" />
                          <path d="M12 3.4c0 0-5.1 6.4-5.1 9.6a5.1 5.1 0 0 0 10.2 0c0-3.2-5.1-9.6-5.1-9.6Z" stroke="var(--rc-neutral)" strokeWidth="1.5" strokeLinejoin="round" />
                        </svg>)}
                    <span style={{ fontFamily: disp, fontSize: 17, fontWeight: 700, lineHeight: 1 }}>
                      {wid ? t(WEATHER[wid].lbl) : "—"}
                      {s.wetness != null && <span style={{ fontFamily: disp, fontSize: 12, fontWeight: 500,
                        color: "var(--rc-text-3)" }}>{" "}%{Math.round(s.wetness)}</span>}</span>
                  </span>
                );
              })()}
              {/* yol tutuşu (GripIcon çocuğu — test kancası: 'Tutuş' + clip-path url(#gc)) */}
              {(() => {
                const totalLaps = fieldAll.reduce((a, c) => a + (c.lapsDone || 0), 0);
                const g = rubberPct(s.sessionType, totalLaps) ?? 0;
                return (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }} title={t("Tutuş")}>
                    <GripIcon pct={g} size={19} title={t("Tutuş")} />
                    <span style={{ fontFamily: disp, fontSize: 17, fontWeight: 700, lineHeight: 1,
                      color: gripColor(g) }}>%{g}</span>
                  </span>
                );
              })()}
            </span>

            {/* sağ kontroller (FLAG: yoğunluk/rehber/büyük-pano fişte yok — özellik+test kancası, korunur) */}
            <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              {/* editör tur geçmişini kaydederken canlı rozet (useLive lapCapture). Eskiden
                  prop geçiliyor ama hiç gösterilmiyordu → kayıt durumu görünmezdi. */}
              {lapCapture?.writing && (
                <span title={t("Tur geçmişi takım için kaydediliyor")}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11,
                    padding: "3px 9px", borderRadius: 99, border: "1px solid var(--rc-ok)", color: "var(--rc-ok)" }}>
                  <i style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--rc-ok)",
                    boxShadow: "0 0 6px var(--rc-ok)" }} />
                  {lapCapture.laps} {t("tur kaydedildi")}
                </span>
              )}
              {!secOn && (
                <button onClick={() => setSecOn(true)} style={pillBtn}>{t("👁 Sektör sütununu göster")}</button>
              )}
              <button className={`denbtn${wall ? " on" : ""}`} onClick={toggleDensity}
                title={t("Satır yoğunluğu")} aria-pressed={wall}>
                {wall ? t("◱ Pit duvarı") : t("◰ Mühendis")}</button>
              {demoBtn}
              {!big && guideBtn}
              {document.fullscreenEnabled && (
                <button className="act" data-tour="livebig" style={{ fontSize: 11, padding: "3px 10px" }}
                  onClick={toggleBig}>{big ? t("✕ Küçült") : t("⛶ Büyük Pano")}</button>
              )}
            </span>
          </div>

          {/* saha tablosu */}
          {!shown.length ? (
            <div style={{ padding: "28px 16px", color: "var(--rc-text-3)", fontSize: 12.5 }}>
              {t("Henüz araç verisi yok.")}</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className={`fieldtbl ${wall ? "wall" : "eng"}`} aria-label={t("Canlı timing tablosu")}
                style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
                <thead><tr>
                  <th style={thPos} onClick={() => setMyClassOnly((v) => !v)} title={t("Kendi sınıfım süzgeci")}>
                    {t("Poz · Sınıf")} {myClassOnly ? t("· kendi sınıfım") : "⇄"}</th>
                  <th style={thLeftClick} onClick={() => setShowTeam((v) => !v)} title={t("Pilot / Takım değiştir")}>
                    {showTeam ? t("Takım") : t("Pilot")} ⇄</th>
                  <th style={th}>{t("Tur")}</th>
                  <th style={thClick} onClick={() => setGapMode((v) => !v)} title={t("Lidere Gap ↔ öndekine Aralık")}>
                    {gapMode ? t("Aralık") : "Gap"} ⇄</th>
                  <th style={thClick} onClick={() => setLapMode((v) => !v)} title={t("Son ↔ En iyi")}>
                    {lapMode ? t("En İyi") : t("Son tur")} ⇄</th>
                  {secOn && (
                    <th style={th}>{t("Sektör")}{" "}
                      <button className="secbtn" onClick={() => setSecOn(false)}
                        title={t("Sektör sütununu gizle")} style={secHideBtn}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                          strokeWidth="2.2" strokeLinecap="round">
                          <path d="M3.5 3.5l17 17" />
                          <path d="M10.6 6.3A9.7 9.7 0 0 1 12 6.2c5 0 8.4 3.6 9.3 5.8-.4.9-1.3 2.4-2.8 3.7" />
                          <path d="M6.6 8.1C4.6 9.4 3.3 11.2 2.7 12c.9 2.2 4.3 5.8 9.3 5.8 1.3 0 2.5-.2 3.5-.6" />
                        </svg>
                      </button>
                    </th>
                  )}
                  <th style={thClick} onClick={() => setAvgMode((v) => !v)} title={t("AVG5 ↔ AVG")}>
                    {avgMode ? "AVG" : "AVG5"} ⇄</th>
                  <th style={th}>{t("Enerji")}</th>
                  <th style={th}>{t("VE/tur")}</th>
                  <th style={th}>{t("Lastik")}</th>
                  <th style={th}>Stint</th>
                  <th style={th}>{t("Hasar")}</th>
                  <th style={th}>Incident</th>
                  <th style={th}>Pit</th>
                  <th style={th} aria-label={t("Turlar")}></th>
                </tr></thead>
                <tbody>
                  {shown.map(({ c, i, id, classPos, interval, lapsDown, lapsDownNext, isFastest }) => {
                    const acc = classAccent(c.carClass);
                    const fl = flash[carKey(c)];
                    const dir = dirRef.current[c.lapKey || c.driver];
                    const gapForBar = gapMode ? interval : c.gapSec;
                    const gapBarPct = gapForBar != null && gapForBar > 0
                      ? Math.max(6, 100 - (Math.min(gapForBar, 5) / 5) * 94) : 0;
                    const gapBarCol = gapForBar == null ? "var(--rc-text-3)"
                      : gapForBar < 1 ? "var(--rc-ok)" : gapForBar < 3 ? "var(--rc-warn)" : "var(--rc-brand-bright)";
                    const ve = c.virtualEnergy;
                    const wearPct = c.tyreWear != null ? Math.round(c.tyreWear * 100) : null;
                    const ax = compoundAxles(c.tyreComp);
                    return (
                      <tr key={carKey(c) ?? (c.pos ?? i)}
                        className={[c.isPlayer ? "me" : "pick",
                          fl === "purple" ? "pbc" : fl === "green" ? "pb" : ""].filter(Boolean).join(" ")}
                        onClick={c.isPlayer ? undefined
                          : () => setCmpCar((v) => (carKey(v) === carKey(c) ? null : c))}
                        style={{ cursor: c.isPlayer ? "default" : "pointer" }}>
                        {/* Poz · sınıf-içi poz (sol kenar 4px sınıf rengi — veri, hex inline) */}
                        <td className="l" style={{ ...tdBase, textAlign: "left", fontFamily: disp,
                          ...(acc ? { borderLeftColor: acc } : {}) }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <span className="fpos" style={{ fontFamily: disp, fontSize: wall ? 18 : 15,
                              fontWeight: 700, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                              {c.pos ?? i + 1}</span>
                            <span style={{ display: "inline-flex", flexDirection: "column",
                              alignItems: "flex-start", gap: 1 }}>
                              {id && <span className="fclspos" style={{ fontSize: 10.5, fontWeight: 700,
                                ...(acc ? { color: acc } : {}) }}>{classPos}</span>}
                              {dir === "up" && <span style={{ color: "var(--rc-ok)", fontSize: 10 }}>▲</span>}
                              {dir === "down" && <span style={{ color: "var(--rc-danger)", fontSize: 10 }}>▼</span>}
                            </span>
                          </span>
                        </td>
                        {/* Pilot */}
                        <td className="l" style={{ ...tdBase, textAlign: "left", fontFamily: "var(--rc-font-ui)" }}>
                          <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                            <Brand manufacturer={c.manufacturer} vehicleName={c.vehicleName} className="fbrand" />
                            <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                              <span className="fdrv" style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap",
                                overflow: "hidden", textOverflow: "ellipsis" }}>
                                {showTeam ? (c.team || c.driver || "—") : (c.driver || "—")}</span>
                              <span className="fsub" style={{ fontSize: 10.5, color: "var(--rc-text-3)",
                                whiteSpace: "nowrap" }}>
                                {c.number != null && <>#{c.number} · </>}
                                {showTeam ? (c.driver || "") : (c.team || "")}
                                {id && <> · {String(c.carClass || "").toUpperCase()} P{classPos}</>}</span>
                            </span>
                          </span>
                        </td>
                        <td style={tdBase}>{c.lapsDone ?? "—"}</td>
                        {/* Gap/Aralık + mini bar */}
                        <td style={tdBase}>
                          <span style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "flex-end" }}>
                            <span>{gapMode
                              ? (lapsDownNext >= 1 ? `+${lapsDownNext} ${t("Tur")}`
                                  : interval != null ? gap(interval) : "—")
                              : (i === 0 ? t("Lider") : lapsDown >= 1 ? `+${lapsDown} ${t("Tur")}`
                                  : gap(c.gapSec))}</span>
                            {i > 0 && gapForBar != null && gapForBar > 0 && (
                              <span style={barTrack}><i style={barFill(gapBarPct, gapBarCol)} /></span>
                            )}
                          </span>
                        </td>
                        {/* Son tur / En iyi (en iyi'de sınıf en hızlısı mor) */}
                        <td style={{ ...tdBase, ...(lapMode
                          ? (isFastest ? { color: "var(--rc-purple)" } : { color: "var(--rc-text-3)" }) : {}) }}>
                          {lap(lapMode ? c.bestSec : c.lastSec)}</td>
                        {secOn && (
                          <td style={{ ...tdBase, color: "var(--rc-text-3)", fontSize: wall ? 12.5 : 11 }}
                            title={t("Son turun S1·S2·S3 sektör süreleri")}>{secStr(c.lastSectors)}</td>
                        )}
                        <td style={{ ...tdBase, color: "var(--rc-text-3)" }}>{lap(avgMode ? c.avgSec : c.avg5Sec)}</td>
                        {/* Enerji + mini bar */}
                        <td style={tdBase}>
                          <span style={{ display: "flex", alignItems: "center", gap: 7, justifyContent: "flex-end" }}>
                            {ve != null && <span style={barTrack}><i style={barFill(ve, veCol(ve))} /></span>}
                            <b style={{ color: veCol(ve), fontWeight: 700 }}>
                              {ve != null ? `${Math.round(ve)}%` : "—"}</b>
                          </span>
                        </td>
                        <td style={{ ...tdBase, color: "var(--rc-text-3)" }} title={t("Tur başına VE tüketimi")}>
                          {c.vePerLap != null ? `${c.vePerLap.toFixed(1)}%` : "—"}</td>
                        {/* Lastik: hamur ikonu + aşınma bar + % (fiş Lastik hücresi) */}
                        <td style={tdBase}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, justifyContent: "flex-end" }}>
                            {ax && <CompoundIcons ax={ax} />}
                            {wearPct != null ? (<>
                              <span style={barTrack}><i style={barFill(wearPct, wearCol(c.tyreWear))} /></span>
                              <b style={{ color: wearCol(c.tyreWear), fontWeight: 700 }}>%{wearPct}</b>
                            </>) : (!ax && <span style={{ color: "var(--rc-text-3)" }}>—</span>)}
                          </span>
                        </td>
                        <td style={{ ...tdBase, color: "var(--rc-text-3)" }}>
                          {c.stintSec > 0 ? fmtHMS(c.stintSec) : "—"}</td>
                        <td style={{ ...tdBase, color: (c.damage || 0) > 0.15 ? "var(--rc-danger)"
                          : (c.damage || 0) > 0.02 ? "var(--rc-warn)" : "var(--rc-text-3)" }}>
                          {c.damage != null ? `${Math.round(c.damage * 100)}%` : "—"}</td>
                        <td style={tdBase} title={t("Ceza sayısı (cut/puan cezaları dahil)")}>
                          {c.penalties > 0
                            ? <span style={{ color: "var(--rc-warn)", fontWeight: 700 }}>{c.penalties}x</span>
                            : <span style={{ color: "var(--rc-text-3)" }}>—</span>}</td>
                        <td style={tdBase}>
                          {c.inPits && <span className="chip" style={{ marginRight: 4, color: "var(--rc-warn)",
                            borderColor: "var(--rc-warn)" }}>PIT</span>}
                          <span style={{ color: "var(--rc-text-3)" }}>{c.pitStops ?? "—"}</span></td>
                        <td style={tdBase}>
                          {c.lapsDone > 0 && c.lapKey && (
                            <button className="flapsbtn" title={t("Tur zamanları")} aria-label={t("Tur zamanları")}
                              data-tour={shown[0]?.c === c ? "livelapsbtn" : undefined}
                              onClick={(e) => { e.stopPropagation(); setLapsFor(c); }}>+</button>
                          )}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* pozisyon grafiği (PosChart çocuğu — fiş chartWrap yerleşimi) */}
          {!big && isRace && shown.length > 0 && (
            <div data-tour="livepos" style={{ padding: "14px 16px", borderTop: "1px solid var(--rc-border)" }}>
              <PosChart t={t} tid={tid} rid={rid} field={fieldAll}
                myClassOnly={myClassOnly} playerClass={playerClass} />
            </div>
          )}
        </div>

        {/* yan panel açma tırnağı (kapalıyken) */}
        {!big && !sideOn && (
          <button onClick={() => setSideOn(true)} title={t("Yan paneli aç")}
            style={{ position: "fixed", right: 0, top: 132, zIndex: 15, width: 26, height: 74,
              borderRadius: "10px 0 0 10px", border: "1px solid var(--rc-border-strong)", borderRight: "none",
              background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer",
              fontSize: 14 }}>‹</button>
        )}

        {/* ═══════════ SAĞ: yan panel (Harita → Kendi Araç → Strateji) ═══════════ */}
        {!big && (
          <div style={{ flex: sideOn ? "0 0 320px" : "0 0 0px", minWidth: 0, overflow: "hidden",
            alignSelf: "stretch",
            transition: "flex-basis .32s cubic-bezier(.4,0,.2,1), min-width .32s cubic-bezier(.4,0,.2,1)" }}>
            <aside aria-label={t("Pist ve araç paneli")} style={{ width: 320, marginLeft: "auto",
              display: "flex", flexDirection: "column", gap: 12,
              transform: sideOn ? "translateX(0)" : "translateX(102%)", opacity: sideOn ? 1 : 0,
              transition: "transform .32s cubic-bezier(.4,0,.2,1), opacity .24s ease" }}>
              <button onClick={() => setSideOn(false)} style={{ alignSelf: "flex-end", display: "inline-flex",
                alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 8,
                border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)",
                color: "var(--rc-text-3)", cursor: "pointer", fontSize: 11.5 }}>{t("Paneli kapat")} ›</button>
              {s.trackLength > 0 && fieldAll.some((c) => c.posX != null) && (
                <TrackMap t={t} field={fieldAll} session={s} trackLength={s.trackLength}
                  tid={tid} trackKey={binKey(s.trackName, s.trackLength)} canSave={canEdit} />
              )}
              {own && <OwnCar t={t} own={own} liveFuelObs={liveFuelObs} topSrc={ownTopSrc} />}
              <StrategyBar t={t} field={fieldAll} />
            </aside>
          </div>
        )}
      </div>

      {/* Rakip karşılaştırma tepsisi — satır tıklamasıyla açılır. Taze kareden yeniden bulunur. */}
      {cmpCar && (() => {
        const ck = carKey(cmpCar);
        const fresh = fieldAll.find((c) => carKey(c) === ck);
        return fresh
          ? <CompareTray t={t} own={own}
              ownName={fieldAll.find((c) => c.isPlayer)?.driver}
              rival={fresh} onClose={() => setCmpCar(null)} />
          : null;
      })()}

      {/* Tur listesi modalı — satırı TAZE kareden bul (canlı lapsDone güncellenir). */}
      {lapsFor && (() => {
        const fk = lapsFor.lapKey || lapsFor.driver;
        const fresh = fieldAll.find((c) => (c.lapKey || c.driver) === fk) || lapsFor;
        return <LapsModal t={t} tid={tid} rid={rid} row={fresh} canEdit={canEdit}
          onClose={() => setLapsFor(null)} />;
      })()}
    </div>
  );
}
