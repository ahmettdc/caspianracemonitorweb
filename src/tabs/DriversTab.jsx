import { fmtHMS, msToLocalInput } from "../engine";
import { PIE_COLORS } from "../constants";
import { Donut } from "../components";

/* Pilotlar sekmesi — kadro yönetimi + stint→pilot atama + süre dağılımı (Donut).
   Türetilmiş driverPlan/teamDrivers ve tüm handler'lar App'ten prop gelir. */
export default function DriversTab({
  t, st, up, driverPlan, fmtClock, removeDriver, newDriver, setNewDriver,
  addDriver, teamDrivers, setSt, assignDriver, teamData, clearAssign,
}) {
  return (
    <div className="card">
      <h2>Pilotlar</h2>
      <div className="row2" style={{ maxWidth: 420 }}>
        <div>
          <label>{t("Yarış Başlangıcı")}</label>
          <input type="datetime-local" value={msToLocalInput(st.raceStartMs)}
            onChange={(e) => { const t2 = new Date(e.target.value).getTime();
              if (!isNaN(t2)) up({ raceStartMs: t2 }); }} />
        </div>
        <div>
          <label>{t("Yarış Bitişi")}</label>
          <div className="mono" style={{ padding: "6px 0" }}>
            {driverPlan ? fmtClock(driverPlan.finishMs, driverPlan.startMs) : "—"}
          </div>
        </div>
      </div>

      <label data-tour="roster">{t("Pilot Kadrosu")}</label>
      <div style={{ marginBottom: 4 }}>
        {st.roster.map((n) => (
          <span className="rchip" key={n}>{n}
            <b onClick={() => removeDriver(n)} title={t("Kadrodan çıkar")}>×</b></span>
        ))}
        {st.roster.length === 0 &&
          <span className="hint">{t("Henüz pilot yok — aşağıdan ekle.")}</span>}
      </div>
      <div style={{ display: "flex", gap: 8, maxWidth: 340, marginBottom: 8 }}>
        <input type="text" placeholder={t("Pilot adı")} value={newDriver}
          onChange={(e) => setNewDriver(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addDriver()} />
        <button className="act" onClick={addDriver}>{t("Ekle")}</button>
      </div>
      {teamDrivers.filter((n) => !st.roster.includes(n)).length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <span className="hint" style={{ marginRight: 6 }}>
            {t("Takımdan ekle")}:</span>
          {teamDrivers.filter((n) => !st.roster.includes(n)).map((n) => (
            <button key={n} className="act" style={{ marginRight: 6, marginTop: 4 }}
              onClick={() => setSt((s) => s.roster.includes(n)
                ? s : { ...s, roster: [...s.roster, n] })}>+ {n}</button>
          ))}
        </div>
      )}

      {driverPlan && (<>
        <table>
          <thead><tr>
            <th>#</th><th>Start</th><th>Finish</th><th>{t("Süre")}</th><th>{t("Pilot")}</th>
          </tr></thead>
          <tbody>
            {driverPlan.rows.map((r, i) => (
              <tr key={i} style={r.dur === 0 ? { opacity: .45 } : {}}>
                <td className="disp" style={{ fontSize: 15 }}>{r.idx}</td>
                <td>{fmtClock(r.start, driverPlan.startMs)}</td>
                <td>{fmtClock(r.finish, driverPlan.startMs)}</td>
                <td>{fmtHMS(r.dur / 1000)}</td>
                <td>
                  <select value={st.driverAssign[i] || ""}
                    onChange={(e) => assignDriver(i, e.target.value)}>
                    <option value="">{t("— seç —")}</option>
                    {st.roster.length > 0 && (
                      <optgroup label={t("Kadro")}>
                        {st.roster.map((n) =>
                          <option key={n} value={n}>{n}</option>)}
                      </optgroup>
                    )}
                    {teamDrivers.filter((n) => !st.roster.includes(n)).length > 0 && (
                      <optgroup label={teamData?.meta?.name || t("Takım")}>
                        {teamDrivers.filter((n) => !st.roster.includes(n)).map((n) =>
                          <option key={n} value={n}>{n}</option>)}
                      </optgroup>
                    )}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {Object.keys(driverPlan.totals).length > 0 && (() => {
          const names = st.roster.filter((n) => driverPlan.totals[n]);
          const colorOf = (n) => PIE_COLORS[names.indexOf(n) % PIE_COLORS.length];
          const pieData = names.map((n) => ({
            name: n, value: driverPlan.totals[n].ms, color: colorOf(n),
          }));
          return (
          <div style={{ display: "flex", gap: 22, marginTop: 16, flexWrap: "wrap",
            alignItems: "center" }}>
            <Donut data={pieData} />
            <table style={{ maxWidth: 480, flex: "1 1 340px", margin: 0 }}>
              <thead><tr><th></th><th>{t("Pilot")}</th><th>Stint</th>
                <th>{t("Toplam Süre")}</th><th>%</th></tr></thead>
              <tbody>
                {names.map((n) => {
                  const d = driverPlan.totals[n];
                  return (
                    <tr key={n}>
                      <td style={{ width: 18, padding: "0 0 0 6px" }}>
                        <span style={{ display: "inline-block", width: 12, height: 12,
                          borderRadius: 3, background: colorOf(n) }} /></td>
                      <td>{n}</td><td>{d.stints}</td>
                      <td>{fmtHMS(d.ms / 1000)}</td>
                      <td className="pos">
                        {driverPlan.grandMs ? ((d.ms / driverPlan.grandMs) * 100).toFixed(1) : "0"}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          );
        })()}
        <div style={{ marginTop: 12 }}>
          <button className="act danger" onClick={clearAssign}>{t("Atamaları Temizle")}</button>
        </div>
        <div className="hint">{t("Start/Finish zamanları stint planından otomatik zincirlenir (pit süreleri dahil). Yarış bitişini aşan kısım süreye sayılmaz; tamamen yarış dışı kalan stintler soluk görünür.")}</div>
      </>)}
      {!driverPlan && <div className="hint warn">{t("Geçerli bir yarış başlangıç zamanı gir.")}</div>}
    </div>
  );
}
