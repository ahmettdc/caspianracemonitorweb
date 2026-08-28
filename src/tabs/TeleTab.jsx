import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ReferenceLine, ReferenceDot, ResponsiveContainer } from "recharts";
import { fmtLap } from "../engine";
import { SLOT_COLORS, ASSET, TRACK_ASSET, trackName, carName, carImg, venueToTrackId } from "../constants";
import { BoxPlot, SessionSetupBox, Icon } from "../components";
import { zoomViewAt, panView, zoomDomain, advanceCursor } from "../zoomView";
import { sectorOf, sectorMarks } from "../ldTrace";
import { detectApexes, cornerStats } from "../corners";

/* İz karşılaştırma renkleri (A/B tur) */
const CA = "#ff5470", CB = "#4d9fff";

/* TraceRow prop kimlikleri modül sabiti — her render'da taze dizi/fonksiyon
   üretilirse aşağıdaki grafik memo'ları hiç tutmaz. */
const K_DT = ["dt"], C_DT = ["#F5C84C"], C_AB = [CA, CB];
const K_SP = ["spA", "spB"], K_TH = ["thA", "thB"], K_BR = ["brA", "brB"],
  K_G = ["gA", "gB"], K_RPM = ["rpmA", "rpmB"], K_ST = ["stA", "stB"];
