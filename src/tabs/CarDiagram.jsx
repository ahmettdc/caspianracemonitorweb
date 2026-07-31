/* Top-down araç şeması — OwnCar için görsel lastik & hasar özeti.
   Veri-güdümlü SVG: 4 lastik kalan-diş %'sine göre renklenir (yeşil→sarı→kırmızı),
   compound rengi lastik kenarlığı olur, gövde tonu hasara göre kızarır. Her köşede
   kalan-diş % / sıcaklık° / basınç kPa etiketi. Yeni sim verisi gerektirmez —
   own.tyres/own.damage/own.tyreCompound'dan gelir. */

/* kalan diş oranı (0..1) → renk (LiveTab wearColor ile aynı eşik) */
const wcol = (w) => (w == null ? "var(--muted)"
  : w < 0.4 ? "var(--red)" : w < 0.7 ? "var(--yellow)" : "var(--green)");

/* compound adı → kenarlık rengi (LiveTab compoundColor ile hizalı) */
const ccol = (n) => {
  const s = String(n || "").toLowerCase();
  if (/soft|yumu|kırmız|\bred\b/.test(s)) return "var(--red)";
  if (/medium|orta/.test(s)) return "var(--yellow)";
  if (/hard|sert/.test(s)) return "#E4E4EA";
  if (/inter/.test(s)) return "var(--green)";
  if (/wet|yağ|rain|ıslak/.test(s)) return "#4D9FFF";
  return "var(--line2)";
};

export default function CarDiagram({ t, tyres, damage, compound }) {
  const ty = tyres || {};
  const tc = compound || {};
  const dmg = damage || 0;
  // gövde hasar tonu: hasar arttıkça kırmızı overlay opaklığı
  const dmgOp = Math.min(0.6, dmg * 3);

  // köşe: [anahtar, compound tarafı(ön/arka), lastik x,y, etiket x, hizalama]
  const TW = 26, TH = 46;   // lastik boyutu
  const corners = [
    { k: "fl", side: "front", tx: 40, ty: 48, lx: 34, anchor: "end" },
    { k: "fr", side: "front", tx: 168, ty: 48, lx: 200, anchor: "start" },
    { k: "rl", side: "rear", tx: 40, ty: 170, lx: 34, anchor: "end" },
    { k: "rr", side: "rear", tx: 168, ty: 170, lx: 200, anchor: "start" },
  ];

  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <svg viewBox="-34 0 302 264" width="100%" style={{ maxWidth: 340 }}
        role="img" aria-label={t("Araç lastik ve hasar şeması")}>
        <defs>
          <linearGradient id="cdbody" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#241820" />
            <stop offset="1" stopColor="#160F14" />
          </linearGradient>
        </defs>
        {/* gövde silueti (yukarı bakan) */}
        <path d="M117 20 C150 20 156 44 156 72 L156 196 C156 228 146 244 117 244
          C88 244 78 228 78 196 L78 72 C78 44 84 20 117 20 Z"
          fill="url(#cdbody)" stroke="var(--line2)" strokeWidth="2" />
        {/* hasar tonu */}
        {dmgOp > 0.02 && (
          <path d="M117 20 C150 20 156 44 156 72 L156 196 C156 228 146 244 117 244
            C88 244 78 228 78 196 L78 72 C78 44 84 20 117 20 Z"
            fill="var(--red)" opacity={dmgOp} />
        )}
        {/* kokpit */}
        <ellipse cx="117" cy="120" rx="20" ry="34" fill="#0E0A0C" opacity="0.7" />
        {/* lastikler + etiketler */}
        {corners.map(({ k, side, tx, ty: tyy, lx, anchor }) => {
          const c = ty[k] || {};
          const w = c.wear;                 // 0..1 kalan diş
          const wpct = w != null ? Math.round(w * 100) : null;
          const fill = wcol(w);
          const border = ccol(tc[side]);
          return (
            <g key={k}>
              <rect x={tx} y={tyy} width={TW} height={TH} rx="7"
                fill={fill} stroke={border} strokeWidth="3" opacity="0.95" />
              <text x={tx + TW / 2} y={tyy + TH / 2} fill="#0B0708" fontSize="13"
                fontWeight="800" textAnchor="middle" dominantBaseline="central">
                {wpct != null ? wpct : "—"}</text>
              <text x={lx} y={tyy + 16} fill="var(--txt)" fontSize="12" fontWeight="700"
                textAnchor={anchor} fontFamily="'IBM Plex Mono',monospace">
                {c.tempC != null ? `${Math.round(c.tempC)}°` : "—"}</text>
              <text x={lx} y={tyy + 32} fill="var(--dim)" fontSize="10"
                textAnchor={anchor} fontFamily="'IBM Plex Mono',monospace">
                {c.pressKpa != null ? `${Math.round(c.pressKpa)} kPa` : ""}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
