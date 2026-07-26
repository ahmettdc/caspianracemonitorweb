/* Sunum komponentleri — durum tutmayan görsel parçalar.
   App.jsx içe aktarır. */
import { useState, useEffect, Fragment } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ResponsiveContainer } from "recharts";
import {
  ASSET, AV, quantile, PIE_COLORS, SLOT_COLORS, TRACKS, trackFlag, TRACK_ASSET,
  PIT_LANE_TIMES, CAR_CLASSES, CARS, trackName, carImg, carName,
} from "./constants";
import { fmtHMS, fmtLap, WX, lastStintFuel, msToLocalInput } from "./engine";

/* Sohbet paneli — mesaj listesi + giriş çubuğu. Genel/takım/yarış kanalları
   için ortak (App.jsx'te iki yerde kullanılıyordu). Tüm veri prop ile gelir. */
export function ChatPanel({
  msgs, h, t, lang, user, teamData, fmtClock, canManage,
  chatText, setChatText, onSend, onDelete, endRef,
}) {
  return (
    <div className="chatwrap" style={h ? { height: h } : undefined}>
      <div className="chatlist">
        {!msgs.length && (
          <div className="hint" style={{ margin: "auto", textAlign: "center" }}>
            {t("Henüz mesaj yok — ilk yazan sen ol.")}</div>
        )}
        {msgs.map((m, i) => {
          const me = m.uid === user?.uid;
          const prev = msgs[i - 1];
          const newDay = !prev || new Date(prev.at || 0).toDateString()
            !== new Date(m.at || 0).toDateString();
          return (
            <Fragment key={m.id}>
              {newDay && <div className="chatday">
                {new Date(m.at || 0).toLocaleDateString(lang === "en" ? "en-GB" : "tr-TR",
                  { day: "2-digit", month: "long" })}</div>}
              <div className={`cmsg ${me ? "me" : ""}`}>
                <div className="who">
                  {!me && <b>{teamData?.names?.[m.uid] || m.name || t("isimsiz")}</b>}
                  <span>{fmtClock(m.at || 0)}</span>
                  {(me || canManage) && (
                    <button className="del" title={t("Sil")}
                      onClick={() => onDelete(m.id)}>✕</button>
                  )}
                </div>
                <div className="bub">{m.text}</div>
              </div>
            </Fragment>
          );
        })}
        <div ref={endRef} />
      </div>
      <div className="chatbar">
        <input type="text" value={chatText} maxLength={500}
          placeholder={t("Mesaj yaz…")}
          onChange={(e) => setChatText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); }
          }} />
        <button className="gbtn ubtn" disabled={!chatText.trim()}
          style={{ opacity: chatText.trim() ? 1 : .45 }}
          onClick={onSend}>{t("Gönder")}</button>
      </div>
    </div>
  );
}

