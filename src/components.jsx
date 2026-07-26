/* Sunum komponentleri — durum tutmayan görsel parçalar.
   App.jsx içe aktarır. */
import { useState, useEffect, Fragment } from "react";
import { ASSET, quantile } from "./constants";
import { fmtHMS, lastStintFuel } from "./engine";

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

export function Tyre({ size = 16 }) {
  return (
    <img src={`${ASSET}tyre.png`} alt="" aria-hidden="true"
      style={{ height: size, width: "auto", verticalAlign: "-2px", flexShrink: 0 }}
      onError={(e) => { e.currentTarget.style.display = "none"; }} />
  );
}
