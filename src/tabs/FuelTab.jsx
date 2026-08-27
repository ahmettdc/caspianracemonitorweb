import { useState, useEffect } from "react";
import { fmtHMS, lastStintFuel, WX } from "../engine";
import { fuelView } from "../constants";
import { Bolt, Icon } from "../components";

/* Son stint yakıtı (v2.0 · handoff-spec/ekranlar/05-yakit.md). Kalan süreye göre
   VE/yakıt ihtiyacı + canlıdan öğren + senaryo karşılaştırması. Türetilmiş değerler
   (lsf, planLastCd, racePlan, liveFuelObs) ve up/autoCd App'ten prop gelir. */
export default function FuelTab({ t, st, up, lsf, autoCd, setAutoCd, planLastCd, racePlan,
  liveFuelObs, applyLiveFuel, canEdit }) {
  const readOnly = !canEdit;
  const isAuto = autoCd;
  const eff = isAuto ? fmtHMS(planLastCd) : st.lastStintCountdown;
  const r = isAuto ? lastStintFuel(eff, st, racePlan.flagExtra) : lsf;
  const applyDisabled = !liveFuelObs || !canEdit || (!liveFuelObs.obsCons && !liveFuelObs.obsRatio);
  /* Hava-düzeltilmiş tüketim: engine refuel% ile aynı kaynak (effCons = consumption × WX.fuel).
     Ekrandaki 'Tüketim' ve formül headline ile tutarlı olsun diye ham değil bunu göster. */
  const cons = +((Number(st.consumption) || 0) * (WX(st).fuel || 1)).toFixed(3);
  const ratio = Number(st.fuelRatio) || 1;
  /* Yakıt sunumu: VE sınıflarında (Hypercar/GT3) yüzde, diğerlerinde litre. Dahili
     birim (cons, refuel, senaryolar = %) hep aynı; burada yalnız etiket/değer çevrilir. */
  const fv = fuelView(st);
  const unit = fv.hasVE ? t("%/tur") : t("L/tur");
  const toL = (pct) => (Number(pct) || 0) * ratio;         // dahili % → litre
  /* Bir dahili %-değerini sınıfa göre metne çevirir: VE'de "12.3%", yakıtta "10.6 L". */
  const shownVal = (pct, dp = 1) => fv.hasVE ? `${(Number(pct) || 0).toFixed(dp)}%` : `${toL(pct).toFixed(dp)} L`;
  /* Senaryo/tüketim giriş kutusu: dahili % ↔ ekran (VE: %, yakıt: L). */
  const consShown = (pct) => fv.hasVE ? pct : +toL(pct).toFixed(2);
  const consStore = (shown) => fv.hasVE ? shown : (ratio > 0 ? +(Number(shown) / ratio).toFixed(4) : shown);

  const [scen, setScen] = useState(() => ({
    plan: cons, save: +(cons * 0.95).toFixed(2), push: +(cons * 1.08).toFixed(2),
  }));
  /* Tüketim değişince (ör. 'Yakıt modeline uygula') senaryolar donmasın — türet. */
  useEffect(() => {
    setScen((s) => ({ ...s, plan: cons, save: +(cons * 0.95).toFixed(2), push: +(cons * 1.08).toFixed(2) }));
  }, [cons]);

  const card = { border: "1px solid var(--rc-border)", borderRadius: 12, background: "var(--rc-surface)", padding: "15px 16px" };
  const hdT = { fontFamily: "var(--rc-font-display)", textTransform: "uppercase", letterSpacing: ".08em", fontSize: 14, fontWeight: 700 };
  const mini = { flex: "1 1 130px", background: "var(--rc-surface-3)", border: "1px solid var(--rc-border)", borderRadius: 10, padding: "11px 14px" };
  const miniV = { fontFamily: "var(--rc-font-display)", fontSize: 26, fontWeight: 700, lineHeight: 1 };
  const miniL = { color: "var(--rc-text-3)", fontSize: 10, textTransform: "uppercase", letterSpacing: ".09em", marginTop: 3 };
  const obsBox = { background: "var(--rc-surface-3)", border: "1px solid var(--rc-border)", borderRadius: 10, padding: "10px 11px" };

  const SCEN = [
    { id: "plan", label: t("Planlanan"), col: "var(--rc-ok)" },
    { id: "save", label: t("Tasarruflu"), col: "var(--rc-ok)" },
    { id: "push", label: t("Agresif"), col: "var(--rc-warn)" },
  ];

  return (
    <div style={{ padding: "2px 0 8px", fontFamily: "var(--rc-font-ui)", animation: "rcin .26s ease-out" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 16 }}>
        <h2 style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: 9, fontFamily: "var(--rc-font-display)", textTransform: "uppercase", letterSpacing: ".06em", fontSize: 22, fontWeight: 700 }}>
          <Bolt size={20} /> {t("Son stint yakıtı")}</h2>
        <span style={{ fontSize: 12, color: "var(--rc-text-3)" }}>{t("Kalan süreye göre gereken enerji")}</span>
        {readOnly && <span style={{ marginLeft: "auto", fontSize: 11, padding: "4px 12px", borderRadius: 99, border: "1px solid var(--rc-warn)", color: "var(--rc-warn)", whiteSpace: "nowrap" }}><Icon name="goz" size={13} /> {t("İzleyici modu · düzenleme kapalı")}</span>}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "stretch" }}>
        {/* Yarış sonu */}
        <div style={{ flex: "1 1 420px", minWidth: 0, border: "1px solid var(--rc-border-strong)", borderRadius: 12, background: "radial-gradient(120% 170% at 100% 0,rgba(150,0,24,.20),var(--rc-surface-2) 62%)", padding: "16px 18px" }} data-tour="fuelcalc">
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
            <span style={{ ...hdT, fontSize: 15 }}>{t("Yarış sonu")}</span>
            <button onClick={() => { if (readOnly) return; if (autoCd && !String(st.lastStintCountdown || "").trim()) up({ lastStintCountdown: eff }); setAutoCd(!autoCd); }} title={t("Stint planından otomatik — sondan önceki stintin Time Left değeri")}
              style={{ padding: "4px 11px", borderRadius: 7, fontSize: 11, cursor: readOnly ? "not-allowed" : "pointer", border: `1px solid ${autoCd ? "var(--rc-brand-bright)" : "var(--rc-border)"}`, background: autoCd ? "var(--rc-brand)" : "var(--rc-surface-3)", color: autoCd ? "#FFE9ED" : "var(--rc-text-3)", opacity: readOnly ? .5 : 1 }}><Icon name="plan" size={13} /> {t("Plan")}</button>
            <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--rc-text-3)" }}>{autoCd ? t("Stint planından otomatik") : t("elle girildi")}</span>
          </div>
          <label style={{ display: "block", color: "var(--rc-text-3)", fontSize: 10, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 6 }}>{t("Seans geri sayımı (h:mm:ss)")}</label>
          <input type="text" value={eff} readOnly={isAuto || readOnly} onChange={(e) => up({ lastStintCountdown: e.target.value })}
            style={{ width: "100%", boxSizing: "border-box", background: "var(--rc-surface-3)", border: `1px solid ${isAuto || readOnly ? "var(--rc-border)" : "var(--rc-border-strong)"}`, borderRadius: 10, color: "var(--rc-text)", padding: "11px 13px", fontFamily: "var(--rc-font-display)", fontSize: 22, fontWeight: 700, opacity: isAuto || readOnly ? .7 : 1 }} />

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
            <div style={mini}><div style={miniV}>{r.lapsLeft}</div><div style={miniL}>{t("Kalan tur")} <span style={{ color: "var(--rc-border-strong)" }}>({r.lapsRaw.toFixed(2)})</span></div></div>
            <div style={mini}><div style={miniV}>{(fv.hasVE ? cons : toL(cons)).toFixed(2)}<span style={{ fontSize: 13, color: "var(--rc-text-3)" }}> {unit}</span></div><div style={miniL}>{t("Tüketim")}</div></div>
            <div style={mini}><div style={miniV}>+{st.extraLap}</div><div style={miniL}>Extra lap</div></div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--rc-border-strong)", flexWrap: "wrap" }}>
            <Bolt size={30} />
            <span style={{ fontFamily: "var(--rc-font-display)", fontSize: "clamp(34px,5vw,52px)", fontWeight: 700, lineHeight: 1, color: r.refuel > 100 ? "var(--rc-danger)" : "var(--rc-ok)" }}>{fv.hasVE ? r.refuel.toFixed(1) : toL(r.refuel).toFixed(1)}<span style={{ fontSize: ".5em" }}>{fv.hasVE ? "%" : " L"}</span></span>
            <span style={{ fontSize: 16, color: "var(--rc-text-3)" }}>(+{st.extraLap} lap)</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--rc-text-2)", marginTop: 9, lineHeight: 1.7 }}>
            ≈ <b style={{ fontFamily: "var(--rc-font-display)", fontSize: 15, color: "var(--rc-ok)" }}>{r.refuelL.toFixed(1)} L</b> {t("gerçek yakıt")} · ({t("kalan tur")} {r.lapsLeft} + extra {st.extraLap}) × {(fv.hasVE ? cons : toL(cons)).toFixed(2)} {unit}
            {r.refuel > 100 && <> · <b style={{ color: "var(--rc-danger)" }}><Icon name="uyari" size={12} /> {t("%100'ü aşıyor — depo yetmez!")}</b></>}
          </div>
        </div>

        {/* Sağ kolon */}
        <div style={{ flex: "1 1 300px", minWidth: 270, display: "flex", flexDirection: "column", gap: 12 }}>
          {liveFuelObs && (
            <div style={card}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
                <span style={hdT}><Icon name="simsek" size={14} /> {t("Canlıdan öğren")}</span>
                <span style={{ marginLeft: "auto", fontSize: 10.5, color: "var(--rc-text-3)" }}>{t("örnek")} {liveFuelObs.samples} {t("tur")}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 9 }}>
                <div style={obsBox}><div style={{ fontFamily: "var(--rc-font-display)", fontSize: 20, fontWeight: 700, lineHeight: 1 }}>{liveFuelObs.litersPerLap ?? "—"}<span style={{ fontSize: 11, color: "var(--rc-text-3)" }}> L</span></div><div style={{ ...miniL, fontSize: 9.5 }}>{t("Tüketim/tur")}</div></div>
                <div style={obsBox}><div style={{ fontFamily: "var(--rc-font-display)", fontSize: 20, fontWeight: 700, lineHeight: 1 }}>{liveFuelObs.obsCons ?? "—"}<span style={{ fontSize: 11, color: "var(--rc-text-3)" }}> %</span></div><div style={{ ...miniL, fontSize: 9.5 }}>{t("VE / tur")}</div></div>
                <div style={obsBox}><div style={{ fontFamily: "var(--rc-font-display)", fontSize: 20, fontWeight: 700, lineHeight: 1 }}>{liveFuelObs.fuelCap ?? "—"}<span style={{ fontSize: 11, color: "var(--rc-text-3)" }}> L</span></div><div style={{ ...miniL, fontSize: 9.5 }}>{t("Depo")}</div></div>
              </div>
              <button onClick={applyLiveFuel} disabled={applyDisabled}
                style={{ width: "100%", marginTop: 12, padding: "10px 16px", borderRadius: 10, cursor: applyDisabled ? "not-allowed" : "pointer", border: "1px solid var(--rc-brand-bright)", background: "var(--rc-brand)", color: "#FFE9ED", fontFamily: "var(--rc-font-display)", fontSize: 15, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", opacity: applyDisabled ? .45 : 1 }}>{t("Yakıt modeline uygula")}</button>
              {readOnly && <div style={{ marginTop: 8, fontSize: 11, color: "var(--rc-warn)" }}><Icon name="goz" size={13} /> {t("İzleyici modunda pasif")}</div>}
            </div>
          )}

          {/* Senaryolar */}
          <div style={card}>
            <div style={{ ...hdT, marginBottom: 11 }}>{t("Senaryolar")}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {SCEN.map((f) => {
                const c = Number(scen[f.id]) || 0;
                const need = (r.lapsLeft + st.extraLap) * c;
                const base = (r.lapsLeft + st.extraLap) * (Number(scen.plan) || 0);
                const diff = need - base;
                const note = f.id === "plan"
                  ? `${(need * ratio).toFixed(1)} L`
                  : (fv.hasVE ? `${diff > 0 ? "+" : ""}${diff.toFixed(1)}%` : `${diff > 0 ? "+" : ""}${toL(diff).toFixed(1)} L`);
                return (
                  <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 10, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)" }}>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: "var(--rc-text-2)" }}>{f.label}</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, flex: "0 0 auto" }}>
                      <input type="number" step="0.01" value={consShown(scen[f.id])} readOnly={readOnly}
                        onChange={(e) => { const v = parseFloat(e.target.value); if (isFinite(v)) setScen((s) => ({ ...s, [f.id]: consStore(v) })); }}
                        style={{ width: 62, textAlign: "right", background: "var(--rc-surface-2)", border: `1px solid ${readOnly ? "var(--rc-border)" : "var(--rc-border-strong)"}`, borderRadius: 7, color: "var(--rc-text)", padding: "4px 7px", fontFamily: "var(--rc-font-display)", fontSize: 13, fontWeight: 700, opacity: readOnly ? .6 : 1 }} />
                      <span style={{ fontSize: 10, color: "var(--rc-text-3)" }}>{unit}</span>
                    </span>
                    <b style={{ fontFamily: "var(--rc-font-display)", fontSize: 17, fontWeight: 700, color: f.col, flex: "0 0 auto", width: 62, textAlign: "right" }}>{shownVal(need)}</b>
                    <span style={{ flex: "0 0 auto", fontSize: 10.5, padding: "3px 9px", borderRadius: 99, width: 62, textAlign: "center", boxSizing: "border-box", border: "1px solid var(--rc-border)", color: "var(--rc-text-3)", whiteSpace: "nowrap" }}>{note}</span>
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
