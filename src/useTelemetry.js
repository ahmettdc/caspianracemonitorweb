/* ============================================================
   useTelemetry — MoTeC telemetri içe aktarma + stint analizi (A/B/C/D)
   ------------------------------------------------------------
   App.jsx'ten çıkarıldı (Tanrı-bileşen borcunu azaltan dilim). Mantık BİREBİR
   taşındı. Dosya/metin ayrıştırma (ham kanal log'u ya da tur raporu), %105 kuralı
   ile yavaş turların elenmesi, seçili slot'a (Stint A/B/C/D) yazma ve kutu/çizgi
   grafik verisi. Durum yalnız `st.telemetry` üzerinden akar → `st`/`setSt` girer.

   Girdi: { st, setSt }.
   Çıktı (App render'ının kullandığı yüzey):
     { slot, setSlot, chartMode, setChartMode, rawTele, setRawTele, parsed, mapping,
       setMapping, onTeleFile, doParse, apply105Slot, saveMotec, saveSlot, toggleLap,
       removeSlot, slotStats, chartData, loadedSlots, baseSlot }. */
import { useState, useMemo } from "react";
import { msFromCell, parseMotecLog, parseTelemetryText, guessMapping } from "./parsers";
import { parseLd } from "./ldParser";
import { computeSlotStats, computeChartData, apply105Rule } from "./state";

export function useTelemetry({ st, setSt }) {
  const [slot, setSlot] = useState("A");
  const [chartMode, setChartMode] = useState("box"); // "box" | "line"
  const [rawTele, setRawTele] = useState("");
  const [parsed, setParsed] = useState(null);   // {headers, lapRows, ncols} | {error}
  const [mapping, setMapping] = useState(null); // {labelCol,timeCol,fuelCol,wear:[4]}

  const doParse = (text) => {
    const m = parseMotecLog(text);          // önce ham kanal log'u dene
    if (m) { setParsed(m); setMapping(null); return; }
    const p = parseTelemetryText(text);
    setParsed(p);
    if (p && !p.error) setMapping(guessMapping(p));
  };
  const onTeleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    /* .ld = MoTeC ikili log → CSV'ye çevirmeden doğrudan oku (parseLd, aynı motec şekli).
       parseLd SEÇİCİ okur: tüm dosyayı belleğe almaz, yalnız gereken kanalları File.slice
       ile çeker → 100MB+ log'lar donmadan/şişmeden açılır. Diğerleri (csv/tsv/txt) = metin. */
    if (/\.ld$/i.test(f.name)) {
      setRawTele("");
      setMapping(null);
      setParsed({ loading: true });
      parseLd(f)
        .then(setParsed)
        .catch(() => setParsed({ error: "MoTeC .ld okunamadı" }));
      return;
    }
    const rd = new FileReader();
    rd.onload = () => { setRawTele(String(rd.result)); doParse(String(rd.result)); };
    rd.readAsText(f);
  };

  /* %105 kuralı saf `apply105Rule` (state.js) — kısmi/freak turları "en iyi" adayı
     saymaz (yarım tur tüm gerçek turların tikini kaldırmasın). */
  const apply105Slot = (sl) => setSt((s) => {
    const t0 = s.telemetry[sl];
    if (!t0) return s;
    return { ...s, telemetry: { ...s.telemetry, [sl]: { ...t0, laps: apply105Rule(t0.laps) } } };
  });

  /* ham log → mevcut tur modeline çevir (yakıt litre → VE %) */
  const saveMotec = () => {
    if (!parsed?.motec) return;
    const ratio = st.fuelRatio > 0 ? st.fuelRatio : null;
    const laps = parsed.laps.map((l) => ({
      label: `Lap ${l.lap}`,
      ms: Math.round(l.sec * 1000),
      fuel: l.fuelL != null && ratio ? +(l.fuelL / ratio).toFixed(2) : null,
      fuelL: l.fuelL != null ? +l.fuelL.toFixed(2) : null,
      w: l.w.map((x) => (x == null ? null : +x.toFixed(2))),
      avgSpd: l.avgSpd != null ? Math.round(l.avgSpd) : null,
      maxSpd: l.maxSpd != null ? Math.round(l.maxSpd) : null,
      partial: !!l.partial, pit: !!l.pit,
      use: !l.pit && !l.partial,   // kısmi/pit turları varsayılan tiksiz (elle açılabilir)
    }));
    setSt((s) => ({ ...s, telemetry: { ...s.telemetry,
      [slot]: { laps: apply105Rule(laps), name: `Stint ${slot}`, src: parsed.meta } } }));
    setRawTele(""); setParsed(null); setMapping(null);
  };

  const saveSlot = () => {
    if (!parsed || parsed.error || !mapping || mapping.timeCol < 0) return;
    const laps = parsed.lapRows.map((r) => {
      const label = String(r[mapping.labelCol] || "").trim();
      const ms = msFromCell(r[mapping.timeCol]);
      const fuelRaw = mapping.fuelCol >= 0
        ? parseFloat(String(r[mapping.fuelCol] || "").replace(",", ".")) : NaN;
      const w = mapping.wear.map((wi) => wi >= 0
        ? parseFloat(String(r[wi] || "").replace(",", ".")) : NaN);
      const refuel = !isNaN(fuelRaw) && fuelRaw > 0; // pozitif değişim = dolum turu
      const abs = isNaN(fuelRaw) ? null : Math.abs(fuelRaw);
      const lit = mapping.fuelIsLitre && st.fuelRatio > 0;
      return {
        label, ms,
        fuel: abs == null ? null : (lit ? +(abs / st.fuelRatio).toFixed(2) : abs),
        fuelL: lit ? +abs.toFixed(2) : null,
        w: w.map((x) => (isNaN(x) ? null : x)),
        use: ms != null && !/^out/i.test(label) && !refuel,
      };
    }).filter((l) => l.ms != null);
    if (!laps.length) return;
    setSt((s) => ({ ...s, telemetry: { ...s.telemetry,
      [slot]: { laps: apply105Rule(laps), name: `Stint ${slot}` } } }));
    setRawTele(""); setParsed(null); setMapping(null);
  };

  const toggleLap = (sl, li) => setSt((s) => {
    const t = s.telemetry[sl]; if (!t) return s;
    const laps = t.laps.map((l, i) => (i === li ? { ...l, use: !l.use } : l));
    return { ...s, telemetry: { ...s.telemetry, [sl]: { ...t, laps } } };
  });
  const removeSlot = (sl) => setSt((s) => ({
    ...s, telemetry: { ...s.telemetry, [sl]: null } }));

  const slotStats = useMemo(() => computeSlotStats(st), [st.telemetry]);
  const chartData = useMemo(() => computeChartData(st), [st.telemetry]);
  const loadedSlots = ["A", "B", "C", "D"].filter((sl) => st.telemetry[sl]);
  const baseSlot = loadedSlots[0];

  return { slot, setSlot, chartMode, setChartMode, rawTele, setRawTele, parsed, mapping,
    setMapping, onTeleFile, doParse, apply105Slot, saveMotec, saveSlot, toggleLap,
    removeSlot, slotStats, chartData, loadedSlots, baseSlot };
}
