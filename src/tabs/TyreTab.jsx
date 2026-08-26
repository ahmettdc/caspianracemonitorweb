/* Lastik stratejisi (v2.0 · handoff-spec/ekranlar/06-lastik.md). Limit sayacı +
   set envanteri + köşe bazlı atama tablosu + hızlı atama + çakışma uyarısı.
   Türetilmiş tyreInfo/racePlan ve handler'lar App'ten prop gelir. */
import { Icon } from "../components";

const TY = ["FL", "FR", "RL", "RR"];
const TY_COL = { "": "#37D67A", t2: "#F2C94C", tq: "#4D9FFF", t3: "#F0604D", t4: "#B91C1C", tw: "#7FE3A0", terr: "var(--rc-danger)" };
const colOf = (cls) => TY_COL[cls] ?? "#37D67A";

export default function TyreTab({
  t, st, up, tyreInfo, racePlan, carriedAt, upTyreCell, quickTyre,
  qsel, setQsel, QSEL_LBL, clearTyres,
}) {
  const limit = Math.max(0, st.tyreLimit);
  const wetCount = tyreInfo.rows.reduce((n, r) => n + r.vals.filter((v) => String(v).trim() === "W").length, 0);
  const lockCorner = (id) => {
    for (const r of tyreInfo.rows) { const ci = r.vals.findIndex((v) => String(v).trim() === id); if (ci >= 0) return TY[ci]; }
    return "";
  };

  const card = { border: "1px solid var(--rc-border)", borderRadius: 12, background: "var(--rc-surface)" };
  const kpi = { flex: "1 1 150px", ...card, padding: "13px 16px" };
  const kpiL = { color: "var(--rc-text-3)", fontSize: 10, textTransform: "uppercase", letterSpacing: ".1em" };
  const bigV = { fontFamily: "var(--rc-font-display)", fontSize: 36, fontWeight: 700, lineHeight: 1.1 };
  const hdT = { fontFamily: "var(--rc-font-display)", textTransform: "uppercase", letterSpacing: ".08em", fontSize: 14, fontWeight: 700 };
  const th = (left) => ({ textAlign: left ? "left" : "center", padding: "9px 14px", fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--rc-text-3)", borderBottom: "1px solid var(--rc-border)", whiteSpace: "nowrap" });

  return (
    <div style={{ padding: "2px 0 8px", fontFamily: "var(--rc-font-ui)", animation: "rcin .26s ease-out" }} data-tour="tyrecard">
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontFamily: "var(--rc-font-display)", textTransform: "uppercase", letterSpacing: ".06em", fontSize: 22, fontWeight: 700 }}>{t("Lastik stratejisi")}</h2>
        <span style={{ fontSize: 12, color: "var(--rc-text-3)" }}>{t("Bir lastik ilk takıldığı köşeye kilitlenir · wet limitten bağımsız")}</span>
        <button onClick={clearTyres} style={{ marginLeft: "auto", padding: "8px 14px", borderRadius: 9, cursor: "pointer", border: "1px solid var(--rc-danger)", background: "transparent", color: "var(--rc-danger)", fontSize: 12.5 }}>{t("Tümünü temizle")}</button>
      </div>

      {/* KPI kartları */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div style={{ flex: "1 1 190px", ...card, padding: "13px 16px" }}>
          <div style={{ ...kpiL, marginBottom: 8 }}>{t("Lastik limiti")}</div>
          <div style={{ display: "inline-flex", alignItems: "center", border: "1px solid var(--rc-border)", borderRadius: 10, overflow: "hidden" }}>
            <button onClick={() => up({ tyreLimit: Math.max(0, limit - 1) })} style={{ width: 34, height: 38, border: "none", background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 15 }}>−</button>
            <b style={{ minWidth: 52, textAlign: "center", fontFamily: "var(--rc-font-display)", fontSize: 26, fontWeight: 700 }}>{limit}</b>
            <button onClick={() => up({ tyreLimit: Math.min(40, limit + 1) })} style={{ width: 34, height: 38, border: "none", background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 15 }}>+</button>
          </div>
        </div>
        <div style={kpi}><div style={kpiL}>{t("Kullanılan")}</div><div style={bigV}>{tyreInfo.used}</div></div>
        <div style={{ ...kpi, border: `1px solid ${tyreInfo.available < 0 ? "var(--rc-danger)" : "var(--rc-border)"}` }}><div style={kpiL}>{t("Kalan")}</div><div style={{ ...bigV, color: tyreInfo.available < 0 ? "var(--rc-danger)" : "var(--rc-ok)" }}>{tyreInfo.available}</div></div>
        <div style={kpi}><div style={kpiL}>{t("Stint sayısı")}</div><div style={bigV}>{racePlan.fullStints}</div></div>
        <div style={kpi}><div style={kpiL}>{t("Wet · limitsiz")}</div><div style={{ ...bigV, color: wetCount ? "#7FE3A0" : "var(--rc-border-strong)" }}>{wetCount}</div></div>
      </div>

      {/* Set envanteri */}
      <div style={{ ...card, padding: "14px 16px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 11 }}>
          <span style={hdT}>{t("Set envanteri")}</span>
          <span style={{ fontSize: 11.5, color: "var(--rc-text-3)" }}>{t("her setin kullanım sayısı ve kilitli köşesi")}</span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {Array.from({ length: limit }, (_, i) => {
            const id = String(i + 1);
            const uses = tyreInfo.counts[id] || 0;
            const col = colOf(tyreInfo.cellCls(id));
            const corner = lockCorner(id);
            return (
              <div key={id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 10, border: `1px solid ${uses ? col : "var(--rc-border)"}`, background: uses ? "rgba(255,255,255,.04)" : "var(--rc-surface-3)", opacity: uses ? 1 : .55 }}>
                <b style={{ fontFamily: "var(--rc-font-display)", fontSize: 19, fontWeight: 700, lineHeight: 1 }}>{id}</b>
                <span style={{ fontFamily: "var(--rc-font-display)", fontSize: 10.5, color: corner ? "var(--rc-text-2)" : "var(--rc-border-strong)", letterSpacing: ".04em" }}>{corner || t("boş")}</span>
                <span style={{ fontFamily: "var(--rc-font-display)", fontSize: 11, fontWeight: 600, color: uses ? col : "var(--rc-border-strong)" }}>{uses ? `${uses}×` : "—"}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Atama tablosu */}
      <div style={{ ...card, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table aria-label={t("Lastik strateji tablosu")} style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
            <thead><tr>
              <th style={th(true)}>Stint</th>{TY.map((c) => <th key={c} style={th()}>{c}</th>)}<th style={th(true)}>{t("Hızlı atama")}</th>
            </tr></thead>
            <tbody>
              {tyreInfo.rows.map((r) => (
                <tr key={r.label} style={{ background: r.row === -1 ? "rgba(76,154,255,.06)" : "transparent" }}>
                  <td style={{ padding: "9px 14px", borderBottom: "1px solid var(--rc-line-soft)", textAlign: "left", fontFamily: "var(--rc-font-display)", fontSize: 17, fontWeight: 700, whiteSpace: "nowrap" }}>{r.label}</td>
                  {r.vals.map((v, ci) => {
                    const empty = !String(v).trim();
                    const carried = r.row >= 0 && empty ? carriedAt(r.row, ci) : "";
                    const cls = tyreInfo.cellCls(v);
                    const col = colOf(cls);
                    const err = cls === "terr";
                    return (
                      <td key={ci} style={{ padding: "7px 8px", borderBottom: "1px solid var(--rc-line-soft)", textAlign: "center" }}>
                        <select value={String(v)} onChange={(e) => upTyreCell(r.row, ci, e.target.value)}
                          style={{ minWidth: 62, padding: "8px 10px", borderRadius: 9, cursor: "pointer", fontFamily: "var(--rc-font-display)", fontSize: 14, fontWeight: 600, textAlign: "center",
                            border: err ? "2px solid var(--rc-danger)" : empty ? "1px dashed var(--rc-border-strong)" : `1px solid ${col}`,
                            background: empty ? "transparent" : `${col}2E`, color: empty ? (carried ? "var(--rc-text-3)" : "var(--rc-border-strong)") : col }}>
                          <option value="">{carried ? `⟳ ${carried}` : "—"}</option>
                          <option value="W" style={{ background: "#0C3A1F", color: "#7FE3A0" }}>🌧 W</option>
                          {Array.from({ length: limit }, (_, n) => {
                            const k = String(n + 1);
                            const cur = String(v).trim() === k;
                            if (!cur && !tyreInfo.allowedIn(k, ci)) return null;
                            const c = tyreInfo.counts[k] || 0;
                            return <option key={k} value={k}>{k}{c > 0 ? ` · ${c}×` : ""}</option>;
                          })}
                        </select>
                      </td>
                    );
                  })}
                  <td style={{ padding: "9px 14px", borderBottom: "1px solid var(--rc-line-soft)" }}>
                    {r.row >= 0 && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <select value="" onChange={(e) => { if (e.target.value) { quickTyre(r.row, e.target.value); setQsel((q) => ({ ...q, [r.row]: e.target.value })); } }}
                          style={{ width: 140, textAlign: "left", padding: "7px 10px", borderRadius: 9, cursor: "pointer", fontSize: 12, background: "var(--rc-surface-3)", border: "1px solid var(--rc-border)", color: "var(--rc-text-2)" }}>
                          <option value="">⚡ {t("Hızlı atama")}</option>
                          <option value="new4" disabled={tyreInfo.available < 4}>{t("4 yeni")}</option>
                          <option value="wet4">{t("4 wet")}</option>
                          <option value="qual4">{t("Qual'a dön")}</option>
                          <option value="carry">⟳ {t("Devam")}</option>
                          <option value="fronts" disabled={tyreInfo.available < 2}>{t("2 yeni ön")}</option>
                          <option value="rears" disabled={tyreInfo.available < 2}>{t("2 yeni arka")}</option>
                          <option value="lefts" disabled={tyreInfo.available < 2}>{t("2 yeni sol")}</option>
                          <option value="rights" disabled={tyreInfo.available < 2}>{t("2 yeni sağ")}</option>
                          <optgroup label={t("Tek teker")}>
                            {[["fl", "FL"], ["fr", "FR"], ["rl", "RL"], ["rr", "RR"]].map(([vv, l]) => (
                              <option key={vv} value={vv} disabled={tyreInfo.available < 1}>{l} {t("yeni")}</option>
                            ))}
                          </optgroup>
                          <option value="clear">✕ {t("Temizle")}</option>
                        </select>
                        {qsel[r.row] && (
                          <span style={{ fontSize: 10.5, padding: "3px 9px", borderRadius: 99, border: "1px solid var(--rc-border-strong)", color: "var(--rc-text-3)", whiteSpace: "nowrap" }}>{t(QSEL_LBL[qsel[r.row]] || qsel[r.row])}</span>
                        )}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", padding: "11px 16px", borderTop: "1px solid var(--rc-border)", background: "var(--rc-surface-2)" }}>
          {[["Yeni kuru (1×)", "#37D67A"], ["2× tekrar", "#F2C94C"], ["Qual'a dönüş", "#4D9FFF"], ["3× tekrar", "#F0604D"], ["4×+ aşırı", "#B91C1C"], ["Wet · limitsiz", "#7FE3A0"]].map(([lbl, c]) => (
            <span key={lbl} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--rc-text-2)" }}><i style={{ width: 10, height: 10, borderRadius: 3, display: "inline-block", flex: "0 0 auto", background: c }} />{t(lbl)}</span>
          ))}
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--rc-text-2)" }}><i style={{ width: 10, height: 10, borderRadius: 3, display: "inline-block", flex: "0 0 auto", background: "transparent", border: "1px dashed var(--rc-text-3)" }} />⟳ {t("önceki setle devam")}</span>
          <button onClick={clearTyres} style={{ marginLeft: "auto", padding: "8px 14px", borderRadius: 9, border: "1px solid var(--rc-border-strong)", background: "var(--rc-surface-3)", color: "var(--rc-text-3)", cursor: "pointer", fontSize: 12, whiteSpace: "nowrap" }}>✕ {t("Seçimleri temizle")}</button>
        </div>
      </div>

      {tyreInfo.conflicts.length > 0 && (
        <div style={{ marginTop: 12, display: "flex", alignItems: "flex-start", gap: 9, padding: "11px 14px", borderRadius: 11, border: "1px solid var(--rc-danger)", background: "rgba(255,77,94,.08)", fontSize: 12, color: "#FFC9C0", lineHeight: 1.6 }}>
          <span style={{ flex: "0 0 auto", fontSize: 14 }}><Icon name="uyari" size={14} /></span>
          <span>{t("Köşe kuralı ihlali")} — <b>{tyreInfo.conflicts.join(", ")}</b> {t("birden fazla köşede kullanılmış. Bir lastik ilk takıldığı köşeye kilitlenir; hatalı hücreyi düzelt.")}</span>
        </div>
      )}
    </div>
  );
}
