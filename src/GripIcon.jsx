/* ============================================================
   GripIcon — yol tutuş (rubber/grip) ikonu
   ------------------------------------------------------------
   WetIcon deseninde inline SVG (24×24). Lastik ALTTAN grip %'sine kadar dolar
   (seviye göstergesi); dolgu ve halka grip seviyesine göre RENKLENİR
   (düşük=kırmızı → orta=amber → yüksek=yeşil). Emoji (🛞) yerine tema-uyumlu,
   her boyutta net, ağdan yüklenmez (Tauri çevrimdışı da çalışır).
   Canlı 'Tutuş' KPI'sı ve '+' tur geçmişi pist-koşulu satırında kullanılır.
   ============================================================ */
import { useId } from "react";

/* Grip yüzdesi → renk. Eşikler: <40 az tutuş (yeşil pist) kırmızı · <65 orta amber ·
   ≥65 yüksek (kauçuk oturmuş) yeşil. Geçersizde nötr. Saf → test edilebilir. */
export function gripColor(pct) {
  if (pct == null || pct === "") return "#8a6f4a";   // Number(null)===0 tuzağı
  const p = Number(pct);
  if (!Number.isFinite(p)) return "#8a6f4a";
  if (p < 40) return "#E0556A";
  if (p < 65) return "#EAB24A";
  return "#37D67A";
}

export function GripIcon({ pct, size = 16, title }) {
  const cid = "gc" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const p = Math.max(0, Math.min(100, Number(pct) || 0));
  const col = gripColor(pct);
  const TOP = 2.8, BOT = 21.2;               // lastik iç açıklığı (dikey)
  const top = BOT - ((BOT - TOP) * p) / 100; // dolgu üst kenarı
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      style={{ verticalAlign: "-0.15em", flexShrink: 0 }} role="img"
      aria-label={title || undefined} aria-hidden={title ? undefined : "true"}>
      <defs><clipPath id={cid}><circle cx="12" cy="12" r="9.2" /></clipPath></defs>
      {/* seviye dolgusu (lastik daireye kırpılı) */}
      <rect x="2" y={top} width="20" height={BOT - top} fill={col} opacity="0.9"
        clipPath={`url(#${cid})`} />
      {p > 0 && p < 100 && (
        <path d={`M2.8 ${top}h18.4`} stroke="#F3EAEC" strokeWidth="0.8" opacity="0.5"
          clipPath={`url(#${cid})`} />
      )}
      {/* lastik halkası + göbek — nötr (kauçuk); seviye/renk dolgudan okunur */}
      <circle cx="12" cy="12" r="9.2" fill="none" stroke="#8a6f4a" strokeWidth="2" />
      <circle cx="12" cy="12" r="4" fill="none" stroke="#8a6f4a" strokeWidth="1.6" />
    </svg>
  );
}
