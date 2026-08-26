/* Sunum komponentleri — durum tutmayan görsel parçalar.
   App.jsx içe aktarır. */
import { useState, useEffect, useRef, useCallback, Fragment } from "react";
import { createPortal } from "react-dom";
import {
  ASSET, AV, quantile, TRACKS, TRACK_ASSET,
  CAR_CLASSES, CARS, trackName, carImg, carName, brandLogo,
  APP_VERSION, REPO_URL, PIE_COLORS,
} from "./constants";
import { msToLocalInput } from "./engine";
import { SETUP_LIMITS, poolEmptyReason, lapDeltas } from "./setupPool";
import { trackOptions, classOptions, carOptions } from "./pickerOptions";
import { parseSvm, b64ToText, setupSummary, diffSetups, categorizeSetup,
  duckSetupToParsed } from "./setupParse";
import { renameTeam, syncMyTeamName, createSeason, deleteRace,
  leaveTeam, createTeam, joinTeam, getSetupBlob,
  getUserAvatar, saveTeamAsset, clearTeamAsset,
  removeMember, transferOwnership, regenerateJoinCode, deleteTeam, updateRace } from "./storage";
import { processImageFile, IMG_ACCEPT_TYPES } from "./imageUpload";
import { carAssetKey, teamLogoSrc } from "./teamAssets";
import { _bindConfirm, confirmDialog, promptDialog } from "./confirm";
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
/* Sohbet mesaj paneli (v2.0 · handoff-spec/ekranlar/11-sohbet.md sağ kolonu).
   Gün ayıracı + boş durum + avatar/ad/saat başlıklı balonlar + karakter sayaçlı
   giriş çubuğu. Kanallar listesi ChatModal'da (bu panel yalnız mesaj akışı). */
