/* Lastik stratejisi — v2.3.1 tasarım fişi (design_handoff_lastik/fis/06-lastik.md).
   Fiş "birebir uygula" kuralıyla geldi: markup yapısı, ölçüler ve koşullu renk
   mantığı fişten kopyalandı, türetilmedi. Renkler tokens üzerinden (fişteki
   "token yok" işaretli sekiz değer styles.js'e eklendi: --rc-tread-1..5,
   --rc-surface-6, --rc-surface-7, --rc-text-6, --rc-on-set, --rc-danger-4,
   --rc-danger-soft).

   Fişten SAPMALAR (bilinçli, hepsi "gerçek veriye bağla" kuralının sonucu):
   · Satırlar fişteki sabit 8 (Qual+S1..S7) yerine racePlan'dan gelen gerçek
     stint sayısı (tyreInfo.rows) — fişin TY_GRID'i prototip örneğidir.
   · Izgara projenin state'inden: tyreQual + tyreStints. Hücre/hızlı atama
     yazımları projenin reducer'larından geçer (upTyreCell/quickTyre) — onlar
     syncPitTyres'i de çalıştırır, ızgarayı doğrudan yazmak pit bayraklarını
     bayat bırakırdı.
   · Defter (TY_LEDGER) ve canlı diş (TY_LIVE_*) prototip örneğiydi; gerçeği
     Firebase livetyre/livelaps + köprünün own.tyres'ı.
   · TY_STINT_LAPS gerçek plandan (stintLaps); plan yoksa fişin 19'una düşer. */
import { useEffect, useState } from "react";
import { Icon } from "../components";
import { liveTyreSubscribe, liveLapsSubscribe } from "../storage";
import { buildLedger, ledgerSummary, planChanges, comparePlan } from "../tyreLedger";

const CORNERS = ["FL", "FR", "RL", "RR"];

/* set kullanım renkleri — fiş "Sabitler" bölümü, upstream TY_COL ile birebir */
const TY_NEW = "var(--rc-ok)";
const TY_2X = "var(--rc-warn-3)";
const TY_QUAL = "var(--rc-delta)";
const TY_3X = "var(--rc-danger-3)";
const TY_4X = "var(--rc-danger-4)";
const TY_WET = "var(--rc-ok-soft)";
const TY_ERR = "var(--rc-danger)";
const useCol = (n, qual) => (n <= 1 ? TY_NEW : n === 2 ? (qual ? TY_QUAL : TY_2X) : n === 3 ? TY_3X : TY_4X);

/* Hücre zemini fişte `${col}2E` (hex + alfa). Token'lı renkte hex birleştirme
   geçersiz olur → aynı oranı color-mix ile kur (0x2E = 46/255 ≈ %18). */
const tint = (c, pct) => `color-mix(in srgb, ${c} ${pct}%, transparent)`;

/* pit işlemi sınıfı — upstream state.js pitTyreFlag (0 taşı … 4 eski kuru tekrar) */
const TY_OPS = [
  { lbl: "taşı", col: "var(--rc-border-strong)", carry: true },
  { lbl: "yeni kuru", col: "var(--rc-ok)" },
  { lbl: "Qual'a dön", col: "var(--rc-delta)" },
  { lbl: "wet", col: "var(--rc-ok-soft)" },
  { lbl: "eski kuru tekrar", col: "var(--rc-warn)" },
];
const changeTimeOf = (n, t12, t34) => (n > 0 ? (n <= 2 ? t12 : t34) : 0);
/* Kalan diş → renk (TinyPedal'ın 9 kademesi okunabilirlik için 5'e indirilmiş) */
const treadCol = (v) => (v > 0.75 ? "var(--rc-tread-1)" : v > 0.55 ? "var(--rc-tread-2)"
  : v > 0.35 ? "var(--rc-tread-3)" : v > 0.15 ? "var(--rc-tread-4)" : "var(--rc-tread-5)");
/* Hamur → şerit rengi. Oyun hamuru yalnız ön/arka verir, köşe başına yok. */
const COMP_COL = (comp) => {
  const c = String(comp || "").toLowerCase();
  if (c.includes("wet") || c.includes("rain")) return "var(--rc-delta)";
  if (c.includes("soft")) return "var(--rc-danger-3)";
  if (c.includes("hard")) return "#E7E7E7";
  if (c.includes("medium")) return "var(--rc-warn-3)";
  return "var(--rc-border-strong)";
};
/* Köşe eğilimi — temel aşınmanın köşe çarpanı (fiş TY_WEAR_BIAS). Yalnız kullanıcı
   köşe değeri girmemişken varsayılan türetmek için; ölçüm varsa o ezer. */
const TY_WEAR_BIAS = [1.15, 0.92, 1.05, 0.88];
/* Plan yoksa stint turu bilinmez; fişin kendi sabiti yedek olarak kullanılır. */
const TY_STINT_LAPS = 19;
const r1 = (v) => Math.round(v * 10) / 10;

