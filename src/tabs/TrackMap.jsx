import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { classId, classAccent, CAR_CLASSES } from "../constants";
import { wetnessLevel, rainLevel, WEATHER } from "../engine";
import { WetIcon } from "../WetIcon";
import { TrackTempIcon } from "../TrackTempIcon";
import { Icon } from "../components";
import { packBins, unpackBins } from "../trackShape";
import { observeSector, sectorFractions, sectorRanges,
  packSectors, unpackSectors, emptySectors,
  observePit, pitFractions, packPit, unpackPit, emptyPit } from "../trackSectors";
import { liveTrackSave, liveTrackSubscribe,
  liveTrackSecSave, liveTrackSecSubscribe,
  liveTrackPitSave, liveTrackPitSubscribe } from "../storage";

/* Canlı pist haritası — iki katman:
   • Dış boşluk halkası: her araç tur mesafesine (lapDist/trackLength) göre daire
     üzerinde; S/F tepede. Fiziksel yakınlık = trafik.
   • İç pist şekli: araçların dünya (posX,posZ) konumları lapDist kutularına
     gömülerek gerçek devre çizilir (birkaç saniyede dolar); araçlar üzerine yerleşir.
   Renkler sınıfa göre (classAccent); oyuncu #960018 halkalı beyaz nokta.
   Köprü lapDist/posX/posZ + session.trackLength göndermezse kart gösterilmez.
   "⛶ Büyüt" → aynı harita ayrı bir pencerede (wxmodal deseni) ekranın izin verdiği
   en büyük kare boyutta; durum bu bileşende tutulduğu için biriken pist şekli ve
   canlı kareler paylaşılır (büyük görünüm de canlı akar, şekil yeniden birikmez). */

const NB = 240;                 // lapDist kutu sayısı (pist şekli çözünürlüğü)
const BRAND = "#960018";        // ana tema
const SECTOR_COL = "#5aa9e6";   // sektör ayırıcı (S/F kırmızısından ayrışan soğuk mavi)
const ROAD_W = 20;              // yol bandı kalınlığı ≈ araç dairesi çapı (araç içine oturur)
const ROAD_COL = "var(--line2)"; // yol rengi (siyah zeminde okunur; renkli noktalar üstte)
const ROAD_WET = "#2b4a66";     // ıslak zemin — soluk koyu mavi (yol bandı)
const ROAD_FCY = "#5a4a1e";     // full-course yellow — koyu amber
const YELLOW = "#F2C037";       // lokal sarı sektör yayı
const cx = 260, cy = 262;       // merkez
const R = 236;                  // dış halka yarıçapı
const PAD = 148;                // iç şekil yarım-uzanımı (px)

