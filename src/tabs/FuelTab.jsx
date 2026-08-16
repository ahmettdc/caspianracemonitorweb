import { useState } from "react";
import { fmtHMS, lastStintFuel } from "../engine";

/* Son stint yakıtı — kalan süreye göre VE/yakıt ihtiyacı.
   handoff-spec/ekranlar/05-yakit.md — markup ve stil değerleri birebir; inline
   stil objeleri (koşullu renk/kenarlık) fişten alınır, renkler --rc-* tokenlarına
   bağlanır. Yeni veri katmanı YOK; hesap mevcut lastStintFuel() ile yapılır.
   Türetilmiş değerler (lsf, planLastCd, racePlan) ve up/autoCd App'ten prop gelir. */
const SCEN = [
  { id: "plan", label: "Planlanan", mul: 1, col: "var(--rc-ok)" },
  { id: "save", label: "Tasarruflu", mul: 0.95, col: "var(--rc-ok)" },
  { id: "push", label: "Agresif", mul: 1.05, col: "var(--rc-warn)" },
];

/* Yakıt hunisi ikonu — fişteki SVG (05-yakit.md satır 27/60). */
const FuelIcon = ({ w, h, fill }) => (
  <svg width={w} height={h} viewBox="0 0 48 46" fill="none" style={{ flex: "0 0 auto" }}>
    <path fill={fill} d="M25.946 44.938c-.664.845-2.021.375-2.021-.698V33.937a2.26 2.26 0 0 0-2.262-2.262H10.287c-.92 0-1.456-1.04-.92-1.788l7.48-10.471c1.07-1.497 0-3.578-1.842-3.578H1.237c-.92 0-1.456-1.04-.92-1.788L10.013.474c.214-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.471c-1.07 1.498 0 3.579 1.842 3.579h11.377c.943 0 1.473 1.088.89 1.83L25.947 44.94z" />
  </svg>
);

