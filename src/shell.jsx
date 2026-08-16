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
      <nav className={`rail${open ? "" : " hidden"}`} aria-label={t("Ana menü")}>
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

/* Birleşik sticky yarış çubuğu — README §2.
   Bloklar: (a) bayrak + yarış adı (+ izleyici rozeti) · (b) bayrağa kalan +
   ilerleme · (c) sıradaki pit (amber, nabız halkası) · (d) pozisyon ·
   (e) enerji · (f) sağ blok: canlı durum + Yarış datası + Pit Board. */
export function RaceBar({
  t, flagSrc, name, meta, viewer = false,
  remain, remainPct = 0,
  nextPit, nextPitSub, pitAlert = false,
  pos, posCls, posClsColor, posSub,
  energy, energyPct = 0, energySub,
  liveOn = false, liveLabel, onBridge,
  onRaceData, dirtyN = 0, onPitBoard,
}) {
  return (
    <header className="racebar">
      <div className="rbblock rbrace">
        {flagSrc && <img className="rbflag" src={flagSrc} alt="" />}
        <div>
          <span className="rbname disp">{name}</span>
          {meta && <span className="rbmeta">{meta}</span>}
          {viewer && (
            <span className="rbviewer">
              <Icon name="eye" size={15} />{t("İzleyici modu")}
            </span>
          )}
        </div>
      </div>

      {remain != null && (
        <div className="rbblock">
          <span className="rblabel">{t("Bayrağa kalan")}</span>
          <span className="rbnum lg">{remain}</span>
          {/* hesaplanan değer → inline genişlik (token'a çevrilemez) */}
          <div className="rbbar"><i style={{ width: `${Math.max(0, Math.min(100, remainPct))}%` }} /></div>
        </div>
      )}

      {nextPit != null && (
        <div className={`rbblock rbpit${pitAlert ? " rbpitring" : ""}`}>
          <span className="rblabel">{t("Sıradaki pit")}</span>
          <span className="rbnum">{nextPit}</span>
          {nextPitSub && <span className="rbmeta">{nextPitSub}</span>}
        </div>
      )}

      {pos != null && (
        <div className="rbblock">
          <span className="rblabel">{t("Pozisyon")}</span>
          <span className="rbnum">
            {pos}
            {posCls && <span className="rbcls" style={{ color: posClsColor }}> · {posCls}</span>}
          </span>
          {posSub && <span className="rbmeta">{posSub}</span>}
        </div>
      )}

      {energy != null && (
        <div className="rbblock rbenergy">
          <span className="rblabel">{t("Enerji")}</span>
          <span className="rbnum">{energy}</span>
          <div className="rbbar"><i style={{ width: `${Math.max(0, Math.min(100, energyPct))}%` }} /></div>
          {energySub && <span className="rbmeta">{energySub}</span>}
        </div>
      )}

      <div className="rbside">
        <button className={`rblive${liveOn ? "" : " off"}`} onClick={onBridge}
          title={t("Köprü durumu ve kaydı")}>
          <i />{liveLabel}
        </button>
        <span className="rbsiderow">
          <button className="rbbtn" onClick={onRaceData}>
            ⚙ {t("Yarış datası")}
            {dirtyN > 0 && <span className="rbdirty">{dirtyN}</span>}
          </button>
          <button className="rbbtn" onClick={onPitBoard}>📟 {t("Pit Board")}</button>
        </span>
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
