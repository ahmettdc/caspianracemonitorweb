import { useState, useEffect } from "react";

/* Lastik stratejisi sekmesi — köşe bazlı lastik atama, limit takibi, hızlı atama.
   handoff-spec/ekranlar/06-lastik.md — markup ve stil değerleri birebir; inline stil
   objeleri (koşullu renk/kenarlık) fişten alınır, renkler rc/ty tokenlarına
   bağlanır. Yeni veri katmanı YOK: türetilmiş tyreInfo/racePlan ve handler'lar
   (upTyreCell/quickTyre/carriedAt/clearTyres) App'ten prop gelir. Native <select>
   hücreleri <button> + açılır seçici ile, hızlı atama <select>'i özel popup menü ile
   değiştirildi; her ikisi de aynı upTyreCell/quickTyre handler'larını çağırır. */
const CORNERS = ["FL", "FR", "RL", "RR"];
const disp = "var(--rc-font-display)";

/* Hızlı atama menüsü — quickTyre() aksiyonlarına birebir eşlenir. */
const QUICK_ALL = [
  { label: "4 yeni", sub: "FL FR RL RR", act: "new4", col: "var(--rc-ok)", need: 4 },
  { label: "4 wet", sub: "limitten bağımsız", act: "wet4", col: "var(--rc-ok-soft)", need: 0 },
  { label: "Qual'a dön", sub: "Qual setleri", act: "qual4", col: "var(--rc-delta)", need: 0 },
];
const QUICK_PAIRS = [
  { label: "2 yeni ön", sub: "FL · FR", act: "fronts", col: "var(--rc-warn-3)", need: 2 },
  { label: "2 yeni arka", sub: "RL · RR", act: "rears", col: "var(--rc-warn-3)", need: 2 },
  { label: "2 yeni sol", sub: "FL · RL", act: "lefts", col: "var(--rc-warn-3)", need: 2 },
  { label: "2 yeni sağ", sub: "FR · RR", act: "rights", col: "var(--rc-warn-3)", need: 2 },
];
const QUICK_SINGLES = [
  { label: "FL", act: "fl" }, { label: "FR", act: "fr" },
  { label: "RL", act: "rl" }, { label: "RR", act: "rr" },
];
const LEGEND = [
  { label: "Yeni kuru (1×)", c: "var(--ty-new)" },
  { label: "2× tekrar", c: "var(--ty-2x)" },
  { label: "Qual'a dönüş", c: "var(--ty-qual)" },
  { label: "3× tekrar", c: "var(--ty-3x)" },
  { label: "4×+ aşırı", c: "var(--ty-4x)" },
  { label: "Wet · limitsiz", c: "var(--ty-wet)" },
  { label: "⟳ önceki setle devam", c: "var(--rc-border-strong)", dash: true },
];

