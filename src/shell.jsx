/* ============================================================
   shell.jsx — v2.0 kabuk: 76px sol ray + birleşik sticky yarış çubuğu
   ------------------------------------------------------------
   Kaynak: docs/design-handoff/Yeni Tasarım.dc.html (<nav> ve isRace <header>
   blokları) + README.md §2 "Yarış çubuğu" ve "Interactions & Behavior".

   SAF SUNUM: kendi state'i yok — `screen`/`go` App.jsx'teki tek yönlendirme
   noktasından gelir (src/nav.js). Tüm stil sınıf-tabanlı (src/styles.js
   .rail* / .rb* / .guide / .empty*); inline stil YALNIZ hesaplanan değerler
   için kullanılır (ilerleme çubuğu genişliği).
   ============================================================ */
import { useState, useEffect, useRef } from "react";
import { ASSET } from "./constants";
import { Icon } from "./components";

/* Ray sırası README "Interactions & Behavior"tan: Menü / Takım / Dash / Stint /
   Yakıt / Canlı / Lastik / Pilot / Tele / Setup, altta Sohbet + sürüm. */
export const RAIL_ITEMS = [
  { id: "team",    icon: "building",  label: "Takım" },
  { id: "dash",    icon: "gauge",     label: "Dash" },
  { id: "stint",   icon: "stopwatch", label: "Stint" },
  { id: "fuel",    icon: "zap",       label: "Yakıt",  title: "Son Stint Yakıtı" },
  { id: "live",    icon: "live",      label: "Canlı" },
  { id: "tyre",    icon: "tyre",      label: "Lastik" },
  { id: "drivers", icon: "steering",  label: "Pilot" },
  { id: "tele",    icon: "chart",     label: "Tele",   title: "Telemetri" },
  { id: "setup",   icon: "cog",       label: "Setup" },
];

export function Rail({
  t, screen, go, onHome, open = true, onToggle,
  version, chatScreen = "chat", unread = 0, onChat, hideChat = false,
}) {
  /* stint ve code80 aynı ekranın iki modu — ikisinde de Stint aktif görünür. */
  const isOn = (id) => screen === id || (id === "stint" && screen === "code80");
  return (
    <>
      {!open && (
        <button className="railopen" onClick={onToggle} title={t("Menüyü aç")}
          aria-label={t("Menüyü aç")}>☰</button>
      )}
      <nav className={`rail${open ? "" : " hidden"}`} aria-label={t("Ana menü")}
        data-tour="tabs">
        <button className="railtoggle" onClick={onToggle} title={t("Menüyü gizle")}
          aria-label={t("Menüyü gizle")}>‹</button>

        <button className={`railbtn${screen === "home" ? " on" : ""}`} onClick={onHome}>
          <img src={`${ASSET}logo.png`} alt="Caspian" width="40" />
          <span>{t("Menü")}</span>
        </button>
        <span className="railsep" />

        {RAIL_ITEMS.map((it) => (
          <button key={it.id} className={`railbtn${isOn(it.id) ? " on" : ""}`}
            title={t(it.title || it.label)} aria-current={isOn(it.id) ? "page" : undefined}
            onClick={() => go(it.id)}>
            <Icon name={it.icon} size={20} />
            <span>{t(it.label)}</span>
          </button>
        ))}

        <div className="railfoot">
          <span className="railsep" />
          {!hideChat && (
            <span className="railbtnwrap">
              <button className={`railbtn${screen === chatScreen ? " on" : ""}`}
                title={t("Sohbet")} onClick={onChat || (() => go(chatScreen))}>
                <Icon name="chat" size={20} />
                <span>{t("Sohbet")}</span>
              </button>
              {unread > 0 && <b className="railbadge">{unread > 99 ? "99+" : unread}</b>}
            </span>
          )}
          <span className="railver">{version}</span>
        </div>
      </nav>
    </>
  );
}

/* Ekran üstü tek satırlık ipucu (README §17). İkon ve kapatma düğmesi YOK. */
export function Guide({ title, text }) {
  if (!title && !text) return null;
  return (
    <div className="guide">
      <b>{title}</b>
      <span>{text}</span>
    </div>
  );
}

