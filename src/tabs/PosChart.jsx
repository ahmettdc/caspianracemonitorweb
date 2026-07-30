import { useState, useEffect, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { classAccent } from "../constants";
import { livePosSubscribe } from "../storage";

/* Pozisyon–tur grafiği — kalıcı livepos düğümünden (teams/{tid}/livepos/{rid})
   tüm sahanın tur-tur pozisyonunu okur. Her araç bir çizgi (sınıf renginde),
   oyuncu kalın #960018. Pit turu (negatif kodlanmış) noktada 'P' ile işaretlenir.
   Y ekseni ters (P1 üstte). Köprü çalışmadıysa/veri yoksa kart gösterilmez. */

const BRAND = "#960018";

// "Dan Harper" → "HAR" (soyadın ilk 3 harfi); grafikte kısa etiket
function code(name) {
  const s = String(name || "").trim();
  if (!s) return "—";
  const parts = s.split(/\s+/);
  return (parts[parts.length - 1] || s).slice(0, 3).toUpperCase();
}

export default function PosChart({ t, tid, rid, field }) {
  const [posMap, setPosMap] = useState(null);   // {lapKey: {n: pos}} (pit → negatif)
  useEffect(() => {
    if (!tid || !rid) { setPosMap(null); return undefined; }
    return livePosSubscribe(tid, rid, setPosMap);
  }, [tid, rid]);

  // lapKey → {driver, code, color, isPlayer} (canlı kareden)
  const meta = useMemo(() => {
    const m = {};
    for (const c of (Array.isArray(field) ? field : [])) {
      if (c.lapKey) m[c.lapKey] = {
        driver: c.driver || c.lapKey, code: code(c.driver),
        color: classAccent(c.carClass) || "#8A7176", isPlayer: !!c.isPlayer,
      };
    }
    return m;
  }, [field]);

  // grafik verisi: her tur için { lap, [lapKey]: pos } + pit noktaları
  const { data, keys, maxPos, pitSet } = useMemo(() => {
    const pm = posMap && typeof posMap === "object" ? posMap : {};
    const byLap = {};
    const pit = new Set();
    let mx = 0;
    const ks = Object.keys(pm);
    for (const k of ks) {
      const laps = pm[k] || {};
      for (const nStr of Object.keys(laps)) {
        const n = +nStr; const raw = +laps[nStr];
        if (!n || !raw) continue;
        const pos = Math.abs(raw);
        if (raw < 0) pit.add(`${k}|${n}`);
        (byLap[n] || (byLap[n] = { lap: n }))[k] = pos;
        if (pos > mx) mx = pos;
      }
    }
    const arr = Object.values(byLap).sort((a, b) => a.lap - b.lap);
    return { data: arr, keys: ks, maxPos: mx, pitSet: pit };
  }, [posMap]);

  if (!data.length) return null;

  // pit turu için özel nokta (kapanış içinde lapKey bilinir)
  const pitDot = (k) => (props) => {
    const { cx, cy, payload } = props;
    if (cx == null || cy == null || !pitSet.has(`${k}|${payload.lap}`)) return null;
    return (
      <g key={`${k}-${payload.lap}`}>
        <circle cx={cx} cy={cy} r={6} fill="var(--panel)"
          stroke={meta[k]?.color || "#8A7176"} strokeWidth={1.6} />
        <text x={cx} y={cy + 3} fontSize="8" fontWeight="700" textAnchor="middle"
          fill="var(--txt)">P</text>
      </g>
    );
  };

  const tip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const rows = payload.filter((p) => p.value != null)
      .sort((a, b) => a.value - b.value).slice(0, 8);
    return (
      <div style={{ background: "var(--panel)", border: "1px solid var(--line)",
        borderRadius: 8, padding: "6px 9px", fontSize: 12 }}>
        <div style={{ color: "var(--dim)", marginBottom: 3 }}>{t("Tur")} {label}</div>
        {rows.map((p) => (
          <div key={p.dataKey} style={{ color: p.stroke, whiteSpace: "nowrap" }}>
            P{p.value} · {meta[p.dataKey]?.code || "—"}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <h2 style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        📈 {t("Pozisyon Grafiği")}
        <span className="hint" style={{ margin: 0, fontWeight: 400 }}>
          {t("tur")} {data[0].lap}–{data[data.length - 1].lap} · {keys.length} {t("araç")}</span>
      </h2>
      <div style={{ width: "100%", height: 360 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -18 }}>
            <XAxis dataKey="lap" tick={{ fontSize: 11, fill: "var(--dim)" }}
              stroke="var(--line)" />
            <YAxis reversed domain={[1, Math.max(maxPos, 1)]} allowDecimals={false}
              tick={{ fontSize: 11, fill: "var(--dim)" }} stroke="var(--line)" width={34} />
            <Tooltip content={tip} />
            {keys.map((k) => {
              const mm = meta[k] || {};
              return (
                <Line key={k} type="monotone" dataKey={k}
                  stroke={mm.isPlayer ? BRAND : mm.color} connectNulls
                  strokeWidth={mm.isPlayer ? 3 : 1.5}
                  dot={pitDot(k)} activeDot={{ r: 3 }} isAnimationActive={false} />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="hint">
        {t("Y ekseni ters (P1 üstte) · renk = sınıf · kalın #960018 = sen · 'P' = pit turu. Köprü çalışırken tur-tur birikir; tüm takım aynı grafiği görür.")}
      </div>
    </div>
  );
}
