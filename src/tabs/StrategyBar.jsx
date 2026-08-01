import { useState } from "react";
import { fmtDur } from "../engine";

/* Strateji rozetleri — kendi araç için gap'lerden hesaplanan pit-wall ipuçları:
   önündeki/arkandaki araç, temiz hava, trafik riski ve pit çıkışı tahmini.
   Pit-loss (pit yolunda kaybedilen saniye) kullanıcı girer; localStorage'da tutulur.
   Yalnız gösterim; ek veri gerektirmez (mevcut gapSec/intervalSec). Ana tema #960018. */

const BRAND = "#960018";
const TRAFFIC_WIN = 3;   // ±sn trafik penceresi

const codeOf = (name) => {
  const p = String(name || "").trim().split(/\s+/);
  return (p[p.length - 1] || "—").slice(0, 3).toUpperCase();
};
/* süre biçimi → engine.fmtDur (taşma düzeltmesi + birim testli; yerel kopya
   "1:60.0" gibi değerler üretiyordu) */
const fmt = fmtDur;

function Chip({ label, value, color, title }) {
  return (
    <span className="chip" title={title} style={{ display: "inline-flex", gap: 6,
      alignItems: "baseline", fontSize: 12, ...(color && { borderColor: color }) }}>
      <span style={{ color: "var(--dim)", textTransform: "uppercase", fontSize: 10,
        letterSpacing: ".04em" }}>{label}</span>
      <b style={{ color: color || "var(--txt)" }}>{value}</b>
    </span>
  );
}

export default function StrategyBar({ t, field }) {
  const [pitLoss, setPitLoss] = useState(() => {
    const v = Number(localStorage.getItem("rm_pitloss"));
    return v > 0 ? v : 30;
  });
  const setPL = (v) => { setPitLoss(v); try { localStorage.setItem("rm_pitloss", String(v)); } catch { /* yoksay */ } };

  const rows = Array.isArray(field) ? field : [];
  const me = rows.find((c) => c.isPlayer);
  if (!me) return null;
  const idx = rows.indexOf(me);
  const ahead = idx > 0 ? rows[idx - 1] : null;
  const behind = idx >= 0 && idx < rows.length - 1 ? rows[idx + 1] : null;

  const aheadGap = me.intervalSec > 0 ? me.intervalSec : null;      // öndeki araca
  const behindGap = behind && behind.intervalSec > 0 ? behind.intervalSec : null;
  const myGap = me.gapSec || 0;                                     // lidere fark

  // trafik: ±TRAFFIC_WIN sn içindeki araç sayısı (lidere farkın mutlak yakınlığı)
  const traffic = rows.filter((c) => !c.isPlayer
    && Math.abs((c.gapSec || 0) - myGap) <= TRAFFIC_WIN).length;
  const nearest = Math.min(aheadGap ?? Infinity, behindGap ?? Infinity);
  const clean = Number.isFinite(nearest) ? nearest : null;

  // pit çıkışı: pit-loss kadar geriye düşersen (~lidere farkın artar) hangi sıraya?
  const newGap = myGap + pitLoss;
  const newPos = 1 + rows.filter((c) => c !== me && (c.gapSec || 0) < newGap).length;
  const rejoinAhead = [...rows].reverse().find((c) => c !== me && (c.gapSec || 0) < newGap);
  const rejoinBehind = rows.find((c) => c !== me && (c.gapSec || 0) >= newGap);

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <h2 style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        🎯 {t("Strateji")}
        <span className="chip" style={{ fontSize: 11, borderColor: BRAND, color: "#fff",
          background: BRAND }}>{codeOf(me.driver)} · P{me.pos}</span>
        <label style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6,
          fontSize: 11, color: "var(--dim)" }}>
          {t("PIT KAYBI")}
          <input type="number" min="0" max="180" value={pitLoss}
            onChange={(e) => setPL(Math.max(0, Number(e.target.value) || 0))}
            style={{ width: 56, padding: "3px 6px", fontSize: 13, textAlign: "right" }} />
          <span>s</span>
        </label>
      </h2>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Chip label={t("Önünde")}
          value={ahead ? `${codeOf(ahead.driver)} +${fmt(aheadGap)}` : t("Lider")}
          title={t("Öndeki araca fark")} />
        <Chip label={t("Arkanda")}
          value={behind ? `${codeOf(behind.driver)} -${fmt(behindGap)}` : "—"}
          title={t("Arkadaki aracın farkı")} />
        <Chip label={t("Temiz hava")}
          value={clean != null ? `${t("en yakın")} ${fmt(clean)}s` : "—"}
          color={clean != null && clean > 5 ? "var(--green)" : undefined}
          title={t("En yakın araca zaman farkı")} />
        <Chip label={t("Trafik")}
          value={`±${TRAFFIC_WIN}s ${t("içinde")} ${traffic} ${t("araç")}`}
          color={traffic > 0 ? "var(--yellow)" : "var(--green)"}
          title={t("±3 sn içinde kaç araç var")} />
        <Chip label={t("Pit çıkışı")}
          value={`~P${newPos}${rejoinAhead ? ` · ${codeOf(rejoinAhead.driver)}↑` : ""}${rejoinBehind ? ` ${codeOf(rejoinBehind.driver)}↓` : ""}`}
          color={BRAND}
          title={t("Şimdi pit'e girersen (pit kaybı kadar geriye) tahmini sıra")} />
      </div>
    </div>
  );
}
