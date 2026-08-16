import { useState, useRef, useEffect, useMemo } from "react";
import { fmtLap } from "../engine";
import { SLOT_COLORS, quantile, venueToTrackId, brandLogo, ASSET, AV, TRACK_ASSET } from "../constants";
import { SessionSetupBox } from "../components";
import { zoomViewAt, panView, advanceCursor } from "../zoomView";
import { sectorOf, sectorMarks } from "../ldTrace";
import { detectApexes, cornerStats } from "../corners";

/* ============================================================
   Telemetri sekmesi — handoff-spec/ekranlar/08-telemetri.md (birebir).
   Markup + inline stil objeleri fişten; renkler --rc-* tokenlarına bağlı.
   Grafikler fişteki EL-ÇİZİMİ inline <svg> ile yeniden kuruldu (kutu/tur-tur,
   iz kanalları, mini pist haritası) — hepsi mevcut veri katmanından beslenir
   (slotStats / st.telemetry / parsed / cmpData). Veri katmanı, prop imzası ve
   handler'lar DEĞİŞMEDİ. TrackMini (etkileşimli pan/zoom/scrub) yalnız ⛶ Büyüt
   penceresinde korunur; satır-içi mini harita fişteki statik SVG'dir.
   ============================================================ */

/* İz karşılaştırma renkleri (A/B tur) — fiş #ff5470 / #4d9fff */
const CA = "var(--rc-danger-2)";   // A turu (kırmızı)
const CB = "var(--rc-delta)";      // B turu (mavi)
/* delta≈0 mini-segment: fişte #7a8797 → token yok, en yakın --rc-neutral (FLAG) */
const NEUTRAL = "var(--rc-neutral)";
const DISP = "var(--rc-font-display)";
const UI = "var(--rc-font-ui)";

