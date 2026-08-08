import { useState, useRef, useEffect, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ReferenceLine, ReferenceDot, ResponsiveContainer } from "recharts";
import { fmtLap } from "../engine";
import { SLOT_COLORS } from "../constants";
import { Tyre, BoxPlot } from "../components";
import { zoomViewAt, panView, zoomDomain, advanceCursor } from "../zoomView";
import { sectorOf, sectorMarks } from "../ldTrace";
import { detectApexes, cornerStats } from "../corners";

/* İz karşılaştırma renkleri (A/B tur) */
const CA = "#ff5470", CB = "#4d9fff";

/* Tek kanal iz satırı — recharts syncId ile hepsi ortak imleç + ortak mesafe ekseni. */
function TraceRow({ data, title, unit, keys, colors, fmt, height = 132, zero, dashB, onCursor, onAnchor, xDomain, bounds, cursorD, dots }) {
  const onMove = (onCursor || onAnchor) ? (s) => {
    if (onCursor) onCursor(s && s.activeTooltipIndex != null ? s.activeTooltipIndex : null);
    if (onAnchor && s && s.activeLabel != null) onAnchor(s.activeLabel);
  } : undefined;
  return (
    <div style={{ marginTop: 8 }}>
      <div className="hint" style={{ margin: "0 0 2px", fontWeight: 600 }}>{title}</div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} syncId="tele" margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
            onMouseMove={onMove}
            onMouseLeave={onCursor ? () => onCursor(null) : undefined}>
            <CartesianGrid stroke="#2B3542" strokeDasharray="3 3" />
            <XAxis dataKey="d" type="number" domain={xDomain || ["dataMin", "dataMax"]}
              allowDataOverflow stroke="#8C97A5" fontSize={10} tickFormatter={(v) => Math.round(v)}
              minTickGap={40} />
            <YAxis stroke="#8C97A5" fontSize={10} width={44}
              domain={["auto", "auto"]} tickFormatter={fmt} />
            <Tooltip contentStyle={{ background: "#1F2731", border: "1px solid #2B3542", fontSize: 12 }}
              labelFormatter={(v) => `${Math.round(v)} ${unit}`}
              formatter={(val, n) => [fmt ? fmt(val) : val, n]} />
            {zero && <ReferenceLine y={0} stroke="#8C97A5" strokeDasharray="4 4" />}
            {cursorD != null && <ReferenceLine x={cursorD} stroke="#3ad07a" strokeWidth={1.4} />}
            {(dots || []).map((p, i) => (
              <ReferenceDot key={`d${i}`} x={p.x} y={p.y} r={3} fill={p.c} stroke="#000"
                strokeWidth={0.6} isFront />
            ))}
            {(bounds || []).map((b) => (
              <ReferenceLine key={b.label} x={b.d} stroke="#6B7683" strokeDasharray="2 3"
                label={{ value: `S${b.label.slice(-1)}`, position: "insideTopLeft",
                  fill: "#8C97A5", fontSize: 9 }} />
            ))}
            {keys.map((k, i) => (
              <Line key={k} dataKey={k} name={k.endsWith("B") ? "B" : k.endsWith("A") ? "A" : k}
                stroke={colors[i]} dot={false} strokeWidth={1.6} connectNulls
                isAnimationActive={false}
                strokeDasharray={dashB && k.endsWith("B") ? "5 3" : undefined} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* Mini pist haritası — turun XY şekli (konum kanalı ya da hız+G tahmini). Segmentler
   delta işaretine göre renkli (kırmızı A hızlı / mavi B hızlı) → "hangi virajda ne
   yaptık". İz üzerinde gezerken (cursor) haritada o nokta işaretlenir.
   Fare tekerleğiyle yakınlaştır (viewBox state), sürükleyerek gez, çift-tık sıfırla —
   nokta matematiği (scr/segment) DEĞİŞMEZ; yalnız viewBox pencere kayar/daralır. */
function TrackMini({ t, data, cursor, src, big, marks, apex, onScrub }) {
  const S = 240, PAD = 16;
  const [view, setView] = useState({ vx: 0, vy: 0, vw: S, vh: S });
  const svgRef = useRef(null);
  const drag = useRef(null);   // { x0, y0, view0 }
  const xs = data.map((d) => d.mapX), ys = data.map((d) => d.mapY);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const spanX = (maxX - minX) || 1, spanY = (maxY - minY) || 1;
  const sc = Math.min((S - 2 * PAD) / spanX, (S - 2 * PAD) / spanY);
  const ox = (S - spanX * sc) / 2, oy = (S - spanY * sc) / 2;
  const scr = (x, y) => [ox + (x - minX) * sc, S - (oy + (y - minY) * sc)];   // y yukarı → ekranda ters
  const step = Math.max(1, Math.floor(data.length / 220));
  const segs = [];
  for (let k = 0; k + step < data.length; k += step) {
    const [x1, y1] = scr(data[k].mapX, data[k].mapY);
    const [x2, y2] = scr(data[k + step].mapX, data[k + step].mapY);
    const dd = (data[k + step].dt ?? 0) - (data[k].dt ?? 0);   // +: B daha çok süre → A hızlı
    const col = dd > 0.003 ? CA : dd < -0.003 ? CB : "#7a8797";
    segs.push(<line key={k} x1={x1} y1={y1} x2={x2} y2={y2} stroke={col} strokeWidth={3.2}
      strokeLinecap="round" vectorEffect="non-scaling-stroke" />);
  }
  const [sfx, sfy] = scr(data[0].mapX, data[0].mapY);
  const cur = cursor != null && data[cursor] ? scr(data[cursor].mapX, data[cursor].mapY) : null;
  const zf = view.vw / S;   // daire yarıçapı ekranda sabit kalsın diye ölçek
  /* sektör sınır tik'leri (S1|S2, S2|S3) — delta rengi korunur, üstüne nötr işaret */
  const secTicks = (marks || []).map((m) => {
    const p = data[m.idx] ? scr(data[m.idx].mapX, data[m.idx].mapY) : null;
    return p ? { ...m, x: p[0], y: p[1] } : null;
  }).filter(Boolean);
  /* viraj (apex) işaretleri — numaralı küçük daireler */
  const apexPts = (apex || []).map((idx, i) => {
    const p = data[idx] ? scr(data[idx].mapX, data[idx].mapY) : null;
    return p ? { no: i + 1, x: p[0], y: p[1] } : null;
  }).filter(Boolean);
  const zoomed = view.vw < S - 0.5;

  /* SVG-koordinatına çevir (px → viewBox birimi) */
  const toSvg = (clientX, clientY) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r || !r.width) return null;
    return [view.vx + ((clientX - r.left) / r.width) * view.vw,
      view.vy + ((clientY - r.top) / r.height) * view.vh];
  };
  /* Tekerlek: React onWheel passive → native non-passive dinleyici (sayfa kaymasın) */
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      const p = toSvg(e.clientX, e.clientY);
      if (!p) return;
      setView((v) => zoomViewAt(v, p[0], p[1], e.deltaY < 0 ? 0.85 : 1.18, S));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });
  /* pist çizgisine en yakın tur noktası (ekran-px) → { idx, dist } */
  const GRAB_PX = 18;
  const nearest = (clientX, clientY) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r || !r.width || !data.length) return null;
    let bi = -1, bd = Infinity;
    for (let k = 0; k < data.length; k++) {
      const [sx, sy] = scr(data[k].mapX, data[k].mapY);
      const px = r.left + ((sx - view.vx) / view.vw) * r.width;
      const py = r.top + ((sy - view.vy) / view.vh) * r.height;
      const d = (clientX - px) ** 2 + (clientY - py) ** 2;
      if (d < bd) { bd = d; bi = k; }
    }
    return { idx: bi, dist: Math.sqrt(bd) };
  };
  const onDown = (e) => {
    const n = onScrub ? nearest(e.clientX, e.clientY) : null;
    if (n && n.dist <= GRAB_PX) {           // pist çizgisi/daire üstünde → scrub
      drag.current = { mode: "scrub" }; onScrub(n.idx);
    } else {                                 // boş alan → pan (v1.4.115)
      drag.current = { mode: "pan", x0: e.clientX, y0: e.clientY, v0: view };
    }
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e) => {
    const d0 = drag.current;
    if (!d0) return;
    if (d0.mode === "scrub") {
      const n = nearest(e.clientX, e.clientY);
      if (n && onScrub) onScrub(n.idx);
      return;
    }
    const r = svgRef.current?.getBoundingClientRect();
    if (!r || !r.width) return;
    const dx = -((e.clientX - d0.x0) / r.width) * d0.v0.vw;
    const dy = -((e.clientY - d0.y0) / r.height) * d0.v0.vh;
    setView(panView(d0.v0, dx, dy, S));
  };
  const onUp = () => { drag.current = null; };
  const reset = () => setView({ vx: 0, vy: 0, vw: S, vh: S });

  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: "flex", justifyContent: "center", position: "relative" }}>
        <svg ref={svgRef} viewBox={`${view.vx} ${view.vy} ${view.vw} ${view.vh}`}
          style={{ width: big ? undefined : "100%", maxWidth: big ? "none" : 360, height: "auto",
            cursor: drag.current ? "grabbing" : "grab", touchAction: "none" }}
          aria-label="track map" onDoubleClick={reset}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}>
          {segs}
          {secTicks.map((m) => (
            <g key={m.label}>
              <circle cx={m.x} cy={m.y} r={4 * zf} fill="#0B0708" stroke="#cbb" strokeWidth={2}
                vectorEffect="non-scaling-stroke" />
              <text x={m.x + 6 * zf} y={m.y + 3 * zf} fill="#cbb" fontSize={8 * zf}>
                S{m.label.slice(-1)}</text>
            </g>
          ))}
          {apexPts.map((a) => (
            <text key={`ap${a.no}`} x={a.x} y={a.y} fill="#F5C84C" fontSize={9 * zf}
              fontWeight="700" textAnchor="middle" dominantBaseline="central"
              stroke="#000" strokeWidth={0.5} paintOrder="stroke"
              vectorEffect="non-scaling-stroke">{a.no}</text>
          ))}
          <circle cx={sfx} cy={sfy} r={5 * zf} fill="none" stroke="#fff" strokeWidth={2}
            vectorEffect="non-scaling-stroke" />
          <text x={sfx + 7 * zf} y={sfy + 3 * zf} fill="#fff" fontSize={9 * zf}>S/F</text>
          {cur && <circle cx={cur[0]} cy={cur[1]} r={6 * zf} fill="#3ad07a" stroke="#000"
            strokeWidth={1.4} vectorEffect="non-scaling-stroke" />}
        </svg>
        {zoomed && (
          <button className="act" style={{ position: "absolute", top: 4, right: 4,
            fontSize: 11, padding: "2px 8px" }} onClick={reset}
            title={t("Yakınlaştırmayı sıfırla")}>⟳</button>
        )}
      </div>
      <div className="hint" style={{ textAlign: "center", opacity: .8, marginTop: 2 }}>
        <span style={{ color: CA }}>■</span> {t("A hızlı")} · <span style={{ color: CB }}>■</span> {t("B hızlı")}
        {" · "}{src === "g" ? t("G-kuvveti tahmini (şekil yaklaşık)") : t("konum kanalından")}
      </div>
      <div className="hint" style={{ textAlign: "center", opacity: .6, marginTop: 1 }}>
        🖱 {t("tekerlek: yakınlaştır · daireyi sürükle: konum · boş alanı sürükle: gez · çift-tık: sıfırla")}
      </div>
    </div>
  );
}

