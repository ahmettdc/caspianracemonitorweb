import { fmtHMS, parseHMS, wxLog, wxAtRel, tyState, TYRE_2_SEC, TYRE_4_SEC, EMPTY_PIT } from "../engine";
import { Tyre } from "../components";

/* Stint plan sekmesi (stint + code80) — KPI'lar, S1 lastik kısayolları, stint/hava
   zaman çizelgeleri, plan tablosu (tur/VE/pit/override) ve pit formülü.
   Mode-aware plan, timeline, liveInfo ve tüm handler'lar App'ten prop gelir. */
export default function StintTab({
  tab, mode, t, st, plan, totalVE, totalFuelL, timeline, liveInfo, pitSoon,
  tyreInfo, quickTyre, bumpLaps, clearLaps, upStintLap, upTyre, upPit,
  assignDriver, upOvr,
}) {
  const TY = ["FL", "FR", "RL", "RR"];
  return (
    <div className={`card ${tab === "code80" ? "c80" : ""}`}>
      <div className="kpis">
        <div className="kpi"><div className="v mono">{fmtHMS(plan.raceSec)}</div>
          <div className="l">{tab === "code80" ? "Code 80 Kalan" : "Yarış Süresi"}</div></div>
        <div className="kpi"><div className="v" style={{ color: "var(--teal)" }}>{st.chosen}-{plan.laps}</div>
          <div className="l">{t("Strateji")}</div></div>
        <div className="kpi"><div className="v">{plan.fullStints}</div>
          <div className="l">{t("Stint Sayısı")}</div></div>
        <div className="kpi"><div className="v">{plan.totalLaps.toFixed(1)}</div>
          <div className="l">{t("Tahmini Toplam Tur")}</div></div>
        <div className="kpi"><div className="v" style={{ color: "var(--green)" }}>{totalVE.toFixed(0)}%</div>
          <div className="l">⚡ {t("Toplam VE")} · {totalFuelL.toFixed(1)} L {t("yakıt")}</div></div>
      </div>

      {tab === "stint" && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
          border: "1px solid var(--line)", borderRadius: 8, padding: "8px 12px",
          marginBottom: 12, background: "var(--panel2)" }}>
          <span className="disp" data-tour="s1" style={{ fontSize: 14,
            letterSpacing: ".06em", color: "var(--teal)" }}>
            <Tyre size={13} /> {t("S1 START LASTİKLERİ")}</span>
          <span className="mono" style={{ fontSize: 12 }}>
            {TY.map((corner, ci) =>
              `${corner}:${String(st.tyreStints[0]?.[ci] || "–")}`).join("  ")}
          </span>
          <span className="pitopt">
            <button onClick={() => quickTyre(0, "carry")}>{t("QUAL İLE BAŞLA")}</button>
            <button disabled={tyreInfo.available < 4}
              onClick={() => quickTyre(0, "new4")}>{t("4 YENİ")}</button>
            <button disabled={tyreInfo.available < 2}
              onClick={() => quickTyre(0, "fronts")}>{t("2 YENİ ÖN")}</button>
            <button disabled={tyreInfo.available < 2}
              onClick={() => quickTyre(0, "rears")}>{t("2 YENİ ARKA")}</button>
            <button disabled={tyreInfo.available < 2}
              onClick={() => quickTyre(0, "lefts")}>{t("2 YENİ SOL")}</button>
            <button disabled={tyreInfo.available < 2}
              onClick={() => quickTyre(0, "rights")}>{t("2 YENİ SAĞ")}</button>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4,
              marginLeft: 4, paddingLeft: 8, borderLeft: "1px solid var(--line)" }}>
              <span style={{ fontSize: 10.5, color: "var(--dim)",
                letterSpacing: ".08em" }}>{t("1 YENİ")}</span>
              {TY.map((c, ci) => (
                <button key={c} disabled={tyreInfo.available < 1}
                  title={`${t("Tek yeni lastik")} — ${c}`}
                  onClick={() => quickTyre(0, ["fl", "fr", "rl", "rr"][ci])}>{c}</button>
              ))}
            </span>
            <button onClick={() => quickTyre(0, "clear")}>{t("TEMİZLE")}</button>
          </span>
          {tyreInfo.available <= 0 && (
            <span className="hint warn" style={{ margin: 0 }}>
              {t("⚠ Lastik limiti doldu — yeni lastik seçilemez")}
            </span>
          )}
          {!(st.tyreStints[0] || []).some((v) => String(v).trim()) && (
            <span className="hint warn" style={{ margin: 0 }}>
              {t("⚠ Başlangıç lastiği seçilmedi — önce buradan başla, pit seçimleri buna zincirlenir")}
            </span>
          )}
        </div>
      )}

      <div className="timeline" role="img" aria-label={t("Stint zaman çizelgesi")}>
        {timeline.map((s, i) => (
          <div key={i} className={`seg ${s.cls}`}
            style={{ width: `${s.w}%`, background: s.cls ? undefined : s.bg }}>
            {s.label && s.w > 1.8 && <span>{s.label}</span>}
          </div>
        ))}
        {liveInfo.status === "live" && mode === "race" && (
          <div className="nowline" style={{
            left: `${Math.min(100, (liveInfo.elapsed / liveInfo.raceMs) * 100)}%` }} />
        )}
      </div>

      {(() => {
        /* hava kronolojisi: doğrudan log'dan, yarış süresi üzerinden
           (stint sınırlarından bağımsız → canlı + planlı her geçiş görünür) */
        const log = wxLog(st);
        const total = plan.raceSec || parseHMS(st.raceTime) || 1;
        const cuts = [0, ...log.map((e) => e.t).filter((tt) => tt > 0.5 && tt < total - 0.5),
          total].sort((a, b) => a - b);
        const segs = [];
        for (let i = 0; i < cuts.length - 1; i++) {
          const a = cuts[i], b = cuts[i + 1];
          if (b - a < 0.5) continue;
          segs.push({ w: (b - a) / total * 100, wx: wxAtRel(log, (a + b) / 2) });
        }
        if (!segs.some((x) => x.wx.lap > 1)) return null; // hep dry → çubuk gizli
        return (
          <div className="wxbar" role="img" aria-label={t("Hava zaman çizelgesi")}>
            {segs.map((s2, i) => (
              <div key={i} className={`wseg ${s2.wx.lap > 1 ? "rain" : ""}`}
                style={{ width: `${s2.w}%`, background: s2.wx.col }}
                title={`${t(s2.wx.lbl)} ×${s2.wx.lap.toFixed(2)}`}>
                {s2.w > 6 && <span>{s2.wx.ico}</span>}
              </div>
            ))}
            {liveInfo.status === "live" && mode === "race" && (
              <div className="nowline" style={{
                left: `${Math.min(100, (liveInfo.elapsed / liveInfo.raceMs) * 100)}%` }} />
            )}
          </div>
        );
      })()}

      <div style={{ overflowX: "auto" }}>
      <table data-tour="stinttable" aria-label={t("Stint plan tablosu")}>
        <thead><tr>
          <th>#</th><th>Stint</th><th>{t("Tur")}</th><th>⚡ {t("VE İht.")}</th>
          <th>{t("Ort. Tur")}</th>
          <th>{t("Pit Ayarı")}</th><th>{t("Pilot")}</th><th>Pit</th><th>End Stint</th><th>Time Left</th>
          <th>Override</th>
        </tr></thead>
        <tbody>
          {plan.rows.map((r, i) => (
            <tr key={i} className={[
              r.isLast ? "last" : "",
              liveInfo.status === "live" && mode === "race" && i === liveInfo.stintIdx
                ? (pitSoon ? "live pitsoon" : "live") : "",
            ].join(" ").trim()}>
              <td className="disp" style={{ fontSize: 15 }}>{r.idx}</td>
              <td>{fmtHMS(r.stintSec)}</td>
              <td>{(() => {
                const timeLocked = parseHMS(st.overrides[i] || "") > 0;
                const lapOvr = (Number(st.lapOverrides?.[i]) || 0) > 0;
                if (r.isLast) return r.lapsInStint;
                return (
                  <span className="lapcell">
                    <button className="lapstep" disabled={timeLocked}
                      title={timeLocked ? t("Önce süre override'ı temizle") : t("Tur −1")}
                      onClick={() => bumpLaps(i, r.lapsInStint, -1)}>−</button>
                    <b className={lapOvr ? "lapman" : ""}>{r.lapsInStint}</b>
                    <button className="lapstep" disabled={timeLocked}
                      title={timeLocked ? t("Önce süre override'ı temizle") : t("Tur +1")}
                      onClick={() => bumpLaps(i, r.lapsInStint, 1)}>+</button>
                    {lapOvr && <button className="lapclr" title={t("Otomatiğe dön")}
                      onClick={() => clearLaps(i)}>✕</button>}
                  </span>
                );
              })()}</td>
              <td className={r.fuelNeed > 100 ? "neg" : ""}
                title={`≈ ${(r.fuelNeed * st.fuelRatio).toFixed(1)} L`}>
                {r.fuelNeed.toFixed(1)}%</td>
              <td>
                <input className="ovr" type="text" style={{ width: 78 }}
                  placeholder={st.avgLap || "m:ss.00"}
                  title={r.fixLap > 0
                    ? t("Bu stint girilen tur süresiyle hesaplanıyor — hava çarpanı uygulanmaz")
                    : t("Boş: yarış datasındaki ortalama tur kullanılır")}
                  value={(st.stintLaps || [])[i] || ""}
                  onChange={(e) => upStintLap(i, e.target.value)} />
                {r.fixLap > 0 && (
                  <button className="minibtn" title={t("Otomatiğe dön")}
                    style={{ marginLeft: 4 }}
                    onClick={() => upStintLap(i, "")}>✕</button>
                )}
              </td>
              <td>
                {r.isLast ? <span className="chip">FINISH 🏁</span> : (<>
                  <span className="tyrebox">
                    {TY.map((corner, ti) => {
                      const stv = tyState((st.pits[i] || EMPTY_PIT).tyres[ti]);
                      return (
                        <button key={corner}
                          className={["", "on", "qual", "wet", "used"][stv]}
                          title={[t("Taşı — tıkla: yeni kuru"),
                            t("Yeni kuru — tıkla: Qual'a dön"),
                            t("Qual lastiği — tıkla: wet"),
                            t("Wet (sınırsız) — tıkla: eski kuru"),
                            t("Eski kuru tekrar — tıkla: taşı")][stv]}
                          onClick={() => upTyre(i, ti)}>{corner}</button>
                      );
                    })}
                  </span>
                  <span className="pitopt">
                    <button className={(st.pits[i] || EMPTY_PIT).fuel ? "on" : ""}
                      onClick={() => upPit(i, { fuel: !(st.pits[i] || EMPTY_PIT).fuel })}>FUEL</button>
                  </span>
                </>)}
              </td>
              <td>
                <select className="drvsel" value={st.driverAssign[i] || ""}
                  onChange={(e) => assignDriver(i, e.target.value)}>
                  <option value="">—</option>
                  {(st.roster || []).map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </td>
              <td>{r.isLast ? "—" : (<>
                {fmtHMS(r.pitSec)}
                {r.repairSec > 0 && <span style={{ color: "var(--yellow)",
                  fontSize: 11, marginLeft: 4 }}>🔧+{r.repairSec}s</span>}
              </>)}</td>
              <td>{fmtHMS(r.endSec)}</td>
              <td className={r.timeLeft < 0 ? "neg" : "pos"}>{fmtHMS(r.timeLeft)}</td>
              <td><input className="ovr" type="text" placeholder="h:mm:ss"
                disabled={(Number(st.lapOverrides?.[i]) || 0) > 0}
                title={(Number(st.lapOverrides?.[i]) || 0) > 0
                  ? t("Tur override aktif — önce onu temizle") : undefined}
                value={st.overrides[i] || ""} onChange={(e) => upOvr(i, e.target.value)} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      <div className="hint">
        {t("Pit süresi = FUEL")}({st.fuelTime}s) + LANE({st.pitLaneTime}s) + {t("lastik")}
        {tab === "code80"
          ? ` (1-2: ${(TYRE_2_SEC / 4).toFixed(2)}s · 3-4: ${(TYRE_4_SEC / 4).toFixed(2)}s · Code 80: ÷4)`
          : ` (1-2: ${TYRE_2_SEC}s · 3-4: ${TYRE_4_SEC}s)`}.
        {t("Son stintte pit hesaplanmaz. Override girilirse stint süresi manuel değere kilitlenir.")}{" "}
        {t("Pit'te seçilen lastikler (FL/FR/RL/RR) Lastik sekmesindeki tabloya otomatik işlenir:")}{" "}
        {t("seçilen köşeye sonraki stint için yeni lastik atanır, seçim kaldırılırsa önceki lastikle devam edilir.")}
      </div>
    </div>
  );
}
