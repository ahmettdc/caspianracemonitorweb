/* ============================================================
   useMiniPlayer — yüzen mini yayın oynatıcısının konum/boyut durumu
   ------------------------------------------------------------
   App.jsx'ten çıkarıldı (Tanrı-bileşen borcunu azaltan güvenli dilim; Firebase yok,
   tümüyle yerel). Köşe (br/bl/tr/tl) ve genişlik localStorage'da saklanır; genişlik
   tutamaçtan pointer ile sürüklenerek ayarlanır (yükseklik 16:9'dan gelir).

   Dönüş: { streamCorner, streamMin, setStreamMin, streamW, streamDrag,
            startResize, moveStream }. Davranış birebir korunur. */
import { useState, useRef } from "react";

export function useMiniPlayer() {
  const [streamCorner, setStreamCorner] = useState(() => {
    try { return localStorage.getItem("rm_stream_corner") || "br"; } catch { return "br"; }
  });                                                 // br | bl | tr | tl
  const [streamMin, setStreamMin] = useState(false);  // tek satıra küçült
  const [streamW, setStreamW] = useState(() => {
    try { return Math.min(1080, Math.max(240,
      +(localStorage.getItem("rm_stream_w") || 320))); } catch { return 320; }
  });
  const [streamDrag, setStreamDrag] = useState(false);
  const dragRef = useRef(null);   // { startX, startW, dir }

  /* tutamaçtan sürükleyerek boyutlandır — yükseklik 16:9'dan kendiliğinden gelir */
  const startResize = (e) => {
    e.preventDefault();
    const dir = streamCorner === "br" || streamCorner === "tr" ? -1 : 1;
    dragRef.current = { startX: e.clientX, startW: streamW, dir };
    setStreamDrag(true);
    const move = (ev) => {
      const d = dragRef.current; if (!d) return;
      const w = d.startW + (ev.clientX - d.startX) * d.dir;
      setStreamW(Math.min(Math.min(1080, window.innerWidth - 32), Math.max(240, w)));
    };
    const upFn = () => {
      dragRef.current = null;
      setStreamDrag(false);
      setStreamW((w) => {
        try { localStorage.setItem("rm_stream_w", String(Math.round(w))); }
        catch { /* yoksay */ }
        return w;
      });
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", upFn);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", upFn);
  };
  const moveStream = (c) => {
    setStreamCorner(c);
    try { localStorage.setItem("rm_stream_corner", c); } catch { /* yoksay */ }
  };

  return { streamCorner, streamMin, setStreamMin, streamW, streamDrag, startResize, moveStream };
}
