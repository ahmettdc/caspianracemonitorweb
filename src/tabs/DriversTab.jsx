import { useState, useEffect, useRef } from "react";
import { fmtHMS } from "../engine";
import { driverColorOf } from "../constants";
import { isAvailable, toggleAvail, buildAvailGrid } from "../avail";
import { Sheet } from "../shell";

/* Ad → baş harf(ler) rozeti (en çok 2). "A. Demircan" → "AD", "Savaş" → "SA". */
function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/* Pilotlar sekmesi — kadro yönetimi + pilot kartları (süre dağılımı) + stint→pilot
   atama programı + Donut. handoff-spec/ekranlar/07-pilotlar.md markup ve renderVals'ı
   birebir: inline stil objeleri (koşullu renk/kenarlık) fişten alınır, renkler
   --rc-* tokenlarına bağlanır. Türetilmiş driverPlan/teamDrivers ve handler'lar
   App'ten prop gelir; native <select> yerine özel açılır seçici AYNI assignDriver'a
   bağlanır. */
export default function DriversTab({
  t, st, up, driverPlan, fmtClock, removeDriver, newDriver, setNewDriver,
  addDriver, teamDrivers, setSt, assignDriver, teamData, clearAssign,
  avail, setAvail, resetAvail, canEdit = true,
}) {
  const [availOpen, setAvailOpen] = useState(false);
  const [drvOpen, setDrvOpen] = useState(null);        // açık stint seçicisinin index'i
  const nameRef = useRef(null);

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

  /* --- fişteki türetilmiş değerler (renderVals) --- */
  const totalSec = driverPlan ? driverPlan.grandMs / 1000 : 0;
  const drvTotalTime = driverPlan ? fmtHMS((driverPlan.finishMs - driverPlan.startMs) / 1000) : "—";
  const stintCount = driverPlan ? driverPlan.rows.length : 0;
  const unassigned = driverPlan ? driverPlan.rows.filter((_, i) => !st.driverAssign[i]).length : 0;

  /* Donut segmentleri — fiş drvDonut: r=48 çevre üzerinde payına göre dash/offset. */
  const donutC = 2 * Math.PI * 48;
  let donutAcc = 0;
  const donutSegs = names.map((n) => {
    const secs = driverPlan.totals[n].ms / 1000;
    const frac = totalSec ? secs / totalSec : 0;
    const seg = {
      color: colorOf(n),
      dash: `${(donutC * frac).toFixed(1)} ${donutC.toFixed(1)}`,
      offset: (-donutC * donutAcc).toFixed(1),
    };
    donutAcc += frac;
    return seg;
  });

  /* Açık seçiciyi dışarı tıklayınca kapat (toggle stopPropagation ile açık kalır). */
  useEffect(() => {
    if (drvOpen === null) return undefined;
    const close = () => setDrvOpen(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [drvOpen]);

  const disp = "var(--rc-font-display)";
  const sectTtl = { fontFamily: disp, textTransform: "uppercase", letterSpacing: ".08em",
    fontSize: 14, fontWeight: 700 };

  return (
    <div style={{ padding: "18px 20px 40px", animation: "rcin .26s ease-out" }}>
      {/* --- başlık --- */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontFamily: disp, textTransform: "uppercase", letterSpacing: ".06em",
          fontSize: 22, fontWeight: 700 }}>{t("Pilotlar")}</h2>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12,
          color: "var(--rc-text-3)" }}>
          <span>{t("Yarış")} <b style={{ fontFamily: disp, color: "var(--rc-text)" }}>
            {driverPlan ? fmtClock(driverPlan.startMs, 0) : "—"}</b></span>
          <span style={{ color: "var(--rc-border-strong)" }}>→</span>
          <span>{t("Bitiş")} <b style={{ fontFamily: disp, color: "var(--rc-text)" }}>
            {driverPlan ? fmtClock(driverPlan.finishMs, driverPlan.startMs) : "—"}</b></span>
        </span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={clearAssign}
            style={{ padding: "8px 14px", borderRadius: 9, border: "1px solid var(--rc-danger)",
              background: "transparent", color: "var(--rc-danger)", cursor: "pointer", fontSize: 12.5 }}>
            {t("Atamaları temizle")}</button>
        </span>
      </div>

      {/* --- Kadro --- */}
      <div data-tour="roster" style={{ border: "1px solid var(--rc-border)", borderRadius: 12,
        background: "var(--rc-surface)", padding: "14px 16px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 11 }}>
          <span style={sectTtl}>{t("Kadro")}</span>
          <span style={{ fontSize: 11.5, color: "var(--rc-text-3)" }}>
            {st.roster.length} {t("pilot · takım havuzundan ekleyebilirsin")}</span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {st.roster.map((n) => (
            <span key={n} style={{ display: "inline-flex", alignItems: "center", gap: 8,
              padding: "6px 12px 6px 6px", borderRadius: 99, border: `1px solid ${colorOf(n)}55`,
              background: "var(--rc-surface-3)", fontSize: 12.5, color: "var(--rc-text)" }}>
              <span style={{ width: 22, height: 22, borderRadius: "50%", background: colorOf(n),
                color: "var(--rc-bg)", display: "inline-flex", alignItems: "center",
                justifyContent: "center", fontWeight: 700, fontSize: 9.5, flex: "0 0 auto" }}>
                {initials(n)}</span>
              {n}
              <button onClick={() => removeDriver(n)} title={t("Kadrodan çıkar")}
                style={{ background: "none", border: "none", color: "var(--rc-text-3)",
                  cursor: "pointer", fontSize: 14, lineHeight: 1, padding: "0 0 0 2px" }}>×</button>
            </span>
          ))}
          <input ref={nameRef} type="text" placeholder={t("Pilot adı ekle…")} value={newDriver}
            onChange={(e) => setNewDriver(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addDriver()}
            style={{ background: "var(--rc-surface-3)", border: "1px solid var(--rc-border)",
              borderRadius: 9, color: "var(--rc-text)", fontSize: 12.5, padding: "8px 12px", width: 170 }} />
        </div>
        {poolExtra.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 11,
            paddingTop: 11, borderTop: "1px solid var(--rc-line-soft)" }}>
            <span style={{ fontSize: 11, color: "var(--rc-text-3)", textTransform: "uppercase",
              letterSpacing: ".08em" }}>{t("Takımdan ekle")}</span>
            {poolExtra.map((n) => (
              <button key={n} onClick={() => setSt((s) => s.roster.includes(n)
                ? s : { ...s, roster: [...s.roster, n] })}
                style={{ padding: "6px 12px", borderRadius: 99, border: "1px dashed var(--rc-border-strong)",
                  background: "transparent", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 12 }}>
                ＋ {n}</button>
            ))}
          </div>
        )}
      </div>

      {/* --- Sürüş dağılımı --- */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <span style={sectTtl}>{t("Sürüş dağılımı")}</span>
        <span style={{ fontSize: 11.5, color: "var(--rc-text-3)" }}>
          {t("planlanan")} {drvTotalTime} · {stintCount} {t("stint")}</span>
      </div>

      {st.roster.length === 0 && (
        <div style={{ border: "1.5px dashed var(--rc-border-strong)", borderRadius: 14,
          background: "var(--rc-surface-2)", padding: "44px 24px", textAlign: "center",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="var(--rc-border-strong)"
            strokeWidth="1.6" strokeLinecap="round">
            <circle cx="12" cy="12" r="9.3" />
            <circle cx="12" cy="12" r="2.8" fill="var(--rc-border-strong)" stroke="none" />
            <path d="M2.9 12h6.3M14.8 12h6.3M12 14.8v6.3" />
          </svg>
          <div style={{ fontFamily: disp, fontWeight: 700, fontSize: 20 }}>{t("Kadroda pilot yok")}</div>
          <div style={{ fontSize: 12.5, color: "var(--rc-text-3)", lineHeight: 1.7, maxWidth: 400 }}>
            {t("Takım üyelerini kadroya ekle ya da yeni üye davet et; stint ataması için en az bir pilot gerekir.")}</div>
          <button onClick={() => nameRef.current?.focus()}
            style={{ marginTop: 4, padding: "9px 18px", borderRadius: 10, border: "1px solid var(--rc-brand-bright)",
              background: "var(--rc-brand)", color: "var(--rc-on-brand)", cursor: "pointer",
              fontSize: 13, fontWeight: 600 }}>{t("＋ Üye davet et")}</button>
        </div>
      )}

      {driverPlan ? (<>
        {/* --- pilot kartları (süre dağılımı) + Donut --- */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
          {names.map((n) => {
            const d = driverPlan.totals[n];
            const pct = driverPlan.grandMs ? Math.round((d.ms / driverPlan.grandMs) * 100) : 0;
            const c = colorOf(n);
            return (
              <div key={n} style={{ flex: "1 1 260px", minWidth: 240, background: "var(--rc-surface)",
                padding: "14px 16px", borderRadius: 12, border: "1px solid var(--rc-border)",
                borderTop: `3px solid ${c}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ width: 44, height: 44, borderRadius: "50%", background: c,
                    color: "var(--rc-bg)", display: "inline-flex", alignItems: "center",
                    justifyContent: "center", fontFamily: disp, fontWeight: 700, fontSize: 16,
                    flex: "0 0 auto" }}>{initials(n)}</span>
                  <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
                    <b style={{ fontFamily: disp, fontSize: 18, fontWeight: 700, whiteSpace: "nowrap",
                      overflow: "hidden", textOverflow: "ellipsis" }}>{n}</b>
                    <span style={{ fontSize: 11, color: "var(--rc-text-3)" }}>
                      {poolExtra.includes(n) ? `🏢 ${t("Takımdan")}` : t("Kadro")}</span>
                  </span>
                  <span style={{ textAlign: "right", flex: "0 0 auto" }}>
                    <span style={{ display: "block", fontFamily: disp, fontSize: 19, fontWeight: 600 }}>
                      {fmtHMS(d.ms / 1000)}</span>
                    <span style={{ display: "block", fontSize: 10, color: "var(--rc-text-3)",
                      textTransform: "uppercase", letterSpacing: ".09em" }}>{t("toplam")}</span>
                  </span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: "var(--rc-line-soft)",
                  overflow: "hidden", marginTop: 12 }}>
                  <i style={{ display: "block", height: "100%", width: `${pct}%`, background: c }} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                  <span style={{ fontSize: 11.5, color: "var(--rc-text-3)" }}>🏁 {d.stints} {t("stint")}</span>
                  <b style={{ marginLeft: "auto", fontFamily: disp, fontSize: 13, color: c }}>%{pct}</b>
                </div>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 9 }}>
                  {(stintsOf[n] || []).map((s) => (
                    <span key={s} style={{ fontFamily: disp, fontSize: 10.5, padding: "2px 8px",
                      borderRadius: 6, border: `1px solid ${c}66`, color: c }}>S{s}</span>
                  ))}
                </div>
              </div>
            );
          })}

          <div style={{ flex: "0 1 300px", minWidth: 260, border: "1px solid var(--rc-border)",
            borderRadius: 12, background: "var(--rc-surface)", padding: "14px 16px", display: "flex",
            alignItems: "center", gap: 16 }}>
            <svg width="130" height="130" viewBox="0 0 130 130" style={{ flex: "0 0 auto" }}>
              {donutSegs.map((a, idx) => (
                <circle key={idx} cx="65" cy="65" r="48" fill="none" stroke={a.color} strokeWidth="19"
                  strokeDasharray={a.dash} strokeDashoffset={a.offset} transform="rotate(-90 65 65)" />
              ))}
              <text x="65" y="60" textAnchor="middle" fill="var(--rc-text)" fontFamily={disp}
                fontSize="21" fontWeight="700">{stintCount}</text>
              <text x="65" y="76" textAnchor="middle" fill="var(--rc-text-3)" fontSize="9.5"
                letterSpacing="1.2">STINT</text>
            </svg>
            <div style={{ display: "flex", flexDirection: "column", gap: 7, minWidth: 0, flex: 1 }}>
              {names.map((n) => {
                const d = driverPlan.totals[n];
                const pct = driverPlan.grandMs ? Math.round((d.ms / driverPlan.grandMs) * 100) : 0;
                return (
                  <span key={n} style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <i style={{ width: 10, height: 10, borderRadius: 3, background: colorOf(n),
                      flex: "0 0 auto" }} />
                    <span style={{ fontSize: 12, flex: 1, minWidth: 0, whiteSpace: "nowrap",
                      overflow: "hidden", textOverflow: "ellipsis" }}>{n}</span>
                    <span style={{ fontFamily: disp, fontSize: 11, color: "var(--rc-text-3)" }}>{pct}%</span>
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {/* --- stint programı: pilot ataması (asıl işlev korunur) --- */}
        <div style={{ border: "1px solid var(--rc-border)", borderRadius: 12,
          background: "var(--rc-surface)", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 16px",
            borderBottom: "1px solid var(--rc-border)", flexWrap: "wrap" }}>
            <span style={sectTtl}>{t("Stint programı")}</span>
            <span style={{ fontSize: 11.5, color: "var(--rc-text-3)" }}>{t("saatler yarış saatine göre")}</span>
            {setAvail && (
              <button onClick={() => setAvailOpen(true)} disabled={!canEdit || !st.roster.length}
                style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--rc-border)",
                  background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer",
                  fontSize: 11.5, whiteSpace: "nowrap" }}>🕑 {t("Uygunluk")}</button>
            )}
            {unassigned > 0 && (
              <span style={{ marginLeft: "auto", fontSize: 11, padding: "3px 10px", borderRadius: 99,
                border: "1px solid var(--rc-warn)", color: "var(--rc-warn)", whiteSpace: "nowrap" }}>
                ⚠ {unassigned} {t("stint atanmadı")}</span>
            )}
          </div>
          {driverPlan.rows.map((r, i) => {
            const cur = st.driverAssign[i] || "";
            const cc = cur ? colorOf(cur) : null;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 16px",
                borderBottom: "1px solid var(--rc-line-soft)",
                background: cur ? "transparent" : "rgba(245,178,61,.05)" }}>
                <span style={{ fontFamily: disp, fontWeight: 700, fontSize: 17, width: 38, flex: "0 0 auto",
                  color: cur ? cc : "var(--rc-text-3)" }}>S{r.idx}</span>
                <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
                  <span style={{ fontFamily: disp, fontSize: 14 }}>
                    {fmtClock(r.start, driverPlan.startMs)}{" "}
                    <span style={{ color: "var(--rc-border-strong)" }}>→</span>{" "}
                    {fmtClock(r.finish, driverPlan.startMs)}</span>
                  <span style={{ fontSize: 11, color: "var(--rc-text-3)" }}>{fmtHMS(r.dur / 1000)}</span>
                </span>
                <span style={{ display: "block", width: 120, height: 6, borderRadius: 3,
                  background: "var(--rc-line-soft)", overflow: "hidden", flex: "0 0 auto" }}>
                  <i style={{ display: "block", height: "100%",
                    width: `${Math.round((r.dur / 1000 / 3600) * 100)}%`,
                    background: cur ? cc : "var(--rc-border-strong)" }} />
                </span>
                <span style={{ position: "relative", display: "flex", gap: 6, alignItems: "center",
                  flex: "0 0 auto" }}>
                  <button onClick={(e) => { e.stopPropagation();
                    setDrvOpen(drvOpen === i ? null : i); }}
                    style={{ display: "inline-flex", alignItems: "center", gap: 8, width: 178,
                      padding: "7px 11px 7px 8px", borderRadius: 9, cursor: "pointer", fontSize: 12.5,
                      background: "var(--rc-surface-3)",
                      border: `1px solid ${drvOpen === i ? "var(--rc-brand-bright)"
                        : cur ? cc + "66" : "var(--rc-border)"}` }}>
                    <span style={cur ? { width: 20, height: 20, borderRadius: "50%", flex: "0 0 auto",
                      background: cc, color: "var(--rc-bg)", display: "inline-flex", alignItems: "center",
                      justifyContent: "center", fontWeight: 700, fontSize: 9 } : { display: "none" }}>
                      {cur ? initials(cur) : ""}</span>
                    <span style={{ flex: 1, minWidth: 0, textAlign: "left", whiteSpace: "nowrap",
                      color: cur ? "var(--rc-text)" : "var(--rc-text-3)" }}>{cur || t("— pilot seç —")}</span>
                    <span style={{ color: "var(--rc-text-3)", fontSize: 11,
                      transform: drvOpen === i ? "rotate(180deg)" : "none",
                      transition: "transform .15s ease" }}>▾</span>
                  </button>
                  <button onClick={() => assignDriver(i, "")}
                    style={cur ? { display: "inline-flex", alignItems: "center", justifyContent: "center",
                      width: 30, height: 30, borderRadius: 8, cursor: "pointer", fontSize: 12, flex: "0 0 auto",
                      border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)",
                      color: "var(--rc-text-3)" } : { display: "none" }}>✕</button>
                  <span onClick={(e) => e.stopPropagation()}
                    style={drvOpen === i ? { position: "absolute", right: 36, zIndex: 30, minWidth: 200,
                      ...(i >= driverPlan.rows.length - 2
                        ? { bottom: "calc(100% + 6px)" }
                        : { top: "calc(100% + 6px)" }),
                      display: "flex", flexDirection: "column", gap: 2, padding: 6, borderRadius: 11,
                      border: "1px solid var(--rc-border-strong)", background: "var(--rc-surface-2)",
                      boxShadow: "0 14px 38px rgba(0,0,0,.55)", animation: "rcpop .16s ease-out" }
                      : { display: "none" }}>
                    {st.roster.map((n) => {
                      const on = cur === n;
                      const off = !isAvailable(avail, n, i);
                      return (
                        <button key={n}
                          onClick={() => { if (off) return; assignDriver(i, n); setDrvOpen(null); }}
                          style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px",
                            borderRadius: 8, cursor: off ? "not-allowed" : "pointer", fontSize: 12.5,
                            width: "100%", border: "1px solid transparent",
                            background: on ? `${colorOf(n)}22` : "transparent",
                            color: off ? "var(--rc-border-mute)" : on ? "var(--rc-text)" : "var(--rc-text-2)",
                            opacity: off ? 0.5 : 1, textDecoration: off ? "line-through" : "none" }}>
                          <span style={{ width: 22, height: 22, borderRadius: "50%", flex: "0 0 auto",
                            background: off ? "var(--rc-border)" : colorOf(n),
                            color: off ? "var(--rc-border-mute)" : "var(--rc-bg)", display: "inline-flex",
                            alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 9.5 }}>
                            {initials(n)}</span>
                          <span style={{ flex: 1, minWidth: 0, textAlign: "left", whiteSpace: "nowrap",
                            overflow: "hidden", textOverflow: "ellipsis" }}>
                            {off ? `${n} · ${t("uygun değil")}` : n}</span>
                          <span style={on ? { color: colorOf(n), fontSize: 12, flex: "0 0 auto" }
                            : { display: "none" }}>✓</span>
                        </button>
                      );
                    })}
                  </span>
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
                          <span style={{ width: 20, height: 20, borderRadius: "50%", flex: "0 0 auto",
                            background: colorOf(row.name), color: "var(--rc-bg)", display: "inline-flex",
                            alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 9 }}>
                            {initials(row.name)}</span>
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
      </>) : (
        <div style={{ fontSize: 12.5, color: "var(--rc-warn)", border: "1px solid var(--rc-warn)",
          borderRadius: 10, padding: "12px 14px", background: "rgba(245,178,61,.05)" }}>
          ⚠ {t("Geçerli bir yarış başlangıç zamanı gir.")}</div>
      )}
    </div>
  );
}