const sp1 = (v) => (v == null ? "—" : v.toFixed(1));
const pct = (v) => (v == null ? "—" : `%${Math.round(v)}`);
const dlt = (v) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(3)}s`);
const int0 = (v) => (v == null ? "—" : String(Math.round(v)));
const fmtLapSec = (sec) => fmtLap(sec);

/* Mini pist haritası — turun XY şekli, delta işaretine göre renkli segmentler.
   ⛶ Büyüt penceresinde etkileşimli (fare tekerleği yakınlaştırır, sürükle gezer,
   daireyi sürükle konum seçer, çift-tık sıfırlar). viewBox pencere kayar/daralır;
   nokta matematiği değişmez. */
function TrackMini({ t, data, cursor, big, marks, apex, onScrub }) {
  const S = 240, PAD = 16;
  const [view, setView] = useState({ vx: 0, vy: 0, vw: S, vh: S });
  const svgRef = useRef(null);
  const drag = useRef(null);
  const viewRef = useRef(view);
  viewRef.current = view;

  const { scrPts, step } = useMemo(() => {
    const xs = data.map((d) => d.mapX), ys = data.map((d) => d.mapY);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const spanX = (maxX - minX) || 1, spanY = (maxY - minY) || 1;
    const sc = Math.min((S - 2 * PAD) / spanX, (S - 2 * PAD) / spanY);
    const ox = (S - spanX * sc) / 2, oy = (S - spanY * sc) / 2;
    const scr = (x, y) => [ox + (x - minX) * sc, S - (oy + (y - minY) * sc)];
    return { scrPts: data.map((d) => scr(d.mapX, d.mapY)), step: Math.max(1, Math.floor(data.length / 220)) };
  }, [data]);

  const segs = useMemo(() => {
    const out = [];
    for (let k = 0; k + step < data.length; k += step) {
      const [x1, y1] = scrPts[k];
      const [x2, y2] = scrPts[k + step];
      const dd = (data[k + step].dt ?? 0) - (data[k].dt ?? 0);
      const col = dd > 0.003 ? CA : dd < -0.003 ? CB : NEUTRAL;
      out.push(<line key={k} x1={x1} y1={y1} x2={x2} y2={y2} stroke={col} strokeWidth={3.2}
        strokeLinecap="round" vectorEffect="non-scaling-stroke" />);
    }
    return out;
  }, [data, scrPts, step]);

  const cur = (() => {
    if (cursor == null || !data.length) return null;
    const i = Math.max(0, Math.min(Math.floor(cursor), data.length - 1));
    const f = cursor - i;
    const p1 = scrPts[i], p2 = scrPts[Math.min(i + 1, data.length - 1)] || p1;
    if (!p1) return null;
    return [p1[0] + f * (p2[0] - p1[0]), p1[1] + f * (p2[1] - p1[1])];
  })();
  const zf = view.vw / S;
  const TICK = 7;
  const secDivs = useMemo(() => {
    const perpTick = (idx) => {
      const i0 = Math.max(0, idx - step), i1 = Math.min(data.length - 1, idx + step);
      const [ax, ay] = scrPts[i0], [bx, by] = scrPts[i1];
      const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1;
      const px = -dy / L, py = dx / L;
      const [cx, cy] = scrPts[idx];
      return { x1: cx - px * TICK, y1: cy - py * TICK, x2: cx + px * TICK, y2: cy + py * TICK, cx, cy };
    };
    return [
      { idx: 0, label: "S/F", col: "var(--rc-white)" },
      ...(marks || []).map((m) => ({ idx: m.idx, label: `S${m.label.slice(-1)}`, col: "var(--rc-text-2)" })),
    ].filter((m) => data[m.idx]).map((m) => ({ ...m, ...perpTick(m.idx) }));
  }, [data, marks, scrPts, step]);
  const apexPts = useMemo(() => (apex || []).map((idx, i) => {
    const p = data[idx] ? scrPts[idx] : null;
    return p ? { no: i + 1, x: p[0], y: p[1] } : null;
  }).filter(Boolean), [data, apex, scrPts]);
  const zoomed = view.vw < S - 0.5;

  const toSvg = (clientX, clientY) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r || !r.width) return null;
    const v = viewRef.current;
    return [v.vx + ((clientX - r.left) / r.width) * v.vw, v.vy + ((clientY - r.top) / r.height) * v.vh];
  };
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const GRAB_PX = 18;
  const nearest = (clientX, clientY, rect) => {
    const r = rect || svgRef.current?.getBoundingClientRect();
    if (!r || !r.width || !data.length) return null;
    const v = viewRef.current;
    let bi = -1, bd = Infinity;
    for (let k = 0; k < scrPts.length; k++) {
      const px = r.left + ((scrPts[k][0] - v.vx) / v.vw) * r.width;
      const py = r.top + ((scrPts[k][1] - v.vy) / v.vh) * r.height;
      const d = (clientX - px) ** 2 + (clientY - py) ** 2;
      if (d < bd) { bd = d; bi = k; }
    }
    return { idx: bi, dist: Math.sqrt(bd) };
  };
  const onDown = (e) => {
    const rect = svgRef.current?.getBoundingClientRect() || null;
    const n = onScrub ? nearest(e.clientX, e.clientY, rect) : null;
    if (n && n.dist <= GRAB_PX) { drag.current = { mode: "scrub", rect }; onScrub(n.idx); }
    else { drag.current = { mode: "pan", x0: e.clientX, y0: e.clientY, v0: view, rect }; }
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e) => {
    const d0 = drag.current;
    if (!d0) return;
    if (d0.mode === "scrub") { const n = nearest(e.clientX, e.clientY, d0.rect); if (n && onScrub) onScrub(n.idx); return; }
    const r = d0.rect;
    if (!r || !r.width) return;
    const dx = -((e.clientX - d0.x0) / r.width) * d0.v0.vw;
    const dy = -((e.clientY - d0.y0) / r.height) * d0.v0.vh;
    setView(panView(d0.v0, dx, dy, S));
  };
  const onUp = () => { drag.current = null; };
  const reset = () => setView({ vx: 0, vy: 0, vw: S, vh: S });

  return (
    <div style={{ display: "flex", flexDirection: "column", position: "relative" }}>
      <svg ref={svgRef} viewBox={`${view.vx} ${view.vy} ${view.vw} ${view.vh}`}
        style={{ width: big ? undefined : "100%", maxWidth: big ? "none" : 360, height: "auto",
          margin: "0 auto", cursor: drag.current ? "grabbing" : "grab", touchAction: "none" }}
        aria-label="track map" onDoubleClick={reset}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}>
        {segs}
        {secDivs.map((m) => (
          <g key={m.label}>
            <line x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2} stroke={m.col} strokeWidth={2}
              strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            <text x={m.cx + 6 * zf} y={m.cy + 3 * zf} fill={m.col}
              fontSize={(m.label === "S/F" ? 9 : 8) * zf}>{m.label}</text>
          </g>
        ))}
        {apexPts.map((a) => (
          <text key={`ap${a.no}`} x={a.x} y={a.y} fill="var(--rc-warn-2)" fontSize={9 * zf}
            fontWeight="700" textAnchor="middle" dominantBaseline="central"
            vectorEffect="non-scaling-stroke">{a.no}</text>
        ))}
        {cur && <circle cx={cur[0]} cy={cur[1]} r={6 * zf} fill="var(--rc-ok-3)" stroke="#000"
          strokeWidth={1.4} vectorEffect="non-scaling-stroke" />}
      </svg>
      {zoomed && (
        <button style={{ position: "absolute", top: 4, right: 4, fontSize: 11, padding: "2px 8px",
          borderRadius: 8, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)",
          color: "var(--rc-text-2)", cursor: "pointer" }} onClick={reset}
          title={t("Yakınlaştırmayı sıfırla")}>⟳</button>
      )}
    </div>
  );
}

/* Tur karşılaştırma kartı — iki turu mesafe ekseninde bindirir; mini pist haritası +
   hız/gaz/fren/vites/RPM/direksiyon izleri (el-çizimi SVG) + zaman-delta + sektör/viraj
   tabloları. Yalnız gösterim. cmpData = buildCompare çıktısı. */
function TraceCompareCard({ t, sources, fallbackMeta, cmpASrc, setCmpASrc, cmpBSrc, setCmpBSrc,
  cmpA, setCmpA, cmpB, setCmpB, cmpData, cmpBusy, openImport }) {
  const [cursor, setCursor] = useState(null);
  const [cursorF, setCursorF] = useState(null);
  const [big, setBig] = useState(false);
  const [zoom, setZoom] = useState(null);   // [z0,z1] index penceresi (null = tam tur)
  const [playing, setPlaying] = useState(false);
  const [pSpeed, setPSpeed] = useState(1);
  const playPosRef = useRef(0);
  const tracesRef = useRef(null);
  const cardRef = useRef(null);
  const zoomRef = useRef(null); zoomRef.current = zoom;

  const srcOf = (k) => (sources || []).find((s) => s.key === k) || (sources || [])[0];
  const srcA = srcOf(cmpASrc), srcB = srcOf(cmpBSrc);
  const lapsA = srcA?.laps || [], lapsB = srcB?.laps || [];
  const meta = srcA?.meta || fallbackMeta;
  const multiSrc = (sources || []).length > 1;
  const srcLabel = (k) => (k === "cur" ? (srcOf(k)?.meta?.venue || t("Yüklü dosya")) : `Stint ${k}`);
  const pickFast = (laps) => {
    if (!laps?.length) return 0;
    const idx = laps.map((_, i) => i).sort((i, j) => laps[i].sec - laps[j].sec);
    const full = idx.filter((i) => !laps[i].partial);
    return (full[0] ?? idx[0]) ?? 0;
  };
  const ch = cmpData?.chans || {};
  const data = cmpData?.data;
  const N = data?.length || 0;
  const unit = cmpData?.distUnit === "frac" ? "%" : "m";

  const marks = useMemo(() => (data ? sectorMarks(data) : []), [data]);
  const apexes = useMemo(() => (data?.length
    ? detectApexes(data.map((p) => p.spA), data.map((p) => p.d)) : []), [data]);
  const corners = useMemo(() => cornerStats(data, apexes), [data, apexes]);

  const z0 = zoom ? zoom[0] : 0;
  const z1 = zoom ? zoom[1] : Math.max(0, N - 1);
  const zoomed = !!zoom;
  const cf = cursorF ?? cursor;
  const cur = Math.max(0, Math.min(N - 1, cursor ?? 0));
  const lapSecA = lapsA[cmpA]?.sec;

  const onScrub = (i) => { setPlaying(false); playPosRef.current = i; setCursorF(null); setCursor(i); };

  /* oynatma — imleci tur A süresi boyunca ilerletir (kesirli → akıcı) */
  useEffect(() => {
    if (!playing || N < 2) return undefined;
    const id = setInterval(() => {
      playPosRef.current = advanceCursor(playPosRef.current, N, lapSecA, pSpeed, 40);
      setCursorF(playPosRef.current);
      setCursor(Math.round(playPosRef.current));
    }, 40);
    return () => clearInterval(id);
  }, [playing, pSpeed, N, lapSecA]);
  useEffect(() => { setPlaying(false); playPosRef.current = 0; setCursorF(null); }, [cmpA, cmpB]);
  useEffect(() => {
    if (!big) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setBig(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [big]);

  /* kanalların üstünde native (passive:false) tekerlek → mesafe penceresini imleç
     etrafında daralt/genişlet (index tabanlı, fişteki onTraceWheel mantığı). */
  useEffect(() => {
    const el = tracesRef.current;
    if (!el || N < 2) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      const svg = e.target.closest && e.target.closest("svg");
      const r = (svg || el).getBoundingClientRect();
      const f = Math.min(1, Math.max(0, (e.clientX - r.left) / (r.width || 1)));
      const [c0, c1] = zoomRef.current || [0, N - 1];
      const anchor = c0 + f * (c1 - c0);
      const span = c1 - c0;
      const next = Math.max(30, Math.min(N - 1, Math.round(span * (e.deltaY > 0 ? 1.25 : 0.8))));
      let a = Math.round(anchor - f * next);
      a = Math.max(0, Math.min(N - 1 - next, a));
      setZoom(a <= 0 && a + next >= N - 1 ? null : [a, a + next]);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [N]);

  const onTraceMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (e.clientX - r.left) / (r.width || 1)));
    setPlaying(false); setCursorF(null); setCursor(Math.round(z0 + f * (z1 - z0)));
  };

  /* mini pist haritası geometrisi (statik — imleçten bağımsız) */
  const mini = useMemo(() => {
    if (!cmpData?.hasMap || !data?.length) return null;
    const S = 240, PAD = 16;
    const xs = data.map((d) => d.mapX), ys = data.map((d) => d.mapY);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const spanX = (maxX - minX) || 1, spanY = (maxY - minY) || 1;
    const sc = Math.min((S - 2 * PAD) / spanX, (S - 2 * PAD) / spanY);
    const ox = (S - spanX * sc) / 2, oy = (S - spanY * sc) / 2;
    const scr = (i) => [ox + (data[i].mapX - minX) * sc, S - (oy + (data[i].mapY - minY) * sc)];
    const segs = [];
    for (let i = 0; i + 3 < data.length; i += 3) {
      const [x1, y1] = scr(i), [x2, y2] = scr(Math.min(i + 3, N - 1));
      const dd = (data[Math.min(i + 3, N - 1)].dt ?? 0) - (data[i].dt ?? 0);
      segs.push({ x1, y1, x2, y2, c: dd > 0.003 ? CA : dd < -0.003 ? CB : NEUTRAL });
    }
    const perp = (m) => {
      const p0 = scr(m.i), p1 = scr(Math.min(m.i + 3, N - 1));
      const dx = p1[0] - p0[0], dy = p1[1] - p0[1], L = Math.hypot(dx, dy) || 1;
      const px = -dy / L * 7, py = dx / L * 7;
      return { label: m.label, c: m.c, x1: p0[0] - px, y1: p0[1] - py, x2: p0[0] + px, y2: p0[1] + py,
        tx: p0[0] + 7, ty: p0[1] + 3 };
    };
    const markPts = [
      { i: 0, label: "S/F", c: "var(--rc-white)" },
      { i: Math.floor(N / 3), label: "S2", c: "var(--rc-text-2)" },
      { i: Math.floor((2 * N) / 3), label: "S3", c: "var(--rc-text-2)" },
    ].map(perp);
    const apexPts = apexes.map((i, k) => { const [x, y] = scr(i); return { no: k + 1, x, y }; });
    return { scr, segs, markPts, apexPts };
  }, [cmpData, data, N, apexes]);
  const miniCur = mini ? mini.scr(cur) : null;

  const lapOpt = (l, i) => (
    <option key={i} value={i}>Lap {l.lap} · {fmtLap(l.sec)}{l.partial ? ` (${t("kısmi")})` : ""}</option>
  );

  /* PDF: karttaki SVG'leri (harita + izler) serialize edip gizli iframe'e yaz → print. */
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
        <td style="font-weight:600">${dlt(s.diff)}</td></tr>`).join("");
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
<div class="sub">${esc(t("Tur karşılaştırma"))} — A ${esc(lapTxt(lapsA, cmpA))}
  · B ${esc(lapTxt(lapsB, cmpB))} · Δ ${esc(dlt(cmpData.totalDelta))}</div>