export function ChatPanel({
  msgs, h, t, lang, user, teamData, fmtClock, canManage,
  chatText, setChatText, onSend, onDelete, endRef,
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: h || "100%", minHeight: 0, fontFamily: "var(--rc-font-ui)" }}>
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10, minHeight: 0 }}>
        {!msgs.length && (
          <div style={{ margin: "auto", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 9, padding: 24 }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--rc-border-strong)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 4H4a1.5 1.5 0 0 0-1.5 1.5V16A1.5 1.5 0 0 0 4 17.5h3V21l4-3.5h9A1.5 1.5 0 0 0 21.5 16V5.5A1.5 1.5 0 0 0 20 4Z" /></svg>
            <div style={{ fontFamily: "var(--rc-font-display)", fontWeight: 700, fontSize: 18 }}>{t("Henüz mesaj yok")}</div>
            <div style={{ fontSize: 12, color: "var(--rc-text-3)", lineHeight: 1.7, maxWidth: 320 }}>{t("İlk yazan sen ol — bu kanaldaki mesajlar yarış boyunca takımda kalır.")}</div>
          </div>
        )}
        {msgs.map((m, i) => {
          const me = m.uid === user?.uid;
          const prev = msgs[i - 1];
          const newDay = !prev || new Date(prev.at || 0).toDateString() !== new Date(m.at || 0).toDateString();
          return (
            <Fragment key={m.id}>
              {newDay && (
                <span style={{ alignSelf: "center", fontSize: 10, color: "var(--rc-text-3)", border: "1px solid var(--rc-border)", borderRadius: 10, padding: "2px 12px", textTransform: "uppercase", letterSpacing: ".1em" }}>
                  {new Date(m.at || 0).toLocaleDateString(lang === "en" ? "en-GB" : "tr-TR", { day: "2-digit", month: "long" })}</span>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: me ? "flex-end" : "flex-start", maxWidth: "100%" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  {!me && <Avatar uid={m.uid} name={teamData?.names?.[m.uid] || m.name} photo={teamData?.photos?.[m.uid]} size={18} />}
                  <b style={{ fontFamily: "var(--rc-font-display)", fontSize: 12.5, fontWeight: 700 }}>{me ? t("Sen") : (teamData?.names?.[m.uid] || m.name || t("isimsiz"))}</b>
                  <span style={{ fontFamily: "var(--rc-font-display)", fontSize: 10.5, color: "var(--rc-text-3)" }}>{fmtClock(m.at || 0)}</span>
                  {(me || canManage) && <button onClick={() => onDelete(m.id)} title={t("Sil")} style={{ background: "none", border: "none", color: "var(--rc-text-3)", cursor: "pointer", fontSize: 11, lineHeight: 1, padding: 0 }}>✕</button>}
                </span>
                <span style={{ maxWidth: "min(560px,88%)", padding: "8px 13px", borderRadius: 12, fontSize: 13.5, lineHeight: 1.55, wordBreak: "break-word", whiteSpace: "pre-wrap",
                  border: `1px solid ${me ? "var(--rc-brand-bright)" : "var(--rc-border)"}`, background: me ? "rgba(150,0,24,.20)" : "var(--rc-surface-3)", color: "var(--rc-text)" }}>{m.text}</span>
              </div>
            </Fragment>
          );
        })}
        <div ref={endRef} />
      </div>
      <div style={{ padding: "12px 18px", borderTop: "1px solid var(--rc-border)", display: "flex", gap: 10, alignItems: "center" }}>
        <input type="text" value={chatText} maxLength={500} placeholder={t("Mesaj yaz…  (Enter gönderir)")}
          onChange={(e) => setChatText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
          style={{ flex: 1, background: "var(--rc-surface-3)", border: "1px solid var(--rc-border)", borderRadius: 10, color: "var(--rc-text)", padding: "11px 14px", fontSize: 14 }} />
        <span style={{ fontSize: 10.5, color: "var(--rc-text-3)", fontFamily: "var(--rc-font-display)" }}>{chatText.length}/500</span>
        <button onClick={onSend} disabled={!chatText.trim()}
          style={{ padding: "11px 22px", borderRadius: 10, border: "1px solid var(--rc-brand-bright)", background: "var(--rc-brand)", color: "var(--rc-on-brand)", cursor: chatText.trim() ? "pointer" : "default", fontFamily: "var(--rc-font-display)", fontSize: 15, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", opacity: chatText.trim() ? 1 : .45 }}>{t("Gönder")}</button>
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
  /* Gruplama (spec: Ekranlar / Yarışlar / Komutlar) — grup sırası ilk görülüşe göre;
     seçim index'i düz `filtered` sırası üzerinden (klavye gezinimi bozulmaz). */
  const groups = [];
  filtered.forEach((a, i) => {
    const key = a.group || t("Komutlar");
    let g = groups.find((x) => x.title === key);
    if (!g) { g = { title: key, items: [] }; groups.push(g); }
    g.items.push({ a, i });
  });
  return (
    <div onClick={onClose} role="dialog" aria-modal="true" aria-label={t("Komut paleti")}
      style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(10,6,10,.7)", backdropFilter: "blur(5px)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "96px 24px 24px" }}>
      <div onClick={(e) => e.stopPropagation()} onKeyDown={onKey}
        style={{ width: "min(620px,96vw)", background: "var(--rc-surface)", border: "1px solid var(--rc-border-strong)", borderRadius: 14, overflow: "hidden", boxShadow: "0 24px 70px rgba(0,0,0,.6)", animation: "rcpop .24s cubic-bezier(.2,.9,.3,1.1)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderBottom: "1px solid var(--rc-border)" }}>
          <span style={{ fontSize: 15, color: "var(--rc-text-3)" }}>🔎</span>
          <input ref={inputRef} type="text" value={q} placeholder={t("Yarış, ekran veya komut ara…")}
            onChange={(e) => setQ(e.target.value)} aria-label={t("Komut ara")}
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--rc-text)", fontSize: 16 }} />
          <b style={{ fontFamily: "var(--rc-font-display)", fontSize: 10, border: "1px solid var(--rc-border)", borderRadius: 5, padding: "2px 6px", color: "var(--rc-text-3)" }}>esc</b>
        </div>
        <div style={{ maxHeight: "52vh", overflowY: "auto", padding: 8 }} role="listbox">
          {!filtered.length && (
            <div style={{ padding: "12px 14px", color: "var(--rc-text-3)", fontSize: 13 }}>{t("Sonuç yok")}</div>)}
          {groups.map((g) => (
            <div key={g.title} style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 9.5, textTransform: "uppercase", letterSpacing: ".12em", color: "var(--rc-text-3)", padding: "8px 12px 5px" }}>{g.title}</div>
              {g.items.map(({ a, i }) => {
                const on = i === sel;
                return (
                  <button key={a.id} role="option" aria-selected={on}
                    onMouseEnter={() => setSel(i)} onClick={() => run(a)}
                    style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 12px", borderRadius: 9, cursor: "pointer", color: "var(--rc-text)",
                      border: `1px solid ${on ? "var(--rc-border-strong)" : "transparent"}`, background: on ? "var(--rc-surface-3)" : "transparent" }}>
                    <span style={{ width: 26, textAlign: "center", fontSize: 14, flex: "0 0 auto" }} aria-hidden="true">{a.icon}</span>
                    <span style={{ flex: 1, minWidth: 0, textAlign: "left", fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.label}</span>
                    {a.hint && <span style={{ fontFamily: "var(--rc-font-display)", fontSize: 10, border: "1px solid var(--rc-border)", borderRadius: 5, padding: "2px 6px", color: "var(--rc-text-3)", flex: "0 0 auto" }}>{a.hint}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* Türkçe karakter DUYARSIZ normalizasyon (üye arama · fiş §5): İ/ı→i, Ş/ş→s,
   Ö/ö→o, Ü/ü→u, Ğ/ğ→g, Ç/ç→c. toLocaleLowerCase("tr") İ/I ayrımını doğru çözer,
   ardından diakritikler sadeleşir → "sen" araması "Şen"i bulur. Saf → test edilebilir. */
export const normalizeTr = (s) => (s || "").toLocaleLowerCase("tr")
  .replace(/ı/g, "i").replace(/ş/g, "s").replace(/ö/g, "o")
  .replace(/ü/g, "u").replace(/ğ/g, "g").replace(/ç/g, "c");

/* Üye yönetimi (site geneli erişim onayı) — spec katmanlar/adminOpen. Arama + filtre
   çipleri + durum rozeti + eylem butonu. allUsers = {uid:{name,email,photo,allowed,
   requested,admin,requestedAt,lastSeen?}}. onToggle(uid, yeniAllowed). */
export function AdminModal({ open, onClose, users, meUid, onToggle, t, lang }) {
  const [q, setQ] = useState("");
  const [flt, setFlt] = useState("all");   // all | wait | ok
  if (!open) return null;
  const stOf = (u) => (u?.admin === true ? "admin" : u?.allowed ? "ok" : u?.requested ? "wait" : "none");
  const list = Object.entries(users || {})
    .map(([uid, u]) => ({ uid, u, st: stOf(u) }))
    .sort((a, b) => (b.u?.requestedAt || 0) - (a.u?.requestedAt || 0));
  const nAll = list.length;
  const nWait = list.filter((x) => x.st === "wait").length;
  const nOk = list.filter((x) => x.st === "ok" || x.st === "admin").length;
  const ql = normalizeTr(q.trim());   // arama Türkçe karakter duyarsız (fiş §5)
  const rows = list.filter((x) => {
    if (flt === "wait" && x.st !== "wait") return false;
    if (flt === "ok" && !(x.st === "ok" || x.st === "admin")) return false;
    if (ql && !(normalizeTr(x.u?.name).includes(ql) || normalizeTr(x.u?.email || x.uid).includes(ql))) return false;
    return true;
  });
  const initials = (u, uid) => {
    const s = (u?.name || u?.email || uid || "?").trim();
    const parts = s.split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || s[0]?.toUpperCase() || "?";
  };
  const stColor = (st) => (st === "admin" ? "var(--rc-purple)" : st === "ok" ? "var(--rc-ok)" : st === "wait" ? "var(--rc-warn)" : "var(--rc-text-3)");
  const stLabel = (st) => (st === "admin" ? "🛡 admin" : st === "ok" ? t("erişim var") : st === "wait" ? t("beklemede") : t("talep yok"));
  const fchip = (on, col) => ({ padding: "7px 13px", borderRadius: 99, cursor: "pointer", fontSize: 12,
    border: `1px solid ${on ? "var(--rc-brand-bright)" : "var(--rc-border)"}`,
    background: on ? "rgba(150,0,24,.22)" : "var(--rc-surface-3)", color: on ? "var(--rc-text)" : col });
  /* Son görülme — zaman damgasından türet (fiş §7): <1dk şimdi · <60dk N dk ·
     <24sa N sa · <48sa dün · sonrası "g.aa" (14 Ağu). */
  const seenTxt = (u) => {
    const ts = u?.lastSeen || u?.requestedAt;
    if (!ts) return "";
    const d = Date.now() - ts;
    if (d < 60_000) return t("şimdi");
    if (d < 3_600_000) return `${Math.floor(d / 60_000)} ${t("dk")}`;
    if (d < 86_400_000) return `${Math.floor(d / 3_600_000)} ${t("sa")}`;
    if (d < 172_800_000) return t("dün");
    return new Date(ts).toLocaleDateString(lang === "en" ? "en-GB" : "tr-TR", { day: "numeric", month: "short" });
  };
  return (
    <div onClick={onClose} role="dialog" aria-modal="true"
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(10,6,10,.74)", backdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, animation: "rcfade .18s ease" }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: "min(720px,96vw)", maxHeight: "86vh", background: "var(--rc-surface)", border: "1px solid var(--rc-border-strong)", borderRadius: 16, overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 24px 70px rgba(0,0,0,.6)", animation: "rcpop .24s cubic-bezier(.2,.9,.3,1.1)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: "1px solid var(--rc-border)", flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--rc-font-display)", textTransform: "uppercase", letterSpacing: ".07em", fontSize: 19, fontWeight: 700 }}>🛡 {t("Üye yönetimi")}</span>
          <span style={{ color: "var(--rc-text-3)", fontSize: 12 }}>{t("Site geneli erişim onayı")}</span>
          <button onClick={onClose} style={{ marginLeft: "auto", width: 32, height: 32, borderRadius: 9, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 15, lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 20px", borderBottom: "1px solid var(--rc-border)", flexWrap: "wrap" }}>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("E-posta veya ad ara…")}
            style={{ flex: 1, minWidth: 180, background: "var(--rc-surface-3)", border: "1px solid var(--rc-border)", borderRadius: 9, color: "var(--rc-text)", fontSize: 12.5, padding: "8px 12px" }} />
          <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button onClick={() => setFlt("all")} style={fchip(flt === "all", "var(--rc-text-2)")}>{t("Tümü")} {nAll}</button>
            <button onClick={() => setFlt("wait")} style={{ ...fchip(flt === "wait", "var(--rc-warn)"), color: "var(--rc-warn)" }}>{t("Beklemede")} {nWait}</button>
            <button onClick={() => setFlt("ok")} style={fchip(flt === "ok", "var(--rc-text-2)")}>{t("Erişim var")} {nOk}</button>
          </span>
        </div>
        <div style={{ overflowY: "auto" }}>
          {!rows.length && <div style={{ padding: "18px 20px", color: "var(--rc-text-3)", fontSize: 12.5 }}>{t("Kayıt yok.")}</div>}
          {rows.map(({ uid, u, st }, i) => (
            <div key={uid} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderBottom: "1px solid var(--rc-line-soft)", background: i % 2 === 0 ? "rgba(255,255,255,.02)" : "transparent" }}>
              <span style={{ width: 32, height: 32, borderRadius: "50%", flex: "0 0 auto", background: "var(--rc-surface-3)", border: "1px solid var(--rc-border-strong)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 11 }}>{initials(u, uid)}</span>
              <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
                <b style={{ fontSize: 13.5 }}>{u?.name || "—"}</b>
                <span style={{ fontSize: 11, color: "var(--rc-text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u?.email || uid}</span>
              </span>
              <span style={{ fontSize: 11, color: "var(--rc-text-3)", flex: "0 0 auto" }}>{seenTxt(u)}</span>
              <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".08em", padding: "3px 10px", borderRadius: 99, whiteSpace: "nowrap", flex: "0 0 auto", border: `1px solid ${stColor(st)}`, color: stColor(st) }}>{stLabel(st)}</span>
              {uid !== meUid && st !== "admin" ? (
                <button onClick={() => onToggle(uid, !u?.allowed)}
                  style={st === "ok"
                    ? { padding: "7px 14px", borderRadius: 9, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text-2)", fontSize: 12, cursor: "pointer", flex: "0 0 auto" }
                    : { padding: "7px 14px", borderRadius: 9, border: "1px solid var(--rc-brand-bright)", background: "var(--rc-brand)", color: "var(--rc-on-brand)", fontSize: 12, fontWeight: 600, cursor: "pointer", flex: "0 0 auto" }}>
                  {st === "ok" ? t("Erişimi al") : t("Erişim ver")}</button>
              ) : (
                <button disabled style={{ padding: "7px 14px", borderRadius: 9, border: "1px solid transparent", background: "transparent", color: "var(--rc-border-strong)", fontSize: 11.5, cursor: "default", flex: "0 0 auto" }}>{st === "admin" ? t("korumalı") : ""}</button>
              )}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 20px", borderTop: "1px solid var(--rc-border)", background: "var(--rc-surface-2)" }}>
          <span style={{ color: "var(--rc-text-3)", fontSize: 11.5 }}>{t("Adminler birbirinin iznine dokunamaz")}</span>
          <button onClick={onClose} style={{ marginLeft: "auto", padding: "9px 20px", borderRadius: 10, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text)", cursor: "pointer", fontSize: 13 }}>{t("Kapat")}</button>
        </div>
      </div>
    </div>
  );
}

/* Rol/rozet ikon seti (rozet fişi · çizgi SVG) — emoji yerine. currentColor kullanır,
   renk üst elemandan gelir; 12px altında stroke-width 1.9, üstünde 1.7. */
const ROLE_PATHS = {
  drv: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3.1" /><path d="M12 15.1V21M9.1 10.6 4 7.9M14.9 10.6 20 7.9" /></>,
  eng: <><path d="M4 14v-2.4a8 8 0 0 1 16 0V14" /><path d="M4 13.2h1.9a1 1 0 0 1 1 1v3.4a1 1 0 0 1-1 1H4.9A1.9 1.9 0 0 1 3 16.7v-1.6a1.9 1.9 0 0 1 1-1.9ZM20 13.2h-1.9a1 1 0 0 0-1 1v3.4a1 1 0 0 0 1 1h1a1.9 1.9 0 0 0 1.9-1.9v-1.6a1.9 1.9 0 0 0-1-1.9Z" /><path d="M11.6 20.6h2.3a2 2 0 0 0 2-2v-.6" /></>,
  owner: <path d="M3 8.4l4 3.4 5-7.4 5 7.4 4-3.4-1.9 10.2H4.9L3 8.4Z" />,
  pod: <><path d="M7.4 3.6h9.2v5.1a4.6 4.6 0 0 1-9.2 0V3.6Z" /><path d="M7.4 5.1H4.6v1.6a3.2 3.2 0 0 0 2.8 3.1M16.6 5.1h2.8v1.6a3.2 3.2 0 0 1-2.8 3.1" /><path d="M12 13.3v3.6M8.4 20.4h7.2l-.7-3.5H9.1l-.7 3.5Z" /></>,
  setup: <><path d="M8.4 3.6h9a1.6 1.6 0 0 1 1.6 1.6v11.6a1.6 1.6 0 0 1-1.6 1.6h-9A1.6 1.6 0 0 1 6.8 16.8V5.2a1.6 1.6 0 0 1 1.6-1.6Z" /><path d="M4.2 6.8v12a1.6 1.6 0 0 0 1.6 1.6h9.4M10 7.6h5.4M10 11h5.4M10 14.4h3.2" /></>,
  clock: <><circle cx="12" cy="13.4" r="7.6" /><path d="M12 9.6v3.8l2.6 1.9M10.2 3.2h3.6M12 3.2v2.6M18.4 6l1.5-1.5" /></>,
};
export function RoleIcon({ name, size = 14 }) {
  const p = ROLE_PATHS[name];
  if (!p) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={size < 12 ? 1.9 : 1.7} strokeLinecap="round" strokeLinejoin="round"
      style={{ flex: "0 0 auto" }} aria-hidden="true">{p}</svg>
  );
}

/* Rozetler — rol ikonları RoleIcon (çizgi SVG) ile; renkler rozet fişinden. */
export const BADGES = {
  admin:    { lbl: "Admin",            ico: "🛡",                            col: "#E11D2E", bg: "rgba(225,29,46,.14)" },
  owner:    { lbl: "Takım Sahibi",     ico: <RoleIcon name="owner" />,       col: "#F5B23D", bg: "rgba(245,178,61,.14)" },
  driver:   { lbl: "Sürücü",           ico: <RoleIcon name="drv" />,         col: "#4C9AFF", bg: "rgba(76,154,255,.14)" },
  engineer: { lbl: "Yarış Mühendisi",  ico: <RoleIcon name="eng" />,         col: "#37D67A", bg: "rgba(55,214,122,.14)" },
  podium:   { lbl: "Podyum",           ico: <RoleIcon name="pod" />,         col: "#B58BFF", bg: "rgba(181,139,255,.14)" },
  setup:    { lbl: "Setup katkısı",    ico: <RoleIcon name="setup" />,       col: "#EF8A2B", bg: "rgba(239,138,43,.14)" },
  clock:    { lbl: "24H bitirdi",      ico: <RoleIcon name="clock" />,       col: "#A88C93", bg: "rgba(168,140,147,.14)" },
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

/* ═══════════ Rehber (koçmark turu) — rehber fişi ═══════════
   Uygulamanın üstünde açılan 11 adımlı tanıtım turu. Her adım arkadaki ekranı
   o bölüme geçirir (onGo), sol menüdeki ilgili düğmeyi spot ışığıyla işaretler
   (data-tour çapası) ve panelde bölüme özel bir animasyon oynatır. */
const TOUR = [
  { id: "welcome", scr: null, anchor: null, label: "Hoş geldin", title: "Caspian'a hoş geldin",
    body: "Bu tur pit-wall'ın bölümlerini tek tek gezdirir. İleri ok ya da noktalarla ilerle; istediğin an Esc ile çık." },
  { id: "dash", scr: "dash", anchor: "nav-dash", label: "Dash", title: "Dash · yarışın tek ekran özeti",
    body: "Bayrağa kalan süre, sıradaki pit, pozisyon ve enerji yan yana durur. Yarış sırasında en çok bakılan ekran bu; diğer bölümlere buradan dallanırsın." },
  { id: "stint", scr: "stint", anchor: "nav-stint", label: "Stint", title: "Stint · yakıt ve pit planı",
    body: "Stint uzunlukları, yakıt/VE tüketimi ve pit anları burada planlanır; zaman çizelgesi planı görselleştirir." },
  { id: "live", scr: "live", anchor: "nav-live", label: "Canlı", title: "Canlı · gerçek zamanlı timing",
    body: "Sahadaki tüm araçların pozisyon, tur ve sektör verisi köprüden canlı akar." },
  { id: "tyre", scr: "tyre", anchor: "nav-tyre", label: "Lastik", title: "Lastik · set ve sıcaklık",
    body: "Set envanteri, köşe sıcaklıkları ve stint ataması; hangi sete hangi stintte gireceğini planla." },
  { id: "drivers", scr: "drivers", anchor: "nav-drivers", label: "Pilot", title: "Pilot · sürüş dağılımı",
    body: "Sürücüleri stintlere ata, uygunlukları işaretle; sürüş süresi dengesi grafikte görünür." },
  { id: "tele", scr: "tele", anchor: "nav-tele", label: "Tele", title: "Tele · telemetri karşılaştırma",
    body: "İki turu mesafe ekseninde üst üste bindir; hız, gaz, fren ve delta eğrilerini karşılaştır." },
  { id: "setup", scr: "setup", anchor: "nav-setup", label: "Setup", title: "Setup · havuz ve karşılaştırma",
    body: "Takımın setup havuzuna yükle, içerikleri incele ve iki setupu alan alan karşılaştır." },
  { id: "team", scr: "team", anchor: "nav-team", label: "Takım", title: "Takım · üyeler ve yetkiler",
    body: "Üyeleri yönet, sürücü/mühendis rozetleriyle yetki ver; sezon takvimini düzenle." },
  { id: "sys", scr: "sys", anchor: "topbar-bridge", label: "Sistem", title: "Sistem · bağlantı durumu",
    body: "Köprü ve oyun bağlantısının canlı durumu; kesinti olduğunda buradan görürsün." },
  { id: "done", scr: null, anchor: null, label: "Bitirme", title: "Hazırsın!",
    body: "Tur tamam. Bu rehbere istediğin an üst bardaki ? düğmesinden dönebilirsin. İyi yarışlar!" },
];
export const TOUR_FOR = { dash: 1, stint: 2, fuel: 2, live: 3, tyre: 4, drivers: 5, tele: 6, setup: 7, team: 8, sys: 9 };

/* Adım animasyonu (112px panel içi) — rehber fişi §8 tablosu. */
function TourAnim({ id }) {
  const box = { height: 112, border: "1px solid var(--rc-border)", borderRadius: 10, background: "var(--rc-surface-inset)", overflow: "hidden", padding: 14, marginBottom: 13, position: "relative", boxSizing: "border-box" };
  let inner = null;
  if (id === "welcome") {
    inner = (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(8,1fr)", gridTemplateRows: "repeat(2,1fr)", gap: 3, height: "100%" }}>
        {Array.from({ length: 16 }).map((_, i) => { const col = i % 8; const dark = (Math.floor(i / 8) + col) % 2; return <span key={i} style={{ background: dark ? "var(--rc-text)" : "var(--rc-surface-3)", borderRadius: 2, animation: `tgCell 2.4s ${col * 0.11}s ease-in-out infinite` }} />; })}
      </div>);
  } else if (id === "dash") {
    const cols = ["var(--rc-danger)", "var(--rc-warn)", "var(--rc-ok)", "var(--rc-info)"];
    inner = (
      <div style={{ display: "flex", gap: 8, height: "100%", alignItems: "stretch" }}>
        {cols.map((c, i) => (
          <div key={i} style={{ flex: 1, border: "1px solid var(--rc-border)", borderRadius: 6, background: "var(--rc-surface-3)", display: "flex", alignItems: "flex-end", padding: 8, animation: `tgUp 2.6s ${i * 0.13}s ease-in-out infinite` }}>
            <span style={{ height: 4, borderRadius: 2, width: "100%", background: c, transformOrigin: "left", animation: `tgFill 2.6s ${i * 0.13}s ease-in-out infinite` }} />
          </div>))}
      </div>);
  } else if (id === "stint") {
    inner = (
      <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", gap: 10 }}>
        <div style={{ height: 8, borderRadius: 4, background: "var(--rc-track-2)", overflow: "hidden" }}>
          <span style={{ display: "block", height: "100%", background: "var(--rc-brand)", transformOrigin: "left", animation: "tgDrain 3s ease-in-out infinite" }} /></div>
        <div style={{ display: "flex", gap: 4 }}>{Array.from({ length: 6 }).map((_, i) => <span key={i} style={{ flex: 1, height: 16, borderRadius: 3, background: i % 2 ? "var(--rc-surface-3)" : "var(--rc-brand-deep, #5E0B18)" }} />)}</div>
        <span style={{ position: "absolute", top: 12, bottom: 12, width: 3, background: "var(--rc-warn)", animation: "tgSweepX 3s linear infinite" }} />
      </div>);
  } else if (id === "live") {
    inner = (
      <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", gap: 6 }}>
        {[0, 1, 2].map((r) => <div key={r} style={{ height: 20, borderRadius: 6, border: "1px solid var(--rc-line-soft)", background: "var(--rc-surface-3)", animation: r === 0 ? "tgRowUp 2.8s ease-in-out infinite" : r === 1 ? "tgRowDn 2.8s ease-in-out infinite" : "none" }} />)}
      </div>);
  } else if (id === "tyre") {
    inner = (
      <div style={{ display: "flex", gap: 14, height: "100%", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,26px)", gridTemplateRows: "repeat(2,26px)", gap: 6 }}>
          {Array.from({ length: 4 }).map((_, i) => <span key={i} style={{ borderRadius: 5, animation: `tgHeat 2.6s ${i * 0.18}s ease-in-out infinite` }} />)}</div>
        <span style={{ fontFamily: "var(--rc-font-display)", fontSize: 24, fontWeight: 700, color: "var(--rc-warn)", animation: "tgVal 2.6s ease-in-out infinite" }}>84°</span>
      </div>);
  } else if (id === "drivers") {
    const badge = { width: 40, height: 40, borderRadius: 10, border: "1px solid var(--rc-border)", display: "inline-flex", alignItems: "center", justifyContent: "center" };
    inner = (
      <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 18, position: "relative" }}>
        <span style={{ ...badge, color: "var(--rc-info)", animation: "tgGlowA 2.6s ease-in-out infinite" }}><RoleIcon name="drv" size={18} /></span>
        <span style={{ position: "absolute", top: "50%", width: 3, height: 22, transform: "translateY(-50%)", background: "var(--rc-warn)", animation: "tgSweepX 2.6s ease-in-out infinite" }} />
        <span style={{ ...badge, color: "var(--rc-ok)", animation: "tgGlowB 2.6s ease-in-out infinite" }}><RoleIcon name="eng" size={18} /></span>
      </div>);
  } else if (id === "tele") {
    inner = (
      <svg viewBox="0 0 240 84" style={{ width: "100%", height: "100%", display: "block" }}>
        <polyline points="4,60 40,40 76,48 112,22 148,34 184,16 236,26" fill="none" stroke="var(--rc-danger-2)" strokeWidth="2.2" strokeLinejoin="round" strokeDasharray="420" style={{ animation: "tgDraw 3s ease-in-out infinite" }} />
        <polyline points="4,66 40,52 76,44 112,40 148,28 184,32 236,18" fill="none" stroke="var(--rc-delta)" strokeWidth="2.2" strokeLinejoin="round" strokeDasharray="420" style={{ animation: "tgDraw 3s .25s ease-in-out infinite" }} />
        <rect x="4" y="74" width="232" height="6" rx="3" fill="var(--rc-track-2)" />
        <rect x="4" y="74" height="6" rx="3" fill="var(--rc-warn)" width="150" style={{ transformOrigin: "left", animation: "tgFill 3s ease-in-out infinite" }} />
      </svg>);
  } else if (id === "setup") {
    inner = (
      <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", gap: 14 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ position: "relative", height: 6, borderRadius: 3, background: "var(--rc-track-2)" }}>
            <span style={{ position: "absolute", top: "50%", transform: "translateY(-50%)", width: 14, height: 14, borderRadius: "50%", background: "var(--rc-brand-bright)", animation: `tgKnob 2.8s ${i * 0.2}s ease-in-out infinite` }} />
          </div>))}
      </div>);
  } else if (id === "team") {
    const tb = { width: 28, height: 22, borderRadius: 6, display: "inline-flex", alignItems: "center", justifyContent: "center" };
    inner = (
      <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", gap: 12 }}>
        {[0, 1].map((r) => (
          <div key={r} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--rc-surface-3)", flex: "0 0 auto" }} />
            <span style={{ flex: 1, height: 8, borderRadius: 4, background: "var(--rc-track-2)" }} />
            <span style={{ ...tb, animation: `tgOn 2.8s ${r * 0.2}s ease-in-out infinite` }}><RoleIcon name="drv" size={13} /></span>
            <span style={{ ...tb, animation: `tgOn2 2.8s ${r * 0.2}s ease-in-out infinite` }}><RoleIcon name="eng" size={13} /></span>
          </div>))}
      </div>);
  } else if (id === "sys") {
    inner = (
      <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "center", height: "100%" }}>
        {[0, 1, 2, 3, 4].map((i) => <span key={i} style={{ width: 13, height: 13, borderRadius: "50%", background: "var(--rc-ok)", animation: i === 3 ? "tgWarn 2.8s ease-in-out infinite" : `tgDot 1.8s ${i * 0.2}s ease-in-out infinite` }} />)}
      </div>);
  } else if (id === "done") {
    inner = (
      <div style={{ height: "100%", display: "grid", placeItems: "center", position: "relative" }}>
        <span style={{ position: "absolute", width: 46, height: 46, borderRadius: "50%", border: "2px solid var(--rc-ok)", animation: "tgRingOut 2.4s ease-out infinite" }} />
        <svg viewBox="0 0 24 24" width="42" height="42" fill="none" stroke="var(--rc-ok)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.2 4.2L19 7" strokeDasharray="44" style={{ animation: "tgCheck 2.4s ease-in-out infinite" }} /></svg>
      </div>);
  }
  return <div className={`tg-anim-${id}`} style={box}>{inner}</div>;
}

export function CoachTour({ open, start = 0, onClose, onGo, t }) {
  const [idx, setIdx] = useState(start);
  const [dir, setDir] = useState(1);
  const [auto, setAuto] = useState(false);
  const [rect, setRect] = useState(null);
  const idxRef = useRef(idx); idxRef.current = idx;
  const onGoRef = useRef(onGo); onGoRef.current = onGo;

  const go = useCallback((n) => {
    const c = Math.max(0, Math.min(TOUR.length - 1, n));
    setDir(c >= idxRef.current ? 1 : -1);
    setIdx(c);
    if (TOUR[c].scr) onGoRef.current?.(TOUR[c].scr);
  }, []);

  /* açılışta baştaki adıma dön + o ekrana geç */
  useEffect(() => {
    if (!open) return;
    setIdx(start); setDir(1); setAuto(false);
    if (TOUR[start]?.scr) onGoRef.current?.(TOUR[start].scr);
  }, [open, start]);

  /* ölçüm — ekran oturduktan sonra (rAF); eşitlik kontrolü sonsuz döngüyü önler */
  const measure = useCallback(() => {
    const st = TOUR[idxRef.current];
    if (!st?.anchor) { setRect((o) => (o ? null : o)); return; }
    const el = document.querySelector(`[data-tour="${st.anchor}"]`);
    if (!el) { setRect((o) => (o ? null : o)); return; }
    const r = el.getBoundingClientRect();
    const nx = { t: Math.round(r.top), l: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height) };
    setRect((o) => (!o || o.t !== nx.t || o.l !== nx.l || o.w !== nx.w || o.h !== nx.h ? nx : o));
  }, []);
  useEffect(() => {
    if (!open) return undefined;
    const raf = requestAnimationFrame(measure);
    const raf2 = requestAnimationFrame(() => requestAnimationFrame(measure)); // rail animasyonu bitince
    return () => { cancelAnimationFrame(raf); cancelAnimationFrame(raf2); };
  }, [idx, open, measure]);
  useEffect(() => {
    if (!open) return undefined;
    const onRz = () => measure();
    window.addEventListener("resize", onRz);
    return () => window.removeEventListener("resize", onRz);
  }, [open, measure]);

  /* otomatik oynatma — 4.8 s; son adımda kapanır */
  useEffect(() => {
    if (!open || !auto) return undefined;
    const id = setInterval(() => {
      if (idxRef.current >= TOUR.length - 1) { setAuto(false); return; }
      go(idxRef.current + 1);
    }, 4800);
    return () => clearInterval(id);
  }, [open, auto, go]);

  /* klavye — capture: tur açıkken Cmd+K ve telemetri okları gölgelenir */
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); e.stopPropagation(); go(idxRef.current + 1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); e.stopPropagation(); go(idxRef.current - 1); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, go, onClose]);

  if (!open) return null;
  const step = TOUR[idx];
  const last = idx >= TOUR.length - 1;
  const ring = rect
    ? { position: "fixed", left: rect.l - 6, top: rect.t - 6, width: rect.w + 12, height: rect.h + 12, borderRadius: 14, border: "1px solid var(--rc-brand-bright)", boxShadow: "0 0 0 9999px rgba(9,6,7,.82), 0 0 24px rgba(210,67,87,.5)", zIndex: 200, transition: "left .34s cubic-bezier(.4,0,.2,1), top .34s cubic-bezier(.4,0,.2,1), width .34s, height .34s", pointerEvents: "none" }
    : { position: "fixed", inset: 0, background: "rgba(9,6,7,.86)", zIndex: 200 };
  const footBtn = (primary) => ({ padding: "7px 13px", borderRadius: 8, cursor: "pointer", fontSize: 11.5, whiteSpace: "nowrap", fontFamily: "inherit", border: `1px solid ${primary ? "var(--rc-brand-bright)" : "var(--rc-border)"}`, background: primary ? "var(--rc-brand)" : "var(--rc-surface-3)", color: primary ? "var(--rc-on-brand)" : "var(--rc-text-2)" });

  return createPortal(
    <div className="rc" style={{ display: "contents" }}>
      {/* karartma + spot ışığı */}
      <div style={ring} aria-hidden="true" />
      {/* etkileşim yutucu (panel dışı tık) */}
      <div onClick={(e) => e.stopPropagation()} style={{ position: "fixed", inset: 0, zIndex: 199 }} aria-hidden="true" />
      {/* panel */}
      <div role="dialog" aria-modal="true" aria-label={t("Rehber")}
        style={{ position: "fixed", right: 22, top: "50%", transform: "translateY(-50%)", zIndex: 201, display: "flex", width: 580, maxWidth: "calc(100vw - 44px)", maxHeight: "calc(100vh - 44px)", border: "1px solid var(--rc-border-strong)", borderRadius: 14, overflow: "hidden", background: "var(--rc-surface-2)", boxShadow: "0 26px 64px rgba(0,0,0,.66)", fontFamily: "var(--rc-font-ui)" }}>
        {/* sol: bölümler */}
        <div style={{ flex: "0 0 174px", borderRight: "1px solid var(--rc-border)", background: "var(--rc-surface)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "12px 14px 8px", fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--rc-text-3)" }}>{t("Bölümler")}</div>
          <div style={{ overflowY: "auto", padding: "0 8px 8px" }}>
            {TOUR.map((s, i) => {
              const on = i === idx;
              return (
                <button key={s.id} onClick={() => go(i)}
                  style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "8px 10px", borderRadius: 8, cursor: "pointer", textAlign: "left", marginBottom: 1,
                    border: `1px solid ${on ? "var(--rc-border-strong)" : "transparent"}`, background: on ? "var(--rc-surface-3)" : "transparent", color: on ? "var(--rc-text)" : "var(--rc-text-3)" }}>
                  <b style={{ fontFamily: "var(--rc-font-display)", fontSize: 11, color: on ? "var(--rc-brand-bright)" : "var(--rc-text-3)" }}>{String(i + 1).padStart(2, "0")}</b>
                  <span style={{ fontSize: 12.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t(s.label)}</span>
                </button>);
            })}
          </div>
        </div>
        {/* sağ */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 14px 0" }}>
            <span style={{ fontFamily: "var(--rc-font-display)", textTransform: "uppercase", letterSpacing: ".1em", fontSize: 12, fontWeight: 700, color: "var(--rc-brand-bright)" }}>{t("Rehber")}</span>
            <span style={{ fontFamily: "var(--rc-font-display)", fontSize: 12, color: "var(--rc-text-3)", whiteSpace: "nowrap" }}>{idx + 1} / {TOUR.length}</span>
            <button onClick={onClose} style={{ marginLeft: "auto", width: 28, height: 28, borderRadius: 8, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 14, lineHeight: 1 }}>✕</button>
          </div>
          <div style={{ height: 3, background: "var(--rc-track, var(--rc-line-soft))", margin: "10px 14px 0", borderRadius: 2, overflow: "hidden" }}>
            <span style={{ display: "block", height: "100%", background: "var(--rc-brand-bright)", width: `${((idx + 1) / TOUR.length) * 100}%`, transition: "width .32s" }} /></div>
          <div style={{ padding: "13px 14px", overflowY: "auto", flex: 1, minWidth: 0 }}>
            <div key={idx} style={{ animation: `tgIn${dir > 0 ? "R" : "L"}${idx % 2 ? "b" : "a"} .38s cubic-bezier(.2,.7,.3,1) both` }}>
              <TourAnim id={step.id} />
              <div style={{ fontFamily: "var(--rc-font-display)", fontWeight: 700, fontSize: 18, marginBottom: 6 }}>{t(step.title)}</div>
              <div style={{ fontSize: 13, color: "var(--rc-text-2)", lineHeight: 1.6 }}>{t(step.body)}</div>
            </div>
          </div>
          {/* alt kontroller */}
          <div style={{ marginTop: "auto", borderTop: "1px solid var(--rc-border)", padding: "11px 14px", display: "flex", flexDirection: "column", gap: 9 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button onClick={() => go(idx - 1)} style={{ ...footBtn(false), opacity: idx === 0 ? .4 : 1 }}>‹ {t("Geri")}</button>
              <span style={{ flex: 1, display: "flex", gap: 5, justifyContent: "center", alignItems: "center" }}>
                {TOUR.map((_, i) => (
                  <button key={i} onClick={() => go(i)} aria-label={`${i + 1}`}
                    style={{ width: i === idx ? 18 : 6, height: 6, borderRadius: 99, border: "none", padding: 0, cursor: "pointer",
                      background: i === idx ? "var(--rc-brand-bright)" : i < idx ? "var(--rc-icon-off)" : "var(--rc-border)", transition: "width .26s, background .26s" }} />))}
              </span>
              <button onClick={() => (last ? onClose() : go(idx + 1))} style={footBtn(true)}>{last ? t("Bitir") : t("İleri ›")}</button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <button onClick={() => setAuto((a) => !a)}
                style={{ padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontSize: 11.5, border: `1px solid ${auto ? "var(--rc-ok)" : "var(--rc-border)"}`, background: auto ? "rgba(55,214,122,.14)" : "var(--rc-surface-3)", color: auto ? "var(--rc-ok)" : "var(--rc-text-2)" }}>{auto ? `‖ ${t("Duraklat")}` : `▶ ${t("Otomatik")}`}</button>
              {step.scr && <button onClick={() => { onGoRef.current?.(step.scr); onClose(); }} style={{ padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontSize: 11.5, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text-2)" }}>{t("Bu ekrana git")} ›</button>}
              <button onClick={onClose} style={{ marginLeft: "auto", padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontSize: 11.5, border: "none", background: "transparent", color: "var(--rc-text-3)" }}>{t("Rehberi atla")}</button>
            </div>
            <div style={{ fontSize: 10, color: "var(--rc-icon-off)" }}>{t("Ok tuşlarıyla gez · Esc ile çık")}</div>
          </div>
        </div>
      </div>
    </div>, document.body);
}

/* v2.0 stilli sayısal alan — ondalık girişte trailing "." kaybolmaz: odaktayken
   yerel metin (ham) tutulur, blur'da kanonik sayıya senkronlanır. onC sayı alır. */
export function NumField({ value, onC, step = "0.01", style, placeholder }) {
  const [txt, setTxt] = useState(value == null ? "" : String(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused) setTxt(value == null ? "" : String(value)); }, [value, focused]);
  return (
    <input type="number" step={step} value={txt} style={style} placeholder={placeholder}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      onChange={(e) => { setTxt(e.target.value); const n = parseFloat(e.target.value); onC(Number.isFinite(n) ? n : 0); }} />
  );
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
  saveSetup, onCancel,
}) {
  const [dragOn, setDragOn] = useState(false);   // sürükleme vurgusu
  const set = (patch) => setSuMeta({ ...suMeta, ...patch });
  const lbl = { display: "block", color: "var(--rc-text-3)", fontSize: 10, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 6 };
  const inp = { width: "100%", boxSizing: "border-box", background: "var(--rc-surface-3)", border: "1px solid var(--rc-border)", borderRadius: 9, color: "var(--rc-text)", padding: "9px 11px", fontSize: 12.5, textTransform: "none" };
  const sel = { ...inp, cursor: "pointer" };
  const tog = (on) => ({ flex: 1, padding: "9px 8px", borderRadius: 9, cursor: "pointer", fontSize: 12.5, whiteSpace: "nowrap", border: `1px solid ${on ? "var(--rc-brand-bright)" : "var(--rc-border)"}`, background: on ? "rgba(150,0,24,.22)" : "var(--rc-surface-3)", color: on ? "var(--rc-text)" : "var(--rc-text-2)" });
  const trackChip = (on) => ({ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 11px", borderRadius: 9, cursor: "pointer", overflow: "hidden",
    border: `1px solid ${on ? "var(--rc-brand-bright)" : "var(--rc-border)"}`, background: on ? "rgba(150,0,24,.22)" : "var(--rc-surface-3)", color: on ? "var(--rc-text)" : "var(--rc-text-2)" });
  const canSave = !!suFile && !!suMeta.track && !suBusy;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* sürükle-bırak + önizleme kartı */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "stretch" }}>
        <div onDragOver={(e) => e.preventDefault()} onDragEnter={() => setDragOn(true)} onDragLeave={() => setDragOn(false)}
          onDrop={(e) => { setDragOn(false); onSetupDrop?.(e); }}
          style={{ flex: "1 1 300px", minWidth: 0, border: `1.5px dashed ${dragOn ? "var(--rc-brand-bright)" : "var(--rc-border-strong)"}`, borderRadius: 12, background: dragOn ? "rgba(150,0,24,.10)" : "var(--rc-surface-2)", padding: 16, display: "flex", flexDirection: "column", justifyContent: "center", textAlign: "center" }}>
          <div style={{ fontSize: 22, marginBottom: 5 }}>⬇</div>
          <div style={{ fontFamily: "var(--rc-font-display)", fontWeight: 700, fontSize: 15 }}>{t(".svm dosyasını sürükle")}</div>
          <div style={{ color: "var(--rc-text-3)", fontSize: 11, marginTop: 4, lineHeight: 1.6 }}>{t("Sınıf ve araç dosyanın içinden otomatik algılanır — elle seçtiklerin ezilmez")}</div>
          <label style={{ marginTop: 10, alignSelf: "center", padding: "7px 15px", borderRadius: 9, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text)", cursor: "pointer", fontSize: 12.5 }}>
            📁 {t("Dosya seç")}<input type="file" style={{ display: "none" }} onChange={onSetupFile} /></label>
          {suFile && <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--rc-text-2)" }}>📄 {suFile.name} · {(suFile.size / 1024).toFixed(1)} KB</div>}
        </div>
        <div style={{ flex: "0 1 250px", minWidth: 210, border: "1px solid var(--rc-border-strong)", borderRadius: 12, background: "radial-gradient(120% 160% at 100% 0,rgba(150,0,24,.22),var(--rc-surface-2) 62%)", padding: 14, textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          {suMeta.track && <img key={suMeta.track} src={`${ASSET}tracks/${TRACK_ASSET(suMeta.track)}.png`} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} style={{ display: "block", width: "100%", maxWidth: 180, height: 78, objectFit: "contain", margin: "0 auto 8px" }} />}
          {suMeta.car && <img src={carImg(suMeta.cls, suMeta.car)} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} style={{ display: "block", width: "100%", maxWidth: 170, height: 52, objectFit: "contain", margin: "0 auto 8px" }} />}
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, fontFamily: "var(--rc-font-display)", fontWeight: 700, fontSize: 15 }}>
            {suMeta.track && <img src={`${ASSET}flags/${TRACK_ASSET(suMeta.track)}.png`} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} style={{ width: 20, borderRadius: 2 }} />}
            {trackName(suMeta.track) || t("Pist seç")}</div>
          <div style={{ fontSize: 11, color: "var(--rc-text-3)", marginTop: 2 }}>{suMeta.car ? `${carName(suMeta.cls, suMeta.car)}${suMeta.cls ? ` · ${(classOptions().find((o) => o.value === suMeta.cls) || {}).label || suMeta.cls}` : ""}` : "—"}</div>
        </div>
      </div>

      {/* PIST çipleri */}
      <div>
        <label style={lbl}>{t("Pist")} *</label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(148px,1fr))", gap: 8, maxHeight: 168, overflowY: "auto" }}>
          {trackOptions().map((o) => (
            <button key={o.value} onClick={() => set({ track: o.value })} style={trackChip(suMeta.track === o.value)}>
              <img src={o.icon} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} style={{ width: 20, borderRadius: 2, flex: "0 0 auto" }} />
              <span style={{ fontSize: 12.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* koşul · seans · sınıf · araç */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 150px", minWidth: 0 }}>
          <label style={lbl}>{t("Koşul")}</label>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => set({ cond: "dry" })} style={tog(suMeta.cond === "dry")}>☀️ {t("Kuru")}</button>
            <button onClick={() => set({ cond: "wet" })} style={tog(suMeta.cond === "wet")}>🌧 Wet</button>
          </div>
        </div>
        <div style={{ flex: "1 1 150px", minWidth: 0 }}>
          <label style={lbl}>{t("Seans")}</label>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => set({ sess: "R" })} style={tog(suMeta.sess === "R")}>{t("Yarış")}</button>
            <button onClick={() => set({ sess: "Q" })} style={tog(suMeta.sess === "Q")}>{t("Sıralama")}</button>
          </div>
        </div>
        <div style={{ flex: "1 1 140px", minWidth: 0 }}>
          <label style={lbl}>{t("Sınıf")}</label>
          <select value={suMeta.cls} onChange={(e) => set({ cls: e.target.value, car: "" })} style={sel}>
            <option value="">—</option>
            {classOptions().map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div style={{ flex: "1 1 190px", minWidth: 0 }}>
          <label style={lbl}>{t("Araç")}</label>
          <select value={suMeta.car} disabled={!suMeta.cls} onChange={(e) => set({ car: e.target.value })} style={{ ...sel, opacity: suMeta.cls ? 1 : .5 }}>
            <option value="">—</option>
            {carOptions(suMeta.cls).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* şampiyona · lmu · tur · pilot */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 170px", minWidth: 0 }}>
          <label style={lbl}>{t("Şampiyona")}</label>
          <input type="text" list="su-champs" value={suMeta.champ} maxLength={SETUP_LIMITS.champ} placeholder={t("örn. ELMS / Official / Online")} style={inp} onChange={(e) => set({ champ: e.target.value })} />
          <datalist id="su-champs">
            {Object.values(seasons || {}).map((se) => <option key={se.name} value={se.name} />)}
            <option value="Official" /><option value="Online" />
          </datalist>
        </div>
        <div style={{ flex: "0 1 120px", minWidth: 100 }}>
          <label style={lbl}>{t("LMU Sürümü")}</label>
          <input type="text" value={suMeta.ver} placeholder="V1.2" maxLength={SETUP_LIMITS.ver} style={{ ...inp, fontFamily: "var(--rc-font-display)", fontSize: 14 }} onChange={(e) => set({ ver: e.target.value })} />
        </div>
        <div style={{ flex: "0 1 140px", minWidth: 120 }}>
          <label style={lbl}>{t("Tur Zamanı")}</label>
          <input type="text" value={suMeta.lap} placeholder="1:58.234" maxLength={SETUP_LIMITS.lap} inputMode="decimal" style={{ ...inp, border: "1px solid var(--rc-border-strong)", fontFamily: "var(--rc-font-display)", fontSize: 16, fontWeight: 700 }} onChange={(e) => set({ lap: e.target.value })} />
        </div>
        <div style={{ flex: "1 1 180px", minWidth: 150 }}>
          <label style={lbl}>{t("Pilot")}</label>
          <input type="text" value={suMeta.pilot || ""} placeholder={t("turu atan pilot")} maxLength={40} style={inp} onChange={(e) => set({ pilot: e.target.value })} />
        </div>
      </div>

      {/* not */}
      <div>
        <label style={lbl}>{t("Not")}</label>
        <input type="text" value={suMeta.note} maxLength={SETUP_LIMITS.note} placeholder={t("örn. düşük kanat, uzun stint dengesi")} style={inp} onChange={(e) => set({ note: e.target.value })} />
      </div>

      {/* dosyadan algılandı bildirimi */}
      {suFile && suMeta.cls && suMeta.car && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: "11px 14px", borderRadius: 11, border: "1px solid rgba(55,214,122,.35)", background: "rgba(55,214,122,.08)", fontSize: 12, color: "var(--rc-ok)", lineHeight: 1.6 }}>
          <span style={{ flex: "0 0 auto", fontSize: 14 }}>✨</span>
          <span>{t("Dosyadan algılandı")}: <b>{[(classOptions().find((o) => o.value === suMeta.cls) || {}).label || suMeta.cls, carName(suMeta.cls, suMeta.car)].filter(Boolean).join(" · ")}</b> — {t("elle seçtiğin alanlara dokunulmadı.")}</span>
        </div>
      )}
      {suErr && <div style={{ fontSize: 12, color: "var(--rc-warn)" }}>⚠ {suErr}</div>}
      {suMsg && <div style={{ fontSize: 12, color: "var(--rc-ok)" }}>{suMsg}</div>}

      {/* alt: hint + Vazgeç + Havuza yükle */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 10, borderTop: "1px solid var(--rc-border)", flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: "var(--rc-text-3)", lineHeight: 1.5 }}>{t("Yüklenen setup ortak havuza gider · tarih otomatik")}</span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {onCancel && <button onClick={onCancel} style={{ padding: "9px 16px", borderRadius: 9, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 12.5 }}>{t("Vazgeç")}</button>}
          <button onClick={saveSetup} disabled={!canSave}
            style={{ padding: "9px 18px", borderRadius: 9, border: `1px solid ${canSave ? "var(--rc-brand-bright)" : "var(--rc-border)"}`, background: canSave ? "var(--rc-brand)" : "var(--rc-surface-3)", color: canSave ? "var(--rc-on-brand)" : "var(--rc-text-3)", cursor: canSave ? "pointer" : "not-allowed", fontSize: 12.5, fontWeight: 600, opacity: suBusy ? .6 : 1 }}>
            {suBusy ? t("Yükleniyor…") : t("Havuza yükle")}</button>
        </span>
      </div>
    </div>
  );
}

