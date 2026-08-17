import { useState } from "react";
import { fmtDur } from "../engine";

/* Strateji rozetleri — kendi araç için gap'lerden hesaplanan pit-wall ipuçları:
   önündeki/arkandaki araç, temiz hava, trafik riski ve pit çıkışı tahmini.
   Pit-loss (pit yolunda kaybedilen saniye) kullanıcı girer; localStorage'da tutulur.
   Yalnız gösterim; ek veri gerektirmez (mevcut gapSec/intervalSec). Ana tema #960018. */

const TRAFFIC_WIN = 3;   // ±sn trafik penceresi

const codeOf = (name) => {
  const p = String(name || "").trim().split(/\s+/);
  return (p[p.length - 1] || "—").slice(0, 3).toUpperCase();
};
/* süre biçimi → engine.fmtDur (taşma düzeltmesi + birim testli; yerel kopya
   "1:60.0" gibi değerler üretiyordu) */
const fmt = fmtDur;

/* Etiket/değer SATIRI (fiş 05-canli-strateji: ~92px etiket + Rajdhani bold değer).
   Yatay çip yerine dikey satır düzeni → pit-wall'da hızlı taranır. */
function Row({ label, value, color, title }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10 }} title={title}>
      <span style={{ width: 92, flex: "0 0 auto", fontSize: 10, color: "var(--rc-text-3)",
        textTransform: "uppercase", letterSpacing: ".08em" }}>{label}</span>
      <b style={{ fontFamily: "var(--rc-font-display)", fontSize: 15,
        color: color || "var(--rc-text)" }}>{value}</b>
    </div>
  );
}

export default function StrategyBar({ t, field, embedded }) {
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

  const inner = (<>
      <h2 style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
        ...(embedded && { marginTop: 0 }) }}>
        🎯 {t("Strateji")}
        <span className="chip" style={{ fontSize: 11, borderColor: "var(--rc-brand-bright)",
          color: "var(--rc-on-brand)", background: "var(--rc-brand)" }}>
          {codeOf(me.driver)} · P{me.pos}</span>
      </h2>
      {/* fiş: dikey etiket/değer satırları (yatay çip yerine) */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Row label={t("Önünde")}
          value={ahead ? `${codeOf(ahead.driver)} +${fmt(aheadGap)}` : t("Lider")}
          title={t("Öndeki araca fark")} />
        <Row label={t("Arkanda")}
          value={behind ? `${codeOf(behind.driver)} -${fmt(behindGap)}` : "—"}
          title={t("Arkadaki aracın farkı")} />
        <Row label={t("Temiz hava")}
          value={clean != null ? `${t("en yakın")} ${fmt(clean)}s` : "—"}
          color={clean != null && clean > 5 ? "var(--rc-ok)" : undefined}
          title={t("En yakın araca zaman farkı")} />
        <Row label={t("Trafik")}
          value={`±${TRAFFIC_WIN}s ${t("içinde")} ${traffic} ${t("araç")}`}
          color={traffic > 0 ? "var(--rc-warn)" : "var(--rc-ok)"}
          title={t("±3 sn içinde kaç araç var")} />
        <Row label={t("Pit çıkışı")}
          value={`~P${newPos}${rejoinAhead ? ` · ${codeOf(rejoinAhead.driver)}↑` : ""}${rejoinBehind ? ` ${codeOf(rejoinBehind.driver)}↓` : ""}`}
          color="var(--rc-brand-bright)"
          title={t("Şimdi pit'e girersen (pit kaybı kadar geriye) tahmini sıra")} />
      </div>
      {/* fiş: pit-kaybı girişi altta, ayraçla ayrılmış */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12,
        paddingTop: 12, borderTop: "1px solid var(--rc-border)" }}>
        <span style={{ fontSize: 10, color: "var(--rc-text-3)", textTransform: "uppercase",
          letterSpacing: ".08em" }}>{t("Pit kaybı")}</span>
        <input type="number" min="0" max="180" value={pitLoss}
          onChange={(e) => setPL(Math.max(0, Number(e.target.value) || 0))}
          style={{ width: 64, padding: "5px 8px", fontSize: 14, textAlign: "right",
            fontFamily: "var(--rc-font-display)", background: "var(--rc-surface-3)",
            border: "1px solid var(--rc-border)", borderRadius: 8, color: "var(--rc-text)" }} />
        <span style={{ color: "var(--rc-text-3)", fontSize: 12 }}>{t("saniye")}</span>
      </div>
  </>);
  // gömülü: dış kart yok (harita kartının içinde, en üstte) — ince ayraçla ayrılır
  if (embedded) {
    return (
      <div style={{ paddingBottom: 10, marginBottom: 10,
        borderBottom: "1px solid var(--line)" }}>{inner}</div>
    );
  }
  return <div className="card" style={{ marginBottom: 12 }}>{inner}</div>;
}
