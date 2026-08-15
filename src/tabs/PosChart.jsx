import { useState, useEffect, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { classId, TEAM_COLORS } from "../constants";
import { livePosSubscribe } from "../storage";
import { buildPosData, teamColors } from "../posData";

/* Pozisyon–tur grafiği — kalıcı livepos düğümünden (teams/{tid}/livepos/{rid})
   tüm sahanın tur-tur pozisyonunu okur. Her araç bir çizgi (TAKIM renginde,
   v1.8.16 — aynı sınıftaki araçlar artık ayırt edilir), oyuncu kalın #960018.
   Her çizginin sağ ucunda pilot kodu (renk tekrar etse de kimlik nettir). Pit turu
   (negatif kodlanmış) noktada 'P' ile işaretlenir. Y ekseni ters (P1 üstte).
   `myClassOnly` açıkken yalnız oyuncunun sınıfı + sınıf-içi pozisyon (1..N).
   Köprü çalışmadıysa/veri yoksa kart gösterilmez. */

const BRAND = "#960018";

// "Dan Harper" → "HAR" (soyadın ilk 3 harfi); grafikte kısa etiket
function code(name) {
  const s = String(name || "").trim();
  if (!s) return "—";
  const parts = s.split(/\s+/);
  return (parts[parts.length - 1] || s).slice(0, 3).toUpperCase();
}

export default function PosChart({ t, tid, rid, field, myClassOnly, playerClass }) {
  const [posMap, setPosMap] = useState(null);   // {lapKey: {n: pos}} (pit → negatif)
  useEffect(() => {
    if (!tid || !rid) { setPosMap(null); return undefined; }
    return livePosSubscribe(tid, rid, setPosMap);
  }, [tid, rid]);

  // sınıf süzgeci: yalnız oyuncunun sınıfı + sınıf-içi pozisyon (1..N)
  const only = myClassOnly && playerClass ? playerClass : null;

  /* lapKey → {driver, code, color, isPlayer} (canlı kareden).
     `field` Firebase'den HER karede yeni dizi kimliğiyle gelir → doğrudan dep
     yapılırsa memo hiç tutmaz ve aşağıdaki buildPosData + ~16k noktalı grafik
     2 Hz'de yeniden kurulurdu. metaKey = içerik parmak izi (ucuz string):
     yalnız sürücü/sınıf/takım/oyuncu/süzgeç GERÇEKTEN değişince meta yenilenir. */
  const metaKey = (Array.isArray(field) ? field : [])
    .map((c) => `${c.lapKey ?? ""}|${c.driver ?? ""}|${c.carClass ?? ""}|${c.team ?? ""}|${c.isPlayer ? 1 : 0}`)
    .join(",") + `#${only ?? ""}`;
  const meta = useMemo(() => {
    const rows = Array.isArray(field) ? field : [];
    /* Takım rengi TÜM sahadan hesaplanır (entiteye bağlı, stabil) → süzgeç açılıp
       kapanınca hayatta kalan çizgiler yeniden boyanmaz. */
    const colorOf = teamColors(
      rows.filter((c) => c.lapKey).map((c) => ({ lapKey: c.lapKey, team: c.team })),
      TEAM_COLORS);
    const m = {};
    for (const c of rows) {
      if (!c.lapKey) continue;
      if (only && classId(c.carClass) !== only) continue;   // sınıf süzgeci
      m[c.lapKey] = {
        driver: c.driver || c.lapKey, code: code(c.driver),
        color: colorOf[c.lapKey] || "#8A7176", isPlayer: !!c.isPlayer,
      };
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metaKey]);

  /* grafik verisi: her tur için { lap, [lapKey]: pos } + pit noktaları.
     Mantık saf modülde (posData.js) — bayat anahtarlar (sahada olmayan araçlar)
     elenir; testlerle korunur. only → sınıf-içi 1..N re-rank. */
  const { data, keys, maxPos, pitSet, lastLap } = useMemo(
    () => buildPosData(posMap, meta, { rerank: !!only }), [posMap, meta, only]);

  /* Grafik bloğu memo (v1.8.0): data/keys/meta/pitSet yalnız gerçek livepos
     yazımlarında (tur başına ~1) değişir → aynı element kimliği korunur ve React
     ~16k noktalı Recharts alt ağacını canlı kareler arasında hiç dolaşmaz.
     pitDot/tip memo içinde tanımlı — taze fonksiyon kimlikleri de tur başına.
     `t` bilinçli olarak deps dışında: dil değişimi bir sonraki tur güncellemesinde
     yansır (etiketler statike yakın — kabul edilen ödünleşim). */
  const chart = useMemo(() => {
    if (!data.length) return null;
    // uç etiket için: tur no → data indeksi (bir kez)
    const lapIdx = new Map(data.map((r, i) => [r.lap, i]));
    /* Her çizginin SAĞ UCUNDA pilot kodu (renk tekrar etse de kimlik nettir —
       dataviz: >7 seride ikincil kodlama şart). Yalnız aracın son turunda çizilir. */
    const endLbl = (k) => {
      const idx = lastLap[k] != null ? lapIdx.get(lastLap[k]) : undefined;
      const mm = meta[k] || {};
      return (props) => {
        const { x, y, index } = props;
        if (idx == null || index !== idx || x == null || y == null) return null;
        return (
          <text x={x + 5} y={y + 3} fontSize="9" fontWeight="700" textAnchor="start"
            fill={mm.isPlayer ? BRAND : (mm.color || "#8A7176")}>{mm.code}</text>
        );
      };
    };
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
      <div className="card" data-tour="livepos" style={{ marginBottom: 12 }}>
        <h2 style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          📈 {t("Pozisyon Grafiği")}
          <span className="hint" style={{ margin: 0, fontWeight: 400 }}>
            {t("tur")} {data[0].lap}–{data[data.length - 1].lap} · {keys.length} {t("araç")}
            {only ? ` · ${t("Kendi sınıfım")}` : ""}</span>
        </h2>
        <div style={{ width: "100%", height: 360 }}>
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 8, right: 44, bottom: 4, left: -18 }}>
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
                    dot={pitDot(k)} label={endLbl(k)} activeDot={{ r: 3 }}
                    isAnimationActive={false} />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, keys, meta, pitSet, maxPos, lastLap]);

  return chart;
}