export default function FuelTab({ t, st, up, lsf, autoCd, setAutoCd, planLastCd, racePlan,
  liveFuelObs, applyLiveFuel, canEdit }) {
  const readOnly = !canEdit;
  const applyDisabled = !liveFuelObs || !canEdit
    || (!liveFuelObs.obsCons && !liveFuelObs.obsRatio);

  /* Senaryo tüketimleri — yerel, kalıcı değil. Varsayılanlar plandaki
     tüketimin ±%5'i (tasarruflu / agresif). */
  const baseCons = Number(st.consumption) || 0;
  const [scen, setScen] = useState(() =>
    Object.fromEntries(SCEN.map((x) => [x.id, (baseCons * x.mul).toFixed(2)])));

  const effCd = autoCd ? fmtHMS(planLastCd) : st.lastStintCountdown;
  const r = autoCd ? lastStintFuel(effCd, st, racePlan.flagExtra) : lsf;
  const planRefuel = lastStintFuel(effCd, st, racePlan.flagExtra).refuel;

  /* --- yeniden kullanılan stil objeleri (fiş: 05-yakit.md) --- */
  const disp = "var(--rc-font-display)";
  const kpiBox = { flex: "1 1 130px", background: "var(--rc-surface-3)",
    border: "1px solid var(--rc-border)", borderRadius: 10, padding: "11px 14px" };
  const kpiNum = { fontFamily: disp, fontSize: 26, fontWeight: 700, lineHeight: 1 };
  const kpiLbl = { color: "var(--rc-text-3)", fontSize: 10, textTransform: "uppercase",
    letterSpacing: ".09em", marginTop: 3 };
  const obsBox = { background: "var(--rc-surface-3)", border: "1px solid var(--rc-border)",
    borderRadius: 10, padding: "10px 11px" };
  const obsNum = { fontFamily: disp, fontSize: 20, fontWeight: 700, lineHeight: 1 };
  const obsUnit = { fontSize: 11, color: "var(--rc-text-3)" };
  const obsLbl = { color: "var(--rc-text-3)", fontSize: 9.5, textTransform: "uppercase",
    letterSpacing: ".08em", marginTop: 3 };
  const sectTtl = { fontFamily: disp, textTransform: "uppercase", letterSpacing: ".08em",
    fontSize: 14, fontWeight: 700 };

  return (
    <div data-tour="fuelcalc" style={{ padding: "18px 20px 40px", animation: "rcin .26s ease-out" }}>
      {/* --- başlık --- */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 16 }}>
        <h2 style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: 9,
          fontFamily: disp, textTransform: "uppercase", letterSpacing: ".06em",
          fontSize: 22, fontWeight: 700 }}>
          <FuelIcon w={22} h={21} fill="var(--rc-brand-bright)" />{t("Son stint yakıtı")}
        </h2>
        <span style={{ fontSize: 12, color: "var(--rc-text-3)" }}>
          {t("Kalan süreye göre gereken enerji")}</span>
        {readOnly && (
          <span style={{ marginLeft: "auto", fontSize: 11, padding: "4px 12px", borderRadius: 99,
            border: "1px solid var(--rc-warn)", color: "var(--rc-warn)", whiteSpace: "nowrap" }}>
            👁 {t("İzleyici modu · düzenleme kapalı")}</span>
        )}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "stretch" }}>
        {/* --- sol: Yarış sonu --- */}
        <div style={{ flex: "1 1 420px", minWidth: 0, border: "1px solid var(--rc-border-strong)",
          borderRadius: 12,
          background: "radial-gradient(120% 170% at 100% 0,rgba(150,0,24,.20),var(--rc-surface-2) 62%)",
          padding: "16px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
            <span style={{ fontFamily: disp, textTransform: "uppercase", letterSpacing: ".08em",
              fontSize: 15, fontWeight: 700 }}>{t("Yarış sonu")}</span>
            <button onClick={() => !readOnly && setAutoCd(!autoCd)}
              style={{ padding: "4px 11px", borderRadius: 7, fontSize: 11,
                cursor: readOnly ? "not-allowed" : "pointer",
                border: `1px solid ${autoCd ? "var(--rc-brand-bright)" : "var(--rc-border)"}`,
                background: autoCd ? "var(--rc-brand)" : "var(--rc-surface-3)",
                color: autoCd ? "var(--rc-on-brand)" : "var(--rc-text-3)", opacity: readOnly ? 0.5 : 1 }}>
              📋 {t("Plan")}</button>
            <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--rc-text-3)" }}>
              {autoCd ? t("Stint planından otomatik") : t("elle girildi")}</span>
          </div>

          <label style={{ display: "block", color: "var(--rc-text-3)", fontSize: 10,
            textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 6 }}>
            {t("Seans geri sayımı (h:mm:ss)")}</label>
          <input type="text" value={effCd} readOnly={autoCd || readOnly}
            onChange={(e) => up({ lastStintCountdown: e.target.value })}
            style={{ width: "100%", boxSizing: "border-box", background: "var(--rc-surface-3)",
              border: `1px solid ${autoCd || readOnly ? "var(--rc-border)" : "var(--rc-border-strong)"}`,
              borderRadius: 10, color: "var(--rc-text)", padding: "11px 13px", fontFamily: disp,
              fontSize: 22, fontWeight: 700, opacity: autoCd || readOnly ? 0.7 : 1 }} />

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
            <div style={kpiBox}>
              <div style={kpiNum}>{r.lapsLeft}</div>
              <div style={kpiLbl}>{t("Kalan tur")}{" "}
                <span style={{ color: "var(--rc-border-strong)" }}>({r.lapsRaw.toFixed(2)})</span></div>
            </div>
            <div style={kpiBox}>
              <div style={kpiNum}>{st.consumption}<span style={{ fontSize: 13, color: "var(--rc-text-3)" }}> %/tur</span></div>
              <div style={kpiLbl}>{t("Tüketim")}</div>
            </div>
            <div style={kpiBox}>
              <div style={kpiNum}>+{st.extraLap}</div>
              <div style={kpiLbl}>{t("Extra lap")}</div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16,
            paddingTop: 14, borderTop: "1px solid var(--rc-border-strong)", flexWrap: "wrap" }}>
            <FuelIcon w={30} h={29} fill="var(--rc-ok)" />
            <span style={{ fontFamily: disp, fontSize: "clamp(34px,5vw,52px)", fontWeight: 700,
              lineHeight: 1, color: "var(--rc-ok)" }}>
              {r.refuel.toFixed(1)}<span style={{ fontSize: ".5em" }}>%</span></span>
            <span style={{ fontSize: 16, color: "var(--rc-text-3)" }}>(+{st.extraLap} {t("lap")})</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--rc-text-2)", marginTop: 9, lineHeight: 1.7 }}>
            ≈ <b style={{ fontFamily: disp, fontSize: 15, color: "var(--rc-ok)" }}>
              {r.refuelL.toFixed(1)} L</b> {t("gerçek yakıt")} ·{" "}
            ({t("kalan tur")} {r.lapsLeft} + extra {st.extraLap}) × {st.consumption} {t("%/tur")}
            {r.refuel > 100 && (
              <> · <b style={{ color: "var(--rc-warn)" }}>{t("⚠ %100'ü aşıyor — depo yetmez!")}</b></>
            )}
          </div>
        </div>

        {/* --- sağ: Canlıdan öğren + Senaryolar --- */}
        <div style={{ flex: "1 1 300px", minWidth: 270, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ border: "1px solid var(--rc-border)", borderRadius: 12,
            background: "var(--rc-surface)", padding: "15px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
              <span style={sectTtl}>⚡ {t("Canlıdan öğren")}</span>
              <span style={{ marginLeft: "auto", fontSize: 10.5, color: "var(--rc-text-3)" }}>
                {liveFuelObs?.samples ? `${t("örnek")} ${liveFuelObs.samples} ${t("tur")}` : t("veri yok")}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 9 }}>
              <div style={obsBox}>
                <div style={obsNum}>{liveFuelObs?.litersPerLap ?? "—"}<span style={obsUnit}> L</span></div>
                <div style={obsLbl}>{t("Tüketim/tur")}</div>
              </div>
              <div style={obsBox}>
                <div style={obsNum}>{liveFuelObs?.obsCons ?? "—"}<span style={obsUnit}> %</span></div>
                <div style={obsLbl}>{t("VE / tur")}</div>
              </div>
              <div style={obsBox}>
                <div style={obsNum}>{liveFuelObs?.fuelCap ?? "—"}<span style={obsUnit}> L</span></div>
                <div style={obsLbl}>{t("Depo")}</div>
              </div>
            </div>
            <button onClick={applyLiveFuel} disabled={applyDisabled}
              style={{ width: "100%", marginTop: 12, padding: "10px 16px", borderRadius: 10,
                cursor: applyDisabled ? "not-allowed" : "pointer",
                border: "1px solid var(--rc-brand-bright)", background: "var(--rc-brand)",
                color: "var(--rc-on-brand)", fontFamily: disp, fontSize: 15, fontWeight: 700,
                letterSpacing: ".04em", textTransform: "uppercase", opacity: applyDisabled ? 0.45 : 1 }}>
              {t("Yakıt modeline uygula")}</button>
            {readOnly && (
              <div style={{ marginTop: 8, fontSize: 11, color: "var(--rc-warn)" }}>
                👁 {t("İzleyici modunda pasif")}</div>
            )}
          </div>

          <div style={{ border: "1px solid var(--rc-border)", borderRadius: 12,
            background: "var(--rc-surface)", padding: "15px 16px" }}>
            <div style={{ ...sectTtl, marginBottom: 11 }}>{t("Senaryolar")}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {SCEN.map((x) => {
                const c = Number(scen[x.id]) || 0;
                const rr = lastStintFuel(effCd, { ...st, consumption: c }, racePlan.flagExtra);
                const diff = rr.refuel - planRefuel;
                const note = x.id === "plan"
                  ? `${rr.refuelL.toFixed(1)} L`
                  : `${diff > 0 ? "+" : ""}${diff.toFixed(1)}%`;
                return (
                  <div key={x.id} style={{ display: "flex", alignItems: "center", gap: 10,
                    padding: "9px 12px", borderRadius: 10, border: "1px solid var(--rc-border)",
                    background: "var(--rc-surface-3)" }}>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: "var(--rc-text-2)" }}>
                      {t(x.label)}</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, flex: "0 0 auto" }}>
                      <input type="number" step="0.01" min="0" value={scen[x.id]} readOnly={readOnly}
                        aria-label={`${t(x.label)} ${t("%/tur")}`}
                        onChange={(e) => setScen((v) => ({ ...v, [x.id]: e.target.value }))}
                        style={{ width: 62, textAlign: "right", background: "var(--rc-surface-2)",
                          border: `1px solid ${readOnly ? "var(--rc-border)" : "var(--rc-border-strong)"}`,
                          borderRadius: 7, color: "var(--rc-text)", padding: "4px 7px", fontFamily: disp,
                          fontSize: 13, fontWeight: 700, opacity: readOnly ? 0.6 : 1 }} />
                      <span style={{ fontSize: 10, color: "var(--rc-text-3)" }}>{t("%/tur")}</span>
                    </span>
                    <b style={{ fontFamily: disp, fontSize: 17, fontWeight: 700, color: x.col,
                      flex: "0 0 auto", width: 62, textAlign: "right" }}>{rr.refuel.toFixed(1)}%</b>
                    <span style={{ flex: "0 0 auto", fontSize: 10.5, padding: "3px 9px", borderRadius: 99,
                      width: 62, textAlign: "center", boxSizing: "border-box",
                      border: "1px solid var(--rc-border)", color: "var(--rc-text-3)", whiteSpace: "nowrap" }}>
                      {note}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