const sp1 = (v) => (v == null ? "—" : v.toFixed(1));
const pct = (v) => (v == null ? "—" : `${Math.round(v)}%`);
const dlt = (v) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(3)}s`);
const int0 = (v) => (v == null ? "—" : String(Math.round(v)));

/* Eksen geometrisi bu dosyada sabittir (aşağıdaki playhead eşlemesi buna dayanır):
   YAxis width=44, margin sağ=8/sol=0/üst=4/alt=0, XAxis yüksekliği=30 (recharts
   varsayılanı). Lineer mesafe ekseni → yüzde eşlemesi kesindir. */
const PLOT_L = 44, PLOT_R = 8, PLOT_T = 4, PLOT_B = 30;

/* Tek kanal iz satırı — recharts syncId ile hepsi ortak imleç + ortak mesafe ekseni.
   PLAYHEAD (cursorD) artık grafiğin İÇİNDE (ReferenceLine) değil, üstünde mutlak
   konumlu ucuz bir div: oynatmada saniyede 25 kez değişen tek şey bu div olur;
   600 noktalı Recharts ağacı useMemo ile SABİT kalır (eskiden 7 grafik × 25/sn
   komple reconcile ediliyordu — ana yavaşlık buydu). Prop kimlikleri çağıran
   tarafta sabitlendi (modül sabitleri + useCallback + useMemo). */
function TraceRow({ data, title, unit, keys, colors, fmt, height = 132, zero, dashB, onCursor, onAnchor, xDomain, bounds, cursorD, dots }) {
  const onMove = useMemo(() => ((onCursor || onAnchor) ? (s) => {
    if (onCursor) onCursor(s && s.activeTooltipIndex != null ? s.activeTooltipIndex : null);
    if (onAnchor && s && s.activeLabel != null) onAnchor(s.activeLabel);
  } : undefined), [onCursor, onAnchor]);
  const onLeave = useMemo(() => (onCursor ? () => onCursor(null) : undefined), [onCursor]);
  const chart = useMemo(() => (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} syncId="tele" margin={{ top: PLOT_T, right: PLOT_R, bottom: 0, left: 0 }}
        onMouseMove={onMove}
        onMouseLeave={onLeave}>
        <CartesianGrid stroke="#2B3542" strokeDasharray="3 3" />
        <XAxis dataKey="d" type="number" domain={xDomain || ["dataMin", "dataMax"]}
          allowDataOverflow stroke="#8C97A5" fontSize={10} tickFormatter={(v) => Math.round(v)}
          minTickGap={40} />
        <YAxis stroke="#8C97A5" fontSize={10} width={PLOT_L}
          domain={["auto", "auto"]} tickFormatter={fmt} />
        <Tooltip contentStyle={{ background: "#1F2731", border: "1px solid #2B3542", fontSize: 12 }}
          labelFormatter={(v) => `${Math.round(v)} ${unit}`}
          formatter={(val, n) => [fmt ? fmt(val) : val, n]} />
        {zero && <ReferenceLine y={0} stroke="#8C97A5" strokeDasharray="4 4" />}
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
  ), [data, unit, keys, colors, fmt, zero, dashB, xDomain, bounds, dots, onMove, onLeave]);
  /* playhead konumu: mesafe → görünür pencere kesri → CSS calc (ölçüm yok) */
  const lo = xDomain ? xDomain[0] : (data?.length ? data[0].d : 0);
  const hi = xDomain ? xDomain[1] : (data?.length ? data[data.length - 1].d : 0);
  const frac = (cursorD != null && hi > lo)
    ? Math.max(0, Math.min(1, (cursorD - lo) / (hi - lo))) : null;
  return (
    <div style={{ marginTop: 8 }}>
      <div className="hint" style={{ margin: "0 0 2px", fontWeight: 600 }}>{title}</div>
      <div style={{ height, position: "relative" }}>
        {chart}
        {frac != null && (
          <div aria-hidden style={{ position: "absolute", top: PLOT_T, bottom: PLOT_B,
            left: `calc(${PLOT_L}px + (100% - ${PLOT_L + PLOT_R}px) * ${frac})`,
            width: 1.4, background: "#3ad07a", pointerEvents: "none" }} />
        )}
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
  const drag = useRef(null);   // { mode, x0, y0, v0, rect }
  /* view'ın güncel değeri ref aynasıyla taşınır → native wheel dinleyicisi BİR KEZ
     takılır (eskiden dependency'siz effect her render'da söküp takıyordu — oynatma
     sırasında saniyede 25 kez addEventListener/removeEventListener). */
  const viewRef = useRef(view);
  viewRef.current = view;

  /* Geometri memo (v1.8.0): nokta matematiği yalnız data değişince kurulur.
     scrPts = ekran-uzayı nokta önbelleği — nearest() ve segment üretimi her
     çağrıda 600 scr() hesabı yerine bunun üzerinde döner. */
  const { scrPts, step } = useMemo(() => {
    const xs = data.map((d) => d.mapX), ys = data.map((d) => d.mapY);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const spanX = (maxX - minX) || 1, spanY = (maxY - minY) || 1;
    const sc = Math.min((S - 2 * PAD) / spanX, (S - 2 * PAD) / spanY);
    const ox = (S - spanX * sc) / 2, oy = (S - spanY * sc) / 2;
    const scr = (x, y) => [ox + (x - minX) * sc, S - (oy + (y - minY) * sc)];   // y yukarı → ekranda ters
    const scrPts = data.map((d) => scr(d.mapX, d.mapY));
    return { scrPts, step: Math.max(1, Math.floor(data.length / 220)) };
  }, [data]);

  /* ~220 renkli <line> segmenti — eskiden her render'da (oynatmada 25/sn) yeniden
     üretiliyordu; artık yalnız data değişince. */
  const segs = useMemo(() => {
    const out = [];
    for (let k = 0; k + step < data.length; k += step) {
      const [x1, y1] = scrPts[k];
      const [x2, y2] = scrPts[k + step];
      const dd = (data[k + step].dt ?? 0) - (data[k].dt ?? 0);   // +: B daha çok süre → A hızlı
      const col = dd > 0.003 ? CA : dd < -0.003 ? CB : "#7a8797";
      out.push(<line key={k} x1={x1} y1={y1} x2={x2} y2={y2} stroke={col} strokeWidth={3.2}
        strokeLinecap="round" vectorEffect="non-scaling-stroke" />);
    }
    return out;
  }, [data, scrPts, step]);

  /* imleç dairesi — kesirli cursor (oynatma) iki nokta ARASINDA interpole edilir → akıcı */
  const cur = (() => {
    if (cursor == null || !data.length) return null;
    const i = Math.max(0, Math.min(Math.floor(cursor), data.length - 1));
    const f = cursor - i;
    const p1 = scrPts[i], p2 = scrPts[Math.min(i + 1, data.length - 1)] || p1;
    if (!p1) return null;
    return [p1[0] + f * (p2[0] - p1[0]), p1[1] + f * (p2[1] - p1[1])];
  })();
  const zf = view.vw / S;   // daire yarıçapı ekranda sabit kalsın diye ölçek
  /* S/F + sektör sınırları: yolu KESEN kısa çizgi (teğete dik) + etiket — daire yok. */
  const TICK = 7;   // yarı-uzunluk (SVG birimi) → yol bandını keser, zoom'la ölçeklenir
  const secDivs = useMemo(() => {
    const perpTick = (idx) => {
      const i0 = Math.max(0, idx - step), i1 = Math.min(data.length - 1, idx + step);
      const [ax, ay] = scrPts[i0];
      const [bx, by] = scrPts[i1];
      const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1;
      const px = -dy / L, py = dx / L;                     // teğete dik birim
      const [cx, cy] = scrPts[idx];
      return { x1: cx - px * TICK, y1: cy - py * TICK, x2: cx + px * TICK, y2: cy + py * TICK, cx, cy };
    };
    return [
      { idx: 0, label: "S/F", col: "#fff" },
      ...(marks || []).map((m) => ({ idx: m.idx, label: `S${m.label.slice(-1)}`, col: "#cbb" })),
    ].filter((m) => data[m.idx]).map((m) => ({ ...m, ...perpTick(m.idx) }));
  }, [data, marks, scrPts, step]);
  /* viraj (apex) işaretleri — numaralı küçük daireler */
  const apexPts = useMemo(() => (apex || []).map((idx, i) => {
    const p = data[idx] ? scrPts[idx] : null;
    return p ? { no: i + 1, x: p[0], y: p[1] } : null;
  }).filter(Boolean), [data, apex, scrPts]);
  const zoomed = view.vw < S - 0.5;

  /* SVG-koordinatına çevir (px → viewBox birimi) — view ref'ten okunur (stale olmaz) */
  const toSvg = (clientX, clientY) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r || !r.width) return null;
    const v = viewRef.current;
    return [v.vx + ((clientX - r.left) / r.width) * v.vw,
      v.vy + ((clientY - r.top) / r.height) * v.vh];
  };
  /* Tekerlek: React onWheel passive → native non-passive dinleyici (sayfa kaymasın).
     [] deps: dinleyici yalnız ref'lere dokunur → bir kez tak, bir kez sök. */
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
  /* pist çizgisine en yakın tur noktası (ekran-px) → { idx, dist }.
     rect parametresi: sürükleme boyunca onDown'da ölçülen kutu yeniden kullanılır —
     eskiden HER pointermove'da getBoundingClientRect (forced layout) vardı. */
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
    if (n && n.dist <= GRAB_PX) {           // pist çizgisi/daire üstünde → scrub
      drag.current = { mode: "scrub", rect }; onScrub(n.idx);
    } else {                                 // boş alan → pan (v1.4.115)
      drag.current = { mode: "pan", x0: e.clientX, y0: e.clientY, v0: view, rect };
    }
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e) => {
    const d0 = drag.current;
    if (!d0) return;
    if (d0.mode === "scrub") {
      const n = nearest(e.clientX, e.clientY, d0.rect);
      if (n && onScrub) onScrub(n.idx);
      return;
    }
    const r = d0.rect;
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
          {secDivs.map((m) => (
            <g key={m.label}>
              <line x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2} stroke={m.col} strokeWidth={2}
                strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              <text x={m.cx + 6 * zf} y={m.cy + 3 * zf} fill={m.col}
                fontSize={(m.label === "S/F" ? 9 : 8) * zf}>{m.label}</text>
            </g>
          ))}
          {apexPts.map((a) => (
            <text key={`ap${a.no}`} x={a.x} y={a.y} fill="#F5C84C" fontSize={9 * zf}
              fontWeight="700" textAnchor="middle" dominantBaseline="central"
              stroke="#000" strokeWidth={0.5} paintOrder="stroke"
              vectorEffect="non-scaling-stroke">{a.no}</text>
          ))}
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
  /* v1.7.1 — kesirli oynatma konumu: playhead yalnız tam index'e yuvarlanınca 600 nokta /
     90 sn'lik turda ~7 kare/sn ZIPLAR (kullanıcının "10 fps" şikâyeti). Oynatma sırasında
     kesir state'e yazılır; cursorD + harita dairesi noktalar ARASINDA interpole edilir →
     çizgi 25 fps akıcı kayar. Hover/scrub tam sayı davranışında kalır (cursorF=null). */
  const [cursorF, setCursorF] = useState(null);
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
  /* sektör sınırları (mesafe üçlüsü) — memo: taze dizi kimliği 7 grafiğin +
     TrackMini'nin memo'larını her render'da kırıyordu */
  const marks = useMemo(() => (data ? sectorMarks(data) : []), [data]);
  /* viraj tespiti: A'nın hız minimumları (apex) → apex hızları + fren mesafeleri (A/B) */
  const apexes = useMemo(() => (data?.length
    ? detectApexes(data.map((p) => p.spA), data.map((p) => p.d)) : []), [data]);
  const corners = useMemo(() => cornerStats(data, apexes), [data, apexes]);
  const curSec = cursor != null && data?.[cursor]
    ? sectorOf((data[cursor].frac ?? 0) / 100) : null;   // data.frac 0..100
  /* imleç konumu: kesirli oynatma varsa iki nokta arası interpole (akıcı), yoksa tam index */
  const cf = cursorF ?? cursor;
  const cursorD = (() => {
    if (cf == null || !data?.length) return null;
    const i = Math.max(0, Math.min(Math.floor(cf), N - 1));
    const f = cf - i;
    const a = data[i], b = data[Math.min(i + 1, N - 1)];
    return a ? a.d + f * (((b?.d) ?? a.d) - a.d) : null;
  })();
  const lapSecA = lapsA[cmpA]?.sec;
  /* haritada daireyi sürükleyince (scrub): oynatmayı durdur + imleci o noktaya taşı.
     useCallback: kimlikleri sabit → TraceRow/TrackMini memo'ları oynatma tick'inde
     kırılmaz (state setter'lar zaten sabit). */
  const onScrub = useCallback((i) => {
    setPlaying(false); playPosRef.current = i; setCursorF(null); setCursor(i);
  }, []);
  /* grafik üzerinde hover — kesirli oynatma konumunu bırak, tam index'e geç */
  const hoverCursor = useCallback((i) => { setCursorF(null); setCursor(i); }, []);
  /* tekerlek yakınlaştırma çapası — tüm grafikler için tek, sabit kimlikli */
  const anchorD = useCallback((d) => { lastDRef.current = d; }, []);
  /* hız grafiği apex noktaları — kimlik yalnız corners değişince yenilensin */
  const speedDots = useMemo(() => corners.flatMap((c) => [
    c.aMin != null ? { x: c.apexD, y: c.aMin, c: CA } : null,
    c.bMin != null ? { x: c.apexD, y: c.bMin, c: CB } : null].filter(Boolean)), [corners]);

  /* Oynatma: setInterval (~40ms) imleci tur A süresi boyunca ilerletir; harita noktası +
     tüm kanallarda playhead (ReferenceLine) noktalar arası interpole edilerek AKICI kayar. */
  useEffect(() => {
    if (!playing || N < 2) return undefined;
    const id = setInterval(() => {
      playPosRef.current = advanceCursor(playPosRef.current, N, lapSecA, playSpeed, 40);
      setCursorF(playPosRef.current);
      setCursor(Math.round(playPosRef.current));
    }, 40);
    return () => clearInterval(id);
  }, [playing, playSpeed, N, lapSecA]);
  // tur/dosya değişince oynatmayı durdur (index karışmasın)
  useEffect(() => { setPlaying(false); playPosRef.current = 0; setCursorF(null); }, [cmpA, cmpB]);

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
    <div style={{ border: "1px solid var(--rc-border)", borderRadius: 12, background: "var(--rc-surface)", padding: "16px 18px", marginTop: 16 }} ref={cardRef}>
      <h2 style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", margin: "0 0 10px", fontFamily: "var(--rc-font-display)", textTransform: "uppercase", letterSpacing: ".08em", fontSize: 16, fontWeight: 700 }}>
        <Icon name="karsilastir" size={16} /> {t("Tur karşılaştırma")}
        {cmpData && Number.isFinite(cmpData.totalDelta) && (
          <span className="chip" style={{ fontSize: 12,
            borderColor: cmpData.totalDelta > 0 ? CA : CB,
            color: cmpData.totalDelta > 0 ? CA : CB }}>
            Δ {dlt(cmpData.totalDelta)}</span>
        )}
        {curSec != null && (
          <span className="chip" style={{ fontSize: 12 }}><Icon name="sektor" size={13} /> {t("Sektör")} S{curSec}</span>
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
            color: "var(--yellow)" }}><Icon name="uyari" size={12} /> {t("farklı pist — kıyas dikkatli")}</span>
        )}
      </div>
      {meta && (meta.venue || meta.trk != null || meta.amb != null) && (
        <div className="hint" style={{ marginTop: 4, opacity: .85, display: "flex",
          gap: 8, flexWrap: "wrap" }}>
          {meta.venue && <span><Icon name="bayrak" size={13} /> {meta.venue}</span>}
          {meta.vehicle && <span>· <Icon name="arac" size={13} /> {meta.vehicle}</span>}
          {meta.driver && <span>· <Icon name="kask" size={13} /> {meta.driver}</span>}
          {meta.trk != null && <span>· <Icon name="asfalt" size={13} /> {t("Pist")} {meta.trk.toFixed(0)}°</span>}
          {meta.amb != null && <span>· <Icon name="sicaklik" size={13} /> {t("Hava")} {meta.amb.toFixed(0)}°</span>}
        </div>
      )}

      {cmpBusy && <div className="hint" style={{ marginTop: 6 }}>⏳ {t("İzler hazırlanıyor…")}</div>}
      {!cmpBusy && !cmpData && <div className="hint" style={{ marginTop: 6 }}>{t("İz verisi çıkarılamadı — bu dosyada hız/mesafe kanalı olmayabilir.")}</div>}

      {cmpData && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <button className="act" style={{ fontSize: 13, padding: "3px 12px" }}
            title={t("Telemetriyi oynat")} onClick={() => setPlaying((p) => !p)}>
            {playing ? <Icon name="duraklat" size={13} /> : <Icon name="oynat" size={13} />}</button>
          <select value={playSpeed} onChange={(e) => setPlaySpeed(+e.target.value)}
            style={{ fontSize: 12 }} title={t("Oynatma hızı")}>
            <option value={0.5}>0.5×</option>
            <option value={1}>1×</option>
            <option value={2}>2×</option>
          </select>
          <input type="range" min={0} max={Math.max(0, N - 1)} value={cursor ?? 0}
            onChange={(e) => { const i = +e.target.value; setPlaying(false);
              playPosRef.current = i; setCursorF(null); setCursor(i); }}
            style={{ flex: "1 1 140px", minWidth: 120 }} aria-label={t("Konum")} />
          {cmpData.hasMap && (
            <button className="act" style={{ fontSize: 11, padding: "3px 10px" }}
              title={t("Haritayı büyük pencerede aç")} onClick={() => setBig(true)}>
              <Icon name="buyut" size={12} /> {t("Büyüt")}</button>
          )}
          <button className="act" style={{ fontSize: 11, padding: "3px 10px" }}
            title={t("Grafikleri PDF rapor olarak çıkart (tam tur için önce ⟳ sıfırla)")}
            onClick={exportTelePdf}><Icon name="dosya" size={12} /> PDF</button>
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
            <span className="chip" style={{ fontSize: 11 }}><Icon name="sektor" size={12} /> {Math.round(p.d)} {unit} · Δ {dlt(p.dt)}</span>
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
        <TrackMini t={t} data={cmpData.data} cursor={cf} src={cmpData.mapSrc} marks={marks} apex={apexes} onScrub={onScrub} />
      )}
      {cmpData && !cmpData.hasMap && (
        <div className="hint" style={{ marginTop: 6, opacity: .7 }}>
          <Icon name="harita" size={13} /> {t("Pist haritası çizilemedi — bu dosyada konum ya da yanal-G kanalı yok.")}
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
        <TraceRow data={cmpData.data} title={<><Icon name="kronometre" size={13} /> {t("Zaman-Delta (B−A)")}</>} unit={unit}
          keys={K_DT} colors={C_DT} fmt={dlt} height={140} zero
          onCursor={hoverCursor} onAnchor={anchorD} xDomain={xWin} bounds={marks} cursorD={cursorD} />
        {ch.speed && (
          <TraceRow data={cmpData.data} title={<><Icon name="bayrak" size={13} /> {t("Hız")} (km/h)</>} unit={unit}
            keys={K_SP} colors={C_AB} fmt={sp1}
            onCursor={hoverCursor} onAnchor={anchorD} xDomain={xWin} bounds={marks} cursorD={cursorD}
            dots={speedDots} />
        )}
        {ch.throttle && (
          <TraceRow data={cmpData.data} title={<><Icon name="pedal" size={13} /> {t("Gaz")} %</>} unit={unit}
            keys={K_TH} colors={C_AB} fmt={pct} height={110} dashB
            onCursor={hoverCursor} onAnchor={anchorD} xDomain={xWin} bounds={marks} cursorD={cursorD} />
        )}
        {ch.brake && (
          <TraceRow data={cmpData.data} title={<><Icon name="pedal" size={13} /> {t("Fren")} %</>} unit={unit}
            keys={K_BR} colors={C_AB} fmt={pct} height={110} dashB
            onCursor={hoverCursor} onAnchor={anchorD} xDomain={xWin} bounds={marks} cursorD={cursorD} />
        )}
        {ch.gear && (
          <TraceRow data={cmpData.data} title={<><Icon name="ayar" size={13} /> {t("Vites")}</>} unit={unit}
            keys={K_G} colors={C_AB} fmt={int0} height={100} dashB
            onCursor={hoverCursor} onAnchor={anchorD} xDomain={xWin} bounds={marks} cursorD={cursorD} />
        )}
        {ch.rpm && (
          <TraceRow data={cmpData.data} title={<><Icon name="somun" size={13} /> {t("RPM")}</>} unit={unit}
            keys={K_RPM} colors={C_AB} fmt={int0} height={100}
            onCursor={hoverCursor} onAnchor={anchorD} xDomain={xWin} bounds={marks} cursorD={cursorD} />
        )}
        {ch.steer && (
          <TraceRow data={cmpData.data} title={<><Icon name="pedal" size={13} /> {t("Direksiyon")}</>} unit={unit}
            keys={K_ST} colors={C_AB} fmt={sp1} height={100}
            onCursor={hoverCursor} onAnchor={anchorD} xDomain={xWin} bounds={marks} cursorD={cursorD} />
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
          <h3 style={{ fontSize: 13, margin: "14px 0 4px" }}><Icon name="bayrak" size={13} /> {t("Viraj Analizi")}</h3>
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
              <span><Icon name="harita" size={14} /> {t("Pist Haritası")}</span>
              <button className="act" style={{ fontSize: 12, padding: "2px 10px" }}
                title={t("Kapat")} onClick={() => setBig(false)}>✕</button>
            </div>
            <div className="mapwrap">
              <TrackMini t={t} data={cmpData.data} cursor={cf} src={cmpData.mapSrc} marks={marks} apex={apexes} onScrub={onScrub} big />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* Telemetri sekmesi — .duckdb içe aktarma, stint analizi + grafikler.
   Tüm state/derived (parsed/slotStats/chartData/loadedSlots/baseSlot) ve handler'lar
   App'ten prop gelir. fmtMs lokal (fmtLap sarmalayıcı). */
export default function TeleTab({
  t, lang, st, slot, setSlot, onTeleFile,
  parsed, saveMotec, loadedSlots, slotStats,
  up, apply105Slot, removeSlot, chartMode, setChartMode, chartData, baseSlot, toggleLap,
  cmpMeta, cmpA, setCmpA, cmpB, setCmpB, cmpData, cmpBusy, savedMsg,
  cmpSources, cmpASrc, setCmpASrc, cmpBSrc, setCmpBSrc, onSaveDuckSetup, standalone,
}) {
  const fmtMs = (ms) => fmtLap(ms / 1000);
  const teleHd = { fontFamily: "var(--rc-font-display)", textTransform: "uppercase", letterSpacing: ".08em", fontSize: 16, fontWeight: 700 };
  const teleCard = { border: "1px solid var(--rc-border)", borderRadius: 12, background: "var(--rc-surface)", padding: "16px 18px" };
  const [impOpen, setImpOpen] = useState(false);
  /* Kaydettikten sonra yükleme penceresini kapat (geri bildirim slot kartında görünür). */
  useEffect(() => { if (savedMsg) setImpOpen(false); }, [savedMsg]);

  /* Stint yuvası kartı: DOLU/BOŞ · medyan tur · tur/pist/araç. Spec 08-telemetri (42-60). */
  const slotIds = ["A", "B", "C", "D"];
  const slotCard = (sl) => {
    const has = !!st.telemetry[sl];
    const s = slotStats[sl];
    const filled = has && s && !s.empty;
    const c = SLOT_COLORS[sl];
    const meta = st.telemetry[sl]?.meta || {};
    const sel = slot === sl;
    return (
      <button key={sl} onClick={() => setSlot(sl)}
        style={{ flex: "1 1 340px", minWidth: 260, display: "flex", alignItems: "center", gap: 12, textAlign: "left",
          border: `1px solid ${sel ? c : filled ? "var(--rc-border)" : "var(--rc-border-strong)"}`,
          borderRadius: 12, cursor: "pointer",
          background: sel ? "rgba(150,0,24,.10)" : filled ? "var(--rc-surface)" : "var(--rc-surface-2)",
          padding: "14px 16px", opacity: filled ? 1 : .82 }}>
        <span style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0, flex: 1 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: filled ? c : "var(--rc-border-strong)", flex: "0 0 auto" }} />
            <span style={{ fontFamily: "var(--rc-font-display)", fontWeight: 700, fontSize: 17, letterSpacing: ".04em", whiteSpace: "nowrap" }}>Stint {sl}</span>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", padding: "2px 8px", borderRadius: 99,
              border: `1px solid ${filled ? c : "var(--rc-border-strong)"}`, color: filled ? c : "var(--rc-text-3)", textTransform: "uppercase" }}>
              {filled ? t("DOLU") : t("BOŞ")}</span>
          </span>
          <span style={{ fontFamily: "var(--rc-font-display)", fontWeight: 700, fontSize: filled ? 30 : 22,
            letterSpacing: ".01em", color: filled ? "var(--rc-text)" : "var(--rc-text-3)", lineHeight: 1 }}>
            {filled ? fmtMs(s.medMs) : "—"}</span>
          <span style={{ fontSize: 11, color: "var(--rc-text-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {filled
              ? [`${s.laps} ${t("tur")}`, meta.venue, meta.vehicle].filter(Boolean).join(" · ")
              : t("dosya bekleniyor")}</span>
        </span>
      </button>
    );
  };

  /* Stint analizi özet kutucukları — gerçek slotStats'tan (spec 147-160). */
  const la = loadedSlots.filter((sl) => slotStats[sl] && !slotStats[sl].empty);
  const base = (baseSlot && slotStats[baseSlot] && !slotStats[baseSlot].empty) ? baseSlot : la[0];
  const bS = base ? slotStats[base] : null;
  const other = la.find((sl) => sl !== base);
  /* İki yuvanın ortalama farkı: hızlı olan + ne kadar önde (spec: "−0.42 sn / A, B'den hızlı"). */
  const dlt2 = (other && bS) ? Math.abs(bS.avgMs - slotStats[other].avgMs) / 1000 : null;
  const dFast = (other && bS && bS.avgMs <= slotStats[other].avgMs) ? base : other;
  const dSlow = dFast === base ? other : base;
  const tile = (main, sub, col) => (
    <div style={{ flex: "1 1 180px", background: "var(--rc-surface-3)", border: "1px solid var(--rc-border)", borderRadius: 10, padding: "11px 14px" }}>
      <div style={{ fontFamily: "var(--rc-font-display)", fontSize: 24, fontWeight: 700, letterSpacing: ".01em", color: col || "var(--rc-text)", whiteSpace: "nowrap" }}>{main}</div>
      <div style={{ color: "var(--rc-text-3)", fontSize: 10, textTransform: "uppercase", letterSpacing: ".09em", marginTop: 3 }}>{sub}</div>
    </div>
  );

  /* Seans yan paneli — seçili slotun meta'sı + eylemler (spec 163-186).
     v2.2: dosya meta'sı eksikse (ör. yalnız tur zamanı içeren .duckdb) pist/araç
     yarış bağlamından (st) türetilir; pist görseli/bayrağı için trackId önce
     dosyanın venue adından (venueToTrackId), yoksa aktif yarıştan çözülür. */
  const curMeta = st.telemetry[slot]?.meta || {};
  const curS = slotStats[slot];
  const sessTrk = venueToTrackId(curMeta.venue) || st?.track || "";
  const sessCls = st?.carClass || "";
  const sessCar = st?.car || "";
  const sessVenue = curMeta.venue || (sessTrk ? trackName(sessTrk) : "");
  const sessVehicle = curMeta.vehicle || (sessCls && sessCar ? carName(sessCls, sessCar) : "");
  const sessRows = [
    ["Pist", sessVenue],
    ["Araç", sessVehicle],
    ["Pilot", curMeta.driver],
    ["Sıcaklık", (curMeta.trk != null || curMeta.amb != null)
      ? `🛣 ${curMeta.trk != null ? curMeta.trk.toFixed(0) + "°" : "—"} / 🌡 ${curMeta.amb != null ? curMeta.amb.toFixed(0) + "°" : "—"}` : null],
    ["Turlar", (curS && !curS.empty) ? `${curS.laps} ${t("tur")}` : null],
  ].filter(([, v]) => v);
  const sessLoaded = !!(curS && !curS.empty);
  const hideImg = (e) => { e.currentTarget.style.display = "none"; };

  /* Yükleme penceresi içeriği (eski import kartı — mantık birebir korundu). */
  const importInner = (
    <div data-tour="teleimport">
      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
        {slotIds.map((sl) => (
          <button key={sl} className="act"
            style={slot === sl
              ? { borderColor: SLOT_COLORS[sl], color: SLOT_COLORS[sl], fontWeight: 700 }
              : {}}
            onClick={() => setSlot(sl)}>
            Stint {sl}{st.telemetry[sl] ? " ●" : ""}
          </button>
        ))}
      </div>
      <label>{t("LMU yerel telemetri kaydını (.duckdb) seç")}</label>
      <div style={{ margin: "8px 0" }}>
        <input type="file" accept=".duckdb" onChange={onTeleFile} />
        {savedMsg && (
          <span className="hint" style={{ color: "var(--rc-ok)", marginLeft: 10, fontWeight: 600 }}>
            ✓ Stint {savedMsg} {t("kaydedildi")}</span>
        )}
      </div>
      {parsed?.loading && <div className="hint">⏳ {parsed.duck
        ? t("DuckDB çözümleniyor (ilk açılışta motor indirilir)…") : t("Telemetri çözümleniyor…")}</div>}
      {parsed?.error && <div className="hint warn"><Icon name="uyari" size={13} /> {t(parsed.error)}</div>}
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
                  <td>{l.lap}{l.pit ? <>{" "}<Icon name="pit" size={12} /></> : ""}
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
    </div>
  );

  return (
    <div style={{ padding: "2px 0 8px", fontFamily: "var(--rc-font-ui)", animation: "rcin .26s ease-out" }}>
      {/* başlık + yükle */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontFamily: "var(--rc-font-display)", textTransform: "uppercase", letterSpacing: ".06em", fontSize: 22, fontWeight: 700 }}>{t("Telemetri")}</h2>
        <span style={{ color: "var(--rc-text-3)", fontSize: 12 }}>.duckdb</span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button onClick={() => setImpOpen(true)}
            style={{ padding: "8px 16px", borderRadius: 9, border: "1px solid var(--rc-brand-bright)", background: "var(--rc-brand)", color: "var(--rc-on-brand)", cursor: "pointer", fontSize: 13, fontWeight: 600 }}><Icon name="yukle" size={13} /> {t("Telemetri yükle")}</button>
        </span>
      </div>

      {/* boş durum */}
      {loadedSlots.length === 0 && (
        <div style={{ border: "1.5px dashed var(--rc-border-strong)", borderRadius: 14, background: "var(--rc-surface-2)", padding: "48px 24px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 11, marginBottom: 16 }}>
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--rc-border-strong)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4v16h16" /><path d="m7 14 3-3 3 2 4-5" /></svg>
          <div style={{ fontFamily: "var(--rc-font-display)", fontWeight: 700, fontSize: 20 }}>{t("Henüz telemetri yok")}</div>
          <div style={{ fontSize: 12.5, color: "var(--rc-text-3)", lineHeight: 1.7, maxWidth: 430 }}>{t("Stint yuvalarına .duckdb dosyası yükle; iki turu karşılaştırmak için en az bir dosya gerekir.")}</div>
          <button onClick={() => setImpOpen(true)} style={{ marginTop: 4, padding: "9px 18px", borderRadius: 10, border: "1px solid var(--rc-brand-bright)", background: "var(--rc-brand)", color: "var(--rc-on-brand)", cursor: "pointer", fontSize: 13, fontWeight: 600 }}><Icon name="yukle" size={13} /> {t("Telemetri yükle")}</button>
        </div>
      )}

      {/* stint yuvaları */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        {slotIds.map(slotCard)}
      </div>

      {loadedSlots.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "stretch" }}>
          {/* stint analizi ana kartı */}
          <div style={{ ...teleCard, flex: "1 1 620px", minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
              <span style={teleHd}>{t("Stint analizi")}</span>
              <span style={{ display: "flex", gap: 6, marginLeft: 12 }}>
                {[["line", "Tur tur"], ["box", "Kutu grafiği"]].map(([m, lbl]) => {
                  const on = chartMode === m;
                  return (
                    <button key={m} onClick={() => setChartMode(m)}
                      style={{ padding: "6px 13px", borderRadius: 9, cursor: "pointer", fontSize: 12.5,
                        border: `1px solid ${on ? "var(--rc-brand-bright)" : "var(--rc-border)"}`,
                        background: on ? "rgba(150,0,24,.22)" : "var(--rc-surface-3)",
                        color: on ? "var(--rc-text)" : "var(--rc-text-2)" }}>{t(lbl)}</button>
                  );
                })}
              </span>
              <span style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center", fontSize: 11.5, color: "var(--rc-text-3)", flexWrap: "wrap" }}>
                {la.map((sl) => (
                  <span key={sl} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <i style={{ width: 10, height: 3, background: SLOT_COLORS[sl], display: "inline-block" }} />Stint {sl}</span>
                ))}
              </span>
            </div>

            {chartMode === "box" ? (
              <div style={{ margin: "2px 0" }}>
                <BoxPlot height={300} fmt={(v) => fmtLap(v / 1000)}
                  series={loadedSlots.map((sl) => ({
                    key: sl, label: `Stint ${sl}`, color: SLOT_COLORS[sl],
                    values: st.telemetry[sl].laps.filter((l) => l.use).map((l) => l.ms),
                  })).filter((s) => s.values.length)} />
              </div>
            ) : (
              <div style={{ height: 280 }}>
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
                        dot={false} strokeWidth={2} connectNulls isAnimationActive={false} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* özet kutucukları */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--rc-border)" }}>
              {dlt2 != null && tile(
                `−${dlt2.toFixed(2)} sn`,
                `${dFast}, ${dSlow}${"'den hızlı (ort.)"}`,
                "var(--rc-ok-2)")}
              {bS?.medFuel != null && tile(
                `${bS.medFuel.toFixed(2)} %/tur`,
                `${t("Medyan VE")}${bS.tankLaps ? ` · %100 ≈ ${Math.floor(bS.tankLaps)} ${t("tur")}` : ""}`)}
              {bS?.medW?.some((w) => w != null) && tile(
                bS.medW.map((w) => w == null ? "–" : w.toFixed(1)).join(" / "),
                `${t("Aşınma %/tur")} · FL FR RL RR`)}
            </div>

            {loadedSlots.length > 1 && baseSlot && slotStats[baseSlot] && !slotStats[baseSlot].empty && (
              <table style={{ maxWidth: 460, marginTop: 14, fontSize: 12 }}>
                <thead><tr><th>{t("Karşılaştırma")}</th><th>{t("Ort. Fark")}</th><th>{t("Hızlı Olan")}</th></tr></thead>
                <tbody>
                  {loadedSlots.slice(1).map((sl) => {
                    const a = slotStats[baseSlot], b = slotStats[sl];
                    if (!b || b.empty) return null;
                    const d = (a.avgMs - b.avgMs) / 1000; // + ise rakip hızlı
                    return (
                      <tr key={sl}>
                        <td>Stint {baseSlot} vs Stint {sl}</td>
                        <td className={d > 0 ? "neg" : "pos"}>{d > 0 ? "▲" : "▼"} {Math.abs(d).toFixed(3)}s/tur</td>
                        <td style={{ color: SLOT_COLORS[d > 0 ? sl : baseSlot] }}>
                          Stint {d > 0 ? sl : baseSlot}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Seans yan paneli */}
          <div style={{ flex: "1 1 300px", minWidth: 280, display: "flex", flexDirection: "column", gap: 12, alignSelf: "stretch" }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column",
              border: "1px solid var(--rc-border-strong)", borderRadius: 12,
              background: "radial-gradient(120% 160% at 100% 0,rgba(150,0,24,.24),var(--rc-surface-2) 62%)", padding: "14px 16px" }}>
              <div style={{ fontFamily: "var(--rc-font-display)", textTransform: "uppercase", letterSpacing: ".08em", fontSize: 14, fontWeight: 700, marginBottom: 12, color: "var(--rc-brand-bright)" }}>{t("Seans")} · {slot}</div>
              {sessLoaded && (sessTrk || (sessCls && sessCar)) && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  {sessTrk && <img src={`${ASSET}flags/${TRACK_ASSET(sessTrk)}.png`} alt="" onError={hideImg}
                    style={{ width: 26, borderRadius: 3, flex: "0 0 auto" }} />}
                  {sessCls && sessCar && <img src={carImg(sessCls, sessCar)} alt="" onError={hideImg}
                    style={{ flex: 1, minWidth: 0, maxHeight: 46, objectFit: "contain" }} />}
                  {sessTrk && <img src={`${ASSET}tracks/${TRACK_ASSET(sessTrk)}.png`} alt="" onError={hideImg}
                    style={{ height: 46, maxWidth: 96, objectFit: "contain", opacity: .85, flex: "0 0 auto" }} />}
                </div>
              )}
              {sessRows.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {sessRows.map(([k, v]) => (
                    <span key={k} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                      <span style={{ width: 74, flex: "0 0 auto", color: "var(--rc-text-3)", fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".08em" }}>{t(k)}</span>
                      <b style={{ fontSize: 12.5, fontFamily: k === "Sıcaklık" ? "var(--rc-font-display)" : "var(--rc-font-ui)" }}>{v}</b>
                    </span>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: "var(--rc-text-3)", lineHeight: 1.6 }}>{t("Bu yuva boş — yükle ya da başka bir Stint seç.")}</div>
              )}
              {curS && !curS.empty && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: "auto", paddingTop: 14, borderTop: "1px solid var(--rc-line-soft)" }}>
                  {!standalone && (
                    <button onClick={() => up({ avgLap: fmtMs(curS.medMs), ...(curS.medFuel != null ? { consumption: +curS.medFuel.toFixed(2) } : {}) })}
                      style={{ padding: "7px 14px", borderRadius: 9, border: "1px solid var(--rc-brand-bright)", background: "rgba(150,0,24,.22)", color: "var(--rc-text)", cursor: "pointer", fontSize: 12 }}>{t("Data'ya uygula")}</button>
                  )}
                  <button onClick={() => apply105Slot(slot)}
                    title={t("En iyi turun %105'ini aşan turların tikini kaldır")}
                    style={{ padding: "7px 14px", borderRadius: 9, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 12 }}>{t("%105 filtre")}</button>
                  <button onClick={() => removeSlot(slot)}
                    style={{ padding: "7px 14px", borderRadius: 9, border: "1px solid var(--rc-danger)", background: "transparent", color: "var(--rc-danger)", cursor: "pointer", fontSize: 12 }}>{t("Stinti sil")}</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* çözümlenen tur listeleri (dahil/hariç işaretleme) */}
      {loadedSlots.length > 0 && (
        <div style={{ ...teleCard, marginTop: 16 }}>
          <div style={{ ...teleHd, marginBottom: 10 }}>{t("Çözümlenen turlar")}</div>
          {loadedSlots.map((sl) => (
            <details key={sl} style={{ marginTop: 8 }}>
              <summary style={{ cursor: "pointer", color: SLOT_COLORS[sl] }}>
                Stint {sl} — {t("tur listesi")} ({st.telemetry[sl].laps.length})</summary>
              <div style={{ overflowX: "auto" }}>
                <table style={{ maxWidth: 560, marginTop: 6 }}>
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
              </div>
            </details>
          ))}
        </div>
      )}

      {cmpMeta?.setup && (
        <SessionSetupBox setup={cmpMeta.setup} meta={cmpMeta} t={t} onSave={onSaveDuckSetup} />
      )}

      {cmpSources?.length > 0 && (
        <TraceCompareCard t={t} sources={cmpSources} fallbackMeta={cmpMeta}
          cmpASrc={cmpASrc} setCmpASrc={setCmpASrc} cmpBSrc={cmpBSrc} setCmpBSrc={setCmpBSrc}
          cmpA={cmpA} setCmpA={setCmpA} cmpB={cmpB} setCmpB={setCmpB}
          cmpData={cmpData} cmpBusy={cmpBusy} />
      )}

      {/* Telemetri yükle penceresi */}
      {impOpen && (
        <div onClick={() => setImpOpen(false)} role="dialog" aria-modal="true"
          style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(10,6,10,.78)", backdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, animation: "rcfade .18s ease" }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ width: "min(760px,96vw)", maxHeight: "90vh", display: "flex", flexDirection: "column", background: "var(--rc-surface)", border: "1px solid var(--rc-border-strong)", borderRadius: 16, overflow: "hidden", boxShadow: "0 24px 70px rgba(0,0,0,.6)", animation: "rcpop .22s cubic-bezier(.2,.9,.3,1.05)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "15px 20px", borderBottom: "1px solid var(--rc-border)" }}>
              <span style={{ fontFamily: "var(--rc-font-display)", textTransform: "uppercase", letterSpacing: ".07em", fontSize: 18, fontWeight: 700 }}>{t("Telemetri yükle")}</span>
              <span style={{ fontSize: 12, color: "var(--rc-text-3)", marginRight: "auto" }}>.duckdb</span>
              <button onClick={() => setImpOpen(false)} style={{ width: 31, height: 31, borderRadius: 9, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 14, lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ padding: "18px 20px", overflowY: "auto" }}>
              {importInner}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
