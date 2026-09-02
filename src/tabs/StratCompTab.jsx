/* Strateji Karşılaştırma — YARIŞ ÖNCESİ karar aracı (v2.4.0).

   Kaynak: `design_handoff_strateji_karsilastirma` tasarım fişi, "birebir port"
   kuralıyla geldi (fidelity: hifi — "pixel-perfect, exact reproduction").
   Ölçüler, boşluklar, yazı tipleri, metinler ve etkileşimler fişin
   `Strateji Karşılaştırma.dc.html` prototipinden birebir alındı.

   ---- RENKLER: FİŞİN HEX'LERİ = UYGULAMANIN TOKENLARI ----
   Fiş "app tokenlarını kullanma, bu hex'leri kullan" diyor. Karşılaştırıldı:
   fişteki 24 rengin 24'ü styles.js'te ZATEN aynı değerle tanımlı (tasarım
   uygulamanın kendi paletiyle çizilmiş). Bu yüzden token üzerinden yazıldı —
   koyu temada renk fişle BİREBİR aynı, ama açık tema da bozulmuyor. Eşleme:
     #0B0708 --rc-bg · #120C0E --rc-surface · #0F0A0C --rc-surface-inset
     #150E10 --rc-surface-2 · #1E1418 --rc-surface-3 · #241519 --rc-line-soft
     #34232A --rc-border · #4A2F38 --rc-border-strong · #1B1013 --rc-surface-5
     #F3EAEC --rc-text · #C9B3B9 --rc-text-2 · #A88C93 --rc-text-3
     #7A6F75 --rc-text-4 · #5B5157 --rc-text-5 · #960018 --rc-brand
     #D24357 --rc-brand-bright · #4D9FFF --rc-delta · #EF8A2B --rc-cls-gt3
     #37D67A --rc-ok · #F0604D --rc-danger-3 · #FF4D5E --rc-danger
     #F5B23D --rc-warn · #4C9AFF --rc-info · #B58BFF --rc-purple
   Tek istisna #FFE2B0 (amber uyarı metni) — token karşılığı yoktu,
   `--rc-warn-text` olarak eklendi (v2.3.1 lastik fişindeki desen).
   Fontlar zaten uyuyor: index.html Rajdhani + IBM Plex Mono + Inter'i fişin
   istediği ağırlıklarla yüklüyor.

   ---- FİŞTEN BİLİNÇLİ ÜÇ SAPMA ----
   1. HESAP PROTOTİPTEN DEĞİL, `stratComp.js`'ten. Fişin "Calculation model"i
      zaten bu modülden kopyalanmış (README öyle diyor) ve modül Excel'in
      sayılarına karşı test edilmiş (57 test). Prototipin `seed()` fonksiyonu
      ise pit yolu 24 / yakıt 40 / ort. tur "2:02.400" gibi SABİT örnek
      değerler yazıyor — README bunu "placeholder demo data · wire the real
      register to the app's data source" diye işaretliyor. Bu yüzden
      "Planımdan ekle" düğmeleri gerçek `computePlan` çıktısını kullanır
      (seedFromPlan), uydurma sabit yazmaz.
   2. SEÇİM LİSTESİ GERÇEK VERİDEN. Prototip 5 GT3 aracını sabit yazıyor;
      burada uygulamanın kendi CARS/CAR_CLASSES listesi kullanılır, araç
      görseli teamAssets.carImageSrc'ten (takımın yüklediği görsel varsa o).
   3. PİST + SINIF SEÇİCİ KORUNDU. Prototipin başlığında bayrak ve "6H Spa"
      alt yazısı var ama seçici yok (fiş, seçicinin eklendiği commit'ten
      önceki PR'a bakıyor). Seçici başlığa fişin diliyle yerleştirildi;
      bayrak ve alt yazı seçili pistten gelir.

   Ekran yarış SIRASINDA kullanılmaz: canlı kareye ve köprüye dokunmaz
   (CLAUDE.md §0 — yeni REST/thread/timer yok). */
import { useState, useMemo } from "react";
import { teamTime, compareTeams, rankTeams, stintWarnings, strategyOptions,
  suggestedLaps, fmtLapMs, parseLapSec, num } from "../stratComp";
import { stratPick } from "../state";
import { ASSET, AV, TRACK_ASSET, trackName, CARS } from "../constants";
import { carImageSrc } from "../teamAssets";

/* ---------- biçimleyiciler (prototiple birebir) ---------- */
/* Fişin `fmtDur`u: DÜZ saniye, tek ondalık ("394.0"). engine.fmtDur'dan
   FARKLI (o 60 sn üstünü m:ss yapar) — fiş tüm sabit kayıp kalemlerini
   saniye olarak gösteriyor, o yüzden yerel. */