export default function TyreTab({
  t, st, up, tyreInfo, racePlan, carriedAt, upTyreCell, quickTyre,
  qsel, setQsel, QSEL_LBL, clearTyres,
}) {
  /* açık popup'lar — yalnız UI durumu (veri değil). pick: {ri,ci} hücre seçicisi,
     quickRow: hızlı atama menüsü açık satırın dizini. */
  const [pick, setPick] = useState(null);
  const [quickRow, setQuickRow] = useState(null);
  useEffect(() => {
    if (pick == null && quickRow == null) return undefined;
    const close = () => { setPick(null); setQuickRow(null); };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [pick, quickRow]);

  const avail = tyreInfo.available;
  const wet = tyreInfo.counts.W || 0;
  const limit = Number(st.tyreLimit) || 0;
  const conflictSet = new Set(tyreInfo.conflicts);

  /* cellCls sınıfını lastik durum rengine çevirir (prototipteki cellCol karşılığı). */
  const cellCol = (v) => ({
    t2: "var(--ty-2x)", tq: "var(--ty-qual)", t3: "var(--ty-3x)",
    t4: "var(--ty-4x)", tw: "var(--ty-wet)", terr: "var(--ty-err)",
  }[tyreInfo.cellCls(v)] || "var(--ty-new)");

  const limDown = () => up({ tyreLimit: Math.max(1, limit - 1) });
  const limUp = () => up({ tyreLimit: Math.min(99, limit + 1) });
  const clearAll = () => { clearTyres(); setQsel({}); };

  /* KPI kartı ortak stil parçaları */
  const kpiLbl = { color: "var(--rc-text-3)", fontSize: 10, textTransform: "uppercase", letterSpacing: ".1em" };
  const kpiNum = { fontFamily: disp, fontSize: 36, fontWeight: 700, lineHeight: 1.1 };
  const kpiCard = { flex: "1 1 150px", border: "1px solid var(--rc-border)", borderRadius: 12,
    background: "var(--rc-surface)", padding: "13px 16px" };
  const stepBtn = { width: 34, height: 38, border: "none", background: "var(--rc-surface-3)",
    color: "var(--rc-text-2)", cursor: "pointer", fontSize: 15 };
  const sectLbl = { padding: "9px 13px 5px", color: "var(--rc-text-3)", fontSize: 9.5,
    textTransform: "uppercase", letterSpacing: ".1em" };
  const menuRow = (dis) => ({ display: "flex", alignItems: "center", gap: 9, width: "100%",
    padding: "8px 13px", border: "none", background: "transparent", color: "var(--rc-text-2)",
    cursor: dis ? "not-allowed" : "pointer", textAlign: "left", opacity: dis ? 0.4 : 1 });
  const th = { padding: "10px 8px", borderBottom: "1px solid var(--rc-border)", color: "var(--rc-text-3)",
    fontSize: 10, textTransform: "uppercase", letterSpacing: ".1em", fontWeight: 700, textAlign: "center" };
  const thLeft = { ...th, textAlign: "left", padding: "10px 14px" };

  return (
    <div data-tour="tyrecard" style={{ padding: "18px 20px 40px", animation: "rcin .26s ease-out" }}>

      {/* --- başlık --- */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontFamily: disp, textTransform: "uppercase", letterSpacing: ".06em",
          fontSize: 22, fontWeight: 700 }}>{t("Lastik stratejisi")}</h2>
        <span style={{ fontSize: 12, color: "var(--rc-text-3)" }}>
          {t("Bir lastik ilk takıldığı köşeye kilitlenir · wet limitten bağımsız")}</span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={clearAll} style={{ padding: "8px 14px", borderRadius: 9, cursor: "pointer",
            border: "1px solid var(--rc-danger)", background: "transparent", color: "var(--rc-danger)",
            fontSize: 12.5 }}>{t("Tümünü temizle")}</button>
        </span>
      </div>

      {/* --- KPI kartları --- */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div style={{ ...kpiCard, flex: "1 1 190px" }}>
          <div style={{ ...kpiLbl, marginBottom: 8 }}>{t("Lastik limiti")}</div>
          <div style={{ display: "inline-flex", alignItems: "center", border: "1px solid var(--rc-border)",
            borderRadius: 10, overflow: "hidden" }}>
            <button onClick={limDown} style={stepBtn}>−</button>
            <b style={{ minWidth: 52, textAlign: "center", fontFamily: disp, fontSize: 26, fontWeight: 700 }}>
              {limit}</b>
            <button onClick={limUp} style={stepBtn}>+</button>
          </div>
        </div>
        <div style={kpiCard}>
          <div style={kpiLbl}>{t("Kullanılan")}</div>
          <div style={kpiNum}>{tyreInfo.used}</div>
        </div>
        <div style={{ flex: "1 1 150px", borderRadius: 12, background: "var(--rc-surface)", padding: "13px 16px",
          border: `1px solid ${avail < 0 ? "var(--rc-danger)" : "var(--rc-border)"}` }}>
          <div style={kpiLbl}>{t("Kalan")}</div>
          <div style={{ ...kpiNum, color: avail < 0 ? "var(--rc-danger)" : "var(--rc-ok)" }}>{avail}</div>
        </div>
        <div style={kpiCard}>
          <div style={kpiLbl}>{t("Stint sayısı")}</div>
          <div style={kpiNum}>{racePlan.fullStints}</div>
        </div>
        <div style={kpiCard}>
          <div style={kpiLbl}>{t("Wet · limitsiz")}</div>
          <div style={{ ...kpiNum, color: wet ? "var(--ty-wet)" : "var(--rc-border-strong)" }}>{wet}</div>
        </div>
      </div>

      {/* --- Set envanteri --- */}
      <div style={{ border: "1px solid var(--rc-border)", borderRadius: 12, background: "var(--rc-surface)",
        padding: "14px 16px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 11 }}>
          <span style={{ fontFamily: disp, textTransform: "uppercase", letterSpacing: ".08em",
            fontSize: 14, fontWeight: 700 }}>{t("Set envanteri")}</span>
          <span style={{ fontSize: 11.5, color: "var(--rc-text-3)" }}>
            {t("her setin kullanım sayısı ve kilitli köşesi")}</span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {Array.from({ length: limit }, (_, i) => {
            const id = String(i + 1);
            const uses = tyreInfo.counts[id] || 0;
            const cols = [0, 1, 2, 3].filter((ci) => tyreInfo.allowedIn(id, ci));
            const corner = cols.length === 1 ? CORNERS[cols[0]] : null;
            const col = cellCol(id);
            return (
              <div key={id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
                borderRadius: 10, border: `1px solid ${uses ? col : "var(--rc-border)"}`,
                background: uses ? "rgba(255,255,255,.04)" : "var(--rc-surface-3)", opacity: uses ? 1 : 0.55 }}>
                <b style={{ fontFamily: disp, fontSize: 19, fontWeight: 700, lineHeight: 1 }}>{id}</b>
                <span style={{ fontFamily: disp, fontSize: 10.5, letterSpacing: ".04em",
                  color: corner ? "var(--rc-text-2)" : "var(--rc-border-strong)" }}>{corner || t("boş")}</span>
                <span style={{ fontFamily: disp, fontSize: 11, fontWeight: 600,
                  color: uses ? col : "var(--rc-border-strong)" }}>{uses ? `${uses}×` : "—"}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* --- Strateji tablosu --- */}
      <div style={{ border: "1px solid var(--rc-border)", borderRadius: 12, background: "var(--rc-surface)" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
            <thead><tr>
              <th style={thLeft}>Stint</th>
              <th style={th}>FL</th>
              <th style={th}>FR</th>
              <th style={th}>RL</th>
              <th style={th}>RR</th>
              <th style={thLeft}>{t("Hızlı atama")}</th>
            </tr></thead>
            <tbody>
              {tyreInfo.rows.map((r, ri) => {
                const quickOpen = quickRow === ri;
                return (
                  <tr key={r.label} style={{ background: ri === 0 ? "rgba(76,154,255,.06)" : "transparent" }}>
                    <td style={{ padding: "9px 14px", borderBottom: "1px solid var(--rc-line-soft)",
                      textAlign: "left", fontFamily: disp, fontSize: 17, fontWeight: 700, whiteSpace: "nowrap" }}>
                      {r.label}</td>

                    {r.vals.map((v, ci) => {
                      const val = String(v).trim();
                      const carried = !val && r.row >= 0 ? carriedAt(r.row, ci) : "";
                      const col = cellCol(val);
                      const err = !!val && conflictSet.has(val);
                      const cellOpen = pick && pick.ri === ri && pick.ci === ci;
                      return (
                        <td key={ci} style={{ padding: "7px 8px", borderBottom: "1px solid var(--rc-line-soft)",
                          textAlign: "center" }}>
                          <span style={{ position: "relative", display: "inline-block" }}>
                            <button title={t("Lastik seç")}
                              onClick={(e) => { e.stopPropagation(); setQuickRow(null);
                                setPick(cellOpen ? null : { ri, ci }); }}
                              style={{ minWidth: 62, padding: "8px 10px", borderRadius: 9, cursor: "pointer",
                                fontFamily: disp, fontSize: 14, fontWeight: 600,
                                border: err ? "2px solid var(--ty-err)"
                                  : val ? `1px solid ${col}` : "1px dashed var(--rc-border-strong)",
                                background: val ? `color-mix(in srgb, ${col} 18%, transparent)` : "transparent",
                                color: val ? col : carried ? "var(--rc-text-3)" : "var(--rc-border-strong)",
                                fontStyle: !val && carried ? "italic" : "normal" }}>
                              {val || (carried ? `⟳ ${carried}` : "—")}</button>

                            {cellOpen && (
                              <div onClick={(e) => e.stopPropagation()}
                                style={{ position: "absolute", top: "calc(100% + 4px)", left: "50%",
                                  transform: "translateX(-50%)", zIndex: 45, minWidth: 172,
                                  background: "var(--rc-surface)", border: "1px solid var(--rc-border-strong)",
                                  borderRadius: 10, overflow: "hidden", boxShadow: "0 18px 44px rgba(0,0,0,.6)",
                                  animation: "rcpop .16s cubic-bezier(.2,.9,.3,1.05)", padding: 5,
                                  display: "flex", flexDirection: "column", gap: 2,
                                  maxHeight: 260, overflowY: "auto" }}>
                                <button onClick={() => { upTyreCell(r.row, ci, ""); setPick(null); }}
                                  style={pickOpt("var(--rc-text-3)")}>
                                  {carried ? `⟳ ${carried}` : "—"}</button>
                                <button onClick={() => { upTyreCell(r.row, ci, "W"); setPick(null); }}
                                  style={pickOpt("var(--ty-wet)")}>🌧 W</button>
                                <div style={{ padding: "5px 6px 2px", color: "var(--rc-text-3)",
                                  fontSize: 9.5, textTransform: "uppercase", letterSpacing: ".08em" }}>
                                  {t("Kuru setler")} · {CORNERS[ci]} {t("köşesi")}</div>
                                {Array.from({ length: limit }, (_, n) => {
                                  const k = String(n + 1);
                                  if (val !== k && !tyreInfo.allowedIn(k, ci)) return null;
                                  const c = tyreInfo.counts[k] || 0;
                                  return (
                                    <button key={k} onClick={() => { upTyreCell(r.row, ci, k); setPick(null); }}
                                      style={pickOpt(cellCol(k))}>
                                      <i style={{ width: 8, height: 8, borderRadius: 2, flex: "0 0 auto",
                                        background: cellCol(k), display: "inline-block" }} />
                                      <b style={{ flex: 1, textAlign: "left" }}>{k}</b>
                                      {c > 0 && (<span style={{ fontSize: 10.5, color: "var(--rc-text-3)" }}>
                                        {c}×</span>)}
                                    </button>
                                  );
                                })}
                                <div style={{ padding: "6px 6px 2px", marginTop: 2,
                                  borderTop: "1px solid var(--rc-line-soft)", fontSize: 10.5,
                                  color: "var(--rc-text-3)" }}>
                                  {t("Kalan")}{" "}
                                  <b style={{ color: avail < 0 ? "var(--rc-danger)" : "var(--rc-text-2)" }}>
                                    {avail}</b> {t("set")}</div>
                              </div>
                            )}
                          </span>
                        </td>
                      );
                    })}

                    <td style={{ padding: "9px 14px", borderBottom: "1px solid var(--rc-line-soft)",
                      position: "relative" }}>
                      {r.row >= 0 && (<>
                        <button onClick={(e) => { e.stopPropagation(); setPick(null);
                          setQuickRow(quickOpen ? null : ri); }}
                          style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 13px",
                            borderRadius: 9, cursor: "pointer", fontSize: 12, whiteSpace: "nowrap",
                            background: "var(--rc-surface-3)",
                            border: `1px solid ${quickOpen ? "var(--rc-brand-bright)" : "var(--rc-border)"}`,
                            color: quickOpen ? "var(--rc-text)" : "var(--rc-text-2)" }}>
                          {"⚡ "}{t("Hızlı atama")}
                          <span style={{ color: "var(--rc-border-strong)",
                            transform: quickOpen ? "rotate(180deg)" : "none", transition: "transform .18s ease",
                            display: "inline-block" }}>▾</span></button>
                        <span style={qsel[r.row] ? { marginLeft: 8, fontSize: 10.5, padding: "3px 9px",
                          borderRadius: 99, border: "1px solid var(--rc-border-strong)", color: "var(--rc-text-3)",
                          whiteSpace: "nowrap" } : { display: "none" }}>
                          {qsel[r.row] ? t(QSEL_LBL[qsel[r.row]] || qsel[r.row]) : ""}</span>

                        <div onClick={(e) => e.stopPropagation()}
                          style={quickOpen ? { position: "absolute", top: "calc(100% - 2px)", left: 14,
                            zIndex: 40, width: 270, background: "var(--rc-surface)",
                            border: "1px solid var(--rc-border-strong)", borderRadius: 12, overflow: "hidden",
                            boxShadow: "0 18px 44px rgba(0,0,0,.6)",
                            animation: "rcpop .16s cubic-bezier(.2,.9,.3,1.05)" } : { display: "none" }}>
                          <div style={sectLbl}>{t("Tüm köşeler")}</div>
                          {QUICK_ALL.map((q) => {
                            const dis = q.need > 0 && avail < q.need;
                            return (
                              <button key={q.act} disabled={dis} style={menuRow(dis)}
                                onClick={() => { if (dis) return; quickTyre(r.row, q.act);
                                  setQsel((s) => ({ ...s, [r.row]: q.act })); setQuickRow(null); }}>
                                <i style={{ width: 8, height: 8, borderRadius: 2, flex: "0 0 auto",
                                  background: q.col, display: "inline-block" }} />
                                <b style={{ fontSize: 12.5, flex: 1, textAlign: "left" }}>{t(q.label)}</b>
                                <span style={{ fontSize: 10.5, color: "var(--rc-text-3)",
                                  whiteSpace: "nowrap" }}>{t(q.sub)}</span>
                              </button>
                            );
                          })}
                          <div style={{ ...sectLbl, borderTop: "1px solid var(--rc-line-soft)" }}>
                            {t("İkili değişim")}</div>
                          {QUICK_PAIRS.map((q) => {
                            const dis = avail < q.need;
                            return (
                              <button key={q.act} disabled={dis} style={menuRow(dis)}
                                onClick={() => { if (dis) return; quickTyre(r.row, q.act);
                                  setQsel((s) => ({ ...s, [r.row]: q.act })); setQuickRow(null); }}>
                                <i style={{ width: 8, height: 8, borderRadius: 2, flex: "0 0 auto",
                                  background: q.col, display: "inline-block" }} />
                                <b style={{ fontSize: 12.5, flex: 1, textAlign: "left" }}>{t(q.label)}</b>
                                <span style={{ fontSize: 10.5, color: "var(--rc-text-3)",
                                  whiteSpace: "nowrap" }}>{t(q.sub)}</span>
                              </button>
                            );
                          })}
                          <div style={{ ...sectLbl, borderTop: "1px solid var(--rc-line-soft)" }}>
                            {t("Tek teker")}</div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 5,
                            padding: "2px 10px 8px" }}>
                            {QUICK_SINGLES.map((q) => {
                              const dis = avail < 1;
                              return (
                                <button key={q.act} disabled={dis}
                                  onClick={() => { if (dis) return; quickTyre(r.row, q.act);
                                    setQsel((s) => ({ ...s, [r.row]: q.act })); setQuickRow(null); }}
                                  style={{ padding: "8px 4px", borderRadius: 8, border: "1px solid var(--rc-border)",
                                    background: "var(--rc-surface-3)", color: "var(--rc-text-2)",
                                    cursor: dis ? "not-allowed" : "pointer", display: "flex", alignItems: "center",
                                    justifyContent: "center", opacity: dis ? 0.4 : 1 }}>
                                  <b style={{ fontFamily: disp, fontSize: 13, fontWeight: 600 }}>{q.label}</b>
                                </button>
                              );
                            })}
                          </div>
                          <div style={{ display: "flex", gap: 6, padding: "8px 10px",
                            borderTop: "1px solid var(--rc-line-soft)", background: "var(--rc-surface-2)" }}>
                            <button onClick={() => { quickTyre(r.row, "carry");
                              setQsel((s) => ({ ...s, [r.row]: "carry" })); setQuickRow(null); }}
                              style={{ flex: 1, padding: "7px 8px", borderRadius: 8, border: "1px solid var(--rc-border)",
                                background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer",
                                fontSize: 11 }}>{t("⟳ Devam")}</button>
                            <button onClick={() => { quickTyre(r.row, "clear");
                              setQsel((s) => ({ ...s, [r.row]: "clear" })); setQuickRow(null); }}
                              style={{ flex: 1, padding: "7px 8px", borderRadius: 8,
                                border: "1px solid var(--rc-border-strong)", background: "var(--rc-surface-3)",
                                color: "var(--rc-text-3)", cursor: "pointer", fontSize: 11 }}>
                              {t("✕ Temizle")}</button>
                          </div>
                        </div>
                      </>)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* --- lejant + temizle --- */}
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", padding: "11px 16px",
          borderTop: "1px solid var(--rc-border)", background: "var(--rc-surface-2)" }}>
          {LEGEND.map((lg) => (
            <span key={lg.label} style={{ display: "inline-flex", alignItems: "center", gap: 6,
              fontSize: 11, color: "var(--rc-text-2)" }}>
              <i style={{ width: 10, height: 10, borderRadius: 3, display: "inline-block", flex: "0 0 auto",
                background: lg.dash ? "transparent" : lg.c,
                border: lg.dash ? "1px dashed var(--rc-text-3)" : "none" }} />{t(lg.label)}</span>
          ))}
          <button onClick={clearAll} style={{ marginLeft: "auto", padding: "8px 14px", borderRadius: 9,
            border: "1px solid var(--rc-border-strong)", background: "var(--rc-surface-3)",
            color: "var(--rc-text-3)", cursor: "pointer", fontSize: 12, whiteSpace: "nowrap" }}>
            {t("✕ Seçimleri temizle")}</button>
        </div>
      </div>

      {/* --- köşe kuralı ihlali --- */}
      {tyreInfo.conflicts.length > 0 && (
        <div style={{ marginTop: 12, display: "flex", alignItems: "flex-start", gap: 9, padding: "11px 14px",
          borderRadius: 11, border: "1px solid var(--rc-danger)", background: "rgba(255,77,94,.08)",
          fontSize: 12, color: "var(--rc-on-brand)", lineHeight: 1.6 }}>
          <span style={{ flex: "0 0 auto", fontSize: 14 }}>⚠</span>
          <span>{t("Köşe kuralı ihlali — ")}<b>{tyreInfo.conflicts.join(", ")}</b>
            {t(" birden fazla köşede kullanılmış. Bir lastik ilk takıldığı köşeye kilitlenir; hatalı hücreyi düzelt.")}</span>
        </div>
      )}
    </div>
  );
}

/* Hücre seçici popup satır stili (fişte markup verilmedi — hızlı menü diliyle kuruldu). */
function pickOpt(color) {
  return { display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 10px",
    border: "none", borderRadius: 7, background: "transparent", cursor: "pointer",
    fontFamily: disp, fontSize: 13, fontWeight: 600, textAlign: "left", color };
}
