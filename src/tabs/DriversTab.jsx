import { fmtHMS, msToLocalInput } from "../engine";
import { PIE_COLORS } from "../constants";
import { Donut } from "../components";

/* Ad → baş harf(ler) rozeti (en çok 2). "A. Demircan" → "AD", "Savaş" → "SA". */
function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/* Pilotlar sekmesi — kadro yönetimi + pilot kartları (süre dağılımı) + stint→pilot atama
   programı + Donut. Türetilmiş driverPlan/teamDrivers ve handler'lar App'ten prop gelir.
   §6 (v1.4.146): düz tablo → kart/görsel hiyerarşi; atama programı korunur. */
export default function DriversTab({
  t, st, up, driverPlan, fmtClock, removeDriver, newDriver, setNewDriver,
  addDriver, teamDrivers, setSt, assignDriver, teamData, clearAssign,
}) {
  const poolExtra = teamDrivers.filter((n) => !st.roster.includes(n));
  /* süre-dağılımı adları (Donut ile AYNI) + renk + atanan stint numaraları */
  const names = driverPlan ? st.roster.filter((n) => driverPlan.totals[n]) : [];
  const colorOf = (n) => PIE_COLORS[names.indexOf(n) % PIE_COLORS.length];
  const stintsOf = {};
  if (driverPlan) {
    driverPlan.rows.forEach((r, i) => {
      const n = st.driverAssign[i];
      if (n && r.dur > 0) (stintsOf[n] = stintsOf[n] || []).push(r.idx);
    });
  }
  const Av = ({ n, size = 22 }) => (
    <span className="drvav" style={{ width: size, height: size,
      fontSize: size * 0.46, background: colorOf(n) }}>{initials(n)}</span>
  );

  return (
    <div className="card">
      <h2>{t("Pilotlar")}</h2>
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
          <span className="rchip" key={n}>
            {driverPlan && driverPlan.totals[n] && <Av n={n} size={20} />}{n}
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
      {poolExtra.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <span className="hint" style={{ marginRight: 6 }}>{t("Takımdan ekle")}:</span>
          {poolExtra.map((n) => (
            <button key={n} className="act" style={{ marginRight: 6, marginTop: 4 }}
              onClick={() => setSt((s) => s.roster.includes(n)
                ? s : { ...s, roster: [...s.roster, n] })}>+ {n}</button>
          ))}
        </div>
      )}

      {driverPlan && (<>
        {/* --- pilot kartları: süre dağılımı (kim ne kadar sürüyor, tek bakışta) --- */}
        {names.length > 0 && (
          <>
            <div className="drvcap">{t("Sürüş dağılımı")}</div>
            <div className="drivers">
              {names.map((n) => {
                const d = driverPlan.totals[n];
                const pct = driverPlan.grandMs ? (d.ms / driverPlan.grandMs) * 100 : 0;
                return (
                  <div className="drv" key={n} style={{ "--c": colorOf(n) }}>
                    <div className="drvtop">
                      <Av n={n} size={42} />
                      <div className="drvwho">
                        <div className="drvnm">{n}</div>
                        <div className="drvteam">
                          {poolExtra.includes(n) ? `🏢 ${t("Takımdan")}` : t("Kadro")}</div>
                      </div>
                      <div className="drvbig">
                        <div className="v">{fmtHMS(d.ms / 1000)}</div>
                        <div className="l">{t("toplam")}</div></div>
                    </div>
                    <div className="drvbar"><i style={{ width: `${pct}%` }} /></div>
                    <div className="drvmeta">
                      <span>🏁 {d.stints} {t("stint")}</span>
                      <span className="pct">%{pct.toFixed(0)}</span></div>
                    {(stintsOf[n] || []).length > 0 && (
                      <div className="drvstints">
                        {stintsOf[n].map((s) => <span className="st" key={s}>S{s}</span>)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* --- stint programı: pilot ataması (asıl işlev korunur) --- */}
        <div className="drvcap">{t("Stint programı")}</div>
        <div className="drvsched">
          {driverPlan.rows.map((r, i) => {
            const cur = st.driverAssign[i] || "";
            return (
              <div className="srow" key={i} style={r.dur === 0 ? { opacity: .5 } : {}}>
                <span className="sno">{r.idx}</span>
                <span className="swin">
                  <b>{fmtClock(r.start, driverPlan.startMs)}</b> → {fmtClock(r.finish, driverPlan.startMs)}
                  {" · "}{fmtHMS(r.dur / 1000)}</span>
                <span className="sasg">
                  {cur && driverPlan.totals[cur] && <Av n={cur} size={20} />}
                  <select value={cur} onChange={(e) => assignDriver(i, e.target.value)}>
                    <option value="">{t("— seç —")}</option>
                    {st.roster.length > 0 && (
                      <optgroup label={t("Kadro")}>
                        {st.roster.map((n) => <option key={n} value={n}>{n}</option>)}
                      </optgroup>
                    )}
                    {poolExtra.length > 0 && (
                      <optgroup label={teamData?.meta?.name || t("Takım")}>
                        {poolExtra.map((n) => <option key={n} value={n}>{n}</option>)}
                      </optgroup>
                    )}
                  </select>
                </span>
              </div>
            );
          })}
        </div>

        {names.length > 0 && (
          <div style={{ display: "flex", gap: 22, marginTop: 16, flexWrap: "wrap",
            alignItems: "center" }}>
            <Donut data={names.map((n) => ({
              name: n, value: driverPlan.totals[n].ms, color: colorOf(n) }))} />
            <div className="drvlegend">
              {names.map((n) => {
                const d = driverPlan.totals[n];
                return (
                  <div className="lrow" key={n}>
                    <span className="dot" style={{ background: colorOf(n) }} />
                    <span className="ln">{n}</span>
                    <span className="ls">{d.stints} · {fmtHMS(d.ms / 1000)}</span>
                    <span className="lp">
                      {driverPlan.grandMs ? ((d.ms / driverPlan.grandMs) * 100).toFixed(1) : "0"}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <div style={{ marginTop: 12 }}>
          <button className="act danger" onClick={clearAssign}>{t("Atamaları Temizle")}</button>
        </div>
      </>)}
      {!driverPlan && <div className="hint warn">{t("Geçerli bir yarış başlangıç zamanı gir.")}</div>}
    </div>
  );
}
