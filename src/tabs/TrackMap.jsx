import { useEffect, useRef, useState } from "react";
import { classId, classAccent } from "../constants";
import { packBins, unpackBins } from "../trackShape";
import { liveTrackSave, liveTrackSubscribe } from "../storage";

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
const cx = 260, cy = 262;       // merkez
const R = 236;                  // dış halka yarıçapı
const PAD = 148;                // iç şekil yarım-uzanımı (px)

export default function TrackMap({ t, field, trackLength, tid, trackKey, canSave }) {
  const [zoom, setZoom] = useState(false);   // ⛶ büyük pencere
  const [, bump] = useState(0);              // paylaşımlı şekil gelince yeniden çiz
  useEffect(() => {
    if (!zoom) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setZoom(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [zoom]);
  /* pist DEĞİŞİNCE biriktirmeyi sıfırla — anahtar artık trackKey (pist adı) → şekil
     pist başına paylaşımlı olduğundan aynı pistin yarışları arasında da korunur. */
  const acc = useRef({ key: null, bins: {}, saved: 0 });
  if (acc.current.key !== trackKey) acc.current = { key: trackKey, bins: {}, saved: 0 };

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
      const onTrack = c.location ? c.location === "TRACK" : !c.inPits;
      if (!onTrack) continue;
      const b = ((Math.floor((c.lapDist / trackLength) * NB) % NB) + NB) % NB;
      if (!acc.current.bins[b]) acc.current.bins[b] = { x: c.posX, z: c.posZ };
    }
  }

  const bins = acc.current.bins;
  const idx = Object.keys(bins).map(Number).sort((a, b) => a - b);
  const pts = idx.map((i) => bins[i]);
  const binCount = idx.length;

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

  // iç şekil dönüşümü (dünya x/z → ekran), pist bbox'una göre ölçekli
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
  const count = building ? t("iç harita oluşturuluyor…") : `${idx.length}/${NB}`;

  /* SVG içeriği tek yerde — küçük kart ve büyük pencere aynı çocukları kullanır.
     Ölçek tamamen CSS'ten (viewBox sabit) → noktalar ve pozisyon numaraları
     büyük pencerede orantılı olarak büyür. */
  const svgKids = (<>
    {/* dış halka */}
    <circle cx={cx} cy={cy} r={R} fill="none" stroke="var(--line)" strokeWidth={1.5} />
    {/* S/F işareti (tepe) */}
    <line x1={cx} y1={cy - R - 8} x2={cx} y2={cy - R + 8}
      stroke={BRAND} strokeWidth={2.5} />
    <text x={cx} y={cy - R - 13} fill={BRAND} fontSize="11" fontWeight="700"
      textAnchor="middle">S/F</text>
    {/* iç pist şekli */}
    {outline && <path d={outline} fill="none" stroke="var(--line)"
      strokeWidth={11} strokeLinejoin="round" strokeLinecap="round" opacity={0.55} />}
    {outline && <path d={outline} fill="none" stroke="var(--muted)"
      strokeWidth={2} strokeLinejoin="round" opacity={0.9} />}
    {/* araçlar — dış halka */}
    {cars.map((c) => { const [x, y] = ringXY(c.lapDist); return dot(c, x, y, 9, classPos.get(c), "r"); })}
    {/* araçlar — iç şekil */}
    {toScreen && cars.map((c) => {
      const [x, y] = toScreen(c.posX, c.posZ);
      return dot(c, x, y, 8, classPos.get(c), "i");
    })}
  </>);

  const legend = t("Dış halka: pist üzerindeki konum (S/F tepede) · iç şekil: gerçek devre. Renk = sınıf; beyaz halka = sen, beyaz kenar = pit.");

  return (<>
    <div className="card" style={{ marginBottom: 12 }}>
      <h2 style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        🗺 {t("Pist Haritası")}
        <span className="hint" style={{ margin: 0, fontWeight: 400 }}>{count}</span>
        <button className="act" style={{ marginLeft: "auto", fontSize: 11, padding: "3px 10px" }}
          title={t("Haritayı büyük pencerede aç")}
          onClick={() => setZoom(true)}>⛶ {t("Büyüt")}</button>
      </h2>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <svg viewBox="0 0 520 520" width="100%" style={{ maxWidth: 460 }}
          role="img" aria-label={t("Canlı pist haritası")}>{svgKids}</svg>
      </div>
      <div className="hint">{legend}</div>
    </div>

    {zoom && (
      <div className="wxmodal" onClick={() => setZoom(false)} role="dialog" aria-modal="true">
        <div className="wxmbox map" onClick={(e) => e.stopPropagation()}>
          <div className="wxmhead">
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              🗺 {t("Pist Haritası")}
              <span style={{ fontSize: 12, color: "var(--dim)", textTransform: "none",
                letterSpacing: 0 }}>· {count}</span>
            </span>
            <button className="act" style={{ fontSize: 12, padding: "2px 10px" }}
              title={t("Kapat")} onClick={() => setZoom(false)}>✕</button>
          </div>
          <div className="mapwrap">
            <svg viewBox="0 0 520 520" role="img" aria-label={t("Canlı pist haritası")}>
              {svgKids}</svg>
          </div>
          <div className="hint" style={{ padding: "0 14px 12px", marginTop: 0 }}>{legend}</div>
        </div>
      </div>
    )}
  </>);
}