${cond ? `<div class="meta">${cond}</div>` : ""}
${svgs}
<table><thead><tr><th>${esc(t("Sektör"))}</th><th>A</th><th>B</th><th>Δ</th></tr></thead>
<tbody>${secRows}</tbody></table>
<div class="foot">Caspian Race Monitor · ${new Date().toLocaleString()}</div>
<scr${""}ipt>window.onload=function(){window.print()}</scr${""}ipt></body></html>`);
    doc.close();
  };

  /* --- yeniden kullanılan tablo başlık stilleri (fiş thB deseninden) --- */
  const th = { color: "var(--rc-text-3)", fontSize: 10, textTransform: "uppercase",
    letterSpacing: ".1em", textAlign: "right", padding: "9px 12px",
    borderBottom: "1px solid var(--rc-border)", fontWeight: 600 };
  const thLeft = { ...th, textAlign: "left" };
  const thA = { ...th, color: CA };
  const thB = { ...th, color: CB };

  const totalDelta = cmpData?.totalDelta ?? 0;
  const cmpSec = data?.length ? Math.min(3, Math.floor(cur / (N / 3)) + 1) : 1;
  const cursorCells = data?.length ? [
    ch.speed && { label: t("Hız"), a: Math.round(data[cur].spA), b: Math.round(data[cur].spB), d: Math.round(data[cur].spA - data[cur].spB) },
    ch.throttle && { label: t("Gaz"), a: `%${Math.round(data[cur].thA)}`, b: `%${Math.round(data[cur].thB)}` },
    ch.brake && { label: t("Fren"), a: `%${Math.round(data[cur].brA)}`, b: `%${Math.round(data[cur].brB)}` },
    ch.gear && { label: t("Vites"), a: data[cur].gA, b: data[cur].gB },
    ch.rpm && { label: t("RPM"), a: Math.round(data[cur].rpmA), b: Math.round(data[cur].rpmB) },
    ch.steer && { label: t("Direksiyon"), a: data[cur].stA?.toFixed(1), b: data[cur].stB?.toFixed(1) },
  ].filter(Boolean) : [];

  /* iz kanalı tanımları — mevcut olanlar (cmpData.chans) sırayla */
  const TRACE_DEFS = data?.length ? [
    { title: `⏱ ${t("Zaman-Delta (B−A)")}`, a: "dt", fmt: dlt, h: 140, zero: true, solo: true },
    ch.speed && { title: `🏁 ${t("Hız")} (km/h)`, a: "spA", b: "spB", fmt: sp1, h: 132 },
    ch.throttle && { title: `🟢 ${t("Gaz")} %`, a: "thA", b: "thB", fmt: pct, h: 110 },
    ch.brake && { title: `🔴 ${t("Fren")} %`, a: "brA", b: "brB", fmt: pct, h: 110 },
    ch.gear && { title: `⚙ ${t("Vites")}`, a: "gA", b: "gB", fmt: int0, h: 100 },
    ch.rpm && { title: `🔧 ${t("RPM")}`, a: "rpmA", b: "rpmB", fmt: int0, h: 100 },
    ch.steer && { title: `🕹 ${t("Direksiyon")}`, a: "stA", b: "stB", fmt: sp1, h: 100 },
  ].filter(Boolean) : [];

  const traceGeom = (def) => {
    const h = def.h;
    const win = data.slice(z0, z1 + 1);
    const n = win.length;
    if (n < 2) return null;
    const vals = win.map((p) => p[def.a]);
    const valsB = def.b ? win.map((p) => p[def.b]) : null;
    const all = (valsB ? vals.concat(valsB) : vals).filter((v) => v != null);
    const lo = all.length ? Math.min(...all) : 0;
    const hi = all.length ? Math.max(...all) : 1;
    const span = (hi - lo) || 1;
    const yN = (v) => h - 6 - ((v - lo) / span) * (h - 12);
    const y = (v) => yN(v).toFixed(1);
    const xN = (i) => (i / (n - 1)) * 720;
    const poly = (arr) => arr.map((v, i) => (v == null ? null : `${xN(i).toFixed(1)},${y(v)}`)).filter(Boolean).join(" ");
    const zY = yN(0);
    const area = (sign) => {
      let d = "", open = false;
      vals.forEach((v, i) => {
        const inSide = sign > 0 ? v > 0 : v < 0;
        if (inSide && !open) { d += `M${xN(i).toFixed(1)} ${zY.toFixed(1)} `; open = true; }
        if (inSide) d += `L${xN(i).toFixed(1)} ${y(v)} `;
        if (!inSide && open) { d += `L${xN(i - 1).toFixed(1)} ${zY.toFixed(1)} Z `; open = false; }
      });
      if (open) d += `L${xN(n - 1).toFixed(1)} ${zY.toFixed(1)} Z`;
      return d;
    };
    const ci = Math.min(n - 1, Math.max(0, cur - z0));
    const cursorX = (xN(ci)).toFixed(1);
    const solo = !!def.solo;
    return {
      h, h2: h - 4, range: `${def.fmt(lo)} – ${def.fmt(hi)}`,
      marks: [1, 2].map((k) => (((k / 3) * 720).toFixed(1))),
      zeroY: y(0), showZero: !!def.zero,
      ptsA: poly(vals), ptsB: valsB ? poly(valsB) : "", hasB: !!valsB,
      colA: solo ? "var(--rc-warn-2)" : CA,
      fill: def.zero && solo, fillPos: def.zero && solo ? area(1) : "", fillNeg: def.zero && solo ? area(-1) : "",
      cursorX, curAY: y(vals[ci] ?? lo), curBY: valsB ? y(valsB[ci] ?? lo) : "0",
      curAVal: def.fmt(vals[ci]), curBVal: valsB ? def.fmt(valsB[ci]) : "",
      valX: (xN(ci) + (ci / (n - 1) > 0.7 ? -8 : 8)).toFixed(1),
      valX2: (xN(ci) + (ci / (n - 1) > 0.7 ? -54 : 54)).toFixed(1),
      valAnchor: ci / (n - 1) > 0.7 ? "end" : "start",
    };
  };

  const scrubVal = Math.round(((cur - z0) / Math.max(1, z1 - z0)) * 100);
  const sel = { background: "var(--rc-surface-3)", border: "1px solid var(--rc-border)",
    borderRadius: 8, color: "var(--rc-text)", padding: "6px 9px", fontSize: 12 };
  const cardHdrTtl = { fontFamily: DISP, textTransform: "uppercase", letterSpacing: ".08em",
    fontSize: 16, fontWeight: 700 };

  return (
    <div ref={cardRef} style={{ border: "1px solid var(--rc-border)", borderRadius: 12,
      background: "var(--rc-surface)", marginTop: 16, overflow: "hidden" }}>
      {/* başlık şeridi */}
      <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "13px 16px",
        borderBottom: "1px solid var(--rc-border)", flexWrap: "wrap" }}>
        <span style={cardHdrTtl}>🔬 {t("Tur karşılaştırma")}</span>
        {cmpData && Number.isFinite(totalDelta) && (
          <span style={{ fontSize: 12, padding: "3px 11px", borderRadius: 99, fontFamily: DISP,
            border: `1px solid ${totalDelta > 0 ? CA : CB}`, color: totalDelta > 0 ? CA : CB }}>
            Δ {dlt(totalDelta)}</span>
        )}
        {cmpData && (
          <span style={{ fontSize: 12, padding: "3px 11px", borderRadius: 99,
            border: "1px solid var(--rc-border)", color: "var(--rc-text-2)" }}>
            📍 {t("Sektör")} S{cmpSec}</span>
        )}
        <button onClick={exportTelePdf} style={{ marginLeft: "auto", padding: "7px 13px",
          borderRadius: 9, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)",
          color: "var(--rc-text-2)", cursor: "pointer", fontSize: 12 }}>📄 PDF</button>
      </div>

      {/* A / B tur seçiciler */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
        padding: "12px 16px", borderBottom: "1px solid var(--rc-line-soft)" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
          <i style={{ width: 11, height: 11, borderRadius: 3, background: CA, display: "inline-block" }} />
          <b style={{ fontSize: 13 }}>A</b>
          {multiSrc && (
            <select value={cmpASrc} style={sel} onChange={(e) => { setCmpASrc(e.target.value);
              setCmpA(pickFast(srcOf(e.target.value)?.laps)); }}>
              {sources.map((s) => <option key={s.key} value={s.key}>{srcLabel(s.key)}</option>)}
            </select>
          )}
          <select value={cmpA ?? 0} style={sel} onChange={(e) => setCmpA(+e.target.value)}>{lapsA.map(lapOpt)}</select>
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
          <i style={{ width: 11, height: 11, borderRadius: 3, background: CB, display: "inline-block" }} />
          <b style={{ fontSize: 13 }}>B</b>
          {multiSrc && (
            <select value={cmpBSrc} style={sel} onChange={(e) => { setCmpBSrc(e.target.value);
              setCmpB(pickFast(srcOf(e.target.value)?.laps)); }}>
              {sources.map((s) => <option key={s.key} value={s.key}>{srcLabel(s.key)}</option>)}
            </select>
          )}
          <select value={cmpB ?? 0} style={sel} onChange={(e) => setCmpB(+e.target.value)}>{lapsB.map(lapOpt)}</select>
        </span>
        {meta && (meta.venue || meta.trk != null || meta.amb != null) && (
          <span style={{ fontSize: 11, color: "var(--rc-text-3)", marginLeft: "auto" }}>
            {meta.venue && <>🏁 {meta.venue} </>}
            {meta.vehicle && <>· 🚗 {meta.vehicle} </>}
            {meta.driver && <>· 👤 {meta.driver} </>}
            {meta.trk != null && <>· 🛣 {meta.trk.toFixed(0)}° </>}
            {meta.amb != null && <>/ 🌡 {meta.amb.toFixed(0)}°</>}
          </span>
        )}
      </div>

      {cmpBusy && <div style={{ padding: "12px 16px", fontSize: 12, color: "var(--rc-text-3)" }}>⏳ {t("İzler hazırlanıyor…")}</div>}
      {!cmpBusy && !cmpData && (
        <div style={{ padding: "12px 16px", fontSize: 12, color: "var(--rc-text-3)" }}>
          {t("İz verisi çıkarılamadı — bu dosyada hız/mesafe kanalı olmayabilir.")}</div>
      )}

      {cmpData && (<>
        {/* oynatma çubuğu */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
          padding: "11px 16px", borderBottom: "1px solid var(--rc-line-soft)" }}>
          <button onClick={() => setPlaying((p) => !p)} style={{ width: 38, height: 32, borderRadius: 9,
            cursor: "pointer", fontSize: 13, border: `1px solid ${playing ? "var(--rc-ok)" : "var(--rc-border)"}`,
            background: playing ? "rgba(55,214,122,.14)" : "var(--rc-surface-3)",
            color: playing ? "var(--rc-ok)" : "var(--rc-text)" }} title={t("Telemetriyi oynat")}>
            {playing ? "⏸" : "▶"}</button>
          <span style={{ display: "flex", gap: 4 }}>
            {[0.5, 1, 2].map((v) => (
              <button key={v} onClick={() => setPSpeed(v)} style={{ padding: "6px 11px", borderRadius: 8,
                cursor: "pointer", fontSize: 11.5, border: `1px solid ${pSpeed === v ? "var(--rc-brand-bright)" : "var(--rc-border)"}`,
                background: pSpeed === v ? "var(--rc-glow-brand)" : "var(--rc-surface-3)",
                color: pSpeed === v ? "var(--rc-text)" : "var(--rc-text-3)" }}>{v}×</button>
            ))}
          </span>
          <input type="range" min={0} max={100} value={scrubVal}
            onChange={(e) => { setPlaying(false); playPosRef.current = Math.round(z0 + (+e.target.value / 100) * (z1 - z0));
              setCursorF(null); setCursor(playPosRef.current); }}
            style={{ flex: "1 1 180px", minWidth: 140, accentColor: "var(--rc-ok)" }} aria-label={t("Konum")} />
          <span style={{ fontFamily: DISP, fontSize: 12, color: "var(--rc-text-3)", whiteSpace: "nowrap" }}>
            {data?.length ? Math.round(data[cur].d) : 0} {unit} · Δ {data?.length ? dlt(data[cur].dt) : "—"}</span>
          {zoomed && (
            <span style={{ fontSize: 11, padding: "5px 11px", borderRadius: 99, border: "1px solid var(--rc-warn)",
              color: "var(--rc-warn)", whiteSpace: "nowrap" }}>
              🔍 {`${Math.round(data[z0].d)}–${Math.round(data[z1].d)} ${unit}`}
              <button onClick={() => setZoom(null)} style={{ marginLeft: 8, background: "none", border: "none",
                color: "var(--rc-warn)", cursor: "pointer", fontSize: 11, padding: 0, textDecoration: "underline" }}>
                {t("sıfırla")}</button></span>
          )}
          {cmpData.hasMap && (
            <button onClick={() => setBig(true)} style={{ padding: "6px 12px", borderRadius: 8,
              border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text-2)",
              cursor: "pointer", fontSize: 11.5, whiteSpace: "nowrap" }}>⛶ {t("Büyüt")}</button>
          )}
          <span style={{ fontSize: 10.5, color: "var(--rc-border-hi)", whiteSpace: "nowrap" }}>
            {t("← → adım · Space oynat · tekerlek yakınlaştır")}</span>
        </div>

        {/* imleç değer rozetleri */}
        {cursorCells.length > 0 && (
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", padding: "11px 16px",
            borderBottom: "1px solid var(--rc-line-soft)" }}>
            {cursorCells.map((c) => (
              <span key={c.label} style={{ display: "inline-flex", alignItems: "baseline", gap: 6,
                padding: "4px 11px", borderRadius: 99, border: "1px solid var(--rc-border)",
                fontSize: 11.5, background: "var(--rc-surface-3)" }}>
                <span style={{ color: "var(--rc-text-3)" }}>{c.label}</span>
                <b style={{ color: CA, fontFamily: DISP }}>{c.a}</b>
                <span style={{ color: "var(--rc-border-strong)" }}>/</span>
                <b style={{ color: CB, fontFamily: DISP }}>{c.b}</b>
                {c.d != null && <span style={{ color: "var(--rc-text-3)", fontSize: 10.5 }}>
                  ({c.d >= 0 ? "+" : ""}{c.d})</span>}
              </span>
            ))}
          </div>
        )}

        {/* mini harita + iz kanalları */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, padding: "14px 16px" }}>
          {mini && (
            <div style={{ flex: "0 1 320px", minWidth: 260 }}>
              <svg viewBox="0 0 240 240" style={{ width: "100%", height: "auto", display: "block" }}>
                {mini.segs.map((s, i) => (
                  <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={s.c} strokeWidth={3.4} strokeLinecap="round" />
                ))}
                {mini.markPts.map((m) => (
                  <g key={m.label}>
                    <line x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2} stroke={m.c} strokeWidth={2} strokeLinecap="round" />
                    <text x={m.tx} y={m.ty} fill={m.c} fontSize={8}>{m.label}</text>
                  </g>
                ))}
                {mini.apexPts.map((a) => (
                  <text key={a.no} x={a.x} y={a.y} fill="var(--rc-warn-2)" fontSize={9} fontWeight="700"
                    textAnchor="middle" dominantBaseline="central">{a.no}</text>
                ))}
                {miniCur && <circle cx={miniCur[0]} cy={miniCur[1]} r={6} fill="var(--rc-ok-3)" stroke="#000" strokeWidth={1.2} />}
              </svg>
              <div style={{ textAlign: "center", fontSize: 11, color: "var(--rc-text-3)", marginTop: 5 }}>
                <span style={{ color: CA }}>■</span> {t("A hızlı")} · <span style={{ color: CB }}>■</span> {t("B hızlı")} · {t("konum kanalından")}
              </div>
            </div>
          )}
          {!mini && (
            <div style={{ flex: "0 1 320px", minWidth: 260, fontSize: 12, color: "var(--rc-text-3)" }}>
              🗺 {t("Pist haritası çizilemedi — bu dosyada konum ya da yanal-G kanalı yok.")}</div>
          )}

          <div ref={tracesRef} style={{ flex: "1 1 420px", minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            {TRACE_DEFS.map((def) => {
              const g = traceGeom(def);
              if (!g) return null;
              return (
                <div key={def.title}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--rc-text-2)" }}>{def.title}</span>
                    <span style={{ marginLeft: "auto", fontFamily: DISP, fontSize: 10.5, color: "var(--rc-text-3)" }}>{g.range}</span>
                  </div>
                  <svg viewBox={`0 0 720 ${g.h}`} onMouseMove={onTraceMove}
                    style={{ width: "100%", height: "auto", display: "block", background: "var(--rc-surface-2)",
                      border: "1px solid var(--rc-line-soft)", borderRadius: 8, cursor: "crosshair", touchAction: "none" }}>
                    {g.marks.map((mx, i) => (
                      <line key={i} x1={mx} y1={4} x2={mx} y2={g.h2} stroke="var(--rc-border-strong)" strokeWidth={1} strokeDasharray="2 3" />
                    ))}
                    {g.showZero && <line x1={0} y1={g.zeroY} x2={720} y2={g.zeroY} stroke="var(--rc-border)" strokeWidth={1} strokeDasharray="4 4" />}
                    {g.fill && <path d={g.fillPos} fill="rgba(255,84,112,.22)" />}
                    {g.fill && <path d={g.fillNeg} fill="rgba(77,159,255,.22)" />}
                    {g.hasB && <polyline points={g.ptsB} fill="none" stroke={CB} strokeWidth={1.7} strokeLinejoin="round" />}
                    <polyline points={g.ptsA} fill="none" stroke={g.colA} strokeWidth={1.9} strokeLinejoin="round" />
                    <line x1={g.cursorX} y1={0} x2={g.cursorX} y2={g.h} stroke="var(--rc-ok-3)" strokeWidth={1.4} />
                    <circle cx={g.cursorX} cy={g.curAY} r={3.2} fill={g.colA} />
                    {g.hasB && <circle cx={g.cursorX} cy={g.curBY} r={3.2} fill={CB} />}
                    <text x={g.valX} y={14} textAnchor={g.valAnchor} fill={g.colA} fontSize={11.5} fontWeight="700" fontFamily={DISP}>{g.curAVal}</text>
                    {g.hasB && <text x={g.valX2} y={14} textAnchor={g.valAnchor} fill={CB} fontSize={11.5} fontWeight="700" fontFamily={DISP}>{g.curBVal}</text>}
                  </svg>
                </div>
              );
            })}
          </div>
        </div>

        {/* sektör farkı + viraj analizi tabloları */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, padding: "0 16px 16px" }}>
          <div style={{ flex: "1 1 300px", minWidth: 260 }}>
            <div style={{ fontFamily: DISP, textTransform: "uppercase", letterSpacing: ".08em",
              fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{t("Sektör farkı")}</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={thLeft}>{t("Sektör")}</th><th style={thA}>A</th><th style={thB}>B</th><th style={th}>Δ</th>
              </tr></thead>
              <tbody>
                {cmpData.sectors.map((s) => (
                  <tr key={s.sec}>
                    <td style={{ padding: "8px 12px", borderBottom: "1px solid var(--rc-line-soft)", textAlign: "left",
                      fontFamily: DISP, fontWeight: 700, fontSize: 15 }}>S{s.sec}</td>
                    <td style={{ padding: "8px 12px", borderBottom: "1px solid var(--rc-line-soft)", textAlign: "right",
                      fontFamily: DISP, fontSize: 12.5, color: "var(--rc-text-2)" }}>{s.dA.toFixed(3)}</td>
                    <td style={{ padding: "8px 12px", borderBottom: "1px solid var(--rc-line-soft)", textAlign: "right",
                      fontFamily: DISP, fontSize: 12.5, color: "var(--rc-text-2)" }}>{s.dB.toFixed(3)}</td>
                    <td style={{ padding: "8px 12px", borderBottom: "1px solid var(--rc-line-soft)", textAlign: "right",
                      fontFamily: DISP, fontSize: 12.5, fontWeight: 600, color: s.diff > 0 ? CA : CB }}>
                      {`${s.diff >= 0 ? "+" : ""}${s.diff.toFixed(3)}s`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ fontSize: 10.5, color: "var(--rc-border-strong)", marginTop: 6, lineHeight: 1.5 }}>
              {t("Sektörler tur-kesri üçlüsüdür; gerçek S/F beacon'ı değil.")}</div>
          </div>

          <div style={{ flex: "1 1 420px", minWidth: 0 }}>
            <div style={{ fontFamily: DISP, textTransform: "uppercase", letterSpacing: ".08em",
              fontSize: 13, fontWeight: 700, marginBottom: 8 }}>🏁 {t("Viraj analizi")}</div>
            {corners.length > 0 ? (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 420 }}>
                  <thead><tr>
                    <th style={thLeft}>{t("Viraj")}</th><th style={th}>{t("Mesafe")}</th>
                    <th style={thA}>A {t("apex")}</th><th style={thB}>B {t("apex")}</th><th style={th}>Δ</th>
                    <th style={thA}>A {t("fren")}</th><th style={thB}>B {t("fren")}</th>
                  </tr></thead>
                  <tbody>
                    {corners.map((c) => {
                      const spD = (c.aMin != null && c.bMin != null) ? Math.round(c.aMin - c.bMin) : null;
                      const bd = (v) => (v == null ? "—" : `${Math.round(v)} ${unit}`);
                      const tdBase = { padding: "8px 12px", borderBottom: "1px solid var(--rc-line-soft)",
                        textAlign: "right", fontFamily: DISP, fontSize: 12, color: "var(--rc-text-2)" };
                      return (
                        <tr key={c.no}>
                          <td style={{ padding: "8px 12px", borderBottom: "1px solid var(--rc-line-soft)",
                            textAlign: "left", fontWeight: 700, color: "var(--rc-warn-2)", fontSize: 13 }}>{c.no}</td>
                          <td style={tdBase}>{Math.round(c.apexD)} {unit}</td>
                          <td style={tdBase}>{c.aMin != null ? Math.round(c.aMin) : "—"}</td>
                          <td style={tdBase}>{c.bMin != null ? Math.round(c.bMin) : "—"}</td>
                          <td style={{ ...tdBase, fontWeight: 600, color: spD == null ? "var(--rc-text-2)" : spD >= 0 ? CA : CB }}>
                            {spD == null ? "—" : `${spD >= 0 ? "+" : ""}${spD}`}</td>
                          <td style={tdBase}>{bd(c.aBrakeDist)}</td>
                          <td style={tdBase}>{bd(c.bBrakeDist)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "var(--rc-text-3)" }}>{t("Viraj tespit edilemedi — hız/fren kanalı gerekli.")}</div>
            )}
            <div style={{ fontSize: 10.5, color: "var(--rc-border-strong)", marginTop: 6, lineHeight: 1.5 }}>
              {t("apex = viraj ortası (en düşük hız); fren = fren başından apex'e mesafe. Sezgisel tespit.")}</div>
          </div>
        </div>
      </>)}

      {big && cmpData?.hasMap && (
        <div onClick={() => setBig(false)} role="dialog" aria-modal="true"
          style={{ position: "fixed", inset: 0, zIndex: 60, background: "var(--rc-scrim-strong)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--rc-surface)",
            border: "1px solid var(--rc-border-strong)", borderRadius: 14, padding: 16, maxWidth: 680, width: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={cardHdrTtl}>🗺 {t("Pist haritası")}</span>
              <button onClick={() => setBig(false)} style={{ marginLeft: "auto", padding: "2px 10px", borderRadius: 8,
                border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text-2)",
                cursor: "pointer", fontSize: 12 }} title={t("Kapat")}>✕</button>
            </div>
            <TrackMini t={t} data={cmpData.data} cursor={cf} marks={marks} apex={apexes} onScrub={onScrub} big />
          </div>
        </div>
      )}
    </div>
  );
}

/* Telemetri sekmesi — MoTeC içe aktarma, stint analizi + grafikler, tur karşılaştırma.
   Tüm state/derived (parsed/slotStats/chartData/loadedSlots/baseSlot) ve handler'lar
   App'ten prop gelir; veri katmanı değişmez. */
export default function TeleTab({
  t, lang, st, slot, setSlot, rawTele, setRawTele, doParse, onTeleFile,
  parsed, mapping, setMapping, saveMotec, saveSlot, loadedSlots, slotStats,
  up, apply105Slot, removeSlot, chartMode, setChartMode, chartData, baseSlot, toggleLap,
  cmpMeta, cmpA, setCmpA, cmpB, setCmpB, cmpData, cmpBusy, savedMsg,
  cmpSources, cmpASrc, setCmpASrc, cmpBSrc, setCmpBSrc, onSaveDuckSetup, standalone,
}) {
  const fileRef = useRef(null);
  const openImport = () => fileRef.current?.click();
  const [colMap, setColMap] = useState(false);

  /* yapıştırma alanı debounce'u (parseMotecLog ağır) — yazma durunca (300ms) koşar */
  const parseTimerRef = useRef(null);
  useEffect(() => () => clearTimeout(parseTimerRef.current), []);
  const onRawChange = (e) => {
    const v = e.target.value;
    setRawTele(v);
    clearTimeout(parseTimerRef.current);
    parseTimerRef.current = setTimeout(() => doParse(v), 300);
  };

  const parsedHasTable = !!(parsed && !parsed.loading && !parsed.error && parsed.motec);
  const parsedHasMap = !!(parsed && !parsed.loading && !parsed.error && !parsed.motec && mapping && parsed.lapRows?.length);
  const teleEmpty = loadedSlots.length === 0 && !parsedHasTable && !parsedHasMap
    && !(cmpSources?.length) && !parsed?.loading;

  const chartLine = chartMode === "line";

  /* --- kutu/tur-tur grafiği: yüklü stintlerin turlarından (saniye) --- */
  const boxes = useMemo(() => {
    const rows = loadedSlots.map((id) => {
      const laps = (st.telemetry[id]?.laps || []).filter((l) => l.use).map((l) => l.ms / 1000);
      return { id, laps, c: SLOT_COLORS[id] };
    }).filter((r) => r.laps.length);
    if (!rows.length) return { rows: [], lo: 0, hi: 1 };
    const all = rows.flatMap((r) => r.laps);
    const lo = Math.min(...all), hi = Math.max(...all);
    const pad = (hi - lo) * 0.08 || 0.5;
    return {
      rows: rows.map((r) => {
        const v = [...r.laps].sort((a, b) => a - b);
        return { ...r, min: v[0], max: v[v.length - 1],
          q1: quantile(v, 0.25), med: quantile(v, 0.5), q3: quantile(v, 0.75), n: v.length };
      }),
      lo: lo - pad, hi: hi + pad,
    };
  }, [loadedSlots, st.telemetry]);

  const BOX_LO = boxes.lo, BOX_HI = boxes.hi;
  const by = (v) => 240 - ((v - BOX_LO) / (BOX_HI - BOX_LO || 1)) * 220;
  const gridLines = [0, 1, 2, 3].map((i) => {
    const v = BOX_LO + (i / 3) * (BOX_HI - BOX_LO);
    const y = by(v);
    return { y: y.toFixed(1), ty: (y + 4).toFixed(1), label: fmtLapSec(v) };
  });
  const maxLen = Math.max(1, ...boxes.rows.map((r) => r.n));
  const xTicks = Array.from({ length: Math.min(7, maxLen) }, (_, k) => {
    const idx = Math.round((k / Math.max(1, Math.min(7, maxLen) - 1)) * (maxLen - 1));
    return { x: (60 + (idx / Math.max(1, maxLen - 1)) * 740).toFixed(1), label: String(idx + 1) };
  });

  /* özet kutucukları — mevcut slotStats'tan türetildi (fiş sabit demo değerler) */
  const bs = slotStats[baseSlot] || {};
  const other = loadedSlots.find((sl) => sl !== baseSlot && slotStats[sl] && !slotStats[sl].empty);
  const delta1 = other ? (bs.avgMs - slotStats[other].avgMs) / 1000 : null;

  /* --- seçili yuvanın seans bilgisi --- */
  const sMeta = st.telemetry[slot]?.src;
  const sStat = slotStats[slot];
  const trackId = sMeta?.venue ? venueToTrackId(sMeta.venue) : "";
  const carLogo = sMeta?.vehicle ? brandLogo(sMeta.vehicle) : "";
  const sessRows = [
    { k: t("Pist"), v: sMeta?.venue || "—" },
    { k: t("Araç"), v: sMeta?.vehicle || "—" },
    { k: t("Pilot"), v: sMeta?.driver || "—" },
    { k: t("Sıcaklık"), v: sMeta?.trk != null ? `🛣 ${sMeta.trk.toFixed(0)}° / 🌡 ${sMeta.amb != null ? sMeta.amb.toFixed(0) + "°" : "—"}` : "—", mono: true },
    { k: t("Turlar"), v: sStat && !sStat.empty ? `${sStat.laps} ${t("tur")}` : "—" },
  ];
  const hideImg = (e) => { e.currentTarget.style.display = "none"; };

  /* çözümlenen turlar: parsed.laps (en iyi turu vurgula) */
  const parsedLaps = parsed?.laps || [];
  const bestSec = parsedLaps.length
    ? Math.min(...parsedLaps.filter((l) => !l.partial && !l.pit).map((l) => l.sec).concat([Infinity]))
    : Infinity;
  const parsedMeta = parsed?.meta
    ? [parsed.meta.venue, parsed.meta.vehicle, parsed.meta.driver].filter(Boolean).join(" · ") : "";

  /* --- yeniden kullanılan tablo stilleri (fiş th deseninden) --- */
  const th = { color: "var(--rc-text-3)", fontSize: 10, textTransform: "uppercase",
    letterSpacing: ".1em", textAlign: "right", padding: "9px 12px",
    borderBottom: "1px solid var(--rc-border)", fontWeight: 600 };
  const thLeft = { ...th, textAlign: "left" };
  const td = { padding: "8px 14px", borderBottom: "1px solid var(--rc-line-soft)", textAlign: "right",
    fontFamily: DISP, fontSize: 12, color: "var(--rc-text-2)" };
  const tile = { flex: "1 1 180px", background: "var(--rc-surface-3)", border: "1px solid var(--rc-border)",
    borderRadius: 10, padding: "11px 14px" };
  const tileLbl = { color: "var(--rc-text-3)", fontSize: 10, textTransform: "uppercase",
    letterSpacing: ".09em", marginTop: 3 };
  const uploadBtn = { padding: "8px 16px", borderRadius: 9, border: "1px solid var(--rc-brand-bright)",
    background: "var(--rc-brand)", color: "var(--rc-on-brand)", cursor: "pointer", fontSize: 13, fontWeight: 600 };
  const saveBtn = () => { if (parsed?.motec) saveMotec(); else saveSlot(); };

  return (
    <div style={{ padding: "18px 20px 40px", animation: "rcin .26s ease-out" }}>
      <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,.ld,.duckdb" onChange={onTeleFile}
        style={{ display: "none" }} />

      {/* ══════════ başlık ══════════ */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontFamily: DISP, textTransform: "uppercase", letterSpacing: ".06em",
          fontSize: 22, fontWeight: 700 }}>{t("Telemetri")}</h2>
        <span style={{ color: "var(--rc-text-3)", fontSize: 12 }}>MoTeC · .ld · .duckdb · CSV</span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button onClick={openImport} data-tour="teleimport" style={uploadBtn}>⬆ {t("Telemetri yükle")}</button>
        </span>
      </div>

      {/* MoTeC yapıştırma (fişte yok — CSV/TSV yapıştırma yolunu korumak için; FLAG) */}
      <details style={{ marginBottom: 14 }}>
        <summary style={{ cursor: "pointer", color: "var(--rc-text-3)", fontSize: 12 }}>
          {t("MoTeC tur istatistiklerini yapıştır (CSV/TSV)")}</summary>
        <textarea value={rawTele} onChange={onRawChange}
          placeholder={"Out Lap\t310127\t-6.403 ...\nLap 1\t237350\t-6.36 ..."}
          style={{ width: "100%", boxSizing: "border-box", height: 84, marginTop: 8,
            background: "var(--rc-surface-2)", border: "1px solid var(--rc-border)", borderRadius: 8,
            color: "var(--rc-text)", fontFamily: "var(--rc-font-mono)", fontSize: 11, padding: 8 }} />
      </details>
      {parsed?.loading && (
        <div style={{ fontSize: 12, color: "var(--rc-text-3)", marginBottom: 12 }}>
          ⏳ {parsed.duck ? t("DuckDB çözümleniyor (ilk açılışta motor indirilir)…") : t(".ld çözümleniyor…")}</div>
      )}
      {parsed?.error && (
        <div style={{ fontSize: 12, color: "var(--rc-warn)", marginBottom: 12 }}>⚠ {t(parsed.error)}</div>
      )}

      {/* ══════════ boş durum ══════════ */}
      {teleEmpty && (
        <div style={{ border: "1.5px dashed var(--rc-border-strong)", borderRadius: 14,
          background: "var(--rc-surface-2)", padding: "48px 24px", textAlign: "center",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 11, marginBottom: 16 }}>
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--rc-border-strong)"
            strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4v16h16"></path><path d="m7 14 3-3 3 2 4-5"></path></svg>
          <div style={{ fontFamily: DISP, fontWeight: 700, fontSize: 20 }}>{t("Henüz telemetri yok")}</div>
          <div style={{ fontSize: 12.5, color: "var(--rc-text-3)", lineHeight: 1.7, maxWidth: 430 }}>
            {t("Stint yuvalarına .ld veya .duckdb dosyası yükle; iki turu karşılaştırmak için en az bir dosya gerekir.")}</div>
          <button onClick={openImport} style={{ ...uploadBtn, marginTop: 4, padding: "9px 18px", borderRadius: 10 }}>
            ⬆ {t("Telemetri yükle")}</button>
        </div>
      )}

      {/* ══════════ stint yuvaları ══════════ */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        {["A", "B", "C", "D"].map((sl) => {
          const loaded = !!st.telemetry[sl];
          const stt = slotStats[sl];
          const has = loaded && stt && !stt.empty;
          const seln = slot === sl;
          const col = SLOT_COLORS[sl];
          const meta = st.telemetry[sl]?.src;
          const median = has ? fmtLapSec(stt.medMs / 1000) : "—";
          const metaText = meta ? [meta.venue, meta.vehicle].filter(Boolean).join(" · ") : t("dosya bekleniyor");
          const brand = meta?.vehicle ? brandLogo(meta.vehicle) : "";
          return (
            <button key={sl} onClick={() => setSlot(sl)} style={{ flex: "1 1 240px", minWidth: 0,
              display: "flex", alignItems: "center", gap: 12, textAlign: "left", cursor: "pointer",
              borderRadius: 12, padding: "12px 14px",
              border: `1px solid ${seln ? col : "var(--rc-border)"}`,
              background: seln ? "var(--rc-surface-2)" : "var(--rc-surface)" }}>
              <span style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0, flex: 1 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 99, display: "inline-block",
                    background: loaded ? col : "var(--rc-border-strong)" }} />
                  <span style={{ fontFamily: DISP, fontWeight: 700, fontSize: 17, letterSpacing: ".04em",
                    whiteSpace: "nowrap" }}>Stint {sl}</span>
                  <span style={{ fontSize: 9.5, textTransform: "uppercase", letterSpacing: ".08em",
                    padding: "2px 8px", borderRadius: 99, whiteSpace: "nowrap",
                    border: `1px solid ${loaded ? col : "var(--rc-border)"}`,
                    color: loaded ? col : "var(--rc-text-3)" }}>
                    {loaded ? (seln ? t("seçili") : t("yüklü")) : t("boş")}</span>
                </span>
                <span style={{ fontFamily: DISP, fontWeight: 700, fontSize: 20,
                  color: has ? col : "var(--rc-text-3)" }}>{median}</span>
                <span style={{ fontSize: 11, color: "var(--rc-text-3)", whiteSpace: "nowrap",
                  overflow: "hidden", textOverflow: "ellipsis" }}>{metaText}</span>
              </span>
              {brand && (
                <span style={{ flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", width: 56 }}>
                  <img src={brand} alt="" onError={hideImg} style={{ width: 40, height: 40, objectFit: "contain" }} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ══════════ stint analizi + seans ══════════ */}
      {loadedSlots.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "stretch" }}>
          {/* Stint analizi */}
          <div style={{ flex: "1 1 620px", minWidth: 0, border: "1px solid var(--rc-border)",
            borderRadius: 12, background: "var(--rc-surface)", padding: "16px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
              <span style={{ fontFamily: DISP, textTransform: "uppercase", letterSpacing: ".08em",
                fontSize: 16, fontWeight: 700 }}>{t("Stint analizi")}</span>
              <span style={{ display: "flex", gap: 6, marginLeft: 12 }}>
                {[["line", t("Tur tur")], ["box", t("Kutu grafiği")]].map(([m, lbl]) => {
                  const on = chartMode === m;
                  return (
                    <button key={m} onClick={() => setChartMode(m)} style={{ padding: "6px 12px", borderRadius: 8,
                      cursor: "pointer", fontSize: 11.5, border: `1px solid ${on ? "var(--rc-brand-bright)" : "var(--rc-border)"}`,
                      background: on ? "var(--rc-glow-brand)" : "var(--rc-surface-3)",
                      color: on ? "var(--rc-text)" : "var(--rc-text-3)" }}>{lbl}</button>
                  );
                })}
              </span>
              <span style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center",
                fontSize: 11.5, color: "var(--rc-text-3)", flexWrap: "wrap" }}>
                {boxes.rows.map((r) => (
                  <span key={r.id} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <i style={{ width: 10, height: 3, background: r.c, display: "inline-block" }} />Stint {r.id}</span>
                ))}
              </span>
            </div>

            {/* kutu grafiği */}
            {!chartLine && (
              <svg viewBox="0 0 820 280" style={{ width: "100%", height: "auto", display: "block" }}>
                <line x1="60" y1="20" x2="60" y2="240" stroke="var(--rc-border)" strokeWidth="1" />
                <line x1="60" y1="240" x2="800" y2="240" stroke="var(--rc-border)" strokeWidth="1" />
                {gridLines.map((g, i) => (
                  <g key={i}>
                    <line x1="60" y1={g.y} x2="800" y2={g.y} stroke="var(--rc-line-soft)" strokeWidth="1" strokeDasharray="3 4" />
                    <text x="52" y={g.ty} textAnchor="end" fill="var(--rc-text-3)" fontSize="11" fontFamily={DISP}>{g.label}</text>
                  </g>
                ))}
                {boxes.rows.map((b, k) => {
                  const nB = boxes.rows.length;
                  const step = 740 / nB;
                  const cx = 60 + step * (k + 0.5);
                  const w = Math.min(130, step - 40);
                  const half = w / 2;
                  const scatterW = Math.min(104, step - 30);
                  return (
                    <g key={b.id}>
                      <line x1={cx} y1={by(b.min)} x2={cx} y2={by(b.max)} stroke={b.c} strokeWidth="1.6" strokeDasharray="3 3" />
                      <line x1={cx - 34} y1={by(b.min)} x2={cx + 34} y2={by(b.min)} stroke={b.c} strokeWidth="2" />
                      <line x1={cx - 34} y1={by(b.max)} x2={cx + 34} y2={by(b.max)} stroke={b.c} strokeWidth="2" />
                      <rect x={cx - half} y={by(b.q3)} width={w} height={Math.max(0, by(b.q1) - by(b.q3))} rx="4"
                        fill={b.c} fillOpacity="0.12" stroke={b.c} strokeWidth="2" />
                      <line x1={cx - half} y1={by(b.med)} x2={cx + half} y2={by(b.med)} stroke={b.c} strokeWidth="3.4" />
                      {b.laps.map((v, i) => (
                        <circle key={i} cx={(cx - scatterW / 2 + (i * scatterW) / Math.max(1, b.n - 1)).toFixed(1)}
                          cy={by(v).toFixed(1)} r="2.6" fill={b.c} opacity="0.55" />
                      ))}
                      <text x={cx} y="262" textAnchor="middle" fill="var(--rc-text-2)" fontSize="12" fontFamily={DISP} fontWeight="700">Stint {b.id}</text>
                      <text x={cx} y={(by(b.med) - 9).toFixed(1)} textAnchor="middle" fill={b.c} fontSize="12" fontWeight="600" fontFamily={DISP}>{fmtLapSec(b.med)}</text>
                    </g>
                  );
                })}
              </svg>
            )}

            {/* kutu istatistik kartları */}
            {!chartLine && (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                {boxes.rows.map((b) => {
                  const cells = [
                    { k: t("medyan"), v: fmtLapSec(b.med), col: b.c },
                    { k: t("en iyi"), v: fmtLapSec(b.min) },
                    { k: "IQR", v: `${(b.q3 - b.q1).toFixed(2)}s` },
                    { k: t("yayılım"), v: `${(b.max - b.min).toFixed(2)}s` },
                  ];
                  return (
                    <div key={b.id} style={{ flex: "1 1 260px", background: "var(--rc-surface-3)",
                      border: `1px solid ${b.c}44`, borderRadius: 10, padding: "11px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <i style={{ width: 10, height: 10, borderRadius: 3, background: b.c, display: "inline-block", flex: "0 0 auto" }} />
                        <b style={{ fontFamily: DISP, fontSize: 15, fontWeight: 700 }}>Stint {b.id}</b>
                        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--rc-text-3)" }}>{b.n} {t("tur")}</span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
                        {cells.map((c) => (
                          <span key={c.k} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <b style={{ fontFamily: DISP, fontSize: 14, fontWeight: 600, color: c.col || "var(--rc-text)" }}>{c.v}</b>
                            <span style={{ fontSize: 9.5, color: "var(--rc-text-3)", textTransform: "uppercase", letterSpacing: ".08em" }}>{c.k}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* tur-tur grafiği */}
            {chartLine && (
              <svg viewBox="0 0 820 280" style={{ width: "100%", height: "auto", display: "block" }}>
                <line x1="60" y1="20" x2="60" y2="240" stroke="var(--rc-border)" strokeWidth="1" />
                <line x1="60" y1="240" x2="800" y2="240" stroke="var(--rc-border)" strokeWidth="1" />
                {gridLines.map((g, i) => (
                  <g key={i}>
                    <line x1="60" y1={g.y} x2="800" y2={g.y} stroke="var(--rc-line-soft)" strokeWidth="1" strokeDasharray="3 4" />
                    <text x="52" y={g.ty} textAnchor="end" fill="var(--rc-text-3)" fontSize="11" fontFamily={DISP}>{g.label}</text>
                  </g>
                ))}
                {boxes.rows.map((b) => {
                  const pts = b.laps.map((v, i) => `${(60 + (i * 740) / Math.max(1, b.n - 1)).toFixed(1)},${by(v).toFixed(1)}`).join(" ");
                  return <polyline key={b.id} points={pts} fill="none" stroke={b.c} strokeWidth="2.5" strokeLinejoin="round" />;
                })}
                {boxes.rows.map((b, k) => b.laps.map((v, i) => {
                  const x = 60 + (i * 740) / Math.max(1, b.n - 1);
                  const y = by(v);
                  return (
                    <g key={`${b.id}-${i}`}>
                      <circle cx={x.toFixed(1)} cy={y.toFixed(1)} r="3.2" fill={b.c} />
                      {i % 2 === 0 && (
                        <text x={x.toFixed(1)} y={(k === 0 ? y - 9 : y + 15).toFixed(1)} textAnchor="middle"
                          fill={b.c} fontSize="10" fontFamily={DISP}>{fmtLapSec(v).replace(/^\d:/, "")}</text>
                      )}
                    </g>
                  );
                }))}
                {xTicks.map((x, i) => (
                  <text key={i} x={x.x} y="262" textAnchor="middle" fill="var(--rc-text-3)" fontSize="11" fontFamily={DISP}>{x.label}</text>
                ))}
              </svg>
            )}

            {/* özet kutucukları */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14, paddingTop: 14,
              borderTop: "1px solid var(--rc-border)" }}>
              <div style={tile}>
                <div style={{ fontFamily: DISP, fontSize: 26, fontWeight: 700,
                  color: delta1 == null ? "var(--rc-text)" : delta1 < 0 ? "var(--rc-ok-2)" : "var(--rc-danger-3)" }}>
                  {delta1 == null ? "—" : `${delta1 < 0 ? "−" : "+"}${Math.abs(delta1).toFixed(2)} sn`}</div>
                <div style={tileLbl}>
                  {other ? `${baseSlot}, ${other}${t("'den hızlı (ort.)")}` : t("ort. fark (medyan)")}</div>
              </div>
              <div style={tile}>
                <div style={{ fontFamily: DISP, fontSize: 26, fontWeight: 700 }}>
                  {bs.medFuel != null ? `${bs.medFuel.toFixed(2)} %/tur` : "—"}</div>
                <div style={tileLbl}>
                  {t("Medyan VE")}{bs.tankLaps ? ` · %100 ≈ ${Math.floor(bs.tankLaps)} ${t("tur")}` : ""}</div>
              </div>
              <div style={tile}>
                <div style={{ fontFamily: DISP, fontSize: 24, fontWeight: 700, whiteSpace: "nowrap" }}>
                  {bs.medW && bs.medW.some((w) => w != null)
                    ? bs.medW.map((w) => (w == null ? "–" : w.toFixed(1))).join(" / ") : "—"}</div>
                <div style={tileLbl}>{t("Aşınma %/tur · FL FR RL RR")}</div>
              </div>
            </div>
          </div>

          {/* Seans */}
          <div style={{ flex: "1 1 300px", minWidth: 280, display: "flex", flexDirection: "column",
            gap: 12, alignSelf: "stretch" }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", border: "1px solid var(--rc-border-strong)",
              borderRadius: 12, padding: "14px 16px",
              background: "radial-gradient(120% 160% at 100% 0,rgba(150,0,24,.24),var(--rc-surface-2) 62%)" }}>
              <div style={{ fontFamily: DISP, textTransform: "uppercase", letterSpacing: ".08em",
                fontSize: 14, fontWeight: 700, marginBottom: 10, color: "var(--rc-brand-bright)" }}>
                {t("Seans")} · {slot}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12,
                paddingBottom: 12, borderBottom: "1px solid var(--rc-line-soft)" }}>
                {trackId
                  ? <img src={`${ASSET}flags/${trackId}.png`} alt="" onError={hideImg}
                      style={{ flex: "0 0 auto", width: 28, borderRadius: 3, border: "1px solid var(--rc-border)" }} />
                  : <span style={{ flex: "0 0 auto", width: 28 }} />}
                {carLogo
                  ? <img src={carLogo} alt="" onError={hideImg}
                      style={{ flex: "1 1 0", minWidth: 0, height: 52, objectFit: "contain" }} />
                  : <span style={{ flex: "1 1 0" }} />}
                <span style={{ width: 1, alignSelf: "stretch", background: "var(--rc-line-soft)" }} />
                {trackId
                  ? <img src={`${ASSET}tracks/${TRACK_ASSET(trackId)}.png${AV}`} alt="" onError={hideImg}
                      style={{ flex: "0 0 auto", width: 82, height: 52, objectFit: "contain", opacity: 0.9 }} />
                  : <span style={{ flex: "0 0 auto", width: 82 }} />}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {sessRows.map((r) => (
                  <span key={r.k} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                    <span style={{ width: 74, flex: "0 0 auto", color: "var(--rc-text-3)", fontSize: 10.5,
                      textTransform: "uppercase", letterSpacing: ".08em" }}>{r.k}</span>
                    <b style={{ fontSize: 12.5, fontFamily: r.mono ? DISP : UI }}>{r.v}</b>
                  </span>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: "auto", paddingTop: 14,
                borderTop: "1px solid var(--rc-line-soft)" }}>
                {!standalone && (
                  <button onClick={() => sStat && !sStat.empty && up({ avgLap: fmtLapSec(sStat.medMs / 1000),
                    ...(sStat.medFuel != null ? { consumption: +sStat.medFuel.toFixed(2) } : {}) })}
                    style={{ padding: "7px 14px", borderRadius: 9, border: "1px solid var(--rc-brand-bright)",
                      background: "rgba(150,0,24,.22)", color: "var(--rc-text)", cursor: "pointer", fontSize: 12 }}>
                    {t("Data'ya uygula")}</button>
                )}
                <button onClick={() => apply105Slot(slot)} style={{ padding: "7px 14px", borderRadius: 9,
                  cursor: "pointer", fontSize: 12, border: "1px solid var(--rc-border)",
                  background: "var(--rc-surface-3)", color: "var(--rc-text-2)" }}>{t("%105 filtre")}</button>
                <button onClick={() => removeSlot(slot)} style={{ padding: "7px 14px", borderRadius: 9,
                  border: "1px solid var(--rc-danger)", background: "transparent", color: "var(--rc-danger)",
                  cursor: "pointer", fontSize: 12 }}>{t("Stinti sil")}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ çözümlenen turlar ══════════ */}
      {(parsedHasTable || parsedHasMap) && (
        <div style={{ border: "1px solid var(--rc-border)", borderRadius: 12, background: "var(--rc-surface)",
          overflow: "hidden", marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "13px 16px",
            borderBottom: "1px solid var(--rc-border)", flexWrap: "wrap" }}>
            <span style={{ fontFamily: DISP, textTransform: "uppercase", letterSpacing: ".08em",
              fontSize: 15, fontWeight: 700 }}>{t("Çözümlenen turlar")}</span>
            <span style={{ fontSize: 11.5, color: "var(--rc-text-3)" }}>
              {parsedHasTable ? parsedLaps.length : (parsed.lapRows?.length || 0)} {t("tur")}
              {parsedMeta ? ` · ${parsedMeta}` : ""}</span>
            {parsedHasMap && (
              <button onClick={() => setColMap((v) => !v)} style={{ padding: "7px 13px", borderRadius: 9,
                cursor: "pointer", fontSize: 12, border: `1px solid ${colMap ? "var(--rc-brand-bright)" : "var(--rc-border)"}`,
                background: colMap ? "rgba(150,0,24,.22)" : "var(--rc-surface-3)", color: "var(--rc-text-2)" }}>
                ⚙ {t("Sütun eşleme")}</button>
            )}
            <button onClick={saveBtn} disabled={parsedHasMap && mapping.timeCol < 0}
              style={{ marginLeft: "auto", padding: "7px 14px", borderRadius: 9, border: "1px solid var(--rc-purple)",
                background: "var(--rc-tint-purple)", color: "var(--rc-purple)", cursor: "pointer",
                fontSize: 12, fontWeight: 600, opacity: parsedHasMap && mapping.timeCol < 0 ? 0.5 : 1 }}>
              {t("Stint")} {slot} {t("olarak kaydet")}</button>
            {savedMsg && (
              <span style={{ fontSize: 12, color: "var(--rc-ok)", fontWeight: 600 }}>
                ✓ {t("Stint")} {savedMsg} {t("kaydedildi")}</span>
            )}
          </div>

          {/* sütun eşleme paneli (CSV) */}
          {parsedHasMap && colMap && (
            <div style={{ padding: "13px 16px", borderBottom: "1px solid var(--rc-line-soft)", background: "var(--rc-surface-2)" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 10 }}>
                {[["Tur süresi", "timeCol"], ["VE Δ (%)", "fuelCol"]].map(([lbl, key]) => (
                  <div key={key}>
                    <label style={{ display: "block", color: "var(--rc-text-3)", fontSize: 10,
                      textTransform: "uppercase", letterSpacing: ".09em", marginBottom: 5 }}>{t(lbl)}</label>
                    <select value={mapping[key]} onChange={(e) => setMapping({ ...mapping, [key]: +e.target.value })}
                      style={{ width: "100%", boxSizing: "border-box", background: "var(--rc-surface-3)",
                        border: "1px solid var(--rc-border)", borderRadius: 8, color: "var(--rc-text)",
                        padding: "7px 9px", fontSize: 12 }}>
                      <option value={-1}>—</option>
                      {parsed.headers.map((h, i) => <option key={i} value={i}>{i}: {h || t("(başlıksız)")}</option>)}
                    </select>
                  </div>
                ))}
                {["FL", "FR", "RL", "RR"].map((c, ci) => (
                  <div key={c}>
                    <label style={{ display: "block", color: "var(--rc-text-3)", fontSize: 10,
                      textTransform: "uppercase", letterSpacing: ".09em", marginBottom: 5 }}>{t("Aşınma")} {c}</label>
                    <select value={mapping.wear[ci]} onChange={(e) => {
                      const wear = [...mapping.wear]; wear[ci] = +e.target.value; setMapping({ ...mapping, wear }); }}
                      style={{ width: "100%", boxSizing: "border-box", background: "var(--rc-surface-3)",
                        border: "1px solid var(--rc-border)", borderRadius: 8, color: "var(--rc-text)",
                        padding: "7px 9px", fontSize: 12 }}>
                      <option value={-1}>—</option>
                      {parsed.headers.map((h, i) => <option key={i} value={i}>{i}: {h || t("(başlıksız)")}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              {mapping.fuelCol >= 0 && (
                <label style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 11,
                  fontSize: 12, color: "var(--rc-text-2)" }}>
                  <input type="checkbox" checked={!!mapping.fuelIsLitre} style={{ width: "auto", margin: 0 }}
                    onChange={(e) => setMapping({ ...mapping, fuelIsLitre: e.target.checked })} />
                  {t("Yakıt sütunu litre (VE % için orana bölünür)")}
                </label>
              )}
            </div>
          )}

          {/* çözümlenen tur tablosu (.ld/.duckdb) */}
          {parsedHasTable && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 660 }}>
                <thead><tr>
                  <th style={thLeft}>{t("Tur")}</th><th style={th}>{t("Süre")}</th><th style={th}>{t("Yakıt")}</th>
                  <th style={th}>VE %</th><th style={th}>{t("Aşınma")} FL/FR/RL/RR</th><th style={th}>{t("Ort / Max km/h")}</th>
                </tr></thead>
                <tbody>
                  {parsedLaps.map((l, i) => {
                    const best = !l.partial && !l.pit && l.sec === bestSec;
                    return (
                      <tr key={i} style={{ background: best ? "var(--rc-tint-purple)"
                        : l.partial ? "rgba(245,178,61,.05)" : "transparent" }}>
                        <td style={{ padding: "8px 14px", borderBottom: "1px solid var(--rc-line-soft)",
                          textAlign: "left", fontSize: 12.5, whiteSpace: "nowrap" }}>
                          Lap {l.lap}
                          {(l.pit || l.partial) && (
                            <span style={{ color: "var(--rc-warn)", fontSize: 10.5, marginLeft: 5 }}>
                              {l.pit ? "🅿" : t("kısmi")}</span>
                          )}
                        </td>
                        <td style={{ padding: "8px 14px", borderBottom: "1px solid var(--rc-line-soft)", textAlign: "right",
                          fontFamily: DISP, fontSize: 13, color: best ? "var(--rc-purple)" : "var(--rc-text)",
                          fontWeight: best ? 600 : 400 }}>{fmtLap(l.sec)}</td>
                        <td style={td}>{l.fuelL != null ? `${l.fuelL.toFixed(2)} L` : "—"}</td>
                        <td style={td}>{l.fuelL != null && st.fuelRatio > 0 ? (l.fuelL / st.fuelRatio).toFixed(2) : "—"}</td>
                        <td style={{ padding: "8px 14px", borderBottom: "1px solid var(--rc-line-soft)", textAlign: "right",
                          fontFamily: DISP, fontSize: 11.5, color: "var(--rc-text-3)" }}>
                          {l.w.map((x) => (x == null ? "—" : x.toFixed(1))).join(" / ")}</td>
                        <td style={td}>{l.avgSpd != null ? `${Math.round(l.avgSpd)} / ${Math.round(l.maxSpd)}` : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {parsedHasMap && !parsedHasTable && (
            <div style={{ padding: "12px 16px", fontSize: 12, color: "var(--rc-text-3)" }}>
              {parsed.lapRows.length} {t("tur satırı bulundu. Sütun eşleşmesini kontrol et:")}
              {mapping.timeCol < 0 && <span style={{ color: "var(--rc-warn)", marginLeft: 8 }}>{t("Tur süresi sütunu seçilmeli")}</span>}
            </div>
          )}
        </div>
      )}

      {/* Seans/setup kutusu — fişte yok; .duckdb setup kaydetme işlevi korunur (FLAG) */}
      {cmpMeta?.setup && (
        <SessionSetupBox setup={cmpMeta.setup} meta={cmpMeta} t={t} onSave={onSaveDuckSetup} />
      )}

      {/* ══════════ tur karşılaştırma ══════════ */}
      {cmpSources?.length > 0 && (
        <TraceCompareCard t={t} sources={cmpSources} fallbackMeta={cmpMeta}
          cmpASrc={cmpASrc} setCmpASrc={setCmpASrc} cmpBSrc={cmpBSrc} setCmpBSrc={setCmpBSrc}
          cmpA={cmpA} setCmpA={setCmpA} cmpB={cmpB} setCmpB={setCmpB}
          cmpData={cmpData} cmpBusy={cmpBusy} openImport={openImport} />
      )}
    </div>
  );
}
