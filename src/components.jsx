/* Sunum komponentleri — durum tutmayan görsel parçalar.
   App.jsx içe aktarır. */
import { useState, useEffect, Fragment } from "react";
import {
  ASSET, quantile, TRACKS, trackFlag, TRACK_ASSET,
  CAR_CLASSES, CARS, trackName, carImg, carName,
  APP_VERSION, REPO_URL,
} from "./constants";
import { CHANGELOG } from "./changelog";

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
        style={{ fontFamily: "'Rajdhani'", fontSize: 30, fontWeight: 700 }}>
        {data.length}</text>
      <text x="50%" y="60%" textAnchor="middle" fill="var(--dim)"
        style={{ fontFamily: "'Rajdhani'", fontSize: 12, letterSpacing: ".1em" }}>
        PİLOT</text>
    </svg>
  );
}

/* Halka gösterge (HUD / Big Board) — value 0..1 dolum, ortada isteğe bağlı
   büyük metin. Rajdhani + tabular; glow ile marka parıltısı. */
export function Ring({ value = 0, size = 76, thickness = 8, color = "var(--teal)",
  track = "var(--panel2)", big, fs, glow = false }) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value || 0));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={thickness} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={thickness}
        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={glow ? { filter: `drop-shadow(0 0 6px ${color})` } : undefined} />
      {big != null && (
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fill={color}
          style={{ fontFamily: "'Rajdhani'", fontWeight: 700, fontSize: fs || size * 0.26,
            fontVariantNumeric: "tabular-nums" }}>{big}</text>
      )}
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

/* Sürüm notları penceresi — CHANGELOG'u listeler. App.jsx'ten çıkarıldı; durum
   tutmaz, tüm veri prop ile gelir. open=false iken null döner. */
export function VersionModal({ open, onClose, t, lang, onStartGuide }) {
  if (!open) return null;
  return (
    <div className="wxmodal" onClick={onClose}>
      <div className="wxmbox" style={{ width: "min(560px,94vw)" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="wxmhead">
          <span>ℹ {t("Neler değişti")}</span>
          <button className="lbclose" onClick={onClose}>✕</button>
        </div>
        <div className="wxmlist" style={{ padding: 0, maxHeight: "62vh" }}>
          {CHANGELOG.map((c) => (
            <div className="clgv" key={c.v}>
              <h4>{c.v}{c.v === APP_VERSION &&
                <span className="cur">{t("ŞU AN")}</span>}</h4>
              <div className="cdate">{c.date}</div>
              <ul>{((lang === "en" ? c.en : c.tr) || c.tr || c.en || []).map((x, i) =>
                <li key={i}>{x}</li>)}</ul>
            </div>
          ))}
        </div>
        <div className="wxmfoot" style={{ justifyContent: "space-between" }}>
          <span style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <a className="hint" href={`${REPO_URL}/commits/main`}
              target="_blank" rel="noreferrer"
              style={{ color: "var(--muted)" }}>{t("GitHub'da tüm değişiklikler ↗")}</a>
            <button className="hint" style={{ background: "none", border: 0,
              color: "var(--teal)", cursor: "pointer", padding: 0,
              textDecoration: "underline" }}
              onClick={onStartGuide}>
              🎓 {t("Rehberi başlat")}</button>
          </span>
          <button className="histbtn" onClick={onClose}>{t("Kapat")}</button>
        </div>
      </div>
    </div>
  );
}
