import { useEffect, useRef } from "react";

/* ============================================================
   Güncelleme penceresi — ortada beliren "yeni sürüm hazır" modalı.
   Kaynak: handoff-spec/guncelleme-penceresi-paketi (Güncelleme Penceresi.dc.html).
   Eski üst güncelleme şeritlerinin (web amber şeridi + Tauri UpdateBanner)
   yerine geçer. Üç faz: idle → downloading → ready.

   Salt sunum bileşeni — durum/faz App'teki useUpdater'dan gelir.
   Dil modalin içinde seçilmez; `lang` prop'undan ('tr'|'en') gelir.
   ============================================================ */

const STR = {
  tr: {
    title: "Yeni sürüm hazır",
    sub: "Caspian Race Monitor güncellemesi indirilmeye hazır.",
    highlights: "Öne çıkanlar",
    close: "Kapat",
    allChanges: "Tüm değişiklikler",
    autoRestart: "Kurulunca yeniden başlat",
    later: "Sonra",
    update: "Şimdi güncelle",
    bgDownload: "Arka planda indir",
    downloading: "İndiriliyor…",
    downloaded: "İndirildi",
    restart: "Yeniden başlat",
  },
  en: {
    title: "Update ready",
    sub: "A Caspian Race Monitor update is ready to download.",
    highlights: "Highlights",
    close: "Close",
    allChanges: "All changes",
    autoRestart: "Restart after install",
    later: "Later",
    update: "Update now",
    bgDownload: "Download in background",
    downloading: "Downloading…",
    downloaded: "Downloaded",
    restart: "Restart",
  },
};

/* Öne çıkan satır ikonları — sıraya göre sabit (İkon Seti çizim dili: 24 viewBox,
   1.8 stroke, currentColor, round uçlar). İçerik changelog'dan gelir, ikon konumdan. */
const HL_ICONS = [
  <svg key="a" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4v16h16" /><path d="m7 14 3-3 3 2 4-5" /></svg>,
  <svg key="b" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4.6 8a10 10 0 0 1 14.8 0M7.6 11a6 6 0 0 1 8.8 0" /><circle cx="12" cy="15" r="1.7" fill="currentColor" stroke="none" /></svg>,
  <svg key="c" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5Z" /><path d="m4 7.5 8 4.5 8-4.5M12 12v9" /></svg>,
];