const fmtSec = (v) => (Number.isFinite(v) ? v.toFixed(1) : "—");
const hms = (v) => {
  if (!Number.isFinite(v)) return "—";
  const s = Math.round(v), h = Math.floor(s / 3600),
    m = Math.floor((s - h * 3600) / 60), r = s - h * 3600 - m * 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`
    : `${m}:${String(r).padStart(2, "0")}`;
};
/* stratComp.fmtLapMs geçersizde "" döner; fiş "—" istiyor. */
const lapTxt = (v) => (Number.isFinite(v) ? fmtLapMs(v) : "—");
/* İşaretli farklar — eksi işareti TİPOGRAFİK "−" (fiş böyle yazıyor). */
const signed = (v) => {
  if (!Number.isFinite(v)) return "—";
  if (Math.abs(v) < 0.05) return "0.0";
  return `${v > 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}`;
};
const sgnLap = (v) => {
  if (!Number.isFinite(v)) return "—";
  if (Math.abs(v) < 0.0005) return "0.000";
  return `${v > 0 ? "+" : "−"}${Math.abs(v).toFixed(3)}`;
};
const sgnInt = (v) => {
  if (!Number.isFinite(v)) return "—";
  return v === 0 ? "0" : `${v > 0 ? "+" : "−"}${Math.abs(v)}`;
};

/* ---------- kayıt defteri sütunları (fişin REG_COLS'u birebir) ---------- */
const REG_COLS = [
  { k: "pits", lbl: "Pit", hint: "Durak sayısı" },
  { k: "stints", lbl: "Stint", hint: "Stint sayısı (= pit + 1)" },
  { k: "pitLane", lbl: "Pit yolu", hint: "Pit yolu geçiş süresi (sn)", unit: "sn" },
  { k: "fuelFull", lbl: "Yakıt tam", hint: "Tam servis yakıt süresi (sn)", unit: "sn" },
  { k: "fuelLast", lbl: "Yakıt son", hint: "Son durakta yalnız bitirmeye yeten yakıt — kısa sürer", unit: "sn" },
  { k: "tyreTime", lbl: "Lastik sn", hint: "Bir değişimin süresi (sn)", unit: "sn" },
  { k: "tyreCount", lbl: "Lastik ad.", hint: "Lastik değişen durak sayısı" },
  { k: "avgLap", lbl: "Ort. tur", hint: "m:ss.mmm", lap: true },
  { k: "penalty", lbl: "Ceza", hint: "Ceza süresi (sn) — boş = yok", unit: "sn" },
  { k: "damage", lbl: "Hasar", hint: "Hasar/tamir süresi (sn) — boş = yok", unit: "sn" },
  { k: "ballast", lbl: "Balast", hint: "Bilgi amaçlı — hesaba GİRMEZ", unit: "kg" },
];
/* Eksik alan adları (karşılaştırma yapılamıyor bloğunda gösterilir). */
const LBL = { pits: "Pit", pitLane: "Pit yolu", fuelFull: "Yakıt tam",
  fuelLast: "Yakıt son", tyreTime: "Lastik süresi", tyreCount: "Lastik adedi",
  avgLap: "Ort. tur", raceLaps: "Toplam yarış turu" };
const WARN_TXT = {
  stintMismatch: "Stint sayısı pit + 1 olmalı",
  tyreOverPits: "Lastik değişimi durak sayısını geçemez",
};
/* Sabit kayıp dağılımı çubuğunun segmentleri (fişin SEG'i birebir). */
const SEG = [
  { k: "pitLaneSec", label: "Pit yolu", color: "var(--rc-info)" },
  { k: "fuelSec", label: "Yakıt", color: "var(--rc-warn)" },
  { k: "tyreSec", label: "Lastik", color: "var(--rc-cls-gt3)" },
  { k: "penaltySec", label: "Ceza", color: "var(--rc-danger)" },
  { k: "damageSec", label: "Hasar", color: "var(--rc-purple)" },
];
const A_COL = "var(--rc-delta)";      // #4D9FFF
const B_COL = "var(--rc-cls-gt3)";    // #EF8A2B

/* ---------- ortak stiller ---------- */
const F_DISP = "'Rajdhani',sans-serif";
const F_MONO = "'IBM Plex Mono',monospace";
const F_UI = "'Inter',sans-serif";
const card = {
  border: "1px solid var(--rc-border)", borderRadius: 14,
  background: "var(--rc-surface)", overflow: "hidden",
};
const cardHead = {
  display: "flex", alignItems: "center", gap: 10, padding: "12px 16px",
  borderBottom: "1px solid var(--rc-line-soft)", flexWrap: "wrap",
};
const cardTitle = {
  fontFamily: F_DISP, textTransform: "uppercase", letterSpacing: ".08em",
  fontSize: 13, fontWeight: 700,
};
const capLbl = {
  color: "var(--rc-text-3)", fontSize: 10, textTransform: "uppercase",
  letterSpacing: ".1em",
};
const selStyle = {
  maxWidth: 150, padding: "5px 7px", borderRadius: 8,
  background: "var(--rc-surface-3)", color: "var(--rc-text)",
  border: "1px solid var(--rc-border)", fontSize: 11.5, fontFamily: F_UI,
};
const pillBtn = {
  display: "inline-flex", alignItems: "center", gap: 4, padding: "6px 11px",
  borderRadius: 8, border: "1px solid var(--rc-border)",
  background: "var(--rc-surface-3)", color: "var(--rc-text-2)",
  cursor: "pointer", fontSize: 11.5, fontWeight: 600,
  fontFamily: F_DISP, letterSpacing: ".03em",
};
const amberBox = {
  border: "1px solid var(--rc-warn)", background: "var(--rc-tint-warn)",
  color: "var(--rc-warn-text)", lineHeight: 1.5,
};

export default function StratCompTab({ t, st, plan, readOnly = false,
  tracks = [], carClasses = [], trackDefs = {}, lmuReady = false, teamAssets,
  onLaps, onTrack, onClass, onAdd, onUp, onDel, onSeed, onSeedInto, onPick }) {
  /* Düzenleme penceresi EPHEMERAL — oda durumuna yazılmaz (TyreTab deseni). */
  const [editIdx, setEditIdx] = useState(null);

  const teams = Array.isArray(st.stratTeams) ? st.stratTeams : [];
  const laps = num(st.stratLaps);
  /* Seçili indeksler state.stratPick'ten — kural TEK yerde ve tam sayı olmayan
     değeri de eler (yerel bir clamp `teams[1.5]` okumasına izin veriyordu). */
  const iA = stratPick(st, "stratA"), iB = stratPick(st, "stratB");
  const nameOf = (i) => (teams[i] && String(teams[i].name || "").trim()) || `${t("Satır")} ${i + 1}`;

  /* compareTeams hem iki tarafı hem farkları verir — deltalar burada ikinci kez
     yazılmasın (tek doğruluk kaynağı, Excel'e karşı test edilmiş olan o). */
  const cmp = useMemo(() => compareTeams(teams[iA], teams[iB], laps), [teams, iA, iB, laps]);
  const A = cmp.a, B = cmp.b;
  /* AYNI SATIR iki tarafta seçiliyse karşılaştırma anlamsız: tek satırlık
     defterde stratPick ikisini de 0'a kırpıyor ve ekran satırı KENDİSİYLE
     karşılaştırıp "İki strateji eşit · 0.0" yazıyordu — uydurma bir "sonuç". */
  const sameRow = teams.length < 2 || iA === iB;
  const cmpOk = cmp.ok && !sameRow;
  const rank = useMemo(() => rankTeams(teams, laps), [teams, laps]);
  const sugg = suggestedLaps(plan);
  const opts = strategyOptions(st);
  const clsSel = st.stratClass || st.carClass || "gt3";
  const trackSel = st.stratTrack || st.track;

  /* ---------- görsel yardımcıları (uygulamanın gerçek varlıkları) ---------- */
  const carOf = (row) => {
    const cls = (row && row.cls) || clsSel;
    const carId = (row && row.car) || "";
    return carId ? carImageSrc(teamAssets, cls, carId, "side") : "";
  };
  const clsOf = (row) => `${ASSET}class/${(row && row.cls) || clsSel}.png${AV}`;
  const hideOnErr = (e) => { e.currentTarget.style.display = "none"; };

  /* ---------- hero kartı ---------- */
  const heroCard = (i, res, accent, side) => {
    const row = teams[i] || {};
    const nm = nameOf(i);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 9, padding: "15px 16px",
        border: `1px solid color-mix(in srgb, ${accent} 40%, transparent)`, borderRadius: 16,
        background: "linear-gradient(180deg,var(--rc-surface-2),var(--rc-surface-inset))" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: accent, flex: "0 0 auto" }} />
          <span style={{ fontFamily: F_DISP, fontSize: 12, fontWeight: 700, letterSpacing: ".12em", color: accent }}>
            {side === "a" ? "PLAN A" : "PLAN B"}
          </span>
          <select value={i} disabled={readOnly || !teams.length}
            onChange={(e) => onPick?.(side === "a" ? "stratA" : "stratB", Number(e.target.value))}
            style={{ ...selStyle, marginLeft: "auto" }}>
            {teams.length ? teams.map((r, j) => (
              <option key={j} value={j}>{String(r?.name || "").trim() || `${t("Satır")} ${j + 1}`}</option>
            )) : <option value={0}>{t("Kayıt yok")}</option>}
          </select>
        </div>
        <div style={{ position: "relative", height: 118, display: "flex", alignItems: "center",
          justifyContent: "center", overflow: "hidden", borderRadius: 10,
          background: `radial-gradient(80% 120% at 50% 120%, color-mix(in srgb, ${accent} 14%, transparent), transparent 70%)` }}>
          {carOf(row) && <img src={carOf(row)} alt="" onError={hideOnErr}
            style={{ maxWidth: "96%", maxHeight: 104, objectFit: "contain",
              filter: "drop-shadow(0 10px 22px rgba(0,0,0,.6))" }} />}
          <span style={{ position: "absolute", [side === "a" ? "left" : "right"]: 0, top: 0,
            fontFamily: F_DISP, fontWeight: 700, fontSize: 34, lineHeight: 1,
            color: "rgba(255,255,255,.09)" }}>#{String(row.num || "").trim() || "?"}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <img src={clsOf(row)} alt="" onError={hideOnErr} style={{ height: 14 }} />
          <b style={{ fontFamily: F_DISP, fontSize: 16, fontWeight: 700, letterSpacing: ".01em",
            minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nm}</b>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: "auto" }}>
          <span style={capLbl}>{t("Tahmini bitiş")}</span>
        </div>
        <b style={{ fontFamily: F_DISP, fontVariantNumeric: "tabular-nums", fontSize: 36,
          fontWeight: 700, lineHeight: .95, color: res.ok ? "var(--rc-text)" : "var(--rc-text-4)" }}>
          {res.ok ? hms(res.totalSec) : "—"}
        </b>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 11, color: "var(--rc-text-3)" }}>
          <span>{res.ok ? (num(row.pits) ?? "—") : "—"} {t("pit")}</span>
          <span>{t("sabit")} {res.ok ? fmtSec(res.staticSec) : "—"}</span>
          <span>{t("ort")} {lapTxt(res.ok ? res.avgLapSec : parseLapSec(row.avgLap))}</span>
        </div>
      </div>
    );
  };

  /* ---------- karar (verdict) ---------- */
  let verdict = null, cmpMissing = "";
  if (cmpOk) {
    const { staticDelta, paceDelta, totalDelta, lapDelta, leader } = cmp;
    const col = leader === "tie" ? "var(--rc-text-2)" : "var(--rc-ok)";
    verdict = {
      col, leader,
      leaderTxt: leader === "tie" ? t("İki strateji eşit") : nameOf(leader === "a" ? iA : iB),
      gap: leader === "tie" ? "0.0" : fmtSec(Math.abs(totalDelta)),
      gapSub: leader === "tie" ? t("sn") : t("sn önde"),
      pace: `${signed(paceDelta)} (${sgnLap(lapDelta)}/${t("tur")})`,
      static: signed(staticDelta),
      breakEven: (cmp.breakEvenLap ?? 0).toFixed(3),
      /* İki satırın ortalama turu BİREBİR aynıysa fark yalnız pit/yakıt/
         lastikten gelir — modellenmeyen şey etiketlenir (CLAUDE.md §1). */
      samePace: A.avgLapSec === B.avgLapSec,
      barPct: Math.max(4, Math.min(50, Math.abs(totalDelta) / 1.2)),
      toward: leader === "a",
    };
  } else if (sameRow) {
    cmpMissing = teams.length < 2
      ? t("Karşılaştırma için deftere en az iki satır ekleyin.")
      : t("A ve B aynı satırı gösteriyor — iki farklı satır seçin.");
  } else {
    const parts = [];
    [[iA, A], [iB, B]].forEach(([i, r]) => {
      if (!r.ok) parts.push(`${nameOf(i)} — ${r.missing.map((k) => t(LBL[k] || k)).join(", ")}`);
    });
    cmpMissing = `${t("Eksik alan")}: ${parts.join(" · ")}`;
  }

  /* ---------- kalem kalem döküm satırları (fişin BR'si birebir) ---------- */
  const BR = [
    { lbl: "Pit sayısı", ga: A.pits, gb: B.pits, fmt: (v) => (Number.isFinite(v) ? String(v) : "—"), kind: "int" },
    { lbl: "Pit yolu toplamı", ga: A.pitLaneSec, gb: B.pitLaneSec, fmt: fmtSec },
    { lbl: "Yakıt toplamı", ga: A.fuelSec, gb: B.fuelSec, fmt: fmtSec },
    { lbl: "Lastik toplamı", ga: A.tyreSec, gb: B.tyreSec, fmt: fmtSec },
    { lbl: "Ceza süresi", ga: A.penaltySec, gb: B.penaltySec, fmt: fmtSec },
    { lbl: "Hasar süresi", ga: A.damageSec, gb: B.damageSec, fmt: fmtSec },
    { lbl: "Sabit kayıp", ga: A.staticSec, gb: B.staticSec, fmt: fmtSec, sub: true },
    { lbl: "Ortalama tur", ga: A.avgLapSec, gb: B.avgLapSec, fmt: lapTxt, kind: "lap" },
    { lbl: "Tempo (ort × tur)", ga: A.paceSec, gb: B.paceSec, fmt: (v) => (Number.isFinite(v) ? hms(v) : "—") },
    { lbl: "TOPLAM", ga: A.totalSec, gb: B.totalSec, fmt: (v) => (Number.isFinite(v) ? hms(v) : "—"), sub: true },
  ];
  const shortName = (i) => { const n = nameOf(i); return n.length > 16 ? `${n.slice(0, 15)}…` : n; };

  /* Sabit kayıp dağılımı — iki satır ORTAK ölçekte (fişin kuralı). */
  const chartMax = cmpOk ? (Math.max(A.staticSec, B.staticSec) || 1) : 1;

  const editRow = (editIdx !== null && teams[editIdx]) ? teams[editIdx] : null;
  const editRes = editRow ? teamTime(editRow, laps) : null;
  const editWarns = editRow ? stintWarnings(editRow) : [];
  const carList = CARS[(editRow && editRow.cls) || clsSel] || [];

  const thNum = {
    textAlign: "right", padding: "8px 6px", color: "var(--rc-text-3)", fontSize: 9.5,
    textTransform: "uppercase", letterSpacing: ".05em", fontWeight: 700,
    borderBottom: "1px solid var(--rc-line-soft)", whiteSpace: "nowrap",
  };

  return (
    <div style={{ background: "radial-gradient(120% 90% at 100% 0,color-mix(in srgb,var(--rc-brand) 12%,transparent),transparent 60%)",
      fontFamily: F_UI, color: "var(--rc-text)" }}>
      <div style={{ maxWidth: 1360, margin: "0 auto", padding: "22px 26px 60px",
        display: "flex", flexDirection: "column", gap: 16 }}>

        {/* ======= başlık ======= */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 20, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
            {trackSel && <img src={`${ASSET}flags/${TRACK_ASSET(trackSel)}.png${AV}`} alt=""
              onError={hideOnErr}
              style={{ width: 36, borderRadius: 3, border: "1px solid var(--rc-border)", flex: "0 0 auto" }} />}
            <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
              <h1 style={{ margin: 0, fontFamily: F_DISP, textTransform: "uppercase",
                letterSpacing: ".05em", fontSize: 26, fontWeight: 700, lineHeight: 1 }}>
                {t("Strateji Karşılaştırma")}
              </h1>
              <span style={{ fontSize: 11.5, color: "var(--rc-text-3)", letterSpacing: ".02em" }}>
                {t("Yarış öncesi karar aracı · canlı veriye ve köprüye dokunmaz")}
                {trackSel ? ` · ${trackName(trackSel)}` : ""}
              </span>
            </div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            {/* pist + sınıf seçici — pit yolu ve ort. tur önerisini besler */}
            <select value={st.stratTrack || ""} disabled={readOnly}
              onChange={(e) => onTrack?.(e.target.value)} style={{ ...selStyle, maxWidth: 160 }}
              title={t("Pist seç — pit yolu ve ortalama tur önerisi buradan gelir")}>
              <option value="">{t("Pist seç (isteğe bağlı)")}</option>
              {tracks.map((tr) => <option key={tr.id} value={tr.id}>{tr.name}</option>)}
            </select>
            <select value={st.stratClass || ""} disabled={readOnly}
              onChange={(e) => onClass?.(e.target.value)} style={{ ...selStyle, maxWidth: 110 }}>
              <option value="">{t("Sınıf")}</option>
              {carClasses.map(([id, lbl]) => <option key={id} value={id}>{lbl}</option>)}
            </select>
            <span style={capLbl}>{t("Toplam yarış turu")}</span>
            <span style={{ display: "inline-flex", alignItems: "center",
              border: "1px solid var(--rc-border)", borderRadius: 10, overflow: "hidden" }}>
              <button type="button" disabled={readOnly}
                onClick={() => onLaps?.(String(Math.max(1, (laps || 1) - 1)))}
                style={{ width: 34, height: 40, border: "none", background: "var(--rc-surface-3)",
                  color: "var(--rc-text-2)", cursor: readOnly ? "not-allowed" : "pointer", fontSize: 16 }}>−</button>
              <b style={{ minWidth: 52, textAlign: "center", fontFamily: F_DISP, fontSize: 24, fontWeight: 700 }}>
                {laps ?? "—"}
              </b>
              <button type="button" disabled={readOnly}
                onClick={() => onLaps?.(String((laps || 0) + 1))}
                style={{ width: 34, height: 40, border: "none", background: "var(--rc-surface-3)",
                  color: "var(--rc-text-2)", cursor: readOnly ? "not-allowed" : "pointer", fontSize: 16 }}>+</button>
            </span>
            {sugg !== null && laps !== sugg && !readOnly && (
              <button type="button" onClick={() => onLaps?.(String(sugg))}
                title={t("Stint planındaki toplam turu buraya yaz")}
                style={{ padding: "7px 11px", borderRadius: 8, border: "1px solid var(--rc-border)",
                  background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 11.5 }}>
                {t("Plandan al")}: {sugg}
              </button>
            )}
          </div>
        </div>

        {/* pist önerisi — yeni satıra otomatik gelir */}
        {(st.stratTrack || st.stratClass) && (
          <div style={{ fontSize: 11, color: "var(--rc-text-4)", marginTop: -8 }}>
            {t("Öneri")}: <b style={{ color: "var(--rc-text-2)" }}>{t("pit yolu")}</b>{" "}
            {trackDefs.pitLane != null ? `${trackDefs.pitLane} ${t("sn")}` : t("veri yok")}
            {" · "}<b style={{ color: "var(--rc-text-2)" }}>{t("ort. tur")}</b>{" "}
            {trackDefs.avgLap || (lmuReady ? t("veri yok") : "…")}
            {" — "}{t("yeni satıra otomatik gelir, üstüne yazabilirsiniz")}
          </div>
        )}

        {/* ======= hero A vs B ======= */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr minmax(230px,300px) 1fr",
          gap: 14, alignItems: "stretch" }}>
          {heroCard(iA, A, A_COL, "a")}

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", gap: 12, padding: "16px 14px",
            border: "1px solid var(--rc-border-strong)", borderRadius: 16,
            background: "linear-gradient(180deg,var(--rc-surface-2),var(--rc-surface-inset))",
            textAlign: "center" }}>
            {cmpOk ? (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <span style={{ ...capLbl, letterSpacing: ".12em" }}>{t("Sonuç")}</span>
                  <b style={{ fontFamily: F_DISP, fontSize: 19, fontWeight: 700, lineHeight: 1.15, color: verdict.col }}>
                    {verdict.leaderTxt}
                  </b>
                  <b style={{ fontFamily: F_DISP, fontVariantNumeric: "tabular-nums", fontSize: 40,
                    fontWeight: 700, lineHeight: .9, color: verdict.col }}>{verdict.gap}</b>
                  <span style={{ fontSize: 10.5, color: "var(--rc-text-3)", letterSpacing: ".03em" }}>{verdict.gapSub}</span>
                </div>
                <div style={{ width: "100%", height: 6, borderRadius: 3, background: "var(--rc-line-soft)",
                  position: "relative", overflow: "hidden" }}>
                  <span style={{ position: "absolute", top: 0, bottom: 0, left: "50%", width: 1,
                    background: "var(--rc-border-strong)" }} />
                  <i style={{ position: "absolute", top: 0, bottom: 0,
                    [verdict.toward ? "right" : "left"]: "50%", width: `${verdict.barPct}%`,
                    background: verdict.col, borderRadius: 3 }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, width: "100%", marginTop: 2 }}>
                  {[[t("Tempo farkı"), verdict.pace], [t("Sabit farkı"), verdict.static]].map(([l, v]) => (
                    <div key={l} style={{ border: "1px solid var(--rc-border)", borderRadius: 9,
                      padding: "7px 8px", background: "var(--rc-surface)" }}>
                      <span style={{ display: "block", color: "var(--rc-text-4)", fontSize: 9,
                        textTransform: "uppercase", letterSpacing: ".09em" }}>{l}</span>
                      <b style={{ fontFamily: F_MONO, fontSize: 13, color: "var(--rc-text-2)" }}>{v}</b>
                    </div>
                  ))}
                </div>
                <span style={{ fontSize: 10.5, color: "var(--rc-text-3)", lineHeight: 1.5 }}>
                  {t("Geride kalan turda")} <b style={{ color: "var(--rc-text)" }}>{verdict.breakEven}</b> {t("sn bulmalı")}
                </span>
                {verdict.samePace && (
                  <span style={{ ...amberBox, display: "flex", alignItems: "flex-start", gap: 6,
                    padding: "7px 9px", borderRadius: 9, fontSize: 10, textAlign: "left" }}>
                    ⚠ {t("İki satırın ortalama turu aynı — fark yalnız pit/yakıt/lastikten geliyor; uzun stintin lastik/yakıt yavaşlaması modelde yok.")}
                  </span>
                )}
              </>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, color: "var(--rc-warn)" }}>
                <span style={{ fontSize: 22 }}>⚠</span>
                <b style={{ fontSize: 12, lineHeight: 1.4 }}>{t("Karşılaştırma yapılamıyor")}</b>
                <span style={{ fontSize: 10.5, color: "var(--rc-text-3)", lineHeight: 1.5 }}>{cmpMissing}</span>
              </div>
            )}
          </div>

          {heroCard(iB, B, B_COL, "b")}
        </div>

        {/* ======= kalem kalem döküm ======= */}
        <div style={card}>
          <div style={{ ...cardHead, flexWrap: "nowrap" }}>
            <span style={cardTitle}>{t("Kalem kalem döküm")}</span>
            <span style={{ fontSize: 11, color: "var(--rc-text-4)" }}>
              {t("toplam süre = ort. tur × tur + pit yolu + yakıt + lastik + ceza + hasar")}
            </span>
          </div>

          {cmpOk && (
            <div style={{ padding: "15px 16px", borderBottom: "1px solid var(--rc-line-soft)",
              display: "flex", flexDirection: "column", gap: 11 }}>
              <span style={{ color: "var(--rc-text-4)", fontSize: 10, textTransform: "uppercase", letterSpacing: ".09em" }}>
                {t("Sabit kayıp dağılımı — süre nereye gidiyor (ortak ölçek)")}
              </span>
              {[[A, iA, "A", A_COL], [B, iB, "B", B_COL]].map(([res, i, tag, accent]) => (
                <div key={tag} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ flex: "0 0 108px", display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <span style={{ width: 11, height: 11, borderRadius: 3, background: accent, flex: "0 0 auto" }} />
                    <b style={{ fontFamily: F_DISP, fontSize: 13, fontWeight: 700, color: accent, letterSpacing: ".06em" }}>{tag}</b>
                    <span style={{ fontSize: 11, color: "var(--rc-text-3)", overflow: "hidden",
                      textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nameOf(i)}</span>
                  </span>
                  <span style={{ flex: 1, display: "flex", height: 26, borderRadius: 7, overflow: "hidden",
                    background: "var(--rc-surface-inset)", border: "1px solid var(--rc-line-soft)" }}>
                    {SEG.filter((s) => (res[s.k] || 0) > 0).map((s) => {
                      const v = res[s.k], w = v / chartMax * 100;
                      return (
                        <span key={s.k} title={`${t(s.label)}: ${fmtSec(v)} ${t("sn")}`}
                          style={{ flex: `0 0 ${w}%`, background: s.color, display: "flex",
                            alignItems: "center", justifyContent: "center", fontSize: 9.5, fontWeight: 700,
                            color: "var(--rc-bg)", overflow: "hidden", whiteSpace: "nowrap",
                            borderRight: "1px solid rgba(11,7,8,.35)" }}>
                          {w >= 11 ? fmtSec(v) : ""}
                        </span>
                      );
                    })}
                  </span>
                  <b style={{ flex: "0 0 auto", minWidth: 56, textAlign: "right", fontFamily: F_MONO,
                    fontSize: 12.5, color: "var(--rc-text)" }}>{fmtSec(res.staticSec)}</b>
                </div>
              ))}
              <div style={{ display: "flex", gap: 15, flexWrap: "wrap", paddingTop: 1 }}>
                {SEG.map((s) => (
                  <span key={s.k} style={{ display: "inline-flex", alignItems: "center", gap: 6,
                    fontSize: 11, color: "var(--rc-text-3)" }}>
                    <i style={{ width: 10, height: 10, borderRadius: 3, background: s.color, display: "inline-block" }} />
                    {t(s.label)}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
              <thead><tr>
                {[[t("Kalem"), "left", "var(--rc-text-3)"], [shortName(iA), "right", A_COL],
                  [shortName(iB), "right", B_COL], [t("Fark (A − B)"), "right", "var(--rc-text-3)"]].map(([l, al, c], k) => (
                  <th key={k} style={{ textAlign: al, padding: "8px 16px", color: c, fontSize: 10,
                    textTransform: "uppercase", letterSpacing: ".07em", fontWeight: 700,
                    borderBottom: "1px solid var(--rc-line-soft)" }}>{l}</th>
                ))}
              </tr></thead>
              <tbody>
                {BR.map((r) => {
                  const va = r.ga, vb = r.gb;
                  const d = (Number.isFinite(va) && Number.isFinite(vb)) ? va - vb : NaN;
                  const eps = r.kind === "lap" ? 0.0005 : 0.05;
                  const dcol = (!Number.isFinite(d) || Math.abs(d) < eps) ? "var(--rc-text-3)"
                    : (d < 0 ? "var(--rc-ok)" : "var(--rc-danger-3)");
                  const cell = { padding: "6px 16px", textAlign: "right", fontFamily: F_MONO,
                    fontSize: 12, fontWeight: r.sub ? 700 : 400, borderBottom: "1px solid var(--rc-surface-5)" };
                  return (
                    <tr key={r.lbl} style={r.sub ? { background: "var(--rc-surface-inset)" } : undefined}>
                      <td style={{ padding: "6px 16px", textAlign: "left", fontSize: 12, fontFamily: F_UI,
                        fontWeight: r.sub ? 700 : 400, color: r.sub ? "var(--rc-text)" : "var(--rc-text-3)",
                        borderBottom: "1px solid var(--rc-surface-5)" }}>{t(r.lbl)}</td>
                      <td style={cell}>{r.fmt(va)}</td>
                      <td style={cell}>{r.fmt(vb)}</td>
                      <td style={{ ...cell, color: dcol }}>
                        {r.kind === "lap" ? sgnLap(d) : r.kind === "int" ? sgnInt(d) : signed(d)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ======= kayıt defteri ======= */}
        <div style={card}>
          <div style={cardHead}>
            <span style={cardTitle}>{t("Kayıt defteri")}</span>
            <span style={{ fontSize: 11, color: "var(--rc-text-4)" }}>
              {teams.length} {t("satır · rakip ya da kendi A/B planınız")}
            </span>
            {!readOnly && (
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ ...capLbl, letterSpacing: ".08em" }}>{t("Planımdan ekle")}</span>
                {opts.map((o) => (
                  <button key={o.key} type="button" disabled={!o.ready} onClick={() => onSeed?.(o.key)}
                    title={o.ready ? `${t("Plan")} ${o.key} — ${o.laps} ${t("tur/stint · plandan satır kur")}`
                      : t("Bu varyantın planı kurulamıyor (yarış süresi, ortalama tur ya da stint turu eksik/geçersiz)")}
                    style={{ ...pillBtn, opacity: o.ready ? 1 : .5,
                      cursor: o.ready ? "pointer" : "not-allowed" }}>
                    {o.key} · {o.laps}
                  </button>
                ))}
                <button type="button" onClick={() => { onAdd?.(); setEditIdx(teams.length); }}
                  style={{ ...pillBtn, fontFamily: F_UI, fontWeight: 400 }}>+ {t("Boş satır")}</button>
              </div>
            )}
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", minWidth: 760, width: "100%" }}>
              <thead><tr>
                <th style={{ textAlign: "left", padding: "8px 10px", color: "var(--rc-text-3)", fontSize: 9.5,
                  textTransform: "uppercase", letterSpacing: ".07em", fontWeight: 700,
                  borderBottom: "1px solid var(--rc-line-soft)", whiteSpace: "nowrap" }}>{t("Ad")}</th>
                {REG_COLS.map((c) => <th key={c.k} style={thNum} title={t(c.hint)}>{t(c.lbl)}</th>)}
                <th style={thNum} />
              </tr></thead>
              <tbody>
                {teams.map((row, i) => {
                  const res = teamTime(row, laps), w = stintWarnings(row);
                  const sel = i === iA || i === iB;
                  return (
                    <tr key={i} onClick={() => !readOnly && setEditIdx(i)}
                      style={{ cursor: readOnly ? "default" : "pointer",
                        borderBottom: "1px solid var(--rc-surface-5)",
                        background: sel ? "color-mix(in srgb,var(--rc-brand) 6%,transparent)" : undefined }}>
                      <td style={{ padding: "8px 12px", textAlign: "left" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
                          {carOf(row) && <img src={carOf(row)} alt="" onError={hideOnErr}
                            style={{ width: 38, height: 22, objectFit: "contain", flex: "0 0 auto", opacity: .92 }} />}
                          <b style={{ fontFamily: F_DISP, fontSize: 14, fontWeight: 700,
                            color: "var(--rc-text)", whiteSpace: "nowrap" }}>{nameOf(i)}</b>
                        </span>
                      </td>
                      {REG_COLS.map((c) => {
                        const missing = res.missing.includes(c.k);
                        const raw = row?.[c.k];
                        const txt = (raw === "" || raw === null || raw === undefined) ? "—" : String(raw);
                        return (
                          <td key={c.k} style={{ padding: "8px 8px", textAlign: "right", fontFamily: F_MONO,
                            fontSize: 11.5, whiteSpace: "nowrap",
                            color: missing ? "var(--rc-warn)" : (txt === "—" ? "var(--rc-text-5)" : "var(--rc-text-2)") }}>
                            {txt}
                          </td>
                        );
                      })}
                      <td style={{ padding: "8px 12px", textAlign: "right" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
                          {w.length > 0 && (
                            <span title={w.map((k) => t(WARN_TXT[k])).join(" · ")}
                              style={{ color: "var(--rc-warn)", fontSize: 13, cursor: "help" }}>⚠</span>
                          )}
                          {!readOnly && (
                            <>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 5,
                                padding: "5px 10px", borderRadius: 7, border: "1px solid var(--rc-border)",
                                background: "var(--rc-surface-3)", color: "var(--rc-text-2)",
                                fontSize: 11, whiteSpace: "nowrap" }}>✎ {t("Düzenle")}</span>
                              <button type="button" title={t("Satırı sil")}
                                onClick={(e) => { e.stopPropagation(); onDel?.(i); }}
                                style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--rc-border)",
                                  background: "var(--rc-surface-3)", color: "var(--rc-text-4)",
                                  cursor: "pointer", fontSize: 13 }}>✕</button>
                            </>
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ padding: "9px 16px", borderTop: "1px solid var(--rc-line-soft)",
            fontSize: 10.5, color: "var(--rc-text-5)", lineHeight: 1.6 }}>
            {t("Boş ceza ve hasar 0 sn sayılır. Diğer zorunlu alanlar boşsa o takım hesaplanmaz — eksik veri sıfır varsayılmaz. Ort. tur biçimi m:ss.mmm. Balast bilgi amaçlı, hesaba girmez.")}
          </div>
        </div>

        {/* ======= sıralama ======= */}
        <div style={card}>
          <div style={{ ...cardHead, flexWrap: "nowrap" }}>
            <span style={cardTitle}>{t("Tüm defter · tahmini bitiş sırası")}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {rank.ranked.map((r, idx) => (
              <div key={r.idx} style={{ display: "flex", alignItems: "center", gap: 13, padding: "10px 16px",
                borderBottom: "1px solid var(--rc-surface-5)",
                background: idx === 0 ? "color-mix(in srgb,var(--rc-ok) 5%,transparent)" : undefined }}>
                <span style={{ flex: "0 0 26px", textAlign: "center", fontFamily: F_DISP, fontSize: 17,
                  fontWeight: 700, color: idx === 0 ? "var(--rc-ok)" : "var(--rc-text-4)" }}>{idx + 1}</span>
                {carOf(r.team) && <img src={carOf(r.team)} alt="" onError={hideOnErr}
                  style={{ width: 52, height: 28, objectFit: "contain", flex: "0 0 auto", opacity: .95 }} />}
                <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0, flex: 1 }}>
                  <b style={{ fontFamily: F_DISP, fontSize: 15, fontWeight: 700, overflow: "hidden",
                    textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {String(r.team?.name || "").trim() || `${t("Satır")} ${r.idx + 1}`}
                  </b>
                  <span style={{ fontSize: 10.5, color: "var(--rc-text-4)" }}>
                    {t("sabit")} {fmtSec(r.res.staticSec)} · {t("ort")} {lapTxt(r.res.avgLapSec)}
                  </span>
                </div>
                <b style={{ fontFamily: F_MONO, fontSize: 14, color: "var(--rc-text-2)", flex: "0 0 auto" }}>
                  {hms(r.res.totalSec)}
                </b>
                <span style={{ flex: "0 0 auto", minWidth: 74, textAlign: "right", fontFamily: F_MONO,
                  fontSize: 12.5, color: idx === 0 ? "var(--rc-ok)" : "var(--rc-text-3)" }}>
                  {idx === 0 ? t("lider") : `+${fmtSec(r.gapToLeader)}`}
                </span>
              </div>
            ))}
          </div>
          {rank.incomplete.length > 0 && (
            <div style={{ padding: "10px 16px", borderTop: "1px solid var(--rc-line-soft)",
              fontSize: 11, color: "var(--rc-text-4)" }}>
              {t("Sıralamaya girmeyen (eksik veri)")}:{" "}
              {rank.incomplete.map((r) => String(r.team?.name || "").trim() || `${t("Satır")} ${r.idx + 1}`).join(", ")}
            </div>
          )}
        </div>
      </div>

      {/* ======= satır düzenleme penceresi ======= */}
      {editRow && !readOnly && (
        <RowEditModal t={t} row={editRow} idx={editIdx} res={editRes} warns={editWarns}
          carList={carList} carClasses={carClasses} clsSel={clsSel} opts={opts}
          carSrc={carOf(editRow)} onUp={onUp} onDel={onDel} onSeedInto={onSeedInto}
          onClose={() => setEditIdx(null)} />
      )}
    </div>
  );
}

/* Satır düzenleme penceresi — fişin 6. bölümü. Ayrı bileşen: sekmedeki
   `editIdx` YEREL state (kalıcı değil, TyreTab deseni) ve statik render onu
   açamıyordu; ayrılınca pencere de doğrudan test edilebiliyor. */
export function RowEditModal({ t, row, idx, res, warns = [], carList = [],
  carClasses = [], clsSel, opts = [], carSrc, onUp, onDel, onSeedInto, onClose }) {
  const hideOnErr = (e) => { e.currentTarget.style.display = "none"; };
  return (
      <div onClick={() => onClose()}
        style={{ position: "fixed", inset: 0, zIndex: 100, background: "var(--rc-scrim-strong)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
        <div onClick={(e) => e.stopPropagation()}
          style={{ width: "100%", maxWidth: 480, maxHeight: "86vh", overflow: "auto",
            background: "var(--rc-surface)", border: "1px solid var(--rc-border-strong)",
            borderRadius: 16, boxShadow: "0 24px 60px rgba(0,0,0,.55)",
            display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "15px 18px",
            borderBottom: "1px solid var(--rc-line-soft)" }}>
            {carSrc && <img src={carSrc} alt="" onError={hideOnErr}
              style={{ width: 48, height: 26, objectFit: "contain", flex: "0 0 auto" }} />}
            <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0, flex: 1 }}>
              <span style={{ fontFamily: F_DISP, textTransform: "uppercase", letterSpacing: ".07em",
                fontSize: 14, fontWeight: 700 }}>{t("Kayıt satırı")}</span>
              <span style={{ fontSize: 11, color: "var(--rc-text-4)" }}>
                {String(row.name || "").trim() ? t("değerleri düzenle") : t("yeni satır — değerleri gir")}
              </span>
            </div>
            <button type="button" onClick={() => onClose()}
              style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid var(--rc-border)",
                background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 13 }}>✕</button>
          </div>

          <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <span style={{ ...capLbl, letterSpacing: ".09em" }}>{t("Takım / plan adı")}</span>
              <input type="text" value={row.name ?? ""} placeholder={t("örn. #4 PESCARA SRT")}
                onChange={(e) => onUp?.(idx, { name: e.target.value })}
                style={{ background: "var(--rc-surface-3)", border: "1px solid var(--rc-border)",
                  borderRadius: 8, color: "var(--rc-text)", padding: "9px 11px",
                  fontFamily: F_UI, fontSize: 13 }} />
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <span style={{ ...capLbl, letterSpacing: ".09em" }}>{t("Araç no")}</span>
                <input type="text" value={row.num ?? ""} placeholder="—"
                  onChange={(e) => onUp?.(idx, { num: e.target.value })}
                  style={{ background: "var(--rc-surface-3)", border: "1px solid var(--rc-border)",
                    borderRadius: 8, color: "var(--rc-text)", padding: "8px 10px",
                    fontFamily: F_MONO, fontSize: 12.5, boxSizing: "border-box", width: "100%" }} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <span style={{ ...capLbl, letterSpacing: ".09em" }}>{t("Sınıf")}</span>
                <select value={row.cls || clsSel}
                  onChange={(e) => onUp?.(idx, { cls: e.target.value, car: "" })}
                  style={{ background: "var(--rc-surface-3)", border: "1px solid var(--rc-border)",
                    borderRadius: 8, color: "var(--rc-text)", padding: "8px 10px",
                    fontFamily: F_UI, fontSize: 13, width: "100%" }}>
                  {carClasses.map(([id, lbl]) => <option key={id} value={id}>{lbl}</option>)}
                </select>
              </label>
            </div>

            <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <span style={{ ...capLbl, letterSpacing: ".09em" }}>{t("Araç")}</span>
              <select value={row.car || ""}
                onChange={(e) => onUp?.(idx, { car: e.target.value })}
                style={{ background: "var(--rc-surface-3)", border: "1px solid var(--rc-border)",
                  borderRadius: 8, color: "var(--rc-text)", padding: "9px 11px",
                  fontFamily: F_UI, fontSize: 13 }}>
                <option value="">{t("Araç seç")}</option>
                {carList.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>

            {!!opts.length && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "11px 12px",
                border: "1px solid var(--rc-border)", borderRadius: 11, background: "var(--rc-surface-inset)" }}>
                <span style={{ ...capLbl, letterSpacing: ".09em" }}>{t("Strateji planından doldur")}</span>
                <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                  {opts.map((o) => (
                    <button key={o.key} type="button" disabled={!o.ready}
                      onClick={() => onSeedInto?.(idx, o.key)}
                      title={`${o.laps} ${t("tur/stint — bu satırı plandan doldur")}`}
                      style={{ ...pillBtn, flex: "1 1 0", minWidth: 88, padding: "8px 6px",
                        justifyContent: "center", opacity: o.ready ? 1 : .5,
                        cursor: o.ready ? "pointer" : "not-allowed" }}>
                      {t("Plan")} {o.key} · {o.laps}
                    </button>
                  ))}
                </div>
                <span style={{ fontSize: 10, color: "var(--rc-text-5)", lineHeight: 1.5 }}>
                  {t("Seçilen varyantın plan değerlerini bu satıra yazar; ad boşsa plan adını da koyar.")}
                </span>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11 }}>
              {REG_COLS.map((c) => {
                const miss = res.missing.includes(c.k);
                return (
                  <label key={c.k} title={t(c.hint)} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ ...capLbl, letterSpacing: ".07em", display: "flex",
                      alignItems: "center", gap: 5 }}>
                      {t(c.lbl)}<span style={{ color: "var(--rc-text-5)" }}>{c.unit || ""}</span>
                    </span>
                    <input type="text" value={row[c.k] ?? ""} placeholder={c.lap ? "m:ss.mmm" : "—"}
                      onChange={(e) => onUp?.(idx, { [c.k]: e.target.value })}
                      style={{ background: "var(--rc-surface-3)",
                        border: `1px solid ${miss ? "var(--rc-warn)" : "var(--rc-border)"}`,
                        borderRadius: 8, color: miss ? "var(--rc-warn)" : "var(--rc-text)",
                        padding: "8px 10px", fontFamily: F_MONO, fontSize: 12.5,
                        boxSizing: "border-box", width: "100%" }} />
                  </label>
                );
              })}
            </div>

            {warns.length > 0 && (
              <div style={{ ...amberBox, display: "flex", alignItems: "flex-start", gap: 8,
                padding: "9px 11px", borderRadius: 10, fontSize: 11 }}>
                ⚠ <span>{warns.map((k) => t(WARN_TXT[k])).join(" · ")}</span>
              </div>
            )}
            <div style={{ fontSize: 10.5, color: "var(--rc-text-5)", lineHeight: 1.6 }}>
              {t("Zorunlu alan boşsa bu satır hesaplanmaz. Ceza ve hasar boşsa 0 sn sayılır. Balast bilgi amaçlı, hesaba girmez.")}
            </div>
          </div>

          <div style={{ display: "flex", gap: 9, padding: "13px 18px",
            borderTop: "1px solid var(--rc-line-soft)" }}>
            <button type="button" onClick={() => { onDel?.(idx); onClose(); }}
              style={{ padding: "9px 14px", borderRadius: 9, border: "1px solid var(--rc-border-strong)",
                background: "var(--rc-surface-3)", color: "var(--rc-text-3)", cursor: "pointer", fontSize: 12 }}>
              {t("Satırı sil")}
            </button>
            <button type="button" onClick={() => onClose()}
              style={{ marginLeft: "auto", padding: "9px 20px", borderRadius: 9,
                border: "1px solid var(--rc-brand-bright)", background: "var(--rc-brand)",
                color: "var(--rc-on-brand)", cursor: "pointer", fontSize: 12.5, fontWeight: 600 }}>
              {t("Bitti")}
            </button>
          </div>
        </div>
      </div>
  );
}
