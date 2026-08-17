import { fmtHMS, WX, wxId } from "../engine";
import { WetIcon } from "../WetIcon";
import { ASSET, AV, TRACK_ASSET, PIT_LANE_TIMES, CAR_CLASSES, driverColorOf,
  trackName, carName } from "../constants";
import { carImageSrc } from "../teamAssets";
import { compoundInfo } from "../tyreCompound";

/* Dashboard özet sekmesi (v2.0 — handoff 03-dashboard.md): İKİ SATIR.
   Satır 1: araç + pist görsel kartı (tıkla → büyütme; araçta LMU tempo tablosu) +
   sağda başlık/PDF, 4 KPI kutusu (kalan · strateji·tur · stint · sıradaki pit) ve
   canlı durum satırı.
   Satır 2: sol stint programı tablosu; sağ lastik kartı, son stint VE kartı ve
   pilot dağılımı (DriversTab ile AYNI renk eşlemesi).
   Markup ve stil değerleri fişten birebir; renkler --rc-* tokenlarına bağlı.

   Derived (liveInfo/racePlan/tyreInfo/planLsf/driverPlan) ve handler'lar
   (exportPdf/setZoom/carriedAt) App'ten prop gelir. Veri katmanı değişmez. */
export default function DashTab({
  t, st, zoom, setZoom, exportPdf, liveInfo, racePlan, tyreInfo,
  planLsf, driverPlan, carriedAt, pitSoon, lmuData, assets,
}) {
  /* pilot renkleri DriversTab'deki colorOf ile BİREBİR aynı sıralamadan gelir →
     iki ekranda aynı pilot aynı renkte görünür. */
  const names = driverPlan ? st.roster.filter((n) => driverPlan.totals[n]) : [];
  const colorOf = (n) => driverColorOf(names, n);
  const live = liveInfo.status === "live";
  const initialsOf = (n) => String(n || "").trim().split(/\s+/)
    .map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  const disp = "var(--rc-font-display)";
  const ui = "var(--rc-font-ui)";
  const hideImg = (e) => { e.currentTarget.style.display = "none"; };

  /* --- yeniden kullanılan stil objeleri (fiş: 03-dashboard.md) --- */
  const kpiBox = { border: "1px solid var(--rc-border)", borderRadius: 12,
    background: "var(--rc-surface)", padding: "13px 15px" };
  const kpiNum = { fontFamily: disp, fontSize: 26, lineHeight: 1 };
  const kpiLbl = { color: "var(--rc-text-3)", fontSize: 10, textTransform: "uppercase",
    letterSpacing: ".09em", marginTop: 4 };
  const tyLbl = { ...kpiLbl, marginTop: 3 };
  const sectTtl = { fontFamily: disp, textTransform: "uppercase", letterSpacing: ".08em",
    fontSize: 16, fontWeight: 700 };
  const rcard = { border: "1px solid var(--rc-border)", borderRadius: 12,
    background: "var(--rc-surface)", padding: "16px 18px" };
  /* fişteki thLeft/th tanımı renderVals'ta yok → veri katmanıyla uyumlu başlık
     hücresi stili (etiket tonu, satır ayracı). FLAG: fiş dışı karar. */
  const th = { padding: "10px 14px", borderBottom: "1px solid var(--rc-border)",
    textAlign: "right", color: "var(--rc-text-3)", fontSize: 10, fontWeight: 600,
    textTransform: "uppercase", letterSpacing: ".08em" };
  const thLeft = { ...th, textAlign: "left" };
  const tdB = { padding: "11px 14px", borderBottom: "1px solid var(--rc-line-soft)",
    textAlign: "right", fontFamily: disp, fontSize: 13.5, fontVariantNumeric: "tabular-nums" };

  /* Lastik hücresi — fişteki tyreImg için per-hamur görsel asset'i yok; en yakın
     gerçek veri st.tyreStints (köşe başına ham hamur). Temsilî hamur kodu +
     hamur rengi (COMPOUNDS) gösterilir. FLAG: görsel yerine kod rozeti. */
  const tyreBadge = (i) => {
    const raw = (st.tyreStints[i] || []).map((x) => String(x).trim()).find(Boolean);
    const info = raw ? compoundInfo(raw) : null;
    if (!info) return <span style={{ color: "var(--rc-text-3)" }}>—</span>;
    return <span style={{ fontFamily: "var(--rc-font-mono)", fontSize: 12,
      fontWeight: 700, color: info.color }}>{info.short}</span>;
  };

  return (
    <>
      <div style={{ padding: "16px 20px 40px", display: "flex", flexDirection: "column",
        gap: 16, animation: "rcin .26s ease-out" }}>

        {/* ══════════ SATIR 1: görsel kart · başlık/KPI · canlı ══════════ */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "stretch" }}>
          <div style={{ flex: "1 1 480px", minWidth: 0, display: "flex", flexWrap: "wrap",
            gap: 16, border: "1px solid var(--rc-border-strong)", borderRadius: 14,
            background: "radial-gradient(120% 160% at 100% 0,rgba(150,0,24,.18),var(--rc-surface-2) 62%)",
            padding: "18px 20px", alignItems: "center" }}>

            {st.car && (
              <div onClick={() => setZoom("car")} title={t("Büyütmek için tıkla")}
                style={{ flex: "1 1 240px", minWidth: 0, textAlign: "center", cursor: "zoom-in" }}>
                <img src={carImageSrc(assets, st.carClass, st.car, "side")} alt="" onError={hideImg}
                  style={{ display: "block", width: "100%", maxWidth: 280, height: 110,
                    objectFit: "contain", margin: "0 auto" }} />
                <div style={{ fontFamily: disp, fontWeight: 700, fontSize: 19, marginTop: 8 }}>
                  {carName(st.carClass, st.car)}</div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5,
                  color: "var(--rc-text-3)", marginTop: 2 }}>
                  <img src={`${ASSET}class/${st.carClass}.png`} alt="" onError={hideImg}
                    style={{ height: 15 }} />
                  {(CAR_CLASSES.find(([id]) => id === st.carClass) || [, st.carClass])[1]}</div>
              </div>
            )}

            {st.car && st.track && (
              <span style={{ width: 1, alignSelf: "stretch", background: "var(--rc-border-strong)" }} />
            )}

            {st.track && (
              <div onClick={() => setZoom("track")} title={t("Büyütmek için tıkla")}
                style={{ flex: "1 1 220px", minWidth: 0, textAlign: "center", cursor: "zoom-in" }}>
                <img key={st.track} src={`${ASSET}tracks/${TRACK_ASSET(st.track)}.png${AV}`} alt=""
                  onError={hideImg}
                  style={{ display: "block", width: "100%", maxWidth: 230, height: 110,
                    objectFit: "contain", margin: "0 auto" }} />
                <div style={{ display: "inline-flex", alignItems: "center", gap: 7, fontFamily: disp,
                  fontWeight: 700, fontSize: 19, marginTop: 8 }}>
                  <img src={`${ASSET}flags/${st.track}.png`} alt="" onError={hideImg}
                    style={{ width: 22, borderRadius: 2 }} />
                  {trackName(st.track)}</div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5,
                  color: "var(--rc-text-3)", marginTop: 2 }}>
                  {PIT_LANE_TIMES[st.track] != null && (
                    <span>{t("Pit lane")} {PIT_LANE_TIMES[st.track]}s</span>
                  )}
                  {PIT_LANE_TIMES[st.track] != null && (
                    <span style={{ color: "var(--rc-border-strong)" }}>·</span>
                  )}
                  {/* Fiş (03-dashboard.md): tutuş çipi kuru (×1.00) dahil her zaman görünür. */}
                  <><WetIcon id={wxId(WX(st))} size={14} /> {t(WX(st).lbl)} ×{WX(st).lap.toFixed(2)}</>
                </div>
              </div>
            )}
          </div>

          <div style={{ flex: "1 1 300px", minWidth: 280, display: "flex",
            flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h2 style={{ margin: 0, fontFamily: disp, textTransform: "uppercase",
                letterSpacing: ".07em", fontSize: 20, fontWeight: 700 }}>{t("Dashboard")}</h2>
              <button onClick={() => exportPdf("stint")} data-tour="pdf"
                style={{ marginLeft: "auto", padding: "8px 14px", borderRadius: 9,
                  border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)",
                  color: "var(--rc-text)", cursor: "pointer", fontSize: 12.5 }}>🖨 PDF</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={kpiBox}>
                <div style={{ ...kpiNum, fontWeight: 600, color: "var(--rc-ok)" }}>
                  {live ? fmtHMS(liveInfo.remaining / 1000) : fmtHMS(racePlan.raceSec)}</div>
                <div style={kpiLbl}>{live ? t("Kalan") : t("Yarış Süresi")}</div>
              </div>
              <div style={kpiBox}>
                <div style={{ ...kpiNum, fontWeight: 700 }}>
                  {st.chosen}<span style={{ color: "var(--rc-text-3)" }}>-</span>{racePlan.laps}</div>
                <div style={kpiLbl}>{t("Strateji · tur")}</div>
              </div>
              <div style={kpiBox}>
                <div style={{ ...kpiNum, fontWeight: 700 }}>{racePlan.fullStints}</div>
                <div style={kpiLbl}>Stint</div>
              </div>
              <div style={kpiBox}>
                <div style={{ ...kpiNum, fontWeight: 600, color: "var(--rc-warn)" }}>
                  {live ? fmtHMS(liveInfo.nextPitIn / 1000) : racePlan.totalLaps.toFixed(0)}</div>
                <div style={kpiLbl}>{live ? t("Sıradaki pit") : t("Tahmini Tur")}</div>
              </div>
            </div>

            {live && (
              <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap",
                padding: "10px 14px", borderRadius: 11, border: "1px solid rgba(55,214,122,.3)",
                background: "rgba(55,214,122,.07)" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--rc-ok)",
                  boxShadow: "0 0 8px var(--rc-ok)", animation: "rcpulse 1.2s ease-in-out infinite" }} />
                <span style={{ fontSize: 12, color: "var(--rc-text-2)" }}>
                  {t("Stint")} <b style={{ color: "var(--rc-text)" }}>{liveInfo.stintIdx + 1}</b>
                  {liveInfo.driver && <> · {t("pilot")} <b style={{ color: "var(--rc-text)" }}>
                    {liveInfo.driver}</b></>}
                  {/* fiş: aktif stintin geçen süresi ("18:52'dir pistte") */}
                  {(() => {
                    const el = (liveInfo.phaseEnd - liveInfo.stintStartMs) - liveInfo.nextPitIn;
                    return liveInfo.phase !== "pit" && el > 0
                      ? <> · <b style={{ color: "var(--rc-text)" }}>{fmtHMS(el / 1000)}</b>{" "}
                          {t("süredir pistte")}</>
                      : null;
                  })()}
                  {liveInfo.phase === "pit" && <> · {t("(PIT'te)")}</>}
                  {pitSoon && <> · <b style={{ color: "var(--rc-text)" }}>{t("pit yaklaşıyor")}</b></>}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ══════════ SATIR 2: stint programı · lastik · VE · pilot dağılımı ══════════ */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>

          <div style={{ flex: "1 1 460px", minWidth: 0, border: "1px solid var(--rc-border)",
            borderRadius: 12, background: "var(--rc-surface)", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 16px",
              borderBottom: "1px solid var(--rc-border)" }}>
              <span style={sectTtl} data-tour="dash-prog">{t("Stint programı")}</span>
              <span style={{ fontSize: 11.5, color: "var(--rc-text-3)" }}>
                {racePlan.fullStints} {t("stint")} · {st.chosen} {t("stratejisi")}</span>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={thLeft}>#</th>
                <th style={thLeft}>{t("Pilot")}</th>
                <th style={th}>{t("Bitiş")}</th>
                <th style={th}>{t("Kalan")}</th>
                <th style={th}>{t("Lastik")}</th>
              </tr></thead>
              <tbody>
                {racePlan.rows.map((r, i) => {
                  const rowLive = live && i === liveInfo.stintIdx;
                  const driver = st.driverAssign[i];
                  return (
                    <tr key={i} style={{
                      background: rowLive ? "rgba(150,0,24,.22)" : "transparent",
                      borderLeft: `3px solid ${rowLive ? "var(--rc-brand-bright)"
                        : r.isLast ? "var(--rc-warn)" : "transparent"}`,
                    }}>
                      <td style={{ ...tdB, textAlign: "left", width: 58 }}>
                        <span style={{ fontFamily: disp, fontWeight: 700, fontSize: 16,
                          color: rowLive ? "var(--rc-text)" : "var(--rc-text-3)" }}>S{r.idx}</span>
                      </td>
                      <td style={{ ...tdB, textAlign: "left", fontFamily: ui }}>
                        {driver ? (
                          <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
                            <span style={{ width: 24, height: 24, borderRadius: "50%",
                              flex: "0 0 auto", background: colorOf(driver), color: "var(--rc-bg)",
                              display: "inline-flex", alignItems: "center", justifyContent: "center",
                              fontWeight: 700, fontSize: 10 }}>{initialsOf(driver)}</span>
                            <span style={{ fontSize: 13.5, whiteSpace: "nowrap" }}>{driver}</span>
                            {rowLive && (
                              <span style={{ fontSize: 9.5, textTransform: "uppercase",
                                letterSpacing: ".09em", padding: "2px 8px", borderRadius: 99,
                                border: "1px solid var(--rc-ok)", color: "var(--rc-ok)",
                                whiteSpace: "nowrap" }}>● {t("pistte")}</span>
                            )}
                          </span>
                        ) : "—"}
                      </td>
                      <td style={tdB}>{fmtHMS(r.endSec)}</td>
                      <td style={{ ...tdB, color: r.timeLeft < 0 ? "var(--rc-danger)" : "var(--rc-ok)" }}>
                        {fmtHMS(r.timeLeft)}</td>
                      <td style={{ ...tdB, width: 60 }}>{tyreBadge(i)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ flex: "1 1 320px", minWidth: 300, display: "flex",
            flexDirection: "column", gap: 16 }}>

            <div style={rcard}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <span style={sectTtl}>🛞 {t("Lastik")}</span>
                <span style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--rc-text-3)" }}>
                  {t("Limit")} {st.tyreLimit} {t("set")}</span>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 14 }}>
                <div>
                  <div style={{ fontFamily: disp, fontSize: 34, fontWeight: 700, lineHeight: 1 }}>
                    {tyreInfo.used}<span style={{ fontSize: ".5em", color: "var(--rc-text-3)" }}>
                      /{st.tyreLimit}</span></div>
                  <div style={tyLbl}>{t("Kullanılan")}</div>
                </div>
                <div>
                  <div style={{ fontFamily: disp, fontSize: 34, fontWeight: 700, lineHeight: 1,
                    color: tyreInfo.available < 0 ? "var(--rc-danger)" : "var(--rc-ok)" }}>
                    {tyreInfo.available}</div>
                  <div style={tyLbl}>{t("Kalan")}</div>
                </div>
                <div style={{ flex: 1, display: "flex", gap: 4, justifyContent: "flex-end" }}>
                  {Array.from({ length: st.tyreLimit }, (_, i) => {
                    const usedBar = i < tyreInfo.used;
                    return (
                      <span key={i} style={{ display: "block", width: 9, height: 26, borderRadius: 3,
                        background: usedBar ? "var(--rc-border-strong)" : "var(--rc-ok)",
                        opacity: usedBar ? 1 : 0.8 }} />
                    );
                  })}
                </div>
              </div>
              {live && racePlan.rows[liveInfo.stintIdx + 1] && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--rc-border)",
                  fontSize: 11.5, color: "var(--rc-text-2)" }}>
                  {t("Sıradaki stint lastikleri")}
                  <b style={{ fontFamily: disp, marginLeft: 6 }}>
                    {[0, 1, 2, 3].map((ci) => {
                      const raw = String((st.tyreStints[liveInfo.stintIdx + 1] || [])[ci] || "").trim();
                      return raw || `⟳${carriedAt(liveInfo.stintIdx + 1, ci) || "–"}`;
                    }).join(" / ")}
                  </b>
                </div>
              )}
            </div>

            <div style={rcard}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={sectTtl} data-tour="dash-lsf">⚡ {t("Son stint VE")}</span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <span style={{ fontFamily: disp, fontSize: 44, fontWeight: 700, lineHeight: 1,
                  color: "var(--rc-warn)" }}>{planLsf.refuel.toFixed(1)}%</span>
                <span style={{ fontSize: 14, color: "var(--rc-text-3)" }}>
                  +{st.extraLap} {t("tur")}</span>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--rc-text-2)", marginTop: 6 }}>
                ≈ {planLsf.refuelL.toFixed(1)} L · {planLsf.lapsLeft} {t("tur + extra")} {st.extraLap}{" "}
                <span style={{ color: "var(--rc-text-3)" }}>
                  ({planLsf.lapsRaw.toFixed(2)} {t("gerçek")})</span>
              </div>
            </div>

            {names.length > 0 && (
              <div style={rcard}>
                <div style={{ ...sectTtl, marginBottom: 12 }}>{t("Pilot dağılımı")}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {names.map((n) => {
                    const tot = driverPlan.totals[n];
                    const pct = driverPlan.grandMs ? (tot.ms / driverPlan.grandMs) * 100 : 0;
                    const col = colorOf(n);
                    return (
                      <div key={n}>
                        <div style={{ display: "flex", justifyContent: "space-between",
                          fontSize: 12, marginBottom: 4 }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                            <span style={{ width: 9, height: 9, borderRadius: "50%", background: col,
                              display: "inline-block" }} />{n}</span>
                          <span style={{ fontFamily: disp, color: "var(--rc-text-2)" }}>
                            {fmtHMS(tot.ms / 1000)} · {pct.toFixed(1)}%</span>
                        </div>
                        <div style={{ height: 6, background: "var(--rc-line-soft)", borderRadius: 3,
                          overflow: "hidden" }}>
                          <i style={{ display: "block", height: "100%", width: `${pct}%`,
                            background: col, borderRadius: 3 }} /></div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Büyütme penceresi — araçta LMU tempo referans tablosu (README §3). */}
      {zoom && (
        <div className="lightbox" onClick={() => setZoom(null)}>
          <button className="lbclose" onClick={() => setZoom(null)}>✕</button>
          <img src={zoom === "car"
              ? carImageSrc(assets, st.carClass, st.car, "side")
              : `${ASSET}tracks/${TRACK_ASSET(st.track)}.png${AV}`}
            alt="" style={zoom === "car" ? { maxHeight: "40vh" } : undefined}
            onError={() => setZoom(null)} />
          <div className="lbcap" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {zoom === "car" && (
              <img src={`${ASSET}class/${st.carClass}.png`} alt="" style={{ height: 20 }}
                onError={(e) => { e.currentTarget.style.display = "none"; }} />
            )}
            {zoom === "car"
              ? `${carName(st.carClass, st.car)} · ${(CAR_CLASSES.find(([id]) => id === st.carClass) || [, st.carClass])[1]}`
              : `${trackName(st.track)}${PIT_LANE_TIMES[st.track] != null ? ` · Pit lane ${PIT_LANE_TIMES[st.track]}s` : ""}`}
          </div>
          {zoom === "car" && (() => {
            const d = lmuData?.data?.[st.track];
            const carE = d?.[`${st.carClass}:${st.car}`];
            const clsE = d?.[st.carClass];
            const tiers = clsE?.tiers;
            const hot = carE?.hot || clsE?.hot;
            if (!tiers && !hot) return null;
            /* Tempo referansı renkleri README §3'ten birebir. */
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
              <div className="lbtiers" onClick={(e) => e.stopPropagation()}
                title={lmuData?.source}>
                {ROWS.map(([lbl, v, col]) => (
                  <div key={lbl} className="lbtr">
                    <i style={{ background: col }} />
                    <span className="lbl">{lbl}</span>
                    <b className="mono" style={{ color: col }}>{v}</b>
                  </div>
                ))}
                <div className="lbsrc">{trackName(st.track)} · {lmuData?.source}</div>
              </div>
            );
          })()}
        </div>
      )}
    </>
  );
}
