/* Sunum komponentleri — durum tutmayan görsel parçalar.
   App.jsx içe aktarır. */
import { useState, useEffect, useRef, Fragment } from "react";
import {
  ASSET, quantile, TRACKS, TRACK_ASSET,
  CAR_CLASSES, CARS, trackName, carImg, carName, brandLogo,
  APP_VERSION, REPO_URL, PIE_COLORS,
} from "./constants";
import { msToLocalInput, parseLap, fmtLap } from "./engine";
import { SETUP_LIMITS, poolEmptyReason, lapDeltas } from "./setupPool";
import { trackOptions, classOptions, carOptions } from "./pickerOptions";
import { parseSvm, b64ToText, setupSummary, diffSetups, categorizeSetup,
  duckSetupToParsed } from "./setupParse";
import { renameTeam, syncMyTeamName, createSeason, deleteRace,
  leaveTeam, createTeam, joinTeam, getSetupBlob,
  getUserAvatar, saveTeamAsset, clearTeamAsset } from "./storage";
import { processImageFile, IMG_ACCEPT_TYPES } from "./imageUpload";
import { carAssetKey, teamLogoSrc } from "./teamAssets";
import { extHref } from "./tauriEnv";
import { OFFICIAL_FORMATION_MIN } from "./lmuSchedule";

/* ---- kullanıcı avatarı ----
   Sıra: userAvatars/{uid} (cache'li tek get) → photo prop (Google photoURL) →
   baş harf rozeti (ada göre PIE_COLORS rengi). dataURI kaynakta referrerPolicy
   gerekmez; yalnız http(s) kaynakta no-referrer.
   Opsiyonel bg + text: görsel yoksa dolu daire rozeti (.drvav görünümü) çizer —
   Pilotlar sekmesi baş-harf rozetini (pasta rengiyle) korumak için kullanır. */
