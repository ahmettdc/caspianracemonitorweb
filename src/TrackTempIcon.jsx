/* ============================================================
   TrackTempIcon — pist (asfalt) sıcaklığı ikonu
   ------------------------------------------------------------
   WetIcon / GripIcon deseninde inline SVG (24×24) termometre. Cıva ALTTAN
   sıcaklığa göre dolar (seviye göstergesi) ve ısıya göre RENKLENİR
   (soğuk=mavi → ılık=amber → sıcak=kırmızı). Emoji (🛣) yerine tema-uyumlu,
   her boyutta net, ağdan yüklenmez (Tauri çevrimdışı da çalışır).
   Canlı '+' tur geçmişi pist-koşulu satırı ve pist haritası kondisyon barında
   WetIcon/grip renginin yanında tutarlı görünmesi için kullanılır.
   ============================================================ */
import { useId } from "react";

/* Pist sıcaklığı (°C) → renk. Eşikler yarış asfaltına göre: <25 soğuk mavi ·
   <40 ılık amber · ≥40 sıcak kırmızı. Geçersizde nötr. Saf → test edilebilir. */
export function tempColor(t) {
  if (t == null || t === "") return "#8a8a92";        // Number(null)===0 tuzağı
  const v = Number(t);
  if (!Number.isFinite(v)) return "#8a8a92";
  if (v < 25) return "#4C9AFF";
  if (v < 40) return "#EAB24A";
  return "#E0556A";
}

export function TrackTempIcon({ temp, size = 16, title }) {
  const cid = "tt" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const col = tempColor(temp);
  /* cıva seviyesi: 10–55 °C aralığını 0–1'e eşle; haznede daima biraz cıva kalır. */
  const v = Number(temp);
  const frac = Number.isFinite(v) ? Math.max(0, Math.min(1, (v - 10) / 45)) : 0;
  const fillTop = 15.8 - 11.8 * frac;                 // dolgu üst kenarı (frac 0→15.8, 1→4)
  const NEUTRAL = "#8a8a92";                          // gövde/tik nötr (iki temada da okunur)
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      style={{ verticalAlign: "-0.15em", flexShrink: 0 }} role="img"
      aria-label={title || undefined} aria-hidden={title ? undefined : "true"}>
      {title && <title>{title}</title>}
      {/* cıva kolonu = gövde iç kanalı ∪ hazne; ısı rengiyle alttan dolar */}
      <defs>
        <clipPath id={cid}>
          <rect x="10.8" y="4" width="2.4" height="13" rx="1.2" />
          <circle cx="12" cy="18.6" r="2.7" />
        </clipPath>
      </defs>
      <rect x="9" y={fillTop} width="6" height={23 - fillTop} fill={col}
        clipPath={`url(#${cid})`} />
      {/* termometre gövdesi (kapsül sap + hazne) + tik çizgileri — nötr çizgi */}
      <path d="M12 3.2a2.9 2.9 0 0 1 2.9 2.9v8.7a4.6 4.6 0 1 1-5.8 0V6.1A2.9 2.9 0 0 1 12 3.2Z"
        fill="none" stroke={NEUTRAL} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M15.4 7.4h1.7M15.4 10h1.7M15.4 12.6h1.7" stroke={NEUTRAL}
        strokeWidth="1.1" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}
