import { Num } from "../components";

/* Lastik Stratejisi sekmesi — köşe bazlı lastik atama, limit takibi, hızlı atama.
   Türetilmiş tyreInfo/racePlan ve handler'lar (upTyreCell/quickTyre/carriedAt/
   clearTyres) App'ten prop gelir. */
export default function TyreTab({
  t, st, up, tyreInfo, racePlan, carriedAt, upTyreCell, quickTyre,
  qsel, setQsel, QSEL_LBL, clearTyres,
}) {
  return (
    <div className="card" data-tour="tyrecard">
      <h2>{t("Lastik Stratejisi")}</h2>
      <div className="kpis">
        <div className="kpi">
          <label style={{ margin: 0 }}>{t("Lastik Limiti (adet)")}</label>
          <Num v={st.tyreLimit} step={1} onC={(v) => up({ tyreLimit: v })} />
        </div>
        <div className="kpi"><div className="v">{tyreInfo.used}</div>
          <div className="l">{t("Kullanılan Lastik")}</div></div>
        <div className="kpi"><div className="v"
          style={{ color: tyreInfo.available < 0 ? "var(--red)" : "var(--green)" }}>
          {tyreInfo.available}</div>
          <div className="l">{t("Kalan Lastik")}</div></div>
        <div className="kpi"><div className="v">{racePlan.fullStints}</div>
          <div className="l">{t("Stint Sayısı")}</div></div>
      </div>
      <div className="hint" style={{ marginTop: 2 }}>
        {t("Kullanılan kuru lastik no")}: {tyreInfo.usedList.length
          ? tyreInfo.usedList.join(", ") : "—"}
        {" "}<b>({tyreInfo.used}/{st.tyreLimit})</b>
        {tyreInfo.wetUsed > 0 && <> · 🌧 {t("wet (limitsiz)")}: {tyreInfo.wetUsed}</>}
      </div>
      <div style={{ overflowX: "auto" }}>
      <table aria-label={t("Lastik strateji tablosu")}>
        <thead><tr><th>Stint</th><th>FL</th><th>FR</th><th>RL</th><th>RR</th><th>{t("Hızlı Atama")}</th></tr></thead>
        <tbody>
          {tyreInfo.rows.map((r) => (
            <tr key={r.label}>
              <td className="disp" style={{ fontSize: 14 }}>{r.label}</td>
              {r.vals.map((v, ci) => {
                const empty = !String(v).trim();
                const carried = r.row >= 0 && empty ? carriedAt(r.row, ci) : "";
                return (
                <td key={ci} className={`${tyreInfo.cellCls(v)} ${carried ? "tcarry" : ""}`}>
                  <select className="tsel" value={String(v)}
                    onChange={(e) => upTyreCell(r.row, ci, e.target.value)}>
                    <option value="">{carried ? `⟳ ${carried}` : "—"}</option>
                    <option value="W" style={{ background: "#0C3A1F", color: "#7FE3A0" }}>
                      🌧 W</option>
                    {Array.from({ length: Math.max(0, st.tyreLimit) }, (_, n) => {
                      const k = String(n + 1);
                      const cur = String(v).trim() === k;
                      if (!cur && !tyreInfo.allowedIn(k, ci)) return null; // köşe kilidi
                      const c = tyreInfo.counts[k] || 0;
                      const cls = tyreInfo.cellCls(k);
                      const OPT = {
                        t2:   { bg: "#8A6E1A", fg: "#FFE9A8", dot: "🟡" },
                        tq:   { bg: "#2B4A8F", fg: "#CFE0FF", dot: "🔵" },
                        t3:   { bg: "#8A5A1A", fg: "#FFDCA8", dot: "🟠" },
                        t4:   { bg: "#7A2020", fg: "#FFC9C0", dot: "🔴" },
                        terr: { bg: "#7A2A20", fg: "#FFC9C0", dot: "⚠️" },
                      }[cls];
                      return <option key={k} value={k}
                        style={OPT ? { background: OPT.bg, color: OPT.fg } : {}}>
                        {OPT ? `${OPT.dot} ` : ""}{k}{c > 0 ? ` · ${c}x` : ""}
                      </option>;
                    })}
                  </select>
                </td>
                );
              })}
              <td>
                {r.row >= 0 && (<span style={{ display: "inline-flex",
                  alignItems: "center", gap: 6 }}>
                  <select className="tsel" style={{ width: 118, textAlign: "left" }}
                    value="" onChange={(e) => {
                      if (e.target.value) {
                        quickTyre(r.row, e.target.value);
                        setQsel((q) => ({ ...q, [r.row]: e.target.value }));
                      }
                    }}>
                    <option value="">{t("— hızlı —")}</option>
                    <option value="new4" disabled={tyreInfo.available < 4}>{t("🆕 4 Yeni")}</option>
                    <option value="wet4">{t("🌧 4 Wet")}</option>
                    <option value="qual4">{t("Qual'a Dön")}</option>
                    <option value="carry">{t("⟳ Öncekiyle Devam")}</option>
                    <option value="fronts" disabled={tyreInfo.available < 2}>{t("Önler Yeni")}</option>
                    <option value="rears" disabled={tyreInfo.available < 2}>{t("Arkalar Yeni")}</option>
                    <option value="lefts" disabled={tyreInfo.available < 2}>{t("Sollar Yeni")}</option>
                    <option value="rights" disabled={tyreInfo.available < 2}>{t("Sağlar Yeni")}</option>
                    <optgroup label={t("Tek lastik")}>
                      {[["fl", "FL"], ["fr", "FR"], ["rl", "RL"], ["rr", "RR"]].map(([v, l]) => (
                        <option key={v} value={v} disabled={tyreInfo.available < 1}>
                          {l} {t("yeni")}</option>
                      ))}
                    </optgroup>
                    <option value="clear">{t("✕ Temizle")}</option>
                  </select>
                  {qsel[r.row] && (
                    <span className="chip" style={{ fontSize: 10, opacity: .85 }}>
                      {t(QSEL_LBL[qsel[r.row]] || qsel[r.row])}</span>
                  )}
                </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      <div className="legend">
        <span><i style={{ background: "var(--panel2)" }} />{t("Yeni lastik (1 kez)")}</span>
        <span><i style={{ background: "rgba(242,201,76,.5)" }} />{t("2 kez (duplicate)")}</span>
        <span><i style={{ background: "rgba(102,148,255,.5)" }} />{t("Qual lastiği tekrar")}</span>
        <span><i style={{ background: "rgba(240,96,77,.5)" }} />{t("3 kez")}</span>
        <span><i style={{ background: "#000" }} />{t("4+ kez")}</span>
        <span><i style={{ background: "transparent", border: "1px dashed var(--dim)" }} />
          ⟳ {t("Değişmedi — önceki lastikle devam")}</span>
        <span style={{ marginLeft: 10 }}>
          <i style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3,
            background: "var(--yellow)", marginRight: 4 }} />{t("Yeni kuru")}</span>
        <span style={{ marginLeft: 10 }}>
          <i style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3,
            background: "#4D9FFF", marginRight: 4 }} />{t("Qual'a dönüş")}</span>
        <span style={{ marginLeft: 10 }}>
          <i style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3,
            background: "#7FE3A0", marginRight: 4 }} />{t("Wet — limitten bağımsız, sınırsız")}</span>
        <span style={{ marginLeft: 10 }}>
          <i style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3,
            background: "#0B0D12", border: "1px solid #6B7280", marginRight: 4 }} />{t("Eski kuru tekrar")}</span>
      </div>
      {tyreInfo.conflicts.length > 0 &&
        <div className="hint" style={{ color: "var(--red)" }}>
          {t("⚠ Köşe kuralı ihlali — lastik")} {tyreInfo.conflicts.join(", ")} {t("birden fazla")}{" "}
          {t("köşede kullanılmış. Bir lastik ilk takıldığı köşeye kilitlenir; hatalı hücreyi düzelt.")}
        </div>}
      <div style={{ marginTop: 12 }}>
        <button className="act danger" onClick={clearTyres}>{t("Tümünü Temizle")}</button>
      </div>
    </div>
  );
}
