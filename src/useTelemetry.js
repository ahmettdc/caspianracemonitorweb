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
import { useState, useMemo, useEffect, useRef } from "react";
import { computeSlotStats, computeChartData, apply105Rule } from "./state";

/* Parser modülleri (parsers/ldParser/ldTrace/duckParse/duckTrace, ~48 KB kaynak)
   başlangıç paketinden çıkarıldı — yalnız dosya/metin içe aktarılınca dynamic
   import ile gelir, modül cache'i sonraki kullanımları anında yapar. TeleTab
   zaten lazy'ydi; statik importlar bu kazanımı sızdırıyordu. */

export function useTelemetry({ st, setSt }) {
  const [slot, setSlot] = useState("A");
  const [chartMode, setChartMode] = useState("box"); // "box" | "line"
  const [rawTele, setRawTele] = useState("");
  const [parsed, setParsed] = useState(null);   // {headers, lapRows, ncols} | {error}
  const [mapping, setMapping] = useState(null); // {labelCol,timeCol,fuelCol,wear:[4]}
  /* İz karşılaştırma (v1.4.111): yalnız .ld — yüklü dosya üzerinde oturum-içi, Firebase'e
     yazılmaz. teleFile/teleHeader = seçici okuma için handle; cmpA/cmpB = parsed.laps
     içindeki tur indeksleri; cmpData = buildCompare sonucu (izler + delta + sektör). */
  const [teleFile, setTeleFile] = useState(null);
  const [teleHeader, setTeleHeader] = useState(null);
  /* cmpLaps = yüklü .ld'nin laps dizisi (t0/tEnd). parsed'tan AYRI tutulur → kaydedince
     parsed temizlenip içe-aktar özeti kapansa da karşılaştırma + harita yaşamaya devam eder. */
  const [cmpLaps, setCmpLaps] = useState(null);
  const [cmpMeta, setCmpMeta] = useState(null);   // yüklü .ld meta (venue/vehicle/driver/trk/amb)
  const [cmpA, setCmpA] = useState(null);
  const [cmpB, setCmpB] = useState(null);
  const [cmpData, setCmpData] = useState(null);
  const [cmpBusy, setCmpBusy] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");   // "✓ Stint X kaydedildi" onayı (slot harfi)
  /* Çapraz-stint (v1.4.118): bir .ld'yi slota kaydedince o dosyanın handle+header+laps+meta'sı
     bellekte TUTULUR → A ve B ayrı stint'ten seçilip karşılaştırılabilir. Oturum-içi (DB'ye yazılmaz). */
  const [stintTele, setStintTele] = useState({});   // { A:{file,header,laps,meta}, ... }
  const [cmpASrc, setCmpASrc] = useState("cur");    // "cur" = yüklü dosya · "A"/"B"/… = kayıtlı stint
  const [cmpBSrc, setCmpBSrc] = useState("cur");
  const readersRef = useRef(new Map());   // File → readers (kimlikle önbellek; bayatlamaz)

  const doParse = (text) => {
    import("./parsers").then(({ parseMotecLog, parseTelemetryText, guessMapping }) => {
      const m = parseMotecLog(text);          // önce ham kanal log'u dene
      if (m) { setParsed(m); setMapping(null); return; }
      const p = parseTelemetryText(text);
      setParsed(p);
      if (p && !p.error) setMapping(guessMapping(p));
    });
  };
  const onTeleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setSavedMsg("");   // yeni dosya → eski kayıt onayını temizle
    /* .duckdb = LMU yerel telemetri kaydı (MoTeC .ld'nin yerini alır) → duckdb-wasm ile
       oku, aynı motec şekli. Ağır WASM (~35 MB) LAZY: yalnız .duckdb açılınca indirilir. */
    if (/\.duckdb$/i.test(f.name)) {
      setRawTele("");
      setMapping(null);
      setParsed({ loading: true, duck: true });
      setCmpASrc("cur"); setCmpBSrc("cur");
      setCmpData(null); setCmpLaps(null); setCmpMeta(null); setTeleFile(null); setTeleHeader(null);
      Promise.all([import("./duckdb"), import("./duckParse")])
        .then(([{ openDuck }, dp]) => Promise.all([openDuck(f), dp]))
        .then(([ds, { duckLaps, duckMeta }]) => {
          const laps = duckLaps(ds);
          const meta = duckMeta(ds);
          if (!laps.length) { setParsed({ error: "DuckDB: geçerli tur bulunamadı" }); return; }
          const header = { duck: ds };            // iz okuyucuları bu dataset'ten kurulur
          setParsed({ motec: true, laps, meta, _header: header });
          setTeleFile(f);
          setTeleHeader(header);
          setCmpLaps(laps);
          setCmpMeta(meta);
          const idx = laps.map((_, i) => i).sort((i, j) => laps[i].sec - laps[j].sec);
          const fulls = idx.filter((i) => !laps[i].partial);
          const pick = fulls.length >= 2 ? fulls : idx;
          setCmpA(pick[0] ?? 0);
          setCmpB(pick[1] ?? pick[0] ?? 0);
        })
        .catch(() => setParsed({ error: "DuckDB dosyası okunamadı" }));
      return;
    }
    /* .ld (MoTeC ikili log) desteği kaldırıldı — telemetri dosyası artık yalnız .duckdb
       (LMU yerel kaydı). Diğerleri (csv/tsv/txt) = metin: aşağıdaki ham okuma yolu. */
    setTeleFile(null); setTeleHeader(null); setCmpData(null); setCmpLaps(null); setCmpMeta(null);
    setCmpASrc("cur"); setCmpBSrc("cur");
    const rd = new FileReader();
    rd.onload = () => { setRawTele(String(rd.result)); doParse(String(rd.result)); };
    rd.readAsText(f);
  };

  /* Bir kaynak anahtarı → {file, header, laps, meta}. "cur" = yüklü dosya; slot = kayıtlı stint. */
  const resolveSrc = (key) => (key === "cur"
    ? { file: teleFile, header: teleHeader, laps: cmpLaps, meta: cmpMeta }
    : stintTele[key]);
  /* Okuyucuları File kimliğiyle önbellekle (kaynak değişse de bayatlamaz; eşzamanlı çağrı promise paylaşır). */
  const getReaders = (file, header) => {
    const m = readersRef.current;
    if (!m.has(file)) {
      /* .duckdb: okuyucular bellek-içi dataset'ten (senkron, ucuz) → promise'e sar.
         .ld: byte-slice okuyucular (async). Karışık kaynak (biri .ld biri .duckdb) desteklenir. */
      m.set(file, header?.duck
        ? import("./duckTrace").then(({ buildDuckReaders }) => buildDuckReaders(header.duck))
        : import("./ldTrace").then(({ buildReaders }) => buildReaders(file, header)));
    }
    return m.get(file);
  };

  /* İz karşılaştırma: her iki taraf kendi kaynağından (yüklü dosya ya da kayıtlı stint) okunur,
     iki turun izini + delta'yı üretir. Ağır iş async; yükleniyor durumu gösterilir. */
  useEffect(() => {
    let alive = true;
    const sA = resolveSrc(cmpASrc), sB = resolveSrc(cmpBSrc);
    if (!sA?.file || !sA?.header || !sB?.file || !sB?.header || cmpA == null || cmpB == null
      || !sA.laps?.[cmpA] || !sB.laps?.[cmpB]) { setCmpData(null); return undefined; }
    setCmpBusy(true);
    (async () => {
      try {
        const needDuck = sA.header?.duck || sB.header?.duck;
        const [ld, dk] = await Promise.all([
          import("./ldTrace"),                                  // buildTrace + buildCompare
          needDuck ? import("./duckTrace") : null,
        ]);
        const rA = await getReaders(sA.file, sA.header);
        const rB = (sA.file === sB.file) ? rA : await getReaders(sB.file, sB.header);
        const tA = sA.header?.duck ? dk.buildDuckTrace : ld.buildTrace;   // kaynağa göre iz fonksiyonu
        const tB = sB.header?.duck ? dk.buildDuckTrace : ld.buildTrace;
        const cmp = ld.buildCompare(tA(rA, sA.laps[cmpA]), tB(rB, sB.laps[cmpB]));
        if (alive) setCmpData(cmp);
      } catch { if (alive) setCmpData(null); }
      finally { if (alive) setCmpBusy(false); }
    })();
    return () => { alive = false; };
  }, [cmpASrc, cmpBSrc, cmpA, cmpB, teleFile, teleHeader, cmpLaps, stintTele]);

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
    /* meta (venue/vehicle/driver/trk/amb…) slotun `meta` anahtarına yazılır —
       SEANS paneli + slot kartı buradan okur. (Eskiden `src`'e yazılıyordu ama
       hiçbir tüketici onu okumuyordu → duckdb'deki pilot/sıcaklık görünmüyordu.) */
    setSt((s) => ({ ...s, telemetry: { ...s.telemetry,
      [slot]: { laps: apply105Rule(laps), name: `Stint ${slot}`, meta: parsed.meta } } }));
    /* İçe-aktar özeti (Dosya Seç + tur tablosu + Kaydet) KAPANIR → parsed/rawTele/mapping
       temizlenir. AMA teleFile/teleHeader/cmpLaps/cmpA/cmpB/cmpData/readersRef KORUNUR →
       Tur Karşılaştırma kartı + pist haritası yaşamaya devam eder (kullanıcı isteği). */
    /* Çapraz-stint: bu .ld'nin handle+header+laps+meta'sı slota kaydedilir → başka bir
       stint'e karşı karşılaştırılabilir (oturum-içi; DB'ye ham iz yazılmaz). */
    if (teleFile && teleHeader && cmpLaps) {
      setStintTele((prev) => ({ ...prev,
        [slot]: { file: teleFile, header: teleHeader, laps: cmpLaps, meta: cmpMeta } }));
    }
    setParsed(null); setRawTele(""); setMapping(null);
    setSavedMsg(slot);
  };

  const saveSlot = async () => {
    if (!parsed || parsed.error || !mapping || mapping.timeCol < 0) return;
    const { msFromCell } = await import("./parsers");
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
      [slot]: { laps: apply105Rule(laps), name: `Stint ${slot}`,
        ...(parsed.meta ? { meta: parsed.meta } : {}) } } }));
    setRawTele(""); setParsed(null); setMapping(null);
  };

  const toggleLap = (sl, li) => setSt((s) => {
    const t = s.telemetry[sl]; if (!t) return s;
    const laps = t.laps.map((l, i) => (i === li ? { ...l, use: !l.use } : l));
    return { ...s, telemetry: { ...s.telemetry, [sl]: { ...t, laps } } };
  });
  const removeSlot = (sl) => {
    setSt((s) => ({ ...s, telemetry: { ...s.telemetry, [sl]: null } }));
    setStintTele((prev) => { if (!prev[sl]) return prev; const n = { ...prev }; delete n[sl]; return n; });
    setCmpASrc((k) => (k === sl ? "cur" : k));
    setCmpBSrc((k) => (k === sl ? "cur" : k));
  };

  const slotStats = useMemo(() => computeSlotStats(st), [st.telemetry]);
  const chartData = useMemo(() => computeChartData(st), [st.telemetry]);
  const loadedSlots = ["A", "B", "C", "D"].filter((sl) => st.telemetry[sl]);
  const baseSlot = loadedSlots[0];

  /* Karşılaştırma kaynakları: yüklü dosya ("cur") + iz verisi tutulan kayıtlı stint'ler. */
  const cmpSources = useMemo(() => {
    const out = [];
    if (teleFile && cmpLaps?.length) out.push({ key: "cur", laps: cmpLaps, meta: cmpMeta });
    for (const sl of ["A", "B", "C", "D"]) {
      if (stintTele[sl]?.laps?.length) out.push({ key: sl, laps: stintTele[sl].laps, meta: stintTele[sl].meta });
    }
    return out;
  }, [teleFile, cmpLaps, cmpMeta, stintTele]);

  return { slot, setSlot, chartMode, setChartMode, rawTele, setRawTele, parsed, mapping,
    setMapping, onTeleFile, doParse, apply105Slot, saveMotec, saveSlot, toggleLap,
    removeSlot, slotStats, chartData, loadedSlots, baseSlot,
    cmpLaps, cmpMeta, cmpA, setCmpA, cmpB, setCmpB, cmpData, cmpBusy, savedMsg,
    cmpSources, cmpASrc, setCmpASrc, cmpBSrc, setCmpBSrc };
}