export function TourOverlay({ steps, onClose, lang }) {
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState(null);
  /* act'li adımlar hedefi render eder (sekme açar) — DOM'da olmasa da tutulur */
  const live = steps.filter((st2) => !st2.sel || st2.act || document.querySelector(st2.sel));
  const step = live[idx];

  useEffect(() => {
    if (!step) return undefined;
    if (step.act) step.act();                       // sekmeyi aç
    let el = null;
    const measure = () => {
      el = step.sel ? document.querySelector(step.sel) : null;
      if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
      if (!el) { setRect(null); return; }
      const r = el.getBoundingClientRect();
      setRect({ x: r.left - 8, y: r.top - 8, w: r.width + 16, h: r.height + 16 });
    };
    const t0 = setTimeout(measure, 340);            // sekme + scroll otursun
    const t1 = setTimeout(measure, 800);            // sidebar animasyonu bitince tekrar
    const remeasure = () => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      setRect({ x: r.left - 8, y: r.top - 8, w: r.width + 16, h: r.height + 16 });
    };
    window.addEventListener("resize", remeasure);
    window.addEventListener("scroll", remeasure, true);
    return () => { clearTimeout(t0); clearTimeout(t1);
      window.removeEventListener("resize", remeasure);
      window.removeEventListener("scroll", remeasure, true); };
  }, [idx, step]);

  useEffect(() => {
    const k = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" || e.key === "Enter") setIdx((i) => Math.min(i + 1, live.length - 1));
      if (e.key === "ArrowLeft") setIdx((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [live.length, onClose]);

  if (!step) { onClose(); return null; }
  const last = idx === live.length - 1;
  const vw = window.innerWidth, vh = window.innerHeight;
  /* balon konumu: hedefin altına; sığmazsa üstüne; hedef yoksa ortaya */
  const CW = Math.min(360, vw - 24);
  let cx = vw / 2 - CW / 2, cy = vh / 2 - 90;
  if (rect) {
    cx = Math.max(12, Math.min(rect.x + rect.w / 2 - CW / 2, vw - CW - 12));
    cy = rect.y + rect.h + 14;
    if (cy > vh - 190) cy = Math.max(12, rect.y - 178);
  }
  return (
    <div className="tourwrap" onClick={onClose}>
      {rect && <div className="tourhole" style={{
        left: rect.x, top: rect.y, width: rect.w, height: rect.h }} />}
      {!rect && <div className="tourdim" />}
      <div className="tourcard" style={{ left: cx, top: cy, width: CW }}
        onClick={(e) => e.stopPropagation()}>
        <div className="tourstep">{idx + 1} / {live.length}</div>
        <h3>{step.title}</h3>
        <p>{step.body}</p>
        <div className="tourbtns">
          <button className="histbtn" onClick={onClose}>
            {lang === "en" ? "Skip" : "Geç"}</button>
          <span style={{ flex: 1 }} />
          {idx > 0 && <button className="histbtn"
            onClick={() => setIdx(idx - 1)}>←</button>}
          <button className="gbtn ubtn"
            onClick={() => (last ? onClose() : setIdx(idx + 1))}>
            {last ? (lang === "en" ? "Done ✓" : "Bitti ✓")
              : (lang === "en" ? "Next →" : "İleri →")}</button>
        </div>
      </div>
    </div>
  );
}

export function Wheel({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      style={{ verticalAlign: -2 }} aria-hidden="true">
      <circle cx="12" cy="12" r="9.3" />
      <circle cx="12" cy="12" r="2.8" fill="currentColor" stroke="none" />
      <path d="M2.9 12h6.3M14.8 12h6.3M12 14.8v6.3" />
    </svg>
  );
}

/* Rozetler — driver ikonu <Wheel/> JSX içerdiği için bu modülde (App + App JSX ortak). */
export const BADGES = {
  admin:    { lbl: "Admin",            ico: "🛡", col: "#E11D2E", bg: "rgba(225,29,46,.14)" },
  owner:    { lbl: "Takım Sahibi",     ico: "👑", col: "#C9A227", bg: "rgba(201,162,39,.14)" },
  driver:   { lbl: "Sürücü",           ico: <Wheel />, col: "#26C6DA", bg: "rgba(38,198,218,.14)" },
  engineer: { lbl: "Yarış Mühendisi",  ico: "🎧", col: "#F2C94C", bg: "rgba(242,201,76,.14)" },
};
export const teamBadgesOf = (team, uid, udocLocal) => {
  const out = [];
  if (udocLocal?.admin) out.push(BADGES.admin);
  if (team?.members?.[uid] === "owner") out.push(BADGES.owner);
  const b = team?.badges?.[uid];
  const ids = typeof b === "string" ? [b] : Object.keys(b || {}).filter((k) => b[k]);
  ids.forEach((id) => { if (BADGES[id] && !out.includes(BADGES[id])) out.push(BADGES[id]); });
  return out;
};
export const hasBadge = (team, uid, id) => {
  const b = team?.badges?.[uid];
  return typeof b === "string" ? b === id : !!b?.[id];
};

export function Num({ v, onC, step = 0.01, w }) {
  return <input type="number" step={step} value={v} style={w ? { width: w } : {}}
    onChange={(e) => onC(parseFloat(e.target.value) || 0)} />;
}

export function Donut({ data, size = 190, thickness = 34 }) {
  const total = data.reduce((a, d) => a + d.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="rgba(255,255,255,.06)" strokeWidth={thickness} />
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        {data.map((d, i) => {
          const dash = (d.value / total) * c;
          const el = (
            <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none"
              stroke={d.color} strokeWidth={thickness}
              strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={-acc}>
              <title>{`${d.name}: ${((d.value / total) * 100).toFixed(1)}%`}</title>
            </circle>
          );
          acc += dash;
          return el;
        })}
      </g>
      <text x="50%" y="47%" textAnchor="middle" fill="var(--txt)"
        style={{ fontFamily: "'Barlow Condensed'", fontSize: 30, fontWeight: 700 }}>
        {data.length}</text>
      <text x="50%" y="60%" textAnchor="middle" fill="var(--dim)"
        style={{ fontFamily: "'Barlow Condensed'", fontSize: 12, letterSpacing: ".1em" }}>
        PİLOT</text>
    </svg>
  );
}

export function BoxPlot({ series, fmt, height = 300 }) {
  const stats = series.map((s) => {
    const v = [...s.values].sort((a, b) => a - b);
    if (!v.length) return null;
    const q1 = quantile(v, 0.25), med = quantile(v, 0.5), q3 = quantile(v, 0.75);
    const iqr = q3 - q1;
    const inl = v.filter((x) => x >= q1 - 1.5 * iqr && x <= q3 + 1.5 * iqr);
    return {
      ...s, q1, med, q3,
      lo: inl.length ? inl[0] : v[0],
      hi: inl.length ? inl[inl.length - 1] : v[v.length - 1],
      out: v.filter((x) => x < q1 - 1.5 * iqr || x > q3 + 1.5 * iqr),
      n: v.length,
    };
  }).filter(Boolean);
  if (!stats.length) return null;

  const W = 760, H = height, padL = 78, padR = 18, padT = 18, padB = 40;
  const all = stats.flatMap((s) => [s.lo, s.hi, ...s.out]);
  let min = Math.min(...all), max = Math.max(...all);
  const pad = Math.max((max - min) * 0.12, 400);
  min -= pad; max += pad;
  const y = (v) => padT + (H - padT - padB) * (1 - (v - min) / (max - min));
  const band = (W - padL - padR) / stats.length;
  const bw = Math.min(78, band * 0.44);
  const ticks = Array.from({ length: 5 }, (_, i) => min + ((max - min) * i) / 4);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}
      style={{ overflow: "visible" }} role="img">
      {ticks.map((tv, i) => (
        <g key={i}>
          <line x1={padL} x2={W - padR} y1={y(tv)} y2={y(tv)}
            stroke="#2B3542" strokeDasharray="3 3" />
          <text x={padL - 8} y={y(tv) + 4} textAnchor="end"
            fill="#8C97A5" fontSize="11" fontFamily="IBM Plex Mono">{fmt(tv)}</text>
        </g>
      ))}
      {stats.map((s, i) => {
        const cx = padL + band * (i + 0.5);
        const lx = cx - bw / 2 - 7;
        const lbl = (v, key) => (
          <text key={key} x={lx} y={y(v) + 3.5} textAnchor="end" fill={s.color}
            fontSize="10.5" fontFamily="IBM Plex Mono">{fmt(v)}</text>
        );
        return (
          <g key={s.key}>
            <line x1={cx} x2={cx} y1={y(s.hi)} y2={y(s.q3)} stroke={s.color} strokeWidth="1.5" />
            <line x1={cx} x2={cx} y1={y(s.q1)} y2={y(s.lo)} stroke={s.color} strokeWidth="1.5" />
            <line x1={cx - 13} x2={cx + 13} y1={y(s.hi)} y2={y(s.hi)} stroke={s.color} strokeWidth="1.5" />
            <line x1={cx - 13} x2={cx + 13} y1={y(s.lo)} y2={y(s.lo)} stroke={s.color} strokeWidth="1.5" />
            <rect x={cx - bw / 2} y={y(s.q3)} width={bw} height={Math.max(2, y(s.q1) - y(s.q3))}
              fill={s.color} fillOpacity="0.22" stroke={s.color} strokeWidth="1.5" rx="2" />
            <line x1={cx - bw / 2} x2={cx + bw / 2} y1={y(s.med)} y2={y(s.med)}
              stroke={s.color} strokeWidth="2.5" />
            {s.out.map((o, oi) => (
              <circle key={oi} cx={cx} cy={y(o)} r="2.6" fill="none"
                stroke={s.color} strokeWidth="1.2" strokeOpacity="0.75" />
            ))}
            {[[s.hi, "hi"], [s.q3, "q3"], [s.med, "md"], [s.q1, "q1"], [s.lo, "lo"]]
              .map(([v, k]) => lbl(v, k))}
            <text x={cx} y={H - padB + 20} textAnchor="middle" fill={s.color}
              fontSize="12" fontWeight="700">{s.label}</text>
            <text x={cx} y={H - padB + 34} textAnchor="middle" fill="#8C97A5" fontSize="10">
              n={s.n}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function Bolt({ size = 16, color = "var(--green)" }) {
  return (
    <svg width={size} height={size * 46 / 48} viewBox="0 0 48 46" fill="none"
      style={{ verticalAlign: "-2px", flexShrink: 0 }} aria-hidden="true">
      <path fill={color} d="M25.946 44.938c-.664.845-2.021.375-2.021-.698V33.937a2.26 2.26 0 0 0-2.262-2.262H10.287c-.92 0-1.456-1.04-.92-1.788l7.48-10.471c1.07-1.497 0-3.578-1.842-3.578H1.237c-.92 0-1.456-1.04-.92-1.788L10.013.474c.214-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.471c-1.07 1.498 0 3.579 1.842 3.579h11.377c.943 0 1.473 1.088.89 1.83L25.947 44.94z" />
    </svg>
  );
}

/* Son Stint Yakıtı sekmesi — kalan süreye göre VE/yakıt ihtiyacı.
   Türetilmiş değerler (lsf, planLastCd, racePlan) ve up/autoCd App'ten prop gelir. */
export function FuelTab({ t, st, up, lsf, autoCd, setAutoCd, planLastCd, racePlan }) {
  return (
    <div className="row2" data-tour="fuelcalc"
      style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr" }}>
      {[
        [t("YARIŞ SONU"), st.lastStintCountdown, (v) => up({ lastStintCountdown: v }), lsf, true],
        /* [t("CODE 80 SONU"), ...] — şimdilik gizli, kod korunuyor (lsf80) */
      ].map(([title, val, setVal, r, canAuto]) => {
        const isAuto = canAuto && autoCd;
        const eff = isAuto ? fmtHMS(planLastCd) : val;
        const rr = isAuto ? lastStintFuel(eff, st, racePlan.flagExtra) : r;
        return ([title, eff, setVal, rr, isAuto, canAuto]);
      }).map(([title, val, setVal, r, isAuto, canAuto]) => (
        <div className={`card ${title.includes("CODE 80") ? "c80" : ""}`} key={title}>
          <h2>⛽ {t("Son Stint Yakıtı")} · {title}</h2>
          <label>{t("Session Countdown (h:mm:ss)")}{" "}
            {canAuto && (
              <button className={autoCd ? "chip" : ""}
                style={{ marginLeft: 6, padding: "2px 8px", borderRadius: 6, fontSize: 10,
                  border: "1px solid var(--line)", cursor: "pointer",
                  background: autoCd ? "var(--car)" : "var(--panel2)",
                  color: autoCd ? "#FFE9ED" : "var(--dim)" }}
                title={t("Stint planından otomatik — sondan önceki stintin Time Left değeri")}
                onClick={() => setAutoCd(!autoCd)}>{t("📋 PLAN")}</button>
            )}
          </label>
          <input type="text" value={val} readOnly={isAuto}
            style={isAuto ? { opacity: .7 } : undefined}
            onChange={(e) => setVal(e.target.value)} />
          <div className="kpis" style={{ marginTop: 12 }}>
            <div className="kpi"><div className="v mono">{r.lapsLeft}</div>
              <div className="l">{t("Kalan Tur")} <span style={{ color: "var(--dim)" }}>({r.lapsRaw.toFixed(2)})</span></div></div>
          </div>
          <div className="fuelbig" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Bolt size={30} />{r.refuel.toFixed(1)}%
            <span style={{ fontSize: 18, color: "var(--dim)" }}>
              (+{st.extraLap} {t("lap")})</span></div>
          <div className="hint">
            ≈ <b className="mono" style={{ color: "var(--green)" }}>{r.refuelL.toFixed(1)} L</b> {t("gerçek yakıt")} ·
            ({t("kalan tur")} {r.lapsLeft} + extra {st.extraLap}) × {st.consumption} {t("%/tur")}
            {r.refuel > 100 &&
              <> · <b className="warn">{t("⚠ %100'ü aşıyor — depo yetmez!")}</b></>}
          </div>
        </div>
      ))}
    </div>
  );
}

/* Lastik Stratejisi sekmesi — köşe bazlı lastik atama, limit takibi, hızlı atama.
   Türetilmiş tyreInfo/racePlan ve handler'lar (upTyreCell/quickTyre/carriedAt/
   clearTyres) App'ten prop gelir. */
export function TyreTab({
  t, st, up, tyreInfo, racePlan, carriedAt, upTyreCell, quickTyre,
  qsel, setQsel, QSEL_LBL, clearTyres,
}) {
  return (
    <div className="card" data-tour="tyrecard">
      <h2>{t("Lastik Stratejisi")}</h2>
      <div className="kpis">
        <div className="kpi">
          <label style={{ margin: 0 }}>{t("Lastik Limiti (adet)")}</label>
          <Num v={st.tyreLimit} step={1} onC={(v) => up({ tyreLimit: v })} />
        </div>
        <div className="kpi"><div className="v">{tyreInfo.used}</div>
          <div className="l">{t("Kullanılan Lastik")}</div></div>
        <div className="kpi"><div className="v"
          style={{ color: tyreInfo.available < 0 ? "var(--red)" : "var(--green)" }}>
          {tyreInfo.available}</div>
          <div className="l">{t("Kalan Lastik")}</div></div>
        <div className="kpi"><div className="v">{racePlan.fullStints}</div>
          <div className="l">{t("Stint Sayısı")}</div></div>
      </div>
      <div className="hint" style={{ marginTop: 2 }}>
        {t("Kullanılan kuru lastik no")}: {tyreInfo.usedList.length
          ? tyreInfo.usedList.join(", ") : "—"}
        {" "}<b>({tyreInfo.used}/{st.tyreLimit})</b>
        {tyreInfo.wetUsed > 0 && <> · 🌧 {t("wet (limitsiz)")}: {tyreInfo.wetUsed}</>}
      </div>
      <table>
        <thead><tr><th>Stint</th><th>FL</th><th>FR</th><th>RL</th><th>RR</th><th>{t("Hızlı Atama")}</th></tr></thead>
        <tbody>
          {tyreInfo.rows.map((r) => (
            <tr key={r.label}>
              <td className="disp" style={{ fontSize: 14 }}>{r.label}</td>
              {r.vals.map((v, ci) => {
                const empty = !String(v).trim();
                const carried = r.row >= 0 && empty ? carriedAt(r.row, ci) : "";
                return (
                <td key={ci} className={`${tyreInfo.cellCls(v)} ${carried ? "tcarry" : ""}`}>
                  <select className="tsel" value={String(v)}
                    onChange={(e) => upTyreCell(r.row, ci, e.target.value)}>
                    <option value="">{carried ? `⟳ ${carried}` : "—"}</option>
                    <option value="W" style={{ background: "#0C3A1F", color: "#7FE3A0" }}>
                      🌧 W</option>
                    {Array.from({ length: Math.max(0, st.tyreLimit) }, (_, n) => {
                      const k = String(n + 1);
                      const cur = String(v).trim() === k;
                      if (!cur && !tyreInfo.allowedIn(k, ci)) return null; // köşe kilidi
                      const c = tyreInfo.counts[k] || 0;
                      const cls = tyreInfo.cellCls(k);
                      const OPT = {
                        t2:   { bg: "#8A6E1A", fg: "#FFE9A8", dot: "🟡" },
                        tq:   { bg: "#2B4A8F", fg: "#CFE0FF", dot: "🔵" },
                        t3:   { bg: "#8A5A1A", fg: "#FFDCA8", dot: "🟠" },
                        t4:   { bg: "#7A2020", fg: "#FFC9C0", dot: "🔴" },
                        terr: { bg: "#7A2A20", fg: "#FFC9C0", dot: "⚠️" },
                      }[cls];
                      return <option key={k} value={k}
                        style={OPT ? { background: OPT.bg, color: OPT.fg } : {}}>
                        {OPT ? `${OPT.dot} ` : ""}{k}{c > 0 ? ` · ${c}x` : ""}
                      </option>;
                    })}
                  </select>
                </td>
                );
              })}
              <td>
                {r.row >= 0 && (<span style={{ display: "inline-flex",
                  alignItems: "center", gap: 6 }}>
                  <select className="tsel" style={{ width: 118, textAlign: "left" }}
                    value="" onChange={(e) => {
                      if (e.target.value) {
                        quickTyre(r.row, e.target.value);
                        setQsel((q) => ({ ...q, [r.row]: e.target.value }));
                      }
                    }}>
                    <option value="">{t("— hızlı —")}</option>
                    <option value="new4" disabled={tyreInfo.available < 4}>{t("🆕 4 Yeni")}</option>
                    <option value="wet4">{t("🌧 4 Wet")}</option>
                    <option value="qual4">{t("Qual'a Dön")}</option>
                    <option value="carry">{t("⟳ Öncekiyle Devam")}</option>
                    <option value="fronts" disabled={tyreInfo.available < 2}>{t("Önler Yeni")}</option>
                    <option value="rears" disabled={tyreInfo.available < 2}>{t("Arkalar Yeni")}</option>
                    <option value="lefts" disabled={tyreInfo.available < 2}>{t("Sollar Yeni")}</option>
                    <option value="rights" disabled={tyreInfo.available < 2}>{t("Sağlar Yeni")}</option>
                    <optgroup label={t("Tek lastik")}>
                      {[["fl", "FL"], ["fr", "FR"], ["rl", "RL"], ["rr", "RR"]].map(([v, l]) => (
                        <option key={v} value={v} disabled={tyreInfo.available < 1}>
                          {l} {t("yeni")}</option>
                      ))}
                    </optgroup>
                    <option value="clear">{t("✕ Temizle")}</option>
                  </select>
                  {qsel[r.row] && (
                    <span className="chip" style={{ fontSize: 10, opacity: .85 }}>
                      {t(QSEL_LBL[qsel[r.row]] || qsel[r.row])}</span>
                  )}
                </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="legend">
        <span><i style={{ background: "var(--panel2)" }} />{t("Yeni lastik (1 kez)")}</span>
        <span><i style={{ background: "rgba(242,201,76,.5)" }} />{t("2 kez (duplicate)")}</span>
        <span><i style={{ background: "rgba(102,148,255,.5)" }} />{t("Qual lastiği tekrar")}</span>
        <span><i style={{ background: "rgba(240,96,77,.5)" }} />{t("3 kez")}</span>
        <span><i style={{ background: "#000" }} />{t("4+ kez")}</span>
        <span><i style={{ background: "transparent", border: "1px dashed var(--dim)" }} />
          ⟳ {t("Değişmedi — önceki lastikle devam")}</span>
        <span style={{ marginLeft: 10 }}>
          <i style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3,
            background: "var(--yellow)", marginRight: 4 }} />{t("Yeni kuru")}</span>
        <span style={{ marginLeft: 10 }}>
          <i style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3,
            background: "#4D9FFF", marginRight: 4 }} />{t("Qual'a dönüş")}</span>
        <span style={{ marginLeft: 10 }}>
          <i style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3,
            background: "#7FE3A0", marginRight: 4 }} />{t("Wet — limitten bağımsız, sınırsız")}</span>
        <span style={{ marginLeft: 10 }}>
          <i style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3,
            background: "#0B0D12", border: "1px solid #6B7280", marginRight: 4 }} />{t("Eski kuru tekrar")}</span>
      </div>
      {tyreInfo.conflicts.length > 0 &&
        <div className="hint" style={{ color: "var(--red)" }}>
          {t("⚠ Köşe kuralı ihlali — lastik")} {tyreInfo.conflicts.join(", ")} {t("birden fazla")}{" "}
          {t("köşede kullanılmış. Bir lastik ilk takıldığı köşeye kilitlenir; hatalı hücreyi düzelt.")}
        </div>}
      <div style={{ marginTop: 12 }}>
        <button className="act danger" onClick={clearTyres}>{t("Tümünü Temizle")}</button>
      </div>
      <div className="hint">{t("Her numara TEK bir lastiği temsil eder (set değil) — limit adet bazlıdır. Bir lastik ilk takıldığı köşeye kilitlenir ve diğer köşelerin menülerinden otomatik kalkar. Aynı lastik aynı köşede tekrar kullanılırsa hücre kullanım sayısına göre renklenir. Hızlı Atama ile tek tıkla 4 yeni / öncekiyle devam / kısmi değişim yapabilirsin.")}</div>
    </div>
  );
}

/* Pilotlar sekmesi — kadro yönetimi + stint→pilot atama + süre dağılımı (Donut).
   Türetilmiş driverPlan/teamDrivers ve tüm handler'lar App'ten prop gelir. */
export function DriversTab({
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

/* Dashboard özet sekmesi — araç/pist kartları, yarış/lastik/son-stint KPI'ları,
   stint programı, pilot dağılımı, PDF. Derived (liveInfo/racePlan/tyreInfo/
   planLsf/driverPlan) ve handler'lar (exportPdf/setZoom/carriedAt) App'ten prop gelir. */
export function DashTab({
  t, st, zoom, setZoom, exportPdf, liveInfo, racePlan, tyreInfo,
  planLsf, driverPlan, carriedAt, pitSoon, lmuData,
}) {
  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", margin: "0 0 10px" }}>
        <button onClick={() => exportPdf("stint")}
          style={{ padding: "5px 16px", borderRadius: 6, cursor: "pointer",
            background: "var(--panel2)", color: "var(--txt)",
            border: "1px solid var(--line)", fontSize: 12 }}
            data-tour="pdf">🖨 PDF</button>
      </div>
      <div className="dgrid">
        {st.car && (
          <div className="card infocard clickable" onClick={() => setZoom("car")}
            title={t("Büyütmek için tıkla")}>
            <h2>🏎 {t("Araç")}</h2>
            <img src={carImg(st.carClass, st.car)} alt=""
              style={{ display: "block", width: "100%", maxHeight: 140,
                objectFit: "contain", margin: "8px 0 10px",
                filter: "drop-shadow(0 4px 12px rgba(0,0,0,.5))" }}
              onError={(e) => { e.currentTarget.style.display = "none"; }} />
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
            <img key={st.track} src={`${ASSET}tracks/${TRACK_ASSET(st.track)}.png${AV}`} alt=""
              style={{ display: "block", width: "100%", maxHeight: 160,
                objectFit: "contain", margin: "8px 0 10px",
                filter: "drop-shadow(0 4px 12px rgba(0,0,0,.5))" }}
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
              <div className="hint" style={{ color: WX(st).col, fontWeight: 600 }}>
                {WX(st).ico} {t(WX(st).lbl)} · ×{WX(st).lap.toFixed(2)}
                {(st.weatherLog || []).length > 1 && <> · {st.weatherLog.length} {t("değişim")}</>}</div>
            )}
          </div>
        )}

        {zoom && (
          <div className="lightbox" onClick={() => setZoom(null)}>
            <button className="lbclose" onClick={() => setZoom(null)}>✕</button>
            <img src={zoom === "car"
                ? carImg(st.carClass, st.car)
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

        <div className="card">
          <h2>{t("⏱ Yarış")}</h2>
          <div className="kpis" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div className="kpi"><div className="v mono" style={{ color: "var(--green)" }}>
              {liveInfo.status === "live" ? fmtHMS(liveInfo.remaining / 1000)
                : fmtHMS(racePlan.raceSec)}</div>
              <div className="l">{liveInfo.status === "live" ? "Kalan" : "Yarış Süresi"}</div></div>
            <div className="kpi"><div className="v" style={{ color: "var(--teal)" }}>
              {st.chosen}-{racePlan.laps}</div><div className="l">{t("Strateji")}</div></div>
            <div className="kpi"><div className="v">{racePlan.fullStints}</div>
              <div className="l">Stint</div></div>
            <div className="kpi"><div className="v">{racePlan.totalLaps.toFixed(0)}</div>
              <div className="l">{t("Tahmini Tur")}</div></div>
          </div>
          {liveInfo.status === "live" && (
            <div className="hint">
              {t("Şu an: Stint")} {liveInfo.stintIdx + 1}
              {liveInfo.phase === "pit" ? " " + t("(PIT'te)") : ""} ·{" "}
              {t("sıradaki pit")} <b className={pitSoon ? "pulse" : "mono"}>
                {fmtHMS(liveInfo.nextPitIn / 1000)}</b>
              {liveInfo.driver && <> · 🏎 {liveInfo.driver}</>}
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
                  liveInfo.status === "live" && i === liveInfo.stintIdx ? "live" : "",
                ].join(" ").trim()}>
                  <td>{r.idx}</td>
                  <td>{fmtHMS(r.endSec)}</td>
                  <td className={r.timeLeft < 0 ? "neg" : "pos"}>{fmtHMS(r.timeLeft)}</td>
                  <td>{st.driverAssign[i] || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h2 style={{ display: "flex", alignItems: "center", gap: 7 }}><Tyre size={18} /> {t("Lastik")}</h2>
          <div className="kpis" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div className="kpi"><div className="v">{tyreInfo.used}/{st.tyreLimit}</div>
              <div className="l">{t("Kullanılan Lastik")}</div></div>
            <div className="kpi"><div className="v"
              style={{ color: tyreInfo.available < 0 ? "var(--red)" : "var(--green)" }}>
              {tyreInfo.available}</div><div className="l">{t("Kalan Lastik")}</div></div>
          </div>
          {liveInfo.status === "live" && racePlan.rows[liveInfo.stintIdx + 1] && (
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
          <div className="fuelbig" style={{ fontSize: 40 }}>
            {planLsf.refuel.toFixed(1)}%
            <span style={{ fontSize: 18, color: "var(--dim)", marginLeft: 8 }}>
              (+{st.extraLap} {t("lap")})</span>
          </div>
          <div className="hint">
            ≈ {planLsf.refuelL.toFixed(1)} L · {planLsf.lapsLeft} {t("tur + extra")} {st.extraLap} <span style={{ color: "var(--dim)" }}>({planLsf.lapsRaw.toFixed(2)} {t("gerçek")})</span>
          </div>
          {driverPlan && Object.keys(driverPlan.totals).length > 0 && (<>
            <label style={{ marginTop: 10 }}>{t("Pilot Dağılımı")}</label>
            {st.roster.filter((n) => driverPlan.totals[n]).map((n) => {
              const t = driverPlan.totals[n];
              const pct = driverPlan.grandMs ? (t.ms / driverPlan.grandMs) * 100 : 0;
              return (
                <div key={n} style={{ marginBottom: 4 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span>{n}</span><span className="mono">{pct.toFixed(1)}%</span>
                  </div>
                  <div style={{ height: 5, background: "var(--panel2)", borderRadius: 3 }}>
                    <div style={{ width: `${pct}%`, height: "100%",
                      background: "var(--teal)", borderRadius: 3 }} />
                  </div>
                </div>
              );
            })}
          </>)}
        </div>
      </div>
    </>
  );
}

/* Telemetri sekmesi — MoTeC içe aktarma, sütun eşleme, stint analizi + grafikler.
   Tüm state/derived (parsed/slotStats/chartData/loadedSlots/baseSlot) ve handler'lar
   App'ten prop gelir. fmtMs lokal (fmtLap sarmalayıcı). */
export function TeleTab({
  t, lang, st, slot, setSlot, rawTele, setRawTele, doParse, onTeleFile,
  parsed, mapping, setMapping, saveMotec, saveSlot, loadedSlots, slotStats,
  up, apply105Slot, removeSlot, chartMode, setChartMode, chartData, baseSlot, toggleLap,
}) {
  const fmtMs = (ms) => fmtLap(ms / 1000);
  return (
    <div>
      <div className="card">
        <h2 data-tour="teleimport">{t("Telemetri İçe Aktar (MoTeC)")}</h2>
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          {["A", "B", "C", "D"].map((sl) => (
            <button key={sl} className="act"
              style={slot === sl
                ? { borderColor: SLOT_COLORS[sl], color: SLOT_COLORS[sl], fontWeight: 700 }
                : {}}
              onClick={() => setSlot(sl)}>
              Stint {sl}{st.telemetry[sl] ? " ●" : ""}
            </button>
          ))}
        </div>
        <label>{t("MoTeC tur istatistiklerini yapıştır veya dosya seç (CSV/TSV)")}</label>
        <textarea value={rawTele}
          onChange={(e) => { setRawTele(e.target.value); doParse(e.target.value); }}
          placeholder={"Out Lap\t310127\t-6.403 ...\nLap 1\t237350\t-6.36 ..."}
          style={{ width: "100%", height: 90, background: "var(--panel2)",
            border: "1px solid var(--line)", borderRadius: 6, color: "var(--txt)",
            fontFamily: "IBM Plex Mono", fontSize: 11, padding: 8 }} />
        <div style={{ margin: "6px 0" }}>
          <input type="file" accept=".csv,.tsv,.txt" onChange={onTeleFile} />
        </div>
        {parsed?.error && <div className="hint warn">⚠ {t(parsed.error)}</div>}
        {parsed?.motec && (<>
          <div className="hint" style={{ marginTop: 4 }}>
            <b>{parsed.laps.length}</b> {t("tur çözümlendi")}
            {parsed.meta.venue && <> · {parsed.meta.venue}</>}
            {parsed.meta.vehicle && <> · {parsed.meta.vehicle}</>}
            {parsed.meta.driver && <> · {parsed.meta.driver}</>}
            {parsed.meta.trk != null && <> · {t("Pist")} {parsed.meta.trk.toFixed(0)}°C</>}
            {parsed.meta.amb != null && <> / {t("Hava")} {parsed.meta.amb.toFixed(0)}°C</>}
          </div>
          <div style={{ overflowX: "auto", margin: "8px 0" }}>
            <table style={{ fontSize: 11.5 }}>
              <thead><tr>
                <th>{t("Tur")}</th><th>{t("Süre")}</th><th>{t("Yakıt")}</th>
                <th>VE %</th><th>{t("Aşınma")} FL/FR/RL/RR</th><th>{t("Ort/Max km/h")}</th>
              </tr></thead>
              <tbody>
                {parsed.laps.map((l) => (
                  <tr key={l.lap}>
                    <td>{l.lap}{l.pit ? " 🅿" : ""}
                      {l.partial && <span className="hint" style={{ marginLeft: 4 }}>
                        {t("kısmi")}</span>}</td>
                    <td className="mono">{fmtLap(l.sec)}</td>
                    <td className="mono">{l.fuelL != null ? `${l.fuelL.toFixed(2)} L` : "—"}</td>
                    <td className="mono">{l.fuelL != null && st.fuelRatio > 0
                      ? `${(l.fuelL / st.fuelRatio).toFixed(2)}` : "—"}</td>
                    <td className="mono">{l.w.map((x) =>
                      x == null ? "—" : x.toFixed(1)).join(" / ")}</td>
                    <td className="mono">{l.avgSpd != null
                      ? `${Math.round(l.avgSpd)} / ${Math.round(l.maxSpd)}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {parsed.laps.some((l) => l.partial) && (
            <div className="hint">{t("Kısmi tur: log'da sonraki tur yok, süre örneklerden hesaplandı.")}</div>
          )}
          {!(st.fuelRatio > 0) && (
            <div className="hint warn">{t("VE karşılığı için Yarış·Data'da yakıt oranı girilmeli.")}</div>
          )}
          <button className="act" style={{ borderColor: SLOT_COLORS[slot],
            color: SLOT_COLORS[slot], marginTop: 4 }} onClick={saveMotec}>
            {lang === "en" ? <>Save as Stint {slot}</> : <>Stint {slot} olarak kaydet</>}
          </button>
        </>)}
        {parsed && !parsed.error && !parsed.motec && mapping && (<>
          <div className="hint">
            {parsed.lapRows.length} {t("tur satırı bulundu. Sütun eşleşmesini kontrol et:")}
          </div>
          {mapping.fuelCol >= 0 && (
            <div className="hint" style={{ marginTop: 2 }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 5,
                margin: 0, textTransform: "none", letterSpacing: 0 }}>
                <input type="checkbox" checked={!!mapping.fuelIsLitre}
                  onChange={(e) => setMapping({ ...mapping, fuelIsLitre: e.target.checked })} />
                {t("Yakıt sütunu litre (VE % için orana bölünür)")}
              </label>
              {mapping.fuelIsLitre && !(st.fuelRatio > 0) &&
                <span className="warn" style={{ marginLeft: 8 }}>
                  {t("Yarış·Data'da yakıt oranı girilmeli")}</span>}
            </div>
          )}
          <details style={{ margin: "6px 0" }}>
          <summary style={{ cursor: "pointer", color: "var(--muted)", fontSize: 12 }}>
            {t("Sütun eşleşmesini düzenle")}</summary>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "6px 0" }}>
            {[["Tur Süresi", "timeCol"], ["VE Δ (%)", "fuelCol"]].map(([lbl, key]) => (
              <div key={key}>
                <label style={{ margin: 0 }}>{t(lbl)}</label>
                <select value={mapping[key]}
                  onChange={(e) => setMapping({ ...mapping, [key]: +e.target.value })}>
                  <option value={-1}>—</option>
                  {parsed.headers.map((h, i) =>
                    <option key={i} value={i}>{i}: {h || t("(başlıksız)")}</option>)}
                </select>
              </div>
            ))}
            {["FL", "FR", "RL", "RR"].map((c, ci) => (
              <div key={c}>
                <label style={{ margin: 0 }}>{t("Aşınma")} {c}</label>
                <select value={mapping.wear[ci]}
                  onChange={(e) => {
                    const wear = [...mapping.wear]; wear[ci] = +e.target.value;
                    setMapping({ ...mapping, wear });
                  }}>
                  <option value={-1}>—</option>
                  {parsed.headers.map((h, i) =>
                    <option key={i} value={i}>{i}: {h || t("(başlıksız)")}</option>)}
                </select>
              </div>
            ))}
          </div>
          </details>
          <button className="act" style={{ borderColor: SLOT_COLORS[slot],
            color: SLOT_COLORS[slot] }} onClick={saveSlot}
            disabled={mapping.timeCol < 0}>
            {lang === "en" ? <>Save as Stint {slot}</> : <>Stint {slot} olarak kaydet</>}
          </button>
          {mapping.timeCol < 0 &&
            <span className="hint warn" style={{ marginLeft: 8 }}>{t("Tur süresi sütunu seçilmeli")}</span>}
        </>)}
      </div>

      {loadedSlots.length > 0 && (
        <div className="card" style={{ marginTop: 12 }}>
          <h2>{t("Stint Analizi")}</h2>
          <div className="kpis">
            {loadedSlots.map((sl) => {
              const s = slotStats[sl];
              if (!s || s.empty) return null;
              return (
                <div className="kpi" key={sl} style={{ borderColor: SLOT_COLORS[sl] }}>
                  <div className="v" style={{ color: SLOT_COLORS[sl], fontSize: 19 }}>
                    {fmtMs(s.medMs)}</div>
                  <div className="l">Stint {sl} {t("medyan tur")} · {s.laps} {t("Tur")}</div>
                  <div className="hint" style={{ marginTop: 4 }}>
                    {s.medFuel != null && <>⚡ {s.medFuel.toFixed(2)} %/tur VE
                      {s.tankLaps && <> · %100 ≈ {Math.floor(s.tankLaps)} tur</>}<br /></>}
                    {s.medW.some((w) => w != null) &&
                      <><Tyre size={13} /> {s.medW.map((w) => w == null ? "–" : w.toFixed(1)).join(" / ")} {t("%/tur")}<br /></>}
                    <span style={{ opacity: .7 }}>{t("ort.")} {fmtMs(s.avgMs)}
                      {s.avgFuel != null && <> · {s.avgFuel.toFixed(2)} %/tur</>}<br />
                      {t("en iyi")} {fmtMs(s.bestMs)} · %105 ≤ {fmtMs(s.lim105)}
                      {s.dropped > 0 && <> · {s.dropped} {t("tur hariç")}</>}</span>
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                    <button className="act" style={{ fontSize: 11 }}
                      onClick={() => up({
                        avgLap: fmtMs(s.medMs),
                        ...(s.medFuel != null
                          ? { consumption: +s.medFuel.toFixed(2) } : {}),
                      })}>{t("DATA'ya uygula")}</button>
                    <button className="act" style={{ fontSize: 11, opacity: .75 }}
                      title={t("Ortalamayı uygula")}
                      onClick={() => up({
                        avgLap: fmtMs(s.avgMs),
                        ...(s.avgFuel != null
                          ? { consumption: +s.avgFuel.toFixed(2) } : {}),
                      })}>{t("ort.")}</button>
                    <button className="act" style={{ fontSize: 11, opacity: .75 }}
                      title={t("En iyi turun %105'ini aşan turların tikini kaldır")}
                      onClick={() => apply105Slot(sl)}>%105</button>
                    <button className="act danger" style={{ fontSize: 11 }}
                      onClick={() => removeSlot(sl)}>{t("Sil")}</button>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 6, margin: "4px 0 2px" }}>
            {[["box", "Kutu grafiği"], ["line", "Tur tur"]].map(([m, lbl]) => (
              <button key={m} className="act" style={{ fontSize: 11,
                ...(chartMode === m ? { borderColor: "var(--teal)", color: "var(--teal)" } : {}) }}
                onClick={() => setChartMode(m)}>{t(lbl)}</button>
            ))}
          </div>
          {chartMode === "box" ? (
            <div style={{ margin: "6px 0 2px" }}>
              <BoxPlot height={300} fmt={(v) => fmtLap(v / 1000)}
                series={loadedSlots.map((sl) => ({
                  key: sl, label: `Stint ${sl}`, color: SLOT_COLORS[sl],
                  values: st.telemetry[sl].laps.filter((l) => l.use).map((l) => l.ms),
                })).filter((s) => s.values.length)} />
              <div className="hint">
                {t("Kutu = turların ortadaki %50'si (Q1–Q3), kalın çizgi medyan. Bıyıklar uç turlara, halkalar aykırı turlara işaret eder.")}
              </div>
            </div>
          ) : (
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid stroke="#2B3542" strokeDasharray="3 3" />
                <XAxis dataKey="lap" stroke="#8C97A5" fontSize={11} />
                <YAxis stroke="#8C97A5" fontSize={11} domain={["auto", "auto"]}
                  tickFormatter={(v) => fmtLap(v)} width={70} />
                <Tooltip contentStyle={{ background: "#1F2731", border: "1px solid #2B3542" }}
                  labelFormatter={(l) => `Tur ${l}`}
                  formatter={(v, n) => [fmtLap(v), `Stint ${n}`]} />
                <Legend formatter={(v) => `Stint ${v}`} />
                {loadedSlots.map((sl) => (
                  <Line key={sl} dataKey={sl} stroke={SLOT_COLORS[sl]}
                    dot={false} strokeWidth={2} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          )}

          {loadedSlots.length > 1 && baseSlot && slotStats[baseSlot] && !slotStats[baseSlot].empty && (
            <table style={{ maxWidth: 460, marginTop: 10 }}>
              <thead><tr><th>{t("Karşılaştırma")}</th><th>{t("Ort. Fark")}</th><th>{t("Hızlı Olan")}</th></tr></thead>
              <tbody>
                {loadedSlots.slice(1).map((sl) => {
                  const a = slotStats[baseSlot], b = slotStats[sl];
                  /* karşılaştırma medyan üzerinden */
                  if (!b || b.empty) return null;
                  const d = (a.avgMs - b.avgMs) / 1000; // + ise rakip hızlı
                  return (
                    <tr key={sl}>
                      <td>Stint {baseSlot} vs Stint {sl}</td>
                      <td className={d > 0 ? "neg" : "pos"}>{Math.abs(d).toFixed(3)}s/tur</td>
                      <td style={{ color: SLOT_COLORS[d > 0 ? sl : baseSlot] }}>
                        Stint {d > 0 ? sl : baseSlot}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {loadedSlots.map((sl) => (
            <details key={sl} style={{ marginTop: 10 }}>
              <summary style={{ cursor: "pointer", color: SLOT_COLORS[sl] }}>
                Stint {sl} — {t("tur listesi")} ({st.telemetry[sl].laps.length})</summary>
              <table style={{ maxWidth: 560 }}>
                <thead><tr>
                  <th>{t("Dahil")}</th><th>{t("Tur")}</th><th>{t("Süre")}</th><th>VE %</th><th>FL/FR/RL/RR</th>
                </tr></thead>
                <tbody>
                  {st.telemetry[sl].laps.map((l, li) => (
                    <tr key={li} style={l.use ? {} : { opacity: .4 }}>
                      <td><input type="checkbox" checked={l.use}
                        onChange={() => toggleLap(sl, li)} /></td>
                      <td>{l.label}</td>
                      <td>{fmtMs(l.ms)}</td>
                      <td>{l.fuel != null ? l.fuel.toFixed(2) : "–"}</td>
                      <td>{l.w.map((w) => w == null ? "–" : w.toFixed(1)).join(" / ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          ))}
          <div className="hint">{t("Out lap ve dolum turları (yakıt Δ pozitif) otomatik hariç tutulur — Dahil kutusuyla elle değiştirebilirsin. Ortalamalar sadece dahil turlardan hesaplanır.")}</div>
        </div>
      )}
    </div>
  );
}

/* Setup yükleme formu — pit wall Setup sekmesi + lobi setup penceresi ortak.
   Tüm state ve saveSetup/onSetupFile App'ten prop gelir. */
export function SetupForm({
  t, onSetupFile, suFile, suMeta, setSuMeta, seasons, suErr, suBusy, saveSetup,
}) {
  return (
    <>
      <div className="row2" style={{ maxWidth: 720 }}>
        <div>
          <label>{t("Dosya")}</label>
          <input type="file" onChange={onSetupFile} />
          {suFile && <div className="hint">
            📄 {suFile.name} · {(suFile.size / 1024).toFixed(1)} KB</div>}
        </div>
        <div>
          <label>{t("Pist")} *</label>
          <select value={suMeta.track}
            onChange={(e) => setSuMeta({ ...suMeta, track: e.target.value })}>
            <option value="">—</option>
            {TRACKS.map((tr) =>
              <option key={tr.id} value={tr.id}>{trackFlag(tr.id)} {tr.name}</option>)}
          </select>
        </div>
      </div>
      <div className="row4" style={{ maxWidth: 720 }}>
        <div>
          <label>{t("Koşul")}</label>
          <select value={suMeta.cond}
            onChange={(e) => setSuMeta({ ...suMeta, cond: e.target.value })}>
            <option value="dry">☀️ {t("Kuru")}</option>
            <option value="wet">🌧 Wet</option>
          </select>
        </div>
        <div>
          <label>{t("Seans")}</label>
          <select value={suMeta.sess}
            onChange={(e) => setSuMeta({ ...suMeta, sess: e.target.value })}>
            <option value="R">{t("Yarış")}</option>
            <option value="Q">{t("Sıralama")}</option>
          </select>
        </div>
        <div>
          <label>{t("Sınıf")}</label>
          <select value={suMeta.cls}
            onChange={(e) => setSuMeta({ ...suMeta, cls: e.target.value, car: "" })}>
            <option value="">—</option>
            {CAR_CLASSES.map(([id, lbl]) => <option key={id} value={id}>{lbl}</option>)}
          </select>
        </div>
        <div>
          <label>{t("Araç")}</label>
          <select value={suMeta.car} disabled={!suMeta.cls}
            onChange={(e) => setSuMeta({ ...suMeta, car: e.target.value })}>
            <option value="">—</option>
            {(CARS[suMeta.cls] || []).map((c) =>
              <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>
      <div className="row4" style={{ maxWidth: 720 }}>
        <div>
          <label>{t("Şampiyona")}</label>
          <input type="text" list="su-champs" value={suMeta.champ}
            placeholder={t("örn. ELMS / Official / Online")}
            style={{ textTransform: "none" }}
            onChange={(e) => setSuMeta({ ...suMeta, champ: e.target.value })} />
          <datalist id="su-champs">
            {Object.values(seasons).map((se) =>
              <option key={se.name} value={se.name} />)}
            <option value="Official" /><option value="Online" />
          </datalist>
        </div>
        <div>
          <label>{t("LMU Sürümü")}</label>
          <input type="text" value={suMeta.ver} placeholder="V1.2"
            style={{ textTransform: "none" }}
            onChange={(e) => setSuMeta({ ...suMeta, ver: e.target.value })} />
        </div>
        <div style={{ gridColumn: "span 2" }}>
          <label>{t("Not")}</label>
          <input type="text" value={suMeta.note} maxLength={140}
            placeholder={t("örn. düşük kanat, uzun stint dengesi")}
            style={{ textTransform: "none" }}
            onChange={(e) => setSuMeta({ ...suMeta, note: e.target.value })} />
        </div>
      </div>
      {suErr && <div className="hint warn">⚠ {suErr}</div>}
      <button className="gbtn ubtn" disabled={!suFile || !suMeta.track || suBusy}
        style={{ opacity: suFile && suMeta.track && !suBusy ? 1 : .45, marginTop: 6 }}
        onClick={saveSetup}>
        {suBusy ? t("Yükleniyor…") : t("Yükle")}</button>
      <div className="hint" style={{ marginTop: 6 }}>
        {t("Yüklenen setup tüm takımlara açık ortak havuza gider. Tarih otomatik kaydedilir.")}</div>
    </>
  );
}

/* Ortak setup tablosu — pit wall Setup sekmesi + lobi penceresi ortak.
   onDownload/onDelete App'ten prop gelir (indirme + silme onayı orada). */
export function SetupTable({ rows, t, st, lang, user, isAdmin, onDownload, onDelete }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ fontSize: 12 }}>
        <thead><tr>
          <th>{t("Tarih")}</th><th>{t("Pist")}</th><th>{t("Koşul")}</th>
          <th>{t("Seans")}</th><th>{t("Sınıf")}</th><th>{t("Araç")}</th>
          <th>{t("Şampiyona")}</th><th>{t("Sürüm")}</th>
          <th>{t("Dosya")}</th><th>{t("Takım")}</th><th>{t("Yükleyen")}</th><th></th>
        </tr></thead>
        <tbody>
          {rows.map((su) => (
            <tr key={su.id}
              style={su.track === st.track ? { background: "rgba(150,0,24,.08)" } : undefined}>
              <td className="mono">{new Date(su.at || 0)
                .toLocaleDateString(lang === "en" ? "en-GB" : "tr-TR",
                  { day: "2-digit", month: "2-digit", year: "2-digit" })}</td>
              <td>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  {su.track && <img src={`${ASSET}flags/${TRACK_ASSET(su.track)}.png`}
                    alt="" style={{ width: 18, borderRadius: 2 }}
                    onError={(e) => { e.currentTarget.style.display = "none"; }} />}
                  {trackName(su.track) || su.track || "—"}
                </span>
              </td>
              <td>{su.cond === "wet" ? "🌧 Wet" : `☀️ ${t("Kuru")}`}</td>
              <td>{su.sess === "Q"
                ? <span className="chip" style={{ borderColor: "var(--green)",
                    color: "var(--green)" }}>{t("Sıralama")}</span>
                : <span className="chip" style={{ borderColor: "var(--orange, #F2A33C)",
                    color: "var(--orange, #F2A33C)" }}>{t("Yarış")}</span>}</td>
              <td>{su.cls
                ? <img src={`${ASSET}class/${su.cls}.png`} alt=""
                    title={CAR_CLASSES.find(([id]) => id === su.cls)?.[1] || su.cls}
                    style={{ height: 16, verticalAlign: "-3px" }}
                    onError={(e) => { e.currentTarget.replaceWith(
                      CAR_CLASSES.find(([id]) => id === su.cls)?.[1] || su.cls); }} />
                : "—"}</td>
              <td>{su.car
                ? <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <img src={carImg(su.cls, su.car)} alt=""
                      style={{ height: 22, width: "auto" }}
                      onError={(e) => { e.currentTarget.style.display = "none"; }} />
                    {carName(su.cls, su.car)}
                  </span>
                : "—"}</td>
              <td>{su.champ || "—"}</td>
              <td className="mono">{su.ver || "—"}</td>
              <td title={su.note || ""}>
                <span className="mono" style={{ fontSize: 11 }}>{su.name}</span>
                {su.note && <span className="hint" style={{ display: "block",
                  margin: 0 }}>{su.note}</span>}</td>
              <td>{su.team || "—"}</td>
              <td>{su.uname || "—"}</td>
              <td style={{ whiteSpace: "nowrap" }}>
                <button className="act" style={{ fontSize: 11 }}
                  onClick={() => onDownload(su)}>⬇ {t("İndir")}</button>
                {(su.uid === user?.uid || isAdmin) && (
                  <button className="act danger" style={{ fontSize: 11, marginLeft: 4 }}
                    onClick={() => onDelete(su)}>✕</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Tyre({ size = 16 }) {
  return (
    <img src={`${ASSET}tyre.png`} alt="" aria-hidden="true"
      style={{ height: size, width: "auto", verticalAlign: "-2px", flexShrink: 0 }}
      onError={(e) => { e.currentTarget.style.display = "none"; }} />
  );
}