/* Sistematik boş durum bloğu (README §Boş durumlar + i18n-EN.md §2). */
export function EmptyState({ icon, title, text, children }) {
  return (
    <div className="empty">
      {icon && <span className="empty-i">{icon}</span>}
      <b>{title}</b>
      {text && <p>{text}</p>}
      {children && <span className="empty-act">{children}</span>}
    </div>
  );
}

/* Birleşik sticky yarış çubuğu — handoff 00-yaris-ust-cubugu.md (markup birebir).
   Bloklar: (a) bayrak + yarış adı (+ izleyici rozeti) · orta flex:1 sarmalı 4 HUD
   hücresi (bayrağa kalan 1.4 · sıradaki pit 1 · pozisyon .8 · enerji .7) · (f) sağ
   blok: köprü durumu (açılır pop-up) + Yarış datası + Pit Board.

   Stil satır içine taşındı (fiş: FuelTab/DashTab deseni); renkler --rc-* token.
   `feed` (araç verisi akıyor mu) gerçek `liveOn` sinyaline bağlı; köprü pop-up
   açık/kapalı LOKAL useState. Test çıpaları (rbpitring/rbdirty/rblive) korunur.

   NOT: köprü düğmesi artık `onBridge`(→ Canlı'ya git) yerine köprü durum
   pop-up'ını açar (fiş). `onBridge` imzada korunur; Canlı ekranına gitmek sol
   raydaki "Canlı" düğmesiyle hâlâ mümkün. */