export default function TyreTab({
  t, st, up, tyreInfo, carriedAt, upTyreCell, quickTyre,
  qsel, setQsel, QSEL_LBL, clearTyres, tid, rid, lapKey,
  ownTyres, lastLapNo, stintLaps, readOnly = false,
}) {
  /* Lastik defteri — köprünün livetyre kaydı (v2.3.0). Elle giriş yok. */
  const [tyreLog, setTyreLog] = useState(null);
  const [lapMap, setLapMap] = useState(null);
  useEffect(() => {
    if (!tid || !rid || !lapKey) { setTyreLog(null); setLapMap(null); return undefined; }
    const a = liveTyreSubscribe(tid, rid, lapKey, setTyreLog);
    const b = liveLapsSubscribe(tid, rid, lapKey, setLapMap);
    return () => { a(); b(); };
  }, [tid, rid, lapKey]);

  /* Pencere/menü durumları — ekrana özel, state'e yazılmaz (fiş: tyPick/tyQuick/tyLog) */
  const [tyPick, setTyPick] = useState(null);
  const [tyQuick, setTyQuick] = useState(null);
  const [tyLog, setTyLog] = useState(false);

  const ledger = buildLedger(tyreLog, lapMap);
  const sum = ledgerSummary(ledger);

  /* ---- ızgara: satır 0 = Qual, 1..n = S1..Sn (gerçek plandan) ---- */
  const rows = tyreInfo.rows;
  const tyGrid = rows.map((r) => r.vals.map((v) => String(v ?? "").trim()));
  const rowIdxOf = (ri) => rows[ri].row;          // proje indeksi: -1 Qual, 0.. stint

  const tyLimit = Math.max(0, st.tyreLimit);
  const tyUseCount = {};
  const tyLock = {};
  const tyConflictSet = new Set();
  tyGrid.forEach((row) => row.forEach((v, ci) => {
    if (!v || v === "W") return;
    tyUseCount[v] = (tyUseCount[v] || 0) + 1;
    const corner = CORNERS[ci];
    if (!tyLock[v]) tyLock[v] = corner;
    else if (tyLock[v] !== corner) tyConflictSet.add(v);
  }));
  const qualSets = new Set((tyGrid[0] || []).filter((v) => v && v !== "W"));
  const tyConflicts = Array.from(tyConflictSet);
  const cellCol = (v) => {
    if (!v) return "var(--rc-border-strong)";
    if (v === "W") return TY_WET;
    if (tyConflictSet.has(v)) return TY_ERR;
    return useCol(tyUseCount[v] || 0, qualSets.has(v));
  };
  const tyUsed = Object.keys(tyUseCount).length;
  const tyWet = tyGrid.flat().filter((v) => v === "W").length;
  const tyAvail = tyLimit - tyUsed;

  /* PATLAK — hücre bazlı işaret, anahtar "satır:köşe" (satır 0 = Qual). */
  const tyPop = st.tyrePop || {};
  const popKey = (ri, ci) => `${ri}:${ci}`;
  const isPop = (ri, ci) => !!tyPop[popKey(ri, ci)];
  const popCount = Object.keys(tyPop).filter((k) => tyPop[k]).length;
  const popSets = new Set(Object.keys(tyPop).filter((k) => tyPop[k]).map((k) => {
    const [ri, ci] = k.split(":").map(Number);
    return String((tyGrid[ri] || [])[ci] || "").trim();
  }).filter(Boolean));
  const togglePop = (ri, ci) => {
    if (readOnly) return;
    const k = popKey(ri, ci);
    const next = { ...tyPop };
    if (next[k]) delete next[k]; else next[k] = true;
    up({ tyrePop: next });
  };

  /* hücre → pit işlemi (upstream pitTyreFlag): 0 taşı · 1 yeni kuru · 2 Qual'a dön
     · 3 wet · 4 eski kuru tekrar. Aynı numarayı tekrar yazmak değişim değildir. */
  const tyOpFlag = (ri, ci) => {
    const v = (tyGrid[ri] || [])[ci] || "";
    if (!v) return 0;
    if (v === "W") return 3;
    if (ri === 0) return 1;
    if (v === ((tyGrid[ri - 1] || [])[ci] || "")) return 0;
    if (v === ((tyGrid[0] || [])[ci] || "")) return 2;
    if ((tyGrid[0] || []).some((x) => x === v)) return 4;
    for (let j = 1; j < ri; j += 1) if ((tyGrid[j] || []).some((x) => x === v)) return 4;
    return 1;
  };
  const tyRowOps = tyGrid.map((_, ri) => [0, 1, 2, 3].map((ci) => tyOpFlag(ri, ci)));
  const tyFill = tyGrid.map((row) => row.filter(Boolean).length);

  /* ---- aşınma: TUR başına, KÖŞE başına (fiş) ---- */
  const SL = Number(stintLaps) > 0 ? Number(stintLaps) : TY_STINT_LAPS;
  const tyWearC = [0, 1, 2, 3].map((i) => {
    const v = (st.tyreWearC || [])[i];
    if (Number.isFinite(v)) return v > 8 ? r1(v / SL) : v;   // >8 = eski stint-bazlı kayıt
    return r1(((st.tyreWearPerStint ?? 30) * TY_WEAR_BIAS[i]) / SL);
  });
  const tyWearCF = tyWearC.map((p) => (p > 0 ? p / 100 : 0));
  const tyStintC = tyWearCF.map((p) => p * SL);
  const tyWearLap = r1(tyWearC.reduce((a, b) => a + b, 0) / 4);
  const setWearC = (i, d) => !readOnly && up({
    tyreWearC: tyWearC.map((v, j) => (j === i ? Math.max(0, Math.min(20, r1(v + d))) : v)),
  });

  /* diş modeli — boş hücre taşımadır, devralınan setin dişinden hesaplanır */
  const tyEffGrid = (() => {
    const cur = (tyGrid[0] || ["", "", "", ""]).slice();
    const out = [cur.slice()];
    for (let i = 1; i < tyGrid.length; i += 1) {
      tyGrid[i].forEach((v, c) => { if (v) cur[c] = v; });
      out.push(cur.slice());
    }
    return out;
  })();
  const tyTread = (() => {
    const seen = new Map();
    return tyEffGrid.map((row) => row.map((id, ci) => {
      if (!id || id === "W") return null;
      const uses = seen.get(id) || 0;
      seen.set(id, uses + 1);
      const w = tyStintC[ci];
      const start = 1 - w * uses;
      const end = start - w;
      return { id, uses, start, end, wear: w, fresh: uses === 0, blowout: end < 0 };
    }));
  })();

  const t12 = Number.isFinite(Number(st.tyreChangeT12)) ? Number(st.tyreChangeT12) : 4.5;
  const t34 = Number.isFinite(Number(st.tyreChangeT34)) ? Number(st.tyreChangeT34) : 12;
  const plan = planChanges(st.tyreStints);
  const tyChangeSum = plan.reduce((s, c) => s + changeTimeOf(c.n, t12, t34), 0);
  const cmp = comparePlan(plan, ledger);
  const cmpOff = cmp.filter((r) => r.state === "diff" || r.state === "extra").length;

  /* ÖLÇÜLEN aşınma — fişin hesabı birebir: yalnız taze setle AÇIK dönemde,
     köşe başına (1 − kalan diş) / geçen tur. Veri eksikse buton hiç çizilmez. */
  const liveTread = (() => {
    const v = ["fl", "fr", "rl", "rr"].map((k) => Number(ownTyres && ownTyres[k] && ownTyres[k].wear));
    return v.every((x) => Number.isFinite(x) && x >= 0 && x <= 1) ? v : null;
  })();
  const tyMeas = (() => {
    const p = ledger.length ? ledger[ledger.length - 1] : null;
    if (!p || p.n !== 4 || !p.open || !liveTread) return null;
    const laps = Number(lastLapNo) - Number(p.fromLap);
    if (!(laps >= 1)) return null;
    const perLap = liveTread.map((x) => (1 - x) / laps);
    if (!perLap.every((v) => v > 0)) return null;
    return { laps, perLap, avg: perLap.reduce((a, b) => a + b, 0) / 4, tread: liveTread };
  })();

  const wetCount = tyWet;
  const kpiL = { color: "var(--rc-text-3)", fontSize: 10, textTransform: "uppercase", letterSpacing: ".1em" };
  const thLeft = { textAlign: "left", padding: "9px 14px", fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--rc-text-3)", borderBottom: "1px solid var(--rc-border)", whiteSpace: "nowrap" };
  const thCorner = { ...thLeft, textAlign: "center" };
  const stepBtn = { width: 36, height: 40, border: "none", background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: readOnly ? "not-allowed" : "pointer", fontSize: 15 };

  /* hızlı atama — proje reducer'ına bağlanır (syncPitTyres orada çalışır) */
  const needCount = (q) => (q.wet || q.qual ? 0 : q.idx.length);
  const mkQuick = (q) => {
    const short = needCount(q) > tyAvail;
    return {
      ...q,
      short,
      sub: short ? `${t("yetersiz")} · ${tyAvail} ${t("kaldı")}` : q.sub,
      go: () => {
        if (short || tyQuick == null || readOnly) return;
        quickTyre(rowIdxOf(tyQuick), q.action);
        setQsel((s) => ({ ...s, [rowIdxOf(tyQuick)]: q.action }));
        setTyQuick(null);
      },
    };
  };
  const quickAll = [
    { label: "4 yeni", sub: "FL FR RL RR", idx: [0, 1, 2, 3], col: "var(--rc-ok)", action: "new4" },
    { label: "4 wet", sub: "limitten bağımsız", wet: true, idx: [0, 1, 2, 3], col: "var(--rc-ok-soft)", action: "wet4" },
    { label: "Qual'a dön", sub: "Qual setleri", qual: true, idx: [0, 1, 2, 3], col: "var(--rc-delta)", action: "qual4" },
  ].map(mkQuick);
  const quickPairs = [
    { label: "2 yeni ön", sub: "FL · FR", idx: [0, 1], col: "var(--rc-warn-3)", action: "fronts" },
    { label: "2 yeni arka", sub: "RL · RR", idx: [2, 3], col: "var(--rc-warn-3)", action: "rears" },
    { label: "2 yeni sol", sub: "FL · RL", idx: [0, 2], col: "var(--rc-warn-3)", action: "lefts" },
    { label: "2 yeni sağ", sub: "FR · RR", idx: [1, 3], col: "var(--rc-warn-3)", action: "rights" },
  ].map(mkQuick);
  const quickSingles = [
    { label: "FL", sub: "1 yeni", idx: [0], col: "var(--rc-text-2)", single: true, action: "fl" },
    { label: "FR", sub: "1 yeni", idx: [1], col: "var(--rc-text-2)", single: true, action: "fr" },
    { label: "RL", sub: "1 yeni", idx: [2], col: "var(--rc-text-2)", single: true, action: "rl" },
    { label: "RR", sub: "1 yeni", idx: [3], col: "var(--rc-text-2)", single: true, action: "rr" },
  ].map(mkQuick);

  const setCell = (ri, ci, val) => { if (!readOnly) upTyreCell(rowIdxOf(ri), ci, val); setTyPick(null); };

  return (
    <div style={{ padding: "18px 20px 40px", animation: "rcin .26s ease-out", display: "flex", flexDirection: "column", gap: 14 }} data-tour="tyrecard">
      <div style={{ display: "flex", alignItems: "flex-end", gap: 18, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 440px", minWidth: 0 }}>
          <h2 style={{ margin: 0, fontFamily: "var(--rc-font-display)", textTransform: "uppercase", letterSpacing: ".06em", fontSize: 22, fontWeight: 700 }}>{t("Lastik stratejisi")}</h2>
        </div>
        <button onClick={() => { if (!readOnly) { clearTyres(); up({ tyrePop: {} }); } }}
          style={{ padding: "8px 14px", borderRadius: 9, cursor: readOnly ? "not-allowed" : "pointer", border: "1px solid var(--rc-danger)", background: "transparent", color: "var(--rc-danger)", fontSize: 12.5, opacity: readOnly ? 0.45 : 1 }}>{t("Tümünü temizle")}</button>
      </div>

      {/* ---- ÜST ŞERİT: tek kart, dört bölme ---- */}
      <div style={{ display: "flex", flexWrap: "wrap", border: "1px solid var(--rc-border)", borderRadius: 14, background: "var(--rc-surface)", overflow: "hidden" }}>
        <div style={{ flex: "0 0 auto", padding: "14px 18px", borderRight: "1px solid var(--rc-line-soft)", display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={kpiL}>{t("Kuru set limiti")}</span>
          <span style={{ display: "inline-flex", alignItems: "center", border: "1px solid var(--rc-border)", borderRadius: 10, overflow: "hidden", width: "max-content" }}>
            <button onClick={() => !readOnly && up({ tyreLimit: Math.max(0, tyLimit - 1) })} style={stepBtn}>−</button>
            <b style={{ minWidth: 54, textAlign: "center", fontFamily: "var(--rc-font-display)", fontSize: 26, fontWeight: 700 }}>{tyLimit}</b>
            <button onClick={() => !readOnly && up({ tyreLimit: Math.min(40, tyLimit + 1) })} style={stepBtn}>+</button>
          </span>
        </div>

        <div style={{ flex: "1 1 340px", minWidth: 0, padding: "14px 18px", borderRight: "1px solid var(--rc-line-soft)", display: "flex", flexDirection: "column", gap: 11 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 9, flexWrap: "wrap" }}>
            <span style={kpiL}>{t("Set bütçesi")}</span>
            <b style={{ fontFamily: "var(--rc-font-display)", fontSize: 24, fontWeight: 700, lineHeight: 1 }}>{tyUsed}</b>
            <span style={{ fontSize: 11.5, color: "var(--rc-text-3)" }}>{t("farklı kuru set kullanıldı")}</span>
            <span style={{ padding: "3px 9px", borderRadius: 99, fontSize: 10.5, whiteSpace: "nowrap",
              border: `1px solid ${tyAvail < 0 ? "var(--rc-danger)" : "var(--rc-border)"}`,
              color: tyAvail < 0 ? "var(--rc-danger)" : "var(--rc-ok)",
              background: tyAvail < 0 ? tint("var(--rc-danger)", 10) : "transparent" }}>
              {tyAvail < 0 ? `${-tyAvail} ${t("set fazla")}` : `${tyAvail} ${t("set kaldı")}`}</span>
            <span style={{ marginLeft: "auto", padding: "3px 9px", borderRadius: 99, fontSize: 10.5, whiteSpace: "nowrap",
              border: `1px solid ${wetCount ? TY_WET : "var(--rc-border)"}`,
              color: wetCount ? TY_WET : "var(--rc-text-5)",
              background: wetCount ? tint(TY_WET, 8) : "transparent" }}>wet {wetCount} · {t("limitsiz")}</span>
            {!!popCount && (
              <span title={`${t("Patlayan set")}: ${Array.from(popSets).join(", ") || "—"} — ${t("yeniden kullanılamaz")}`}
                style={{ padding: "3px 9px", borderRadius: 99, fontSize: 10.5, whiteSpace: "nowrap",
                  border: "1px solid var(--rc-danger)", color: "var(--rc-danger)", background: tint("var(--rc-danger)", 10) }}>
                {popCount} {t("patlak")}</span>
            )}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4,
            maxHeight: (tyLimit > 44 ? 19 : tyLimit > 30 ? 23 : 25) * 4 + 12, overflowY: "auto" }}>
            {Array.from({ length: tyLimit }, (_, i) => {
              const id = String(i + 1);
              const uses = tyUseCount[id] || 0;
              const col = uses ? cellCol(id) : null;
              const popped = popSets.has(id);
              return (
                <i key={id} title={popped ? `Set ${id} · ${t("PATLADI — yeniden kullanılamaz")}`
                  : uses ? `Set ${id} · ${uses}× · ${tyLock[id] || ""} ${t("köşesinde kilitli")}` : `Set ${id} · ${t("kullanılmadı")}`}
                  style={{ flex: "0 0 auto",
                    width: tyLimit > 44 ? 21 : tyLimit > 30 ? 25 : 27,
                    height: tyLimit > 44 ? 19 : tyLimit > 30 ? 23 : 25,
                    borderRadius: 5, boxSizing: "border-box",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "var(--rc-font-display)", fontWeight: 700, fontStyle: "normal",
                    fontSize: tyLimit > 44 ? 10 : tyLimit > 30 ? 11 : 12, lineHeight: 1, letterSpacing: 0,
                    background: popped ? "repeating-linear-gradient(115deg,var(--rc-danger) 0 3px,rgba(255,77,94,.25) 3px 6px)" : uses ? col : "var(--rc-surface-7)",
                    border: `1px solid ${popped ? "var(--rc-danger)" : uses ? col : "var(--rc-line-soft)"}`,
                    color: popped || uses ? "var(--rc-on-set)" : "var(--rc-text-6)" }}>{id}</i>
              );
            })}
          </div>
        </div>

        <div style={{ flex: "1 1 260px", minWidth: 230, padding: "14px 18px", borderRight: "1px solid var(--rc-line-soft)", display: "flex", flexDirection: "column", gap: 9 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
            <span style={kpiL}>{t("Tur başına aşınma · köşe")}</span>
            <span style={{ fontFamily: "var(--rc-font-display)", fontSize: 12.5, fontWeight: 700, color: "var(--rc-text-2)" }}>⌀ %{tyWearLap.toFixed(1)}/{t("tur")}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {CORNERS.map((c, i) => (
              <div key={c} title={`${c} · %${tyWearC[i].toFixed(1)}/${t("tur")} — ${SL} ${t("turluk stintte")} %${Math.round(tyStintC[i] * 100)}`}
                style={{ display: "flex", alignItems: "center", gap: 2, padding: "3px 3px 3px 8px", borderRadius: 9,
                  background: "var(--rc-surface-6)",
                  border: `1px solid ${tyWearC[i] === Math.max(...tyWearC) ? "var(--rc-border-strong)" : "var(--rc-line-soft)"}` }}>
                <span style={{ fontFamily: "var(--rc-font-display)", fontSize: 10, fontWeight: 700, letterSpacing: ".08em", color: "var(--rc-text-3)" }}>{c}</span>
                <span style={{ display: "inline-flex", alignItems: "center", marginLeft: "auto" }}>
                  <button onClick={() => setWearC(i, -0.1)} style={{ width: 21, height: 26, border: "none", background: "transparent", lineHeight: 1, color: readOnly ? "var(--rc-border-strong)" : "var(--rc-text-3)", cursor: readOnly ? "not-allowed" : "pointer", fontSize: 13 }}>−</button>
                  <b style={{ minWidth: 42, textAlign: "center", fontFamily: "var(--rc-font-display)", fontSize: 15, fontWeight: 700, color: treadCol(1 - tyStintC[i]) }}>%{tyWearC[i].toFixed(1)}</b>
                  <button onClick={() => setWearC(i, 0.1)} style={{ width: 21, height: 26, border: "none", background: "transparent", lineHeight: 1, color: readOnly ? "var(--rc-border-strong)" : "var(--rc-text-3)", cursor: readOnly ? "not-allowed" : "pointer", fontSize: 13 }}>+</button>
                </span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            {!!tyMeas && (
              <button onClick={() => !readOnly && up({ tyreWearC: tyMeas.perLap.map((v) => r1(v * 100)) })}
                title={`${t("Canlı ölçüm")} · ${tyMeas.laps} ${t("tur")} — ${t("kalan diş")} ${CORNERS.map((c, i) => `${c} %${Math.round(tyMeas.tread[i] * 100)}`).join(" · ")}\n${t("Tıkla: dört köşeye ayrı ayrı uygula")} (${tyMeas.perLap.map((v) => `%${(v * 100).toFixed(1)}`).join(" ")}/${t("tur")})`}
                style={{ padding: "6px 10px", borderRadius: 8, cursor: readOnly ? "not-allowed" : "pointer", fontSize: 11.5, whiteSpace: "nowrap", border: "1px solid var(--rc-ok)", background: "transparent", color: "var(--rc-ok)" }}>
                {t("ölçülen")} ⌀%{(tyMeas.avg * 100).toFixed(1)}/{t("tur")} →</button>
            )}
            <button onClick={() => !readOnly && up({ tyreWearC: tyWearC.map(() => tyWearLap) })}
              title={t("Dört köşeyi ortalamaya eşitle")}
              style={{ padding: "6px 10px", borderRadius: 8, fontSize: 11.5, whiteSpace: "nowrap", border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text-3)", cursor: readOnly ? "not-allowed" : "pointer" }}>{t("eşitle")}</button>
          </div>
        </div>

        <div style={{ flex: "0 0 auto", minWidth: 190, padding: "14px 18px", display: "flex", flexDirection: "column", gap: 5 }}>
          <span style={kpiL}>{t("Plandaki lastik değişimi")}</span>
          <b style={{ fontFamily: "var(--rc-font-display)", fontSize: 32, fontWeight: 700, lineHeight: 1, color: "var(--rc-warn)" }}>+{tyChangeSum.toFixed(1)}s</b>
          {/* Fişin markup'ında tyPitNote yok ama kabul kriteri "plan boşken
              'hiçbir pitte lastik değişmiyor'" diyor; referans görselde (plan DOLU)
              bu bölmede üçüncü satır görünmüyor. İkisini uzlaştıran okuma: not
              YALNIZ plan boşken çizilir. */}
          {!plan.length && (
            <span style={{ fontSize: 11, color: "var(--rc-text-3)", lineHeight: 1.5 }}>
              {t("hiçbir pitte lastik değişmiyor")}</span>
          )}
        </div>
      </div>

      {/* ---- LASTİK DEFTERİ butonu ---- */}
      <button onClick={() => setTyLog(true)}
        style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", boxSizing: "border-box", textAlign: "left", fontFamily: "inherit", cursor: "pointer", border: "1px solid var(--rc-border)", borderRadius: 14, background: "var(--rc-surface)", padding: "13px 16px" }}>
        <span style={{ fontFamily: "var(--rc-font-display)", textTransform: "uppercase", letterSpacing: ".08em", fontSize: 14, fontWeight: 700, color: "var(--rc-text)" }}>{t("Lastik defteri")}</span>
        <span style={{ fontSize: 11.5, color: "var(--rc-text-3)" }}>{sum.fullSets} {t("tam set")} · {sum.axleChanges} {t("aks")} · {sum.fuelOnly} {t("yakıt-only")}</span>
        {/* FİŞTEN SAPMA (bilinçli): fiş bu çipi KOŞULSUZ çiziyor. Defter boşken
            "plana uyuyor" demek, hiçbir şey gerçekleşmemişken uyum İDDİA etmek
            olurdu — CLAUDE.md §1'in yasakladığı ve v2.3.0'da özellikle
            düzeltilmiş hata sınıfı. Yalnız gerçek kayıt varken çizilir. */}
        {!!ledger.length && (
          <span style={{ fontSize: 11.5, color: cmpOff ? "var(--rc-warn)" : "var(--rc-ok)" }}>{cmpOff ? `${cmpOff} ${t("sapma")}` : t("plana uyuyor")}</span>
        )}
        <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11.5, color: "var(--rc-text-3)", whiteSpace: "nowrap" }}>{t("Aç")}<i style={{ fontStyle: "normal", fontSize: 13, color: "var(--rc-text-5)" }}>↗</i></span>
      </button>

      {tyLog && (
        <>
          <div onClick={() => setTyLog(false)} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(10,6,10,.55)", backdropFilter: "blur(2px)", animation: "rcfade .18s ease-out" }} />
          <div style={{ position: "fixed", left: "50%", top: "50%", transform: "translate(-50%,-50%)", zIndex: 65, width: "min(560px,94vw)", maxHeight: "82vh", display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--rc-surface)", border: "1px solid var(--rc-border-strong)", borderRadius: 14, boxShadow: "0 24px 60px rgba(0,0,0,.55)", animation: "rcfade .18s ease-out" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: "1px solid var(--rc-line-soft)" }}>
              <span style={{ fontFamily: "var(--rc-font-display)", textTransform: "uppercase", letterSpacing: ".08em", fontSize: 14, fontWeight: 700 }}>{t("Lastik defteri")}</span>
              <span style={{ fontSize: 11.5, color: "var(--rc-text-3)" }}>{sum.fullSets} {t("tam set")} · {sum.axleChanges} {t("aks")} · {sum.fuelOnly} {t("yakıt-only")}</span>
              <button onClick={() => setTyLog(false)} style={{ marginLeft: "auto", width: 28, height: 28, borderRadius: 8, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 13, lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ padding: "14px 16px 16px", overflow: "auto" }}>
              <div style={{ fontSize: 11.5, color: "var(--rc-text-3)", marginBottom: 12 }}>{t("yarıştaki gerçek değişimler — köprüden gelir, elle giriş yok")}</div>
              {!ledger.length && (
                <div style={{ fontSize: 12.5, color: "var(--rc-text-3)", padding: "6px 0" }}>{t("Henüz kayıt yok — köprü çalışırken pit değişimleri buraya kendiliğinden düşer.")}</div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {ledger.map((r, i) => {
                  const col = COMP_COL(r.comp);
                  const w = Math.max(6, Math.round((r.laps / Math.max(1, sum.totalLaps)) * 100));
                  return (
                    <div key={r.idx} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", opacity: i === ledger.length - 1 ? 1 : 0.88 }}>
                      <span style={{ minWidth: 86, fontFamily: "var(--rc-font-display)", fontSize: 12.5, color: "var(--rc-text-2)" }}>{t("Tur")} {r.fromLap}–{r.toLap}</span>
                      <span title={r.n == null ? t("Yarış başındaki set — oyun ne takıldığını söylemiyor") : `${r.n} ${t("lastik takıldı")}`}
                        style={{ padding: "2px 9px", borderRadius: 99, fontSize: 10, whiteSpace: "nowrap", fontFamily: "var(--rc-font-display)", letterSpacing: ".04em",
                          color: r.fresh ? "var(--rc-ok)" : r.partial ? "var(--rc-warn)" : "var(--rc-text-3)",
                          border: `1px solid ${r.fresh ? "var(--rc-ok)" : r.partial ? "var(--rc-warn)" : "var(--rc-border-strong)"}` }}>
                        {r.n == null ? t("Başlangıç") : r.fresh ? t("YENİ") : `${r.n} ${t("aks")}`}</span>
                      <span title={r.comp || t("hamur bilinmiyor")} style={{ flex: `0 0 ${w}%`, minWidth: 30, height: 10, borderRadius: 5, background: col, opacity: r.fresh ? 1 : 0.72 }} />
                      <span style={{ fontSize: 11.5, color: "var(--rc-text-3)" }}>
                        {r.laps} {t("tur")}{r.comp ? ` · ${r.comp}` : ""}{r.fuelOnly ? ` · ${r.fuelOnly} ${t("yakıt-only")}` : ""}{r.open ? ` · ${t("sürüyor")}` : ""}</span>
                    </div>
                  );
                })}
              </div>
              {!!ledger.length && (
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--rc-line-soft)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 9 }}>
                  <span style={{ fontFamily: "var(--rc-font-display)", textTransform: "uppercase", letterSpacing: ".08em", fontSize: 12, fontWeight: 700 }}>{t("Plan ↔ Gerçek")}</span>
                  <span style={{ fontSize: 11.5, color: cmpOff ? "var(--rc-warn)" : "var(--rc-ok)" }}>{cmpOff ? `${cmpOff} ${t("sapma")}` : t("plana uyuyor")}</span>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {cmp.map((r) => {
                    const col = r.state === "match" ? "var(--rc-ok)" : r.state === "diff" ? "var(--rc-warn)" : r.state === "extra" ? "var(--rc-danger)" : "var(--rc-border-strong)";
                    const lbl = r.state === "pending" ? t("bekliyor") : r.state === "extra" ? t("planda yok") : `${r.plan.n} → ${r.actual.n}`;
                    return (
                      <span key={r.i} title={[
                        r.plan ? `${t("Plan")}: S${r.plan.stint} · ${r.plan.n} ${t("lastik")}` : t("Planda karşılığı yok"),
                        r.actual ? `${t("Gerçek")}: ${t("tur")} ${r.actual.fromLap} · ${r.actual.n} ${t("lastik")}` : t("Henüz gerçekleşmedi"),
                      ].join("\n")}
                        style={{ padding: "3px 9px", borderRadius: 99, fontSize: 10.5, whiteSpace: "nowrap", border: `1px solid ${col}`, color: col, background: r.state === "pending" ? "transparent" : "rgba(255,255,255,.03)" }}>
                        {r.i + 1}. {lbl}</span>
                    );
                  })}
                </div>
                <div style={{ fontSize: 11, color: "var(--rc-text-5)", marginTop: 9, lineHeight: 1.55, textWrap: "pretty" }}>
                  {t("Plan tablodan türetilir (dolu hücre = pit işlemi); planda tur numarası olmadığı için eşleme sırayla yapılır, tur-hassas değildir. Oyun set kimliği vermez — defter pit olaylarından türer, hamur yalnız ön/arka okunur.")}</div>
              </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ---- PLAN TABLOSU ---- */}
      <div style={{ border: "1px solid var(--rc-border)", borderRadius: 12, background: "var(--rc-surface)" }}>
        <div style={{ overflowX: "auto" }}>
          <table aria-label={t("Lastik strateji tablosu")} style={{ width: "100%", borderCollapse: "collapse", minWidth: 880 }}>
            <thead><tr>
              <th style={thLeft}>Stint</th>
              {CORNERS.map((c) => <th key={c} style={thCorner}>{c}</th>)}
              <th style={thLeft}>{t("Pitte ne oluyor · değişim")}</th>
              <th style={thLeft}>{t("Hızlı atama")}</th>
            </tr></thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={r.label} style={{ background: ri === 0 ? "rgba(77,159,255,.06)" : "transparent" }}>
                  <td style={{ padding: "9px 14px", borderBottom: "1px solid var(--rc-line-soft)", textAlign: "left", whiteSpace: "nowrap" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <b style={{ fontFamily: "var(--rc-font-display)", fontSize: 17, fontWeight: 700 }}>{r.label}</b>
                    </span>
                  </td>
                  {r.vals.map((raw, ci) => {
                    const v = String(raw ?? "").trim();
                    const carried = !v && ri > 0 ? carriedAt(r.row, ci) : "";
                    const col = cellCol(v);
                    const err = !!v && tyConflictSet.has(v);
                    const op = TY_OPS[(tyRowOps[ri] || [])[ci] || 0];
                    const tr = (tyTread[ri] || [])[ci];
                    const pop = isPop(ri, ci);
                    const trOn = !!tr && (pop || tyWearCF[ci] > 0);
                    const bad = !!tr && (pop || tr.blowout);
                    const trCol = !trOn ? "" : bad ? "var(--rc-danger)" : treadCol(tr.end);
                    const trPct = !trOn ? 0 : Math.max(0, Math.min(1, tr.end)) * 100;
                    return (
                      <td key={ci} style={{ padding: "7px 8px", borderBottom: "1px solid var(--rc-line-soft)", textAlign: "center", position: "relative" }}>
                        <button onClick={() => setTyPick({ ri, ci })}
                          title={err ? `${CORNERS[ci]} · set ${v} ${t("başka köşede de kullanılmış — köşe kilidi ihlali")}`
                            : v ? `${CORNERS[ci]} · ${ri === 0 ? t("yarışa çıkış seti") : t(op.lbl)}${v === "W" ? "" : ` · ${tyUseCount[v] || 1}× ${t("kullanım")}`}`
                              : carried ? `${CORNERS[ci]} · ${carried} ${t("taşınıyor — pitte işlem yok")}` : `${CORNERS[ci]} · ${t("boş")}`}
                          style={{ position: "relative", minWidth: 62, padding: "8px 10px", borderRadius: 9, cursor: "pointer",
                            fontFamily: "var(--rc-font-display)", fontSize: 14, fontWeight: 600,
                            border: pop ? "2px dashed var(--rc-danger)" : err ? `2px solid ${TY_ERR}` : v ? `1px solid ${col}` : "1px dashed var(--rc-border-strong)",
                            background: pop ? "var(--rc-tint-danger)" : v ? tint(col, 18) : "transparent",
                            color: pop ? "var(--rc-danger-soft)" : v ? col : carried ? "var(--rc-text-3)" : "var(--rc-border-strong)",
                            textDecoration: pop ? "line-through" : "none",
                            fontStyle: !v && carried ? "italic" : "normal" }}>
                          {v || (carried ? `⟳ ${carried}` : "—")}
                          {pop && (
                            <span style={{ position: "absolute", top: -7, right: -4, padding: "1px 5px", borderRadius: 99, fontFamily: "var(--rc-font-display)", fontSize: 8.5, fontWeight: 700, letterSpacing: ".06em", lineHeight: 1.5, background: "var(--rc-danger)", color: "var(--rc-on-set)", pointerEvents: "none" }}>{t("PATLAK")}</span>
                          )}
                        </button>
                        {trOn && (
                          <div title={pop ? `${CORNERS[ci]} · ${t("bu stintte patladı — set")} ${v || carried} ${t("yarış dışı, sonrası plansız pit")}`
                            : tr.blowout ? t("Plan bu seti kapasitesinin ötesinde çalıştırıyor")
                              : `${tr.fresh ? t("Yeni") : `%${Math.round(tr.start * 100)}`} → %${Math.round(tr.end * 100)} · ${t("bu setin")} ${tr.uses + 1}. ${t("stinti")} · ${CORNERS[ci]} ${t("aşınması")} %${tyWearC[ci].toFixed(1)}/${t("tur")}`}
                            style={{ display: "flex", alignItems: "center", gap: 4, width: 62, margin: "5px auto 0" }}>
                            <span style={{ flex: "1 1 auto", minWidth: 0, height: 5, borderRadius: 3, overflow: "hidden", background: bad ? "rgba(255,77,94,.22)" : "rgba(243,234,236,.10)" }}>
                              <span style={{ display: "block", height: "100%", borderRadius: 3, width: bad ? "100%" : `${trPct}%`,
                                background: bad ? "repeating-linear-gradient(115deg,var(--rc-danger) 0 3px,transparent 3px 6px)" : trCol }} />
                            </span>
                            <span style={{ flex: "0 0 auto", fontSize: 9.5, fontFamily: "var(--rc-font-display)", fontWeight: 700, letterSpacing: ".03em", whiteSpace: "nowrap", color: trCol }}>
                              {pop ? t("PATLADI") : tr.blowout ? t("PATLAK") : `%${Math.round(tr.end * 100)}`}</span>
                          </div>
                        )}
                      </td>
                    );
                  })}
                  <td style={{ padding: "7px 14px", borderBottom: "1px solid var(--rc-line-soft)", whiteSpace: "nowrap", borderLeft: "1px solid var(--rc-line-soft)" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 11 }}>
                      <span style={{ display: "grid", gridTemplateColumns: "repeat(2,8px)", gap: 3, flex: "0 0 auto" }}>
                        {(tyRowOps[ri] || [0, 0, 0, 0]).map((o, ci) => {
                          const m = TY_OPS[o];
                          return <i key={ci} title={`${CORNERS[ci]} · ${ri === 0 ? t("yarışa çıkış seti") : t(m.lbl)}`}
                            style={{ width: 8, height: 8, borderRadius: 99, display: "block", background: m.carry ? "transparent" : m.col, border: m.carry ? "1px solid var(--rc-border-strong)" : "none" }} />;
                        })}
                      </span>
                      <b style={{ fontFamily: "var(--rc-font-display)", fontSize: 15, fontWeight: 700, minWidth: 48,
                        color: ri === 0 ? "var(--rc-border-strong)" : (tyFill[ri] || 0) >= 3 ? "var(--rc-warn)" : tyFill[ri] ? "var(--rc-text-2)" : "var(--rc-border-strong)" }}>
                        {ri === 0 || !tyFill[ri] ? "—" : `+${changeTimeOf(tyFill[ri], t12, t34).toFixed(1)}s`}</b>
                      <span style={{ fontSize: 11, color: (tyFill[ri] || 0) === 3 ? "var(--rc-warn)" : "var(--rc-text-3)" }}>
                        {(() => {
                          if (ri === 0) return t("pit yok · buradan başlanır");
                          const ops = tyRowOps[ri] || [];
                          const n = tyFill[ri] || 0;
                          if (!n) return t("lastik değişmiyor · yalnız yakıt");
                          const kinds = [];
                          if (ops.filter((o) => o === 1).length) kinds.push(t("yeni"));
                          if (ops.filter((o) => o === 2).length) kinds.push("Qual");
                          if (ops.filter((o) => o === 3).length) kinds.push("wet");
                          if (ops.filter((o) => o === 4).length) kinds.push(t("eski"));
                          const head = n === 3 ? t("3 lastik · 4. teker aynı sürede") : `${n} ${t("lastik")}`;
                          return kinds.length ? `${head} · ${kinds.join(" + ")}` : head;
                        })()}</span>
                    </span>
                  </td>
                  <td style={{ padding: "9px 14px", borderBottom: "1px solid var(--rc-line-soft)", position: "relative" }}>
                    {r.row >= 0 && (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); setTyQuick((q) => (q === ri ? null : ri)); }}
                          style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 13px", borderRadius: 9, cursor: "pointer", fontSize: 12, whiteSpace: "nowrap", background: "var(--rc-surface-3)",
                            border: `1px solid ${tyQuick === ri ? "var(--rc-brand-bright)" : "var(--rc-border)"}`,
                            color: tyQuick === ri ? "var(--rc-text)" : "var(--rc-text-2)" }}>
                          ⚡ {t("Hızlı atama")} <span style={{ color: "var(--rc-border-strong)", transform: tyQuick === ri ? "rotate(180deg)" : "none", transition: "transform .18s ease", display: "inline-block" }}>▾</span>
                        </button>
                        {!!qsel[r.row] && (
                          <span style={{ marginLeft: 8, fontSize: 10.5, padding: "3px 9px", borderRadius: 99, border: "1px solid var(--rc-border-strong)", color: "var(--rc-text-3)", whiteSpace: "nowrap" }}>{t(QSEL_LBL[qsel[r.row]] || qsel[r.row])}</span>
                        )}
                        {tyQuick === ri && (
                          <div style={{ position: "absolute", top: "calc(100% - 2px)", left: 14, zIndex: 40, width: 270, background: "var(--rc-surface)", border: "1px solid var(--rc-border-strong)", borderRadius: 12, overflow: "hidden", boxShadow: "0 18px 44px rgba(0,0,0,.6)", animation: "rcpop .16s cubic-bezier(.2,.9,.3,1.05)" }}>
                            {[["Tüm köşeler", quickAll], ["İkili değişim", quickPairs]].map(([head, list], gi) => (
                              <div key={head}>
                                <div style={{ padding: "9px 13px 5px", color: "var(--rc-text-3)", fontSize: 9.5, textTransform: "uppercase", letterSpacing: ".1em", borderTop: gi ? "1px solid var(--rc-line-soft)" : "none" }}>{t(head)}</div>
                                {list.map((q) => (
                                  <button key={q.label} onClick={q.go}
                                    style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "7px 13px", border: "none", background: "transparent", color: q.short ? "var(--rc-border-strong)" : "var(--rc-text)", cursor: q.short ? "not-allowed" : "pointer" }}>
                                    <i style={{ width: 10, height: 26, borderRadius: 3, flex: "0 0 auto", background: q.short ? "var(--rc-border)" : q.col }} />
                                    <b style={{ fontSize: 12.5, flex: 1, textAlign: "left" }}>{t(q.label)}</b>
                                    <span style={{ fontSize: 10.5, color: q.short ? "var(--rc-danger)" : "var(--rc-text-3)" }}>{t(q.sub)}</span>
                                  </button>
                                ))}
                              </div>
                            ))}
                            <div style={{ padding: "9px 13px 5px", borderTop: "1px solid var(--rc-line-soft)", color: "var(--rc-text-3)", fontSize: 9.5, textTransform: "uppercase", letterSpacing: ".1em" }}>{t("Tek teker")}</div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 5, padding: "2px 10px 8px" }}>
                              {quickSingles.map((q) => (
                                <button key={q.label} onClick={q.go}
                                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "11px 6px", borderRadius: 10, cursor: q.short ? "not-allowed" : "pointer", border: `1px solid ${q.short ? "var(--rc-border)" : "var(--rc-border-strong)"}`, background: "var(--rc-surface-3)", color: "var(--rc-text)", opacity: q.short ? 0.45 : 1 }}>
                                  <b style={{ fontFamily: "var(--rc-font-display)", fontSize: 13, fontWeight: 600 }}>{q.label}</b>
                                </button>
                              ))}
                            </div>
                            <div style={{ display: "flex", gap: 6, padding: "8px 10px", borderTop: "1px solid var(--rc-line-soft)", background: "var(--rc-surface-2)" }}>
                              <button onClick={() => { if (!readOnly) { quickTyre(r.row, "carry"); setQsel((s) => ({ ...s, [r.row]: "carry" })); } setTyQuick(null); }}
                                style={{ flex: 1, padding: "7px 8px", borderRadius: 8, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 11 }}>⟳ {t("Devam")}</button>
                              <button onClick={() => { if (!readOnly) { quickTyre(r.row, "clear"); setQsel((s) => { const n = { ...s }; delete n[r.row]; return n; }); } setTyQuick(null); }}
                                style={{ flex: 1, padding: "7px 8px", borderRadius: 8, border: "1px solid var(--rc-border-strong)", background: "var(--rc-surface-3)", color: "var(--rc-text-3)", cursor: "pointer", fontSize: 11 }}>✕ {t("Temizle")}</button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 9, padding: "11px 16px", borderTop: "1px solid var(--rc-border)", background: "var(--rc-surface-2)" }}>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ flex: "0 0 78px", color: "var(--rc-text-5)", fontSize: 9.5, textTransform: "uppercase", letterSpacing: ".1em" }}>{t("Set kullanımı")}</span>
            {[["1× yeni", TY_NEW], ["2× tekrar", TY_2X], ["Qual'a dönüş", TY_QUAL], ["3× tekrar", TY_3X], ["4×+ aşırı", TY_4X], ["wet · limitsiz", TY_WET], ["⟳ taşınan set", "", true]].map(([lbl, c, dash]) => (
              <span key={lbl} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--rc-text-2)" }}>
                <i style={{ width: 10, height: 10, borderRadius: 3, display: "inline-block", flex: "0 0 auto", background: dash ? "transparent" : c, border: dash ? "1px dashed var(--rc-text-3)" : "none" }} />{t(lbl)}
              </span>
            ))}
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", paddingTop: 9, borderTop: "1px solid var(--rc-line-soft)" }}>
            <span style={{ flex: "0 0 78px", color: "var(--rc-text-5)", fontSize: 9.5, textTransform: "uppercase", letterSpacing: ".1em" }}>{t("Pit işlemi")}</span>
            {[["taşı · 0 sn", 0], ["yeni kuru", 1], ["Qual'a dön", 2], ["wet", 3], ["eski kuru tekrar", 4]].map(([lbl, o]) => {
              const m = TY_OPS[o];
              return (
                <span key={lbl} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--rc-text-2)" }}>
                  <i style={{ width: 9, height: 9, borderRadius: 99, display: "inline-block", flex: "0 0 auto", background: m.carry ? "transparent" : m.col, border: m.carry ? "1px solid var(--rc-border-strong)" : "none" }} />{t(lbl)}
                </span>
              );
            })}
            <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--rc-text-3)", whiteSpace: "nowrap" }}>
              {t("değişim süresi")}: 1-2 {t("lastik")} <b style={{ color: "var(--rc-warn)" }}>+{t12.toFixed(1)}s</b> · 3-4 {t("lastik")} <b style={{ color: "var(--rc-warn)" }}>+{t34.toFixed(1)}s</b></span>
          </div>
        </div>
      </div>

      {tyConflicts.length > 0 && (
        <div style={{ marginTop: 12, display: "flex", alignItems: "flex-start", gap: 9, padding: "11px 14px", borderRadius: 11, border: "1px solid var(--rc-danger)", background: "rgba(255,77,94,.08)", fontSize: 12, color: "#FFC9C0", lineHeight: 1.6 }}>
          <span style={{ flex: "0 0 auto", fontSize: 14 }}><Icon name="uyari" size={14} /></span>
          <span>{t("Köşe kuralı ihlali")} — <b>{tyConflicts.join(", ")}</b> {t("birden fazla köşede kullanılmış. Bir lastik ilk takıldığı köşeye kilitlenir; hatalı hücreyi düzelt.")}</span>
        </div>
      )}

      {/* ---- "Lastik seç" penceresi ---- */}
      {!!tyPick && (() => {
        const { ri, ci } = tyPick;
        const cur = (tyGrid[ri] || [])[ci] || "";
        const corner = CORNERS[ci];
        const popped = isPop(ri, ci);
        const carr = carriedAt(rows[ri].row, ci);
        return (
          <div onClick={() => setTyPick(null)} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(10,6,10,.74)", backdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, animation: "rcfade .18s ease-out" }}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: "min(560px,95vw)", maxHeight: "86vh", background: "var(--rc-surface)", border: "1px solid var(--rc-border-strong)", borderRadius: 16, overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 24px 70px rgba(0,0,0,.6)", animation: "rcpop .22s cubic-bezier(.2,.9,.3,1.05)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "14px 18px", borderBottom: "1px solid var(--rc-border)" }}>
                <span style={{ fontFamily: "var(--rc-font-display)", textTransform: "uppercase", letterSpacing: ".07em", fontSize: 17, fontWeight: 700 }}>{t("Lastik seç")}</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--rc-text-3)" }}>
                  <b style={{ color: "var(--rc-text)", fontFamily: "var(--rc-font-display)", fontSize: 15 }}>{rows[ri].label}</b>
                  <span style={{ padding: "2px 8px", borderRadius: 6, border: "1px solid var(--rc-border)", fontFamily: "var(--rc-font-display)", fontSize: 11, color: "var(--rc-text-2)" }}>{corner}</span>
                </span>
                <button onClick={() => setTyPick(null)} style={{ marginLeft: "auto", width: 30, height: 30, borderRadius: 9, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 14, lineHeight: 1 }}>✕</button>
              </div>
              <div style={{ overflowY: "auto", padding: "14px 18px 16px" }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                  <button onClick={() => setCell(ri, ci, "")}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 15px", borderRadius: 10, cursor: "pointer", fontSize: 12.5, border: `1px solid ${!cur ? "var(--rc-brand-bright)" : "var(--rc-border)"}`, background: "var(--rc-surface-3)", color: "var(--rc-text)" }}>
                    ⟳ {t("Önceki setle devam")} <span style={{ color: "var(--rc-text-3)" }}>{carr ? `· ${carr}` : ""}</span></button>
                  <button onClick={() => setCell(ri, ci, "W")}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 15px", borderRadius: 10, cursor: "pointer", fontSize: 12.5, border: `1px solid ${cur === "W" ? TY_WET : "var(--rc-border)"}`, background: cur === "W" ? tint(TY_WET, 12) : "var(--rc-surface-3)", color: TY_WET }}>🌧 {t("Wet · limitsiz")}</button>
                  <button onClick={() => togglePop(ri, ci)} title={t("Yarışta patlayan lastiği işaretle — set yeniden kullanılamaz")}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 15px", borderRadius: 10, cursor: readOnly ? "not-allowed" : "pointer", fontSize: 12.5,
                      border: `1px solid ${popped ? "var(--rc-danger)" : "var(--rc-border-strong)"}`,
                      background: popped ? tint("var(--rc-danger)", 16) : "var(--rc-surface-3)",
                      color: popped ? "var(--rc-danger-soft)" : "var(--rc-text-2)" }}>
                    {popped ? `⚠ ${t("Patlak işaretini kaldır")}` : `⚠ ${t("Bu stintte patladı")}`}</button>
                </div>
                <div style={{ color: "var(--rc-text-3)", fontSize: 10, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 9 }}>{t("Kuru setler")} · {corner} {t("köşesi")}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(88px,1fr))", gap: 8 }}>
                  {Array.from({ length: tyLimit }, (_, i) => {
                    const id = String(i + 1);
                    const uses = tyUseCount[id] || 0;
                    const lock = tyLock[id];
                    const isCur = cur === id;
                    const blocked = !!lock && lock !== corner && !isCur;
                    const col = uses ? cellCol(id) : TY_NEW;
                    return (
                      <button key={id} onClick={() => { if (!blocked) setCell(ri, ci, id); }}
                        style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "11px 8px", borderRadius: 10,
                          cursor: blocked ? "not-allowed" : "pointer", opacity: blocked ? 0.4 : 1,
                          border: `1px solid ${isCur ? "var(--rc-brand-bright)" : blocked ? "var(--rc-border)" : uses ? col : "var(--rc-border)"}`,
                          background: isCur ? "rgba(150,0,24,.24)" : "var(--rc-surface-3)", color: "var(--rc-text)" }}>
                        <b style={{ fontFamily: "var(--rc-font-display)", fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{id}</b>
                        <span style={{ fontFamily: "var(--rc-font-display)", fontSize: 10, color: blocked ? "var(--rc-danger)" : uses ? col : "var(--rc-text-3)" }}>
                          {blocked ? `🔒 ${lock}` : uses ? `${uses}× · ${lock}` : t("yeni")}</span>
                      </button>
                    );
                  })}
                </div>
                <div style={{ fontSize: 11, color: "var(--rc-text-3)", lineHeight: 1.6, marginTop: 12 }}>{t("Kilitli köşesi farklı olan setler seçilemez — bir lastik ilk takıldığı köşede kalır.")}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 18px", borderTop: "1px solid var(--rc-border)", background: "var(--rc-surface-2)" }}>
                <span style={{ fontSize: 11.5, color: "var(--rc-text-3)" }}>{t("Kalan")} <b style={{ color: tyAvail < 0 ? "var(--rc-danger)" : "var(--rc-ok)", fontFamily: "var(--rc-font-display)" }}>{tyAvail}</b> {t("set")}</span>
                <button onClick={() => setCell(ri, ci, "")} style={{ marginLeft: "auto", padding: "8px 14px", borderRadius: 9, border: "1px solid var(--rc-border-strong)", background: "var(--rc-surface-3)", color: "var(--rc-text-3)", cursor: "pointer", fontSize: 12 }}>{t("Hücreyi boşalt")}</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