/* Tur karşılaştırma kartı — yüklü .ld üzerinde iki turu mesafe ekseninde üst üste
   bindirir; pist haritası + hız/gaz/fren/vites/RPM/direksiyon izleri + zaman-delta +
   sektör farkı. Yalnız gösterim (Firebase'e yazılmaz). cmpData buildCompare çıktısı. */
function TraceCompareCard({ t, sources, fallbackMeta, cmpASrc, setCmpASrc, cmpBSrc, setCmpBSrc,
  cmpA, setCmpA, cmpB, setCmpB, cmpData, cmpBusy }) {
  const [cursor, setCursor] = useState(null);   // ize gelince pist haritasında işaretlenen nokta
  const [big, setBig] = useState(false);        // harita tam pencere
  const [xWin, setXWin] = useState(null);       // kanal mesafe penceresi (null = tam genişlik)
  const [playing, setPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1);
  const playPosRef = useRef(0);                  // kesirli oynatma index'i
  const lastDRef = useRef(null);                // tekerlek anchor'ı (imleçten bağımsız son mesafe)
  const tracesRef = useRef(null);
  const cardRef = useRef(null);                 // PDF için karttaki SVG'leri toplamak
  const srcOf = (k) => (sources || []).find((s) => s.key === k) || (sources || [])[0];
  const srcA = srcOf(cmpASrc), srcB = srcOf(cmpBSrc);
  const lapsA = srcA?.laps || [];
  const lapsB = srcB?.laps || [];
  const meta = srcA?.meta || fallbackMeta;
  const multiSrc = (sources || []).length > 1;
  const srcLabel = (k) => (k === "cur"
    ? (srcOf(k)?.meta?.venue || t("Yüklü dosya")) : `Stint ${k}`);
  /* kaynak değişince o tarafın turunu en hızlı TAM tura al (index taşmasın) */
  const pickFast = (laps) => {
    if (!laps?.length) return 0;
    const idx = laps.map((_, i) => i).sort((i, j) => laps[i].sec - laps[j].sec);
    const full = idx.filter((i) => !laps[i].partial);
    return (full[0] ?? idx[0]) ?? 0;
  };
  const venDiff = srcA?.meta?.venue && srcB?.meta?.venue
    && srcA.meta.venue !== srcB.meta.venue;
  const ch = cmpData?.chans || {};
  const data = cmpData?.data;
  const N = data?.length || 0;
  const dLo = data?.length ? data[0].d : 0;
  const dHi = data?.length ? data[data.length - 1].d : 0;
  const unit = cmpData?.distUnit === "frac" ? "%" : "m";
  const marks = data ? sectorMarks(data) : [];   // sektör sınırları (mesafe üçlüsü)
  /* viraj tespiti: A'nın hız minimumları (apex) → apex hızları + fren mesafeleri (A/B) */
  const apexes = useMemo(() => (data?.length
    ? detectApexes(data.map((p) => p.spA), data.map((p) => p.d)) : []), [data]);
  const corners = useMemo(() => cornerStats(data, apexes), [data, apexes]);
  const curSec = cursor != null && data?.[cursor]
    ? sectorOf((data[cursor].frac ?? 0) / 100) : null;   // data.frac 0..100
  const cursorD = cursor != null && data?.[cursor] ? data[cursor].d : null;
  const lapSecA = lapsA[cmpA]?.sec;
  /* haritada daireyi sürükleyince (scrub): oynatmayı durdur + imleci o noktaya taşı */
  const onScrub = (i) => { setPlaying(false); playPosRef.current = i; setCursor(i); };

  /* Oynatma: setInterval (~40ms) imleci tur A süresi boyunca ilerletir; harita noktası +
     tüm kanallarda playhead (ReferenceLine) kayar. Veri/tur değişince durur. */
  useEffect(() => {
    if (!playing || N < 2) return undefined;
    const id = setInterval(() => {
      playPosRef.current = advanceCursor(playPosRef.current, N, lapSecA, playSpeed, 40);
      setCursor(Math.round(playPosRef.current));
    }, 40);
    return () => clearInterval(id);
  }, [playing, playSpeed, N, lapSecA]);
  // tur/dosya değişince oynatmayı durdur (index karışmasın)
  useEffect(() => { setPlaying(false); playPosRef.current = 0; }, [cmpA, cmpB]);

  /* Esc → harita tam pencereyi kapat (TrackMap deseni) */
  useEffect(() => {
    if (!big) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setBig(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [big]);

  /* Kanallar: tüm satırları saran kapsayıcıda native (passive:false) tekerlek → mesafe
     penceresini imleç etrafında daralt/genişlet; tüm grafikler syncId ile birlikte yakınlaşır. */
  useEffect(() => {
    const el = tracesRef.current;
    if (!el || !(dHi > dLo)) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      const anchor = lastDRef.current ?? (dLo + dHi) / 2;
      setXWin((w) => zoomDomain(w || [dLo, dHi], anchor, e.deltaY < 0 ? 0.8 : 1.25, [dLo, dHi]));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [dLo, dHi]);
  const sp1 = (v) => (v == null ? "—" : v.toFixed(1));
  const pct = (v) => (v == null ? "—" : `${Math.round(v)}%`);
  const dlt = (v) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(3)}s`);
  const lapOpt = (l, i) => (
    <option key={i} value={i}>Lap {l.lap} · {fmtLap(l.sec)}{l.partial ? " (kısmi)" : ""}</option>
  );

  /* PDF raporu: karttaki mevcut SVG'leri (harita + grafikler) serialize edip gizli iframe'e
     yaz → window.print (App.exportPdf deseni, WebView2 popup'suz). Vektör → PDF'te net. */
  const exportTelePdf = () => {
    const host = cardRef.current;
    if (!host || !cmpData) return;
    const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const svgs = [...host.querySelectorAll("svg")].map((sv) => {
      const c = sv.cloneNode(true);
      const w = c.getAttribute("width"), h = c.getAttribute("height");
      if (!c.getAttribute("viewBox") && w && h) c.setAttribute("viewBox", `0 0 ${parseFloat(w)} ${parseFloat(h)}`);
      c.removeAttribute("width"); c.removeAttribute("height");
      c.setAttribute("style", "width:100%;height:auto;display:block");
      return `<div class="panel">${new XMLSerializer().serializeToString(c)}</div>`;
    }).join("");
    const lapTxt = (laps, i) => (laps[i] ? `Lap ${laps[i].lap} · ${fmtLap(laps[i].sec)}` : "—");
    const secRows = (cmpData.sectors || []).map((s) =>
      `<tr><td>S${s.sec}</td><td>${s.dA.toFixed(3)}</td><td>${s.dB.toFixed(3)}</td>
        <td style="color:${s.diff > 0 ? CA : CB};font-weight:600">${dlt(s.diff)}</td></tr>`).join("");
    const cond = [meta?.venue, meta?.vehicle, meta?.driver,
      meta?.trk != null ? `${t("Pist")} ${meta.trk.toFixed(0)}°` : null,
      meta?.amb != null ? `${t("Hava")} ${meta.amb.toFixed(0)}°` : null]
      .filter(Boolean).map(esc).join(" · ");
    document.getElementById("pdfframe")?.remove();
    const ifr = document.createElement("iframe");
    ifr.id = "pdfframe"; ifr.setAttribute("aria-hidden", "true");
    ifr.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
    document.body.appendChild(ifr);
    const doc = ifr.contentWindow.document;
    doc.open();
    doc.write(`<!doctype html><html><head><meta charset="utf-8">
<title>${esc(t("Telemetri Raporu"))}</title>
<style>
 *{box-sizing:border-box}
 body{font-family:Arial,Helvetica,sans-serif;color:#1a1113;margin:24px;font-size:12px}
 h1{font-size:18px;margin:0 0 2px;letter-spacing:.04em;text-transform:uppercase}
 h1 b{color:#960018}
 .sub{color:#555;margin:0 0 6px;font-size:11px}
 .meta{color:#333;font-size:11px;border-bottom:2px solid #960018;padding-bottom:8px;margin-bottom:10px}
 .panel{background:#131a22;border-radius:8px;padding:8px;margin:8px 0;
   -webkit-print-color-adjust:exact;print-color-adjust:exact;break-inside:avoid}
 table{border-collapse:collapse;width:auto;margin-top:10px;font-variant-numeric:tabular-nums}
 th,td{border:1px solid #d9c9cd;padding:5px 12px;text-align:left}
 th{background:#960018;color:#fff;font-size:10.5px;text-transform:uppercase}
 .foot{color:#999;font-size:10px;margin-top:16px}
</style></head><body>
<h1><b>Caspian</b> ${esc(t("Telemetri Raporu"))}</h1>
<div class="sub">${esc(t("Tur Karşılaştırma"))} — <b style="color:${CA}">A</b> ${esc(lapTxt(lapsA, cmpA))}
  · <b style="color:${CB}">B</b> ${esc(lapTxt(lapsB, cmpB))}
  · Δ ${esc(dlt(cmpData.totalDelta))}</div>
${cond ? `<div class="meta">${cond}</div>` : ""}
${svgs}
<table><thead><tr><th>${esc(t("Sektör"))}</th><th>A</th><th>B</th><th>Δ</th></tr></thead>
<tbody>${secRows}</tbody></table>
<div class="foot">Caspian Race Monitor · ${new Date().toLocaleString()}</div>
<scr${""}ipt>window.onload=function(){window.print()}</scr${""}ipt></body></html>`);
    doc.close();
  };
  return (
    <div className="card" style={{ marginTop: 12 }} ref={cardRef}>
      <h2 style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        🔬 {t("Tur Karşılaştırma")}
        {cmpData && Number.isFinite(cmpData.totalDelta) && (
          <span className="chip" style={{ fontSize: 12,
            borderColor: cmpData.totalDelta > 0 ? CA : CB,
            color: cmpData.totalDelta > 0 ? CA : CB }}>
            Δ {dlt(cmpData.totalDelta)}</span>
        )}
        {curSec != null && (
          <span className="chip" style={{ fontSize: 12 }}>📍 {t("Sektör")} S{curSec}</span>
        )}
      </h2>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", fontSize: 12 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 5, margin: 0 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: CA, display: "inline-block" }} />
          A
          {multiSrc && (
            <select value={cmpASrc} onChange={(e) => { setCmpASrc(e.target.value);
              setCmpA(pickFast(srcOf(e.target.value)?.laps)); }}>
              {sources.map((s) => <option key={s.key} value={s.key}>{srcLabel(s.key)}</option>)}
            </select>
          )}
          <select value={cmpA ?? 0} onChange={(e) => setCmpA(+e.target.value)}>{lapsA.map(lapOpt)}</select>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 5, margin: 0 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: CB, display: "inline-block" }} />
          B
          {multiSrc && (
            <select value={cmpBSrc} onChange={(e) => { setCmpBSrc(e.target.value);
              setCmpB(pickFast(srcOf(e.target.value)?.laps)); }}>
              {sources.map((s) => <option key={s.key} value={s.key}>{srcLabel(s.key)}</option>)}
            </select>
          )}
          <select value={cmpB ?? 0} onChange={(e) => setCmpB(+e.target.value)}>{lapsB.map(lapOpt)}</select>
        </label>
        {venDiff && (
          <span className="chip" style={{ fontSize: 11, borderColor: "var(--yellow)",
            color: "var(--yellow)" }}>⚠ {t("farklı pist — kıyas dikkatli")}</span>
        )}
      </div>
      {meta && (meta.venue || meta.trk != null || meta.amb != null) && (
        <div className="hint" style={{ marginTop: 4, opacity: .85, display: "flex",
          gap: 8, flexWrap: "wrap" }}>
          {meta.venue && <span>🏁 {meta.venue}</span>}
          {meta.vehicle && <span>· 🚗 {meta.vehicle}</span>}
          {meta.driver && <span>· 👤 {meta.driver}</span>}
          {meta.trk != null && <span>· 🛣 {t("Pist")} {meta.trk.toFixed(0)}°</span>}
          {meta.amb != null && <span>· 🌡 {t("Hava")} {meta.amb.toFixed(0)}°</span>}
        </div>
      )}

      {cmpBusy && <div className="hint" style={{ marginTop: 6 }}>⏳ {t("İzler hazırlanıyor…")}</div>}
      {!cmpBusy && !cmpData && <div className="hint" style={{ marginTop: 6 }}>{t("İz verisi çıkarılamadı — bu dosyada hız/mesafe kanalı olmayabilir.")}</div>}

      {cmpData && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <button className="act" style={{ fontSize: 13, padding: "3px 12px" }}
            title={t("Telemetriyi oynat")} onClick={() => setPlaying((p) => !p)}>
            {playing ? "⏸" : "▶"}</button>
          <select value={playSpeed} onChange={(e) => setPlaySpeed(+e.target.value)}
            style={{ fontSize: 12 }} title={t("Oynatma hızı")}>
            <option value={0.5}>0.5×</option>
            <option value={1}>1×</option>
            <option value={2}>2×</option>
          </select>
          <input type="range" min={0} max={Math.max(0, N - 1)} value={cursor ?? 0}
            onChange={(e) => { const i = +e.target.value; setPlaying(false);
              playPosRef.current = i; setCursor(i); }}
            style={{ flex: "1 1 140px", minWidth: 120 }} aria-label={t("Konum")} />
          {cmpData.hasMap && (
            <button className="act" style={{ fontSize: 11, padding: "3px 10px" }}
              title={t("Haritayı büyük pencerede aç")} onClick={() => setBig(true)}>
              ⛶ {t("Büyüt")}</button>
          )}
          <button className="act" style={{ fontSize: 11, padding: "3px 10px" }}
            title={t("Grafikleri PDF rapor olarak çıkart (tam tur için önce ⟳ sıfırla)")}
            onClick={exportTelePdf}>📄 PDF</button>
        </div>
      )}

      {/* İmleç değer paneli: cursor (hover/scrub/oynatma) konumundaki tüm kanalların A/B değeri + fark */}
      {cmpData && cursor != null && data?.[cursor] && (() => {
        const p = data[cursor];
        const cell = (lbl, aV, bV, fmtV, diff) => (
          <span key={lbl} className="chip" style={{ fontSize: 11 }}>
            {lbl} <b style={{ color: CA }}>{fmtV(aV)}</b>/<b style={{ color: CB }}>{fmtV(bV)}</b>
            {diff && aV != null && bV != null && (
              <span style={{ opacity: .7 }}> ({aV - bV >= 0 ? "+" : ""}{Math.round(aV - bV)})</span>
            )}
          </span>
        );
        const iv = (v) => (v == null ? "—" : String(Math.round(v)));
        return (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
            <span className="chip" style={{ fontSize: 11 }}>📍 {Math.round(p.d)} {unit} · Δ {dlt(p.dt)}</span>
            {ch.speed && cell(t("Hız"), p.spA, p.spB, iv, true)}
            {ch.throttle && cell(t("Gaz"), p.thA, p.thB, pct)}
            {ch.brake && cell(t("Fren"), p.brA, p.brB, pct)}
            {ch.gear && cell(t("Vites"), p.gA, p.gB, iv)}
            {ch.rpm && cell(t("RPM"), p.rpmA, p.rpmB, iv)}
            {ch.steer && cell(t("Direksiyon"), p.stA, p.stB, sp1)}
          </div>
        );
      })()}
      {cmpData && cursor == null && (
        <div className="hint" style={{ marginTop: 8, opacity: .6 }}>
          {t("ize gel / oynat / daireyi sürükle → o noktadaki A/B değerleri")}
        </div>
      )}

      {cmpData && cmpData.hasMap && (
        <TrackMini t={t} data={cmpData.data} cursor={cursor} src={cmpData.mapSrc} marks={marks} apex={apexes} onScrub={onScrub} />
      )}
      {cmpData && !cmpData.hasMap && (
        <div className="hint" style={{ marginTop: 6, opacity: .7 }}>
          🗺 {t("Pist haritası çizilemedi — bu dosyada konum ya da yanal-G kanalı yok.")}
        </div>
      )}

      {cmpData && (<>
        <div className="hint" style={{ marginTop: 6, opacity: .8, display: "flex",
          alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span>{t("X ekseni")}: {unit === "%" ? t("tur kesri %") : t("mesafe (m)")} · {t("kırmızı A, mavi B")} ·
            {" "}{t("delta > 0 = B daha yavaş")} · 🖱 {t("tekerlek: yakınlaştır")}</span>
          {xWin && (
            <button className="act" style={{ fontSize: 11, padding: "2px 8px" }}
              onClick={() => setXWin(null)}>⟳ {t("Yakınlaştırmayı sıfırla")}</button>
          )}
        </div>
        <div ref={tracesRef}>
        <TraceRow data={cmpData.data} title={`⏱ ${t("Zaman-Delta (B−A)")}`} unit={unit}
          keys={["dt"]} colors={["#F5C84C"]} fmt={dlt} height={140} zero
          onCursor={setCursor} onAnchor={(d) => { lastDRef.current = d; }} xDomain={xWin} bounds={marks} cursorD={cursorD} />
        {ch.speed && (
          <TraceRow data={cmpData.data} title={`🏁 ${t("Hız")} (km/h)`} unit={unit}
            keys={["spA", "spB"]} colors={[CA, CB]} fmt={sp1}
            onCursor={setCursor} onAnchor={(d) => { lastDRef.current = d; }} xDomain={xWin} bounds={marks} cursorD={cursorD}
            dots={corners.flatMap((c) => [
              c.aMin != null ? { x: c.apexD, y: c.aMin, c: CA } : null,
              c.bMin != null ? { x: c.apexD, y: c.bMin, c: CB } : null].filter(Boolean))} />
        )}
        {ch.throttle && (
          <TraceRow data={cmpData.data} title={`🟢 ${t("Gaz")} %`} unit={unit}
            keys={["thA", "thB"]} colors={[CA, CB]} fmt={pct} height={110} dashB
            onCursor={setCursor} onAnchor={(d) => { lastDRef.current = d; }} xDomain={xWin} bounds={marks} cursorD={cursorD} />
        )}
        {ch.brake && (
          <TraceRow data={cmpData.data} title={`🔴 ${t("Fren")} %`} unit={unit}
            keys={["brA", "brB"]} colors={[CA, CB]} fmt={pct} height={110} dashB
            onCursor={setCursor} onAnchor={(d) => { lastDRef.current = d; }} xDomain={xWin} bounds={marks} cursorD={cursorD} />
        )}
        {ch.gear && (
          <TraceRow data={cmpData.data} title={`⚙ ${t("Vites")}`} unit={unit}
            keys={["gA", "gB"]} colors={[CA, CB]} fmt={(v) => (v == null ? "—" : String(Math.round(v)))} height={100} dashB
            onCursor={setCursor} onAnchor={(d) => { lastDRef.current = d; }} xDomain={xWin} bounds={marks} cursorD={cursorD} />
        )}
        {ch.rpm && (
          <TraceRow data={cmpData.data} title={`🔧 ${t("RPM")}`} unit={unit}
            keys={["rpmA", "rpmB"]} colors={[CA, CB]} fmt={(v) => (v == null ? "—" : String(Math.round(v)))} height={100}
            onCursor={setCursor} onAnchor={(d) => { lastDRef.current = d; }} xDomain={xWin} bounds={marks} cursorD={cursorD} />
        )}
        {ch.steer && (
          <TraceRow data={cmpData.data} title={`🕹 ${t("Direksiyon")}`} unit={unit}
            keys={["stA", "stB"]} colors={[CA, CB]} fmt={sp1} height={100}
            onCursor={setCursor} onAnchor={(d) => { lastDRef.current = d; }} xDomain={xWin} bounds={marks} cursorD={cursorD} />
        )}
        </div>

        <table style={{ maxWidth: 420, marginTop: 10, fontSize: 12 }}>
          <thead><tr>
            <th>{t("Sektör")}</th><th style={{ color: CA }}>A</th>
            <th style={{ color: CB }}>B</th><th>Δ</th>
          </tr></thead>
          <tbody>
            {cmpData.sectors.map((s) => (
              <tr key={s.sec}>
                <td>S{s.sec}</td>
                <td className="mono">{s.dA.toFixed(3)}</td>
                <td className="mono">{s.dB.toFixed(3)}</td>
                <td className="mono" style={{ color: s.diff > 0 ? CA : CB, fontWeight: 600 }}>{dlt(s.diff)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="hint" style={{ marginTop: 4, opacity: .6 }}>
          {t("Sektörler tur-kesri üçlüsüdür (mesafe/3); gerçek S/F beacon'ı değil.")}
        </div>

        {/* Viraj analizi: apex (viraj ortası) hızları + fren mesafeleri (A/B) */}
        {corners.length > 0 ? (<>
          <h3 style={{ fontSize: 13, margin: "14px 0 4px" }}>🏁 {t("Viraj Analizi")}</h3>
          <div style={{ overflowX: "auto" }}>
          <table style={{ fontSize: 12 }}>
            <thead><tr>
              <th>{t("Viraj")}</th><th>{t("Mesafe")}</th>
              <th style={{ color: CA }}>A {t("apex")}</th><th style={{ color: CB }}>B {t("apex")}</th><th>Δ</th>
              <th style={{ color: CA }}>A {t("fren")}</th><th style={{ color: CB }}>B {t("fren")}</th>
            </tr></thead>
            <tbody>
              {corners.map((c) => {
                const spD = (c.aMin != null && c.bMin != null) ? c.aMin - c.bMin : null;
                const bd = (v) => (v == null ? "—" : `${Math.round(v)} ${unit}`);
                return (
                  <tr key={c.no}>
                    <td style={{ fontWeight: 700, color: "#F5C84C" }}>{c.no}</td>
                    <td className="mono">{Math.round(c.apexD)} {unit}</td>
                    <td className="mono">{c.aMin != null ? Math.round(c.aMin) : "—"}</td>
                    <td className="mono">{c.bMin != null ? Math.round(c.bMin) : "—"}</td>
                    <td className="mono" style={{ color: spD == null ? "inherit" : spD >= 0 ? CA : CB, fontWeight: 600 }}>
                      {spD == null ? "—" : `${spD >= 0 ? "+" : ""}${Math.round(spD)}`}</td>
                    <td className="mono">{bd(c.aBrakeDist)}</td>
                    <td className="mono">{bd(c.bBrakeDist)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          <div className="hint" style={{ marginTop: 4, opacity: .6 }}>
            {t("apex = viraj ortası (en düşük hız); fren = fren-başından apex'e mesafe. Sezgisel tespit (gerçek beacon değil).")}
          </div>
        </>) : (
          <div className="hint" style={{ marginTop: 10, opacity: .6 }}>
            {t("Viraj tespit edilemedi — hız/fren kanalı gerekli.")}
          </div>
        )}
      </>)}

      {big && cmpData?.hasMap && (
        <div className="wxmodal" onClick={() => setBig(false)} role="dialog" aria-modal="true">
          <div className="wxmbox map" onClick={(e) => e.stopPropagation()}>
            <div className="wxmhead">
              <span>🗺 {t("Pist Haritası")}</span>
              <button className="act" style={{ fontSize: 12, padding: "2px 10px" }}
                title={t("Kapat")} onClick={() => setBig(false)}>✕</button>
            </div>
            <div className="mapwrap">
              <TrackMini t={t} data={cmpData.data} cursor={cursor} src={cmpData.mapSrc} marks={marks} apex={apexes} onScrub={onScrub} big />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* Telemetri sekmesi — MoTeC içe aktarma, sütun eşleme, stint analizi + grafikler.
   Tüm state/derived (parsed/slotStats/chartData/loadedSlots/baseSlot) ve handler'lar
   App'ten prop gelir. fmtMs lokal (fmtLap sarmalayıcı). */
export default function TeleTab({
  t, lang, st, slot, setSlot, rawTele, setRawTele, doParse, onTeleFile,
  parsed, mapping, setMapping, saveMotec, saveSlot, loadedSlots, slotStats,
  up, apply105Slot, removeSlot, chartMode, setChartMode, chartData, baseSlot, toggleLap,
  cmpMeta, cmpA, setCmpA, cmpB, setCmpB, cmpData, cmpBusy, savedMsg,
  cmpSources, cmpASrc, setCmpASrc, cmpBSrc, setCmpBSrc,
}) {
  const fmtMs = (ms) => fmtLap(ms / 1000);
  return (
    <div>
      <div className="card">
        <h2 data-tour="teleimport">{t("Telemetri İçe Aktar (MoTeC)")}</h2>
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          {["A", "B", "C", "D"].map((sl) => (
            <button key={sl} className="act"
              style={slot === sl
                ? { borderColor: SLOT_COLORS[sl], color: SLOT_COLORS[sl], fontWeight: 700 }
                : {}}
              onClick={() => setSlot(sl)}>
              Stint {sl}{st.telemetry[sl] ? " ●" : ""}
            </button>
          ))}
        </div>
        <label>{t("MoTeC tur istatistiklerini yapıştır veya dosya seç (CSV/TSV) — .ld doğrudan çalışır")}</label>
        <textarea value={rawTele}
          onChange={(e) => { setRawTele(e.target.value); doParse(e.target.value); }}
          placeholder={"Out Lap\t310127\t-6.403 ...\nLap 1\t237350\t-6.36 ..."}
          style={{ width: "100%", height: 90, background: "var(--panel2)",
            border: "1px solid var(--line)", borderRadius: 6, color: "var(--txt)",
            fontFamily: "IBM Plex Mono", fontSize: 11, padding: 8 }} />
        <div style={{ margin: "6px 0" }}>
          <input type="file" accept=".csv,.tsv,.txt,.ld" onChange={onTeleFile} />
          {savedMsg && (
            <span className="hint" style={{ color: "var(--green)", marginLeft: 10, fontWeight: 600 }}>
              ✓ Stint {savedMsg} {t("kaydedildi")}</span>
          )}
        </div>
        {parsed?.loading && <div className="hint">⏳ {t(".ld çözümleniyor…")}</div>}
        {parsed?.error && <div className="hint warn">⚠ {t(parsed.error)}</div>}
        {parsed?.motec && (<>
          <div className="hint" style={{ marginTop: 4 }}>
            <b>{parsed.laps.length}</b> {t("tur çözümlendi")}
            {parsed.meta.venue && <> · {parsed.meta.venue}</>}
            {parsed.meta.vehicle && <> · {parsed.meta.vehicle}</>}
            {parsed.meta.driver && <> · {parsed.meta.driver}</>}
            {parsed.meta.trk != null && <> · {t("Pist")} {parsed.meta.trk.toFixed(0)}°C</>}
            {parsed.meta.amb != null && <> / {t("Hava")} {parsed.meta.amb.toFixed(0)}°C</>}
          </div>
          <div style={{ overflowX: "auto", margin: "8px 0" }}>
            <table style={{ fontSize: 11.5 }}>
              <thead><tr>
                <th>{t("Tur")}</th><th>{t("Süre")}</th><th>{t("Yakıt")}</th>
                <th>VE %</th><th>{t("Aşınma")} FL/FR/RL/RR</th><th>{t("Ort/Max km/h")}</th>
              </tr></thead>
              <tbody>
                {parsed.laps.map((l) => (
                  <tr key={l.lap}>
                    <td>{l.lap}{l.pit ? " 🅿" : ""}
                      {l.partial && <span className="hint" style={{ marginLeft: 4 }}>
                        {t("kısmi")}</span>}</td>
                    <td className="mono">{fmtLap(l.sec)}</td>
                    <td className="mono">{l.fuelL != null ? `${l.fuelL.toFixed(2)} L` : "—"}</td>
                    <td className="mono">{l.fuelL != null && st.fuelRatio > 0
                      ? `${(l.fuelL / st.fuelRatio).toFixed(2)}` : "—"}</td>
                    <td className="mono">{l.w.map((x) =>
                      x == null ? "—" : x.toFixed(1)).join(" / ")}</td>
                    <td className="mono">{l.avgSpd != null
                      ? `${Math.round(l.avgSpd)} / ${Math.round(l.maxSpd)}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!(st.fuelRatio > 0) && (
            <div className="hint warn">{t("VE karşılığı için Yarış·Data'da yakıt oranı girilmeli.")}</div>
          )}
          <button className="act" style={{ borderColor: SLOT_COLORS[slot],
            color: SLOT_COLORS[slot], marginTop: 4 }} onClick={saveMotec}>
            {lang === "en" ? <>Save as Stint {slot}</> : <>Stint {slot} olarak kaydet</>}
          </button>
        </>)}
        {parsed && !parsed.error && !parsed.motec && mapping && (<>
          <div className="hint">
            {parsed.lapRows.length} {t("tur satırı bulundu. Sütun eşleşmesini kontrol et:")}
          </div>
          {mapping.fuelCol >= 0 && (
            <div className="hint" style={{ marginTop: 2 }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 5,
                margin: 0, textTransform: "none", letterSpacing: 0 }}>
                <input type="checkbox" checked={!!mapping.fuelIsLitre}
                  onChange={(e) => setMapping({ ...mapping, fuelIsLitre: e.target.checked })} />
                {t("Yakıt sütunu litre (VE % için orana bölünür)")}
              </label>
              {mapping.fuelIsLitre && !(st.fuelRatio > 0) &&
                <span className="warn" style={{ marginLeft: 8 }}>
                  {t("Yarış·Data'da yakıt oranı girilmeli")}</span>}
            </div>
          )}
          <details style={{ margin: "6px 0" }}>
          <summary style={{ cursor: "pointer", color: "var(--muted)", fontSize: 12 }}>
            {t("Sütun eşleşmesini düzenle")}</summary>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "6px 0" }}>
            {[["Tur Süresi", "timeCol"], ["VE Δ (%)", "fuelCol"]].map(([lbl, key]) => (
              <div key={key}>
                <label style={{ margin: 0 }}>{t(lbl)}</label>
                <select value={mapping[key]}
                  onChange={(e) => setMapping({ ...mapping, [key]: +e.target.value })}>
                  <option value={-1}>—</option>
                  {parsed.headers.map((h, i) =>
                    <option key={i} value={i}>{i}: {h || t("(başlıksız)")}</option>)}
                </select>
              </div>
            ))}
            {["FL", "FR", "RL", "RR"].map((c, ci) => (
              <div key={c}>
                <label style={{ margin: 0 }}>{t("Aşınma")} {c}</label>
                <select value={mapping.wear[ci]}
                  onChange={(e) => {
                    const wear = [...mapping.wear]; wear[ci] = +e.target.value;
                    setMapping({ ...mapping, wear });
                  }}>
                  <option value={-1}>—</option>
                  {parsed.headers.map((h, i) =>
                    <option key={i} value={i}>{i}: {h || t("(başlıksız)")}</option>)}
                </select>
              </div>
            ))}
          </div>
          </details>
          <button className="act" style={{ borderColor: SLOT_COLORS[slot],
            color: SLOT_COLORS[slot] }} onClick={saveSlot}
            disabled={mapping.timeCol < 0}>
            {lang === "en" ? <>Save as Stint {slot}</> : <>Stint {slot} olarak kaydet</>}
          </button>
          {mapping.timeCol < 0 &&
            <span className="hint warn" style={{ marginLeft: 8 }}>{t("Tur süresi sütunu seçilmeli")}</span>}
        </>)}
      </div>

      {loadedSlots.length > 0 && (
        <div className="card" style={{ marginTop: 12 }}>
          <h2>{t("Stint Analizi")}</h2>
          <div className="kpis">
            {loadedSlots.map((sl) => {
              const s = slotStats[sl];
              if (!s || s.empty) return null;
              return (
                <div className="kpi" key={sl} style={{ borderColor: SLOT_COLORS[sl] }}>
                  <div className="v" style={{ color: SLOT_COLORS[sl], fontSize: 19 }}>
                    {fmtMs(s.medMs)}</div>
                  <div className="l">Stint {sl} {t("medyan tur")} · {s.laps} {t("Tur")}</div>
                  <div className="hint" style={{ marginTop: 4 }}>
                    {s.medFuel != null && <>⚡ {s.medFuel.toFixed(2)} %/tur VE
                      {s.tankLaps && <> · %100 ≈ {Math.floor(s.tankLaps)} tur</>}<br /></>}
                    {s.medW.some((w) => w != null) &&
                      <><Tyre size={13} /> {s.medW.map((w) => w == null ? "–" : w.toFixed(1)).join(" / ")} {t("%/tur")}<br /></>}
                    <span style={{ opacity: .7 }}>{t("ort.")} {fmtMs(s.avgMs)}
                      {s.avgFuel != null && <> · {s.avgFuel.toFixed(2)} %/tur</>}<br />
                      {t("en iyi")} {fmtMs(s.bestMs)} · %105 ≤ {fmtMs(s.lim105)}
                      {s.dropped > 0 && <> · {s.dropped} {t("tur hariç")}</>}</span>
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                    <button className="act" style={{ fontSize: 11 }}
                      onClick={() => up({
                        avgLap: fmtMs(s.medMs),
                        ...(s.medFuel != null
                          ? { consumption: +s.medFuel.toFixed(2) } : {}),
                      })}>{t("DATA'ya uygula")}</button>
                    <button className="act" style={{ fontSize: 11, opacity: .75 }}
                      title={t("Ortalamayı uygula")}
                      onClick={() => up({
                        avgLap: fmtMs(s.avgMs),
                        ...(s.avgFuel != null
                          ? { consumption: +s.avgFuel.toFixed(2) } : {}),
                      })}>{t("ort.")}</button>
                    <button className="act" style={{ fontSize: 11, opacity: .75 }}
                      title={t("En iyi turun %105'ini aşan turların tikini kaldır")}
                      onClick={() => apply105Slot(sl)}>%105</button>
                    <button className="act danger" style={{ fontSize: 11 }}
                      onClick={() => removeSlot(sl)}>{t("Sil")}</button>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 6, margin: "4px 0 2px" }}>
            {[["box", "Kutu grafiği"], ["line", "Tur tur"]].map(([m, lbl]) => (
              <button key={m} className="act" style={{ fontSize: 11,
                ...(chartMode === m ? { borderColor: "var(--teal)", color: "var(--teal)" } : {}) }}
                onClick={() => setChartMode(m)}>{t(lbl)}</button>
            ))}
          </div>
          {chartMode === "box" ? (
            <div style={{ margin: "6px 0 2px" }}>
              <BoxPlot height={300} fmt={(v) => fmtLap(v / 1000)}
                series={loadedSlots.map((sl) => ({
                  key: sl, label: `Stint ${sl}`, color: SLOT_COLORS[sl],
                  values: st.telemetry[sl].laps.filter((l) => l.use).map((l) => l.ms),
                })).filter((s) => s.values.length)} />
            </div>
          ) : (
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid stroke="#2B3542" strokeDasharray="3 3" />
                <XAxis dataKey="lap" stroke="#8C97A5" fontSize={11} />
                <YAxis stroke="#8C97A5" fontSize={11} domain={["auto", "auto"]}
                  tickFormatter={(v) => fmtLap(v)} width={70} />
                <Tooltip contentStyle={{ background: "#1F2731", border: "1px solid #2B3542" }}
                  labelFormatter={(l) => `Tur ${l}`}
                  formatter={(v, n) => [fmtLap(v), `Stint ${n}`]} />
                <Legend formatter={(v) => `Stint ${v}`} />
                {loadedSlots.map((sl) => (
                  <Line key={sl} dataKey={sl} stroke={SLOT_COLORS[sl]}
                    dot={false} strokeWidth={2} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          )}

          {loadedSlots.length > 1 && baseSlot && slotStats[baseSlot] && !slotStats[baseSlot].empty && (
            <table style={{ maxWidth: 460, marginTop: 10 }}>
              <thead><tr><th>{t("Karşılaştırma")}</th><th>{t("Ort. Fark")}</th><th>{t("Hızlı Olan")}</th></tr></thead>
              <tbody>
                {loadedSlots.slice(1).map((sl) => {
                  const a = slotStats[baseSlot], b = slotStats[sl];
                  /* karşılaştırma medyan üzerinden */
                  if (!b || b.empty) return null;
                  const d = (a.avgMs - b.avgMs) / 1000; // + ise rakip hızlı
                  return (
                    <tr key={sl}>
                      <td>Stint {baseSlot} vs Stint {sl}</td>
                      <td className={d > 0 ? "neg" : "pos"}>{Math.abs(d).toFixed(3)}s/tur</td>
                      <td style={{ color: SLOT_COLORS[d > 0 ? sl : baseSlot] }}>
                        Stint {d > 0 ? sl : baseSlot}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {loadedSlots.map((sl) => (
            <details key={sl} style={{ marginTop: 10 }}>
              <summary style={{ cursor: "pointer", color: SLOT_COLORS[sl] }}>
                Stint {sl} — {t("tur listesi")} ({st.telemetry[sl].laps.length})</summary>
              <table style={{ maxWidth: 560 }}>
                <thead><tr>
                  <th>{t("Dahil")}</th><th>{t("Tur")}</th><th>{t("Süre")}</th><th>VE %</th><th>FL/FR/RL/RR</th>
                </tr></thead>
                <tbody>
                  {st.telemetry[sl].laps.map((l, li) => (
                    <tr key={li} style={l.use ? {} : { opacity: .4 }}>
                      <td><input type="checkbox" checked={l.use}
                        onChange={() => toggleLap(sl, li)} /></td>
                      <td>{l.label}</td>
                      <td>{fmtMs(l.ms)}</td>
                      <td>{l.fuel != null ? l.fuel.toFixed(2) : "–"}</td>
                      <td>{l.w.map((w) => w == null ? "–" : w.toFixed(1)).join(" / ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          ))}
        </div>
      )}

      {cmpSources?.length > 0 && (
        <TraceCompareCard t={t} sources={cmpSources} fallbackMeta={cmpMeta}
          cmpASrc={cmpASrc} setCmpASrc={setCmpASrc} cmpBSrc={cmpBSrc} setCmpBSrc={setCmpBSrc}
          cmpA={cmpA} setCmpA={setCmpA} cmpB={cmpB} setCmpB={setCmpB}
          cmpData={cmpData} cmpBusy={cmpBusy} />
      )}
    </div>
  );
}