export function RaceBar({
  t, flagSrc, name, meta, viewer = false,
  remain, remainPct = 0, remainLabel,
  nextPit, nextPitSub, pitAlert = false,
  pos, posCls, posClsColor, posSub,
  energy, energyPct = 0, energySub,
  liveOn = false, liveLabel, onBridge,
  onRaceData, dirtyN = 0, onPitBoard,
}) {
  /* Köprü durum pop-up'ı açık/kapalı — lokal (fişte this.state.bridge). */
  const [bridgeOpen, setBridgeOpen] = useState(false);
  /* Araç verisi akıyor mu — varsayılan gerçek `liveOn`; kullanıcı önizleme için
     elle değiştirebilir (fişteki toggleFeed). */
  const [feedManual, setFeedManual] = useState(null);
  const feed = feedManual == null ? liveOn : feedManual;
  const toggleFeed = () => setFeedManual((v) => !(v == null ? liveOn : v));

  /* Dışarı tıkla → kapat (nice-to-have; SSR'de çalışmaz, testte etkisiz). */
  const popRef = useRef(null);
  useEffect(() => {
    if (!bridgeOpen) return undefined;
    const onDoc = (e) => {
      if (popRef.current && !popRef.current.contains(e.target)) setBridgeOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [bridgeOpen]);

  const disp = "var(--rc-font-display)";
  const clamp = (n) => Math.max(0, Math.min(100, Number(n) || 0));

  /* --- yeniden kullanılan stil objeleri (fiş: renderVals) --- */
  const hudLbl = { color: "var(--rc-text-3)", fontSize: 10, textTransform: "uppercase",
    letterSpacing: ".12em" };
  const staleDot = feed
    ? { display: "none" }
    : { width: 6, height: 6, borderRadius: "50%", background: "var(--rc-warn)",
      flex: "0 0 auto", animation: "rcpulse 1.6s ease-in-out infinite" };

  const posCell = { flex: ".8", display: "flex", flexDirection: "column",
    justifyContent: "center", gap: 2, padding: "10px 22px",
    borderRight: "1px solid var(--rc-border)",
    background: feed ? "transparent" : "rgba(245,178,61,.06)" };
  const posValStyle = { fontFamily: disp, fontWeight: 700, lineHeight: .95,
    fontSize: "clamp(30px,3.2vw,44px)", color: feed ? "var(--rc-text)" : "var(--rc-border-strong)" };
  const posClsStyle = feed ? { fontSize: ".45em", color: posClsColor || "var(--rc-cls-gt3)" }
    : { display: "none" };
  const posSubStyle = !feed ? { fontSize: 11, color: "var(--rc-warn)" }
    : posSub ? { fontSize: 11, color: "var(--rc-text-3)" } : { display: "none" };

  const nrgCell = { flex: ".7", display: "flex", flexDirection: "column",
    justifyContent: "center", gap: 4, padding: "10px 22px",
    borderRight: "1px solid var(--rc-border)",
    background: feed ? "transparent" : "rgba(245,178,61,.06)" };
  const nrgValStyle = { fontFamily: disp, fontWeight: 700, fontVariantNumeric: "tabular-nums",
    lineHeight: .95, fontSize: "clamp(26px,2.6vw,36px)",
    color: feed ? "var(--rc-ok)" : "var(--rc-border-strong)" };
  const nrgBar = { display: "block", height: "100%", width: feed ? `${clamp(energyPct)}%` : "100%",
    background: feed ? "var(--rc-ok)"
      : "repeating-linear-gradient(90deg,var(--rc-border-strong) 0 6px,transparent 6px 12px)" };
  const nrgSubStyle = !feed ? { fontSize: 11, color: "var(--rc-warn)" }
    : energySub ? { fontSize: 11, color: "var(--rc-text-3)" } : { display: "none" };

  const pitValStyle = { display: "inline-block", fontFamily: disp, fontWeight: 700,
    fontVariantNumeric: "tabular-nums", fontSize: "clamp(30px,3.2vw,44px)", lineHeight: .95,
    color: "var(--rc-warn)", borderRadius: 10,
    animation: pitAlert ? "rcalert 2.6s ease-in-out infinite" : undefined };

  const roTag = {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
    marginTop: 12, alignSelf: "center", padding: "4px 12px", borderRadius: 8,
    border: "1px solid var(--rc-warn)", background: "rgba(245,178,61,.10)",
    color: "var(--rc-warn)", fontSize: 11, textTransform: "uppercase",
    letterSpacing: ".08em", whiteSpace: "nowrap",
  };

  const rdBtn = {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
    padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontSize: 12, whiteSpace: "nowrap",
    border: "1px solid var(--rc-border)", background: "var(--rc-surface-3)", color: "var(--rc-text)",
    transition: "background .18s ease, border-color .18s ease",
  };
  const rdDirty = { background: "var(--rc-warn)", color: "var(--rc-bg)", borderRadius: 99,
    fontSize: 9.5, fontWeight: 700, padding: "0 5px", lineHeight: 1.6 };
  const pbBtn = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
    padding: "6px 12px", borderRadius: 8, border: "1px solid var(--rc-border)",
    background: "var(--rc-surface-3)", color: "var(--rc-text)", cursor: "pointer",
    fontSize: 12, whiteSpace: "nowrap" };

  const feedBtn = {
    marginLeft: "auto", padding: "5px 12px", borderRadius: 8, cursor: "pointer", fontSize: 11,
    fontFamily: disp, textTransform: "uppercase", letterSpacing: ".05em",
    border: `1px solid ${feed ? "rgba(55,214,122,.5)" : "var(--rc-warn)"}`,
    background: "transparent", color: feed ? "var(--rc-ok)" : "var(--rc-warn)",
  };

  const bridgePop = bridgeOpen
    ? { position: "absolute", right: 0, top: "calc(100% + 9px)", zIndex: 70, width: 320,
      background: "var(--rc-surface)", border: "1px solid var(--rc-border-strong)", borderRadius: 13,
      boxShadow: "0 16px 44px rgba(0,0,0,.55)", display: "block", overflow: "hidden",
      textAlign: "left", textTransform: "none", letterSpacing: 0, color: "var(--rc-text)",
      fontFamily: "var(--rc-font-ui)" }
    : { display: "none" };

  /* MOCK — köprü durum satırları: gerçek prop yok (App.jsx'ten beslenmeli). */
  const bridgeRows = [
    { k: t("Canlı kaynak"), v: "Kerem Yılmaz", col: "var(--rc-text)" },
    { k: t("Kare hızı"), v: "2.5 Hz · 0.4 sn", col: "var(--rc-text)" },
    { k: t("Son kare"), v: "0.3 sn önce", col: "var(--rc-ok)" },
    { k: t("Kaydedilen tur"), v: "412", col: "var(--rc-text)" },
    { k: t("Sahadaki araç"), v: "34", col: "var(--rc-text)" },
  ].map((b) => ({ ...b, vStyle: { fontFamily: disp, fontSize: 11.5, color: b.col } }));

  const cellBorder = "1px solid var(--rc-border)";

  return (
    <header style={{ position: "sticky", top: 0, zIndex: 20, display: "flex",
      alignItems: "stretch", gap: 0, borderBottom: cellBorder,
      /* FLAG: #1A1013 fişte "token yok — sor" → ham hex korundu. */
      background: "linear-gradient(180deg,#1A1013,var(--rc-surface))" }}>

      {/* (a) bayrak + yarış adı (+ izleyici rozeti) */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 20px",
        minWidth: 250 }}>
        {flagSrc && <img src={flagSrc} alt=""
          style={{ width: 34, borderRadius: 3, border: cellBorder }} />}
        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <span style={{ fontFamily: disp, fontWeight: 700, fontSize: 22, lineHeight: 1,
            letterSpacing: ".02em" }}>{name}</span>
          {meta && <span style={{ fontSize: 11, color: "var(--rc-text-3)",
            whiteSpace: "nowrap" }}>{meta}</span>}
          {viewer && (
            <span style={roTag}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--rc-warn)"
                strokeWidth="1.9" strokeLinecap="round" style={{ flex: "0 0 auto" }}>
                <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z" />
                <circle cx="12" cy="12" r="2.7" />
              </svg>
              {t("İzleyici modu")}
            </span>
          )}
        </div>
      </div>

      {/* orta flex:1 sarmalı — 4 HUD hücresi */}
      <div style={{ flex: 1, display: "flex", alignItems: "stretch", borderLeft: cellBorder }}>

        {/* (b) bayrağa kalan + ilerleme */}
        {remain != null && (
          <div style={{ flex: 1.4, display: "flex", flexDirection: "column",
            justifyContent: "center", gap: 2, padding: "10px 22px", borderRight: cellBorder }}>
            <span style={hudLbl}>{remainLabel || t("Bayrağa kalan")}</span>
            <span style={{ fontFamily: disp, fontWeight: 700, fontVariantNumeric: "tabular-nums",
              fontSize: "clamp(38px,4.2vw,60px)", lineHeight: .9, color: "var(--rc-text)" }}>{remain}</span>
            {/* hesaplanan değer → satır içi genişlik */}
            <div style={{ height: 3, borderRadius: 2, background: "var(--rc-line-soft)",
              overflow: "hidden", marginTop: 6 }}>
              <i style={{ display: "block", height: "100%", width: `${clamp(remainPct)}%`,
                background: "var(--rc-brand)" }} />
            </div>
          </div>
        )}

        {/* (c) sıradaki pit (amber, nabız halkası) */}
        {nextPit != null && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center",
            gap: 2, padding: "10px 22px", borderRight: cellBorder,
            background: "rgba(245,178,61,.07)" }}>
            <span style={hudLbl}>{t("Sıradaki pit")}</span>
            <span style={pitValStyle} className={pitAlert ? "rbpitring" : undefined}>{nextPit}</span>
            {nextPitSub && <span style={{ fontSize: 11, color: "var(--rc-text-2)" }}>{nextPitSub}</span>}
          </div>
        )}

        {/* (d) pozisyon */}
        {pos != null && (
          <div style={posCell}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={hudLbl}>{t("Pozisyon")}</span>
              <i style={staleDot} />
            </span>
            <span style={posValStyle}>{feed ? pos : "—"}
              {posCls && <span style={posClsStyle}> · {posCls}</span>}</span>
            <span style={posSubStyle}>
              {feed ? posSub : <>{t("köprü verisi yok · son")} 18:41</>}</span>
          </div>
        )}

        {/* (e) enerji */}
        {energy != null && (
          <div style={nrgCell}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={hudLbl}>{t("Enerji")}</span>
              <i style={staleDot} />
            </span>
            <span style={nrgValStyle}>{feed ? energy : "—"}</span>
            <div style={{ height: 3, borderRadius: 2, background: "var(--rc-line-soft)",
              overflow: "hidden" }}><i style={nrgBar} /></div>
            <span style={nrgSubStyle}>
              {feed ? energySub : <>{t("son değer")} 3 {t("dk önce")}</>}</span>
          </div>
        )}
      </div>

      {/* (f) sağ blok: köprü durumu + Yarış datası + Pit Board */}
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center",
        alignItems: "stretch", gap: 7, padding: "10px 18px", borderLeft: cellBorder }}>

        <span ref={popRef} style={{ position: "relative", display: "flex" }}>
          <button className={`rblive${liveOn ? "" : " off"}`}
            onClick={() => setBridgeOpen((o) => !o)} title={t("Köprü durumu ve kaydı")}
            style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center",
              gap: 6, fontSize: 11, fontFamily: disp, letterSpacing: ".04em", padding: "5px 11px",
              borderRadius: 8, textTransform: "uppercase", background: "transparent",
              whiteSpace: "nowrap", cursor: "pointer",
              border: `1px solid ${liveOn ? "rgba(55,214,122,.5)" : "var(--rc-warn)"}`,
              color: liveOn ? "var(--rc-ok)" : "var(--rc-warn)" }}>
            <i style={{ width: 8, height: 8, borderRadius: "50%",
              background: liveOn ? "var(--rc-ok)" : "var(--rc-warn)",
              boxShadow: liveOn ? "0 0 8px var(--rc-ok)" : "0 0 8px var(--rc-warn)",
              animation: "rcpulse 1.2s ease-in-out infinite" }} />
            {liveLabel} <span style={{ opacity: .6 }}>▾</span>
          </button>

          <span style={bridgePop}>
            <span style={{ display: "flex", alignItems: "center", gap: 9, padding: "13px 16px",
              borderBottom: cellBorder }}>
              <span style={{ fontSize: 15 }}>🛰</span>
              <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                <b style={{ fontFamily: disp, fontSize: 15, letterSpacing: ".03em" }}>
                  {t("Canlı köprü")}</b>
                {/* MOCK: sürüm — gerçek kaynak yok */}
                <span style={{ fontSize: 10.5, color: "var(--rc-text-3)" }}>
                  {t("otomatik")} · v1.8.18</span>
              </span>
              <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center",
                gap: 6, fontSize: 10, textTransform: "uppercase", letterSpacing: ".09em",
                padding: "3px 9px", borderRadius: 99, border: "1px solid var(--rc-ok)",
                color: "var(--rc-ok)" }}>
                <i style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--rc-ok)",
                  boxShadow: "0 0 6px var(--rc-ok)" }} />{t("çalışıyor")}
              </span>
            </span>

            {/* MOCK: köprü ölçüm satırları — gerçek prop yok */}
            <span style={{ display: "block", padding: "12px 16px", borderBottom: cellBorder }}>
              {bridgeRows.map((b) => (
                <span key={b.k} style={{ display: "flex", justifyContent: "space-between", gap: 12,
                  padding: "3px 0", fontSize: 11.5 }}>
                  <span style={{ color: "var(--rc-text-3)" }}>{b.k}</span>
                  <b style={b.vStyle}>{b.v}</b>
                </span>
              ))}
            </span>

            <span style={{ display: "block", padding: "11px 16px", borderBottom: cellBorder }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5,
                color: "var(--rc-ok)" }}>
                <i style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--rc-danger)",
                  boxShadow: "0 0 7px var(--rc-danger)", flex: "0 0 auto" }} />
                {/* MOCK: 34 araç · 412 tur */}
                {t("Tur geçmişi kaydediliyor")} · 34 {t("araç")} · 412 {t("tur")}
              </span>
              <span style={{ display: "block", fontSize: 11, color: "var(--rc-text-3)",
                marginTop: 6, lineHeight: 1.5 }}>
                📼 {t("Köprü bağımsız kaydediyor — web kapalıyken de tur geçmişi birikir.")}</span>
            </span>

            <span style={{ display: "block", padding: "11px 16px", borderBottom: cellBorder }}>
              <span style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 11,
                color: "var(--rc-warn)", lineHeight: 1.55 }}>
                <span style={{ flex: "0 0 auto" }}>⚡</span>
                <span>{t("Oyun eklentisi saniyede ~400 kez okumadığımız veriyi yazıyor (FFB, Graphics) — oyunda takılma yapar.")}
                  {/* MOCK: UnsubscribedBuffersMask değeri */}
                  <b style={{ display: "block", marginTop: 4, fontFamily: disp, fontSize: 10.5,
                    color: "var(--rc-text)" }}>UnsubscribedBuffersMask: 96</b>
                </span>
              </span>
              <button style={{ marginTop: 8, padding: "5px 11px", borderRadius: 8,
                border: cellBorder, background: "var(--rc-surface-3)", color: "var(--rc-text-2)",
                cursor: "pointer", fontSize: 11 }}>{t("Değeri kopyala")}</button>
            </span>

            <span style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 16px",
              borderBottom: cellBorder }}>
              <button style={{ padding: "6px 12px", borderRadius: 8, border: cellBorder,
                background: "var(--rc-surface-3)", color: "var(--rc-text)", cursor: "pointer",
                fontSize: 11.5 }}>🗑 {t("Tur geçmişini temizle")}</button>
              <button style={{ marginLeft: "auto", padding: "6px 12px", borderRadius: 8,
                border: cellBorder, background: "transparent", color: "var(--rc-text-3)",
                cursor: "pointer", fontSize: 11.5 }}>{t("Günlük")}</button>
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 16px" }}>
              <span style={{ fontSize: 11, color: "var(--rc-text-3)" }}>
                {t("Araç verisi (pozisyon · enerji)")}</span>
              <button onClick={toggleFeed} style={feedBtn}>
                {feed ? t("Akıyor") : t("Veri yok")}</button>
            </span>
          </span>
        </span>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          <button onClick={onRaceData} style={rdBtn}>⚙ {t("Yarış datası")}
            {dirtyN > 0 && <span style={rdDirty} className="rbdirty">{dirtyN}</span>}</button>
          <button onClick={onPitBoard} data-tour="pitboard" style={pbBtn}>
            📟 {t("Pit Board")}</button>
        </div>
      </div>
    </header>
  );
}

