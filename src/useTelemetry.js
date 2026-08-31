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
import { teleTraceSet, teleTraceGetAll, teleTraceRemove } from "./storage";
import { packTrace, unpackTrace, MAX_TRACE_STR } from "./traceCodec";

/* Tüm izler AYNI nokta sayısında üretilir — buildCompare index-hizalı çalışır
   (k. nokta = tur kesri k/(N-1)); kalıcı iz ve oturum-içi iz farklı N olursa
   harita/grafik hizası bozulur. 300 harita+delta için yeterli, boyutu makul tutar. */
const TRACE_N = 300;
/* Stint başına kalıcı iz güvenlik sınırı: tur başına ~9 KB × 80 ≈ 720 KB.
   Aşılırsa en hızlı 80 tam tur saklanır (Firebase bant genişliği/maliyet koruması). */
const MAX_TRACE_LAPS = 80;

/* Parser modülleri (parsers/ldParser/ldTrace/duckParse/duckTrace, ~48 KB kaynak)
   başlangıç paketinden çıkarıldı — yalnız dosya/metin içe aktarılınca dynamic
   import ile gelir, modül cache'i sonraki kullanımları anında yapar. TeleTab
   zaten lazy'ydi; statik importlar bu kazanımı sızdırıyordu. */

export function useTelemetry({ st, setSt, curTeam, curRace, role }) {
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
  /* Kalıcı izler (Firebase teleTrace'ten yüklenmiş, unpack'lenmiş). stintTele'nin
     KALICI muadili: file/header yok, iz nesneleri hazır. { A:{laps:[{sec,partial,lap}], meta, traces:[traceObj|null], mapSrc } } */
  const [savedTrace, setSavedTrace] = useState({});
  /* Kaydetme ilerlemesi/hatası: { slot, done, total } | { slot, ok } | { slot, error } | null */
  const [traceSaving, setTraceSaving] = useState(null);

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
    /* Telemetri dosyası artık YALNIZ .duckdb (LMU yerel kaydı). MoTeC .ld ve
       CSV/TSV/TXT (metin) desteği kaldırıldı — .duckdb dışı dosyalar reddedilir. */
    setRawTele(""); setMapping(null);
    setTeleFile(null); setTeleHeader(null); setCmpData(null); setCmpLaps(null); setCmpMeta(null);
    setCmpASrc("cur"); setCmpBSrc("cur");
    setParsed({ error: "Yalnızca .duckdb dosyaları desteklenir" });
    e.target.value = "";   // aynı dosya tekrar seçilebilsin
  };

  /* Bir kaynak anahtarı → kaynak nesnesi. Üç tip:
     "cur" = yüklü dosya {file, header, laps, meta};
     oturum-içi stint {file, header, laps, meta} (stintTele);
     KALICI stint {traces:[...], laps, meta} (savedTrace — file/header YOK, izler hazır). */
  const resolveSrc = (key) => {
    if (key === "cur") return { file: teleFile, header: teleHeader, laps: cmpLaps, meta: cmpMeta };
    if (stintTele[key]) return stintTele[key];   // oturum-içi tam çözünürlük önceliği
    const sv = savedTrace[key];
    if (sv) return { traces: sv.traces, laps: sv.laps, meta: sv.meta };
    return undefined;
  };
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
    /* Her taraf ya KALICI (traces[idx] hazır) ya OTURUM-İÇİ (file+header'dan üretilecek).
       İki taraf karışık olabilir (A kalıcı, B oturum-içi) — buildCompare kaynak-bağımsız. */
    const okSide = (s, idx) => !!(s && idx != null && s.laps?.[idx]
      && (s.traces?.[idx] || (s.file && s.header)));
    if (!okSide(sA, cmpA) || !okSide(sB, cmpB)) { setCmpData(null); return undefined; }
    setCmpBusy(true);
    (async () => {
      try {
        const needDuck = sA.header?.duck || sB.header?.duck;
        const [ld, dk] = await Promise.all([
          import("./ldTrace"),                                  // buildCompare (+ buildTrace)
          needDuck ? import("./duckTrace") : null,
        ]);
        /* Bir tarafın izini getir: kalıcıysa doğrudan al; değilse okuyuculardan üret.
           Tüm izler TRACE_N noktada → buildCompare index-hizalı. */
        const traceOf = async (s, idx) => {
          if (s.traces?.[idx]) return s.traces[idx];
          const r = await getReaders(s.file, s.header);
          return s.header?.duck ? dk.buildDuckTrace(r, s.laps[idx], TRACE_N)
            : ld.buildTrace(r, s.laps[idx], TRACE_N);
        };
        const [tA, tB] = await Promise.all([traceOf(sA, cmpA), traceOf(sB, cmpB)]);
        const cmp = ld.buildCompare(tA, tB);
        if (alive) setCmpData(cmp);
      } catch { if (alive) setCmpData(null); }
      finally { if (alive) setCmpBusy(false); }
    })();
    return () => { alive = false; };
  }, [cmpASrc, cmpBSrc, cmpA, cmpB, teleFile, teleHeader, cmpLaps, stintTele, savedTrace]);

  /* Kalıcı izleri yükle: yarış açılınca teleTrace'i BİR KEZ oku (iz yalnız stint
     kaydında değişir → canlı dinlemeye gerek yok, bant genişliği tasarrufu).
     Migration: düğüm yoksa savedTrace={} → davranış değişmez. */
  useEffect(() => {
    if (!curTeam || !curRace) { setSavedTrace({}); return undefined; }
    let alive = true;
    teleTraceGetAll(curTeam, curRace).then((all) => {
      if (!alive) return;
      if (!all || typeof all !== "object") { setSavedTrace({}); return; }
      const out = {};
      for (const sl of ["A", "B", "C", "D"]) {
        const node = all[sl];
        if (!node?.lap) continue;
        const keys = Object.keys(node.lap).map(Number).filter(Number.isInteger).sort((a, b) => a - b);
        const traces = keys.map((k) => unpackTrace(node.lap[k]));
        const laps = Array.isArray(node.meta?.laps) ? node.meta.laps : keys.map(() => ({}));
        out[sl] = { laps, meta: node.meta || null, traces, mapSrc: node.meta?.mapSrc || null };
      }
      setSavedTrace(out);
      /* Dosya yüklenmemişken (yarış yeni açıldı) karşılaştırmayı otomatik ilk kayıtlı
         stintin en hızlı turuna kur → harita + gaz/fren manuel seçim beklemeden gelir. */
      if (!teleFile) {
        const first = ["A", "B", "C", "D"].find((sl) => out[sl]?.traces?.some(Boolean));
        if (first) {
          const laps = out[first].laps;
          const order = laps.map((_, i) => i).sort((a, b) => (laps[a]?.sec || 1e9) - (laps[b]?.sec || 1e9));
          const best = order.find((i) => !laps[i]?.partial && out[first].traces[i]) ?? order[0] ?? 0;
          setCmpASrc(first); setCmpBSrc(first); setCmpA(best); setCmpB(best);
        }
      }
    }).catch(() => { if (alive) setSavedTrace({}); });
    return () => { alive = false; };
  }, [curTeam, curRace]);

  /* %105 kuralı saf `apply105Rule` (state.js) — kısmi/freak turları "en iyi" adayı
     saymaz (yarım tur tüm gerçek turların tikini kaldırmasın). */
  const apply105Slot = (sl) => setSt((s) => {
    const t0 = s.telemetry[sl];
    if (!t0) return s;
    return { ...s, telemetry: { ...s.telemetry, [sl]: { ...t0, laps: apply105Rule(t0.laps) } } };
  });

  /* Bir stintin TÜM (tam) turlarının izini üret → kompaktla → Firebase'e yaz.
     Ağır iş (tur başına buildDuckTrace ~10-30 ms); UI'yı bloklamamak için 5'erli
     chunk'lanır, ilerleme traceSaving ile bildirilir. Yalnız takım + editör/sahip
     + yüklü dosya varken çalışır; yoksa sessizce atlanır (oturum-içi davranış korunur).
     Hata graceful: stintTele oturum-içi zaten dolu, sadece kalıcılık atlanır. */
  const persistTraces = async (sl, file, header, laps, meta) => {
    if (!curTeam || !curRace || !role || role === "viewer" || !file || !header || !laps?.length) return;
    // tam (kısmi olmayan) turlar; sınır aşılırsa en hızlı MAX_TRACE_LAPS tur
    let idxs = laps.map((_, i) => i).filter((i) => laps[i] && !laps[i].partial);
    if (!idxs.length) idxs = laps.map((_, i) => i);   // hepsi kısmi ise yine de sakla
    let capped = false;
    if (idxs.length > MAX_TRACE_LAPS) {
      capped = true;
      idxs = [...idxs].sort((a, b) => (laps[a].sec || 1e9) - (laps[b].sec || 1e9))
        .slice(0, MAX_TRACE_LAPS).sort((a, b) => a - b);
    }
    setTraceSaving({ slot: sl, done: 0, total: idxs.length });
    try {
      const readers = await getReaders(file, header);
      const dk = header?.duck ? await import("./duckTrace") : null;
      const ld = header?.duck ? null : await import("./ldTrace");
      const lapMap = {}; const metaLaps = []; let mapSrc = null; let done = 0;
      for (const i of idxs) {
        const tr = header?.duck ? dk.buildDuckTrace(readers, laps[i], TRACE_N)
          : ld.buildTrace(readers, laps[i], TRACE_N);
        const packed = tr ? packTrace(tr) : "";
        if (packed && packed.length < MAX_TRACE_STR) {
          if (!mapSrc && tr.mapSrc) mapSrc = tr.mapSrc;
          lapMap[metaLaps.length] = packed;
          metaLaps.push({ sec: laps[i].sec ?? null, lap: laps[i].lap ?? null, partial: !!laps[i].partial });
        }
        done++;
        setTraceSaving({ slot: sl, done, total: idxs.length });
        if (done % 5 === 0) await new Promise((r) => setTimeout(r));   // UI nefes alsın
      }
      if (!metaLaps.length) { setTraceSaving(null); return; }
      await teleTraceSet(curTeam, curRace, sl, {
        meta: { at: Date.now(), laps: metaLaps, n: metaLaps.length, mapSrc, capped },
        lap: lapMap,
      });
      // optimistik: yeniden yükleme beklemeden kalıcı kaynak hazır olsun
      setSavedTrace((prev) => ({ ...prev, [sl]: {
        laps: metaLaps, meta, mapSrc,
        traces: metaLaps.map((_, k) => unpackTrace(lapMap[k])),
      } }));
      setTraceSaving({ slot: sl, ok: true, n: metaLaps.length, capped });
      setTimeout(() => setTraceSaving((s) => (s?.slot === sl && s.ok ? null : s)), 3000);
    } catch (e) {
      setTraceSaving({ slot: sl, error: e?.message || "iz kaydedilemedi" });
      setTimeout(() => setTraceSaving((s) => (s?.slot === sl && s.error ? null : s)), 4500);
    }
  };

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
      sectors: Array.isArray(l.sectors) && l.sectors.length === 3 ? l.sectors : null,
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
      /* v2.2.3 — o stintin tüm turlarının izini Firebase'e KALICI yaz (harita +
         gaz/fren program kapanınca da dursun). Async, kendi guard'ı var. */
      persistTraces(slot, teleFile, teleHeader, cmpLaps, cmpMeta);
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
    setSavedTrace((prev) => { if (!prev[sl]) return prev; const n = { ...prev }; delete n[sl]; return n; });
    teleTraceRemove(curTeam, curRace, sl);   // kalıcı izi de sil
    setCmpASrc((k) => (k === sl ? "cur" : k));
    setCmpBSrc((k) => (k === sl ? "cur" : k));
  };

  const slotStats = useMemo(() => computeSlotStats(st), [st.telemetry]);
  const chartData = useMemo(() => computeChartData(st), [st.telemetry]);
  const loadedSlots = ["A", "B", "C", "D"].filter((sl) => st.telemetry[sl]);
  const baseSlot = loadedSlots[0];

  /* Karşılaştırma kaynakları: yüklü dosya ("cur") + iz verisi tutulan stint'ler.
     Her slot için oturum-içi (stintTele, tam çözünürlük) önce; yoksa KALICI
     (savedTrace, Firebase'ten). Böylece yeni yüklenen dosya oturum boyunca yüksek
     çözünürlük, yarış yeniden açılışında kalıcı iz gösterir. */
  const cmpSources = useMemo(() => {
    const out = [];
    if (teleFile && cmpLaps?.length) out.push({ key: "cur", laps: cmpLaps, meta: cmpMeta });
    for (const sl of ["A", "B", "C", "D"]) {
      if (stintTele[sl]?.laps?.length) out.push({ key: sl, laps: stintTele[sl].laps, meta: stintTele[sl].meta });
      else if (savedTrace[sl]?.laps?.length) out.push({ key: sl, laps: savedTrace[sl].laps, meta: savedTrace[sl].meta });
    }
    return out;
  }, [teleFile, cmpLaps, cmpMeta, stintTele, savedTrace]);

  return { slot, setSlot, chartMode, setChartMode, rawTele, setRawTele, parsed, mapping,
    setMapping, onTeleFile, doParse, apply105Slot, saveMotec, saveSlot, toggleLap,
    removeSlot, slotStats, chartData, loadedSlots, baseSlot,
    cmpLaps, cmpMeta, cmpA, setCmpA, cmpB, setCmpB, cmpData, cmpBusy, savedMsg,
    cmpSources, cmpASrc, setCmpASrc, cmpBSrc, setCmpBSrc, traceSaving };
}
