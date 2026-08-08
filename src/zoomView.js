/* ============================================================
   zoomView — pist haritası (SVG viewBox) + kanal (mesafe ekseni) yakınlaştırma
   ------------------------------------------------------------
   Saf matematik (React'siz, test edilebilir). TeleTab.jsx Tur Karşılaştırma
   kartındaki fare-tekerleği zoom/pan mantığı buradan gelir → tek kaynak, birim testli.
   ============================================================ */

/* Harita viewBox'ını fit kutusuna klampla: yakınlaşma [S/MAX, S] arası; pan fit dışına taşmaz. */
export function clampView(view, S, maxZoom = 10) {
  const min = S / maxZoom;
  const vw = Math.min(S, Math.max(min, view.vw));
  const vh = Math.min(S, Math.max(min, view.vh));
  const vx = Math.min(Math.max(0, view.vx), S - vw);
  const vy = Math.min(Math.max(0, view.vy), S - vh);
  return { vx, vy, vw, vh };
}

/* (ax,ay) SVG noktası SABİT kalacak şekilde k çarpanıyla yakınlaştır. k<1 yakınlaş, k>1 uzaklaş. */
export function zoomViewAt(view, ax, ay, k, S, maxZoom = 10) {
  const min = S / maxZoom;
  const vw = Math.min(S, Math.max(min, view.vw * k));
  const vh = Math.min(S, Math.max(min, view.vh * k));
  /* anchor'ın viewBox içindeki oranını koru → recenter */
  const rx = view.vw ? (ax - view.vx) / view.vw : 0.5;
  const ry = view.vh ? (ay - view.vy) / view.vh : 0.5;
  return clampView({ vx: ax - rx * vw, vy: ay - ry * vh, vw, vh }, S, maxZoom);
}

/* Haritayı SVG-birimi kadar kaydır (pan) + klampla. */
export function panView(view, dxUnits, dyUnits, S, maxZoom = 10) {
  return clampView({ ...view, vx: view.vx + dxUnits, vy: view.vy + dyUnits }, S, maxZoom);
}

/* Oynatma: kesirli imleç index'ini bir tick kadar ilerlet. Tam tur (N nokta) tur A süresi
   (lapSec) boyunca / speed hızıyla oynar → gerçek-zamana yakın. Sona gelince başa sarar (döngü). */
export function advanceCursor(cur, N, lapSec, speed, tickMs) {
  if (!(N > 1)) return 0;
  const dur = (lapSec > 0 ? lapSec : 8) / (speed > 0 ? speed : 1);   // tam tur saniyesi
  const perMs = (N - 1) / (dur * 1000);
  let next = (Number.isFinite(cur) ? cur : 0) + tickMs * perMs;
  if (next >= N - 1) next = 0;   // döngü
  return next;
}

/* Kanal mesafe penceresi [lo,hi]'yi anchor etrafında k ile daralt/genişlet, veri aralığına klampla.
   Tam aralığa (ya da daha genişe) ulaşırsa null döner (= "tam genişlik" → domain sıfırla). */
export function zoomDomain(win, anchor, k, dataRange, minSpanRatio = 0.02) {
  const [dLo, dHi] = dataRange;
  const full = dHi - dLo;
  if (!(full > 0)) return null;
  const [lo, hi] = win || [dLo, dHi];
  let span = (hi - lo) * k;
  const minSpan = full * minSpanRatio;
  if (span >= full) return null;          // tam genişliğe döndü
  if (span < minSpan) span = minSpan;
  const a = Math.min(Math.max(anchor, dLo), dHi);
  const r = (hi - lo) > 0 ? (a - lo) / (hi - lo) : 0.5;   // anchor'ın pencere içindeki oranı
  let nLo = a - r * span;
  let nHi = nLo + span;
  if (nLo < dLo) { nLo = dLo; nHi = dLo + span; }
  if (nHi > dHi) { nHi = dHi; nLo = dHi - span; }
  return [nLo, nHi];
}
