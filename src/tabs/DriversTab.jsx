import { useState } from "react";
import { fmtHMS, msToLocalInput } from "../engine";
import { PIE_COLORS } from "../constants";
import { Avatar } from "../components";

/* Ad → baş harf(ler) rozeti (en çok 2). */
function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/* Pilotlar (v2.0 · handoff-spec/ekranlar/07-pilotlar.md). Kadro + sürüş dağılımı
   kartları + donut + stint→pilot atama programı. Türetilmiş driverPlan/teamDrivers
   ve handler'lar App'ten prop gelir. */
export default function DriversTab({
  t, st, up, driverPlan, fmtClock, removeDriver,
  teamDrivers, addPoolDriver, assignDriver, teamData, clearAssign,
}) {
  const poolExtra = teamDrivers.filter((n) => !st.roster.includes(n));
  const names = driverPlan ? st.roster.filter((n) => driverPlan.totals[n]) : [];
  /* Renk kararlı kaynaktan (kadro sırası) — names.indexOf(-1)→0 çakışmasını önler. */
  const colorOf = (n) => { const i = (st.roster || []).indexOf(n); return i >= 0 ? PIE_COLORS[i % PIE_COLORS.length] : "var(--rc-text-3)"; };
  const stintsOf = {};
  if (driverPlan) driverPlan.rows.forEach((r, i) => {
    const n = st.driverAssign[i]; if (n && r.dur > 0) (stintsOf[n] = stintsOf[n] || []).push(r.idx);
  });
  const uidByName = {};
  const nmeta = teamData?.names || {};
  Object.keys(nmeta).forEach((uid) => { const nm = nmeta[uid]; if (nm && !(nm in uidByName)) uidByName[nm] = uid; });
  const av = (n, size = 22) => <Avatar uid={uidByName[n] || ""} name={n} photo={teamData?.photos?.[uidByName[n] || ""] || ""} size={size} bg={colorOf(n)} text={initials(n)} />;

  const card = { border: "1px solid var(--rc-border)", borderRadius: 12, background: "var(--rc-surface)" };
  const hdT = { fontFamily: "var(--rc-font-display)", textTransform: "uppercase", letterSpacing: ".08em", fontSize: 14, fontWeight: 700 };
  const dim = { fontSize: 11.5, color: "var(--rc-text-3)" };
  const unassigned = driverPlan ? driverPlan.rows.filter((r, i) => r.dur > 0 && !st.driverAssign[i]).length : 0;

  /* ---- Pilot uygunluğu (🕑) ---- pilotların hangi stintte uygun olmadığını işaretle.
     st.driverUnavail = { [pilotAdı]: { [stintIdx]: true } }. Varsayılan: tüm stintlerde uygun. */
  const [avOpen, setAvOpen] = useState(false);
  const availRoster = ((st.roster && st.roster.length ? st.roster : teamDrivers) || []).filter(Boolean);
  const stintRows = driverPlan ? driverPlan.rows.filter((r) => r.dur > 0) : [];
  const unavail = st.driverUnavail || {};
  const isUnavail = (n, idx) => !!(unavail[n] && unavail[n][idx]);
  const toggleAvail = (n, idx) => {
    const du = { ...(st.driverUnavail || {}) };
    const row = { ...(du[n] || {}) };
    const nowUnavail = !row[idx];         // bu tıkla "uygun değil" mi yapılıyor
    if (row[idx]) delete row[idx]; else row[idx] = true;
    if (Object.keys(row).length) du[n] = row; else delete du[n];
    up({ driverUnavail: du });
    /* Uygunsuz yapıldıysa ve o pilot o stinte ATANMIŞSA atamayı otomatik temizle
       (dropdown boş kalır). Stint idx → plan satır indeksi. */
    if (nowUnavail && driverPlan) {
      const ri = driverPlan.rows.findIndex((r) => r.idx === idx);
      if (ri >= 0 && st.driverAssign[ri] === n) assignDriver(ri, "");
    }
  };
  /* uygun pilot kalmayan stintler (uyarı) */
  const noAvailStints = stintRows.filter((r) => availRoster.length > 0 && availRoster.every((n) => isUnavail(n, r.idx)));

  // donut segmentleri
  const C = 2 * Math.PI * 48;
  let acc = 0;
  const donut = names.map((n) => {
    const frac = driverPlan.grandMs ? driverPlan.totals[n].ms / driverPlan.grandMs : 0;
    const seg = { n, color: colorOf(n), dash: `${(C * frac).toFixed(1)} ${C.toFixed(1)}`, offset: (-C * acc).toFixed(1) };
    acc += frac; return seg;
  });

  return (
    <div style={{ padding: "2px 0 8px", fontFamily: "var(--rc-font-ui)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontFamily: "var(--rc-font-display)", textTransform: "uppercase", letterSpacing: ".06em", fontSize: 22, fontWeight: 700 }}>{t("Pilotlar")}</h2>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, ...dim }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>{t("Yarış")}
            <input type="datetime-local" value={msToLocalInput(st.raceStartMs)} onChange={(e) => { const v = new Date(e.target.value).getTime(); if (!isNaN(v)) up({ raceStartMs: v }); }}
              style={{ background: "var(--rc-surface-3)", border: "1px solid var(--rc-border)", borderRadius: 8, color: "var(--rc-text)", padding: "5px 8px", fontSize: 12, fontFamily: "var(--rc-font-display)" }} /></label>
          <span style={{ color: "var(--rc-border-strong)" }}>→</span>
          <span>{t("Bitiş")} <b style={{ fontFamily: "var(--rc-font-display)", color: "var(--rc-text)" }}>{driverPlan ? fmtClock(driverPlan.finishMs, driverPlan.startMs) : "—"}</b></span>
        </span>
        <button onClick={clearAssign} style={{ marginLeft: "auto", padding: "8px 14px", borderRadius: 9, border: "1px solid var(--rc-danger)", background: "transparent", color: "var(--rc-danger)", cursor: "pointer", fontSize: 12.5 }}>{t("Atamaları temizle")}</button>
      </div>

      {/* Kadro */}
      <div style={{ ...card, padding: "14px 16px", marginBottom: 16 }} data-tour="roster">
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 11 }}>
          <span style={hdT}>{t("Kadro")}</span>
          <span style={dim}>{st.roster.length} {t("pilot")} · {t("takım havuzundan ekleyebilirsin")}</span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {st.roster.map((n) => (
            <span key={n} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 12px 6px 6px", borderRadius: 99, border: `1px solid ${colorOf(n)}55`, background: "var(--rc-surface-3)", fontSize: 12.5, color: "var(--rc-text)" }}>
              {av(n, 22)}{n}
              <button onClick={() => removeDriver(n)} title={t("Kadrodan çıkar")} style={{ background: "none", border: "none", color: "var(--rc-text-3)", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: "0 0 0 2px" }}>×</button>
            </span>
          ))}
          {st.roster.length === 0 && <span style={dim}>{t("Kadro boş — aşağıdan takım üyesi ekle.")}</span>}
        </div>
        {poolExtra.length > 0 ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 11, paddingTop: 11, borderTop: "1px solid var(--rc-line-soft)" }}>
            <span style={{ fontSize: 11, color: "var(--rc-text-3)", textTransform: "uppercase", letterSpacing: ".08em" }}>{t("Takımdan ekle")}</span>
            {poolExtra.map((n) => (
              <button key={n} onClick={() => addPoolDriver(n)}
                style={{ padding: "6px 12px", borderRadius: 99, border: "1px dashed var(--rc-border-strong)", background: "transparent", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 12 }}>＋ {n}</button>
            ))}
          </div>
        ) : st.roster.length > 0 && (
          <div style={{ marginTop: 11, paddingTop: 11, borderTop: "1px solid var(--rc-line-soft)", fontSize: 11, color: "var(--rc-text-3)" }}>{t("Tüm takım üyeleri kadroda. Yeni pilot için takıma üye davet et.")}</div>
        )}
      </div>

      {/* Sürüş dağılımı */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <span style={hdT}>{t("Sürüş dağılımı")}</span>
        {driverPlan && <span style={dim}>{t("planlanan")} {fmtHMS(driverPlan.grandMs / 1000)} · {driverPlan.rows.filter((r) => r.dur > 0).length} stint</span>}
      </div>

      {!driverPlan && <div style={{ padding: "11px 15px", borderRadius: 11, border: "1px solid var(--rc-warn)", background: "rgba(245,178,61,.10)", fontSize: 12.5, color: "var(--rc-warn)" }}>{t("Geçerli bir yarış başlangıç zamanı gir.")}</div>}

      {driverPlan && names.length === 0 && (
        <div style={{ border: "1.5px dashed var(--rc-border-strong)", borderRadius: 14, background: "var(--rc-surface-2)", padding: "44px 24px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="var(--rc-border-strong)" strokeWidth="1.6" strokeLinecap="round"><circle cx="12" cy="12" r="9.3" /><circle cx="12" cy="12" r="2.8" fill="var(--rc-border-strong)" stroke="none" /><path d="M2.9 12h6.3M14.8 12h6.3M12 14.8v6.3" /></svg>
          <div style={{ fontFamily: "var(--rc-font-display)", fontWeight: 700, fontSize: 20 }}>{t("Kadroda pilot yok")}</div>
          <div style={{ fontSize: 12.5, color: "var(--rc-text-3)", lineHeight: 1.7, maxWidth: 400 }}>{t("Takım üyelerini kadroya ekle; stint ataması için en az bir pilot gerekir.")}</div>
        </div>
      )}

      {driverPlan && names.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
          {names.map((n) => {
            const d = driverPlan.totals[n];
            const pct = driverPlan.grandMs ? (d.ms / driverPlan.grandMs) * 100 : 0;
            const col = colorOf(n);
            return (
              <div key={n} style={{ flex: "1 1 260px", minWidth: 240, borderRadius: 12, background: "var(--rc-surface)", padding: "14px 16px", border: "1px solid var(--rc-border)", borderTop: `3px solid ${col}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {av(n, 44)}
                  <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
                    <b style={{ fontFamily: "var(--rc-font-display)", fontSize: 18, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{n}</b>
                    <span style={{ fontSize: 11, color: "var(--rc-text-3)" }}>{teamDrivers.includes(n) ? `🏢 ${t("Takımdan")}` : t("Kadro")}</span>
                  </span>
                  <span style={{ textAlign: "right", flex: "0 0 auto" }}>
                    <span style={{ display: "block", fontFamily: "var(--rc-font-display)", fontSize: 19, fontWeight: 600 }}>{fmtHMS(d.ms / 1000)}</span>
                    <span style={{ display: "block", fontSize: 10, color: "var(--rc-text-3)", textTransform: "uppercase", letterSpacing: ".09em" }}>{t("toplam")}</span>
                  </span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: "var(--rc-line-soft)", overflow: "hidden", marginTop: 12 }}><i style={{ display: "block", height: "100%", width: `${pct}%`, background: col }} /></div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                  <span style={{ fontSize: 11.5, color: "var(--rc-text-3)" }}>🏁 {d.stints} stint</span>
                  <b style={{ marginLeft: "auto", fontFamily: "var(--rc-font-display)", fontSize: 13, color: col }}>%{pct.toFixed(0)}</b>
                </div>
                {(stintsOf[n] || []).length > 0 && (
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 9 }}>
                    {stintsOf[n].map((s) => <span key={s} style={{ fontFamily: "var(--rc-font-display)", fontSize: 10.5, padding: "2px 8px", borderRadius: 6, border: `1px solid ${col}66`, color: col }}>S{s}</span>)}
                  </div>
                )}
              </div>
            );
          })}

          <div style={{ flex: "0 1 300px", minWidth: 260, ...card, padding: "14px 16px", display: "flex", alignItems: "center", gap: 16 }}>
            <svg width="130" height="130" viewBox="0 0 130 130" style={{ flex: "0 0 auto" }}>
              {donut.map((a) => <circle key={a.n} cx="65" cy="65" r="48" fill="none" stroke={a.color} strokeWidth="19" strokeDasharray={a.dash} strokeDashoffset={a.offset} transform="rotate(-90 65 65)" />)}
              <text x="65" y="60" textAnchor="middle" fill="var(--rc-text)" fontFamily="var(--rc-font-display)" fontSize="21" fontWeight="700">{driverPlan.rows.filter((r) => r.dur > 0).length}</text>
              <text x="65" y="76" textAnchor="middle" fill="var(--rc-text-3)" fontSize="9.5" letterSpacing="1.2">STINT</text>
            </svg>
            <div style={{ display: "flex", flexDirection: "column", gap: 7, minWidth: 0, flex: 1 }}>
              {names.map((n) => {
                const pct = driverPlan.grandMs ? (driverPlan.totals[n].ms / driverPlan.grandMs) * 100 : 0;
                return (
                  <span key={n} style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <i style={{ width: 10, height: 10, borderRadius: 3, background: colorOf(n), flex: "0 0 auto" }} />
                    <span style={{ fontSize: 12, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{n}</span>
                    <span style={{ fontFamily: "var(--rc-font-display)", fontSize: 11, color: "var(--rc-text-3)" }}>{pct.toFixed(0)}%</span>
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Stint programı */}
      {driverPlan && (
        <div style={{ ...card, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 16px", borderBottom: "1px solid var(--rc-border)", flexWrap: "wrap" }}>
            <span style={hdT}>{t("Stint programı")}</span>
            <span style={dim}>{t("saatler yarış saatine göre")}</span>
            <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {unassigned > 0 && <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 99, border: "1px solid var(--rc-warn)", color: "var(--rc-warn)", whiteSpace: "nowrap" }}>⚠ {unassigned} {t("stint atanmadı")}</span>}
              <button onClick={() => setAvOpen(true)} style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${noAvailStints.length ? "var(--rc-warn)" : "var(--rc-border)"}`, background: "var(--rc-surface-3)", color: noAvailStints.length ? "var(--rc-warn)" : "var(--rc-text-2)", cursor: "pointer", fontSize: 11.5, whiteSpace: "nowrap" }}>🕑 {t("Uygunluk")}{noAvailStints.length ? ` · ${noAvailStints.length}⚠` : ""}</button>
            </span>
          </div>
          {driverPlan.rows.map((r, i) => {
            const cur = st.driverAssign[i] || "";
            const col = cur ? colorOf(cur) : "var(--rc-text-3)";
            const barPct = Math.min(100, Math.round((r.dur / 1000 / 3600) * 100));
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 16px", borderBottom: "1px solid var(--rc-line-soft)", background: cur ? "transparent" : "rgba(245,178,61,.05)", opacity: r.dur === 0 ? .5 : 1 }}>
                <span style={{ fontFamily: "var(--rc-font-display)", fontWeight: 700, fontSize: 17, width: 38, flex: "0 0 auto", color: col }}>S{r.idx}</span>
                <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
                  <span style={{ fontFamily: "var(--rc-font-display)", fontSize: 14 }}>{fmtClock(r.start, driverPlan.startMs)} <span style={{ color: "var(--rc-border-strong)" }}>→</span> {fmtClock(r.finish, driverPlan.startMs)}</span>
                  <span style={{ fontSize: 11, color: "var(--rc-text-3)" }}>{fmtHMS(r.dur / 1000)}{r.laps != null ? ` · ${r.laps} tur` : ""}</span>
                </span>
                <span style={{ display: "block", width: 120, height: 6, borderRadius: 3, background: "var(--rc-line-soft)", overflow: "hidden", flex: "0 0 auto" }}><i style={{ display: "block", height: "100%", width: `${barPct}%`, background: cur ? col : "var(--rc-border-strong)" }} /></span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flex: "0 0 auto" }}>
                  {cur && isUnavail(cur, r.idx) && <span title={t("Bu pilot bu stintte uygun değil")} style={{ color: "var(--rc-danger)", fontSize: 13 }}>⚠</span>}
                  {cur && driverPlan.totals[cur] && av(cur, 20)}
                  <select value={cur} onChange={(e) => assignDriver(i, e.target.value)}
                    style={{ width: 168, padding: "7px 10px", borderRadius: 9, cursor: "pointer", fontSize: 12.5, background: "var(--rc-surface-3)", border: `1px solid ${cur ? col + "66" : "var(--rc-border)"}`, color: cur ? "var(--rc-text)" : "var(--rc-text-3)" }}>
                    <option value="">{t("— pilot seç —")}</option>
                    {st.roster.length > 0 && <optgroup label={t("Kadro")}>{st.roster.map((n) => { const un = isUnavail(n, r.idx); return <option key={n} value={n} disabled={un}>{n}{un ? ` — ${t("uygun değil")}` : ""}</option>; })}</optgroup>}
                    {poolExtra.length > 0 && <optgroup label={teamData?.meta?.name || t("Takım")}>{poolExtra.map((n) => { const un = isUnavail(n, r.idx); return <option key={n} value={n} disabled={un}>{n}{un ? ` — ${t("uygun değil")}` : ""}</option>; })}</optgroup>}
                  </select>
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* ===== Pilot uygunluğu penceresi ===== */}
      {avOpen && (
        <div onClick={() => setAvOpen(false)} role="dialog" aria-modal="true"
          style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(10,6,10,.74)", backdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, animation: "rcfade .18s ease" }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ width: "min(820px,96vw)", maxHeight: "88vh", display: "flex", flexDirection: "column", background: "var(--rc-surface)", border: "1px solid var(--rc-border-strong)", borderRadius: 16, overflow: "hidden", boxShadow: "0 24px 70px rgba(0,0,0,.6)", animation: "rcpop .22s cubic-bezier(.2,.9,.3,1.05)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "15px 20px", borderBottom: "1px solid var(--rc-border)", flexWrap: "wrap" }}>
              <span style={{ fontFamily: "var(--rc-font-display)", textTransform: "uppercase", letterSpacing: ".07em", fontSize: 18, fontWeight: 700 }}>{t("Pilot uygunluğu")}</span>
              <span style={{ fontSize: 12, color: "var(--rc-text-3)" }}>{t("Stinte tıkla · o pilot o saatte uygun değil işaretlenir")}</span>
              <button onClick={() => setAvOpen(false)} style={{ marginLeft: "auto", width: 31, height: 31, borderRadius: 9, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 14, lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ overflow: "auto", padding: "16px 20px 18px" }}>
              {!availRoster.length || !stintRows.length ? (
                <div style={{ color: "var(--rc-text-3)", fontSize: 12.5, lineHeight: 1.7 }}>{!availRoster.length ? t("Önce kadroya pilot ekle.") : t("Plan için önce yarış datalarını gir.")}</div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: `minmax(150px,1.4fr) repeat(${stintRows.length}, minmax(48px,1fr))`, gap: 6, alignItems: "center" }}>
                  <span />
                  {stintRows.map((r) => (
                    <span key={r.idx} style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 2 }}>
                      <b style={{ fontFamily: "var(--rc-font-display)", fontSize: 14, fontWeight: 700 }}>S{r.idx}</b>
                      <span style={{ fontFamily: "var(--rc-font-display)", fontSize: 9.5, color: "var(--rc-text-3)" }}>{fmtClock(r.start, driverPlan.startMs)}</span>
                    </span>
                  ))}
                  {availRoster.map((n) => {
                    const okCount = stintRows.filter((r) => !isUnavail(n, r.idx)).length;
                    return (
                      <span key={n} style={{ display: "contents" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0, paddingRight: 8 }}>
                          {av(n, 22)}
                          <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                            <b style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{n}</b>
                            <span style={{ fontSize: 10.5, color: okCount === 0 ? "var(--rc-danger)" : "var(--rc-text-3)" }}>{okCount}/{stintRows.length} {t("uygun")}</span>
                          </span>
                        </span>
                        {stintRows.map((r) => {
                          const un = isUnavail(n, r.idx);
                          return (
                            <button key={r.idx} onClick={() => toggleAvail(n, r.idx)} title={t("Uygunluk")}
                              style={{ height: 34, borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700,
                                border: `1px solid ${un ? "var(--rc-danger)" : "var(--rc-ok)"}`,
                                background: un ? "rgba(255,77,94,.16)" : "rgba(55,214,122,.20)",
                                color: un ? "var(--rc-danger)" : "var(--rc-ok)" }}>{un ? "✕" : "✓"}</button>
                          );
                        })}
                      </span>
                    );
                  })}
                </div>
              )}
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 14 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11.5, color: "var(--rc-text-2)" }}><i style={{ width: 12, height: 12, borderRadius: 4, background: "rgba(55,214,122,.22)", border: "1px solid var(--rc-ok)", display: "inline-block" }} />{t("Uygun")}</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11.5, color: "var(--rc-text-2)" }}><i style={{ width: 12, height: 12, borderRadius: 4, background: "rgba(255,77,94,.16)", border: "1px solid var(--rc-danger)", display: "inline-block" }} />{t("Uygun değil")}</span>
                <span style={{ fontSize: 11.5, color: "var(--rc-text-3)" }}>{t("Varsayılan tüm stintlerde uygun")}</span>
              </div>
              {noAvailStints.length > 0 && (
                <div style={{ marginTop: 14, display: "flex", alignItems: "flex-start", gap: 9, padding: "11px 14px", borderRadius: 11, border: "1px solid var(--rc-warn)", background: "rgba(245,178,61,.08)", fontSize: 12, color: "var(--rc-warn)", lineHeight: 1.6 }}>
                  <span style={{ flex: "0 0 auto", fontSize: 14 }}>⚠</span>
                  <span><b>{noAvailStints.map((r) => `S${r.idx}`).join(", ")}</b> {t("için hiç uygun pilot kalmadı — bu stint atanamaz.")}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
