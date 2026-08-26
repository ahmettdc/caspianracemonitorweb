/* ============================================================
   İkon seti — 68 parçalık çizgi-SVG (handoff: ikon-paketi/IKON-FISI.md).
   Emoji/dingbat yerine tema-uyumlu vektör. viewBox 24×24, fill:none,
   stroke:currentColor (renk daima üst elemandan miras). stroke-width
   BOYA göre: <12px 1.9 · 12–22px 1.7 · >22px 1.6 (optik ağırlık sabit).
   Path'ler fişten BİREBİR — değiştirme. İki özel durum: `canli` merkez
   noktası fill="currentColor" stroke="none"; `lastik` sırt bandı kalın
   (stroke-width 3.4) çember. currentColor → renk kapsayıcıdan gelir. */

export const ICONSET = {
  gosterge: <><path d="M3.6 17.2a8.4 8.4 0 1 1 16.8 0" /><path d="M12 17.2 16.3 11.4" /></>,
  stint: <><rect x="3.4" y="9.6" width="17.2" height="4.8" rx="1.6" /><path d="M9.1 9.6v4.8M14.8 9.6v4.8" /></>,
  canli: <><circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" /><path d="M8.5 15.5a5 5 0 0 1 0-7" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M5.6 18.4a9 9 0 0 1 0-12.8" /><path d="M18.4 5.6a9 9 0 0 1 0 12.8" /></>,
  lastik: <><circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth="3.4" fill="none" /><circle cx="12" cy="12" r="2.5" /></>,
  yakit: <><path d="M4.2 20.4V6.2a2 2 0 0 1 2-2h3.2a2 2 0 0 1 2 2v14.2" /><path d="M2.9 20.4h9.8" /><path d="M6.2 9.4h3.2" /><path d="M11.4 12.6h1.3" /><path d="M18.1 4.2 14 13.9h3.7l-.4 6.5 4.1-9.7h-3.7z" /></>,
  kask: <><path d="M20.2 15.6a8.2 8.2 0 1 0-16.4 0" /><path d="M3.8 15.6h16.4" /><path d="M11 15.6v-2.8a2.6 2.6 0 0 1 2.6-2.6h6.2" /></>,
  telemetri: <><path d="M3.8 4.4v15.4h16.4" /><path d="M6.6 15.6 10 9.4l3.2 4.2 2.4-6.4 2.8 5" /></>,
  setup: <><path d="M4 7.6h4M12.2 7.6h7.8M4 16.4h9.4M17.6 16.4h2.4" /><circle cx="10.1" cy="7.6" r="2.1" /><circle cx="15.5" cy="16.4" r="2.1" /></>,
  takim: <><path d="M14.8 19.6v-1.7a3.8 3.8 0 0 0-3.8-3.8H6.6a3.8 3.8 0 0 0-3.8 3.8v1.7" /><circle cx="8.8" cy="7.7" r="3.4" /><path d="M21.2 19.6v-1.7a3.8 3.8 0 0 0-2.9-3.7" /><path d="M15.6 4.7a3.8 3.8 0 0 1 0 6.9" /></>,
  sohbet: <><path d="M20.4 12.4a7.4 7.4 0 0 1-7.4 7.4 7.4 7.4 0 0 1-3.3-.8L4.4 20.6l1.6-5.3a7.4 7.4 0 0 1-.8-3.3 7.4 7.4 0 0 1 7.4-7.4h.4a7.4 7.4 0 0 1 7 7z" /></>,
  takvim: <><rect x="3.6" y="5.4" width="16.8" height="15" rx="2.2" /><path d="M8.4 3v4.8M15.6 3v4.8M3.6 10.6h16.8" /></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  ara: <><circle cx="10.8" cy="10.8" r="6.6" /><path d="M15.6 15.6 20.6 20.6" /></>,
  rehber: <><path d="M2.6 8.6 12 4.4l9.4 4.2L12 12.8z" /><path d="M6.4 10.3v5.1c0 1.9 2.5 3.4 5.6 3.4s5.6-1.5 5.6-3.4v-5.1" /><path d="M21.4 8.6v5.4" /></>,
  kalkan: <><path d="M12 3 4.5 6v5.4c0 4.2 3 8 7.5 9.6 4.5-1.6 7.5-5.4 7.5-9.6V6L12 3Z" /><path d="M9.2 12.1l2 2 3.6-4" /></>,
  bilgi: <><circle cx="12" cy="12" r="8.4" /><path d="M12 11.2v5.2" /><path d="M12 7.6v.9" /></>,
  zil: <><path d="M18.2 9.6a6.2 6.2 0 1 0-12.4 0c0 5-2.1 6.4-2.1 6.4h16.6s-2.1-1.4-2.1-6.4z" /><path d="M13.9 19.4a2.2 2.2 0 0 1-3.8 0" /></>,
  "zil-kapali": <><path d="M8.1 5.1a6.2 6.2 0 0 1 10.1 4.5c0 5 2.1 6.4 2.1 6.4H7.4" /><path d="M5.9 8.4a6.2 6.2 0 0 0-.1 1.2c0 5-2.1 6.4-2.1 6.4" /><path d="M13.9 19.4a2.2 2.2 0 0 1-3.8 0" /><path d="M3.4 3.4 20.6 20.6" /></>,
  "pit-tabela": <><path d="M7.4 5.6h9.2a2 2 0 0 1 2 2v8.8a2 2 0 0 1-2 2H7.4a2 2 0 0 1-2-2V7.6a2 2 0 0 1 2-2z" /><path d="M9.4 9.4h5.2M9.4 12.8h3.4" /><path d="M12 18.4v2.2" /></>,
  ekle: <><path d="M12 4.8v14.4M4.8 12h14.4" /></>,
  duzenle: <><path d="M16.4 3.6a2.3 2.3 0 0 1 3.3 3.3L8.2 18.4l-4.4 1.1 1.1-4.4z" /><path d="M14.6 5.4l4 4" /></>,
  sil: <><path d="M3.8 6.8h16.4" /><path d="M9.6 6.8V4.6a1.2 1.2 0 0 1 1.2-1.2h2.4a1.2 1.2 0 0 1 1.2 1.2v2.2" /><path d="M5.8 6.8l1 12.2a1.8 1.8 0 0 0 1.8 1.6h6.8a1.8 1.8 0 0 0 1.8-1.6l1-12.2" /><path d="M10.2 11v5.4M13.8 11v5.4" /></>,
  yukle: <><path d="M12 16.4V4.2" /><path d="M7.4 8.8 12 4.2l4.6 4.6" /><path d="M4 16.4v2.4a1.8 1.8 0 0 0 1.8 1.8h12.4a1.8 1.8 0 0 0 1.8-1.8v-2.4" /></>,
  indir: <><path d="M12 4.2v12.2" /><path d="M7.4 11.8 12 16.4l4.6-4.6" /><path d="M4 16.4v2.4a1.8 1.8 0 0 0 1.8 1.8h12.4a1.8 1.8 0 0 0 1.8-1.8v-2.4" /></>,
  ayar: <><path d="M10.17 2.58 L13.83 2.58 L13.35 5.03 L15.97 6.11 L17.37 4.04 L19.96 6.63 L17.89 8.03 L18.97 10.65 L21.42 10.17 L21.42 13.83 L18.97 13.35 L17.89 15.97 L19.96 17.37 L17.37 19.96 L15.97 17.89 L13.35 18.97 L13.83 21.42 L10.17 21.42 L10.65 18.97 L8.03 17.89 L6.63 19.96 L4.04 17.37 L6.11 15.97 L5.03 13.35 L2.58 13.83 L2.58 10.17 L5.03 10.65 L6.11 8.03 L4.04 6.63 L6.63 4.04 L8.03 6.11 L10.65 5.03 Z" /><circle cx="12" cy="12" r="3.1" /></>,
  plan: <><rect x="7.4" y="3.4" width="9.2" height="4.2" rx="1.4" /><path d="M16.6 5.4h1.8a1.9 1.9 0 0 1 1.9 1.9v11.4a1.9 1.9 0 0 1-1.9 1.9H5.6a1.9 1.9 0 0 1-1.9-1.9V7.3a1.9 1.9 0 0 1 1.9-1.9h1.8" /><path d="M7.8 11.6h8.4M7.8 15.4h5.4" /></>,
  baglanti: <><path d="M9.6 13.9a4.6 4.6 0 0 0 6.9.5l2.8-2.8a4.6 4.6 0 0 0-6.5-6.5l-1.6 1.6" /><path d="M14.4 10.1a4.6 4.6 0 0 0-6.9-.5L4.7 12.4a4.6 4.6 0 0 0 6.5 6.5l1.6-1.6" /></>,
  yazdir: <><path d="M7 9.4V3.8h10v5.6" /><rect x="3.8" y="9.4" width="16.4" height="7.2" rx="2" /><path d="M7 14.6h10v5.6H7z" /></>,
  klasor: <><path d="M3.6 7.4a2 2 0 0 1 2-2h3.6l2 2.6h7.2a2 2 0 0 1 2 2v8.6a2 2 0 0 1-2 2H5.6a2 2 0 0 1-2-2z" /></>,
  dosya: <><path d="M13.4 3.6H7.2a2 2 0 0 0-2 2v12.8a2 2 0 0 0 2 2h9.6a2 2 0 0 0 2-2V9z" /><path d="M13.4 3.6V9h5.4" /><path d="M8.4 13.4h7.2M8.4 16.6h4.6" /></>,
  anahtar: <><circle cx="8.6" cy="15.4" r="4.4" /><path d="M11.7 12.3 20.4 3.6" /><path d="M16.4 7.6l2.4 2.4M18.6 5.4l2.4 2.4" /></>,
  bayrak: <><path d="M5.4 3.4v17.2" /><path d="M5.4 4.8h13.8v9.2H5.4z" /><path d="M12.3 4.8v9.2M5.4 9.4h13.8" /></>,
  somun: <><path d="M12 3.4l7.4 4.3v8.6L12 20.6 4.6 16.3V7.7z" /><circle cx="12" cy="12" r="3" /></>,
  kronometre: <><circle cx="12" cy="13.6" r="7.4" /><path d="M12 10v3.6l2.4 1.6" /><path d="M9.6 2.8h4.8M12 2.8v3.4" /></>,
  sicaklik: <><path d="M13.9 14.8V5.6a2.4 2.4 0 0 0-4.8 0v9.2a4.2 4.2 0 1 0 4.8 0z" /><path d="M11.5 9.6v6.4" /></>,
  asfalt: <><path d="M8.6 3.6 4.4 20.4M15.4 3.6l4.2 16.8" /><path d="M12 4.4v2.6M12 10.4v2.6M12 16.4v2.6" /></>,
  kuru: <><circle cx="12" cy="12" r="4.2" /><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.9 1.9M16.6 16.6l1.9 1.9M5.5 18.5l1.9-1.9M16.6 7.4l1.9-1.9" /></>,
  islak: <><path d="M17.2 15.4a4.2 4.2 0 0 0-.9-8.3 6 6 0 0 0-11.3 2.5 3.9 3.9 0 0 0 .8 7.7" /><path d="M8.4 18.8l-1 2.4M12 18.8l-1 2.4M15.6 18.8l-1 2.4" /></>,
  harita: <><path d="M9.2 3.6 3.6 5.9v14.5l5.6-2.3 5.6 2.3 5.6-2.3V3.6l-5.6 2.3z" /><path d="M9.2 3.6v14.5M14.8 5.9v14.5" /></>,
  arac: <><path d="M3.4 14.6h17.2" /><path d="M5.4 14.6l1.9-5.4a2 2 0 0 1 1.9-1.4h5.6a2 2 0 0 1 1.9 1.4l1.9 5.4" /><path d="M4.6 14.6v3h1.8v-3M17.6 14.6v3h1.8v-3" /><circle cx="7.8" cy="14.6" r="1.6" /><circle cx="16.2" cy="14.6" r="1.6" /></>,
  goz: <><path d="M2.6 12a11 11 0 0 1 18.8 0 11 11 0 0 1-18.8 0z" /><circle cx="12" cy="12" r="3.2" /></>,
  kopru: <><path d="M2.4 10.2h19.2" /><path d="M5.6 10.2V8.3M12 10.2V8.3M18.4 10.2V8.3" /><path d="M2.9 18.6v-4a4.55 4.55 0 0 1 9.1 0v4" /><path d="M12 18.6v-4a4.55 4.55 0 0 1 9.1 0v4" /><path d="M1.6 18.6h20.8" /></>,
  kayit: <><rect x="3.4" y="6.6" width="17.2" height="10.8" rx="2.2" /><circle cx="8.4" cy="12" r="2.4" /><circle cx="15.6" cy="12" r="2.4" /><path d="M10.8 12h2.4" /></>,
  aero: <><path d="M3.6 10.2h16.8" /><path d="M6.2 14.4h11.6" /><path d="M5.4 7.6v5.2M18.6 7.6v5.2" /><path d="M12 14.4v4.2" /></>,
  mekanik: <><path d="M7.6 4.4h8.8M7.6 19.6h8.8" /><path d="M12 4.4v1.6M12 18v1.6" /><path d="M8.4 6 15.6 8.4 8.4 10.8 15.6 13.2 8.4 15.6 15.6 18" /></>,
  geometri: <><path d="M4.4 19.6h15.6" /><path d="M4.4 19.6 18.2 5.8" /><path d="M11.6 19.6a7.2 7.2 0 0 0-2.1-5.1" /></>,
  fren: <><circle cx="10.4" cy="12" r="7.4" /><circle cx="10.4" cy="12" r="2.6" /><path d="M16.6 8.2h2.9a1.4 1.4 0 0 1 1.4 1.4v4.8a1.4 1.4 0 0 1-1.4 1.4h-2.9" /></>,
  kontrol: <><path d="M6 4.4v15.2M12 4.4v15.2M18 4.4v15.2" /><path d="M4.2 9.4h3.6M10.2 14.2h3.6M16.2 7.4h3.6" /></>,
  pedal: <><path d="M8.8 3.8h5.6a2 2 0 0 1 2 2v6.8a5.6 5.6 0 0 1-5.6 5.6H8.8z" /><path d="M8.8 3.8v14.4" /><path d="M4.8 20.4h14.4" /></>,
  karsilastir: <><path d="M4 4.6h6.4v14.8H4z" /><path d="M13.6 4.6H20v14.8h-6.4z" /><path d="M10.4 9.6h3.2M12.4 8.4l1.2 1.2-1.2 1.2" /><path d="M13.6 14.4h-3.2M11.6 13.2l-1.2 1.2 1.2 1.2" /></>,
  sektor: <><path d="M12 21.2s7.2-6 7.2-11a7.2 7.2 0 1 0-14.4 0c0 5 7.2 11 7.2 11z" /><circle cx="12" cy="10.2" r="2.6" /></>,
  masaustu: <><rect x="3" y="4.4" width="18" height="11.6" rx="2" /><path d="M8.4 20.4h7.2" /><path d="M12 16v4.4" /></>,
  tuy: <><path d="M20.2 12.2a6 6 0 0 0-8.5-8.5L5 10.4V19h8.5z" /><path d="M16 8 2.8 21.2" /><path d="M17.4 15H9" /></>,
  oto: <><path d="M20.4 12a8.4 8.4 0 1 1-2.5-6" /><path d="M20.4 4.8v5.4h-5.4" /><circle cx="12" cy="12" r="2.4" /></>,
  kanal: <><circle cx="12" cy="12" r="8.6" /><path d="M3.4 12h17.2" /><path d="M12 3.4a13 13 0 0 1 0 17.2 13 13 0 0 1 0-17.2z" /></>,
  kilit: <><rect x="4.6" y="10.6" width="14.8" height="9.8" rx="2.2" /><path d="M8.2 10.6V7.4a3.8 3.8 0 0 1 7.6 0v3.2" /><path d="M12 14.4v2.4" /></>,
  pit: <><rect x="4.4" y="3.6" width="15.2" height="16.8" rx="2.6" /><path d="M9.6 16.6V7.4h3.4a2.7 2.7 0 0 1 0 5.4H9.6" /></>,
  buyut: <><path d="M9.4 3.6H5.2a1.6 1.6 0 0 0-1.6 1.6v4.2" /><path d="M14.6 3.6h4.2a1.6 1.6 0 0 1 1.6 1.6v4.2" /><path d="M20.4 14.6v4.2a1.6 1.6 0 0 1-1.6 1.6h-4.2" /><path d="M3.6 14.6v4.2a1.6 1.6 0 0 0 1.6 1.6h4.2" /></>,
  yakinlastir: <><circle cx="10.6" cy="10.6" r="6.6" /><path d="M15.4 15.4 20.6 20.6" /><path d="M10.6 7.8v5.6M7.8 10.6h5.6" /></>,
  "geri-al": <><path d="M4.2 8.4h9.4a5.4 5.4 0 0 1 0 10.8H6.6" /><path d="M8.4 4.2 4.2 8.4l4.2 4.2" /></>,
  havuz: <><path d="M3.6 7.4 12 3.6l8.4 3.8-8.4 3.8z" /><path d="M3.6 12 12 15.8 20.4 12" /><path d="M3.6 16.4 12 20.2 20.4 16.4" /></>,
  davet: <><rect x="3.4" y="5.6" width="17.2" height="12.8" rx="2.2" /><path d="M3.4 8 12 13.4 20.6 8" /></>,
  oynat: <><path d="M8.4 5.2 18.6 12 8.4 18.8z" /></>,
  duraklat: <><path d="M9.4 5.4v13.2M14.6 5.4v13.2" /></>,
  flama: <><path d="M5.4 20.4V4.2" /><path d="M5.4 5.6h11.4l-1.9 3.6 1.9 3.6H5.4z" /></>,
  simsek: <><path d="M13.4 2.8 4.2 14.2h8.2l-.8 7 8.2-11.4h-8.2z" /></>,
  uyari: <><path d="M10.6 4.4a1.6 1.6 0 0 1 2.8 0l7.8 13.6a1.6 1.6 0 0 1-1.4 2.4H4.2a1.6 1.6 0 0 1-1.4-2.4z" /><path d="M12 9.4v4.8" /><path d="M12 16.9v.9" /></>,
  onay: <><path d="M20.4 12a8.4 8.4 0 1 1-8.4-8.4" /><path d="M8.4 11.6 11.6 14.8 20.6 5.4" /></>,
  /* Set dışı yardımcılar (emoji DEĞİL — fiş §6 kapsamı dışı, tema/yoğunluk/menü
     komut paletinde kullanılır). Aynı çizim diliyle korunur. */
  home: <><path d="M3 10.6 12 3l9 7.6" /><path d="M5.2 9.4V21h13.6V9.4" /></>,
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5Z" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  rows: <path d="M4 6h16M4 12h16M4 18h16" />,
};

/* Tek ikon bileşeni — çıktı DOM'u fişteki path'lerle birebir. */
export function Icon({ name, size = 16, style, title }) {
  const body = ICONSET[name];
  if (!body) return null;
  const sw = size < 12 ? 1.9 : size > 22 ? 1.6 : 1.7;   // boya göre optik ağırlık
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
      style={{ flex: "0 0 auto", ...style }} role={title ? "img" : undefined}
      aria-label={title || undefined} aria-hidden={title ? undefined : "true"}>
      {title && <title>{title}</title>}
      {body}
    </svg>
  );
}
