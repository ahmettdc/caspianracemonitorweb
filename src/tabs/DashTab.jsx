import { fmtHMS, WX, wxId } from "../engine";
import { WetIcon } from "../WetIcon";
import { ASSET, AV, TRACK_ASSET, PIT_LANE_TIMES, CAR_CLASSES, PIE_COLORS,
  trackName, carName } from "../constants";
import { carImageSrc } from "../teamAssets";
import { Tyre, Bolt } from "../components";
import { Guide } from "../shell";

/* Dashboard özet sekmesi (v2.0 — README §3): İKİ KOLON.
   Sol: araç + pist görsel kartı (tıkla → büyütme penceresi; araçta LMU tempo
   referans tablosu), altında stint programı tablosu.
   Sağ: 4 KPI kutusu (kalan · strateji·tur · stint · sıradaki pit), canlı durum
   satırı, lastik kartı, son stint VE kartı (36px yeşil), pilot dağılımı
   (pilot renkli çubuklar — DriversTab ile AYNI renk eşlemesi).
   Başlıkta 🖨 PDF düğmesi.

   Derived (liveInfo/racePlan/tyreInfo/planLsf/driverPlan) ve handler'lar
   (exportPdf/setZoom/carriedAt) App'ten prop gelir. */
export default function DashTab({
  t, st, zoom, setZoom, exportPdf, liveInfo, racePlan, tyreInfo,
  planLsf, driverPlan, carriedAt, pitSoon, lmuData, assets, guide,
}) {
  /* pilot renkleri DriversTab'deki colorOf ile BİREBİR aynı sıralamadan gelir →
     iki ekranda aynı pilot aynı renkte görünür. */
  const names = driverPlan ? st.roster.filter((n) => driverPlan.totals[n]) : [];
  const colorOf = (n) => PIE_COLORS[names.indexOf(n) % PIE_COLORS.length];
  const live = liveInfo.status === "live";

  return (
    <>
      {guide && <Guide title={guide.title} text={guide.text} />}
      <div className="dashhead">
        <span className="spacer" />
        <button className="pdfbtn" onClick={() => exportPdf("stint")} data-tour="pdf">
          🖨 PDF</button>
      </div>

      <div className="dgrid dashgrid">
        {/* ══════════ SOL: görseller + stint programı ══════════ */}
        <div className="dashcol left">
          <div className="dashvis">
            {st.car && (
              <div className="card infocard clickable" onClick={() => setZoom("car")}
                title={t("Büyütmek için tıkla")}>
                <h2>🏎 {t("Araç")}</h2>
                <img className="infoimg" src={carImageSrc(assets, st.carClass, st.car, "side")}
                  alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                <div className="disp" style={{ fontSize: 17 }}>{carName(st.carClass, st.car)}</div>
                <div className="hint" style={{ display: "flex", alignItems: "center",
                  justifyContent: "center", gap: 6 }}>
                  <img src={`${ASSET}class/${st.carClass}.png`} alt="" style={{ height: 16 }}
                    onError={(e) => { e.currentTarget.style.display = "none"; }} />
                  {(CAR_CLASSES.find(([id]) => id === st.carClass) || [, st.carClass])[1]}</div>
              </div>
            )}

            {st.track && (
              <div className="card infocard clickable" onClick={() => setZoom("track")}
                title={t("Büyütmek için tıkla")}>
                <h2>📍 {t("Pist")}</h2>
                <img className="infoimg track" key={st.track}
                  src={`${ASSET}tracks/${TRACK_ASSET(st.track)}.png${AV}`} alt=""
                  onError={(e) => { e.currentTarget.style.display = "none"; }} />
                <div className="disp" style={{ fontSize: 17, display: "flex",
                  alignItems: "center", gap: 6 }}>
                  <img className="flag" style={{ width: 22 }} src={`${ASSET}flags/${st.track}.png`}
                    alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                  {trackName(st.track)}</div>
                {PIT_LANE_TIMES[st.track] != null && (
                  <div className="hint">{t("Pit lane")}: {PIT_LANE_TIMES[st.track]}s</div>
                )}
                {WX(st).lap > 1 && (
                  <div className="hint" style={{ color: WX(st).col, fontWeight: 600,
                    display: "flex", alignItems: "center", gap: 5 }}>
                    <WetIcon id={wxId(WX(st))} size={15} /> {t(WX(st).lbl)} · ×{WX(st).lap.toFixed(2)}
                    {(st.weatherLog || []).length > 1 &&
                      <> · {st.weatherLog.length} {t("değişim")}</>}</div>
                )}
              </div>
            )}
          </div>

          <div className="card">
            <h2 data-tour="dash-prog">{t("📋 Stint Programı")}</h2>
            <table>
              <thead><tr><th>#</th><th>End</th><th>Left</th><th>{t("Pilot")}</th></tr></thead>
              <tbody>
                {racePlan.rows.map((r, i) => (
                  <tr key={i} className={[
                    r.isLast ? "last" : "",
                    live && i === liveInfo.stintIdx ? "live" : "",
                  ].join(" ").trim()}>
                    <td>{r.idx}</td>
                    <td>{fmtHMS(r.endSec)}</td>
                    <td className={r.timeLeft < 0 ? "neg" : "pos"}>{fmtHMS(r.timeLeft)}</td>
                    <td>
                      {st.driverAssign[i]
                        ? <span className="drvsplit">
                            <span className="top"><span className="nm">
                              <i className="dot" style={{ background: colorOf(st.driverAssign[i]) }} />
                              {st.driverAssign[i]}</span></span>
                          </span>
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ══════════ SAĞ: KPI · canlı · lastik · VE · pilot dağılımı ══════════ */}
        <div className="dashcol right">
          <div className="card">
            <h2>{t("⏱ Yarış")}</h2>
            {/* 4 KPI: kalan · strateji·tur · stint · sıradaki pit (README §3) */}
            <div className="kpis" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <div className="kpi"><div className="v mono" style={{ color: "var(--green)" }}>
                {live ? fmtHMS(liveInfo.remaining / 1000) : fmtHMS(racePlan.raceSec)}</div>
                <div className="l">{live ? t("Kalan") : t("Yarış Süresi")}</div></div>
              <div className="kpi"><div className="v" style={{ color: "var(--accent)" }}>
                {st.chosen}-{racePlan.laps}</div><div className="l">{t("Strateji")}</div></div>
              <div className="kpi"><div className="v">{racePlan.fullStints}</div>
                <div className="l">Stint</div></div>
              <div className="kpi"><div className="v mono"
                style={{ color: live ? "var(--yellow)" : undefined }}>
                {live ? fmtHMS(liveInfo.nextPitIn / 1000) : racePlan.totalLaps.toFixed(0)}</div>
                <div className="l">{live ? t("Sıradaki pit") : t("Tahmini Tur")}</div></div>
            </div>
            {live && (
              <div className="hint">
                {t("Şu an: Stint")} {liveInfo.stintIdx + 1}
                {liveInfo.phase === "pit" ? " " + t("(PIT'te)") : ""}
                {pitSoon && <> · <b className="pulse">{t("pit yaklaşıyor")}</b></>}
                {liveInfo.driver && <> · 🏎 {liveInfo.driver}</>}
              </div>
            )}
          </div>

          <div className="card">
            <h2 style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <Tyre size={18} /> {t("Lastik")}</h2>
            <div className="kpis" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <div className="kpi"><div className="v">{tyreInfo.used}/{st.tyreLimit}</div>
                <div className="l">{t("Kullanılan Lastik")}</div></div>
              <div className="kpi"><div className="v"
                style={{ color: tyreInfo.available < 0 ? "var(--red)" : "var(--green)" }}>
                {tyreInfo.available}</div><div className="l">{t("Kalan Lastik")}</div></div>
            </div>
            {live && racePlan.rows[liveInfo.stintIdx + 1] && (
              <div className="hint">{t("Sıradaki stint lastikleri:")}{" "}
                <b className="mono">
                  {[0, 1, 2, 3].map((ci) => {
                    const raw = String((st.tyreStints[liveInfo.stintIdx + 1] || [])[ci] || "").trim();
                    return raw || `⟳${carriedAt(liveInfo.stintIdx + 1, ci) || "–"}`;
                  }).join(" / ")}
                </b></div>
            )}
            {tyreInfo.conflicts.length > 0 &&
              <div className="hint" style={{ color: "var(--red)" }}>
                {t("⚠ Köşe ihlali: lastik")} {tyreInfo.conflicts.join(", ")}</div>}
          </div>

          <div className="card">
            <h2 style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Bolt /> <span data-tour="dash-lsf">{t("Son Stint VE")}</span></h2>
            <div className="vebig">
              {planLsf.refuel.toFixed(1)}%
              <span className="sub">(+{st.extraLap} {t("lap")})</span>
            </div>
            <div className="hint">
              ≈ {planLsf.refuelL.toFixed(1)} L · {planLsf.lapsLeft} {t("tur + extra")}{" "}
              {st.extraLap} <span style={{ color: "var(--dim)" }}>
                ({planLsf.lapsRaw.toFixed(2)} {t("gerçek")})</span>
            </div>
          </div>

          {names.length > 0 && (
            <div className="card">
              <h2>{t("Pilot Dağılımı")}</h2>
              <div className="drvsplit">
                {names.map((n) => {
                  const tot = driverPlan.totals[n];
                  const pct = driverPlan.grandMs ? (tot.ms / driverPlan.grandMs) * 100 : 0;
                  const col = colorOf(n);
                  return (
                    <div key={n} className="row">
                      <div className="top">
                        <span className="nm"><i className="dot" style={{ background: col }} />{n}</span>
                        <span className="mono">{pct.toFixed(1)}%</span>
                      </div>
                      {/* genişlik + renk hesaplanan değer → inline (token'a çevrilemez) */}
                      <div className="bar"><i style={{ width: `${pct}%`, background: col }} /></div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
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
