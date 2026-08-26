import { fmtHMS, WX, wxId } from "../engine";
import { WetIcon } from "../WetIcon";
import { ASSET, AV, TRACK_ASSET, PIT_LANE_TIMES, CAR_CLASSES, trackName, carName } from "../constants";
import { carImageSrc } from "../teamAssets";
import { Tyre, Bolt } from "../components";

/* Dashboard (v2.0 · handoff-spec/ekranlar/03-dashboard.md).
   Hero: araç | pist kartı + 4 KPI + canlı stint bandı. Alt: stint programı tablosu +
   lastik / son-stint VE / pilot dağılımı. Türetilmiş veriler App'ten prop gelir. */
const DRV_COLORS = ["#4C9AFF", "#F5B23D", "#37D67A", "#B58BFF", "#EF8A2B", "#F0506E", "#22C1C3"];
const initialsOf = (nm) => String(nm || "").trim().split(/\s+/).map((w) => w[0] || "").slice(0, 2).join("").toUpperCase() || "—";

export default function DashTab({
  t, st, zoom, setZoom, exportPdf, liveInfo, racePlan, tyreInfo,
  planLsf, driverPlan, carriedAt, lmuData, assets,
}) {
  const live = liveInfo.status === "live";
  const clsName = (CAR_CLASSES.find(([id]) => id === st.carClass) || ["", st.carClass])[1];
  const roster = st.roster || [];
  const drvCol = (nm) => { const i = roster.indexOf(nm); return DRV_COLORS[(i >= 0 ? i : 0) % DRV_COLORS.length]; };
  const stintElapsed = live ? Math.max(0, liveInfo.phaseEnd - liveInfo.nextPitIn - liveInfo.stintStartMs) : 0;
  const onLast = live && !!racePlan.rows[liveInfo.stintIdx]?.isLast;
  const pitLabel = !live ? t("Sıradaki pit") : liveInfo.phase === "pit" ? t("Pit çıkışı") : onLast ? t("Bayrağa") : t("Sıradaki pit");
  const wx = WX(st);

  const stintTyre = (i) => {
    const codes = (st.tyreStints[i] || []).map((x) => String(x).trim()).filter(Boolean);
    if (!codes.length) return "";
    const m = {};
    codes.forEach((c) => { m[c] = (m[c] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1])[0][0];
  };

  const card = { border: "1px solid var(--rc-border)", borderRadius: 12, background: "var(--rc-surface)", overflow: "hidden" };
  const cardHd = { display: "flex", alignItems: "center", gap: 10, padding: "13px 16px", borderBottom: "1px solid var(--rc-border)" };
  const cardHdT = { fontFamily: "var(--rc-font-display)", textTransform: "uppercase", letterSpacing: ".08em", fontSize: 16, fontWeight: 700 };
  const dim = { color: "var(--rc-text-3)", fontSize: 11.5 };
  const kpi = { border: "1px solid var(--rc-border)", borderRadius: 12, background: "var(--rc-surface)", padding: "13px 15px" };
  const kpiV = { fontFamily: "var(--rc-font-display)", fontSize: 26, fontWeight: 700, lineHeight: 1 };
  const kpiL = { color: "var(--rc-text-3)", fontSize: 10, textTransform: "uppercase", letterSpacing: ".09em", marginTop: 4 };
  const th = (left) => ({ textAlign: left ? "left" : "right", padding: "10px 14px", fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".07em", color: "var(--rc-text-3)", borderBottom: "1px solid var(--rc-border)", whiteSpace: "nowrap" });

  return (
    <div style={{ padding: "4px 0 8px", display: "flex", flexDirection: "column", gap: 16, fontFamily: "var(--rc-font-ui)", animation: "rcin .26s ease-out" }}>

      {/* ═══════ Hero: araç|pist + KPI ═══════ */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "stretch" }}>
        <div style={{ flex: "1 1 480px", minWidth: 0, display: "flex", flexWrap: "wrap", gap: 16, border: "1px solid var(--rc-border-strong)", borderRadius: 14, background: "radial-gradient(120% 160% at 100% 0,rgba(150,0,24,.18),var(--rc-surface-2) 62%)", padding: "18px 20px", alignItems: "center" }}>
          {st.car && (
            <div onClick={() => setZoom("car")} title={t("Büyütmek için tıkla")} style={{ flex: "1 1 240px", minWidth: 0, textAlign: "center", cursor: "zoom-in" }}>
              <img src={carImageSrc(assets, st.carClass, st.car, "side")} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }}
                style={{ display: "block", width: "100%", maxWidth: 280, height: 110, objectFit: "contain", margin: "0 auto", filter: "drop-shadow(0 4px 12px rgba(0,0,0,.5))" }} />
              <div style={{ fontFamily: "var(--rc-font-display)", fontWeight: 700, fontSize: 19, marginTop: 8 }}>{carName(st.carClass, st.car)}</div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--rc-text-3)", marginTop: 2 }}>
                <img src={`${ASSET}class/${st.carClass}.png`} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} style={{ height: 15 }} />{clsName}</div>
            </div>
          )}
          {st.car && st.track && <span style={{ width: 1, alignSelf: "stretch", background: "var(--rc-border-strong)" }} />}
          {st.track && (
            <div onClick={() => setZoom("track")} title={t("Büyütmek için tıkla")} style={{ flex: "1 1 220px", minWidth: 0, textAlign: "center", cursor: "zoom-in" }}>
              <img key={st.track} src={`${ASSET}tracks/${TRACK_ASSET(st.track)}.png${AV}`} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }}
                style={{ display: "block", width: "100%", maxWidth: 230, height: 110, objectFit: "contain", margin: "0 auto", filter: "drop-shadow(0 4px 12px rgba(0,0,0,.5))" }} />
              <div style={{ display: "inline-flex", alignItems: "center", gap: 7, fontFamily: "var(--rc-font-display)", fontWeight: 700, fontSize: 19, marginTop: 8 }}>
                <img src={`${ASSET}flags/${st.track}.png`} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} style={{ width: 22, borderRadius: 2 }} />{trackName(st.track)}</div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--rc-text-3)", marginTop: 2 }}>
                {PIT_LANE_TIMES[st.track] != null && <>{t("Pit lane")} {PIT_LANE_TIMES[st.track]}s<span style={{ color: "var(--rc-border-strong)" }}>·</span></>}
                <WetIcon id={wxId(wx)} size={14} /> {t(wx.lbl)} ×{wx.lap.toFixed(2)}
              </div>
            </div>
          )}
        </div>

        <div style={{ flex: "1 1 300px", minWidth: 280, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h2 style={{ margin: 0, fontFamily: "var(--rc-font-display)", textTransform: "uppercase", letterSpacing: ".07em", fontSize: 20, fontWeight: 700 }}>{t("Dashboard")}</h2>
            <button onClick={() => exportPdf("stint")} data-tour="pdf"
              style={{ marginLeft: "auto", padding: "8px 14px", borderRadius: 9, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text)", cursor: "pointer", fontSize: 12.5 }}>🖨 PDF</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={kpi}><div style={{ ...kpiV, fontWeight: 600, color: "var(--rc-ok)" }}>{live ? fmtHMS(liveInfo.remaining / 1000) : fmtHMS(racePlan.raceSec)}</div><div style={kpiL}>{live ? t("Kalan") : t("Yarış Süresi")}</div></div>
            <div style={kpi}><div style={kpiV}>{st.chosen}<span style={{ color: "var(--rc-text-3)" }}>-</span>{racePlan.totalLaps.toFixed(0)}</div><div style={kpiL}>{t("Strateji · tur")}</div></div>
            <div style={kpi}><div style={kpiV}>{racePlan.rows.length}</div><div style={kpiL}>{t("Stint")}</div></div>
            <div style={kpi}><div style={{ ...kpiV, fontWeight: 600, color: "var(--rc-warn)" }}>{live ? fmtHMS(liveInfo.nextPitIn / 1000) : "—"}</div><div style={kpiL}>{pitLabel}</div></div>
          </div>
          {live && (
            <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", padding: "10px 14px", borderRadius: 11, border: "1px solid rgba(55,214,122,.3)", background: "rgba(55,214,122,.07)" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--rc-ok)", boxShadow: "0 0 8px var(--rc-ok)", animation: "rcpulse 1.2s ease-in-out infinite", flex: "0 0 auto" }} />
              <span style={{ fontSize: 12, color: "var(--rc-text-2)" }}>
                {t("Stint")} <b style={{ color: "var(--rc-text)" }}>{liveInfo.stintIdx + 1}</b>
                {liveInfo.driver && <> · {t("pilot")} <b style={{ color: "var(--rc-text)" }}>{liveInfo.driver}</b></>}
                {liveInfo.phase === "pit" ? <> · {t("PIT'te")}</> : <> · {fmtHMS(stintElapsed / 1000)}{t("'dir pistte")}</>}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ═══════ Alt: stint programı + yan kartlar ═══════ */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
        <div style={{ flex: "1 1 460px", minWidth: 0, ...card }}>
          <div style={cardHd} data-tour="dash-prog">
            <span style={cardHdT}>{t("Stint Programı")}</span>
            <span style={dim}>{racePlan.rows.length} {t("stint")} · {st.chosen} {t("stratejisi")}</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={th(true)}>#</th><th style={th(true)}>{t("Pilot")}</th>
                <th style={th()}>{t("Bitiş")}</th><th style={th()}>{t("Kalan")}</th><th style={th()}>{t("Lastik")}</th>
              </tr></thead>
              <tbody>
                {racePlan.rows.map((r, i) => {
                  const isLive = live && i === liveInfo.stintIdx;
                  const drv = st.driverAssign[i] || "";
                  const tyre = stintTyre(i);
                  const tdB = { padding: "11px 14px", borderBottom: "1px solid var(--rc-line-soft)", textAlign: "right", fontFamily: "var(--rc-font-display)", fontSize: 13.5, fontVariantNumeric: "tabular-nums" };
                  return (
                    <tr key={i} style={{ background: isLive ? "rgba(150,0,24,.22)" : "transparent", borderLeft: `3px solid ${isLive ? "var(--rc-brand-bright)" : r.isLast ? "var(--rc-warn)" : "transparent"}` }}>
                      <td style={{ ...tdB, textAlign: "left", width: 54 }}><span style={{ fontWeight: 700, fontSize: 16, color: isLive ? "var(--rc-text)" : "var(--rc-text-3)" }}>S{r.idx}</span></td>
                      <td style={{ ...tdB, textAlign: "left", fontFamily: "var(--rc-font-ui)" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
                          <span style={{ width: 24, height: 24, borderRadius: "50%", flex: "0 0 auto", background: drv ? drvCol(drv) : "var(--rc-border-strong)", color: "#0B0708", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 10 }}>{drv ? initialsOf(drv) : "—"}</span>
                          <span style={{ fontSize: 13.5, whiteSpace: "nowrap" }}>{drv || "—"}</span>
                          {isLive && <span style={{ fontSize: 9.5, textTransform: "uppercase", letterSpacing: ".09em", padding: "2px 8px", borderRadius: 99, border: "1px solid var(--rc-ok)", color: "var(--rc-ok)", whiteSpace: "nowrap" }}>● {t("pistte")}</span>}
                        </span>
                      </td>
                      <td style={tdB}>{fmtHMS(r.endSec)}</td>
                      <td style={{ ...tdB, color: r.timeLeft < 0 ? "var(--rc-danger)" : "var(--rc-ok)" }}>{fmtHMS(r.timeLeft)}</td>
                      <td style={{ ...tdB, width: 64, color: "var(--rc-text-2)" }}>{tyre || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ flex: "1 1 320px", minWidth: 300, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Lastik */}
          <div style={{ ...card, padding: "16px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <span style={{ ...cardHdT, display: "flex", alignItems: "center", gap: 7 }}><Tyre size={18} /> {t("Lastik")}</span>
              <span style={{ ...dim, marginLeft: "auto" }}>{t("Limit")} {st.tyreLimit} {t("set")}</span>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 14 }}>
              <div><div style={{ fontFamily: "var(--rc-font-display)", fontSize: 34, fontWeight: 700, lineHeight: 1 }}>{tyreInfo.used}<span style={{ fontSize: ".5em", color: "var(--rc-text-3)" }}>/{st.tyreLimit}</span></div><div style={kpiL}>{t("Kullanılan")}</div></div>
              <div><div style={{ fontFamily: "var(--rc-font-display)", fontSize: 34, fontWeight: 700, lineHeight: 1, color: tyreInfo.available < 0 ? "var(--rc-danger)" : "var(--rc-ok)" }}>{tyreInfo.available}</div><div style={kpiL}>{t("Kalan")}</div></div>
              <div style={{ flex: 1, display: "flex", gap: 4, justifyContent: "flex-end" }}>
                {(() => {
                  const lim = Math.max(0, st.tyreLimit);
                  const bars = Math.min(lim, 12);
                  const usedBars = lim > 0 ? Math.round((tyreInfo.used / lim) * bars) : 0;
                  return Array.from({ length: bars }).map((_, i) => (
                    <span key={i} style={{ display: "block", width: 9, height: 26, borderRadius: 3, background: i < usedBars ? "var(--rc-border-strong)" : "var(--rc-ok)", opacity: i < usedBars ? 1 : .8 }} />
                  ));
                })()}
              </div>
            </div>
            {live && racePlan.rows[liveInfo.stintIdx + 1] && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--rc-border)", fontSize: 11.5, color: "var(--rc-text-2)" }}>
                {t("Sıradaki stint lastikleri")} <b style={{ fontFamily: "var(--rc-font-display)", marginLeft: 6 }}>
                  {[0, 1, 2, 3].map((ci) => {
                    const raw = String((st.tyreStints[liveInfo.stintIdx + 1] || [])[ci] || "").trim();
                    return raw || `⟳${carriedAt(liveInfo.stintIdx + 1, ci) || "–"}`;
                  }).join(" / ")}</b>
              </div>
            )}
            {tyreInfo.conflicts.length > 0 && (
              <div style={{ marginTop: 8, fontSize: 11.5, color: "var(--rc-danger)" }}>{t("⚠ Köşe ihlali: lastik")} {tyreInfo.conflicts.join(", ")}</div>
            )}
          </div>

          {/* Son stint VE */}
          <div style={{ ...card, padding: "16px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ ...cardHdT, display: "flex", alignItems: "center", gap: 6 }} data-tour="dash-lsf"><Bolt /> {t("Son Stint VE")}</span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <span style={{ fontFamily: "var(--rc-font-display)", fontSize: 44, fontWeight: 700, lineHeight: 1, color: "var(--rc-warn)" }}>{planLsf.refuel.toFixed(1)}%</span>
              <span style={{ fontSize: 14, color: "var(--rc-text-3)" }}>+{st.extraLap} {t("tur")}</span>
            </div>
            <div style={{ fontSize: 11.5, color: "var(--rc-text-2)", marginTop: 6 }}>
              ≈ {planLsf.refuelL.toFixed(1)} L · {planLsf.lapsLeft} {t("tur + extra")} {st.extraLap} <span style={{ color: "var(--rc-text-3)" }}>({planLsf.lapsRaw.toFixed(2)} {t("gerçek")})</span>
            </div>
          </div>

          {/* Pilot dağılımı */}
          {driverPlan && Object.keys(driverPlan.totals).length > 0 && (
            <div style={{ ...card, padding: "16px 18px" }}>
              <div style={{ ...cardHdT, marginBottom: 12 }}>{t("Pilot Dağılımı")}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[...roster.filter((n) => driverPlan.totals[n]),
                  ...Object.keys(driverPlan.totals).filter((n) => !roster.includes(n))].map((n) => {
                  const tot = driverPlan.totals[n];
                  const pct = driverPlan.grandMs ? (tot.ms / driverPlan.grandMs) * 100 : 0;
                  const col = drvCol(n);
                  return (
                    <div key={n}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><span style={{ width: 9, height: 9, borderRadius: "50%", background: col, display: "inline-block" }} />{n}</span>
                        <span style={{ fontFamily: "var(--rc-font-display)", color: "var(--rc-text-2)" }}>{fmtHMS(tot.ms / 1000)} · {pct.toFixed(0)}%</span>
                      </div>
                      <div style={{ height: 6, background: "var(--rc-line-soft)", borderRadius: 3, overflow: "hidden" }}>
                        <i style={{ display: "block", height: "100%", width: `${pct}%`, background: col, borderRadius: 3 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Büyüt (lightbox) — mevcut davranış korunur (araç tempo tabloları dahil) */}
      {zoom && (
        <div className="lightbox" onClick={() => setZoom(null)}>
          <button className="lbclose" onClick={() => setZoom(null)}>✕</button>
          <img src={zoom === "car" ? carImageSrc(assets, st.carClass, st.car, "side") : `${ASSET}tracks/${TRACK_ASSET(st.track)}.png${AV}`}
            alt="" style={zoom === "car" ? { maxHeight: "40vh" } : undefined} onError={() => setZoom(null)} />
          <div className="lbcap" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {zoom === "car" && <img src={`${ASSET}class/${st.carClass}.png`} alt="" style={{ height: 20 }} onError={(e) => { e.currentTarget.style.display = "none"; }} />}
            {zoom === "car"
              ? `${carName(st.carClass, st.car)} · ${clsName}`
              : `${trackName(st.track)}${PIT_LANE_TIMES[st.track] != null ? ` · Pit lane ${PIT_LANE_TIMES[st.track]}s` : ""}`}
          </div>
          {zoom === "car" && (() => {
            const d = lmuData?.data?.[st.track];
            const carE = d?.[`${st.carClass}:${st.car}`];
            const clsE = d?.[st.carClass];
            const tiers = clsE?.tiers;
            const hot = carE?.hot || clsE?.hot;
            if (!tiers && !hot) return null;
            const ROWS = [
              ["HOTLAP", hot, "#b06ffc"],
              ["ALIEN · 100%", tiers?.alien, "#16a34a"],
              ["COMPETITIVE · 1.01", tiers?.c101, "#65a30d"],
              ["GOOD · 1.02", tiers?.c102, "#ca8a04"],
              ["· 1.03", tiers?.c103, "#d97706"],
              ["MIDPACK · 1.04", tiers?.c104, "#ea580c"],
              ["· 1.05", tiers?.c105, "#f05252"],
              ["TAIL-ENDER · 1.06", tiers?.c106, "#dc2626"],
              ["OFFLINE · 1.07", tiers?.c107, "#991b1b"],
            ].filter(([, v]) => v);
            return (
              <div className="lbtiers" onClick={(e) => e.stopPropagation()} title={lmuData?.source}>
                {ROWS.map(([lbl, v, col]) => (
                  <div key={lbl} className="lbtr"><i style={{ background: col }} /><span className="lbl">{lbl}</span><b className="mono" style={{ color: col }}>{v}</b></div>
                ))}
                <div className="lbsrc">{trackName(st.track)} · {lmuData?.source}</div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