/* Ortak setup tablosu — pit wall Setup sekmesi + lobi penceresi ortak.
   onDownload/onDelete App'ten prop gelir (indirme + silme onayı orada). */
/* Kaydın gövdesi (dosyası) var mı? Legacy kayıt data'yı meta içinde taşır; yeni
   kayıtlar (v1.4.93 şema bölme) hasBlob işaretiyle gelir, gövde talep üzerine iner. */
const hasFile = (su) => !!(su?.data || su?.hasBlob);

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
  cmpSel, onCmpToggle }) {
  const deltas = lapDeltas(rows);   // pist+sınıf başına ⚡ en hızlı + farklar
  const COLS = "minmax(120px,1.2fr) 96px 1fr 92px 88px 168px";
  const smBtn = { padding: "4px 10px", borderRadius: 7, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text)", cursor: "pointer", fontSize: 11, whiteSpace: "nowrap" };
  const hd = { color: "var(--rc-text-3)", fontSize: 10, textTransform: "uppercase", letterSpacing: ".09em" };
  return (
    <div style={{ overflowX: "auto", border: "1px solid var(--rc-border)", borderRadius: 12, background: "var(--rc-surface)" }}>
      <div style={{ minWidth: 660 }}>
        {/* başlık satırı (spec 73-81) */}
        <div style={{ display: "grid", gridTemplateColumns: COLS, gap: 10, alignItems: "center", padding: "8px 12px", borderBottom: "1px solid var(--rc-border)", background: "var(--rc-surface-2)" }}>
          <span style={hd}>{t("Dosya")}</span>
          <span style={{ ...hd, textAlign: "left" }}>{t("Koşul")}</span>
          <span style={hd}>{t("Araç")}</span>
          <span style={{ ...hd, textAlign: "right" }}>{t("Tur")}</span>
          <span style={hd}>{t("Yükleyen")}</span>
          <span style={{ ...hd, textAlign: "right" }}>{t("İşlem")}</span>
        </div>
        {rows.map((su) => {
          const d = deltas.get(su.id);
          const lapColor = d?.fastest ? "var(--rc-ok)" : "var(--rc-text)";
          const lapNote = su.note || (d?.fastest ? t("sınıf en hızlısı") : d && d.delta > 0 ? `+${d.delta.toFixed(2)}` : "");
          const here = su.track === st.track;
          const sel = cmpSel?.includes(su.id);
          return (
            /* satıra tıkla → içerik penceresi (eylem hücresi stopPropagation ile hariç) */
            <div key={su.id} onClick={() => hasFile(su) && onView?.(su)}
              style={{ display: "grid", gridTemplateColumns: COLS, gap: 10, alignItems: "center",
                padding: "9px 12px", borderBottom: "1px solid var(--rc-line-soft)",
                borderLeft: `2px solid ${here ? "var(--rc-brand-bright)" : "transparent"}`,
                background: sel ? "rgba(150,0,24,.10)" : "transparent",
                cursor: hasFile(su) && onView ? "pointer" : "default" }}>
              {/* Dosya: ad + sürüm çipi + not */}
              <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                  <b style={{ fontFamily: "var(--rc-font-display)", fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{su.name}</b>
                  {su.ver && <span style={{ fontSize: 10, color: "var(--rc-text-3)", padding: "1px 7px", borderRadius: 99, border: "1px solid var(--rc-border)", flex: "0 0 auto" }}>{su.ver}</span>}
                </span>
                {(lapNote || su.champ) && <span style={{ fontSize: 10.5, color: "var(--rc-text-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{[su.champ, lapNote].filter(Boolean).join(" · ")}</span>}
              </span>
              {/* Koşul */}
              <span style={{ display: "flex", justifyContent: "flex-start" }}><CondSess su={su} t={t} /></span>
              {/* Araç: marka + sınıf + ad */}
              <span style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                {su.car && brandLogo(carName(su.cls, su.car)) && (
                  <img src={brandLogo(carName(su.cls, su.car))} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} style={{ height: 17, width: 17, objectFit: "contain", flex: "0 0 auto" }} />)}
                {su.cls && <img src={`${ASSET}class/${su.cls}.png`} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} style={{ height: 14, flex: "0 0 auto" }} />}
                <span style={{ fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{carName(su.cls, su.car) || "—"}</span>
              </span>
              {/* Tur */}
              <b style={{ fontFamily: "var(--rc-font-display)", fontSize: 17, fontWeight: 700, textAlign: "right", color: lapColor }}>{su.lap || "—"}</b>
              {/* Yükleyen · tarih */}
              <span style={{ fontSize: 11, color: "var(--rc-text-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {su.uname || "—"} · {new Date(su.at || 0).toLocaleDateString(lang === "en" ? "en-GB" : "tr-TR", { day: "2-digit", month: "2-digit" })}</span>
              {/* İşlem */}
              <span style={{ display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center" }} onClick={(e) => e.stopPropagation()}>
                {onCmpToggle && hasFile(su) && (
                  <button style={{ ...smBtn, padding: "4px 8px", ...(sel ? { borderColor: "var(--rc-brand-bright)", color: "var(--rc-brand-bright)", background: "rgba(150,0,24,.18)" } : {}) }}
                    title={t("Karşılaştırmak için seç (en çok 2)")} onClick={() => onCmpToggle(su)}>⚖</button>)}
                {onView && hasFile(su) && <button style={smBtn} onClick={() => onView(su)}>{t("İçerik")}</button>}
                <button style={smBtn} onClick={() => onDownload(su)}>{t("İndir")}</button>
                {isAdmin && <button style={{ ...smBtn, borderColor: "var(--rc-danger)", color: "var(--rc-danger)" }} onClick={() => onDelete(su)}>✕</button>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* Kart görünümü — tabloyla aynı veri/handler'lar, mobil ve göz gezdirme için.
   ⊞/☰ toggle App'te (localStorage rm_setup_view). Karta tıkla → içerik. */
export function SetupCards({ rows, t, st, lang, isAdmin, onDownload, onDelete, onView,
  cmpSel, onCmpToggle }) {
  const deltas = lapDeltas(rows);
  const smBtn = { padding: "4px 10px", borderRadius: 7, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text)", cursor: "pointer", fontSize: 11, whiteSpace: "nowrap" };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 12 }}>
      {rows.map((su) => {
        const d = deltas.get(su.id);
        const lapColor = d?.fastest ? "var(--rc-ok)" : "var(--rc-text)";
        const lapNote = su.note || (d?.fastest ? t("sınıf en hızlısı") : d && d.delta > 0 ? `+${d.delta.toFixed(2)}` : "");
        const here = su.track === st.track;
        return (
          <div key={su.id} onClick={() => hasFile(su) && onView?.(su)}
            style={{ position: "relative", overflow: "hidden", border: `1px solid ${here ? "var(--rc-brand-bright)" : "var(--rc-border)"}`, borderRadius: 14, background: "var(--rc-surface)", padding: "14px 16px", cursor: hasFile(su) && onView ? "pointer" : "default" }}>
            {/* pist arka planı */}
            {su.track && <img src={`${ASSET}tracks/${TRACK_ASSET(su.track)}.png`} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }}
              style={{ position: "absolute", right: -10, top: 8, width: 150, opacity: .10, pointerEvents: "none" }} />}
            {/* araç ön planı */}
            {su.car && <img src={carImg(su.cls, su.car)} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }}
              style={{ position: "absolute", right: 10, bottom: 46, height: 46, width: "auto", objectFit: "contain", pointerEvents: "none" }} />}
            {/* üst: tur + koşul */}
            <div style={{ position: "relative", display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
                <span style={{ fontFamily: "var(--rc-font-display)", fontWeight: 700, fontSize: 36, lineHeight: .95, color: lapColor, fontVariantNumeric: "tabular-nums" }}>{su.lap || "—"}</span>
                {lapNote && <span style={{ fontSize: 11, color: "var(--rc-text-3)" }}>{lapNote}</span>}
              </div>
              <CondSess su={su} t={t} />
            </div>
            {/* araç */}
            <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 8, marginTop: 12, minWidth: 0 }}>
              {su.car && brandLogo(carName(su.cls, su.car)) && (
                <img src={brandLogo(carName(su.cls, su.car))} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} style={{ height: 20, width: 20, objectFit: "contain" }} />)}
              {su.cls && <img src={`${ASSET}class/${su.cls}.png`} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} style={{ height: 16 }} />}
              <span style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{carName(su.cls, su.car) || "—"}</span>
            </div>
            <div style={{ position: "relative", fontFamily: "var(--rc-font-display)", fontSize: 11, color: "var(--rc-text-2)", marginTop: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{su.name}</div>
            {/* alt */}
            <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 8, marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--rc-border)" }} onClick={(e) => e.stopPropagation()}>
              <span style={{ fontSize: 11, color: "var(--rc-text-3)" }}>{su.uname || "—"} · {new Date(su.at || 0).toLocaleDateString(lang === "en" ? "en-GB" : "tr-TR", { day: "2-digit", month: "2-digit" })}</span>
              <span style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
                {su.ver && <span style={{ fontSize: 10, color: "var(--rc-text-3)", padding: "2px 8px", borderRadius: 99, border: "1px solid var(--rc-border)" }}>{su.ver}</span>}
                {onCmpToggle && hasFile(su) && (
                  <button style={{ ...smBtn, padding: "4px 8px", ...(cmpSel?.includes(su.id) ? { borderColor: "var(--rc-brand-bright)", color: "var(--rc-brand-bright)", background: "rgba(150,0,24,.18)" } : {}) }}
                    title={t("Karşılaştırmak için seç (en çok 2)")} onClick={() => onCmpToggle(su)}>⚖</button>)}
                {onView && hasFile(su) && <button style={smBtn} onClick={() => onView(su)}>{t("İçerik")}</button>}
                <button style={smBtn} onClick={() => onDownload(su)}>{t("İndir")}</button>
                {isAdmin && <button style={{ ...smBtn, borderColor: "var(--rc-danger)", color: "var(--rc-danger)" }} onClick={() => onDelete(su)}>✕</button>}
              </span>
            </div>
          </div>
        );
      })}
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
export function RaceEditModal({ rForm, setRForm, t, seasons, onSave, onProceed, lmuData }) {
  if (!rForm) return null;
  const dataFlow = rForm.flow === "data"; // + Yarış ekle akışı: İlerle → data ekranı
  /* LMU referans tempoları (Ohne Speed) — seçili pist+araç/sınıf için tier tablosu */
  const tempoRows = (() => {
    if (!rForm.trackId || !rForm.carId) return null; // araç seçilmeden gösterme
    const d = lmuData?.data?.[rForm.trackId];
    if (!d) return null;
    const carE = d[`${rForm.carClass}:${rForm.carId}`];
    const clsE = d[rForm.carClass];
    const tiers = clsE?.tiers;
    const hot = carE?.hot || clsE?.hot;
    if (!tiers && !hot) return null;
    return [
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
  })();
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
            {tempoRows && (
              <div style={{ border: "1px solid var(--rc-border)", borderRadius: 12, background: "var(--rc-surface-2)", padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontFamily: "var(--rc-font-display)", textTransform: "uppercase", letterSpacing: ".07em", fontSize: 12, fontWeight: 700 }}>{t("Tempolar")}</span>
                  <span style={{ marginLeft: "auto", fontSize: 9.5, color: "var(--rc-text-4)" }}>{lmuData?.source || "Ohne Speed"}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {tempoRows.map(([lbl, v, col]) => (
                    <div key={lbl} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
                      <i style={{ width: 7, height: 7, borderRadius: 2, background: col, flex: "0 0 auto" }} />
                      <span style={{ color: "var(--rc-text-3)", letterSpacing: ".02em" }}>{lbl}</span>
                      <b style={{ marginLeft: "auto", fontFamily: "var(--rc-font-mono)", color: col }}>{v}</b>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", borderTop: "1px solid var(--rc-border)", background: "var(--rc-surface-2)" }}>
          <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button onClick={() => setRForm(null)} style={{ padding: "10px 18px", borderRadius: 10, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 13 }}>{t("Vazgeç")}</button>
            {(() => { const ready = !!rForm.trackId && !!rForm.carId; return (
            <button disabled={!ready} onClick={() => { if (!ready) return; dataFlow && onProceed ? onProceed(rForm) : onSave(rForm); }}
              title={ready ? undefined : t("Önce pist ve araç seç")}
              style={{ padding: "10px 24px", borderRadius: 10, border: "1px solid var(--rc-brand-bright)", background: "var(--rc-brand)", color: "var(--rc-on-brand)", cursor: ready ? "pointer" : "not-allowed", opacity: ready ? 1 : .45, fontFamily: "var(--rc-font-display)", fontSize: 16, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase" }}>{dataFlow ? `${t("İlerle")} →` : t("Kaydet")}</button>
            ); })()}
          </span>
        </div>
      </div>
    </div>
  );
}

/* Sohbet penceresi (kanal sekmeleri + gövde). App.jsx'ten çıkarıldı; sohbet gövdesi
   (ChatPanel'i saran, iki yerde kullanılan) App'te kalıp `chatBody` render-prop'u ile
   gelir. open=false → null döner. */
export function ChatModal({ open, onClose, t, lang, chatSound, toggleChatSound, chatChans,
  unreadOf, chatChan, setChatChan, teamData, curChan, chatBody, chatAll, fmtClock }) {
  if (!open) return null;
  const nameOf = (c) => (c.id === "team" ? (teamData?.meta?.name || t(c.lbl)) : t(c.lbl));
  const metaOf = (c) => (c.id === "team" ? t("takım kanalı") : c.id === "global" ? t("genel kanal") : t("yarışa özel kanal"));
  const lastOf = (c) => { const m = (chatAll?.[c.path] || []); return m[m.length - 1]; };
  return (
    <div className="rc" onClick={onClose} role="dialog" aria-modal="true"
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(10,6,10,.74)", backdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, animation: "rcfade .18s ease" }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: "min(940px,96vw)", height: "min(660px,88vh)", display: "flex", flexWrap: "wrap", gap: 0, background: "var(--rc-surface)", border: "1px solid var(--rc-border-strong)", borderRadius: 16, overflow: "hidden", boxShadow: "0 24px 70px rgba(0,0,0,.6)", animation: "rcpop .24s cubic-bezier(.2,.9,.3,1.1)" }}>
        {/* sol: Kanallar */}
        <div style={{ flex: "0 0 280px", minWidth: 220, borderRight: "1px solid var(--rc-border)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--rc-border)", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontFamily: "var(--rc-font-display)", textTransform: "uppercase", letterSpacing: ".08em", fontSize: 15, fontWeight: 700 }}>{t("Kanallar")}</span>
            <button onClick={toggleChatSound} title={chatSound ? t("Bildirim sesini kapat") : t("Bildirim sesini aç")}
              style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--rc-text-3)", cursor: "pointer", fontSize: 15 }}>{chatSound ? "🔔" : "🔕"}</button>
          </div>
          <div style={{ overflowY: "auto", padding: 8 }}>
            {chatChans.map((c) => {
              const on = c.id === chatChan;
              const u2 = unreadOf(c);
              const last = lastOf(c);
              return (
                <button key={c.id} onClick={() => setChatChan(c.id)}
                  style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 11px", borderRadius: 10, cursor: "pointer", marginBottom: 2,
                    border: `1px solid ${on ? "var(--rc-border-strong)" : "transparent"}`, background: on ? "var(--rc-surface-3)" : "transparent" }}>
                  <span style={{ width: 30, height: 30, flex: "0 0 auto", borderRadius: 9, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 15, background: "var(--rc-surface-2)", border: "1px solid var(--rc-border)" }}>{c.ico}</span>
                  <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1, textAlign: "left" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <b style={{ fontFamily: "var(--rc-font-display)", fontSize: 15, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nameOf(c)}</b>
                      {u2 > 0 && !on && <b style={{ flex: "0 0 auto", fontSize: 10, minWidth: 17, height: 17, padding: "0 5px", borderRadius: 99, background: "var(--rc-brand)", color: "var(--rc-on-brand)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{u2 > 9 ? "9+" : u2}</b>}
                      <span style={{ marginLeft: "auto", fontSize: 10.5, color: "var(--rc-text-3)", fontFamily: "var(--rc-font-display)", flex: "0 0 auto" }}>{last ? fmtClock(last.at || 0) : ""}</span>
                    </span>
                    <span style={{ fontSize: 11.5, color: "var(--rc-text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{last ? last.text : metaOf(c)}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        {/* sağ: mesaj sütunu */}
        <div style={{ flex: "1 1 420px", minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--rc-border)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "var(--rc-font-display)", textTransform: "uppercase", letterSpacing: ".06em", fontSize: 17, fontWeight: 700 }}>{curChan ? nameOf(curChan) : t("Sohbet")}</span>
            {curChan && <span style={{ fontSize: 11.5, color: "var(--rc-text-3)" }}>{metaOf(curChan)}</span>}
            <button onClick={onClose} style={{ marginLeft: "auto", width: 30, height: 30, borderRadius: 8, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 14, lineHeight: 1 }}>✕</button>
          </div>
          {chatBody(curChan)}
        </div>
      </div>
    </div>
  );
}

/* .svm alan anahtarları → kısa TR ad (yoksa ham anahtar gösterilir). Bölüm başlıkları
   da TR'ye çevrilir. Liste uzun olduğu için yalnız sık bakılanlar; gerisi ham key. */
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
const CAT_ACC = { aero: "#4C9AFF", tyre: "#F5B23D", susp: "#37D67A", align: "#B58BFF", brake: "#FF4D5E", diff: "#EF8A2B", elec: "#4C9AFF", engine: "#C9B3B9", other: "#A88C93" };

export function SetupContentModal({ open, su, onClose, t, onDownload, onAddCompare, inCompare }) {
  const blob = useSetupBlob(su, open);
  const [cat, setCat] = useState("all");
  useEffect(() => {
    if (!open) return undefined;
    setCat("all");
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open || !su) return null;
  const parsed = parseSvm(b64ToText(blob.b64));
  /* ÖNE ÇIKANLAR: fişteki gibi az sayıda, ön/arka BİRLEŞİK küratörlü kutular
     (setupSummary'nin 19 ayrı kutusu yerine). */
  const _fi = {};
  if (parsed?.ok) for (const r of parsed.rows) if (_fi[`${r.section}/${r.key}`] == null) _fi[`${r.section}/${r.key}`] = r.label;
  const _g = (p) => _fi[p];
  const _pair = (fa, fb) => { const x = _g(fa), y = _g(fb); if (x == null && y == null) return null; return `${x ?? "—"} / ${y ?? "—"}`; };
  const summary = [
    { label: "Arka Kanat", value: _g("REARWING/RWSetting") },
    { label: "Yükseklik ön/arka", value: _pair("FRONTLEFT/RideHeightSetting", "REARLEFT/RideHeightSetting") },
    { label: "Basınç ön/arka", value: _pair("FRONTLEFT/PressureSetting", "REARLEFT/PressureSetting") },
    { label: "Kamber ön/arka", value: _pair("FRONTLEFT/CamberSetting", "REARLEFT/CamberSetting") },
    { label: "Fren Dengesi", value: _g("CONTROLS/RearBrakeSetting") },
    { label: "TC", value: _g("CONTROLS/TractionControlMapSetting") },
    { label: "ABS", value: _g("CONTROLS/AntilockBrakeSystemMapSetting") },
    { label: "VE", value: _g("GENERAL/VirtualEnergySetting") },
  ].filter((s) => s.value != null && s.value !== "");
  const fieldName = (key) => t(SVM_FIELDS[key] || key);
  const cats = categorizeSetup(parsed);
  const totalFields = cats.reduce((a, c) => a + c.rows.length, 0);
  const shownCats = cat === "all" ? cats : cats.filter((c) => c.cat === cat);
  const dateStr = su.at ? new Date(su.at).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" }) : "";
  const chip = (on) => ({ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 13px", borderRadius: 99, cursor: "pointer", fontSize: 12, whiteSpace: "nowrap",
    border: `1px solid ${on ? "var(--rc-brand-bright)" : "var(--rc-border)"}`, background: on ? "rgba(150,0,24,.22)" : "var(--rc-surface-3)", color: on ? "var(--rc-text)" : "var(--rc-text-2)" });
  const carTitle = carName(su.cls, su.car) || su.car || "—";
  return (
    <div onClick={onClose} role="dialog" aria-modal="true"
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(10,6,10,.78)", backdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, animation: "rcfade .18s ease" }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: "min(880px,96vw)", maxHeight: "90vh", display: "flex", flexDirection: "column", background: "var(--rc-surface)", border: "1px solid var(--rc-border-strong)", borderRadius: 16, overflow: "hidden", boxShadow: "0 24px 70px rgba(0,0,0,.6)", animation: "rcpop .22s cubic-bezier(.2,.9,.3,1.05)" }}>
        {/* başlık */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "15px 20px", borderBottom: "1px solid var(--rc-border)", flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--rc-font-display)", textTransform: "uppercase", letterSpacing: ".07em", fontSize: 18, fontWeight: 700 }}>{t("Setup İçeriği")}</span>
          <span style={{ fontFamily: "var(--rc-font-display)", fontSize: 13, color: "var(--rc-text-2)", marginRight: "auto", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{su.name}</span>
          <button onClick={onClose} style={{ width: 31, height: 31, borderRadius: 9, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 14, lineHeight: 1 }}>✕</button>
        </div>

        {/* bilgi şeridi: pist · araç · en iyi tur */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 20px", borderBottom: "1px solid var(--rc-line-soft)", flexWrap: "wrap", background: "radial-gradient(120% 200% at 100% 0,rgba(150,0,24,.16),var(--rc-surface-2) 70%)" }}>
          {su.track && <img src={`${ASSET}flags/${TRACK_ASSET(su.track)}.png`} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} style={{ width: 26, borderRadius: 3, flex: "0 0 auto" }} />}
          <span style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <b style={{ fontFamily: "var(--rc-font-display)", fontSize: 16 }}>{trackName(su.track) || su.track || "—"}</b>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--rc-text-3)" }}><CondSess su={su} t={t} />{dateStr ? ` · ${dateStr}` : ""}</span>
          </span>
          {su.car && <img src={carImg(su.cls, su.car)} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} style={{ height: 40, width: "auto", objectFit: "contain", flex: "0 0 auto" }} />}
          <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
            <b style={{ fontSize: 13, whiteSpace: "nowrap" }}>{carTitle}</b>
            <span style={{ fontSize: 11, color: "var(--rc-text-3)" }}>{[su.uname ? `${su.uname} ${t("yükledi")}` : "", su.champ, su.ver].filter(Boolean).join(" · ")}</span>
          </span>
          {su.lap && (
            <span style={{ marginLeft: "auto", textAlign: "right" }}>
              <div style={{ fontFamily: "var(--rc-font-display)", fontSize: 26, fontWeight: 700, lineHeight: 1, color: "var(--rc-ok)" }}>{su.lap}</div>
              <div style={{ fontSize: 10, color: "var(--rc-text-3)", textTransform: "uppercase", letterSpacing: ".09em" }}>{t("en iyi tur")}</div>
            </span>
          )}
        </div>

        {/* not */}
        {su.note && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: "11px 20px", borderBottom: "1px solid var(--rc-line-soft)", fontSize: 13, color: "var(--rc-text-2)", lineHeight: 1.6 }}>
            <span style={{ flex: "0 0 auto" }}>📝</span><span>{su.note}</span>
          </div>
        )}

        <div style={{ overflowY: "auto" }}>
          {blob.loading ? (
            <div style={{ padding: "18px 20px", color: "var(--rc-text-3)", fontSize: 12.5 }}>⏳ {t("Dosya yükleniyor…")}</div>
          ) : !parsed.ok ? (
            <div style={{ padding: "18px 20px", color: "var(--rc-warn)", fontSize: 12.5, lineHeight: 1.6 }}>⚠ {t("İçerik okunamadı — bu bir LMU setup dosyası değil ya da bozuk.")}</div>
          ) : (
            <>
              {/* öne çıkanlar */}
              {summary.length > 0 && (
                <div style={{ padding: "13px 20px", borderBottom: "1px solid var(--rc-line-soft)" }}>
                  <div style={{ color: "var(--rc-text-3)", fontSize: 10, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 9 }}>{t("Öne çıkanlar")}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 8 }}>
                    {summary.map((s) => (
                      <div key={s.label} style={{ background: "var(--rc-surface-3)", border: "1px solid var(--rc-border)", borderRadius: 10, padding: "9px 11px" }}>
                        <div style={{ fontFamily: "var(--rc-font-display)", fontSize: 17, fontWeight: 700, lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.value}</div>
                        <div style={{ fontSize: 10, color: "var(--rc-text-3)", textTransform: "uppercase", letterSpacing: ".07em", marginTop: 3 }}>{t(s.label)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* kategori filtre çipleri */}
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap", padding: "11px 20px", borderBottom: "1px solid var(--rc-line-soft)" }}>
                <button onClick={() => setCat("all")} style={chip(cat === "all")}>▦ {t("Tümü")}</button>
                {cats.map((c) => (
                  <button key={c.cat} onClick={() => setCat(c.cat)} style={chip(cat === c.cat)}>{CAT_META[c.cat]?.icon || "•"} {t(CAT_META[c.cat]?.tr || c.cat)}</button>
                ))}
              </div>
              {/* kategori kartları */}
              <div style={{ padding: "14px 20px 18px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 12 }}>
                  {shownCats.map((c) => {
                    const acc = CAT_ACC[c.cat] || "#A88C93";
                    return (
                      <div key={c.cat} style={{ border: "1px solid var(--rc-border)", borderRadius: 12, background: "var(--rc-surface-2)", overflow: "hidden" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 13px", borderBottom: `1px solid ${acc}33`, background: `${acc}14`, fontFamily: "var(--rc-font-display)", textTransform: "uppercase", letterSpacing: ".06em", fontSize: 12.5, fontWeight: 700, color: acc }}>
                          {CAT_META[c.cat]?.icon || "•"} {t(CAT_META[c.cat]?.tr || c.cat)}
                        </div>
                        {c.rows.map((r, i) => (
                          <div key={r.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 13px", borderTop: i > 0 ? "1px solid var(--rc-line-soft)" : "none" }}>
                            <span style={{ fontSize: 12, color: "var(--rc-text-2)", flex: 1, minWidth: 0 }}>{fieldName(r.key)}</span>
                            {r.kind === "axle" ? (
                              <span style={{ display: "inline-flex", gap: 12, flex: "0 0 auto" }}>
                                <span style={{ display: "inline-flex", alignItems: "baseline", gap: 5 }}><span style={{ fontSize: 9.5, color: "var(--rc-text-3)", textTransform: "uppercase" }}>{t("Ön")}</span><b style={{ fontFamily: "var(--rc-font-display)", fontSize: 14 }}>{r.front}</b></span>
                                <span style={{ display: "inline-flex", alignItems: "baseline", gap: 5 }}><span style={{ fontSize: 9.5, color: "var(--rc-text-3)", textTransform: "uppercase" }}>{t("Arka")}</span><b style={{ fontFamily: "var(--rc-font-display)", fontSize: 14 }}>{r.rear}</b></span>
                              </span>
                            ) : (
                              <b style={{ fontFamily: "var(--rc-font-display)", fontSize: 14, flex: "0 0 auto" }}>{r.value}</b>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* alt: alan sayısı + karşılaştırmaya ekle / indir */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 20px", borderTop: "1px solid var(--rc-border)", background: "var(--rc-surface-2)" }}>
          <span style={{ fontSize: 11, color: "var(--rc-text-3)" }}>{totalFields} {t("alan")} · {t("LMU .svm dosyasından okundu")}</span>
          <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            {onAddCompare && (
              <button onClick={() => onAddCompare(su)} style={{ padding: "8px 15px", borderRadius: 9, cursor: "pointer", fontSize: 12.5,
                border: `1px solid ${inCompare ? "var(--rc-brand-bright)" : "var(--rc-border)"}`, background: inCompare ? "rgba(150,0,24,.22)" : "var(--rc-surface-3)", color: inCompare ? "var(--rc-text)" : "var(--rc-text-2)" }}>⚖ {t("Karşılaştırmaya ekle")}</button>
            )}
            {onDownload && (
              <button onClick={() => onDownload(su)} style={{ padding: "8px 18px", borderRadius: 9, border: "1px solid var(--rc-brand-bright)", background: "var(--rc-brand)", color: "var(--rc-on-brand)", cursor: "pointer", fontSize: 12.5, fontWeight: 600 }}>⬇ {t("İndir")}</button>
            )}
          </span>
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
  const segBtn = (on) => ({ padding: "7px 14px", borderRadius: 8, cursor: "pointer", fontSize: 12, whiteSpace: "nowrap",
    border: `1px solid ${on ? "var(--rc-brand-bright)" : "var(--rc-border)"}`, background: on ? "rgba(150,0,24,.22)" : "var(--rc-surface-3)", color: on ? "var(--rc-text)" : "var(--rc-text-2)" });
  return (
    <div style={{ border: "1px solid var(--rc-border)", borderRadius: 12, background: "var(--rc-surface)", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "var(--rc-font-display)", textTransform: "uppercase", letterSpacing: ".07em", fontSize: 15, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 8 }}>🔧 {t("Bu Seansın Setup'ı")}</span>
        <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: ".09em", padding: "2px 8px", borderRadius: 99, border: "1px solid var(--rc-ok)", color: "var(--rc-ok)" }}>{t("YENİ")}</span>
        <span style={{ fontSize: 11, color: "var(--rc-text-3)" }}>{[meta?.driver, meta?.session].filter(Boolean).join(" · ")}{count ? ` · ${count} ${t("ayar")}` : ""}</span>
      </div>
      {summary.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
          {summary.map((s) => (
            <span key={s.label} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 99, border: "1px solid var(--rc-border)", background: "var(--rc-surface-2)", fontSize: 11.5 }}>
              <b style={{ fontFamily: "var(--rc-font-display)", color: "var(--rc-brand-bright)" }}>{t(s.label)}</b>
              <span style={{ fontFamily: "var(--rc-font-display)" }}>{s.value}</span></span>
          ))}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span role="group" style={{ display: "inline-flex", gap: 6 }}>
          <button aria-pressed={!open} onClick={() => setOpen(false)} style={segBtn(!open)}>{t("Özet")}</button>
          <button aria-pressed={open} onClick={() => setOpen(true)} style={segBtn(open)}>{t("Detay")}</button>
        </span>
        {open && (
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("ara: kanat, basınç…")} aria-label={t("Setup alanı ara")}
            style={{ flex: "1 1 150px", minWidth: 0, background: "var(--rc-surface-3)", border: "1px solid var(--rc-border-strong)", borderRadius: 9, color: "var(--rc-text)", padding: "8px 12px", fontSize: 12.5 }} />
        )}
        {onSave && (
          <button onClick={doSave} disabled={saving || saved}
            style={{ marginLeft: "auto", padding: "8px 14px", borderRadius: 9, cursor: saving || saved ? "default" : "pointer", fontSize: 12,
              border: `1px solid ${saved ? "var(--rc-ok)" : "var(--rc-brand-bright)"}`, background: saved ? "rgba(55,214,122,.12)" : "var(--rc-brand)", color: saved ? "var(--rc-ok)" : "var(--rc-on-brand)", opacity: saving ? .6 : 1 }}>
            {saved ? `✓ ${t("Havuza kaydedildi")}` : saving ? t("Kaydediliyor…") : `⬆ ${t("Havuza Kaydet")}`}
          </button>
        )}
      </div>
      {err && <div style={{ fontSize: 11.5, color: "var(--rc-warn)" }}>⚠ {err}</div>}
      {open && (shown.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {shown.map((c) => (
            <section key={c.cat} style={{ border: "1px solid var(--rc-border)", borderRadius: 12, background: "var(--rc-surface-2)", overflow: "hidden" }}>
              <h4 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8, padding: "9px 13px", borderBottom: "1px solid var(--rc-line-soft)", fontFamily: "var(--rc-font-display)", textTransform: "uppercase", letterSpacing: ".06em", fontSize: 12.5, fontWeight: 700 }}>
                <span>{CAT_META[c.cat]?.icon || "•"}</span>
                {t(CAT_META[c.cat]?.tr || c.cat)}
                <span style={{ marginLeft: "auto", fontSize: 10.5, color: "var(--rc-text-3)", padding: "1px 8px", borderRadius: 99, border: "1px solid var(--rc-border)", fontWeight: 400 }}>{c.rows.length}</span></h4>
              {c.rows.map((r, i) => (
                <div key={r.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 13px", borderTop: i > 0 ? "1px solid var(--rc-line-soft)" : "none" }}>
                  <span style={{ fontSize: 12, color: "var(--rc-text-2)", flex: 1, minWidth: 0 }}>{fieldName(r.key)}</span>
                  {r.kind === "axle" ? (
                    <span style={{ display: "inline-flex", gap: 12, fontFamily: "var(--rc-font-display)", fontSize: 13, flex: "0 0 auto" }}>
                      <span style={{ display: "inline-flex", gap: 4 }}><b style={{ color: "var(--rc-text-3)", fontSize: 9.5, alignSelf: "center" }}>{t("ÖN")}</b>{r.front}</span>
                      <span style={{ display: "inline-flex", gap: 4 }}><b style={{ color: "var(--rc-text-3)", fontSize: 9.5, alignSelf: "center" }}>{t("ARKA")}</b>{r.rear}</span></span>
                  ) : (
                    <span style={{ fontFamily: "var(--rc-font-display)", fontSize: 13, flex: "0 0 auto" }}>{r.value}</span>
                  )}
                </div>
              ))}
            </section>
          ))}
        </div>
      ) : (
        <div style={{ color: "var(--rc-text-3)", fontSize: 12.5 }}>{t("Eşleşen alan yok.")}</div>
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
  const sameCount = rows.length - diffCount;
  const shown = onlyDiff ? rows.filter((r) => r.differ) : rows;
  /* KATEGORİYE göre grupla (fişteki bölümler: Aero/Lastik/Süspansiyon…) */
  const groups = [];
  const gIdx = {};
  for (const r of shown) {
    const c = r.cat || "other";
    if (!(c in gIdx)) { gIdx[c] = groups.length; groups.push({ cat: c, list: [] }); }
    groups[gIdx[c]].list.push(r);
  }
  const mismatch = a.track !== b.track || a.cls !== b.cls;
  const A_COL = "#ff5470", B_COL = "#4d9fff";
  const num = (s) => { const m = String(s ?? "").match(/-?\d+(?:\.\d+)?/); return m ? parseFloat(m[0]) : null; };
  const deltaOf = (r) => {
    if (!r.differ) return "";
    const na = num(r.a), nb = num(r.b);
    if (na == null || nb == null) return "";
    const d = nb - na; if (Math.abs(d) < 1e-9) return "";
    const s = d.toFixed(2).replace(/\.?0+$/, "");
    return d > 0 ? `+${s}` : s;
  };
  const lapSec = (s) => { const m = String(s || "").match(/(\d+):(\d+(?:\.\d+)?)/); if (m) return +m[1] * 60 + +m[2]; const f = parseFloat(s); return Number.isFinite(f) ? f : NaN; };
  const la = lapSec(a.lap), lb = lapSec(b.lap);
  const lapD = (Number.isFinite(la) && Number.isFinite(lb)) ? lb - la : null;
  const dateOf = (su) => (su.at ? new Date(su.at).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" }) : "");
  const copyDiffs = () => {
    const txt = rows.filter((r) => r.differ).map((r) => `${t(SVM_FIELDS[r.key] || r.key)}: ${r.a} → ${r.b}`).join("\n");
    try { navigator.clipboard?.writeText(txt); } catch { /* yoksay */ }
  };
  const sideCard = (su, letter, dot, lapColor, delta) => (
    <div style={{ flex: 1, minWidth: 0, padding: "12px 18px", background: letter === "A" ? "rgba(255,84,112,.07)" : "rgba(77,159,255,.07)", borderRight: letter === "A" ? "1px solid var(--rc-line-soft)" : "none" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
        <i style={{ width: 10, height: 10, borderRadius: 3, background: dot, flex: "0 0 auto" }} />
        <b style={{ fontFamily: "var(--rc-font-display)", fontSize: 15, fontWeight: 700 }}>{letter}</b>
        <span style={{ fontFamily: "var(--rc-font-display)", fontSize: 12.5, color: "var(--rc-text-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{su.name}</span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 9, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "var(--rc-font-display)", fontSize: 24, fontWeight: 700, color: lapColor }}>{su.lap || "—"}</span>
        {delta != null && <span style={{ fontSize: 11, color: delta > 0 ? "var(--rc-danger)" : "var(--rc-ok)" }}>{delta > 0 ? "+" : ""}{delta.toFixed(2)}</span>}
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--rc-text-3)" }}>{su.uname ? `${su.uname} · ` : ""}<CondSess su={su} t={t} />{dateOf(su) ? ` · ${dateOf(su)}` : ""}</span>
      </div>
    </div>
  );
  return (
    <div onClick={onClose} role="dialog" aria-modal="true"
      style={{ position: "fixed", inset: 0, zIndex: 1010, background: "rgba(10,6,10,.8)", backdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, animation: "rcfade .18s ease" }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: "min(940px,96vw)", maxHeight: "92vh", display: "flex", flexDirection: "column", background: "var(--rc-surface)", border: "1px solid var(--rc-border-strong)", borderRadius: 16, overflow: "hidden", boxShadow: "0 24px 70px rgba(0,0,0,.6)", animation: "rcpop .22s cubic-bezier(.2,.9,.3,1.05)" }}>
        {/* başlık */}
        <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "15px 20px", borderBottom: "1px solid var(--rc-border)" }}>
          <span style={{ fontFamily: "var(--rc-font-display)", textTransform: "uppercase", letterSpacing: ".07em", fontSize: 18, fontWeight: 700 }}>⚖ {t("Setup Karşılaştır")}</span>
          {both && <span style={{ fontSize: 12, color: "var(--rc-warn)" }}><b>{diffCount}</b> {t("alan farklı")} · {sameCount} {t("alan aynı")}</span>}
          <button onClick={onClose} style={{ marginLeft: "auto", width: 31, height: 31, borderRadius: 9, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 14, lineHeight: 1 }}>✕</button>
        </div>

        {/* A / B başlık kartları */}
        <div style={{ display: "flex", alignItems: "stretch", borderBottom: "1px solid var(--rc-line-soft)" }}>
          {sideCard(a, "A", A_COL, (lapD == null || lapD >= 0) ? "var(--rc-ok)" : "var(--rc-text)", null)}
          {sideCard(b, "B", B_COL, (lapD != null && lapD < 0) ? "var(--rc-ok)" : "var(--rc-text)", lapD)}
        </div>
        {mismatch && <div style={{ fontSize: 11.5, color: "var(--rc-warn)", padding: "8px 20px", borderBottom: "1px solid var(--rc-line-soft)" }}>⚠ {t("Farklı pist ya da sınıf — kıyası dikkatli oku.")}</div>}

        {/* araç çubuğu: yalnız farklar + lejant */}
        {both && (
          <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 20px", borderBottom: "1px solid var(--rc-line-soft)", flexWrap: "wrap" }}>
            <button onClick={() => setOnlyDiff((v) => !v)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 13px", borderRadius: 99, cursor: "pointer", fontSize: 12,
              border: `1px solid ${onlyDiff ? "var(--rc-warn)" : "var(--rc-border)"}`, background: onlyDiff ? "rgba(245,178,61,.14)" : "var(--rc-surface-3)", color: onlyDiff ? "var(--rc-warn)" : "var(--rc-text-2)" }}>◈ {t("Yalnız farklar")}</button>
            <span style={{ fontSize: 11, color: "var(--rc-text-3)" }}>{t("Aynı olan alanlar")} {onlyDiff ? t("gizli") : t("gösteriliyor")}</span>
            <span style={{ marginLeft: "auto", display: "flex", gap: 12, fontSize: 10.5, color: "var(--rc-text-3)" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><i style={{ width: 9, height: 9, borderRadius: 2, background: "var(--rc-warn)", display: "inline-block" }} />{t("farklı")}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><i style={{ width: 9, height: 9, borderRadius: 2, background: "var(--rc-border)", display: "inline-block" }} />{t("aynı")}</span>
            </span>
          </div>
        )}

        <div style={{ overflowY: "auto" }}>
          {loading ? (
            <div style={{ padding: "18px 20px", color: "var(--rc-text-3)", fontSize: 12.5 }}>⏳ {t("Dosya yükleniyor…")}</div>
          ) : !both ? (
            <div style={{ padding: "18px 20px", color: "var(--rc-warn)", fontSize: 12.5 }}>⚠ {t("İçerik okunamadı — bu bir LMU setup dosyası değil ya da bozuk.")}</div>
          ) : !shown.length ? (
            <div style={{ padding: "18px 20px", color: "var(--rc-text-3)", fontSize: 12.5 }}>{diffCount === 0 ? t("İki setup'ın tüm anlamlı değerleri aynı.") : t("Gösterilecek satır yok.")}</div>
          ) : (
            groups.map(({ cat, list }) => {
              const acc = CAT_ACC[cat] || "#A88C93";
              const dn = list.filter((r) => r.differ).length;
              return (
                <div key={cat}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 20px", background: `${acc}14`, borderBottom: `1px solid ${acc}33`, fontFamily: "var(--rc-font-display)", textTransform: "uppercase", letterSpacing: ".06em", fontSize: 13, fontWeight: 700, color: acc }}>
                    <span>{CAT_META[cat]?.icon || "•"} {t(CAT_META[cat]?.tr || cat)}</span>
                    {dn > 0 && <span style={{ marginLeft: "auto", fontSize: 10, padding: "2px 9px", borderRadius: 99, border: "1px solid var(--rc-warn)", color: "var(--rc-warn)" }}>{dn} {t("fark")}</span>}
                  </div>
                  {list.map((r) => {
                    const d = deltaOf(r);
                    return (
                      <div key={`${r.section}/${r.key}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 20px", borderBottom: "1px solid var(--rc-line-soft)", borderLeft: `3px solid ${r.differ ? "var(--rc-warn)" : "transparent"}`, background: r.differ ? "rgba(245,178,61,.05)" : "transparent" }}>
                        <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: "var(--rc-text-2)" }}>{t(SVM_FIELDS[r.key] || r.key)}</span>
                        <b style={{ fontFamily: "var(--rc-font-display)", fontSize: 14, textAlign: "right", minWidth: 60, color: r.differ ? A_COL : "var(--rc-text-3)" }}>{r.a}</b>
                        <span style={{ color: "var(--rc-border-strong)", fontSize: 12, flex: "0 0 auto" }}>→</span>
                        <b style={{ fontFamily: "var(--rc-font-display)", fontSize: 14, textAlign: "left", minWidth: 60, color: r.differ ? "var(--rc-text)" : "var(--rc-text-3)" }}>{r.b}</b>
                        <span style={{ fontFamily: "var(--rc-font-display)", fontSize: 12, textAlign: "right", minWidth: 48, color: A_COL }}>{d}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* alt: fark yönü + kopyala + kapat */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 20px", borderTop: "1px solid var(--rc-border)", background: "var(--rc-surface-2)" }}>
          <span style={{ fontSize: 11, color: "var(--rc-text-3)" }}>{t("Fark yönü")} A → B</span>
          <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button onClick={copyDiffs} style={{ padding: "8px 15px", borderRadius: 9, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 12.5 }}>📋 {t("Farkları kopyala")}</button>
            <button onClick={onClose} style={{ padding: "8px 18px", borderRadius: 9, border: "1px solid var(--rc-brand-bright)", background: "var(--rc-brand)", color: "var(--rc-on-brand)", cursor: "pointer", fontSize: 12.5, fontWeight: 600 }}>{t("Kapat")}</button>
          </span>
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
/* Create & Join — v2.0 "TAKIMA BAĞLAN" (handoff: kur/katıl iki sekme + bilgi paneli).
   TAKIM KUR: ad + opsiyonel logo (staged → createTeam sonrası saveTeamAsset) + ilk
   sezon seçimi (2026 WEC | boş). TAKIMA KATIL: 6 haneli kod. İşlevler eskisiyle aynı. */
export function CreateJoinModal({ open, onClose, user, t, userName,
  tForm, setTForm, setTErr, tErr, setCurTeam }) {
  const [tab, setTab] = useState("kur");         // "kur" | "katil"
  const [logoUri, setLogoUri] = useState("");    // staged logo (data URI)
  const [logoErr, setLogoErr] = useState("");
  const [seedSeason, setSeedSeason] = useState(true);  // ilk sezon: 2026 WEC | boş
  const [busy, setBusy] = useState(false);
  if (!open || !user) return null;

  const year = new Date().getFullYear();
  const seasonLabel = `${year} WEC`;

  const onLogoFile = async (f) => {
    if (!f) return;
    setLogoErr("");
    try { setLogoUri(await processImageFile(f, "logo")); }
    catch { setLogoErr(t("Logo yüklenemedi — PNG/SVG, en az 256×256.")); }
  };
  const doCreate = async () => {
    if (!tForm.name.trim() || busy) return;
    setBusy(true); setTErr("");
    try {
      const tid = await createTeam(user, tForm.name.trim(), userName);
      if (logoUri) await saveTeamAsset(tid, "logo", logoUri).catch(() => {});
      if (seedSeason) await createSeason(tid, "WEC", year).catch(() => {});
      setCurTeam(tid); setTForm({ ...tForm, name: "" }); setLogoUri(""); onClose();
    } catch { setTErr(t("Takım kurulamadı")); }
    setBusy(false);
  };
  const doJoin = async () => {
    if (tForm.join.trim().length < 4 || busy) return;
    setBusy(true); setTErr("");
    try {
      const tid = await joinTeam(user, tForm.join, userName);
      setCurTeam(tid); setTForm({ ...tForm, join: "" }); onClose();
    } catch (e) {
      setTErr(e.message === "NOT_FOUND" ? t("Takım bulunamadı") : t("Katılınamadı"));
    }
    setBusy(false);
  };

  const overlay = { position: "fixed", inset: 0, zIndex: 2200, display: "flex",
    alignItems: "center", justifyContent: "center", padding: "28px 18px",
    background: "rgba(6,4,5,.72)", backdropFilter: "blur(6px)", animation: "rcfade .18s ease" };
  const box = { width: "min(780px,96vw)", maxHeight: "92vh", overflow: "auto",
    background: "var(--rc-surface)", border: "1px solid var(--rc-border-strong)",
    borderRadius: 16, boxShadow: "var(--rc-shadow-card)", color: "var(--rc-text)",
    fontFamily: "var(--rc-font-ui)", animation: "rcpop .2s ease" };
  const disp = { fontFamily: "var(--rc-font-display)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em" };
  const tabBtn = (on) => ({ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 18px",
    borderRadius: 10, cursor: "pointer", fontSize: 13, ...disp, letterSpacing: ".06em",
    border: `1px solid ${on ? "var(--rc-brand-bright)" : "var(--rc-border)"}`,
    background: on ? "var(--rc-brand)" : "var(--rc-surface-3)", color: on ? "var(--rc-on-brand)" : "var(--rc-text-2)" });
  const lbl = { display: "block", color: "var(--rc-text-3)", fontSize: 10, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 7 };
  const inp = { width: "100%", boxSizing: "border-box", background: "var(--rc-surface-3)", border: "1px solid var(--rc-border-strong)", borderRadius: 10, color: "var(--rc-text)", padding: "12px 14px", fontFamily: "var(--rc-font-display)", fontSize: 20, fontWeight: 600 };
  const chip = (on) => ({ padding: "8px 16px", borderRadius: 99, cursor: "pointer", fontSize: 12.5,
    border: `1px solid ${on ? "var(--rc-brand-bright)" : "var(--rc-border)"}`,
    background: on ? "rgba(150,0,24,.22)" : "var(--rc-surface-3)", color: on ? "var(--rc-text)" : "var(--rc-text-2)" });
  const panel = { flex: "0 1 300px", minWidth: 220, alignSelf: "stretch", background: "var(--rc-surface-2)",
    border: "1px solid var(--rc-border)", borderRadius: 12, padding: "16px 18px" };
  const panelH = { ...disp, fontSize: 12, letterSpacing: ".1em", color: "var(--rc-brand-bright)", marginBottom: 12 };
  const bullet = (ico, tx) => (
    <span key={tx} style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: 12.5, color: "var(--rc-text-2)", lineHeight: 1.5, marginBottom: 10 }}>
      <span style={{ flex: "0 0 auto" }}>{ico}</span>{t(tx)}</span>
  );

  return (
    <div style={overlay} onClick={onClose}>
      <div style={box} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "18px 22px", borderBottom: "1px solid var(--rc-border)" }}>
          <h2 style={{ margin: 0, ...disp, fontSize: 20 }}>{t("Takıma Bağlan")}</h2>
          <span style={{ fontSize: 12.5, color: "var(--rc-text-3)" }}>{t("Yeni bir takım kur ya da katılım koduyla katıl")}</span>
          <button onClick={onClose} style={{ marginLeft: "auto", width: 34, height: 34, borderRadius: 9, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 15 }}>✕</button>
        </div>

        <div style={{ padding: "18px 22px" }}>
          <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
            <button onClick={() => { setTab("kur"); setTErr(""); }} style={tabBtn(tab === "kur")}>＋ {t("Takım Kur")}</button>
            <button onClick={() => { setTab("katil"); setTErr(""); }} style={tabBtn(tab === "katil")}>🔑 {t("Takıma Katıl")}</button>
          </div>

          {tab === "kur" ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "flex-start" }}>
              <div style={{ flex: "1 1 320px", minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label style={lbl}>{t("Takım adı")}</label>
                  <input value={tForm.name} placeholder={t("örn. Caspian Motorsport")}
                    maxLength={32} onChange={(e) => setTForm({ ...tForm, name: e.target.value })}
                    style={{ ...inp, textTransform: "none" }} />
                  <div style={{ fontSize: 11, color: "var(--rc-text-3)", marginTop: 6 }}>{t("Yarış çubuğunda ve pit board'da görünür · en fazla 32 karakter")}</div>
                </div>
                <div>
                  <label style={lbl}>{t("Takım logosu")} <span style={{ textTransform: "none", letterSpacing: 0, color: "var(--rc-text-4)" }}>({t("isteğe bağlı")})</span></label>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <label style={{ width: 92, height: 92, flex: "0 0 auto", borderRadius: 12, border: "1px dashed var(--rc-border-strong)", background: "var(--rc-surface-3)", display: "grid", placeItems: "center", cursor: "pointer", overflow: "hidden" }}>
                      {logoUri
                        ? <img src={logoUri} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                        : <span style={{ fontSize: 26, color: "var(--rc-text-3)" }}>+</span>}
                      <input type="file" accept={IMG_ACCEPT_TYPES.join(",")} style={{ display: "none" }}
                        onChange={(e) => { onLogoFile(e.target.files?.[0]); e.target.value = ""; }} />
                    </label>
                    <div style={{ fontSize: 11.5, color: "var(--rc-text-3)", lineHeight: 1.6 }}>
                      {t("Sürükleyip bırak ya da seç.")}<br />{t("PNG / SVG · en az 256×256")}
                      {logoUri && <><br /><button onClick={() => setLogoUri("")} style={{ marginTop: 4, background: "none", border: "none", color: "var(--rc-brand-bright)", cursor: "pointer", fontSize: 11.5, padding: 0 }}>✕ {t("Kaldır")}</button></>}
                    </div>
                  </div>
                  {logoErr && <div style={{ fontSize: 11.5, color: "var(--rc-danger)", marginTop: 6 }}>{logoErr}</div>}
                </div>
                <div>
                  <label style={lbl}>{t("İlk sezon")}</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setSeedSeason(true)} style={chip(seedSeason)}>{seasonLabel}</button>
                    <button onClick={() => setSeedSeason(false)} style={chip(!seedSeason)}>{t("Boş başla")}</button>
                  </div>
                </div>
              </div>
              <div style={panel}>
                <div style={panelH}>{t("Kurduğunda ne olur")}</div>
                {bullet(<span style={{ color: "var(--rc-warn)", display: "inline-flex" }}><RoleIcon name="owner" size={14} /></span>, "Takım sahibi sen olursun")}
                {bullet("🔑", "6 haneli katılım kodu üretilir")}
                {bullet("🏁", "Sezon takvimi ve yarış odaları açılır")}
                {bullet("📋", "Setup havuzu takımla paylaşılır")}
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "flex-start" }}>
              <div style={{ flex: "1 1 320px", minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label style={lbl}>{t("Katılım kodu")}</label>
                  <input value={tForm.join} placeholder="ABC123" maxLength={6}
                    onChange={(e) => setTForm({ ...tForm, join: e.target.value.toUpperCase() })}
                    style={{ ...inp, letterSpacing: ".3em", textAlign: "center" }} />
                  <div style={{ fontSize: 11, color: "var(--rc-text-3)", marginTop: 6 }}>{t("Takım sahibinden aldığın 6 haneli kodu gir.")}</div>
                </div>
              </div>
              <div style={panel}>
                <div style={panelH}>{t("Katıldığında ne olur")}</div>
                {bullet("🏢", "Takımın tüm yarış takvimini görürsün")}
                {bullet(<span style={{ color: "var(--rc-ok)", display: "inline-flex" }}><RoleIcon name="eng" size={14} /></span>, "Yarış odalarına ortak ekranla katılırsın")}
                {bullet("📋", "Takımın setup havuzuna erişirsin")}
                {bullet("🛡", "Yetkiler takım sahibince atanır")}
              </div>
            </div>
          )}

          {tErr && <div style={{ color: "var(--rc-danger)", fontSize: 12.5, marginTop: 14 }}>{tErr}</div>}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 22px", borderTop: "1px solid var(--rc-border)" }}>
          <span style={{ fontSize: 12, color: "var(--rc-text-3)" }}>
            {tab === "kur"
              ? `${userName || user.email} ${t("olarak kurulacak")}`
              : `${userName || user.email} ${t("olarak katılacaksın")}`}</span>
          <span style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
            <button onClick={onClose} style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text-2)", cursor: "pointer", fontSize: 13 }}>{t("Vazgeç")}</button>
            {tab === "kur" ? (
              <button onClick={doCreate} disabled={!tForm.name.trim() || busy}
                style={{ padding: "10px 24px", borderRadius: 10, border: "1px solid var(--rc-brand-bright)", background: "var(--rc-brand)", color: "var(--rc-on-brand)", cursor: tForm.name.trim() && !busy ? "pointer" : "default", opacity: tForm.name.trim() && !busy ? 1 : .5, ...disp, fontSize: 14 }}>{busy ? t("Kuruluyor…") : t("Takımı Kur")}</button>
            ) : (
              <button onClick={doJoin} disabled={tForm.join.trim().length < 4 || busy}
                style={{ padding: "10px 24px", borderRadius: 10, border: "1px solid var(--rc-brand-bright)", background: "var(--rc-brand)", color: "var(--rc-on-brand)", cursor: tForm.join.trim().length >= 4 && !busy ? "pointer" : "default", opacity: tForm.join.trim().length >= 4 && !busy ? 1 : .5, ...disp, fontSize: 14 }}>{busy ? t("Katılınıyor…") : t("Takıma Katıl")}</button>
            )}
          </span>
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

/* ============================================================
   TeamScreen — v2.0 TAKIM tam ekranı (handoff: ekranlar/10-takim.md)
   ------------------------------------------------------------
   Sol: takım kimliği (logo sürükle-bırak + ad + katılım kodu) + araç görselleri.
   Sağ: üyeler & yetkiler (rol + sürücü/mühendis + ⋯ menü) · sezon takvimi ·
   takım hareketleri (yarış createdAt'ten türetilir) · tehlikeli işlemler.
   Kabuk (shell + rail) App tarafından sağlanır; bu bileşen yalnız içeriktir.
   ============================================================ */
export function TeamScreen({ user, t, lang, myTeams, curTeam, setCurTeam,
  teamData, tnEdit, setTnEdit, canManageTeam, canEditTeam, curSeason, setCurSeason,
  seasons, races, st, myRole, openRace, setRForm, setBadge, roleLabel, onCreateJoin, onExit }) {
  const [astCls, setAstCls] = useState("hypercar");
  const [astCar, setAstCar] = useState("");
  const [menuUid, setMenuUid] = useState("");
  const [copied, setCopied] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoErr, setLogoErr] = useState("");
  const isOwner = myRole === "owner";
  const astKey = astCar ? carAssetKey(astCls, astCar) : "";
  const astCustom = (angle) => teamData?.assets?.cars?.[astKey]?.[angle] || "";

  const c = {
    card: { border: "1px solid var(--rc-border)", borderRadius: 12, background: "var(--rc-surface)", overflow: "hidden" },
    hd: { display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: "1px solid var(--rc-border)", flexWrap: "wrap" },
    hdT: { fontFamily: "var(--rc-font-display)", textTransform: "uppercase", letterSpacing: ".08em", fontSize: 16, fontWeight: 700 },
    dim: { color: "var(--rc-text-3)", fontSize: 12 },
    sBtn: { padding: "7px 14px", borderRadius: 9, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text)", cursor: "pointer", fontSize: 12 },
    mini: { width: 26, height: 26, borderRadius: 7, border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text-3)", cursor: "pointer", fontSize: 11, lineHeight: 1 },
  };
  const copyCode = () => {
    const code = teamData?.meta?.joinCode || "";
    if (!code) return;
    try { navigator.clipboard?.writeText(code); } catch { /* yoksay */ }
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };
  const onLogoFile = async (f) => {
    if (!f || !canEditTeam) return;
    setLogoErr(""); setLogoBusy(true);
    try { await saveTeamAsset(curTeam, "logo", await processImageFile(f, "logo")); }
    catch { setLogoErr(t("Logo yüklenemedi — PNG/SVG, en az 256×256.")); }
    setLogoBusy(false);
  };

  const memberList = Object.entries(teamData?.members || {});
  const memberCount = memberList.length;
  const raceCount = Object.keys(races).length;
  const seasonName = (curSeason && seasons[curSeason]?.name)
    || Object.values(seasons)[0]?.name || t("Sezon yok");
  const logoSrc = teamLogoSrc(teamData?.assets);

  const sortedRaces = Object.entries(races)
    .filter(([, r]) => !curSeason || !seasons[curSeason] || r.seasonId === curSeason)
    .sort(([, a], [, b]) => (a.startsAt || 0) - (b.startsAt || 0));
  const swapRace = async (i, j) => {
    const a = sortedRaces[i], b = sortedRaces[j];
    if (!a || !b) return;
    const as = a[1].startsAt || 0, bs = b[1].startsAt || 0;
    await updateRace(curTeam, a[0], { startsAt: bs }).catch(() => {});
    await updateRace(curTeam, b[0], { startsAt: as }).catch(() => {});
  };

  /* Hareket akışı — yarış createdAt/createdBy'den türetilir (uydurma yok). */
  const feed = Object.entries(races)
    .filter(([, r]) => r.createdAt)
    .sort(([, a], [, b]) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 6)
    .map(([rid, r]) => ({
      id: rid, icon: "🏁", col: "var(--rc-brand-bright)",
      who: teamData?.names?.[r.createdBy] || t("Bir üye"),
      text: `${r.name || trackName(r.trackId) || t("yarış")} ${t("yarışını ekledi")}`,
      at: new Date(r.createdAt).toLocaleString(lang === "en" ? "en-GB" : "tr-TR",
        { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),
    }));

  const roleChip = (role) => {
    const own = role === "owner";
    return { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, padding: "3px 10px",
      borderRadius: 99, border: `1px solid ${own ? "var(--rc-brand-bright)" : "var(--rc-border)"}`,
      background: own ? "rgba(150,0,24,.20)" : "var(--rc-surface-3)", color: own ? "var(--rc-text)" : "var(--rc-text-2)",
      textTransform: "uppercase", letterSpacing: ".05em", whiteSpace: "nowrap" };
  };
  const tgl = (on, col, bg) => ({ width: 40, height: 30, borderRadius: 8, cursor: "pointer",
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    border: `1px solid ${on ? col : "var(--rc-border)"}`, background: on ? bg : "var(--rc-surface-3)",
    color: on ? col : "var(--rc-icon-off)" });

  if (!curTeam || !teamData) {
    return (
      <div style={{ padding: "40px 24px", textAlign: "center", color: "var(--rc-text-3)", fontFamily: "var(--rc-font-ui)" }}>
        <div style={{ fontFamily: "var(--rc-font-display)", fontWeight: 700, fontSize: 20, color: "var(--rc-text)", marginBottom: 8 }}>{t("Henüz bir takımın yok")}</div>
        <div style={{ fontSize: 13, marginBottom: 16 }}>{t("Yeni takım kur ya da katılım kodu ile katıl.")}</div>
        {onCreateJoin && (
          <button onClick={onCreateJoin} style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid var(--rc-brand-bright)", background: "var(--rc-brand)", color: "var(--rc-on-brand)", cursor: "pointer", fontFamily: "var(--rc-font-display)", fontWeight: 700, fontSize: 14, textTransform: "uppercase" }}>🏢 {t("Kur & Katıl")}</button>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: "16px 20px 48px", fontFamily: "var(--rc-font-ui)", color: "var(--rc-text)", animation: "rcin .26s ease-out" }}
      onClick={() => menuUid && setMenuUid("")}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontFamily: "var(--rc-font-display)", textTransform: "uppercase", letterSpacing: ".06em", fontSize: 22, fontWeight: 700 }}>{t("Takım")}</h2>
        {Object.keys(myTeams).length > 1 && (
          <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {Object.entries(myTeams).map(([tid, nm]) => (
              <button key={tid} onClick={() => setCurTeam(tid)} style={{ ...c.sBtn,
                border: `1px solid ${curTeam === tid ? "var(--rc-brand-bright)" : "var(--rc-border)"}`,
                background: curTeam === tid ? "rgba(150,0,24,.20)" : "var(--rc-surface-3)" }}>{nm}</button>
            ))}
          </span>
        )}
        {onExit && <button onClick={onExit} style={{ ...c.sBtn, marginLeft: "auto" }}>{t("Kapat")}</button>}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
        {/* ═══════════ SOL ═══════════ */}
        <div style={{ flex: "1 1 300px", maxWidth: 360, display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Takım kimliği */}
          <div style={{ ...c.card, padding: 18, textAlign: "center" }}>
            <label
              onDragOver={(e) => { e.preventDefault(); }}
              onDrop={(e) => { e.preventDefault(); onLogoFile(e.dataTransfer?.files?.[0]); }}
              style={{ position: "relative", width: 140, height: 140, margin: "0 auto 12px", border: "1.5px dashed var(--rc-border-strong)", borderRadius: 14, background: "var(--rc-surface-2)", display: "grid", placeItems: "center", overflow: "hidden", cursor: canEditTeam ? "pointer" : "default" }}>
              {logoSrc
                ? <img src={logoSrc} alt="" style={{ maxWidth: "78%", maxHeight: "78%", objectFit: "contain" }} />
                : <img src={`${ASSET}logo.png`} alt="" style={{ maxWidth: "70%", maxHeight: "70%", objectFit: "contain", opacity: .5 }} />}
              <span style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "5px 0", background: "rgba(11,7,8,.82)", fontSize: 10, textTransform: "uppercase", letterSpacing: ".09em", color: "var(--rc-text-2)" }}>{logoBusy ? t("Yükleniyor…") : t("sürükle-bırak")}</span>
              {canEditTeam && <input type="file" accept={IMG_ACCEPT_TYPES.join(",")} style={{ display: "none" }}
                onChange={(e) => { onLogoFile(e.target.files?.[0]); e.target.value = ""; }} />}
            </label>
            {canEditTeam && (
              <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 10 }}>
                <label style={{ ...c.sBtn, padding: "6px 14px" }}>{t("Logo değiştir")}
                  <input type="file" accept={IMG_ACCEPT_TYPES.join(",")} style={{ display: "none" }}
                    onChange={(e) => { onLogoFile(e.target.files?.[0]); e.target.value = ""; }} /></label>
                {logoSrc && <button onClick={() => clearTeamAsset(curTeam, "logo").catch(() => {})} style={{ ...c.sBtn, padding: "6px 14px", color: "var(--rc-text-3)" }}>{t("Kaldır")}</button>}
              </div>
            )}
            <div style={{ color: "var(--rc-text-3)", fontSize: 10.5, margin: "0 0 12px", lineHeight: 1.5 }}>{t("PNG veya SVG · en az 256×256 · şeffaf zemin önerilir")}</div>
            {logoErr && <div style={{ color: "var(--rc-danger)", fontSize: 11, marginBottom: 10 }}>{logoErr}</div>}

            {tnEdit === null || !canManageTeam ? (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
                <span style={{ fontFamily: "var(--rc-font-display)", fontWeight: 700, fontSize: 22, letterSpacing: ".02em" }}>{teamData?.meta?.name || "—"}</span>
                {canManageTeam && <button onClick={() => setTnEdit(teamData?.meta?.name || "")} title={t("Düzenle")} style={{ ...c.mini, width: 24, height: 24 }}>✎</button>}
              </div>
            ) : (
              <div style={{ display: "flex", gap: 6, maxWidth: 300, margin: "0 auto" }}>
                <input type="text" value={tnEdit} maxLength={40} autoFocus
                  style={{ flex: 1, background: "var(--rc-surface-3)", border: "1px solid var(--rc-border)", borderRadius: 8, color: "var(--rc-text)", padding: "7px 10px", textTransform: "none", fontSize: 14 }}
                  onChange={(e) => setTnEdit(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Escape") setTnEdit(null); }} />
                <button disabled={!tnEdit.trim()} style={{ ...c.sBtn, opacity: tnEdit.trim() ? 1 : .45 }}
                  onClick={async () => { const nm = tnEdit.trim(); setTnEdit(null);
                    try { await renameTeam(curTeam, nm); await syncMyTeamName(user.uid, curTeam, nm); } catch { /* yoksay */ } }}>{t("Kaydet")}</button>
              </div>
            )}
            <div style={{ color: "var(--rc-text-3)", fontSize: 12, marginTop: 4 }}>{seasonName} · {memberCount} {t("üye")} · {raceCount} {t("yarış")}</div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, background: "var(--rc-surface-3)", border: "1px solid var(--rc-border-strong)", borderRadius: 10, padding: "9px 14px", marginTop: 14 }}>
              <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--rc-text-3)" }}>{t("Katılım kodu")}</span>
              <b style={{ fontFamily: "var(--rc-font-display)", fontWeight: 700, letterSpacing: ".16em", fontSize: 18 }}>{teamData?.meta?.joinCode || "—"}</b>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button onClick={copyCode} style={{ ...c.sBtn, flex: 1, padding: "8px 12px" }}>{copied ? `✓ ${t("Kopyalandı")}` : t("Kodu kopyala")}</button>
              {isOwner && (
                <button onClick={async () => { if (await confirmDialog({ title: t("Kodu yenile"), message: t("Katılım kodu yenilensin mi? Eski kod geçersiz olur."), confirmText: t("Yenile") }))
                  await regenerateJoinCode(curTeam, teamData?.meta?.joinCode).catch(() => {}); }}
                  style={{ ...c.sBtn, flex: 1, padding: "8px 12px" }}>{t("Yenile")}</button>
              )}
            </div>
          </div>

          {/* Araç görselleri */}
          {canEditTeam && (
            <div style={{ ...c.card, padding: 16 }}>
              <div style={{ ...c.hdT, fontSize: 14, marginBottom: 12 }}>{t("Araç Görselleri")}</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <ImgSelect value={astCls} options={classOptions()} t={t} placeholder={t("Sınıf")}
                  onChange={(v) => { setAstCls(v); setAstCar(""); }} />
                <ImgSelect value={astCar} options={carOptions(astCls)} t={t} placeholder={t("Araç")}
                  disabled={!astCls} onChange={(v) => setAstCar(v)} />
              </div>
              {astCar ? (
                <div style={{ display: "flex", gap: 10 }}>
                  <AssetUpload label={`${t("Yandan")} (SIDE)`} specKey="carSide" aspect="1000 / 400" w={190}
                    current={astCustom("side")} fallback={carImg(astCls, astCar)} canEdit={canEditTeam} t={t}
                    onSave={(uri) => saveTeamAsset(curTeam, `cars/${astKey}/side`, uri)}
                    onClear={() => clearTeamAsset(curTeam, `cars/${astKey}/side`).catch(() => {})} />
                  <AssetUpload label={`${t("Üstten")} (TOP)`} specKey="carTop" aspect="400 / 1000" w={80}
                    current={astCustom("top")} fallback={`${ASSET}cartop/default.png`} canEdit={canEditTeam} t={t}
                    onSave={(uri) => saveTeamAsset(curTeam, `cars/${astKey}/top`, uri)}
                    onClear={() => clearTeamAsset(curTeam, `cars/${astKey}/top`).catch(() => {})} />
                </div>
              ) : <div style={c.dim}>{t("Görsel yüklemek için önce araç seç.")}</div>}
            </div>
          )}
        </div>

        {/* ═══════════ SAĞ ═══════════ */}
        <div style={{ flex: "1 1 560px", minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Üyeler & yetkiler */}
          <div style={c.card}>
            <div style={c.hd}>
              <span style={c.hdT}>{t("Üyeler & Yetkiler")}</span>
              <span style={c.dim}>{memberCount} {t("kişi")}</span>
              <button onClick={copyCode} style={{ ...c.sBtn, marginLeft: "auto" }}>＋ {t("Üye davet et")}</button>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
                <thead><tr>
                  {[t("Üye"), t("Rol"),
                    <span key="drv" style={{ display: "inline-flex", alignItems: "center", gap: 6, justifyContent: "center" }}><span style={{ color: "var(--rc-info)", display: "inline-flex" }}><RoleIcon name="drv" size={14} /></span>{t("Sürücü")}</span>,
                    <span key="eng" style={{ display: "inline-flex", alignItems: "center", gap: 6, justifyContent: "center" }}><span style={{ color: "var(--rc-ok)", display: "inline-flex" }}><RoleIcon name="eng" size={14} /></span>{t("Mühendis")}</span>,
                    t("Son görülme"), ""].map((h, i) => (
                    <th key={i} style={{ textAlign: i < 2 ? "left" : "center", padding: "9px 14px", fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".07em", color: "var(--rc-text-3)", borderBottom: "1px solid var(--rc-border)", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {memberList.map(([uid, role]) => {
                    const isSelf = uid === user.uid;
                    const drvOn = hasBadge(teamData, uid, "driver");
                    const engOn = hasBadge(teamData, uid, "engineer");
                    return (
                      <tr key={uid} style={{ borderBottom: "1px solid var(--rc-line-soft)" }}>
                        <td style={{ padding: "10px 14px" }}>
                          <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <Avatar uid={uid} name={teamData?.names?.[uid]} photo={teamData?.photos?.[uid]} size={26} />
                            <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                              <b style={{ fontSize: 14 }}>{teamData?.names?.[uid] || (isSelf ? t("(sen)") : uid.slice(0, 8) + "…")}{teamData?.names?.[uid] && isSelf ? ` ${t("(sen)")}` : ""}</b>
                            </span>
                          </span>
                        </td>
                        <td style={{ padding: "10px 14px" }}><span style={roleChip(role)}>{role === "owner" && <RoleIcon name="owner" size={12} />}{t(roleLabel(role))}</span></td>
                        <td style={{ padding: "10px 14px", textAlign: "center" }}>
                          <button disabled={!canManageTeam} onClick={() => canManageTeam && setBadge(uid, "driver", !drvOn)}
                            title={t("Sürücü")} style={{ ...tgl(drvOn, BADGES.driver.col, BADGES.driver.bg), cursor: canManageTeam ? "pointer" : "default" }}><RoleIcon name="drv" size={16} /></button>
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "center" }}>
                          <button disabled={!canManageTeam} onClick={() => canManageTeam && setBadge(uid, "engineer", !engOn)}
                            title={t("Mühendis")} style={{ ...tgl(engOn, BADGES.engineer.col, BADGES.engineer.bg), cursor: canManageTeam ? "pointer" : "default" }}><RoleIcon name="eng" size={16} /></button>
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "center", color: "var(--rc-text-4)", fontSize: 12 }}>—</td>
                        <td style={{ padding: "10px 14px", textAlign: "center" }}>
                          {canManageTeam && (
                            <span style={{ position: "relative", display: "inline-flex" }}>
                              <button onClick={(e) => { e.stopPropagation(); setMenuUid(menuUid === uid ? "" : uid); }}
                                style={{ ...c.mini, width: 28 }}>⋯</button>
                              {menuUid === uid && (
                                <span onClick={(e) => e.stopPropagation()} style={{ position: "absolute", top: "110%", right: 0, zIndex: 20, minWidth: 180, background: "var(--rc-surface-2)", border: "1px solid var(--rc-border-strong)", borderRadius: 10, boxShadow: "var(--rc-shadow-card)", padding: 5, display: "flex", flexDirection: "column", gap: 2 }}>
                                  {!isSelf && (
                                    <button style={{ ...c.sBtn, border: "none", background: "transparent", textAlign: "left", padding: "8px 10px" }}
                                      onClick={async () => { setMenuUid(""); if (await confirmDialog({ title: t("Sahipliği devret"), message: t("Sahiplik bu üyeye devredilsin mi?"), confirmText: t("Devret") })) await transferOwnership(curTeam, uid, user.uid).catch(() => {}); }}><span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><RoleIcon name="owner" size={13} />{t("Sahipliği devret")}</span></button>
                                  )}
                                  <button style={{ ...c.sBtn, border: "none", background: "transparent", textAlign: "left", padding: "8px 10px" }}
                                    onClick={() => { setMenuUid(""); copyCode(); }}>✉ {t("Yeniden davet et")}</button>
                                  {!isSelf && (
                                    <button style={{ border: "none", background: "transparent", textAlign: "left", padding: "8px 10px", color: "var(--rc-danger)", cursor: "pointer", fontSize: 12, borderRadius: 7 }}
                                      onClick={async () => { setMenuUid(""); if (await confirmDialog({ title: t("Üyeyi çıkar"), message: t("Üye takımdan çıkarılsın mı?"), confirmText: t("Çıkar"), danger: true })) await removeMember(curTeam, uid).catch(() => {}); }}>✕ {t("Takımdan çıkar")}</button>
                                  )}
                                </span>
                              )}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sezon takvimi */}
          <div style={c.card}>
            <div style={c.hd}>
              <span style={c.hdT}>{t("Sezon Takvimi")}</span>
              <span style={{ display: "flex", gap: 6, marginLeft: 8, flexWrap: "wrap" }}>
                <button onClick={() => setCurSeason("")} style={{ ...c.sBtn, borderRadius: 99, padding: "5px 12px",
                  border: `1px solid ${curSeason === "" ? "var(--rc-brand-bright)" : "var(--rc-border)"}`,
                  background: curSeason === "" ? "rgba(150,0,24,.22)" : "var(--rc-surface-3)" }}>{t("Tümü")}</button>
                {Object.entries(seasons).map(([sid, se]) => (
                  <button key={sid} onClick={() => setCurSeason(sid)} style={{ ...c.sBtn, borderRadius: 99, padding: "5px 12px",
                    border: `1px solid ${curSeason === sid ? "var(--rc-brand-bright)" : "var(--rc-border)"}`,
                    background: curSeason === sid ? "rgba(150,0,24,.22)" : "var(--rc-surface-3)" }}>{se.name}</button>
                ))}
                {canEditTeam && (
                  <button onClick={async () => { const nm = await promptDialog({ title: t("Yeni sezon"), message: t("Sezon adı"), defaultValue: `${new Date().getFullYear()} WEC`, confirmText: t("Ekle") });
                    if (nm) await createSeason(curTeam, nm, new Date().getFullYear()).catch(() => {}); }}
                    style={{ ...c.sBtn, borderRadius: 99, padding: "5px 11px", border: "1px dashed var(--rc-border-strong)", background: "transparent", color: "var(--rc-text-3)" }}>＋ {t("Sezon")}</button>
                )}
              </span>
              {canEditTeam && (
                <button onClick={() => setRForm({ rid: null, flow: "data", seasonId: curSeason || null, round: "", name: "",
                  trackId: st.track || "", carClass: st.carClass || "hypercar", carId: st.car || "",
                  raceTime: st.raceTime || "6:00:00", startsAt: Date.now() })}
                  style={{ ...c.sBtn, marginLeft: "auto" }}>＋ {t("Yarış ekle")}</button>
              )}
            </div>
            {sortedRaces.length === 0 && <div style={{ padding: "14px 16px", ...c.dim }}>{t("Takvimde yarış yok.")}</div>}
            {sortedRaces.map(([rid, r], i) => (
              <div key={rid} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderTop: i > 0 ? "1px solid var(--rc-line-soft)" : "none" }}>
                <span style={{ fontFamily: "var(--rc-font-display)", fontWeight: 700, fontSize: 15, color: "var(--rc-text-3)", width: 34, flex: "0 0 auto" }}>{r.round ? `R${r.round}` : "—"}</span>
                {r.trackId && <img src={`${ASSET}flags/${TRACK_ASSET(r.trackId)}.png${AV}`} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} style={{ width: 26, borderRadius: 3, border: "1px solid var(--rc-border)", flex: "0 0 auto" }} />}
                <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0, flex: 1 }}>
                  <b style={{ fontSize: 14 }}>{r.name || trackName(r.trackId) || "—"}</b>
                  <span style={{ fontSize: 11, color: "var(--rc-text-3)" }}>{[trackName(r.trackId), r.raceTime, r.startsAt ? new Date(r.startsAt).toLocaleDateString(lang === "en" ? "en-GB" : "tr-TR", { day: "2-digit", month: "short" }) : ""].filter(Boolean).join(" · ")}</span>
                </span>
                <button onClick={() => openRace(rid)} style={{ padding: "7px 16px", borderRadius: 8, border: "1px solid var(--rc-brand-bright)", background: "var(--rc-brand)", color: "var(--rc-on-brand)", cursor: "pointer", fontFamily: "var(--rc-font-display)", fontSize: 13, fontWeight: 700, textTransform: "uppercase", flex: "0 0 auto" }}>{t("Aç")}</button>
                {canEditTeam && (
                  <span style={{ display: "flex", gap: 5, flex: "0 0 auto" }}>
                    <button title={t("Yukarı taşı")} disabled={i === 0} onClick={() => swapRace(i, i - 1)} style={{ ...c.mini, opacity: i === 0 ? .4 : 1 }}>▲</button>
                    <button title={t("Aşağı taşı")} disabled={i === sortedRaces.length - 1} onClick={() => swapRace(i, i + 1)} style={{ ...c.mini, opacity: i === sortedRaces.length - 1 ? .4 : 1 }}>▼</button>
                    <button title={t("Düzenle")} onClick={() => setRForm({ rid, ...r, flow: "data" })} style={c.mini}>✎</button>
                    <button title={t("Sil")} onClick={async () => { if (await confirmDialog({ title: t("Yarışı sil"), message: t("Yarış silinsin mi?"), confirmText: t("Sil"), danger: true })) deleteRace(curTeam, rid).catch(() => {}); }} style={c.mini}>✕</button>
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Takım hareketleri */}
          <div style={c.card}>
            <div style={c.hd}>
              <span style={c.hdT}>{t("Takım Hareketleri")}</span>
            </div>
            {feed.length === 0 && <div style={{ padding: "14px 16px", ...c.dim }}>{t("Henüz hareket yok.")}</div>}
            {feed.map((f) => (
              <div key={f.id} style={{ display: "flex", alignItems: "flex-start", gap: 11, padding: "11px 16px", borderTop: "1px solid var(--rc-surface-5)" }}>
                <span style={{ width: 28, height: 28, borderRadius: 9, flex: "0 0 auto", background: "var(--rc-surface-3)", border: `1px solid ${f.col}`, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>{f.icon}</span>
                <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
                  <span style={{ fontSize: 12.5, lineHeight: 1.5 }}><b>{f.who}</b> {f.text}</span>
                  <span style={{ fontSize: 10.5, color: "var(--rc-text-3)" }}>{f.at}</span>
                </span>
              </div>
            ))}
          </div>

          {/* Tehlikeli işlemler */}
          <div style={{ ...c.card, border: "1px solid var(--rc-border-strong)" }}>
            <div style={c.hd}><span style={{ ...c.hdT, color: "var(--rc-danger)" }}>{t("Tehlikeli İşlemler")}</span></div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", borderTop: "1px solid var(--rc-surface-5)", flexWrap: "wrap" }}>
              <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
                <b style={{ fontSize: 13 }}>{t("Takımdan ayrıl")}</b>
                <span style={{ fontSize: 11, color: "var(--rc-text-3)" }}>{t("Yarış verilerine ve havuza erişimin kalkar. Sahipsen önce sahipliği devret.")}</span>
              </span>
              <button disabled={isOwner} onClick={async () => { if (await confirmDialog({ title: t("Takımdan ayrıl"), message: t("Takımdan ayrılınsın mı?"), confirmText: t("Ayrıl"), danger: true })) { await leaveTeam(curTeam, user.uid).catch(() => {}); setCurTeam(""); onExit?.(); } }}
                style={{ padding: "8px 15px", borderRadius: 9, border: "1px solid var(--rc-warn)", background: "transparent", color: "var(--rc-warn)", cursor: isOwner ? "not-allowed" : "pointer", fontSize: 12.5, whiteSpace: "nowrap", opacity: isOwner ? .5 : 1 }}>{t("Ayrıl")}</button>
            </div>
            {isOwner && (
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", borderTop: "1px solid var(--rc-surface-5)", flexWrap: "wrap" }}>
                <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
                  <b style={{ fontSize: 13 }}>{t("Takımı sil")}</b>
                  <span style={{ fontSize: 11, color: "var(--rc-text-3)" }}>{t("Sezonlar, yarışlar ve takım setupları kalıcı olarak silinir. Geri alınamaz.")}</span>
                </span>
                <button onClick={async () => { if (await confirmDialog({ title: t("Takımı sil"), message: t("Takım kalıcı olarak silinsin mi? Bu işlem geri alınamaz."), confirmText: t("Takımı sil"), danger: true })) { await deleteTeam(curTeam, user.uid, teamData?.meta?.joinCode).catch(() => {}); setCurTeam(""); onExit?.(); } }}
                  style={{ padding: "8px 15px", borderRadius: 9, border: "1px solid var(--rc-danger)", background: "rgba(255,77,94,.10)", color: "var(--rc-danger)", cursor: "pointer", fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap" }}>{t("Takımı sil")}</button>
              </div>
            )}
          </div>
        </div>
      </div>
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
                        const nm = await promptDialog({ title: t("Yeni sezon"), message: t("Sezon adı"), defaultValue: `${new Date().getFullYear()} WEC`, confirmText: t("Ekle") });
                        if (nm) await createSeason(curTeam, nm, new Date().getFullYear())
                          .catch(() => {});
                      }}>+ {t("Sezon")}</button>
                    )}
                  </div>
                  {Object.entries(races)
                    .filter(([, r]) => !curSeason || !seasons[curSeason] || r.seasonId === curSeason)
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
                            onClick={() => setRForm({ rid, ...r, flow: "data" })}>✎</button>
                          <button className="minibtn" title={t("Sil")}
                            onClick={async () => { if (await confirmDialog({ title: t("Yarışı sil"), message: t("Yarış silinsin mi?"), confirmText: t("Sil"), danger: true }))
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
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ color: "var(--rc-ok)", display: "inline-flex" }}><RoleIcon name="eng" size={13} /></span>{t("Yarış Mühendisi")} — {t("yarış datasını değiştirebilir, üyelere dokunamaz")}</span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ color: "var(--rc-info)", display: "inline-flex" }}><RoleIcon name="drv" size={13} /></span>{t("Sürücü")} — {t("her şeyi görür, hiçbir şeyi değiştiremez")}</span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ color: "var(--rc-warn)", display: "inline-flex" }}><RoleIcon name="owner" size={13} /></span>{t("Takım Sahibi")} — {t("rozetleri ve yetkileri yönetir")}</span>
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
/* ConfirmHost — global onay/uyarı/istem penceresi (confirm.js ile konuşur).
   App kökünde BİR KEZ render edilir; native window.confirm/alert/prompt yerine
   arayüzle uyumlu modal gösterir. Klavye: Esc → iptal, Enter → onayla. */
export function ConfirmHost() {
  const [req, setReq] = useState(null);
  const [val, setVal] = useState("");
  useEffect(() => _bindConfirm((r) => {
    // yeni istek gelince öncekini askıda bırakma — güvenli varsayılanla çöz.
    setReq((prev) => { if (prev) prev.resolve(prev.variant === "prompt" ? null : prev.variant === "alert" ? true : false); return r; });
    setVal(r?.defaultValue || "");
  }), []);
  useEffect(() => {
    if (!req) return undefined;
    const isPrompt = req.variant === "prompt", isAlert = req.variant === "alert";
    const onKey = (e) => {
      // alert iptal edilemez (tek buton onayı) → Esc/backdrop true çözer; diğerleri iptal.
      if (e.key === "Escape") { e.preventDefault(); setReq(null); req.resolve(isPrompt ? null : isAlert ? true : false); }
      else if (e.key === "Enter" && !isPrompt) { e.preventDefault(); setReq(null); req.resolve(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [req, val]);
  if (!req) return null;

  const en = (() => { try { return localStorage.getItem("crm-lang") === "en"; } catch { return false; } })();
  const L = en
    ? { cancel: "Cancel", ok: "OK", title: "Are you sure?" }
    : { cancel: "Vazgeç", ok: "Tamam", title: "Emin misin?" };
  const alertOnly = req.variant === "alert";
  const isPrompt = req.variant === "prompt";
  const danger = !!req.danger;
  const done = (v) => { setReq(null); req.resolve(v); };
  const onConfirm = () => done(isPrompt ? (val.trim() || null) : true);
  const onCancel = () => done(isPrompt ? null : alertOnly ? true : false);

  const overlay = { position: "fixed", inset: 0, zIndex: 3000, display: "flex",
    alignItems: "center", justifyContent: "center", padding: "24px 18px",
    background: "rgba(6,4,5,.72)", backdropFilter: "blur(6px)",
    fontFamily: "var(--rc-font-ui)", animation: "rcfade .16s ease" };
  const box = { width: "min(420px,94vw)", background: "var(--rc-surface)",
    border: "1px solid var(--rc-border-strong)", borderRadius: 16,
    boxShadow: "var(--rc-shadow-card)", color: "var(--rc-text)", overflow: "hidden",
    animation: "rcpop .18s ease" };
  const accent = danger ? "var(--rc-danger)" : "var(--rc-brand-bright)";

  return (
    <div style={overlay} onClick={onCancel}>
      <div style={box} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "22px 22px 18px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <span style={{ width: 44, height: 44, borderRadius: 12, display: "grid", placeItems: "center",
            border: `1px solid ${accent}`, background: danger ? "rgba(255,77,94,.10)" : "rgba(150,0,24,.16)" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              {danger
                ? <><path d="M10.3 3.9 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" /></>
                : <><circle cx="12" cy="12" r="9.2" /><path d="M12 8v5M12 16h.01" /></>}
            </svg>
          </span>
          <h3 style={{ margin: 0, fontFamily: "var(--rc-font-display)", fontWeight: 700, fontSize: 19, letterSpacing: ".02em", color: danger ? "var(--rc-danger)" : "var(--rc-text)" }}>
            {req.title || L.title}</h3>
          {req.message && <p style={{ margin: 0, fontSize: 13, color: "var(--rc-text-2)", lineHeight: 1.6, whiteSpace: "pre-line" }}>{req.message}</p>}
          {isPrompt && (
            <input autoFocus value={val} placeholder={req.placeholder || ""}
              onChange={(e) => setVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onConfirm(); } }}
              style={{ width: "100%", boxSizing: "border-box", marginTop: 4, textTransform: "none",
                background: "var(--rc-surface-3)", border: "1px solid var(--rc-border-strong)",
                borderRadius: 10, color: "var(--rc-text)", padding: "11px 13px", fontSize: 15 }} />
          )}
        </div>
        <div style={{ display: "flex", gap: 10, padding: "14px 22px", borderTop: "1px solid var(--rc-border)", background: "#0F090B" }}>
          {!alertOnly && (
            <button onClick={onCancel} style={{ flex: 1, padding: "11px 16px", borderRadius: 10,
              border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text-2)",
              cursor: "pointer", fontFamily: "var(--rc-font-display)", fontWeight: 600, fontSize: 14, textTransform: "uppercase", letterSpacing: ".04em" }}>
              {req.cancelText || L.cancel}</button>
          )}
          <button autoFocus={!isPrompt} onClick={onConfirm} style={{ flex: 1, padding: "11px 16px", borderRadius: 10,
            border: `1px solid ${accent}`, background: danger ? "var(--rc-danger)" : "var(--rc-brand)",
            color: "var(--rc-on-brand)", cursor: "pointer", fontFamily: "var(--rc-font-display)", fontWeight: 700,
            fontSize: 14, textTransform: "uppercase", letterSpacing: ".04em" }}>
            {req.confirmText || L.ok}</button>
        </div>
      </div>
    </div>
  );
}

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