const TrayIcon = ({ size = 26, stroke = "#F5B23D", sw = 1.9 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v11" /><path d="m7.5 9.5 4.5 4.5 4.5-4.5" /><path d="M4 17.5v1.4A1.6 1.6 0 0 0 5.6 20.5h12.8A1.6 1.6 0 0 0 20 18.9v-1.4" />
  </svg>
);

export default function UpdateModal({
  open, lang = "tr", phase = "idle", pct = 0, autoRestart = true, forced = false,
  oldVersion, newVersion, size, highlights = [],
  onToggleAuto, onUpdate, onRestart, onLater, onClose, onAllChanges,
}) {
  const primaryRef = useRef(null);
  const cardRef = useRef(null);

  /* Açılışta odak birincil düğmede; Esc kapatır; arka plan kaydırması kilitli;
     odak modal içinde döner (basit focus trap). Zorunlu modda Esc/scrim kapatmaz. */
  useEffect(() => {
    if (!open) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = setTimeout(() => primaryRef.current?.focus(), 40);
    const onKey = (e) => {
      if (e.key === "Escape" && !forced) { e.preventDefault(); onClose?.(); return; }
      if (e.key !== "Tab") return;
      const nodes = cardRef.current?.querySelectorAll(
        'button, a[href], [tabindex]:not([tabindex="-1"])');
      if (!nodes || !nodes.length) return;
      const list = Array.from(nodes).filter((n) => !n.disabled);
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, forced, onClose, phase]);

  if (!open) return null;
  const t = STR[lang === "en" ? "en" : "tr"];
  const isIdle = phase === "idle";
  const isDownloading = phase === "downloading";
  const isReady = phase === "ready";
  const rows = (highlights || []).slice(0, 3);

  const primBtn = {
    display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 10,
    cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "var(--rc-font-display)",
    textTransform: "uppercase", letterSpacing: ".06em",
  };
  const ghostBtn = {
    padding: "10px 16px", borderRadius: 10, border: "1px solid var(--rc-border)",
    background: "transparent", color: "var(--rc-text-3)", cursor: "pointer",
    fontSize: 12.5, fontFamily: "var(--rc-font-ui)",
  };

  return (
    <div className="rc" onClick={forced ? undefined : onClose} role="dialog" aria-modal="true"
      aria-label={t.title}
      style={{ position: "fixed", inset: 0, zIndex: 1090, display: "flex", alignItems: "center",
        justifyContent: "center", padding: 24, isolation: "isolate",
        background: "radial-gradient(120% 90% at 50% 40%,rgba(11,7,8,.35),rgba(8,5,6,.82))",
        backdropFilter: "blur(3px)", animation: "gpFade .2s ease" }}>
      <div ref={cardRef} onClick={(e) => e.stopPropagation()}
        style={{ width: 452, maxWidth: "100%", background: "var(--rc-surface)",
          border: "1px solid var(--rc-border-strong)", borderRadius: 18, overflow: "hidden",
          boxShadow: "0 30px 80px rgba(0,0,0,.62), 0 0 0 1px rgba(0,0,0,.4)",
          animation: "gpPop .3s cubic-bezier(.2,.9,.3,1.1)" }}>

        {/* üst aksan şeridi */}
        <div style={{ height: 3, background: "linear-gradient(90deg,var(--rc-brand),var(--rc-brand-bright) 45%,var(--rc-warn))" }} />

        {/* başlık */}
        <div style={{ padding: "22px 24px 18px", display: "flex", alignItems: "flex-start", gap: 16 }}>
          <div style={{ flex: "0 0 auto", width: 52, height: 52, borderRadius: 14,
            background: "radial-gradient(120% 120% at 30% 20%,rgba(245,178,61,.24),rgba(245,178,61,.06))",
            border: "1px solid rgba(245,178,61,.4)", display: "flex", alignItems: "center",
            justifyContent: "center", animation: "gpBob 3.4s ease-in-out infinite" }}>
            <TrayIcon />
          </div>
          <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <h2 style={{ margin: 0, fontFamily: "var(--rc-font-display)", fontWeight: 700, fontSize: 22,
                letterSpacing: ".01em", lineHeight: 1.05, color: "var(--rc-text)" }}>{t.title}</h2>
              {newVersion && (
                <span style={{ fontFamily: "var(--rc-font-mono)", fontSize: 11, fontWeight: 600, color: "var(--rc-warn)",
                  background: "rgba(245,178,61,.12)", border: "1px solid rgba(245,178,61,.32)", borderRadius: 999,
                  padding: "2px 9px", letterSpacing: ".02em" }}>{newVersion}</span>
              )}
            </div>
            <p style={{ margin: "5px 0 0", fontSize: 12.5, lineHeight: 1.55, color: "var(--rc-text-3)" }}>{t.sub}</p>
          </div>
          {!forced && (
            <button onClick={onClose} title={t.close} aria-label={t.close}
              style={{ width: 30, height: 30, borderRadius: 9, border: "1px solid var(--rc-border)",
                background: "var(--rc-surface-3)", color: "var(--rc-text-3)", cursor: "pointer",
                fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>✕</button>
          )}
        </div>

        {/* sürüm geçişi */}
        {(oldVersion || newVersion) && (
          <div style={{ margin: "0 24px", display: "flex", alignItems: "center", gap: 12, padding: "11px 14px",
            border: "1px solid var(--rc-border)", borderRadius: 12, background: "var(--rc-surface-2)",
            fontFamily: "var(--rc-font-mono)" }}>
            {oldVersion && (
              <span style={{ fontSize: 12.5, color: "var(--rc-icon-off)", textDecoration: "line-through",
                textDecorationColor: "rgba(107,74,84,.6)" }}>{oldVersion}</span>
            )}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A88C93" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h13" /><path d="m13 6 6 6-6 6" /></svg>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--rc-text)" }}>{newVersion}</span>
            {size && <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--rc-text-3)" }}>{size}</span>}
          </div>
        )}

        {/* öne çıkanlar */}
        {rows.length > 0 && (
          <div style={{ padding: "18px 24px 6px" }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".14em",
              color: "var(--rc-text-3)", fontWeight: 600, marginBottom: 11 }}>{t.highlights}</div>
            {rows.map((tx, i) => (
              <div key={i} style={{ display: "flex", gap: 11, alignItems: "flex-start", marginBottom: 11 }}>
                <span style={{ flex: "0 0 auto", marginTop: 1, color: "var(--rc-brand-bright)" }}>{HL_ICONS[i]}</span>
                <span style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--rc-text-2)" }}>{tx}</span>
              </div>
            ))}
            <button onClick={onAllChanges}
              style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 3, fontSize: 12,
                color: "var(--rc-brand-bright)", background: "none", border: "none", padding: 0,
                cursor: "pointer", fontFamily: "var(--rc-font-ui)" }}>
              <span>{t.allChanges}</span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7M9 7h8v8" /></svg>
            </button>
          </div>
        )}

        {/* indirme çubuğu (yalnız downloading) */}
        {isDownloading && (
          <div style={{ padding: "12px 24px 4px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
              <span style={{ fontSize: 11.5, color: "var(--rc-text-2)", display: "inline-flex", alignItems: "center", gap: 7 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F5B23D" strokeWidth="2.4" strokeLinecap="round" style={{ animation: "gpSpin .9s linear infinite" }}><path d="M12 3a9 9 0 1 0 9 9" opacity=".9" /></svg>
                <span>{t.downloading}</span>
              </span>
              <span style={{ fontFamily: "var(--rc-font-mono)", fontSize: 11.5, color: "var(--rc-warn)", fontWeight: 600 }}>{Math.round(pct)}%</span>
            </div>
            <div style={{ height: 7, borderRadius: 999, background: "var(--rc-line-soft)", overflow: "hidden", position: "relative" }}>
              <div style={{ height: "100%", borderRadius: 999, background: "linear-gradient(90deg,var(--rc-brand-bright),var(--rc-warn))",
                width: `${Math.round(pct)}%`, transition: "width .2s ease", position: "relative", overflow: "hidden" }}>
                <span style={{ position: "absolute", inset: 0, width: "40%",
                  background: "linear-gradient(90deg,transparent,rgba(255,255,255,.4),transparent)",
                  animation: "gpShimmer 1.1s ease-in-out infinite" }} />
              </div>
            </div>
          </div>
        )}

        {/* alt bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 24px 20px", marginTop: 8,
          borderTop: "1px solid var(--rc-line-soft)", flexWrap: "wrap" }}>
          <label onClick={onToggleAuto} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11.5,
            color: "var(--rc-text-3)", cursor: "pointer", userSelect: "none" }}>
            <span style={{ width: 17, height: 17, flex: "0 0 auto", borderRadius: 5, display: "inline-flex",
              alignItems: "center", justifyContent: "center", transition: "all .15s ease",
              border: autoRestart ? "1px solid var(--rc-warn)" : "1px solid var(--rc-border-strong)",
              background: autoRestart ? "var(--rc-warn)" : "transparent" }}>
              {autoRestart && (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#0B0708" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7" /></svg>
              )}
            </span>
            <span>{t.autoRestart}</span>
          </label>

          <span style={{ marginLeft: "auto", display: "flex", gap: 9, alignItems: "center" }}>
            {isIdle && (<>
              {!forced && <button onClick={onLater} style={ghostBtn}>{t.later}</button>}
              <button ref={primaryRef} onClick={onUpdate}
                style={{ ...primBtn, border: "1px solid var(--rc-warn)",
                  background: "linear-gradient(180deg,rgba(245,178,61,.22),rgba(245,178,61,.1))", color: "var(--rc-warn)" }}>
                <TrayIcon size={15} stroke="currentColor" sw={2} />{t.update}
              </button>
            </>)}
            {isDownloading && (
              <button onClick={onLater} style={ghostBtn}>{t.bgDownload}</button>
            )}
            {isReady && (<>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--rc-ok)", marginRight: 2 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#37D67A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ strokeDasharray: 26, strokeDashoffset: 26, animation: "gpCheck .4s ease .05s forwards" }}><path d="m5 12.5 4.5 4.5L19 7" /></svg>
                {t.downloaded}
              </span>
              <button ref={primaryRef} onClick={onRestart}
                style={{ ...primBtn, border: "1px solid var(--rc-ok)",
                  background: "linear-gradient(180deg,rgba(55,214,122,.2),rgba(55,214,122,.08))", color: "var(--rc-ok)" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 11.5A8 8 0 1 0 18.2 17" /><path d="M20 5.5V11h-5.5" /></svg>
                {t.restart}
              </button>
            </>)}
          </span>
        </div>
      </div>
    </div>
  );
}
