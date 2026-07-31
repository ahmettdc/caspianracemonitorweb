import { useRef } from "react";
import { classId, classAccent } from "../constants";

/* Canlı pist haritası — iki katman:
   • Dış boşluk halkası: her araç tur mesafesine (lapDist/trackLength) göre daire
     üzerinde; S/F tepede. Fiziksel yakınlık = trafik.
   • İç pist şekli: araçların dünya (posX,posZ) konumları lapDist kutularına
     gömülerek gerçek devre çizilir (birkaç saniyede dolar); araçlar üzerine yerleşir.
   Renkler sınıfa göre (classAccent); oyuncu #960018 halkalı beyaz nokta.
   Köprü lapDist/posX/posZ + session.trackLength göndermezse kart gösterilmez. */

const NB = 240;                 // lapDist kutu sayısı (pist şekli çözünürlüğü)
const BRAND = "#960018";        // ana tema
const cx = 260, cy = 262;       // merkez
const R = 236;                  // dış halka yarıçapı
const PAD = 148;                // iç şekil yarım-uzanımı (px)

export default function TrackMap({ t, field, trackLength }) {
  // pist uzunluğu değişince (yeni pist/seans) biriktirmeyi sıfırla
  const acc = useRef({ len: 0, bins: {} });
  if (acc.current.len !== trackLength) acc.current = { len: trackLength, bins: {} };

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

  // daire + içinde sınıf-içi pozisyon (num). renk = sınıf; oyuncu beyaz/#960018.
  const dot = (c, x, y, rBase, num) => {
    const col = classAccent(c.carClass) || "var(--muted)";
    const label = num > 0 ? String(num) : "";
    const fs = num >= 10 ? rBase : rBase + 2;   // 2 haneli biraz küçük
    if (c.isPlayer) {
      return (
        <g key={`p${c.pos}`}>
          <circle cx={x} cy={y} r={rBase + 2} fill="#fff" stroke={BRAND} strokeWidth={2.5} />
          <circle cx={x} cy={y} r={rBase + 6} fill="none" stroke={BRAND}
            strokeWidth={1.4} opacity={0.55} />
          {label && <text x={x} y={y} fill={BRAND} fontSize={fs} fontWeight="800"
            textAnchor="middle" dominantBaseline="central">{label}</text>}
        </g>
      );
    }
    const pit = c.inPits || c.location === "PIT";
    return (
      <g key={c.pos}>
        <circle cx={x} cy={y} r={rBase} fill={col}
          stroke={pit ? "#fff" : "none"} strokeWidth={pit ? 1.6 : 0} opacity={0.97} />
        {label && <text x={x} y={y} fill="#fff" fontSize={fs} fontWeight="700"
          textAnchor="middle" dominantBaseline="central"
          stroke="rgba(0,0,0,.4)" strokeWidth="0.5" paintOrder="stroke">{label}</text>}
      </g>
    );
  };

  const building = pts.length < NB * 0.45;

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <h2 style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        🗺 {t("Pist Haritası")}
        <span className="hint" style={{ margin: 0, fontWeight: 400 }}>
          {building ? t("iç harita oluşturuluyor…") : `${idx.length}/${NB}`}</span>
      </h2>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <svg viewBox="0 0 520 520" width="100%" style={{ maxWidth: 460 }}
          role="img" aria-label={t("Canlı pist haritası")}>
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
          {cars.map((c) => { const [x, y] = ringXY(c.lapDist); return dot(c, x, y, 9, classPos.get(c)); })}
          {/* araçlar — iç şekil */}
          {toScreen && cars.map((c) => {
            const [x, y] = toScreen(c.posX, c.posZ);
            return dot({ ...c, pos: `i${c.pos}` }, x, y, 8, classPos.get(c));
          })}
        </svg>
      </div>
      <div className="hint">
        {t("Dış halka: pist üzerindeki konum (S/F tepede) · iç şekil: gerçek devre. Renk = sınıf; beyaz halka = sen, beyaz kenar = pit.")}
      </div>
    </div>
  );
}