/* Sheet — AYNI gövdeyi hem pencere hem TAM SAYFA olarak çizer.
   v2.0'da Takım · Sohbet · Telemetri · Setup havuzu modal kabuğundan (wxmodal /
   wxmbox) çıkıp sol raydan erişilen tam sayfa ekran oluyor. İki ayrı bileşen
   yazmak yerine kabuk buradan seçiliyor → içerik tek yerde kalıyor.

   Tam sayfada ✕ "kapat" değil GERİ'dir: açık pencereyi kapatmak yerine önceki
   ekrana dönülür (ARAYUZ-YENILEME-PROMPT-v2 · tam sayfa kuralı). */
export function Sheet({ page, title, onClose, width, headExtra, children }) {
  if (page) {
    return (
      <section className="v2page">
        <div className="v2pagehead">
          <span className="ttl disp">{title}</span>
          {headExtra}
          {onClose && (
            <button className="lbclose" onClick={onClose} title="←"
              aria-label="←">←</button>
          )}
        </div>
        {children}
      </section>
    );
  }
  return (
    <div className="wxmodal" onClick={onClose}>
      <div className="wxmbox" style={width ? { width } : undefined}
        onClick={(e) => e.stopPropagation()}>
        <div className="wxmhead">
          <span>{title}</span>
          {headExtra}
          <button className="lbclose" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
