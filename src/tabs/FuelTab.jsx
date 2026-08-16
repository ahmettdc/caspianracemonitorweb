import { useState } from "react";
import { fmtHMS, lastStintFuel } from "../engine";
import { Bolt } from "../components";

/* Senaryolar (README §5): Planlanan / Tasarruflu / Agresif. Her satırda
   düzenlenebilir %/tur girdisi, o tüketimle hesaplanan gereken yüzde ve
   plandan fark. Yeni veri katmanı YOK — yalnız görünüm; hesap mevcut
   lastStintFuel() ile yapılır, state'e hiçbir şey yazılmaz. */
const SCEN = [
  { id: "plan", label: "Planlanan", mul: 1 },
  { id: "save", label: "Tasarruflu", mul: 0.95 },
  { id: "push", label: "Agresif", mul: 1.05 },
];

/* Son Stint Yakıtı sekmesi — kalan süreye göre VE/yakıt ihtiyacı.
   Türetilmiş değerler (lsf, planLastCd, racePlan) ve up/autoCd App'ten prop gelir. */
export default function FuelTab({ t, st, up, lsf, autoCd, setAutoCd, planLastCd, racePlan,
  liveFuelObs, applyLiveFuel, canEdit }) {
  const applyDisabled = !liveFuelObs || !canEdit
    || (!liveFuelObs.obsCons && !liveFuelObs.obsRatio);

  /* Senaryo tüketimleri — yerel, kalıcı değil. Varsayılanlar plandaki
     tüketimin ±%5'i (tasarruflu / agresif). */
  const baseCons = Number(st.consumption) || 0;
  const [scen, setScen] = useState(() =>
    Object.fromEntries(SCEN.map((x) => [x.id, (baseCons * x.mul).toFixed(2)])));
  const effCd = autoCd ? fmtHMS(planLastCd) : st.lastStintCountdown;
  const planRefuel = lastStintFuel(effCd, st, racePlan.flagExtra).refuel;

  return (
    <div className="row2" data-tour="fuelcalc"
      style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr" }}>
      {[
        [t("YARIŞ SONU"), st.lastStintCountdown, (v) => up({ lastStintCountdown: v }), lsf, true],
        /* [t("CODE 80 SONU"), ...] — şimdilik gizli, kod korunuyor (lsf80) */
      ].map(([title, val, setVal, r, canAuto]) => {
        const isAuto = canAuto && autoCd;
        const eff = isAuto ? fmtHMS(planLastCd) : val;
        const rr = isAuto ? lastStintFuel(eff, st, racePlan.flagExtra) : r;
        return ([title, eff, setVal, rr, isAuto, canAuto]);
      }).map(([title, val, setVal, r, isAuto, canAuto]) => (
        <div className={`card ${title.includes("CODE 80") ? "c80" : ""}`} key={title}>
          <h2>⛽ {t("Son Stint Yakıtı")} · {title}
            {/* README §18: izleyici modunda AÇIKLAMA METNİ yalnız burada. */}
            {!canEdit && (
              <span className="ro-note" style={{ marginLeft: "auto" }}>
                👁 {t("İzleyici modunda pasif")}</span>
            )}
          </h2>
          <label>{t("Session Countdown (h:mm:ss)")}{" "}
            {canAuto && (
              <button className={autoCd ? "chip" : ""}
                style={{ marginLeft: 6, padding: "2px 8px", borderRadius: 6, fontSize: 10,
                  border: "1px solid var(--line)", cursor: "pointer",
                  background: autoCd ? "var(--car)" : "var(--panel2)",
                  color: autoCd ? "#FFE9ED" : "var(--dim)" }}
                title={t("Stint planından otomatik — sondan önceki stintin Time Left değeri")}
                onClick={() => setAutoCd(!autoCd)}>{t("📋 PLAN")}</button>
            )}
          </label>
          <input type="text" value={val} readOnly={isAuto}
            style={isAuto ? { opacity: .7 } : undefined}
            onChange={(e) => setVal(e.target.value)} />
          <div className="kpis" style={{ marginTop: 12 }}>
            <div className="kpi"><div className="v mono">{r.lapsLeft}</div>
              <div className="l">{t("Kalan Tur")} <span style={{ color: "var(--dim)" }}>({r.lapsRaw.toFixed(2)})</span></div></div>
          </div>
          <div className="fuelbig" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Bolt size={30} />{r.refuel.toFixed(1)}%
            <span style={{ fontSize: 18, color: "var(--dim)" }}>
              (+{st.extraLap} {t("lap")})</span></div>
          <div className="hint">
            ≈ <b className="mono" style={{ color: "var(--green)" }}>{r.refuelL.toFixed(1)} L</b> {t("gerçek yakıt")} ·
            ({t("kalan tur")} {r.lapsLeft} + extra {st.extraLap}) × {st.consumption} {t("%/tur")}
            {r.refuel > 100 &&
              <> · <b className="warn">{t("⚠ %100'ü aşıyor — depo yetmez!")}</b></>}
          </div>
        </div>
      ))}

      {/* --- Senaryolar (README §5) --- */}
      <div className="card">
        <h2>{t("Senaryolar")}</h2>
        <div className="scenrows">
          {SCEN.map((x) => {
            const c = Number(scen[x.id]) || 0;
            const r = lastStintFuel(effCd, { ...st, consumption: c }, racePlan.flagExtra);
            const d = r.refuel - planRefuel;
            return (
              <div className="scenrow" key={x.id}>
                <span className="nm">{t(x.label)}</span>
                <span className="inp">
                  <input type="number" step="0.01" min="0" value={scen[x.id]}
                    aria-label={`${t(x.label)} ${t("%/tur")}`}
                    onChange={(e) => setScen((v) => ({ ...v, [x.id]: e.target.value }))} />
                  <i>{t("%/tur")}</i>
                </span>
                <b className="val">{r.refuel.toFixed(1)}%</b>
                <span className={`dlt ${d < -0.05 ? "down" : d > 0.05 ? "up" : ""}`}>
                  {x.id === "plan" ? "—" : `${d > 0 ? "+" : ""}${d.toFixed(1)}`}
                </span>
              </div>
            );
          })}
        </div>
        <div className="hint">
          {t("Senaryolar yalnız gösterim — plan verisine yazılmaz.")}
        </div>
      </div>

      {liveFuelObs && (
        <div className="card">
          <h2>⚡ {t("Canlıdan Öğren")}</h2>
          <div className="kpis" style={{ marginTop: 10, marginBottom: 8 }}>
            <div className="kpi"><div className="v">{liveFuelObs.litersPerLap ?? "—"}
              <span style={{ fontSize: 12, color: "var(--dim)" }}> L</span></div>
              <div className="l">{t("Gözlenen tüketim (tur)")}</div></div>
            <div className="kpi"><div className="v">{liveFuelObs.obsCons ?? "—"}
              <span style={{ fontSize: 12, color: "var(--dim)" }}> %</span></div>
              <div className="l">{t("VE / tur")}</div></div>
            <div className="kpi"><div className="v">{liveFuelObs.fuelCap ?? "—"}
              <span style={{ fontSize: 12, color: "var(--dim)" }}> L</span></div>
              <div className="l">{t("Depo")}</div></div>
          </div>
          <div className="hint">{t("Örnek")}: <b>{liveFuelObs.samples}</b> {t("tur")}</div>
          <button className="act" onClick={applyLiveFuel} disabled={applyDisabled}
            style={{ marginTop: 12, background: "var(--car)", color: "#FFE9ED",
              borderColor: "var(--teal)", fontFamily: "var(--font-disp)", fontWeight: 700,
              letterSpacing: ".04em", padding: "8px 16px", opacity: applyDisabled ? .5 : 1 }}>
            {t("Yakıt modeline uygula")}</button>
          {!canEdit && <div className="hint" style={{ marginTop: 6 }}>
            <b className="warn">{t("izleyici modunda pasif")}</b></div>}
        </div>
      )}
    </div>
  );
}
