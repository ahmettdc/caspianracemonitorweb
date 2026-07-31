import { ASSET, AV } from "../constants";

/* Top-down araç şeması — OwnCar için görsel lastik & hasar özeti.
   Ortada GERÇEK araç top-down görseli (assets/cartop/<key>.png; yoksa default.png),
   çevresinde 4 lastik kalan-diş %'sine göre renklenir (yeşil→sarı→kırmızı), compound
   rengi lastik kenarlığı olur. Hasar, araç silueti içine kırmızı ton olarak bindirilir.
   Görsel yüklenemezse (dosya yoksa) şematik gövdeye düşer — hiçbir şey bozulmaz.
   Yeni sim verisi gerektirmez — own.tyres/own.damage/own.tyreCompound'dan gelir. */

const DEFAULT_TOP = `${ASSET}cartop/default.png${AV}`;
/* araç gövdesi silueti — görsel yoksa yedek çizim + hasar tonu için clip */
const BODY = "M117 20 C150 20 156 44 156 72 L156 196 C156 228 146 244 117 244 "
  + "C88 244 78 228 78 196 L78 72 C78 44 84 20 117 20 Z";

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

export default function CarDiagram({ t, tyres, damage, compound, src }) {
  const img = src || DEFAULT_TOP;
  const ty = tyres || {};
  const tc = compound || {};
  const dmg = damage || 0;
  const dmgOp = Math.min(0.55, dmg * 3);   // hasar → kırmızı ton opaklığı

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
          <clipPath id="cdclip"><path d={BODY} /></clipPath>
        </defs>
        {/* şematik gövde (arka plan / yedek) — görsel yoksa bu görünür */}
        <path d={BODY} fill="url(#cdbody)" />
        <ellipse cx="117" cy="120" rx="20" ry="34" fill="#0E0A0C" opacity="0.6" />
        {/* ortada gerçek araç top-down görseli (üstte) */}
        <image href={img} x={64} y={10} width={106} height={244}
          preserveAspectRatio="xMidYMid meet" />
        {/* hasar tonu — araç silueti içine kırpılı kırmızı */}
        {dmgOp > 0.02 && (
          <rect x="78" y="20" width="78" height="224" fill="var(--red)"
            opacity={dmgOp} clipPath="url(#cdclip)" />
        )}
        {/* lastikler + etiketler */}
        {corners.map(({ k, side, tx, ty: tyy, lx, anchor }) => {
          const c = ty[k] || {};
          const w = c.wear;
          const wpct = w != null ? Math.round(w * 100) : null;
          return (
            <g key={k}>
              <rect x={tx} y={tyy} width={TW} height={TH} rx="7"
                fill={wcol(w)} stroke={ccol(tc[side])} strokeWidth="3" opacity="0.95" />
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
