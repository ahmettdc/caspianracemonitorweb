import { fmtHMS, msToLocalInput } from "../engine";
import { PIE_COLORS, driverColorOf } from "../constants";
import { Donut, Avatar } from "../components";
import { useState } from "react";
import { isAvailable, toggleAvail, availableDrivers, stintsWithoutDriver,
  buildAvailGrid } from "../avail";
import { Sheet } from "../shell";

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
  avail, setAvail, resetAvail, canEdit = true,
}) {
  const [availOpen, setAvailOpen] = useState(false);
  const poolExtra = teamDrivers.filter((n) => !st.roster.includes(n));
  /* süre-dağılımı adları (Donut ile AYNI) + renk + atanan stint numaraları */
  const names = driverPlan ? st.roster.filter((n) => driverPlan.totals[n]) : [];
  const colorOf = (n) => driverColorOf(names, n);
  const stintsOf = {};
  if (driverPlan) {
    driverPlan.rows.forEach((r, i) => {
      const n = st.driverAssign[i];
      if (n && r.dur > 0) (stintsOf[n] = stintsOf[n] || []).push(r.idx);
    });
  }
  /* ad → uid köprüsü: teamData.names (uid→ad) tersine çevrilir. Takım üyesi olan
     pilotlarda uid bulunur → Avatar yüklenen/Google avatarını gösterir; elle
     yazılan pilotlarda uid yok → colorOf+initials dolu rozeti (mevcut görünüm). */
  const uidByName = {};
  const nmeta = teamData?.names || {};
  Object.keys(nmeta).forEach((uid) => {
    const nm = nmeta[uid];
    if (nm && !(nm in uidByName)) uidByName[nm] = uid;
  });
  /* not: JSX bileşeni olarak DEĞİL, düz fonksiyon olarak çağrılır ({av(n,20)})
     — böylece stabil (modül kapsamlı) Avatar yeniden mount olmaz, avatar
     getirme effect'i her render'da tekrar çalışmaz (titreme olmaz). */
  const av = (n, size = 22) => {
    const uid = uidByName[n] || "";
    return (
      <Avatar uid={uid} name={n} photo={teamData?.photos?.[uid] || ""}
        size={size} bg={colorOf(n)} text={initials(n)} />
    );
  };

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
            {driverPlan && driverPlan.totals[n] && av(n, 20)}{n}
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
                      {av(n, 42)}
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
        <div className="drvcap drvcaprow">
          {t("Stint programı")}
          <span className="spacer" />
          {setAvail && (
            <button className="rbbtn" onClick={() => setAvailOpen(true)}
              disabled={!canEdit || !st.roster.length}>🕑 {t("Uygunluk")}</button>
          )}
        </div>
        {(() => {
          const bad = stintsWithoutDriver(avail, st.roster, driverPlan.rows.length);
          return bad.length && st.roster.length ? (
            <div className="hint warn">
              ⚠ {t("Bu stint için uygun pilot kalmadı")}: {bad.map((i) => `S${i + 1}`).join(", ")}
            </div>
          ) : null;
        })()}
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
                  {cur && driverPlan.totals[cur] && av(cur, 20)}
                  {/* Uygun değil işaretlenen pilot bu stintte SOLUK, ÜSTÜ ÇİZİLİ ve
                      seçilemez (README §8). */}
                  <select value={cur} onChange={(e) => assignDriver(i, e.target.value)}>
                    <option value="">{t("— seç —")}</option>
                    {st.roster.length > 0 && (
                      <optgroup label={t("Kadro")}>
                        {st.roster.map((n) => (
                          <option key={n} value={n} disabled={!isAvailable(avail, n, i)}
                            className={isAvailable(avail, n, i) ? "" : "unavail"}>
                            {isAvailable(avail, n, i) ? n : `${n} · ${t("uygun değil")}`}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {poolExtra.length > 0 && (
                      <optgroup label={teamData?.meta?.name || t("Takım")}>
                        {poolExtra.map((n) => (
                          <option key={n} value={n} disabled={!isAvailable(avail, n, i)}>
                            {isAvailable(avail, n, i) ? n : `${n} · ${t("uygun değil")}`}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  {!availableDrivers(avail, st.roster, i).length && st.roster.length > 0 && (
                    <span className="availwarn" title={t("⚠ Bu stint için uygun pilot kalmadı")}>⚠</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>

        {/* --- Uygunluk penceresi (v2.0 · README §8) ---
            Izgara varsayılan olarak TÜM hücreler uygun (yeşil ✓); tıklayınca
            kırmızı ✕. Kalıcılık yarış başına Firebase'de:
            teams/{tid}/races/{rid}/avail/{driverId} = [stintNo…] */}
        {availOpen && setAvail && (
          <Sheet onClose={() => setAvailOpen(false)} width="min(880px,96vw)"
            title={<>🕑 {t("Pilot uygunluğu")}</>}>
            <div className="availhint">
              {t("Stinte tıkla · o pilot o saatte uygun değil işaretlenir")}
            </div>
            <div className="availwrap">
              <table className="availgrid">
                <thead><tr>
                  <th className="l">{t("Pilot")}</th>
                  {driverPlan.rows.map((r, i) => (
                    <th key={i} title={fmtClock(r.start, driverPlan.startMs)}>
                      S{r.idx}<span className="tm">{fmtClock(r.start, driverPlan.startMs)}</span>
                    </th>
                  ))}
                </tr></thead>
                <tbody>
                  {buildAvailGrid(avail, st.roster, driverPlan.rows.length).map((row) => (
                    <tr key={row.name}>
                      <td className="l">
                        <span className="availnm">
                          {av(row.name, 20)}
                          <b>{row.name}</b>
                          <span className="fsub">{row.offCount
                            ? `${row.offCount} ${t("stint uygun değil")}`
                            : t("Varsayılan tüm stintlerde uygun")}</span>
                        </span>
                      </td>
                      {row.cells.map((c) => (
                        <td key={c.stint}>
                          <button className={`availcell${c.ok ? " ok" : " no"}`}
                            disabled={!canEdit} title={t("Uygunluk")}
                            aria-pressed={!c.ok}
                            onClick={() => setAvail(toggleAvail(avail, row.name, c.stint))}>
                            {c.ok ? "✓" : "✕"}</button>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="availfoot">
              <span className="lg"><i className="ok" />{t("uygun")}</span>
              <span className="lg"><i className="no" />{t("uygun değil")}</span>
              <span className="fsub">
                {t("Uygun değil işaretlenen pilot o stinte atanamaz")}</span>
              <span className="spacer" />
              {resetAvail && (
                <button className="rbbtn" onClick={resetAvail} disabled={!canEdit}>
                  {t("Tümünü sıfırla")}</button>
              )}
              <button className="rbbtn" onClick={() => setAvailOpen(false)}>
                {t("Kapat")}</button>
            </div>
          </Sheet>
        )}

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
