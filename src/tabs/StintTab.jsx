import { fmtHMS, parseHMS, wxLog, wxAtRel, wxId, tyState, EMPTY_PIT, MAX_STINTS, WEATHER } from "../engine";
import { WetIcon } from "../WetIcon";
import { Tyre } from "../components";

/* Stint planı (v2.0 · handoff-spec/ekranlar/04-stint-plani.md). KPI'lar + S1 start
   lastikleri + zaman çizelgesi (stint/pilot/hava şeritleri) + plan tablosu.
   Mode-aware plan/timeline/liveInfo ve tüm handler'lar App'ten prop gelir. */
const DRV_COLORS = ["#4C9AFF", "#F5B23D", "#37D67A", "#B58BFF", "#EF8A2B", "#F0506E", "#22C1C3"];
const initialsOf = (nm) => String(nm || "").trim().split(/\s+/).map((w) => w[0] || "").slice(0, 2).join("").toUpperCase() || "—";
const WX_LEGEND = [["dry", "kuru"], ["damp", "nemli"], ["slwet", "az ıslak"], ["wet", "ıslak"], ["xwet", "çok ıslak"]];

export default function StintTab({
  tab, mode, t, st, plan, totalVE, totalFuelL, timeline, liveInfo,
  tyreInfo, quickTyre, bumpLaps, clearLaps, upStintLap, upTyre, upPit,
  assignDriver, upOvr, setRepair,
}) {
  const TY = ["FL", "FR", "RL", "RR"];
  const roster = st.roster || [];
  const drvCol = (nm) => { const i = roster.indexOf(nm); return DRV_COLORS[(i >= 0 ? i : 0) % DRV_COLORS.length]; };
  const nowPct = liveInfo.status === "live" && mode === "race"
    ? Math.min(100, (liveInfo.elapsed / liveInfo.raceMs) * 100) : null;

  const card = { border: "1px solid var(--rc-border)", borderRadius: 12, background: "var(--rc-surface)" };
  const kpi = (accent) => ({ border: `1px solid ${accent ? accent.b : "var(--rc-border)"}`, borderRadius: 11, background: accent ? accent.bg : "var(--rc-surface)", padding: "9px 14px", minWidth: 96 });
  const kpiV = { fontFamily: "var(--rc-font-display)", fontSize: 20, fontWeight: 700, lineHeight: 1 };
  const kpiL = { color: "var(--rc-text-3)", fontSize: 9.5, textTransform: "uppercase", letterSpacing: ".09em", marginTop: 3 };
  const hdT = { fontFamily: "var(--rc-font-display)", textTransform: "uppercase", letterSpacing: ".08em", fontSize: 15, fontWeight: 700 };
  const th = (left) => ({ textAlign: left ? "left" : "right", padding: "9px 14px", fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--rc-text-3)", borderBottom: "1px solid var(--rc-border)", whiteSpace: "nowrap" });
  const td = (left) => ({ padding: "10px 14px", borderBottom: "1px solid var(--rc-line-soft)", textAlign: left ? "left" : "right", fontFamily: left ? "var(--rc-font-ui)" : "var(--rc-font-display)", fontSize: left ? 12.5 : 13, fontVariantNumeric: "tabular-nums" });

  return (
    <div className={tab === "code80" ? "c80" : ""} style={{ padding: "4px 0 8px", display: "flex", flexDirection: "column", gap: 14, fontFamily: "var(--rc-font-ui)" }}>

      {/* Başlık + KPI */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, ...hdT, fontSize: 20, letterSpacing: ".07em" }}>{tab === "code80" ? t("Code 80 Planı") : t("Stint Planı")}</h2>
        <span style={{ marginLeft: "auto", display: "flex", flexWrap: "wrap", gap: 10 }}>
          <div style={kpi()}><div style={{ ...kpiV, fontWeight: 600 }}>{fmtHMS(plan.raceSec)}</div><div style={kpiL}>{tab === "code80" ? t("Code 80 Kalan") : t("Yarış süresi")}</div></div>
          <div style={kpi()}><div style={{ ...kpiV, color: "var(--rc-brand-bright)" }}>{st.chosen}-{plan.laps}</div><div style={kpiL}>{t("Strateji")}</div></div>
          <div style={kpi()}><div style={kpiV}>{plan.fullStints}</div><div style={kpiL}>{t("Stint")}</div></div>
          <div style={kpi()}><div style={kpiV}>{plan.totalLaps.toFixed(1)}</div><div style={kpiL}>{t("Tahmini tur")}</div></div>
          <div style={kpi({ b: "rgba(55,214,122,.35)", bg: "rgba(55,214,122,.07)" })}><div style={{ ...kpiV, color: "var(--rc-ok)" }}>{totalVE.toFixed(0)}%</div><div style={kpiL}>⚡ {t("Toplam VE")} · {totalFuelL.toFixed(0)} L</div></div>
        </span>
      </div>

      {(plan.truncated || !plan.rows.length) && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 15px", borderRadius: 11, border: "1px solid var(--rc-warn)", background: "rgba(245,178,61,.10)", fontSize: 12.5, color: "var(--rc-warn)", lineHeight: 1.5 }}>
          {plan.invalid
            ? t("⚠ Plan hesaplanamıyor — süre, \"Avg Lap\" ve seçili stratejinin tur sayısı dolu ve geçerli olmalı (tur ≥ 0:30).")
            : `${t("⚠ Plan tamamlanamadı")} — ${fmtHMS(plan.rows.length ? plan.rows[plan.rows.length - 1].timeLeft : plan.raceSec)} ${t("planlanmadı")} (${t("stint sınırı")}: ${MAX_STINTS}).`}
        </div>
      )}

      {/* S1 start lastikleri */}
      {tab === "stint" && (
        <div style={{ ...card, padding: "13px 16px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <span data-tour="s1" style={{ display: "inline-flex", alignItems: "center", gap: 8, ...hdT, fontSize: 14, letterSpacing: ".07em", color: "var(--rc-brand-bright)" }}><Tyre size={14} /> {t("S1 start lastikleri")}</span>
          <span className="mono" style={{ fontSize: 12, color: "var(--rc-text-2)" }}>
            {TY.map((corner, ci) => `${corner}:${String(st.tyreStints[0]?.[ci] || "–")}`).join("  ")}
          </span>
          <span className="pitopt" style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginLeft: "auto" }}>
            <button onClick={() => quickTyre(0, "carry")}>{t("Qual ile başla")}</button>
            <button disabled={tyreInfo.available < 4} onClick={() => quickTyre(0, "new4")}>{t("4 yeni")}</button>
            <button disabled={tyreInfo.available < 2} onClick={() => quickTyre(0, "fronts")}>{t("2 yeni ön")}</button>
            <button disabled={tyreInfo.available < 2} onClick={() => quickTyre(0, "rears")}>{t("2 yeni arka")}</button>
            <button disabled={tyreInfo.available < 2} onClick={() => quickTyre(0, "lefts")}>{t("2 yeni sol")}</button>
            <button disabled={tyreInfo.available < 2} onClick={() => quickTyre(0, "rights")}>{t("2 yeni sağ")}</button>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, paddingLeft: 9, marginLeft: 2, borderLeft: "1px solid var(--rc-border)" }}>
              <span style={{ fontSize: 10, color: "var(--rc-text-3)", letterSpacing: ".08em", textTransform: "uppercase" }}>{t("1 yeni")}</span>
              {TY.map((c, ci) => (
                <button key={c} disabled={tyreInfo.available < 1} title={`${t("Tek yeni lastik")} — ${c}`}
                  onClick={() => quickTyre(0, ["fl", "fr", "rl", "rr"][ci])}>{c}</button>
              ))}
            </span>
            <button onClick={() => quickTyre(0, "clear")}>{t("Temizle")}</button>
          </span>
          {!(st.tyreStints[0] || []).some((v) => String(v).trim()) && (
            <span style={{ flex: "1 1 100%", fontSize: 11.5, color: "var(--rc-warn)" }}>{t("⚠ Başlangıç lastiği seçilmedi — önce buradan başla, pit seçimleri buna zincirlenir")}</span>
          )}
          {tyreInfo.available <= 0 && (
            <span style={{ flex: "1 1 100%", fontSize: 11.5, color: "var(--rc-danger)" }}>{t("⚠ Lastik limiti doldu — yeni lastik seçilemez")}</span>
          )}
        </div>
      )}

      {/* Zaman çizelgesi */}
      <div style={{ ...card, padding: "16px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
          <span style={hdT}>{t("Zaman çizelgesi")}</span>
          <span style={{ marginLeft: "auto", display: "flex", gap: 12, fontSize: 10.5, color: "var(--rc-text-3)", flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><i style={{ width: 12, height: 8, borderRadius: 2, background: "var(--rc-brand)", display: "inline-block" }} />{t("stint")}</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><i style={{ width: 6, height: 8, borderRadius: 2, background: "var(--rc-warn)", display: "inline-block" }} />{t("pit")}</span>
            {WX_LEGEND.map(([id, lbl]) => (
              <span key={id} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><i style={{ width: 11, height: 8, borderRadius: 2, background: WEATHER[id].col, display: "inline-block" }} />{t(lbl)}</span>
            ))}
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><i style={{ width: 2, height: 10, background: "var(--rc-ok)", display: "inline-block" }} />{t("şu an")}</span>
          </span>
        </div>
        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", height: 34, borderRadius: 8, overflow: "hidden", border: "1px solid var(--rc-border)" }}>
            {timeline.map((s, i) => (
              <div key={i} style={{ width: `${s.w}%`, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", borderRight: "1px solid var(--rc-surface)", background: s.cls === "pit" ? "var(--rc-warn)" : s.cls === "live" ? "var(--rc-brand)" : (s.bg || "#2A171C") }}>
                {s.label && s.w > 5 && <span style={{ fontFamily: "var(--rc-font-display)", fontWeight: 700, fontSize: 12, color: s.cls === "pit" ? "#0B0708" : "var(--rc-text)", letterSpacing: ".04em", whiteSpace: "nowrap" }}>{s.label}</span>}
              </div>
            ))}
          </div>

          {(st.driverAssign || []).some(Boolean) && (() => {
            const rows = plan.rows; const cells = []; let i = 0;
            while (i < rows.length) {
              const drv = st.driverAssign[i] || "";
              let w = (rows[i].stintSec / plan.raceSec) * 100; let j = i;
              while (j + 1 < rows.length && (st.driverAssign[j + 1] || "") === drv) {
                w += ((rows[j].pitSec || 0) / plan.raceSec) * 100;
                w += (rows[j + 1].stintSec / plan.raceSec) * 100; j++;
              }
              const isCur = liveInfo.status === "live" && mode === "race" && liveInfo.stintIdx >= i && liveInfo.stintIdx <= j;
              cells.push({ type: "drv", w, drv, cur: isCur });
              if (j < rows.length - 1) cells.push({ type: "gap", w: ((rows[j].pitSec || 0) / plan.raceSec) * 100 });
              i = j + 1;
            }
            return (
              <div style={{ display: "flex", height: 26, marginTop: 5, borderRadius: 8, overflow: "hidden", border: "1px solid var(--rc-border)" }}>
                {cells.map((c, k) => c.type === "gap"
                  ? <div key={k} style={{ width: `${c.w}%`, flex: "0 0 auto", background: "var(--rc-surface-2)", borderRight: "1px solid var(--rc-surface)" }} />
                  : <div key={k} title={c.drv || t("Atanmadı")} style={{ width: `${c.w}%`, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", borderRight: "1px solid var(--rc-surface)", background: c.drv ? drvCol(c.drv) : "var(--rc-surface-3)", opacity: c.cur ? 1 : .62, boxShadow: c.cur ? "inset 0 0 0 2px var(--rc-text)" : "none" }}>
                    {c.w > 6 && <span style={{ fontSize: 11, fontWeight: 600, color: "#0B0708", whiteSpace: "nowrap" }}>{c.drv || "—"}</span>}</div>
                )}
              </div>
            );
          })()}

          {(() => {
            const log = wxLog(st);
            const total = plan.raceSec || parseHMS(st.raceTime) || 1;
            const cuts = [0, ...log.map((e) => e.t).filter((tt) => tt > 0.5 && tt < total - 0.5), total].sort((a, b) => a - b);
            const segs = [];
            for (let i = 0; i < cuts.length - 1; i++) {
              const a = cuts[i], b = cuts[i + 1]; if (b - a < 0.5) continue;
              segs.push({ w: (b - a) / total * 100, wx: wxAtRel(log, (a + b) / 2) });
            }
            if (!segs.some((x) => x.wx.lap > 1)) return null;
            return (
              <div style={{ display: "flex", height: 14, marginTop: 5, borderRadius: 6, overflow: "hidden", border: "1px solid var(--rc-border)" }}>
                {segs.map((s2, i) => (
                  <div key={i} title={`${t(s2.wx.lbl)} ×${s2.wx.lap.toFixed(2)}`} style={{ width: `${s2.w}%`, flex: "0 0 auto", background: s2.wx.col, borderRight: "1px solid var(--rc-surface)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {s2.w > 6 && <WetIcon id={wxId(s2.wx)} size={11} />}
                  </div>
                ))}
              </div>
            );
          })()}

          {nowPct != null && (
            <div style={{ position: "absolute", top: -4, bottom: -4, left: `${nowPct}%`, width: 2, background: "var(--rc-ok)", boxShadow: "0 0 8px rgba(55,214,122,.7)" }} />
          )}
        </div>
      </div>

      {/* Plan tablosu */}
      <div style={{ ...card, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 16px", borderBottom: "1px solid var(--rc-border)" }}>
          <span style={hdT}>{t("Plan tablosu")}</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table data-tour="stinttable" aria-label={t("Stint plan tablosu")} style={{ width: "100%", borderCollapse: "collapse", minWidth: 1000 }}>
            <thead><tr>
              <th style={th(true)}>#</th><th style={th(true)}>{t("Stint · tur")}</th><th style={th()}>⚡ {t("VE iht.")}</th>
              <th style={th(true)}>{t("Ort. tur")}</th><th style={th(true)}>{t("Pit ayarı")}</th><th style={th()}>Pit</th>
              <th style={th(true)}>{t("Pilot")}</th><th style={th()}>{t("Bitiş")}</th><th style={th()}>{t("Kalan")}</th><th style={th(true)}>Override</th>
            </tr></thead>
            <tbody>
              {plan.rows.map((r, i) => {
                const isLive = liveInfo.status === "live" && mode === "race" && i === liveInfo.stintIdx;
                const timeLocked = parseHMS(st.overrides[i] || "") > 0;
                const lapOvr = (Number(st.lapOverrides?.[i]) || 0) > 0;
                const drv = st.driverAssign[i] || "";
                const ovrTxt = (st.stintLaps || [])[i] || "";
                const ovrBad = !!ovrTxt && !(r.fixLap > 0);
                return (
                  <tr key={i} style={{ background: isLive ? "rgba(150,0,24,.20)" : "transparent", borderLeft: `3px solid ${isLive ? "var(--rc-brand-bright)" : r.isLast ? "var(--rc-warn)" : "transparent"}` }}>
                    <td style={{ ...td(true), width: 54 }}><span style={{ fontFamily: "var(--rc-font-display)", fontWeight: 700, fontSize: 17, color: isLive ? "var(--rc-text)" : "var(--rc-text-3)" }}>{r.idx}</span>{isLive && <i style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "var(--rc-ok)", marginLeft: 6, boxShadow: "0 0 6px var(--rc-ok)" }} />}</td>
                    <td style={td(true)}>
                      <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <b style={{ fontFamily: "var(--rc-font-display)", fontSize: 14 }}>{fmtHMS(r.stintSec)}</b>
                        {r.isLast ? null : (
                          <span className="lapcell">
                            <button className="lapstep" disabled={timeLocked} title={timeLocked ? t("Önce süre override'ı temizle") : t("Tur −1")} onClick={() => bumpLaps(i, r.lapsInStint, -1)}>−</button>
                            <b className={lapOvr ? "lapman" : ""}>{r.lapsInStint}</b>
                            <button className="lapstep" disabled={timeLocked} title={timeLocked ? t("Önce süre override'ı temizle") : t("Tur +1")} onClick={() => bumpLaps(i, r.lapsInStint, 1)}>+</button>
                            {lapOvr && <button className="lapclr" title={t("Otomatiğe dön")} onClick={() => clearLaps(i)}>✕</button>}
                          </span>
                        )}
                      </span>
                    </td>
                    <td style={{ ...td(), color: r.fuelNeed > 100 ? "var(--rc-danger)" : "var(--rc-text)" }} title={`≈ ${(r.fuelNeed * st.fuelRatio).toFixed(1)} L`}>{r.fuelNeed.toFixed(1)}%</td>
                    <td style={td(true)}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <input className="ovr" type="text" style={{ width: 78, ...(ovrBad ? { borderColor: "var(--rc-danger)", color: "var(--rc-danger)" } : {}) }}
                          placeholder={st.avgLap || "m:ss.00"}
                          title={ovrBad ? t("Geçersiz tur süresi — 'm:ss.00' biçiminde yaz (örn. 2:21.0); bu stint yarış ortalamasıyla hesaplanıyor") : r.fixLap > 0 ? t("Bu stint girilen tur süresiyle hesaplanıyor — hava çarpanı uygulanmaz") : t("Boş: yarış datasındaki ortalama tur kullanılır")}
                          value={ovrTxt} onChange={(e) => upStintLap(i, e.target.value)} />
                        {(r.fixLap > 0 || ovrBad) && <button className="minibtn" title={t("Otomatiğe dön")} onClick={() => upStintLap(i, "")}>✕</button>}
                      </span>
                    </td>
                    <td style={td(true)}>
                      {r.isLast ? <span style={{ display: "inline-block", padding: "3px 12px", borderRadius: 99, border: "1px solid var(--rc-warn)", color: "var(--rc-warn)", fontSize: 11.5 }}>FINISH 🏁</span> : (
                        <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span className="tyrebox">
                            {TY.map((corner, ti) => {
                              const stv = tyState((st.pits[i] || EMPTY_PIT).tyres[ti]);
                              return (
                                <button key={corner} className={["", "on", "qual", "wet", "used"][stv]}
                                  title={[t("Taşı — tıkla: yeni kuru"), t("Yeni kuru — tıkla: Qual'a dön"), t("Qual lastiği — tıkla: wet"), t("Wet (sınırsız) — tıkla: eski kuru"), t("Eski kuru tekrar — tıkla: taşı")][stv]}
                                  onClick={() => upTyre(i, ti)}>{corner}</button>
                              );
                            })}
                          </span>
                          <span className="pitopt">
                            <button className={(st.pits[i] || EMPTY_PIT).fuel ? "on" : ""} onClick={() => upPit(i, { fuel: !(st.pits[i] || EMPTY_PIT).fuel })}>FUEL</button>
                            <label className="dmg" title={t("Hasar tamir süresi (s) — plana eklenir")}>🔧<input type="number" min="0" step="1" placeholder="0" value={(st.pitRepairs || [])[i] || ""} onChange={(e) => setRepair?.(i, e.target.value)} /></label>
                          </span>
                        </span>
                      )}
                    </td>
                    <td style={td()}>{r.isLast ? "—" : (<>{fmtHMS(r.pitSec)}{r.repairSec > 0 && <span style={{ color: "var(--rc-warn)", fontSize: 11, marginLeft: 4 }}>🔧+{r.repairSec}s</span>}</>)}</td>
                    <td style={td(true)}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 24, height: 24, borderRadius: "50%", flex: "0 0 auto", background: drv ? drvCol(drv) : "var(--rc-border-strong)", color: "#0B0708", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 10 }}>{drv ? initialsOf(drv) : "—"}</span>
                        <select className="drvsel" value={drv} onChange={(e) => assignDriver(i, e.target.value)}>
                          <option value="">—</option>
                          {roster.map((n) => <option key={n} value={n}>{n}</option>)}
                        </select>
                      </span>
                    </td>
                    <td style={td()}>{fmtHMS(r.endSec)}</td>
                    <td style={{ ...td(), color: r.timeLeft < 0 ? "var(--rc-danger)" : "var(--rc-ok)" }}>{fmtHMS(r.timeLeft)}</td>
                    <td style={td(true)}><input className="ovr" type="text" placeholder="h:mm:ss" disabled={lapOvr}
                      title={lapOvr ? t("Tur override aktif — önce onu temizle") : undefined}
                      value={st.overrides[i] || ""} onChange={(e) => upOvr(i, e.target.value)} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