export function Avatar({ uid, name = "", photo = "", size = 24, bg = "", text = "" }) {
  const [custom, setCustom] = useState("");
  useEffect(() => {
    let on = true;
    setCustom("");
    if (uid) getUserAvatar(uid).then((v) => { if (on) setCustom(v || ""); });
    return () => { on = false; };
  }, [uid]);
  const src = custom || photo;
  if (src) {
    return (
      <img className="avimg" src={src} alt="" width={size} height={size}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover",
          flex: "0 0 auto" }}
        referrerPolicy={/^https?:/.test(src) ? "no-referrer" : undefined}
        onError={(e) => { e.currentTarget.style.display = "none"; }} />
    );
  }
  const nm = String(name || "").trim();
  /* dolu rozet (bg verildiyse): koyu yazı + tam renk zemin (.drvav stili) */
  if (bg) {
    return (
      <span className="drvav" aria-hidden="true"
        style={{ width: size, height: size, fontSize: Math.round(size * 0.46),
          background: bg }}>
        {text || (nm ? nm.charAt(0).toUpperCase() : "?")}
      </span>
    );
  }
  const initial = text || (nm ? nm.charAt(0).toUpperCase() : "?");
  let h = 0;
  for (let i = 0; i < nm.length; i++) h = (h * 31 + nm.charCodeAt(i)) >>> 0;
  const col = PIE_COLORS[h % PIE_COLORS.length];
  return (
    <span className="avfb" aria-hidden="true"
      style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.44)),
        background: `${col}33`, color: col, borderColor: `${col}66` }}>
      {initial}
    </span>
  );
}

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
                  {!me && <Avatar uid={m.uid}
                    name={teamData?.names?.[m.uid] || m.name} size={18} />}
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
  const nextRef = useRef(null);
  /* Adım listesi BİR KEZ süzülür (mount'ta), her render'da değil.
     Eskiden her render'da document.querySelector ile süzülüyordu: act() sekme
     değiştirince koşullu hedefler (pitboard/pdf/tabs) listeye girip çıkıyor,
     "n / N" sayacı zıplıyor ve idx başka bir adıma denk gelebiliyordu.
     act'li adımlar hedefi kendisi render eder → DOM'da olmasa da tutulur. */
  const [live] = useState(() =>
    steps.filter((st2) => !st2.sel || st2.act || document.querySelector(st2.sel)));
  const safeIdx = Math.min(idx, Math.max(0, live.length - 1));
  const step = live[safeIdx];

  useEffect(() => {
    if (!step) return undefined;
    if (step.act) step.act();                       // sekmeyi aç / demoyu aç
    /* hareket azaltma tercihi: yumuşak kaydırma yerine anında */
    const smooth = !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let el = null;
    const measure = () => {
      el = step.sel ? document.querySelector(step.sel) : null;
      if (el) el.scrollIntoView({ block: "center", behavior: smooth ? "smooth" : "auto" });
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
  }, [safeIdx, step]);

  /* adım değişince "İleri" düğmesine odak → klavye ve ekran okuyucu takip eder */
  useEffect(() => { nextRef.current?.focus(); }, [safeIdx]);

  useEffect(() => {
    const k = (e) => {
      if (e.key === "Escape") onClose();
      /* son adımda İleri/Enter turu BİTİRİR (eskiden clamp'lenip takılıyordu) */
      if (e.key === "ArrowRight" || e.key === "Enter") {
        setIdx((i) => (i >= live.length - 1 ? (onClose(), i) : i + 1));
      }
      if (e.key === "ArrowLeft") setIdx((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [live.length, onClose]);

  /* adım kalmadıysa render sırasında değil, effect'te kapat (React anti-pattern'i giderir) */
  useEffect(() => { if (!step) onClose(); }, [step, onClose]);
  if (!step) return null;
  const last = safeIdx === live.length - 1;
  const vw = window.innerWidth, vh = window.innerHeight;
  /* balon konumu: hedefin altına; sığmazsa üstüne; hedef yoksa ortaya */
  const CW = Math.min(360, vw - 24);
  let cx = vw / 2 - CW / 2, cy = vh / 2 - 90;
  if (rect) {
    cx = Math.max(12, Math.min(rect.x + rect.w / 2 - CW / 2, vw - CW - 12));
    cy = rect.y + rect.h + 14;
    if (cy > vh - 190) cy = Math.max(12, rect.y - 178);
  }
  /* NOT: sarmalayıcıya onClick={onClose} YOK — balon dışına değen tık 20 adımlık
     turu kazara bitiriyordu. Çıkış yalnız Geç / Esc / Bitti ile. */
  return (
    <div className="tourwrap" role="dialog" aria-modal="true" aria-labelledby="tourttl">
      {rect && <div className="tourhole" style={{
        left: rect.x, top: rect.y, width: rect.w, height: rect.h }} />}
      {!rect && <div className="tourdim" />}
      <div className="tourcard" style={{ left: cx, top: cy, width: CW }}>
        <div className="tourstep">{safeIdx + 1} / {live.length}</div>
        <div className="tourbar" aria-hidden="true">
          <i style={{ width: `${((safeIdx + 1) / live.length) * 100}%` }} />
        </div>
        <h3 id="tourttl">{step.title}</h3>
        <p>{step.body}</p>
        <div className="tourbtns">
          <button className="histbtn" onClick={onClose}>
            {lang === "en" ? "Skip" : "Geç"}</button>
          <span style={{ flex: 1 }} />
          {safeIdx > 0 && <button className="histbtn"
            onClick={() => setIdx(safeIdx - 1)}>←</button>}
          <button className="gbtn ubtn" ref={nextRef}
            onClick={() => (last ? onClose() : setIdx(safeIdx + 1))}>
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

/* Tek çizgi-ikon seti (Lucide tabanlı) — currentColor kullanır → tema/renk uyumlu.
   Emoji yerine tutarlı SVG. Header + tab bar burayı kullanır. */
const ICON_PATHS = {
  home:     <><path d="M3 10.6 12 3l9 7.6" /><path d="M5.2 9.4V21h13.6V9.4" /></>,
  building: <><rect x="4" y="3" width="16" height="18" rx="1.4" /><path d="M9 8h1M14 8h1M9 12h1M14 12h1M9 16h2v5" /></>,
  users:    <><circle cx="9" cy="8" r="3.1" /><path d="M3.4 20a5.6 5.6 0 0 1 11.2 0" /><path d="M16.3 5.2a3.1 3.1 0 0 1 0 5.9M18.6 20a5.6 5.6 0 0 0-3.1-5" /></>,
  power:    <><path d="M12 3v9" /><path d="M6.4 6.4a8 8 0 1 0 11.2 0" /></>,
  cap:      <><path d="M12 4 2.5 8.5 12 13l9.5-4.5L12 4Z" /><path d="M6 10.6V15c0 1.5 2.7 2.7 6 2.7s6-1.2 6-2.7v-4.4" /><path d="M21.5 8.6V14" /></>,
  chat:     <path d="M20 4H4a1.5 1.5 0 0 0-1.5 1.5V16A1.5 1.5 0 0 0 4 17.5h3V21l4-3.5h9A1.5 1.5 0 0 0 21.5 16V5.5A1.5 1.5 0 0 0 20 4Z" />,
  chart:    <><path d="M4 4v16h16" /><path d="m7 14 3-3 3 2 4-5" /></>,
  live:     <><path d="M4.6 8a10 10 0 0 1 14.8 0M7.6 11a6 6 0 0 1 8.8 0" /><circle cx="12" cy="15" r="1.7" fill="currentColor" stroke="none" /></>,
  wrench:   <path d="M15.5 4a4.5 4.5 0 0 0-4 6.6L4 18.1 5.9 20l7.5-7.5A4.5 4.5 0 1 0 15.5 4Z" />,
  zap:      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />,
  rows:     <><path d="M4 6h16M4 12h16M4 18h16" /></>,
  sun:      <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  moon:     <path d="M20 14.5A8 8 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5Z" />,
  search:   <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></>,
  /* lastik — çizgi-ikon (tread halkası + jant + 4 diş); sekme çubuğundaki diğer
     ikonlarla aynı stil (Wheel/Icon: strokeWidth 2, currentColor). */
  tyre:     <><circle cx="12" cy="12" r="9.2" /><circle cx="12" cy="12" r="4" /><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6" /></>,
};
export function Icon({ name, size = 16, style }) {
  const p = ICON_PATHS[name];
  if (!p) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ verticalAlign: -2, flex: "0 0 auto", ...style }} aria-hidden="true">
      {p}
    </svg>
  );
}

/* Birleşik buton — variant: primary|ghost|danger|subtle, size: sm|md|lg.
   Eski bespoke sınıfların (adminbtn/histbtn/bigbtn…) yerine kademeli geçiş için;
   className ek sınıf ekler, kalan proplar (onClick/title/data-*) DOM'a geçer. */
export function Btn({ variant = "subtle", size = "md", iconLeft, className = "", children, ...rest }) {
  return (
    <button className={`btn btn--${variant} btn--${size}${className ? " " + className : ""}`} {...rest}>
      {iconLeft && <span className="btn-i" aria-hidden="true">{iconLeft}</span>}
      {children}
    </button>
  );
}

/* Komut paleti (Ctrl+K) — filtrelenebilir aksiyon listesi; ↑/↓/Enter/Esc ile gezinme.
   Harici bağımlılık yok; mevcut wxmodal desenini yeniden kullanır. */
export function CommandPalette({ open, onClose, actions, t }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef(null);
  const ql = q.trim().toLowerCase();
  const filtered = !ql ? actions : actions.filter((a) =>
    a.label.toLowerCase().includes(ql) || (a.keywords || "").toLowerCase().includes(ql));
  useEffect(() => {
    if (open) { setQ(""); setSel(0); const id = setTimeout(() => inputRef.current?.focus(), 20);
      return () => clearTimeout(id); }
  }, [open]);
  useEffect(() => { setSel(0); }, [q]);
  if (!open) return null;
  const run = (a) => { if (!a) return; onClose(); a.run(); };
  const onKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); run(filtered[sel]); }
    else if (e.key === "Escape") { e.preventDefault(); onClose(); }
  };
  return (
    <div className="wxmodal" onClick={onClose}>
      <div className="wxmbox cmdk" onClick={(e) => e.stopPropagation()} onKeyDown={onKey}
        role="dialog" aria-modal="true" aria-label={t("Komut paleti")}>
        <div className="cmdk-in">
          <Icon name="search" size={16} />
          <input ref={inputRef} type="text" value={q} placeholder={`${t("Komut ara")}…`}
            onChange={(e) => setQ(e.target.value)} aria-label={t("Komut ara")} />
        </div>
        <div className="cmdk-list" role="listbox">
          {!filtered.length && (
            <div className="hint" style={{ padding: "12px 14px" }}>{t("Sonuç yok")}</div>)}
          {filtered.map((a, i) => (
            <button key={a.id} role="option" aria-selected={i === sel}
              className={`cmdk-opt ${i === sel ? "on" : ""}`}
              onMouseEnter={() => setSel(i)} onClick={() => run(a)}>
              {a.icon && <span className="cmdk-i" aria-hidden="true">{a.icon}</span>}
              <span className="cmdk-l">{a.label}</span>
              {a.hint && <span className="cmdk-h">{a.hint}</span>}
            </button>
          ))}
        </div>
        <div className="cmdk-foot">
          <span>↑↓ {t("gezin")}</span><span>↵ {t("seç")}</span><span>esc {t("kapat")}</span>
        </div>
      </div>
    </div>
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
        style={{ fontFamily: "var(--font-disp)", fontSize: 30, fontWeight: 700 }}>
        {data.length}</text>
      <text x="50%" y="60%" textAnchor="middle" fill="var(--dim)"
        style={{ fontFamily: "var(--font-disp)", fontSize: 12, letterSpacing: ".1em" }}>
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
          style={{ fontFamily: "var(--font-disp)", fontWeight: 700, fontSize: fs || size * 0.26,
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
/* Logolu açılır liste — native <select> görsel taşıyamadığı için (Setup formu Track/
   Class/Car). Kapalıyken seçili ikon+ad; açılınca fixed-konumlu popup, her satırda logo.
   Kapatma: dış tık (backdrop) · Esc · resize · popup DIŞINDA kaydırma (fixed konum kaymasın;
   popup İÇİ kaydırma korunur). Modal (z1000) üstünde: backdrop z1290 / popup z1300.
   options: [{ value, label, icon }]. icon URL'i yüklenemezse gizlenir, ad kalır. */
export function ImgSelect({ value, options, onChange, placeholder, disabled, t }) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState(null);
  const [up, setUp] = useState(false);      // alta sığmazsa üstte aç
  const btnRef = useRef(null);
  const popRef = useRef(null);
  const cur = options.find((o) => o.value === value) || null;

  useEffect(() => {
    if (!open) return undefined;
    const b = btnRef.current?.getBoundingClientRect();
    if (b) {
      setRect(b);
      setUp(b.bottom + 300 > window.innerHeight && b.top > window.innerHeight - b.bottom);
    }
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    const onScroll = (e) => { if (!popRef.current?.contains(e.target)) setOpen(false); };
    const onResize = () => setOpen(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  const hideImg = (e) => { e.currentTarget.style.display = "none"; };
  const pick = (v) => { onChange(v); setOpen(false); };

  return (
    <>
      <button type="button" className={`imgsel-btn${disabled ? " off" : ""}`}
        aria-haspopup="listbox" aria-expanded={open} disabled={disabled}
        ref={btnRef} onClick={() => !disabled && setOpen((o) => !o)}>
        {cur
          ? <span className="imgsel-cur">
              {cur.icon && <img src={cur.icon} alt="" onError={hideImg} />}
              <span>{cur.label}</span>
            </span>
          : <span className="imgsel-ph">{placeholder || (t ? t("Seç") : "—")}</span>}
        <span className="imgsel-car" aria-hidden="true">▾</span>
      </button>
      {open && (
        <>
          <div className="imgsel-back" onClick={() => setOpen(false)} />
          <div className="imgsel-pop" role="listbox" ref={popRef}
            style={{
              left: rect ? rect.left : 0, width: rect ? rect.width : "auto",
              ...(up
                ? { bottom: rect ? window.innerHeight - rect.top + 4 : 0 }
                : { top: rect ? rect.bottom + 4 : 0 }),
            }}>
            {options.map((o) => (
              <button type="button" key={o.value} role="option"
                aria-selected={o.value === value}
                className={`imgsel-opt${o.value === value ? " on" : ""}`}
                onClick={() => pick(o.value)}>
                {o.icon && <img src={o.icon} alt="" onError={hideImg} />}
                <span>{o.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}

export function SetupForm({
  t, onSetupFile, onSetupDrop, suFile, suMeta, setSuMeta, seasons, suErr, suMsg, suBusy,
  saveSetup,
}) {
  const [dragOn, setDragOn] = useState(false);   // sürükleme vurgusu
  return (
    <div className="suform">
      <div className="suform-2">
        <div>
          <label>{t("Dosya")}</label>
          {/* sürükle-bırak bölgesi — dosya seçici de içinde; .svm bırakılınca
              sınıf/araç dosyadan kendiliğinden algılanır (setupAutofill) */}
          <div className={`sudrop${dragOn ? " on" : ""}`}
            onDragOver={(e) => e.preventDefault()}
            onDragEnter={() => setDragOn(true)}
            onDragLeave={() => setDragOn(false)}
            onDrop={(e) => { setDragOn(false); onSetupDrop?.(e); }}>
            <input type="file" onChange={onSetupFile} />
            <div className="hint" style={{ margin: 0 }}>
              {t("ya da .svm dosyasını buraya sürükle")}</div>
          </div>
          {suFile && <div className="hint">
            📄 {suFile.name} · {(suFile.size / 1024).toFixed(1)} KB</div>}
        </div>
        <div>
          <label>{t("Pist")} *</label>
          <ImgSelect t={t} value={suMeta.track} options={trackOptions()}
            placeholder="—" onChange={(v) => setSuMeta({ ...suMeta, track: v })} />
        </div>
      </div>
      {/* Pist seçilince pist görseli (kullanıcı: "pistte görüntü yok") — pick-ekranı deseni */}
      {suMeta.track && (
        <img key={suMeta.track} src={`${ASSET}tracks/${TRACK_ASSET(suMeta.track)}.png`} alt=""
          style={{ display: "block", margin: "8px 0 4px", maxWidth: "100%", maxHeight: 130,
            borderRadius: 8, filter: "drop-shadow(0 3px 10px rgba(0,0,0,.45))" }}
          onError={(e) => { e.currentTarget.style.display = "none"; }} />
      )}
      <div className="suform-4">
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
          <ImgSelect t={t} value={suMeta.cls} options={classOptions()}
            placeholder="—" onChange={(v) => setSuMeta({ ...suMeta, cls: v, car: "" })} />
        </div>
        <div>
          <label>{t("Araç")}</label>
          <ImgSelect t={t} value={suMeta.car} options={carOptions(suMeta.cls)}
            placeholder="—" disabled={!suMeta.cls}
            onChange={(v) => setSuMeta({ ...suMeta, car: v })} />
        </div>
      </div>
      <div className="suform-4">
        <div>
          <label>{t("Şampiyona")}</label>
          {/* maxLength kaydetmedeki kırpma sözleşmesiyle eşit (setupPool.SETUP_LIMITS)
              — eskiden sınır yoktu, uzun metin kayıtta sessizce kısalıyordu. */}
          <input type="text" list="su-champs" value={suMeta.champ}
            maxLength={SETUP_LIMITS.champ}
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
            maxLength={SETUP_LIMITS.ver}
            style={{ textTransform: "none" }}
            onChange={(e) => setSuMeta({ ...suMeta, ver: e.target.value })} />
        </div>
        <div>
          {/* opsiyonel best-lap — havuzda hangi setup hızlı bir bakışta görünsün */}
          <label>{t("Tur Zamanı")}</label>
          <input type="text" value={suMeta.lap} placeholder="1:58.234"
            maxLength={SETUP_LIMITS.lap} inputMode="decimal"
            style={{ textTransform: "none" }}
            onChange={(e) => setSuMeta({ ...suMeta, lap: e.target.value })} />
        </div>
        <div style={{ gridColumn: "span 2" }}>
          <label>{t("Not")}</label>
          <input type="text" value={suMeta.note} maxLength={SETUP_LIMITS.note}
            placeholder={t("örn. düşük kanat, uzun stint dengesi")}
            style={{ textTransform: "none" }}
            onChange={(e) => setSuMeta({ ...suMeta, note: e.target.value })} />
        </div>
      </div>
      {suErr && <div className="hint warn">⚠ {suErr}</div>}
      {suMsg && <div className="hint" style={{ color: "var(--green)" }}>{suMsg}</div>}
      <button className="gbtn ubtn" disabled={!suFile || !suMeta.track || suBusy}
        style={{ opacity: suFile && suMeta.track && !suBusy ? 1 : .45, marginTop: 6 }}
        onClick={saveSetup}>
        {suBusy ? t("Yükleniyor…") : t("Yükle")}</button>
      <div className="hint" style={{ marginTop: 6 }}>
        {t("Yüklenen setup tüm takımlara açık ortak havuza gider. Tarih otomatik kaydedilir.")}</div>
    </div>
  );
}

/* Ortak setup tablosu — pit wall Setup sekmesi + lobi penceresi ortak.
   onDownload/onDelete App'ten prop gelir (indirme + silme onayı orada). */
/* Kaydın gövdesi (dosyası) var mı? Legacy kayıt data'yı meta içinde taşır; yeni
   kayıtlar (v1.4.93 şema bölme) hasBlob işaretiyle gelir, gövde talep üzerine iner. */
const hasFile = (su) => !!(su?.data || su?.hasBlob);

/* Tur zamanı hücresi/rozeti — tablo ve kart görünümü ortak. En hızlı ⚡ yeşil;
   diğerlerinde grubun en hızlısına fark "+0.6s" soluk ek. */
function LapCell({ su, d, t }) {
  if (!su.lap) return "—";
  const sec = parseLap(su.lap);
  const txt = sec > 0 ? fmtLap(sec) : su.lap;
  if (d?.fastest) return <span className="fastlap" title={t("En hızlı")}>⚡ {txt}</span>;
  return (<>
    {txt}
    {d && d.delta > 0 && <span className="lapdelta"> +{d.delta.toFixed(1)}s</span>}
  </>);
}

/* Koşul + seans tek hücrede (sadeleştirme: 13 → 9 sütun) — kısa çipler, tam ad title'da */
function CondSess({ su, t }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
      <span title={su.cond === "wet" ? "Wet" : t("Kuru")}>{su.cond === "wet" ? "🌧" : "☀️"}</span>
      {su.sess === "Q"
        ? <span className="chip" title={t("Sıralama")} style={{ borderColor: "var(--green)",
            color: "var(--green)" }}>Q</span>
        : <span className="chip" title={t("Yarış")} style={{ borderColor: "var(--orange, #F2A33C)",
            color: "var(--orange, #F2A33C)" }}>R</span>}
    </span>
  );
}

export function SetupTable({ rows, t, st, lang, isAdmin, onDownload, onDelete, onView,
  sort, onSort, cmpSel, onCmpToggle }) {
  const deltas = lapDeltas(rows);   // pist+sınıf başına ⚡ en hızlı + farklar
  /* Tarih/Tur başlıkları tıklanabilir sıralama — ok yönü aktif sıralamayı gösterir */
  const arrow = (k) => (sort?.key === k ? (sort.dir === "asc" ? " ▲" : " ▼") : "");
  const sortTh = (k, lbl) => onSort
    ? <th style={{ cursor: "pointer", whiteSpace: "nowrap" }}
        onClick={() => onSort(k)}>{lbl}{arrow(k)}</th>
    : <th>{lbl}</th>;
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ fontSize: 12 }}>
        <thead><tr>
          {sortTh("date", t("Tarih"))}<th>{t("Pist")}</th><th>{t("Koşul")}</th>
          <th>{t("Sınıf")}</th><th>{t("Araç")}</th>{sortTh("lap", t("Tur"))}
          <th>{t("Dosya")}</th><th>{t("Yükleyen")}</th><th></th>
        </tr></thead>
        <tbody>
          {rows.map((su) => (
            /* satıra tıkla → içerik penceresi (eylem hücresi stopPropagation ile hariç) */
            <tr key={su.id}
              onClick={() => hasFile(su) && onView?.(su)}
              style={{
                ...(su.track === st.track ? { background: "rgba(150,0,24,.08)" } : {}),
                ...(hasFile(su) && onView ? { cursor: "pointer" } : {}),
              }}>
              <td className="setupmono">{new Date(su.at || 0)
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
              <td><CondSess su={su} t={t} /></td>
              {/* İkon yüklenemezse SADECE gizlenir; yanındaki metin yedeği zaten durur. */}
              <td>{su.cls
                ? <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <img src={`${ASSET}class/${su.cls}.png`} alt=""
                      style={{ height: 16, verticalAlign: "-3px" }}
                      onError={(e) => { e.currentTarget.style.display = "none"; }} />
                    {CAR_CLASSES.find(([id]) => id === su.cls)?.[1] || su.cls}
                  </span>
                : "—"}</td>
              <td>{su.car
                ? <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    {/* marka logosu + araç görseli */}
                    {brandLogo(carName(su.cls, su.car)) && (
                      <img src={brandLogo(carName(su.cls, su.car))} alt=""
                        style={{ height: 16, width: "auto" }}
                        onError={(e) => { e.currentTarget.style.display = "none"; }} />
                    )}
                    <img src={carImg(su.cls, su.car)} alt=""
                      style={{ height: 22, width: "auto" }}
                      onError={(e) => { e.currentTarget.style.display = "none"; }} />
                    {carName(su.cls, su.car)}
                  </span>
                : "—"}</td>
              <td className="setupmono" style={{ whiteSpace: "nowrap" }}>
                <LapCell su={su} d={deltas.get(su.id)} t={t} /></td>
              {/* Dosya hücresi: ad + (şampiyona · sürüm) + not — sütun birleştirme */}
              <td title={su.note || ""}>
                <span className="setupmono" style={{ fontSize: 11 }}>{su.name}</span>
                {(su.champ || su.ver) && <span className="hint" style={{ display: "block",
                  margin: 0 }}>{[su.champ, su.ver].filter(Boolean).join(" · ")}</span>}
                {su.note && <span className="hint" style={{ display: "block",
                  margin: 0 }}>{su.note}</span>}</td>
              {/* Yükleyen + takım tek hücrede */}
              <td>
                {su.uname || "—"}
                {su.team && <span className="hint" style={{ display: "block",
                  margin: 0 }}>{su.team}</span>}</td>
              <td style={{ whiteSpace: "nowrap" }} onClick={(e) => e.stopPropagation()}>
                {onCmpToggle && hasFile(su) && (
                  <button className="act" style={{ fontSize: 11, marginRight: 4,
                      ...(cmpSel?.includes(su.id)
                        ? { borderColor: "var(--teal)", color: "var(--teal)" } : {}) }}
                    title={t("Karşılaştırmak için seç (en çok 2)")}
                    onClick={() => onCmpToggle(su)}>⚖</button>
                )}
                {onView && hasFile(su) && (
                  <button className="act" style={{ fontSize: 11, marginRight: 4 }}
                    onClick={() => onView(su)}>🔍 {t("İçerik")}</button>
                )}
                <button className="act" style={{ fontSize: 11 }}
                  onClick={() => onDownload(su)}>⬇ {t("İndir")}</button>
                {/* silme yalnız admin */}
                {isAdmin && (
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

/* Kart görünümü — tabloyla aynı veri/handler'lar, mobil ve göz gezdirme için.
   ⊞/☰ toggle App'te (localStorage rm_setup_view). Karta tıkla → içerik. */
export function SetupCards({ rows, t, st, lang, isAdmin, onDownload, onDelete, onView,
  cmpSel, onCmpToggle }) {
  const deltas = lapDeltas(rows);
  return (
    <div className="sucards">
      {rows.map((su) => (
        <div key={su.id}
          className={`sucard${su.track === st.track ? " here" : ""}`}
          onClick={() => hasFile(su) && onView?.(su)}
          style={hasFile(su) && onView ? { cursor: "pointer" } : undefined}>
          <div className="sucard-img">
            <img src={`${ASSET}tracks/${TRACK_ASSET(su.track)}.png`} alt=""
              onError={(e) => { e.currentTarget.style.display = "none"; }} />
          </div>
          <div className="sucard-row">
            {su.track && <img className="fl" src={`${ASSET}flags/${TRACK_ASSET(su.track)}.png`}
              alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} />}
            <b>{trackName(su.track) || su.track || "—"}</b>
            <span style={{ marginLeft: "auto" }}><CondSess su={su} t={t} /></span>
          </div>
          <div className="sucard-row">
            {su.cls && <img className="cb" src={`${ASSET}class/${su.cls}.png`} alt=""
              onError={(e) => { e.currentTarget.style.display = "none"; }} />}
            {su.car && brandLogo(carName(su.cls, su.car)) && (
              <img className="br" src={brandLogo(carName(su.cls, su.car))} alt=""
                onError={(e) => { e.currentTarget.style.display = "none"; }} />)}
            <span className="nm">{carName(su.cls, su.car) || "—"}</span>
          </div>
          <div className="sucard-lap setupmono">
            <LapCell su={su} d={deltas.get(su.id)} t={t} /></div>
          <div className="sucard-file setupmono">{su.name}</div>
          {(su.champ || su.ver || su.note) && (
            <div className="hint" style={{ margin: 0 }}>
              {[su.champ, su.ver, su.note].filter(Boolean).join(" · ")}</div>
          )}
          <div className="sucard-foot" onClick={(e) => e.stopPropagation()}>
            <span className="hint" style={{ margin: 0 }}>
              {su.uname || "—"} · {new Date(su.at || 0)
                .toLocaleDateString(lang === "en" ? "en-GB" : "tr-TR",
                  { day: "2-digit", month: "2-digit", year: "2-digit" })}</span>
            <span style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
              {onCmpToggle && hasFile(su) && (
                <button className="act" style={{ fontSize: 11,
                    ...(cmpSel?.includes(su.id)
                      ? { borderColor: "var(--teal)", color: "var(--teal)" } : {}) }}
                  title={t("Karşılaştırmak için seç (en çok 2)")}
                  onClick={() => onCmpToggle(su)}>⚖</button>)}
              {onView && hasFile(su) && (
                <button className="act" style={{ fontSize: 11 }}
                  onClick={() => onView(su)}>🔍</button>)}
              <button className="act" style={{ fontSize: 11 }}
                onClick={() => onDownload(su)}>⬇</button>
              {isAdmin && (
                <button className="act danger" style={{ fontSize: 11 }}
                  onClick={() => onDelete(su)}>✕</button>)}
            </span>
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

/* Sürüm notları penceresi — CHANGELOG'u listeler. App.jsx'ten çıkarıldı.
   changelog.js uygulamanın EN BÜYÜK modülü (~190 KB kaynak) ve yalnız bu modalda
   gerekiyor → başlangıç paketine girmesin diye modal AÇILINCA dynamic import ile
   yüklenir, modül-seviyesi cache ile sonraki açılışlar anında. */
let CHANGELOG_CACHE = null;
/* v2.0 katman — handoff-spec/katmanlar/wnOpen.md. İki kolon: solda sürüm listesi
   (süzgeç), sağda notlar (emoji ikon + kart). Renkler var(--rc-*); metin CHANGELOG'tan. */
const WN_ICO = /^(\p{Extended_Pictographic}️?|➕|⚡|🗑|📈|📼|🛰|🏁)\s*/u;
export function VersionModal({ open, onClose, t, lang, onStartGuide }) {
  const [list, setList] = useState(CHANGELOG_CACHE);
  const [wnV, setWnV] = useState(null); // seçili sürüm süzgeci (null = tümü)
  useEffect(() => {
    if (!open || CHANGELOG_CACHE) return undefined;
    let on = true;
    import("./changelog").then((m) => {
      CHANGELOG_CACHE = m.CHANGELOG;
      if (on) setList(m.CHANGELOG);
    });
    return () => { on = false; };
  }, [open]);
  if (!open) return null;
  const all = list || [];
  const CUR = APP_VERSION;
  const newest = all[0]?.v || CUR;
  const notes = all.filter((c) => !wnV || c.v === wnV);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "var(--rc-scrim)",
      backdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, animation: "rcfade .18s ease" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(860px,96vw)", height: "min(680px,86vh)",
        background: "var(--rc-surface)", border: "1px solid var(--rc-border-strong)", borderRadius: 16, overflow: "hidden",
        display: "flex", flexDirection: "column", boxShadow: "0 24px 70px rgba(0,0,0,.6)", animation: "rcpop .24s cubic-bezier(.2,.9,.3,1.1)" }}>

        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: "1px solid var(--rc-border)" }}>
          <span style={{ fontFamily: "var(--rc-font-display)", textTransform: "uppercase", letterSpacing: ".07em", fontSize: 19, fontWeight: 700 }}>{t("Neler değişti")}</span>
          <span style={{ color: "var(--rc-text-3)", fontSize: 12 }}>{t("Kurulu sürüm")} {CUR} · {t("en yeni")} {newest}</span>
          <button onClick={onClose} style={{ marginLeft: "auto", width: 32, height: 32, borderRadius: 9, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 15, lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
          <div style={{ flex: "0 0 132px", borderRight: "1px solid var(--rc-border)", overflowY: "auto", padding: "10px 8px", background: "var(--rc-surface-2)" }}>
            {!list && <div style={{ padding: 10, fontSize: 11, color: "var(--rc-text-3)" }}>{t("Yükleniyor…")}</div>}
            {all.map((c) => {
              const cur = c.v === CUR, sel = c.v === wnV;
              return (
                <button key={c.v} onClick={() => setWnV(sel ? null : c.v)}
                  style={{ display: "flex", flexDirection: "column", gap: 2, width: "100%", textAlign: "left",
                    padding: "9px 10px", borderRadius: 9, cursor: "pointer", marginBottom: 3, color: "var(--rc-text)",
                    border: sel ? "1px solid var(--rc-brand-bright)" : "1px solid transparent",
                    background: sel ? "rgba(150,0,24,.22)" : "transparent" }}>
                  <b style={{ fontFamily: "var(--rc-font-display)", fontSize: 12.5 }}>{c.v}</b>
                  <span style={{ fontSize: 10, color: "var(--rc-text-3)" }}>{c.date}</span>
                  {cur && <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: ".09em", marginTop: 2, color: "var(--rc-ok)" }}>{t("şu an")}</span>}
                </button>
              );
            })}
          </div>

          <div style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: "18px 22px 24px" }}>
            {notes.map((c) => {
              const cur = c.v === CUR;
              const items = ((lang === "en" ? c.en : c.tr) || c.tr || c.en || []).map((x) => {
                const m = x.match(WN_ICO);
                return { ico: m ? m[1] : "•", text: m ? x.slice(m[0].length) : x };
              });
              return (
                <div key={c.v} style={{ marginBottom: 22 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <span style={{ fontFamily: "var(--rc-font-display)", fontWeight: 700, fontSize: 21, letterSpacing: ".02em" }}>{c.v}</span>
                    {cur && <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".09em", padding: "3px 10px", borderRadius: 99, border: "1px solid var(--rc-ok)", color: "var(--rc-ok)" }}>{t("şu an kurulu")}</span>}
                    <span style={{ marginLeft: "auto", fontFamily: "var(--rc-font-display)", fontSize: 11.5, color: "var(--rc-text-3)" }}>{c.date}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {items.map((it, i) => (
                      <div key={i} style={{ display: "flex", gap: 11, alignItems: "flex-start", border: "1px solid var(--rc-border)", borderRadius: 11, background: "var(--rc-surface-2)", padding: "12px 14px" }}>
                        <span style={{ fontSize: 16, lineHeight: 1.35, flex: "0 0 auto" }}>{it.ico}</span>
                        <span style={{ fontSize: 13, lineHeight: 1.65, color: "var(--rc-text-2)", textWrap: "pretty" }}>{it.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 20px", borderTop: "1px solid var(--rc-border)", background: "var(--rc-surface-2)", flexWrap: "wrap" }}>
          <a {...extHref(`${REPO_URL}/commits/main`)} style={{ fontSize: 12, color: "var(--rc-text-3)" }}>{t("GitHub'da tüm değişiklikler ↗")}</a>
          <button onClick={onStartGuide} style={{ background: "none", border: "none", color: "var(--rc-brand-bright)", cursor: "pointer", fontSize: 12, padding: 0, textDecoration: "underline", textUnderlineOffset: 3 }}>🎓 {t("Rehberi başlat")}</button>
          <button onClick={onClose} style={{ marginLeft: "auto", padding: "9px 20px", borderRadius: 10, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text)", cursor: "pointer", fontSize: 13 }}>{t("Kapat")}</button>
        </div>
      </div>
    </div>
  );
}

/* Yarış ekleme/düzenleme penceresi (form). App.jsx'ten çıkarıldı; sunum + form
   durumu (rForm) prop ile gelir. Kaydetme iş mantığı App'te (onSave callback).
   rForm=null iken null döner. */
/* v2.0 katman — handoff-spec/katmanlar/raceOpen.md. İki kolon: solda form
   (ad, sezon/round, pist ızgarası, sınıf/araç/süre, başlangıç, resmi ön ayar),
   sağda pist + araç önizlemesi. Kaydet/Düzenle davranışı korundu. */
export function RaceEditModal({ rForm, setRForm, t, seasons, onSave }) {
  if (!rForm) return null;
  const lbl = { display: "block", color: "var(--rc-text-3)", fontSize: 10, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 6 };
  const inp = { width: "100%", boxSizing: "border-box", background: "var(--rc-surface-3)", border: "1px solid var(--rc-border)", borderRadius: 10, color: "var(--rc-text)", padding: "11px 12px", fontSize: 13 };
  const curTrackName = trackName(rForm.trackId) || t("Pist seçilmedi");
  return (
    <div onClick={() => setRForm(null)} style={{ position: "fixed", inset: 0, zIndex: 1030, background: "var(--rc-scrim)", backdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, animation: "rcfade .18s ease" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(820px,96vw)", maxHeight: "88vh", background: "var(--rc-surface)", border: "1px solid var(--rc-border-strong)", borderRadius: 16, overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 24px 70px rgba(0,0,0,.6)", animation: "rcpop .24s cubic-bezier(.2,.9,.3,1.1)" }}>

        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: "1px solid var(--rc-border)" }}>
          <span style={{ fontFamily: "var(--rc-font-display)", textTransform: "uppercase", letterSpacing: ".07em", fontSize: 19, fontWeight: 700 }}>{rForm.rid ? t("Yarışı Düzenle") : t("Yarış Ekle")}</span>
          <button onClick={() => setRForm(null)} style={{ marginLeft: "auto", width: 32, height: 32, borderRadius: 9, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 15, lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ overflowY: "auto", padding: "18px 20px 20px", display: "flex", flexWrap: "wrap", gap: 18 }}>
          <div style={{ flex: "1 1 380px", minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={lbl}>{t("Yarış adı")}</label>
              <input type="text" value={rForm.name || ""} placeholder={t("örn. 6 Hours of Spa")}
                onChange={(e) => setRForm({ ...rForm, name: e.target.value })}
                style={{ ...inp, border: "1px solid var(--rc-border-strong)", fontFamily: "var(--rc-font-display)", fontSize: 20, fontWeight: 700, padding: "12px 14px", textTransform: "none" }} />
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: "2 1 200px", minWidth: 0 }}>
                <label style={lbl}>{t("Sezon")}</label>
                <select value={rForm.seasonId || ""} onChange={(e) => setRForm({ ...rForm, seasonId: e.target.value || null })} style={inp}>
                  <option value="">{t("Takvim dışı (tekli yarış)")}</option>
                  {Object.entries(seasons).map(([sid, se]) => (<option key={sid} value={sid}>{se.name}</option>))}
                </select>
              </div>
              <div style={{ flex: "1 1 90px", minWidth: 0 }}>
                <label style={lbl}>{t("Round")}</label>
                <input type="number" value={rForm.round || ""} onChange={(e) => setRForm({ ...rForm, round: e.target.value })}
                  style={{ ...inp, fontFamily: "var(--rc-font-display)", fontSize: 16 }} />
              </div>
            </div>
            <div>
              <label style={lbl}>{t("Pist")}</label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 8 }}>
                {TRACKS.map((tr) => {
                  const on = rForm.trackId === tr.id;
                  return (
                    <button key={tr.id} onClick={() => setRForm({ ...rForm, trackId: tr.id })}
                      style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 11px", borderRadius: 9, cursor: "pointer", color: "var(--rc-text)", minWidth: 0,
                        border: `1px solid ${on ? "var(--rc-brand-bright)" : "var(--rc-border)"}`, background: on ? "rgba(150,0,24,.22)" : "var(--rc-surface-3)" }}>
                      <img src={`${ASSET}flags/${TRACK_ASSET(tr.id)}.png`} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} style={{ width: 22, borderRadius: 2, flex: "0 0 auto" }} />
                      <span style={{ fontSize: 12.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tr.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 150px", minWidth: 0 }}>
                <label style={lbl}>{t("Sınıf")}</label>
                <select value={rForm.carClass || ""} onChange={(e) => setRForm({ ...rForm, carClass: e.target.value, carId: "" })} style={inp}>
                  {CAR_CLASSES.map(([id, nm]) => (<option key={id} value={id}>{nm}</option>))}
                </select>
              </div>
              <div style={{ flex: "1 1 180px", minWidth: 0 }}>
                <label style={lbl}>{t("Araç")}</label>
                <select value={rForm.carId || ""} onChange={(e) => setRForm({ ...rForm, carId: e.target.value })} style={inp}>
                  <option value="">—</option>
                  {(CARS[rForm.carClass] || []).map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                </select>
              </div>
              <div style={{ flex: "1 1 130px", minWidth: 0 }}>
                <label style={lbl}>{t("Yarış Süresi")}</label>
                <input type="text" value={rForm.raceTime || ""} placeholder="6:00:00" onChange={(e) => setRForm({ ...rForm, raceTime: e.target.value })}
                  style={{ ...inp, fontFamily: "var(--rc-font-display)", fontSize: 16 }} />
              </div>
            </div>
            <div>
              <label style={lbl}>{t("Başlangıç (yerel saat)")}</label>
              <input type="datetime-local" value={msToLocalInput(rForm.startsAt || Date.now())}
                onChange={(e) => { const v = new Date(e.target.value).getTime(); if (!isNaN(v)) setRForm({ ...rForm, startsAt: v }); }}
                style={{ ...inp, border: "1px solid var(--rc-border-strong)", fontFamily: "var(--rc-font-display)", fontSize: 15 }} />
            </div>
            {rForm.sessionStartMs != null && (
              <div style={{ border: "1px solid var(--rc-border-strong)", borderRadius: 11, background: "var(--rc-surface-2)", padding: "13px 15px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", marginBottom: 10 }}>
                  <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".1em", color: "var(--rc-brand-bright)", fontWeight: 600 }}>{t("Resmi yarıştan ön ayar")}</span>
                  <span style={{ fontSize: 11.5, color: "var(--rc-text-3)" }}>{t("Seans başı")} <b style={{ fontFamily: "var(--rc-font-display)", color: "var(--rc-text)" }}>{new Date(rForm.sessionStartMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</b></span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, color: "var(--rc-text-2)" }}>{t("Sıralama süresi")}</span>
                  <span style={{ display: "inline-flex", alignItems: "center", border: "1px solid var(--rc-border)", borderRadius: 9, overflow: "hidden" }}>
                    {[["−", -5], null, ["+", 5]].map((x) => x === null ? (
                      <b key="v" style={{ minWidth: 44, textAlign: "center", fontFamily: "var(--rc-font-display)", fontSize: 16 }}>{rForm.qualMin ?? 0}</b>
                    ) : (
                      <button key={x[0]} onClick={() => { const q = Math.max(0, Math.min(180, (rForm.qualMin ?? 0) + x[1])); setRForm({ ...rForm, qualMin: q, startsAt: rForm.sessionStartMs + (q + OFFICIAL_FORMATION_MIN) * 60000 }); }}
                        style={{ width: 32, height: 34, border: "none", background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 14 }}>{x[0]}</button>
                    ))}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--rc-text-3)" }}>{t("dk")} + {OFFICIAL_FORMATION_MIN} {t("dk formasyon")}</span>
                  <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11.5, color: "var(--rc-text-3)" }}>{t("Yarış başı")}</span>
                    <b style={{ fontFamily: "var(--rc-font-display)", fontSize: 19, color: "var(--rc-ok)" }}>{new Date(rForm.startsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</b>
                  </span>
                </div>
                {rForm.tyreSets != null && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--rc-border)" }}>
                    <span style={{ fontSize: 12, color: "var(--rc-text-2)" }}>🛞 {t("Lastik seti")}</span>
                    <input type="number" min={0} max={99} value={rForm.tyreSets ?? 0} onChange={(e) => setRForm({ ...rForm, tyreSets: Math.max(0, Math.min(99, Number(e.target.value) || 0)) })}
                      style={{ width: 70, background: "var(--rc-surface-3)", border: "1px solid var(--rc-border)", borderRadius: 9, color: "var(--rc-text)", padding: "7px 10px", fontFamily: "var(--rc-font-display)", fontSize: 14, textAlign: "right" }} />
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ flex: "1 1 240px", minWidth: 230, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ border: "1px solid var(--rc-border-strong)", borderRadius: 12, background: "radial-gradient(120% 160% at 100% 0,rgba(150,0,24,.20),var(--rc-surface-2) 62%)", padding: 16, textAlign: "center" }}>
              {rForm.trackId && <img src={`${ASSET}tracks/${TRACK_ASSET(rForm.trackId)}.png`} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} style={{ display: "block", width: "100%", maxWidth: 190, height: "auto", margin: "0 auto 10px" }} />}
              <div style={{ display: "inline-flex", alignItems: "center", gap: 7, fontFamily: "var(--rc-font-display)", fontWeight: 700, fontSize: 17 }}>
                {rForm.trackId && <img src={`${ASSET}flags/${TRACK_ASSET(rForm.trackId)}.png`} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} style={{ width: 20, borderRadius: 2 }} />}{curTrackName}
              </div>
            </div>
            {rForm.carId && (
              <div style={{ border: "1px solid var(--rc-border)", borderRadius: 12, background: "var(--rc-surface-2)", padding: 16, textAlign: "center" }}>
                <img src={`${ASSET}cars/${rForm.carClass}/${rForm.carId}.png`} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} style={{ display: "block", width: "100%", maxWidth: 210, height: "auto", margin: "0 auto 8px" }} />
                <div style={{ display: "inline-flex", alignItems: "center", gap: 7, fontFamily: "var(--rc-font-display)", fontWeight: 700, fontSize: 16 }}>
                  <img src={`${ASSET}class/${rForm.carClass}.png`} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} style={{ height: 15 }} />{carName(rForm.carClass, rForm.carId)}
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", borderTop: "1px solid var(--rc-border)", background: "var(--rc-surface-2)" }}>
          <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button onClick={() => setRForm(null)} style={{ padding: "10px 18px", borderRadius: 10, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 13 }}>{t("Vazgeç")}</button>
            <button onClick={() => onSave(rForm)} style={{ padding: "10px 24px", borderRadius: 10, border: "1px solid var(--rc-brand-bright)", background: "var(--rc-brand)", color: "var(--rc-on-brand)", cursor: "pointer", fontFamily: "var(--rc-font-display)", fontSize: 16, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase" }}>{t("Kaydet")}</button>
          </span>
        </div>
      </div>
    </div>
  );
}

/* Sohbet penceresi (kanal sekmeleri + gövde). App.jsx'ten çıkarıldı; sohbet gövdesi
   (ChatPanel'i saran, iki yerde kullanılan) App'te kalıp `chatBody` render-prop'u ile
   gelir. open=false → null döner. */
export function ChatModal({ open, onClose, t, chatSound, toggleChatSound, chatChans,
  unreadOf, chatChan, setChatChan, teamData, curChan, chatBody }) {
  if (!open) return null;
  return (
    <div className="wxmodal" onClick={onClose}>
      <div className="wxmbox" style={{ width: "min(560px,94vw)" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="wxmhead">
          <span>💬 {t("Sohbet")}</span>
          <button className="lbclose" style={{ marginLeft: "auto", marginRight: 4 }}
            title={chatSound ? t("Bildirim sesini kapat") : t("Bildirim sesini aç")}
            onClick={toggleChatSound}>{chatSound ? "🔔" : "🔕"}</button>
          <button className="lbclose" onClick={onClose}>✕</button>
        </div>
        <div className="chattabs">
          {chatChans.map((c) => {
            const u2 = unreadOf(c);
            return (
              <button key={c.id} className={`ctab ${c.id === chatChan ? "on" : ""}`}
                onClick={() => setChatChan(c.id)}>
                {c.ico} {c.id === "team" ? (teamData?.meta?.name || t(c.lbl)) : t(c.lbl)}
                {u2 > 0 && c.id !== chatChan && <b className="cdot">{u2 > 9 ? "9+" : u2}</b>}
              </button>
            );
          })}
        </div>
        {chatBody(curChan)}
      </div>
    </div>
  );
}

/* .svm alan anahtarları → kısa TR ad (yoksa ham anahtar gösterilir). Bölüm başlıkları
   da TR'ye çevrilir. Liste uzun olduğu için yalnız sık bakılanlar; gerisi ham key. */
const SVM_SECTIONS = {
  GENERAL: "Genel", FRONTWING: "Ön Kanat", REARWING: "Arka Kanat", BODYAERO: "Gövde/Aero",
  SUSPENSION: "Süspansiyon", CONTROLS: "Kontroller", ENGINE: "Motor", DRIVELINE: "Aktarma",
  FRONTLEFT: "Ön Sol", FRONTRIGHT: "Ön Sağ", REARLEFT: "Arka Sol", REARRIGHT: "Arka Sağ",
  BASIC: "Temel", LEFTFENDER: "Sol Çamurluk", RIGHTFENDER: "Sağ Çamurluk",
};
const SVM_FIELDS = {
  FuelSetting: "Yakıt", VirtualEnergySetting: "Sanal Enerji (VE)", FWSetting: "Ön Kanat",
  RWSetting: "Arka Kanat", WaterRadiatorSetting: "Su Radyatörü", OilRadiatorSetting: "Yağ Radyatörü",
  BrakeDuctSetting: "Fren Kanalı (Ön)", BrakeDuctRearSetting: "Fren Kanalı (Arka)",
  FrontAntiSwaySetting: "Ön Denge Çubuğu", RearAntiSwaySetting: "Arka Denge Çubuğu",
  FrontToeInSetting: "Ön Toe", RearToeInSetting: "Arka Toe", SteerLockSetting: "Direksiyon Kilidi",
  RearBrakeSetting: "Fren Dengesi", BrakeMigrationSetting: "Fren Göçü", BrakePressureSetting: "Fren Basıncı",
  TractionControlMapSetting: "TC Haritası", TCPowerCutMapSetting: "TC Güç Kesme",
  TCSlipAngleMapSetting: "TC Kayma Açısı", AntilockBrakeSystemMapSetting: "ABS Haritası",
  RevLimitSetting: "Devir Limiti", EngineMixtureSetting: "Motor Karışımı",
  DiffPreloadSetting: "Diff Preload", CamberSetting: "Kamber", PressureSetting: "Lastik Basıncı",
  SpringSetting: "Yay", RideHeightSetting: "Yükseklik", SlowBumpSetting: "Yavaş Sıkışma",
  FastBumpSetting: "Hızlı Sıkışma", SlowReboundSetting: "Yavaş Yaylanma",
  FastReboundSetting: "Hızlı Yaylanma", CompoundSetting: "Lastik Hamuru",
};

/* Kategori kimliği → görünen ad + ikon (setupParse SETUP_CATS sırasında çizilir). */
const CAT_META = {
  aero: { tr: "Aero", icon: "✈" }, tyre: { tr: "Lastik", icon: "🛞" },
  susp: { tr: "Süspansiyon", icon: "⚙" }, align: { tr: "Hizalama", icon: "📐" },
  brake: { tr: "Fren", icon: "🛑" }, diff: { tr: "Diferansiyel", icon: "🔩" },
  elec: { tr: "Elektronik", icon: "💡" }, engine: { tr: "Motor & Yakıt", icon: "🛢" },
  other: { tr: "Diğer", icon: "•" },
};

/* Setup gövdesini (base64) hazırla — legacy kayıt su.data'yı meta içinde taşır
   (senkron yol, eskisi gibi); yeni kayıtlarda (şema bölme) globalSetupData/{id}
   talep üzerine çekilir. Dönen: { b64, loading }. Hook kuralı: erken return'lerden
   ÖNCE çağrılmalı (İçerik + Karşılaştırma pencereleri kullanır). */
function useSetupBlob(su, open) {
  const [st, setSt] = useState({ id: null, b64: "", done: false });
  useEffect(() => {
    if (!open || !su || su.data) return undefined;
    let alive = true;
    setSt({ id: su.id, b64: "", done: false });
    getSetupBlob(su.id)
      .then((b64) => { if (alive) setSt({ id: su.id, b64, done: true }); })
      .catch(() => { if (alive) setSt({ id: su.id, b64: "", done: true }); });
    return () => { alive = false; };
  }, [open, su]);
  if (!su) return { b64: "", loading: false };
  if (su.data) return { b64: su.data, loading: false };
  const hit = st.id === su.id;
  return { b64: hit ? st.b64 : "", loading: !hit || !st.done };
}

/* Setup içeriği penceresi — havuzdaki base64 (su.data) çözülüp .svm parse edilir; üstte
   özet çipleri (Arka Kanat vb.), altında bölüm bölüm anlamlı değerler. open=false → null. */
export function SetupContentModal({ open, su, onClose, t }) {
  const blob = useSetupBlob(su, open);
  const [q, setQ] = useState("");
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open || !su) return null;
  const parsed = parseSvm(b64ToText(blob.b64));
  const summary = setupSummary(parsed);
  const fieldName = (key) => t(SVM_FIELDS[key] || key);
  const cats = categorizeSetup(parsed, showAll);
  const needle = q.trim().toLowerCase();
  const shown = needle
    ? cats.map((c) => ({ ...c, rows: c.rows.filter((r) => {
      const nm = fieldName(r.key).toLowerCase();
      const val = (r.kind === "axle" ? `${r.front} ${r.rear}` : r.value || "").toLowerCase();
      return nm.includes(needle) || val.includes(needle);
    }) })).filter((c) => c.rows.length)
    : cats;
  const title = [carName(su.cls, su.car) || su.car, trackName(su.track) || su.track]
    .filter(Boolean).join(" · ");
  return (
    <div className="wxmodal" onClick={onClose}>
      <div className="wxmbox" style={{ width: "min(640px,95vw)" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="wxmhead">
          <span>🔧 {t("Setup İçeriği")}</span>
          <button className="lbclose" onClick={onClose}>✕</button>
        </div>
        <div className="wxmlist" style={{ maxHeight: "74vh" }}>
          <div className="hint" style={{ margin: "0 0 8px" }}>
            {su.name}{title ? ` · ${title}` : ""}{su.lap ? ` · ⏱ ${su.lap}` : ""}</div>
          {blob.loading ? (
            <div className="hint">⏳ {t("Dosya yükleniyor…")}</div>
          ) : !parsed.ok ? (
            <div className="hint warn">⚠ {t("İçerik okunamadı — bu bir LMU setup dosyası değil ya da bozuk.")}</div>
          ) : (
            <>
              {summary.length > 0 && (
                <div className="setupsum">
                  {summary.map((s) => (
                    <span className="setupchip" key={s.label}>
                      <b>{t(s.label)}</b> {s.value}</span>
                  ))}
                </div>
              )}
              <div className="setuptools">
                <div className="seg" role="group">
                  <button aria-pressed={!showAll} onClick={() => setShowAll(false)}>
                    {t("Anlamlı alanlar")}</button>
                  <button aria-pressed={showAll} onClick={() => setShowAll(true)}>
                    {t("Tümünü göster")}</button>
                </div>
                <input className="setupsearch" value={q} onChange={(e) => setQ(e.target.value)}
                  placeholder={t("ara: kanat, basınç…")} aria-label={t("Setup alanı ara")} />
              </div>
              {shown.length ? (
                <div className="setupcats">
                  {shown.map((c) => (
                    <section className="setupcat" key={c.cat}>
                      <h4 className="setupcat-h">
                        <span className="ic">{CAT_META[c.cat]?.icon || "•"}</span>
                        {t(CAT_META[c.cat]?.tr || c.cat)}
                        <span className="n">{c.rows.length}</span></h4>
                      {c.rows.map((r) => (
                        <div className="setuprow" key={r.key}>
                          <span className="setuprow-k">{fieldName(r.key)}</span>
                          {r.kind === "axle" ? (
                            <span className="setuprow-v axle">
                              <span><b>{t("ÖN")}</b>{r.front}</span>
                              <span><b>{t("ARKA")}</b>{r.rear}</span></span>
                          ) : (
                            <span className="setuprow-v">{r.value}</span>
                          )}
                        </div>
                      ))}
                    </section>
                  ))}
                </div>
              ) : (
                <div className="hint">{t("Eşleşen alan yok.")}</div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* Seans Setup kutusu (v1.5.2) — .duckdb telemetrisine gömülü kurulumu Telemetri
   sekmesinde gösterir. `setup` = ham VM_/WM_ JSON (cmpMeta.setup). Özet çipleri +
   "Detay" ile kategorili tam görünüm (Setup İçerik penceresiyle aynı düzen, aynı
   categorizeSetup/CAT_META) + "⬆ Havuza Kaydet" (onSave). onSave yoksa buton yok. */
export function SessionSetupBox({ setup, meta, t, onSave }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");
  if (!setup) return null;
  const parsed = duckSetupToParsed(setup);
  if (!parsed.ok) return null;
  const summary = setupSummary(parsed);
  const fieldName = (key) => t(SVM_FIELDS[key] || key);
  const cats = categorizeSetup(parsed);
  const count = parsed.rows.filter((r) => r.meaningful).length;
  const needle = q.trim().toLowerCase();
  const shown = needle
    ? cats.map((c) => ({ ...c, rows: c.rows.filter((r) => {
      const nm = fieldName(r.key).toLowerCase();
      const val = (r.kind === "axle" ? `${r.front} ${r.rear}` : r.value || "").toLowerCase();
      return nm.includes(needle) || val.includes(needle);
    }) })).filter((c) => c.rows.length)
    : cats;
  const doSave = async () => {
    if (!onSave || saving) return;
    setSaving(true); setErr("");
    try { await onSave(setup, meta); setSaved(true); }
    catch (e) { setErr(String(e?.message || t("Kaydedilemedi"))); }
    finally { setSaving(false); }
  };
  return (
    <div className="card sessetup">
      <h2>🔧 {t("Bu Seansın Setup'ı")} <span className="newtag">{t("YENİ")}</span>
        <span className="n">{[meta?.driver, meta?.session].filter(Boolean).join(" · ")}
          {count ? ` · ${count} ${t("ayar")}` : ""}</span></h2>
      {summary.length > 0 && (
        <div className="setupsum">
          {summary.map((s) => (
            <span className="setupchip" key={s.label}><b>{t(s.label)}</b> {s.value}</span>
          ))}
        </div>
      )}
      <div className="setuptools">
        <div className="seg" role="group">
          <button aria-pressed={!open} onClick={() => setOpen(false)}>{t("Özet")}</button>
          <button aria-pressed={open} onClick={() => setOpen(true)}>{t("Detay")}</button>
        </div>
        {open && (
          <input className="setupsearch" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder={t("ara: kanat, basınç…")} aria-label={t("Setup alanı ara")} />
        )}
        {onSave && (
          <button className="act" onClick={doSave} disabled={saving || saved}
            style={{ marginLeft: "auto" }}>
            {saved ? `✓ ${t("Havuza kaydedildi")}` : saving ? t("Kaydediliyor…") : `⬆ ${t("Havuza Kaydet")}`}
          </button>
        )}
      </div>
      {err && <div className="hint warn">⚠ {err}</div>}
      {open && (shown.length ? (
        <div className="setupcats">
          {shown.map((c) => (
            <section className="setupcat" key={c.cat}>
              <h4 className="setupcat-h">
                <span className="ic">{CAT_META[c.cat]?.icon || "•"}</span>
                {t(CAT_META[c.cat]?.tr || c.cat)}
                <span className="n">{c.rows.length}</span></h4>
              {c.rows.map((r) => (
                <div className="setuprow" key={r.key}>
                  <span className="setuprow-k">{fieldName(r.key)}</span>
                  {r.kind === "axle" ? (
                    <span className="setuprow-v axle">
                      <span><b>{t("ÖN")}</b>{r.front}</span>
                      <span><b>{t("ARKA")}</b>{r.rear}</span></span>
                  ) : (
                    <span className="setuprow-v">{r.value}</span>
                  )}
                </div>
              ))}
            </section>
          ))}
        </div>
      ) : (
        <div className="hint">{t("Eşleşen alan yok.")}</div>
      ))}
    </div>
  );
}

/* İki setup'ı yan yana karşılaştırma penceresi — ⚖ ile seçilen iki kayıt (a, b).
   diffSetups bölüm/anahtar birleşimini verir; farklı satırlar vurgulanır (.diffhl),
   "yalnız farklar" anahtarı varsayılan açık. Farklı pist/sınıf engellenmez — başlıkta
   uyarı çipi çıkar (kıyas kullanıcının bilinçli kararı). open=false → null. */
export function SetupCompareModal({ open, a, b, onClose, t }) {
  const [onlyDiff, setOnlyDiff] = useState(true);
  const blobA = useSetupBlob(a, open);     // legacy: su.data · yeni: talep üzerine
  const blobB = useSetupBlob(b, open);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open || !a || !b) return null;

  const loading = blobA.loading || blobB.loading;
  const pa = parseSvm(b64ToText(blobA.b64));
  const pb = parseSvm(b64ToText(blobB.b64));
  const both = pa.ok && pb.ok;
  const rows = both ? diffSetups(pa, pb) : [];
  const diffCount = rows.filter((r) => r.differ).length;
  const shown = onlyDiff ? rows.filter((r) => r.differ) : rows;
  /* bölüm sırasını koruyarak grupla */
  const groups = [];
  const gIdx = {};
  for (const r of shown) {
    if (!(r.section in gIdx)) { gIdx[r.section] = groups.length; groups.push({ sec: r.section, list: [] }); }
    groups[gIdx[r.section]].list.push(r);
  }
  const mismatch = a.track !== b.track || a.cls !== b.cls;
  const side = (su) => (
    <>
      <b className="setupmono" style={{ fontSize: 11, wordBreak: "break-all" }}>{su.name}</b>
      <span className="hint" style={{ margin: 0 }}>
        {[carName(su.cls, su.car) || su.car, trackName(su.track) || su.track,
          su.uname].filter(Boolean).join(" · ")}</span>
    </>
  );
  return (
    <div className="wxmodal" onClick={onClose}>
      <div className="wxmbox" style={{ width: "min(760px,96vw)" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="wxmhead">
          <span>⚖ {t("Setup Karşılaştır")}</span>
          <button className="lbclose" onClick={onClose}>✕</button>
        </div>
        <div className="wxmlist" style={{ maxHeight: "76vh" }}>
          {/* başlık: iki taraf + tur zamanları */}
          <div className="cmphead">
            <div className="cmpside">{side(a)}</div>
            <div className="cmpvs setupmono">
              {(a.lap || b.lap) ? <>{a.lap || "—"} ↔ {b.lap || "—"}</> : "↔"}</div>
            <div className="cmpside" style={{ textAlign: "right" }}>{side(b)}</div>
          </div>
          {mismatch && (
            <div className="hint warn" style={{ margin: "6px 0" }}>
              ⚠ {t("Farklı pist ya da sınıf — kıyası dikkatli oku.")}</div>
          )}
          {loading ? (
            <div className="hint">⏳ {t("Dosya yükleniyor…")}</div>
          ) : !both ? (
            <div className="hint warn">⚠ {t("İçerik okunamadı — bu bir LMU setup dosyası değil ya da bozuk.")}</div>
          ) : (
            <>
              {/* iki özet çip şeridi */}
              {[pa, pb].map((p, i) => {
                const sum = setupSummary(p);
                if (!sum.length) return null;
                return (
                  <div className="setupsum" key={i} style={{ marginBottom: i ? 8 : 4 }}>
                    <span className="setupchip" style={{ opacity: .7 }}>{i ? "B" : "A"}</span>
                    {sum.map((s) => (
                      <span className="setupchip" key={s.label}>
                        <b>{t(s.label)}</b> {s.value}</span>
                    ))}
                  </div>
                );
              })}
              <label className="hint" style={{ display: "flex", alignItems: "center",
                gap: 6, margin: "4px 0 8px", cursor: "pointer" }}>
                <input type="checkbox" checked={onlyDiff}
                  onChange={(e) => setOnlyDiff(e.target.checked)} />
                {t("Yalnız farkları göster")} ({diffCount})
              </label>
              {!shown.length && (
                <div className="hint">
                  {diffCount === 0
                    ? t("İki setup'ın tüm anlamlı değerleri aynı.")
                    : t("Gösterilecek satır yok.")}</div>
              )}
              {groups.map(({ sec, list }) => (
                <div className="setupsec" key={sec}>
                  <div className="setupsec-h">{t(SVM_SECTIONS[sec] || sec)}</div>
                  {list.map((r) => (
                    <div className={`cmprow${r.differ ? " diffhl" : ""}`}
                      key={`${r.section}/${r.key}`}>
                      <span className="setuprow-k">{t(SVM_FIELDS[r.key] || r.key)}</span>
                      <span className="cmpv setupmono">{r.a}</span>
                      <span className="cmpv setupmono">{r.b}</span>
                    </div>
                  ))}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* Lobi ortak setup havuzu penceresi — süzgeçler + liste. Yükleme formu (setupForm)
   ve tablo (setupTable) App'te kalıp render-prop ile gelir (Setup sekmesinde de
   kullanılıyor). open=false → null döner. */
export function SetupModal({ open, onClose, t, suUpOpen, setSuUpOpen, suList, setups,
  suFTrack, setSuFTrack, suFCond, setSuFCond, suFSess, setSuFSess,
  suQuery, setSuQuery, suMine, setSuMine, suView, toggleSuView,
  suHasMore, loadMoreSetups, setupForm, setupTable }) {
  if (!open) return null;
  return (
    <div className="wxmodal" onClick={onClose}>
      <div className="wxmbox" style={{ width: "min(1080px,97vw)" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="wxmhead">
          <span>🔧 {t("Setup Havuzu")} · {t("Ortak")} ({suList.length}/{setups.length})</span>
          <button className="lbclose" style={{ marginLeft: "auto", marginRight: 4 }}
            title={t("Setup Ekle")}
            onClick={() => setSuUpOpen((v) => !v)}>{suUpOpen ? "▾" : "＋"}</button>
          <button className="lbclose" onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: "12px 16px", maxHeight: "70vh", overflowY: "auto" }}>
          {suUpOpen && (
            <div className="card" style={{ marginBottom: 12 }}>
              <h2>🔧 {t("Setup Yükle")}</h2>
              {setupForm()}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            <select value={suFTrack} onChange={(e) => setSuFTrack(e.target.value)}>
              <option value="">{t("Tüm pistler")}</option>
              {TRACKS.filter((tr) => setups.some((x) => x.track === tr.id))
                .map((tr) => <option key={tr.id} value={tr.id}>{tr.name}</option>)}
            </select>
            <select value={suFCond} onChange={(e) => setSuFCond(e.target.value)}>
              <option value="">{t("Kuru + Wet")}</option>
              <option value="dry">☀️ {t("Kuru")}</option>
              <option value="wet">🌧 Wet</option>
            </select>
            <select value={suFSess} onChange={(e) => setSuFSess(e.target.value)}>
              <option value="">{t("Yarış + Sıralama")}</option>
              <option value="R">{t("Yarış")}</option>
              <option value="Q">{t("Sıralama")}</option>
            </select>
            {setSuQuery && (
              <input type="text" value={suQuery || ""} placeholder={`🔎 ${t("ara")}…`}
                style={{ textTransform: "none", minWidth: 160 }}
                onChange={(e) => setSuQuery(e.target.value)} />
            )}
            {setSuMine && (
              <button className="act" style={{ fontSize: 11,
                  ...(suMine ? { borderColor: "var(--green)", color: "var(--green)" } : {}) }}
                title={t("Yalnız senin yüklediklerin")}
                onClick={() => setSuMine((v) => !v)}>
                👤 {t("Benim setuplarım")}</button>
            )}
            {toggleSuView && (
              <button className="act" style={{ fontSize: 11, marginLeft: "auto" }}
                title={suView === "cards" ? t("Tablo") : t("Kartlar")}
                onClick={toggleSuView}>
                {suView === "cards" ? <>☰ {t("Tablo")}</> : <>⊞ {t("Kartlar")}</>}</button>
            )}
          </div>
          {!suList.length
            ? <div className="hint">
                {poolEmptyReason(setups.length, suList.length) === "filtered"
                  ? <>{t("Bu süzgeçle setup yok.")}{" "}
                    <button className="act" style={{ fontSize: 11 }}
                      onClick={() => { setSuFTrack(""); setSuFCond(""); setSuFSess("");
                        setSuQuery?.(""); setSuMine?.(false); }}>
                      ✕ {t("Süzgeçleri temizle")}</button></>
                  : t("Henüz setup yok — ilk dosyayı yukarıdan yükle.")}
              </div>
            : setupTable(suList)}
          {suHasMore && loadMoreSetups && (
            <div style={{ textAlign: "center", marginTop: 10 }}>
              <button className="act" onClick={loadMoreSetups}>
                ⬇ {t("Daha fazla yükle")}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* Takım penceresi — takım seçimi, ad, sezon/yarış takvimi, üye/rozet yönetimi,
   kur/katıl. App.jsx'ten çıkarıldı (en büyük modal). Depo fonksiyonları burada
   import; navigasyon/rozet/rol yardımcıları (openRace/setRForm/setBadge/roleLabel)
   App'ten prop. open=false || user yok → null döner. */
/* Create & Join — sade takım OLUŞTUR / KATIL ekranı (v1.6). Team Management'tan
   AYRI: yalnız yeni takım kur + katılım kodu ile katıl. Yönetim (sezon/takvim/
   üye/izin) burada YOK — o TeamModal'da. Backend/Firebase davranışı değişmez. */
export function CreateJoinModal({ open, onClose, user, t, userName,
  tForm, setTForm, setTErr, tErr, setCurTeam }) {
  if (!open || !user) return null;
  return (
    <div className="wxmodal" onClick={onClose}>
      <div className="wxmbox" style={{ width: "min(460px,94vw)" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="wxmhead">
          <span>🏢 {t("Kur & Katıl")}</span>
          <button className="lbclose" onClick={onClose}>✕</button>
        </div>
        <div className="wxmlist" style={{ padding: "14px 16px" }}>
          <div className="hint" style={{ marginTop: 0, marginBottom: 16 }}>
            {t("Yeni bir takım kur ya da katılım koduyla mevcut bir takıma katıl.")}
          </div>

          <div className="cjsec">
            <div className="cjsec-h">➕ {t("Takım Kur")}</div>
            <div className="cjrow">
              <input placeholder={t("Yeni takım adı")} value={tForm.name}
                onChange={(e) => setTForm({ ...tForm, name: e.target.value })}
                style={{ textTransform: "none" }} />
              <button className="gbtn ubtn" disabled={!tForm.name.trim()}
                style={{ opacity: tForm.name.trim() ? 1 : .45 }}
                onClick={async () => {
                  setTErr("");
                  try {
                    const tid = await createTeam(user, tForm.name.trim(), userName);
                    setCurTeam(tid); setTForm({ ...tForm, name: "" }); onClose();
                  } catch { setTErr(t("Takım kurulamadı")); }
                }}>{t("Takım Kur")}</button>
            </div>
          </div>

          <div className="cjsec">
            <div className="cjsec-h">🔑 {t("Takıma Katıl")}</div>
            <div className="cjrow">
              <input placeholder={t("KATILIM KODU")} maxLength={6} value={tForm.join}
                onChange={(e) => setTForm({ ...tForm, join: e.target.value.toUpperCase() })} />
              <button className="gbtn ubtn" disabled={tForm.join.trim().length < 4}
                style={{ opacity: tForm.join.trim().length >= 4 ? 1 : .45 }}
                onClick={async () => {
                  setTErr("");
                  try {
                    const tid = await joinTeam(user, tForm.join, userName);
                    setCurTeam(tid); setTForm({ ...tForm, join: "" }); onClose();
                  } catch (e) {
                    setTErr(e.message === "NOT_FOUND" ? t("Takım bulunamadı") : t("Katılınamadı"));
                  }
                }}>{t("Katıl")}</button>
            </div>
          </div>

          {tErr && <div className="hint" style={{ color: "var(--red)", margin: 0 }}>{tErr}</div>}
        </div>
      </div>
    </div>
  );
}

/* Team Management (v1.6 yeniden düzenleme): mantıksal kart bölümleri —
   Takım Kimliği · Sezonlar & Takvim · Üyeler & Yetkiler · Takım Erişimi.
   Kur/Katıl ARTIK burada değil (CreateJoinModal'a taşındı) → yönetim penceresi
   sade ve kompakt kalır. Tüm mevcut işlevler (ad düzenle, sezon/yarış CRUD,
   rol rozetleri, join code, ayrıl) korunur. */
/* Görsel yükleme kutusu (v1.7.0) — sabit-aspect önizleme + Yükle/Değiştir/Kaldır.
   current = takımın özel görseli; fallback = statik asset (varsa önizlemede görünür,
   Kaldır yalnız özel görsel varken çıkar). Doğrulama/normalize processImageFile'da;
   hata (tür/boyut/bozuk/kural reddi) kutunun altında hint warn ile gösterilir. */
function AssetUpload({ label, current, fallback = "", specKey, aspect, w,
  canEdit, t, onSave, onClear }) {
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const inpRef = useRef(null);
  const pick = async (f) => {
    if (!f) return;
    setErr(""); setBusy(true);
    try {
      const uri = await processImageFile(f, specKey);
      await onSave(uri);
    } catch (e) {
      setErr(t(e?.message || "Görsel işlenemedi — dosya bozuk olabilir."));
    } finally {
      setBusy(false);
      if (inpRef.current) inpRef.current.value = "";
    }
  };
  const shown = current || fallback;
  return (
    <div className="astbox">
      <div className="astcap">{label}</div>
      <div className="astprev" style={{ width: w, aspectRatio: aspect }}>
        {shown
          ? <img src={shown} alt=""
              onError={(e) => { e.currentTarget.style.display = "none"; }} />
          : <span className="hint" style={{ margin: 0 }}>{t("Görsel yok")}</span>}
      </div>
      {canEdit && (
        <div className="astact">
          <input ref={inpRef} type="file" accept={IMG_ACCEPT_TYPES.join(",")}
            style={{ display: "none" }}
            onChange={(e) => pick(e.target.files?.[0])} />
          <button className="minibtn" style={{ width: "auto", padding: "0 10px" }}
            disabled={busy} onClick={() => inpRef.current?.click()}>
            {busy ? t("Yükleniyor…") : current ? t("Değiştir") : `⬆ ${t("Yükle")}`}
          </button>
          {current && (
            <button className="minibtn" style={{ width: "auto", padding: "0 10px" }}
              disabled={busy} title={t("Kaldır")}
              onClick={() => { setErr(""); onClear(); }}>✕ {t("Kaldır")}</button>
          )}
        </div>
      )}
      {err && <div className="hint warn" style={{ margin: "4px 0 0" }}>{err}</div>}
    </div>
  );
}

export function TeamModal({ open, onClose, user, t, lang, myTeams, curTeam, setCurTeam,
  teamData, tnEdit, setTnEdit, canManageTeam, canEditTeam, curSeason, setCurSeason,
  seasons, races, st, myRole,
  openRace, setRForm, setBadge, roleLabel, onCreateJoin }) {
  /* Araç Görselleri kartı seçimi — hook'lar erken return'den ÖNCE (React kuralı). */
  const [astCls, setAstCls] = useState("hypercar");
  const [astCar, setAstCar] = useState("");
  if (!open || !user) return null;
  const astKey = astCar ? carAssetKey(astCls, astCar) : "";
  const astCustom = (angle) => teamData?.assets?.cars?.[astKey]?.[angle] || "";
  return (
        <div className="wxmodal" onClick={onClose}>
          <div className="wxmbox" style={{ width: "min(680px,95vw)" }}
            onClick={(e) => e.stopPropagation()}>
            <div className="wxmhead">
              <span>⚙ {t("Yönet")} · {t("Takımlar")}</span>
              <button className="lbclose" onClick={onClose}>✕</button>
            </div>

            {/* takım seçici (birden çok takım) */}
            {Object.keys(myTeams).length > 1 && (
              <div className="tmtabs">
                {Object.entries(myTeams).map(([tid, nm]) => (
                  <button key={tid} className={curTeam === tid ? "on" : ""}
                    onClick={() => setCurTeam(tid)}>{nm}</button>
                ))}
              </div>
            )}

            <div className="wxmlist tmbody">
              {!curTeam && (
                <div className="hint" style={{ marginBottom: 4 }}>
                  {t("Henüz bir takımın yok. Yeni takım kur ya da katılım kodu ile katıl.")}
                  {onCreateJoin && (
                    <><br /><button className="gbtn ubtn" style={{ marginTop: 8 }}
                      onClick={onCreateJoin}>🏢 {t("Kur & Katıl")}</button></>
                  )}
                </div>
              )}

              {curTeam && teamData && (<>
                {/* ── Takım Kimliği ── */}
                <section className="tmcard">
                  <div className="tmcard-h">🏷 {t("Takım Kimliği")}</div>
                  {tnEdit === null ? (
                    <div className="tmid">
                      <b className="tmid-name">{teamData?.meta?.name || "—"}</b>
                      {canManageTeam && (
                        <button className="minibtn" style={{ width: "auto", padding: "0 10px" }}
                          onClick={() => setTnEdit(teamData?.meta?.name || "")}>
                          {t("Düzenle")}</button>
                      )}
                    </div>
                  ) : (
                    <>
                      <div style={{ display: "flex", gap: 8, maxWidth: 420 }}>
                        <input type="text" value={tnEdit} maxLength={40} autoFocus
                          style={{ textTransform: "none", margin: 0 }}
                          onChange={(e) => setTnEdit(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Escape") setTnEdit(null); }} />
                        <button className="gbtn ubtn" disabled={!tnEdit.trim()}
                          style={{ opacity: tnEdit.trim() ? 1 : .45 }}
                          onClick={async () => {
                            const nm = tnEdit.trim();
                            setTnEdit(null);
                            try {
                              await renameTeam(curTeam, nm);
                              await syncMyTeamName(user.uid, curTeam, nm);
                            } catch (e) { console.warn("ad değiştirilemedi:", e?.message); }
                          }}>{t("Kaydet")}</button>
                        <button className="histbtn"
                          onClick={() => setTnEdit(null)}>{t("Vazgeç")}</button>
                      </div>
                      <div className="hint" style={{ marginBottom: 0 }}>
                        {t("Yeni ad diğer üyelerde uygulamayı açtıklarında güncellenir.")}</div>
                    </>
                  )}
                  {/* Takım logosu — ana menü kartı, başlık ve teambar'da görünür */}
                  <div style={{ marginTop: 12 }}>
                    <AssetUpload label={t("Takım Logosu")} specKey="logo"
                      current={teamLogoSrc(teamData?.assets)} aspect="1 / 1" w={110}
                      canEdit={canEditTeam} t={t}
                      onSave={(uri) => saveTeamAsset(curTeam, "logo", uri)}
                      onClear={() => clearTeamAsset(curTeam, "logo").catch(() => {})} />
                  </div>
                </section>

                {/* ── Araç Görselleri (v1.7.0) ── */}
                {canEditTeam && (
                  <section className="tmcard">
                    <div className="tmcard-h">🖼 {t("Araç Görselleri")}</div>
                    <div className="hint">
                      {t("Sınıf ve araç seç — yüklenen SIDE/TOP görseller o araç için tüm takım ekranlarında kullanılır. Yüklenmeyen araçlar varsayılan görselle kalır.")}
                    </div>
                    <div style={{ display: "flex", gap: 8, maxWidth: 460, marginBottom: 12 }}>
                      <ImgSelect value={astCls} options={classOptions()} t={t}
                        placeholder={t("Sınıf")}
                        onChange={(v) => { setAstCls(v); setAstCar(""); }} />
                      <ImgSelect value={astCar} options={carOptions(astCls)} t={t}
                        placeholder={t("Araç")} disabled={!astCls}
                        onChange={(v) => setAstCar(v)} />
                    </div>
                    {astCar ? (
                      <div className="astgrid">
                        <AssetUpload label={`${t("Yandan")} (SIDE · 1000×400)`}
                          specKey="carSide" aspect="1000 / 400" w={300}
                          current={astCustom("side")} fallback={carImg(astCls, astCar)}
                          canEdit={canEditTeam} t={t}
                          onSave={(uri) => saveTeamAsset(curTeam, `cars/${astKey}/side`, uri)}
                          onClear={() => clearTeamAsset(curTeam, `cars/${astKey}/side`)
                            .catch(() => {})} />
                        <AssetUpload label={`${t("Üstten")} (TOP · 400×1000)`}
                          specKey="carTop" aspect="400 / 1000" w={110}
                          current={astCustom("top")}
                          fallback={`${ASSET}cartop/default.png`}
                          canEdit={canEditTeam} t={t}
                          onSave={(uri) => saveTeamAsset(curTeam, `cars/${astKey}/top`, uri)}
                          onClear={() => clearTeamAsset(curTeam, `cars/${astKey}/top`)
                            .catch(() => {})} />
                      </div>
                    ) : (
                      <div className="hint" style={{ marginBottom: 0 }}>
                        {t("Görsel yüklemek için önce araç seç.")}</div>
                    )}
                  </section>
                )}

                {/* ── Sezonlar & Takvim ── */}
                <section className="tmcard">
                  <div className="tmcard-h">🏁 {t("Sezonlar & Takvim")}</div>
                  <div className="tmtabs" style={{ padding: "0 0 10px" }}>
                    <button className={curSeason === "" ? "on" : ""}
                      onClick={() => setCurSeason("")}>{t("Tümü")}</button>
                    {Object.entries(seasons).map(([sid, se]) => (
                      <button key={sid} className={curSeason === sid ? "on" : ""}
                        onClick={() => setCurSeason(sid)}>{se.name}</button>
                    ))}
                    {canEditTeam && (
                      <button onClick={async () => {
                        const nm = window.prompt(t("Sezon adı"), `${new Date().getFullYear()} WEC`);
                        if (nm) await createSeason(curTeam, nm, new Date().getFullYear())
                          .catch(() => {});
                      }}>+ {t("Sezon")}</button>
                    )}
                  </div>
                  {Object.entries(races)
                    .filter(([, r]) => !curSeason || r.seasonId === curSeason)
                    .sort(([, a], [, b]) => (a.startsAt || 0) - (b.startsAt || 0))
                    .map(([rid, r]) => (
                      <div key={rid} className="tmroom">
                        {r.round ? <span className="rcode">R{r.round}</span> : null}
                        <span className="rlabel">
                          <b>{r.name || trackName(r.trackId) || "—"}</b>
                          <span className="rmeta">
                            {r.trackId ? trackName(r.trackId) : ""}
                            {r.raceTime ? ` · ${r.raceTime}` : ""}
                            {r.startsAt ? ` · ${new Date(r.startsAt)
                              .toLocaleString(lang === "en" ? "en-GB" : "tr-TR",
                                { day: "2-digit", month: "2-digit", hour: "2-digit",
                                  minute: "2-digit" })}` : ""}
                          </span>
                        </span>
                        <button className="gbtn ubtn" onClick={() => openRace(rid)}>
                          {t("Aç")}</button>
                        {canEditTeam && (<>
                          <button className="minibtn" title={t("Düzenle")}
                            onClick={() => setRForm({ rid, ...r })}>✎</button>
                          <button className="minibtn" title={t("Sil")}
                            onClick={() => { if (window.confirm(t("Yarış silinsin mi?")))
                              deleteRace(curTeam, rid).catch(() => {}); }}>✕</button>
                        </>)}
                      </div>
                    ))}
                  {Object.keys(races).length === 0 && (
                    <div className="hint" style={{ marginBottom: 0 }}>{t("Takvimde yarış yok.")}</div>
                  )}
                  {canEditTeam && (
                    <button className="gbtn ubtn" style={{ width: "100%", marginTop: 10 }}
                      onClick={() => setRForm({
                        rid: null, seasonId: curSeason || null, round: "", name: "",
                        trackId: st.track || "", carClass: st.carClass || "hypercar",
                        carId: st.car || "", raceTime: st.raceTime || "6:00:00",
                        startsAt: Date.now(),
                      })}>
                      ➕ {t("Yarış Ekle")}
                    </button>
                  )}
                </section>

                {/* ── Üyeler & Yetkiler ── */}
                <section className="tmcard">
                  <div className="tmcard-h">👥 {t("Üyeler & Yetkiler")}</div>
                  {canManageTeam && (
                    <div className="tmlegend">
                      <span>🎧 {t("Yarış Mühendisi")} — {t("yarış datasını değiştirebilir, üyelere dokunamaz")}</span>
                      <span><span style={{ verticalAlign: -2 }}><Wheel size={12} /></span> {t("Sürücü")} — {t("her şeyi görür, hiçbir şeyi değiştiremez")}</span>
                      <span>👑 {t("Takım Sahibi")} — {t("rozetleri ve yetkileri yönetir")}</span>
                    </div>
                  )}
                  <div className="tmmembers">
                    {Object.entries(teamData.members || {}).map(([uid, role]) => {
                      const mbs = teamBadgesOf(teamData, uid, null);
                      return (
                        <div key={uid} className="tmmem2">
                          <Avatar uid={uid} name={teamData?.names?.[uid]} size={24} />
                          <span className="tmm-badges">
                            {mbs.length ? mbs.map((b) => (
                              <span key={b.lbl} className="ubadge" title={t(b.lbl)}
                                style={{ color: b.col, background: b.bg, borderColor: b.col }}>
                                {b.ico}</span>
                            )) : <span className="ubadge" style={{ opacity: .25 }}>·</span>}
                          </span>
                          <span className="tmm-name">
                            <b>{teamData?.names?.[uid]
                              ? teamData.names[uid]
                              : (uid === user.uid ? t("(sen)") : uid.slice(0, 10) + "…")}
                              {teamData?.names?.[uid] && uid === user.uid ? ` ${t("(sen)")}` : ""}</b>
                            <span className="tmm-role" title={t("Yetki")}>{t(roleLabel(role))}</span>
                          </span>
                          {canManageTeam && (
                            <span className="tmm-act">
                              {["driver", "engineer"].map((id) => {
                                const on = hasBadge(teamData, uid, id);
                                const b = BADGES[id];
                                return (
                                  <button key={id} className={`btgl ${on ? "on" : ""}`}
                                    title={`${t(b.lbl)} — ${t(id === "engineer"
                                      ? "datayı değiştirebilir" : "sadece görür")}`}
                                    style={on ? { color: b.col, borderColor: b.col,
                                      background: b.bg } : undefined}
                                    onClick={() => setBadge(uid, id, !on)}>
                                    {b.ico}
                                  </button>
                                );
                              })}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* ── Takım Erişimi ── */}
                <section className="tmcard">
                  <div className="tmcard-h">🔑 {t("Takım Erişimi")}</div>
                  <div className="tmcode">
                    <span className="tmcode-k">{t("Katılım kodu")}</span>
                    <b className="tmcode-v">{teamData?.meta?.joinCode || "—"}</b>
                  </div>
                  <div className="hint" style={{ marginBottom: myRole !== "owner" ? 10 : 0 }}>
                    {t("Bu kodu paylaş — üyeler katılırken girer.")}
                    {" "}{t("PIN'leri yalnız düzenleyiciler görür.")}
                  </div>
                  {myRole !== "owner" && (
                    <button className="histbtn" onClick={() => {
                      leaveTeam(curTeam, user.uid).catch(() => {}); setCurTeam("");
                    }}>{t("Takımdan ayrıl")}</button>
                  )}
                </section>
              </>)}
            </div>
          </div>
        </div>
  );
}

/* Yetki reddi kutucuğu — viewer bir yarışta düzenleme deneyince (App.jsx edit() muhafızı)
   ekranın alt-ortasında belirir. Fixed konumlu (.denytoast) → DOM'daki yeri önemsiz;
   App'te key={deny} ile remount edilir (her tıkta yeniden animasyon). Boş bağımlılıkla
   yalnız mount'ta ~2.6 sn'lik zamanlayıcı kurulur (parent re-render zamanlayıcıyı sıfırlamaz),
   sonra onDone() ile kendini kapatır. */
export function DenyToast({ text, onDone }) {
  useEffect(() => {
    const id = setTimeout(() => onDone?.(), 2600);
    return () => clearTimeout(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="denytoast" role="alert" aria-live="assertive">
      <span className="dticon" aria-hidden="true">🔒</span>
      <span>{text}</span>
    </div>
  );
}
