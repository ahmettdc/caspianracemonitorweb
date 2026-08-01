/* ============================================================
   WetIcon — zemin ıslaklığı (track wetness) ikon sistemi
   ------------------------------------------------------------
   Kullanıcının verdiği "Track wetness icon system" (tek mavi hue, 24×24) — 5 kademe
   için inline SVG. WEATHER id'siyle eşlenir: dry / damp / slwet / wet / xwet.
   Emoji yerine tutarlı ikon; hava planlayıcı, canlı 'Zemin ıslaklığı', öneri çipi,
   hava geçmişi, stint ve dashboard'da ortak kullanılır.
   Inline SVG: her boyutta net, ağdan yüklenmez (Tauri çevrimdışı da çalışır). */
import { useId } from "react";

/* damp ikonu clipPath kullanır → aynı sayfada birden çok ikon olduğunda id çakışmasın
   diye örnek başına benzersiz id (React useId, url() için sanitize edilir). */
export function WetIcon({ id, size = 16, title }) {
  const cid = "wc" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const shapes = {
    dry: (
      <>
        <path d="M8.5 21.2h7" stroke="#5b6b7a" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="1.2 2.6" />
        <path d="M12 3.4c0 0-5.1 6.4-5.1 9.6a5.1 5.1 0 0 0 10.2 0c0-3.2-5.1-9.6-5.1-9.6Z" stroke="#6e8496" strokeWidth="1.5" strokeLinejoin="round" />
      </>
    ),
    damp: (
      <>
        <path d="M8 21.2h8" stroke="#3f7fae" strokeWidth="1.6" strokeLinecap="round" />
        <clipPath id={cid}><rect x="4" y="13.6" width="16" height="8" /></clipPath>
        <path d="M12 3.4c0 0-5.1 6.4-5.1 9.6a5.1 5.1 0 0 0 10.2 0c0-3.2-5.1-9.6-5.1-9.6Z" fill="#3f8fc4" clipPath={`url(#${cid})`} />
        <path d="M12 3.4c0 0-5.1 6.4-5.1 9.6a5.1 5.1 0 0 0 10.2 0c0-3.2-5.1-9.6-5.1-9.6Z" stroke="#4d9ed4" strokeWidth="1.5" strokeLinejoin="round" />
      </>
    ),
    slwet: (
      <>
        <ellipse cx="12" cy="21" rx="5.4" ry="1.3" fill="#2f83bd" opacity=".55" />
        <path d="M12 3.4c0 0-5.1 6.4-5.1 9.6a5.1 5.1 0 0 0 10.2 0c0-3.2-5.1-9.6-5.1-9.6Z" fill="#3f9dda" />
      </>
    ),
    wet: (
      <>
        <ellipse cx="12" cy="21" rx="8.6" ry="1.6" fill="#2f8fd4" opacity=".7" />
        <path d="M4.6 18.2c1.3-.9 2.5-.9 3.8 0M15.6 18.2c1.3-.9 2.5-.9 3.8 0" stroke="#3f9dda" strokeWidth="1.2" strokeLinecap="round" opacity=".75" />
        <path d="M13 2.9c0 0-4.7 5.9-4.7 8.9a4.7 4.7 0 0 0 9.4 0c0-3-4.7-8.9-4.7-8.9Z" fill="#4fb0ec" />
        <path d="M5.6 8.6c0 0-2.7 3.4-2.7 5.1a2.7 2.7 0 0 0 5.4 0c0-1.7-2.7-5.1-2.7-5.1Z" fill="#4fb0ec" />
      </>
    ),
    xwet: (
      <>
        <ellipse cx="12" cy="20.8" rx="11" ry="2.1" fill="#2f9ae8" opacity=".85" />
        <ellipse cx="12" cy="20.4" rx="6.4" ry="1.1" fill="#9fdcff" opacity=".45" />
        <path d="M2.2 17.4c1.3-1.1 2.6-1.1 3.9 0M9.4 16.6c1.3-1.1 2.6-1.1 3.9 0M17.9 17.4c1.3-1.1 2.6-1.1 3.9 0" stroke="#63bdf7" strokeWidth="1.3" strokeLinecap="round" />
        <path d="M13.6 2.4c0 0-4.4 5.5-4.4 8.3a4.4 4.4 0 0 0 8.8 0c0-2.8-4.4-8.3-4.4-8.3Z" fill="#7ccdff" />
        <path d="M5.4 6.5c0 0-3 3.8-3 5.7a3 3 0 0 0 6 0c0-1.9-3-5.7-3-5.7Z" fill="#7ccdff" />
        <path d="M20 8.4c0 0-2.2 2.8-2.2 4.2a2.2 2.2 0 0 0 4.4 0c0-1.4-2.2-4.2-2.2-4.2Z" fill="#7ccdff" />
      </>
    ),
  };
  const body = shapes[id];
  if (!body) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      style={{ verticalAlign: "-0.15em", flexShrink: 0 }} role="img"
      aria-label={title || undefined} aria-hidden={title ? undefined : "true"}>
      {title && <title>{title}</title>}
      {body}
    </svg>
  );
}