export default function TrackMap({ t, field, session, trackLength, tid, trackKey,
  canSave, topSlot }) {
  const [zoom, setZoom] = useState(false);   // ⛶ büyük pencere (tam ekran overlay)
  const [, bump] = useState(0);              // paylaşımlı şekil gelince yeniden çiz
  const svgRef = useRef(null);               // küçük karttaki canlı svg (yeni pencereye kopyalanır)
  const winRef = useRef(null);               // ayrı tarayıcı penceresi
  useEffect(() => {
    if (!zoom) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setZoom(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [zoom]);
  /* ⧉ Ayrı pencere: haritayı yeni bir tarayıcı penceresinde açar; küçük karttaki
     canlı svg'yi periyodik kopyalayarak pencereyi canlı tutar (React yeniden
     kurulmadan). Pencere kapanınca kendi interval'i durur. */
  const openWin = () => {
    const w = window.open("", "rc-map-" + (trackKey || "map"), "width=760,height=800");
    if (!w) return;
    winRef.current = w;
    w.document.title = `${t("Pist Haritası")} · ${session?.trackName || ""}`;
    w.document.body.style.cssText = "margin:0;background:#0B0708;height:100vh;display:flex;align-items:center;justify-content:center;overflow:hidden";
    const holder = w.document.createElement("div");
    holder.style.cssText = "width:96vmin;height:96vmin;display:flex;align-items:center;justify-content:center";
    w.document.body.appendChild(holder);
    const paint = () => { if (svgRef.current) holder.innerHTML = svgRef.current.outerHTML; };
    paint();
    w.setInterval(() => { if (!w.closed) paint(); }, 700);
  };
  useEffect(() => () => { try { winRef.current?.close?.(); } catch { /* yoksay */ } }, []);
  /* pist DEĞİŞİNCE biriktirmeyi sıfırla — anahtar artık trackKey (pist adı) → şekil
     pist başına paylaşımlı olduğundan aynı pistin yarışları arasında da korunur. */
  const acc = useRef({ key: null, bins: {}, saved: 0, sec: emptySectors(), secSaved: "",
    pit: emptyPit(), pitSaved: "" });
  const prevSec = useRef({});   // lapKey → son sektör (sınır geçişini yakalamak için)
  const prevLoc = useRef({});   // lapKey → son location (pit giriş/çıkış geçişi için)
  if (acc.current.key !== trackKey) {
    acc.current = { key: trackKey, bins: {}, saved: 0, sec: emptySectors(), secSaved: "",
      pit: emptyPit(), pitSaved: "" };
    prevSec.current = {};
    prevLoc.current = {};
  }

  /* takımca paylaşımlı şekli yükle: bir kez oluşan devre, tüm takımda (hiç sürmeyen
     izleyici dahil) anında dolu gelir. Gelen kutular yalnız EKSİK olanlara yerleşir
     (canlı gözlenenleri ezmez). */
  useEffect(() => {
    if (!tid || !trackKey) return undefined;
    const off = liveTrackSubscribe(tid, trackKey, (packed) => {
      const shared = unpackBins(packed);
      let added = 0;
      for (const b of Object.keys(shared)) {
        if (!acc.current.bins[b]) { acc.current.bins[b] = shared[b]; added++; }
      }
      if (added) bump((v) => v + 1);
    });
    return off;
  }, [tid, trackKey]);

  /* takımca paylaşımlı sektör sınırları — izleyicilerde ayırıcılar anında gelsin.
     Yalnız HENÜZ gözlenmemiş sınırı doldur (canlı gözlemi ezme): sum=frac, n=1. */
  useEffect(() => {
    if (!tid || !trackKey) return undefined;
    const off = liveTrackSecSubscribe(tid, trackKey, (str) => {
      const fr = unpackSectors(str);
      if (!fr) return;
      let added = false;
      const seed = (acc0, f) => {
        if (f != null && acc0.n === 0) { acc0.sum = f; acc0.n = 1; added = true; }
      };
      seed(acc.current.sec.b12, fr.f12);
      seed(acc.current.sec.b20, fr.f20);
      if (added) bump((v) => v + 1);
    });
    return off;
  }, [tid, trackKey]);

  /* takımca paylaşımlı pit giriş/çıkış — izleyicilerde işaretler anında gelsin. */
  useEffect(() => {
    if (!tid || !trackKey) return undefined;
    const off = liveTrackPitSubscribe(tid, trackKey, (str) => {
      const fr = unpackPit(str);
      if (!fr) return;
      let added = false;
      const seed = (acc0, f) => {
        if (f != null && acc0.n === 0) { acc0.sum = f; acc0.n = 1; added = true; }
      };
      seed(acc.current.pit.entry, fr.entry);
      seed(acc.current.pit.exit, fr.exit);
      if (added) bump((v) => v + 1);
    });
    return off;
  }, [tid, trackKey]);

  const cars = (Array.isArray(field) ? field : [])
    .filter((c) => c.posX != null && c.posZ != null);

  // sınıf-içi pozisyon (Pn) — pos sırasında sınıfa göre say (LiveTab ile aynı mantık)
  const order = (Array.isArray(field) ? field : []).slice()
    .sort((a, b) => (a.pos > 0 ? a.pos : 999) - (b.pos > 0 ? b.pos : 999));
  const clsN = {};
  const classPos = new Map();
  for (const c of order) {
    const id = classId(c.carClass);
    clsN[id] = (clsN[id] || 0) + 1;
    classPos.set(c, clsN[id]);
  }

  /* her araç → lapDist kutusu (yalnız boş kutuyu doldur → pist şekli birikir).
     YALNIZ PİSTTEKİ araçlar: pit yolundaki/garajdaki araçların dünya konumu pistin
     yanındadır ve kutular bir daha güncellenmediği için o hatalı nokta tüm seans
     boyunca kalırdı (seans başında herkes garajda → devre şeklinde kalıcı çıkıntı). */
  if (trackLength > 0) {
    for (const c of cars) {
      const frac = ((c.lapDist / trackLength) % 1 + 1) % 1;
      const key = c.lapKey || c.driver || c.pos;
      /* pit GİRİŞ/ÇIKIŞI: location TRACK↔PIT döndüğü andaki lapDist oranı. prevLoc'ta
         tutulur; ilk görüşte yalnız kaydedilir (sahte geçiş olmasın). Tüm araçlar. */
      const loc = c.location || (c.inPits ? "PIT" : "TRACK");
      const pl = prevLoc.current[key];
      /* lapsDone > 0: seans başında herkes garajda/grid'de → GARAGE→TRACK (start) sahte
         "pit çıkışı" sanılmasın (detectPitEntry ile aynı koruma). */
      if (pl != null && pl !== loc && c.lapsDone > 0) observePit(acc.current.pit, pl, loc, frac);
      prevLoc.current[key] = loc;

      const onTrack = c.location ? c.location === "TRACK" : !c.inPits;
      if (!onTrack) continue;
      const b = Math.floor(frac * NB) % NB;
      if (!acc.current.bins[b]) acc.current.bins[b] = { x: c.posX, z: c.posZ };
      /* sektör SINIRI: aracın mSector'ü değiştiği andaki lapDist oranı (1→2, 2→0). */
      if (c.sector != null && c.sector >= 0) {
        const prev = prevSec.current[key];
        if (prev != null && prev !== c.sector) observeSector(acc.current.sec, prev, c.sector, frac);
        prevSec.current[key] = c.sector;
      }
    }
  }

  const bins = acc.current.bins;
  const binCount = Object.keys(bins).length;

  /* şekil olgunlaşınca (≈%90 kutu) takımca paylaş — owner/editor yazar, tur başına
     değil bir kez (yeni kutular geldikçe 2 sn debounce ile). Viewer yalnız okur. */
  useEffect(() => {
    if (!canSave || !tid || !trackKey) return undefined;
    if (binCount < NB * 0.9 || binCount <= acc.current.saved) return undefined;
    const id = setTimeout(() => {
      liveTrackSave(tid, trackKey, packBins(acc.current.bins));
      acc.current.saved = binCount;
    }, 2000);
    return () => clearTimeout(id);
  }, [canSave, tid, trackKey, binCount]);

  // gözlenen sektör sınırları (ortalama) — çizim + paylaşım için
  const secFr = sectorFractions(acc.current.sec);
  const secStr = packSectors(secFr);
  /* iki sınır da gözlenince takımca paylaş (owner/editor); değişince bir kez, 2 sn
     debounce (şekil deseni). Viewer yalnız okur. */
  useEffect(() => {
    if (!canSave || !tid || !trackKey || !secStr) return undefined;
    if (!(secFr && secFr.f12 != null && secFr.f20 != null)) return undefined;
    if (secStr === acc.current.secSaved) return undefined;
    const id = setTimeout(() => {
      liveTrackSecSave(tid, trackKey, secStr);
      acc.current.secSaved = secStr;
    }, 2000);
    return () => clearTimeout(id);
  }, [canSave, tid, trackKey, secStr, secFr]);

  // gözlenen pit giriş/çıkış (ortalama) — işaret + paylaşım için
  const pitFr = pitFractions(acc.current.pit);
  const pitStr = packPit(pitFr);
  useEffect(() => {
    if (!canSave || !tid || !trackKey || !pitStr) return undefined;
    if (pitStr === acc.current.pitSaved) return undefined;
    const id = setTimeout(() => {
      liveTrackPitSave(tid, trackKey, pitStr);
      acc.current.pitSaved = pitStr;
    }, 2000);
    return () => clearTimeout(id);
  }, [canSave, tid, trackKey, pitStr]);

  /* iç şekil dönüşümü (dünya x/z → ekran), pist bbox'una göre ölçekli.
     Geometri memo (v1.8.0): bins yalnız YENİ kutu kazanır (mevcut güncellenmez)
     ve trackKey değişince sıfırlanır → binCount+trackKey doğru önbellek anahtarı.
     240 kutuluk sort + minmax spread'leri + outline path string'i eskiden her
     canlı karede yeniden kuruluyordu; artık yalnız şekil gerçekten büyüyünce. */
  const { pts, toScreen, outline } = useMemo(() => {
    const idx = Object.keys(bins).map(Number).sort((a, b) => a - b);
    const pts = idx.map((i) => bins[i]);
    let toScreen = null, outline = "";
    if (pts.length >= NB * 0.45) {
      const xs = pts.map((p) => p.x), zs = pts.map((p) => p.z);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minZ = Math.min(...zs), maxZ = Math.max(...zs);
      const spanX = maxX - minX || 1, spanZ = maxZ - minZ || 1;
      const sc = Math.min((PAD * 2) / spanX, (PAD * 2) / spanZ);
      const mx = (minX + maxX) / 2, mz = (minZ + maxZ) / 2;
      toScreen = (x, z) => [cx + (x - mx) * sc, cy - (z - mz) * sc];  // z yukarı
      outline = pts.map((p, i) => {
        const [sx, sy] = toScreen(p.x, p.z);
        return `${i ? "L" : "M"}${sx.toFixed(1)} ${sy.toFixed(1)}`;
      }).join(" ") + " Z";
    }
    return { pts, toScreen, outline };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [binCount, trackKey]);

  // dış halka açısı: lapDist oranı → tepeden saat yönünde
  const ringXY = (lapDist) => {
    const a = (Math.max(0, lapDist) / (trackLength || 1)) * 2 * Math.PI;
    return [cx + R * Math.sin(a), cy - R * Math.cos(a)];
  };

  /* daire + içinde sınıf-içi pozisyon (num). renk = sınıf; oyuncu beyaz/#960018.
     AKICILIK: daire (0,0)'da çizilir, konum sarmalayıcı <g>'nin CSS transform'uyla
     verilir → köprü ~2.5 Hz kare atsa da tarayıcı kareler arasını kendisi animate
     eder (zıplama yok, rAF gerekmez). key ARAÇ kimliği (kprefix+lapKey): pozisyon
     değişince remount olup animasyonu kırmasın. S/F geçişi xy uzayında komşu nokta
     olduğu için sarma problemi yoktur. */
  const dot = (c, x, y, rBase, num, keyPrefix) => {
    const col = classAccent(c.carClass) || "var(--muted)";
    const label = num > 0 ? String(num) : "";
    const fs = num >= 10 ? rBase : rBase + 2;   // 2 haneli biraz küçük
    const key = `${keyPrefix}${c.lapKey || c.driver || c.pos}`;
    const gStyle = { transform: `translate(${x}px, ${y}px)`,
      transition: "transform .5s linear" };
    if (c.isPlayer) {
      return (
        <g key={key} style={gStyle}>
          <circle r={rBase + 2} fill="#fff" stroke={BRAND} strokeWidth={2.5} />
          <circle r={rBase + 6} fill="none" stroke={BRAND}
            strokeWidth={1.4} opacity={0.55} />
          {label && <text fill={BRAND} fontSize={fs} fontWeight="800"
            textAnchor="middle" dominantBaseline="central">{label}</text>}
        </g>
      );
    }
    const pit = c.inPits || c.location === "PIT";
    return (
      <g key={key} style={gStyle}>
        <circle r={rBase} fill={col}
          stroke={pit ? "#fff" : "none"} strokeWidth={pit ? 1.6 : 0} opacity={0.97} />
        {label && <text fill="#fff" fontSize={fs} fontWeight="700"
          textAnchor="middle" dominantBaseline="central"
          stroke="rgba(0,0,0,.4)" strokeWidth="0.5" paintOrder="stroke">{label}</text>}
      </g>
    );
  };

  const building = pts.length < NB * 0.45;
  const count = building ? t("iç harita oluşturuluyor…") : `${binCount}/${NB}`;

  /* SEKTÖR AYIRICILARI — sınır oranı f için: dış halkada radyal tik + etiket, iç şekilde
     pisti dik kesen kısa çizgi. Tik yönü: dış = merkezden dışa; iç = teğete dik
     (komşu kutulardan tahmin). Yalnız gözlenen sınır çizilir. */
  const binAt = (k) => bins[((Math.round(k) % NB) + NB) % NB];
  const sectorMark = (f, lbl) => {
    if (f == null) return null;
    const a = f * 2 * Math.PI;
    const ux = Math.sin(a), uy = -Math.cos(a);   // ringXY ile aynı yön (dışa)
    const ring = (
      <line x1={cx + (R - 13) * ux} y1={cy + (R - 13) * uy}
        x2={cx + (R + 13) * ux} y2={cy + (R + 13) * uy}
        stroke={SECTOR_COL} strokeWidth={2} opacity={0.85} />
    );
    const rlabel = (
      <text x={cx + (R + 20) * ux} y={cy + (R + 20) * uy} fill={SECTOR_COL}
        fontSize="10" fontWeight="700" textAnchor="middle" dominantBaseline="central"
        opacity={0.9}>{lbl}</text>
    );
    // iç şekil dik çizgisi (şekil olgunsa)
    let inner = null;
    if (toScreen) {
      const bi = f * NB;
      let cB = null;
      for (let d = 0; d <= 8 && cB == null; d++) {
        if (binAt(bi + d)) cB = Math.round(bi + d);
        else if (binAt(bi - d)) cB = Math.round(bi - d);
      }
      if (cB != null) {
        let lo = null, hi = null;
        for (let d = 1; d <= 12; d++) {
          if (lo == null && binAt(cB - d)) lo = cB - d;
          if (hi == null && binAt(cB + d)) hi = cB + d;
        }
        const cp = binAt(cB);
        const [px, py] = toScreen(cp.x, cp.z);
        let perpx = 0, perpy = -1;
        if (lo != null && hi != null) {
          const A = toScreen(binAt(lo).x, binAt(lo).z);
          const B = toScreen(binAt(hi).x, binAt(hi).z);
          let tx = B[0] - A[0], ty = B[1] - A[1];
          const L = Math.hypot(tx, ty) || 1; tx /= L; ty /= L;
          perpx = -ty; perpy = tx;
        }
        inner = (<>
          <line x1={px - perpx * 13} y1={py - perpy * 13}
            x2={px + perpx * 13} y2={py + perpy * 13}
            stroke={SECTOR_COL} strokeWidth={2.5} opacity={0.9} strokeLinecap="round" />
          <text x={px + perpx * 20} y={py + perpy * 20} fill={SECTOR_COL} fontSize="9"
            fontWeight="700" textAnchor="middle" dominantBaseline="central">{lbl}</text>
        </>);
      }
    }
    return (<g key={`sec${lbl}`}>{ring}{rlabel}{inner}</g>);
  };
  // sınır etiketi: biten sektör (S1│S2 → "S1", S2│S3 → "S2"); S/F zaten S3'ün sonu
  const sectorMarks = secFr
    ? [sectorMark(secFr.f12, "S1"), sectorMark(secFr.f20, "S2")]
    : null;

  /* ---- PİST DURUMU KATMANI (session → görsel): bayrak / sarı sektör / ıslak zemin ----
     session prop yoksa (demo/eski) hiçbir katman çizilmez → geriye uyum. */
  const flag = session?.flag;
  const isFCY = flag === "FCY";
  const wetId = wetnessLevel(session?.wetness);   // null = veri yok
  const rainId = rainLevel(session?.rain);
  const isWet = wetId && wetId !== "dry";
  // yol bandı rengi: FCY amber > ıslak mavi > normal (öncelik sırası)
  const roadStroke = isFCY ? ROAD_FCY : (isWet ? ROAD_WET : ROAD_COL);

  // sarı sektör yayı — yellowSectors [2] gibi S-no'lar; sektör lapDist aralığı secFr'den
  const ranges = sectorRanges(secFr);
  const ringArc = (fromFrac, toFrac) => {
    const a0 = fromFrac * 2 * Math.PI, a1 = toFrac * 2 * Math.PI;
    const p0 = [cx + R * Math.sin(a0), cy - R * Math.cos(a0)];
    const p1 = [cx + R * Math.sin(a1), cy - R * Math.cos(a1)];
    const large = toFrac - fromFrac > 0.5 ? 1 : 0;   // sweep=1: tepeden saat yönü
    return `M${p0[0].toFixed(1)} ${p0[1].toFixed(1)} A ${R} ${R} 0 ${large} 1 `
      + `${p1[0].toFixed(1)} ${p1[1].toFixed(1)}`;
  };
  const yellowArcs = (!isFCY && Array.isArray(session?.yellowSectors) && ranges)
    ? session.yellowSectors.map((sn) => {
        const rg = ranges.find((r) => r.sec === Number(sn));
        if (!rg || rg.to <= rg.from) return null;
        return <path key={`ys${sn}`} d={ringArc(rg.from, rg.to)} fill="none"
          stroke={YELLOW} strokeWidth={ROAD_W} opacity={0.5} />;
      })
    : null;

  // durum rozeti (harita üstü HTML katmanı) — bayrak + hava + sıcaklık
  const hasCond = isFCY || flag === "Yellow" || isWet
    || (rainId && rainId.id !== "none") || session?.trackTemp != null;
  const conditionBadge = hasCond ? (
    <div className="mapcond">
      {(isFCY || flag === "Yellow") && (
        <span className="mapcond-flag"><Icon name="flama" size={14} /> {isFCY ? "FCY" : t("Yellow")}
          {flag === "Yellow" && session?.yellowSectors?.length
            ? " " + session.yellowSectors.map((s) => "S" + s).join("·") : ""}</span>
      )}
      {isWet && (
        <span className="mapcond-wx"><WetIcon id={wetId} size={15}
          title={WEATHER[wetId]?.lbl} /> {WEATHER[wetId]?.lbl}</span>
      )}
      {!isWet && rainId && rainId.id !== "none" && (
        <span className="mapcond-wx">{rainId.ico} {rainId.lbl}</span>
      )}
      {session?.trackTemp != null && (
        <span className="mapcond-temp" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <TrackTempIcon temp={session.trackTemp} size={14} title={t("Asfalt sıcaklığı")} />
          {Math.round(session.trackTemp)}°{session?.ambientTemp != null ? ` · ${Math.round(session.ambientTemp)}°` : ""}</span>
      )}
    </div>
  ) : null;

  /* ---- PİT İŞARETLERİ + HAREKET YÖNÜ (v1.4.96) ---- */
  const ringXYFrac = (f) => {
    const a = f * 2 * Math.PI;
    return [cx + R * Math.sin(a), cy - R * Math.cos(a)];
  };
  /* pit GİRİŞ/ÇIKIŞI: yolu kesen dik ÇİZGİ + etiket (sectorMark dış-halka deseni).
     Giriş yeşil "PIT IN", çıkış beyaz "PIT OUT" — ikisi de aynı çizgi biçiminde. */
  const pitLine = (frac, col, label, key) => {
    if (frac == null) return null;
    const a = frac * 2 * Math.PI;
    const ux = Math.sin(a), uy = -Math.cos(a);   // dışa doğru radyal normal
    return (
      <g key={key}>
        <line x1={cx + (R - 13) * ux} y1={cy + (R - 13) * uy}
          x2={cx + (R + 13) * ux} y2={cy + (R + 13) * uy}
          stroke={col} strokeWidth={2.5} strokeLinecap="round" />
        <text x={cx + (R + 26) * ux} y={cy + (R + 26) * uy} fill={col}
          fontSize="9" fontWeight="700" textAnchor="middle" dominantBaseline="central">{label}</text>
      </g>
    );
  };
  const pitMarks = pitFr
    ? [pitLine(pitFr.entry, "#37D67A", "PIT IN", "pit-in"),
       pitLine(pitFr.exit, "#fff", "PIT OUT", "pit-out")]
    : null;
  // hareket yönü oku — S/F'nin hemen ötesinde, pist teğeti (saat yönü, jitter'sız)
  const dirArrow = (() => {
    if (!(trackLength > 0)) return null;
    const f = 0.04, a = f * 2 * Math.PI, s = 8;
    const [x, y] = ringXYFrac(f);
    const dx = Math.cos(a), dy = Math.sin(a);   // teğet (ilerleme yönü)
    const px = -dy, py = dx;                     // dike
    const pt = (mx, my) => `${(x + dx * s * mx + px * s * my).toFixed(1)},`
      + `${(y + dy * s * mx + py * s * my).toFixed(1)}`;
    return <polygon points={`${pt(1, 0)} ${pt(-0.7, 0.7)} ${pt(-0.7, -0.7)}`}
      fill="var(--muted)" opacity={0.85} />;
  })();

  // lejant (Büyük Pano) — sahadaki sınıf renkleri + oyuncu + pit
  const clsSeen = [];
  for (const c of cars) {
    const id = classId(c.carClass);
    if (id && !clsSeen.includes(id)) clsSeen.push(id);
  }
  const legend = (
    <div className="maplegend">
      {clsSeen.map((id) => (
        <span key={id}><i style={{ background: classAccent(id) }} />
          {CAR_CLASSES.find(([cid]) => cid === id)?.[1] || id}</span>
      ))}
      <span><i style={{ background: "#fff", boxShadow: `0 0 0 2px ${BRAND}` }} /> {t("Sen")}</span>
      {pitMarks && <><span><i style={{ background: "#37D67A" }} /> {t("Pit giriş")}</span>
        <span><i style={{ background: "#fff" }} /> PIT OUT</span></>}
    </div>
  );

  /* SVG içeriği tek yerde — küçük kart ve büyük pencere aynı çocukları kullanır.
     Ölçek tamamen CSS'ten (viewBox sabit) → noktalar ve pozisyon numaraları
     büyük pencerede orantılı olarak büyür. */
  const svgKids = (<>
    {/* dış halka — araç çapı kalınlığında yol bandı (ıslak/FCY renklenir) + merkez çizgisi */}
    <circle cx={cx} cy={cy} r={R} fill="none" stroke={roadStroke} strokeWidth={ROAD_W} />
    {/* lokal sarı sektör yay(lar)ı — yol bandının üstünde */}
    {yellowArcs}
    <circle cx={cx} cy={cy} r={R} fill="none" stroke="var(--muted)"
      strokeWidth={1.5} opacity={0.35} />
    {/* S/F işareti (tepe) — kalın bandı kessin */}
    <line x1={cx} y1={cy - R - 12} x2={cx} y2={cy - R + 12}
      stroke={BRAND} strokeWidth={2.5} />
    <text x={cx} y={cy - R - 17} fill={BRAND} fontSize="11" fontWeight="700"
      textAnchor="middle">S/F</text>
    {/* sektör ayırıcıları (S1, S2) — gözlendiyse */}
    {sectorMarks}
    {/* pit giriş/çıkış işaretleri (gözlendiyse) + hareket yönü oku */}
    {pitMarks}
    {dirArrow}
    {/* iç pist şekli — kalın yol bandı + ince merkez çizgisi (araç bandın içine oturur) */}
    {outline && <path d={outline} fill="none" stroke={roadStroke}
      strokeWidth={ROAD_W} strokeLinejoin="round" strokeLinecap="round" />}
    {outline && <path d={outline} fill="none" stroke="var(--muted)"
      strokeWidth={1.5} strokeLinejoin="round" opacity={0.35} />}
    {/* araçlar — dış halka */}
    {cars.map((c) => { const [x, y] = ringXY(c.lapDist); return dot(c, x, y, 9, classPos.get(c), "r"); })}
    {/* araçlar — iç şekil */}
    {toScreen && cars.map((c) => {
      const [x, y] = toScreen(c.posX, c.posZ);
      return dot(c, x, y, 8, classPos.get(c), "i");
    })}
  </>);

  return (<>
    <div className="card" data-tour="livemap" style={{ marginBottom: 12 }}>
      {/* en üstte gömülü içerik (strateji şeridi) — ayrı kart yerine harita kutusunda.
          Modal açıkken kart gövdesi (topSlot + svg) RENDER EDİLMEZ: modal kartı
          zaten örtüyor; eskiden iki SVG ağacı + iki StrategyBar her canlı karede
          birlikte güncelleniyordu (çift maliyet). */}
      {!zoom && topSlot}
      <h2 style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <Icon name="harita" size={16} /> {t("Pist Haritası")}
        <span className="hint" style={{ margin: 0, fontWeight: 400 }}>{count}</span>
        <button className="act" style={{ marginLeft: "auto", fontSize: 11, padding: "3px 10px" }}
          title={t("Haritayı tam ekranda aç")}
          onClick={() => setZoom(true)}><Icon name="buyut" size={12} /> {t("Büyüt")}</button>
        <button className="act" style={{ fontSize: 11, padding: "3px 10px" }}
          title={t("Haritayı ayrı pencerede aç")}
          onClick={openWin}>⧉ {t("Pencere")}</button>
      </h2>
      {!zoom && (
        <div style={{ display: "flex", justifyContent: "center", position: "relative" }}>
          {conditionBadge}
          <svg ref={svgRef} viewBox="0 0 520 520" width="100%" style={{ maxWidth: 460 }}
            role="img" aria-label={t("Canlı pist haritası")}>{svgKids}</svg>
        </div>
      )}
    </div>

    {zoom && createPortal(
      /* .rc sarmalayıcı ŞART: .wxmodal/.wxmbox stilleri `.rc ...` altında scope'lu;
         body'e doğrudan portallandığında .rc atası olmadan stilsiz kalıp "kayboluyordu". */
      <div className="rc" style={{ display: "contents" }}><div className="wxmodal" onClick={() => setZoom(false)} role="dialog" aria-modal="true">
        <div className="wxmbox map" onClick={(e) => e.stopPropagation()}>
          <div className="wxmhead">
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Icon name="harita" size={16} /> {t("Pist Haritası")}
              <span style={{ fontSize: 12, color: "var(--dim)", textTransform: "none",
                letterSpacing: 0 }}>· {count}</span>
            </span>
            <button className="act" style={{ fontSize: 12, padding: "2px 10px" }}
              title={t("Kapat")} onClick={() => setZoom(false)}>✕</button>
          </div>
          {/* Büyük Pano zenginleştirme (v1.4.96): strateji + durum paneli + lejant —
              küçük kartta strateji topSlot'ta, burada da gösterilir; pit duvarı panosu. */}
          {topSlot && <div className="mapbig-strat">{topSlot}</div>}
          <div className="mapwrap">
            {conditionBadge}
            <svg viewBox="0 0 520 520" role="img" aria-label={t("Canlı pist haritası")}>
              {svgKids}</svg>
          </div>
          {legend}
        </div>
      </div></div>,
      document.body
    )}
  </>);
}
